#!/usr/bin/env python3
"""Generate Seed TTS 2.0 narration from a VideoSpec script.

The generator reads only blockquoted text under **口播：**. It loads the key
from VOLCENGINE_TTS_API_KEY (or X_API_KEY), then falls back to the local,
owner-only videospec/.secrets/tts.env created by `videospec init`.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ENDPOINT = "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional"
RESOURCE_ID = "seed-tts-2.0"
DEFAULT_SPEAKER = "zh_male_m191_uranus_bigtts"
NARRATION_LOCK_FILE = "narration-lock.json"


def prose_audio_profile(content: str, spec_file: Path) -> dict:
    """Read the previous v6 prose format without overriding project targets."""
    voice_block = re.search(r"^### Standard: Narration uses a non-destructive, controlled voice master\s*\n([\s\S]*?)(?=^### Standard:|\Z)", content, re.MULTILINE)
    mix_block = re.search(r"^### Standard: Final video mix is delivery-ready\s*\n([\s\S]*?)(?=^### Standard:|\Z)", content, re.MULTILINE)
    if not voice_block or not mix_block:
        raise RuntimeError(f"Audio profile JSON is missing from {spec_file}; add the current Audio profile block.")

    def value(text: str, pattern: str, label: str) -> str:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            raise RuntimeError(f"Cannot read {label} from {spec_file}; add the current Audio profile block.")
        return match.group(1)

    voice = voice_block.group(1)
    mix = mix_block.group(1)
    voice_format = re.search(r"narration master SHALL be (mono|stereo) (\d+) kHz / (\d+)-bit PCM WAV", voice)
    mix_format = re.search(r"final video audio SHALL be (mono|stereo) (\d+) kHz", mix)
    if not voice_format or not mix_format:
        raise RuntimeError(f"Cannot read audio formats from {spec_file}; add the current Audio profile block.")
    codec = {"16": "pcm_s16le", "24": "pcm_s24le"}.get(voice_format.group(3))
    return {
        "voiceMaster": {
            "highPassHz": int(value(voice, r"(\d+) Hz high-pass", "high-pass")),
            "compressionRatio": float(value(voice, r"([\d.]+):1 speech compression", "compression ratio")),
            "safetyLimiterDbfs": float(value(voice, r"(-[\d.]+) dB safety limiter", "safety limiter")),
            "sampleRateHz": int(voice_format.group(2)) * 1000,
            "channels": 1 if voice_format.group(1) == "mono" else 2,
            "codec": codec,
            "integratedLoudnessLufs": float(value(voice, r"to (-[\d.]+) LUFS", "voice loudness")),
            "loudnessRangeLu": float(value(voice, r"([\d.]+) LU loudness range", "loudness range")),
            "truePeakDbtp": float(value(voice, r"no more than (-[\d.]+) dBTP", "voice true peak")),
        },
        "finalMix": {
            "sampleRateHz": int(mix_format.group(2)) * 1000,
            "channels": 1 if mix_format.group(1) == "mono" else 2,
            "integratedLoudnessLufs": float(value(mix, r"to (-[\d.]+) LUFS", "final mix loudness")),
            "truePeakDbtp": float(value(mix, r"no more than (-[\d.]+) dBTP", "final mix true peak")),
        },
    }


def load_audio_profile(script_path: Path) -> tuple[dict, Path]:
    """Read the current project's audio targets from its durable standard."""
    spec_file = next(
        (parent / "videospec" / "specs" / "audio" / "spec.md"
         for parent in script_path.parents
         if (parent / "videospec" / "specs" / "audio" / "spec.md").is_file()),
        None,
    )
    if spec_file is None:
        raise RuntimeError("Project audio standard not found at videospec/specs/audio/spec.md.")
    content = spec_file.read_text(encoding="utf-8")
    match = re.search(r"^#### Audio profile\s*\n+```json\s*\n([\s\S]*?)\n```", content, re.MULTILINE)
    if match:
        try:
            profile = json.loads(match.group(1))
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Audio profile JSON is invalid in {spec_file}: {error}") from error
    else:
        profile = prose_audio_profile(content, spec_file)
    if not isinstance(profile, dict) or not isinstance(profile.get("voiceMaster"), dict) or not isinstance(profile.get("finalMix"), dict):
        raise RuntimeError(f"Audio profile must contain voiceMaster and finalMix objects: {spec_file}")

    def numeric(section: str, key: str, minimum: float, maximum: float, *, integer: bool = False) -> None:
        value = profile[section].get(key)
        if type(value) not in (int, float) or not math.isfinite(value) or not minimum <= value <= maximum or (integer and int(value) != value):
            raise RuntimeError(f"Invalid audio profile {section}.{key} in {spec_file}.")

    for key, low, high, integer in (
        ("highPassHz", 20, 300, True), ("compressionRatio", 1, 10, False),
        ("safetyLimiterDbfs", -12, -0.1, False), ("sampleRateHz", 8000, 192000, True),
        ("channels", 1, 2, True), ("integratedLoudnessLufs", -30, -8, False),
        ("loudnessRangeLu", 1, 20, False), ("truePeakDbtp", -12, -0.1, False),
    ):
        numeric("voiceMaster", key, low, high, integer=integer)
    for key, low, high, integer in (
        ("sampleRateHz", 8000, 192000, True), ("channels", 1, 2, True),
        ("integratedLoudnessLufs", -30, -8, False), ("truePeakDbtp", -12, -0.1, False),
    ):
        numeric("finalMix", key, low, high, integer=integer)
    if profile["voiceMaster"].get("codec") not in {"pcm_s16le", "pcm_s24le", "pcm_f32le"}:
        raise RuntimeError(f"Unsupported audio profile voiceMaster.codec in {spec_file}.")
    return profile, spec_file


def limiter_amplitude(dbfs: float) -> str:
    return f"{10 ** (dbfs / 20):.6f}"


def scene_conditioning_filter(profile: dict) -> str:
    voice = profile["voiceMaster"]
    return (
        f"highpass=f={voice['highPassHz']},"
        "deesser=i=0.15:m=0.5:f=0.5:s=o,"
        f"acompressor=threshold=0.125:ratio={voice['compressionRatio']}:attack=10:release=120:"
        "knee=3:makeup=1:link=average:detection=rms,"
        f"alimiter=limit={limiter_amplitude(voice['safetyLimiterDbfs'])}:level=0"
    )


def secret_key(script_path: Path) -> str:
    for name in ("VOLCENGINE_TTS_API_KEY", "X_API_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    for parent in (script_path.parent, *script_path.parents):
        credential = parent / "videospec" / ".secrets" / "tts.env"
        if not credential.is_file():
            continue
        for line in credential.read_text(encoding="utf-8").splitlines():
            if line.startswith("VOLCENGINE_TTS_API_KEY="):
                value = line.partition("=")[2].strip()
                if value:
                    return value
    raise SystemExit("Missing TTS credential. Re-run `videospec init` or set VOLCENGINE_TTS_API_KEY.")


def blockquote(section: str, label: str) -> str | None:
    marker = re.search(rf"^\*\*{re.escape(label)}：\*\*\s*$", section, re.MULTILINE)
    if not marker:
        return None
    lines: list[str] = []
    started = False
    for line in section[marker.end():].splitlines():
        if line.startswith(">"):
            started = True
            lines.append(re.sub(r"^> ?", "", line).strip())
        elif started and line.strip():
            break
    value = "\n".join(lines).strip()
    return value or None


def parameters(section: str) -> dict[str, str]:
    source = blockquote(section, "合成参数") or ""
    return dict(re.findall(r"^([a-z][a-z0-9_]*):\s*(.*?)\s*$", source, re.MULTILINE))


def interface_parameters(section: str) -> dict[str, str]:
    source = blockquote(section, "接口与音频参数") or ""
    return dict(re.findall(r"^([a-z][a-z0-9_]*):\s*(.*?)\s*$", source, re.MULTILINE))


def usable_config_value(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned or re.search(r"TODO|待填写|待确定|Unresolved|内容审批|^None$", cleaned, re.IGNORECASE):
        return None
    if cleaned.startswith("<!--") or cleaned.endswith("-->"):
        return None
    return cleaned


def config_int(values: dict[str, str], key: str, default: int, minimum: int, maximum: int) -> int:
    raw = usable_config_value(values.get(key))
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise SystemExit(f"Invalid {key} in **接口与音频参数：**") from error
    if not minimum <= value <= maximum:
        raise SystemExit(f"Invalid {key}: expected {minimum}..{maximum}")
    return value


def config_bool(values: dict[str, str], key: str, default: bool) -> bool:
    raw = usable_config_value(values.get(key))
    if raw is None:
        return default
    lowered = raw.lower()
    if lowered in {"true", "yes", "1"}:
        return True
    if lowered in {"false", "no", "0"}:
        return False
    raise SystemExit(f"Invalid {key} in **接口与音频参数：**; expected true or false")


def tts_configuration(script: str, speaker_override: str | None, format_override: str | None) -> dict[str, object]:
    values = interface_parameters(script)
    speaker = usable_config_value(speaker_override) or usable_config_value(values.get("speaker")) or DEFAULT_SPEAKER
    audio_format = usable_config_value(format_override) or usable_config_value(values.get("format")) or "wav"
    if audio_format not in {"mp3", "wav"}:
        raise SystemExit("Invalid format: expected mp3 or wav")
    explicit_language = usable_config_value(values.get("explicit_language")) or "zh-cn"
    return {
        "speaker": speaker,
        "format": audio_format,
        "sample_rate": config_int(values, "sample_rate", 24000, 8000, 96000),
        "bit_rate": config_int(values, "bit_rate", 128000, 8000, 512000),
        "enable_subtitle": config_bool(values, "enable_subtitle", True),
        "explicit_language": explicit_language,
        "disable_markdown_filter": config_bool(values, "disable_markdown_filter", False),
        "max_length_to_filter_parenthesis": config_int(values, "max_length_to_filter_parenthesis", 0, 0, 100000),
        "aigc_watermark": config_bool(values, "aigc_watermark", False),
    }


def bounded_int(values: dict[str, str], key: str, default: int, minimum: int, maximum: int, scene: str) -> int:
    try:
        value = int(values.get(key, default))
    except ValueError as error:
        raise SystemExit(f"Invalid {key} for {scene}") from error
    if not minimum <= value <= maximum:
        raise SystemExit(f"Invalid {key} for {scene}: expected {minimum}..{maximum}")
    return value


def scenes(script: str) -> list[dict]:
    narration = blockquote(script, "口播")
    if not narration:
        raise SystemExit("Missing blockquoted continuous narration under **口播：**.")
    values = parameters(script)
    global_direction = usable_config_value(blockquote(script, "全局演绎提示")) or "自然、清晰、可信。"
    scene_id = "MASTER"
    return [{
        "id": scene_id,
        "number": 1,
        "title": "完整口播",
        "text": narration,
        "direction": "",
        "section_id": values.get("section_id", "voice:MASTER"),
        "speech_rate": bounded_int(values, "speech_rate", 15, -50, 100, scene_id),
        "loudness_rate": bounded_int(values, "loudness_rate", 0, -50, 100, scene_id),
        "silence_duration_ms": bounded_int(values, "silence_duration_ms", 0, 0, 30000, scene_id),
        "post_process_pitch": bounded_int(values, "post_process_pitch", 0, -12, 12, scene_id),
        "global_direction": global_direction,
    }]


def narration_payload(parsed: list[dict]) -> list[dict[str, str]]:
    """Return the only script material that becomes spoken audio.

    Visual notes and delivery parameters may change after synthesis.
    The blockquoted narration cannot.
    """
    return [{"sceneId": scene["id"], "text": scene["text"]} for scene in parsed]


def narration_digest(parsed: list[dict]) -> str:
    encoded = json.dumps(narration_payload(parsed), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def ensure_narration_lock(lock_file: Path, parsed: list[dict]) -> dict:
    """Create the first-TTS narration lock, or reject an altered narration."""
    digest = narration_digest(parsed)
    if lock_file.exists():
        try:
            lock = json.loads(lock_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Narration lock is invalid: {lock_file}") from error
        if lock.get("digest") != digest or lock.get("narration") != narration_payload(parsed):
            raise RuntimeError(
                "The blockquoted 口播 text or its scene order changed after TTS started. "
                f"It is locked by {lock_file}; restore the locked narration before generating again."
            )
        return lock
    lock = {
        "version": 1,
        "digest": digest,
        "narration": narration_payload(parsed),
        "rule": "Locked immediately before the first non-dry-run TTS request. Only timing and non-narration production artifacts may change afterward.",
    }
    lock_file.parent.mkdir(parents=True, exist_ok=True)
    lock_file.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return lock


def require_revised_content_approval(script_path: Path) -> None:
    """A changed manuscript needs a fresh signed content decision."""
    production = script_path.parent
    metadata_file = production / "production.json"
    if not metadata_file.is_file():
        raise RuntimeError("Narration revision requires a VideoSpec production with renewed content approval.")
    metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    approval = metadata.get("approvals", {}).get("content")
    hashes = approval.get("hashes") if isinstance(approval, dict) else None
    protected = ("context.md", "brief.md", "evidence.md", "script.md", "content-review.md")
    if not isinstance(hashes, dict) or any(
        not (production / name).is_file()
        or hashlib.sha256((production / name).read_bytes()).hexdigest() != hashes.get(name)
        for name in protected
    ):
        raise RuntimeError("Narration revision requires renewed content approval for the current script and content files.")


def archive_voice_revision(voice_root: Path) -> str:
    """Preserve every previous voice asset before replacing the active narration."""
    revisions = voice_root / "revisions"
    revisions.mkdir(parents=True, exist_ok=True)
    numbers = [int(item.name[1:]) for item in revisions.iterdir() if item.is_dir() and re.fullmatch(r"R\d{3}", item.name)]
    revision = f"R{max(numbers, default=0) + 1:03d}"
    destination = revisions / revision
    staging = revisions / f".{revision}-{uuid.uuid4().hex}"
    staging.mkdir()
    production = voice_root.parent.parent.parent
    try:
        for item in voice_root.iterdir():
            if item.name == "revisions":
                continue
            if item.is_symlink() or (item.is_dir() and any(child.is_symlink() for child in item.rglob("*"))):
                raise RuntimeError(f"Refusing to archive symlinked voice asset: {item}")
            if item.is_dir():
                shutil.copytree(item, staging / item.name)
            elif item.is_file():
                shutil.copy2(item, staging / item.name)
        for name in ("production.json", "render-authorization.json", "deliverables.json"):
            source = production / name
            if source.is_file():
                shutil.copy2(source, staging / name)
        staging.rename(destination)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    for item in voice_root.iterdir():
        if item.name == "revisions":
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
    authorization = production / "render-authorization.json"
    if authorization.is_file():
        authorization.write_text(json.dumps({
            "approved": False, "confirmedBy": None, "confirmedAt": None,
            "previewUrl": None, "preRenderQa": {"passed": False, "record": "tasks.md"},
            "inputsSha256": {}, "previewVersionSha256": None,
        }, indent=2) + "\n", encoding="utf-8")
    deliverables = production / "deliverables.json"
    if deliverables.is_file():
        deliverables.write_text("[]\n", encoding="utf-8")
    return revision


def wav_duration_seconds(source: Path) -> float:
    """Read a processed WAV duration, falling back to FFprobe for extensible WAV."""
    import wave

    try:
        with wave.open(str(source), "rb") as audio:
            rate = audio.getframerate()
            if not rate:
                raise RuntimeError("WAV has no sample rate")
            return audio.getnframes() / rate
    except (wave.Error, OSError) as error:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(source)],
            capture_output=True,
            text=True,
            check=False,
        )
        try:
            duration = float(probe.stdout.strip())
        except ValueError as probe_error:
            raise RuntimeError(f"Could not read generated voice duration from {source}: {error}") from probe_error
        if duration <= 0:
            raise RuntimeError(f"Could not read generated voice duration from {source}: {error}")
        return duration


def format_timecode(seconds: float) -> str:
    milliseconds = round(max(seconds, 0) * 1000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    whole_seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def audio_from_response(body: bytes, content_type: str) -> bytes:
    if content_type.startswith("audio/"):
        return body
    chunks: list[bytes] = []
    for match in re.finditer(r'"data"\s*:\s*"([^"]+)"', body.decode("utf-8", errors="replace")):
        try:
            chunks.append(base64.b64decode(match.group(1)))
        except ValueError:
            continue
    if chunks:
        return b"".join(chunks)
    raise RuntimeError("TTS response contained no audio data")


def synthesize(scene: dict, key: str, tts_config: dict[str, object], timeout: int) -> bytes:
    delivery_direction = "\n".join(part for part in [scene["global_direction"], scene["direction"]] if part)
    additions = {
        "silence_duration": scene["silence_duration_ms"],
        "post_process": {"pitch": scene["post_process_pitch"]},
        "explicit_language": tts_config["explicit_language"],
        "disable_markdown_filter": tts_config["disable_markdown_filter"],
        "max_length_to_filter_parenthesis": tts_config["max_length_to_filter_parenthesis"],
        "aigc_watermark": tts_config["aigc_watermark"],
        # Keep one instruction entry, with the global creator-to-viewer profile
        # first and the scene-specific turn immediately after it.
        "context_texts": [delivery_direction],
        "section_id": scene["section_id"],
    }
    audio_params = {"format": tts_config["format"], "sample_rate": tts_config["sample_rate"], "speech_rate": scene["speech_rate"], "loudness_rate": scene["loudness_rate"], "enable_subtitle": tts_config["enable_subtitle"]}
    if tts_config["format"] == "mp3":
        audio_params["bit_rate"] = tts_config["bit_rate"]
    payload = {"user": {"uid": "videospec"}, "req_params": {"text": scene["text"], "speaker": tts_config["speaker"], "audio_params": audio_params, "additions": json.dumps(additions, ensure_ascii=False)}}
    request = Request(ENDPOINT, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": "application/json; charset=utf-8", "X-Api-Key": key, "X-Api-Resource-Id": RESOURCE_ID, "X-Api-Request-Id": str(uuid.uuid4())}, method="POST")
    try:
        with urlopen(request, timeout=timeout) as response:
            return audio_from_response(response.read(), response.headers.get("Content-Type", ""))
    except HTTPError as error:
        raise RuntimeError(f"TTS HTTP {error.code}: {error.read().decode('utf-8', errors='replace')[:500]}") from error
    except URLError as error:
        raise RuntimeError(f"TTS network error: {error}") from error


def ffmpeg() -> str:
    executable = shutil.which("ffmpeg")
    if not executable:
        raise RuntimeError("ffmpeg is required to normalize, limit, and merge narration audio.")
    return executable


def run_ffmpeg(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip() or result.stdout.strip()}")


def run_ffmpeg_capture(command: list[str]) -> str:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip() or result.stdout.strip()}")
    return result.stderr + "\n" + result.stdout


def condition_segment(source: Path, destination: Path, overwrite: bool, profile: dict) -> None:
    if destination.exists() and not overwrite:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg([
        ffmpeg(), "-hide_banner", "-loglevel", "error", "-y" if overwrite else "-n",
        "-i", str(source), "-af", scene_conditioning_filter(profile),
        "-ar", str(profile["voiceMaster"]["sampleRateHz"]), "-ac", str(profile["voiceMaster"]["channels"]),
        "-c:a", profile["voiceMaster"]["codec"], str(destination),
    ])


def loudnorm_measurement(source: Path, profile: dict) -> dict[str, str]:
    """Return the first-pass EBU R128 measurements required for a second pass."""
    measurement_filter = (
        f"loudnorm=I={profile['voiceMaster']['integratedLoudnessLufs']}:"
        f"LRA={profile['voiceMaster']['loudnessRangeLu']}:"
        f"TP={profile['voiceMaster']['truePeakDbtp']}:"
        "print_format=json"
    )
    output = run_ffmpeg_capture([
        ffmpeg(), "-hide_banner", "-nostats", "-i", str(source), "-af", measurement_filter,
        "-f", "null", "-",
    ])
    matches = re.findall(r"\{\s*\"input_i\"[\s\S]*?\}", output)
    if not matches:
        raise RuntimeError("ffmpeg loudnorm measurement did not return JSON statistics.")
    try:
        stats = json.loads(matches[-1])
    except json.JSONDecodeError as error:
        raise RuntimeError("ffmpeg loudnorm measurement returned invalid JSON statistics.") from error
    expected = ("input_i", "input_lra", "input_tp", "input_thresh", "target_offset")
    if any(key not in stats for key in expected):
        raise RuntimeError("ffmpeg loudnorm measurement was incomplete.")
    return {key: str(stats[key]) for key in expected}


def two_pass_loudnorm_filter(stats: dict[str, str], profile: dict) -> str:
    voice = profile["voiceMaster"]
    return (
        f"loudnorm=I={voice['integratedLoudnessLufs']}:LRA={voice['loudnessRangeLu']}:TP={voice['truePeakDbtp']}:"
        f"measured_I={stats['input_i']}:measured_LRA={stats['input_lra']}:"
        f"measured_TP={stats['input_tp']}:measured_thresh={stats['input_thresh']}:"
        f"offset={stats['target_offset']}:linear=true:print_format=summary,"
        f"alimiter=limit={limiter_amplitude(voice['safetyLimiterDbfs'])}:level=0"
    )


def merge_narration(inputs: list[Path], destination: Path, overwrite: bool, profile: dict) -> None:
    if destination.exists() and not overwrite:
        raise RuntimeError(f"Merged narration exists; use --overwrite to replace it: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".ffconcat", delete=False) as handle:
        list_file = Path(handle.name)
        for item in inputs:
            escaped = str(item.resolve()).replace("'", r"'\\''")
            handle.write(f"file '{escaped}'\n")
    try:
        # Pass one measures the complete, scene-ordered voice master. Pass two
        # applies the measured correction, then retains a final anti-clipping guard.
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
            concatenated = Path(handle.name)
        run_ffmpeg([
            ffmpeg(), "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(list_file),
            "-ar", str(profile["voiceMaster"]["sampleRateHz"]), "-ac", str(profile["voiceMaster"]["channels"]),
            "-c:a", profile["voiceMaster"]["codec"], str(concatenated),
        ])
        stats = loudnorm_measurement(concatenated, profile)
        run_ffmpeg([
            ffmpeg(), "-hide_banner", "-loglevel", "error", "-y" if overwrite else "-n",
            "-i", str(concatenated), "-af", two_pass_loudnorm_filter(stats, profile),
            "-ar", str(profile["voiceMaster"]["sampleRateHz"]), "-ac", str(profile["voiceMaster"]["channels"]),
            "-c:a", profile["voiceMaster"]["codec"], str(destination),
        ])
    finally:
        list_file.unlink(missing_ok=True)
        if "concatenated" in locals():
            concatenated.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path, help="VideoSpec script.md")
    parser.add_argument("--speaker", help="Override script.md speaker")
    parser.add_argument("--format", choices=("mp3", "wav"), help="Override script.md format")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--merged-output", type=Path, help="Processed, scene-ordered narration WAV path.")
    parser.add_argument("--scene", action="append", help="Generate a narration sample with --scene MASTER.")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--revise-narration", action="store_true", help="After renewed content approval, archive the prior voice revision and synthesize the revised script.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    script_path = args.script.resolve()
    script_text = script_path.read_text(encoding="utf-8")
    if not re.search(r"^templateVersion:\s*6\s*$", script_text, re.MULTILINE):
        raise SystemExit("Only templateVersion 6 scripts are supported.")
    audio_profile, audio_spec = load_audio_profile(script_path)
    all_scenes = scenes(script_text)
    tts_config = tts_configuration(script_text, args.speaker, args.format)
    parsed = all_scenes
    if args.scene:
        wanted = {value.strip().upper() for value in args.scene}
        parsed = [scene for scene in parsed if scene["id"] in wanted]
        missing = wanted - {scene["id"] for scene in parsed}
        if missing:
            raise SystemExit(f"Unknown scene(s): {', '.join(sorted(missing))}")
    voice_root = script_path.parent / "assets" / "audio" / "voice"
    output_dir = (args.output_dir or voice_root / "raw").resolve()
    processed_dir = voice_root / "processed"
    merged_default = voice_root / ("narration.wav" if not args.scene else "preview-" + "-".join(scene["id"].lower() for scene in parsed) + ".wav")
    merged = (args.merged_output or merged_default).resolve()
    manifest_file = voice_root / (
        "manifest.json" if not args.scene else "preview-manifest-" + "-".join(scene["id"].lower() for scene in parsed) + ".json"
    )
    lock_file = voice_root / NARRATION_LOCK_FILE
    if args.revise_narration:
        if args.scene or args.output_dir or args.merged_output or args.overwrite:
            raise RuntimeError("Narration revision requires a full run with the standard voice paths and no --overwrite.")
        if not lock_file.is_file():
            raise RuntimeError("No existing narration lock to revise; run normal voice generation instead.")
        require_revised_content_approval(script_path)
        if json.loads(lock_file.read_text(encoding="utf-8")).get("digest") == narration_digest(all_scenes):
            raise RuntimeError("Narration has not changed; a revision is unnecessary.")
    audio_spec_hash = hashlib.sha256(audio_spec.read_bytes()).hexdigest()
    previous_profile = None
    previous_spec_hash = None
    if manifest_file.is_file():
        try:
            previous_manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
            if not isinstance(previous_manifest, dict):
                raise RuntimeError(f"Existing voice manifest must be an object: {manifest_file}")
            previous_profile = previous_manifest.get("audioProfile")
            previous_source = previous_manifest.get("audioProfileSource")
            previous_spec_hash = previous_source.get("sha256") if isinstance(previous_source, dict) else None
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Existing voice manifest is invalid: {manifest_file}") from error
    processing_changed = manifest_file.is_file() and (previous_profile != audio_profile or previous_spec_hash != audio_spec_hash)
    for location in (output_dir, merged):
        if not location.is_relative_to(script_path.parent):
            raise SystemExit("Voice outputs must stay inside the production directory for portable archives.")

    def manifest_path(location: Path) -> str:
        return str(location.relative_to(script_path.parent))

    print(f"Found {len(parsed)} narration scene(s); speaker={tts_config['speaker']}, format={tts_config['format']}, sample_rate={tts_config['sample_rate']}.")
    if args.dry_run:
        if args.revise_narration:
            print("- Revised narration is content-approved; the prior voice assets will be archived on the full run.")
        for scene in parsed:
            print(f"- {scene['id']}: {scene['title']}")
        return 0
    key = secret_key(script_path)
    revision = archive_voice_revision(voice_root) if args.revise_narration else None
    output_dir.mkdir(parents=True, exist_ok=True)
    # Lock the active manuscript before the first network request. A later
    # user-authorized revision archives the previous lock and voice assets.
    lock = ensure_narration_lock(lock_file, all_scenes)
    manifest = []
    processed_paths: list[Path] = []
    for scene in parsed:
        output = output_dir / f"{scene['number']:02d}-{scene['id'].lower()}.{tts_config['format']}"
        generated = False
        if output.exists() and not args.overwrite:
            print(f"[skip] {scene['id']}: {output}")
        else:
            output.write_bytes(synthesize(scene, key, tts_config, args.timeout))
            generated = True
            print(f"[ok] {scene['id']}: {output}")
        processed = processed_dir / f"{scene['number']:02d}-{scene['id'].lower()}.wav"
        condition_segment(output, processed, overwrite=args.overwrite or generated or processing_changed, profile=audio_profile)
        processed_paths.append(processed)
        manifest.append({"sceneId": scene["id"], "rawFile": manifest_path(output), "processedFile": manifest_path(processed), "speaker": tts_config["speaker"], "sourceText": scene["text"], "synthesis": {key: scene[key] for key in ("speech_rate", "loudness_rate", "silence_duration_ms", "post_process_pitch", "section_id")}})
    merge_narration(processed_paths, merged, overwrite=args.overwrite or processing_changed, profile=audio_profile)
    scene_durations = [wav_duration_seconds(item) for item in processed_paths]
    timing = []
    cursor = 0.0
    for scene, duration in zip(parsed, scene_durations):
        timing.append({
            "sceneId": scene["id"],
            "startSeconds": cursor,
            "endSeconds": cursor + duration,
            "durationSeconds": duration,
        })
        cursor += duration
    # A sample cannot define the full production timeline. Keep measured
    # timing in the manifest without modifying the approved script.
    calibrated_duration = cursor if not args.scene else None
    voice_profile = audio_profile["voiceMaster"]
    final_mix = audio_profile["finalMix"]
    manifest_file.write_text(json.dumps({
        "provider": "volcengine-seed-tts-2.0",
        "ttsRequest": tts_config,
        "audioProfileSource": {
            "path": os.path.relpath(audio_spec, script_path.parent),
            "sha256": audio_spec_hash,
        },
        "audioProfile": audio_profile,
        "processing": {
            "sceneConditioning": f"{voice_profile['highPassHz']} Hz high-pass, gentle de-essing, {voice_profile['compressionRatio']}:1 compression, {voice_profile['safetyLimiterDbfs']} dB safety limiting",
            "mastering": "two-pass EBU R128 loudness normalization",
        },
        "voiceMaster": {
            "integratedLoudness": f"{voice_profile['integratedLoudnessLufs']} LUFS",
            "loudnessRange": f"{voice_profile['loudnessRangeLu']} LU",
            "truePeakLimit": f"{voice_profile['truePeakDbtp']} dBTP",
            "sampleRateHz": voice_profile["sampleRateHz"],
            "channels": voice_profile["channels"],
            "codec": voice_profile["codec"],
        },
        "finalVideoMixTarget": {
            "integratedLoudness": f"{final_mix['integratedLoudnessLufs']} LUFS",
            "truePeakLimit": f"{final_mix['truePeakDbtp']} dBTP",
            "sampleRateHz": final_mix["sampleRateHz"],
            "channels": final_mix["channels"],
        },
        "pathBase": "production",
        "mergedFile": manifest_path(merged),
        "narrationLock": {"file": NARRATION_LOCK_FILE, "digest": lock["digest"]},
        "narrationRevision": revision or (previous_manifest.get("narrationRevision", "R000") if manifest_file.is_file() else "R000"),
        "timing": {
            "source": "processed scene WAV durations",
            "scriptCalibrated": False,
            "totalSeconds": calibrated_duration if calibrated_duration is not None else cursor,
            "scenes": timing,
        },
        "scenes": manifest,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not args.scene:
        print(f"[ok] recorded measured narration timing in manifest without changing approved script -> {format_timecode(calibrated_duration)}")
    elif args.scene:
        print(f"[ok] sample did not recalibrate the full timeline; sample timing -> {manifest_file}")
    print(f"[ok] conditioned and two-pass mastered narration -> {merged}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"[error] {error}", file=sys.stderr)
        raise SystemExit(1)

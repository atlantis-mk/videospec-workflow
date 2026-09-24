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
# Delivery targets apply to the processed voice master, not the source TTS request.
# The TTS provider may synthesize at a lower native rate; FFmpeg produces the
# project master as 48 kHz / 24-bit PCM WAV after the safety processing below.
TARGET_SAMPLE_RATE = 48000
TARGET_CHANNELS = 1
TARGET_CODEC = "pcm_s24le"
TARGET_LOUDNESS = -16.0
TARGET_LRA = 6.0
TRUE_PEAK_LIMIT = -1.5
LIMITER_AMPLITUDE = "0.8414"  # -1.5 dBFS, an additional safety guard after loudnorm.
NARRATION_LOCK_FILE = "narration-lock.json"

# Gentle, speech-first scene conditioning. Do not loudness-normalize each short
# scene: doing that makes scene boundaries sound unnaturally uneven. Exact
# integrated loudness is set once on the fully merged narration in two passes.
SCENE_CONDITIONING_FILTER = (
    "highpass=f=75,"
    "deesser=i=0.15:m=0.5:f=0.5:s=o,"
    "acompressor=threshold=0.125:ratio=2.5:attack=10:release=120:"
    "knee=3:makeup=1:link=average:detection=rms,"
    f"alimiter=limit={LIMITER_AMPLITUDE}:level=0"
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
    heading_pattern = re.compile(r"^##\s+\d{2,}:\d{2}(?:\.\d{3})?[–-]\d{2,}:\d{2}(?:\.\d{3})?｜", re.MULTILINE)
    first_heading = heading_pattern.search(script)
    prefix = script[:first_heading.start()] if first_heading else script
    values = interface_parameters(prefix)
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


def legacy_scenes(script: str) -> list[dict]:
    pattern = re.compile(r"^##\s+(\d{2,}:\d{2}(?:\.\d{3})?)[–-](\d{2,}:\d{2}(?:\.\d{3})?)｜(.+?)\s*$", re.MULTILINE)
    headings = list(pattern.finditer(script))
    if not headings:
        raise SystemExit("No narration scenes found. Expected `## 00:00–00:10｜Title` headings.")
    global_direction = blockquote(script[:headings[0].start()], "全局演绎提示") or "自然、清晰、可信。"
    result = []
    for index, heading in enumerate(headings, start=1):
        section = script[heading.end(): headings[index].start() if index < len(headings) else len(script)]
        scene_match = re.search(r"^- Scene ID:\s*(S\d{3})\s*$", section, re.MULTILINE)
        if not scene_match:
            raise SystemExit(f"Missing Scene ID for {heading.group(3)}")
        narration = blockquote(section, "口播")
        if not narration:
            raise SystemExit(f"Missing blockquoted narration for {scene_match.group(1)}")
        values = parameters(section)
        scene_id = scene_match.group(1)
        result.append({
            "id": scene_id,
            "number": index,
            "title": heading.group(3).strip(),
            "text": narration,
            "direction": blockquote(section, "演绎提示") or "自然、清晰，重点突出。",
            "section_id": values.get("section_id", f"voice:{scene_id}"),
            "speech_rate": bounded_int(values, "speech_rate", 15, -50, 100, scene_id),
            "loudness_rate": bounded_int(values, "loudness_rate", 0, -50, 100, scene_id),
            "silence_duration_ms": bounded_int(values, "silence_duration_ms", 0, 0, 30000, scene_id),
            "post_process_pitch": bounded_int(values, "post_process_pitch", 0, -12, 12, scene_id),
            "global_direction": global_direction,
        })
    return result


def scenes(script: str) -> list[dict]:
    if re.search(r"^##\s+\d{2,}:\d{2}(?:\.\d{3})?[–-]\d{2,}:\d{2}(?:\.\d{3})?｜", script, re.MULTILINE):
        return legacy_scenes(script)
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

    Timing headers, visual notes, and delivery parameters can be recalibrated
    after synthesis. The scene order and blockquoted narration cannot.
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


def recalibrate_script_timing(script_path: Path, parsed: list[dict], durations: list[float]) -> float:
    """Replace only scene headers and timing status with measured voice durations."""
    if len(parsed) != len(durations):
        raise RuntimeError("Cannot recalibrate script timing: scene and duration counts differ.")
    content = script_path.read_text(encoding="utf-8")
    if len(parsed) == 1 and parsed[0]["id"] == "MASTER":
        cursor = durations[0]
        timing_line = (
            f"- Narration timing: Calibrated from one real master voice request; total {format_timecode(cursor)}; "
            "source `assets/audio/voice/narration.wav`. Spoken text is locked."
        )
        if re.search(r"^- Narration timing:\s*.*$", content, re.MULTILINE):
            calibrated = re.sub(r"^- Narration timing:\s*.*$", timing_line, content, flags=re.MULTILINE)
        elif re.search(r"^- Estimated narration:\s*.*$", content, re.MULTILINE):
            calibrated = re.sub(r"^- Estimated narration:\s*.*$", timing_line, content, flags=re.MULTILINE)
        else:
            calibrated = re.sub(r"(^- Target duration:\s*.*$)", r"\1\n" + timing_line, content, count=1, flags=re.MULTILINE)
        script_path.write_text(calibrated, encoding="utf-8")
        return cursor
    heading_pattern = re.compile(r"^##\s+(\d{2,}:\d{2}(?:\.\d{3})?)[–-](\d{2,}:\d{2}(?:\.\d{3})?)｜(.+?)\s*$", re.MULTILINE)
    headings = list(heading_pattern.finditer(content))
    if len(headings) != len(parsed):
        raise RuntimeError("Cannot recalibrate script timing: narration scene headings changed during synthesis.")
    ranges: list[tuple[str, str]] = []
    cursor = 0.0
    for duration in durations:
        start = cursor
        cursor += duration
        ranges.append((format_timecode(start), format_timecode(cursor)))
    index = 0

    def replace_heading(match: re.Match) -> str:
        nonlocal index
        start, end = ranges[index]
        index += 1
        return f"## {start}–{end}｜{match.group(3)}"

    calibrated = heading_pattern.sub(replace_heading, content)
    timing_line = (
        f"- Narration timing: Calibrated from real generated voice; total {format_timecode(cursor)}; "
        "source `assets/audio/voice/narration.wav`. Spoken text is locked."
    )
    if re.search(r"^- Narration timing:\s*.*$", calibrated, re.MULTILINE):
        calibrated = re.sub(r"^- Narration timing:\s*.*$", timing_line, calibrated, flags=re.MULTILINE)
    elif re.search(r"^- Estimated narration:\s*.*$", calibrated, re.MULTILINE):
        calibrated = re.sub(r"^- Estimated narration:\s*.*$", timing_line, calibrated, flags=re.MULTILINE)
    else:
        calibrated = re.sub(r"(^- Target duration:\s*.*$)", r"\1\n" + timing_line, calibrated, count=1, flags=re.MULTILINE)
    script_path.write_text(calibrated, encoding="utf-8")
    return cursor


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


def condition_segment(source: Path, destination: Path, overwrite: bool) -> None:
    if destination.exists() and not overwrite:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg([
        ffmpeg(), "-hide_banner", "-loglevel", "error", "-y" if overwrite else "-n",
        "-i", str(source), "-af", SCENE_CONDITIONING_FILTER,
        "-ar", str(TARGET_SAMPLE_RATE), "-ac", str(TARGET_CHANNELS),
        "-c:a", TARGET_CODEC, str(destination),
    ])


def loudnorm_measurement(source: Path) -> dict[str, str]:
    """Return the first-pass EBU R128 measurements required for a second pass."""
    measurement_filter = (
        f"loudnorm=I={TARGET_LOUDNESS}:LRA={TARGET_LRA}:TP={TRUE_PEAK_LIMIT}:"
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


def two_pass_loudnorm_filter(stats: dict[str, str]) -> str:
    return (
        f"loudnorm=I={TARGET_LOUDNESS}:LRA={TARGET_LRA}:TP={TRUE_PEAK_LIMIT}:"
        f"measured_I={stats['input_i']}:measured_LRA={stats['input_lra']}:"
        f"measured_TP={stats['input_tp']}:measured_thresh={stats['input_thresh']}:"
        f"offset={stats['target_offset']}:linear=true:print_format=summary,"
        f"alimiter=limit={LIMITER_AMPLITUDE}:level=0"
    )


def merge_narration(inputs: list[Path], destination: Path, overwrite: bool) -> None:
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
            "-ar", str(TARGET_SAMPLE_RATE), "-ac", str(TARGET_CHANNELS),
            "-c:a", TARGET_CODEC, str(concatenated),
        ])
        stats = loudnorm_measurement(concatenated)
        run_ffmpeg([
            ffmpeg(), "-hide_banner", "-loglevel", "error", "-y" if overwrite else "-n",
            "-i", str(concatenated), "-af", two_pass_loudnorm_filter(stats),
            "-ar", str(TARGET_SAMPLE_RATE), "-ac", str(TARGET_CHANNELS), "-c:a", TARGET_CODEC, str(destination),
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
    parser.add_argument("--scene", action="append", help="Generate only one scene, for example S001. May be repeated.")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    script_path = args.script.resolve()
    script_text = script_path.read_text(encoding="utf-8")
    is_v6_script = bool(re.search(r"^templateVersion:\s*6\s*$", script_text, re.MULTILINE))
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
    if is_v6_script:
        for location in (output_dir, merged):
            if not location.is_relative_to(script_path.parent):
                raise SystemExit("v6 voice outputs must stay inside the production directory for portable archives.")

    def manifest_path(location: Path) -> str:
        return str(location.relative_to(script_path.parent)) if is_v6_script else str(location)

    print(f"Found {len(parsed)} narration scene(s); speaker={tts_config['speaker']}, format={tts_config['format']}, sample_rate={tts_config['sample_rate']}.")
    if args.dry_run:
        for scene in parsed:
            print(f"- {scene['id']}: {scene['title']}")
        return 0
    key = secret_key(script_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    # This happens before the first network request. From this point forward a
    # rerun may adjust measured timings, but it must never synthesize a revised
    # spoken manuscript under the same production.
    lock_file = voice_root / NARRATION_LOCK_FILE
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
        condition_segment(output, processed, overwrite=args.overwrite or generated)
        processed_paths.append(processed)
        manifest.append({"sceneId": scene["id"], "rawFile": manifest_path(output), "processedFile": manifest_path(processed), "speaker": tts_config["speaker"], "sourceText": scene["text"], "synthesis": {key: scene[key] for key in ("speech_rate", "loudness_rate", "silence_duration_ms", "post_process_pitch", "section_id")}})
    merge_narration(processed_paths, merged, overwrite=args.overwrite)
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
    # A partial sample cannot define the full production timeline. v6 keeps
    # measured timing in the voice manifest so synthesis cannot change a
    # content-approved script. Older scene-based scripts retain their heading
    # calibration for compatibility.
    calibrated_script = False
    calibrated_duration = None
    if not args.scene and not is_v6_script:
        calibrated_duration = recalibrate_script_timing(script_path, all_scenes, scene_durations)
        calibrated_script = True
    elif not args.scene:
        calibrated_duration = cursor
    manifest_file = voice_root / (
        "manifest.json" if not args.scene else "preview-manifest-" + "-".join(scene["id"].lower() for scene in parsed) + ".json"
    )
    manifest_file.write_text(json.dumps({
        "provider": "volcengine-seed-tts-2.0",
        "ttsRequest": tts_config,
        "processing": {
            "sceneConditioning": "75 Hz high-pass, gentle de-essing, 2.5:1 compression, -1.5 dB safety limiting",
            "mastering": "two-pass EBU R128 loudness normalization after scene-ordered merge",
        },
        "voiceMaster": {
            "integratedLoudness": "-16 LUFS",
            "loudnessRange": "6 LU",
            "truePeakLimit": "-1.5 dBTP",
            "sampleRateHz": TARGET_SAMPLE_RATE,
            "channels": TARGET_CHANNELS,
            "codec": "PCM 24-bit WAV",
        },
        "finalVideoMixTarget": {"integratedLoudness": "-14 LUFS", "truePeakLimit": "-1.0 dBTP", "sampleRateHz": 48000, "channels": 2},
        "pathBase": "production" if is_v6_script else "absolute",
        "mergedFile": manifest_path(merged),
        "narrationLock": {"file": NARRATION_LOCK_FILE, "digest": lock["digest"]},
        "timing": {
            "source": "processed scene WAV durations",
            "scriptCalibrated": calibrated_script,
            "totalSeconds": calibrated_duration if calibrated_duration is not None else cursor,
            "scenes": timing,
        },
        "scenes": manifest,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if calibrated_script:
        print(f"[ok] recalibrated script timecodes from real generated voice -> {format_timecode(calibrated_duration)}")
    elif not args.scene:
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

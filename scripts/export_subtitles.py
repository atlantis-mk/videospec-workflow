#!/usr/bin/env python3
"""Export an SRT subtitle file with FunASR Paraformer.

Uses the timestamp-capable Paraformer model with FSMN VAD and sentence
timestamps. SenseVoiceSmall does not return the word timestamps required by
FunASR sentence segmentation, so it cannot produce an anchor-safe SRT here.
The model performs local recognition; it does not use the VideoSpec TTS key.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Cue:
    start_ms: int
    end_ms: int
    text: str


def normalized_char_positions(value: str) -> tuple[str, list[int]]:
    """Return speech characters and their indices in the original string."""
    indices = [index for index, char in enumerate(value) if char.isalnum()]
    return "".join(value[index] for index in indices), indices


def canonical_srt_text(path: Path) -> str:
    """Read only displayed subtitle text from a canonical SRT, in cue order."""
    blocks = re.split(r"\r?\n\r?\n+", path.read_text(encoding="utf-8").strip())
    lines: list[str] = []
    for block in blocks:
        parts = block.splitlines()
        if len(parts) >= 3 and "-->" in parts[1]:
            lines.extend(part.strip() for part in parts[2:] if part.strip())
    text = "".join(lines)
    if not text:
        raise SystemExit(f"canonical SRT contains no subtitle text: {path}")
    return text


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


def canonical_script_text(path: Path) -> str:
    """Read the single blockquoted **口播：** text from an unsegmented V6 script."""
    content = path.read_text(encoding="utf-8")
    canonical = blockquote(content, "口播") or ""
    if not canonical:
        raise SystemExit(f"canonical script contains no narration text: {path}")
    return canonical


def map_asr_boundaries_to_canonical(asr: str, canonical: str) -> list[int]:
    """Map every ASR character boundary to the closest canonical boundary."""
    mapping = [0] * (len(asr) + 1)
    matcher = difflib.SequenceMatcher(a=asr, b=canonical, autojunk=False)
    for tag, asr_start, asr_end, canonical_start, canonical_end in matcher.get_opcodes():
        width = asr_end - asr_start
        if width == 0:
            mapping[asr_start] = canonical_end
            continue
        for offset in range(width + 1):
            mapping[asr_start + offset] = round(
                canonical_start + (canonical_end - canonical_start) * offset / width
            )
    mapping[-1] = len(canonical)
    previous = 0
    for index, value in enumerate(mapping):
        value = max(previous, min(len(canonical), value))
        mapping[index] = value
        previous = value
    return mapping


def canonicalize_cues(cues: list[Cue], canonical_raw: str) -> list[Cue]:
    """Keep ASR timing while replacing ASR wording with locked script wording."""
    canonical, canonical_indices = normalized_char_positions(canonical_raw)
    asr, _ = normalized_char_positions("".join(cue.text for cue in cues))
    if not asr or not canonical:
        raise SystemExit("Cannot align empty ASR or canonical subtitle text.")
    boundary_map = map_asr_boundaries_to_canonical(asr, canonical)
    corrected: list[Cue] = []
    asr_cursor = 0
    for cue in cues:
        cue_normalized, _ = normalized_char_positions(cue.text)
        asr_end = asr_cursor + len(cue_normalized)
        canonical_start = boundary_map[min(asr_cursor, len(boundary_map) - 1)]
        canonical_end = boundary_map[min(asr_end, len(boundary_map) - 1)]
        if canonical_end <= canonical_start:
            canonical_end = min(len(canonical), canonical_start + max(1, len(cue_normalized)))
        raw_start = canonical_indices[canonical_start] if canonical_start < len(canonical_indices) else len(canonical_raw)
        raw_end = canonical_indices[canonical_end - 1] + 1 if canonical_end else raw_start
        while raw_end < len(canonical_raw) and not canonical_raw[raw_end].isalnum():
            raw_end += 1
        text = canonical_raw[raw_start:raw_end]
        if not text:
            text = cue.text
        corrected.append(Cue(cue.start_ms, cue.end_ms, text))
        asr_cursor = asr_end
    return corrected


def srt_time(milliseconds: int) -> str:
    milliseconds = max(0, milliseconds)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, milliseconds = divmod(remainder, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def clean_text(value: Any, postprocess) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", postprocess(value)).strip()


def sentence_cues(result: dict[str, Any], postprocess) -> list[Cue]:
    cues: list[Cue] = []
    for sentence in result.get("sentence_info") or []:
        if not isinstance(sentence, dict):
            continue
        start = sentence.get("start")
        end = sentence.get("end")
        text = clean_text(sentence.get("text", sentence.get("sentence", "")), postprocess)
        if isinstance(start, (int, float)) and isinstance(end, (int, float)) and end > start and text:
            cues.append(Cue(int(round(start)), int(round(end)), text))
    return cues


def word_cues(result: dict[str, Any], postprocess, max_chars: int) -> list[Cue]:
    """Fallback when FunASR returns aligned words/tokens instead of sentences."""
    words = result.get("words") or []
    timestamps = result.get("timestamp") or []
    if len(words) != len(timestamps):
        return []
    cues: list[Cue] = []
    tokens: list[str] = []
    start_ms: int | None = None
    end_ms: int | None = None
    punctuation = set("。！？；：.!?;:")
    for word, stamp in zip(words, timestamps):
        if not isinstance(word, str) or not isinstance(stamp, (list, tuple)) or len(stamp) < 2:
            continue
        begin, finish = stamp[0], stamp[1]
        if not isinstance(begin, (int, float)) or not isinstance(finish, (int, float)) or finish <= begin:
            continue
        if start_ms is None:
            start_ms = int(round(begin))
        tokens.append(word)
        end_ms = int(round(finish))
        text = clean_text("".join(tokens), postprocess)
        if text and (len(text) >= max_chars or word[-1:] in punctuation):
            cues.append(Cue(start_ms, end_ms, text))
            tokens, start_ms, end_ms = [], None, None
    if tokens and start_ms is not None and end_ms is not None:
        text = clean_text("".join(tokens), postprocess)
        if text:
            cues.append(Cue(start_ms, end_ms, text))
    return cues


def write_srt(path: Path, cues: list[Cue], overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise SystemExit(f"Output exists; use --overwrite: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(
        f"{index}\n{srt_time(cue.start_ms)} --> {srt_time(cue.end_ms)}\n{cue.text}\n"
        for index, cue in enumerate(cues, start=1)
    )
    path.write_text(content, encoding="utf-8")


def read_srt(path: Path) -> list[Cue]:
    """Read an existing timed SRT without invoking any recognition model."""
    cues: list[Cue] = []
    pattern = re.compile(
        r"^\s*\d+\s*\n(\d\d):(\d\d):(\d\d),(\d\d\d)\s+-->\s+"
        r"(\d\d):(\d\d):(\d\d),(\d\d\d)\s*\n([\s\S]*?)$"
    )
    for block in re.split(r"\r?\n\r?\n+", path.read_text(encoding="utf-8").strip()):
        match = pattern.match(block)
        if not match:
            continue
        values = [int(value) for value in match.groups()[:8]]
        start_ms = ((values[0] * 60 + values[1]) * 60 + values[2]) * 1000 + values[3]
        end_ms = ((values[4] * 60 + values[5]) * 60 + values[6]) * 1000 + values[7]
        text = re.sub(r"\s+", "", match.group(9))
        if end_ms > start_ms and text:
            cues.append(Cue(start_ms, end_ms, text))
    if not cues:
        raise SystemExit(f"No valid timed cues found in SRT: {path}")
    return cues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, nargs="?", help="Audio or video file to transcribe")
    parser.add_argument("--output", type=Path, help="SRT output path; defaults beside input")
    parser.add_argument("--json-output", type=Path, help="Raw recognition result JSON")
    canonical = parser.add_mutually_exclusive_group()
    canonical.add_argument("--canonical-srt", type=Path, help="Locked script SRT whose wording replaces ASR recognition variants")
    canonical.add_argument("--canonical-script", type=Path, help="V6 script.md; ordered blockquoted 口播 text replaces ASR wording")
    parser.add_argument("--correct-srt", type=Path, help="Existing timed ASR SRT to correct without running ASR again")
    parser.add_argument("--language", default="auto", choices=("auto", "zh", "en", "yue", "ja", "ko"))
    parser.add_argument("--device", default="cpu", help="FunASR device, for example cpu or cuda:0")
    parser.add_argument("--max-chars", type=int, default=20, help="Maximum characters per fallback subtitle cue")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.max_chars < 1:
        parser.error("--max-chars must be positive")
    result: dict[str, Any] | None = None
    if args.correct_srt:
        timed_srt = args.correct_srt.resolve()
        if not timed_srt.is_file():
            parser.error(f"timed SRT not found: {timed_srt}")
        cues = read_srt(timed_srt)
        source = timed_srt
    else:
        if not args.input:
            parser.error("input is required unless --correct-srt is used")
        source = args.input.resolve()
        if not source.is_file():
            parser.error(f"input file not found: {source}")
        try:
            from funasr import AutoModel
            from funasr.utils.postprocess_utils import rich_transcription_postprocess
        except ImportError as error:
            raise SystemExit("FunASR is required. Install it with `python3 -m pip install -U funasr modelscope`.") from error

        model = AutoModel(
            model="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
            vad_model="fsmn-vad",
            vad_kwargs={"max_single_segment_time": 30000},
            punc_model="ct-punc",
            device=args.device,
            disable_update=True,
        )
        results = model.generate(
            input=str(source),
            cache={},
            language=args.language,
            use_itn=True,
            batch_size_s=60,
            output_timestamp=True,
            sentence_timestamp=True,
        )
        if not results or not isinstance(results[0], dict):
            raise SystemExit("Paraformer returned no recognition result.")
        result = results[0]
        cues = sentence_cues(result, rich_transcription_postprocess) or word_cues(result, rich_transcription_postprocess, args.max_chars)
        if not cues:
            raise SystemExit("Paraformer returned no usable timestamps; cannot create an accurate SRT.")
    if args.canonical_srt:
        canonical_srt = args.canonical_srt.resolve()
        if not canonical_srt.is_file():
            parser.error(f"canonical SRT not found: {canonical_srt}")
        cues = canonicalize_cues(cues, canonical_srt_text(canonical_srt))
    elif args.canonical_script:
        canonical_script = args.canonical_script.resolve()
        if not canonical_script.is_file():
            parser.error(f"canonical V6 script not found: {canonical_script}")
        cues = canonicalize_cues(cues, canonical_script_text(canonical_script))
    output = (args.output or source.with_suffix(".srt")).resolve()
    json_output = (args.json_output or output.with_suffix(".asr.json")).resolve()
    write_srt(output, cues, args.overwrite)
    print(f"[ok] wrote {len(cues)} subtitle cues -> {output}")
    if result is not None:
        json_output.parent.mkdir(parents=True, exist_ok=True)
        json_output.write_text(json.dumps({"model": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch", "input": str(source), "cues": [asdict(cue) for cue in cues], "raw": result}, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8")
        print(f"[ok] wrote recognition record -> {json_output}")
    else:
        print("[ok] corrected existing SRT without rerunning ASR")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"[error] {error}", file=sys.stderr)
        raise SystemExit(1)

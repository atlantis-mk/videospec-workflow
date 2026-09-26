#!/usr/bin/env python3
"""Reject a video render unless the current preview inputs were explicitly approved."""

import argparse
import hashlib
import json
import sys
from pathlib import Path


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def check(production: Path) -> None:
    root = production.resolve()
    record_path = root / "render-authorization.json"
    if not record_path.is_file():
        raise ValueError("missing render-authorization.json")
    record = json.loads(record_path.read_text(encoding="utf-8"))
    if record.get("approved") is not True or not record.get("confirmedBy") or not record.get("confirmedAt"):
        raise ValueError("current preview has no explicit human render confirmation")
    qa = record.get("preRenderQa")
    if not record.get("previewUrl") or not isinstance(qa, dict) or qa.get("passed") is not True:
        raise ValueError("playable preview or passing pre-render QA is missing")
    expected = record.get("inputsSha256")
    if not isinstance(expected, dict) or not expected:
        raise ValueError("render authorization has no preview input hashes")
    if "script.md" not in expected:
        raise ValueError("script is missing from preview input hashes")
    actual = {}
    for name, approved_hash in expected.items():
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"preview input missing or outside production: {name}")
        current_hash = digest(path)
        if current_hash != approved_hash:
            raise ValueError(f"preview input changed since confirmation: {name}")
        actual[name] = current_hash
    voice_manifest = root / "assets" / "audio" / "voice" / "manifest.json"
    if voice_manifest.exists():
        if not voice_manifest.resolve().is_relative_to(root):
            raise ValueError("voice manifest is outside production")
        if "assets/audio/voice/manifest.json" not in expected:
            raise ValueError("voice manifest is missing from preview input hashes")
        applied = json.loads(voice_manifest.read_text(encoding="utf-8"))
        source = applied.get("audioProfileSource") if isinstance(applied, dict) else None
        spec = next(
            (parent / "videospec" / "specs" / "audio" / "spec.md"
             for parent in root.parents
             if (parent / "videospec" / "specs" / "audio" / "spec.md").is_file()),
            None,
        )
        if spec is None or not isinstance(source, dict) or not source.get("sha256"):
            raise ValueError("current project audio profile or applied profile hash is missing")
        if digest(spec) != source["sha256"]:
            raise ValueError("project audio profile changed since narration was generated")
    version = hashlib.sha256(
        json.dumps(actual, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    if version != record.get("previewVersionSha256"):
        raise ValueError("preview version changed since confirmation")
    print(f"Render authorized for preview {version[:16]} by {record['confirmedBy']} at {record['confirmedAt']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("production", type=Path)
    args = parser.parse_args()
    try:
        check(args.production)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"Render blocked: {error}", file=sys.stderr)
        sys.exit(1)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(packageRoot, "scripts", "generate_voice.py");

test("voice timing calibration preserves locked narration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-voice-"));
  const script = path.join(root, "script.md");
  fs.writeFileSync(script, `# Script: Demo

## Summary

- Target duration: 3s
- Narration timing: Planned

## 00:00–00:01｜Opening

- Scene ID: S001

**口播：**

> First spoken line.

## 00:01–00:03｜Payoff

- Scene ID: S002

**口播：**

> Second spoken line.
`);
  const program = String.raw`
import importlib.util
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
script = root / "script.md"
spec = importlib.util.spec_from_file_location("voice", sys.argv[2])
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)
parsed = voice.scenes(script.read_text(encoding="utf-8"))
lock = root / "assets" / "audio" / "voice" / "narration-lock.json"
voice.ensure_narration_lock(lock, parsed)
voice.recalibrate_script_timing(script, parsed, [1.234, 2.345])
calibrated = script.read_text(encoding="utf-8")
assert "## 00:00.000–00:01.234｜Opening" in calibrated
assert "## 00:01.234–00:03.579｜Payoff" in calibrated
assert "> First spoken line." in calibrated
assert "> Second spoken line." in calibrated
changed = voice.scenes(calibrated.replace("Second spoken line.", "Changed spoken line."))
try:
    voice.ensure_narration_lock(lock, changed)
except RuntimeError as error:
    assert "changed after TTS started" in str(error)
else:
    raise AssertionError("Changed narration was not rejected")
`;
  try {
    execFileSync("python3", ["-c", program, root, generator], { encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.ok(true);
});

test("v6 voice generation parses one master and locks its wording", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-master-"));
  const script = path.join(root, "script.md");
  fs.writeFileSync(script, `---
templateVersion: 6
---

# Script: Demo

## Summary

- Target duration: 3s

## TTS configuration

**接口与音频参数：**

> speaker: zh_male_example_bigtts
> format: wav
> sample_rate: 24000

**合成参数：**

> speech_rate: 15
> section_id: demo:MASTER

## Voice profile

**全局演绎提示：**

> Speak naturally.

**口播：**

> Complete narration, spoken once.
`);
  const program = String.raw`
import importlib.util
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
script = root / "script.md"
spec = importlib.util.spec_from_file_location("voice", sys.argv[2])
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)
content = script.read_text(encoding="utf-8")
parsed = voice.scenes(content)
assert len(parsed) == 1 and parsed[0]["id"] == "MASTER"
assert parsed[0]["text"] == "Complete narration, spoken once."
assert voice.tts_configuration(content, None, None)["speaker"] == "zh_male_example_bigtts"
voice.secret_key = lambda _script_path: "test-key"
voice.synthesize = lambda *_args: b"raw voice"
def fake_condition(_source, destination, overwrite):
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(b"processed voice")
voice.condition_segment = fake_condition
voice.merge_narration = lambda _inputs, destination, overwrite: destination.write_bytes(b"master voice")
voice.wav_duration_seconds = lambda _source: 3.125
sys.argv = ["generate_voice.py", str(script)]
assert voice.main() == 0
assert script.read_text(encoding="utf-8") == content
voice_root = root / "assets" / "audio" / "voice"
lock = voice_root / "narration-lock.json"
manifest = __import__("json").loads((voice_root / "manifest.json").read_text(encoding="utf-8"))
assert manifest["timing"]["totalSeconds"] == 3.125
assert manifest["timing"]["scriptCalibrated"] is False
assert manifest["pathBase"] == "production"
assert manifest["mergedFile"] == "assets/audio/voice/narration.wav"
assert manifest["scenes"][0]["rawFile"].startswith("assets/audio/voice/raw/")
changed = voice.scenes(content.replace("spoken once", "spoken twice"))
try:
    voice.ensure_narration_lock(lock, changed)
except RuntimeError:
    pass
else:
    raise AssertionError("Changed narration was not rejected")
`;
  try {
    execFileSync("python3", ["-c", program, root, generator], { encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

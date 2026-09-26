import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(packageRoot, "scripts", "generate_voice.py");

test("v6 voice generation parses one master and locks its wording", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-master-"));
  const script = path.join(root, "script.md");
  const audioSpec = path.join(root, "videospec", "specs", "audio", "spec.md");
  fs.mkdirSync(path.dirname(audioSpec), { recursive: true });
  fs.copyFileSync(path.join(packageRoot, "templates", "v6", "specs", "audio.md"), audioSpec);
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
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
script = root / "script.md"
audio_spec = root / "videospec" / "specs" / "audio" / "spec.md"
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
voice.condition_segment = lambda source, destination, overwrite, profile: fake_condition(source, destination, overwrite)
voice.merge_narration = lambda _inputs, destination, overwrite, profile: destination.write_bytes(b"master voice")
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
assert manifest["audioProfile"]["voiceMaster"]["compressionRatio"] == 2.5
assert manifest["voiceMaster"]["integratedLoudness"] == "-16 LUFS"
assert "ratio=2.5" in voice.scene_conditioning_filter(manifest["audioProfile"])
updated_spec = audio_spec.read_text(encoding="utf-8").replace('"compressionRatio": 2.5', '"compressionRatio": 3.0').replace('"integratedLoudnessLufs": -16', '"integratedLoudnessLufs": -17')
audio_spec.write_text(updated_spec, encoding="utf-8")
assert voice.main() == 0
updated = __import__("json").loads((voice_root / "manifest.json").read_text(encoding="utf-8"))
assert updated["audioProfile"]["voiceMaster"]["compressionRatio"] == 3.0
assert updated["voiceMaster"]["integratedLoudness"] == "-17 LUFS"
assert "ratio=3.0" in voice.scene_conditioning_filter(updated["audioProfile"])
stats = {"input_i": "-20", "input_lra": "5", "input_tp": "-3", "input_thresh": "-30", "target_offset": "0"}
assert "loudnorm=I=-17" in voice.two_pass_loudnorm_filter(stats, updated["audioProfile"])
audio_spec.write_text("""### Standard: Narration uses a non-destructive, controlled voice master

The production SHALL process each scene with a 75 Hz high-pass filter, gentle de-essing, 2.5:1 speech compression, and a -1.5 dB safety limiter. The resulting narration master SHALL be mono 48 kHz / 24-bit PCM WAV, calibrated with two-pass EBU R128 processing to -16 LUFS integrated loudness, 6 LU loudness range, and no more than -1.5 dBTP true peak.

### Standard: Final video mix is delivery-ready

After music and effects are mixed, the final video audio SHALL be stereo 48 kHz and mastered to -14 LUFS integrated loudness with no more than -1.0 dBTP true peak.
""", encoding="utf-8")
prose_profile, _ = voice.load_audio_profile(script)
assert prose_profile["voiceMaster"]["integratedLoudnessLufs"] == -16
assert prose_profile["finalMix"]["integratedLoudnessLufs"] == -14
changed = voice.scenes(content.replace("spoken once", "spoken twice"))
try:
    voice.ensure_narration_lock(lock, changed)
except RuntimeError:
    pass
else:
    raise AssertionError("Changed narration was not rejected")
script.write_text(content.replace("spoken once", "spoken twice"), encoding="utf-8")
sys.argv = ["generate_voice.py", str(script), "--revise-narration"]
try:
    voice.main()
except RuntimeError as error:
    assert "renewed content approval" in str(error)
else:
    raise AssertionError("Revision without renewed content approval was not rejected")
protected = ("context.md", "brief.md", "evidence.md", "script.md", "content-review.md")
for name in protected:
    if name != "script.md":
        (root / name).write_text(name, encoding="utf-8")
hashes = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in protected}
(root / "production.json").write_text(json.dumps({"approvals": {"content": {"hashes": {**hashes, "script.md": "stale"}}}}), encoding="utf-8")
try:
    voice.main()
except RuntimeError as error:
    assert "renewed content approval" in str(error)
else:
    raise AssertionError("Revision with stale content approval was not rejected")
(root / "production.json").write_text(json.dumps({"approvals": {"content": {"hashes": hashes}}}), encoding="utf-8")
(root / "render-authorization.json").write_text(json.dumps({"approved": True}), encoding="utf-8")
(root / "deliverables.json").write_text(json.dumps([{"path": "renders/old.mp4"}]), encoding="utf-8")
assert voice.main() == 0
archived = voice_root / "revisions" / "R001"
assert (archived / "narration-lock.json").is_file()
assert (archived / "manifest.json").is_file()
assert (archived / "render-authorization.json").is_file()
assert (archived / "deliverables.json").is_file()
assert json.loads((voice_root / "manifest.json").read_text(encoding="utf-8"))["narrationRevision"] == "R001"
assert json.loads((root / "render-authorization.json").read_text(encoding="utf-8"))["approved"] is False
assert json.loads((root / "deliverables.json").read_text(encoding="utf-8")) == []
`;
  try {
    execFileSync("python3", ["-c", program, root, generator], { encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

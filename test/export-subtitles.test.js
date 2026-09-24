import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const exporter = path.resolve("scripts/export_subtitles.py");

test("corrects timed ASR subtitles to v6 script wording without moving cues", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-subtitles-"));
  const timed = path.join(root, "raw.srt");
  const script = path.join(root, "script.md");
  const output = path.join(root, "corrected.srt");
  fs.writeFileSync(timed, "1\n00:00:00,100 --> 00:00:01,000\n今天存下钱\n\n2\n00:00:01,000 --> 00:00:02,000\n先看现今流\n");
  fs.writeFileSync(script, "# Script\n\n**口播：**\n\n> 今天存下钱，先看现金流。\n");
  try {
    execFileSync("python3", [exporter, "--correct-srt", timed, "--canonical-script", script, "--output", output]);
    const corrected = fs.readFileSync(output, "utf8");
    assert.match(corrected, /00:00:00,100 --> 00:00:01,000/);
    assert.match(corrected, /00:00:01,000 --> 00:00:02,000/);
    assert.match(corrected, /现金流/);
    assert.doesNotMatch(corrected, /现今流/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

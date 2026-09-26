import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  approveGate,
  archiveProduction,
  createProduction,
  doctorProject,
  getStatus,
  initProject,
  lintProduction,
  listProductions,
  loadProduction,
  nextActions,
  registerDeliverable,
  snapshotProduction,
  syncStandards,
  updateProject,
  validateProduction,
  VERSION,
  VIDEO_SPEC_SKILLS,
} from "../src/core.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-"));
  initProject(root);
  createProduction(root, "demo-video", {
    title: "Demo video",
    type: "faceless-explainer",
    duration: "60s",
    aspect: "16:9",
  });
  return root;
}

function authorizeRender(production) {
  const media = path.join(production.dir, "assets", "素材图.png");
  fs.mkdirSync(path.dirname(media), { recursive: true });
  fs.writeFileSync(media, "preview media");
  const inputs = ["script.md", "storyboard.md", "assets/素材图.png"];
  if (fs.existsSync(path.join(production.dir, "assets/audio/voice/manifest.json"))) inputs.push("assets/audio/voice/manifest.json");
  const hashes = Object.fromEntries(inputs.sort().map((name) => [
    name, crypto.createHash("sha256").update(fs.readFileSync(path.join(production.dir, name))).digest("hex"),
  ]));
  const version = crypto.createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
  fs.writeFileSync(path.join(production.dir, "render-authorization.json"), JSON.stringify({
    approved: true,
    confirmedBy: "Producer",
    confirmedAt: "2026-09-25T00:00:00Z",
    previewUrl: "http://localhost:3000/preview",
    preRenderQa: { passed: true, record: "tasks.md" },
    inputsSha256: hashes,
    previewVersionSha256: version,
  }, null, 2));
}

function complete(file) {
  let content = fs.readFileSync(file, "utf8")
    .replaceAll(/<!-- TODO(?::.*?)? -->/g, "Completed and verified")
    .replaceAll("- [ ]", "- [x]");
  if (path.basename(file) === "evidence.md") {
    content = content
      .replace("- Disposition: Completed and verified", "- Disposition: preserve")
      .replace("- Brief beat coverage: Completed and verified", "- Brief beat coverage: B001");
  }
  if (path.basename(file) === "storyboard.md") {
    content = content.replace("- Time: 00:00.000 - 00:00.000", "- Time: 00:00.000 - 01:00.000");
  }
  if (path.basename(file) === "script.md") {
    content = content.replace("- Script authority: Completed and verified", "- Script authority: newly-authored");
  }
  if (path.basename(file) === "publish.md") {
    content = content.replace(/#标签占位(\d+)/g, (_match, number) => `#verified-tag-${number}`);
  }
  fs.writeFileSync(file, content);
}

test("missing packaged skills fail before initialization or update changes the project", async () => {
  const isolatedPackage = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-package-"));
  const freshProject = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-empty-"));
  const existingProject = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-existing-"));
  try {
    fs.mkdirSync(path.join(isolatedPackage, "src"), { recursive: true });
    fs.copyFileSync(path.resolve("src/core.js"), path.join(isolatedPackage, "src", "core.js"));
    fs.writeFileSync(path.join(isolatedPackage, "package.json"), '{"type":"module"}\n');
    for (const name of VIDEO_SPEC_SKILLS.filter((name) => name !== "videospec-verify")) {
      const dir = path.join(isolatedPackage, ".agents", "skills", name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`);
    }
    const isolatedCore = await import(pathToFileURL(path.join(isolatedPackage, "src", "core.js")).href);
    assert.throws(() => isolatedCore.initProject(freshProject), /missing required skills: videospec-verify/);
    assert.deepEqual(fs.readdirSync(freshProject), []);

    initProject(existingProject);
    const configFile = path.join(existingProject, "videospec", "config.json");
    const before = fs.readFileSync(configFile, "utf8");
    assert.throws(() => isolatedCore.updateProject(existingProject), /missing required skills: videospec-verify/);
    assert.equal(fs.readFileSync(configFile, "utf8"), before);
  } finally {
    for (const dir of [isolatedPackage, freshProject, existingProject]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("scaffolds a production and invalidates stale approval", () => {
  const root = fixture();
  const config = JSON.parse(fs.readFileSync(path.join(root, "videospec", "config.json"), "utf8"));
  assert.equal(config.productionRoot, "productions");
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "videospec-propose", "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "video-script-review", "SKILL.md")), true);
  const installedSkills = fs.readdirSync(path.join(root, ".agents", "skills"))
    .filter((name) => name.startsWith("videospec"));
  assert.equal(installedSkills.length, 8);
  assert.equal(fs.readdirSync(path.join(root, ".agents", "skills")).length, VIDEO_SPEC_SKILLS.length);
  assert.equal(VIDEO_SPEC_SKILLS.length, 9);
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "finance-video-production")), false);
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "videospec-archive")), false);
  const embeddedList = execFileSync(
    process.execPath,
    [path.join(root, "videospec", "bin", "videospec.js"), "list", "--json"],
    { cwd: root, encoding: "utf8" },
  );
  assert.match(embeddedList, /demo-video/);
  const production = loadProduction(root, "demo-video");
  const history = JSON.parse(fs.readFileSync(path.join(production.dir, "history", "index.json"), "utf8"));
  assert.equal(history.snapshots[0].version, "V000");
  assert.equal(fs.existsSync(path.join(production.dir, "history", "V000", "context.md")), true);
  assert.equal(production.dir, path.join(root, "productions", "demo-video"));
  assert.equal(fs.existsSync(path.join(root, "videospec", "productions", "demo-video")), false);
  assert.deepEqual(listProductions(root).map((item) => item.id), ["demo-video"]);
  assert.equal(production.metadata.templateVersion, 6);
  assert.equal(fs.existsSync(path.join(production.dir, "brief.md")), true);
  assert.equal(fs.existsSync(path.join(production.dir, "evidence.md")), true);
  assert.match(nextActions(root, "demo-video")[0], /brief, evidence ledger, script/);
  for (const name of ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md"]) complete(path.join(production.dir, name));

  approveGate(root, "demo-video", "content", "Producer");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "approved");
  fs.appendFileSync(path.join(production.dir, "script.md"), "\nChanged after approval.\n");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "stale");
});

test("v6 scaffolds consolidated content and post-publication artifacts", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  assert.equal(production.metadata.templateVersion, 6);
  for (const kind of ["templates", "schemas"]) {
    assert.deepEqual(fs.readdirSync(path.join(root, "videospec", kind)), ["v6"]);
  }
  for (const name of ["brief.md", "evidence.md", "script.md", "learning.md"]) {
    assert.equal(fs.existsSync(path.join(production.dir, name)), true);
  }
  for (const name of ["topic.md", "reference-analysis.md", "retention-plan.md", "research.md", "analytics.md", "retrospective.md"]) {
    assert.equal(fs.existsSync(path.join(production.dir, name)), false);
  }
  assert.equal(lintProduction(root, "demo-video").templateVersion, 6);
  assert.match(nextActions(root, "demo-video")[0], /brief, evidence ledger, script/);
  const script = path.join(production.dir, "script.md");
  const validScript = fs.readFileSync(script, "utf8");
  fs.writeFileSync(script, validScript.replace("> speech_rate: 15", "> speech_rate: 101"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /speech_rate must be between -50 and 100/);
  fs.writeFileSync(script, validScript);
  const publish = path.join(production.dir, "publish.md");
  const validPublish = fs.readFileSync(publish, "utf8");
  fs.writeFileSync(publish, validPublish.replace("#标签占位10", "#标签占位1"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /publication tags must be distinct/);
  fs.writeFileSync(publish, validPublish);
  for (const name of ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md"]) {
    complete(path.join(production.dir, name));
  }
  approveGate(root, "demo-video", "content", "Producer");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "approved");
  fs.appendFileSync(path.join(production.dir, "evidence.md"), "\nNew source.\n");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "stale");
});

test("publication validation follows the current project delivery profile", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-delivery-"));
  initProject(root);
  const spec = path.join(root, "videospec", "specs", "delivery", "spec.md");
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8")
    .replace('"tagCount": 10', '"tagCount": 3')
    .replace('    { "ratio": "4:3", "path": "assets/covers/cover-4x3.png" },\n', ""));
  const production = createProduction(root, "custom-package");
  const publish = path.join(production.dir, "publish.md");
  const initial = fs.readFileSync(publish, "utf8");
  assert.match(initial, /cover-16x9\.png/);
  assert.doesNotMatch(initial, /cover-4x3\.png/);
  assert.match(initial, /#标签占位1 #标签占位2 #标签占位3\s/);
  complete(publish);
  const coverDir = path.join(production.dir, "assets", "covers");
  fs.mkdirSync(coverDir, { recursive: true });
  for (const name of ["cover-16x9.png", "cover-3x4.png"]) fs.writeFileSync(path.join(coverDir, name), name);
  assert.equal(getStatus(root, "custom-package").artifacts.publish.state, "ready");
  fs.writeFileSync(publish, fs.readFileSync(publish, "utf8").replace("## Publication tags", "## Ten publication tags"));
  assert.match(lintProduction(root, "custom-package").issues.join("\n"), /rename the legacy Ten publication tags heading/);
  fs.writeFileSync(publish, fs.readFileSync(publish, "utf8").replace("## Ten publication tags", "## Publication tags"));
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8").replace('"tagCount": 3', '"tagCount": 4'));
  assert.match(lintProduction(root, "custom-package").issues.join("\n"), /exactly 4 unnumbered/);
  fs.writeFileSync(spec, "# Delivery Standards\n\n## Standards\n\n### Standard: Deliverables match the target platform\n\nThe production SHALL meet approved requirements.\n");
  const legacy = createProduction(root, "prior-v6-package");
  const legacyPublish = fs.readFileSync(path.join(legacy.dir, "publish.md"), "utf8");
  assert.match(legacyPublish, /cover-4x3\.png/);
  assert.match(legacyPublish, /#标签占位10/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("rejects productions created with removed template versions", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  production.metadata.templateVersion = 5;
  fs.writeFileSync(production.metadataFile, `${JSON.stringify(production.metadata, null, 2)}\n`);
  assert.throws(() => lintProduction(root, "demo-video"), /Only v6 is supported/);
});

test("v6 operational activity and measured voice timing leave content approval intact", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  for (const name of ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md"]) {
    complete(path.join(production.dir, name));
  }
  approveGate(root, "demo-video", "content", "Producer");
  fs.appendFileSync(path.join(production.dir, "activity.md"), "\n- V001: Timed and rendered the approved narration.\n");
  const voiceDir = path.join(production.dir, "assets", "audio", "voice");
  fs.mkdirSync(voiceDir, { recursive: true });
  fs.writeFileSync(path.join(voiceDir, "manifest.json"), JSON.stringify({ timing: { totalSeconds: 60 } }));
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "approved");
  fs.appendFileSync(path.join(production.dir, "context.md"), "\nChanged content decision.\n");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "stale");
});

test("v6 validates narration anchors, brief beats, and material scene references", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  for (const name of ["brief.md", "evidence.md", "script.md", "storyboard.md", "materials.md"]) {
    complete(path.join(production.dir, name));
  }
  const brief = path.join(production.dir, "brief.md");
  const originalBrief = fs.readFileSync(brief, "utf8");
  fs.writeFileSync(brief, originalBrief.replace("- Narration anchor: Completed and verified", "- Narration anchor: missing spoken phrase"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /narration anchor is not present/);
  fs.writeFileSync(brief, originalBrief);

  const storyboard = path.join(production.dir, "storyboard.md");
  const originalStoryboard = fs.readFileSync(storyboard, "utf8");
  fs.writeFileSync(storyboard, originalStoryboard.replace("- Brief beat: B001", "- Brief beat: B999"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /missing brief beat B999/);
  fs.writeFileSync(storyboard, originalStoryboard.replace("- Brief beat: B001", "- Script scene: S999"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /must reference a Brief beat/);
  fs.writeFileSync(storyboard, originalStoryboard);

  const materials = path.join(production.dir, "materials.md");
  fs.writeFileSync(materials, fs.readFileSync(materials, "utf8").replace("- Scene: S001", "- Scene: S999"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /references missing storyboard scene S999/);
});

test("early v6 scene mappings remain readable without the new contract marker", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  delete production.metadata.artifactContractVersion;
  fs.writeFileSync(production.metadataFile, `${JSON.stringify(production.metadata, null, 2)}\n`);
  for (const name of ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md", "storyboard.md"]) {
    complete(path.join(production.dir, name));
  }
  const brief = path.join(production.dir, "brief.md");
  fs.writeFileSync(brief, fs.readFileSync(brief, "utf8").replace("- Narration anchor: Completed and verified", "- Script coverage: S001"));
  const evidence = path.join(production.dir, "evidence.md");
  fs.writeFileSync(evidence, fs.readFileSync(evidence, "utf8").replace("- Brief beat coverage: B001", "- Script scene coverage: S001"));
  const storyboard = path.join(production.dir, "storyboard.md");
  fs.writeFileSync(storyboard, fs.readFileSync(storyboard, "utf8").replace("- Brief beat: B001", "- Script scene: S001"));
  approveGate(root, "demo-video", "content", "Producer");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "approved");
  assert.doesNotMatch(lintProduction(root, "demo-video").issues.join("\n"), /Narration anchor|Brief beat coverage|must reference a Brief beat/);
});

test("update adds an unsigned activity ledger to an existing v6 production", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  for (const name of ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md"]) {
    complete(path.join(production.dir, name));
  }
  approveGate(root, "demo-video", "content", "Producer");
  fs.rmSync(path.join(production.dir, "activity.md"));
  const result = updateProject(root);
  assert.deepEqual(result.activityLedgers, ["demo-video"]);
  assert.equal(fs.existsSync(path.join(production.dir, "activity.md")), true);
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "approved");
});

test("v6 signs covers and keeps registered deliverables inside the archive", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  for (const name of ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md", "storyboard.md", "materials.md", "tasks.md", "review.md", "publish.md", "learning.md"]) {
    complete(path.join(production.dir, name));
  }
  const reviewFile = path.join(production.dir, "review.md");
  const [automatedReview, humanReview] = fs.readFileSync(reviewFile, "utf8").split("## Human final checklist");
  fs.writeFileSync(reviewFile, `${automatedReview}## Human final checklist${humanReview.replaceAll("- [x]", "- [ ]")}`);
  approveGate(root, "demo-video", "content", "Producer");
  const externalRender = path.join(root, "external-render.mp4");
  fs.writeFileSync(externalRender, "approved video bytes");
  assert.throws(() => registerDeliverable(root, "demo-video", externalRender, "master"), /render confirmation/);
  authorizeRender(production);
  execFileSync("python3", [path.join(root, "videospec", "scripts", "check_render_authorization.py"), production.dir]);
  const item = registerDeliverable(root, "demo-video", externalRender, "master");
  assert.equal(path.isAbsolute(item.path), false);
  assert.equal(fs.existsSync(path.join(production.dir, item.path)), true);
  fs.writeFileSync(externalRender, "new approved video bytes");
  const replacement = registerDeliverable(root, "demo-video", externalRender, "master");
  assert.notEqual(replacement.path, item.path);
  assert.equal(fs.readFileSync(path.join(production.dir, item.path), "utf8"), "approved video bytes");
  fs.appendFileSync(path.join(production.dir, "storyboard.md"), "\nChanged after preview.\n");
  assert.throws(() => registerDeliverable(root, "demo-video", externalRender, "changed"), /Preview input changed/);
  authorizeRender(production);
  assert.throws(() => approveGate(root, "demo-video", "final", "Editor"), /cover-16x9.png/);
  assert.equal(getStatus(root, "demo-video").artifacts.publish.state, "draft");

  const coverDir = path.join(production.dir, "assets", "covers");
  fs.mkdirSync(coverDir, { recursive: true });
  for (const name of ["cover-16x9.png", "cover-4x3.png", "cover-3x4.png"]) {
    fs.writeFileSync(path.join(coverDir, name), `approved ${name}`);
  }
  const version = snapshotProduction(root, "demo-video", "after: prepared covers");
  assert.equal(fs.existsSync(path.join(version.path, "assets", "covers", "cover-16x9.png")), true);
  approveGate(root, "demo-video", "final", "Editor");
  approveGate(root, "demo-video", "publish", "Publisher");
  const cover = path.join(coverDir, "cover-16x9.png");
  fs.writeFileSync(cover, "different cover");
  assert.equal(getStatus(root, "demo-video").approvals.final.state, "stale");
  assert.equal(getStatus(root, "demo-video").approvals.publish.state, "stale");
  fs.writeFileSync(cover, "approved cover-16x9.png");
  const registeredVideo = path.join(production.dir, replacement.path);
  fs.writeFileSync(registeredVideo, "changed video bytes");
  assert.equal(getStatus(root, "demo-video").approvals.final.state, "stale");
  assert.equal(getStatus(root, "demo-video").approvals.publish.state, "stale");
  fs.writeFileSync(registeredVideo, "new approved video bytes");
  const deliverySpec = path.join(root, "videospec", "specs", "delivery", "spec.md");
  const originalDeliverySpec = fs.readFileSync(deliverySpec, "utf8");
  fs.writeFileSync(deliverySpec, `${originalDeliverySpec}\nUpdated packaging guidance.\n`);
  assert.equal(getStatus(root, "demo-video").approvals.final.state, "stale");
  assert.equal(getStatus(root, "demo-video").approvals.publish.state, "stale");
  fs.writeFileSync(deliverySpec, originalDeliverySpec);
  fs.writeFileSync(path.join(production.dir, "publication.json"), JSON.stringify({ published: true }));
  assert.deepEqual(validateProduction(root, "demo-video"), { valid: true, issues: [] });
  const archived = archiveProduction(root, "demo-video");
  const archivedItem = JSON.parse(fs.readFileSync(path.join(archived, "deliverables.json"), "utf8"))[0];
  assert.equal(path.isAbsolute(archivedItem.path), false);
  assert.equal(fs.existsSync(path.join(archived, archivedItem.path)), true);
  assert.equal(fs.existsSync(path.join(archived, item.path)), true);
  assert.equal(fs.existsSync(path.join(archived, "assets", "covers", "cover-16x9.png")), true);
});

test("changed project audio standards invalidate an authorized preview", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const audioSpec = path.join(root, "videospec", "specs", "audio", "spec.md");
  const voiceManifest = path.join(production.dir, "assets", "audio", "voice", "manifest.json");
  fs.mkdirSync(path.dirname(voiceManifest), { recursive: true });
  fs.writeFileSync(voiceManifest, JSON.stringify({
    audioProfileSource: { sha256: crypto.createHash("sha256").update(fs.readFileSync(audioSpec)).digest("hex") },
  }));
  authorizeRender(production);
  const checker = path.join(root, "videospec", "scripts", "check_render_authorization.py");
  execFileSync("python3", [checker, production.dir]);
  const script = path.join(production.dir, "script.md");
  const approvedScript = fs.readFileSync(script, "utf8");
  fs.appendFileSync(script, "\nRevised narration.\n");
  assert.throws(() => execFileSync("python3", [checker, production.dir], { stdio: "pipe" }), /preview input changed since confirmation: script.md/);
  fs.writeFileSync(script, approvedScript);
  fs.appendFileSync(audioSpec, "\nUpdated project audio target.\n");
  assert.throws(() => execFileSync("python3", [checker, production.dir], { stdio: "pipe" }), /project audio profile changed/);
  const render = path.join(production.dir, "renders", "master.mp4");
  fs.writeFileSync(render, "rendered video");
  assert.throws(() => registerDeliverable(root, "demo-video", render), /Project audio profile changed/);
});

test("retains immutable before and after review snapshots", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const before = snapshotProduction(root, "demo-video", "before: change the hook");
  fs.appendFileSync(path.join(production.dir, "brief.md"), "\nUpdated hook.\n");
  const after = snapshotProduction(root, "demo-video", "after: change the hook");

  assert.equal(before.version, "V001");
  assert.equal(after.version, "V002");
  assert.doesNotMatch(fs.readFileSync(path.join(production.dir, "history", "V001", "brief.md"), "utf8"), /Updated hook/);
  assert.match(fs.readFileSync(path.join(production.dir, "history", "V002", "brief.md"), "utf8"), /Updated hook/);
  assert.throws(() => snapshotProduction(root, "demo-video"), /Snapshot note is required/);
});

test("keeps the legacy production directory when productionRoot is absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-"));
  initProject(root);
  const configFile = path.join(root, "videospec", "config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  delete config.productionRoot;
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  const production = createProduction(root, "legacy-location");
  assert.equal(production.dir, path.join(root, "videospec", "productions", "legacy-location"));
});

test("stores an initialization TTS credential outside production artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-"));
  initProject(root, { ttsKey: "test-tts-key" });
  const secret = path.join(root, "videospec", ".secrets", "tts.env");
  const config = fs.readFileSync(path.join(root, "videospec", "config.json"), "utf8");

  assert.equal(fs.readFileSync(secret, "utf8"), "VOLCENGINE_TTS_API_KEY=test-tts-key\n");
  assert.equal(fs.statSync(secret).mode & 0o077, 0);
  assert.doesNotMatch(config, /test-tts-key/);
  assert.equal(fs.existsSync(path.join(root, "videospec", "scripts", "generate_voice.py")), true);
  assert.equal(fs.existsSync(path.join(root, "videospec", "scripts", "export_subtitles.py")), true);
});

test("copies legacy productions to the external root during update", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-"));
  initProject(root);
  const configFile = path.join(root, "videospec", "config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  delete config.productionRoot;
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  fs.rmSync(path.join(root, "productions"), { recursive: true, force: true });
  const legacy = createProduction(root, "migrated-video");
  fs.writeFileSync(path.join(legacy.dir, "brief.md"), "# Preserved brief\n");

  const result = updateProject(root);
  const migrated = loadProduction(root, "migrated-video");
  assert.equal(result.migration.state, "copied");
  assert.equal(migrated.dir, path.join(root, "productions", "migrated-video"));
  assert.equal(fs.readFileSync(path.join(migrated.dir, "brief.md"), "utf8"), "# Preserved brief\n");
  assert.equal(fs.existsSync(path.join(root, "videospec", "productions", "migrated-video")), true);
  assert.equal(JSON.parse(fs.readFileSync(configFile, "utf8")).productionRoot, "productions");
});

test("rejects a production root outside the project", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-"));
  initProject(root);
  const configFile = path.join(root, "videospec", "config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  config.productionRoot = "../outside";
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  assert.throws(() => createProduction(root, "unsafe-location"), /must stay inside the project root/);
});

test("detects a standards delta edited after sync", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const delta = path.join(production.dir, "specs", "audio.md");
  fs.writeFileSync(delta, `## ADDED Standards\n\n### Standard: Music ducks under speech\n\nThe production SHALL duck music under speech.\n`);
  syncStandards(root, "demo-video");
  fs.appendFileSync(delta, "\nChanged after sync.\n");
  assert.equal(getStatus(root, "demo-video").standardsDelta.state, "stale");
});

test("updates generated skills and runtime without changing production files", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const brief = path.join(production.dir, "brief.md");
  fs.writeFileSync(brief, "# User-owned brief\n");
  fs.writeFileSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md"), "outdated\n");
  const formerArchiveSkill = path.join(root, ".agents", "skills", "videospec-archive");
  fs.mkdirSync(formerArchiveSkill, { recursive: true });
  fs.writeFileSync(path.join(formerArchiveSkill, "SKILL.md"), "# User-customized former archive skill\n");
  const customFinanceSkill = path.join(root, ".agents", "skills", "finance-video-production");
  fs.mkdirSync(customFinanceSkill, { recursive: true });
  fs.writeFileSync(path.join(customFinanceSkill, "SKILL.md"), "# User-owned finance skill\n");

  const result = updateProject(root);

  assert.equal(result.version, VERSION);
  assert.equal(result.agentLayer.skills.length, VIDEO_SPEC_SKILLS.length);
  assert.deepEqual(result.agentLayer.retiredSkills, ["videospec/retired-skills/videospec-archive"]);
  assert.equal(fs.existsSync(formerArchiveSkill), false);
  assert.equal(fs.readFileSync(path.join(customFinanceSkill, "SKILL.md"), "utf8"), "# User-owned finance skill\n");
  assert.equal(fs.readFileSync(path.join(root, result.agentLayer.retiredSkills[0], "SKILL.md"), "utf8"), "# User-customized former archive skill\n");
  assert.equal(fs.readFileSync(brief, "utf8"), "# User-owned brief\n");
  assert.match(fs.readFileSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md"), "utf8"), /name: videospec/);
  assert.match(fs.readFileSync(path.join(root, ".agents", "skills", "videospec-apply", "SKILL.md"), "utf8"), /read the current `videospec\/specs\/audio\/spec\.md`, `videospec\/specs\/visual\/spec\.md`, and `videospec\/specs\/creative\/spec\.md`/);
  assert.match(fs.readFileSync(path.join(root, ".agents", "skills", "videospec-verify", "SKILL.md"), "utf8"), /current audio, visual, and creative specs/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "videospec", "config.json"), "utf8")).toolVersion, VERSION);
  assert.equal(doctorProject(root).valid, true);
  assert.deepEqual(updateProject(root).agentLayer.retiredSkills, []);
});

test("update adds missing universal standards without replacing project wording", () => {
  const root = fixture();
  const audio = path.join(root, "videospec", "specs", "audio", "spec.md");
  const visual = path.join(root, "videospec", "specs", "visual", "spec.md");
  const creative = path.join(root, "videospec", "specs", "creative", "spec.md");
  const removeStandard = (content, name) => content.replace(
    new RegExp(`^### Standard: ${name}\\n[\\s\\S]*?(?=^### Standard: |$(?![\\s\\S]))`, "m"),
    "",
  );
  let audioContent = removeStandard(fs.readFileSync(audio, "utf8"), "Captions convey meaningful audio information");
  audioContent = removeStandard(audioContent, "Essential visual information is available through audio");
  fs.writeFileSync(audio, audioContent);
  let visualContent = fs.readFileSync(visual, "utf8")
    .replace("For productions with on-screen captions,", "For this project, captions are always top aligned. For productions with on-screen captions,");
  visualContent = removeStandard(visualContent, "Information-bearing overlay text maintains contrast");
  visualContent = removeStandard(visualContent, "Color is not the only carrier of meaning");
  visualContent = removeStandard(visualContent, "Data graphics preserve numeric context");
  visualContent = removeStandard(visualContent, "Flashing effects remain below safety thresholds");
  fs.writeFileSync(visual, visualContent);
  fs.writeFileSync(creative, removeStandard(fs.readFileSync(creative, "utf8"), "Complex information has processing time"));

  const result = updateProject(root);
  assert.deepEqual(result.standardsAdded, [
    "audio: Captions convey meaningful audio information",
    "audio: Essential visual information is available through audio",
    "visual: Information-bearing overlay text maintains contrast",
    "visual: Color is not the only carrier of meaning",
    "visual: Data graphics preserve numeric context",
    "visual: Flashing effects remain below safety thresholds",
    "creative: Complex information has processing time",
  ]);
  const updatedAudio = fs.readFileSync(audio, "utf8");
  const updatedVisual = fs.readFileSync(visual, "utf8");
  const updatedCreative = fs.readFileSync(creative, "utf8");
  assert.match(updatedAudio, /### Standard: Captions convey meaningful audio information/);
  assert.match(updatedAudio, /### Standard: Essential visual information is available through audio/);
  assert.match(updatedVisual, /For this project, captions are always top aligned/);
  assert.match(updatedVisual, /### Standard: Information-bearing overlay text maintains contrast/);
  assert.match(updatedVisual, /### Standard: Color is not the only carrier of meaning/);
  assert.match(updatedVisual, /### Standard: Data graphics preserve numeric context/);
  assert.match(updatedVisual, /### Standard: Flashing effects remain below safety thresholds/);
  assert.match(updatedCreative, /### Standard: Complex information has processing time/);
  assert.deepEqual(updateProject(root).standardsAdded, []);
  assert.equal(fs.readFileSync(audio, "utf8"), updatedAudio);
  assert.equal(fs.readFileSync(visual, "utf8"), updatedVisual);
  assert.equal(fs.readFileSync(creative, "utf8"), updatedCreative);
});

test("doctor reports a healthy initialized project and the CLI exposes its version", () => {
  const root = fixture();
  const result = doctorProject(root);
  assert.equal(result.valid, true);
  assert.equal(result.checks.find((check) => check.name === "skills").status, "pass");

  const version = execFileSync(process.execPath, [path.resolve("bin/videospec.js"), "--version"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  assert.equal(version, VERSION);
});

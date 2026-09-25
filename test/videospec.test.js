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

function fixture(version = 5) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "videospec-"));
  initProject(root);
  createProduction(root, "demo-video", {
    title: "Demo video",
    type: "faceless-explainer",
    duration: "60s",
    aspect: "16:9",
  });
  if (version !== 6) useVersionTemplates(root, version);
  return root;
}

function useVersionTemplates(root, version) {
  const production = loadProduction(root, "demo-video");
  production.metadata.templateVersion = version;
  if (version < 6) delete production.metadata.artifactContractVersion;
  fs.writeFileSync(production.metadataFile, `${JSON.stringify(production.metadata, null, 2)}\n`);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(`templates/v${version}/manifest.json`), "utf8"));
  const values = {
    "production.id": production.metadata.id,
    "production.title": production.metadata.title,
    "production.type": production.metadata.type,
    "production.duration": production.metadata.duration,
    "production.aspectRatio": production.metadata.aspectRatio,
  };
  for (const [destination, source] of Object.entries(manifest.productionFiles)) {
    let content = fs.readFileSync(path.resolve(`templates/v${version}`, source), "utf8");
    content = content.replace(/\{\{([a-zA-Z0-9.]+)\}\}/g, (_match, key) => values[key]);
    content = content.replace(/^templateVersion:\s*\d+\s*$/m, `templateVersion: ${version}`);
    const file = path.join(production.dir, destination);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return production;
}

function authorizeRender(production) {
  const media = path.join(production.dir, "assets", "素材图.png");
  fs.mkdirSync(path.dirname(media), { recursive: true });
  fs.writeFileSync(media, "preview media");
  const hashes = Object.fromEntries(["storyboard.md", "assets/素材图.png"].sort().map((name) => [
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
  if (path.basename(file) === "reference-analysis.md") {
    content = content
      .replace("- Mode: Completed and verified", "- Mode: conversation")
      .replace("- Authority: Completed and verified", "- Authority: newly-authored")
      .replace("- Reference input: Completed and verified", "- Reference input: current conversation")
      + "\n### Reference R001\n\n- Source locator: current conversation\n- Extracted idea: User's stated video goal\n- Verification: user-provided production scope\n- Adaptation decision: preserve\n- Script coverage: S001\n";
  }
  if (path.basename(file) === "retention-plan.md") {
    content = content
      .replace("- Script coverage: Completed and verified", "- Script coverage: S001");
  }
  if (path.basename(file) === "evidence.md") {
    content = content
      .replace("- Disposition: Completed and verified", "- Disposition: preserve")
      .replace("- Brief beat coverage: Completed and verified", "- Brief beat coverage: B001");
  }
  if (["script.md", "storyboard.md"].includes(path.basename(file))) {
    content = content.replace("- Time: 00:00.000 - 00:00.000", "- Time: 00:00.000 - 01:00.000");
  }
  if (path.basename(file) === "script.md") {
    content = content
      .replace("- Script authority: Completed and verified", "- Script authority: newly-authored")
      .replace("## 00:00–00:00｜Completed and verified", "## 00:00–01:00｜Completed and verified");
  }
  if (path.basename(file) === "publish.md") {
    let tagNumber = 0;
    content = content.replace(/^\d+\. Completed and verified$/gm, () => {
      tagNumber += 1;
      return `${tagNumber}. verified-tag-${tagNumber}`;
    });
    content = content.replace(/#标签占位(\d+)/g, (_match, number) => `#verified-tag-${number}`);
  }
  fs.writeFileSync(file, content);
}

function useV1Templates(root) {
  const production = useVersionTemplates(root, 1);
  production.metadata.approvals = { brief: null, storyboard: null, final: null };
  fs.writeFileSync(production.metadataFile, `${JSON.stringify(production.metadata, null, 2)}\n`);
  return production;
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
  assert.equal(production.metadata.templateVersion, 5);
  assert.equal(fs.existsSync(path.join(production.dir, "retention-plan.md")), true);
  assert.match(fs.readFileSync(path.join(production.dir, "script.md"), "utf8"), /\*\*合成参数：\*\*[\s\S]*\*\*演绎提示：\*\*/);
  assert.deepEqual(nextActions(root, "demo-video"), ["Automatically complete the angle slate, retention plan, research, script, editorial opposition, strict AI review, and any fixable review/re-review loop."]);
  for (const name of ["context.md", "topic.md", "retention-plan.md", "research.md", "script.md", "reference-analysis.md", "content-review.md"]) complete(path.join(production.dir, name));

  approveGate(root, "demo-video", "content", "Producer");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "approved");

  fs.appendFileSync(path.join(production.dir, "script.md"), "\nChanged after approval.\n");
  assert.equal(getStatus(root, "demo-video").approvals.content.state, "stale");
});

test("v6 scaffolds consolidated content and post-publication artifacts", () => {
  const root = fixture(6);
  const production = loadProduction(root, "demo-video");
  assert.equal(production.metadata.templateVersion, 6);
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

test("v6 operational activity and measured voice timing leave content approval intact", () => {
  const root = fixture(6);
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
  const root = fixture(6);
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
  const root = fixture(6);
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
  const root = fixture(6);
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
  const root = fixture(6);
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
  fs.writeFileSync(path.join(production.dir, "publication.json"), JSON.stringify({ published: true }));
  assert.deepEqual(validateProduction(root, "demo-video"), { valid: true, issues: [] });
  const archived = archiveProduction(root, "demo-video");
  const archivedItem = JSON.parse(fs.readFileSync(path.join(archived, "deliverables.json"), "utf8"))[0];
  assert.equal(path.isAbsolute(archivedItem.path), false);
  assert.equal(fs.existsSync(path.join(archived, archivedItem.path)), true);
  assert.equal(fs.existsSync(path.join(archived, item.path)), true);
  assert.equal(fs.existsSync(path.join(archived, "assets", "covers", "cover-16x9.png")), true);
});

test("retains immutable before and after review snapshots", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const before = snapshotProduction(root, "demo-video", "before: change the hook");
  fs.appendFileSync(path.join(production.dir, "topic.md"), "\nUpdated hook.\n");
  const after = snapshotProduction(root, "demo-video", "after: change the hook");

  assert.equal(before.version, "V001");
  assert.equal(after.version, "V002");
  assert.doesNotMatch(fs.readFileSync(path.join(production.dir, "history", "V001", "topic.md"), "utf8"), /Updated hook/);
  assert.match(fs.readFileSync(path.join(production.dir, "history", "V002", "topic.md"), "utf8"), /Updated hook/);
  assert.throws(() => snapshotProduction(root, "demo-video"), /Snapshot note is required/);
});

test("runs approval, standards sync, delivery, validation, and archive end to end", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");

  for (const name of ["context.md", "topic.md", "retention-plan.md", "research.md", "script.md", "reference-analysis.md", "content-review.md"]) complete(path.join(production.dir, name));
  approveGate(root, "demo-video", "content", "Producer");

  for (const name of ["storyboard.md", "materials.md"]) complete(path.join(production.dir, name));

  for (const name of ["tasks.md", "review.md"]) complete(path.join(production.dir, name));
  const render = path.join(production.dir, "renders", "final.mp4");
  fs.writeFileSync(render, "deterministic test render");
  registerDeliverable(root, "demo-video", render, "master");
  const legacyManifestFile = path.join(production.dir, "deliverables.json");
  const legacyManifest = JSON.parse(fs.readFileSync(legacyManifestFile, "utf8"));
  legacyManifest[0].path = render;
  fs.writeFileSync(legacyManifestFile, `${JSON.stringify(legacyManifest, null, 2)}\n`);

  assert.deepEqual(nextActions(root, "demo-video"), [
    "Automatically complete the release package before final approval: selected title, separately composed 16:9/4:3/3:4 covers, description, exactly ten distinct tags, platform settings, and a master-promise check.",
  ]);

  fs.writeFileSync(path.join(production.dir, "specs", "visual.md"), `## ADDED Standards\n\n### Standard: Captions use at most two lines\n\nThe production SHALL keep captions to at most two lines.\n\n#### Check: Preview\n\n- **WHEN** captions are shown\n- **THEN** no caption SHALL exceed two lines\n`);
  const synced = syncStandards(root, "demo-video");
  assert.equal(synced.operationCount, 1);
  assert.match(
    fs.readFileSync(path.join(root, "videospec", "specs", "visual", "spec.md"), "utf8"),
    /Captions use at most two lines/,
  );

  complete(path.join(production.dir, "publish.md"));
  approveGate(root, "demo-video", "final", "Editor in chief");
  assert.ok(loadProduction(root, "demo-video").metadata.approvals.final.hashes["publish.md"]);
  fs.appendFileSync(path.join(production.dir, "publish.md"), "\nRevised title after final review.\n");
  assert.equal(getStatus(root, "demo-video").approvals.final.state, "stale");
  approveGate(root, "demo-video", "final", "Editor in chief");
  approveGate(root, "demo-video", "publish", "Publisher");
  fs.writeFileSync(path.join(production.dir, "publication.json"), JSON.stringify({ published: true, platform: "Test", url: "https://example.test/video/demo", platformId: "demo", publishedAt: "2026-09-14T00:00:00Z" }));
  for (const name of ["analytics.md", "retrospective.md"]) complete(path.join(production.dir, name));
  assert.deepEqual(validateProduction(root, "demo-video"), { valid: true, issues: [] });

  const destination = archiveProduction(root, "demo-video");
  assert.equal(fs.existsSync(destination), true);
  assert.equal(fs.existsSync(production.dir), false);
  assert.equal(path.dirname(destination), path.join(root, "productions", "archive"));
  const archivedManifest = JSON.parse(fs.readFileSync(path.join(destination, "deliverables.json"), "utf8"));
  assert.equal(path.isAbsolute(archivedManifest[0].path), false);
  assert.equal(fs.existsSync(path.join(destination, archivedManifest[0].path)), true);
  const archivedMetadata = JSON.parse(fs.readFileSync(path.join(destination, "production.json"), "utf8"));
  assert.equal(archivedMetadata.archivePathMigration.changes[0].from, render);
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
  fs.writeFileSync(path.join(legacy.dir, "proposal.md"), "# Preserved proposal\n");

  const result = updateProject(root);
  const migrated = loadProduction(root, "migrated-video");
  assert.equal(result.migration.state, "copied");
  assert.equal(migrated.dir, path.join(root, "productions", "migrated-video"));
  assert.equal(fs.readFileSync(path.join(migrated.dir, "proposal.md"), "utf8"), "# Preserved proposal\n");
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

test("lints template structure and cross-artifact references", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  for (const name of ["context.md", "topic.md", "reference-analysis.md", "retention-plan.md", "research.md", "script.md", "content-review.md", "storyboard.md", "materials.md", "tasks.md", "review.md", "publish.md", "analytics.md", "retrospective.md"]) {
    complete(path.join(production.dir, name));
  }

  assert.deepEqual(lintProduction(root, "demo-video"), {
    valid: true,
    templateVersion: 5,
    issues: [],
    warnings: [],
  });

  const script = path.join(production.dir, "script.md");
  const validScript = fs.readFileSync(script, "utf8");
  fs.writeFileSync(script, validScript.replace("## 00:00–01:00", "## 00:00.000–01:00.123"));
  assert.equal(lintProduction(root, "demo-video").valid, true);
  fs.writeFileSync(script, validScript);
  fs.writeFileSync(script, validScript.replace("> speech_rate: 15", "> speech_rate: 101"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /speech_rate must be between -50 and 100/);
  fs.writeFileSync(script, validScript);

  const retentionPlan = path.join(production.dir, "retention-plan.md");
  const validRetentionPlan = fs.readFileSync(retentionPlan, "utf8");
  fs.writeFileSync(retentionPlan, validRetentionPlan.replace("- Script coverage: S001", "- Script coverage: S999"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /retention-plan\.md B001 references missing script scene S999/);
  fs.writeFileSync(retentionPlan, validRetentionPlan);

  const storyboard = path.join(production.dir, "storyboard.md");
  fs.writeFileSync(storyboard, fs.readFileSync(storyboard, "utf8").replace("- Script scene: S001", "- Script scene: S999"));
  const result = lintProduction(root, "demo-video");
  assert.equal(result.valid, false);
  assert.match(result.issues.join("\n"), /references missing script scene S999/);
});

test("requires reference material to map to real script scenes", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  complete(path.join(production.dir, "script.md"));
  const reference = path.join(production.dir, "reference-analysis.md");
  let content = fs.readFileSync(reference, "utf8")
    .replace("- Mode: <!-- TODO: conversation, extract, or adapt -->", "- Mode: extract")
    .replace("- Reference input: <!-- TODO: current-conversation locator and any source file/link -->", "- Reference input: current conversation / supplied transcript")
    .replaceAll(/<!-- TODO(?::.*?)? -->/g, "Completed and verified");
  content += `\n### Reference R001\n\n- Source locator: transcript 00:00–00:20\n- Extracted idea: First material idea\n- Verification: source-specific idea; no external factual claim\n- Adaptation decision: reframe\n- Script coverage: S001\n`;
  fs.writeFileSync(reference, content);
  assert.doesNotMatch(lintProduction(root, "demo-video").issues.join("\n"), /reference-analysis\.md R001/);

  fs.writeFileSync(reference, content.replace("Script coverage: S001", "Script coverage: S999"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /reference-analysis\.md R001 references missing script scene S999/);
});

test("locks user-authoritative subtitle scripts to a traceable source segment", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const script = path.join(production.dir, "script.md");
  complete(script);
  let scriptContent = fs.readFileSync(script, "utf8")
    .replace("- Script authority: newly-authored", "- Script authority: user-authoritative")
    .replace("- Source subtitle coverage: Completed and verified", "- Source subtitle coverage: None");
  fs.writeFileSync(script, scriptContent);
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /S001 is missing Source subtitle coverage/);

  scriptContent = scriptContent.replace("- Source subtitle coverage: None", "- Source subtitle coverage: supplied.srt:1-2");
  fs.writeFileSync(script, scriptContent);
  const reference = path.join(production.dir, "reference-analysis.md");
  complete(reference);
  let referenceContent = fs.readFileSync(reference, "utf8")
    .replace("- Mode: conversation", "- Mode: authoritative-script")
    .replace("- Authority: newly-authored", "- Authority: user-authoritative")
    + "\n### Reference R002\n\n- Source locator: supplied.srt:1-2\n- Extracted idea: User-authoritative narration segment\n- Verification: user-provided script\n- Adaptation decision: reframe\n- Script coverage: S001\n";
  fs.writeFileSync(reference, referenceContent);
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /R002 must use Adaptation decision: preserve/);

  fs.writeFileSync(script, scriptContent.replace("- Script authority: user-authoritative", "- Script authority: user-authored"));
  referenceContent = referenceContent
    .replace("- Mode: authoritative-script", "- Mode: user-authored-script")
    .replace("- Authority: user-authoritative", "- Authority: user-authored")
    .replace("- Adaptation decision: reframe", "- Adaptation decision: preserve");
  fs.writeFileSync(reference, referenceContent);
  const userAuthoredIssues = lintProduction(root, "demo-video").issues.join("\n");
  assert.doesNotMatch(userAuthoredIssues, /user-authored-script mode must declare Authority/);
  assert.doesNotMatch(userAuthoredIssues, /R002 must use Adaptation decision: preserve/);
});

test("continues to lint template v1 productions after v2 becomes the default", () => {
  const root = fixture();
  const production = useV1Templates(root);
  for (const name of ["proposal.md", "brief.md", "script.md", "storyboard.md", "materials.md", "review.md"]) {
    complete(path.join(production.dir, name));
  }
  assert.deepEqual(lintProduction(root, "demo-video"), {
    valid: true,
    templateVersion: 1,
    issues: [],
    warnings: [],
  });
});

test("updates generated skills and runtime without changing production files", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");
  const proposal = path.join(production.dir, "proposal.md");
  fs.writeFileSync(proposal, "# User-owned proposal\n");
  fs.writeFileSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md"), "outdated\n");
  const formerArchiveSkill = path.join(root, ".agents", "skills", "videospec-archive");
  fs.mkdirSync(formerArchiveSkill, { recursive: true });
  fs.writeFileSync(path.join(formerArchiveSkill, "SKILL.md"), "# User-customized former archive skill\n");

  const result = updateProject(root);

  assert.equal(result.version, VERSION);
  assert.equal(result.agentLayer.skills.length, VIDEO_SPEC_SKILLS.length);
  assert.deepEqual(result.agentLayer.retiredSkills, ["videospec/retired-skills/videospec-archive"]);
  assert.equal(fs.existsSync(formerArchiveSkill), false);
  assert.equal(fs.readFileSync(path.join(root, result.agentLayer.retiredSkills[0], "SKILL.md"), "utf8"), "# User-customized former archive skill\n");
  assert.equal(fs.readFileSync(proposal, "utf8"), "# User-owned proposal\n");
  assert.match(fs.readFileSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md"), "utf8"), /name: videospec/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "videospec", "config.json"), "utf8")).toolVersion, VERSION);
  assert.equal(doctorProject(root).valid, true);
  assert.deepEqual(updateProject(root).agentLayer.retiredSkills, []);
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

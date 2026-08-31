import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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
  syncStandards,
  updateProject,
  validateProduction,
  VERSION,
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

function complete(file) {
  let content = fs.readFileSync(file, "utf8")
    .replaceAll(/<!-- TODO(?::.*?)? -->/g, "Completed and verified")
    .replaceAll("- [ ]", "- [x]");
  if (["script.md", "storyboard.md"].includes(path.basename(file))) {
    content = content.replace("- Time: 00:00.000 - 00:00.000", "- Time: 00:00.000 - 01:00.000");
  }
  if (path.basename(file) === "script.md") {
    content = content.replace("## 00:00–00:00｜Completed and verified", "## 00:00–01:00｜Completed and verified");
  }
  fs.writeFileSync(file, content);
}

function useV1Templates(root) {
  const production = loadProduction(root, "demo-video");
  production.metadata.templateVersion = 1;
  fs.writeFileSync(production.metadataFile, `${JSON.stringify(production.metadata, null, 2)}\n`);
  const manifest = JSON.parse(fs.readFileSync(path.resolve("templates/v1/manifest.json"), "utf8"));
  const values = {
    "production.id": production.metadata.id,
    "production.title": production.metadata.title,
    "production.type": production.metadata.type,
    "production.duration": production.metadata.duration,
    "production.aspectRatio": production.metadata.aspectRatio,
  };
  for (const [destination, source] of Object.entries(manifest.productionFiles)) {
    let content = fs.readFileSync(path.resolve("templates/v1", source), "utf8");
    content = content.replace(/\{\{([a-zA-Z0-9.]+)\}\}/g, (_match, key) => values[key]);
    const file = path.join(production.dir, destination);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return production;
}

test("scaffolds a production and invalidates stale approval", () => {
  const root = fixture();
  const config = JSON.parse(fs.readFileSync(path.join(root, "videospec", "config.json"), "utf8"));
  assert.equal(config.productionRoot, "productions");
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".agents", "skills", "videospec-propose", "SKILL.md")), true);
  const installedSkills = fs.readdirSync(path.join(root, ".agents", "skills"))
    .filter((name) => name.startsWith("videospec"));
  assert.equal(installedSkills.length, 9);
  const embeddedList = execFileSync(
    process.execPath,
    [path.join(root, "videospec", "bin", "videospec.js"), "list", "--json"],
    { cwd: root, encoding: "utf8" },
  );
  assert.match(embeddedList, /demo-video/);
  const production = loadProduction(root, "demo-video");
  assert.equal(production.dir, path.join(root, "productions", "demo-video"));
  assert.equal(fs.existsSync(path.join(root, "videospec", "productions", "demo-video")), false);
  assert.deepEqual(listProductions(root).map((item) => item.id), ["demo-video"]);
  assert.equal(production.metadata.templateVersion, 2);
  assert.match(fs.readFileSync(path.join(production.dir, "script.md"), "utf8"), /\*\*合成参数：\*\*[\s\S]*\*\*演绎提示：\*\*/);
  assert.deepEqual(nextActions(root, "demo-video"), ["Complete proposal.md and brief.md."]);
  complete(path.join(production.dir, "proposal.md"));
  complete(path.join(production.dir, "brief.md"));

  approveGate(root, "demo-video", "brief", "Producer");
  assert.equal(getStatus(root, "demo-video").approvals.brief.state, "approved");

  fs.appendFileSync(path.join(production.dir, "brief.md"), "\nChanged after approval.\n");
  assert.equal(getStatus(root, "demo-video").approvals.brief.state, "stale");
});

test("runs approval, standards sync, delivery, validation, and archive end to end", () => {
  const root = fixture();
  const production = loadProduction(root, "demo-video");

  for (const name of ["proposal.md", "brief.md"]) complete(path.join(production.dir, name));
  approveGate(root, "demo-video", "brief", "Producer");

  for (const name of ["script.md", "storyboard.md", "materials.md"]) complete(path.join(production.dir, name));
  approveGate(root, "demo-video", "storyboard", "Director");

  for (const name of ["tasks.md", "review.md"]) complete(path.join(production.dir, name));
  const render = path.join(production.dir, "renders", "final.mp4");
  fs.writeFileSync(render, "deterministic test render");
  registerDeliverable(root, "demo-video", render, "master");

  fs.writeFileSync(path.join(production.dir, "specs", "visual.md"), `## ADDED Standards\n\n### Standard: Captions use at most two lines\n\nThe production SHALL keep captions to at most two lines.\n\n#### Check: Preview\n\n- **WHEN** captions are shown\n- **THEN** no caption SHALL exceed two lines\n`);
  const synced = syncStandards(root, "demo-video");
  assert.equal(synced.operationCount, 1);
  assert.match(
    fs.readFileSync(path.join(root, "videospec", "specs", "visual", "spec.md"), "utf8"),
    /Captions use at most two lines/,
  );

  approveGate(root, "demo-video", "final", "Editor in chief");
  assert.deepEqual(validateProduction(root, "demo-video"), { valid: true, issues: [] });

  const destination = archiveProduction(root, "demo-video");
  assert.equal(fs.existsSync(destination), true);
  assert.equal(fs.existsSync(production.dir), false);
  assert.equal(path.dirname(destination), path.join(root, "productions", "archive"));
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
  for (const name of ["proposal.md", "brief.md", "script.md", "storyboard.md", "materials.md", "review.md"]) {
    complete(path.join(production.dir, name));
  }

  assert.deepEqual(lintProduction(root, "demo-video"), {
    valid: true,
    templateVersion: 2,
    issues: [],
    warnings: [],
  });

  const script = path.join(production.dir, "script.md");
  const validScript = fs.readFileSync(script, "utf8");
  fs.writeFileSync(script, validScript.replace("> speech_rate: 0", "> speech_rate: 101"));
  assert.match(lintProduction(root, "demo-video").issues.join("\n"), /speech_rate must be between -50 and 100/);
  fs.writeFileSync(script, validScript);

  const storyboard = path.join(production.dir, "storyboard.md");
  fs.writeFileSync(storyboard, fs.readFileSync(storyboard, "utf8").replace("- Script scene: S001", "- Script scene: S999"));
  const result = lintProduction(root, "demo-video");
  assert.equal(result.valid, false);
  assert.match(result.issues.join("\n"), /references missing script scene S999/);
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

  const result = updateProject(root);

  assert.equal(result.version, VERSION);
  assert.equal(fs.readFileSync(proposal, "utf8"), "# User-owned proposal\n");
  assert.match(fs.readFileSync(path.join(root, ".agents", "skills", "videospec", "SKILL.md"), "utf8"), /name: videospec/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "videospec", "config.json"), "utf8")).toolVersion, VERSION);
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

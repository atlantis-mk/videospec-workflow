import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = "videospec";
export const GATES = ["content", "final", "publish"];
export const VERSION = "0.8.1";
export const TEMPLATE_VERSION = 6;
export const VIDEO_SPEC_SKILLS = [
  "video-script-review",
  "videospec",
  "videospec-apply",
  "videospec-approve",
  "videospec-explore",
  "videospec-propose",
  "videospec-sync",
  "videospec-update",
  "videospec-verify",
];

const TTS_SECRET_RELATIVE_PATH = path.join(".secrets", "tts.env");

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LEGACY_ARTIFACTS = {
  proposal: "proposal.md",
  brief: "brief.md",
  script: "script.md",
  storyboard: "storyboard.md",
  materials: "materials.md",
  tasks: "tasks.md",
  review: "review.md",
};

const V3_ARTIFACTS = {
  context: "context.md",
  topic: "topic.md",
  research: "research.md",
  script: "script.md",
  contentReview: "content-review.md",
  storyboard: "storyboard.md",
  materials: "materials.md",
  tasks: "tasks.md",
  review: "review.md",
  publish: "publish.md",
  analytics: "analytics.md",
  retrospective: "retrospective.md",
};

const V4_ARTIFACTS = {
  context: "context.md",
  topic: "topic.md",
  referenceAnalysis: "reference-analysis.md",
  research: "research.md",
  script: "script.md",
  contentReview: "content-review.md",
  storyboard: "storyboard.md",
  materials: "materials.md",
  tasks: "tasks.md",
  review: "review.md",
  publish: "publish.md",
  analytics: "analytics.md",
  retrospective: "retrospective.md",
};

const V5_ARTIFACTS = {
  ...V4_ARTIFACTS,
  retentionPlan: "retention-plan.md",
};

const V6_ARTIFACTS = {
  context: "context.md",
  brief: "brief.md",
  evidence: "evidence.md",
  script: "script.md",
  contentReview: "content-review.md",
  storyboard: "storyboard.md",
  materials: "materials.md",
  tasks: "tasks.md",
  review: "review.md",
  publish: "publish.md",
  learning: "learning.md",
};

const LEGACY_GATES = ["brief", "storyboard", "final"];
const LEGACY_GATE_FILES = {
  brief: ["proposal.md", "brief.md"],
  storyboard: ["script.md", "storyboard.md", "materials.md"],
  final: ["tasks.md", "review.md", "deliverables.json"],
};

const V3_GATE_FILES = {
  content: ["context.md", "topic.md", "research.md", "script.md", "content-review.md"],
  final: ["storyboard.md", "materials.md", "tasks.md", "review.md", "deliverables.json"],
  publish: ["publish.md"],
};

const V4_GATE_FILES = {
  content: ["context.md", "topic.md", "reference-analysis.md", "research.md", "script.md", "content-review.md"],
  final: V3_GATE_FILES.final,
  publish: V3_GATE_FILES.publish,
};

const V5_GATE_FILES = {
  content: ["context.md", "topic.md", "reference-analysis.md", "retention-plan.md", "research.md", "script.md", "content-review.md"],
  final: [...V3_GATE_FILES.final, "publish.md"],
  publish: V3_GATE_FILES.publish,
};

const V6_COVERS = ["assets/covers/cover-16x9.png", "assets/covers/cover-4x3.png", "assets/covers/cover-3x4.png"];

const V6_GATE_FILES = {
  content: ["context.md", "brief.md", "evidence.md", "script.md", "content-review.md"],
  final: ["storyboard.md", "materials.md", "tasks.md", "review.md", "publish.md", "deliverables.json", ...V6_COVERS],
  publish: ["publish.md", "deliverables.json", ...V6_COVERS],
};

function artifactsFor(metadata) {
  if (metadata.templateVersion >= 6) return V6_ARTIFACTS;
  if (metadata.templateVersion >= 5) return V5_ARTIFACTS;
  if (metadata.templateVersion >= 4) return V4_ARTIFACTS;
  return metadata.templateVersion >= 3 ? V3_ARTIFACTS : LEGACY_ARTIFACTS;
}

function gatesFor(metadata) {
  return metadata.templateVersion >= 3 ? GATES : LEGACY_GATES;
}

function gateFilesFor(metadata, gate) {
  const files = metadata.templateVersion >= 6
    ? V6_GATE_FILES
    : metadata.templateVersion >= 5
    ? V5_GATE_FILES
    : metadata.templateVersion >= 4
    ? V4_GATE_FILES
    : metadata.templateVersion >= 3 ? V3_GATE_FILES : LEGACY_GATE_FILES;
  const selected = files[gate];
  return metadata.artifactContractVersion >= 3 && gate === "final"
    ? [...selected, "render-authorization.json"]
    : selected;
}

function now() {
  return new Date().toISOString();
}

function writeNew(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { flag: "wx" });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function slug(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")) {
    throw new Error("Production id must be kebab-case (for example: launch-video-01).");
  }
  return value;
}

export function findProject(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    const candidate = path.join(current, ROOT_DIR, "config.json");
    if (fs.existsSync(candidate)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("No VideoSpec project found. Run `videospec init` first.");
}

function configuredProductionRoot(projectRoot, config) {
  const relative = config.productionRoot ?? path.join(ROOT_DIR, "productions");
  if (typeof relative !== "string" || !relative.trim()) {
    throw new Error("config.productionRoot must be a non-empty relative path.");
  }
  if (path.isAbsolute(relative)) {
    throw new Error("config.productionRoot must be relative to the project root.");
  }
  const root = path.resolve(projectRoot, relative);
  const relativeToProject = path.relative(projectRoot, root);
  if (!relativeToProject || relativeToProject === ".." || relativeToProject.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToProject)) {
    throw new Error("config.productionRoot must stay inside the project root.");
  }
  return root;
}

export function productionRoot(projectRoot) {
  const config = readJson(path.join(projectRoot, ROOT_DIR, "config.json"));
  return configuredProductionRoot(projectRoot, config);
}

export function productionDir(projectRoot, id) {
  return path.join(productionRoot(projectRoot), slug(id));
}

export function loadProduction(projectRoot, id) {
  const dir = productionDir(projectRoot, id);
  const metadataFile = path.join(dir, "production.json");
  if (!fs.existsSync(metadataFile)) throw new Error(`Production not found: ${id}`);
  return { dir, metadataFile, metadata: readJson(metadataFile) };
}

function templateRoot(version = TEMPLATE_VERSION) {
  return path.join(PACKAGE_ROOT, "templates", `v${version}`);
}

function schemaRoot(version = TEMPLATE_VERSION) {
  return path.join(PACKAGE_ROOT, "schemas", `v${version}`);
}

function loadTemplateManifest(version = TEMPLATE_VERSION) {
  const file = path.join(templateRoot(version), "manifest.json");
  if (!fs.existsSync(file)) throw new Error(`Template manifest is missing: ${file}`);
  const manifest = readJson(file);
  if (manifest.templateVersion !== version) {
    throw new Error(`Template manifest version mismatch: expected ${version}, got ${manifest.templateVersion}.`);
  }
  return manifest;
}

function templateValue(context, key) {
  const value = key.split(".").reduce((current, part) => current?.[part], context);
  if (value === undefined || value === null) throw new Error(`Missing template variable: ${key}`);
  return String(value);
}

function renderTemplate(content, context, allowedVariables) {
  return content.replace(/\{\{([a-zA-Z0-9.]+)\}\}/g, (_match, key) => {
    if (!allowedVariables.includes(key)) throw new Error(`Unknown template variable: ${key}`);
    return templateValue(context, key);
  });
}

function templateFiles(group, context = {}, version = TEMPLATE_VERSION) {
  const manifest = loadTemplateManifest(version);
  const files = manifest[group];
  if (!files) throw new Error(`Unknown template group: ${group}`);
  return Object.fromEntries(Object.entries(files).map(([destination, source]) => {
    const file = path.join(templateRoot(version), source);
    if (!fs.existsSync(file)) throw new Error(`Template file is missing: ${file}`);
    const content = fs.readFileSync(file, "utf8");
    const rendered = renderTemplate(content, context, manifest.variables);
    return [destination, destination.endsWith(".md")
      ? rendered.replace(/^templateVersion:\s*\d+\s*$/m, `templateVersion: ${version}`)
      : rendered];
  }));
}

export function initProject(target = ".", { ttsKey } = {}) {
  const projectRoot = path.resolve(target);
  const root = path.join(projectRoot, ROOT_DIR);
  sourceSkillNames();
  if (fs.existsSync(path.join(root, "config.json"))) {
    return { ...updateProject(projectRoot), initialized: false };
  }
  assertSkillTargetsAvailable(projectRoot);

  const files = {
    "config.json": `${JSON.stringify({
      schemaVersion: 1,
      toolVersion: VERSION,
      templateVersion: TEMPLATE_VERSION,
      workflow: "video-production",
      productionRoot: "productions",
      humanGates: GATES,
      createdAt: now(),
    }, null, 2)}\n`,
    "AGENTS.md": reviewHistoryAgentInstructions(),
    ...templateFiles("projectFiles"),
  };

  for (const [relative, content] of Object.entries(files)) {
    writeNew(path.join(root, relative), content);
  }
  if (ttsKey) saveTtsCredential(projectRoot, ttsKey);
  writeNew(path.join(projectRoot, "productions", "archive", ".gitkeep"), "");
  const agentLayer = installAgentLayer(projectRoot);
  return { projectRoot, root, agentLayer, initialized: true };
}

function sourceSkillsDir() {
  return path.join(PACKAGE_ROOT, ".agents", "skills");
}

function sourceSkillNames() {
  const missing = VIDEO_SPEC_SKILLS.filter((name) => !fs.existsSync(path.join(sourceSkillsDir(), name, "SKILL.md")));
  if (missing.length) throw new Error(`VideoSpec package is missing required skills: ${missing.join(", ")}.`);
  return VIDEO_SPEC_SKILLS;
}

function isBundledFinanceSkillV080(dir) {
  const expected = {
    "SKILL.md": "f7be2d74976133df7c695fe2f21bb5b079dc9114153b2c8872bd521cf2cb0175",
    "agents/openai.yaml": "7235402cfd8fba34eac45cb4bd767a588db346b5a8919bef38d9677ee1aa534d",
  };
  if (!fs.statSync(dir).isDirectory()) return false;
  if (fs.readdirSync(dir).sort().join(",") !== "SKILL.md,agents") return false;
  if (fs.readdirSync(path.join(dir, "agents")).join(",") !== "openai.yaml") return false;
  return Object.entries(expected).every(([name, digest]) => fileHash(path.join(dir, name)) === digest);
}

function assertSkillTargetsAvailable(projectRoot) {
  const source = path.resolve(sourceSkillsDir());
  const targetRoot = path.resolve(projectRoot, ".agents", "skills");
  if (source === targetRoot) return;
  const conflicts = sourceSkillNames().filter((name) => fs.existsSync(path.join(targetRoot, name)));
  if (conflicts.length) {
    throw new Error(`VideoSpec skill target already exists: ${conflicts.join(", ")}. Move or remove it before initialization.`);
  }
}

function installAgentLayer(projectRoot, { replace = false } = {}) {
  const root = path.join(projectRoot, ROOT_DIR);
  const runtime = path.join(root, ".runtime");
  fs.mkdirSync(runtime, { recursive: true });
  for (const name of ["cli.js", "core.js"]) {
    const source = path.join(PACKAGE_ROOT, "src", name);
    if (!fs.existsSync(source)) throw new Error(`VideoSpec runtime source is missing: ${source}`);
    fs.copyFileSync(source, path.join(runtime, name));
  }
  for (const name of ["templates", "schemas", "scripts"]) {
    const source = path.join(PACKAGE_ROOT, name);
    if (!fs.existsSync(source)) throw new Error(`VideoSpec ${name} source is missing: ${source}`);
    const destination = path.join(root, name);
    if (path.resolve(source) !== path.resolve(destination)) {
      if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true });
      fs.cpSync(source, destination, { recursive: true });
    }
  }
  const launcher = path.join(root, "bin", "videospec.js");
  write(launcher, `#!/usr/bin/env node\n\nimport { main } from "../.runtime/cli.js";\n\nmain(process.argv.slice(2)).catch((error) => {\n  console.error(\`Error: \${error.message}\`);\n  process.exitCode = 1;\n});\n`);
  fs.chmodSync(launcher, 0o755);

  const source = sourceSkillsDir();
  const target = path.join(projectRoot, ".agents", "skills");
  const retiredSkills = [];
  if (path.resolve(source) !== path.resolve(target)) {
    for (const name of sourceSkillNames()) {
      const destination = path.join(target, name);
      if (replace && fs.existsSync(destination)) fs.rmSync(destination, { recursive: true });
      fs.cpSync(path.join(source, name), destination, { recursive: true, errorOnExist: true });
    }
    if (replace) {
      for (const name of ["videospec-archive", "finance-video-production"]) {
        const retired = path.join(target, name);
        if (!fs.existsSync(retired) || (name === "finance-video-production" && !isBundledFinanceSkillV080(retired))) continue;
        const backups = path.join(root, "retired-skills");
        fs.mkdirSync(backups, { recursive: true });
        let destination = path.join(backups, name);
        for (let suffix = 1; fs.existsSync(destination); suffix += 1) {
          destination = path.join(backups, `${name}-${suffix}`);
        }
        fs.renameSync(retired, destination);
        retiredSkills.push(path.relative(projectRoot, destination));
      }
    }
  }
  return {
    runtime: path.relative(projectRoot, launcher),
    skills: sourceSkillNames(),
    retiredSkills,
  };
}

export function saveTtsCredential(projectRoot, key) {
  const value = key?.trim();
  if (!value) throw new Error("TTS API key is required.");
  if (/[\r\n]/.test(value)) throw new Error("TTS API key must be a single line.");
  const secretDir = path.join(projectRoot, ROOT_DIR, ".secrets");
  fs.mkdirSync(secretDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(secretDir, 0o700);
  const ignoreFile = path.join(secretDir, ".gitignore");
  if (!fs.existsSync(ignoreFile)) writeNew(ignoreFile, "*\n!.gitignore\n");
  const credentialFile = path.join(secretDir, "tts.env");
  write(credentialFile, `VOLCENGINE_TTS_API_KEY=${value}\n`);
  fs.chmodSync(credentialFile, 0o600);
  const configFile = path.join(projectRoot, ROOT_DIR, "config.json");
  const config = readJson(configFile);
  config.tts = {
    provider: "volcengine-seed-tts-2.0",
    credentialFile: TTS_SECRET_RELATIVE_PATH,
  };
  writeJson(configFile, config);
  return { credentialFile: path.relative(projectRoot, credentialFile), provider: config.tts.provider };
}

export function updateProject(target = ".") {
  const projectRoot = findProject(target);
  sourceSkillNames();
  const configFile = path.join(projectRoot, ROOT_DIR, "config.json");
  const config = readJson(configFile);
  const migration = migrateLegacyProductionRoot(projectRoot, config);
  config.toolVersion = VERSION;
  config.templateVersion = TEMPLATE_VERSION;
  config.updatedAt = now();
  writeJson(configFile, config);
  const agentLayer = installAgentLayer(projectRoot, { replace: true });
  const activityLedgers = ensureV6ActivityLedgers(projectRoot);
  return { projectRoot, root: path.join(projectRoot, ROOT_DIR), agentLayer, version: VERSION, migration, activityLedgers };
}

function ensureV6ActivityLedgers(projectRoot) {
  const created = [];
  for (const metadata of listProductions(projectRoot)) {
    if (metadata.templateVersion !== 6 || !metadata.id) continue;
    const file = path.join(productionDir(projectRoot, metadata.id), "activity.md");
    if (fs.existsSync(file)) continue;
    const content = templateFiles("productionFiles", { production: metadata }, 6)["activity.md"]
      .replace("- V000: Initial production scaffold.", "- Runtime update: Ledger created; earlier changes remain in context.md and history/index.json.");
    writeNew(file, content);
    snapshotProduction(projectRoot, metadata.id, "after: add operational activity ledger during runtime update");
    created.push(metadata.id);
  }
  return created;
}

function migrateLegacyProductionRoot(projectRoot, config) {
  if (config.productionRoot !== undefined) return { state: "not-needed" };

  const legacyRoot = path.join(projectRoot, ROOT_DIR, "productions");
  const destination = path.join(projectRoot, "productions");
  if (fs.existsSync(legacyRoot)) {
    if (fs.existsSync(destination)) {
      throw new Error(`Cannot migrate legacy productions because the destination already exists: ${destination}. Resolve the destination and run videospec update again.`);
    }
    fs.cpSync(legacyRoot, destination, { recursive: true, errorOnExist: true });
    config.productionRoot = "productions";
    return {
      state: "copied",
      source: legacyRoot,
      destination,
    };
  }

  config.productionRoot = "productions";
  return { state: "configured", destination };
}

function diagnostic(name, status, message) {
  return { name, status, message };
}

export function doctorProject(target = ".") {
  const checks = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push(diagnostic(
    "node",
    nodeMajor >= 20 ? "pass" : "fail",
    `Node.js ${process.versions.node}${nodeMajor >= 20 ? "" : "; VideoSpec requires Node.js 20 or newer"}`,
  ));

  let projectRoot;
  try {
    projectRoot = findProject(target);
    checks.push(diagnostic("project", "pass", `VideoSpec project found at ${projectRoot}`));
  } catch (error) {
    checks.push(diagnostic("project", "fail", error.message));
    return { valid: false, version: VERSION, projectRoot: null, checks };
  }

  const configFile = path.join(projectRoot, ROOT_DIR, "config.json");
  let config;
  try {
    config = readJson(configFile);
    checks.push(diagnostic(
      "config",
      config.schemaVersion === 1 ? "pass" : "fail",
      `Schema ${config.schemaVersion ?? "unknown"}; installed by VideoSpec ${config.toolVersion ?? "unknown"}`,
    ));
  } catch (error) {
    checks.push(diagnostic("config", "fail", `Cannot read config.json: ${error.message}`));
  }
  if (config) {
    try {
      const root = configuredProductionRoot(projectRoot, config);
      checks.push(diagnostic("production-root", "pass", `Production root: ${path.relative(projectRoot, root)}`));
    } catch (error) {
      checks.push(diagnostic("production-root", "fail", error.message));
    }
  }

  const missingSkills = VIDEO_SPEC_SKILLS.filter((name) => !fs.existsSync(path.join(projectRoot, ".agents", "skills", name, "SKILL.md")));
  checks.push(diagnostic(
    "skills",
    missingSkills.length ? "fail" : "pass",
    missingSkills.length ? `Missing skills: ${missingSkills.join(", ")}` : `${VIDEO_SPEC_SKILLS.length} VideoSpec skills installed`,
  ));

  const runtimeFiles = [
    path.join(projectRoot, ROOT_DIR, ".runtime", "cli.js"),
    path.join(projectRoot, ROOT_DIR, ".runtime", "core.js"),
    path.join(projectRoot, ROOT_DIR, "bin", "videospec.js"),
    path.join(projectRoot, ROOT_DIR, "templates", `v${TEMPLATE_VERSION}`, "manifest.json"),
    path.join(projectRoot, ROOT_DIR, "schemas", `v${TEMPLATE_VERSION}`, "artifacts.json"),
    path.join(projectRoot, ROOT_DIR, "scripts", "generate_voice.py"),
    path.join(projectRoot, ROOT_DIR, "scripts", "export_subtitles.py"),
  ];
  const missingRuntime = runtimeFiles.filter((file) => !fs.existsSync(file));
  checks.push(diagnostic(
    "runtime",
    missingRuntime.length ? "fail" : "pass",
    missingRuntime.length ? `Missing runtime files: ${missingRuntime.map((file) => path.relative(projectRoot, file)).join(", ")}` : "Embedded runtime is complete",
  ));

  const hyperframesCandidates = [
    path.join(projectRoot, "node_modules", ".bin", "hyperframes"),
    path.join(projectRoot, "node_modules", ".bin", "hyperframes.cmd"),
  ];
  const hyperframesFound = hyperframesCandidates.some((file) => fs.existsSync(file));
  checks.push(diagnostic(
    "hyperframes",
    hyperframesFound ? "pass" : "info",
    hyperframesFound ? "Local HyperFrames CLI detected" : "HyperFrames is optional and was not detected in this project",
  ));

  return {
    valid: checks.every((check) => check.status !== "fail"),
    version: VERSION,
    projectRoot,
    checks,
  };
}

export function createProduction(projectRoot, id, options = {}) {
  id = slug(id);
  const dir = productionDir(projectRoot, id);
  if (fs.existsSync(dir)) throw new Error(`Production already exists: ${id}`);

  const metadata = {
    schemaVersion: 1,
    templateVersion: TEMPLATE_VERSION,
    ...(TEMPLATE_VERSION >= 6 ? { artifactContractVersion: 3 } : {}),
    id,
    title: options.title || id,
    type: options.type || "general-video",
    duration: options.duration || "TBD",
    aspectRatio: options.aspect || "16:9",
    createdAt: now(),
    updatedAt: now(),
    approvals: Object.fromEntries(GATES.map((gate) => [gate, null])),
    syncedAt: null,
    standardsSync: null,
    archivedAt: null,
  };

  const files = productionTemplates(metadata);
  for (const [relative, content] of Object.entries(files)) {
    writeNew(path.join(dir, relative), content);
  }
  writeJson(path.join(dir, "production.json"), metadata);
  snapshotProduction(projectRoot, id, "Initial production scaffold");
  return { dir, metadata };
}

function productionTemplates(meta) {
  return templateFiles("productionFiles", { production: meta }, meta.templateVersion);
}

function snapshotFiles(metadata) {
  return [
    "production.json",
    ...Object.values(artifactsFor(metadata)),
    ...(metadata.templateVersion >= 6 ? ["activity.md"] : []),
    ...(metadata.artifactContractVersion >= 3 ? ["render-authorization.json"] : []),
    ...(metadata.templateVersion >= 6 ? V6_COVERS : []),
    "deliverables.json",
    ...(metadata.templateVersion >= 3 ? ["publication.json"] : []),
  ];
}

function nextSnapshotId(historyDir) {
  if (!fs.existsSync(historyDir)) return "V000";
  const versions = fs.readdirSync(historyDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^V\d{3}$/.test(entry.name))
    .map((entry) => Number(entry.name.slice(1)));
  return `V${String(versions.length ? Math.max(...versions) + 1 : 0).padStart(3, "0")}`;
}

export function snapshotProduction(projectRoot, id, note) {
  const production = loadProduction(projectRoot, id);
  if (!note?.trim()) throw new Error("Snapshot note is required. Pass `--note <what changed or why>`. ");
  const historyDir = path.join(production.dir, "history");
  const version = nextSnapshotId(historyDir);
  const destination = path.join(historyDir, version);
  fs.mkdirSync(destination, { recursive: true });
  const hashes = {};
  for (const relative of snapshotFiles(production.metadata)) {
    const source = path.join(production.dir, relative);
    if (!fs.existsSync(source)) continue;
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    hashes[relative] = fileHash(source);
  }
  const specs = path.join(production.dir, "specs");
  if (fs.existsSync(specs)) fs.cpSync(specs, path.join(destination, "specs"), { recursive: true });
  const indexFile = path.join(historyDir, "index.json");
  const index = fs.existsSync(indexFile) ? readJson(indexFile) : { schemaVersion: 1, snapshots: [] };
  index.snapshots.push({ version, at: now(), note: note.trim(), hashes });
  writeJson(indexFile, index);
  return { version, path: destination, note: note.trim(), hashes };
}

function reviewHistoryAgentInstructions() {
  return `# VideoSpec agent instructions

VideoSpec is the agreement layer for this video project.

## Immutable review context

- Context belongs to the current production only; never automatically import a prior episode's working context.
- Before every coherent AI edit, read \`context.md\`, v6 \`activity.md\`, \`history/index.json\`, relevant current artifacts, and durable specs; then run \`node videospec/bin/videospec.js snapshot <id> --note "before: ..."\`.
- For v6, record approved content decisions in \`context.md\` and post-approval timing, build, QA, and packaging operations in \`activity.md\`. A substantive content change still updates signed files and makes content approval stale. Take before/after snapshots and retain a final snapshot if logging its ID changes the activity log. Never overwrite, rename, or delete \`history/V###\`.

## Workflow

conversation/reference triage → brief → evidence ledger → script → editorial opposition + duration-aware strict AI review → automatic fix/re-review → human content approval → storyboard + materials → TTS → playable preview + pre-render QA → explicit human confirmation of the current preview → render + encoded-master QA → fixes and renewed preview confirmation before re-render → publication package → human final approval → human publish approval → human publication record → learning → standards sync → archive

Automatically continue every consecutive non-human phase; do not request intermediate AI-work approval. Reuse a matching exploration handoff rather than repeating angle search, and respect a user-selected direction or protected script. Before costly production work, check the required renderer, built-in imagegen, TTS, subtitle, and inspection capabilities. Run lint after edits. AI never invents facts, rights, approvals, publication results, or platform data. Human gates are content, confirmation of the current playable preview before rendering, final video, and publication. Before each render or export, verify render-authorization.json and the current input hashes; changed inputs require a new preview and confirmation. Also stop for a genuinely unavailable external dependency or a blocking QA failure after bounded attempts. For QA, try at most two repairs per finding and three repair rounds per run; record the attempts and remaining risk. Never present a missing render or failed essential technical/rights check as ready for final approval.

For v6 narration, leave approved script files unchanged and record measured timing in the voice manifest. Retain raw segments and use only the merged mono 48 kHz / 24-bit voice master (-16 LUFS, 6 LU LRA, -1.5 dBTP). After music and effects are mixed, require final-mix QA against stereo 48 kHz, -14 LUFS, and -1.0 dBTP. Generate the three publication covers with the imagegen skill in built-in mode in separate calls, store accepted 16:9, 4:3, and 3:4 assets in the production, and record prompt/provenance in publish.md.

## Artifact authority by template version

For v6, \`brief.md\` owns topic, selected promise and retention design; \`evidence.md\` owns reference coverage, research and verification; \`script.md\` owns one continuous blockquoted narration; \`activity.md\` owns operational change notes; \`learning.md\` owns post-publication analysis. Map evidence to brief beats, beats to exact narration anchors, storyboard scenes to beats, and materials to scenes. Do not create v5-only topic, reference-analysis, retention-plan, research, analytics or retrospective files in v6 productions. Existing productions retain their recorded template version and file layout.

## Conversation and reference inputs

- Treat all relevant user instructions, decisions, pasted material, attachments, links, and clarifications already present in the current conversation as current-production input. Record their source and role in \`evidence.md\` for v6 (or \`reference-analysis.md\` for v4–v5); do not require the user to repeat earlier discussion.
- If the user adds or corrects reference material later in the same conversation before the content gate, update \`evidence.md\` for v6 (or \`reference-analysis.md\` for v4–v5) and rebuild the earliest affected content artifact automatically. After a content approval, preserve the approval record, let it become stale when a signed file changes, and return only to the content gate.
- Current-conversation text is always a production source. Use \`conversation\` for user goals, decisions, and discussion; use \`extract\` for supplied source material; use \`adapt\` when the user asks to re-express the same substance. There is no \`inspire\` or context-free original path when relevant conversation content exists.
- Every material conversation or reference unit must be preserved, reframed, or explicitly omitted with rationale and mapped to the resulting narration or storyboard beats. Never replace the stated discussion scope with a different topic.
- Rephrase rather than copy protected wording, visual material, audio, or the source’s distinctive expression. Independently verify factual claims before presenting them as facts; copyright constraints limit expression, not the obligation to faithfully cover the user-requested ideas.
`;
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function renderAuthorizationIssues(dir) {
  const file = path.join(dir, "render-authorization.json");
  if (!fs.existsSync(file)) return ["Missing render-authorization.json."];
  let record;
  try { record = readJson(file); } catch { return ["render-authorization.json is not valid JSON."]; }
  if (!record || typeof record !== "object" || record.approved !== true || !record.confirmedBy || !record.confirmedAt) {
    return ["Current preview has no explicit human render confirmation."];
  }
  if (!record.previewUrl || record.preRenderQa?.passed !== true) {
    return ["Playable preview or passing pre-render QA is missing."];
  }
  const expected = record.inputsSha256;
  if (!expected || typeof expected !== "object" || Array.isArray(expected) || !Object.keys(expected).length) {
    return ["Render authorization has no preview input hashes."];
  }
  const actual = {};
  const root = fs.realpathSync(dir);
  for (const name of Object.keys(expected).sort()) {
    const candidate = path.resolve(root, name);
    if (!candidate.startsWith(`${root}${path.sep}`) || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()
      || !fs.realpathSync(candidate).startsWith(`${root}${path.sep}`)) {
      return [`Preview input missing or outside production: ${name}`];
    }
    const digest = fileHash(candidate);
    if (digest !== expected[name]) return [`Preview input changed since confirmation: ${name}`];
    actual[name] = digest;
  }
  const version = crypto.createHash("sha256").update(JSON.stringify(actual)).digest("hex");
  if (version !== record.previewVersionSha256) return ["Preview version changed since confirmation."];
  return [];
}

function hashGateFiles(dir, metadata, gate) {
  return Object.fromEntries(gateFilesFor(metadata, gate).map((name) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) throw new Error(`Missing gate artifact: ${name}`);
    return [name, fileHash(file)];
  }));
}

function hasTodo(file) {
  return fs.readFileSync(file, "utf8").includes("<!-- TODO");
}

function uncheckedTasks(file, { beforeHeading } = {}) {
  const content = fs.readFileSync(file, "utf8");
  const relevant = beforeHeading ? content.split(beforeHeading)[0] : content;
  return (relevant.match(/^\s*- \[ \]/gm) || []).length;
}

function parseFrontmatter(content) {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return { values: null, body: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return { values: null, body: normalized };
  const values = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const match = /^([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const raw = match[2];
    values[match[1]] = /^\d+$/.test(raw) ? Number(raw) : raw.replace(/^(["'])(.*)\1$/, "$2");
  }
  return { values, body: normalized.slice(end + 5) };
}

function markdownHeadings(content) {
  const headings = [];
  let inFence = false;
  for (const line of content.replaceAll("\r\n", "\n").split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^#{1,6}\s+\S/.test(line)) headings.push(line.trim());
  }
  return headings;
}

function repeatedBlocks(content, pattern) {
  const matches = [...content.matchAll(pattern)];
  return matches.map((match, index) => ({
    id: match[1],
    content: content.slice(match.index, matches[index + 1]?.index ?? content.length),
  }));
}

function sceneBlocks(content) {
  return repeatedBlocks(content, /^### Scene (S\d{3})\s*$/gm);
}

function assetBlocks(content) {
  return repeatedBlocks(content, /^### Asset (MAT-\d{3})\s*$/gm);
}

function narrationSceneBlocks(content) {
  const matches = [...content.matchAll(/^## (\d{2,}:\d{2}(?:\.\d{3})?)[–-](\d{2,}:\d{2}(?:\.\d{3})?)｜(.+?)\s*$/gm)];
  return matches.map((match, index) => {
    const blockContent = content.slice(match.index, matches[index + 1]?.index ?? content.length);
    const id = /^- Scene ID:\s*(S\d{3})\s*$/m.exec(blockContent)?.[1] || null;
    return {
      id,
      title: match[3].trim(),
      startTime: match[1],
      endTime: match[2],
      content: blockContent,
    };
  });
}

function checkSequentialIds(blocks, prefix, fileName) {
  const issues = [];
  const seen = new Set();
  blocks.forEach((block, index) => {
    if (seen.has(block.id)) issues.push(`${fileName} has duplicate id ${block.id}.`);
    seen.add(block.id);
    const expected = `${prefix}${String(index + 1).padStart(3, "0")}`;
    if (block.id !== expected) issues.push(`${fileName} expected ${expected} but found ${block.id}.`);
  });
  return issues;
}

function timecodeSeconds(value) {
  const match = /^(\d{2,}):(\d{2})(?:\.(\d{3}))?$/.exec(value);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 1000;
  return Number(match[2]) < 60 ? seconds : null;
}

function targetDurationSeconds(value) {
  let match = /^(\d+(?:\.\d+)?)s$/i.exec(value);
  if (match) return Number(match[1]);
  match = /^(\d+(?:\.\d+)?)m$/i.exec(value);
  if (match) return Number(match[1]) * 60;
  match = /^(\d+):(\d{2})$/.exec(value);
  if (match && Number(match[2]) < 60) return Number(match[1]) * 60 + Number(match[2]);
  return null;
}

function requiredBlockParts(block, parts, fileName) {
  return parts
    .filter((part) => !part.pattern.test(block.content))
    .map((part) => `${fileName} ${block.id} is missing ${part.label}.`);
}

function lintSceneTiming(blocks, fileName) {
  const issues = [];
  const ranges = [];
  for (const block of blocks) {
    const match = /^- Time:\s*(\S+)\s+-\s+(\S+)\s*$/m.exec(block.content);
    const startText = block.startTime || match?.[1];
    const endText = block.endTime || match?.[2];
    if (!startText || !endText) {
      issues.push(`${fileName} ${block.id} has no valid Time field.`);
      continue;
    }
    const start = timecodeSeconds(startText);
    const end = timecodeSeconds(endText);
    if (start === null || end === null || end <= start) {
      issues.push(`${fileName} ${block.id || "scene"} has an invalid time range '${startText} - ${endText}'.`);
      continue;
    }
    ranges.push({ id: block.id, start, end });
  }
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start < ranges[index - 1].end) {
      issues.push(`${fileName} ${ranges[index].id} overlaps ${ranges[index - 1].id}.`);
    }
  }
  return { issues, ranges };
}

function quotedMarkerText(content, label) {
  const marker = new RegExp(`^\\*\\*${label}：\\*\\*\\s*$`, "m").exec(content);
  if (!marker) return null;
  const lines = [];
  let started = false;
  for (const line of content.slice(marker.index + marker[0].length).split("\n")) {
    if (/^>/.test(line)) {
      started = true;
      lines.push(line.replace(/^>\s?/, "").trim());
    } else if (started && line.trim()) {
      break;
    }
  }
  return lines.join("\n").trim();
}

function directiveFields(content, label) {
  const text = quotedMarkerText(content, label);
  if (!text) return null;
  return Object.fromEntries(text.split("\n").flatMap((line) => {
    const match = /^([a-z][a-z0-9_]*):\s*(.*?)\s*$/.exec(line);
    return match ? [[match[1], match[2]]] : [];
  }));
}

function requireDirectiveFields(fields, required, scope) {
  if (!fields) return [`${scope} must contain blockquoted parameters.`];
  return required
    .filter((key) => !Object.hasOwn(fields, key) || !fields[key])
    .map((key) => `${scope} is missing ${key}.`);
}

function numericDirectiveIssue(fields, key, min, max, scope) {
  if (!fields || !Object.hasOwn(fields, key)) return [];
  const raw = fields[key];
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return [`${scope} ${key} must be numeric.`];
  const value = Number(raw);
  return value < min || value > max ? [`${scope} ${key} must be between ${min} and ${max}.`] : [];
}

function lintNarrationScript(content, templateVersion) {
  const issues = [];
  const blocks = narrationSceneBlocks(content);
  const scriptAuthority = /^- Script authority:\s*(newly-authored|user-authored|user-authoritative)\s*$/m.exec(content)?.[1];
  const api = directiveFields(content, "接口与音频参数");
  issues.push(...requireDirectiveFields(api, [
    "endpoint",
    "resource_id",
    "speaker",
    "format",
    "sample_rate",
    "bit_rate",
    "enable_subtitle",
    "explicit_language",
    "disable_markdown_filter",
    "max_length_to_filter_parenthesis",
    "aigc_watermark",
  ], "script.md 接口与音频参数"));
  if (api) {
    if (api.endpoint !== "/api/v3/tts/unidirectional") issues.push("script.md endpoint must be /api/v3/tts/unidirectional.");
    if (!new Set(["mp3", "ogg_opus", "pcm", "wav"]).has(api.format)) issues.push("script.md format must be mp3, ogg_opus, pcm, or wav.");
    if (!new Set(["8000", "16000", "22050", "24000", "32000", "44100", "48000"]).has(api.sample_rate)) {
      issues.push("script.md sample_rate is not supported by the asynchronous long-text API.");
    }
    issues.push(...numericDirectiveIssue(api, "bit_rate", 64000, 160000, "script.md"));
    if (!new Set(["true", "false"]).has(api.enable_subtitle)) issues.push("script.md enable_subtitle must be true or false.");
    if (!new Set(["true", "false"]).has(api.disable_markdown_filter)) issues.push("script.md disable_markdown_filter must be true or false.");
    if (!new Set(["true", "false"]).has(api.aigc_watermark)) issues.push("script.md aigc_watermark must be true or false.");
    if (!new Set(["0", "100"]).has(api.max_length_to_filter_parenthesis)) {
      issues.push("script.md max_length_to_filter_parenthesis must be 0 or 100.");
    }
    if (!new Set(["zh-cn", "en", "ja", "es-mx", "id", "pt-br", "pt", "ko", "it", "de", "fr", "th", "vi", "ru", "fil", "ms", "ar", "pl", "tr", "sv"]).has(api.explicit_language)) {
      issues.push("script.md explicit_language is not a documented language value.");
    }
  }
  if (templateVersion >= 5 && !scriptAuthority) {
    issues.push("script.md must declare Script authority: newly-authored, user-authored, or user-authoritative.");
  }
  if (!quotedMarkerText(content, "全局演绎提示")) issues.push("script.md must contain a blockquoted 全局演绎提示.");
  if (templateVersion >= 6) {
    const synthesis = directiveFields(content, "合成参数");
    const narration = quotedMarkerText(content, "口播");
    issues.push(...requireDirectiveFields(synthesis, [
      "speech_rate",
      "loudness_rate",
      "silence_duration_ms",
      "post_process_pitch",
      "section_id",
    ], "script.md 合成参数"));
    issues.push(...numericDirectiveIssue(synthesis, "speech_rate", -50, 100, "script.md"));
    issues.push(...numericDirectiveIssue(synthesis, "loudness_rate", -50, 100, "script.md"));
    issues.push(...numericDirectiveIssue(synthesis, "silence_duration_ms", 0, 30000, "script.md"));
    issues.push(...numericDirectiveIssue(synthesis, "post_process_pitch", -12, 12, "script.md"));
    if (!narration) issues.push("script.md must contain one blockquoted continuous narration under **口播：**.");
    return { issues, blocks: [], ranges: [] };
  }
  if (!blocks.length) return { issues: [...issues, "script.md must contain at least one time-coded narration scene."], blocks: [] };
  const blocksWithIds = blocks.filter((block) => block.id);
  if (blocksWithIds.length !== blocks.length) issues.push("Every script.md narration scene must contain a Scene ID field.");
  issues.push(...checkSequentialIds(blocksWithIds, "S", "script.md"));
  for (const block of blocks) {
    const label = block.id || block.title;
    const required = [
      { label: "Purpose", pattern: /^- Purpose:\s*\S.*$/m },
      { label: "Evidence", pattern: /^- Evidence:\s*\S.*$/m },
      { label: "合成参数", pattern: /^\*\*合成参数：\*\*\s*$/m },
      { label: "演绎提示", pattern: /^\*\*演绎提示：\*\*\s*$/m },
      { label: "口播", pattern: /^\*\*口播：\*\*\s*$/m },
    ];
    if (templateVersion >= 5) {
      required.splice(1, 0,
        { label: "Viewer state", pattern: /^- Viewer state:\s*\S.*$/m },
        { label: "Narrative move", pattern: /^- Narrative move:\s*\S.*$/m },
        { label: "Open loop or payoff", pattern: /^- Open loop or payoff:\s*\S.*$/m },
      );
      if (["user-authored", "user-authoritative"].includes(scriptAuthority)) {
        required.splice(4, 0, { label: "Source subtitle coverage", pattern: /^- Source subtitle coverage:\s*(?!None\b)\S.*$/m });
      }
    }
    issues.push(...requiredBlockParts({ ...block, id: label }, required, "script.md"));
    const synthesis = directiveFields(block.content, "合成参数");
    const direction = quotedMarkerText(block.content, "演绎提示");
    const narration = quotedMarkerText(block.content, "口播");
    issues.push(...requireDirectiveFields(synthesis, [
      "speech_rate",
      "loudness_rate",
      "silence_duration_ms",
      "post_process_pitch",
      "section_id",
    ], `script.md ${label} 合成参数`));
    issues.push(...numericDirectiveIssue(synthesis, "speech_rate", -50, 100, `script.md ${label}`));
    issues.push(...numericDirectiveIssue(synthesis, "loudness_rate", -50, 100, `script.md ${label}`));
    issues.push(...numericDirectiveIssue(synthesis, "silence_duration_ms", 0, 30000, `script.md ${label}`));
    issues.push(...numericDirectiveIssue(synthesis, "post_process_pitch", -12, 12, `script.md ${label}`));
    if (synthesis?.section_id && block.id && !synthesis.section_id.endsWith(`:${block.id}`)) {
      issues.push(`script.md ${label} section_id must end with ':${block.id}'.`);
    }
    if (!direction) issues.push(`script.md ${label} must contain a blockquoted 演绎提示.`);
    if (!narration) issues.push(`script.md ${label} must contain blockquoted narration.`);
  }
  const timing = lintSceneTiming(blocks, "script.md");
  issues.push(...timing.issues);
  return { issues, blocks, ranges: timing.ranges };
}

function lintRetentionPlan(content, scriptIds) {
  const issues = [];
  const blocks = repeatedBlocks(content, /^### Beat (B\d{3})\s*$/gm);
  if (!blocks.length) return { issues: ["retention-plan.md must contain at least one beat."], blocks: [] };
  issues.push(...checkSequentialIds(blocks, "B", "retention-plan.md"));
  const coveredScenes = new Set();
  for (const block of blocks) {
    issues.push(...requiredBlockParts(block, [
      { label: "Time", pattern: /^- Time:\s*\S.*$/m },
      { label: "Viewer state", pattern: /^- Viewer state:\s*\S.*$/m },
      { label: "Narrative move", pattern: /^- Narrative move:\s*\S.*$/m },
      { label: "Open loop or payoff", pattern: /^- Open loop or payoff:\s*\S.*$/m },
      { label: "New value", pattern: /^- New value:\s*\S.*$/m },
      { label: "Visual or audio shift", pattern: /^- Visual or audio shift:\s*\S.*$/m },
      { label: "Script coverage", pattern: /^- Script coverage:\s*\S.*$/m },
    ], "retention-plan.md"));
    const coverage = /^- Script coverage:\s*(.+?)\s*$/m.exec(block.content)?.[1] || "";
    const sceneIds = coverage.match(/S\d{3}/g) || [];
    if (!sceneIds.length) issues.push(`retention-plan.md ${block.id} must map to at least one script scene.`);
    for (const sceneId of sceneIds) {
      coveredScenes.add(sceneId);
      if (!scriptIds.has(sceneId)) issues.push(`retention-plan.md ${block.id} references missing script scene ${sceneId}.`);
    }
  }
  for (const scriptId of scriptIds) {
    if (!coveredScenes.has(scriptId)) issues.push(`retention-plan.md does not cover script scene ${scriptId}.`);
  }
  return { issues, blocks };
}

function lintReferenceAnalysis(content, scriptIds) {
  const issues = [];
  const mode = /^- Mode:\s*(conversation|extract|adapt|user-authored-script|authoritative-script)\s*$/m.exec(content)?.[1];
  const source = /^- Reference input:\s*(.+?)\s*$/m.exec(content)?.[1];
  const authority = /^- Authority:\s*(newly-authored|user-authored|user-authoritative)\s*$/m.exec(content)?.[1];
  const sourceAsset = /^- Authoritative source asset:\s*(.+?)\s*$/m.exec(content)?.[1];
  const blocks = repeatedBlocks(content, /^### Reference (R\d{3})\s*$/gm);
  if (!mode) issues.push("reference-analysis.md must declare Mode: conversation, extract, adapt, user-authored-script, or authoritative-script.");
  if (!source) issues.push("reference-analysis.md must declare Reference input.");
  if (mode === "authoritative-script" && authority !== "user-authoritative") {
    issues.push("reference-analysis.md authoritative-script mode must declare Authority: user-authoritative.");
  }
  if (mode === "user-authored-script" && authority !== "user-authored") {
    issues.push("reference-analysis.md user-authored-script mode must declare Authority: user-authored.");
  }
  if (["authoritative-script", "user-authored-script"].includes(mode) && (!sourceAsset || /^None$/i.test(sourceAsset))) {
    issues.push(`reference-analysis.md ${mode} mode must declare an Authoritative source asset.`);
  }
  if (mode && !blocks.length) issues.push("reference-analysis.md must map at least one material conversation or reference unit.");
  issues.push(...checkSequentialIds(blocks, "R", "reference-analysis.md"));
  for (const block of blocks) {
    issues.push(...requiredBlockParts(block, [
      { label: "Source locator", pattern: /^- Source locator:\s*\S.*$/m },
      { label: "Extracted idea", pattern: /^- Extracted idea:\s*\S.*$/m },
      { label: "Verification", pattern: /^- Verification:\s*\S.*$/m },
      { label: "Adaptation decision", pattern: /^- Adaptation decision:\s*(preserve|reframe|omit)\s*$/m },
      { label: "Script coverage", pattern: /^- Script coverage:\s*\S.*$/m },
    ], "reference-analysis.md"));
    const coverage = /^- Script coverage:\s*(.+?)\s*$/m.exec(block.content)?.[1];
    const decision = /^- Adaptation decision:\s*(preserve|reframe|omit)\s*$/m.exec(block.content)?.[1];
    if (["authoritative-script", "user-authored-script"].includes(mode) && decision !== "preserve") {
      issues.push(`reference-analysis.md ${block.id} must use Adaptation decision: preserve for a user script.`);
    }
    if (decision === "omit") {
      if (!/^Omitted — .+/.test(coverage || "")) {
        issues.push(`reference-analysis.md ${block.id} omitted material must state its rationale in Script coverage.`);
      }
      continue;
    }
    const coveredScenes = (coverage || "").match(/S\d{3}/g) || [];
    if (!coveredScenes.length) {
      issues.push(`reference-analysis.md ${block.id} must map preserved or reframed material to at least one script scene.`);
    }
    for (const scene of coveredScenes) {
      if (!scriptIds.has(scene)) issues.push(`reference-analysis.md ${block.id} references missing script scene ${scene}.`);
    }
  }
  return { issues, blocks };
}

function lintPublicationTags(content, templateVersion) {
  const marker = /^## Ten publication tags\s*$/m.exec(content);
  if (!marker) return { issues: ["publish.md must contain a Ten publication tags section."] };
  const remainder = content.slice(marker.index + marker[0].length);
  const nextHeading = remainder.search(/^##\s+/m);
  const section = remainder.slice(0, nextHeading < 0 ? remainder.length : nextHeading);
  if (templateVersion >= 6) {
    const tagLines = section.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("#"));
    const tags = tagLines.flatMap((line) => line.split(/\s+/));
    if (/^\s*\d+\.\s+/m.test(section) || tagLines.some((line) => !/^(?:#[^\s#]+\s*)+$/.test(line)) || tags.length !== 10) {
      return { issues: ["publish.md must list exactly ten unnumbered #hashtags."] };
    }
    const values = tags.map((tag) => tag.slice(1).toLocaleLowerCase());
    if (values.some((value) => !value || /TODO|Unresolved|待填/i.test(value))) {
      return { issues: ["publish.md has an unresolved publication tag."] };
    }
    if (new Set(values).size !== values.length) return { issues: ["publish.md publication tags must be distinct."] };
    return { issues: [] };
  }
  const tags = [...section.matchAll(/^(\d+)\.\s+(.+?)\s*$/gm)];
  const expected = Array.from({ length: 10 }, (_, index) => String(index + 1));
  if (tags.length !== 10 || tags.map((match) => match[1]).join(",") !== expected.join(",")) {
    return { issues: ["publish.md must list exactly ten numbered publication tags (1–10)."] };
  }
  const values = tags.map((match) => match[2].trim().toLocaleLowerCase());
  if (values.some((value) => !value || /TODO|Unresolved/i.test(value))) {
    return { issues: ["publish.md has an unresolved publication tag."] };
  }
  if (new Set(values).size !== values.length) return { issues: ["publish.md publication tags must be distinct."] };
  return { issues: [] };
}

function lintStructuredArtifact(name, content, templateVersion, scriptIds = new Set()) {
  const issues = [];
  if (name === "script.md") {
    if (templateVersion >= 2) return lintNarrationScript(content, templateVersion);
    const blocks = sceneBlocks(content);
    if (!blocks.length) return { issues: ["script.md must contain at least one scene."], blocks: [] };
    issues.push(...checkSequentialIds(blocks, "S", name));
    for (const block of blocks) {
      issues.push(...requiredBlockParts(block, [
        { label: "Purpose", pattern: /^- Purpose:\s*\S.*$/m },
        { label: "Evidence", pattern: /^- Evidence:\s*\S.*$/m },
        { label: "Narration", pattern: /^#### Narration\s*$/m },
        { label: "On-screen text", pattern: /^#### On-screen text\s*$/m },
        { label: "Visual intent", pattern: /^#### Visual intent\s*$/m },
      ], name));
    }
    const timing = lintSceneTiming(blocks, name);
    issues.push(...timing.issues);
    return { issues, blocks, ranges: timing.ranges };
  }
  if (name === "storyboard.md") {
    const blocks = sceneBlocks(content);
    if (!blocks.length) return { issues: ["storyboard.md must contain at least one scene."], blocks: [] };
    issues.push(...checkSequentialIds(blocks, "S", name));
    for (const block of blocks) {
      const required = [
        templateVersion >= 6
          ? { label: "Brief beat or legacy Script scene", pattern: /^- (?:Brief beat:\s*B\d{3}|Script scene:\s*S\d{3})\s*$/m }
          : { label: "Script scene", pattern: /^- Script scene:\s*S\d{3}\s*$/m },
        { label: "Visual composition", pattern: /^#### Visual composition\s*$/m },
        { label: "Motion and transition", pattern: /^#### Motion and transition\s*$/m },
        { label: "Audio", pattern: /^#### Audio\s*$/m },
        { label: "Acceptance check", pattern: /^#### Acceptance check\s*$/m },
      ];
      if (templateVersion >= 5) {
        required.splice(1, 0,
          { label: "Visual mode", pattern: /^- Visual mode:\s*\S.*$/m },
          { label: "Attention task", pattern: /^- Attention task:\s*\S.*$/m },
          { label: "Visual beat and attention", pattern: /^#### Visual beat and attention\s*$/m },
        );
      }
      issues.push(...requiredBlockParts(block, required, name));
    }
    const timing = lintSceneTiming(blocks, name);
    issues.push(...timing.issues);
    return { issues, blocks, ranges: timing.ranges };
  }
  if (name === "materials.md") {
    const blocks = assetBlocks(content);
    if (!blocks.length) return { issues: ["materials.md must contain at least one asset."], blocks: [] };
    issues.push(...checkSequentialIds(blocks, "MAT-", name));
    for (const block of blocks) {
      issues.push(...requiredBlockParts(block, [
        { label: "Scene", pattern: /^- Scene:\s*S\d{3}\s*$/m },
        { label: "Type", pattern: /^- Type:\s*\S.*$/m },
        { label: "Source or path", pattern: /^- Source or path:\s*\S.*$/m },
        { label: "Rights status", pattern: /^- Rights status:\s*\S.*$/m },
        { label: "Owner", pattern: /^- Owner:\s*\S.*$/m },
        { label: "Intended use", pattern: /^#### Intended use\s*$/m },
      ], name));
    }
    return { issues, blocks };
  }
  if (name === "publish.md" && templateVersion >= 3) return lintPublicationTags(content, templateVersion);
  if (name === "reference-analysis.md" && templateVersion >= 4) return lintReferenceAnalysis(content, scriptIds);
  if (name === "retention-plan.md" && templateVersion >= 5) return lintRetentionPlan(content, scriptIds);
  return { issues: [], blocks: [] };
}

function artifactRules(version) {
  const file = path.join(schemaRoot(version), "artifacts.json");
  if (!fs.existsSync(file)) throw new Error(`Artifact rules are missing: ${file}`);
  return readJson(file).artifacts;
}

function jsonSchemaIssues(value, schema, location) {
  const issues = [];
  const typeMatches = {
    object: value !== null && typeof value === "object" && !Array.isArray(value),
    array: Array.isArray(value),
    string: typeof value === "string",
  };
  if (schema.type && !typeMatches[schema.type]) return [`${location} must be ${schema.type}.`];
  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    issues.push(`${location} must equal ${JSON.stringify(schema.const)}.`);
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) issues.push(`${location} must not be empty.`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) issues.push(`${location} has an invalid format.`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) issues.push(`${location} must be an ISO date-time.`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => issues.push(...jsonSchemaIssues(item, schema.items, `${location}[${index}]`)));
  }
  if (typeMatches.object) {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) issues.push(`${location}.${key} is required.`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) issues.push(...jsonSchemaIssues(value[key], childSchema, `${location}.${key}`));
    }
  }
  return issues;
}

function lintJsonFile(file, schemaFile, label) {
  if (!fs.existsSync(file)) return [`Missing ${label}.`];
  let value;
  try {
    value = readJson(file);
  } catch (error) {
    return [`${label} is not valid JSON: ${error.message}`];
  }
  return jsonSchemaIssues(value, readJson(schemaFile), label);
}

function lintArtifact(dir, metadata, name, { checkTodo = true, scriptIds = new Set() } = {}) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return { issues: [`Missing ${name}.`], warnings: [], detail: null };
  const content = fs.readFileSync(file, "utf8");
  const rule = artifactRules(metadata.templateVersion)[name];
  if (!rule) return { issues: [], warnings: [], detail: null };
  const issues = [];
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter.values) {
    issues.push(`${name} is missing YAML frontmatter.`);
  } else {
    if (frontmatter.values.template !== rule.template) {
      issues.push(`${name} template must be '${rule.template}'.`);
    }
    if (frontmatter.values.templateVersion !== metadata.templateVersion) {
      issues.push(`${name} templateVersion must be ${metadata.templateVersion}.`);
    }
    if (frontmatter.values.productionId !== metadata.id) {
      issues.push(`${name} productionId must be '${metadata.id}'.`);
    }
  }
  const headings = markdownHeadings(frontmatter.body);
  let lastIndex = -1;
  for (const required of rule.requiredHeadings) {
    const index = headings.indexOf(required);
    if (index < 0) issues.push(`${name} is missing heading '${required}'.`);
    else if (index <= lastIndex) issues.push(`${name} heading '${required}' is out of order.`);
    else lastIndex = index;
    if (headings.filter((heading) => heading === required).length > 1) {
      issues.push(`${name} repeats heading '${required}'.`);
    }
  }
  const allowedPatterns = rule.allowedHeadingPatterns.map((pattern) => new RegExp(pattern));
  for (const heading of headings) {
    if (!rule.requiredHeadings.includes(heading) && !allowedPatterns.some((pattern) => pattern.test(heading))) {
      issues.push(`${name} contains unsupported heading '${heading}'.`);
    }
  }
  if (/\{\{[a-zA-Z0-9.]+\}\}/.test(content)) issues.push(`${name} contains an unresolved template variable.`);
  if (checkTodo && content.includes("<!-- TODO")) issues.push(`${name} contains unresolved TODO markers.`);
  const detail = lintStructuredArtifact(name, frontmatter.body, metadata.templateVersion, scriptIds);
  issues.push(...detail.issues);
  return { issues: [...new Set(issues)], warnings: [], detail };
}

function v6ContentMappings(dir, { strict = false } = {}) {
  const briefFile = path.join(dir, "brief.md");
  const evidenceFile = path.join(dir, "evidence.md");
  const scriptFile = path.join(dir, "script.md");
  if (![briefFile, evidenceFile, scriptFile].every((file) => fs.existsSync(file))) return { issues: [], beatIds: new Set() };
  const brief = fs.readFileSync(briefFile, "utf8");
  const evidence = fs.readFileSync(evidenceFile, "utf8");
  const script = fs.readFileSync(scriptFile, "utf8");
  const narration = (quotedMarkerText(script, "口播") || "").replace(/\s+/g, " ").trim();
  const beats = repeatedBlocks(brief, /^### Beat (B\d{3})\s*$/gm);
  const beatIds = new Set(beats.map((beat) => beat.id));
  const issues = [...checkSequentialIds(beats, "B", "brief.md")];
  if (!beats.length) issues.push("brief.md must contain at least one retention beat.");
  for (const beat of beats) {
    const anchor = /^- Narration anchor:\s*(.+?)\s*$/m.exec(beat.content)?.[1];
    if (!anchor) {
      if (strict) issues.push(`brief.md ${beat.id} must declare a Narration anchor.`);
      continue; // Early v6 productions may use the former Script coverage field.
    }
    const exact = anchor.replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ").trim();
    if (!exact || !narration.includes(exact)) issues.push(`brief.md ${beat.id} narration anchor is not present in script.md.`);
  }
  const references = repeatedBlocks(evidence, /^### Reference (R\d{3})\s*$/gm);
  issues.push(...checkSequentialIds(references, "R", "evidence.md"));
  if (strict && !references.length) issues.push("evidence.md must map at least one reference unit.");
  for (const reference of references) {
    const coverage = /^- Brief beat coverage:\s*(.+?)\s*$/m.exec(reference.content)?.[1];
    if (!coverage) {
      if (strict) issues.push(`evidence.md ${reference.id} must declare Brief beat coverage.`);
      continue; // Compatibility with early v6 Script scene coverage.
    }
    const disposition = /^- Disposition:\s*(preserve|reframe|omit)\s*$/m.exec(reference.content)?.[1];
    if (!disposition) issues.push(`evidence.md ${reference.id} must declare Disposition: preserve, reframe, or omit.`);
    if (disposition === "omit") {
      const reason = /^- Omission rationale:\s*(.+?)\s*$/m.exec(reference.content)?.[1];
      if (!reason || /^None$/i.test(reason)) issues.push(`evidence.md ${reference.id} omitted material needs an omission rationale.`);
      continue;
    }
    const ids = coverage.match(/B\d{3}/g) || [];
    if (!ids.length) issues.push(`evidence.md ${reference.id} must map to at least one brief beat.`);
    for (const beatId of ids) {
      if (!beatIds.has(beatId)) issues.push(`evidence.md ${reference.id} references missing brief beat ${beatId}.`);
    }
  }
  return { issues, beatIds };
}

function v6SceneMappings(dir, { requireCoverage = false, strict = false } = {}) {
  const storyboardFile = path.join(dir, "storyboard.md");
  if (!fs.existsSync(storyboardFile)) return [];
  const storyboard = fs.readFileSync(storyboardFile, "utf8");
  const scenes = sceneBlocks(storyboard);
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const { beatIds } = v6ContentMappings(dir, { strict });
  const coveredBeats = new Set();
  const issues = [];
  for (const scene of scenes) {
    const beat = /^- Brief beat:\s*(B\d{3})\s*$/m.exec(scene.content)?.[1];
    const legacy = /^- Script scene:\s*(S\d{3})\s*$/m.exec(scene.content)?.[1];
    if (beat) {
      coveredBeats.add(beat);
      if (!beatIds.has(beat)) issues.push(`storyboard.md ${scene.id} references missing brief beat ${beat}.`);
    } else if (strict) {
      issues.push(`storyboard.md ${scene.id} must reference a Brief beat.`);
    } else if (legacy && legacy !== scene.id) {
      issues.push(`storyboard.md ${scene.id} must reference matching legacy scene ${scene.id}.`);
    }
  }
  const briefFile = path.join(dir, "brief.md");
  const newMapping = fs.existsSync(briefFile) && fs.readFileSync(briefFile, "utf8").includes("- Narration anchor:");
  if (requireCoverage && (strict || newMapping)) {
    for (const beatId of beatIds) {
      if (!coveredBeats.has(beatId)) issues.push(`storyboard.md does not cover brief beat ${beatId}.`);
    }
  }
  const materialsFile = path.join(dir, "materials.md");
  if (fs.existsSync(materialsFile)) {
    for (const asset of assetBlocks(fs.readFileSync(materialsFile, "utf8"))) {
      const scene = /^- Scene:\s*(S\d{3})\s*$/m.exec(asset.content)?.[1];
      if (scene && !sceneIds.has(scene)) issues.push(`materials.md ${asset.id} references missing storyboard scene ${scene}.`);
    }
  }
  if (requireCoverage && !strict && !newMapping) {
    for (const name of ["brief.md", "evidence.md"]) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/^- (?:Script coverage|Script scene coverage):\s*(.+?)\s*$/gm)) {
        for (const scene of match[1].match(/S\d{3}/g) || []) {
          if (!sceneIds.has(scene)) issues.push(`${name} references missing storyboard scene ${scene}.`);
        }
      }
    }
  }
  return issues;
}

export function lintProduction(projectRoot, id) {
  const { dir, metadata } = loadProduction(projectRoot, id);
  if (!metadata.templateVersion) {
    return {
      valid: true,
      templateVersion: null,
      issues: [],
      warnings: ["Legacy production has no templateVersion; structural lint was skipped."],
    };
  }
  const issues = [];
  const warnings = [];
  const results = {};
  issues.push(...jsonSchemaIssues(
    metadata,
    readJson(path.join(schemaRoot(metadata.templateVersion), "production.schema.json")),
    "production.json",
  ));
  issues.push(...lintJsonFile(
    path.join(dir, "deliverables.json"),
    path.join(schemaRoot(metadata.templateVersion), "deliverables.schema.json"),
    "deliverables.json",
  ));
  for (const name of Object.values(artifactsFor(metadata))) {
    if (metadata.templateVersion >= 4 && name === "reference-analysis.md") continue;
    if (metadata.templateVersion >= 5 && name === "retention-plan.md") continue;
    results[name] = lintArtifact(dir, metadata, name, { checkTodo: metadata.templateVersion < 3 });
    issues.push(...results[name].issues);
  }

  const scriptIds = new Set((results["script.md"].detail?.blocks || []).map((block) => block.id));
  if (metadata.templateVersion >= 4 && metadata.templateVersion < 6) {
    const referenceFile = "reference-analysis.md";
    results[referenceFile] = lintArtifact(dir, metadata, referenceFile, {
      checkTodo: metadata.templateVersion < 3,
      scriptIds,
    });
    issues.push(...results[referenceFile].issues);
  }
  if (metadata.templateVersion >= 5 && metadata.templateVersion < 6) {
    const retentionFile = "retention-plan.md";
    results[retentionFile] = lintArtifact(dir, metadata, retentionFile, {
      checkTodo: metadata.templateVersion < 3,
      scriptIds,
    });
    issues.push(...results[retentionFile].issues);
  }
  if (metadata.templateVersion < 6) {
    const storyboardBlocks = results["storyboard.md"].detail?.blocks || [];
    const storyboardIds = new Set(storyboardBlocks.map((block) => block.id));
    for (const scriptId of scriptIds) {
      if (!storyboardIds.has(scriptId)) issues.push(`storyboard.md is missing script scene ${scriptId}.`);
    }
    for (const block of storyboardBlocks) {
      const reference = /^- Script scene:\s*(S\d{3})\s*$/m.exec(block.content)?.[1];
      if (reference && !scriptIds.has(reference)) issues.push(`storyboard.md ${block.id} references missing script scene ${reference}.`);
      else if (reference && reference !== block.id) issues.push(`storyboard.md ${block.id} must reference matching script scene ${block.id}.`);
    }
    for (const block of results["materials.md"].detail?.blocks || []) {
      const reference = /^- Scene:\s*(S\d{3})\s*$/m.exec(block.content)?.[1];
      if (reference && !scriptIds.has(reference)) issues.push(`materials.md ${block.id} references missing script scene ${reference}.`);
    }
  }
  if (metadata.templateVersion >= 6) {
    const strict = metadata.artifactContractVersion >= 2;
    issues.push(...v6ContentMappings(dir, { strict }).issues);
    issues.push(...v6SceneMappings(dir, { strict }));
  }

  const ranges = results["script.md"].detail?.ranges || [];
  const target = targetDurationSeconds(metadata.duration);
  if (target !== null && ranges.length) {
    const actual = ranges.at(-1).end;
    if (Math.abs(target - actual) > 1) {
      warnings.push(`script.md ends at ${actual.toFixed(3)}s, which differs from target ${target.toFixed(3)}s.`);
    }
  }
  return {
    valid: issues.length === 0,
    templateVersion: metadata.templateVersion,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
  };
}

function gateIssues(dir, metadata, gate, { prerequisites = true } = {}) {
  const issues = [];
  const gates = gatesFor(metadata);
  const scriptFile = path.join(dir, "script.md");
  const referenceScriptIds = metadata.templateVersion >= 4 && fs.existsSync(scriptFile)
    ? new Set(narrationSceneBlocks(fs.readFileSync(scriptFile, "utf8")).map((block) => block.id).filter(Boolean))
    : new Set();
  if (!gates.includes(gate)) return [`Unknown gate: ${gate}`];

  if (prerequisites) {
    const index = gates.indexOf(gate);
    for (const prior of gates.slice(0, index)) {
      const priorIssues = approvalIssues(dir, metadata, prior);
      if (priorIssues.length) issues.push(`Prior gate '${prior}' is not valid.`);
    }
  }

  for (const name of gateFilesFor(metadata, gate)) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      issues.push(`Missing ${name}.`);
      continue;
    }
    if (name.endsWith(".md") && hasTodo(file)) issues.push(`${name} contains unresolved TODO markers.`);
    if (name.endsWith(".md") && metadata.templateVersion) {
      issues.push(...lintArtifact(dir, metadata, name, {
        checkTodo: false,
        scriptIds: ["reference-analysis.md", "retention-plan.md"].includes(name) ? referenceScriptIds : new Set(),
      }).issues);
    }
    if (["tasks.md", "review.md"].includes(name)) {
      const count = uncheckedTasks(file, name === "review.md" && metadata.templateVersion >= 6
        ? { beforeHeading: "## Human final checklist" }
        : {});
      if (count) issues.push(`${name} has ${count} unchecked task(s).`);
    }
  }

  if (gate === "final" || (gate === "publish" && metadata.templateVersion >= 6)) {
    issues.push(...deliverableIssues(dir));
  }
  if (gate === "final" && metadata.artifactContractVersion >= 3) issues.push(...renderAuthorizationIssues(dir));
  if (metadata.templateVersion >= 6 && gate === "content") issues.push(...v6ContentMappings(dir, { strict: metadata.artifactContractVersion >= 2 }).issues);
  if (metadata.templateVersion >= 6 && gate === "final") issues.push(...v6SceneMappings(dir, { requireCoverage: true, strict: metadata.artifactContractVersion >= 2 }));
  if (metadata.templateVersion >= 6 && ["final", "publish"].includes(gate)) {
    const packageFile = path.join(dir, "publish.md");
    if (fs.existsSync(packageFile)) {
      const publication = fs.readFileSync(packageFile, "utf8");
      for (const cover of V6_COVERS) {
        if (!publication.includes(cover)) issues.push(`publish.md must reference ${cover}.`);
      }
    }
  }
  return issues;
}

function approvalIssues(dir, metadata, gate) {
  const approval = metadata.approvals?.[gate];
  if (!approval) return [`Gate '${gate}' has not been approved.`];
  let current;
  try {
    current = hashGateFiles(dir, metadata, gate);
  } catch (error) {
    return [error.message];
  }
  const stale = Object.keys(current).filter((name) => current[name] !== approval.hashes?.[name]);
  const issues = stale.map((name) => `Gate '${gate}' is stale because ${name} changed after approval.`);
  if (["final", "publish"].includes(gate)) {
    issues.push(...deliverableIssues(dir).map((issue) => `Gate '${gate}' is stale: ${issue}`));
  }
  if (gate === "final" && metadata.artifactContractVersion >= 3) {
    issues.push(...renderAuthorizationIssues(dir).map((issue) => `Gate '${gate}' is stale: ${issue}`));
  }
  return issues;
}

function insideDirectory(dir, file) {
  const relative = path.relative(dir, file);
  return relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveDeliverable(dir, storedPath) {
  if (typeof storedPath !== "string" || !storedPath) return null;
  const resolved = path.resolve(dir, storedPath);
  if (!path.isAbsolute(storedPath) && !insideDirectory(dir, resolved)) return null;
  return resolved;
}

function deliverableIssues(dir) {
  const file = path.join(dir, "deliverables.json");
  if (!fs.existsSync(file)) return ["Missing deliverables.json."];
  let items;
  try {
    items = readJson(file);
  } catch {
    return ["deliverables.json is not valid JSON."];
  }
  if (!Array.isArray(items) || items.length === 0) return ["No deliverable has been registered."];
  const issues = [];
  for (const item of items) {
    const file = resolveDeliverable(dir, item.path);
    if (!file || !fs.existsSync(file)) {
      issues.push(`Deliverable is missing: ${item.path || "<empty path>"}.`);
    } else if (fileHash(file) !== item.sha256) {
      issues.push(`Deliverable changed after registration: ${item.path}.`);
    }
  }
  return issues;
}

export function approveGate(projectRoot, id, gate, by) {
  if (!by) throw new Error("Approver is required. Pass `--by <name>`. ");
  const production = loadProduction(projectRoot, id);
  const gates = gatesFor(production.metadata);
  if (!gates.includes(gate)) throw new Error(`Gate must be one of: ${gates.join(", ")}`);
  const issues = gateIssues(production.dir, production.metadata, gate);
  if (issues.length) throw new Error(`Cannot approve ${gate}:\n- ${issues.join("\n- ")}`);

  production.metadata.approvals[gate] = {
    by,
    at: now(),
    hashes: hashGateFiles(production.dir, production.metadata, gate),
  };
  production.metadata.updatedAt = now();
  writeJson(production.metadataFile, production.metadata);
  return production.metadata.approvals[gate];
}

export function registerDeliverable(projectRoot, id, inputPath, label) {
  const production = loadProduction(projectRoot, id);
  if (production.metadata.artifactContractVersion >= 3) {
    const issues = renderAuthorizationIssues(production.dir);
    if (issues.length) throw new Error(`Cannot register rendered video: ${issues.join("; ")}`);
  }
  const absolute = path.resolve(inputPath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Deliverable file not found: ${absolute}`);
  }
  const manifestFile = path.join(production.dir, "deliverables.json");
  const items = readJson(manifestFile);
  const digest = fileHash(absolute);
  const source = fs.realpathSync(absolute);
  const stored = path.join(production.dir, "renders", "registered", `${digest.slice(0, 16)}-${path.basename(absolute)}`);
  fs.mkdirSync(path.dirname(stored), { recursive: true });
  if (!fs.existsSync(stored)) fs.copyFileSync(source, stored);
  if (fileHash(stored) !== digest) throw new Error(`Registered deliverable copy differs from source: ${stored}`);
  const item = {
    label: label || path.basename(absolute),
    path: path.relative(production.dir, stored),
    sha256: digest,
    registeredAt: now(),
  };
  const next = items.filter((entry) => entry.label !== item.label);
  next.push(item);
  writeJson(manifestFile, next);
  production.metadata.approvals.final = null;
  if (production.metadata.templateVersion >= 3) production.metadata.approvals.publish = null;
  production.metadata.updatedAt = now();
  writeJson(production.metadataFile, production.metadata);
  return item;
}

function artifactState(file, key, dir, metadata, name) {
  if (!fs.existsSync(file)) return { state: "missing" };
  if (hasTodo(file)) return { state: "draft", reason: "TODO markers remain" };
  if (metadata.templateVersion && name.endsWith(".md")) {
    const issues = lintArtifact(dir, metadata, name, { checkTodo: false }).issues;
    if (issues.length) return { state: "draft", reason: `${issues.length} structure issue(s)` };
  }
  if (key === "publish" && metadata.templateVersion >= 6) {
    const missing = V6_COVERS.filter((cover) => !fs.existsSync(path.join(dir, cover)));
    if (missing.length) return { state: "draft", reason: `missing ${missing.join(", ")}` };
  }
  if (["tasks", "review"].includes(key)) {
    const count = uncheckedTasks(file, key === "review" && metadata.templateVersion >= 6
      ? { beforeHeading: "## Human final checklist" }
      : {});
    if (count) return { state: "draft", reason: `${count} unchecked task(s)` };
  }
  return { state: "ready" };
}

export function getStatus(projectRoot, id) {
  const { dir, metadata } = loadProduction(projectRoot, id);
  const artifacts = Object.fromEntries(Object.entries(artifactsFor(metadata)).map(([key, name]) => [
    key,
    artifactState(path.join(dir, name), key, dir, metadata, name),
  ]));
  const approvals = Object.fromEntries(gatesFor(metadata).map((gate) => {
    const approval = metadata.approvals?.[gate];
    if (!approval) return [gate, { state: "pending" }];
    const issues = approvalIssues(dir, metadata, gate);
    return [gate, issues.length ? { state: "stale", issues } : { state: "approved", by: approval.by, at: approval.at }];
  }));
  const deliverables = deliverableIssues(dir);
  const deltas = inspectDeltas(dir);
  const syncState = standardsSyncState(metadata, deltas);
  return {
    id,
    title: metadata.title,
    type: metadata.type,
    artifacts,
    approvals,
    deliverables: deliverables.length ? { state: "invalid", issues: deliverables } : { state: "ready" },
    standardsDelta: deltas.operationCount
      ? { operations: deltas.operationCount, state: syncState, syncedAt: metadata.standardsSync?.at || metadata.syncedAt }
      : { operations: 0, state: syncState },
  };
}

export function nextActions(projectRoot, id) {
  const status = getStatus(projectRoot, id);
  const { metadata } = loadProduction(projectRoot, id);
  if (metadata.templateVersion >= 3) {
    const contentArtifacts = metadata.templateVersion >= 6
      ? ["context", "brief", "evidence", "script", "contentReview"]
      : metadata.templateVersion >= 5
      ? ["context", "topic", "referenceAnalysis", "retentionPlan", "research", "script", "contentReview"]
      : ["context", "topic", "research", "script", "contentReview"];
    if (status.approvals.content.state !== "approved") {
      if (contentArtifacts.some((key) => status.artifacts[key].state !== "ready")) {
        return [metadata.templateVersion >= 6
          ? "Automatically complete the brief, evidence ledger, script, editorial opposition, strict AI review, and any fixable review/re-review loop."
          : metadata.templateVersion >= 5
          ? "Automatically complete the angle slate, retention plan, research, script, editorial opposition, strict AI review, and any fixable review/re-review loop."
          : "Automatically complete topic, research, script, strict AI review, and any fixable review/re-review loop."];
      }
      return [`Request content approval${status.approvals.content.state === "stale" ? " again" : ""}.`];
    }
    if (["storyboard", "materials"].some((key) => status.artifacts[key].state !== "ready")) {
      return ["Automatically complete storyboard.md and materials.md, then continue to TTS/video production."];
    }
    const productionActions = [];
    if (status.artifacts.tasks.state !== "ready") productionActions.push("Complete TTS and video production tasks in tasks.md.");
    if (status.deliverables.state !== "ready") {
      if (metadata.artifactContractVersion >= 3 && renderAuthorizationIssues(productionDir(projectRoot, id)).length) {
        productionActions.push("Build and check a playable preview, obtain explicit confirmation of its current inputs, then render and register a deliverable.");
      } else {
        productionActions.push("Render and register at least one deliverable.");
      }
    }
    if (productionActions.length) return ["Automatically complete the remaining production work: " + productionActions.join(" ")];
    if (status.artifacts.review.state !== "ready") return ["Automatically complete review.md; auto-fix and re-check findings that stay within approved scope; do not tick human checklist items."];
    if (status.artifacts.publish.state !== "ready") return ["Automatically complete the release package before final approval: selected title, separately composed 16:9/4:3/3:4 covers, description, exactly ten distinct tags, platform settings, and a master-promise check."];
    if (status.approvals.final.state !== "approved") {
      return [`Request final-video approval${status.approvals.final.state === "stale" ? " again" : ""}.`];
    }
    if (status.approvals.publish.state !== "approved") {
      return [`Request publication approval${status.approvals.publish.state === "stale" ? " again" : ""}.`];
    }
    const learningKeys = metadata.templateVersion >= 6 ? ["learning"] : ["analytics", "retrospective"];
    if (learningKeys.some((key) => status.artifacts[key].state !== "ready")) {
      return [metadata.templateVersion >= 6
        ? "When the real publication record and authorized data are available, automatically complete learning.md; promote only explicit durable standards, not this production's working context."
        : "When the real publication record and authorized data are available, automatically complete analytics.md and retrospective.md; promote only explicit durable standards, not this production's working context."];
    }
    if (["pending", "stale"].includes(status.standardsDelta.state)) {
      return [`Sync the durable standards delta${status.standardsDelta.state === "stale" ? " again" : ""}.`];
    }
    return ["Archive the completed production."];
  }
  if (["proposal", "brief"].some((key) => status.artifacts[key].state !== "ready")) {
    return ["Complete proposal.md and brief.md."];
  }
  if (status.approvals.brief.state !== "approved") {
    return [`Request brief approval${status.approvals.brief.state === "stale" ? " again" : ""}.`];
  }
  if (["script", "storyboard", "materials"].some((key) => status.artifacts[key].state !== "ready")) {
    return ["Complete script.md, storyboard.md, and materials.md."];
  }
  if (status.approvals.storyboard.state !== "approved") {
    return [`Request storyboard/materials approval${status.approvals.storyboard.state === "stale" ? " again" : ""}.`];
  }
  const productionActions = [];
  if (status.artifacts.tasks.state !== "ready") productionActions.push("Complete the production tasks in tasks.md.");
  if (status.deliverables.state !== "ready") productionActions.push("Render and register at least one deliverable.");
  if (productionActions.length) return productionActions;
  if (status.artifacts.review.state !== "ready") return ["Complete review.md and its human checklist."];
  if (status.approvals.final.state !== "approved") {
    return [`Request final approval${status.approvals.final.state === "stale" ? " again" : ""}.`];
  }
  if (["pending", "stale"].includes(status.standardsDelta.state)) {
    return [`Sync the durable standards delta${status.standardsDelta.state === "stale" ? " again" : ""}.`];
  }
  return ["Archive the completed production."];
}

export function validateProduction(projectRoot, id) {
  const { dir, metadata } = loadProduction(projectRoot, id);
  const issues = [];
  for (const gate of gatesFor(metadata)) {
    issues.push(...gateIssues(dir, metadata, gate, { prerequisites: false }));
    issues.push(...approvalIssues(dir, metadata, gate));
  }
  const deltas = inspectDeltas(dir);
  const syncState = standardsSyncState(metadata, deltas);
  if (syncState === "pending") issues.push("Standards delta has not been synced.");
  if (syncState === "stale") issues.push("Standards delta changed after it was synced.");
  if (metadata.templateVersion >= 3) {
    const learningArtifacts = metadata.templateVersion >= 6
      ? { learning: "learning.md" }
      : { analytics: "analytics.md", retrospective: "retrospective.md" };
    for (const [key, name] of Object.entries(learningArtifacts)) {
      const state = artifactState(path.join(dir, name), key, dir, metadata, name);
      if (state.state !== "ready") issues.push(`${name} is not ready for archive${state.reason ? `: ${state.reason}` : "."}`);
    }
    const publication = path.join(dir, "publication.json");
    try {
      if (!readJson(publication).published) issues.push("publication.json has no human publication record.");
    } catch {
      issues.push("publication.json is missing or invalid.");
    }
  }
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}

export function listProductions(projectRoot) {
  const root = productionRoot(projectRoot);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "archive")
    .map((entry) => {
      const file = path.join(root, entry.name, "production.json");
      return fs.existsSync(file) ? readJson(file) : { id: entry.name, invalid: true };
    });
}

function parseStandardBlocks(content) {
  const matches = [...content.matchAll(/^### Standard:\s*(.+?)\s*$/gm)];
  const blocks = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    blocks.set(matches[index][1].trim().toLowerCase(), {
      name: matches[index][1].trim(),
      text: content.slice(start, end).trim(),
    });
  }
  return blocks;
}

function deltaSection(content, heading) {
  const startMatch = new RegExp(`^## ${heading} Standards\\s*$`, "m").exec(content);
  if (!startMatch) return "";
  const start = startMatch.index + startMatch[0].length;
  const rest = content.slice(start);
  const next = /^## [A-Z]+ Standards\s*$/m.exec(rest);
  return rest.slice(0, next ? next.index : undefined).trim();
}

function parseDeltaFile(file) {
  const content = fs.readFileSync(file, "utf8");
  return {
    added: parseStandardBlocks(deltaSection(content, "ADDED")),
    modified: parseStandardBlocks(deltaSection(content, "MODIFIED")),
    removed: parseStandardBlocks(deltaSection(content, "REMOVED")),
  };
}

function inspectDeltas(dir) {
  const deltaDir = path.join(dir, "specs");
  if (!fs.existsSync(deltaDir)) return { files: [], operationCount: 0 };
  const files = fs.readdirSync(deltaDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => path.join(deltaDir, name));
  let operationCount = 0;
  for (const file of files) {
    const delta = parseDeltaFile(file);
    operationCount += delta.added.size + delta.modified.size + delta.removed.size;
  }
  return {
    files,
    operationCount,
    hashes: Object.fromEntries(files.map((file) => [path.basename(file), fileHash(file)])),
  };
}

function standardsSyncState(metadata, deltas) {
  if (!deltas.operationCount) return "not-needed";
  if (!metadata.standardsSync) return "pending";
  const synced = metadata.standardsSync.hashes || {};
  const names = new Set([...Object.keys(synced), ...Object.keys(deltas.hashes)]);
  return [...names].some((name) => synced[name] !== deltas.hashes[name]) ? "stale" : "synced";
}

export function syncStandards(projectRoot, id) {
  const production = loadProduction(projectRoot, id);
  const deltas = inspectDeltas(production.dir);
  if (!deltas.operationCount) return { operationCount: 0, files: [] };

  const writes = [];
  const conflicts = [];
  for (const deltaFile of deltas.files) {
    const domain = path.basename(deltaFile, ".md");
    slug(domain);
    const target = path.join(projectRoot, ROOT_DIR, "specs", domain, "spec.md");
    const existing = fs.existsSync(target)
      ? fs.readFileSync(target, "utf8")
      : `# ${domain} Standards\n\n## Purpose\n\nDurable production standards.\n\n## Standards\n\n`;
    const firstBlock = existing.search(/^### Standard:/m);
    const preamble = (firstBlock >= 0 ? existing.slice(0, firstBlock) : existing).trimEnd();
    const standards = parseStandardBlocks(existing);
    const delta = parseDeltaFile(deltaFile);

    for (const [key, block] of delta.removed) {
      if (!standards.has(key)) conflicts.push(`${domain}: cannot remove missing standard '${block.name}'.`);
      else standards.delete(key);
    }
    for (const [key, block] of delta.modified) {
      if (!standards.has(key)) conflicts.push(`${domain}: cannot modify missing standard '${block.name}'.`);
      else standards.set(key, block);
    }
    for (const [key, block] of delta.added) {
      if (standards.has(key)) conflicts.push(`${domain}: cannot add existing standard '${block.name}'.`);
      else standards.set(key, block);
    }
    writes.push({ target, content: `${preamble}\n\n${[...standards.values()].map((item) => item.text).join("\n\n")}\n` });
  }

  if (conflicts.length) throw new Error(`Standards sync conflicts:\n- ${conflicts.join("\n- ")}`);
  for (const item of writes) write(item.target, item.content);
  production.metadata.syncedAt = now();
  production.metadata.standardsSync = {
    at: production.metadata.syncedAt,
    hashes: deltas.hashes,
  };
  production.metadata.updatedAt = now();
  writeJson(production.metadataFile, production.metadata);
  return { operationCount: deltas.operationCount, files: writes.map((item) => item.target) };
}

function relocateDeliverablesForArchive(production) {
  const manifestFile = path.join(production.dir, "deliverables.json");
  const items = readJson(manifestFile);
  const changes = [];
  const relocated = items.map((item) => {
    const source = fs.realpathSync(resolveDeliverable(production.dir, item.path));
    let target = source;
    if (!insideDirectory(production.dir, source)) {
      target = path.join(production.dir, "renders", "registered", `${item.sha256.slice(0, 16)}-${path.basename(source)}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!fs.existsSync(target)) fs.copyFileSync(source, target);
      if (fileHash(target) !== item.sha256) throw new Error(`Archived deliverable copy differs from approved file: ${item.path}`);
    }
    const relative = path.relative(production.dir, target);
    if (relative !== item.path) changes.push({ from: item.path, to: relative, sha256: item.sha256 });
    return { ...item, path: relative };
  });
  if (!changes.length) return;

  const beforeHash = fileHash(manifestFile);
  writeJson(manifestFile, relocated);
  const afterHash = fileHash(manifestFile);
  for (const approval of Object.values(production.metadata.approvals || {})) {
    if (approval?.hashes?.["deliverables.json"] === beforeHash) {
      approval.hashes["deliverables.json"] = afterHash;
    }
  }
  production.metadata.archivePathMigration = { at: now(), beforeHash, afterHash, changes };
  writeJson(production.metadataFile, production.metadata);
}

export function archiveProduction(projectRoot, id) {
  const production = loadProduction(projectRoot, id);
  const result = validateProduction(projectRoot, id);
  if (!result.valid) throw new Error(`Cannot archive ${id}:\n- ${result.issues.join("\n- ")}`);
  const date = new Date().toISOString().slice(0, 10);
  const destination = path.join(productionRoot(projectRoot), "archive", `${date}-${id}`);
  if (fs.existsSync(destination)) throw new Error(`Archive destination already exists: ${destination}`);
  relocateDeliverablesForArchive(production);
  const relocated = validateProduction(projectRoot, id);
  if (!relocated.valid) throw new Error(`Cannot archive ${id} after relocating deliverables:\n- ${relocated.issues.join("\n- ")}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  production.metadata.archivedAt = now();
  writeJson(production.metadataFile, production.metadata);
  fs.renameSync(production.dir, destination);
  return destination;
}

export function formatStatus(status) {
  const lines = [`${status.id} — ${status.title} (${status.type})`, "", "Artifacts:"];
  for (const [name, value] of Object.entries(status.artifacts)) {
    lines.push(`  ${value.state === "ready" ? "✓" : "·"} ${name}: ${value.state}${value.reason ? ` — ${value.reason}` : ""}`);
  }
  lines.push("", "Human gates:");
  for (const [name, value] of Object.entries(status.approvals)) {
    lines.push(`  ${value.state === "approved" ? "✓" : "·"} ${name}: ${value.state}${value.by ? ` — ${value.by}` : ""}`);
  }
  lines.push("", `Deliverables: ${status.deliverables.state}`);
  lines.push(`Standards delta: ${status.standardsDelta.operations} operation(s) — ${status.standardsDelta.state}`);
  return lines.join("\n");
}

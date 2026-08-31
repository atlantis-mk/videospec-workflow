import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = "videospec";
export const GATES = ["brief", "storyboard", "final"];
export const VERSION = "0.4.5";
export const TEMPLATE_VERSION = 2;
export const VIDEO_SPEC_SKILLS = [
  "videospec",
  "videospec-apply",
  "videospec-approve",
  "videospec-archive",
  "videospec-explore",
  "videospec-propose",
  "videospec-sync",
  "videospec-update",
  "videospec-verify",
];

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ARTIFACTS = {
  proposal: "proposal.md",
  brief: "brief.md",
  script: "script.md",
  storyboard: "storyboard.md",
  materials: "materials.md",
  tasks: "tasks.md",
  review: "review.md",
};

const GATE_FILES = {
  brief: ["proposal.md", "brief.md"],
  storyboard: ["script.md", "storyboard.md", "materials.md"],
  final: ["tasks.md", "review.md", "deliverables.json"],
};

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
    return [destination, renderTemplate(content, context, manifest.variables)];
  }));
}

export function initProject(target = ".") {
  const projectRoot = path.resolve(target);
  const root = path.join(projectRoot, ROOT_DIR);
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
    "AGENTS.md": agentInstructions(),
    ...templateFiles("projectFiles"),
  };

  for (const [relative, content] of Object.entries(files)) {
    writeNew(path.join(root, relative), content);
  }
  writeNew(path.join(projectRoot, "productions", "archive", ".gitkeep"), "");
  const agentLayer = installAgentLayer(projectRoot);
  return { projectRoot, root, agentLayer, initialized: true };
}

function sourceSkillsDir() {
  return path.join(PACKAGE_ROOT, ".agents", "skills");
}

function sourceSkillNames() {
  return VIDEO_SPEC_SKILLS.filter((name) => fs.existsSync(path.join(sourceSkillsDir(), name, "SKILL.md")));
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
  for (const name of ["templates", "schemas"]) {
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
  if (path.resolve(source) !== path.resolve(target)) {
    for (const name of sourceSkillNames()) {
      const destination = path.join(target, name);
      if (replace && fs.existsSync(destination)) fs.rmSync(destination, { recursive: true });
      fs.cpSync(path.join(source, name), destination, { recursive: true, errorOnExist: true });
    }
  }
  return {
    runtime: path.relative(projectRoot, launcher),
    skills: sourceSkillNames(),
  };
}

export function updateProject(target = ".") {
  const projectRoot = findProject(target);
  const configFile = path.join(projectRoot, ROOT_DIR, "config.json");
  const config = readJson(configFile);
  const migration = migrateLegacyProductionRoot(projectRoot, config);
  config.toolVersion = VERSION;
  config.templateVersion = TEMPLATE_VERSION;
  config.updatedAt = now();
  writeJson(configFile, config);
  const agentLayer = installAgentLayer(projectRoot, { replace: true });
  return { projectRoot, root: path.join(projectRoot, ROOT_DIR), agentLayer, version: VERSION, migration };
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
    id,
    title: options.title || id,
    type: options.type || "general-video",
    duration: options.duration || "TBD",
    aspectRatio: options.aspect || "16:9",
    createdAt: now(),
    updatedAt: now(),
    approvals: { brief: null, storyboard: null, final: null },
    syncedAt: null,
    standardsSync: null,
    archivedAt: null,
  };

  const files = productionTemplates(metadata);
  for (const [relative, content] of Object.entries(files)) {
    writeNew(path.join(dir, relative), content);
  }
  writeJson(path.join(dir, "production.json"), metadata);
  return { dir, metadata };
}

function productionTemplates(meta) {
  return templateFiles("productionFiles", { production: meta }, meta.templateVersion);
}

function agentInstructions() {
  return `# VideoSpec agent instructions\n\nVideoSpec is the agreement layer for this video project. Treat \`videospec/specs/\` as durable production truth and each folder under the relative \`productionRoot\` configured in \`videospec/config.json\` as one reviewable unit of work.\n\n## Working model\n\n- Explore before creating artifacts when intent is unclear.\n- Keep the production proposal focused on one deliverable.\n- Use upstream artifacts as context; revise them when learning changes the plan.\n- Preserve artifact YAML frontmatter, fixed headings, heading order, field names, and sequential \`S001\` / \`MAT-001\` identifiers.\n- In template v2 scripts, keep time-coded scene headings, blockquote spoken text under \`**口播：**\`, keep Volcengine synthesis parameters numeric and in range, and send natural-language performance guidance through \`additions.context_texts\` only for Seed TTS 2.0 preset voices.\n- Use \`None\`, \`Unresolved\`, or \`Unassigned\` instead of deleting a fixed field.\n- Run \`node videospec/bin/videospec.js lint <id> --json\` after creating or editing artifacts and fix structural errors before approval.\n- Do not invent factual sources, rights clearance, human approvals, or review results.\n- AI may draft and implement. Humans own the brief, storyboard/materials, and final approval gates.\n- A changed approved artifact makes its approval stale; ask for renewed approval.\n- For HyperFrames builds, translate the approved storyboard into seek-safe composition timing, validate the project, and register rendered files with \`videospec deliver\`.\n\n## Artifact flow\n\nproposal → brief → script → storyboard + materials → tasks → render → review → final approval → archive\n\nDependencies enable work; they do not prevent iteration. Human approvals are explicit release controls.\n`;
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function hashGateFiles(dir, gate) {
  return Object.fromEntries(GATE_FILES[gate].map((name) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) throw new Error(`Missing gate artifact: ${name}`);
    return [name, fileHash(file)];
  }));
}

function hasTodo(file) {
  return fs.readFileSync(file, "utf8").includes("<!-- TODO");
}

function uncheckedTasks(file) {
  const content = fs.readFileSync(file, "utf8");
  return (content.match(/^\s*- \[ \]/gm) || []).length;
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
  const matches = [...content.matchAll(/^## (\d{2,}:\d{2})[–-](\d{2,}:\d{2})｜(.+?)\s*$/gm)];
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

function lintNarrationScript(content) {
  const issues = [];
  const blocks = narrationSceneBlocks(content);
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
  if (!quotedMarkerText(content, "全局演绎提示")) issues.push("script.md must contain a blockquoted 全局演绎提示.");
  if (!blocks.length) return { issues: [...issues, "script.md must contain at least one time-coded narration scene."], blocks: [] };
  const blocksWithIds = blocks.filter((block) => block.id);
  if (blocksWithIds.length !== blocks.length) issues.push("Every script.md narration scene must contain a Scene ID field.");
  issues.push(...checkSequentialIds(blocksWithIds, "S", "script.md"));
  for (const block of blocks) {
    const label = block.id || block.title;
    issues.push(...requiredBlockParts({ ...block, id: label }, [
      { label: "Purpose", pattern: /^- Purpose:\s*\S.*$/m },
      { label: "Evidence", pattern: /^- Evidence:\s*\S.*$/m },
      { label: "合成参数", pattern: /^\*\*合成参数：\*\*\s*$/m },
      { label: "演绎提示", pattern: /^\*\*演绎提示：\*\*\s*$/m },
      { label: "口播", pattern: /^\*\*口播：\*\*\s*$/m },
      { label: "屏幕内容", pattern: /^\*\*屏幕内容：\*\*\s*$/m },
      { label: "视觉意图", pattern: /^\*\*视觉意图：\*\*\s*$/m },
    ], "script.md"));
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

function lintStructuredArtifact(name, content, templateVersion) {
  const issues = [];
  if (name === "script.md") {
    if (templateVersion >= 2) return lintNarrationScript(content);
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
      issues.push(...requiredBlockParts(block, [
        { label: "Script scene", pattern: /^- Script scene:\s*S\d{3}\s*$/m },
        { label: "Visual composition", pattern: /^#### Visual composition\s*$/m },
        { label: "Motion and transition", pattern: /^#### Motion and transition\s*$/m },
        { label: "Audio", pattern: /^#### Audio\s*$/m },
        { label: "Acceptance check", pattern: /^#### Acceptance check\s*$/m },
      ], name));
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

function lintArtifact(dir, metadata, name, { checkTodo = true } = {}) {
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
  const detail = lintStructuredArtifact(name, frontmatter.body, metadata.templateVersion);
  issues.push(...detail.issues);
  return { issues: [...new Set(issues)], warnings: [], detail };
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
  for (const name of Object.values(ARTIFACTS)) {
    results[name] = lintArtifact(dir, metadata, name);
    issues.push(...results[name].issues);
  }

  const scriptIds = new Set((results["script.md"].detail?.blocks || []).map((block) => block.id));
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
  if (!GATES.includes(gate)) return [`Unknown gate: ${gate}`];

  if (prerequisites) {
    const index = GATES.indexOf(gate);
    for (const prior of GATES.slice(0, index)) {
      const priorIssues = approvalIssues(dir, metadata, prior);
      if (priorIssues.length) issues.push(`Prior gate '${prior}' is not valid.`);
    }
  }

  for (const name of GATE_FILES[gate]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      issues.push(`Missing ${name}.`);
      continue;
    }
    if (name.endsWith(".md") && hasTodo(file)) issues.push(`${name} contains unresolved TODO markers.`);
    if (name.endsWith(".md") && metadata.templateVersion) {
      issues.push(...lintArtifact(dir, metadata, name, { checkTodo: false }).issues);
    }
    if (["tasks.md", "review.md"].includes(name)) {
      const count = uncheckedTasks(file);
      if (count) issues.push(`${name} has ${count} unchecked task(s).`);
    }
  }

  if (gate === "final") {
    issues.push(...deliverableIssues(dir));
  }
  return issues;
}

function approvalIssues(dir, metadata, gate) {
  const approval = metadata.approvals?.[gate];
  if (!approval) return [`Gate '${gate}' has not been approved.`];
  let current;
  try {
    current = hashGateFiles(dir, gate);
  } catch (error) {
    return [error.message];
  }
  const stale = Object.keys(current).filter((name) => current[name] !== approval.hashes?.[name]);
  return stale.map((name) => `Gate '${gate}' is stale because ${name} changed after approval.`);
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
    if (!item.path || !fs.existsSync(item.path)) {
      issues.push(`Deliverable is missing: ${item.path || "<empty path>"}.`);
    } else if (fileHash(item.path) !== item.sha256) {
      issues.push(`Deliverable changed after registration: ${item.path}.`);
    }
  }
  return issues;
}

export function approveGate(projectRoot, id, gate, by) {
  if (!GATES.includes(gate)) throw new Error(`Gate must be one of: ${GATES.join(", ")}`);
  if (!by) throw new Error("Approver is required. Pass `--by <name>`. ");
  const production = loadProduction(projectRoot, id);
  const issues = gateIssues(production.dir, production.metadata, gate);
  if (issues.length) throw new Error(`Cannot approve ${gate}:\n- ${issues.join("\n- ")}`);

  production.metadata.approvals[gate] = {
    by,
    at: now(),
    hashes: hashGateFiles(production.dir, gate),
  };
  production.metadata.updatedAt = now();
  writeJson(production.metadataFile, production.metadata);
  return production.metadata.approvals[gate];
}

export function registerDeliverable(projectRoot, id, inputPath, label) {
  const production = loadProduction(projectRoot, id);
  const absolute = path.resolve(inputPath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Deliverable file not found: ${absolute}`);
  }
  const manifestFile = path.join(production.dir, "deliverables.json");
  const items = readJson(manifestFile);
  const item = {
    label: label || path.basename(absolute),
    path: absolute,
    sha256: fileHash(absolute),
    registeredAt: now(),
  };
  const next = items.filter((entry) => entry.label !== item.label);
  next.push(item);
  writeJson(manifestFile, next);
  production.metadata.approvals.final = null;
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
  if (["tasks", "review"].includes(key)) {
    const count = uncheckedTasks(file);
    if (count) return { state: "draft", reason: `${count} unchecked task(s)` };
  }
  return { state: "ready" };
}

export function getStatus(projectRoot, id) {
  const { dir, metadata } = loadProduction(projectRoot, id);
  const artifacts = Object.fromEntries(Object.entries(ARTIFACTS).map(([key, name]) => [
    key,
    artifactState(path.join(dir, name), key, dir, metadata, name),
  ]));
  const approvals = Object.fromEntries(GATES.map((gate) => {
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
  for (const gate of GATES) {
    issues.push(...gateIssues(dir, metadata, gate, { prerequisites: false }));
    issues.push(...approvalIssues(dir, metadata, gate));
  }
  const deltas = inspectDeltas(dir);
  const syncState = standardsSyncState(metadata, deltas);
  if (syncState === "pending") issues.push("Standards delta has not been synced.");
  if (syncState === "stale") issues.push("Standards delta changed after it was synced.");
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

export function archiveProduction(projectRoot, id) {
  const production = loadProduction(projectRoot, id);
  const result = validateProduction(projectRoot, id);
  if (!result.valid) throw new Error(`Cannot archive ${id}:\n- ${result.issues.join("\n- ")}`);
  const date = new Date().toISOString().slice(0, 10);
  const destination = path.join(productionRoot(projectRoot), "archive", `${date}-${id}`);
  if (fs.existsSync(destination)) throw new Error(`Archive destination already exists: ${destination}`);
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

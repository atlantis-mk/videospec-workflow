import path from "node:path";
import {
  approveGate,
  archiveProduction,
  createProduction,
  findProject,
  formatStatus,
  getStatus,
  initProject,
  lintProduction,
  listProductions,
  nextActions,
  registerDeliverable,
  doctorProject,
  syncStandards,
  updateProject,
  validateProduction,
  VERSION,
} from "./core.js";

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { positional, flags };
}

function print(value, json = false) {
  console.log(json ? JSON.stringify(value, null, 2) : value);
}

function help() {
  return `VideoSpec — specification-driven video production\n\nUsage:\n  videospec init [directory]\n  videospec update [directory]\n  videospec doctor [directory] [--json]\n  videospec new <production-id> [--title <text>] [--type <type>] [--duration <time>] [--aspect <ratio>]\n  videospec list [--json]\n  videospec status <production-id> [--json]\n  videospec lint <production-id> [--json]\n  videospec next <production-id> [--json]\n  videospec approve <production-id> <brief|storyboard|final> --by <name>\n  videospec deliver <production-id> <file> [--label <name>]\n  videospec sync <production-id>\n  videospec validate <production-id> [--json]\n  videospec archive <production-id>\n  videospec --version\n\nWorkflow:\n  proposal → brief → script → storyboard + materials → tasks → render → review → approve → archive\n`;
}

function requireArg(value, name) {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

export async function main(argv) {
  if (argv.includes("--version") || argv.includes("-V")) {
    print(VERSION);
    return;
  }
  const { positional, flags } = parseArgs(argv);
  const [command = "help", ...args] = positional;
  const json = Boolean(flags.json);

  if (["help", "--help", "-h"].includes(command)) {
    print(help());
    return;
  }

  if (command === "init") {
    const result = initProject(args[0] || ".");
    print(
      json ? result : `${result.initialized ? "Initialized" : "Updated"} VideoSpec at ${result.root}\nInstalled ${result.agentLayer.skills.length} AI skill(s) in .agents/skills.\n\nNext: open your AI chat and run $videospec-explore or $videospec-propose.`,
      json,
    );
    return;
  }

  if (command === "update") {
    const result = updateProject(args[0] || ".");
    const migration = result.migration?.state === "copied"
      ? `\nCopied legacy productions to ${path.relative(result.projectRoot, result.migration.destination)}; future commands use the new directory.`
      : result.migration?.state === "configured"
        ? `\nConfigured the production root at ${path.relative(result.projectRoot, result.migration.destination)}.`
        : "";
    print(json ? result : `Updated VideoSpec ${result.version} at ${result.root}\nRefreshed ${result.agentLayer.skills.length} AI skill(s).${migration}`, json);
    return;
  }

  if (command === "doctor") {
    const result = doctorProject(args[0] || ".");
    print(
      json ? result : [`VideoSpec ${result.version} doctor`, "", ...result.checks.map((check) => `${check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "·"} ${check.name}: ${check.message}`)].join("\n"),
      json,
    );
    if (!result.valid) process.exitCode = 1;
    return;
  }

  const projectRoot = findProject();
  if (command === "new") {
    const id = requireArg(args[0], "production id");
    const result = createProduction(projectRoot, id, flags);
    print(json ? result : `Created production ${id} at ${result.dir}`, json);
    return;
  }

  if (command === "list") {
    const items = listProductions(projectRoot);
    print(json ? items : items.length ? items.map((item) => `${item.id}\t${item.title || ""}\t${item.type || ""}`).join("\n") : "No active productions.", json);
    return;
  }

  if (command === "status") {
    const id = requireArg(args[0], "production id");
    const status = getStatus(projectRoot, id);
    print(json ? status : formatStatus(status), json);
    return;
  }

  if (command === "lint") {
    const id = requireArg(args[0], "production id");
    const result = lintProduction(projectRoot, id);
    const formatted = result.valid
      ? [`${id} matches template v${result.templateVersion ?? "legacy"}.`, ...result.warnings.map((warning) => `Warning: ${warning}`)].join("\n")
      : [`Template lint failed for ${id}:`, ...result.issues.map((issue) => `- ${issue}`), ...result.warnings.map((warning) => `Warning: ${warning}`)].join("\n");
    print(json ? result : formatted, json);
    if (!result.valid) process.exitCode = 1;
    return;
  }

  if (command === "next") {
    const id = requireArg(args[0], "production id");
    const actions = nextActions(projectRoot, id);
    print(json ? actions : actions.map((action, index) => `${index + 1}. ${action}`).join("\n"), json);
    return;
  }

  if (command === "approve") {
    const id = requireArg(args[0], "production id");
    const gate = requireArg(args[1], "approval gate");
    const result = approveGate(projectRoot, id, gate, flags.by);
    print(json ? result : `Approved ${gate} for ${id} by ${result.by}.`, json);
    return;
  }

  if (command === "deliver") {
    const id = requireArg(args[0], "production id");
    const file = requireArg(args[1], "deliverable file");
    const result = registerDeliverable(projectRoot, id, file, flags.label);
    print(json ? result : `Registered ${result.label}: ${result.path}`, json);
    return;
  }

  if (command === "sync") {
    const id = requireArg(args[0], "production id");
    const result = syncStandards(projectRoot, id);
    print(json ? result : result.operationCount ? `Synced ${result.operationCount} standards operation(s).` : "No standards delta to sync.", json);
    return;
  }

  if (command === "validate") {
    const id = requireArg(args[0], "production id");
    const result = validateProduction(projectRoot, id);
    print(json ? result : result.valid ? `${id} is valid.` : `Validation failed:\n- ${result.issues.join("\n- ")}`, json);
    if (!result.valid) process.exitCode = 1;
    return;
  }

  if (command === "archive") {
    const id = requireArg(args[0], "production id");
    const destination = archiveProduction(projectRoot, id);
    print(json ? { destination } : `Archived ${id} to ${path.relative(projectRoot, destination)}`, json);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${help()}`);
}

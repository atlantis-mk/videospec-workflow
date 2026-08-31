---
name: videospec
description: Route AI-assisted, specification-driven video production work. Use when the user asks to initialize or inspect VideoSpec, start or continue a video, check what comes next, approve a gate, revise plans, verify a render, sync standards, or archive a production, especially when a `videospec/` directory exists.
---

# VideoSpec router

Treat VideoSpec as the AI-facing control plane. Run its deterministic CLI yourself; do not tell the user to type terminal commands.

## Establish state

1. Look for `videospec/config.json` from the working directory upward.
2. If it is absent and the user wants to start a VideoSpec project, run `node bin/videospec.js init` when this source checkout is available. Otherwise report that the VideoSpec package must be installed once.
3. In an initialized project, run `node videospec/bin/videospec.js list --json` and, for the selected production, `node videospec/bin/videospec.js status <id> --json`.
4. Infer the production only when exactly one active production or the conversation makes it unambiguous.

For any action that creates, edits, approves, or verifies production artifacts, run `node videospec/bin/videospec.js lint <id> --json` before handing off the result. Do not normalize or redesign the versioned Markdown structure yourself.

## Route the action

Read the matching sibling skill completely, then follow it:

- unclear idea or comparison only → `../videospec-explore/SKILL.md`
- start a production or draft its plan → `../videospec-propose/SKILL.md`
- execute an approved production → `../videospec-apply/SKILL.md`
- revise existing artifacts → `../videospec-update/SKILL.md`
- record explicit human approval → `../videospec-approve/SKILL.md`
- inspect a render or production quality → `../videospec-verify/SKILL.md`
- merge durable standards → `../videospec-sync/SKILL.md`
- finish and archive → `../videospec-archive/SKILL.md`

If the request is only “what next?”, run `node videospec/bin/videospec.js next <id> --json`, explain the result, and carry out the safe next action when the user already authorized it.

Never invent factual evidence, rights clearance, review findings, or human approval.

---
name: videospec-update
description: Revise an active VideoSpec production after feedback or new learning while keeping proposal, brief, script, storyboard, materials, tasks, and review artifacts coherent. Use when the user asks to change direction, incorporate notes, replace material, alter timing, or update an approved video plan.
---

# Update a production

1. Select the production, read `production.json`, all planning artifacts, durable specs, and `node videospec/bin/videospec.js status <id> --json`.
2. Translate the requested revision into affected artifacts before editing. Preserve the same production only when its intent remains substantially the same; propose a new production if the audience, primary outcome, or majority of scope changes.
3. Edit the earliest affected artifact, then reconcile every dependent artifact:
   - proposal/brief changes may affect everything
   - script changes may affect storyboard, materials, tasks, and review
   - storyboard changes may affect materials and tasks
   - material changes may affect rights, tasks, and visual treatment
4. Preserve the production's template contract while editing: do not change frontmatter, fixed headings, heading order, field names, or identifier formats. Add content inside existing sections and repeat the documented scene/asset blocks when more entries are needed. In template v2 scripts, keep scene headings in `MM:SS–MM:SS｜title` format, keep narration blockquoted under `**口播：**`, keep Volcengine API parameters numeric and in range, and update `演绎提示` whenever wording, timing, or dramatic intent changes. Use `None`, `Unresolved`, or `Unassigned` instead of deleting a field.
5. Do not edit approval records in `production.json`. File hashes intentionally make affected approvals stale.
6. If a deliverable is replaced, register the new file with `node videospec/bin/videospec.js deliver`; this clears final approval.
7. Run `node videospec/bin/videospec.js lint <id> --json` and fix structural errors before running status. State warnings, which approvals became stale, and the next required review.

Do not silently preserve an approval after its reviewed content changed, and do not record a new approval without an explicit user instruction.

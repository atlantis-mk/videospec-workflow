---
name: videospec-archive
description: Finish and archive a completed VideoSpec production after its deliverable, reviews, approvals, and durable standards are valid. Use when the user asks to close, complete, file, or archive a finished video production.
---

# Archive a production

1. Select the production and run `node videospec/bin/videospec.js validate <id> --json`.
2. Fix only objective, in-scope machine issues. Never fabricate completed tasks, rights clearance, review results, checked human items, or approval.
3. If a durable standards delta is pending or stale, follow `../videospec-sync/SKILL.md` and sync it before archiving.
4. Re-run validation. If a human gate is missing or stale, stop and name the exact `$videospec-approve` action required.
5. When validation passes, run `node videospec/bin/videospec.js archive <id>`.
6. Report the archive path, registered deliverables, approval identities, and standards merged.

Archive is a record of completed reality, not a way to hide unfinished work.

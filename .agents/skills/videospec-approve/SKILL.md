---
name: videospec-approve
description: Record explicit human content, final-video, or publication approval for a VideoSpec production.
---

# Record human approval

Only record a decision the user explicitly makes. Confirmation to render the current playable preview is a separate pre-render decision; content and final approval never imply permission to render. Read the context ledger, status, and the files protected by the requested gate.

1. For `content`, require acceptance of v6 `context.md`, `brief.md`, `evidence.md`, `script.md`, and `content-review.md`; confirm the reference mode, coverage/omissions, and rights boundary where a reference is used.
2. For `final`, require a valid current render authorization and acceptance of the rendered deliverable, storyboard/materials, automated review, the prepared `publish.md` package, and the human final checklist questions. The explicit final approval record is the sign-off; do not mark those questions as agent-completed checks. Present the title, the project-required covers, and one-sentence viewer promise alongside the master; this avoids a separate manual packaging pass after approval.
3. For `publish`, require acceptance of `publish.md`: selected title, the cover assets declared in the current project delivery spec, separately generated with `$imagegen` and stored in the production, plus description, metadata, settings, and the project-required number of distinct search-relevant tags, and the final deliverable. Approval authorizes publication; it does not pretend publication has happened.
4. Run `node videospec/bin/videospec.js lint <id> --json` and status, disclose warnings or stale approvals, then run `node videospec/bin/videospec.js approve <id> <content|final|publish> --by <name>`.
5. Report the approver, timestamp, and signed file hashes. Never infer approval from completed AI work.

## v6 artifact authority

The content gate protects `context.md`, `brief.md`, `evidence.md`, `script.md`, and `content-review.md`; `activity.md` records later operational work without invalidating content approval. The final gate protects `storyboard.md`, `materials.md`, `tasks.md`, `review.md`, `publish.md`, `deliverables.json`, and the project-required cover files; the publication gate protects `publish.md`, `deliverables.json`, and the project-required cover files. `learning.md` is post-publication and is not a pre-publication approval artifact.

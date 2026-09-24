---
name: videospec-approve
description: Record explicit human content, final-video, or publication approval for a VideoSpec production.
---

# Record human approval

Only record a decision the user explicitly makes. Read the context ledger, status, and the files protected by the requested gate.

1. For `content`, require acceptance of v6 `context.md`, `brief.md`, `evidence.md`, `script.md`, and `content-review.md` (use the recorded older artifact layout for legacy productions); confirm the reference mode, coverage/omissions, and rights boundary where a reference is used.
2. For `final`, require acceptance of the rendered deliverable, storyboard/materials, automated review, the prepared `publish.md` package, and the human final checklist questions. The explicit final approval record is the sign-off; do not mark those questions as agent-completed checks. Present the title, three native-ratio covers, and one-sentence viewer promise alongside the master; this avoids a separate manual packaging pass after approval.
3. For `publish`, require acceptance of `publish.md`: selected title, separately composed 16:9, 4:3, and 3:4 cover assets generated with `$imagegen` and stored in the production, description, metadata, settings, exactly ten distinct search-relevant tags, and the final deliverable. Approval authorizes publication; it does not pretend publication has happened.
4. Run `node videospec/bin/videospec.js lint <id> --json` and status, disclose warnings or stale approvals, then run `node videospec/bin/videospec.js approve <id> <content|final|publish> --by <name>`.
5. Report the approver, timestamp, and signed file hashes. Never infer approval from completed AI work.

## v6 artifact authority

For templateVersion 6, the content gate protects `context.md`, `brief.md`, `evidence.md`, `script.md`, and `content-review.md`; `activity.md` records later operational work without invalidating content approval. The final gate protects `storyboard.md`, `materials.md`, `tasks.md`, `review.md`, `publish.md`, `deliverables.json`, and the three cover files; the publication gate protects `publish.md`, `deliverables.json`, and the three cover files. `learning.md` is post-publication and is not a pre-publication approval artifact.

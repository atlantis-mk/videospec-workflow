---
name: videospec-approve
description: Record an explicit human approval for a VideoSpec brief, storyboard/materials package, or final video. Use only when the user clearly asks to approve, sign off, accept, or confirm a named production gate; never invoke implicitly merely because artifacts look complete.
---

# Record human approval

Treat invocation as a request to record a human decision, not to make the decision for them.

1. Identify the production and gate: `brief`, `storyboard`, or `final`.
2. Run `node videospec/bin/videospec.js lint <id> --json` and `node videospec/bin/videospec.js status <id> --json`. Structural lint errors block approval; show the user any warnings, incomplete scope, or stale scope before recording approval.
3. For `brief`, ensure the user explicitly accepts `proposal.md` and `brief.md`.
4. For `storyboard`, ensure the user explicitly accepts `script.md`, `storyboard.md`, and `materials.md`, including unresolved rights or evidence risks.
5. For `final`, require the user's explicit confirmation that they reviewed facts/claims, rights/privacy/attribution, brand/editorial intent, picture, audio, captions, and delivery. If the checklist in `review.md` is unchecked, update it only from that explicit confirmation.
6. Use the provided approver name; otherwise record `User`. Run `node videospec/bin/videospec.js approve <id> <gate> --by <name>`.
7. Report the gate, approver, timestamp, and files whose hashes were signed.

Do not approve from inference, technical QA, previous conversation ambiguity, or another skill's completion. If the user has not explicitly approved, stop and request confirmation.

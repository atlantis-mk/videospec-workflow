---
name: videospec-apply
description: Execute an existing VideoSpec production plan using approved artifacts, including creating media, composing or editing scenes, running HyperFrames, rendering outputs, updating tasks, and preparing a review version. Use when the user asks to make, build, continue, render, or produce an approved video.
---

# Apply an approved production

1. Select the production and run `node videospec/bin/videospec.js lint <id> --json` followed by status. Fix structural errors through `$videospec-update` before implementation and report any duration warnings.
2. Require valid `brief` and `storyboard` approvals before cost-bearing production or final rendering. If either is pending or stale, stop at draft work and request explicit `$videospec-approve` approval.
3. Read the durable specs and all production artifacts. Treat the approved script, storyboard, and materials plan as the implementation contract.
4. If HyperFrames is the chosen or default framework, invoke the available `$hyperframes` entry skill before creating, editing, validating, or rendering its composition. Let HyperFrames own composition details; VideoSpec owns intent, traceability, gates, and delivery registration.
5. Produce only assets that the materials plan permits. Do not claim rights clearance, recording, or source verification that did not happen.
6. When generating or recording narration, map the script's synthesis fields to the provider request without reinterpretation, and send `全局演绎提示` plus per-scene `演绎提示` through `additions.context_texts` only for a Seed TTS 2.0 preset voice. Generate one representative sample before the full batch, and preserve spoken text separately from pronunciation substitutions or provider-specific context.
7. Check off `tasks.md` items only after completing them. Record newly discovered changes in the proper upstream artifact. If an approved script, storyboard, or materials file must change, use `$videospec-update`, let the approval become stale, and pause final production until renewed approval.
8. Render a reviewable output and register it yourself with `node videospec/bin/videospec.js deliver <id> <absolute-file> --label <label>`.
9. Fill the technical findings in `review.md`, but leave the human final checklist and final approval to the user.
10. Run status and report completed work, remaining tasks, output paths, and the exact next human action.

Never approve a gate as part of apply.

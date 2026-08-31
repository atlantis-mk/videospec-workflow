---
name: videospec-verify
description: Verify a VideoSpec production or rendered video against approved intent, script, storyboard, materials, durable standards, and delivery requirements. Use for review, QA, diagnostics, render inspection, acceptance checks, or determining whether a video is ready for final human approval.
---

# Verify a production

1. Read the durable specs, production artifacts, approval state, deliverables manifest, and registered files.
2. Confirm the registered file exists and its hash still matches. Register an untracked review render only when the user placed it in scope.
3. Inspect representative frames and critical transitions. Check scene order, timing, safe areas, typography, captions, visual consistency, and storyboard acceptance checks.
4. When timed captions or narration-to-caption references are present, compare them against the final rendered timeline yourself. Verify every related semantic effect, label, card, illustrative image, or footage has a storyboard mapping, begins at or after the matching content starts, and does not persist into unrelated content. Record the result, any mismatch, and its resolution in `review.md` under `Automated checks` or `Findings and resolutions`.
5. Inspect audio for speech intelligibility, masking, sync, clipping, and expected duration when audio tooling is available.
6. Compare narration performance with the global and per-scene performance direction. Check `context_texts`, speech rate, loudness, trailing silence, pitch, pronunciation, pacing, pauses, and whether provider-side substitutions changed meaning.
7. For a HyperFrames project, invoke `$hyperframes` and run its required lint/check/snapshot or render diagnostics. Do not substitute generic checks for its workflow.
8. Compare factual claims and asset use with `script.md` and `materials.md`; flag unresolved evidence, rights, privacy, or attribution instead of guessing.
9. Update only the machine/technical findings and resolutions in `review.md`. Do not tick the human final checklist.
10. Run `node videospec/bin/videospec.js lint <id> --json` and `node videospec/bin/videospec.js validate <id> --json`. Explain template errors/warnings, automated QA findings, missing human items, and whether the deliverable is unchanged as separate results.

Never turn a successful technical check into human final approval.

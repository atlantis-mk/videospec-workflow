---
name: videospec-sync
description: Review and merge a production's ADDED, MODIFIED, or REMOVED durable standards into the VideoSpec project truth. Use when a completed production introduces reusable editorial, visual, audio, brand, or delivery rules that future videos should follow.
---

# Sync durable standards

1. Read every delta file under `<productionRoot>/<id>/specs/`, excluding `README.md`; resolve `productionRoot` from `videospec/config.json` (new projects default to `productions/`).
2. Compare each operation with its target `videospec/specs/<domain>/spec.md`.
3. Confirm that the rule is durable across future productions, not a one-off episode detail. Remove accidental one-off content from the delta.
4. Check that ADDED names are new and MODIFIED/REMOVED names exist. Resolve conflicts in the delta or canonical spec before syncing.
5. Run `node videospec/bin/videospec.js sync <id>`.
6. Re-read changed canonical specs and run production status. Report each added, modified, or removed standard.

Do not change creative history merely to make sync pass. Do not create a standards delta when the production learned nothing durable.

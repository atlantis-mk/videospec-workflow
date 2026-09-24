---
template: videospec/tasks
templateVersion: 6
productionId: {{production.id}}
---

# Production tasks: {{production.title}}

This is a machine-maintained execution checklist. It is not the source of truth for the brief, evidence, narration, visual plan, or approvals.

## Pre-production

- [ ] Preserve the current context ledger, evidence ledger, brief, and script
- [ ] Run editorial opposition and strict script review; resolve fixable revisions before the human content gate
- [ ] Convert each retention beat into a director-ready storyboard and traceable materials plan

## TTS and video build

- [ ] Generate and review one representative TTS sample covering the opening tone and one emotional turn
- [ ] Lock every **口播：** block and its scene order before the first non-dry-run TTS request
- [ ] Generate the full TTS master with the approved per-scene processing and loudness targets
- [ ] Recalibrate timing from measured processed voice durations without changing narration
- [ ] Export timed ASR SRT from the merged narration, then correct wording with `export_subtitles.py --canonical-script <production>/script.md`; render a review version and register it

## Automated quality control

- [ ] Check subtitles, audio-video sync, black frames, timing, pacing, facts, sources, rights, privacy, and visual mapping
- [ ] Run the audience-critic review and fix/re-check findings within the approved scope

## Publication and learning

- [ ] Prepare the release package during production QA and check it against the review render
- [ ] After human publication and authorized data are available, complete learning.md

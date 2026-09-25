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
- [ ] Export timed ASR SRT from the merged narration, then correct wording with `export_subtitles.py --canonical-script <production>/script.md`
- [ ] Build delivery subtitles on one dedicated caption track from corrected text and reliable word times; inspect phrase grouping, exits, safe zones, and bundled fonts
- [ ] Build a playable preview and record its composition, subtitle, narration, and local media hashes

**Pre-render preview QA:**

- [ ] Run the renderer's runtime, layout, motion, and contrast checks; inspect representative frames at mobile size
- [ ] Compare corrected subtitles and semantic visual anchors with the locked narration and reliable word times
- [ ] Check caption behavior during both seeking and continuous playback
- [ ] Audit the full timeline for gaps, black or empty frames, overlong stills, and video source duration and handoffs
- [ ] Record passing results and the exact preview input version before requesting render confirmation

**Render gate:**

- [ ] Obtain explicit human confirmation of the current playable preview in `render-authorization.json`
- [ ] Run `python3 videospec/scripts/check_render_authorization.py <production>` immediately before every video render or export
- [ ] Render the confirmed version and register the review deliverable

## Automated quality control

- [ ] Confirm the encoded file matches the checked preview; probe sync, black frames, loudness, streams, captions, and footage motion
- [ ] Run the audience-critic review and fix/re-check findings within the approved scope; renew preview confirmation before any re-render after input changes

## Publication and learning

- [ ] Prepare the release package during production QA and check it against the review render
- [ ] After human publication and authorized data are available, complete learning.md

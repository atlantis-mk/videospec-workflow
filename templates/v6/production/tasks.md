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
- [ ] Map essential visual information to approved audio or an authorized description path; choose caption design, overlay contrast, honest chart scales and context, non-color cues, and motion from project standards before generating the storyboard, assets, and composition
- [ ] Plan readable holds and purposeful pauses for dense concepts, figures, charts, and multi-step explanations without changing protected narration

## TTS and video build

- [ ] Generate and review one representative TTS sample covering the opening tone and one emotional turn
- [ ] Lock every **口播：** block and its scene order before the first non-dry-run TTS request
- [ ] Generate the full TTS master using the current project audio profile
- [ ] Recalibrate timing from measured processed voice durations without changing narration
- [ ] Export timed ASR SRT from the merged narration, then correct wording with `export_subtitles.py --canonical-script <production>/script.md`
- [ ] Build delivery subtitles on one dedicated caption track from corrected text and reliable word times; retain approved wording, include meaningful sound or speaker cues when needed, and inspect phrase grouping, exits, safe zones, bundled fonts, and the current project caption presentation standard
- [ ] Build a playable preview and record its script, composition, subtitle, narration, voice manifest, and local media hashes

**Pre-render preview QA:**

- [ ] Run the renderer's runtime, layout, motion, and contrast checks; inspect representative frames at mobile size
- [ ] Compare corrected subtitles and semantic visual anchors with the locked narration and reliable word times
- [ ] Check caption behavior during both seeking and continuous playback, including picture occlusion, layout stability, and restrained emphasis at mobile size
- [ ] Check essential visual meaning is available in audio, overlay text remains legible on its least favorable background frames, and data graphics preserve units, period, source, and honest scales
- [ ] Play information-dense beats continuously and adjust holds, pauses, or reveal order when viewers cannot process a point before the next arrives
- [ ] Check that charts, status cues, and meaningful highlights remain understandable without color alone; inspect flashing sequences against the project visual standard
- [ ] Audit the full timeline for gaps, black or empty frames, overlong stills, and video source duration and handoffs
- [ ] Record passing results and the exact preview input version before requesting render confirmation

**Render gate:**

- [ ] Obtain explicit human confirmation of the current playable preview in `render-authorization.json`
- [ ] Run `python3 videospec/scripts/check_render_authorization.py <production>` immediately before every video render or export
- [ ] Render the confirmed version and register the review deliverable

## Automated quality control

- [ ] Confirm the encoded file matches the checked preview; probe sync, black frames, audio against the project profile, streams, caption content and audible visual meaning, overlay contrast, data-graphic integrity, comprehension pacing, color-independent meaning, flash safety, and footage motion
- [ ] Run the audience-critic review and fix/re-check findings within the approved scope; renew preview confirmation before any re-render after input changes

## Publication and learning

- [ ] Prepare the release package during production QA and check it against the review render
- [ ] After human publication and authorized data are available, complete learning.md

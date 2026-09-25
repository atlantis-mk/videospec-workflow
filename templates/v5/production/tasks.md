---
template: videospec/tasks
templateVersion: 5
productionId: {{production.id}}
---

# Production tasks: {{production.title}}

## Pre-production

- [ ] Preserve the current context ledger, source log, angle slate, and retention plan
- [ ] Run editorial opposition and strict script review; resolve fixable revisions and re-review before the human content gate
- [ ] Convert each retention beat into a director-ready storyboard and traceable materials plan

## TTS and video build

- [ ] Generate and review one representative TTS sample that covers the opening tone and one emotional turn
- [ ] Before the first non-dry-run TTS request, finalize and lock every **口播：** block and its scene order; after that, never change the spoken text
- [ ] Generate full TTS; retain raw segments and apply per-scene 75 Hz high-pass, gentle de-essing, 2.5:1 compression, and -1.5 dB safety limiting
- [ ] Merge processed scenes in script order; use two-pass EBU R128 mastering for a mono 48 kHz / 24-bit `narration.wav` at -16 LUFS, 6 LU LRA, and -1.5 dBTP
- [ ] Recalibrate script scene timecodes from the measured processed voice durations; reconcile storyboard and other timing-only production artifacts without changing **口播：**
- [ ] Export timed ASR subtitles once from the merged narration and retain the raw SRT and recognition record; when wording is locked, correct the raw SRT against the canonical script without rerunning ASR, then build scenes, captions, and sound mix using only that merged file; master the final stereo video mix to -14 LUFS and -1.0 dBTP
- [ ] Render a review version, register it, and automatically trigger audience-critic and technical QA

## Automated quality control

- [ ] Check subtitles, audio-video sync, black frames, timing, and pacing; automatically fix and re-check fixable findings
- [ ] Run a time-coded audience critic review for likely exits, narration-to-screen duplication, visual repetition, unresolved promises, and unearned visual interruptions
- [ ] Check factual, source, rights, privacy, and visual mapping risks

## Publication and learning

- [ ] During production QA, automatically prepare and verify the selected title, three individually composed native-ratio covers, description, metadata, accessibility text, platform draft, and exactly ten distinct search-relevant tags against the actual review render
- [ ] Present the complete release package with the final-master decision brief; do not make title/cover generation a separate post-final task

After a human publishes, capture platform data, compare retention against the planned beats, and complete the retrospective; these are post-publication records, not blockers for final-video approval.

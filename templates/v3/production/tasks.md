---
template: videospec/tasks
templateVersion: 3
productionId: {{production.id}}
---

# Production tasks: {{production.title}}

## Pre-production

- [ ] Preserve the current context ledger and source log
- [ ] Automatically run strict script review; resolve fixable revisions and re-review before the human content gate
- [ ] Prepare storyboard and materials

## TTS and video build

- [ ] Generate and review one representative TTS sample
- [ ] Before the first non-dry-run TTS request, finalize and lock every **口播：** block and its scene order; after that, never change the spoken text
- [ ] Generate full TTS; retain raw segments and apply per-scene 75 Hz high-pass, gentle de-essing, 2.5:1 compression, and -1.5 dB safety limiting
- [ ] Merge processed scenes in script order; use two-pass EBU R128 mastering for a mono 48 kHz / 24-bit `narration.wav` at -16 LUFS, 6 LU LRA, and -1.5 dBTP
- [ ] Recalibrate script scene timecodes from the measured processed voice durations; reconcile storyboard and other timing-only production artifacts without changing **口播：**
- [ ] Export subtitles from the merged narration and build scenes, captions, and sound mix using only that merged file; master the final stereo video mix to -14 LUFS and -1.0 dBTP
- [ ] Render a review version, register it, and automatically trigger QA

## Automated quality control

- [ ] Check subtitles, audio-video sync, black frames, timing, and pacing; automatically fix and re-check fixable findings
- [ ] Check factual, source, rights, privacy, and visual mapping risks

## Publication and learning

Prepare the publication package after final-video approval. After a human publishes, capture platform data and complete the retrospective; these are post-publication records, not blockers for final-video approval.

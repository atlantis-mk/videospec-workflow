---
template: videospec/review
templateVersion: 5
productionId: {{production.id}}
---

# Automated video review: {{production.title}}

## Review version

<!-- TODO: Record filename, render id, or URL. -->

## Automated checks

- [ ] Agent compared timed captions or narration against the final render; every related effect, label, card, and visual starts with or after its corresponding content
- [ ] Agent checked audio-video sync, clipping, silence, black frames, caption readability, safe areas, and pacing
- [ ] Agent verified the voice master is mono 48 kHz / 24-bit PCM WAV at -16 LUFS, 6 LU LRA, and no more than -1.5 dBTP; verified the final stereo mix is -14 LUFS and no more than -1.0 dBTP
- [ ] Agent verified `narration-lock.json` still matches every **口播：** block and that script/video timing uses measured durations from the voice manifest
- [ ] Agent verified the selected title, cover copy, description, and platform draft make the same supported viewer promise as the final render
- [ ] Agent verified the opening begins with a recognisable action/conflict, the early promise is delivered, and section handoffs do not become a numbered-lecture cadence
<!-- TODO: Record the checks, any mismatch, and its resolution. -->

## Audience critic review

<!-- TODO: Internal-only review. Review the rendered video as an indifferent viewer. Give time-coded likely exit points, identify any repeated visual grammar, narration copied into screen text, flat emotional sections, false/unearned pattern interrupts, unresolved open loops, and the smallest safe repair. Treat this as a retention hypothesis, not fabricated platform analytics. Never turn safety, verification, source-status, or fictional-status findings into viewer-facing narration, captions, screen text, visual assets, title, cover, description, or disclaimers without an explicit user request. -->

## Findings and resolutions

<!-- TODO -->

## Human final checklist

- [ ] Facts and claims verified
- [ ] Rights, privacy, attribution, and voice identity verified
- [ ] Brand and editorial intent approved
- [ ] Picture, audio, captions, pacing, and delivery inspected
- [ ] Selected title, 16:9 / 4:3 / 3:4 covers, description, tags, and platform draft inspected against the master

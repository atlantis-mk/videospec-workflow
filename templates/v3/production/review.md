---
template: videospec/review
templateVersion: 3
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
<!-- TODO: Record the checks, any mismatch, and its resolution. -->

## Findings and resolutions

<!-- TODO -->

## Human final checklist

- [ ] Facts and claims verified
- [ ] Rights, privacy, attribution, and voice identity verified
- [ ] Brand and editorial intent approved
- [ ] Picture, audio, captions, pacing, and delivery inspected

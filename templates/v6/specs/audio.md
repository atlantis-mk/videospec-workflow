# Audio Standards

## Purpose

The current source of truth for narration, music, effects, and loudness.

## Standards

### Standard: Speech is intelligible

The production SHALL keep narration understandable and prevent music or effects from masking it.

#### Check: Acceptance

- **WHEN** the production reaches final review
- **THEN** a human reviewer SHALL confirm this standard

### Standard: Subtitle timing follows final narration

For productions with spoken narration, the production SHALL derive and human-correct subtitle timing from the final narration audio. If narration, speech rate, pauses, or subtitle segmentation changes, dependent semantic timing anchors SHALL be regenerated rather than patched from estimates. For captioned productions without speech, the approved caption timeline SHALL be the timing authority.

#### Check: Acceptance

- **WHEN** the production reaches pre-render review
- **THEN** spoken subtitles SHALL match the final audio and every semantic trigger word SHALL have a cue boundary or reliable word-level timestamp; captions without speech SHALL match their approved timeline

### Standard: Captions convey meaningful audio information

For productions with captions, the captions SHALL represent approved spoken wording accurately. When a sound or change of speaker is needed to understand the content and is not clear from the picture, the captions SHALL identify it without changing the approved spoken words. Decorative background music and incidental effects do not need labels.

#### Check: Caption content

- **WHEN** the playable preview and final render are reviewed
- **THEN** the reviewer SHALL compare the captions with the final audio and check meaningful sounds and otherwise unclear speaker changes

### Standard: Essential visual information is available through audio

When a visual, chart, on-screen instruction, or text supplies information needed to understand the video's core message, the production SHALL convey that meaning in the approved main audio or provide an accessible description track. The storyboard SHALL map each such visual to its audible explanation. A protected user script SHALL NOT be changed to satisfy this standard without the user's approval; the production MAY instead make the extra visual information nonessential or prepare a separately approved description. See [W3C's guidance on describing visual information](https://www.w3.org/WAI/media/av/av-content/).

#### Check: Audible visual meaning

- **WHEN** the script and storyboard are planned and the playable preview is reviewed
- **THEN** the agent SHALL identify essential visual-only information, record its audio or description path, and confirm that the preview can be understood without seeing those details

### Standard: Narration uses a non-destructive, controlled voice master

The production SHALL retain raw narration, apply the processing profile below with gentle de-essing, and create the voice master with two-pass EBU R128 normalization. The video build SHALL use the processed voice master. The JSON profile is the machine-readable authority for audio targets in this project.

#### Audio profile

```json
{
  "voiceMaster": {
    "highPassHz": 75,
    "compressionRatio": 2.5,
    "safetyLimiterDbfs": -1.5,
    "sampleRateHz": 48000,
    "channels": 1,
    "codec": "pcm_s24le",
    "integratedLoudnessLufs": -16,
    "loudnessRangeLu": 6,
    "truePeakDbtp": -1.5
  },
  "finalMix": {
    "sampleRateHz": 48000,
    "channels": 2,
    "integratedLoudnessLufs": -14,
    "truePeakDbtp": -1.0
  }
}
```

#### Check: Voice-master acceptance

- **WHEN** narration is ready for video assembly
- **THEN** raw narration, processed voice master, and the applied audio profile SHALL be available for review

### Standard: Final video mix is delivery-ready

After music and effects are mixed, the final video audio SHALL meet the `finalMix` targets in the audio profile above.

#### Check: Final-mix acceptance

- **WHEN** the final render is reviewed
- **THEN** automated review SHALL measure final-mix loudness, true peak, and clipping; a human reviewer SHALL assess intelligibility and narration-to-music balance when speech is present

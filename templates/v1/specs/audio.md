# Audio Standards

## Purpose

The current source of truth for narration, music, effects, and loudness.

## Standards

### Standard: Speech is intelligible

The production SHALL keep narration understandable and prevent music or effects from masking it.

#### Check: Acceptance

- **WHEN** the production reaches final review
- **THEN** a human reviewer SHALL confirm this standard

### Standard: Narration uses a non-destructive, controlled voice master

The production SHALL retain raw TTS or recorded segments. It SHALL process each scene with a 75 Hz high-pass filter, gentle de-essing, 2.5:1 speech compression, and a -1.5 dB safety limiter, then merge the scenes in approved script order. The resulting narration master SHALL be mono 48 kHz / 24-bit PCM WAV, calibrated with two-pass EBU R128 processing to -16 LUFS integrated loudness, 6 LU loudness range, and no more than -1.5 dBTP true peak. The video build SHALL use this merged master rather than a raw scene fragment.

#### Check: Voice-master acceptance

- **WHEN** narration is ready for video assembly
- **THEN** raw segments, processed segments, the merged master, and its recorded processing targets SHALL be available for review

### Standard: Final video mix is delivery-ready

After music and effects are mixed, the final video audio SHALL be stereo 48 kHz and mastered to -14 LUFS integrated loudness with no more than -1.0 dBTP true peak.

#### Check: Final-mix acceptance

- **WHEN** the final render is reviewed
- **THEN** automated review SHALL check final-mix loudness, true peak, clipping, intelligibility, and narration-to-music balance

---
template: videospec/project
templateVersion: 3
---

# Video project context

## Series or brand

<!-- Describe the channel, series, product, or organization. -->

## Audience

<!-- Describe the primary audience. -->

## Production defaults

- Default language: zh-CN
- Default aspect ratio: 16:9
- Default delivery: MP4 / H.264
- Default narration provider: Unresolved
- Default narrator persona: Unresolved
- Voice-master target: mono 48 kHz / 24-bit PCM WAV, -16 LUFS, 6 LU LRA, -1.5 dBTP
- Final-mix target: stereo 48 kHz, -14 LUFS, -1.0 dBTP

## Review-history policy

- A production's working context belongs only to that production. Do not automatically inject a prior episode's context into a new one.
- Every AI edit must have immutable `history/V###` snapshots before and after the change, plus an entry in `history/index.json` and `context.md`.
- Carry reusable rules forward only through explicit durable standards, never by deleting or silently rewriting past context.

## Non-negotiables

- Facts, rights, privacy, voice identity, and final publishing decisions require human review.
- AI must preserve context and decision history whenever it revises an artifact.

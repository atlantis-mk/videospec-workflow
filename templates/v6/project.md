---
template: videospec/project
templateVersion: 6
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
- Audio targets: `specs/audio/spec.md` audio profile
- Publication package: `specs/delivery/spec.md` publication profile

## Review-history policy

- A production's working context belongs only to that production. Do not automatically inject a prior episode's context into a new one.
- Every AI edit must have immutable `history/V###` snapshots before and after the change, plus an entry in `history/index.json`. Content decisions belong in `context.md`; production operations belong in `activity.md`.
- Carry reusable rules forward only through explicit durable standards, never by deleting or silently rewriting past context.

## Non-negotiables

- Facts, rights, privacy, voice identity, and final publishing decisions require human review.
- AI must preserve context and decision history whenever it revises an artifact.

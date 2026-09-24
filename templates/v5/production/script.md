---
template: videospec/script
templateVersion: 5
productionId: {{production.id}}
---

# Script: {{production.title}}

## Summary

- Target duration: {{production.duration}}
- Narration timing: Planned; recalibrate from the real generated voice master before video assembly. Once TTS starts, changing timing never permits changing **口播：** text or scene order.
- Language: zh-CN
- Script authority: <!-- TODO: newly-authored, user-authored, or user-authoritative -->
- Editorial voice: <!-- TODO: A real creator talking to one viewer who is about to make a concrete decision. Start from an observable action or consequence, not an author-style summary; use concrete behaviour → tension → mechanism/condition → next natural question. Never use news-report, announcer, official-neutral, lecture-like prose, or mechanical “第 X 个问题” spoken openings. -->

## TTS configuration

**接口与音频参数：**

> endpoint: /api/v3/tts/unidirectional
> resource_id: seed-tts-2.0
> speaker: <!-- TODO: exact authorized Seed TTS 2.0 speaker id -->
> format: mp3
> sample_rate: 24000
> bit_rate: 128000
> enable_subtitle: true
> explicit_language: zh-cn
> disable_markdown_filter: false
> max_length_to_filter_parenthesis: 0
> aigc_watermark: false

## Voice profile

**全局演绎提示：**

> 角色：<!-- TODO -->
> 整体语气：<!-- TODO: Describe the emotional range and a creator-to-viewer conversation, not a constant energetic tone. -->
> 发音原则：<!-- TODO: Natural spoken Chinese directed at one viewer. Treat 15 as the speech-rate baseline; name pauses at a concrete action, a condition, a reversal, or a decision—not at arbitrary punctuation. -->
> 避免：<!-- TODO: Include newsreader/announcer delivery, official or lecture-like cadence, flat news copy, generic motivational cadence, unearned sarcasm, and polished author-language nobody would say in ordinary conversation. -->

## 00:00–00:00｜<!-- TODO: Scene title -->

- Scene ID: S001
- Purpose: <!-- TODO -->
- Viewer state: <!-- TODO -->
- Narrative move: <!-- TODO: Hook, question, conflict, evidence, counterargument, reversal, or payoff. For S001, begin with an observable viewer action/consequence and deliver a useful judgment within 15 seconds. -->
- Open loop or payoff: <!-- TODO: The exact unresolved question advanced or value delivered. -->
- Evidence: Unresolved
- Source subtitle coverage: <!-- TODO: source subtitle segment locator for a user script; None when newly-authored -->

**合成参数：**

> <!-- speech_rate baseline: 15. Vary above or below it per scene only for story, emotion, information density, or comprehension. -->
> speech_rate: 15
> loudness_rate: 0
> silence_duration_ms: 0
> post_process_pitch: 0
> section_id: {{production.id}}:S001

**演绎提示：**

> <!-- TODO: Specify pauses, emphasis, emotional turn, return to calm, and why this scene stays at or moves above/below the 15 speech-rate baseline. -->

**口播：**

> <!-- TODO -->

**屏幕内容：**

> <!-- TODO: Only keywords, numbers, conflict, or conclusion. Do not transcribe the narration. -->

**视觉意图：**

> <!-- TODO: What the viewer sees and why it is more useful than a subtitle card. -->

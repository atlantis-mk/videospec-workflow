---
template: videospec/script
templateVersion: 2
productionId: {{production.id}}
---

# Script: {{production.title}}

## Summary

- Target duration: {{production.duration}}
- Estimated narration: <!-- TODO -->
- Language: zh-CN

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

<!-- Parameter source: Volcengine unidirectional HTTP streaming TTS API. context_texts is supported only by Seed TTS 2.0 preset voices. -->

## Voice profile

**全局演绎提示：**

> 角色：<!-- TODO: narrator identity and relationship to the audience -->
> 整体语气：<!-- TODO: conversational, documentary, technical, etc. -->
> 发音原则：<!-- TODO: product names, acronyms, numbers, and substitutions -->
> 避免：<!-- TODO: unwanted delivery styles -->

## 00:00–00:00｜<!-- TODO: Scene title -->

- Scene ID: S001
- Purpose: <!-- TODO -->
- Evidence: Unresolved

**合成参数：**

> speech_rate: 0
> loudness_rate: 0
> silence_duration_ms: 0
> post_process_pitch: 0
> section_id: {{production.id}}:S001

**演绎提示：**

> <!-- TODO: One concise voice instruction sent through additions.context_texts. Cover emotion, delivery, pacing, emphasis, pauses, and pronunciation. -->

**口播：**

> <!-- TODO: Spoken words only. Keep every narration paragraph blockquoted. -->

**屏幕内容：**

> <!-- TODO: Use None when no text appears. -->

**视觉意图：**

> <!-- TODO: Describe visual intent, not implementation details. -->

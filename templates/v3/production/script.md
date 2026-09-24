---
template: videospec/script
templateVersion: 3
productionId: {{production.id}}
---

# Script: {{production.title}}

## Summary

- Target duration: {{production.duration}}
- Narration timing: Planned; recalibrate from the real generated voice master before video assembly. Once TTS starts, changing timing never permits changing **口播：** text or scene order.
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

## Voice profile

**全局演绎提示：**

> 角色：<!-- TODO -->
> 整体语气：<!-- TODO -->
> 发音原则：<!-- TODO -->
> 避免：<!-- TODO -->

## 00:00–00:00｜<!-- TODO: Scene title -->

- Scene ID: S001
- Purpose: <!-- TODO -->
- Evidence: Unresolved

**合成参数：**

> <!-- speech_rate baseline: 15. Vary above or below it per scene only for story, emotion, information density, or comprehension. -->
> speech_rate: 15
> loudness_rate: 0
> silence_duration_ms: 0
> post_process_pitch: 0
> section_id: {{production.id}}:S001

**演绎提示：**

> <!-- TODO -->

**口播：**

> <!-- TODO -->

**屏幕内容：**

> <!-- TODO -->

**视觉意图：**

> <!-- TODO -->

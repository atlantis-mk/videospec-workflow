---
template: videospec/script
templateVersion: 6
productionId: {{production.id}}
---

# Script: {{production.title}}

## Summary

- Target duration: {{production.duration}}
- Language: zh-CN
- Script authority: newly-authored
- Editorial voice: <!-- TODO: Natural creator-to-viewer spoken style. Avoid news-report, lecture-like, official-neutral, or overly polished written prose. -->

## TTS configuration

**接口与音频参数：**

> endpoint: /api/v3/tts/unidirectional  
> resource_id: seed-tts-2.0  
> speaker: <!-- TODO: exact authorized Seed TTS 2.0 speaker id -->  
> format: wav  
> sample_rate: 24000  
> bit_rate: 128000  
> enable_subtitle: true  
> explicit_language: zh-cn  
> disable_markdown_filter: false  
> max_length_to_filter_parenthesis: 0  
> aigc_watermark: false

**合成参数：**

> speech_rate: 15  
> loudness_rate: 0  
> silence_duration_ms: 0  
> post_process_pitch: 0  
> section_id: {{production.id}}:MASTER

## Voice profile

**全局演绎提示：**

> <!-- TODO: 用一句可直接作为豆包 TTS 2.0 context_texts[0] 发送的自然语言指令，定义全篇统一的语气、情绪、语速或停顿。示例：请用自然、清醒的中文解说语气朗读，语速适中；关键数字前后稍作停顿，不要播报腔。 -->

**口播：**

> <!-- TODO: Complete the entire narration as one continuous voiceover. Do not add time-coded scene headings, scene IDs, or per-scene delivery fields. -->

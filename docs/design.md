# VideoSpec 设计说明

## 两层架构

VideoSpec 由两个明确分离的层组成：

- AI 技能层：`.agents/skills/videospec-*`，负责理解用户意图、读取上下文、生成和修改制作产物、调用 HyperFrames，并保护人类审批边界。
- 确定性状态层：`videospec/bin/videospec.js`，负责脚手架、状态、哈希、审批记录、交付物登记、规范合并、校验和归档。

用户主要与技能层对话。技能在后台调用状态层，避免要求用户把每个动作翻译成终端命令。

## 模板层

模板是状态层的一部分，但以独立文件维护，避免模板内容散落在 JavaScript 字符串和技能提示词中：

```text
templates/v1..v6/
├── manifest.json
├── project.md
├── specs/
└── production/

schemas/v1..v6/
├── artifacts.json
├── production.schema.json
└── deliverables.schema.json
```

`manifest.json` 是目标路径、源模板和允许变量的清单。模板渲染只支持白名单中的简单 `{{production.*}}` 变量；未知变量或缺值立即失败。

新建的 v6 production 在 `production.json` 记录 `artifactContractVersion: 2`，要求证据条目 → brief beat → 原文口播锚点 → 分镜场景 → 素材场景的引用链完整。早期没有该字段的 v6 production 仍按原有 `S###` 引用读取，并在成片关检查这些引用；升级运行时不会改写已审批的内容文件。

production 的 `templateVersion` 和数据层 `schemaVersion` 分开演进。更新运行时和模板库不会重写已有 production；没有模板版本的历史 production 作为 legacy 内容继续读取。v1–v5 继续按原结构读取。当前 v6 用 `brief.md` 管理选题与留存设计，用 `evidence.md` 管理参考覆盖与调研，用 `learning.md` 管理发布后分析；脚本是一段连续口播，分镜负责场景划分。

### Markdown 结构契约

人类仍以 Markdown 审阅制作计划，但 AI 不能自由设计文档结构。frontmatter、固定标题、标题顺序、字段名和 ID 格式属于机器可检查契约。v1 使用通用场景块；v2 使用可被旁白生成器直接提取的时间标题、API 合成参数、演绎提示和块引用口播：

```markdown
## 00:00–00:05｜开场

- Scene ID: S001
- Purpose: Establish the problem
- Evidence: SRC-001

**合成参数：**

> speech_rate: 15
> loudness_rate: 0
> silence_duration_ms: 200
> post_process_pitch: 0
> section_id: demo-video:S001

**演绎提示：**

> 克制的紧迫感，前三句短促，重读“第一步”，随后回稳。

**口播：**

> 真正送入录音或 TTS 的文字。
```

v2 还提供全局演绎提示和接口级音频配置。逐段 `合成参数` 直接映射到火山引擎单向流式 HTTP 接口的 speech_rate、loudness_rate、silence_duration、post_process.pitch 和 section_id；`speech_rate: 15` 是默认与缺失字段时的基线，各场景可依叙事、情绪、信息密度与理解需要上下浮动。自然语言演绎意图放在单独的 `演绎提示`，与全局提示合并后进入 `additions.context_texts`。旁白工具应只提取 `口播` 的块引用，并把发音替换后的 TTS 文本与原始口播分别保留。

`videospec lint` 同时检查单文件结构和 script、storyboard、materials 之间的引用。相关 gate 在计算审批资格时会再次执行结构校验，因此 AI 忘记主动 lint 也不能绕过契约。

### TTS credential and generator

交互式 `videospec init` 要求输入 Volcengine TTS API Key，并仅在项目本地的 `videospec/.secrets/tts.env` 保存它；该文件权限为 owner-only，且通过同目录 `.gitignore` 排除。密钥不会进入配置内容、production、交付物或 `history/V###`。内嵌的 `videospec/scripts/generate_voice.py` 读取 v3 `script.md` 的 `口播`、合成参数和演绎提示，先用 `--dry-run` 检查，再请求 Seed TTS 2.0。首次实际请求前，它在 `assets/audio/voice/narration-lock.json` 记录口播文本与场景顺序的指纹；之后拒绝变更；旧版分场景脚本按实测时长校准脚本时间码，v6 只写音频 manifest，不改动已批准的脚本。它永久保留 raw 分段，并对每段进行 75 Hz 低切、轻度去齿音、2.5:1 压缩和 -1.5 dB 安全限幅；然后按场景顺序合并，并以两遍 EBU R128 校准输出唯一可供视频使用的 `narration.wav`：单声道 48 kHz / 24-bit PCM WAV、-16 LUFS、6 LU LRA、-1.5 dBTP。raw 分段不允许直接用于视频。加入音乐和音效后，成片应另行混音到立体声 48 kHz、-14 LUFS、-1.0 dBTP。manifest 不包含密钥。

v6 的 `script.md` 只保留一段连续的 `**口播：**`，生成器一次请求完整主旁白，把实测总时长和相对于 production 的音频路径写入 manifest，不改动已获内容审批的脚本。旧版按场景生成、锁定顺序和校准时间码的路径继续保留。

`videospec/scripts/export_subtitles.py` 使用 FunASR Paraformer 加 FSMN VAD 和句级时间戳，输出 SRT 及 `.asr.json` 识别记录。SRT 只在模型结果含有效时间戳时写出；缺少时间戳是错误而不是用猜测时序替代。`--correct-srt` 可以保留已有 ASR 时间码，再用 v6 `script.md` 的连续口播或旧版权威 SRT 校正文案，无需重跑识别。

## 从 OpenSpec 映射到视频制作

| OpenSpec | VideoSpec | 含义 |
|---|---|---|
| Current specs | Production standards | 当前真实有效的栏目、内容、视听与交付规范 |
| Change | Production | 一期视频或一个明确交付物 |
| Proposal | Context + angle slate/topic + retention plan + research + script + AI content review | 为什么做、为谁做、以什么证据、留存设计和叙事完成 |
| Behavioral spec | Script + storyboard + acceptance check | 成片中应当出现什么，以及如何判断正确 |
| Design | Materials + TTS/video production method | 素材来源、权利状态和实现方式 |
| Tasks | Production checklist | 可执行制作与质检清单 |
| Implementation | Shoot / compose / edit / render | 现实拍摄或 HyperFrames 等制作过程 |
| Verification | Automated review + human final approval + deliverable hash | 内容、审美、技术和文件一致性确认 |
| Release | Publication package + human publish approval + publication record | 标题、封面、简介、发布设置和实际平台记录 |
| Learning | Analytics + retrospective + explicit experiments | 用实际数据提出下期试验和长期规则，不自动复制工作上下文 |
| Delta sync | Standards sync | 将本期形成的长期规则回写真相源 |
| Archive | Production archive | 保存完整上下文和审计记录 |

## 为什么不是线性阶段机

视频和代码一样会在执行中发现上游问题：素材无法授权、旁白过长、视觉方案不可实现、平台规格变化。VideoSpec 允许随时修改上游产物，但审批绑定内容哈希，因此修改不会悄悄绕过已完成的人类确认。

这形成两种不同的约束：

- 依赖是“上下文是否足够”的提示，允许返回修改。
- 审批是“是否可以承担下一层风险”的明确控制。

## 三道人类审批

### Content gate

确认 `context.md`、选题决定、留存地图、调研、脚本和严格 AI 审稿；这些文件的哈希被签名。开放式选题需要角度比较；已有适用的探索结果会复用，用户指定方向或提供受保护脚本时不重新生成竞争选题。AI 在此之前自动完成留存设计、调研、脚本、反方攻击、按时长审稿、可修复问题的修订和复审。AI 每次修改前后都保存 `history/V###` 快照。v6 内容决策记录在受审批保护的 `context.md`；审批后的操作过程记录在不受内容审批保护的 `activity.md`。

### Final gate

确认分镜、素材、TTS/视频制作任务、观众代理审片、技术自动审片、最终交付物及已准备的发布包：事实、权利、品牌、画面、声音、字幕、黑帧、节奏，以及标题/封面/简介对成片承诺的一致性。内容审批后，AI 先检查渲染器、图像生成、配音、字幕和音视频检查能力，再自动完成制作。同一 QA 问题最多自动修复并复检两次，一次 QA 运行最多三轮；仍失败时记录已尝试的修复和残留风险，缺少可审片成片或关键技术/权利检查失败时不得申请成片批准。AI 不得自行伪造审批。观众代理结论是时间码化的编辑假设，不能替代平台留存数据。

### Publish gate

确认标题、由 `$imagegen` 分别生成的 16:9 / 4:3 / 3:4 三个封面、简介、元数据、平台设置和恰好 10 个不重复且搜索相关的标签。AI 在成片 QA 时生成并于成片关核验这份发布包；`imagegen` 每个比例单独生成，接受的资产存入 production 并在 `publish.md` 记录提示词和生成来源；三版封面共享同一视觉概念，但不得通过简单裁切互相替代。此门仅授权人类发布。实际发布时间、URL 和平台 ID 写入独立的 `publication.json`，不会反向篡改已签名的发布包；只有真实记录和已授权数据出现后，AI 才会自动完成数据分析、复盘、规范同步与归档。

v6 的成片关与发布关同时签署 `deliverables.json` 和三个 `assets/covers/` 封面文件的 SHA-256。登记成片时，文件会按内容哈希复制进 production 的 `renders/registered/`，清单只保存 production 相对路径，归档移动后仍能定位并校验。旧版绝对路径清单在归档前按原 SHA-256 核对和转换；迁移记录保留旧、新清单哈希。

## HyperFrames 的位置

HyperFrames 属于实现层：它读取已批准的上下文，把分镜转换成 HTML 场景、确定性时间轴、媒体轨道和可重复渲染。VideoSpec 不复制 HyperFrames 的动画或渲染职责，只负责回答以下问题：

- 为什么做？
- 做什么？
- 用哪些经过确认的素材？
- 谁批准了哪个版本？
- 最终交付文件是否仍然是已审文件？
- 本期产生了哪些以后持续有效的新规则？

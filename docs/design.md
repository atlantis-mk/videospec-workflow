# VideoSpec 设计说明

## 两层架构

VideoSpec 由两个明确分离的层组成：

- AI 技能层：`.agents/skills/videospec-*`，负责理解用户意图、读取上下文、生成和修改制作产物、调用 HyperFrames，并保护人类审批边界。
- 确定性状态层：`videospec/bin/videospec.js`，负责脚手架、状态、哈希、审批记录、交付物登记、规范合并、校验和归档。

用户主要与技能层对话。技能在后台调用状态层，避免要求用户把每个动作翻译成终端命令。

## 模板层

模板是状态层的一部分，但以独立文件维护，避免模板内容散落在 JavaScript 字符串和技能提示词中：

```text
templates/v6/
├── manifest.json
├── project.md
├── specs/
└── production/

schemas/v6/
├── artifacts.json
├── production.schema.json
└── deliverables.schema.json
```

`manifest.json` 是目标路径、源模板和允许变量的清单。模板渲染只支持白名单中的简单 `{{production.*}}` 变量；未知变量或缺值立即失败。`templates/v6/specs/` 只提供新项目的规范初值；初始化后的 `videospec/specs/` 是项目制作标准的当前真相源。技能读取规范并执行流程，代码处理审批、哈希、合法范围等必须强制阻止的边界。

新建的 v6 production 在 `production.json` 记录 `artifactContractVersion: 3`，要求证据条目 → brief beat → 原文口播锚点 → 分镜场景 → 素材场景的引用链完整。新契约还要求当前可播放预览经过 QA 和明确人工渲染确认，记录输入哈希并在成片登记及最终审批时复核。早期没有该字段或仍为版本 2 的 v6 production 仍按原有 `S###` 引用读取，并在成片关检查这些引用；升级运行时不会改写已审批的内容文件。

production 的 `templateVersion` 和数据层 `schemaVersion` 分开演进。更新运行时和模板库不会重写已有 production；旧模板版本的 production 不再由运行时处理。当前 v6 用 `brief.md` 管理选题与留存设计，用 `evidence.md` 管理参考覆盖与调研，用 `learning.md` 管理发布后分析；脚本是一段连续口播，分镜负责场景划分。

### Markdown 结构契约

人类仍以 Markdown 审阅制作计划，但 AI 不能自由设计文档结构。frontmatter、固定标题、标题顺序、字段名和 ID 格式属于机器可检查契约。脚本包含接口级音频配置、全局演绎提示、整篇合成参数和一段块引用的 `**口播：**`。分镜负责场景划分，素材按场景 ID 关联。旁白工具只提取 `口播` 文本，不用视觉说明填充配音。

`videospec lint` 同时检查单文件结构和 script、storyboard、materials 之间的引用。相关 gate 在计算审批资格时会再次执行结构校验，因此 AI 忘记主动 lint 也不能绕过契约。

### TTS credential and generator

交互式 `videospec init` 要求输入 Volcengine TTS API Key，并仅在项目本地的 `videospec/.secrets/tts.env` 保存它；该文件权限为 owner-only，且通过同目录 `.gitignore` 排除。密钥不会进入配置内容、production、交付物或 `history/V###`。内嵌的 `videospec/scripts/generate_voice.py` 读取当前 `script.md` 的口播与合成参数，以及项目 `videospec/specs/audio/spec.md` 的机器可读 Audio profile。已有 v6 项目的原文字规范也可读取；无法明确解析的规范会阻止生成。首次实际请求前，它记录口播指纹。后续用户明确修订口播时，先更新并重新批准内容，再通过 `--revise-narration` 归档旧音频和审批记录、重录当前口播，并使旧预览和交付失效。配音处理参数、旁白主文件目标及最终混音目标来自项目规范；实测时长、应用的 profile 和规范哈希写入音频 manifest，不改动已批准的脚本。项目音频规范更改后重用 raw 口播并重新处理音频，已确认预览因规范哈希变化而失效。音频 manifest 不包含密钥。

`script.md` 只保留一段连续的 `**口播：**`。生成器一次请求完整主旁白，把实测总时长和相对于 production 的音频路径写入 manifest，不改动已获内容审批的脚本。

`videospec/scripts/export_subtitles.py` 使用 FunASR Paraformer 加 FSMN VAD 和句级时间戳，输出 SRT 及 `.asr.json` 识别记录。SRT 只在模型结果含有效时间戳时写出；缺少时间戳是错误而不是用猜测时序替代。`--correct-srt` 可以保留已有 ASR 时间码，再用 `script.md` 的连续口播校正文案，无需重跑识别。

## 从 OpenSpec 映射到视频制作

| OpenSpec | VideoSpec | 含义 |
|---|---|---|
| Current specs | Production standards | 当前真实有效的栏目、内容、视听与交付规范 |
| Change | Production | 一期视频或一个明确交付物 |
| Proposal | Context + brief + evidence + script + AI content review | 为什么做、为谁做、以什么证据、留存设计和叙事完成 |
| Behavioral spec | Script + storyboard + acceptance check | 成片中应当出现什么，以及如何判断正确 |
| Design | Materials + TTS/video production method | 素材来源、权利状态和实现方式 |
| Tasks | Production checklist | 可执行制作与质检清单 |
| Implementation | Shoot / compose / edit / render | 现实拍摄或 HyperFrames 等制作过程 |
| Verification | Automated review + human final approval + deliverable hash | 内容、审美、技术和文件一致性确认 |
| Release | Publication package + human publish approval + publication record | 标题、封面、简介、发布设置和实际平台记录 |
| Learning | Learning + explicit experiments | 用实际数据提出下期试验和长期规则，不自动复制工作上下文 |
| Delta sync | Standards sync | 将本期形成的长期规则回写真相源 |
| Archive | Production archive | 保存完整上下文和审计记录 |

## 为什么不是线性阶段机

视频和代码一样会在执行中发现上游问题：素材无法授权、旁白过长、视觉方案不可实现、平台规格变化。VideoSpec 允许随时修改上游产物，但审批绑定内容哈希，因此修改不会悄悄绕过已完成的人类确认。

这形成两种不同的约束：

- 依赖是“上下文是否足够”的提示，允许返回修改。
- 审批是“是否可以承担下一层风险”的明确控制。

## 三道人类审批

### Content gate

确认 `context.md`、选题决定、留存地图、调研、脚本和严格 AI 审稿；这些文件的哈希被签名。开放式选题需要角度比较；已有适用的探索结果会复用，用户指定方向或提供受保护脚本时不重新生成竞争选题。AI 在此之前自动完成留存设计、调研、脚本、反方攻击、按时长审稿、可修复问题的修订和复审。AI 每次修改前后都保存 `history/V###` 快照。内容决策记录在受审批保护的 `context.md`；审批后的操作过程记录在不受内容审批保护的 `activity.md`。

### Final gate

确认分镜、素材、TTS/视频制作任务、观众代理审片、技术自动审片、最终交付物及已准备的发布包：事实、权利、品牌、画面、声音、字幕、黑帧、节奏，以及标题/封面/简介对成片承诺的一致性。内容审批后，AI 先检查渲染器、图像生成、配音、字幕和音视频检查能力，再自动完成制作。同一 QA 问题最多自动修复并复检两次，一次 QA 运行最多三轮；仍失败时记录已尝试的修复和残留风险，缺少可审片成片或关键技术/权利检查失败时不得申请成片批准。AI 不得自行伪造审批。观众代理结论是时间码化的编辑假设，不能替代平台留存数据。

### Publish gate

确认标题、按项目交付规范由 `$imagegen` 分别生成的封面、简介、元数据、平台设置和规范要求数量的不重复且搜索相关的标签。AI 在成片 QA 时生成并于成片关核验这份发布包；`imagegen` 每个比例单独生成，接受的资产存入 production 并在 `publish.md` 记录提示词和生成来源；各版封面共享同一视觉概念，但不得通过简单裁切互相替代。此门仅授权人类发布。实际发布时间、URL 和平台 ID 写入独立的 `publication.json`，不会反向篡改已签名的发布包；只有真实记录和已授权数据出现后，AI 才会自动完成数据分析、复盘、规范同步与归档。

成片关与发布关同时签署 `deliverables.json` 和项目交付规范声明的封面文件 SHA-256，并记录交付规范哈希；规范变更会使审批失效。早期没有机器可读发布 profile 的 v6 项目仍按原来的三版封面和十个标签读取。登记成片时，文件会按内容哈希复制进 production 的 `renders/registered/`，清单只保存 production 相对路径，归档移动后仍能定位并校验。旧版绝对路径清单在归档前按原 SHA-256 核对和转换；迁移记录保留旧、新清单哈希。

## HyperFrames 的位置

HyperFrames 属于实现层：它读取已批准的上下文，把分镜转换成 HTML 场景、确定性时间轴、媒体轨道和可重复渲染。VideoSpec 不复制 HyperFrames 的动画或渲染职责，只负责回答以下问题：

- 为什么做？
- 做什么？
- 用哪些经过确认的素材？
- 谁批准了哪个版本？
- 最终交付文件是否仍然是已审文件？
- 本期产生了哪些以后持续有效的新规则？

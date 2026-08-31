# VideoSpec 设计说明

## 两层架构

VideoSpec 由两个明确分离的层组成：

- AI 技能层：`.agents/skills/videospec-*`，负责理解用户意图、读取上下文、生成和修改制作产物、调用 HyperFrames，并保护人类审批边界。
- 确定性状态层：`videospec/bin/videospec.js`，负责脚手架、状态、哈希、审批记录、交付物登记、规范合并、校验和归档。

用户主要与技能层对话。技能在后台调用状态层，避免要求用户把每个动作翻译成终端命令。

## 模板层

模板是状态层的一部分，但以独立文件维护，避免模板内容散落在 JavaScript 字符串和技能提示词中：

```text
templates/v1..v2/
├── manifest.json
├── project.md
├── specs/
└── production/

schemas/v1..v2/
├── artifacts.json
├── production.schema.json
└── deliverables.schema.json
```

`manifest.json` 是目标路径、源模板和允许变量的清单。模板渲染只支持白名单中的简单 `{{production.*}}` 变量；未知变量或缺值立即失败。

production 的 `templateVersion` 和数据层 `schemaVersion` 分开演进。更新运行时和模板库不会重写已有 production；没有模板版本的历史 production 作为 legacy 内容继续读取。v1 保持不可变，v2 新增面向旁白生成的结构。

### Markdown 结构契约

人类仍以 Markdown 审阅制作计划，但 AI 不能自由设计文档结构。frontmatter、固定标题、标题顺序、字段名和 ID 格式属于机器可检查契约。v1 使用通用场景块；v2 使用可被旁白生成器直接提取的时间标题、API 合成参数、演绎提示和块引用口播：

```markdown
## 00:00–00:05｜开场

- Scene ID: S001
- Purpose: Establish the problem
- Evidence: SRC-001

**合成参数：**

> speech_rate: 10
> loudness_rate: 0
> silence_duration_ms: 200
> post_process_pitch: 0
> section_id: demo-video:S001

**演绎提示：**

> 克制的紧迫感，前三句短促，重读“第一步”，随后回稳。

**口播：**

> 真正送入录音或 TTS 的文字。
```

v2 还提供全局演绎提示和接口级音频配置。逐段 `合成参数` 直接映射到火山引擎单向流式 HTTP 接口的 speech_rate、loudness_rate、silence_duration、post_process.pitch 和 section_id；自然语言演绎意图放在单独的 `演绎提示`，与全局提示合并后进入 `additions.context_texts`。旁白工具应只提取 `口播` 的块引用，并把发音替换后的 TTS 文本与原始口播分别保留。

`videospec lint` 同时检查单文件结构和 script、storyboard、materials 之间的引用。相关 gate 在计算审批资格时会再次执行结构校验，因此 AI 忘记主动 lint 也不能绕过契约。

## 从 OpenSpec 映射到视频制作

| OpenSpec | VideoSpec | 含义 |
|---|---|---|
| Current specs | Production standards | 当前真实有效的栏目、内容、视听与交付规范 |
| Change | Production | 一期视频或一个明确交付物 |
| Proposal | Proposal + creative brief | 为什么做、为谁做、做到什么程度 |
| Behavioral spec | Script + storyboard + acceptance check | 成片中应当出现什么，以及如何判断正确 |
| Design | Materials + production method | 素材来源、权利状态和实现方式 |
| Tasks | Production checklist | 可执行制作与质检清单 |
| Implementation | Shoot / compose / edit / render | 现实拍摄或 HyperFrames 等制作过程 |
| Verification | Review + deliverable hash | 内容、审美、技术和文件一致性确认 |
| Delta sync | Standards sync | 将本期形成的长期规则回写真相源 |
| Archive | Production archive | 保存完整上下文和审计记录 |

## 为什么不是线性阶段机

视频和代码一样会在执行中发现上游问题：素材无法授权、旁白过长、视觉方案不可实现、平台规格变化。VideoSpec 允许随时修改上游产物，但审批绑定内容哈希，因此修改不会悄悄绕过已完成的人类确认。

这形成两种不同的约束：

- 依赖是“上下文是否足够”的提示，允许返回修改。
- 审批是“是否可以承担下一层风险”的明确控制。

## 三道人类审批

### Brief gate

确认目标、受众、范围、核心信息和商业意图。避免 AI 高效制作错误方向。

### Storyboard gate

确认脚本、画面、节奏、素材来源、版权和现实可执行性。避免进入成本较高的拍摄或渲染后再推倒重来。

### Final gate

确认事实、权利、品牌、画面、声音、字幕和交付设置。AI 不得自行伪造这一审批。

## HyperFrames 的位置

HyperFrames 属于实现层：它读取已批准的上下文，把分镜转换成 HTML 场景、确定性时间轴、媒体轨道和可重复渲染。VideoSpec 不复制 HyperFrames 的动画或渲染职责，只负责回答以下问题：

- 为什么做？
- 做什么？
- 用哪些经过确认的素材？
- 谁批准了哪个版本？
- 最终交付文件是否仍然是已审文件？
- 本期产生了哪些以后持续有效的新规则？

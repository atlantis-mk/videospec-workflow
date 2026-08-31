# VideoSpec

VideoSpec 是一套受 [OpenSpec](https://openspec.dev/docs/overview) 启发的、面向 AI 视频制作的规格驱动工作流。主要入口是 Codex/ChatGPT 技能，CLI 是技能在后台调用的确定性状态层，不是日常用户界面。

核心原则：

- `videospec/specs/` 是栏目、品牌和交付标准的长期真相源。
- `<productionRoot>/<id>/` 是一期视频的完整工作单元；新项目默认的 `productionRoot` 为项目根目录下的 `productions/`。
- 策划、脚本、分镜、素材和任务是可迭代的依赖关系，不是僵硬瀑布阶段。
- 简报、分镜/素材、最终成片保留三道人类审批。
- 审批绑定文件 SHA-256；审批后修改文件会自动显示为过期。
- 一期视频产生的长期规则变化，通过 standards delta 回写到主规范。
- 所有 AI 产物由版本化模板生成，并在审批前执行结构校验。

## 直接和 AI 对话

初始化一次后，不需要手工输入 VideoSpec 终端命令。可以直接在 Codex 中使用：

```text
$videospec-explore 帮我梳理一期介绍 AI 视频工作流的选题

$videospec-propose 为这个选题建立一期 60 秒、16:9 的视频方案

$videospec-approve 我批准 pilot 的 brief，审批人是 Atlan

$videospec-apply 按已批准方案制作 pilot，使用 HyperFrames

$videospec-update 把第三幕压缩两秒，并同步修改脚本和分镜

$videospec-verify 检查 pilot 的成片是否符合脚本、分镜和交付规范

$videospec-verify 检查 pilot 的字幕/口播与标签、卡片和画面是否按时间线同步

$videospec-sync 把本期形成的字幕规则同步为长期规范

$videospec-archive 完成并归档 pilot
```

也可以只说自然语言，例如“继续制作当前视频”或“这期下一步是什么”，`$videospec` 会按当前状态路由。Codex 会根据技能描述自动触发；也可以输入 `$` 选择技能，或输入 `/` 从技能命令列表中选择。

VideoSpec 提供以下 AI 技能：

| 技能 | AI 动作 |
|---|---|
| `$videospec` | 检查状态并路由到正确动作 |
| `$videospec-explore` | 在当前对话中确定目标、最终选题与必要资料 |
| `$videospec-propose` | 创建提案、脚本、分镜、素材和任务 |
| `$videospec-approve` | 记录用户明确作出的人类审批 |
| `$videospec-apply` | 调用 HyperFrames 等制作工具执行方案 |
| `$videospec-update` | 修改产物并传播影响，自动暴露过期审批 |
| `$videospec-verify` | 检查画面、声音、事实、素材和交付 |
| `$videospec-sync` | 合并长期制作规范增量 |
| `$videospec-archive` | 校验并归档已完成制作 |

## 工作流

```text
探索
  ↓
proposal → brief → script → storyboard + materials → tasks
             │                    │                    │
          人工审批 1           人工审批 2          AI/人工制作
                                                       ↓
                                              render → review
                                                       ↓
                                                   人工审批 3
                                                       ↓
                                      sync standards → archive
```

人工审批是发布控制；其余依赖用于告诉 AI 当前有哪些可靠上下文，并不禁止返回上游修改。

## 安装与初始化

需要 Node.js 20 或以上版本，没有运行时依赖。

```bash
npm install -g videospec-workflow@latest
videospec init
```

也可以不进行全局安装，直接运行：

```bash
npx videospec-workflow@latest init
```

`videospec init` 会把 9 个技能安装到项目的 `.agents/skills/`，并把自包含运行时放到 `videospec/bin/`。此后回到聊天界面使用 `$videospec-propose` 等技能即可。

## 字幕与视觉时序自检

从 `0.4.2` 起，新项目的视觉规范要求：当使用带时间码的字幕或口播对照时，相关效果、标签、卡片、示意图和素材画面必须在分镜中对应到字幕或口播片段；它们只能在对应内容开始后出现，且不得延续到会造成误导的无关内容中。

使用时，在分镜的 `Visual composition` 中写清元素对应的口播/字幕和出现时间；渲染后直接让 Agent 执行：

```text
$videospec-verify 检查 <production-id> 的字幕/口播与效果、标签、卡片和画面是否按时间线同步；把检查结果和修复项写入 review.md
```

Agent 会自行比对最终渲染时间线，检查每个相关视觉元素的映射、起始时间和结束时机，并将结果记录到 `review.md` 的 `Automated checks` 或 `Findings and resolutions`。发现错位时，先用 `$videospec-update` 修正脚本或分镜并重新渲染，再运行一次验证；这一项不会由 Agent 代替任何人类审批。

已初始化的旧项目先升级并刷新 Agent 层：

```bash
npm install -g videospec-workflow@latest
videospec update
```

若要把这条规则写进旧项目的长期真相源，在某期 production 的 `specs/visual.md` 加入对应的 `ADDED Standard`，然后执行 `$videospec-sync`。`videospec update` 不会改写既有项目已维护的长期规范。

升级全局包后，在每个已经初始化的项目中刷新技能和内嵌运行时：

```bash
npm install -g videospec-workflow@latest
videospec update
videospec doctor
```

## 外置 production 目录

新项目会在 `videospec/config.json` 写入以下配置，因此每期 production 和归档都位于项目根目录的 `productions/`：

```json
{
  "productionRoot": "productions"
}
```

`productionRoot` 必须是项目根目录内的相对路径，不能使用绝对路径或 `..` 跳出项目。创建、列表、状态、交付、同步和归档命令都会自动读取该配置；归档目录是 `<productionRoot>/archive/`。

旧项目升级后，`videospec update` 会自动把 `videospec/productions/` **复制**到项目根目录的 `productions/`，并写入 `"productionRoot": "productions"`；之后所有命令只使用新目录。原目录会保留为备份，不会自动删除。请在没有运行中的制作任务时升级，确认新目录可用后再自行处理旧备份。

`videospec init` 会生成：

```text
productions/
├── <production-id>/
│   ├── production.json
│   ├── proposal.md
│   ├── brief.md
│   ├── script.md
│   ├── storyboard.md
│   ├── materials.md
│   ├── tasks.md
│   ├── review.md
│   ├── deliverables.json
│   ├── specs/
│   └── renders/
└── archive/

videospec/
├── AGENTS.md
├── config.json
├── project.md
├── templates/v1..v2/         # 随内嵌运行时安装的版本化模板
├── schemas/v1..v2/           # Markdown 结构规则与 JSON Schema
├── specs/
│   ├── content/spec.md
│   ├── creative/spec.md
│   ├── visual/spec.md
│   ├── audio/spec.md
│   └── delivery/spec.md

.agents/skills/
├── videospec/
├── videospec-explore/
├── videospec-propose/
├── videospec-approve/
├── videospec-apply/
├── videospec-update/
├── videospec-verify/
├── videospec-sync/
└── videospec-archive/
```

## CLI 是内部执行层

以下命令主要供技能、CI 和调试使用；正常制作时由 AI 自动执行：

```bash
# 查看当前状态和建议动作
videospec status ai-video-workflow
videospec next ai-video-workflow

# 人工确认简报
videospec approve ai-video-workflow brief --by "制作人姓名"

# 人工确认脚本、分镜和素材方案
videospec approve ai-video-workflow storyboard --by "导演姓名"

# 注册 HyperFrames 或其他工具生成的成片
videospec deliver ai-video-workflow ./output/final.mp4 --label master-16x9

# 人工完成 review.md 后批准最终版本
videospec approve ai-video-workflow final --by "主编姓名"

# 校验并归档
videospec validate ai-video-workflow
videospec sync ai-video-workflow
videospec archive ai-video-workflow
```

所有查询命令都支持适合程序消费的 JSON 输出：

```bash
videospec status ai-video-workflow --json
videospec next ai-video-workflow --json
videospec validate ai-video-workflow --json
```

## 版本化模板与格式校验

新 production 会记录独立的 `templateVersion`。Markdown frontmatter、固定标题、标题顺序和字段名都属于模板契约；脚本、分镜和素材使用可重复的固定块，并通过 `S001`、`MAT-001` 等 ID 关联。v1 保留用于复现旧 production，v2 是当前默认模板。

### 可直接提取的旁白格式

v2 的脚本把 TTS 输入和视觉说明明确分开：

```markdown
## TTS configuration

**接口与音频参数：**

> endpoint: /api/v3/tts/unidirectional
> resource_id: seed-tts-2.0
> speaker: zh_male_example_bigtts
> format: mp3
> sample_rate: 24000
> bit_rate: 128000
> enable_subtitle: true
> explicit_language: zh-cn
> disable_markdown_filter: false
> max_length_to_filter_parenthesis: 0
> aigc_watermark: false

## 00:00–00:08｜开场提出问题

- Scene ID: S001
- Purpose: 建立问题
- Evidence: None

**合成参数：**

> speech_rate: 10
> loudness_rate: 0
> silence_duration_ms: 200
> post_process_pitch: 0
> section_id: demo-video:S001

**演绎提示：**

> 直接、有一点紧迫感但不制造焦虑；前三句短促，重读“上手门槛”。

**口播：**

> 这里仅放真正送入录音或 TTS 的文字。
```

文件开头还有 `全局演绎提示`，定义角色、整体语气、发音原则和需要避免的风格。API 参数和自然语言演绎提示保持分离：参数直接映射到火山引擎请求，`全局演绎提示` 与逐段 `演绎提示` 合并后写入 `additions.context_texts`。旁白生成器只提取 `口播` 块中的文字。

参数范围遵循火山引擎单向流式 HTTP 接口：`speech_rate` 和 `loudness_rate` 为 -50–100，`silence_duration_ms` 为 0–30000，`post_process_pitch` 为 -12–12。`context_texts` 仅在 `speaker` 为豆包语音合成模型 2.0 音色时支持；复刻音色指定 `model` 后不支持语音指令。

AI 在创建或修改文件后会自动执行：

```bash
videospec lint ai-video-workflow
```

校验覆盖：

- 模板版本、frontmatter、必需标题和标题顺序；
- 未解析的模板变量和 TODO；
- 场景/素材 ID 的唯一性与连续性；
- 时间码合法性与场景重叠；
- storyboard、materials 对 script 场景的引用；
- 接口/音频配置、逐段合成参数范围、演绎提示和块引用口播；
- 脚本结束时间与目标时长的偏差警告。

结构错误会阻止对应审批。没有 `templateVersion` 的旧 production 继续按 legacy 模式读取，`update` 不会自动改写用户的制作文件。

## 与 HyperFrames 配合

建议把 VideoSpec 当作控制面，把 HyperFrames 当作制作和渲染面：

1. AI 根据 `proposal.md`、`brief.md` 和主规范起草脚本。
2. 人工批准简报。
3. AI 完成 `storyboard.md` 与逐场景 `materials.md`。
4. 人工批准分镜和素材权利方案。
5. HyperFrames 把已批准分镜实现为可定位、可复现的 HTML 时间轴。
6. 完成 lint、check、快照和渲染，把输出注册到 VideoSpec。
7. 人工在 `review.md` 记录审片结果并批准最终版本。
8. 将本期沉淀出的长期规则同步进 `videospec/specs/`，随后归档。

VideoSpec 初始化时安装的技能已包含这套协作约束；`videospec/AGENTS.md` 则为其他支持项目指令的 AI 助手提供兼容说明。

## 长期规范增量

如果某期制作形成了以后都要遵守的标准，在该期 `specs/` 下创建领域文件，例如 `specs/visual.md`：

```markdown
## ADDED Standards

### Standard: Vertical captions use two lines at most

The production SHALL keep vertical-video captions to no more than two lines.

#### Check: Mobile preview

- **WHEN** a 9:16 review render is inspected on a phone-sized viewport
- **THEN** every caption SHALL occupy no more than two lines
```

然后让 AI 使用 `$videospec-sync`。其内部等价操作是：

```bash
videospec sync <production-id>
```

支持 `ADDED`、`MODIFIED`、`REMOVED`；发生名称冲突或修改目标不存在时，工具会停止同步并报告冲突。

## 命令一览

| 命令 | 作用 |
|---|---|
| `init` | 初始化真相源、AI 指令和归档目录 |
| `update` | 保留制作资料并刷新 AI 技能与内嵌运行时 |
| `doctor` | 检查项目、技能、运行时及可选的 HyperFrames 集成 |
| `new` | 新建一期视频工作单元 |
| `list` | 列出活动制作 |
| `status` | 查看产物、审批、交付和规范增量状态 |
| `lint` | 按 production 的模板版本校验文件结构与跨文件引用 |
| `next` | 根据当前状态给出下一步动作 |
| `approve` | 记录带文件哈希的人类审批 |
| `deliver` | 注册成片路径与 SHA-256 |
| `sync` | 合并长期规范增量 |
| `validate` | 校验所有产物、审批、交付物和同步状态 |
| `archive` | 校验通过后归档一期制作 |

## 开发验证

```bash
npm test
npm run check
```

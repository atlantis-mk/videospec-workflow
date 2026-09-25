# VideoSpec

VideoSpec 是一套受 [OpenSpec](https://openspec.dev/docs/overview) 启发的、面向 AI 视频制作的规格驱动工作流。主要入口是 Codex/ChatGPT 技能，CLI 是技能在后台调用的确定性状态层，不是日常用户界面。

核心原则：

- `videospec/specs/` 是栏目、品牌和交付标准的长期真相源。
- `<productionRoot>/<id>/` 是一期视频的完整工作单元；新项目默认的 `productionRoot` 为项目根目录下的 `productions/`。
- 选题、调研、脚本、分镜、素材、制作、发布和复盘是可迭代的依赖关系，不是僵硬瀑布阶段。
- 内容、最终成片、发布包保留三道人类审批；渲染前还须由人明确确认当前可播放预览。AI 不得代替人类发布或伪造平台数据。
- 每次 AI 修改都保存同一期 production 的修改前/后快照；v6 的 `context.md` 保存需内容审批的决策，`activity.md` 保存审批后的时间、制作、QA 与发布包操作，历史永不删除。
- 审批绑定文件 SHA-256；审批后修改文件会自动显示为过期。
- 一期视频产生的长期规则变化，通过 standards delta 回写到主规范。
- 所有 AI 产物由版本化模板生成，并在审批前执行结构校验。

## 直接和 AI 对话

初始化一次后，不需要手工输入 VideoSpec 终端命令。可以直接在 Codex 中使用：

```text
$videospec-explore 帮我梳理一期介绍 AI 视频工作流的选题

$videospec-propose 基于本次对话前面给出的参考稿，提炼内容并建立一期 60 秒、16:9 的视频方案

$videospec-approve 我批准 pilot 的内容包，审批人是 Atlan

$videospec-apply 按已批准方案制作 pilot，使用 HyperFrames

$videospec-update 把第三幕的画面压缩两秒，按已锁口播的实测时长更新预览，重新确认后渲染

$videospec-verify 检查 pilot 的成片是否符合脚本、分镜和交付规范

$videospec-verify 检查 pilot 的字幕/口播与标签、卡片和画面是否按时间线同步

$videospec-sync 把本期形成的字幕规则同步为长期规范

$videospec 完成并归档 pilot
```

也可以只说自然语言，例如“继续制作当前视频”或“这期下一步是什么”，`$videospec` 会按当前状态路由。Codex 会根据技能描述自动触发；也可以输入 `$` 选择技能，或输入 `/` 从技能命令列表中选择。

VideoSpec 提供以下 AI 技能：

| 技能 | AI 动作 |
|---|---|
| `$videospec` | 检查状态并路由到正确动作 |
| `$videospec-explore` | 按需比较角度，确认核心判断与必要资料 |
| `$videospec-propose` | 创建上下文、选题决定、留存地图、调研、脚本与 AI 内容审稿包 |
| `$video-script-review` | 按目标时长独立审查脚本，只诊断问题与修改方向 |
| `$videospec-approve` | 记录内容、成片或发布包的明确人类审批 |
| `$videospec-apply` | 生成分镜、素材、TTS 与可播放预览，确认后才渲染 |
| `$finance-video-production` | 中文财经视频的素材、镜头、字幕和预览验收规范 |
| `$videospec-update` | 带着上下文修改产物，或写入发布数据与复盘结论 |
| `$videospec-verify` | 自动检查字幕、音画、黑帧、节奏、事实、素材和交付 |
| `$videospec-sync` | 合并长期制作规范增量 |

## 工作流

```text
对话 / 参考材料 → brief.md → evidence.md → script.md → 内容审稿 → 人工内容审批
→ 分镜 + 素材 + TTS → 可播放预览 + 渲染前 QA → 人工确认当前预览
→ 渲染 + 成片 QA → 标题 / 三版封面 / 简介 / 标签 / 平台草稿
→ 人工成片审批 → 人工发布审批 → 人工发布
→ 授权数据 + learning.md → 长期规范同步 → 归档
```

三道内容与发布审批以及单独的预览渲染确认都是人为决策点；缺少实际制作所需的外部能力或授权数据，或限定次数后仍有阻塞性 QA 失败时，流程会记录原因并暂停。当前对话中此前已经确认的用户要求、附件、链接、参考稿、讨论结论和后续补充都属于同一期的内容输入；它们会写入 v6 的 `evidence.md`（旧版 production 仍使用原有文件），不会要求用户重复说明。已完成且仍适用的选题探索会直接复用；用户已确定方向或提供受保护脚本时，不再强制生成一组竞争选题。只有其他 production 的工作上下文不会自动带入。只要存在相关对话文本，流程就按文本和讨论生成：用户目标、决策和修正使用 `conversation`，附带稿件或素材使用 `extract`，要求重新表达同一内容使用 `adapt`；不存在“灵感创作”或脱离上下文直接换题的路径。每项实质内容必须保留、改写或明确说明省略理由，并映射到口播或分镜；不允许借“原创”或版权谨慎之名替换成另一个选题。审稿或 QA 发现的可修复问题会自动回到最早受影响的产物，修复后重新审查；同一 QA 问题最多自动修复并复检两次，一次 QA 运行最多三轮，仍失败的原因和风险会留在 `review.md`。若改变已审批内容，则审批自动失效并仅回到对应人工关卡。平台数据仅在已授权且实际可用时读取，AI 不会编造指标、发布事实或来源。每次修改都先保存 `history/V###` 的前态，完成后保存后态；v6 的日常操作差异写入 `activity.md`，内容决策变动才更新已签名的 `context.md` 并使内容审批过期。历史不会覆盖或删除。只有明确同步的可泛化规则会进入长期规范，上一期的工作上下文不会自动带入下一期。

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

`videospec init` 会把 10 个技能安装到项目的 `.agents/skills/`，并把自包含运行时放到 `videospec/bin/`。此后回到聊天界面使用 `$videospec-propose` 等技能即可。

进入制作前，`$videospec-apply` 会确认本期所需的视频渲染器、内置 `$imagegen`、TTS 凭据与 Python 依赖、字幕依赖及音视频检查工具可用。CLI 只检查它能从项目环境观察到的部分；Agent 工具是否可用由技能在当前会话中检查。缺失依赖时记录可恢复的阻塞步骤，不生成替代的虚假产物。

初始化时会要求输入 Volcengine TTS API Key。它仅保存于 `videospec/.secrets/tts.env`（owner-only 权限且由 `.gitignore` 排除），不会写入 production、审查快照、模板或提交记录。生成配音时，AI 使用：

```bash
python3 videospec/scripts/generate_voice.py productions/<production-id>/script.md --dry-run
python3 videospec/scripts/generate_voice.py productions/<production-id>/script.md
```

首次非 dry-run 配音会在 `assets/audio/voice/narration-lock.json` 锁定 `**口播：**` 文字；之后生成器会拒绝任何口播变更。v6 脚本采用一段连续口播，一次请求生成整篇；v2–v5 的分场景口播和场景顺序继续受支持。完整配音会永久保留 `raw/` 音频，对音频做 75 Hz 低切、轻度去齿音、`2.5:1` 人声压缩及 **-1.5 dB** 安全限幅。完整运行会把 v6 实测时长和相对于 production 的音频路径写入 `assets/audio/voice/manifest.json`，不改动已获内容审批的 `script.md`；v2–v5 仍按旧格式校准场景时间码。它不会改写口播。合并后的 `assets/audio/voice/narration.wav` 采用两遍 EBU R128 校准：单声道 **48 kHz / 24-bit PCM WAV**、**-16 LUFS**、**6 LU LRA**、**-1.5 dBTP**。视频制作只能使用该合并文件，不直接使用 `raw/` 下的分段文件。加入 BGM、音效后的最终立体声成片则应混音至 **-14 LUFS**、**-1.0 dBTP**。

## Paraformer 字幕导出与校正

初始化也会安装 `videospec/scripts/export_subtitles.py`。它在本地使用 FunASR Paraformer、VAD 和句级时间戳导出 SRT 与 `.asr.json` 识别记录；不读取 TTS Key。首次使用先安装 Python 依赖：

```bash
python3 -m pip install -U funasr modelscope
python3 videospec/scripts/export_subtitles.py \
  productions/<production-id>/assets/audio/voice/narration.wav \
  --output productions/<production-id>/assets/audio/voice/subtitles/narration.asr.srt
```

模型没有可用的时间戳时，脚本会明确失败而不会伪造字幕时序。对于已锁定的 v6 口播，可以保留原 ASR 时间码，并用脚本文字校正识别差异：

```bash
python3 videospec/scripts/export_subtitles.py \
  --correct-srt productions/<production-id>/assets/audio/voice/subtitles/narration.asr.srt \
  --canonical-script productions/<production-id>/script.md \
  --output productions/<production-id>/assets/audio/voice/subtitles/narration.srt
```

## 字幕与视觉时序自检

从 `0.4.2` 起，新项目的视觉规范要求：当使用带时间码的字幕或口播对照时，相关效果、标签、卡片、示意图和素材画面必须在分镜中对应到字幕或口播片段；它们只能在对应内容开始后出现，且不得延续到会造成误导的无关内容中。

使用时，在分镜的 `Visual composition` 中写清元素对应的口播/字幕和出现时间；渲染后直接让 Agent 执行：

```text
$videospec-verify 检查 <production-id> 的字幕/口播与效果、标签、卡片和画面是否按时间线同步；把检查结果和修复项写入 review.md
```

Agent 会自行比对最终渲染时间线，检查每个相关视觉元素的映射、起始时间和结束时机，并将结果记录到 `review.md` 的 `Automated checks` 或 `Findings and resolutions`。发现错位时，先用 `$videospec-update` 修正分镜并更新预览；再次确认当前预览后重新渲染，再运行验证；这一项不会由 Agent 代替任何人类审批。

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

旧版独立的 `$videospec-archive` 已并入 `$videospec`：直接说“归档当前视频”即可。`videospec update` 会将已安装的旧技能目录移到 `videospec/retired-skills/` 保存，并从可用技能列表移除；CLI 的 `videospec archive` 命令仍可直接使用。

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
│   ├── context.md
│   ├── activity.md
│   ├── brief.md
│   ├── evidence.md
│   ├── script.md
│   ├── content-review.md
│   ├── storyboard.md
│   ├── materials.md
│   ├── tasks.md
│   ├── review.md
│   ├── publish.md
│   ├── publication.json
│   ├── history/
│   │   ├── index.json
│   │   ├── README.md
│   │   ├── V000/
│   │   └── V001.../
│   ├── learning.md
│   ├── deliverables.json
│   ├── specs/
│   └── renders/
└── archive/

videospec/
├── AGENTS.md
├── config.json
├── project.md
├── templates/v1..v6/         # 随内嵌运行时安装的版本化模板
├── schemas/v1..v6/           # Markdown 结构规则与 JSON Schema
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
├── video-script-review/
├── videospec-approve/
├── videospec-apply/
├── videospec-update/
├── videospec-verify/
└── videospec-sync/
```

## CLI 是内部执行层

以下命令主要供技能、CI 和调试使用；正常制作时由 AI 自动执行：

```bash
# 查看当前状态和建议动作
videospec status ai-video-workflow
videospec next ai-video-workflow

# 在 AI 修改前/后留存不可变快照
videospec snapshot ai-video-workflow --note "before: revise opening hook"

# 人工确认选题、调研、脚本与 AI 审稿
videospec approve ai-video-workflow content --by "制作人姓名"

# 当前预览通过检查并由人明确确认后，先核验授权
python3 videospec/scripts/check_render_authorization.py productions/ai-video-workflow

# 注册 HyperFrames 或其他工具生成的成片
videospec deliver ai-video-workflow ./output/final.mp4 --label master-16x9

# 人工完成 review.md 后批准最终成片
videospec approve ai-video-workflow final --by "主编姓名"

# 人工确认标题、封面、简介与发布设置；随后由人完成平台发布
videospec approve ai-video-workflow publish --by "发布负责人"

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

新 production 会记录独立的 `templateVersion`。Markdown frontmatter、固定标题、标题顺序和字段名都属于模板契约；脚本、分镜和素材使用可重复的固定块，并通过 `S001`、`MAT-001` 等 ID 关联。v1–v5 保留用于复现旧 production，v6 是当前默认模板。

v0.8.0 起新建的 v6 production 使用 `artifactContractVersion: 3`：`render-authorization.json` 初始为 `approved: false`。制作方在 `tasks.md` 记录预览 QA，并在授权记录中填入可播放预览地址、通过的 QA、预览使用的本地文件 SHA-256 和由这些哈希计算的版本值。用户明确确认当前预览后才记录确认人和时间；渲染前运行 `check_render_authorization.py`，`videospec deliver` 和最终成片审批也会拒绝缺失或过期的授权。修改画面、时间线、字幕、声音或素材后须重做预览与确认。旧 v6 production 的契约保持兼容。

v6 将选题和留存设计归入 `brief.md`、参考覆盖和调研归入 `evidence.md`，发布后的分析归入 `learning.md`；`script.md` 使用整篇连续口播，由分镜承担场景划分。证据条目映射到留存 beat，beat 以原文短句锚定口播，分镜再映射到 beat、素材映射到分镜场景。v5 在内容审批前增加 `retention-plan.md`：先写角度池与核心判断，再把每个 `B001` 留存 beat 映射至真实脚本场景。每个 beat 都必须说明观众状态、叙事动作、开放问题或 payoff、新价值，以及有叙事理由的视听变化。它不强制剪辑频率；目标是避免“文章朗读式”视频。v5 脚本要求每一幕说明观众状态、叙事动作和推进的 open loop/payoff；分镜要求视觉模式和注意力任务；最终 `review.md` 则额外保留时间码化的 Audience Critic 审片，作为待平台数据验证的编辑假设，不冒充真实留存数据。

### 可直接提取的旁白格式（v2–v5）

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

> speech_rate: 15
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

v6 把合成参数放在整篇口播之前，生成一次主旁白；以下参数范围适用于新旧模板。参数范围遵循火山引擎单向流式 HTTP 接口：`speech_rate` 和 `loudness_rate` 为 -50–100，`silence_duration_ms` 为 0–30000，`post_process_pitch` 为 -12–12。`speech_rate: 15` 是新脚本和缺失参数时的基线；每个场景可按叙事、情绪、信息密度与理解需要上下浮动，不应机械锁定全片。`context_texts` 仅在 `speaker` 为豆包语音合成模型 2.0 音色时支持；复刻音色指定 `model` 后不支持语音指令。

AI 在创建或修改文件后会自动执行：

```bash
videospec lint ai-video-workflow
```

校验覆盖：

- 模板版本、frontmatter、必需标题和标题顺序；
- 未解析的模板变量和 TODO；
- 场景/素材 ID 的唯一性与连续性；
- 时间码合法性与场景重叠；
- retention plan、storyboard、materials 对 script 场景的引用；
- 接口/音频配置、逐段合成参数范围、演绎提示和块引用口播；
- 脚本结束时间与目标时长的偏差警告，以及毫秒级实测配音时间码。

结构错误会阻止对应审批。没有 `templateVersion` 的旧 production 继续按 legacy 模式读取，`update` 不会自动改写用户的制作文件。

## 与 HyperFrames 配合

建议把 VideoSpec 当作控制面，把 HyperFrames 当作制作和渲染面：

1. AI 从当前对话的相关要求与参考材料开始，在 `context.md` 的约束下完成 `brief.md`、`evidence.md`、`script.md` 和 `content-review.md`。AI 会先钢人化最强反方，再做严格脚本审稿；`evidence.md` 记录参考内容覆盖，`brief.md` 记录留存设计。AI 可以重写表达与结构，但不能无说明地丢掉“提炼/按内容制作”所要求的实质内容。
2. 人工批准内容包。
3. AI 先以自媒体导演身份完成 `storyboard.md`、`materials.md`，再制作 TTS 和 HyperFrames 成片；产物注册后在 `review.md` 完成观众代理与技术自动审片。该连续作业同时使用 `$imagegen` 分别生成并检查 16:9 / 4:3 / 3:4 封面，再将接受的文件存入 production 的 `assets/covers/`；随后完成 `publish.md`（标题、封面提示词/生成记录、简介、元数据、10 个不重复且搜索相关的标签），并核验其承诺与成片一致。
4. 人工批准最终成片，同时看到已准备好的发布包。
5. 人工批准发布包后由人发布；发布事实记录在 `publication.json`。
6. AI 将实际数据和下期实验建议写入 `learning.md`，并将明确、可泛化的规则同步进 `videospec/specs/`，随后归档；不会自动复制本期工作上下文。

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

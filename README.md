# VideoSpec

VideoSpec 是一套受 [OpenSpec](https://openspec.dev/docs/overview) 启发的、面向 AI 视频制作的规格驱动工作流。主要入口是 Codex/ChatGPT 技能，CLI 是技能在后台调用的确定性状态层，不是日常用户界面。

核心原则：

- `videospec/specs/` 是栏目、品牌和交付标准的长期真相源。
- `<productionRoot>/<id>/` 是一期视频的完整工作单元；新项目默认的 `productionRoot` 为项目根目录下的 `productions/`。
- 选题、调研、脚本、分镜、素材、制作、发布和复盘是可迭代的依赖关系，不是僵硬瀑布阶段。
- 内容、最终成片、发布包保留三道人类审批；渲染前还须由人明确确认当前可播放预览。AI 不得代替人类发布或伪造平台数据。
- 每次 AI 修改都保存同一期 production 的修改前/后快照；`context.md` 保存需内容审批的决策，`activity.md` 保存审批后的时间、制作、QA 与发布包操作，历史永不删除。
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

三道内容与发布审批以及单独的预览渲染确认都是人为决策点；缺少实际制作所需的外部能力或授权数据，或限定次数后仍有阻塞性 QA 失败时，流程会记录原因并暂停。当前对话中此前已经确认的用户要求、附件、链接、参考稿、讨论结论和后续补充都属于同一期的内容输入；它们会写入 `evidence.md`，不会要求用户重复说明。已完成且仍适用的选题探索会直接复用；用户已确定方向或提供受保护脚本时，不再强制生成一组竞争选题。只有其他 production 的工作上下文不会自动带入。只要存在相关对话文本，流程就按文本和讨论生成：用户目标、决策和修正使用 `conversation`，附带稿件或素材使用 `extract`，要求重新表达同一内容使用 `adapt`；不存在“灵感创作”或脱离上下文直接换题的路径。每项实质内容必须保留、改写或明确说明省略理由，并映射到口播或分镜；不允许借“原创”或版权谨慎之名替换成另一个选题。审稿或 QA 发现的可修复问题会自动回到最早受影响的产物，修复后重新审查；同一 QA 问题最多自动修复并复检两次，一次 QA 运行最多三轮，仍失败的原因和风险会留在 `review.md`。若改变已审批内容，则审批自动失效并仅回到对应人工关卡。平台数据仅在已授权且实际可用时读取，AI 不会编造指标、发布事实或来源。每次修改都先保存 `history/V###` 的前态，完成后保存后态；日常操作差异写入 `activity.md`，内容决策变动才更新已签名的 `context.md` 并使内容审批过期。历史不会覆盖或删除。只有明确同步的可泛化规则会进入长期规范，上一期的工作上下文不会自动带入下一期。

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

`videospec init` 会把 9 个技能安装到项目的 `.agents/skills/`，并把自包含运行时放到 `videospec/bin/`。此后回到聊天界面使用 `$videospec-propose` 等技能即可。`finance-video-production` 是财经工作区自己的技能，不计入通用 VideoSpec 安装；从 0.8.0 升级时，未修改的打包副本会备份到 `videospec/retired-skills/`。

进入制作前，`$videospec-apply` 会确认本期所需的视频渲染器、内置 `$imagegen`、TTS 凭据与 Python 依赖、字幕依赖及音视频检查工具可用。CLI 只检查它能从项目环境观察到的部分；Agent 工具是否可用由技能在当前会话中检查。缺失依赖时记录可恢复的阻塞步骤，不生成替代的虚假产物。

初始化时会要求输入 Volcengine TTS API Key。它仅保存于 `videospec/.secrets/tts.env`（owner-only 权限且由 `.gitignore` 排除），不会写入 production、审查快照、模板或提交记录。生成配音时，AI 使用：

```bash
python3 videospec/scripts/generate_voice.py productions/<production-id>/script.md --dry-run
python3 videospec/scripts/generate_voice.py productions/<production-id>/script.md
```

首次非 dry-run 配音会在 `assets/audio/voice/narration-lock.json` 锁定 `**口播：**` 文字。用户后来明确修改口播时，先记录精确差异并重新通过内容审批，再用 `generate_voice.py <production>/script.md --revise-narration` 重录；旧配音、旧预览确认及交付清单保存在 `assets/audio/voice/revisions/R###/`，旧预览确认与交付登记失效，须重新制作字幕、预览和成片。修订中断后用普通生成命令继续当前版本。脚本采用一段连续口播，一次请求生成整篇。配音脚本从当前项目的 `videospec/specs/audio/spec.md` 读取 `Audio profile`，保留 raw 音频，并按该 profile 生成 `assets/audio/voice/narration.wav`。实测时长、应用的 profile 及规范文件哈希写入 `assets/audio/voice/manifest.json`，不改动已获内容审批的 `script.md`。视频制作使用处理后的旁白主文件；最终混音按同一项目规范检查。发布封面和标签数量以项目的 `videospec/specs/delivery/spec.md` 为准。

## Paraformer 字幕导出与校正

初始化也会安装 `videospec/scripts/export_subtitles.py`。它在本地使用 FunASR Paraformer、VAD 和句级时间戳导出 SRT 与 `.asr.json` 识别记录；不读取 TTS Key。首次使用先安装 Python 依赖：

```bash
python3 -m pip install -U funasr modelscope
python3 videospec/scripts/export_subtitles.py \
  productions/<production-id>/assets/audio/voice/narration.wav \
  --output productions/<production-id>/assets/audio/voice/subtitles/narration.asr.srt
```

模型没有可用的时间戳时，脚本会明确失败而不会伪造字幕时序。对于已锁定的口播，可以保留原 ASR 时间码，并用脚本文字校正识别差异：

```bash
python3 videospec/scripts/export_subtitles.py \
  --correct-srt productions/<production-id>/assets/audio/voice/subtitles/narration.asr.srt \
  --canonical-script productions/<production-id>/script.md \
  --output productions/<production-id>/assets/audio/voice/subtitles/narration.srt
```

## 字幕与视觉时序自检

项目视觉规范要求：当使用带时间码的字幕或口播对照时，相关效果、标签、卡片、示意图和素材画面必须在分镜中对应到字幕、口播或已批准的节拍；通常在对应内容开始后出现，且不得延续到会造成误导的无关内容中。刻意的开场悬念可提前入场，但分镜须说明意图，预览检查须确认没有提前泄露答案或结果。

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

`videospec update` 会把缺失的字幕呈现、字幕音频信息、重要视觉信息的音频可达性、动态背景文字对比度、数据图表的刻度与语境、复杂信息的理解时间、非颜色线索和闪烁安全等通用规范补进旧项目的 `videospec/specs/`，供方案、分镜、生成与验收技能实际读取；同名的项目自定义条款保持原样。其他项目规范仍通过某期 production 的 standards delta 和 `$videospec-sync` 维护。旧 production 的任务和审片模板不会被覆盖，但技能会把适用规范的设计选择和检查结果补记到现有 `storyboard.md`、`tasks.md` 和 `review.md`。

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
├── templates/v6/             # 当前模板
├── schemas/v6/               # Markdown 结构规则与 JSON Schema
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

## 模板与格式校验

新 production 记录 `templateVersion: 6`。Markdown frontmatter、固定标题、标题顺序和字段名都属于模板契约；分镜和素材使用可重复的固定块，并通过 `S001`、`MAT-001` 等 ID 关联。运行时只支持 v6 production。

当前新建的 production 使用 `artifactContractVersion: 3`：`render-authorization.json` 初始为 `approved: false`。制作方在 `tasks.md` 记录预览 QA，并在授权记录中填入可播放预览地址、通过的 QA、预览使用的本地文件 SHA-256 和由这些哈希计算的版本值。用户明确确认当前预览后才记录确认人和时间；渲染前运行 `check_render_authorization.py`，`videospec deliver` 和最终成片审批也会拒绝缺失或过期的授权。修改画面、时间线、字幕、声音或素材后须重做预览与确认。早期 v6 production 的契约仍可读取。

选题和留存设计归入 `brief.md`，参考覆盖和调研归入 `evidence.md`，发布后分析归入 `learning.md`；`script.md` 使用整篇连续口播，由分镜承担场景划分。证据条目映射到留存 beat，beat 以原文短句锚定口播，分镜再映射到 beat、素材映射到分镜场景。

口播使用全局演绎提示、接口与音频参数、整篇合成参数，以及单个块引用的 `**口播：**` 字段。生成器只提取 `口播` 块中的文字。TTS 参数的合法范围由代码校验；项目的音频交付目标以 `videospec/specs/audio/spec.md` 为准。

AI 在创建或修改文件后会自动执行：

```bash
videospec lint ai-video-workflow
```

校验覆盖：

- 模板版本、frontmatter、必需标题和标题顺序；
- 未解析的模板变量和 TODO；
- 场景/素材 ID 的唯一性与连续性；
- 时间码合法性与场景重叠；
- evidence、brief、storyboard、materials 的引用链；
- 接口/音频配置、整篇合成参数范围、演绎提示和块引用口播；
- 分镜时间码合法性与场景重叠。

结构错误会阻止对应审批。旧模板版本的 production 会收到明确的不支持错误；`update` 不会自动改写制作文件。

## 与 HyperFrames 配合

建议把 VideoSpec 当作控制面，把 HyperFrames 当作制作和渲染面：

1. AI 从当前对话的相关要求与参考材料开始，在 `context.md` 的约束下完成 `brief.md`、`evidence.md`、`script.md` 和 `content-review.md`。AI 会先钢人化最强反方，再做严格脚本审稿；`evidence.md` 记录参考内容覆盖，`brief.md` 记录留存设计。AI 可以重写表达与结构，但不能无说明地丢掉“提炼/按内容制作”所要求的实质内容。
2. 人工批准内容包。
3. AI 先以自媒体导演身份完成 `storyboard.md`、`materials.md`，再制作 TTS 和 HyperFrames 成片；产物注册后在 `review.md` 完成观众代理与技术自动审片。该连续作业按项目交付规范使用 `$imagegen` 分别生成并检查封面，再将接受的文件存入规范指定路径；随后完成 `publish.md`（标题、封面提示词/生成记录、简介、元数据、规范要求数量的不重复且搜索相关的标签），并核验其承诺与成片一致。
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

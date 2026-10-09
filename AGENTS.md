# Skill 管理中心 — Agent 交接文档（AGENTS.md）

> 本文件是 Skill 管理中心项目的权威交接文档。任何接手本项目的 agent（WorkBuddy / 豆包 / Claude Code / 其他）**第一步先读本文件**，再读 `CHANGELOG.md`（进度与协作历史 → §13）、`交接说明-Claude-Code.md`（面向新环境的任务书）和 `README-部署指南.md`（backend 部署）。
> 更新日期：2026-10-09（新增 §13 版本管理与协作记录）。初版 2026-10-07。

## 1. 项目目标（一句话）

个人「Skill 技能管理台」：每天 9:00 自动推荐 AI Agent Skill（双档：为你推荐 5 条贴合初中数学教师画像 + 全网热门 5 条），写入飞书 Base「Skill 技能管理台」，同步生成在线 HTML「Skill 管理中心」网页；用户可在网页上浏览技能、提交安装/卸载/感兴趣/不感兴趣/好用/没用等反馈，agent 根据反馈执行本机安装/卸载并回流数据。

## 1.5 运行分工（2026-10-07 用户确认 · 混合模式）

- **Claude Code（本机 Mac）＝代码手术**：大重构、UI 大改、脚本工程化、复杂代码迭代。只在用户发起"改页面/重构/写代码"类请求时启用。
- **豆包 agent（平台侧）＝日常运营**：每日推荐 cron、安装/卸载 skill、sync/发布/在线验证、反馈处理、内容创作（动画/封面/可视化）、以及豆包平台所有绑定动作（豆包 cron、doubaoapps 发布、给豆包环境装 skill）。
- **WorkBuddy（贾维斯 1 号，本机 Mac）＝大脑/项目经理 + 每日推荐兜底调度**：代码手术外的规划/核查/内容/自动化；**当豆包因额度等问题停跑时，由 WorkBuddy 自动化接管每日 9 点推荐**（见 §8.6）；可与豆包并行跑而不翻车（pipeline 内置 14 天重复抑制，**该去重曾完全失效、已于 ee64018 修复并验证生效**）。
- **边界**：Claude Code 不负责每日推荐、安装卸载、数据闭环（这些在平台侧，它无授权/无环境）；豆包 agent 不做大规模代码重构（交由 Claude Code）。
- **协作点**：Claude Code 改完代码后，产物需回到平台侧发布（迁 CF Pages 或由豆包 agent 代发）；写库动作必须遵循本文件口径。
- **额度**：Claude Code 仅在代码手术时启用，日常零消耗。

### 1.5.1 每日推荐调度方协调约定（单一调度原则 · 2026-10-09 起）
- **现状（2026-10-09）**：豆包因额度连续两天无法跑每日推荐，已由 **WorkBuddy 自动化 `id=563ac448-23a1-46e1-9548-27a0017c7a95`**（`FREQ=DAILY;BYHOUR=9;BYMINUTE=0`，ACTIVE，cwd=skill-center）接管每日 9 点推荐，命令 `recommend.py all --date <当天>`（带 `HTTPS_PROXY=127.0.0.1:7897` + `dangerouslyDisableSandbox`）。
- **双跑兜底**：即便豆包恢复额度也跑，`recommend.py` 的 `recent_recs(days=14)` 会抑制 14 天内已推技能，不会重复推荐（**去重曾完全失效、已于 ee64018 修复并验证生效**）；发布 `html-publish` 幂等（再发一次只是覆盖上线），安全。
- **长期建议（待老板拍板）**：明确 **单一调度方**，另一方只做「推荐后的 LLM 精修」（如豆包恢复后把 rule 选出的 10 条做个性化文案润色），避免资源浪费与口径冲突。

## 2. 系统架构（数据流）

```
飞书 Base「Skill 技能管理台」(8 表，唯一数据源；sync 用其中 6 张：台账/推荐记录/用法案例/技能反馈/技能打磨记录/技能手册)
   │  lark-cli base +record-list 导出 6 表 JSON 到 /tmp
   ▼
data.json（中间产物，页面数据源）
   │  sync_from_base.py 生成（同时覆写 HTML 内置快照常量）
   ▼
Skill管理中心.html（自包含单页，机架风 UI，含 SKILL_LEDGER/RECOMMEND_RECS/CASE_LEDGER/POLISH_RECORDS/HANDBOOK_MAP/RATING_MAP/INTEREST_MAP 快照）
   │  lark-cli apps +html-publish 发布
   ▼
在线网页 https://s0zel9adg2.doubaoapps.com/app/app_17f88vb743c
   │
   ├─ 用户点击反馈 → CF Worker (https://skill-center-api.ustchfut-b.workers.dev) → POST 写回 Base「技能反馈」表
   └─ 用户要求安装/卸载 → agent 在本机执行 npx skills add/remove + 副本 + tar 备份 → 更新台账
```

## 3. 目录结构

```
skill-center/
├── Skill管理中心.html      # 主页面（唯一待发布文件，发布前 cp 到 /tmp/index.html）
├── data.json               # 页面数据源（ledger/recs/cases/rating/interest/updated）
├── sync_from_base.py       # 同步脚本：读 6 表 JSON（台账/推荐/案例/反馈/打磨/手册）→ 生成 data.json + 覆写 HTML 快照
├── VERSION                 # 项目版本号唯一真源（当前 0.1.0，见 §13）
├── CHANGELOG.md            # 变更日志 + 多 Agent 协作记录（必读，且干完活必写，见 §13）
├── backend/                # CF Worker（worker.js + README-部署指南.md）
├── assets/                 # 案例封面图、echarts.min.js
├── redesign-mock.html      # 机架风 UI 设计参考
├── 验收清单-v2.md / v3.md   # 历史验收口径
├── AGENTS.md               # 本文件
└── 交接说明-Claude-Code.md   # 新环境任务书
```

配套目录（在 skill-center 之外）：
- 安装备份 tar（含日期）目录：原 Linux 工作区为 `/home/user/Doubao/chats/38444168961292802/skills-backup/`；**新机器 / Mac 上请替换为实际仓库位置**（如 `~/skill-center/skills-backup/`）。脚本已自动定位自身目录，无需固定 cd 到该路径。
- `~/.claude/skills/`：npx skills 实际安装目录
- `~/.doubao/agent_mode/workspace/.user_skills/`：安装副本（agent 可读的 skill 目录）

## 4. 关键 ID 与表结构（写库前必读）

- **base_token**：`VRA1bfbiaaiUjRsK0ekcwAdsnHd`（Base 名「Skill 技能管理台」）
- **技能台账** `tblnkqaoYXg7j0dj`
- **推荐记录** `tblMWvCyEcrhxbyu`
- **用法案例** `tblgLIx9pFpojjW1`
- **技能反馈** `tblLQqY1V17uA6Ql`
- **技能打磨记录（Skill Lab）** `tblfWDIjED46UGFx`
- **技能手册（L2 使用手册）** `tblifZ7KdXaj7GbZ`

### 技能台账字段（select 选项边界——写入选值只能用已有项）
| 字段 | 字段ID | 选项（只允许这些值） |
|---|---|---|
| 技能名称 | fldCyEb5hS | text（英文注册名，如 security-audit） |
| 中文名 | fldvtpmanW | text |
| 安装状态 | fldADNj9x2 | 已安装 / 被环境清除 / 未安装 |
| 备份状态 | fld5MwRsRp | 已备份 / 未备份 / 无需备份 |
| 类别 | fldPFd6T0h | 内容创作 / 教学与教研 / 家长沟通 / 效率工具 / AI开发 / 视频制作 / 文档办公 / 官方系统 / 数据分析 / 其他 |
| 对应业务 | fldQN3bMfV | 家长答疑 / 口播视频 / 题目解析 / 内容创作 / 教学备课 / 效率管理（**无「家长沟通」选项，写了报错 800030005，用「家长答疑」**） |
| 功能标签 | fldnNOo20T | 写作润色 / 图片生成 / 视频生成 / 可视化 / 调研检索 / 自动化 / 代码开发 / 教学讲解 / 答疑代写 / 表格处理 |
| 热度(星) | fldO95u1p8 | number |
| 效果评分 | fldaJMu0mY | number |
| 来源 | fldSRaLUeL | text（真实 URL） |
| 备注 | fld1T1ru8q | text |
| 一句话说明 | fldc78TPnY | text |
| 最近试用日期 | fld2nwTlD0 | datetime |
| 用法案例(link) | fldCMgppDF | link → 用法案例表 |
| 推荐记录(link) | fldYygK7Ss | link → 推荐记录表 |

### 推荐记录表字段
| 字段 | 字段ID | 说明/选项 |
|---|---|---|
| 推荐批次 | fldqQI7KxX | text，格式 `YYYY-MM-DD 推荐` |
| 推荐日期 | fldmfulEGW | datetime |
| 推荐类型 | fldIj7yn1l | select：为你推荐 / 全网热门 |
| 关联技能 | fldnimdOxI | link → 台账，传 `[{"id":"rec_xxx"}]` |
| 是否安装 | fldpuYnr79 | select：已安装 / 未安装 / 待定（批量写统一「待定」） |
| 是否试用 | fldQmNx7Kx | select：已试用 / 未试用 |
| 试用效果 | fldaKIBeGT | select：很好 / 一般 / 不适用 / 未试用 |
| 热度指标 | fldhCuSGPN | text（真实 star/安装量字符串） |
| 来源链接 | fldye9EqoQ | text（真实 URL） |
| 推荐理由与帮助 | fldIfkHYD9 | text（一句落地建议） |

### 技能反馈表字段
| 字段 | 字段ID | 说明/选项 |
|---|---|---|
| 技能名称 | fld7oOUUUx | text |
| 反馈类型 | fld5PbdsNN | select：有用 / 没用 / 请求试用 / 评分 / 吐槽 / 感兴趣 / 不感兴趣 |
| 评分 | fldjZimRxa | number |
| 一句话备注 | fldLOU9Znc | text |
| 提交时间 | — | 自动 |

## 5. 核心命令（lark-cli）

```bash
# 读（导出全量，分页用 --limit 200 --offset N，直到 has_more=false）
lark-cli base +record-list --base-token VRA1bfbiaaiUjRsK0ekcwAdsnHd --table-id tblnkqaoYXg7j0dj --as user --format json --limit 200

# 核对表结构
lark-cli base +table-list --base-token VRA1bfbiaaiUjRsK0ekcwAdsnHd --as user
lark-cli base +field-list --base-token VRA1bfbiaaiUjRsK0ekcwAdsnHd --table-id <table_id> --as user

# 写记录（create_records 是扁平字段 map 数组，不要包 fields 层）
lark-cli base +record-batch-create --base-token VRA1bfbiaaiUjRsK0ekcwAdsnHd --table-id tblnkqaoYXg7j0dj --create-records '[{"技能名称":"xxx",...}]' --as user

# 更新记录（成功形态 {"update_records":{rec_id:{字段:["值"]}}}，不带 --yes！）
lark-cli base +record-batch-update --base-token VRA1bfbiaaiUjRsK0ekcwAdsnHd --table-id tblnkqaoYXg7j0dj --update-records '{"rec_xxx":{"安装状态":["已安装"]}}' --as user
```

## 6. 写入口径（血泪教训，必须遵守）

1. `+record-batch-create` 的 `--create-records` 是**扁平字段 map 数组**，**不要包 `fields` 层**。
2. `+record-batch-update` **不带 `--yes`**（带 `--yes` 报 unknown flag）；成功形态是 `{"update_records":{rec_id:{字段:["值"]}}}`。
3. select 单选字段传 `["值"]`；link 字段传 `[{"id":"rec_xxx"}]`。
4. 台账 select 字段只能写**已存在选项**（见 §4），写新值会触发平台新增选项或报错。
5. 推荐批次格式：`YYYY-MM-DD 推荐`（日期用当天）。
6. 热度指标、来源链接**必须是真实搜索结果**，禁止编造 star 数与链接；来源链接给原始 URL。
7. 写后必须回读（`+record-list`）确认记录数 ≥ 写入数，才算完成。

## 7. 安装/卸载约定（本机执行）

```bash
# 安装（本地安装；-g 全局可能失败，如 distilly 报 "does not support global skill installation"）
cd /home/user && npx -y skills add <owner/repo@skill> -a '*' -y

# 卸载
cd /home/user && npx -y skills remove <技能> -g -y
```

- **注册名必须探测**，已知映射：colleague-skill→`titanwings/colleague-skill@distilly`、math-to-manim→`HarleyCoops/Math-To-Manim@hermes-learns-manim`、agent-reach→`panniantong/agent-reach@agent-reach`、HowToLiveBetter→`eternity4719/howtolivebetter@life-decision-guide`、mattpocock-skills→`mattpocock/skills@setup-matt-pocock-skills`、frontend-design→`anthropics/skills@frontend-design`；裸名安装报 repository does not exist 就换 owner/repo@skill。
- deep 仓库（如 HKUDS/DeepTutor）npx 超时：`git clone --depth 1` + 手动落位 SKILL.md。
- 安装后：`cp -rL ~/.claude/skills/<name>/ ~/.doubao/agent_mode/workspace/.user_skills/`，并 `tar` 备份到 `skills-backup/`（文件名含日期）。
- 卸载后：同步删除 `.user_skills/` 下的副本。
- 安装后更新台账：安装状态=已安装、备份状态=已备份、备注=`YYYY-MM-DD 安装（注册名）`；卸载反之。

## 8. 发布与验证链路

```bash
cd <skill-center 仓库根目录>      # 脚本会自动定位自身目录，无需写死固定路径
python3 sync_from_base.py                      # 需先导出 4 表 JSON 到 /tmp 再运行
cp Skill管理中心.html /tmp/index.html
lark-cli apps +html-publish --path /tmp/index.html --app-id app_17f88vb743c --as user --format json
# 取返回 release_id，轮询直到 status=finished：
lark-cli apps +release-get --app-id app_17f88vb743c --release-id <id> --as user
# 在线验证：用 node Playwright 启动**本机已装的 Google Chrome** 截图核对页面（route abort fonts.*/gstatic/googleapis 省流量，避免外网字体阻塞）
#   - 复用系统 Chrome：verify_publish.mjs 用 `executablePath` 指向 /Applications/Google Chrome.app，无需下载 Playwright 自带 chromium（国外 CDN 龟速）
#   - 运行：node verify_publish.mjs [在线URL 或 本地HTML绝对路径]（playwright 装在隔离 node workspace，脚本内用 createRequire 显式加载）
```

在线页：https://s0zel9adg2.doubaoapps.com/app/app_17f88vb743c

## 8.5 recommend.py 每日推荐管道（自动化入口）

```bash
python3 recommend.py fetch    --date YYYY-MM-DD            # 抓取候选（GitHub Trending + GitHub Search API 稳定源 + 台账未安装兜底 + 经典兜底）→ /tmp/rec_candidates.json
python3 recommend.py select   --date YYYY-MM-DD --dry-run  # 规则打分（profile.json 画像）→ /tmp/rec_plan.json（为你推荐5+全网热门5）
python3 recommend.py write    --date YYYY-MM-DD --dry-run  # 写 Base：台账补录 + 推荐记录 + link + 回读确认
python3 recommend.py publish  --date YYYY-MM-DD --dry-run  # 导出6表 → sync_from_base.py → html-publish → 轮询 → 在线验证
python3 recommend.py all      --date YYYY-MM-DD            # fetch→select→write→publish 一条链
```

- `--dry-run` 不写库、不发布，只打印计划；去掉即真实执行。
- 画像关键词在 `profile.json`（初中数学教师：数学/教学/口播/家长/视频/写作/可视化等加权）。
- 热度数据全部来自 GitHub Trending 页面抓取 + GitHub API 实时 star，**禁止改脚本编数字**。
- write/publish 需要 lark-cli 已授权；fetch/select 不需要。
- 规则推荐是自动化兜底；追求更高质量时可在 select 后人工/LLM 复核 plan.json 再 write。
- ⚠️ **发布失败只重跑 `publish`**：若 `publish` 的 sync 崩溃（如漏表），**只重跑 `publish`**，切勿重跑 `all`。
  - 历史上（ee64018 之前）"勿重跑 all"的真正原因：当时 `recent_recs` 14 天去重**完全失效**（推荐记录表无「技能名称」字段，原逻辑读不存在的字段→去重空集），重跑 all 会**原样再写一遍同一批 10 条 → 制造精确重复推荐**（老板 2026-10-09 投诉"今日推荐全是推过的"即此因）。
  - 现在去重已修复（ee64018）：同天重跑 all 会被去重压掉当天已推的 10 条、再写出另一批，造成当天推荐被替换/混乱，仍应避免。结论不变：**sync 崩只重跑 `publish`，不重跑 `all`**。
  - 另：`all` 整条链若超过自动化超时线会被 SIGTERM 杀掉（输出全空、库里 0 条）；`fetch_trending` 已做快失败、`publish` 轮询已缩短，正常可在线内跑完。

## 8.6 每日推荐自动化（WorkBuddy 接管，替代豆包 9 点 cron）

- 豆包因额度停跑时，由 **WorkBuddy 自动化**接管每日 9:00 推荐：
  - `id=563ac448-23a1-46e1-9548-27a0017c7a95`，名称「Skill中心每日推荐接管（原豆包调度）」，`FREQ=DAILY;BYHOUR=9;BYMINUTE=0`，状态 ACTIVE，cwd=skill-center
  - 触发命令：`HTTPS_PROXY=127.0.0.1:7897 HTTP_PROXY=127.0.0.1:7897 python3 recommend.py all --date <当天>`（需 `dangerouslyDisableSandbox`：沙箱默认代理不代理飞书/GitHub，且 lark-cli 写库需联网）
- 双跑安全：`recommend.py` 内置 **14 天重复抑制**（`recent_recs(days=14)`，**曾完全失效、已于 ee64018 修复并验证生效**），即便豆包恢复额度也并行跑，同一技能 14 天内不重复推荐；`html-publish` 幂等。
- 协调约定见 §1.5.1（长期建议明确单一调度方 + 另一方做 LLM 精修）。

## 9. 已知问题与坑（必读，别再踩）

- 台账「对应业务」无「家长沟通」选项 → 用「家长答疑」。
- `+record-batch-update --yes` 是未知 flag。（旧记录「node playwright 不可用」已过时：现用 node playwright + 本机 Google Chrome，见 §8）
- GitHub REST API 匿名限流（45.78.x rate limit exceeded）→ 用 skills CLI / raw.githubusercontent 取数据。
- 页面请求 data.json 返回 404 属旧问题：页面实际数据源是 HTML 内置快照（sync 覆写），不是线上 data.json。
- 禁 BootCDN；renderer 最外层必须 `<html style="margin:0;padding:0;">`。
- 🔴 **【已修复·ee64018】推荐去重曾完全失效（项目级历史 bug）**：推荐记录表无「技能名称」字段（技能经「关联技能」链接到台账 rec_id），原 `recent_recs()` 读不存在的字段→去重空集→14 天重复抑制自项目诞生起从未生效，每天可自由重复推老技能。**老板 2026-10-09 投诉"今日推荐全是推过的"即此因**。修复：`ledger_id_to_name()` 解析关联链接 id→技能名，去重现真正生效（实测抑制 62 个近期技能、新选 10 条零混入）。此后"14 天去重兜底"才名副其实。
- 🟡 **候选池脆弱性（已加固·ee64018）**：GitHub Trending HTML 经代理常 502/超时，`fetch` 已加 `api.github.com/search/repositories` 稳定源 + 台账未安装兜底（`ledger_candidates()`），即便 Trending 全挂也能凑 ~49 候选、稳定产出双档 10 条，杜绝开天窗。
- 反馈双状态 bug 已修复：评价（好用/没用）与意向（感兴趣/不感兴趣）分组锁，fetch 超时 + 乐观更新；「已提交，等待同步」只在 data.json 同步时间晚于点击后才清除。
- 意向语义（已定稿）：未安装+感兴趣→进资产待装；未安装+不感兴趣→排除；已安装+不感兴趣→标记待卸载（可点取消待卸载，按钮文案「卸载」）；「恢复」是行内小按钮不进 kebab 菜单；评价仅已装技能在抽屉内可点、不改安装状态；卡片不显示独立意向标签（用户要"页面清爽"）。
- UI 已定稿：机架风（深色机架状态条+LED、IBM Plex、钴蓝主操作/信号红卸载/琥珀待定）；侧边固定导航+右侧滚动；kebab 菜单规格（宽 168px、白底、圆角 10px、无边框菜单项、危险项红字、Esc/外点关闭）；末行菜单向上弹出防遮挡；抽屉打开锁滚动。

## 10. 环境差异（Linux 工作区 → 新机器/Claude Code 本机）

- 脚本已改为**自动定位自身所在目录**（`sync_from_base.py` / `recommend.py` / `check_snapshots.js` / `cases-1010/gen_15cases.py` 均用 `__file__`/`__dirname`，跨平台）；原项目曾固定在 Linux 工作区 `/home/user/Doubao/chats/38444168961292802/skill-center/`，现不再依赖该路径。Claude Code 在本机（Mac）终端运行。
- 新环境需要：`node + npm`（npx skills）、`python3`、本机已装 Google Chrome（playwright 验证复用它，无需单独装 chromium）、`lark-cli`（**必须重新 OAuth 授权一次**，user 身份，飞书个人版 tenant）、Claude Code 本体（npm i -g @anthropic-ai/claude-code 或 brew 安装，在项目目录运行 `claude`）。
- 豆包 cron（每日推荐调度）在豆包平台，Claude Code 无法管理；**调度外置已落地**：WorkBuddy 自动化（见 §8.6）每日 9 点跑 `recommend.py all` 接管推荐，豆包额度恢复后双跑有 14 天去重兜底（见 §1.5.1，**去重曾失效、已于 ee64018 修复**）。
- 在线验证截图、发布链路在 Mac 上同样适用（装好 lark-cli + OAuth 后）。

## 11. 已完成状态（截至 2026-10-07）

- 台账 51 条、推荐记录 49 条、用法案例 8 条（全带封面）、技能反馈 50 条；data.json updated 2026-10-07 09:42。
- 2026-10-07 已执行：每日双档推荐 10 条写入并发布（release 7693726211328084928 finished）；轮询安装 5 个（distilly / hermes-learns-manim / agent-reach / deeptutor / self-improving-agent）+ 卸载 1 个（security-audit），台账已更新（release 7693734314894674923 finished）。
- 案例体验化：详情抽屉「它能干什么·示范案例」区块 + 8/8 案例封面完成。
- 反馈/意向/评价闭环：CF Worker POST /feedback、/action、/auth；页面按钮全部直写 Base。

## 12. 下一步（待办，按用户确认推进）

1. 【阶段A已完成】调度外置：GitHub Actions workflow `daily-recommend-fetch.yml` 已上线并实测通过（每天 UTC 1:00=北京 9:00 抓 GitHub Trending 候选 → `data/candidates/YYYY-MM-DD.json` 自动 commit，2026-10-07 已验证 run 37644120914 success）。**豆包 cron 暂不撤销**（双轨：Actions 抓候选入仓库，豆包仍跑完整推荐；阶段 B 再让豆包 cron 消费仓库候选）。阶段 B：CF Worker 扩展为飞书代理（写库+发布外置，需用户面板配合更新 Worker 代码）。
2. 【可选】前端迁 Cloudflare Pages（HTML+data.json 静态托管，可绑域名；doubaoapps 发布退役）。
3. 【已立项未推进】推荐系统反馈优化：用户动作（好用/没用/感兴趣/不感兴趣）回流 → 调整推荐权重（阶段一方案已提出，未交付）。
4. 装机清单核对：新环境 node/python/chromium/lark-cli OAuth 是否就位。
5. 每日推荐任务持续运行：豆包因额度停跑期间由 **WorkBuddy 自动化接管**（§8.6）；豆包恢复后双跑，14 天去重兜底不重复推荐（§1.5.1，**去重曾失效、已于 ee64018 修复**）。

## 13. 版本管理与协作记录（2026-10-09 起）

### 13.1 版本号的唯一真源
- 根目录 **`VERSION`** 文件，内容为纯版本号（如 `0.1.0`）。**查当前版本一律读它**，不要从代码注释里猜。
- 与之对应的 Git tag 形如 **`v0.1.0`**（`VERSION` 内容加前缀 `v`）。

### 13.2 版本策略（语义化版本 semver 2.0.0）
格式：`主版本.次版本.修订号`

- **当前处于 `0.x` 阶段**：项目早期，目录结构 / 数据管道 / 接口均可能变动，**不保证向后兼容**
- **修订号**（第三位）：数据同步、文档更新、小修小补
- **次版本**（第二位）：新增能力、结构性改动
- **`1.0.0` 门槛**：对外提供稳定契约且长期不再变动时方可升级，**由用户拍板**，agent 不得擅自升主版本

### 13.3 协作记录铁律（所有 Agent 必读必守）
本项目由多 Agent 协同维护（角色分工见 §1.5），进度必须对所有人透明：

1. 完成任何任务后**必须**更新 **`CHANGELOG.md`** 的 `[Unreleased]` 段，写清：**做了什么 / 动了哪些文件 / 有无后续待办**
2. 发布时由发布方把 `[Unreleased]` 收敛为新版本段落、同步递增 `VERSION`、提交后**打同名 tag（`v<VERSION>`）并推送**
3. **禁止**不记录就提交；**禁止**篡改他人已写入的历史条目（有误就在下方追加更正说明）
4. 完整格式与协作历史见 `CHANGELOG.md` 顶部「协作记录规则」

### 13.4 Worker 组件版本 ≠ 项目版本
`backend/worker.js` 注释中的版本号（如 `v2.1.0`）是 **CF Worker 组件的独立版本**，与本项目整体版本号（读 `VERSION`）**互不相干**，勿交叉引用。

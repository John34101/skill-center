# 交接说明 — 给 Claude Code 的任务书

> 你好，Claude Code。你是「Skill 管理中心」项目的新任维护者。这份文件是给你的第一封任务书，**先读它，再读同目录 `AGENTS.md`（完整口径）**。

## 你是谁，在维护什么

一个个人「Skill 技能管理台」系统：每天自动推荐 AI Agent Skill（双档：为你推荐 5 条贴合初中数学教师 + 全网热门 5 条），数据存在飞书多维表格「Skill 技能管理台」，通过本项目的 `sync_from_base.py` 同步成 `data.json` 并覆写 `Skill管理中心.html` 的内置数据快照，再发布成在线网页。用户浏览网页、提交安装/卸载/感兴趣/不感兴趣/好用/没用反馈，你负责执行安装/卸载并让数据闭环。

## 启动方式

1. 在本机终端进入本项目文件夹（`skill-center/`），运行 `claude` 启动会话。
2. 完整读取 `AGENTS.md`——里面是全部表结构、字段 ID、选项边界、命令、写入口径、坑清单。**它比任何聊天记忆都权威**。
3. 按下面「环境预置」确认工具就位后，即可开始。

## 环境预置（本机 Mac，第一次必须先做）

- `node + npm`（npx 装 skill 用）
- `python3`（跑 sync 脚本、在线验证）
- `chromium`（playwright 在线验证用；node playwright 不可用，用 python playwright）
- `lark-cli`：**必须重新 OAuth 授权一次**（user 身份，飞书个人版租户），授权后才能读写 Base 和发布
- CF Worker 已在线（https://skill-center-api.ustchfut-b.workers.dev），无需重部署
- 日常维护命令可直接参考 AGENTS.md §5/§7/§8；推荐管道用 §8.5 的 `recommend.py`（--dry-run 可试跑）

## 当前状态（截至 2026-10-07）

- 台账 51 条、推荐记录 49 条、用法案例 8 条（全带封面）、技能反馈 50 条
- 最近一次数据同步：2026-10-07 09:42；在线网页已发布（release finished）
- 最近一次安装：5 装 1 卸（distilly / hermes-learns-manim / agent-reach / deeptutor / self-improving-agent 安装，security-audit 卸载）

## 你的职责

| 事项 | 做法 |
|---|---|
| 每日推荐 | 已抽成 `recommend.py`（fetch/select/write/publish 四段，用法见 AGENTS.md §8.5）；豆包 cron 现役中，你可维护脚本，后续迁 GitHub Actions 即全自动 |
| 安装/卸载 | 用户一句话 → 你按 AGENTS.md §7 执行（注册名探测、副本、tar 备份、台账更新） |
| 数据同步/发布/验证 | `sync_from_base.py` → `lark-cli apps +html-publish` → `+release-get` 轮询 → playwright 验证 |
| 页面/脚本迭代 | 直接改 `Skill管理中心.html` / sync 脚本，改完按 §8 链路发布 |

## 工作原则（必须遵守）

1. **热度数据必须真实**：star 数/安装量/来源链接来自真实搜索结果，禁止编造；找不到就标注"未取得可靠数据"。
2. **写后回读**：任何 Base 写入后必须 `+record-list` 回读确认，才算完成。
3. **只改点名范围**：用户没要求的不动；select 字段只写已存在选项（见 AGENTS.md §4）。
4. **反馈语义已定稿**（别按直觉改）：未安装+感兴趣→待装；未安装+不感兴趣→排除；已安装+不感兴趣→待卸载（可取消）；「恢复」是行内小按钮；好用/没用只影响推荐算法不改安装状态。
5. **先问后做**：涉及改表单选项、删除数据、迁移调度这类结构性动作，先向用户确认。

## 接下来要做的事（待办，等用户拍板）

1. 【已就绪】`recommend.py` 已抽出（fetch/select/write/publish，--dry-run 可试跑）；配 GitHub Actions cron 即完成调度迁移
2. 【可选】前端迁 Cloudflare Pages
3. 【已立项】推荐算法反馈优化（用户反馈回流调整权重）
4. 新环境装机核对（上面「环境预置」逐项验证）

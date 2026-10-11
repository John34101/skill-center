# 云端运行说明（把每日推荐搬离本机）

目标：让每日推荐**不再依赖你的电脑开机**。

## 现状：代码已云就绪

整条管道 `fetch → select → write → publish` 里，**已经没有绑本机的代码**：

| 环节 | 依赖 | 云端表现 |
|---|---|---|
| `BASE` 路径 | `__file__` 自动定位 | ✅ 任意环境可跑 |
| 代理 | 靠环境变量（`urllib` 自动读 `HTTPS_PROXY`） | ✅ 云端不设代理即直连 |
| 抓取 | GitHub（Trending / Search API） | ✅ 云端可直连 |
| 写飞书 / 发布 | `lark-cli`（`--as user`） | ⚠️ **唯一待落地项**，见下 |
| 发布后验证 | 本机 Chrome（`verify_publish.mjs`） | ✅ 已提供免 Chrome 的 `cloud/verify_online.sh` |

新增的两个脚本：
- `cloud/run_daily.sh`：云端入口，跑机械管道 + 无浏览器验证（不设代理）。
- `cloud/verify_online.sh`：curl 抓在线页，核对 `DATA_UPDATED` 与当日条数。
- `cloud/cloud-task-prompt.md`：粘到「云上模式·定时任务」里的完整提示词。

## 唯一待落地项：lark-cli 的 user 授权

发布网页（`apps +html-publish`）**只支持 user 身份**，而 WorkBuddy 云上模式的沙箱是**一次性**的（跑完释放，不含本机凭证）。所以要在云端把授权"带上"，可选：

1. **首次在云沙箱内授权一次**：跑 `lark-cli config init` + `lark-cli auth login`（设备码，你扫一次码），把生成的凭证目录保存到**项目资产**；之后每次任务开头先把它恢复到沙箱、结束时把续期后的写回。
2. 需要确认的细节：云沙箱里 lark-cli 的**凭证目录路径**（Linux 与 macOS 不同）、以及凭证能否经环境变量重定向到项目资产目录。

> ⚠️ 这一项**尚未在真云端实测**，是迁移的最后一块拼图。

## 两种云

| | 云上模式（免费/积分） | 云上龙虾（付费） |
|---|---|---|
| 花钱 | 否（消耗积分） | 是（腾讯云 Lighthouse） |
| 持久化 | 项目资料库（5GB） | 服务器本地盘 |
| 落地难度 | 中（需解决凭证持久化） | 低（有持久盘，凭证可常驻） |

## 第 0 步：先做「探针任务」摸清沙箱（强烈建议）

正式搭之前，先在**云上模式**里发一个一次性任务（不是定时任务），把下面提示词整段粘贴运行，看真实输出。这一步决定后面怎么走，务必先做。

```
请在这台云端沙箱里做一次环境速查，逐条回答，贴出真实输出，不要省略：
1. 系统：uname -a
2. Python：python3 --version
3. git：git --version
4. node/npm：node -v ; npm -v
5. curl：curl --version | head -1
6. HOME 与当前目录：echo $HOME ; pwd
7. 联网与克隆：git clone --depth 1 https://github.com/John34101/skill-center.git /tmp/sc && ls /tmp/sc | head
8. lark-cli：which lark-cli || echo "lark-cli 不存在"
9. 你当前可用哪些连接器/技能？特别是有没有飞书（lark / 多维表格）相关的？
10. /tmp 可写吗？
```

看结果决定路线：
- 若 **lark-cli 存在** → 走「首次授权」把凭证落到项目资产。
- 若 **lark-cli 不存在、但有飞书连接器** → 考虑改用连接器写飞书库（需改造 `recommend.py` 的 write/publish）。
- 若 **网络受限** → 改用项目资产上传仓库压缩包。

## 启用步骤（云上模式）

1. 建/进入「Skill 管理中心」**项目**；把本仓库放入**项目资产**（或允许任务直接 clone）。
2. 在项目里配好可用连接器（飞书）；确认能与任务环境互通。
3. 走一次「首次授权」把 lark-cli 凭证落到项目资产（见上）。
4. 新建**云上模式·定时任务**（每天 9:00），提示词粘贴 `cloud/cloud-task-prompt.md` 正文。
5. 先**手动触发一次**验证全链路，再正式启用；同时**停用**本机桌面自动化（避免双跑）。

## 回退

本机桌面自动化保持不动，随时可切回；两套并发有 14 天去重兜底（见 AGENTS.md §8.6），但仍建议只保留一套调度。

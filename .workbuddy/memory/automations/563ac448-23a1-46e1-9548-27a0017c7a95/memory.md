# 自动化执行记忆 — Skill中心每日推荐接管（id 563ac448-23a1-46e1-9548-27a0017c7a95）

> 仅记高层执行要点，便于历次运行对齐。完整正文见 CHANGELOG.md。

## 运行要点（固定流程）
1. cwd = `/Users/zhaobin/WorkBuddy/2026-10-08-23-29-12/skill-center`
2. 跑管道：`HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 python3 recommend.py all --date <当天>`，**必须放开沙箱**（lark-cli 写库 + GitHub 抓取）。
3. 内容精修（关键，对齐豆包卡片水准）：为当天新增技能补 中文名 / 台账一句话说明 / 手册表条目；当天推荐记录「推荐理由与帮助」改正确中文。文案须基于 GitHub README 真实功能（代理抓 raw.githubusercontent.com）。
4. 写完用 `+record-batch-update`（`--json '{"update_records":{...}}'`，**文本字段传纯字符串、select 传数组**）批量写回，`+record-batch-create`（`--json '{"create_records":[...]}'`）建手册/推荐记录；核验一律 `+record-get`（`+record-list` 有缓存延迟会假报未写入）。
5. **只重跑 `publish`（`recommend.py publish --date <当天>`），绝不重跑 `all`**（会把当天已推压掉/重写）。
6. 验证：`NODE_PATH=/Users/zhaobin/.workbuddy/binaries/node/workspace/node_modules node verify_publish.mjs <线上URL>`（复用本机 Google Chrome），看截图卡片是否有中文标题+说明+场景+怎么用。
7. 收尾：更新 CHANGELOG.md [Unreleased] → commit → push（GitHub 需 127.0.0.1:7897 代理）→ 写本记忆 + 工作区日志。

## 关键坑（血泪）
- **台账补录后回读缓存延迟**（2026-10-10 踩坑，已修 recommend.py）：`add_ledger` 曾用 `+record-list` 回读新 rec_id，缓存延迟读不到 → `write()` 误判「台账无记录」跳过推荐记录，当天 10 条只写进 5 条。**已改用 create 响应的 `data.record_id_list`（与 need 同序）直接建映射。**
- lark-cli 字段值形态：text/url → 纯字符串；select/link → 数组。曾因给 text 字段传数组报 `800010407`。
- `+record-batch-update` 的 flag 是 `--json`（内含 `update_records` 包裹），**不是** `--update-records`。

## 历次执行
### 2026-10-10
- 管道 all 成功（release 7694885537510264013）；当日 10 条：为你推荐=excel / Auto-claude-code-research-in-sleep / AI-Research-SKILLs / anything2explainer / huashu-design；全网热门=setup-matt-pocock-skills / pdf / docx / pptx / agent-skills
- 遇上述「补录回读缓存延迟」bug：手动补建 5 条推荐记录 + 精修 5 中文名/说明 + 10 条手册 + 修正 5 条理由；重跑 publish（release 7694886686001482992，DATA_UPDATED 2026-10-10 12:15）；Chrome 截图核验 10 卡片均有中文标题+说明+场景+怎么用
- 修复 recommend.py 该 bug；CHANGELOG 记 A/B/C；commit 0d5e494 已 push origin/main

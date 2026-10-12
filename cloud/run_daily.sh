#!/usr/bin/env bash
# 云端每日推荐入口（机械管道部分）——无本机依赖
# 适用：WorkBuddy 云上模式 / 云主机 VPS / 任意 Linux 环境
# 前置：python3、lark-cli（已 user 身份授权、在 PATH 或用 LARK_CLI 指定）、可直连 GitHub 与飞书
#
# 用法: bash cloud/run_daily.sh [YYYY-MM-DD]
#
# 说明：
#   - 云端可直连 GitHub，因此**不设代理**；若你的环境需要代理，请自行 export HTTPS_PROXY 后运行。
#   - 本脚本只跑 fetch→select→write→publish 的机械管道。
#   - 「内容精修」（补中文名 / 中文说明 / 使用手册 / 推荐理由）需要 AI 参与，
#     由 WorkBuddy 云上模式的**任务提示词**承担（见 cloud/cloud-task-prompt.md），本脚本不代劳。
set -euo pipefail

cd "$(dirname "$0")/.."
DATE="${1:-$(date +%F)}"

echo "[cloud] 开始 $DATE 每日推荐管道"
python3 recommend.py all --date "$DATE"
echo "[cloud] 管道结束，开始无浏览器验证"
bash cloud/verify_online.sh "$DATE"

#!/usr/bin/env bash
# 无浏览器线上页验证（云端 / 本机通用，替代依赖本机 Google Chrome 的 verify_publish.mjs）
# 用法: bash cloud/verify_online.sh [YYYY-MM-DD]   # 日期默认取今天
# 退出码: 0=通过（页面已刷新且找到当日推荐），1=失败
set -euo pipefail

URL="https://s0zel9adg2.doubaoapps.com/app/app_17f88vb743c"
DATE="${1:-$(date +%F)}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if ! curl -fsSL --max-time 30 "$URL" -o "$tmp"; then
  echo "FAIL: 无法访问在线页 $URL"
  exit 1
fi

updated="$(grep -o 'DATA_UPDATED = "[^"]*"' "$tmp" | head -1 | sed 's/.*"\(.*\)".*/\1/')"
n="$(grep -o "date:\"$DATE\"" "$tmp" | wc -l | tr -d ' ')"

echo "在线页: $URL"
echo "DATA_UPDATED = ${updated:-（未找到）}"
echo "今日($DATE) 推荐条数 = $n"

if [ "${n:-0}" -ge 1 ]; then
  echo "OK: 线上页已包含 $DATE 的推荐"
  exit 0
else
  echo "FAIL: 线上页未找到 $DATE 的推荐（发布可能未生效或日期不符）"
  exit 1
fi

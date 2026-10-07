#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 Base 四表导出同步 data.json + HTML 内嵌快照（Skill 中心 v2）
- 台账 / 推荐记录 / 用法案例 / 技能反馈
- 产出：每技能「我的评价」(rating)、案例技能中文名映射、同步时间 updated
"""
import json, re, sys
from datetime import datetime

BASE = "/home/user/Doubao/chats/38444168961292802/skill-center"
HTML = f"{BASE}/Skill管理中心.html"

def load(f):
    d = json.load(open(f"/tmp/{f}.json"))
    data = d["data"]
    fields = data["fields"]
    rows = data["data"]
    out = []
    for row in rows:
        rec = {fields[i]: row[i] for i in range(len(fields)) if i < len(row)}
        out.append(rec)
    return out

def v(rec, key, default=None):
    x = rec.get(key, default)
    if x is None or x == "":
        return default
    return x

def first(rec, key):
    x = rec.get(key)
    if isinstance(x, list) and x:
        return x[0]
    return x

def date10(x):
    if not x:
        return None
    return str(x)[:10]

def extract_url(x):
    """把 markdown 链接 [text](url) 解析成纯 URL；无链接则原样"""
    if not x:
        return ""
    m = re.match(r"^\s*\[[^\]]*\]\(([^)]+)\)\s*$", str(x))
    if m:
        return m.group(1).strip()
    return str(x).strip()

# ---- 台账 ----
ledger = []
for r in load("ledger_raw"):
    ledger.append({
        "name": v(r, "技能名称"),
        "cn": v(r, "中文名") or "",
        "cat": first(r, "类别") or "",
        "tags": r.get("功能标签") or [],
        "status": first(r, "安装状态") or "",
        "backup": first(r, "备份状态") or "",
        "hot": v(r, "热度(星)"),
        "source": extract_url(v(r, "来源")) or "",
        "biz": r.get("对应业务") or [],
        "last": date10(v(r, "最近试用日期")),
        "score": v(r, "效果评分"),
        "desc": v(r, "一句话说明") or "",
        "note": v(r, "备注") or "",
    })

# ---- 台账 id -> 名称（用于关联映射）----
ledger_name_by_id = {}
ledger_score_by_name = {}
lr = json.load(open("/tmp/ledger_raw.json"))["data"]
for i, rid in enumerate(lr.get("record_id_list", [])):
    row = lr["data"][i]
    fields = lr["fields"]
    rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
    name = rec.get("技能名称")
    ledger_name_by_id[rid] = name
    if name:
        ledger_score_by_name[name] = rec.get("效果评分")

# ---- 技能反馈 -> 我的评价 ----
# 只看最新一条 有用/一般/没用（请求试用/评分/吐槽不算评价）
fb_by_skill = {}  # name -> (time, type)
for r in load("feedback_raw"):
    ftype = first(r, "反馈类型")
    if ftype not in ("有用", "一般", "没用"):
        continue
    sname = v(r, "技能名称")
    t = str(r.get("提交时间") or "")
    if sname and (sname not in fb_by_skill or t >= fb_by_skill[sname][0]):
        fb_by_skill[sname] = (t, ftype)

FB_TYPE_RATING = {"有用": "好用", "一般": "一般", "没用": "没用"}

def calc_rating(name):
    if name in fb_by_skill:
        return FB_TYPE_RATING[fb_by_skill[name][1]]
    score = ledger_score_by_name.get(name)
    if score:
        if score >= 4: return "好用"
        if score == 3: return "一般"
        if score <= 2: return "没用"
    return "未评价"

rating_map = {s["name"]: calc_rating(s["name"]) for s in ledger}

# ---- 技能反馈 -> 意向（感兴趣/不感兴趣，最新一条）----
interest_map = {}  # name -> 感兴趣 | 不感兴趣
for r in load("feedback_raw"):
    ftype = first(r, "反馈类型")
    if ftype not in ("感兴趣", "不感兴趣"):
        continue
    sname = v(r, "技能名称")
    t = str(r.get("提交时间") or "")
    if sname and (sname not in interest_map or t >= interest_map[sname][0]):
        interest_map[sname] = (t, ftype)
interest_map = {k: v[1] for k, v in interest_map.items()}

# ---- 推荐记录 ----
recs = []
for r in load("recs_raw"):
    link = r.get("关联技能") or []
    linked = ""
    if link and isinstance(link, list) and link[0].get("id"):
        linked = ledger_name_by_id.get(link[0]["id"], "")
    recs.append({
        "batch": v(r, "推荐批次") or "",
        "date": date10(v(r, "推荐日期")),
        "skill": linked,
        "inst": first(r, "是否安装") or "",
        "tried": first(r, "是否试用") or "",
        "effect": first(r, "试用效果") or "",
        "hot": v(r, "热度指标") or "",
        "why": v(r, "推荐理由与帮助") or "",
        "type": "trending" if first(r, "推荐类型") == "全网热门" else "for_you",
    })

# ---- 用法案例（skill 关联转名称，修复 [object Object]）----
cases = []
for r in load("cases_raw"):
    link = first(r, "关联技能")
    sname = ""
    if isinstance(link, dict) and link.get("id"):
        sname = ledger_name_by_id.get(link["id"], "") or ""
    cases.append({
        "name": v(r, "案例名称") or "",
        "skill": sname,
        "scene": first(r, "教学场景") or "",
        "date": date10(v(r, "完成日期")),
        "effect": first(r, "使用效果") or "",
        "link": extract_url(v(r, "产物链接")),
        "steps": v(r, "操作步骤") or "",
        "note": v(r, "复盘备注") or "",
        "cover": extract_url(v(r, "封面图")) or "",
    })

updated = datetime.now().strftime("%Y-%m-%d %H:%M")
data_json = {"ledger": ledger, "recs": recs, "cases": cases, "rating": rating_map, "interest": interest_map, "updated": updated}
with open(f"{BASE}/data.json", "w", encoding="utf-8") as f:
    json.dump(data_json, f, ensure_ascii=False, indent=1)
print(f"data.json written: ledger={len(ledger)} recs={len(recs)} cases={len(cases)} rating={len(rating_map)} interest={len(interest_map)} updated={updated}")

# ---- HTML 内嵌快照 ----
def js_array(items, keys):
    lines = []
    for it in items:
        parts = []
        for k in keys:
            val = it.get(k)
            js = json.dumps(val, ensure_ascii=False)
            parts.append(f"{k}:{js}")
        lines.append("  {" + ",".join(parts) + "}")
    return "[\n" + ",\n".join(lines) + "\n]"

def js_object(obj):
    return "{" + ",".join(f"{json.dumps(k, ensure_ascii=False)}:{json.dumps(v, ensure_ascii=False)}" for k, v in obj.items()) + "}"

html = open(HTML, encoding="utf-8").read()

ledger_keys = ["name","cn","cat","tags","status","backup","hot","source","biz","last","score","desc","note"]
recs_keys = ["batch","date","skill","inst","tried","effect","hot","why","type"]
cases_keys = ["name","skill","scene","date","effect","link","steps","note","cover"]

new_ledger = js_array(ledger, ledger_keys)
new_recs = js_array(recs, recs_keys)
new_cases = js_array(cases, cases_keys)
new_rating = js_object(rating_map)
new_interest = js_object(interest_map)

def replace_block(html, const_name, new_body):
    pattern = re.compile(r"(const %s = )\[.*?\];" % const_name, re.DOTALL)
    repl = lambda m: m.group(1) + new_body + ";"
    new_html, n = pattern.subn(repl, html)
    if n != 1:
        print(f"WARN: {const_name} replaced {n} times")
    return new_html

html = replace_block(html, "SKILL_LEDGER", new_ledger)
html = replace_block(html, "RECOMMEND_RECS", new_recs)
html = replace_block(html, "CASE_LEDGER", new_cases)
html = re.sub(r'(const RATING_MAP = )\{.*?\};', lambda m: m.group(1) + new_rating + ";", html, flags=re.DOTALL)
html = re.sub(r'(const INTEREST_MAP = )\{.*?\};', lambda m: m.group(1) + new_interest + ";", html, flags=re.DOTALL)
html = re.sub(r'(let DATA_UPDATED = )"[^"]*";', lambda m: m.group(1) + json.dumps(updated) + ";", html)

with open(HTML, "w", encoding="utf-8") as f:
    f.write(html)
print("HTML snapshots updated")

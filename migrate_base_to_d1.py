#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""P0 数据迁移：飞书 Base → Cloudflare D1
- 读 /tmp/mig_*.json（Base 全量导出）
- 生成 seed.sql（skills → recs/cases/handbook/polish → admin 用户 → user_skill_states → commands）
"""
import json, re
from datetime import datetime

def load(t):
    d = json.load(open(f"/tmp/mig_{t}.json"))
    data = d["data"]
    fields = data["fields"]
    rows = data["data"]
    rids = data.get("record_id_list", [])
    out = []
    for i, row in enumerate(rows):
        rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
        rec["__rid__"] = rids[i] if i < len(rids) else None
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
    """markdown 链接 [text](url) → 纯 URL；标注文本保留原文"""
    if not x:
        return None
    m = re.match(r"^\s*\[[^\]]*\]\(([^)]+)\)\s*$", str(x))
    if m:
        u = m.group(1).strip()
        if u.startswith("http"):
            return u
        return m.group(0)
    return str(x).strip()

def esc(x):
    if x is None:
        return "NULL"
    return "'" + str(x).replace("'", "''") + "'"

def arr(rec, key):
    x = rec.get(key)
    if isinstance(x, list) and x:
        return json.dumps(x, ensure_ascii=False)
    return None

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
sql = []
sql.append("-- seed.sql generated " + now)
sql.append("BEGIN;")

# ---------- 1. skills ----------
ledger = load("ledger")
rid2skill = {}
for r in ledger:
    rid2skill[r["__rid__"]] = r["技能名称"]

skill_ids = {}   # name -> d1 skill_id
for r in ledger:
    name = r["技能名称"]
    cn = v(r, "中文名")
    cat = first(r, "类别")
    tags = arr(r, "功能标签") or "[]"
    biz = arr(r, "对应业务") or "[]"
    status = first(r, "安装状态") or "未安装"
    backup = first(r, "备份状态") or "未备份"
    hot = v(r, "热度(星)")
    source = extract_url(v(r, "来源"))
    reg = v(r, "可安装注册名")
    score = v(r, "效果评分")
    desc = v(r, "一句话说明")
    note = v(r, "备注")
    last_used = date10(v(r, "最近试用日期"))
    sql.append(f"INSERT INTO skills(name,cn,cat,tags,biz,status,backup,hot,source,reg,score,desc,note,last_used) VALUES({esc(name)},{esc(cn)},{esc(cat)},{esc(tags)},{esc(biz)},{esc(status)},{esc(backup)},{esc(hot)},{esc(source)},{esc(reg)},{esc(score)},{esc(desc)},{esc(note)},{esc(last_used)});")

# 需要 skill_id：先查回（脚本内通过临时表方式：直接以 name 为准后续用子查询）
def skill_id_expr(name):
    return f"(SELECT id FROM skills WHERE name={esc(name)} LIMIT 1)"

# ---------- 2. recs ----------
recs = load("recs")
rec_cnt = 0
for r in recs:
    batch = v(r, "推荐批次")
    date = date10(v(r, "推荐日期"))
    typ = first(r, "推荐类型") or "为你推荐"
    link = r.get("关联技能")
    skill_ref = link[0]["id"] if isinstance(link, list) and link else None
    hot = v(r, "热度指标")
    source = extract_url(v(r, "来源链接"))
    why = v(r, "推荐理由与帮助")
    if skill_ref and skill_ref in rid2skill:
        se = skill_id_expr(rid2skill[skill_ref])
        sql.append(f"INSERT INTO recs(batch,date,type,skill_id,hot,source,why) VALUES({esc(batch)},{esc(date)},{esc(typ)},{se},{esc(hot)},{esc(source)},{esc(why)});")
        rec_cnt += 1

# ---------- 3. cases ----------
cases = load("cases")
case_cnt = 0
for r in cases:
    link = r.get("关联技能")
    skill_ref = link[0]["id"] if isinstance(link, list) and link else None
    if not (skill_ref and skill_ref in rid2skill):
        continue
    se = skill_id_expr(rid2skill[skill_ref])
    sql.append(f"INSERT INTO cases(name,skill_id,scene,date,effect,link,bg,repro,steps,note,cover,time) VALUES({esc(v(r,'案例名称'))},{se},{esc(v(r,'教学场景'))},{esc(date10(v(r,'完成日期')))},{esc(v(r,'使用效果'))},{esc(extract_url(v(r,'产物链接')))},{esc(v(r,'任务背景'))},{esc(v(r,'可复现性'))},{esc(v(r,'操作步骤'))},{esc(v(r,'复盘备注'))},{esc(extract_url(v(r,'封面图')))},{esc(v(r,'耗时卡点'))});")
    case_cnt += 1

# ---------- 4. handbook ----------
handbook = load("handbook")
hb_cnt = 0
for r in handbook:
    name = v(r, "技能名称")
    if not name:
        continue
    sql.append(f"INSERT INTO handbook(skill_id,goal,prompt,steps,examples) VALUES({skill_id_expr(name)},NULL,{esc(v(r,'调用模板'))},{esc(v(r,'输入准备'))},{esc(v(r,'产出格式'))});")
    hb_cnt += 1

# ---------- 5. polish ----------
polish = load("polish")
pl_cnt = 0
for r in polish:
    name = v(r, "技能名称")
    if not name:
        continue
    sql.append(f"INSERT INTO polish(name,scene,status,rounds,score,issues,fixes,tpl,note,date) VALUES({esc(name)},{esc(v(r,'打磨场景'))},{esc(first(r,'打磨状态'))},{esc(v(r,'迭代轮次'))},{esc(v(r,'当前质量评分'))},{esc(v(r,'评审问题清单'))},{esc(v(r,'改进措施'))},{esc(extract_url(v(r,'最佳实践模板')))},{esc(v(r,'复盘备注'))},{esc(date10(v(r,'完成日期')))});")
    pl_cnt += 1

# ---------- 6. admin 用户（迁移期占位，第一个注册用户将拥有 admin） ----------
sql.append("INSERT INTO users(email,password_hash,nickname,role) VALUES('admin@skill-center.local','placeholder','赵斌(管理员)','admin');")

# ---------- 7. user_skill_states（历史反馈合并：每人每技能取最新一条） ----------
feedback = load("feedback")
states = {}   # (open_id, skill_name) -> {ts, rating/status, note}
for r in feedback:
    skill = v(r, "技能名称")
    ftype = first(r, "反馈类型")
    ts = v(r, "提交时间") or ""
    note = v(r, "一句话备注")
    persons = r.get("提交人")
    pid = persons[0]["id"] if isinstance(persons, list) and persons else "unknown"
    if not skill or not ftype:
        continue
    key = (pid, skill)
    cur = states.get(key)
    if cur is None or ts > cur["ts"]:
        act = None
        if ftype in ("有用", "没用", "一般"):
            act = ("rating", {"有用": "好用", "没用": "没用", "一般": "一般"}[ftype])
        elif ftype == "感兴趣":
            act = ("status", "待安装")
        elif ftype == "不感兴趣":
            act = ("status", "不感兴趣")
        else:
            act = ("note", ftype)   # 请求试用/评分/吐槽 仅记备注
        states[key] = {"ts": ts, "act": act, "note": note}

state_cnt = 0
for (pid, skill), s in states.items():
    kind, val = s["act"]
    if kind == "rating":
        fields = f"rating={esc(val)}"
    elif kind == "status":
        fields = f"status={esc(val)}"
    else:
        fields = f"note={esc(s['note'] or val)}"
    # user_id=1(admin), status 默认未安装
    sql.append(f"INSERT INTO user_skill_states(user_id,skill_id,status,rating,note,updated_at) VALUES(1,{skill_id_expr(skill)},'未安装',NULL,{esc(s['note'])},'') ON CONFLICT(user_id,skill_id) DO UPDATE SET {fields};")
    state_cnt += 1

# ---------- 8. commands（历史指令归 admin） ----------
commands = load("commands")
cmd_cnt = 0
for r in commands:
    skill = v(r, "技能名称")
    act = first(r, "动作")
    status = first(r, "状态")
    result = v(r, "处理结果")
    handled = date10(v(r, "处理时间")) or date10(v(r, "提交时间"))
    if not (skill and act):
        continue
    created = date10(v(r, "提交时间")) or handled
    sql.append(f"INSERT INTO commands(user_id,skill_id,act,status,executor,result,created_at,handled_at) VALUES(1,{skill_id_expr(skill)},{esc(act)},{esc(status)},'cloud',{esc(result)},{esc(created)},{esc(handled)});")
    cmd_cnt += 1

sql.append("COMMIT;")

out = "\n".join(sql)
open("backend/seed.sql", "w").write(out)
print(f"seed.sql written: {len(sql)} statements")
print(f"skills={len(ledger)} recs={rec_cnt} cases={case_cnt} handbook={hb_cnt} polish={pl_cnt} states={state_cnt} commands={cmd_cnt} feedback_raw={len(feedback)}")

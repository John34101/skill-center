#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Skill 管理中心 · 每日双档推荐管道（recommend.py）
用法：
  python3 recommend.py fetch    --date 2026-10-07            # 抓取候选 → /tmp/rec_candidates.json
  python3 recommend.py select   --date 2026-10-07 --dry-run  # 规则打分 → /tmp/rec_plan.json（为你推荐5+全网热门5）
  python3 recommend.py write    --date 2026-10-07 --dry-run  # 写 Base：台账补录+推荐记录+link+回读
  python3 recommend.py publish  --date 2026-10-07 --dry-run  # 导出4表 → sync → 发布 → 轮询 → 验证
  python3 recommend.py all      --date 2026-10-07 --dry-run  # fetch→select→write→publish 一条链

依赖：python3 标准库 + lark-cli（write/publish 需要，且已 OAuth 授权）；GitHub Trending 匿名可抓。
注意：--dry-run 时不写库、不发布，只打印计划。热度数据全部来自真实抓取，禁止编造。
"""
import json, re, subprocess, sys, time, urllib.request
from datetime import datetime
from pathlib import Path

BASE = Path("/home/user/Doubao/chats/38444168961292802/skill-center")
PROFILE = BASE / "profile.json"
BASE_TOKEN = "VRA1bfbiaaiUjRsK0ekcwAdsnHd"
TBL_LEDGER = "tblnkqaoYXg7j0dj"     # 技能台账
TBL_RECS = "tblMWvCyEcrhxbyu"       # 推荐记录
TBL_CASES = "tblgLIx9pFpojjW1"      # 用法案例
TBL_FEEDBACK = "tblLQqY1V17uA6Ql"   # 技能反馈
APP_ID = "app_17f88vb743c"
ONLINE_URL = "https://s0zel9adg2.doubaoapps.com/app/app_17f88vb743c"

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}

# 经典高热度 skill 兜底清单（star 数由 GitHub API 实时补，禁止硬编码）
CLASSIC = [
    {"name": "frontend-design", "cn": "前端设计", "repo": "anthropics/skills", "desc": "Anthropic 官方前端设计规范，避免模板化 UI"},
    {"name": "pdf", "cn": "PDF处理", "repo": "anthropics/skills", "desc": "PDF 读写编辑转换全流程处理"},
    {"name": "docx", "cn": "Word处理", "repo": "anthropics/skills", "desc": "Office Word 阅读新建修改"},
    {"name": "pptx", "cn": "PPT处理", "repo": "anthropics/skills", "desc": "PowerPoint 创建编辑导出"},
    {"name": "excel", "cn": "Excel处理", "repo": "anthropics/skills", "desc": "Excel 表格读写分析可视化"},
    {"name": "webapp-testing", "cn": "网页测试", "repo": "anthropics/skills", "desc": "Playwright 网页自动化测试"},
    {"name": "life-decision-guide", "cn": "高性价比人生指南", "repo": "eternity4719/HowToLiveBetter", "desc": "全站爆款：按正文回答该不该做、值不值"},
    {"name": "setup-matt-pocock-skills", "cn": "Matt Pocock技能集", "repo": "mattpocock/skills", "desc": "TypeScript 名师的生产级 Claude Code 技能集合"},
    {"name": "security-audit", "cn": "安全审计", "repo": "mattpocock/skills", "desc": "代码安全漏洞审查"},
    {"name": "colleague-skill", "cn": "同事蒸馏", "repo": "titanwings/colleague-skill", "desc": "把同事/关系人蒸馏成可复用人物画像"},
]

def http_get(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="ignore")

def parse_star(s):
    s = s.replace(",", "").strip()
    m = re.search(r"([\d.]+)\s*k", s, re.I)
    if m:
        return int(float(m.group(1)) * 1000)
    m = re.search(r"\d+", s)
    return int(m.group(0)) if m else 0

def gh_api_stars(repo, retries=2):
    for i in range(retries):
        try:
            d = json.loads(http_get(f"https://api.github.com/repos/{repo}"))
            return d.get("stargazers_count") or 0
        except Exception:
            time.sleep(2)
    return None

# ---------------- fetch ----------------
def fetch_trending():
    """抓 GitHub Trending daily，取前 25 条"""
    try:
        html = http_get("https://github.com/trending?since=daily")
    except Exception as e:
        print(f"[fetch] trending 失败（跳过）：{e}")
        return []
    items = []
    for art in re.findall(r'<article class="Box-row">([\s\S]*?)</article>', html):
        mh = re.search(r'<h2[^>]*>[\s\S]*?href="/([^"]+)"', art)
        md = re.search(r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)</p>', art)
        ms = re.search(r'<a[^>]*href="/(?:[^"]+/stargazers|stars[^"]*)"[^>]*>([\s\S]*?)</a>', art)
        if not mh:
            continue
        repo = mh.group(1).strip().strip("/")
        desc = re.sub(r"<[^>]+>", "", md.group(1) if md else "").strip()
        desc = re.sub(r"\s+", " ", desc)
        star = parse_star(re.sub(r"<[^>]+>", "", ms.group(1))) if ms else 0
        items.append({"name": repo.split("/")[-1], "cn": "", "repo": repo,
                      "desc": desc[:120], "hot": star,
                      "source": f"https://github.com/trending?since=daily",
                      "src": "trending"})
    return items[:25]

def fetch_classic():
    """经典兜底，star 用 GitHub API 实时补"""
    items = []
    for c in CLASSIC:
        star = gh_api_stars(c["repo"])
        items.append({"name": c["name"], "cn": c["cn"], "repo": c["repo"],
                      "desc": c["desc"], "hot": star if star is not None else 0,
                      "source": f"https://github.com/{c['repo']}",
                      "src": "classic"})
    return items

def fetch():
    cands = fetch_trending() + fetch_classic()
    seen, out = set(), []
    for c in cands:
        k = c["name"].lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    out.sort(key=lambda x: -(x["hot"] or 0))
    with open("/tmp/rec_candidates.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"[fetch] 候选 {len(out)} 条 → /tmp/rec_candidates.json")
    return out

# ---------------- select ----------------
def load_profile():
    return json.load(open(PROFILE, encoding="utf-8"))

def feedback_scores():
    """读反馈表，按技能名聚合反馈类型计数（A1 推荐闭环）"""
    fb = {}
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_FEEDBACK,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows = d["fields"], d["data"]
        for row in rows:
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            name = rec.get("技能名称")
            if not name:
                continue
            t = rec.get("反馈类型")
            if isinstance(t, list):
                t = t[0] if t else None
            if t not in ("感兴趣", "有用", "没用", "不感兴趣"):
                continue
            fb.setdefault(name, {}).setdefault(t, 0)
            fb[name][t] += 1
    except Exception as e:
        print(f"[select] 反馈表读取失败（按无反馈处理）：{e}")
    return fb

def installed_set():
    """读台账，返回已安装技能名集合"""
    inst = set()
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_LEDGER,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows = d["fields"], d["data"]
        for row in rows:
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            name = rec.get("技能名称")
            st = rec.get("安装状态")
            if isinstance(st, list):
                st = st[0] if st else None
            if name and st == "已安装":
                inst.add(name)
    except Exception as e:
        print(f"[select] 台账读取失败（按无已装处理）：{e}")
    return inst

def recent_recs(days=14):
    """P1 重复抑制：读推荐记录表，返回最近 N 天推荐过的技能名集合"""
    recent = set()
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_RECS,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows = d["fields"], d["data"]
        from datetime import timedelta
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        for row in rows:
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            dt = str(rec.get("推荐日期") or "")[:10]
            name = rec.get("技能名称")
            if dt >= cutoff and name and not isinstance(name, list):
                recent.add(str(name))
    except Exception as e:
        print(f"[select] 推荐记录读取失败（重复抑制跳过）：{e}")
    return recent

def recent_cases(days=7):
    """P4 个性化推荐语：读最近 N 天案例，返回 skill -> 案例名列表"""
    cases = {}
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_CASES,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows = d["fields"], d["data"]
        from datetime import timedelta
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        for row in rows:
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            dt = str(rec.get("完成日期") or "")[:10]
            name = rec.get("技能名称")
            case = rec.get("案例名称")
            if dt >= cutoff and name and case:
                cases.setdefault(str(name), []).append(str(case))
    except Exception as e:
        print(f"[select] 案例读取失败（个性化推荐语跳过）：{e}")
    return cases

def fb_score(name, fb):
    """反馈分 = 感兴趣×3 + 有用×2 − 没用×2 − 不感兴趣×3（A1 口径）"""
    d = fb.get(name, {})
    return d.get("感兴趣", 0)*3 + d.get("有用", 0)*2 - d.get("没用", 0)*2 - d.get("不感兴趣", 0)*3

def score(item, profile):
    text = f"{item.get('name','')} {item.get('cn','')} {item.get('desc','')}".lower()
    s = 0
    for kw, w in profile["keywords"].items():
        if kw.lower() in text:
            s += w
    return s

def why_text(item, cases=None, fb=None, name2cn=None):
    """P4 个性化推荐语：优先结合最近 7 天真实案例与用户反馈；无则用画像模板"""
    nm = item.get("name", "")
    if cases and nm in cases:
        cn = (name2cn or {}).get(nm, "") or ""
        cs = "、".join(cases[nm][:2])
        return f"你最近做过「{cs}」，它和这个技能同赛道，可复现同类产出"
    if fb and fb.get(nm, {}).get("感兴趣", 0) > 0:
        return "你标记过感兴趣，同赛道技能值得一试"
    text = f"{nm} {item.get('desc','')}".lower()
    if any(k in text for k in ["video", "video", "anim", "visual", "diagram", "动画", "视频"]):
        return "可落地：把几何模型/定理做成讲解动画或口播配图"
    if any(k in text for k in ["writ", "polish", "human", "rewrit", "写作", "润色"]):
        return "可落地：家长/学生回复去 AI 味、代写口播稿"
    if any(k in text for k in ["search", "research", "investig", "调研", "搜索"]):
        return "可落地：调研初中生家长高频问题、抓选题素材"
    if any(k in text for k in ["math", "edu", "teach", "tutor", "数学", "教育", "教学"]):
        return "可落地：备课、知识点讲解、出题与答疑"
    if any(k in text for k in ["test", "code", "dev", "engineer", "开发", "测试"]):
        return "可落地：自动化工具类，试用以提效"
    return "可落地：试用后按真实效果反馈回流推荐"

def select(date_str):
    cands = json.load(open("/tmp/rec_candidates.json", encoding="utf-8"))
    profile = load_profile()
    fb = feedback_scores()
    inst = installed_set()
    recent = recent_recs(days=14)          # P1：最近 14 天已推，抑制重复
    cases = recent_cases(days=7)           # P4：最近 7 天案例，个性化推荐语
    excluded = inst | {n for n, d in fb.items() if d.get("不感兴趣", 0) > 0} | recent
    def final_score(c):
        return score(c, profile) + fb_score(c["name"], fb)
    scored = sorted(cands, key=lambda c: -final_score(c))
    for_you = []
    for c in scored:
        if c["name"] in excluded:
            continue
        if len(for_you) >= 5:
            break
        c["cn"] = c.get("cn") or ""
        c["why"] = why_text(c, cases, fb)
        c["tier"] = "for_you"
        c["img"] = score(c, profile)
        c["fb"] = fb_score(c["name"], fb)
        for_you.append(c)
    used = {c["name"].lower() for c in for_you}
    trending = []
    for c in sorted(cands, key=lambda x: -(x.get("hot") or 0)):
        if c["name"].lower() in used:
            continue
        if len(trending) >= 5 and c["name"] in recent:
            continue
        c["cn"] = c.get("cn") or ""
        c["why"] = why_text(c, cases, fb)
        c["tier"] = "trending"
        trending.append(c)
        if len(trending) >= 5:
            break
    plan = {"date": date_str, "for_you": for_you, "trending": trending}
    with open("/tmp/rec_plan.json", "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=1)
    print(f"[select] 为你推荐 {len(for_you)} 条 / 全网热门 {len(trending)} 条 → /tmp/rec_plan.json")
    print(f"[select] 已排除：已装 {len(inst & {c['name'] for c in cands})} / 不感兴趣 {len({c['name'] for c in cands if c['name'] in excluded - inst - recent})} / 近14天已推 {len(recent & {c['name'] for c in cands})}")
    for c in for_you:
        print(f"  [为你推荐] {c['name']} ★{c.get('hot')} 画像{c['img']} 反馈{c['fb']} | {c['why'][:40]}")
    for c in trending:
        print(f"  [全网热门] {c['name']} ★{c.get('hot')} | {c['why'][:40]}")
    return plan

# ---------------- write（Base） ----------------
def run_cli(args):
    return subprocess.run(["lark-cli"] + args, capture_output=True, text=True)

def ledger_map():
    r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_LEDGER,
                 "--as", "user", "--format", "json", "--limit", "200"])
    try:
        d = json.loads(r.stdout)["data"]
    except Exception:
        print("[write] 台账读取失败：", r.stdout[:300], r.stderr[:300]); sys.exit(1)
    fields, rows, ids = d["fields"], d["data"], d.get("record_id_list", [])
    m = {}
    for i, row in enumerate(rows):
        rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
        rid = ids[i] if i < len(ids) else None
        name = rec.get("技能名称")
        if name:
            m[name] = rid
    return m

def add_ledger(items, dry):
    """补录不在台账的技能，返回 name -> rec_id"""
    m = ledger_map()
    need = []
    for it in items:
        name = it["name"]
        if name in m:
            continue
        cat = "效率工具"
        biz = ["内容创作"]
        tag = ["自动化"]
        if any(k in (name + it.get("desc", "")).lower() for k in ["math", "edu", "tutor", "teach"]):
            cat, biz, tag = "教学与教研", ["教学备课"], ["教学讲解"]
        elif any(k in (name + it.get("desc", "")).lower() for k in ["writ", "polish", "human"]):
            cat, biz, tag = "内容创作", ["内容创作"], ["写作润色"]
        elif any(k in (name + it.get("desc", "")).lower() for k in ["video", "anim", "visual"]):
            cat, biz, tag = "视频制作", ["口播视频"], ["视频生成"]
        rec = {
            "技能名称": name,
            "中文名": it.get("cn", "") or "",
            "安装状态": ["未安装"],
            "备份状态": ["未备份"],
            "类别": [cat],
            "对应业务": biz,
            "功能标签": tag,
            "热度(星)": it.get("hot") or 0,
            "来源": it.get("source") or "",
            "一句话说明": it.get("desc", "")[:200],
            "备注": f"{datetime.now().strftime('%Y-%m-%d')} recommend.py 自动补录",
        }
        need.append(rec)
    if not need:
        print("[write] 台账无需补录"); return m
    if dry:
        print(f"[write][dry] 将补录台账 {len(need)} 条：{[r['技能名称'] for r in need]}")
        return m
    r = run_cli(["base", "+record-batch-create", "--base-token", BASE_TOKEN, "--table-id", TBL_LEDGER,
                 "--create-records", json.dumps(need, ensure_ascii=False), "--as", "user"])
    print("[write] 台账补录：", r.stdout[:300], r.stderr[:300])
    return ledger_map()  # 重读拿新 rec_id

def write(date_str, dry):
    plan = json.load(open("/tmp/rec_plan.json", encoding="utf-8"))
    items = plan["for_you"] + plan["trending"]
    m = add_ledger(items, dry)
    recs = []
    for it in items:
        rid = m.get(it["name"])
        if not rid:
            print(f"[write] 跳过 {it['name']}：台账无记录且补录失败"); continue
        recs.append({
            "推荐批次": f"{date_str} 推荐",
            "推荐日期": date_str,
            "推荐类型": ["为你推荐" if it["tier"] == "for_you" else "全网热门"],
            "关联技能": [{"id": rid}],
            "是否安装": ["待定"],
            "是否试用": ["未试用"],
            "试用效果": ["未试用"],
            "热度指标": f"{it.get('hot') or 0} stars" if it.get('hot') else it.get('source', ''),
            "来源链接": it.get("source") or "",
            "推荐理由与帮助": it.get("why", "")[:200],
        })
    if not recs:
        print("[write] 无推荐记录可写"); return
    if dry:
        print(f"[write][dry] 将写推荐记录 {len(recs)} 条（批次 {date_str} 推荐）")
        return
    r = run_cli(["base", "+record-batch-create", "--base-token", BASE_TOKEN, "--table-id", TBL_RECS,
                 "--create-records", json.dumps(recs, ensure_ascii=False), "--as", "user"])
    print("[write] 推荐记录：", r.stdout[:400], r.stderr[:400])
    # 回读确认
    r2 = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_RECS,
                  "--as", "user", "--format", "json", "--limit", "200"])
    try:
        n = len(json.loads(r2.stdout)["data"]["data"])
        print(f"[write] 回读：推荐记录表共 {n} 条（要求 >= 写入数 {len(recs)}）")
    except Exception:
        print("[write] 回读失败，请人工核对")

# ---------------- publish ----------------
def export_tables():
    tables = {"ledger_raw": TBL_LEDGER, "recs_raw": TBL_RECS, "cases_raw": TBL_CASES, "feedback_raw": TBL_FEEDBACK}
    for fn, tid in tables.items():
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", tid,
                     "--as", "user", "--format", "json", "--limit", "200"])
        Path(f"/tmp/{fn}.json").write_text(r.stdout, encoding="utf-8")
    print("[publish] 4 表导出完成")

def publish(dry):
    export_tables()
    if dry:
        print("[publish][dry] 将执行 sync_from_base.py + html-publish")
        return
    r = subprocess.run(["python3", str(BASE / "sync_from_base.py")], capture_output=True, text=True)
    print("[publish] sync:", r.stdout.strip(), r.stderr.strip()[:300])
    r = subprocess.run(["cp", str(BASE / "Skill管理中心.html"), "/tmp/index.html"])
    r = run_cli(["apps", "+html-publish", "--path", "/tmp/index.html", "--app-id", APP_ID, "--as", "user", "--format", "json"])
    print("[publish] html-publish:", r.stdout[:400], r.stderr[:300])
    try:
        rid = json.loads(r.stdout)["data"]["release_id"]
    except Exception:
        print("[publish] 未拿到 release_id，跳过轮询"); return
    for i in range(10):
        time.sleep(5)
        r2 = run_cli(["apps", "+release-get", "--app-id", APP_ID, "--release-id", str(rid), "--as", "user", "--format", "json"])
        try:
            st = json.loads(r2.stdout)["data"]["status"]
        except Exception:
            st = "?"
        print(f"[publish] release {rid} status={st}")
        if st == "finished":
            print(f"[publish] 在线页：{ONLINE_URL}")
            return
    print("[publish] 发布超时未 finished，请人工确认")

# ---------------- main ----------------
def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(0)
    cmd = args[0]
    date_str = datetime.now().strftime("%Y-%m-%d")
    dry = "--dry-run" in args
    for i, a in enumerate(args):
        if a == "--date" and i + 1 < len(args):
            date_str = args[i + 1]
    if cmd in ("fetch", "all"):
        fetch()
    if cmd in ("select", "all"):
        select(date_str)
    if cmd in ("write", "all"):
        write(date_str, dry)
    if cmd in ("publish", "all"):
        publish(dry)
    print(f"[done] recommend.py {cmd} date={date_str} dry={dry}")

if __name__ == "__main__":
    main()

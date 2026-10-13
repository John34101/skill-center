#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Skill 管理中心 · 每日双档推荐管道（recommend.py）
用法：
  python3 recommend.py fetch    --date 2026-10-07            # 抓取候选 → /tmp/rec_candidates.json
  python3 recommend.py select   --date 2026-10-07 --dry-run  # 规则打分 → /tmp/rec_plan.json（为你推荐5+全网热门5）
  python3 recommend.py write    --date 2026-10-07 --dry-run  # 写 Base：台账补录+推荐记录+link+回读（本机/旧流程）
  python3 recommend.py publish  --date 2026-10-07 --dry-run  # 导出6表 → sync → 发布 → 轮询 → 验证（旧 doubaoapps 流程）
  python3 recommend.py all      --date 2026-10-07 --dry-run  # fetch→select→write→publish 一条链（Base 版）
  python3 recommend.py all-d1   --date 2026-10-07 --dry-run  # fetch→select→write_d1（产品版：直接写 D1，Actions 用）

依赖：python3 标准库；write/publish 需要 lark-cli（本机 OAuth）；all-d1 需要环境变量
  CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID（GitHub Actions secrets 注入）。
注意：--dry-run 时不写库、不发布，只打印计划。热度数据全部来自真实抓取，禁止编造。
"""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path

# 脚本自动定位自身所在目录（跨平台：Mac/Linux 都能跑），不再写死豆包的工作区路径
BASE = Path(__file__).resolve().parent
PROFILE = BASE / "profile.json"
BASE_TOKEN = "VRA1bfbiaaiUjRsK0ekcwAdsnHd"
TBL_LEDGER = "tblnkqaoYXg7j0dj"     # 技能台账
TBL_RECS = "tblMWvCyEcrhxbyu"       # 推荐记录
TBL_CASES = "tblgLIx9pFpojjW1"      # 用法案例
TBL_FEEDBACK = "tblLQqY1V17uA6Ql"   # 技能反馈
TBL_POLISH = "tblfWDIjED46UGFx"     # 技能打磨记录（Skill Lab）
TBL_HANDBOOK = "tblifZ7KdXaj7GbZ"   # 技能手册（L2 使用手册）
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
    """抓 GitHub Trending daily，取前 25 条。GitHub 经代理偶发 502/超时，这里 8s 快超时、
    仅重试 2 次，避免拖垮整条管道（失败就让 Search API / 经典兜底顶上）。"""
    html = None
    last_err = ""
    for attempt in range(2):
        try:
            html = http_get("https://github.com/trending?since=daily", timeout=8)
            if html and "<article" in html:
                break
        except Exception as e:
            last_err = str(e)
            print(f"[fetch] trending 第 {attempt+1} 次失败：{e}")
    if not html or "<article" not in html:
        print(f"[fetch] trending 失败（跳过）：{last_err}")
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

def fetch_github_search():
    """稳定新鲜源：GitHub Search API 抓热门 agent/skill 仓库（比 HTML trending 稳定，api.github.com 通）。
    作为 trending 抓取失败时的兜底，保证候选池有外部新鲜技能。返回与 fetch 候选同构的 dict 列表。"""
    items = []
    queries = [
        "topic:claude-code-skill",
        "claude code agent skill in:name,description",
    ]
    for q in queries:
        try:
            url = "https://api.github.com/search/repositories?q=" + urllib.parse.quote(q) \
                  + "&sort=stars&order=desc&per_page=20"
            d = json.loads(http_get(url))
            for it in d.get("items", []):
                repo = it.get("full_name", "")
                if not repo:
                    continue
                items.append({"name": it["name"], "cn": "", "repo": repo,
                              "desc": (it.get("description") or "")[:120],
                              "hot": it.get("stargazers_count") or 0,
                              "source": it.get("html_url") or f"https://github.com/{repo}",
                              "src": "search"})
        except Exception as e:
            print(f"[fetch] github search 失败（{q}）：{e}")
    return items

def fetch():
    cands = fetch_trending() + fetch_github_search() + fetch_classic()
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

def ledger_id_to_name():
    """读台账，返回 记录id -> 技能名（用于把推荐记录里的关联链接解析成技能名）"""
    m = {}
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_LEDGER,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows, ids = d["fields"], d["data"], d.get("record_id_list", [])
        for i, row in enumerate(rows):
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            rid = ids[i] if i < len(ids) else None
            nm = rec.get("技能名称")
            if rid and nm:
                m[rid] = nm
    except Exception as e:
        print(f"[select] 台账读取失败（关联解析跳过）：{e}")
    return m

def recent_recs(days=14):
    """P1 重复抑制：读推荐记录表，返回最近 N 天推荐过的技能名集合。
    注意：推荐记录表本身没有『技能名称』字段，技能是通过『关联技能』链接到台账的，
    必须先把链接 id 解析成技能名，否则去重永远是空集合（历史 bug）。"""
    recent = set()
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_RECS,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows = d["fields"], d["data"]
        from datetime import timedelta
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        name_by_id = ledger_id_to_name()
        for row in rows:
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            dt = str(rec.get("推荐日期") or "")[:10]
            link = rec.get("关联技能")
            nm = None
            if isinstance(link, list) and link and isinstance(link[0], dict) and link[0].get("id"):
                nm = name_by_id.get(link[0]["id"])
            if dt >= cutoff and nm:
                recent.add(str(nm))
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
    """反馈分 = 感兴趣×1.5 + 有用×2 − 没用×2 − 不感兴趣×3
    （感兴趣降权：测试/随手点击占比高，不应压过业务画像分）"""
    d = fb.get(name, {})
    return d.get("感兴趣", 0)*1.5 + d.get("有用", 0)*2 - d.get("没用", 0)*2 - d.get("不感兴趣", 0)*3

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

def ledger_candidates():
    """兜底候选源：从台账拉取『未安装』的技能（已装的不必再推荐），作为 GitHub Trending
    抓取失败时的新鲜候选。返回与 fetch 候选同构的 dict 列表（src=ledger）。"""
    out = []
    try:
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_LEDGER,
                     "--as", "user", "--format", "json", "--limit", "200"])
        d = json.loads(r.stdout)["data"]
        fields, rows = d["fields"], d["data"]
        for row in rows:
            rec = {fields[j]: row[j] for j in range(len(fields)) if j < len(row)}
            name = rec.get("技能名称")
            if not name:
                continue
            st = rec.get("安装状态")
            if isinstance(st, list):
                st = st[0] if st else None
            if st == "已安装":
                continue  # 已装的不再作为推荐候选
            hot = rec.get("热度(星)") or 0
            out.append({"name": name, "cn": rec.get("中文名") or "", "repo": name,
                        "desc": rec.get("一句话说明") or "",
                        "hot": hot if isinstance(hot, int) else 0,
                        "source": rec.get("来源") or "", "src": "ledger"})
    except Exception as e:
        print(f"[select] 台账候选拉取失败（跳过兜底）：{e}")
    return out

def select(date_str, use_d1=False):
    cands = json.load(open("/tmp/rec_candidates.json", encoding="utf-8"))
    # 合并兜底候选（台账未安装技能），按 name 去重，不覆盖已有的 trending/classic
    if use_d1:
        ledger_cands = d1_ledger_candidates()
    else:
        ledger_cands = ledger_candidates()
    seen = {c["name"].lower() for c in cands}
    for lc in ledger_cands:
        if lc["name"].lower() not in seen:
            cands.append(lc); seen.add(lc["name"].lower())
    profile = load_profile()
    if use_d1:
        fb, inst, recent, cases = d1_feedback_scores(), d1_installed_set(), d1_recent_recs(days=7), d1_recent_cases(days=7)
    else:
        fb, inst, recent, cases = feedback_scores(), installed_set(), recent_recs(days=7), recent_cases(days=7)
    excluded = inst | {n for n, d in fb.items() if d.get("不感兴趣", 0) > 0} | recent
    def final_score(c):
        return score(c, profile) + fb_score(c["name"], fb)
    scored = sorted(cands, key=lambda c: -final_score(c))
    for_you = []
    for c in scored:
        if c["name"] in excluded:
            continue
        # 画像门槛：业务画像和反馈分双零的技能不进"为你推荐"（宁缺毋滥，
        # 避免低相关技能靠排序随机混入；不足 5 个就少推）
        if score(c, profile) <= 0 and fb_score(c["name"], fb) <= 0:
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
        if c["name"] in excluded:
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
    print(f"[select] 候选池 {len(cands)} 条（含台账兜底 {len(ledger_cands)}）→ 为你推荐 {len(for_you)} / 全网热门 {len(trending)} → /tmp/rec_plan.json")
    print(f"[select] 已排除：已装 {len(inst & {c['name'] for c in cands})} / 不感兴趣 {len({c['name'] for c in cands if c['name'] in excluded - inst - recent})} / 近14天已推 {len(recent & {c['name'] for c in cands})}")
    for c in for_you:
        print(f"  [为你推荐] {c['name']} ★{c.get('hot')} 画像{c['img']} 反馈{c['fb']} | {c['why'][:40]}")
    for c in trending:
        print(f"  [全网热门] {c['name']} ★{c.get('hot')} | {c['why'][:40]}")
    return plan

# ---------------- write（Base） ----------------
# lark-cli 可执行文件路径可用环境变量 LARK_CLI 覆盖（默认走 PATH）。
# 云端/Linux 沙箱里 lark-cli 未必在 PATH，可用 LARK_CLI=/abs/path/lark-cli 指定。
LARK_CLI = os.environ.get("LARK_CLI", "lark-cli")

def run_cli(args):
    return subprocess.run([LARK_CLI] + args, capture_output=True, text=True)

# ---------- D1 直写（产品版，M4 迁移目标） ----------
D1_DB_ID = "3ecbcacc-8f1b-48ff-b870-c87613f5b307"
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

# 常见技能的通用中文名（fetch 候选无 cn 字段，补录时用映射表补中文名，
# 保证首页卡片显示中文、一眼看出用途；查不到时兜底用 name 本身）
CN_MAP = {
    "superpowers": "超级技能合集", "VoiceStudio": "语音工坊", "gods-eye-view": "上帝视角",
    "airllm": "AirLLM 大模型推理", "artcraft": "ArtCraft 艺术创作", "xtool": "Xtool 跨平台开发",
    "claude-seo": "Claude SEO 优化", "GPT-Image2-Skill": "GPT 图像生成",
    "obsidian-second-brain": "Obsidian 第二大脑", "claude-code": "Claude Code 编程助手",
    "answer-me-with-html": "HTML 互动答题", "claude-obsidian": "Obsidian 笔记管家",
    "claude-ads": "Claude 广告投放", "godogen": "Godot 游戏开发", "pinme": "一键部署前端",
    "one-skill-to-rule-them-all": "全能技能养成器", "life-decision-guide": "高性价比人生指南",
    "manimate": "图解动画生成", "manim-video": "数学动画视频", "archify": "架构流程图",
    "baoyu-comic": "知识科普漫画", "distilly": "人物画像提炼", "faceless-explainer": "无人出镜解说视频",
    "brainstorming": "创意头脑风暴", "grill-me": "方案压力测试", "grill-with-docs": "带文档方案评审",
    "stop-slop": "去AI味润色", "humanizer-zh": "中文去模板化", "visual-explainer": "可视化讲解",
    "typesafe-ai": "TypeSafe AI 开发", "hermes-learns-manim": "Manim 数学动画",
    "hyperframes": "超帧视频框架", "hyperframes-core": "超帧合成引擎", "hyperframes-cli": "超帧命令行",
    "openmaic": "OpenMAIC 助手", "getnote": "得到笔记", "last30days": "近30天口碑调研",
    "writing-beats": "写作节拍", "writing-shape": "写作结构", "deeptutor-cli": "DeepTutor 教练",
    "book-to-skill": "书转技能", "adult-vocational-certificate": "职业证书备考",
    "content-strategy": "内容策略规划", "agent-reach": "全网调研", "find-skills": "技能发现",
    "media-use": "媒体创作系统", "remotion-best-practices": "Remotion 视频实践",
    "seedance-2-0-prompting-skills": "Seedance 提示词", "reverse-engineer-anything": "逆向工程",
    "security-audit": "安全审计", "self-improving-agent": "自我进化代理", "teach": "技能教学",
    "webapp-testing": "网页应用测试", "ponytail": "最小改动开发", "rea-changelog-update": "发布日志更新",
    "rea-tool-design": "REA 工具设计", "setup-matt-pocock-skills": "技能环境配置",
    "skill-creator": "技能创作", "skill-creator-for-work": "工作技能创作", "ljg-map": "知识观概念图",
    "mid-autumn-chat-letter": "中秋小笺", "seedream-50": "Seedream 图像生成",
    "seedance-25": "Seedance 视频生成", "seed-audio": "音频生成", "html": "网页设计",
    "sheet": "表格处理", "ppt": "幻灯片", "word": "文档写作", "lark-doc": "飞书文档",
    "lark-base": "多维表格", "lark-calendar": "飞书日历", "lark-im": "飞书消息",
    "lark-meeting": "飞书会议", "lark-mail": "飞书邮箱", "lark-task": "飞书任务",
    "lark-drive": "云盘文件", "lark-wiki": "知识库", "lark-contact": "通讯录",
    "lark-approval": "审批流程", "lark-project": "项目管理", "lark-attendance": "考勤打卡",
    "lark-okr": "OKR 管理", "lark-whiteboard": "画板", "lark-markdown": "Markdown 文件",
    "lark-openapi-explorer": "开放接口探索", "doubao-identity": "豆包产品咨询",
    "doubao-pdf": "PDF 处理", "doubao-visualization": "可视化", "doubao-creative-design": "创意设计",
    "doubao-creative-video": "创意视频", "doubao-creative-drama": "短剧创作",
    "doubao-newmedia-writing": "新媒体写作", "doubao-marketing-plan": "营销策划",
    "doubao-ecommerce-proposal": "电商活动策划", "doubao-contract-reviewer": "合同审查",
    "doubao-contract-drafting": "合同起草", "doubao-contract-amendment": "补充协议",
    "doubao-dpa-drafter": "数据处理协议", "doubao-compliance-assessment-public": "合规评估",
    "doubao-personal-info-audit": "个保审计", "doubao-medical-report": "医学报告解读",
    "doubao-answer-with-medical-evidence": "循证医学咨询", "doubao-clinical-decision-support": "临床决策支持",
    "doubao-medical-literature-search": "医学文献检索", "doubao-medical-literature-interpretation": "医学文献解读",
    "doubao-medical-literature-translation": "医学文献翻译", "doubao-medical-literature-monitoring": "医学进展跟踪",
    "doubao-academic-researcher": "学术文献调研", "doubao-academic-polish": "论文写作润色",
    "doubao-academic-evaluator": "学术评审", "doubao-paper-close-reading": "论文精读",
    "doubao-research-proposal": "研究计划书", "doubao-patent-drafting": "专利申请撰写",
    "doubao-reference-audit": "参考文献审查", "doubao-journal-format": "论文格式排版",
    "doubao-questionnaire-designer": "问卷设计", "doubao-public-company-analysis": "上市公司分析",
    "doubao-earnings-analysis": "财报归因分析", "doubao-announcement-analysis": "公告解读",
    "doubao-daily-stock": "个股日报", "doubao-stock-screening": "选股筛选",
    "multi-stock-comparison": "多股比较", "doubao-finance-model-builder": "财务建模",
    "doubao-market-hotspot": "市场热点分析", "doubao-industry-analysis": "行业研究",
    "doubao-private-company": "一级市场评估", "doubao-wealth-planning": "财富规划",
    "doubao-data-analysis": "数据分析", "doubao-sentiment-tracker": "舆情监控",
    "doubao-video-extract": "视频提取", "doubao-product-manager": "产品经理",
    "doubao-product-analysis": "产品分析", "doubao-product-selection": "选品分析",
    "doubao-product-content": "商品内容", "doubao-listing-localization": "Listing 本地化",
    "doubao-cross-border-growth-content": "跨境增长内容", "doubao-ecommerce-compliance-tax-logistics": "跨境合规税务物流",
    "doubao-customer-service": "客服方案", "doubao-multiplatform-rewrite": "多平台改写",
    "doubao-headlines-calendar": "标题日历", "doubao-ultimate-guide": "攻略创作",
    "doubao-novel-writing": "网文创作", "doubao-book-writer": "长文档写作",
    "doubao-game-designer": "游戏设计", "doubao-human-signal": "去AI味", "doubao-pc-optimizer": "电脑优化",
    "doubao-marketing-material-review": "营销素材审核", "doubao-oceanengine-adops-agent": "巨量引擎盯盘",
    "doubao-record": "录音", "doubao-cron-scheduler": "定时任务", "doubao-app-builder": "网页应用构建",
    "browser-task": "浏览器自动化", "byted-mediakit-video": "视频处理", "byted-mediakit-audio": "音频处理",
    "byted-mediakit-image": "图片处理", "byted-mediakit-editing": "音视频剪辑",
    "byted-mediakit-shared": "MediaKit 媒体工具", "artifact-preview": "产物预览", "verifier-hub": "产物校验",
    "frontend-design": "前端设计", "diagram-design": "图示设计", "vercel-react-best-practices": "Vercel React 实践",
    "i-have-adhd": "ADHD 友好开发", "hermes-learns-manim": "Hermes Manim 教学",
}

def d1_query(sql, params=None, is_write=False):
    """Cloudflare D1 HTTP API。写操作直接执行；读操作走 /raw 返回 results。"""
    if not CF_TOKEN or not CF_ACCOUNT:
        raise RuntimeError("缺少 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 环境变量")
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{D1_DB_ID}/query"
    body = json.dumps({"sql": sql, "params": params or []}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": "Bearer " + CF_TOKEN,
        "Content-Type": "application/json",
        "User-Agent": "skill-center-recommend",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode("utf-8", errors="ignore"))
    if not d.get("success"):
        raise RuntimeError("D1 错误: " + json.dumps(d.get("errors", [])[:2], ensure_ascii=False))
    res = d["result"][0]
    if res.get("success") is False:
        raise RuntimeError("D1 查询失败: " + json.dumps(res.get("errors", [])[:2], ensure_ascii=False))
    return res.get("results", [])

def d1_skill_map():
    """skills 表 name -> 行"""
    rows = d1_query("SELECT id,name,cn,cat,tags,biz,status,hot,source,reg,desc FROM skills")
    return {r["name"]: r for r in rows}

def _mymemory(text):
    """免费翻译（MyMemory API，无需 key，每日 5000 字符额度；每天 10 条推荐足够）。
    失败或翻译无中文字符时返回 None。"""
    if not text or not text.strip():
        return None
    url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(
        {"q": text[:450], "langpair": "en|zh-CN"})
    try:
        d = json.load(urllib.request.urlopen(url, timeout=15))
        t = (d.get("responseData") or {}).get("translatedText") or ""
        t = t.strip()
        if t and not t.isascii():
            return t
    except Exception:
        pass
    return None

def auto_cn(name, desc):
    """补录时生成中文名（产品质量门，绝不允许推荐无中文名的技能）：
    1) 人工映射表 CN_MAP（最可靠，优先）
    2) 翻译英文名（连字符转空格，命中率高）
    3) 翻译 desc 前 160 字兜底
    4) 都拿不到可靠中文 → 返回 None，调用方跳过该技能进推荐（宁缺毋滥）
    """
    if name in CN_MAP:
        return CN_MAP[name]
    if os.environ.get("DISABLE_TRANSLATE") == "1":
        return None
    t = _mymemory(name.replace("-", " ").replace("_", " "))
    if not t:
        t = _mymemory((desc or "")[:160])
    if not t:
        return None
    t = t.rstrip("。．.!！?？,，;；:： ")
    if len(t) > 18:
        t = t[:18].rstrip("，。！？、；： ")
    return t or None

def d1_feedback_scores():
    """从 user_skill_states 聚合反馈分（D1 无独立 feedback 表）：
    感兴趣(待安装)×3 + 好用×2 − 没用×2 − 不感兴趣×3，按技能名聚合"""
    fb = {}
    try:
        rows = d1_query(
            "SELECT s.name AS name, ss.status AS status, ss.rating AS rating "
            "FROM user_skill_states ss JOIN skills s ON s.id=ss.skill_id")
        for r in rows:
            nm = r.get("name")
            if not nm:
                continue
            st, rt = r.get("status"), r.get("rating")
            d = fb.setdefault(nm, {})
            if st == "待安装":
                d["感兴趣"] = d.get("感兴趣", 0) + 1
            elif st == "不感兴趣":
                d["不感兴趣"] = d.get("不感兴趣", 0) + 1
            if rt == "好用":
                d["有用"] = d.get("有用", 0) + 1
            elif rt == "没用":
                d["没用"] = d.get("没用", 0) + 1
    except Exception as e:
        print(f"[select] D1 反馈聚合失败（按无反馈处理）：{e}")
    return fb

def d1_installed_set():
    """台账全站默认态已安装的技能名集合"""
    s = set()
    try:
        rows = d1_query("SELECT name,status FROM skills")
        for r in rows:
            if r.get("status") == "已安装":
                s.add(r["name"])
    except Exception as e:
        print(f"[select] D1 台账读取失败（按无已装处理）：{e}")
    return s

def d1_recent_recs(days=14):
    """最近 N 天已推荐的技能名集合（重复抑制）"""
    recent = set()
    try:
        rows = d1_query(
            "SELECT s.name AS name FROM recs r JOIN skills s ON s.id=r.skill_id "
            "WHERE r.date >= date('now', ?)", [f"-{days} days"])
        for r in rows:
            if r.get("name"):
                recent.add(r["name"])
    except Exception as e:
        print(f"[select] D1 推荐记录读取失败（重复抑制跳过）：{e}")
    return recent

def d1_recent_cases(days=7):
    """最近 N 天案例：skill -> 案例名列表（个性化推荐语）"""
    cases = {}
    try:
        rows = d1_query(
            "SELECT s.name AS name, c.name AS case_name FROM cases c JOIN skills s ON s.id=c.skill_id "
            "WHERE c.date >= date('now', ?)", [f"-{days} days"])
        for r in rows:
            if r.get("name") and r.get("case_name"):
                cases.setdefault(r["name"], []).append(r["case_name"])
    except Exception as e:
        print(f"[select] D1 案例读取失败（个性化推荐语跳过）：{e}")
    return cases

def d1_ledger_candidates():
    """兜底候选源：D1 台账『未安装』技能"""
    out = []
    try:
        rows = d1_query("SELECT name,cn,cat,tags,biz,status,hot,source,reg,desc FROM skills WHERE status != '已安装'")
        for r in rows:
            hot = r.get("hot")
            try:
                hot = int(str(hot).replace(",", ""))
            except Exception:
                hot = 0
            out.append({"name": r["name"], "cn": r.get("cn") or "", "repo": r["name"],
                        "desc": r.get("desc") or "",
                        "hot": hot,
                        "source": r.get("source") or "", "src": "ledger"})
    except Exception as e:
        print(f"[select] D1 台账候选拉取失败（跳过兜底）：{e}")
    return out

# ---------- 来源合规校验（防历史债再犯） ----------
# 白名单 = 技能真实托管/分发的安装源。盘点类文章站（csdn/openagentskill/felloai/top-agent-skills
# /agentconn/dev.to/brightcoding/ailinklab/agentskillslist/toolify 等）一律视为不合规，
# 不能作为"安装入口"，挡在台账补录/推荐写入之前。
ALLOWED_SOURCE_DOMAINS = {
    "skills.sh", "skilld.dev", "github.com", "lobehub.com", "agskills.dev",
    "claude.com", "getclaudeskills.com", "agenticskills.io",
    "skillhub.cloud.tencent.com", "aka.doubaocdn.com",
}

def source_ok(source):
    """来源必须是白名单域名且非空；支持 markdown 链接或裸 URL。"""
    s = (source or "").strip()
    if not s:
        return False
    m = re.search(r"https?://([^/\"\s\)\]]+)", s)
    if not m:
        return False
    dom = m.group(1).lower()
    # 去掉 www. 前缀后比对；主域名精确匹配
    core = dom[4:] if dom.startswith("www.") else dom
    return core in ALLOWED_SOURCE_DOMAINS or dom in ALLOWED_SOURCE_DOMAINS

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
    blocked = []
    for it in items:
        name = it["name"]
        if name in m:
            continue
        if not source_ok(it.get("source") or ""):
            blocked.append(name)
            print(f"[write] 拦截补录 {name}：来源不合规（非安装源白名单/空来源）→ {str(it.get('source'))[:60]}")
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
        print("[write] 台账无需补录" + (f"；另有 {len(blocked)} 条因来源不合规被拦截" if blocked else ""))
        return m
    if dry:
        print(f"[write][dry] 将补录台账 {len(need)} 条：{[r['技能名称'] for r in need]}"
              + (f"；拦截 {len(blocked)} 条：{blocked}" if blocked else ""))
        return m
    r = run_cli(["base", "+record-batch-create", "--base-token", BASE_TOKEN, "--table-id", TBL_LEDGER,
                 "--json", json.dumps({"create_records": need}, ensure_ascii=False), "--as", "user"])
    print("[write] 台账补录：", r.stdout[:300], r.stderr[:300])
    # 直接用 create 响应里的 record_id_list（与 need 同序）建映射，避免 +record-list 缓存延迟：
    # 刚建的记录立刻回读常常读不到，会让 write() 误判「台账无记录」而跳过整条推荐记录（2026-10-10 实测踩坑）。
    try:
        created = json.loads(r.stdout)["data"]["record_id_list"]
        if len(created) != len(need):
            raise ValueError(f"created {len(created)} != need {len(need)}")
        for rec, cid in zip(need, created):
            m[rec["技能名称"]] = cid
    except Exception as e:
        print(f"[write] 补录 id 解析失败（{e}），回读台账兜底")
        m = ledger_map()
    return m

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
                 "--json", json.dumps({"create_records": recs}, ensure_ascii=False), "--as", "user"])
    print("[write] 推荐记录：", r.stdout[:400], r.stderr[:400])
    # 回读确认
    r2 = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", TBL_RECS,
                  "--as", "user", "--format", "json", "--limit", "200"])
    try:
        n = len(json.loads(r2.stdout)["data"]["data"])
        print(f"[write] 回读：推荐记录表共 {n} 条（要求 >= 写入数 {len(recs)}）")
    except Exception:
        print("[write] 回读失败，请人工核对")

def write_d1(date_str, dry):
    """产品版写入：直接写 D1（skills 补录 + recs 推荐记录），幂等，不依赖飞书 Base。"""
    plan = json.load(open("/tmp/rec_plan.json", encoding="utf-8"))
    items = plan["for_you"] + plan["trending"]
    m = d1_skill_map()
    need, blocked = [], []
    for it in items:
        if it["name"] in m:
            continue
        if not source_ok(it.get("source") or ""):
            blocked.append(it["name"])
            print(f"[write_d1] 拦截补录 {it['name']}：来源不合规（非安装源白名单/空来源）→ {str(it.get('source'))[:60]}")
            continue
        need.append(it)
    if dry:
        for it in need:
            m[it["name"]] = {"id": -1, "dry": True, "cn": auto_cn(it["name"], it.get("desc") or "")}
        print(f"[write_d1][dry] 将补录台账 {len(need)} 条：{[n['name'] for n in need]}"
              + (f"；拦截 {len(blocked)} 条：{blocked}" if blocked else ""))
    else:
        for it in need:
            name, desc = it["name"], (it.get("desc") or "")
            cat, biz, tag = "效率工具", "[\"内容创作\"]", "[\"自动化\"]"
            low = (name + desc).lower()
            if any(k in low for k in ["math", "edu", "tutor", "teach"]):
                cat, biz, tag = "教学与教研", "[\"教学备课\"]", "[\"教学讲解\"]"
            elif any(k in low for k in ["writ", "polish", "human"]):
                cat, biz, tag = "内容创作", "[\"内容创作\"]", "[\"写作润色\"]"
            elif any(k in low for k in ["video", "anim", "visual"]):
                cat, biz, tag = "视频制作", "[\"口播视频\"]", "[\"视频生成\"]"
            cn2 = auto_cn(name, desc) or name
            res = d1_query(
                "INSERT INTO skills(name,cn,cat,tags,biz,status,backup,hot,source,reg,score,desc,note,created_at) "
                "VALUES(?,?,?,?,?,'未安装','未备份',?,?,NULL,NULL,?,?,datetime('now','localtime'))",
                [name, cn2, cat, tag, biz, it.get("hot") or 0,
                 it.get("source") or "", desc[:500],
                 f"{datetime.now().strftime('%Y-%m-%d')} recommend.py 自动补录"
                 + ("；中文名待人工补" if cn2 == name else "")], is_write=True)
            # INSERT 响应不带 last_row_id，回查一次拿真实 id（8 条以内，开销可忽略）
            got = d1_query("SELECT id FROM skills WHERE name=?", [name])
            m[name] = {"id": got[0]["id"] if got else -1, "cn": cn2}
        if need:
            print(f"[write_d1] 台账补录 {len(need)} 条")
        if blocked:
            print(f"[write_d1] 拦截 {len(blocked)} 条：{blocked}")
    # 写推荐记录（幂等：同 batch+type+skill_id 不重复）
    recs = []
    for it in items:
        row = m.get(it["name"])
        if not row:
            print(f"[write_d1] 跳过 {it['name']}：台账无记录且补录失败"); continue
        sid = row.get("id") or row.get("skill_id")
        # 产品质量门：无真实中文名（cn 为空或等于英文名）的技能不进推荐，
        # 用户永远看不到英文名标题；此类技能留在台账待人工补 CN_MAP 后自然可推
        cn_v = str(row.get("cn") or "")
        if not cn_v or cn_v == it["name"]:
            print(f"[write_d1] 质量门拦截 {it['name']}：无中文名，不写入推荐（待补 CN_MAP/人工命名）")
            continue
        if dry:
            recs.append({"name": it["name"], "type": "为你推荐" if it["tier"] == "for_you" else "全网热门", "skill_id": sid})
            continue
        dup = d1_query("SELECT COUNT(*) AS n FROM recs WHERE batch=? AND type=? AND skill_id=?",
                       [f"{date_str} 推荐", "为你推荐" if it["tier"] == "for_you" else "全网热门", sid])
        if dup and dup[0].get("n"):
            print(f"[write_d1] 跳过已存在：{it['name']}（{date_str} 已推）"); continue
        d1_query(
            "INSERT INTO recs(batch,date,type,skill_id,hot,source,why,created_at) "
            "VALUES(?,?,?,?,?,?,?,datetime('now','localtime'))",
            [f"{date_str} 推荐", date_str, "为你推荐" if it["tier"] == "for_you" else "全网热门",
             sid, str(it.get("hot") or ""), it.get("source") or "", (it.get("why") or "")[:200]],
            is_write=True)
        recs.append({"name": it["name"], "skill_id": sid})
    if dry:
        print(f"[write_d1][dry] 将写推荐记录 {len(recs)} 条（批次 {date_str} 推荐）")
        return
    n = d1_query("SELECT COUNT(*) AS n FROM recs WHERE batch=?", [f"{date_str} 推荐"])
    print(f"[write_d1] 回读：批次 {date_str} 共 {n[0]['n'] if n else 0} 条推荐记录（本次写 {len(recs)}）")

# ---------------- publish ----------------
def export_tables():
    tables = {"ledger_raw": TBL_LEDGER, "recs_raw": TBL_RECS, "cases_raw": TBL_CASES,
              "feedback_raw": TBL_FEEDBACK, "polish_raw": TBL_POLISH, "handbook_raw": TBL_HANDBOOK}
    for fn, tid in tables.items():
        r = run_cli(["base", "+record-list", "--base-token", BASE_TOKEN, "--table-id", tid,
                     "--as", "user", "--format", "json", "--limit", "200"])
        Path(f"/tmp/{fn}.json").write_text(r.stdout, encoding="utf-8")
    print("[publish] 6 表导出完成（台账/推荐/案例/反馈/打磨/手册）")

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
    # 发布是异步的；轮询仅作确认，缩短轮询避免整条 all 管道触发超时（发布本身已完成）
    for i in range(6):
        time.sleep(4)
        r2 = run_cli(["apps", "+release-get", "--app-id", APP_ID, "--release-id", str(rid), "--as", "user", "--format", "json"])
        try:
            st = json.loads(r2.stdout)["data"]["status"]
        except Exception:
            st = "?"
        print(f"[publish] release {rid} status={st}")
        if st == "finished":
            print(f"[publish] 在线页：{ONLINE_URL}")
            return
    print(f"[publish] 轮询结束（release {rid} 末态={st}，发布通常已完成，可访问在线页确认）")

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
    if cmd in ("fetch", "all", "all-d1"):
        fetch()
    if cmd in ("select", "all", "all-d1"):
        select(date_str, use_d1=(cmd == "all-d1"))
    if cmd in ("write", "all"):
        write(date_str, dry)
    if cmd in ("publish", "all"):
        publish(dry)
    if cmd in ("write_d1", "all-d1"):
        write_d1(date_str, dry)
    print(f"[done] recommend.py {cmd} date={date_str} dry={dry}")

if __name__ == "__main__":
    main()

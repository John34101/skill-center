#!/usr/bin/env python3
"""Deploy web/ dist to Cloudflare Pages (Direct Upload via wrangler).

Uses CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from the environment
(GitHub Actions secrets). Auto-picks a Pages project whose name/domains
mention ilovelearning / skill-center; override with PAGES_PROJECT_NAME.

Safe to run from Actions (daily-recommend piggyback) or locally once token is set.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


def die(msg: str, code: int = 1) -> None:
    print(f"[deploy_web] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def cf_api(path: str) -> dict:
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or ""
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or ""
    if not token or not acc:
        die("需要环境变量 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID")
    url = f"https://api.cloudflare.com/client/v4/accounts/{acc}{path}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:1500]
        die(f"CF API HTTP {e.code}: {body}")
    if not data.get("success"):
        die(f"CF API failed: {json.dumps(data)[:1500]}")
    return data


def resolve_project() -> str:
    override = (os.environ.get("PAGES_PROJECT_NAME") or "").strip()
    if override:
        print(f"[deploy_web] PAGES_PROJECT_NAME override: {override}")
        return override
    projects = cf_api("/pages/projects").get("result") or []
    print(f"[deploy_web] Found {len(projects)} Pages project(s):")
    chosen = None
    for p in projects:
        name = p.get("name") or ""
        domains = []
        for d in p.get("domains") or []:
            domains.append(d if isinstance(d, str) else str(d))
        sub = p.get("subdomain") or ""
        print(f"  - {name}  subdomain={sub}  domains={domains}")
        hay = " ".join(domains + [sub, name]).lower()
        if any(k in hay for k in ("ilovelearning", "skill-center", "skill_center", "skillcenter")):
            if chosen is None:
                chosen = name
    if not chosen and len(projects) == 1:
        chosen = projects[0].get("name")
        print(f"[deploy_web] only one project → {chosen}")
    elif chosen:
        print(f"[deploy_web] auto-selected → {chosen}")
    if not chosen:
        die(
            "无法自动匹配 Pages 项目。请设置 PAGES_PROJECT_NAME，"
            "或在 Cloudflare 创建绑定 ilovelearning.top 的 Pages 项目。"
        )
    return chosen


def ensure_node() -> None:
    if shutil.which("node"):
        out = subprocess.check_output(["node", "-v"], text=True).strip()
        print(f"[deploy_web] node {out}")
        return
    print("[deploy_web] installing Node 22…")
    subprocess.check_call(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs",
        shell=True,
    )
    print("[deploy_web] node", subprocess.check_output(["node", "-v"], text=True).strip())


def build() -> Path:
    if not WEB.is_dir():
        die(f"missing {WEB}")
    print("[deploy_web] npm ci && npm run build…")
    subprocess.check_call(["npm", "ci"], cwd=str(WEB))
    subprocess.check_call(["npm", "run", "build"], cwd=str(WEB))
    dist = WEB / "dist"
    meta = dist / "courses" / "sample-efficient-learning" / "meta.json"
    if not meta.is_file():
        die(f"build missing sample course: {meta}")
    print(f"[deploy_web] dist ok ({meta})")
    return dist


def deploy(project: str, dist: Path) -> None:
    print(f"[deploy_web] wrangler pages deploy → {project}")
    env = os.environ.copy()
    subprocess.check_call(
        [
            "npx",
            "-y",
            "wrangler@4",
            "pages",
            "deploy",
            str(dist),
            "--project-name",
            project,
            "--commit-dirty=true",
        ],
        cwd=str(WEB),
        env=env,
    )


def main() -> None:
    print("[deploy_web] start")
    project = resolve_project()
    ensure_node()
    dist = build()
    deploy(project, dist)
    print("[deploy_web] done")


if __name__ == "__main__":
    main()

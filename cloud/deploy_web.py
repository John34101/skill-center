#!/usr/bin/env python3
"""Deploy web/ to whatever hosts ilovelearning.top, or discover how it is hosted.

Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
Optional: PAGES_PROJECT_NAME, DISCOVER_ONLY=1
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
ZONE_ID = "701bed54e48b08d94e374a0b293048ce"  # from docs/P0-产品化设计.md


def die(msg: str, code: int = 1) -> None:
    print(f"[deploy_web] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def token_acc():
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or ""
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or ""
    if not token or not acc:
        die("需要环境变量 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID")
    return token, acc


def cf_api(url: str, method: str = "GET", data: bytes | None = None, soft: bool = False) -> dict:
    token, _ = token_acc()
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:2000]
        if soft:
            print(f"[discover] soft-fail HTTP {e.code} {url}: {body[:400]}")
            return {"success": False, "errors": [{"message": body}], "result": None}
        die(f"CF API HTTP {e.code} {url}: {body}")


def cf_account(path: str) -> dict:
    _, acc = token_acc()
    return cf_api(f"https://api.cloudflare.com/client/v4/accounts/{acc}{path}")


def discover() -> None:
    print("[discover] === Cloudflare account probe ===")
    _, acc = token_acc()
    print(f"[discover] account_id={acc} zone_id={ZONE_ID}")

    pages = cf_account("/pages/projects").get("result") or []
    print(f"[discover] Pages projects: {len(pages)}")
    for p in pages:
        print("  pages:", p.get("name"), "domains=", p.get("domains"), "subdomain=", p.get("subdomain"))

    w = cf_api(f"https://api.cloudflare.com/client/v4/accounts/{acc}/workers/scripts", soft=True)
    scripts = w.get("result") or []
    print(f"[discover] Workers scripts: {len(scripts) if isinstance(scripts, list) else scripts}")
    if isinstance(scripts, list):
        for s in scripts[:40]:
            print("  worker:", s.get("id") or s.get("name") or s)

    routes = cf_api(f"https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/workers/routes", soft=True)
    print("[discover] zone worker routes:", json.dumps(routes.get("result"), ensure_ascii=False)[:2000])

    dns = cf_api(f"https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records?per_page=100", soft=True)
    recs = dns.get("result") or []
    print(f"[discover] DNS records: {len(recs) if isinstance(recs, list) else recs}")
    if isinstance(recs, list):
        for r in recs:
            print(f"  DNS {r.get('type')} {r.get('name')} -> {r.get('content')} proxied={r.get('proxied')}")

    custom = cf_api(f"https://api.cloudflare.com/client/v4/accounts/{acc}/workers/domains", soft=True)
    print("[discover] workers domains:", json.dumps(custom.get("result"), ensure_ascii=False)[:2000])

    r2 = cf_api(f"https://api.cloudflare.com/client/v4/accounts/{acc}/r2/buckets", soft=True)
    print("[discover] R2 buckets:", json.dumps(r2.get("result"), ensure_ascii=False)[:1500])


def resolve_project() -> str:
    override = (os.environ.get("PAGES_PROJECT_NAME") or "").strip()
    if override:
        print(f"[deploy_web] PAGES_PROJECT_NAME override: {override}")
        return override
    projects = cf_account("/pages/projects").get("result") or []
    print(f"[deploy_web] Found {len(projects)} Pages project(s):")
    chosen = None
    for p in projects:
        name = p.get("name") or ""
        domains = [d if isinstance(d, str) else str(d) for d in (p.get("domains") or [])]
        sub = p.get("subdomain") or ""
        print(f"  - {name}  subdomain={sub}  domains={domains}")
        hay = " ".join(domains + [sub, name]).lower()
        if any(k in hay for k in ("ilovelearning", "skill-center", "skill_center", "skillcenter")):
            if chosen is None:
                chosen = name
    if not chosen and len(projects) == 1:
        chosen = projects[0].get("name")
    if not chosen:
        discover()
        die(
            "没有可用的 Cloudflare Pages 项目。ilovelearning.top 可能不是 Pages 托管，"
            "或 API Token 缺少 Account.Cloudflare Pages 权限。"
            "请在 CF Dashboard 确认托管方式，或创建 Pages 项目并设置 PAGES_PROJECT_NAME。"
        )
    print(f"[deploy_web] using project={chosen}")
    return chosen


def ensure_node() -> None:
    if shutil.which("node"):
        print("[deploy_web] node", subprocess.check_output(["node", "-v"], text=True).strip())
        return
    print("[deploy_web] installing Node 22…")
    subprocess.check_call(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs",
        shell=True,
    )


def build() -> Path:
    print("[deploy_web] npm ci && npm run build…")
    subprocess.check_call(["npm", "ci"], cwd=str(WEB))
    subprocess.check_call(["npm", "run", "build"], cwd=str(WEB))
    dist = WEB / "dist"
    meta = dist / "courses" / "sample-efficient-learning" / "meta.json"
    if not meta.is_file():
        die(f"build missing sample course: {meta}")
    return dist


def deploy(project: str, dist: Path) -> None:
    print(f"[deploy_web] wrangler pages deploy → {project}")
    subprocess.check_call(
        ["npx", "-y", "wrangler@4", "pages", "deploy", str(dist),
         "--project-name", project, "--commit-dirty=true"],
        cwd=str(WEB),
    )


def main() -> None:
    print("[deploy_web] start")
    if os.environ.get("DISCOVER_ONLY") == "1":
        discover()
        return
    # Always print discovery breadcrumbs when pages empty path might happen
    project = resolve_project()
    ensure_node()
    dist = build()
    deploy(project, dist)
    print("[deploy_web] done")


if __name__ == "__main__":
    main()

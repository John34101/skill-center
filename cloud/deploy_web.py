#!/usr/bin/env python3
"""Deploy web/dist to Cloudflare Worker skill-center-web (static assets).

Hosts: ilovelearning.top / www.ilovelearning.top
API Worker skill-center-api is separate (api.ilovelearning.top).

Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
WORKER_NAME = os.environ.get("WEB_WORKER_NAME") or "skill-center-web"


def die(msg: str, code: int = 1) -> None:
    print(f"[deploy_web] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def ensure_creds() -> None:
    if not os.environ.get("CLOUDFLARE_API_TOKEN") or not os.environ.get("CLOUDFLARE_ACCOUNT_ID"):
        die("需要环境变量 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID")


def ensure_node() -> None:
    if shutil.which("node"):
        print("[deploy_web] node", subprocess.check_output(["node", "-v"], text=True).strip())
        return
    print("[deploy_web] installing Node 22…")
    subprocess.check_call(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs",
        shell=True,
    )
    print("[deploy_web] node", subprocess.check_output(["node", "-v"], text=True).strip())


def build() -> Path:
    print("[deploy_web] npm ci && npm run build…")
    subprocess.check_call(["npm", "ci"], cwd=str(WEB))
    subprocess.check_call(["npm", "run", "build"], cwd=str(WEB))
    dist = WEB / "dist"
    meta = dist / "courses" / "sample-efficient-learning" / "meta.json"
    if not meta.is_file():
        die(f"build missing sample course: {meta}")
    print(f"[deploy_web] dist ok")
    return dist


def deploy() -> None:
    print(f"[deploy_web] wrangler deploy → Worker {WORKER_NAME} (assets=./dist)")
    # Prefer web/wrangler.toml ([assets] directory); name must match production Worker
    subprocess.check_call(
        ["npx", "-y", "wrangler@4", "deploy"],
        cwd=str(WEB),
        env=os.environ.copy(),
    )


def main() -> None:
    print("[deploy_web] start (skill-center-web Worker assets)")
    ensure_creds()
    ensure_node()
    build()
    deploy()
    print("[deploy_web] done — check https://ilovelearning.top/courses/sample-efficient-learning/meta.json")


if __name__ == "__main__":
    main()

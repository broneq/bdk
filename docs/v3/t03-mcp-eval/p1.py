#!/usr/bin/env python3
"""P1 connect (design D-6): time from process start to the init event, per MCP configuration.

With MCP_CONNECTION_NONBLOCKING=0 and MCP_CONNECT_TIMEOUT_MS=600000 the session emits init only
after every server connected or failed, so time-to-init minus the C0 baseline is the servers' connect
time. MCP_TIMEOUT (the per-server connect timeout, default 30000) is raised to 600000 so a slow cold
start is measured rather than cut off; a start over 30 s is a failure under the default and is
reported as such. The
process is killed at init, before any model turn, so a start costs no tokens.

Usage: p1.py --label <name> --plugin <dir> --cwd <worktree> --starts 10 [--cold] --out <file.jsonl>
  --cold uses a fresh, empty UV_CACHE_DIR and UV_TOOL_DIR per start (the user's own uv cache and
  installed tools are not touched). UV_TOOL_DIR matters: `uvx <pkg>` reuses a matching `uv tool
  install` of the package, so a fresh cache alone is not a cold start.
"""

import argparse
import json
import os
import subprocess
import tempfile
import time


def one_start(plugin, cwd, cold):
    env = dict(os.environ, ENABLE_CLAUDEAI_MCP_SERVERS="false", MCP_CONNECTION_NONBLOCKING="0",
               MCP_CONNECT_TIMEOUT_MS="600000", MCP_TIMEOUT="600000")
    tmp = None
    if cold:
        tmp = tempfile.mkdtemp(prefix="uvcache-", dir=os.environ.get("BENCH"))
        env["UV_CACHE_DIR"] = os.path.join(tmp, "cache")
        env["UV_TOOL_DIR"] = os.path.join(tmp, "tools")
    t0 = time.time()
    p = subprocess.Popen(
        ["claude", "-p", "Reply OK.", "--model", "claude-haiku-4-5-20251001", "--output-format", "stream-json",
         "--verbose", "--plugin-dir", plugin, "--setting-sources", "project,local", "--no-session-persistence"],
        cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    rec = {"cold": cold, "uv_cache": tmp}
    for line in p.stdout:
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("type") == "system" and e.get("subtype") == "init":
            rec["t_init_s"] = round(time.time() - t0, 2)
            rec["servers"] = {m["name"]: m["status"] for m in e.get("mcp_servers", [])}
            break
    p.kill()
    p.wait()
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", required=True)
    ap.add_argument("--plugin", required=True)
    ap.add_argument("--cwd", required=True)
    ap.add_argument("--starts", type=int, default=10)
    ap.add_argument("--cold", action="store_true")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    with open(a.out, "a") as out:
        for i in range(a.starts):
            rec = {"label": a.label, "start": i + 1, **one_start(a.plugin, a.cwd, a.cold)}
            out.write(json.dumps(rec) + "\n")
            out.flush()
            print(json.dumps(rec))


if __name__ == "__main__":
    main()

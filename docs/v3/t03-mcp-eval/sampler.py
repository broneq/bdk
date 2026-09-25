#!/usr/bin/env python3
"""Sample host and benchmark process load once per interval until the root process exits.

Usage: sampler.py --root <pid> --out <file.jsonl> [--interval 1]

Each line: timestamp, load average, and CPU (cores, from cumulative CPU time deltas) and RSS (MB)
per process family, for the process tree under --root and for everything else on the host
("background"). Families are assigned by command line, with language servers counted by ancestry
(a descendant of a serena process), so an editor's own tsserver counts as background.
"""

import argparse
import json
import os
import subprocess
import time


def cpu_seconds(t):
    # ps TIME: [[dd-]hh:]mm:ss.ss
    days = 0
    if "-" in t:
        d, t = t.split("-", 1)
        days = int(d)
    parts = [float(p) for p in t.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0.0)
    h, m, s = parts
    return days * 86400 + h * 3600 + m * 60 + s


def snapshot():
    out = subprocess.run(["ps", "-A", "-o", "pid=,ppid=,rss=,time=,args="], capture_output=True, text=True).stdout
    procs = {}
    for line in out.splitlines():
        f = line.split(None, 4)
        if len(f) < 5:
            continue
        pid, ppid, rss, t, args = int(f[0]), int(f[1]), int(f[2]), f[3], f[4]
        procs[pid] = {"ppid": ppid, "rss_kb": rss, "cpu_s": cpu_seconds(t), "args": args}
    return procs


def ancestors(pid, procs):
    seen = []
    while pid in procs and pid not in seen and pid > 1:
        seen.append(pid)
        pid = procs[pid]["ppid"]
    return seen


def family(pid, procs, root):
    chain = ancestors(pid, procs)
    in_bench = root in chain
    args = procs[pid]["args"]
    name = "other"
    if "code-review-graph" in args:
        name = "graph"
    elif "serena" in args and "start-mcp-server" in args:
        name = "serena"
    elif any("serena" in procs[a]["args"] for a in chain[1:]):
        name = "language_servers"
    elif os.path.basename(args.split()[0]) in ("uv", "uvx"):
        name = "uv"
    elif "claude" in args.split()[0] or "/claude" in args or args.startswith("claude"):
        name = "claude"
    elif "tsc" in args or "tsserver" in args or "typescript" in args:
        name = "tsc"
    return ("bench" if in_bench else "background"), name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--interval", type=float, default=1.0)
    a = ap.parse_args()
    prev = snapshot()
    prev_t = time.time()
    with open(a.out, "a") as out:
        while True:
            time.sleep(a.interval)
            procs = snapshot()
            now = time.time()
            dt = now - prev_t
            agg = {}
            for pid, p in procs.items():
                scope, name = family(pid, procs, a.root)
                key = f"{scope}.{name}"
                d = agg.setdefault(key, {"cpu_cores": 0.0, "rss_mb": 0.0, "n": 0})
                before = prev.get(pid)
                if before and before["args"] == p["args"]:
                    d["cpu_cores"] += max(0.0, p["cpu_s"] - before["cpu_s"]) / dt
                d["rss_mb"] += p["rss_kb"] / 1024
                d["n"] += 1
            load = subprocess.run(["sysctl", "-n", "vm.loadavg"], capture_output=True, text=True).stdout.strip("{} \n")
            rec = {"t": round(now, 2), "load1": float(load.split()[0]),
                   "families": {k: {kk: round(vv, 3) for kk, vv in v.items()} for k, v in sorted(agg.items())}}
            out.write(json.dumps(rec) + "\n")
            out.flush()
            prev, prev_t = procs, now
            if a.root not in procs:
                break


if __name__ == "__main__":
    main()

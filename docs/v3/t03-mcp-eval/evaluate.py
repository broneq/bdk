#!/usr/bin/env python3
"""Evaluate T03 benchmark runs: isolation check, metrics, grading, judge, tables.

Subcommands:
  spent <runs dir>               total USD spent by all evaluated runs and judge calls
  run --cfg ... --stream ...     evaluate one raw run, write <stream>.eval.json
  judge <runs dir> [--task V5]   grade rubric tasks (V5, V6) with a Haiku judge
  table <runs dir>               print per task x config medians and ranges (markdown)
  raw <runs dir>                 print one row per valid run with its raw numbers (markdown)
  verdict <runs dir>             apply the design D-7 value rule per task and comparison (markdown)
"""

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import time
from pathlib import Path

SERVERS = {"C0": [], "CG": ["code-review-graph"], "CS": ["serena"], "CGS": ["code-review-graph", "serena"]}
BUILTIN_PLUGINS = {"agents-md", "telemetry"}
JUDGE_MODEL = "claude-haiku-4-5-20251001"


def load_stream(path):
    events = []
    for line in Path(path).read_text().splitlines():
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def isolation_problems(events, cfg, bench, plugin=None, failure_mode=False):
    """Checks a run's init event against its configuration. failure_mode (design D-8): the servers
    are expected to miss the connect timeout, so their connect status and tools are not checked."""
    init = next((e for e in events if e.get("type") == "system" and e.get("subtype") == "init"), None)
    if init is None:
        return ["no init event"]
    problems = []
    plugins = {p["name"]: p for p in init.get("plugins", [])}
    if set(plugins) != {"bdk"} | BUILTIN_PLUGINS:
        problems.append(f"plugins {sorted(plugins)}")
    elif os.path.realpath(plugins["bdk"]["path"]) != os.path.realpath(f"{bench}/bdk-{plugin or cfg}"):
        problems.append(f"bdk path {plugins['bdk']['path']}")
    want = {f"plugin:bdk:{s}" for s in SERVERS[cfg]}
    got = {m["name"]: m["status"] for m in init.get("mcp_servers", [])}
    if set(got) != want:
        problems.append(f"mcp servers {got}")
    not_connected = [n for n, s in got.items() if s != "connected"]
    if not_connected and not failure_mode:
        problems.append(f"not connected {not_connected}")
    allowed = tuple(f"mcp__plugin_bdk_{s}__" for s in SERVERS[cfg])
    mcp_tools = [t for t in init.get("tools", []) if t.startswith("mcp__")]
    stray = [t for t in mcp_tools if not t.startswith(allowed)] if allowed else mcp_tools
    if stray:
        problems.append(f"stray mcp tools {stray[:5]}")
    for prefix in allowed if not failure_mode else ():
        if not any(t.startswith(prefix) for t in mcp_tools):
            problems.append(f"no tools for {prefix}")
    return problems


def tool_category(name):
    if name.startswith("mcp__plugin_bdk_code-review-graph__"):
        return "graph"
    if name.startswith("mcp__plugin_bdk_serena__"):
        return "serena"
    if name in ("Edit", "Write", "NotebookEdit"):
        return "edit"
    if name in ("Read", "Bash", "Task", "Agent", "ToolSearch", "Skill"):
        return name
    return "other"


def metrics(events, start, end):
    result = next((e for e in reversed(events) if e.get("type") == "result"), {})
    calls = {}
    by_name = {}
    subagent_calls = 0
    for e in events:
        if e.get("type") != "assistant":
            continue
        for block in e.get("message", {}).get("content", []):
            if isinstance(block, dict) and block.get("type") == "tool_use":
                cat = tool_category(block["name"])
                calls[cat] = calls.get(cat, 0) + 1
                by_name[block["name"]] = by_name.get(block["name"], 0) + 1
                if e.get("parent_tool_use_id"):
                    subagent_calls += 1
    usage = result.get("usage", {})
    return {
        "cost_usd": result.get("total_cost_usd"),
        "input_tokens": usage.get("input_tokens"),
        "output_tokens": usage.get("output_tokens"),
        "cache_creation_tokens": usage.get("cache_creation_input_tokens"),
        "cache_read_tokens": usage.get("cache_read_input_tokens"),
        "num_turns": result.get("num_turns"),
        "duration_ms": result.get("duration_ms"),
        "wall_s": round(end - start, 1),
        "is_error": result.get("is_error"),
        "tool_calls": sum(calls.values()),
        "tool_calls_by_kind": calls,
        "tool_calls_by_name": by_name,
        "subagent_tool_calls": subagent_calls,
        "result_text": result.get("result"),
    }


def final_json(text):
    blocks = re.findall(r"```json\s*(.*?)```", text or "", re.S)
    for block in reversed(blocks):
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            continue
    return None


def norm_path(p, worktree):
    p = str(p).strip()
    for prefix in (os.path.realpath(worktree) + "/", worktree + "/", "./"):
        if p.startswith(prefix):
            p = p[len(prefix):]
    return p


def f1(got, expected):
    got, expected = set(got), set(expected)
    if not got and not expected:
        return 1.0, 1.0, 1.0
    tp = len(got & expected)
    precision = tp / len(got) if got else 0.0
    recall = tp / len(expected) if expected else 0.0
    score = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return round(precision, 3), round(recall, 3), round(score, 3)


def grade(task, ref, answer, worktree):
    mode = ref["grading"]
    if mode == "rubric":
        return {"score": None, "pending": "judge"}
    if mode == "build":
        return grade_build(ref, worktree)
    if answer is None:
        return {"score": 0.0, "reason": "no final json block"}
    if mode == "exact":
        file_ok = norm_path(answer.get("file", ""), worktree) == ref["file"]
        line_ok = isinstance(answer.get("line"), int) and abs(answer["line"] - ref["line"]) <= 1
        sig = re.sub(r"\s+", " ", str(answer.get("signature", "")))
        frags = [f for f in ref["signature_must_contain"] if re.sub(r"\s+", " ", f) in sig]
        score = (0.5 if file_ok and line_ok else 0.0) + 0.5 * len(frags) / len(ref["signature_must_contain"])
        return {"score": round(score, 3), "file_ok": file_ok, "line_ok": line_ok, "signature_fragments": len(frags)}
    if mode == "set":
        got = [norm_path(x, worktree) for x in answer.get(ref["key"], []) or []]
        p, r, s = f1(got, ref["expected"])
        out = {"precision": p, "recall": r, "f1": s, "got": got}
        if "secondary" in ref:
            sec = ref["secondary"]
            p2, r2, s2 = f1(answer.get(sec["key"], []) or [], sec["expected"])
            out.update({"secondary_f1": s2, "score": round(0.75 * s + 0.25 * s2, 3)})
        else:
            out["score"] = s
        return out
    raise ValueError(mode)


def grade_build(ref, worktree):
    def sh(cmd):
        return subprocess.run(cmd, cwd=worktree, shell=True, capture_output=True, text=True)

    old = sh("git grep -lw getSortedExecutorVariantKeys -- packages").stdout.split()
    new = sh("git grep -lw sortExecutorVariantKeys -- packages").stdout.split()
    changed = [l.split("\t")[2] for l in sh("git diff --numstat").stdout.splitlines() if l.strip()]
    expected = set(ref["expected_files"])
    checks = {
        "old_name_gone": not old,
        "new_name_in_expected_files": set(new) == expected,
        "only_expected_files_changed": set(changed) == expected,
    }
    tsc = sh("pnpm --filter @vibe/web-core run check")
    checks["web_core_check_passes"] = tsc.returncode == 0
    return {"score": 1.0 if all(checks.values()) else 0.0, "checks": checks,
            "changed": changed, "tsc_tail": tsc.stdout[-600:] if tsc.returncode else ""}


def cmd_run(a):
    events = load_stream(a.stream)
    ref = json.loads(Path(a.tasks, f"{a.task}.reference.json").read_text())
    problems = isolation_problems(events, a.cfg, a.bench, a.plugin, a.failure_mode)
    init = next((e for e in events if e.get("subtype") == "init"), {})
    m = metrics(events, float(a.start), float(a.end))
    answer = final_json(m["result_text"])
    g = grade(a.task, ref, answer, a.worktree) if not problems else {"score": None}
    record = {"cfg": a.cfg, "task": a.task, "model": a.model, "rep": int(a.rep),
              "exit_code": int(a.exit_code), "valid": not problems, "isolation_problems": problems,
              "started_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(float(a.start))),
              "mcp_status_at_init": {x["name"]: x["status"] for x in init.get("mcp_servers", [])},
              "failure_mode": a.failure_mode, "answer": answer, "grade": g, **m}
    Path(a.stream + ".eval.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({k: record[k] for k in ("cfg", "task", "rep", "valid", "cost_usd", "wall_s", "tool_calls")}
                     | {"score": g.get("score"), "problems": problems}))
    return 0 if not problems else 3


def all_evals(runs):
    return sorted(Path(runs).rglob("*.eval.json"))


def cmd_spent(a):
    total = 0.0
    for p in all_evals(a.runs):
        r = json.loads(p.read_text())
        total += r.get("cost_usd") or 0.0
        total += (r.get("grade") or {}).get("judge_cost_usd") or 0.0
    print(round(total, 4))


def cmd_judge(a):
    tasks = Path(__file__).parent / "tasks"
    for p in all_evals(a.runs):
        r = json.loads(p.read_text())
        if r["task"] not in ("V5", "V6") or not r["valid"] or (a.task and r["task"] != a.task):
            continue
        if r["grade"].get("score") is not None and not a.force:
            continue
        ref = json.loads((tasks / f"{r['task']}.reference.json").read_text())
        items = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(ref["rubric"]))
        prompt = (
            "You grade an AI assistant's answer against a reference. Do not use any tools.\n\n"
            f"Task given to the assistant:\n{(tasks / (r['task'] + '.prompt.md')).read_text()}\n"
            f"Reference answer:\n{json.dumps(ref['reference'], indent=2)}\n\n"
            f"Assistant's answer:\n{r['result_text']}\n\n"
            f"Rubric items:\n{items}\n\n"
            "For each rubric item decide whether the assistant's answer satisfies it. "
            'Reply with only a fenced ```json block: {"items": [true|false, ...], "notes": "<one sentence>"}'
        )
        env = dict(os.environ, ENABLE_CLAUDEAI_MCP_SERVERS="false")
        out = subprocess.run(
            ["claude", "-p", prompt, "--model", JUDGE_MODEL, "--output-format", "json",
             "--setting-sources", "local", "--strict-mcp-config", "--no-session-persistence"],
            capture_output=True, text=True, stdin=subprocess.DEVNULL, env=env, cwd=a.runs)
        res = json.loads(out.stdout)
        verdict = final_json(res.get("result"))
        if not verdict or len(verdict.get("items", [])) != len(ref["rubric"]):
            print(f"judge failed for {p}", file=sys.stderr)
            continue
        score = round(sum(bool(x) for x in verdict["items"]) / len(ref["rubric"]), 3)
        r["grade"] = {"score": score, "judge_items": verdict["items"], "judge_notes": verdict.get("notes"),
                      "judge_model": JUDGE_MODEL, "judge_cost_usd": res.get("total_cost_usd"),
                      "spot_check": r["grade"].get("spot_check")}
        p.write_text(json.dumps(r, indent=2) + "\n")
        print(f"{r['task']} {r['cfg']} r{r['rep']}: {score} {verdict['items']}")


def spread(values):
    values = [v for v in values if v is not None]
    if not values:
        return "-"
    med = statistics.median(values)
    return f"{med:.3g} [{min(values):.3g}-{max(values):.3g}]" if len(values) > 1 else f"{med:.3g}"


def cmd_table(a):
    rows = {}
    for p in all_evals(a.runs):
        r = json.loads(p.read_text())
        if not r["valid"] or (a.model and r["model"] != a.model):
            continue
        rows.setdefault((r["model"], r["task"], r["cfg"]), []).append(r)
    print("| model | task | cfg | n | score | cost USD | wall s | turns | tool calls | graph | serena | Bash | Read |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for (model, task, cfg), rs in sorted(rows.items(), key=lambda kv: (kv[0][0], kv[0][1], list(SERVERS).index(kv[0][2]))):
        k = lambda name: [x["tool_calls_by_kind"].get(name, 0) for x in rs]
        print(f"| {model} | {task} | {cfg} | {len(rs)} | {spread([x['grade'].get('score') for x in rs])} | "
              f"{spread([x['cost_usd'] for x in rs])} | {spread([x['wall_s'] for x in rs])} | "
              f"{spread([x['num_turns'] for x in rs])} | {spread([x['tool_calls'] for x in rs])} | "
              f"{spread(k('graph'))} | {spread(k('serena'))} | {spread(k('Bash'))} | {spread(k('Read'))} |")


def cmd_raw(a):
    print("| model | task | cfg | rep | score | cost USD | input+cache tokens | output tokens | turns | wall s | tool calls | graph | serena | subagent calls | file |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    rs = [json.loads(p.read_text()) | {"_p": p} for p in all_evals(a.runs)]
    order = lambda r: (r["model"], r["task"], list(SERVERS).index(r["cfg"]), r["rep"])
    for r in sorted((r for r in rs if r["valid"]), key=order):
        tin = sum(r.get(k) or 0 for k in ("input_tokens", "cache_creation_tokens", "cache_read_tokens"))
        k = r["tool_calls_by_kind"]
        score = r["grade"].get("score")
        print(f"| {r['model']} | {r['task']} | {r['cfg']} | {r['rep']} | {'-' if score is None else round(score, 3)} | "
              f"{r['cost_usd']:.4f} | {tin} | {r.get('output_tokens')} | {r['num_turns']} | {r['wall_s']} | "
              f"{r['tool_calls']} | {k.get('graph', 0)} | {k.get('serena', 0)} | {r.get('subagent_tool_calls', 0)} | "
              f"`{str(r["_p"]).removesuffix(".eval.json")}` |")


# Design D-2: what each configuration is judged against.
COMPARISONS = [("CG", "C0"), ("CS", "C0"), ("CGS", "CG"), ("CGS", "C0")]


def compare(a, b, higher_is_better):
    """D-7 noise rule: a gap between medians counts only if it exceeds the larger of the two ranges."""
    ma, mb = statistics.median(a), statistics.median(b)
    noise = max(max(a) - min(a), max(b) - min(b))
    if abs(ma - mb) <= noise:
        return 0, ma, mb
    better = ma > mb if higher_is_better else ma < mb
    return (1 if better else -1), ma, mb


def cmd_verdict(a):
    rows = {}
    for p in all_evals(a.runs):
        r = json.loads(p.read_text())
        if r["valid"]:
            rows.setdefault((r["task"], r["cfg"]), []).append(r)
    tasks = sorted({t for t, _ in rows})
    print("| comparison | task | correctness | cost USD | wall s | verdict |")
    print("|---|---|---|---|---|---|")
    for x, y in COMPARISONS:
        for task in tasks:
            if (task, x) not in rows or (task, y) not in rows:
                continue
            rx, ry = rows[(task, x)], rows[(task, y)]
            col = lambda rs, f: [f(r) for r in rs]
            score = lambda r: r["grade"].get("score")
            if None in col(rx, score) + col(ry, score):
                continue
            c = compare(col(rx, score), col(ry, score), True)
            cost = compare(col(rx, lambda r: r["cost_usd"]), col(ry, lambda r: r["cost_usd"]), False)
            wall = compare(col(rx, lambda r: r["wall_s"]), col(ry, lambda r: r["wall_s"]), False)
            # Cost and wall time count only at equal correctness, and only for a gap of at least 20%.
            big = lambda m: abs(m[1] - m[2]) >= 0.2 * m[2]
            if c[0]:
                v = "better" if c[0] > 0 else "worse"
            elif c[1] != c[2]:
                v = "no measurable difference (correctness gap within noise)"
            else:
                wins = [n for n, m in (("cost", cost), ("wall", wall)) if m[0] > 0 and big(m)]
                losses = [n for n, m in (("cost", cost), ("wall", wall)) if m[0] < 0 and big(m)]
                v = ("better (" + ", ".join(wins) + ")") if wins else "no measurable difference"
                if losses:
                    v += "; worse " + ", ".join(losses)
            fmt = lambda m, d: f"{m[1]:.{d}f} vs {m[2]:.{d}f}"
            print(f"| {x} vs {y} | {task} | {fmt(c, 3)} | {fmt(cost, 3)} | {fmt(wall, 0)} | {v} |")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("spent"); s.add_argument("runs")
    r = sub.add_parser("run")
    for f in ("cfg", "task", "model", "rep", "stream", "exit-code", "start", "end", "tasks", "worktree", "bench"):
        r.add_argument(f"--{f}", required=True)
    r.add_argument("--plugin", help="plugin copy label when it differs from --cfg (bench/bdk-<label>)")
    r.add_argument("--failure-mode", action="store_true", help="servers expected down (design D-8)")
    j = sub.add_parser("judge"); j.add_argument("runs"); j.add_argument("--task"); j.add_argument("--force", action="store_true")
    t = sub.add_parser("table"); t.add_argument("runs"); t.add_argument("--model")
    v = sub.add_parser("verdict"); v.add_argument("runs")
    w = sub.add_parser("raw"); w.add_argument("runs")
    a = ap.parse_args()
    if a.cmd == "run":
        sys.exit(cmd_run(a))
    if a.cmd == "spent":
        Path(a.runs).mkdir(parents=True, exist_ok=True)
    {"spent": cmd_spent, "judge": cmd_judge, "table": cmd_table, "verdict": cmd_verdict, "raw": cmd_raw}[a.cmd](a)


if __name__ == "__main__":
    main()

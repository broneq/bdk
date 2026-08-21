#!/usr/bin/env python3
"""Run-state mediator for BDK plan execution and code review.

Claude Code removed the Task* tools, so plan-execution state lives here
instead: an immutable plan (identified by the sha256 of its bytes) plus a
gitignored JSON manifest at `.bdk/runs/<run-id>.json`, with git commit
trailers as the durable ground truth behind it.

The manifest is a cache. Git always wins: every read cross-checks the
`BDK-Group` trailers on the branch and corrects the manifest in place when
they disagree. `rebuild` throws the manifest away and re-derives it from
trailers alone, which is the documented recovery after a rebase or squash.

This script is the ONLY reader and writer of the manifest. Do not hand-edit
the JSON - an edit that git does not agree with is discarded on next read.
Use `print` for a human-readable view.

Usage:
    python3 bdk_run_state.py hash-plan <plan-path>
    python3 bdk_run_state.py init --run <id> --plan <path> --base-sha <sha>
                                 --session <id> [--force]
    python3 bdk_run_state.py get --run <id>
    python3 bdk_run_state.py resume --run <id> --session <id> [--force]
    python3 bdk_run_state.py group-done --run <id> --group <n> --commit <sha>
    python3 bdk_run_state.py resolve-range --run <id> --head <sha> [--full]
    python3 bdk_run_state.py review-done --run <id> --reviewed-sha <sha>
                                 [--group <n>] [--counts C,H,M,L] [--report <path>]
    python3 bdk_run_state.py findings-add --run <id> --severity <s> --category <c>
                                 --file <path> [--line <n>] --problem <text> [--fix <text>]
    python3 bdk_run_state.py findings-list --run <id> [--severity <s>] [--format json|prompt]
    python3 bdk_run_state.py rebuild --run <id>
    python3 bdk_run_state.py list [--branch <name>]
    python3 bdk_run_state.py print --run <id>
    python3 bdk_run_state.py run-id --plan <path> [--branch <name>]

All output is JSON on stdout unless noted. Exit 0 on success, 1 on refusal
with a `[bdk-run-state]` message on stderr.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

STATE_DIR = Path(".bdk/runs")
TRAILER_RUN = "BDK-Run"
TRAILER_GROUP = "BDK-Group"
SCHEMA_VERSION = 1
ERR_PREFIX = "[bdk-run-state]"

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")


class Refusal(Exception):
    """A condition the caller must resolve - never a crash, always a message."""


# ---------------------------------------------------------------------------
# slugs and identity
# ---------------------------------------------------------------------------


def slugify(value: str) -> str:
    """Reduce an arbitrary branch or plan name to one filename-safe segment.

    Branch names carry `/` (`feat/foo`), which would otherwise demand nested
    directories under the state dir. Both callers must agree on this exactly,
    which is why it lives here and not in either orchestrator's prose.
    """
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-").lower()
    return slug or "unnamed"


def plan_slug(plan_path: str | Path) -> str:
    return slugify(Path(plan_path).stem)


def run_id(plan_path: str | Path, branch: str) -> str:
    return f"{plan_slug(plan_path)}--{slugify(branch)}"


def hash_plan(plan_path: str | Path) -> str:
    """sha256 of the plan file's bytes.

    Single source of the hash for both verify-plan's stamp and the executor's
    precondition check, so the two cannot drift by algorithm.
    """
    path = Path(plan_path)
    if not path.exists():
        raise Refusal(f"plan not found: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# git
# ---------------------------------------------------------------------------


def git(*args: str, check: bool = True) -> str:
    proc = subprocess.run(
        ["git", *args], capture_output=True, text=True, check=False
    )
    if check and proc.returncode != 0:
        raise Refusal(f"git {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout.strip()


def current_branch() -> str:
    return git("rev-parse", "--abbrev-ref", "HEAD")


def repo_root() -> Path:
    return Path(git("rev-parse", "--show-toplevel"))


def is_ancestor(maybe_ancestor: str, descendant: str) -> bool:
    proc = subprocess.run(
        ["git", "merge-base", "--is-ancestor", maybe_ancestor, descendant],
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.returncode == 0


def commit_exists(sha: str) -> bool:
    proc = subprocess.run(
        ["git", "cat-file", "-e", f"{sha}^{{commit}}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.returncode == 0


def trailer_commits(rid: str, base_sha: str | None = None) -> list[dict]:
    """Every commit reachable from HEAD carrying this run's BDK-Group trailer.

    Read with `--format` trailer interpolation, never `--grep`: `--grep` would
    match the token anywhere in the message body, including a commit that
    merely quotes it.

    Returns oldest-first, so the last entry is the newest group.
    """
    rev = f"{base_sha}..HEAD" if base_sha and commit_exists(base_sha) else "HEAD"
    # `separator=` keeps a repeated key on one line instead of appending a
    # newline that would break the field split.
    fmt = (
        "%H%x1f"
        f"%(trailers:key={TRAILER_RUN},valueonly,separator=%x2C)%x1f"
        f"%(trailers:key={TRAILER_GROUP},valueonly,separator=%x2C)%x1e"
    )
    out = git("log", "--reverse", f"--format={fmt}", rev, check=False)
    commits: list[dict] = []
    for record in out.split("\x1e"):
        record = record.strip("\n")
        if not record:
            continue
        parts = record.split("\x1f")
        if len(parts) != 3:
            continue
        sha, run_val, group_val = (p.strip() for p in parts)
        if not group_val or run_val != rid:
            continue
        try:
            group = int(group_val)
        except ValueError:
            continue
        commits.append({"sha": sha, "group": group})
    return commits


# ---------------------------------------------------------------------------
# gitignore invariant
# ---------------------------------------------------------------------------


def ensure_ignored(manifest_path: Path) -> str | None:
    """Guarantee the manifest is not committable. Idempotent.

    Probes `git check-ignore` first, so an existing rule - wherever it lives,
    including `.git/info/exclude` - is left alone. Only when nothing covers
    the path does this append to the project `.gitignore`, visibly, and say
    so. Runs on every write, not just init: a `.gitignore` can be edited
    mid-run.
    """
    proc = subprocess.run(
        ["git", "check-ignore", "-q", str(manifest_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode == 0:
        return None

    gitignore = repo_root() / ".gitignore"
    existing = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    prefix = "" if (not existing or existing.endswith("\n")) else "\n"
    gitignore.write_text(
        f"{existing}{prefix}# BDK run state - machine-owned, never committed\n/.bdk/\n",
        encoding="utf-8",
    )
    return f"appended '/.bdk/' to {gitignore}"


# ---------------------------------------------------------------------------
# manifest i/o
# ---------------------------------------------------------------------------


def manifest_path(rid: str) -> Path:
    return STATE_DIR / f"{rid}.json"


def read_manifest(rid: str) -> dict:
    path = manifest_path(rid)
    if not path.exists():
        raise Refusal(
            f"no run '{rid}'. Start one with `init`, or list existing runs with `list`."
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise Refusal(
            f"manifest for '{rid}' is not valid JSON ({exc}). "
            f"Recover with `rebuild --run {rid}`."
        ) from exc


def write_manifest(state: dict) -> list[str]:
    """Atomically replace the manifest. Returns any notes worth surfacing."""
    path = manifest_path(state["run_id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    notes = []
    note = ensure_ignored(path)
    if note:
        notes.append(note)

    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return notes


def reconcile(state: dict) -> list[str]:
    """Correct the manifest against git trailers. Git wins, always.

    Called on every read. A crash between the commit and the manifest write
    leaves the commit as the only record - this is what finds it.
    """
    drift: list[str] = []
    commits = trailer_commits(state["run_id"], state.get("base_sha"))
    by_group = {c["group"]: c["sha"] for c in commits}

    recorded = {int(g): sha for g, sha in state.get("groups_done", {}).items()}

    for group, sha in sorted(by_group.items()):
        if recorded.get(group) != sha:
            drift.append(
                f"group {group}: git says {sha[:8]}, manifest said "
                f"{(recorded.get(group) or 'nothing')[:8]}"
            )
        recorded[group] = sha

    for group in sorted(set(recorded) - set(by_group)):
        drift.append(
            f"group {group}: manifest claimed {recorded[group][:8]} but no commit "
            f"on this branch carries that trailer - dropped"
        )
        del recorded[group]

    state["groups_done"] = {str(g): sha for g, sha in sorted(recorded.items())}
    return drift


def claim_session(state: dict, session: str, force: bool) -> list[str]:
    """Enforce single-writer. No time threshold - identity is the whole test.

    A stale-session heuristic would need a timeout longer than the slowest
    group (or it steals a live run) which in turn lengthens the lockout after
    a real crash. `--force` replaces that tuning with an explicit decision.
    """
    owner = state.get("session_id")
    if not owner or owner == session:
        state["session_id"] = session
        return []
    if not force:
        raise Refusal(
            f"run '{state['run_id']}' is held by session {owner}. "
            f"If that session is gone, take it over with --force."
        )
    last = max((int(g) for g in state.get("groups_done", {})), default=None)
    last_sha = state.get("groups_done", {}).get(str(last), "") if last else ""
    state["session_id"] = session
    return [
        f"took over run '{state['run_id']}' from session {owner} "
        f"(plan {state.get('plan_slug')}, branch {state.get('branch')}, "
        f"last group {last if last is not None else 'none'} "
        f"{last_sha[:8] or '-'})"
    ]


# ---------------------------------------------------------------------------
# subcommands
# ---------------------------------------------------------------------------


def cmd_hash_plan(args: argparse.Namespace) -> dict:
    return {"plan": str(args.plan), "sha256": hash_plan(args.plan)}


def cmd_run_id(args: argparse.Namespace) -> dict:
    branch = args.branch or current_branch()
    return {
        "run_id": run_id(args.plan, branch),
        "plan_slug": plan_slug(args.plan),
        "branch": branch,
        "branch_slug": slugify(branch),
    }


def cmd_init(args: argparse.Namespace) -> dict:
    rid = args.run
    path = manifest_path(rid)
    notes: list[str] = []

    if path.exists():
        state = read_manifest(rid)
        notes += claim_session(state, args.session, args.force)
        existing_hash = state.get("plan_sha256")
        new_hash = hash_plan(args.plan)
        if existing_hash != new_hash:
            notes.append(
                "plan file changed since this run started - the plan is meant to be "
                "immutable. Groups already committed still stand; re-verify before "
                "continuing."
            )
            state["plan_sha256"] = new_hash
        notes += reconcile(state)
        state["existed"] = True
    else:
        branch = current_branch()
        state = {
            "schema_version": SCHEMA_VERSION,
            "run_id": rid,
            "plan": str(args.plan),
            "plan_slug": plan_slug(args.plan),
            "plan_sha256": hash_plan(args.plan),
            "branch": branch,
            "branch_slug": slugify(branch),
            "base_sha": args.base_sha,
            "session_id": args.session,
            "groups_done": {},
            "reviewed_sha": None,
            "reviews": [],
            "deferred_findings": [],
        }
        # A missing manifest does not mean a missing run: the trailers on this
        # branch may already record completed groups (manifest deleted, fresh
        # clone, `.bdk/` wiped). Recover them rather than re-running group 1.
        recovered = reconcile(state)
        if recovered:
            notes.append(
                f"no manifest for '{rid}', but {len(state['groups_done'])} group(s) are "
                f"recorded in git trailers on this branch - recovered from git"
            )
        state["existed"] = bool(state["groups_done"])

    existed = state.pop("existed")
    notes += write_manifest(state)
    return {
        "run_id": rid,
        "manifest": str(manifest_path(rid)),
        "resumed": existed,
        "base_sha": state["base_sha"],
        "plan_sha256": state["plan_sha256"],
        "groups_done": sorted(int(g) for g in state["groups_done"]),
        "notes": notes,
    }


def cmd_get(args: argparse.Namespace) -> dict:
    state = read_manifest(args.run)
    drift = reconcile(state)
    if drift:
        write_manifest(state)
    return {**{k: v for k, v in state.items()}, "drift": drift}


def cmd_resume(args: argparse.Namespace) -> dict:
    state = read_manifest(args.run)
    notes = claim_session(state, args.session, args.force)
    drift = reconcile(state)
    notes += write_manifest(state)
    done = sorted(int(g) for g in state["groups_done"])
    return {
        "run_id": state["run_id"],
        "manifest": str(manifest_path(args.run)),
        "plan": state["plan"],
        "plan_sha256": state["plan_sha256"],
        "base_sha": state["base_sha"],
        "branch": state["branch"],
        "groups_done": done,
        "next_group": (max(done) + 1) if done else 1,
        "reviewed_sha": state.get("reviewed_sha"),
        "deferred_findings": len(state.get("deferred_findings", [])),
        "drift": drift,
        "notes": notes,
    }


def cmd_group_done(args: argparse.Namespace) -> dict:
    state = read_manifest(args.run)
    if not commit_exists(args.commit):
        raise Refusal(f"commit {args.commit} does not exist")
    sha = git("rev-parse", args.commit)
    state.setdefault("groups_done", {})[str(args.group)] = sha
    notes = write_manifest(state)

    recorded = {c["group"] for c in trailer_commits(state["run_id"], state.get("base_sha"))}
    if args.group not in recorded:
        notes.append(
            f"commit {sha[:8]} carries no '{TRAILER_GROUP}: {args.group}' trailer for this "
            f"run, so this group cannot survive a rebase. Commit with "
            f"--trailer '{TRAILER_RUN}={state['run_id']}' "
            f"--trailer '{TRAILER_GROUP}={args.group}' "
            f"(repeated -m does NOT produce trailers: git parses only the last paragraph)."
        )
    return {
        "run_id": state["run_id"],
        "group": args.group,
        "commit": sha,
        "groups_done": sorted(int(g) for g in state["groups_done"]),
        "notes": notes,
    }


def cmd_resolve_range(args: argparse.Namespace) -> dict:
    """Decide what a review should actually look at. All git subtlety is here.

    Both orchestrators call this rather than reasoning about the watermark
    themselves, so `cr` and the executor cannot disagree about what "delta"
    means.
    """
    state = read_manifest(args.run)
    reconcile(state)
    base = state["base_sha"]
    head = git("rev-parse", args.head)
    warnings: list[str] = []
    watermark = state.get("reviewed_sha")

    if args.full:
        anchor, source = base, "full (requested)"
    elif not watermark:
        anchor, source = base, "full (first pass)"
    elif not commit_exists(watermark) or not is_ancestor(watermark, head):
        # History was rewritten under the watermark. Recover the boundary from
        # the trailers rather than guessing an equivalent commit.
        recovered = _recover_watermark(state, watermark)
        if recovered:
            anchor, source = recovered, "delta (recovered from trailer)"
            warnings.append(
                f"watermark {watermark[:8]} is no longer on this branch; recovered the "
                f"boundary from a {TRAILER_GROUP} trailer at {recovered[:8]}"
            )
        else:
            anchor, source = base, "full (degraded)"
            warnings.append(
                f"watermark {watermark[:8]} is no longer on this branch and no "
                f"{TRAILER_GROUP} trailer identifies an equivalent commit - reviewing "
                f"the whole branch rather than guessing a boundary"
            )
    else:
        anchor, source = watermark, "delta"

    count = git("rev-list", "--count", f"{anchor}..{head}", check=False)
    commits = int(count) if count.isdigit() else 0
    files = (
        git("diff", "--name-only", f"{anchor}..{head}", check=False).splitlines()
        if commits
        else []
    )
    cumulative = git("diff", "--name-only", f"{base}..{head}", check=False).splitlines()

    return {
        "run_id": state["run_id"],
        "base_sha": base,
        "anchor_sha": anchor,
        "head_sha": head,
        "anchor_source": source,
        "range_mode": "empty" if commits == 0 else ("full" if anchor == base else "delta"),
        "commits_in_range": commits,
        "delta_files": [f for f in files if f],
        "cumulative_files": [f for f in cumulative if f],
        "suppressed_findings": len(state.get("deferred_findings", [])),
        "warnings": warnings,
    }


def _recover_watermark(state: dict, watermark: str) -> str | None:
    """Find the rewritten commit that ends the same group the watermark did."""
    group = None
    for review in reversed(state.get("reviews", [])):
        if review.get("reviewed_sha") == watermark:
            group = review.get("group")
            break
    if group is None:
        return None
    for commit in trailer_commits(state["run_id"], state.get("base_sha")):
        if commit["group"] == group:
            return commit["sha"]
    return None


def cmd_review_done(args: argparse.Namespace) -> dict:
    state = read_manifest(args.run)
    if args.reviewed_sha.upper() == "HEAD":
        raise Refusal(
            "refusing the literal 'HEAD' as a watermark - it is not durable. "
            "Pass the resolved sha from `resolve-range`."
        )
    if not commit_exists(args.reviewed_sha):
        raise Refusal(f"commit {args.reviewed_sha} does not exist")
    sha = git("rev-parse", args.reviewed_sha)

    previous = state.get("reviewed_sha")
    if previous and commit_exists(previous) and not is_ancestor(previous, sha):
        raise Refusal(
            f"{sha[:8]} does not descend from the current watermark {previous[:8]}; "
            f"the watermark only moves forward. Use --full to re-review instead."
        )

    counts = _parse_counts(args.counts)
    state["reviewed_sha"] = sha
    state.setdefault("reviews", []).append(
        {
            "reviewed_sha": sha,
            "group": args.group,
            "counts": counts,
            "report": args.report,
        }
    )
    notes = write_manifest(state)
    return {
        "run_id": state["run_id"],
        "reviewed_sha": sha,
        "group": args.group,
        "counts": counts,
        "report": args.report,
        "notes": notes,
    }


def _parse_counts(raw: str | None) -> dict:
    if not raw:
        return {}
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != len(SEVERITIES) or not all(p.isdigit() for p in parts):
        raise Refusal(
            f"--counts must be four integers 'C,H,M,L' (got {raw!r})"
        )
    return dict(zip(SEVERITIES, (int(p) for p in parts)))


def cmd_findings_add(args: argparse.Namespace) -> dict:
    state = read_manifest(args.run)
    severity = args.severity.upper()
    if severity not in SEVERITIES:
        raise Refusal(f"--severity must be one of {', '.join(SEVERITIES)}")
    finding = {
        "severity": severity,
        "category": args.category,
        "file": args.file,
        "line": args.line,
        "problem": args.problem,
        "fix": args.fix,
    }
    findings = state.setdefault("deferred_findings", [])
    key = (severity, args.category, args.file, args.line, args.problem)
    if any(
        (f["severity"], f["category"], f["file"], f.get("line"), f["problem"]) == key
        for f in findings
    ):
        return {"run_id": state["run_id"], "added": False, "total": len(findings)}
    findings.append(finding)
    notes = write_manifest(state)
    return {
        "run_id": state["run_id"],
        "added": True,
        "total": len(findings),
        "notes": notes,
    }


def cmd_findings_list(args: argparse.Namespace) -> dict | str:
    state = read_manifest(args.run)
    findings = state.get("deferred_findings", [])
    if args.severity:
        wanted = args.severity.upper()
        findings = [f for f in findings if f["severity"] == wanted]

    if args.format == "prompt":
        if not findings:
            return ""
        lines = [
            "## Already triaged - do NOT report these again",
            "",
            "The coordinator saw each of these and deliberately deferred it. "
            "Re-reporting one is noise, not a finding.",
            "",
        ]
        for f in findings:
            where = f["file"] + (f":{f['line']}" if f.get("line") else "")
            lines.append(f"- [{f['severity']}] {f['category']} → {where} → {f['problem']}")
        return "\n".join(lines) + "\n"

    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in SEVERITIES}
    return {
        "run_id": state["run_id"],
        "findings": findings,
        "counts": counts,
        "total": len(findings),
    }


def cmd_rebuild(args: argparse.Namespace) -> dict:
    """Re-derive progress from trailers alone, discarding manifest progress.

    The manifest's own record of which groups are done is exactly what a
    rebase invalidates, so this trusts nothing but git for that. Identity
    fields (plan, base) are not recoverable from trailers and are kept.
    """
    state = read_manifest(args.run)
    before = sorted(int(g) for g in state.get("groups_done", {}))
    state["groups_done"] = {}
    drift = reconcile(state)
    after = sorted(int(g) for g in state["groups_done"])

    watermark = state.get("reviewed_sha")
    if watermark and (not commit_exists(watermark) or not is_ancestor(watermark, "HEAD")):
        state["reviewed_sha"] = None
        drift.append(
            f"watermark {watermark[:8]} is no longer on this branch - cleared, so the "
            f"next review covers the full branch"
        )

    notes = write_manifest(state)
    return {
        "run_id": state["run_id"],
        "groups_before": before,
        "groups_done": after,
        "reviewed_sha": state.get("reviewed_sha"),
        "drift": drift,
        "notes": notes,
    }


def cmd_list(args: argparse.Namespace) -> dict:
    runs = []
    if STATE_DIR.exists():
        for path in sorted(STATE_DIR.glob("*.json")):
            try:
                state = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                runs.append({"run_id": path.stem, "unreadable": True})
                continue
            if args.branch and state.get("branch") != args.branch:
                continue
            done = sorted(int(g) for g in state.get("groups_done", {}))
            runs.append(
                {
                    "run_id": state.get("run_id", path.stem),
                    "plan": state.get("plan"),
                    "branch": state.get("branch"),
                    "groups_done": done,
                    "reviewed_sha": state.get("reviewed_sha"),
                    "session_id": state.get("session_id"),
                }
            )
    return {"runs": runs}


def cmd_print(args: argparse.Namespace) -> str:
    state = read_manifest(args.run)
    drift = reconcile(state)
    done = sorted(int(g) for g in state.get("groups_done", {}))
    findings = state.get("deferred_findings", [])
    lines = [
        f"run          {state.get('run_id')}",
        f"plan         {state.get('plan')}",
        f"plan sha256  {(state.get('plan_sha256') or '')[:16]}",
        f"branch       {state.get('branch')}",
        f"base         {(state.get('base_sha') or '')[:12]}",
        f"session      {state.get('session_id')}",
        f"groups done  {', '.join(map(str, done)) or 'none'}",
        f"reviewed to  {(state.get('reviewed_sha') or 'never')[:12]}",
        f"deferred     {len(findings)} finding(s)",
    ]
    for group in done:
        lines.append(f"  group {group} → {state['groups_done'][str(group)][:12]}")
    for review in state.get("reviews", []):
        counts = review.get("counts") or {}
        summary = " ".join(f"{k[0]}{v}" for k, v in counts.items()) or "-"
        lines.append(
            f"  review  {review['reviewed_sha'][:12]} group="
            f"{review.get('group') or '-'} {summary}"
        )
    for note in drift:
        lines.append(f"  drift: {note}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# cli
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bdk_run_state.py", description=__doc__.split("\n")[0]
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("hash-plan", help="sha256 of a plan file's bytes")
    p.add_argument("plan")
    p.set_defaults(func=cmd_hash_plan)

    p = sub.add_parser("run-id", help="derive the run id for a plan + branch")
    p.add_argument("--plan", required=True)
    p.add_argument("--branch")
    p.set_defaults(func=cmd_run_id)

    p = sub.add_parser("init", help="create or re-claim a run manifest")
    p.add_argument("--run", required=True)
    p.add_argument("--plan", required=True)
    p.add_argument("--base-sha", required=True)
    p.add_argument("--session", required=True)
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("get", help="read raw run state")
    p.add_argument("--run", required=True)
    p.set_defaults(func=cmd_get)

    p = sub.add_parser("resume", help="claim a run and report the next group")
    p.add_argument("--run", required=True)
    p.add_argument("--session", required=True)
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_resume)

    p = sub.add_parser("group-done", help="record a completed group's commit")
    p.add_argument("--run", required=True)
    p.add_argument("--group", type=int, required=True)
    p.add_argument("--commit", required=True)
    p.set_defaults(func=cmd_group_done)

    p = sub.add_parser("resolve-range", help="resolve what a review should cover")
    p.add_argument("--run", required=True)
    p.add_argument("--head", default="HEAD")
    p.add_argument("--full", action="store_true")
    p.set_defaults(func=cmd_resolve_range)

    p = sub.add_parser("review-done", help="advance the review watermark")
    p.add_argument("--run", required=True)
    p.add_argument("--reviewed-sha", required=True)
    p.add_argument("--group", type=int)
    p.add_argument("--counts", help="'C,H,M,L'")
    p.add_argument("--report")
    p.set_defaults(func=cmd_review_done)

    p = sub.add_parser("findings-add", help="defer one MEDIUM/LOW finding")
    p.add_argument("--run", required=True)
    p.add_argument("--severity", required=True)
    p.add_argument("--category", required=True)
    p.add_argument("--file", required=True)
    p.add_argument("--line", type=int)
    p.add_argument("--problem", required=True)
    p.add_argument("--fix")
    p.set_defaults(func=cmd_findings_add)

    p = sub.add_parser("findings-list", help="read deferred findings")
    p.add_argument("--run", required=True)
    p.add_argument("--severity")
    p.add_argument("--format", choices=("json", "prompt"), default="json")
    p.set_defaults(func=cmd_findings_list)

    p = sub.add_parser("rebuild", help="re-derive progress from git trailers")
    p.add_argument("--run", required=True)
    p.set_defaults(func=cmd_rebuild)

    p = sub.add_parser("list", help="list known runs")
    p.add_argument("--branch")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("print", help="human-readable view of one run")
    p.add_argument("--run", required=True)
    p.set_defaults(func=cmd_print)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = args.func(args)
    except Refusal as exc:
        print(f"{ERR_PREFIX} {exc}", file=sys.stderr)
        return 1
    if isinstance(result, str):
        if result:
            print(result)
    else:
        print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())

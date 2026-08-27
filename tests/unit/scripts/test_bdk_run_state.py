"""Tests for scripts/bdk_run_state.py.

The script mediates plan-execution state for two orchestrators, and its whole
premise is that git trailers outrank the manifest. So most of these tests
build a real throwaway repo, commit with trailers, then rewrite history and
assert the script recovers rather than trusting its own cache.
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[3] / "scripts" / "bdk_run_state.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("bdk_run_state", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


state_mod = _load_module()
slugify = state_mod.slugify
plan_slug = state_mod.plan_slug
run_id = state_mod.run_id
hash_plan = state_mod.hash_plan
Refusal = state_mod.Refusal


def _run(args: list[str], cwd: Path, at: str | None = None) -> subprocess.CompletedProcess:
    # `at` pins the script's clock (BDK_NOW) so a timing test can assert an
    # exact elapsed value instead of only that some stamp exists.
    env = {**os.environ}
    if at:
        env["BDK_NOW"] = at
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env=env,
    )


def _ok(args: list[str], cwd: Path, at: str | None = None) -> dict:
    proc = _run(args, cwd, at)
    assert proc.returncode == 0, f"{args} failed: {proc.stderr}"
    return json.loads(proc.stdout) if proc.stdout.strip() else {}


def _git(cwd: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True, check=True
    )
    return proc.stdout.strip()


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A throwaway git repo with a plan file and one base commit."""
    _git(tmp_path, "init", "-q", "-b", "main")
    _git(tmp_path, "config", "user.email", "t@example.com")
    _git(tmp_path, "config", "user.name", "T")
    (tmp_path / "README.md").write_text("base\n")
    plans = tmp_path / ".bdk" / "plans"
    plans.mkdir(parents=True)
    (plans / "add-oauth.md").write_text("# Plan\n\nGroup 1\nGroup 2\n")
    _git(tmp_path, "add", "README.md")
    _git(tmp_path, "commit", "-q", "-m", "base")
    return tmp_path


PLAN = ".bdk/plans/add-oauth.md"
RUN = "add-oauth--main"


def _commit_group(repo: Path, group: int, rid: str = RUN, body: str | None = None) -> str:
    marker = repo / f"file{group}.txt"
    marker.write_text(body or f"group {group}\n")
    _git(repo, "add", marker.name)
    # `--trailer`, not repeated `-m`: each `-m` starts its own paragraph, and
    # git only parses the LAST paragraph as trailers, so `-m 'BDK-Run: …' -m
    # 'BDK-Group: …'` silently yields one recognised trailer out of two.
    _git(
        repo,
        "commit",
        "-q",
        "-m",
        f"feat: group {group}",
        "--trailer",
        f"BDK-Run={rid}",
        "--trailer",
        f"BDK-Group={group}",
    )
    return _git(repo, "rev-parse", "HEAD")


def _init(
    repo: Path,
    session: str = "s1",
    extra: list[str] | None = None,
    base: str | None = None,
    at: str | None = None,
) -> dict:
    # The real coordinator passes the merge-base, which stays fixed for the
    # life of the run - not HEAD, which moves with every group.
    base = base or _git(repo, "rev-list", "--max-parents=0", "HEAD")
    return _ok(
        [
            "init",
            "--run",
            RUN,
            "--plan",
            PLAN,
            "--base-sha",
            base,
            "--session",
            session,
            *(extra or []),
        ],
        repo,
        at,
    )


# ---------------------------------------------------------------------------
# slugs and identity
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("feat/foo", "feat-foo"),
        ("main", "main"),
        ("release/2026-08-21", "release-2026-08-21"),
        ("Feature/Add_OAuth", "feature-add-oauth"),
        ("///", "unnamed"),
        ("", "unnamed"),
    ],
)
def test_slugify_yields_one_filename_safe_segment(raw: str, expected: str) -> None:
    assert slugify(raw) == expected
    assert "/" not in slugify(raw)


def test_run_id_pairs_plan_and_branch(repo: Path) -> None:
    assert run_id(repo / PLAN, "feat/foo") == "add-oauth--feat-foo"


def test_run_id_of_a_slashed_branch_stays_a_single_path_segment(repo: Path) -> None:
    """A nested run id would need a directory the script never creates."""
    out = _ok(["run-id", "--plan", PLAN, "--branch", "feat/deep/nesting"], repo)
    assert "/" not in out["run_id"]


def test_hash_plan_is_stable_and_content_addressed(repo: Path) -> None:
    first = _ok(["hash-plan", PLAN], repo)["sha256"]
    second = _ok(["hash-plan", PLAN], repo)["sha256"]
    assert first == second
    (repo / PLAN).write_text("# Plan\n\nGroup 1\nGroup 2\nGroup 3\n")
    assert _ok(["hash-plan", PLAN], repo)["sha256"] != first


def test_hash_plan_refuses_a_missing_plan(repo: Path) -> None:
    proc = _run(["hash-plan", "nope.md"], repo)
    assert proc.returncode == 1
    assert "[bdk-run-state]" in proc.stderr


# ---------------------------------------------------------------------------
# init and the gitignore invariant
# ---------------------------------------------------------------------------


def test_init_creates_the_manifest_under_the_state_dir(repo: Path) -> None:
    out = _init(repo)
    assert out["resumed"] is False
    assert (repo / ".bdk" / "runs" / f"{RUN}.json").exists()


def test_init_writes_gitignore_when_nothing_covers_the_manifest(repo: Path) -> None:
    out = _init(repo)
    assert any("/.bdk/" in n for n in out["notes"]), out["notes"]
    assert "/.bdk/" in (repo / ".gitignore").read_text()


def test_manifest_is_actually_ignored_by_git_after_init(repo: Path) -> None:
    _init(repo)
    proc = subprocess.run(
        ["git", "check-ignore", "-q", f".bdk/runs/{RUN}.json"],
        cwd=str(repo),
        check=False,
    )
    assert proc.returncode == 0


def test_gitignore_append_is_idempotent(repo: Path) -> None:
    _init(repo)
    first = (repo / ".gitignore").read_text()
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", _commit_group(repo, 1)], repo)
    assert (repo / ".gitignore").read_text() == first


def test_existing_gitignore_rule_is_left_alone(repo: Path) -> None:
    (repo / ".gitignore").write_text(".bdk/\n")
    out = _init(repo)
    assert not any("/.bdk/" in n for n in out["notes"])
    assert (repo / ".gitignore").read_text() == ".bdk/\n"


def test_rule_in_git_info_exclude_also_counts_as_covered(repo: Path) -> None:
    """check-ignore is the probe precisely so this case needs no special code."""
    exclude = repo / ".git" / "info"
    exclude.mkdir(parents=True, exist_ok=True)
    (exclude / "exclude").write_text("/.bdk/\n")
    out = _init(repo)
    assert not any("/.bdk/" in n for n in out["notes"])
    assert not (repo / ".gitignore").exists()


def test_init_on_an_existing_run_resumes_it(repo: Path) -> None:
    _init(repo)
    out = _init(repo)
    assert out["resumed"] is True


def test_init_warns_when_the_immutable_plan_changed(repo: Path) -> None:
    _init(repo)
    (repo / PLAN).write_text("# Plan\n\nGroup 1\nGroup 2\nGroup 3\n")
    out = _init(repo)
    assert any("plan file changed" in n for n in out["notes"]), out["notes"]


# ---------------------------------------------------------------------------
# atomic writes
# ---------------------------------------------------------------------------


def test_write_leaves_the_original_intact_when_serialisation_fails(repo: Path) -> None:
    """os.replace means a crash mid-write cannot produce a truncated manifest."""
    _init(repo)
    path = repo / ".bdk" / "runs" / f"{RUN}.json"
    before = path.read_text()

    cwd = os.getcwd()
    os.chdir(repo)
    try:
        state = json.loads(before)
        state["boom"] = {1, 2}  # a set is not JSON-serialisable
        with pytest.raises(TypeError):
            state_mod.write_manifest(state)
    finally:
        os.chdir(cwd)

    assert path.read_text() == before
    assert not list(path.parent.glob(".tmp-*")), "temp file left behind"


# ---------------------------------------------------------------------------
# git is ground truth
# ---------------------------------------------------------------------------


def test_group_done_records_the_resolved_sha(repo: Path) -> None:
    _init(repo)
    sha = _commit_group(repo, 1)
    out = _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha], repo)
    assert out["commit"] == sha
    assert out["groups_done"] == [1]


def test_group_done_warns_when_the_commit_carries_no_trailer(repo: Path) -> None:
    _init(repo)
    (repo / "x.txt").write_text("x\n")
    _git(repo, "add", "x.txt")
    _git(repo, "commit", "-q", "-m", "feat: no trailer")
    sha = _git(repo, "rev-parse", "HEAD")
    out = _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha], repo)
    assert any("cannot survive a rebase" in n for n in out["notes"]), out["notes"]


def test_group_done_refuses_a_nonexistent_commit(repo: Path) -> None:
    _init(repo)
    proc = _run(
        ["group-done", "--run", RUN, "--group", "1", "--commit", "0" * 40], repo
    )
    assert proc.returncode == 1
    assert "[bdk-run-state]" in proc.stderr


def test_a_deleted_manifest_is_fully_recovered_from_trailers(repo: Path) -> None:
    """The manifest is a cache. Losing it must not lose the run."""
    _init(repo)
    sha1 = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha1], repo)
    sha2 = _commit_group(repo, 2)
    _ok(["group-done", "--run", RUN, "--group", "2", "--commit", sha2], repo)

    (repo / ".bdk" / "runs" / f"{RUN}.json").unlink()
    out = _init(repo)
    assert out["groups_done"] == [1, 2]


def test_a_group_committed_but_never_recorded_is_picked_up(repo: Path) -> None:
    """Crashing between the commit and the manifest write must be survivable."""
    _init(repo)
    _commit_group(repo, 1)  # deliberately no group-done
    out = _ok(["resume", "--run", RUN, "--session", "s1"], repo)
    assert out["groups_done"] == [1]
    assert out["next_group"] == 2
    assert any("group 1" in d for d in out["drift"]), out["drift"]


def test_amend_rewrites_the_sha_and_the_manifest_follows(repo: Path) -> None:
    _init(repo)
    sha = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha], repo)
    (repo / "file1.txt").write_text("amended\n")
    _git(repo, "add", "file1.txt")
    _git(repo, "commit", "-q", "--amend", "--no-edit")
    amended = _git(repo, "rev-parse", "HEAD")
    assert amended != sha

    out = _ok(["get", "--run", RUN], repo)
    assert out["groups_done"]["1"] == amended
    assert out["drift"], "rewritten sha should be reported as drift"


def test_a_trailer_from_another_run_is_ignored(repo: Path) -> None:
    _init(repo)
    _commit_group(repo, 1, rid="some-other-plan--main")
    out = _ok(["resume", "--run", RUN, "--session", "s1"], repo)
    assert out["groups_done"] == []


def test_rebuild_rederives_progress_from_trailers_alone(repo: Path) -> None:
    _init(repo)
    sha1 = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha1], repo)

    # Fabricate a group the trailers do not support, as a rebase would.
    path = repo / ".bdk" / "runs" / f"{RUN}.json"
    state = json.loads(path.read_text())
    state["groups_done"]["7"] = "0" * 40
    path.write_text(json.dumps(state))

    out = _ok(["rebuild", "--run", RUN], repo)
    assert out["groups_done"] == [1]
    assert 7 in out["groups_before"]


# ---------------------------------------------------------------------------
# session claim
# ---------------------------------------------------------------------------


def test_the_owning_session_always_proceeds(repo: Path) -> None:
    _init(repo, session="s1")
    out = _ok(["resume", "--run", RUN, "--session", "s1"], repo)
    assert out["notes"] == []


def test_a_foreign_session_is_refused_with_a_takeover_hint(repo: Path) -> None:
    _init(repo, session="s1")
    proc = _run(["resume", "--run", RUN, "--session", "s2"], repo)
    assert proc.returncode == 1
    assert "--force" in proc.stderr
    assert "s1" in proc.stderr


def test_force_takes_over_and_names_what_it_stole(repo: Path) -> None:
    _init(repo, session="s1")
    sha = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha], repo)

    out = _ok(["resume", "--run", RUN, "--session", "s2", "--force"], repo)
    stolen = " ".join(out["notes"])
    assert "s1" in stolen
    assert "add-oauth" in stolen
    assert "main" in stolen
    assert sha[:8] in stolen


def test_after_a_takeover_the_new_session_owns_it(repo: Path) -> None:
    _init(repo, session="s1")
    _ok(["resume", "--run", RUN, "--session", "s2", "--force"], repo)
    assert _ok(["resume", "--run", RUN, "--session", "s2"], repo)["notes"] == []
    assert _run(["resume", "--run", RUN, "--session", "s1"], repo).returncode == 1


def test_no_time_threshold_is_involved(repo: Path) -> None:
    """A fresh run held by a foreign session is refused on identity alone."""
    _init(repo, session="s1")
    proc = _run(["resume", "--run", RUN, "--session", "s2"], repo)
    assert proc.returncode == 1
    assert "stale" not in proc.stderr.lower()


# ---------------------------------------------------------------------------
# watermark
# ---------------------------------------------------------------------------


def test_review_done_refuses_the_literal_head(repo: Path) -> None:
    _init(repo)
    _commit_group(repo, 1)
    proc = _run(["review-done", "--run", RUN, "--reviewed-sha", "HEAD"], repo)
    assert proc.returncode == 1
    assert "not durable" in proc.stderr


def test_review_done_records_the_resolved_sha_and_counts(repo: Path) -> None:
    _init(repo)
    sha = _commit_group(repo, 1)
    out = _ok(
        [
            "review-done",
            "--run",
            RUN,
            "--reviewed-sha",
            sha,
            "--group",
            "1",
            "--counts",
            "0,2,3,4",
            "--report",
            ".bdk/cr/r.md",
        ],
        repo,
    )
    assert out["reviewed_sha"] == sha
    assert out["counts"] == {"CRITICAL": 0, "HIGH": 2, "MEDIUM": 3, "LOW": 4}


def test_review_done_rejects_malformed_counts(repo: Path) -> None:
    _init(repo)
    sha = _commit_group(repo, 1)
    proc = _run(
        ["review-done", "--run", RUN, "--reviewed-sha", sha, "--counts", "1,2"], repo
    )
    assert proc.returncode == 1
    assert "four integers" in proc.stderr


def test_the_watermark_only_moves_forward(repo: Path) -> None:
    _init(repo)
    sha1 = _commit_group(repo, 1)
    sha2 = _commit_group(repo, 2)
    _ok(["review-done", "--run", RUN, "--reviewed-sha", sha2], repo)
    proc = _run(["review-done", "--run", RUN, "--reviewed-sha", sha1], repo)
    assert proc.returncode == 1
    assert "only moves forward" in proc.stderr


# ---------------------------------------------------------------------------
# resolve-range decision table
# ---------------------------------------------------------------------------


def test_first_pass_with_no_watermark_is_full(repo: Path) -> None:
    _init(repo)
    _commit_group(repo, 1)
    out = _ok(["resolve-range", "--run", RUN], repo)
    assert out["range_mode"] == "full"
    assert out["anchor_source"] == "full (first pass)"


def test_a_healthy_watermark_yields_only_the_new_commits(repo: Path) -> None:
    _init(repo)
    sha1 = _commit_group(repo, 1)
    _ok(["review-done", "--run", RUN, "--reviewed-sha", sha1, "--group", "1"], repo)
    _commit_group(repo, 2)

    out = _ok(["resolve-range", "--run", RUN], repo)
    assert out["range_mode"] == "delta"
    assert out["anchor_sha"] == sha1
    assert out["commits_in_range"] == 1
    assert out["delta_files"] == ["file2.txt"]
    assert sorted(out["cumulative_files"]) == ["file1.txt", "file2.txt"]


def test_full_flag_overrides_a_healthy_watermark(repo: Path) -> None:
    _init(repo)
    sha1 = _commit_group(repo, 1)
    _ok(["review-done", "--run", RUN, "--reviewed-sha", sha1, "--group", "1"], repo)
    _commit_group(repo, 2)

    out = _ok(["resolve-range", "--run", RUN, "--full"], repo)
    assert out["range_mode"] == "full"
    assert out["anchor_source"] == "full (requested)"
    assert sorted(out["delta_files"]) == ["file1.txt", "file2.txt"]


def test_no_new_commits_reports_empty(repo: Path) -> None:
    _init(repo)
    sha1 = _commit_group(repo, 1)
    _ok(["review-done", "--run", RUN, "--reviewed-sha", sha1, "--group", "1"], repo)
    out = _ok(["resolve-range", "--run", RUN], repo)
    assert out["range_mode"] == "empty"
    assert out["commits_in_range"] == 0


def test_watermark_orphaned_by_a_rewrite_recovers_from_the_trailer(repo: Path) -> None:
    _init(repo)
    sha1 = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha1], repo)
    _ok(["review-done", "--run", RUN, "--reviewed-sha", sha1, "--group", "1"], repo)

    # Rewrite group 1's commit, keeping its trailers. The watermark sha is now
    # unreachable, but the BDK-Group trailer still marks the same boundary.
    (repo / "file1.txt").write_text("rewritten\n")
    _git(repo, "add", "file1.txt")
    _git(repo, "commit", "-q", "--amend", "--no-edit")
    rewritten = _git(repo, "rev-parse", "HEAD")
    _commit_group(repo, 2)

    out = _ok(["resolve-range", "--run", RUN], repo)
    assert out["anchor_sha"] == rewritten
    assert out["anchor_source"] == "delta (recovered from trailer)"
    assert out["delta_files"] == ["file2.txt"]
    assert out["warnings"]


def test_orphaned_watermark_with_no_recoverable_trailer_degrades_to_full(
    repo: Path,
) -> None:
    """Degrading loudly beats guessing an equivalent commit."""
    _init(repo)
    (repo / "y.txt").write_text("y\n")
    _git(repo, "add", "y.txt")
    _git(repo, "commit", "-q", "-m", "feat: untrailered")
    untrailered = _git(repo, "rev-parse", "HEAD")
    _ok(["review-done", "--run", RUN, "--reviewed-sha", untrailered], repo)

    _git(repo, "reset", "-q", "--hard", "HEAD~1")
    _commit_group(repo, 2)

    out = _ok(["resolve-range", "--run", RUN], repo)
    assert out["range_mode"] == "full"
    assert out["anchor_source"] == "full (degraded)"
    assert any("whole branch" in w for w in out["warnings"]), out["warnings"]


def test_rebuild_clears_a_watermark_that_left_the_branch(repo: Path) -> None:
    _init(repo)
    (repo / "z.txt").write_text("z\n")
    _git(repo, "add", "z.txt")
    _git(repo, "commit", "-q", "-m", "feat: gone soon")
    doomed = _git(repo, "rev-parse", "HEAD")
    _ok(["review-done", "--run", RUN, "--reviewed-sha", doomed], repo)
    _git(repo, "reset", "-q", "--hard", "HEAD~1")

    out = _ok(["rebuild", "--run", RUN], repo)
    assert out["reviewed_sha"] is None
    assert any("full branch" in d or "full" in d for d in out["drift"]), out["drift"]


# ---------------------------------------------------------------------------
# deferred findings
# ---------------------------------------------------------------------------


def _add_finding(repo: Path, severity: str = "MEDIUM", problem: str = "long fn") -> dict:
    return _ok(
        [
            "findings-add",
            "--run",
            RUN,
            "--severity",
            severity,
            "--category",
            "maintainability",
            "--file",
            "src/a.py",
            "--line",
            "42",
            "--problem",
            problem,
        ],
        repo,
    )


def test_findings_round_trip(repo: Path) -> None:
    _init(repo)
    _add_finding(repo)
    _add_finding(repo, severity="LOW", problem="naming")
    out = _ok(["findings-list", "--run", RUN], repo)
    assert out["total"] == 2
    assert out["counts"]["MEDIUM"] == 1
    assert out["counts"]["LOW"] == 1


def test_findings_add_is_idempotent(repo: Path) -> None:
    """A re-review that re-reports the same finding must not grow the store."""
    _init(repo)
    _add_finding(repo)
    second = _add_finding(repo)
    assert second["added"] is False
    assert second["total"] == 1


def test_findings_add_rejects_an_unknown_severity(repo: Path) -> None:
    _init(repo)
    proc = _run(
        [
            "findings-add",
            "--run",
            RUN,
            "--severity",
            "NAGGING",
            "--category",
            "x",
            "--file",
            "a.py",
            "--problem",
            "p",
        ],
        repo,
    )
    assert proc.returncode == 1


def test_findings_list_filters_by_severity(repo: Path) -> None:
    _init(repo)
    _add_finding(repo, severity="MEDIUM")
    _add_finding(repo, severity="LOW", problem="naming")
    out = _ok(["findings-list", "--run", RUN, "--severity", "LOW"], repo)
    assert out["total"] == 1
    assert out["findings"][0]["problem"] == "naming"


def test_prompt_format_is_a_paste_ready_suppression_block(repo: Path) -> None:
    _init(repo)
    _add_finding(repo)
    proc = _run(["findings-list", "--run", RUN, "--format", "prompt"], repo)
    assert proc.returncode == 0
    assert "do NOT report these again" in proc.stdout
    assert "src/a.py:42" in proc.stdout


def test_prompt_format_is_silent_with_nothing_deferred(repo: Path) -> None:
    _init(repo)
    proc = _run(["findings-list", "--run", RUN, "--format", "prompt"], repo)
    assert proc.returncode == 0
    assert proc.stdout.strip() == ""


def _add_symbol_finding(
    repo: Path,
    category: str = "dead-code",
    symbol: str = "parse_row",
    line: str = "42",
    problem: str = "unused",
) -> dict:
    return _ok(
        [
            "findings-add",
            "--run",
            RUN,
            "--severity",
            "MEDIUM",
            "--category",
            category,
            "--file",
            "src/a.py",
            "--line",
            line,
            "--symbol",
            symbol,
            "--problem",
            problem,
        ],
        repo,
    )


def test_category_spellings_fold_onto_one_slug(repo: Path) -> None:
    """`Dead Code`, `dead_code`, `DEAD-CODE` are one category, not three."""
    _init(repo)
    for spelling in ("Dead Code", "dead_code", "DEAD-CODE", "  dead-code  "):
        _add_symbol_finding(repo, category=spelling)
    out = _ok(["findings-list", "--run", RUN], repo)
    assert out["total"] == 1
    assert out["findings"][0]["category"] == "dead-code"


def test_category_normalization_keeps_distinct_categories_apart(repo: Path) -> None:
    _init(repo)
    _add_symbol_finding(repo, category="dead-code")
    _add_symbol_finding(repo, category="duplication")
    assert _ok(["findings-list", "--run", RUN], repo)["total"] == 2


def test_an_empty_category_is_refused(repo: Path) -> None:
    _init(repo)
    proc = _run(
        [
            "findings-add",
            "--run",
            RUN,
            "--severity",
            "LOW",
            "--category",
            "  ",
            "--file",
            "a.py",
            "--problem",
            "p",
        ],
        repo,
    )
    assert proc.returncode == 1


def test_symbol_keys_the_entry_across_a_line_shift(repo: Path) -> None:
    """An edit above the defect shifts its line; the deferral must not double."""
    _init(repo)
    _add_symbol_finding(repo, line="42")
    second = _add_symbol_finding(repo, line="57")
    assert second["added"] is False
    assert second["total"] == 1


def test_distinct_symbols_on_one_line_stay_distinct(repo: Path) -> None:
    _init(repo)
    _add_symbol_finding(repo, symbol="parse_row")
    _add_symbol_finding(repo, symbol="write_row")
    assert _ok(["findings-list", "--run", RUN], repo)["total"] == 2


def test_line_still_keys_the_entry_with_no_symbol(repo: Path) -> None:
    _init(repo)
    _add_finding(repo)
    assert _add_finding(repo)["added"] is False
    out = _ok(["findings-list", "--run", RUN], repo)
    assert out["total"] == 1
    assert out["findings"][0]["symbol"] is None


def test_prompt_format_names_the_symbol_when_stored(repo: Path) -> None:
    _init(repo)
    _add_symbol_finding(repo)
    proc = _run(["findings-list", "--run", RUN, "--format", "prompt"], repo)
    assert proc.returncode == 0
    assert "src/a.py:42 (parse_row)" in proc.stdout


def test_resolve_range_reports_the_suppression_count(repo: Path) -> None:
    _init(repo)
    _add_finding(repo)
    _commit_group(repo, 1)
    assert _ok(["resolve-range", "--run", RUN], repo)["suppressed_findings"] == 1


# ---------------------------------------------------------------------------
# discovery and refusals
# ---------------------------------------------------------------------------


def test_list_finds_the_run_and_filters_by_branch(repo: Path) -> None:
    _init(repo)
    assert [r["run_id"] for r in _ok(["list"], repo)["runs"]] == [RUN]
    assert _ok(["list", "--branch", "main"], repo)["runs"]
    assert _ok(["list", "--branch", "other"], repo)["runs"] == []


def test_list_is_empty_before_any_run(repo: Path) -> None:
    assert _ok(["list"], repo)["runs"] == []


def test_print_renders_a_human_view(repo: Path) -> None:
    _init(repo)
    sha = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha], repo)
    proc = _run(["print", "--run", RUN], repo)
    assert proc.returncode == 0
    assert "add-oauth" in proc.stdout
    assert "groups done  1" in proc.stdout


def test_every_command_refuses_an_unknown_run_by_name(repo: Path) -> None:
    for args in (
        ["get", "--run", "nope"],
        ["resume", "--run", "nope", "--session", "s1"],
        ["group-done", "--run", "nope", "--group", "1", "--commit", "HEAD"],
        ["resolve-range", "--run", "nope"],
        ["review-done", "--run", "nope", "--reviewed-sha", "HEAD"],
        ["findings-list", "--run", "nope"],
        ["rebuild", "--run", "nope"],
        ["print", "--run", "nope"],
    ):
        proc = _run(args, repo)
        assert proc.returncode == 1, args
        assert "[bdk-run-state]" in proc.stderr, args


def test_a_corrupt_manifest_refuses_and_names_the_recovery(repo: Path) -> None:
    _init(repo)
    (repo / ".bdk" / "runs" / f"{RUN}.json").write_text("{not json")
    proc = _run(["get", "--run", RUN], repo)
    assert proc.returncode == 1
    assert "rebuild" in proc.stderr


# ---------------------------------------------------------------------------
# timings
# ---------------------------------------------------------------------------


def test_init_stamps_a_start_instant(repo: Path) -> None:
    result = _init(repo, at="2026-08-21T10:00:00Z")
    assert result["started_at"] == "2026-08-21T10:00:00Z"


def test_group_elapsed_is_measured_between_start_and_done(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    _ok(["group-start", "--run", RUN, "--group", "1"], repo, "2026-08-21T10:00:05Z")
    _commit_group(repo, 1)
    done = _ok(
        ["group-done", "--run", RUN, "--group", "1", "--commit", "HEAD"],
        repo,
        "2026-08-21T10:02:05Z",
    )
    assert done["elapsed_s"] == 120


def test_group_done_without_a_start_reports_unknown_rather_than_guessing(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    _commit_group(repo, 1)
    done = _ok(
        ["group-done", "--run", RUN, "--group", "1", "--commit", "HEAD"],
        repo,
        "2026-08-21T10:02:05Z",
    )
    assert done["elapsed_s"] is None


def test_group_start_twice_resets_the_stamp_and_says_so(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    _ok(["group-start", "--run", RUN, "--group", "1"], repo, "2026-08-21T10:00:05Z")
    again = _ok(
        ["group-start", "--run", RUN, "--group", "1"], repo, "2026-08-21T10:03:05Z"
    )
    assert again["started_at"] == "2026-08-21T10:03:05Z"
    assert any("re-dispatch" in n for n in again["notes"])
    _commit_group(repo, 1)
    done = _ok(
        ["group-done", "--run", RUN, "--group", "1", "--commit", "HEAD"],
        repo,
        "2026-08-21T10:04:05Z",
    )
    assert done["elapsed_s"] == 60


def test_phase_elapsed_is_measured_and_the_slug_is_normalized(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    _ok(
        ["phase-start", "--run", RUN, "--phase", "final_tests"],
        repo,
        "2026-08-21T10:00:00Z",
    )
    # Same phase, different spelling: one entry, not two.
    done = _ok(
        ["phase-done", "--run", RUN, "--phase", "Final Tests"],
        repo,
        "2026-08-21T10:05:00Z",
    )
    assert done["phase"] == "final-tests"
    assert done["elapsed_s"] == 300
    timings = _ok(["timings", "--run", RUN], repo, "2026-08-21T10:06:00Z")
    assert list(timings["phases"]) == ["final-tests"]


def test_phase_done_without_a_start_names_the_gap(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    done = _ok(["phase-done", "--run", RUN, "--phase", "review"], repo, "2026-08-21T10:05:00Z")
    assert done["elapsed_s"] is None
    assert any("never started" in n for n in done["notes"])


def test_timings_reports_total_and_per_group_breakdown(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    _ok(["group-start", "--run", RUN, "--group", "1"], repo, "2026-08-21T10:00:00Z")
    _commit_group(repo, 1)
    _ok(
        ["group-done", "--run", RUN, "--group", "1", "--commit", "HEAD"],
        repo,
        "2026-08-21T10:01:00Z",
    )
    _ok(["group-start", "--run", RUN, "--group", "2"], repo, "2026-08-21T10:01:00Z")
    _commit_group(repo, 2)
    _ok(
        ["group-done", "--run", RUN, "--group", "2", "--commit", "HEAD"],
        repo,
        "2026-08-21T10:04:00Z",
    )

    timings = _ok(["timings", "--run", RUN], repo, "2026-08-21T10:10:00Z")
    assert timings["wall_clock_total_s"] == 600
    assert [g["group"] for g in timings["groups"]] == [1, 2]
    assert [g["elapsed_s"] for g in timings["groups"]] == [60, 180]
    assert timings["groups_measured"] == 2
    assert timings["group_total_s"] == 240
    assert timings["slowest_group_s"] == 180


def test_timings_survives_a_manifest_written_before_timings_existed(repo: Path) -> None:
    _init(repo)
    path = repo / ".bdk" / "runs" / f"{RUN}.json"
    state = json.loads(path.read_text())
    for key in ("started_at", "group_timings", "phases"):
        state.pop(key, None)
    path.write_text(json.dumps(state))

    timings = _ok(["timings", "--run", RUN], repo)
    assert timings["wall_clock_total_s"] is None
    assert timings["groups"] == []
    assert timings["group_total_s"] is None


def test_a_resumed_legacy_run_gets_its_start_stamp_backfilled(repo: Path) -> None:
    _init(repo)
    path = repo / ".bdk" / "runs" / f"{RUN}.json"
    state = json.loads(path.read_text())
    del state["started_at"]
    path.write_text(json.dumps(state))

    result = _init(repo, at="2026-08-21T12:00:00Z")
    assert result["started_at"] == "2026-08-21T12:00:00Z"


def test_review_done_stamps_the_review(repo: Path) -> None:
    _init(repo)
    sha = _commit_group(repo, 1)
    _ok(["group-done", "--run", RUN, "--group", "1", "--commit", sha], repo)
    _ok(
        ["review-done", "--run", RUN, "--reviewed-sha", sha, "--counts", "0,0,1,2"],
        repo,
        "2026-08-21T11:00:00Z",
    )
    state = _ok(["get", "--run", RUN], repo)
    assert state["reviews"][-1]["ts"] == "2026-08-21T11:00:00Z"


def test_a_group_dropped_by_reconcile_loses_its_timing_too(repo: Path) -> None:
    _init(repo, at="2026-08-21T10:00:00Z")
    _ok(["group-start", "--run", RUN, "--group", "1"], repo, "2026-08-21T10:00:00Z")
    sha = _commit_group(repo, 1)
    _ok(
        ["group-done", "--run", RUN, "--group", "1", "--commit", sha],
        repo,
        "2026-08-21T10:01:00Z",
    )
    # Drop the trailered commit: git no longer knows the group happened, so
    # neither should the timing that measured it.
    _git(repo, "reset", "-q", "--hard", "HEAD~1")
    timings = _ok(["timings", "--run", RUN], repo)
    assert timings["groups"] == []


def test_an_in_flight_group_keeps_its_start_stamp_through_a_read(repo: Path) -> None:
    # The pruning above must not touch a group that is merely still running:
    # it has a start stamp and no commit yet, which is the normal mid-group state.
    _init(repo, at="2026-08-21T10:00:00Z")
    _ok(["group-start", "--run", RUN, "--group", "1"], repo, "2026-08-21T10:00:00Z")
    _ok(["get", "--run", RUN], repo)
    timings = _ok(["timings", "--run", RUN], repo, "2026-08-21T10:00:30Z")
    assert [g["group"] for g in timings["groups"]] == [1]
    assert timings["groups"][0]["started_at"] == "2026-08-21T10:00:00Z"
    assert timings["groups"][0]["elapsed_s"] is None


def test_a_tracked_manifest_does_not_re_append_the_rule(repo: Path) -> None:
    """`git check-ignore` reports a TRACKED path as un-ignored even when a rule
    covers it. Probing without `--no-index` therefore re-appended the block on
    every single write once a manifest had slipped into the index."""
    _init(repo)
    before = (repo / ".gitignore").read_text()
    _git(repo, "add", "-f", f".bdk/runs/{RUN}.json")
    _git(repo, "commit", "-q", "-m", "manifest slipped into the index")

    out = _ok(
        ["group-done", "--run", RUN, "--group", "1", "--commit", _commit_group(repo, 1)],
        repo,
    )
    assert not any("/.bdk/" in n for n in out.get("notes", [])), out.get("notes")
    assert (repo / ".gitignore").read_text() == before


def test_an_existing_rule_line_is_never_duplicated(repo: Path) -> None:
    """Belt and braces: whatever `check-ignore` says, the exact line we would
    write must never be appended twice."""
    (repo / ".gitignore").write_text("# BDK run state - machine-owned, never committed\n/.bdk/\n")
    out = _init(repo)
    assert not any("/.bdk/" in n for n in out["notes"]), out["notes"]
    assert (repo / ".gitignore").read_text().count("/.bdk/") == 1


@pytest.mark.parametrize("rule", ["/.bdk/", "/.bdk", ".bdk/", ".bdk", "  /.bdk/  "])
def test_rule_already_present_recognises_every_spelling(tmp_path: Path, rule: str) -> None:
    """The guard that runs whatever `check-ignore` answered, so it has to
    recognise the hand-written spellings too - not just the one we emit."""
    gitignore = tmp_path / ".gitignore"
    gitignore.write_text(f"node_modules/\n{rule}\n*.log\n")
    assert state_mod.rule_already_present(gitignore) is True


@pytest.mark.parametrize("rule", ["/.bdk/plans/", "bdk", ".bdkx", "# .bdk/"])
def test_rule_already_present_rejects_rules_that_do_not_cover_the_state_dir(
    tmp_path: Path, rule: str
) -> None:
    gitignore = tmp_path / ".gitignore"
    gitignore.write_text(f"{rule}\n")
    assert state_mod.rule_already_present(gitignore) is False


def test_rule_already_present_on_a_missing_gitignore(tmp_path: Path) -> None:
    assert state_mod.rule_already_present(tmp_path / ".gitignore") is False

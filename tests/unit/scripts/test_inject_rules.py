"""Tests for scripts/inject-rules.py.

Rule overrides are prompt values (`kernel-settings`, Prompt values): files under
`.bdk/prompts/rules/` or mapped by `prompts.files`, resolved by the committed
dist/bdk.mjs through scripts/kernel_settings.py. Plugin defaults are the real
`rules/*.md` files the kernel ships with.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).parents[3]
SCRIPT = REPO / "scripts" / "inject-rules.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("inject_rules", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


inject_rules_mod = _load_module()
resolve_rule = inject_rules_mod.resolve_rule


@pytest.fixture
def project(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A git work tree with an empty global layer."""
    root = tmp_path / "project"
    root.mkdir()
    subprocess.run(["git", "init", "--quiet"], cwd=root, check=True)
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
    return root


def _write(root: Path, relative: str, content: str) -> Path:
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return target


def _default(name: str) -> str:
    return (REPO / "rules" / f"{name}.md").read_text(encoding="utf-8").strip()


def _run_cli(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env={**os.environ},
        check=False,
    )


def test_no_settings_returns_the_plugin_default(project):
    assert resolve_rule("code-quality", cwd=project) == f"{_default('code-quality')}\n"


def test_project_prompt_file_extends_the_default(project):
    _write(project, ".bdk/prompts/rules/security.md", "- never log tokens\n")
    assert (
        resolve_rule("security", cwd=project) == f"{_default('security')}\n\n- never log tokens\n"
    )


def test_replace_drops_the_default(project):
    _write(project, ".bdk/prompts/rules/security.md", "---\nmode: replace\n---\n- only mine\n")
    assert resolve_rule("security", cwd=project) == "- only mine\n"


def test_local_replace_wins_over_project_extends(project):
    _write(project, ".bdk/prompts/rules/architecture.md", "- project\n")
    _write(
        project, ".bdk/prompts.local/rules/architecture.md", "---\nmode: replace\n---\n- local\n"
    )
    assert resolve_rule("architecture", cwd=project) == "- local\n"


def test_prompts_files_maps_a_file_from_anywhere(project):
    _write(project, "docs/security-rules.md", "- mapped\n")
    _write(
        project,
        ".bdk/settings.yaml",
        "prompts:\n  files:\n    rules/security: docs/security-rules.md\n",
    )
    assert resolve_rule("security", cwd=project) == f"{_default('security')}\n\n- mapped\n"


def test_a_missing_mapped_file_raises(project):
    _write(project, ".bdk/settings.yaml", "prompts:\n  files:\n    rules/security: missing.md\n")
    with pytest.raises(
        inject_rules_mod.KernelSettingsError, match=r"prompts\.files\.rules/security"
    ):
        resolve_rule("security", cwd=project)


def test_an_unknown_rule_raises(project):
    with pytest.raises(inject_rules_mod.KernelSettingsError, match="policy/unknown-config-key"):
        resolve_rule("no-such-rule", cwd=project)


def test_cli_emits_the_default_to_stdout(project):
    result = _run_cli(["test-quality"], cwd=project)
    assert result.returncode == 0
    assert result.stdout == f"{_default('test-quality')}\n"
    assert result.stderr == ""


def test_cli_kernel_refusal_reports_one_line_on_stdout(project):
    _write(project, ".bdk/settings.yaml", "quality:\n  security: mine.md\n")
    result = _run_cli(["security"], cwd=project)
    assert result.returncode == 0
    assert result.stdout.startswith("[bdk-inject-error]")
    assert "quality" in result.stdout
    assert result.stdout.count("\n") == 1
    assert result.stderr == ""


def test_cli_no_args_reports_on_stdout(project):
    result = _run_cli([], cwd=project)
    assert result.returncode == 0
    assert result.stdout.startswith("[bdk-inject-error]")
    assert result.stderr == ""

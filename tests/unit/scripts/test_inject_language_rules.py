"""Tests for scripts/inject-language-rules.py.

Languages come from `languages` in the YAML settings and each language's rule
text is the prompt value `rules/languages/<lang>`, both resolved by the
committed dist/bdk.mjs through scripts/kernel_settings.py.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).parents[3]
SCRIPT = REPO / "scripts" / "inject-language-rules.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("inject_language_rules", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = _load_module()
resolve_language_rule = mod.resolve_language_rule
resolve_all = mod.resolve_all


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


def _default(lang: str) -> str:
    return (REPO / "rules" / "languages" / f"{lang}.md").read_text(encoding="utf-8").strip()


def _run_cli(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env={**os.environ},
        check=False,
    )


# ---------- resolve_language_rule ----------


def test_the_plugin_default_without_settings(project):
    assert resolve_language_rule("react", cwd=project) == f"{_default('react')}\n"


def test_a_language_without_any_rule_file_is_none(project):
    assert resolve_language_rule("cobol", cwd=project) is None


def test_a_project_file_extends_the_default(project):
    _write(project, ".bdk/prompts/rules/languages/react.md", "- hooks first\n")
    assert resolve_language_rule("react", cwd=project) == f"{_default('react')}\n\n- hooks first\n"


def test_replace_drops_the_default(project):
    _write(
        project,
        ".bdk/prompts/rules/languages/typescript.md",
        "---\nmode: replace\n---\n- strict only\n",
    )
    assert resolve_language_rule("typescript", cwd=project) == "- strict only\n"


def test_an_override_without_a_default(project):
    _write(project, ".bdk/prompts/rules/languages/cobol.md", "- divisions\n")
    assert resolve_language_rule("cobol", cwd=project) == "- divisions\n"


def test_a_mapped_language_file(project):
    _write(project, "rules/go.md", "- errors are values\n")
    _write(
        project, ".bdk/settings.yaml", "prompts:\n  files:\n    rules/languages/go: rules/go.md\n"
    )
    assert resolve_language_rule("go", cwd=project) == "- errors are values\n"


# ---------- resolve_all ----------


def test_resolve_all_without_languages_is_empty(project):
    assert resolve_all(cwd=project) == ""


def test_resolve_all_skips_languages_without_rules(project):
    _write(project, ".bdk/settings.yaml", "languages: [cobol, react]\n")
    assert resolve_all(cwd=project) == _default("react")


def test_resolve_all_concatenates_languages_in_order(project):
    _write(project, ".bdk/settings.yaml", "languages: [typescript, react]\n")
    assert resolve_all(cwd=project) == f"{_default('typescript')}\n\n{_default('react')}"


# ---------- CLI ----------


def test_cli_no_args_emits_all_to_stdout(project):
    _write(project, ".bdk/settings.yaml", "languages: [react]\n")
    proc = _run_cli([], cwd=project)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout == _default("react")


def test_cli_lang_arg_emits_one_language(project):
    _write(project, ".bdk/settings.yaml", "languages: [react, typescript]\n")
    proc = _run_cli(["typescript"], cwd=project)
    assert proc.returncode == 0
    assert proc.stdout == f"{_default('typescript')}\n"


def test_cli_without_settings_is_silent(project):
    proc = _run_cli([], cwd=project)
    assert proc.returncode == 0
    assert proc.stdout == ""


def test_cli_removed_v2_key_reports_on_stdout(project):
    _write(project, ".bdk/settings.yaml", "language-rules:\n  react: mine.md\n")
    proc = _run_cli([], cwd=project)
    assert proc.returncode == 0
    assert proc.stdout.startswith("[bdk-inject-error]")
    assert "language-rules" in proc.stdout
    assert proc.stderr == ""


def test_cli_too_many_args_reports_on_stdout(project):
    proc = _run_cli(["a", "b"], cwd=project)
    assert proc.returncode == 0
    assert "[bdk-inject-error]" in proc.stdout
    assert proc.stderr == ""

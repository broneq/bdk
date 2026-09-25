"""Tests for scripts/kernel_settings.py, the bridge from the v2 injection
scripts to the kernel's `bdk config show` (design D-14 of v3-t12-layered-config).

They run the committed dist/bdk.mjs, so `pnpm build` must have run.
"""

from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).parents[3]
SCRIPT = REPO / "scripts" / "kernel_settings.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("kernel_settings", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


kernel_settings = _load_module()


@pytest.fixture
def project(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A git work tree with an empty global layer, as the working directory."""
    root = tmp_path / "project"
    root.mkdir()
    subprocess.run(["git", "init", "--quiet"], cwd=root, check=True)
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
    monkeypatch.chdir(root)
    return root


def _write(root: Path, relative: str, content: str) -> Path:
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return target


def test_load_settings_returns_the_resolved_tree(project: Path):
    _write(project, ".bdk/settings.yaml", "languages: [go]\nfeatures:\n  lavish: false\n")
    settings = kernel_settings.load_settings()
    assert settings["languages"] == ["go"]
    assert settings["features"] == {"lavish": False}
    assert settings["tools"] == {"test": [], "lint": [], "build": []}


def test_load_settings_from_a_subdirectory(project: Path, monkeypatch: pytest.MonkeyPatch):
    _write(project, ".bdk/settings.yaml", "languages: [go]\n")
    sub = project / "pkg" / "src"
    sub.mkdir(parents=True)
    monkeypatch.chdir(sub)
    assert kernel_settings.load_settings()["languages"] == ["go"]


def test_prompt_files_after_replace_are_the_local_file_alone(project: Path):
    _write(project, ".bdk/prompts/rules/security.md", "---\nmode: extends\n---\n- project\n")
    local = _write(project, ".bdk/prompts.local/rules/security.md", "---\nmode: replace\n---\n- local\n")
    assert kernel_settings.prompt_files("rules/security") == [local.resolve()]


def test_prompt_files_start_with_the_plugin_default(project: Path):
    mine = _write(project, ".bdk/prompts/rules/security.md", "- mine\n")
    assert kernel_settings.prompt_files("rules/security") == [
        (REPO / "rules" / "security.md").resolve(),
        mine.resolve(),
    ]


def test_prompt_files_of_a_language_without_any_file_are_empty(project: Path):
    assert kernel_settings.prompt_files("rules/languages/cobol") == []


def test_a_kernel_refusal_is_one_error_line(project: Path):
    _write(project, ".bdk/settings.yaml", "features:\n  serena: true\n")
    with pytest.raises(kernel_settings.KernelSettingsError) as caught:
        kernel_settings.load_settings()
    line = kernel_settings.error_line(caught.value)
    assert line.startswith("[bdk-inject-error] ")
    assert "policy/unknown-config-key" in line
    assert "features.serena" in line
    assert "\n" not in line


def test_a_missing_node_is_one_error_line(project: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PATH", "")
    with pytest.raises(kernel_settings.KernelSettingsError) as caught:
        kernel_settings.load_settings()
    line = kernel_settings.error_line(caught.value)
    assert line.startswith("[bdk-inject-error] ")
    assert "Node" in line
    assert "\n" not in line


def test_prompt_text_joins_the_bodies_without_frontmatter(project: Path):
    _write(project, ".bdk/prompts/rules/security.md", "---\nmode: extends\n---\n\n- mine\n\n")
    default = (REPO / "rules" / "security.md").read_text().strip()
    assert kernel_settings.prompt_text("rules/security") == f"{default}\n\n- mine\n"


def test_prompt_text_of_a_key_without_files_is_none(project: Path):
    assert kernel_settings.prompt_text("rules/languages/cobol") is None

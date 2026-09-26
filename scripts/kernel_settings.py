#!/usr/bin/env python3
"""Bridge from the v2 injection scripts to the kernel's settings.

Settings are read only through the kernel (`plugin-tooling`, Settings read
through the kernel): this module runs ``node dist/bdk.mjs config show --json``
from the working directory and returns what it resolves. It is transitional:
T13 deletes the injection scripts, and this module with them.

Public API:
    from kernel_settings import load_settings, prompt_files, prompt_text, error_line, KernelSettingsError

A missing Node or a kernel refusal raises ``KernelSettingsError``; callers print
``error_line(error)``, one ``[bdk-inject-error]`` line on stdout, and exit 0, so
the failure is visible in the rendered skill instead of reading as silence.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ERR_PREFIX = "[bdk-inject-error]"

# The kernel's frontmatter block (kernel/src/shared/store/frontmatter.ts).
_FRONTMATTER = re.compile(r"^---\r?\n(?:.*\r?\n)*?---(?:\r?\n|$)")

# The bundle ships next to this script; CLAUDE_PLUGIN_ROOT may point elsewhere
# in tests, but the kernel always resolves plugin defaults from its own location.
BUNDLE = Path(__file__).resolve().parent.parent / "dist" / "bdk.mjs"


class KernelSettingsError(Exception):
    """The kernel could not be run, or it refused."""


def error_line(error: KernelSettingsError) -> str:
    """The one line a script prints for `error`."""
    return f"{ERR_PREFIX} {' '.join(str(error).split())}"


def load_settings(cwd: Path | None = None) -> dict:  # type: ignore[type-arg]
    """The resolved configuration: every layer merged, defaults included."""
    value = _show([], cwd)["value"]
    if not isinstance(value, dict):
        raise KernelSettingsError(f"bdk config show returned {type(value).__name__}, not a mapping")
    return value


def prompt_files(key: str, cwd: Path | None = None) -> list[Path]:
    """The files that form prompt value `key`, lowest layer first, after `replace`.

    A key no layer contributes to (a language without a rule file) has none.
    """
    report = _show([f"prompts.{key}"], cwd, missing_ok=True)
    if report is None:
        return []
    root = _project_root(cwd or Path.cwd())
    files = report["value"]["files"]
    return [(root / entry["path"]).resolve() for entry in files]


def prompt_text(key: str, cwd: Path | None = None) -> str | None:
    """The content of prompt value `key`: each file's body without frontmatter,
    trimmed and joined by a blank line, as the kernel joins them. None without files.
    """
    bodies = []
    for path in prompt_files(key, cwd):
        body = _FRONTMATTER.sub("", path.read_text(encoding="utf-8"), count=1).strip()
        if body:
            bodies.append(f"{body}\n")
    return "\n".join(bodies) if bodies else None


def _show(args: list[str], cwd: Path | None, missing_ok: bool = False) -> dict | None:  # type: ignore[type-arg]
    command = ["node", str(BUNDLE), "config", "show", *args, "--json"]
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    except FileNotFoundError as error:
        raise KernelSettingsError(
            "node not found: BDK settings need Node >= 22.13 (install it, then run bdk config check)"
        ) from error
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        detail = (result.stdout or result.stderr).strip()
        raise KernelSettingsError(
            f"bdk config show failed (exit {result.returncode}): {detail}"
        ) from error
    if result.returncode == 0:
        return report
    rule = report.get("rule", "unknown")
    if missing_ok and rule == "input/not-found":
        return None
    raise KernelSettingsError(f"bdk config show: {rule}: {report.get('why', '')}")


def _project_root(cwd: Path) -> Path:
    """Where the kernel's relative paths start: the nearest `.bdk/`, else the work tree root."""
    current = cwd.resolve()
    for directory in (current, *current.parents):
        if (directory / ".bdk").is_dir():
            return directory
        if (directory / ".git").exists():
            return directory
    return current

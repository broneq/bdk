"""Abstract base class for format-specific fixture builders."""

from __future__ import annotations

import os
import subprocess
import sys
from abc import ABC, abstractmethod
from pathlib import Path

from bs4 import BeautifulSoup

# Support both package import and standalone execution
if __package__:
    from .id_generator import IDGenerator
else:
    sys.path.insert(0, os.path.dirname(__file__))
    from id_generator import IDGenerator  # type: ignore[no-redef]


_SKIP_ELEMENTS = frozenset(
    {"script", "link", "style", "meta", "head", "html", "body", "[document]"}
)


class BaseFixtureBuilder(ABC):
    """Abstract base for format-specific fixture builders."""

    def __init__(self, template_path: str, html: str) -> None:
        self._template_path = Path(template_path)
        self._template_dir = self._template_path.parent
        self._html = html
        self._ids = IDGenerator()
        self._changes_applied = 0
        self._errors: list[str] = []

    def fill_placeholder(self, placeholder_id: str, value: str) -> None:
        """Fill a placeholder by its ID with the given value."""
        result = self._fill_placeholder_html(placeholder_id, value)
        if result is None:
            self._errors.append(f'fill_placeholder("{placeholder_id}"): id not found in template')
            return
        self._html = result
        self._changes_applied += 1

    def fill_freetextfield(self, index: int, value: str) -> None:
        """Fill the Nth freetextfield (1-based) with the given value."""
        result = self._fill_freetextfield_html(index, value)
        if result is None:
            self._errors.append(f"fill_freetextfield({index}): index not found in template")
            return
        self._html = result
        self._changes_applied += 1

    def delete(self, text: str) -> None:
        """Wrap first occurrence of text in deletion markup."""
        idx = self._html.find(text)
        if idx < 0:
            self._errors.append(
                f'delete("{text}"): text not found in template (hint: check &amp; vs & encoding)'
            )
            return
        wrapped = self._wrap_deletion(text)
        self._html = self._html[:idx] + wrapped + self._html[idx + len(text) :]
        self._changes_applied += 1

    def replace(self, old: str, new: str) -> None:
        """Replace first occurrence of old with deletion+insertion pair."""
        idx = self._html.find(old)
        if idx < 0:
            self._errors.append(
                f'replace("{old}"): text not found in template (hint: check &amp; vs & encoding)'
            )
            return
        replacement = self._build_replacement(old, new)
        self._html = self._html[:idx] + replacement + self._html[idx + len(old) :]
        self._changes_applied += 1

    def insert_after(self, anchor: str, text: str) -> None:
        """Insert addition markup immediately after anchor text."""
        idx = self._html.find(anchor)
        if idx < 0:
            self._errors.append(
                f'insert_after("{anchor}"): anchor not found in template'
                " (hint: check &amp; vs & encoding)"
            )
            return
        insertion = self._wrap_insertion(text)
        insert_pos = idx + len(anchor)
        self._html = self._html[:insert_pos] + insertion + self._html[insert_pos:]
        self._changes_applied += 1

    def save(self, filename: str) -> None:
        """Write HTML to file, set legacy attr, and validate."""
        if self._errors:
            numbered = "\n".join(f"  [{i + 1}] {e}" for i, e in enumerate(self._errors))
            raise ValueError(f"{len(self._errors)} operation(s) failed:\n{numbered}")
        if self._changes_applied == 0:
            raise ValueError(
                "no changes applied — did you forget delete()/replace()/fill_placeholder()?"
            )
        # Set data-or-legacy-html on first meaningful DOM element
        soup = BeautifulSoup(self._html, "html.parser")
        for element in soup.descendants:
            if hasattr(element, "name") and element.name and element.name not in _SKIP_ELEMENTS:
                element["data-or-legacy-html"] = "true"
                break
        self._html = str(soup)

        output_path = self._template_dir / filename
        output_path.write_text(self._html, encoding="utf-8")

        # Run validator
        validator = Path(__file__).parent.parent / "validate_fixture.py"
        result = subprocess.run(
            [sys.executable, str(validator), str(output_path)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise ValueError(f"Validation failed:\n{result.stdout}\n{result.stderr}")

    @abstractmethod
    def _wrap_deletion(self, text: str) -> str:
        """Return text wrapped in format-specific deletion markup."""

    @abstractmethod
    def _wrap_insertion(self, text: str) -> str:
        """Return text wrapped in format-specific insertion markup."""

    @abstractmethod
    def _fill_placeholder_html(self, placeholder_id: str, value: str) -> str | None:
        """Fill placeholder in self._html, return new HTML or None if not found."""

    @abstractmethod
    def _build_replacement(self, old: str, new: str) -> str:
        """Return deletion+insertion composite markup for a replacement."""

    def _fill_freetextfield_html(self, index: int, value: str) -> str | None:
        """Fill the Nth freetextfield by index. Override in subclasses that support it."""
        return None

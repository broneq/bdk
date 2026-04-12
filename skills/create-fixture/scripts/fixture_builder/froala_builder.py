"""Froala format fixture builder (<span> tags with fr-* classes)."""

from __future__ import annotations

import os
import re
import sys

# Support both package import and standalone execution
if __package__:
    from .base import BaseFixtureBuilder
else:
    sys.path.insert(0, os.path.dirname(__file__))
    from base import BaseFixtureBuilder  # type: ignore[no-redef]


class FroalaFixtureBuilder(BaseFixtureBuilder):
    """Builder for Froala format tracked changes (<span> tags)."""

    def __init__(self, template_path: str, html: str, user_uuid: str) -> None:
        super().__init__(template_path, html)
        self._user_uuid = user_uuid

    def _wrap_deletion(self, text: str) -> str:
        ts = self._ids.next_timestamp_ms()
        uid = self._ids.next_uuid()
        return (
            f'<span data-timestamp="{ts}" '
            f'data-identifier="{uid}" '
            f'data-user="{self._user_uuid}" '
            f'data-change-type="deletion" '
            f'class="fr-tracking-deleted">{text}</span>'
        )

    def _wrap_insertion(self, text: str) -> str:
        ts = self._ids.next_timestamp_ms()
        uid = self._ids.next_uuid()
        return (
            f'<span data-timestamp="{ts}" '
            f'data-identifier="{uid}" '
            f'data-user="{self._user_uuid}" '
            f'data-change-type="addition" '
            f'class="fr-highlight-change">{text}</span>'
        )

    def _build_replacement(self, old: str, new: str) -> str:
        return self._wrap_deletion(old) + self._wrap_insertion(new)

    def _fill_placeholder_html(self, placeholder_id: str, value: str) -> str | None:
        # Match the full opening <a> tag + closing </a>
        pattern = rf'(<a [^>]*data-recap-id="{re.escape(placeholder_id)}"[^>]*>)(</a>)'
        m = re.search(pattern, self._html)
        if not m:
            return None
        opening_tag = m.group(1)
        ts = self._ids.next_timestamp_s()
        uid = self._ids.next_uuid()
        # Augment the opening tag with smart-field attributes
        new_opening_tag = opening_tag.rstrip(">") + (
            f' data-change-type="addition"'
            f' data-identifier="{uid}"'
            f' data-user="{self._user_uuid}"'
            f' data-timestamp="{ts}"'
            f' name="smart-field"'
            f' data-is-smart-field="true"'
            f' class="fr-highlight-change">'
        )
        inner_span = f'<span class="fr-highlight-change">{value}</span>'
        replacement = new_opening_tag + inner_span + "</a>"
        return self._html[: m.start()] + replacement + self._html[m.end() :]

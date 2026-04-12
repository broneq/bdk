"""SEA/ICE format fixture builder (<del>/<ins> tags)."""

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


class SEAFixtureBuilder(BaseFixtureBuilder):
    """Builder for SEA/ICE format tracked changes (<del>/<ins> tags)."""

    def __init__(self, template_path: str, html: str, userid: str, username: str) -> None:
        super().__init__(template_path, html)
        self._userid = userid
        self._username = username

    def _wrap_deletion(self, text: str) -> str:
        cid = self._ids.next_cid()
        t = self._ids.next_timestamp_ms()
        return (
            f'<del data-userid-previous="{self._userid}" '
            f'data-last-change-time="{t + 300}" '
            f'data-time="{t}" data-changedata="" '
            f'data-username="{self._username}" '
            f'data-userid="{self._userid}" '
            f'data-cid="{cid}" '
            f'class="ice-del ice-cts-1 cpm-change-previous">{text}</del>'
        )

    def _wrap_insertion(self, text: str) -> str:
        cid = self._ids.next_cid()
        t = self._ids.next_timestamp_ms()
        return (
            f'<ins data-last-change-time="{t + 500}" '
            f'data-time="{t}" data-changedata="" '
            f'data-username="{self._username}" '
            f'data-userid="{self._userid}" '
            f'data-cid="{cid}" '
            f'class="ice-ins ice-cts-1 cpm-change-previous">{text}</ins>'
        )

    def _build_replacement(self, old: str, new: str) -> str:
        cid = self._ids.next_cid()
        t_del = self._ids.next_timestamp_ms()
        t_ins = self._ids.next_timestamp_ms()
        del_html = (
            f'<del data-userid-previous="{self._userid}" '
            f'data-last-change-time="{t_del + 300}" '
            f'data-time="{t_del}" data-changedata="" '
            f'data-username="{self._username}" '
            f'data-userid="{self._userid}" '
            f'data-cid="{cid}" '
            f'class="ice-del ice-cts-1 cpm-change-previous">{old}</del>'
        )
        ins_html = (
            f'<ins data-last-change-time="{t_ins + 500}" '
            f'data-time="{t_ins}" data-changedata="" '
            f'data-username="{self._username}" '
            f'data-userid="{self._userid}" '
            f'data-cid="{cid}" '
            f'class="ice-ins ice-cts-1 cpm-change-previous">{new}</ins>'
        )
        return del_html + ins_html

    def _fill_placeholder_html(self, placeholder_id: str, value: str) -> str | None:
        # Match the closing > of the dfplaceholder opening tag, then optional &nbsp;, then closing tag
        pattern = rf'(id="{re.escape(placeholder_id)}"[^>]*>)(&nbsp;|)(</dfplaceholder>)'
        m = re.search(pattern, self._html)
        if not m:
            return None
        return self._html[: m.start()] + m.group(1) + value + m.group(3) + self._html[m.end() :]

    def _fill_freetextfield_html(self, index: int, value: str) -> str | None:
        pattern = re.compile(
            r"(<freetextfield\b[^>]*>)([^<]*)(</freetextfield>)",
            re.DOTALL,
        )
        count = 0
        for m in pattern.finditer(self._html):
            count += 1
            if count == index:
                return (
                    self._html[: m.start()]
                    + m.group(1)
                    + value
                    + m.group(3)
                    + self._html[m.end() :]
                )
        return None

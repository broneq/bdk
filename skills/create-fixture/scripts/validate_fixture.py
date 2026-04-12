#!/usr/bin/env python3
"""Validate a generated fixture HTML file for or-migrator migration testing.

Usage:
    uv run python .claude/skills/create-fixture/scripts/validate_fixture.py <path>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from detection import detect_format

_PLACEHOLDER_RE = re.compile(r"\[[\w\s\-/]+\]")
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)
_SHORT_NUMERIC_RE = re.compile(r"^\d{4,7}$")


def _check_unfilled_placeholders(html: str) -> list[str]:
    found = _PLACEHOLDER_RE.findall(html)
    if found:
        return [f"Found unfilled placeholder markers: {found[:5]} — use real names/values instead"]
    return []


def _check_froala_spans(html: str) -> list[str]:
    errors: list[str] = []
    addition_spans = re.findall(r'<span[^>]*data-change-type="addition"[^>]*>', html)
    deletion_spans = re.findall(r'<span[^>]*data-change-type="deletion"[^>]*>', html)
    br_additions = re.findall(r'<br[^>]*data-change-type="addition"[^>]*>', html)

    if not addition_spans and not br_additions and not deletion_spans:
        errors.append("No tracked changes found — document has neither additions nor deletions")
        return errors

    required_addition = {"data-timestamp", "data-identifier", "data-user", "fr-highlight-change"}
    for i, span in enumerate(addition_spans, 1):
        for attr in required_addition:
            if attr not in span:
                errors.append(f"Addition span #{i} missing {attr}")

    required_deletion = {"data-timestamp", "data-identifier", "data-user", "fr-tracking-deleted"}
    for i, span in enumerate(deletion_spans, 1):
        for attr in required_deletion:
            if attr not in span:
                errors.append(f"Deletion span #{i} missing {attr}")

    return errors


def _check_froala_timestamps(html: str) -> list[str]:
    errors: list[str] = []
    for ts in re.findall(r'data-timestamp="(\d+)"', html):
        if len(ts) not in (10, 13):
            errors.append(
                f"Invalid timestamp '{ts}' — must be 10 digits (seconds) or 13 digits (milliseconds), got {len(ts)}"
            )
    return errors


def _check_froala_identifiers(html: str) -> list[str]:
    errors: list[str] = []
    for ident in re.findall(r'data-identifier="([^"]+)"', html):
        if not _UUID_RE.match(ident) and not _SHORT_NUMERIC_RE.match(ident):
            errors.append(f"Invalid data-identifier '{ident}' — must be UUID or 4-7 digit number")
    return errors


def _check_froala_smart_fields(html: str) -> list[str]:
    errors: list[str] = []
    required = {"data-is-smart-field", "data-change-type", "fr-highlight-change"}
    labels = {
        "data-is-smart-field": "data-is-smart-field attribute",
        "data-change-type": "data-change-type",
        "fr-highlight-change": "class fr-highlight-change on <a> tag",
    }
    for i, sf in enumerate(re.findall(r'<a[^>]*name="smart-field"[^>]*>', html), 1):
        for attr in required:
            if attr not in sf:
                errors.append(f"Smart field #{i} missing {labels[attr]}")
    return errors


def _build_template_row_text(template_html: str) -> dict[str, str]:
    """Return a map of row-key → plain-text for every <tr> in the template.

    Row-key is the first explicit line number found in the row (e.g. "3") or
    "row:<index>" for rows that carry no line-number span.
    Plain-text is the row's visible text with all HTML tags stripped.
    """
    rows = re.findall(r"<tr[^>]*>.*?</tr>", template_html)
    result: dict[str, str] = {}
    for i, row in enumerate(rows):
        line_nums = re.findall(r'data-is-line-number="true"[^>]*><span>(\d+)</span>', row)
        key = line_nums[0] if line_nums else f"row:{i}"
        result[key] = re.sub(r"<[^>]+>", " ", row)
    return result


def _extract_deletion_text(span_tag_and_body: str) -> str:
    """Strip HTML tags from a deletion span's inner content."""
    return re.sub(r"<[^>]+>", "", span_tag_and_body)


def _check_deletions_exist_in_template(fixture_html: str, template_html: str) -> list[str]:
    """For every deletion span in the fixture verify its text exists in the
    corresponding template row (matched by line number or row index)."""
    template_rows = _build_template_row_text(template_html)
    fixture_rows = re.findall(r"<tr[^>]*>.*?</tr>", fixture_html)

    errors: list[str] = []
    for i, row in enumerate(fixture_rows):
        deletions = re.findall(r'<span[^>]*data-change-type="deletion"[^>]*>(.*?)</span>', row)
        if not deletions:
            continue

        line_nums = re.findall(r'data-is-line-number="true"[^>]*><span>(\d+)</span>', row)
        row_key = line_nums[0] if line_nums else f"row:{i}"
        template_text = template_rows.get(row_key, "")

        for deleted_content in deletions:
            deleted_text = _extract_deletion_text(deleted_content).strip()
            if deleted_text and deleted_text not in template_text:
                errors.append(
                    f'Deletion text not found in template row {row_key!r}: "{deleted_text}"'
                )
    return errors


def check_froala(html: str, template_html: str | None = None) -> list[str]:
    errors = _check_unfilled_placeholders(html)
    errors += _check_froala_spans(html)
    errors += _check_froala_timestamps(html)
    errors += _check_froala_identifiers(html)
    errors += _check_froala_smart_fields(html)
    if "no-borders" in html and "data-or-legacy-html" not in html:
        errors.append('Table-based document missing data-or-legacy-html="true" on root div')
    if template_html is not None:
        errors += _check_deletions_exist_in_template(html, template_html)
    return errors


def check_sea(html: str) -> list[str]:
    errors = _check_unfilled_placeholders(html)

    ins_elements = re.findall(r"<ins[^>]*>", html)
    del_elements = re.findall(r"<del[^>]*>", html)
    cpm_ins = re.findall(r"<span[^>]*cpm-change-previous-ins[^>]*>", html)

    if not ins_elements and not cpm_ins and not del_elements:
        errors.append("No tracked changes found — document has neither additions nor deletions")

    for i, ins in enumerate(ins_elements, 1):
        if "ice-ins" not in ins:
            errors.append(f"<ins> element #{i} missing class ice-ins")

    for i, del_el in enumerate(del_elements, 1):
        if "ice-del" not in del_el:
            errors.append(f"<del> element #{i} missing class ice-del")

    for i, ph in enumerate(re.findall(r"<dfplaceholder[^>]*>", html), 1):
        if "dfsystemname" not in ph:
            errors.append(f"dfplaceholder #{i} missing dfsystemname attribute")
        if 'contenteditable="false"' not in ph:
            errors.append(f'dfplaceholder #{i} missing contenteditable="false"')

    return errors


def _find_template(fixture_path: Path) -> Path | None:
    """Return the template.html sibling of a fixture file, if it exists."""
    candidate = fixture_path.parent / "template.html"
    return candidate if candidate.exists() else None


def validate(path: Path) -> None:
    html = path.read_text(encoding="utf-8")
    fmt = detect_format(html)

    print(f"File:   {path}")
    print(f"Format: {fmt}")
    print()

    template_path = _find_template(path)
    template_html = template_path.read_text(encoding="utf-8") if template_path else None

    if fmt == "froala":
        errors = check_froala(html, template_html)
    elif fmt == "sea":
        errors = check_sea(html)
    else:
        print("WARNING: Could not detect format (froala/sea). Running basic checks only.")
        errors = _check_unfilled_placeholders(html)

    addition_count = len(re.findall(r'data-change-type="addition"', html)) + len(
        re.findall(r'class="[^"]*ice-ins[^"]*"', html)
    )
    deletion_count = len(re.findall(r'data-change-type="deletion"', html)) + len(
        re.findall(r'class="[^"]*ice-del[^"]*"', html)
    )
    print(f"Additions: {addition_count}")
    print(f"Deletions: {deletion_count}")
    print()

    if errors:
        print(f"✗ Found {len(errors)} error(s):\n")
        for error in errors:
            print(f"  • {error}")
        print()
        sys.exit(1)
    else:
        print("✓ Fixture is valid")


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <fixture.html>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"Error: file not found: {path}")
        sys.exit(1)

    validate(path)


if __name__ == "__main__":
    main()

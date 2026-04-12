"""Format and sub-type detection for OR V1 (Froala) and SEA fixture HTML files."""

from __future__ import annotations


def detect_format(html: str) -> str:
    if (
        "cpm-main-clause" in html
        or "cp-editable-line" in html
        or "ice-ins" in html
        or "ice-del" in html
    ):
        return "sea"
    if "fr-element" in html or "fr-view" in html or "no-borders" in html:
        return "froala"
    return "unknown"


def detect_subtype(html: str) -> str:
    if "outside-margins" in html:
        return "nype46"
    if "roboto" in html.lower() and "no-borders" in html and "<section" not in html:
        return "nype81"
    if "<section" in html:
        return "gencon1994" if ("gencon" in html.lower() or "GENCON" in html) else "nype93"
    if "GENCON" in html or "gencon" in html.lower():
        return "gencon1994"
    if "cpm-main-clause" in html or "cp-editable-line" in html:
        if "nype46" in html or "NYPE 46" in html:
            return "sea/nype46"
        if "nype81" in html or "NYPE 81" in html:
            return "sea/nype81"
        return "sea"
    return "unknown"


def requires_legacy_attr(subtype: str) -> bool:
    """data-or-legacy-html="true" required for nype46, nype81, nype2015, gencon1976."""
    return subtype in ("nype46", "nype81", "nype2015", "gencon1976")


def ec6_allowed(subtype: str) -> bool:
    """ec6 (<br data-change-type="addition">) is nype81/nype2015 only."""
    return subtype in ("nype81", "nype2015")


def user_uuid(subtype: str) -> str:
    """Canonical user UUID per sub-type (from §8 Metadata Rules)."""
    if subtype == "nype46":
        return "53b51b06-ca6e-4ad5-83a6-fd0a78fa76b1"
    return "9d5432e9-8811-431b-83e6-d8fc21582f6a"

"""Shared parsing helpers for material composition and percentage text."""

from __future__ import annotations

import re

_COMPOSITION_PERCENT_PATTERN = re.compile(
    r"(?P<label>[^;\n%]+?)\s*(?:[:=]?\s*)?(?P<value>\d{1,3}(?:[.,]\d+)?)\s*%",
    re.IGNORECASE,
)


def extract_percentages_from_text(text: str | None) -> list[float]:
    """Parse percentage values from free-text composition or recycled-content fields."""
    if not text:
        return []
    values: list[float] = []
    for match in _COMPOSITION_PERCENT_PATTERN.finditer(text):
        raw = match.group("value").replace(",", ".")
        try:
            values.append(float(raw))
        except ValueError:
            continue
    return values

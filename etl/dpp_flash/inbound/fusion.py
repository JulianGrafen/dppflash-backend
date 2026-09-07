"""Data-fusion engine — master-fallback merge for DPP drafts.

Rule
----
``master_data`` (e.g. SAP ERP) is the single source of truth. ``enrichment_data``
(e.g. LangGraph SDS extraction) may only contribute a value when the master field
is *explicitly empty* (``None``, ``""``, ``[]``, ``{}``) or absent.

The merge is fully recursive so nested objects (``supplier_contact`` inside a BOM
item) are fused field-by-field instead of being overwritten wholesale.
"""

from __future__ import annotations

from typing import Any

# Keys used to align list items (e.g. BOM lines) between master and enrichment.
# First key present on both sides wins. Extend this tuple for new list schemas.
_LIST_MATCH_KEYS: tuple[str, ...] = ("bom_number", "upi", "id")


def _is_empty(value: Any) -> bool:
    """Return True for values the master-fallback rule treats as 'missing'."""
    return value is None or value == "" or value == [] or value == {}


def _match_key_for(items: list[Any]) -> str | None:
    """Pick the identity key shared by every dict item of a list, if any."""
    for key in _LIST_MATCH_KEYS:
        if all(isinstance(item, dict) and not _is_empty(item.get(key)) for item in items):
            return key
    return None


def _merge_lists(master: list[Any], enrichment: list[Any]) -> list[Any]:
    """Fuse two lists of dicts item-by-item.

    Strategy:
    1. If both sides expose a shared identity key (``bom_number`` etc.), align by
       that key: master items are enriched in place, enrichment-only items are
       appended (they fill a gap the master did not know about).
    2. Otherwise fall back to positional (index-wise) merging.
    Non-dict lists (e.g. ``safety_warnings``) never reach this function — the
    master list wins as a whole once it is non-empty (see :func:`deep_merge_dpp`).
    """
    match_key = _match_key_for(master)
    if match_key is not None and match_key != _match_key_for(enrichment):
        match_key = None
    if match_key:
        enrichment_by_key = {item[match_key]: item for item in enrichment}
        merged = [
            deep_merge_dpp(item, enrichment_by_key.get(item[match_key], {}))
            for item in master
        ]
        master_keys = {item[match_key] for item in master}
        merged.extend(
            item for key, item in enrichment_by_key.items() if key not in master_keys
        )
        return merged

    merged = []
    for index, master_item in enumerate(master):
        enrichment_item = enrichment[index] if index < len(enrichment) else None
        if isinstance(master_item, dict) and isinstance(enrichment_item, dict):
            merged.append(deep_merge_dpp(master_item, enrichment_item))
        else:
            merged.append(master_item)
    return merged


def deep_merge_dpp(master_data: dict[str, Any], enrichment_data: dict[str, Any]) -> dict[str, Any]:
    """Recursively fuse ``enrichment_data`` into ``master_data`` (master wins).

    Contract:
    - Master values that are non-empty are never touched.
    - Empty master fields (``None``/``""``/``[]``/``{}``) or missing keys are
      filled from the enrichment source.
    - Nested dicts are merged recursively; lists of dicts item-by-item
      (see :func:`_merge_lists`).
    - Inputs are not mutated; a new dict is returned.
    """
    merged: dict[str, Any] = dict(master_data)

    for key, enrichment_value in enrichment_data.items():
        if _is_empty(enrichment_value):
            continue

        master_value = merged.get(key)

        if _is_empty(master_value):
            merged[key] = enrichment_value
        elif isinstance(master_value, dict) and isinstance(enrichment_value, dict):
            merged[key] = deep_merge_dpp(master_value, enrichment_value)
        elif isinstance(master_value, list) and isinstance(enrichment_value, list):
            merged[key] = _merge_lists(master_value, enrichment_value)
        # else: master scalar wins — nothing to do.

    return merged

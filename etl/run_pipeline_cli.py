#!/usr/bin/env python3
"""
Run the DPP LangGraph pipeline from JSON on stdin; emit JSON on stdout.

Used by Next.js `POST /api/etl/run`.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from enum import Enum
from typing import Any

from etl.graph.graph import graph, initial_state


def _apply_runtime_env(payload: dict[str, Any]) -> None:
    """Apply server-side env forwarded from Next.js (Render runtime secrets)."""
    runtime = payload.get("_runtime_env")
    if not isinstance(runtime, dict):
        return
    for key, value in runtime.items():
        if isinstance(key, str) and isinstance(value, str) and value.strip():
            os.environ[key] = value.strip()


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_jsonable(item) for key, item in value.items()}
    return value


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"Invalid JSON input: {exc}"}), file=sys.stderr)
        return 1

    _apply_runtime_env(payload)
    payload.pop("_runtime_env", None)

    raw_document = payload.get("raw_document") or {}
    sku_master_data = payload.get("sku_master_data")
    sap_export = payload.get("sap_export")
    supplier_odata = payload.get("supplier_odata")
    max_attempts = payload.get("max_extraction_attempts", 3)

    try:
        state = initial_state(
            raw_document,
            sku_master_data=sku_master_data,
            supplier_odata=supplier_odata,
            max_extraction_attempts=max_attempts,
        )
        if sap_export:
            state["sap_export"] = sap_export
        result = asyncio.run(graph.ainvoke(state, config={"recursion_limit": 50}))
        print(json.dumps(_to_jsonable(result), ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001 — surface pipeline errors to the API caller
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

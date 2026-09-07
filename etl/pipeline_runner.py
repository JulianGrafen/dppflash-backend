"""Shared LangGraph pipeline execution for CLI and HTTP service."""

from __future__ import annotations

import asyncio
import os
from enum import Enum
from typing import Any


def apply_runtime_env(payload: dict[str, Any]) -> dict[str, bool | int]:
    """Apply server-side env forwarded from Next.js (Render runtime secrets)."""
    runtime = payload.get("_runtime_env")
    applied = False
    if isinstance(runtime, dict):
        for key, value in runtime.items():
            if isinstance(key, str) and isinstance(value, str) and value.strip():
                os.environ[key] = value.strip()
                applied = True
    return {
        "secret_in_environ": bool(os.environ.get("SUPPLIER_OUTREACH_SECRET", "").strip()),
        "runtime_env_applied": applied,
        "runtime_env_key_count": len(runtime) if isinstance(runtime, dict) else 0,
    }


def to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    return value


async def run_pipeline_payload(payload: dict[str, Any]) -> dict[str, Any]:
    from etl.graph.graph import graph, initial_state

    env_debug = apply_runtime_env(payload)
    body = dict(payload)
    body.pop("_runtime_env", None)

    raw_document = body.get("raw_document") or {}
    sku_master_data = body.get("sku_master_data")
    sap_export = body.get("sap_export")
    supplier_odata = body.get("supplier_odata")
    max_attempts = body.get("max_extraction_attempts", 3)

    state = initial_state(
        raw_document,
        sku_master_data=sku_master_data,
        supplier_odata=supplier_odata,
        max_extraction_attempts=max_attempts,
    )
    if sap_export:
        state["sap_export"] = sap_export
    metadata = dict(state.get("metadata") or {})
    metadata["_pipeline_env_debug"] = env_debug
    state["metadata"] = metadata

    result = await graph.ainvoke(state, config={"recursion_limit": 50})
    return to_jsonable(result)


def run_pipeline_payload_sync(payload: dict[str, Any]) -> dict[str, Any]:
    return asyncio.run(run_pipeline_payload(payload))

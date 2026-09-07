#!/usr/bin/env python3
"""Run the DPP LangGraph pipeline from JSON on stdin; emit JSON on stdout."""

from __future__ import annotations

import json
import sys

from etl.pipeline_runner import run_pipeline_payload_sync


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"Invalid JSON input: {exc}"}), file=sys.stderr)
        return 1

    try:
        print(json.dumps(run_pipeline_payload_sync(payload), ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""SMTP test CLI — stdin JSON `{ "to": "user@example.com" }`, stdout JSON result."""

from __future__ import annotations

import json
import os
import sys

from etl.services.mailer import send_smtp_test_email


def _apply_runtime_env(payload: dict) -> None:
    runtime = payload.get("_runtime_env")
    if not isinstance(runtime, dict):
        return
    for key, value in runtime.items():
        if isinstance(key, str) and isinstance(value, str) and value.strip():
            os.environ[key] = value.strip()


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {exc}"}), file=sys.stderr)
        return 1

    _apply_runtime_env(payload)
    to_address = str(payload.get("to") or "").strip()
    result = send_smtp_test_email(to_address)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env bash
# Runs the LangGraph DPP pipeline with the project venv (avoids system python3 without langgraph).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/etl/run_pipeline_cli.py"

if [[ -n "${ETL_PYTHON:-}" && -x "${ETL_PYTHON}" ]]; then
  PYTHON="$ETL_PYTHON"
elif [[ -x "$ROOT/.venv-langgraph/bin/python" ]]; then
  PYTHON="$ROOT/.venv-langgraph/bin/python"
elif [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="python3"
fi

export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
exec "$PYTHON" "$CLI"

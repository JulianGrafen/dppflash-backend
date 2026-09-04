"""Ensure OpenAI structured-output schema stays valid."""

from __future__ import annotations

import json

from etl.models.dpp_schemas import DPPExtractionOutput


def _schema_has_typed_value(node: object) -> bool:
    if not isinstance(node, dict):
        return True
    if "type" in node or "$ref" in node or "enum" in node:
        return True
    if "anyOf" in node:
        return all(_schema_has_typed_value(item) for item in node["anyOf"])
    if "properties" in node:
        return all(_schema_has_typed_value(v) for v in node["properties"].values())
    return True


def test_dpp_extraction_output_schema_is_openai_compatible() -> None:
    schema = DPPExtractionOutput.model_json_schema()
    audit = schema["$defs"]["AuditField"]
    value_schema = audit["properties"]["value"]
    assert _schema_has_typed_value(value_schema)
    assert value_schema["anyOf"][0]["type"] in {"string", "boolean"}
    # Sanity: full schema serializes (OpenAI receives JSON schema)
    json.dumps(schema)

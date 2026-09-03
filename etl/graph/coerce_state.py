"""
Coerce LangGraph Studio JSON state into typed Pydantic models.

LangGraph passes nested state values as plain dicts at runtime — nodes must
normalise before attribute access.
"""

from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

from etl.graph.state import (
    EspAuditReport,
    GapRecord,
    RawDocumentInput,
    SkuMasterData,
    ValidationReport,
)
from etl.models.dpp_schemas import DPPAnalysisResult

ModelT = TypeVar("ModelT", bound=BaseModel)


def coerce_model(model_cls: type[ModelT], value: object | None) -> ModelT | None:
    if value is None:
        return None
    if isinstance(value, model_cls):
        return value
    if isinstance(value, dict):
        return model_cls.model_validate(value)
    raise TypeError(f"Expected {model_cls.__name__} or dict, got {type(value).__name__}")


def coerce_raw_document(value: object | None) -> RawDocumentInput | None:
    return coerce_model(RawDocumentInput, value)


def coerce_sku_master_data(value: object | None) -> SkuMasterData | None:
    return coerce_model(SkuMasterData, value)


def coerce_extracted_data(value: object | None) -> DPPAnalysisResult | None:
    return coerce_model(DPPAnalysisResult, value)


def coerce_validation_report(value: object | None) -> ValidationReport | None:
    return coerce_model(ValidationReport, value)


def coerce_espr_audit_report(value: object | None) -> EspAuditReport | None:
    return coerce_model(EspAuditReport, value)


def coerce_gaps(value: object | None) -> list[GapRecord]:
    if not value:
        return []
    gaps: list[GapRecord] = []
    for item in value:  # type: ignore[union-attr]
        coerced = coerce_model(GapRecord, item)
        if coerced is not None:
            gaps.append(coerced)
    return gaps

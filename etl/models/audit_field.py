"""
Audit trail wrapper for every DPP field exposed to compliance auditors.

Each extracted or enriched value carries provenance: source system, exact location
(verbatim document quote or SAP table.field path), and extraction timestamp.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

T = TypeVar("T")


class SourceSystem(str, Enum):
    """Origin system for an audited field value."""

    DOCUMENT_SDS = "DOCUMENT_SDS"
    SAP_VENDOR_MASTER = "SAP_VENDOR_MASTER"
    SAP_PO_HISTORY = "SAP_PO_HISTORY"
    SAP_SRM = "SAP_SRM"
    ERP_MASTER_DATA = "ERP_MASTER_DATA"
    HUMAN_INPUT = "HUMAN_INPUT"
    SYSTEM_INFERENCE = "SYSTEM_INFERENCE"


class AuditField(BaseModel):
    """
    Auditable field for pipeline state and post-extraction provenance.

    OpenAI structured output uses ``LLMAuditStr`` / ``LLMAuditBool`` (typed ``value``);
    convert via ``llm_audit_to_field()`` in ``to_analysis_result()``.
    """

    model_config = ConfigDict(extra="forbid")

    value: str | bool | None = Field(
        default=None,
        description="Extracted or enriched value. Null when not present in the source.",
    )
    source_system: str = Field(
        default=SourceSystem.DOCUMENT_SDS.value,
        description="System that supplied the value (DOCUMENT_SDS, SAP_*, HUMAN_INPUT, …).",
    )
    source_detail: str | None = Field(
        default=None,
        description=(
            "Exact location in the source: verbatim document quote for SDS/PDF text, "
            "or SAP technical path (e.g. 'Tabelle LFA1, Feld ADR6-SMTP_ADDR')."
        ),
    )
    timestamp: datetime | None = Field(
        default=None,
        description="ISO-8601 UTC timestamp when the value was captured.",
    )

    @field_serializer("source_system")
    @classmethod
    def _serialize_source_system(cls, value: str) -> str:
        return value.value if isinstance(value, SourceSystem) else value

    @model_validator(mode="before")
    @classmethod
    def _coerce_primitive(cls, data: Any) -> Any:
        """Allow legacy plain values in tests and JSON imports."""
        if data is None or isinstance(data, cls):
            return data
        if isinstance(data, dict):
            return data
        if isinstance(data, bool):
            return cls.from_document(data).model_dump(mode="python")
        return cls.from_document(data).model_dump(mode="python")

    @classmethod
    def now(cls) -> datetime:
        return datetime.now(timezone.utc)

    @classmethod
    def from_document(
        cls,
        value: Any,
        *,
        source_detail: str | None = None,
        timestamp: datetime | None = None,
    ) -> AuditField:
        normalized: str | bool | None
        if isinstance(value, bool):
            normalized = value
        elif value is None:
            normalized = None
        else:
            normalized = str(value)
        return cls(
            value=normalized,
            source_system=SourceSystem.DOCUMENT_SDS.value,
            source_detail=source_detail,
            timestamp=timestamp or cls.now(),
        )

    @classmethod
    def from_sap(
        cls,
        value: Any,
        source_detail: str,
        *,
        source_system: SourceSystem | str = SourceSystem.SAP_VENDOR_MASTER,
        timestamp: datetime | None = None,
    ) -> AuditField:
        system = source_system.value if isinstance(source_system, SourceSystem) else source_system
        return cls(
            value=str(value) if value is not None else None,
            source_system=system,
            source_detail=source_detail,
            timestamp=timestamp or cls.now(),
        )

    @classmethod
    def from_erp_master(
        cls,
        value: Any,
        source_detail: str,
        *,
        timestamp: datetime | None = None,
    ) -> AuditField:
        return cls(
            value=str(value) if value is not None else None,
            source_system=SourceSystem.ERP_MASTER_DATA.value,
            source_detail=source_detail,
            timestamp=timestamp or cls.now(),
        )

    @classmethod
    def from_inference(
        cls,
        value: Any,
        source_detail: str,
        *,
        timestamp: datetime | None = None,
    ) -> AuditField:
        normalized: str | bool | None
        if isinstance(value, bool):
            normalized = value
        elif isinstance(value, (int, float)):
            normalized = str(value)
        elif value is None:
            normalized = None
        else:
            normalized = str(value)
        return cls(
            value=normalized,
            source_system=SourceSystem.SYSTEM_INFERENCE.value,
            source_detail=source_detail,
            timestamp=timestamp or cls.now(),
        )

    def with_timestamp(self) -> AuditField:
        if self.timestamp is not None:
            return self
        return self.model_copy(update={"timestamp": self.now()})


def audit_value(field: AuditField | Any | None) -> Any | None:
    """Unwrap an audited field (or pass through legacy primitives)."""
    if field is None:
        return None
    if isinstance(field, AuditField):
        return field.value
    return field


def audit_text(field: AuditField | Any | None) -> str | None:
    value = audit_value(field)
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value)


def is_audit_field_filled(field: AuditField | Any | None) -> bool:
    value = audit_value(field)
    if value is None:
        return False
    if isinstance(value, bool):
        return True
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return len(value) > 0
    return True


def stamp_audit_tree(value: Any, *, default_source: SourceSystem = SourceSystem.DOCUMENT_SDS) -> Any:
    """Recursively stamp missing timestamps on AuditField instances in nested models."""
    if isinstance(value, AuditField):
        stamped = value.with_timestamp()
        if stamped.source_system == SourceSystem.DOCUMENT_SDS.value and stamped.value is not None:
            return stamped
        return stamped.with_timestamp() if stamped.timestamp is None else stamped
    if isinstance(value, BaseModel):
        updates: dict[str, Any] = {}
        for name in type(value).model_fields:
            current = getattr(value, name)
            updated = stamp_audit_tree(current, default_source=default_source)
            if updated is not current:
                updates[name] = updated
        return value.model_copy(update=updates) if updates else value
    if isinstance(value, list):
        return [stamp_audit_tree(item, default_source=default_source) for item in value]
    if isinstance(value, dict):
        return {key: stamp_audit_tree(item, default_source=default_source) for key, item in value.items()}
    return value


def iter_audit_string_leaves(value: Any) -> list[str]:
    """Collect string leaves from nested audited structures for cross-field rules (e.g. SCIP)."""
    if value is None:
        return []
    if isinstance(value, AuditField):
        return iter_audit_string_leaves(value.value) + (
            [value.source_detail.strip()] if value.source_detail and value.source_detail.strip() else []
        )
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    if isinstance(value, BaseModel):
        parts: list[str] = []
        for name in type(value).model_fields:
            parts.extend(iter_audit_string_leaves(getattr(value, name)))
        return parts
    if isinstance(value, dict):
        return [leaf for nested in value.values() for leaf in iter_audit_string_leaves(nested)]
    if isinstance(value, list):
        return [leaf for item in value for leaf in iter_audit_string_leaves(item)]
    return []

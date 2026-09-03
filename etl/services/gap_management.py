"""
Gap management — auditable ESPR gap report for compliance workflows.
"""

from __future__ import annotations

from etl.graph.state import GapRecord, GapRemediationPlan
from etl.models.dpp_schemas import DPPAnalysisResult


def _resolve_product_identifier(result: DPPAnalysisResult | None) -> str | None:
    if result is None:
        return None

    if result.identification is not None:
        upi = result.identification.unique_product_identifier
        if isinstance(upi, str) and upi.strip():
            return upi.strip()

    if result.economic_operator is not None:
        manufacturer = result.economic_operator.manufacturer_name
        if isinstance(manufacturer, str) and manufacturer.strip():
            return manufacturer.strip()

    return None


def build_gap_remediation_plan(
    gaps: list[GapRecord],
    extracted_data: DPPAnalysisResult | None,
) -> GapRemediationPlan:
    """
    Summarise detected ESPR gaps and recommended manual follow-up actions.
    """
    product_identifier = _resolve_product_identifier(extracted_data)

    recommended_actions: list[str] = []
    if not product_identifier:
        recommended_actions.append(
            "Produktkennung fehlt — manuelle Prüfung oder erneute Extraktion aus Abschnitt 1 erforderlich."
        )
    if any(gap.severity == "critical" for gap in gaps):
        recommended_actions.append(
            "Kritische Lücken (Massenbilanz/Composition) — SDS Abschnitt 3 manuell gegenprüfen."
        )
    if gaps:
        recommended_actions.append(
            "Fehlende ESPR-Felder manuell ergänzen oder Quelldokumente nachreichen."
        )
    else:
        recommended_actions.append("Keine offenen Lücken — DPP kann zur Freigabe weitergeleitet werden.")

    return GapRemediationPlan(
        product_identifier=product_identifier,
        gap_count=len(gaps),
        gaps=gaps,
        recommended_actions=recommended_actions,
    )

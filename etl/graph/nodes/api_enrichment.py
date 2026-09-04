"""API enrichment node (SPHIER/ERP lookup)."""

from __future__ import annotations

from typing import Any

from etl.graph.coerce_state import coerce_extracted_data, coerce_gaps, coerce_sku_master_data
from etl.graph.state import DppGraphState, EnrichmentStage
from etl.services.enrichment import lookup_sphier_eprm_api


async def api_enrichment_node(state: DppGraphState) -> dict[str, Any]:
    extracted_data = coerce_extracted_data(state.get("extracted_data"))
    gaps = coerce_gaps(state.get("gaps"))

    if extracted_data is None:
        return {"errors": ["api_enrichment_node: extracted_data is missing."]}

    result = lookup_sphier_eprm_api(
        extracted_data=extracted_data,
        gaps=gaps,
        sku_master_data=coerce_sku_master_data(state.get("sku_master_data")),
    )

    return {
        "enrichment_stage": EnrichmentStage.API_LOOKUP,
        "enrichment_result": result,
        "gaps": result.remaining_gaps,
        "extracted_data": extracted_data,
    }

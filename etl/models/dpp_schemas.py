"""
Pydantic v2 schemas for EU-ESPR Digital Product Passport (DPP).

Gap-analysis scope (Regulation EU 2024/1781)
--------------------------------------------
44 ESPR fields across 5 themes:
  1. Identification          (6)  — horizontal, all products
  2. Economic Operator       (4)  — horizontal, all products
  3. System Requirements    (11)  — horizontal, all products
  4. Product Details         (9+) — vertical, category-specific extensions
  5. Sustainability          (8+) — vertical, category-specific extensions

Horizontal pillars are always evaluated. Vertical pillars use category-specific
subclasses so the LLM schema only exposes relevant delegated-act fields.

OpenAI Structured Outputs: root model `DPPAnalysisResult` is passed as
`response_format=DPPAnalysisResult`.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing_extensions import Self

# Full ESPR gap-analysis field universe (38 base + 6 category extensions).
ESPR_TOTAL_FIELD_COUNT = 44


class ProductCategory(str, Enum):
    """ESPR product category inferred from the source document (Delegated Acts)."""

    TEXTILES_APPAREL = "TEXTILES_APPAREL"
    ELECTRONICS = "ELECTRONICS"
    BATTERIES = "BATTERIES"
    GENERIC = "GENERIC"


# ── Horizontal pillar 1: Identification (6 fields) ───────────────────────────


class DPPIdentification(BaseModel):
    """ESPR identification block — applies to every product category."""

    model_config = ConfigDict(extra="forbid")

    unique_product_identifier: Optional[str] = Field(
        default=None,
        description=(
            "Unique Product Identifier (UPI): internal article code, SDB-Nr., "
            "product code, or Item No. Copy verbatim; never fabricate."
        ),
    )
    data_carrier_type: Optional[str] = Field(
        default=None,
        description=(
            "Physical data carrier type, e.g. 'QR Code', 'Data Matrix', 'RFID'. "
            "Null if not mentioned."
        ),
    )
    gtin_or_equivalent: Optional[str] = Field(
        default=None,
        description=(
            "GTIN, EAN, or equivalent trade identifier (8, 12, 13, or 14 digits). "
            "Only when explicitly labelled as GTIN/EAN/barcode."
        ),
    )
    commodity_code_taric: Optional[str] = Field(
        default=None,
        description="EU TARIC / HS commodity code if stated, e.g. '3214 10 10'.",
    )
    unique_facility_identifier: Optional[str] = Field(
        default=None,
        description=(
            "Unique facility identifier (production site / manufacturing plant ID) "
            "if stated. Null if absent."
        ),
    )
    link_to_previous_dpps: Optional[str] = Field(
        default=None,
        description=(
            "URL or reference linking to previous DPP versions for the same product. "
            "Null if absent."
        ),
    )


# ── Horizontal pillar 2: Economic Operator (4 fields) ────────────────────────


class DPPEconomicOperator(BaseModel):
    """Manufacturer / economic-operator contact block — all products."""

    model_config = ConfigDict(extra="forbid")

    manufacturer_name: Optional[str] = Field(
        default=None,
        description="Legal manufacturer name exactly as printed (e.g. SDS Section 1).",
    )
    manufacturer_address: Optional[str] = Field(
        default=None,
        description="Full postal address: street, postal code, city, country.",
    )
    electronic_contact_details: Optional[str] = Field(
        default=None,
        description="Primary email or electronic contact for regulatory queries.",
    )
    unique_operator_identifier: Optional[str] = Field(
        default=None,
        description=(
            "Unique economic-operator identifier (EORI, company registration, "
            "operator ID) if stated. Null if absent."
        ),
    )


# ── Horizontal pillar 3: System Requirements (11 fields) ─────────────────────


class DPPSystemRequirements(BaseModel):
    """ESPR DPP system & access requirements — all products."""

    model_config = ConfigDict(extra="forbid")

    eu_declaration_of_conformity: Optional[str] = Field(
        default=None,
        description="EU Declaration of Conformity reference or statement if present.",
    )
    backup_dpp_provider: Optional[str] = Field(
        default=None,
        description="Named backup DPP service provider if stated.",
    )
    availability_duration: Optional[str] = Field(
        default=None,
        description="Declared DPP data availability period, e.g. '15 years after last unit placed on market'.",
    )
    data_authenticity_integrity: Optional[str] = Field(
        default=None,
        description="Measures ensuring data authenticity and integrity if described.",
    )
    accessible_before_purchase: Optional[bool] = Field(
        default=None,
        description="True if document states DPP/data is accessible before purchase.",
    )
    actor_creating_dpp: Optional[str] = Field(
        default=None,
        description="Entity responsible for creating the DPP if named.",
    )
    actor_updating_dpp: Optional[str] = Field(
        default=None,
        description="Entity responsible for updating the DPP if named.",
    )
    provide_digital_copy_dealers: Optional[bool] = Field(
        default=None,
        description="True if dealers must receive a digital DPP copy per document.",
    )
    open_interoperable_data: Optional[bool] = Field(
        default=None,
        description="True if open, interoperable data format is declared.",
    )
    free_of_charge_access: Optional[bool] = Field(
        default=None,
        description="True if free-of-charge DPP access is declared.",
    )
    rights_modify_restricted: Optional[str] = Field(
        default=None,
        description="Restrictions on who may modify DPP data, if stated.",
    )


# ── Vertical pillar 4: Product Details (base 9 fields) ───────────────────────


class BaseProductDetails(BaseModel):
    """Shared product-detail fields across all delegated-act categories."""

    model_config = ConfigDict(extra="forbid")

    product_photo: Optional[str] = Field(
        default=None,
        description="Reference/URL to product photo if present in the document.",
    )
    product_dimensions: Optional[str] = Field(
        default=None,
        description="Product dimensions with units, e.g. '120 mm × 80 mm × 15 mm'.",
    )
    product_weight: Optional[str] = Field(
        default=None,
        description="Product weight with unit, e.g. '1.2 kg'.",
    )
    product_volume: Optional[str] = Field(
        default=None,
        description="Product volume with unit if applicable, e.g. '500 ml'.",
    )
    contains_critical_raw_materials: Optional[bool] = Field(
        default=None,
        description="True if critical raw materials are declared present.",
    )
    contains_svhc: Optional[bool] = Field(
        default=None,
        description=(
            "True if SVHC (REACH Art. 57) above 0.1% w/w is declared. "
            "False if explicitly absent. Null if not stated."
        ),
    )
    location_of_substances: Optional[str] = Field(
        default=None,
        description="Location of substances of concern within the product if described.",
    )
    user_manual_digital: Optional[str] = Field(
        default=None,
        description="Digital user manual reference or URL if stated.",
    )
    warnings_safety_information: Optional[str] = Field(
        default=None,
        description="Warnings and safety information (SDS Section 2, label text).",
    )


class GenericProductDetails(BaseProductDetails):
    category: Literal[ProductCategory.GENERIC] = ProductCategory.GENERIC


class TextileProductDetails(BaseProductDetails):
    category: Literal[ProductCategory.TEXTILES_APPAREL] = ProductCategory.TEXTILES_APPAREL
    recycled_content_by_material: Optional[str] = Field(
        default=None,
        description=(
            "Recycled content broken down by material/fibre, "
            "e.g. 'Polyester 30% post-consumer recycled'."
        ),
    )


class ElectronicsProductDetails(BaseProductDetails):
    category: Literal[ProductCategory.ELECTRONICS] = ProductCategory.ELECTRONICS


class BatteryProductDetails(BaseProductDetails):
    category: Literal[ProductCategory.BATTERIES] = ProductCategory.BATTERIES


ProductDetailsModel = Annotated[
    Union[
        GenericProductDetails,
        TextileProductDetails,
        ElectronicsProductDetails,
        BatteryProductDetails,
    ],
    Field(discriminator="category"),
]


# ── Vertical pillar 5: Sustainability (base 8 fields) ──────────────────────


class BaseSustainabilityCircularity(BaseModel):
    """Shared sustainability & circularity fields for all categories."""

    model_config = ConfigDict(extra="forbid")

    durability_reliability: Optional[str] = Field(
        default=None,
        description="Durability / reliability information or expected service life.",
    )
    repairability_info: Optional[str] = Field(
        default=None,
        description="Repairability score, index, or qualitative repairability statement.",
    )
    recyclability_info: Optional[str] = Field(
        default=None,
        description="Recyclability instructions, sorting guidance, or stated rate.",
    )
    environmental_footprint: Optional[str] = Field(
        default=None,
        description=(
            "Environmental footprint metric if stated, e.g. "
            "'2.4 kg CO₂e per unit (cradle-to-gate)'."
        ),
    )
    resource_use: Optional[str] = Field(
        default=None,
        description="Resource-use information (materials, water, energy inputs).",
    )
    resource_efficiency: Optional[str] = Field(
        default=None,
        description="Resource-efficiency statements or metrics if present.",
    )
    material_composition: Optional[str] = Field(
        default=None,
        description=(
            "Material composition summary targeting mass balance "
            "(SDS Section 3 / product datasheet)."
        ),
    )
    end_of_life_treatment: Optional[str] = Field(
        default=None,
        description=(
            "End-of-life treatment / disposal guidance including EWC references "
            "(SDS Section 13, Entsorgungshinweise)."
        ),
    )


class GenericSustainability(BaseSustainabilityCircularity):
    category: Literal[ProductCategory.GENERIC] = ProductCategory.GENERIC


class TextileSustainability(BaseSustainabilityCircularity):
    category: Literal[ProductCategory.TEXTILES_APPAREL] = ProductCategory.TEXTILES_APPAREL


class ElectronicsSustainability(BaseSustainabilityCircularity):
    category: Literal[ProductCategory.ELECTRONICS] = ProductCategory.ELECTRONICS
    energy_use: Optional[str] = Field(
        default=None,
        description="Energy-use information, e.g. annual kWh consumption.",
    )
    energy_efficiency: Optional[str] = Field(
        default=None,
        description="Energy-efficiency class or rating if stated.",
    )
    disassembly_instructions: Optional[str] = Field(
        default=None,
        description="Disassembly instructions for repair or recycling.",
    )
    repair_instructions: Optional[str] = Field(
        default=None,
        description="Repair or maintenance instructions if present.",
    )
    spare_parts_availability: Optional[str] = Field(
        default=None,
        description="Spare-parts availability period or policy if stated.",
    )


class BatterySustainability(BaseSustainabilityCircularity):
    category: Literal[ProductCategory.BATTERIES] = ProductCategory.BATTERIES


SustainabilityModel = Annotated[
    Union[
        GenericSustainability,
        TextileSustainability,
        ElectronicsSustainability,
        BatterySustainability,
    ],
    Field(discriminator="category"),
]


class ExtractionMetadata(BaseModel):
    """Extraction provenance — populated by DPPExtractor, not the LLM."""

    model_config = ConfigDict(extra="forbid")

    source_filename: Optional[str] = Field(default=None)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)
    schema_version: str = Field(default="ESPR_ETL_V2")


class ExtractProductDetails(BaseProductDetails):
    """Flat product-details block — OpenAI Structured Outputs compatible (no oneOf)."""

    recycled_content_by_material: Optional[str] = Field(
        default=None,
        description="Recycled content by material/fibre when stated (textiles).",
    )


class ExtractSustainability(BaseSustainabilityCircularity):
    """Flat sustainability block — OpenAI Structured Outputs compatible (no oneOf)."""

    energy_use: Optional[str] = Field(default=None, description="Energy-use information if stated.")
    energy_efficiency: Optional[str] = Field(default=None, description="Energy-efficiency class if stated.")
    disassembly_instructions: Optional[str] = Field(default=None, description="Disassembly instructions.")
    repair_instructions: Optional[str] = Field(default=None, description="Repair instructions.")
    spare_parts_availability: Optional[str] = Field(default=None, description="Spare-parts availability.")


class DPPExtractionOutput(BaseModel):
    """
    LLM structured-output schema (flat, no discriminated unions).

    OpenAI rejects oneOf/anyOf in nested response_format schemas.
    Convert to `DPPAnalysisResult` via `.to_analysis_result()` after parsing.
    """

    model_config = ConfigDict(extra="forbid")

    product_category: ProductCategory = Field(
        description=(
            "Detected ESPR product category. Choose TEXTILES_APPAREL, ELECTRONICS, "
            "BATTERIES, or GENERIC when no delegated act clearly applies."
        ),
    )
    identification: Optional[DPPIdentification] = None
    economic_operator: Optional[DPPEconomicOperator] = None
    product_details: Optional[ExtractProductDetails] = None
    sustainability: Optional[ExtractSustainability] = None
    system_requirements: Optional[DPPSystemRequirements] = None
    metadata: ExtractionMetadata = Field(default_factory=ExtractionMetadata)

    def to_analysis_result(self) -> "DPPAnalysisResult":
        product_details: BaseProductDetails | None = None
        if self.product_details is not None:
            product_details = _coerce_product_details(
                self.product_category,
                self.product_details,
            )

        sustainability: BaseSustainabilityCircularity | None = None
        if self.sustainability is not None:
            sustainability = _coerce_sustainability(
                self.product_category,
                self.sustainability,
            )

        return DPPAnalysisResult(
            product_category=self.product_category,
            identification=self.identification,
            economic_operator=self.economic_operator,
            product_details=product_details,  # type: ignore[arg-type]
            sustainability=sustainability,  # type: ignore[arg-type]
            system_requirements=self.system_requirements,
            metadata=self.metadata,
        )


# ── Gap-analysis helpers ───────────────────────────────────────────────────────

_CATEGORY_PRODUCT_DETAILS: dict[ProductCategory, type[BaseProductDetails]] = {
    ProductCategory.GENERIC: GenericProductDetails,
    ProductCategory.TEXTILES_APPAREL: TextileProductDetails,
    ProductCategory.ELECTRONICS: ElectronicsProductDetails,
    ProductCategory.BATTERIES: BatteryProductDetails,
}

_CATEGORY_SUSTAINABILITY: dict[ProductCategory, type[BaseSustainabilityCircularity]] = {
    ProductCategory.GENERIC: GenericSustainability,
    ProductCategory.TEXTILES_APPAREL: TextileSustainability,
    ProductCategory.ELECTRONICS: ElectronicsSustainability,
    ProductCategory.BATTERIES: BatterySustainability,
}

def _model_leaf_field_names(model: type[BaseModel], *, skip: frozenset[str] = frozenset()) -> tuple[str, ...]:
    return tuple(
        name
        for name, field_info in model.model_fields.items()
        if name not in skip and not _is_nested_model_field(field_info.annotation)
    )


def _is_nested_model_field(annotation: object) -> bool:
    origin = getattr(annotation, "__origin__", None)
    if origin is Union:
        args = getattr(annotation, "__args__", ())
        return any(isinstance(arg, type) and issubclass(arg, BaseModel) for arg in args)
    return isinstance(annotation, type) and issubclass(annotation, BaseModel)


def _build_field_paths(category: ProductCategory) -> tuple[str, ...]:
    horizontal: list[str] = []
    for block, model in (
        ("identification", DPPIdentification),
        ("economic_operator", DPPEconomicOperator),
        ("system_requirements", DPPSystemRequirements),
    ):
        horizontal.extend(f"{block}.{name}" for name in _model_leaf_field_names(model))

    product_model = _CATEGORY_PRODUCT_DETAILS[category]
    sustainability_model = _CATEGORY_SUSTAINABILITY[category]

    vertical = [
        *[f"product_details.{name}" for name in _model_leaf_field_names(product_model, skip=frozenset({"category"}))],
        *[
            f"sustainability.{name}"
            for name in _model_leaf_field_names(sustainability_model, skip=frozenset({"category"}))
        ],
    ]

    paths = tuple(horizontal + vertical)
    if len(paths) > ESPR_TOTAL_FIELD_COUNT:
        raise ValueError(f"Category {category} defines {len(paths)} fields; max is {ESPR_TOTAL_FIELD_COUNT}.")
    return paths


def _build_field_paths(category: ProductCategory) -> tuple[str, ...]:
    horizontal: list[str] = []
    for block, model in (
        ("identification", DPPIdentification),
        ("economic_operator", DPPEconomicOperator),
        ("system_requirements", DPPSystemRequirements),
    ):
        horizontal.extend(f"{block}.{name}" for name in _model_leaf_field_names(model))

    product_model = _CATEGORY_PRODUCT_DETAILS[category]
    sustainability_model = _CATEGORY_SUSTAINABILITY[category]

    vertical = [
        *[f"product_details.{name}" for name in _model_leaf_field_names(product_model, skip=frozenset({"category"}))],
        *[
            f"sustainability.{name}"
            for name in _model_leaf_field_names(sustainability_model, skip=frozenset({"category"}))
        ],
    ]
    return tuple(horizontal + vertical)


_ESPR_FIELD_REGISTRY: dict[ProductCategory, tuple[str, ...]] = {
    category: _build_field_paths(category) for category in ProductCategory
}


def _resolve_dot_path(obj: DPPAnalysisResult, dot_path: str) -> Any:
    block_name, _, field_name = dot_path.partition(".")
    block = getattr(obj, block_name, None)
    if block is None:
        return None
    return getattr(block, field_name, None)


def _is_field_filled(value: Any) -> bool:
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


# ── Root model ─────────────────────────────────────────────────────────────────


class DPPAnalysisResult(BaseModel):
    """
    Root structured-output model for DPP ETL extraction.

    Vertical sub-models are discriminated by `category` matching `product_category`.
    """

    model_config = ConfigDict(extra="forbid")

    product_category: ProductCategory = Field(
        description=(
            "Detected ESPR product category. Choose TEXTILES_APPAREL, ELECTRONICS, "
            "BATTERIES, or GENERIC when no delegated act clearly applies."
        ),
    )
    identification: Optional[DPPIdentification] = Field(
        default=None,
        description="Horizontal identification block (6 ESPR fields).",
    )
    economic_operator: Optional[DPPEconomicOperator] = Field(
        default=None,
        description="Horizontal economic-operator block (4 ESPR fields).",
    )
    product_details: Optional[ProductDetailsModel] = Field(
        default=None,
        description="Category-scoped product details (base 9 + delegated-act extensions).",
    )
    sustainability: Optional[SustainabilityModel] = Field(
        default=None,
        description="Category-scoped sustainability & circularity data.",
    )
    system_requirements: Optional[DPPSystemRequirements] = Field(
        default=None,
        description="Horizontal DPP system requirements (11 ESPR fields).",
    )
    metadata: ExtractionMetadata = Field(
        default_factory=ExtractionMetadata,
        description="Extraction provenance (not part of ESPR gap analysis).",
    )

    @model_validator(mode="after")
    def _sync_category_discriminators(self) -> Self:
        if self.product_details is not None and self.product_details.category != self.product_category:
            self.product_details = _coerce_product_details(self.product_category, self.product_details)
        if self.sustainability is not None and self.sustainability.category != self.product_category:
            self.sustainability = _coerce_sustainability(self.product_category, self.sustainability)
        return self

    def calculate_gap_analysis(self) -> dict[str, Any]:
        """
        Compute DPP-Ready completeness against the ESPR field registry.

        Returns
        -------
        dict with keys:
            score_percent   – float 0–100 (one decimal)
            filled_fields   – count of non-null applicable fields
            total_fields    – applicable field count for this category (≤ 44)
            missing_fields  – dot-path names of applicable fields that are None/empty
            filled_field_names – dot-path names of populated fields
        """
        applicable = _ESPR_FIELD_REGISTRY[self.product_category]
        filled_names: list[str] = []
        missing_names: list[str] = []

        for path in applicable:
            value = _resolve_dot_path(self, path)
            if _is_field_filled(value):
                filled_names.append(path)
            else:
                missing_names.append(path)

        total = len(applicable)
        filled = len(filled_names)
        score = round((filled / total) * 100, 1) if total else 0.0

        return {
            "score_percent": score,
            "filled_fields": filled,
            "total_fields": total,
            "missing_fields": missing_names,
            "filled_field_names": filled_names,
        }

    def calculate_readiness_score(self) -> dict[str, Any]:
        """Backward-compatible alias used by the FastAPI extraction router."""
        result = self.calculate_gap_analysis()
        return {
            "score_percent": result["score_percent"],
            "filled_fields": result["filled_fields"],
            "total_fields": result["total_fields"],
            "missing_fields": result["missing_fields"],
        }


def _coerce_product_details(
    category: ProductCategory,
    details: BaseProductDetails,
) -> BaseProductDetails:
    target = _CATEGORY_PRODUCT_DETAILS[category]
    allowed = set(target.model_fields.keys())
    payload = {
        key: value
        for key, value in details.model_dump(exclude={"category"}).items()
        if key in allowed
    }
    return target(category=category, **payload)  # type: ignore[call-arg, arg-type]


def _coerce_sustainability(
    category: ProductCategory,
    sustainability: BaseSustainabilityCircularity,
) -> BaseSustainabilityCircularity:
    target = _CATEGORY_SUSTAINABILITY[category]
    allowed = set(target.model_fields.keys())
    payload = {
        key: value
        for key, value in sustainability.model_dump(exclude={"category"}).items()
        if key in allowed
    }
    return target(category=category, **payload)  # type: ignore[call-arg, arg-type]

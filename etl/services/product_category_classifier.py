"""Rule-based ESPR product category signals (refines LLM classification)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from etl.models.dpp_schemas import ProductCategory

_CATEGORY_PATTERNS: dict[ProductCategory, tuple[tuple[str, float], ...]] = {
    ProductCategory.BATTERIES: (
        (r"\bli-?ion\b", 2.0),
        (r"\blithium(?:\s|-)?ion\b", 2.0),
        (r"\bportable\s+batter", 2.5),
        (r"\bUN\s*3480\b", 3.0),
        (r"\bUN\s*3090\b", 3.0),
        (r"\bbattery\s+regulation\b", 2.5),
        (r"\b(?:\d+[,.]?\d*)\s*(?:Ah|mAh)\b", 1.5),
        (r"\b(?:\d+[,.]?\d*)\s*Wh\b", 1.5),
        (r"\bakkumulator\b", 1.5),
        (r"\bbatterie\b", 1.0),
    ),
    ProductCategory.ELECTRONICS: (
        (r"\bRoHS\b", 2.5),
        (r"\bWEEE\b", 2.5),
        (r"\bCE\s*(?:marking|kennzeichnung)?\b", 1.5),
        (r"\belectrical\s+and\s+electronic\s+equipment\b", 3.0),
        (r"\belektrische\s+und\s+elektronische\b", 3.0),
        (r"\bEEE\b", 1.5),
        (r"\b(?:rated\s+)?voltage\b", 1.0),
        (r"\b(?:Nennspannung|Betriebsspannung)\b", 1.5),
        (r"\bIP\s*\d{2}\b", 1.0),
        (r"\belectronic\s+device\b", 1.5),
    ),
    ProductCategory.CHEMICALS: (
        (r"\bsicherheitsdatenblatt\b", 2.5),
        (r"\bsds\b", 2.0),
        (r"\bmsds\b", 2.0),
        (r"\bklebstoff\b", 2.5),
        (r"\bdichtstoff\b", 2.5),
        (r"\badhesive\b", 2.0),
        (r"\bsealant\b", 2.0),
        (r"\bREACH\b", 2.0),
        (r"\bSVHC\b", 2.5),
        (r"\babschnitt\s*3\b", 1.5),
        (r"\bsection\s*3\b", 1.5),
        (r"\bmixture\b", 1.5),
        (r"\bgemisch\b", 1.5),
    ),
    ProductCategory.TEXTILES_APPAREL: (
        (r"\bGOTS\b", 3.0),
        (r"\bOeko-?Tex\b", 2.5),
        (r"\btextile\b", 1.5),
        (r"\btextil\b", 1.5),
        (r"\bgarment\b", 2.0),
        (r"\bbekleidung\b", 2.0),
        (r"\bfaser(?:n)?\b", 1.0),
        (r"\bfibre\b", 1.0),
        (r"\b\d+\s*%\s*(?:baumwolle|cotton|polyester|wolle|wool|elastan)\b", 2.5),
        (r"\b(?:baumwolle|cotton|polyester|wolle|wool)\s*[: ]\s*\d+\s*%", 2.5),
        (r"\bpflegehinweis", 1.5),
        (r"\bcare\s+label\b", 1.5),
    ),
}

_FILENAME_HINTS: dict[ProductCategory, tuple[str, ...]] = {
    ProductCategory.BATTERIES: ("battery", "batterie", "akku", "cell"),
    ProductCategory.ELECTRONICS: ("electronics", "elektronik", "device", "geraet"),
    ProductCategory.TEXTILES_APPAREL: ("textile", "textil", "garment", "apparel", "fabric"),
    ProductCategory.CHEMICALS: ("sds", "msds", "klebstoff", "adhesive", "sealant", "chemical"),
}

_UPGRADE_THRESHOLD = 2.5
_OVERRIDE_THRESHOLD = 4.0


@dataclass(frozen=True)
class CategoryClassification:
    category: ProductCategory
    confidence: float
    reason: str


def _score_category(corpus: str, category: ProductCategory) -> tuple[float, list[str]]:
    score = 0.0
    hits: list[str] = []
    for pattern, weight in _CATEGORY_PATTERNS.get(category, ()):
        if re.search(pattern, corpus, flags=re.IGNORECASE):
            score += weight
            hits.append(pattern)
    return score, hits


def classify_product_category(corpus: str, filename: str = "") -> CategoryClassification:
    """Heuristic category from document text and optional filename."""
    normalized = corpus.casefold()
    filename_cf = filename.casefold()

    scores: dict[ProductCategory, float] = {}
    reasons: dict[ProductCategory, list[str]] = {}
    for category in (
        ProductCategory.BATTERIES,
        ProductCategory.ELECTRONICS,
        ProductCategory.CHEMICALS,
        ProductCategory.TEXTILES_APPAREL,
    ):
        score, hits = _score_category(normalized, category)
        for hint in _FILENAME_HINTS.get(category, ()):
            if hint in filename_cf:
                score += 0.75
                hits.append(f"filename:{hint}")
        scores[category] = score
        reasons[category] = hits

    best_category = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_score = scores[best_category]
    if best_score < _UPGRADE_THRESHOLD:
        return CategoryClassification(
            category=ProductCategory.GENERIC,
            confidence=min(best_score / _UPGRADE_THRESHOLD, 0.99) if best_score else 0.0,
            reason="no strong delegated-act category signals",
        )

    confidence = min(best_score / 6.0, 1.0)
    hit_summary = ", ".join(reasons[best_category][:4]) or "pattern match"
    return CategoryClassification(
        category=best_category,
        confidence=confidence,
        reason=hit_summary,
    )


def refine_product_category(
    llm_category: ProductCategory,
    corpus: str,
    filename: str = "",
) -> tuple[ProductCategory, str | None]:
    """Adjust LLM category using rules; returns optional refinement reason."""
    ruled = classify_product_category(corpus, filename)
    if llm_category == ProductCategory.GENERIC:
        if ruled.category != ProductCategory.GENERIC:
            return (
                ruled.category,
                f"rules upgraded GENERIC → {ruled.category.value} ({ruled.reason})",
            )
        return llm_category, None

    if ruled.category != ProductCategory.GENERIC and ruled.category != llm_category:
        if ruled.confidence >= 0.65 and scores_favor_override(corpus, ruled.category, llm_category):
            return (
                ruled.category,
                f"rules corrected {llm_category.value} → {ruled.category.value} ({ruled.reason})",
            )
    return llm_category, None


def scores_favor_override(corpus: str, ruled: ProductCategory, llm: ProductCategory) -> bool:
    ruled_score, _ = _score_category(corpus.casefold(), ruled)
    llm_score, _ = _score_category(corpus.casefold(), llm)
    return ruled_score >= _OVERRIDE_THRESHOLD and ruled_score >= llm_score + 1.5

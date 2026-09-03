"""
DPPExtractor — deterministic PDF → DPPAnalysisResult extraction service.

Pipeline
--------
  1. Read PDF bytes → plain text  (pypdf)
  2. Build system + user prompt
  3. Call OpenAI Structured Outputs  (client.beta.chat.completions.parse)
     → LLM is constrained to return exactly DPPAnalysisResult JSON
  4. Inject provenance metadata  (filename, timing)
  5. Return typed DPPAnalysisResult

Key design decisions
--------------------
- Direct LLM structured extraction — no vector DB or retrieval step.
- The LLM is forbidden to hallucinate; missing data must be null.
- All error paths raise typed exceptions so callers can map to HTTP codes.
- ExtractorConfig is a frozen dataclass — safe to share across requests.
"""

from __future__ import annotations

import io
import logging
import time
from dataclasses import dataclass, field

import pypdf
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI

from etl.models.dpp_schemas import DPPAnalysisResult, ExtractionMetadata
from etl.services.env_loader import load_project_env, resolve_openai_api_key
from etl.services.prompts import STRUCTURED_OUTPUT_SYSTEM_PROMPT, build_structured_user_prompt

load_project_env()

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

_MAX_PDF_TEXT_CHARS = 24_000  # ~6 k tokens; keeps cost predictable


# ── Configuration ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ExtractorConfig:
    """
    Immutable configuration for DPPExtractor.

    Attributes
    ----------
    openai_api_key:
        OpenAI API key (sk-...). Prefer loading from environment variable.
    model:
        OpenAI model that supports Structured Outputs (gpt-4o-2024-08-06 or later).
    temperature:
        0.0 enforces deterministic extraction — do not raise above 0.1.
    timeout_seconds:
        Hard timeout for the OpenAI API call. Large PDFs may need > 60 s.
    max_pdf_text_chars:
        Character limit applied to extracted PDF text before sending to LLM.
        Increase for very long documents; watch token cost.
    """

    openai_api_key: str
    model: str = "gpt-4o-2024-08-06"
    temperature: float = 0.0
    timeout_seconds: float = 120.0
    max_pdf_text_chars: int = _MAX_PDF_TEXT_CHARS


# ── Typed exceptions ───────────────────────────────────────────────────────────


class PDFReadError(Exception):
    """Raised when the PDF cannot be parsed into extractable text."""


class LLMExtractionError(Exception):
    """Raised on any failure in the LLM call or structured-output parsing."""


# ── Main service ───────────────────────────────────────────────────────────────


class DPPExtractor:
    """
    End-to-end DPP extraction pipeline: PDF bytes → validated DPPAnalysisResult.

    Usage
    -----
    .. code-block:: python

        import os
        from etl.services.dpp_extractor import DPPExtractor, ExtractorConfig

        config = ExtractorConfig(openai_api_key=os.environ["OPENAI_API_KEY"])
        extractor = DPPExtractor(config)

        with open("product_sds.pdf", "rb") as f:
            result = extractor.extract(f.read(), filename="product_sds.pdf")

        score = result.calculate_readiness_score()
        print(f"DPP-Ready: {score['score_percent']}%")
        print(f"Missing fields: {score['missing_fields']}")
    """

    def __init__(self, config: ExtractorConfig) -> None:
        self._config = config
        self._client = OpenAI(
            api_key=config.openai_api_key,
            timeout=config.timeout_seconds,
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    def extract(self, pdf_bytes: bytes, filename: str = "document.pdf", *, correction_hints: str | None = None) -> DPPAnalysisResult:
        """
        Full pipeline: PDF bytes → structured, validated DPPAnalysisResult.

        Parameters
        ----------
        pdf_bytes:
            Raw PDF file content.
        filename:
            Original filename used for logging and metadata; does not affect extraction.

        Returns
        -------
        DPPAnalysisResult
            Fully typed result. All fields are Optional; missing data is None.
            Call .calculate_readiness_score() to measure ESPR completeness.

        Raises
        ------
        PDFReadError
            If the PDF yields no extractable text (e.g. image-only scan).
        LLMExtractionError
            If the OpenAI call fails (timeout, rate-limit, refusal, invalid output).
        """
        start = time.perf_counter()

        document_text = self._parse_pdf(pdf_bytes, filename)
        logger.info(
            "dpp_etl.pdf_parsed",
            extra={"filename": filename, "char_count": len(document_text)},
        )

        result = self._run_structured_extraction(document_text, filename, correction_hints=correction_hints)

        elapsed_ms = round((time.perf_counter() - start) * 1_000)
        logger.info(
            "dpp_etl.extraction_complete",
            extra={
                "filename": filename,
                "elapsed_ms": elapsed_ms,
                "confidence": result.metadata.confidence,
                "warning_count": len(result.metadata.warnings),
            },
        )

        return result

    def extract_from_text(
        self,
        document_text: str,
        filename: str = "document.pdf",
        *,
        correction_hints: str | None = None,
    ) -> DPPAnalysisResult:
        """
        Structured extraction from pre-parsed document text (LangGraph Studio friendly).
        """
        if not document_text.strip():
            raise PDFReadError(f"'{filename}' produced no extractable text.")

        truncated = document_text[: self._config.max_pdf_text_chars]
        return self._run_structured_extraction(truncated, filename, correction_hints=correction_hints)

    # ── Private: PDF parsing ───────────────────────────────────────────────────

    def _parse_pdf(self, pdf_bytes: bytes, filename: str) -> str:
        """Extract plain text from PDF bytes using pypdf."""
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n\n".join(pages).strip()
        except Exception as exc:
            raise PDFReadError(
                f"Failed to read '{filename}': {exc}"
            ) from exc

        if not text:
            raise PDFReadError(
                f"'{filename}' produced no extractable text. "
                "The document may be an image-only scan. "
                "Use an OCR pre-processing step before extraction."
            )

        truncated = text[: self._config.max_pdf_text_chars]
        if len(text) > self._config.max_pdf_text_chars:
            logger.warning(
                "dpp_etl.pdf_text_truncated",
                extra={
                    "filename": filename,
                    "original_chars": len(text),
                    "truncated_to": self._config.max_pdf_text_chars,
                },
            )

        return truncated

    # ── Private: LLM call ──────────────────────────────────────────────────────

    def _run_structured_extraction(
        self,
        document_text: str,
        filename: str,
        *,
        correction_hints: str | None = None,
    ) -> DPPAnalysisResult:
        """
        Call OpenAI with Structured Outputs and return a DPPAnalysisResult.

        `client.beta.chat.completions.parse` with `response_format=DPPAnalysisResult`
        guarantees the response matches the Pydantic schema — no manual JSON parsing.
        If the model cannot satisfy the schema it returns a refusal (parsed=None),
        which we surface as LLMExtractionError.
        """
        user_message = self._build_user_message(document_text, filename, correction_hints=correction_hints)

        try:
            completion = self._client.beta.chat.completions.parse(
                model=self._config.model,
                temperature=self._config.temperature,
                messages=[
                    {"role": "system", "content": STRUCTURED_OUTPUT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                response_format=DPPAnalysisResult,
            )
        except APITimeoutError as exc:
            raise LLMExtractionError(
                f"OpenAI request timed out after {self._config.timeout_seconds}s "
                f"while processing '{filename}'."
            ) from exc
        except APIConnectionError as exc:
            raise LLMExtractionError(
                f"OpenAI connection error while processing '{filename}': {exc}"
            ) from exc
        except APIStatusError as exc:
            raise LLMExtractionError(
                f"OpenAI API error {exc.status_code} while processing '{filename}': "
                f"{exc.message}"
            ) from exc

        parsed = completion.choices[0].message.parsed

        if parsed is None:
            refusal = getattr(completion.choices[0].message, "refusal", None)
            raise LLMExtractionError(
                f"OpenAI returned a refusal or empty structured output for '{filename}'. "
                f"Refusal reason: {refusal or 'not provided'}"
            )

        parsed.metadata.source_filename = filename
        return parsed

    @staticmethod
    def _build_user_message(
        document_text: str,
        filename: str,
        *,
        correction_hints: str | None = None,
    ) -> str:
        return build_structured_user_prompt(document_text, filename, correction_hints=correction_hints)

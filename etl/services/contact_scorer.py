"""
Deterministic SAP OData supplier contact scoring.

Selects the best compliance-relevant e-mail from vendor master / BP OData JSON
without LLM calls. Blacklisted accounting inboxes force HITL escalation (None).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Final, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from etl.models.audit_field import AuditField, SourceSystem

logger = logging.getLogger(__name__)

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactPerson(BaseModel):
    """One SAP business-partner contact person (OData ``to_ContactPerson`` row)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    first_name: str | None = Field(default=None, alias="FirstName")
    last_name: str | None = Field(default=None, alias="LastName")
    department: str | None = Field(default=None, alias="Department")
    email_address: str | None = Field(default=None, alias="EmailAddress")

    @field_validator("email_address", "first_name", "last_name", "department", mode="before")
    @classmethod
    def _blank_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class SupplierOData(BaseModel):
    """
    Minimal supplier / vendor OData payload used for e-mail selection.

    Accepts both a flat contact list and the OData V2 ``{ "results": [...] }``
    navigation property shape for ``to_ContactPerson``.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    default_email_address: str | None = Field(default=None, alias="DefaultEmailAddress")
    to_contact_person: list[ContactPerson] | dict[str, Any] | None = Field(
        default=None,
        alias="to_ContactPerson",
    )

    @field_validator("default_email_address", mode="before")
    @classmethod
    def _blank_default_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value


@dataclass(frozen=True)
class _ScoredCandidate:
    email: str
    score: int
    source_path: str
    origin: Literal["contact_person", "default"]


class ContactScorer:
    """
    Hard-coded, fail-safe scorer for SAP supplier contact e-mails.

    Scoring weights are class constants so compliance can retune them without
    touching selection logic.
    """

    SCORE_BLACKLIST: Final[int] = -100
    SCORE_DEPT_BONUS: Final[int] = 50
    SCORE_PERSONAL_BONUS: Final[int] = 20
    SCORE_DEFAULT_BASE: Final[int] = 5
    MIN_ACCEPTABLE_SCORE: Final[int] = 0

    BLACKLIST_SUBSTRINGS: Final[tuple[str, ...]] = (
        "rechnung",
        "invoice",
        "ap-invoices",
        "accounting",
        "noreply",
        "buchhaltung",
    )
    DEPARTMENT_KEYWORDS: Final[tuple[str, ...]] = (
        "technical",
        "sales",
        "quality",
        "compliance",
        "sustainability",
    )

    def get_best_contact(self, supplier_data: dict[str, Any]) -> AuditField | None:
        """
        Pick the highest-scoring supplier e-mail from OData JSON.

        Parameters
        ----------
        supplier_data:
            Raw SAP supplier / business-partner OData dictionary.

        Returns
        -------
        AuditField | None
            Audited e-mail when the best score is >= ``MIN_ACCEPTABLE_SCORE``.
            ``None`` when no usable address exists or only blacklisted inboxes
            remain — callers must escalate to human-in-the-loop.
        """
        if not isinstance(supplier_data, dict) or not supplier_data:
            logger.info("ContactScorer: empty or non-dict supplier_data — escalate")
            return None

        try:
            supplier = SupplierOData.model_validate(supplier_data)
        except ValidationError as exc:
            logger.warning("ContactScorer: invalid supplier OData (%s) — escalate", exc)
            return None

        candidates = self._collect_candidates(supplier)
        if not candidates:
            logger.info("ContactScorer: no e-mail candidates — escalate")
            return None

        best = max(candidates, key=lambda item: (item.score, item.origin == "contact_person"))
        if best.score < self.MIN_ACCEPTABLE_SCORE:
            logger.warning(
                "ContactScorer: best score %s for %s below threshold — escalate",
                best.score,
                best.email,
            )
            return None

        source_detail = f"{best.source_path} (score={best.score})"
        logger.info("ContactScorer: selected %s via %s", best.email, source_detail)
        return AuditField.from_sap(
            best.email,
            source_detail,
            source_system=SourceSystem.SAP_VENDOR_MASTER,
        )

    def _collect_candidates(self, supplier: SupplierOData) -> list[_ScoredCandidate]:
        candidates: list[_ScoredCandidate] = []

        for person in self._unwrap_contact_results(supplier.to_contact_person):
            email = self._normalize_email(person.email_address)
            if email is None:
                continue
            score = self._score_contact_person(email, person)
            source_path = f"to_ContactPerson / {self._contact_person_label(person)}"
            candidates.append(
                _ScoredCandidate(
                    email=email,
                    score=score,
                    source_path=source_path,
                    origin="contact_person",
                )
            )

        default_email = self._normalize_email(supplier.default_email_address)
        if default_email is not None:
            score = self._score_default_email(default_email)
            candidates.append(
                _ScoredCandidate(
                    email=default_email,
                    score=score,
                    source_path="DefaultEmailAddress",
                    origin="default",
                )
            )

        return candidates

    def _contact_person_label(self, person: ContactPerson) -> str:
        name = " ".join(
            part.strip()
            for part in (person.first_name, person.last_name)
            if part and part.strip()
        )
        dept_label = (person.department or "unspecified").strip() or "unspecified"
        if name:
            return f"{name} ({dept_label})"
        return dept_label

    def _score_contact_person(self, email: str, person: ContactPerson) -> int:
        if self._is_blacklisted(email):
            return self.SCORE_BLACKLIST

        score = 0
        if self._department_bonus(person.department):
            score += self.SCORE_DEPT_BONUS
        elif self._is_personal_email(email, person.first_name, person.last_name):
            score += self.SCORE_PERSONAL_BONUS
        return score

    def _score_default_email(self, email: str) -> int:
        if self._is_blacklisted(email):
            return self.SCORE_BLACKLIST
        return self.SCORE_DEFAULT_BASE

    def _normalize_email(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not normalized or not _EMAIL_PATTERN.match(normalized):
            return None
        return normalized

    def _is_blacklisted(self, email: str) -> bool:
        local_and_domain = email.lower()
        return any(token in local_and_domain for token in self.BLACKLIST_SUBSTRINGS)

    def _department_bonus(self, department: str | None) -> bool:
        if not department:
            return False
        haystack = department.lower()
        return any(keyword in haystack for keyword in self.DEPARTMENT_KEYWORDS)

    def _is_personal_email(
        self,
        email: str,
        first_name: str | None,
        last_name: str | None,
    ) -> bool:
        local_part = email.split("@", 1)[0]
        tokens = [t for t in re.split(r"[.\-_]+", local_part) if t]
        if not tokens:
            return False

        names = [
            part.strip().lower()
            for part in (first_name, last_name)
            if part and part.strip()
        ]
        if not names:
            return False

        return any(name in tokens or name in local_part for name in names)

    def _unwrap_contact_results(
        self,
        raw: list[ContactPerson] | dict[str, Any] | None,
    ) -> list[ContactPerson]:
        if raw is None:
            return []
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            results = raw.get("results")
            if isinstance(results, list):
                people: list[ContactPerson] = []
                for item in results:
                    if isinstance(item, ContactPerson):
                        people.append(item)
                    elif isinstance(item, dict):
                        try:
                            people.append(ContactPerson.model_validate(item))
                        except ValidationError:
                            continue
                return people
        return []

"""Pydantic models for tenant inbound Stammdaten."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TenantKontakt(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class TenantStammdaten(BaseModel):
    """Economic operator master data for a tenant (dashboard entry)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    tenant_id: str = Field(min_length=1)
    hersteller: str | None = None
    herstelleradresse: str | None = None
    kontakt: TenantKontakt | None = None
    eori: str | None = None
    taric_code: str | None = None


class TenantStammdatenUpsert(BaseModel):
    hersteller: str | None = None
    herstelleradresse: str | None = None
    kontakt: TenantKontakt | None = None
    eori: str | None = None
    taric_code: str | None = None

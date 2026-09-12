"""
HTTP ETL service for serverless Next.js frontends.

Deploy as separate Render web service (Dockerfile.etl). Set ETL_SERVICE_URL on the
Next.js app to this service's public URL.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel

from etl.dpp_flash.inbound.drafts_router import router as dpp_drafts_router
from etl.dpp_flash.inbound.kmu_upload import router as kmu_upload_router
from etl.dpp_flash.inbound.match_router import router as dpp_match_router
from etl.dpp_flash.inbound.pdf_extract import router as pdf_extract_router
from etl.dpp_flash.inbound.router import router as dpp_ingest_router
from etl.dpp_flash.inbound.stammdaten_router import router as inbound_stammdaten_router
from etl.dpp_flash.inbound.staging_router import router as inbound_staging_router
from etl.dpp_flash.inbound.validate_router import router as dpp_validate_router
from etl.pipeline_runner import run_pipeline_payload
from etl.services.mailer import describe_smtp_config, send_smtp_test_email

app = FastAPI(title="DPP-Flash ETL Service", version="0.1.0")
app.include_router(dpp_ingest_router)
app.include_router(kmu_upload_router)
app.include_router(pdf_extract_router)
app.include_router(dpp_drafts_router)
app.include_router(dpp_match_router)
app.include_router(dpp_validate_router)
app.include_router(inbound_staging_router)
app.include_router(inbound_stammdaten_router)


class SmtpTestRequest(BaseModel):
    to: str
    _runtime_env: dict[str, str] | None = None


def _authorize(authorization: str | None) -> None:
    secret = os.environ.get("ETL_SERVICE_SECRET", "").strip()
    if not secret:
        return
    expected = f"Bearer {secret}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized.")


@app.get("/health")
@app.get("/api/v1/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/diagnostics")
async def diagnostics() -> dict[str, Any]:
    from etl.services.env_loader import openai_api_key_status, resolve_openai_api_key

    return {
        "ok": True,
        "service": "dppflash-etl",
        "render_service_name": os.environ.get("RENDER_SERVICE_NAME"),
        "routes": sorted(app.openapi().get("paths", {}).keys()),
        "openai_configured": resolve_openai_api_key() is not None,
        "openai_forwarding_enabled": bool(os.environ.get("ETL_SERVICE_SECRET", "").strip()),
        **openai_api_key_status(),
        "smtp": describe_smtp_config(),
        "supplier_outreach_secret": bool(
            os.environ.get("SUPPLIER_OUTREACH_SECRET", "").strip()
        ),
    }


@app.post("/run")
async def run_pipeline(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(authorization)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON object required.")
    try:
        result = await run_pipeline_payload(payload)
        return {"result": result}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/test-smtp")
async def test_smtp(
    body: SmtpTestRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(authorization)
    if body._runtime_env:
        for key, value in body._runtime_env.items():
            if value.strip():
                os.environ[key] = value.strip()
    return send_smtp_test_email(body.to)

# DPP-Flash — Architektur & Code-Übersicht

Stand: Repo `dppf-backend` (Next.js + Python ETL in einem Monorepo). Ziel: **EU Digital Product Passport (ESPR)** — Datenerfassung, Validierung, Anreicherung, öffentliche Pass-Seiten.

---

## 1. Laufzeit-Topologie

```
┌─────────────────┐     Bearer ETL_SERVICE_SECRET      ┌──────────────────────┐
│  Next.js (UI)   │ ───────────────────────────────────► │  dppflash-etl        │
│  Vercel oder    │     ETL_SERVICE_URL                  │  FastAPI + Python    │
│  Render         │                                      │  (Dockerfile.etl)    │
└────────┬────────┘                                      └──────────┬───────────┘
         │                                                          │
         │  Supabase (Service Role)                                 │  Azure OpenAI / OpenAI
         ▼                                                          ▼
┌─────────────────┐                                      ┌──────────────────────┐
│  Postgres +     │                                      │  LangSmith (EU)      │
│  Storage (RAG)  │                                      │  optional Tracing    │
└─────────────────┘                                      └──────────────────────┘
```

| Service | Dockerfile | Health | Rolle |
|---------|------------|--------|--------|
| **dppflash-backend** | `Dockerfile` | `/health.json` | Next.js App + API-Routes (BFF) |
| **dppflash-etl** | `Dockerfile.etl` | `/api/v1/health` | Python ETL, Inbound, LangGraph-Ausführung |

**Wichtig:** `ETL_SERVICE_URL` muss auf **dppflash-etl** zeigen, nicht auf die Next-URL. Siehe `app/lib/etl/fetchEtl.ts` und `etlServiceUrl.ts`.

---

## 2. Repository-Struktur

### `app/` — Next.js (Frontend + BFF)

| Pfad | Zweck |
|------|--------|
| `app/dashboard/inbound/` | KMU-Funnel: Excel, PDF, Drafts, Staging-Auditor, Stammdaten |
| `app/dashboard/create/` | PDF-Upload (älterer Create-Flow) |
| `app/dashboard/sap-simulation/` | Startet **vollen LangGraph** via `POST /api/etl/run` |
| `app/dashboard/rag-ingest/` | RAG-Dokumente ingestieren |
| `app/p/[id]/` | Öffentliche DPP-Passport-Seite (QR, Traceability, RAG-Provenance) |
| `app/api/inbound/*` | Proxies zum Python-ETL (`fetchEtl`) |
| `app/api/etl/run` | Pipeline: lokal Subprocess oder remote `POST /run` auf ETL |
| `app/api/rag/*` | RAG-Ingest, Purge (TypeScript-Stack) |
| `app/domain/` | Fachlogik, Schemas, reine TS-Domain |
| `app/application/` | Use Cases, Ports, RAG-Orchestrierung |
| `app/infrastructure/` | Azure OpenAI, Supabase RAG, OpenAI-Extractor |
| `app/lib/etl/` | ETL-URL, Secrets, Remote-Pipeline |

### `etl/` — Python (FastAPI + LangGraph)

| Pfad | Zweck |
|------|--------|
| `etl/http_service.py` | FastAPI-App, Router-Mount, `/diagnostics`, `POST /run` |
| `etl/pipeline_runner.py` | `graph.ainvoke` für Enterprise-Pipeline |
| `etl/graph/` | **LangGraph `dpp_extraction`**: Knoten, Routing, State |
| `etl/dpp_flash/graph.py` | Kleinerer Scaffold-Graph (`dpp_flash`) für Studio |
| `etl/dpp_flash/inbound/` | Inbound-Funnel: Excel, PDF, Staging, Merge, Stammdaten |
| `etl/models/dpp_schemas.py` | `DPPAnalysisResult`, Kategorien, Structured-Output-Schema |
| `etl/services/dpp_extractor.py` | PDF/Text → LLM Structured Outputs |
| `etl/services/validation.py` | ESPR-Gaps + Plausibilitäts-Agent |
| `etl/services/validation_agent.py` | Deterministische Regeln (Massenbilanz, GTIN, …) |
| `etl/services/espr_auditor.py` | Audit / CO₂-Proxy, Compliance-Lücken |
| `etl/services/llm_config.py` | OpenAI vs Azure OpenAI für Extraktion |
| `etl/services/tracing.py` | LangSmith `@traceable`, Diagnostics |
| `langgraph.json` | Studio: `dpp_flash` + `dpp_extraction` |

### `supabase/migrations/`

Postgres-Schema: `product_passports`, Inbound, Staging, RAG-Chunks, Stammdaten, Supplier-Outreach.

### `tests/etl/`

Pytest für Inbound, Validierung, LangGraph-Routing, KMU, PDF, Auth, Tracing.

---

## 3. Welcher Pfad nutzt was?

| User-Aktion | Next-Route | ETL-Endpoint | LangGraph? | LLM? | Pydantic |
|-------------|------------|--------------|------------|------|----------|
| Excel hochladen | `/api/inbound/kmu-upload` | `POST /api/v1/kmu/upload-erp-export` | Nein | Nein | **`ProductPassportDraft` pro Zeile** |
| PDF Inbound | `/api/inbound/pdf-extract` | `POST /api/v1/extract/pdf` | Nein | Ja (Extraktor) | Draft + `DPPAnalysisResult` |
| Staging **Merge** | `…/merge` | `POST …/staging/events/{id}/merge` | Nein | Nein | Draft + `persist_with_validation` |
| SAP-Simulation | `/api/etl/run` | `POST /run` | **Ja** (`dpp_extraction`) | Ja (in Graph) | Graph-State + Schemas |
| Validate Draft | `/api/inbound/validate` | `POST /api/v1/dpp/validate` | Nein | Nein | Draft → Analysis → Validator |
| Enterprise Ingest | `/api/inbound/ingest/*` | `POST /api/v1/dpp/ingest` | Nein | Nein | Merge SAP + SDS JSON |
| RAG Enrich (UI) | `/api/rag/ingest` | — (TS) | Nein | Ja (Azure/OpenAI in TS) | Zod/TS-Schemas |

---

## 4. Inbound-Funnel (Python) im Detail

### 4.1 Excel / KMU (`kmu_upload.py`)

1. `pandas` liest Excel/CSV  
2. Spalten → `KMU_COLUMN_ALIASES`  
3. `ProductPassportDraft` (**Pydantic**) pro Zeile  
4. `persist_with_validation` → Readiness, Gaps, Supabase  

### 4.2 PDF (`pdf_extract.py`)

1. Bytes → `DPPExtractor` (OpenAI oder **Azure** Deployment)  
2. `DPPAnalysisResult` → `analysis_result_to_passport_draft`  
3. Optional Auto-Match/Fusion mit Excel-Master  
4. `persist_with_validation`  

### 4.3 Staging (`staging_router.py`, `staging_merge.py`)

- Events: `PENDING`, `CONFLICT`, `ORPHAN`, `PROCESSED`  
- **Merge:** Fusion/Matching, **kein** LangGraph  
- `ingest_and_maybe_merge`: bei `PENDING` automatisch Merge  

### 4.4 Stammdaten (`stammdaten_*`)

Tenant-weite Felder (Hersteller, TARIC, …) — werden beim Persist auf Drafts gemerged, nicht aus Excel-Zeilen.

### 4.5 Validierung (`validation_service.py`)

- `draft_to_analysis.py`: Draft → `DPPAnalysisResult` für Regeln  
- `validate_extracted_data` + `run_espr_auditor` + `run_validation_agent`  
- Kategorie-Regeln: `category_requirements.py`  
- Universalpflichten: soft gaps beim KMU-Persist (lenient)  

---

## 5. LangGraph `dpp_extraction` (`etl/graph/graph.py`)

Knoten (vereinfacht):

```
START → prepare_input → extraction_phase → [routing]
  → espr_auditor → load_to_db → END
  → api_enrichment → sap_enrichment → supplier_outreach / escalate → load_to_db
```

- **`extraction_phase`:** Extraktion + Massenbilanz-Retries **innerhalb eines Knotens** (kein Graph-Zyklus)  
- **Routing:** `etl/graph/routing.py`  
- **Ausführung Prod:** nur `POST /run` (`pipeline_runner.py`)  
- **Studio lokal:** `langgraph dev` + `langgraph.json`  

Kleinerer Graph **`dpp_flash`:** `extractor → validator → sap → outreach / human_escalation` (Legacy-Scaffold).

---

## 6. Datenmodelle (Pydantic vs TS)

| Modell | Ort | Rolle |
|--------|-----|--------|
| `ProductPassportDraft` | `etl/dpp_flash/inbound/models.py` | Inbound-Persistenz, Excel-Zeilen, Merge |
| `DPPAnalysisResult` | `etl/models/dpp_schemas.py` | LLM-Extraktion, Validierung, Readiness |
| `DppGraphState` | `etl/graph/state.py` | LangGraph-State |
| `DppProductPassport` (TS) | `app/domain/dpp/dppSchema.ts` | UI / Legacy Azure-MVP |

---

## 7. KI-Konfiguration (ETL)

| Variable | Zweck |
|----------|--------|
| `OPENAI_API_KEY` | Direktes OpenAI (optional) |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` | PDF/Pipeline auf Azure |
| `DPP_EXTRACTOR_MODEL` | Nur OpenAI-Modell-ID; Azure nutzt **Deployment-Name** |
| `DPP_EXTRACTOR_AZURE_DEPLOYMENT` | Optional Override Deployment |

Vercel kann `OPENAI_API_KEY` per Header an ETL forwarden (`ETL_SERVICE_SECRET`).

---

## 8. Observability

| Mechanismus | Wo |
|-------------|-----|
| `GET /diagnostics` | LLM, Azure, LangSmith-Status |
| LangSmith EU | `LANGSMITH_*`, `@traceable` auf Pipeline, PDF, Excel, Validierung |
| Render Logs | `dppflash-etl` stdout |

Projekt in LangSmith: z. B. `DPP-MVP` — UI: **https://eu.smith.langchain.com**

---

## 9. Sicherheit & Mandanten (kurz)

- **Tenant:** `tenant_id` (Query/Form), Default `default`  
- **ETL:** `Authorization: Bearer ETL_SERVICE_SECRET`  
- **Supabase:** `SUPABASE_SERVICE_ROLE_KEY` serverseitig — RLS/Policies separat prüfen  
- Kein durchgängiges End-User-Auth im Inbound-Dashboard (Pilot-Stand)  

---

## 10. Lokale Entwicklung

```bash
# Next.js
npm run dev

# ETL API
.venv/bin/uvicorn etl.http_service:app --reload --port 8000

# LangGraph Studio (Graph visualisieren)
.venv-langgraph/bin/langgraph dev --host 127.0.0.1 --port 2024
```

`.env.local`: `ETL_SERVICE_URL=http://127.0.0.1:8000`, Supabase, Azure/OpenAI, optional LangSmith.

---

## 11. Wichtige Dateien (Einstieg)

| Thema | Datei |
|-------|--------|
| ETL Entry | `etl/http_service.py` |
| Excel | `etl/dpp_flash/inbound/kmu_upload.py` |
| PDF | `etl/dpp_flash/inbound/pdf_extract.py` |
| Merge | `etl/dpp_flash/inbound/staging_merge.py` |
| Graph | `etl/graph/graph.py` |
| Deploy | `render.yaml`, `Dockerfile.etl` |
| BFF → ETL | `app/lib/etl/fetchEtl.ts` |

---

## 12. Batterie-Demo (öffentlicher Pass, Tier-1 Traceability)

| Thema | Wert |
|--------|------|
| **Pass-ID / URL** | `battery-demo-public` → `/p/battery-demo-public` |
| **Datenquelle** | Festes Seed-Produkt in `app/lib/server-store.ts` (`createDemoBatteryPublicPassport`) |
| **Fixture** | `app/fixtures/demoBatteryPublicPassport.ts` |
| **Öffentliche Traceability** | `traceabilityMaxPublicTier: 1` — nur Rohstoffe (ESPR Tier-1); Tier-2/3 werden per `clampTraceabilityModelToMaxTier` ausgeblendet |
| **Einstieg im UI** | `app/p/page.tsx` — Link + `QRCodeDisplay` |
| **QR-Link** | `https://dppflash-backend.onrender.com/p/battery-demo-public` (über `NEXT_PUBLIC_DPP_URL`, auch im Docker-Build) |

Showcase nutzt das **gleiche** öffentliche Layout wie Chemie-Demos (`app/p/[id]/page.tsx`), nicht ein separates Theme.

---

## 13. Bekannte Architektur-Spannungen

1. **Zwei Extraktions-Stacks:** TS (`AzureOpenAiDppExtractor`) vs Python (`DPPExtractor`) — Inbound-PDF nutzt Python.  
2. **LangGraph nur auf `/run`:** Inbound (Excel/PDF/Merge) umgeht den Graph, teilt aber Validierungs-Services.  
3. **README.md** ist noch Next-Template — diese Datei ist die fachliche Übersicht.  

Bei Erweiterungen: zuerst klären, ob der Flow **Inbound (direkt)** oder **Enterprise-Graph (`/run`)** sein soll.

# Dashboard v2 — UI/UX Mock (User Testing)

Isolated, **client-only** prototype at `/dashboard/v2` for product and UX tests. No ETL, Supabase, or real email delivery.

## Purpose

- Corporate-email registration/login (freemail blocked in the UI)
- Wizard to create a Digital Product Passport with emphasis on **document upload**
- Simulated AI extraction, completeness metrics, human-in-the-loop review, supplier outreach (mock), pre-publish checks, and publish with link + QR

Legacy inbound flows remain at `/dashboard/inbound` and `/dashboard/create`. The v2 shell links to **Technischer Inbound (Alt)** in the footer.

## Quick start

1. Run the app locally (`npm run dev`).
2. Open `/dashboard/v2/login`.
3. Register or log in with a **company** address, e.g. `user@acme.de` or `user@firma.de`.
4. Complete **Global Data Onboarding & PIM Integration** (5 steps): company master data → PIM/ERP connect → Compliance Inbox → AI Sync (3 progress bars) → Global Catalog (4,250 SKUs) → bulk Magic Links dialog → **Zum Dashboard**.
5. Hub → **Neuen Produktpass erstellen** → choose **Dokumente hochladen** (recommended) or SAP/PIM shortcuts if integrations were configured earlier in settings.
5. Walk through: Upload → Daten → Lücken → Prüfung → Veröffentlichen.

Published demo public pass: `/p/battery-demo-public`.

## Test accounts

| Email | Result |
|--------|--------|
| `user@firma.de`, `user@acme.de` | Allowed |
| `user@gmail.com`, `user@outlook.com`, … | Blocked (German error message) |

Session is stored in the browser only.

## localStorage keys

| Key | Content |
|-----|---------|
| `dppflash_v2_session` | `{ email, companyDomain, tenantId, onboarding, integrations, createdAt }` |
| `dppflash_v2_drafts` | Array of `DraftPassport` objects |

### Reset (clean slate)

In the browser devtools console on your app origin:

```js
localStorage.removeItem('dppflash_v2_session');
localStorage.removeItem('dppflash_v2_drafts');
location.reload();
```

Or clear site data for localhost / your preview URL.

## User-test script (~5–8 min)

1. **Login** — Try `user@gmail.com` (expect block), then `user@firma.de` (success).
2. **Hub** — Note greeting and CTA; optional: start a second draft later.
3. **Entry** — Pick document upload; confirm upload is the primary path.
4. **Upload** — Drop 1–3 PDFs/images; watch per-file status (queued → processing → done); auto-advance to data review.
5. **Daten** — Open accordion groups; confirm AI vs **Prüfen** badges; confirm one field; use completeness panel to jump to an open item.
6. **Lücken** — Open **Lieferanten anfragen**; review prefilled mail; send (mock) and see gap marked pending supplier where applicable.
7. **Prüfung** — Read checklist; publish disabled until critical gaps are resolved (fill missing fields or complete supplier mock flow).
8. **Veröffentlichen** — Publish; copy link; scan or open QR → public battery demo pass.
9. **Reload** — Refresh mid-wizard or after publish; session and draft should persist.

## Design references

- `design-system/dppflash/MASTER.md` — global tokens and patterns
- `design-system/dppflash/pages/dashboard-v2.md` — page overrides (narrow layout, status badges)

## Onboarding: Global PIM & Catalog (mock)

- Route: `/dashboard/v2/onboarding` (required until `onboarding.completedAt` is set).
- Steps: **Stammdaten** (Firma, Adresse, USt-IdNr.) → **Integrationen** (Akeneo, Xentral, Shopify, Zapier) → **Inbox** (`import-data@{domain}.dppflash.com`) → **Sync** (3 parallel progress bars) → **Katalog** (master table + bulk Magic Links). Stammdaten landen in `session.integrations`.
- Mock data: `app/dashboard/v2/onboarding/globalCatalogMock.ts`.
- **Zum Dashboard** seeds `createGlobalCatalogSeedDraft` and sets `integrations.onboardingDraftId`.

Legacy ingest merge helpers (`app/dashboard/v2/mock/ingest/*`) remain for wizard upload simulations.

## Automated tests

```bash
npm run test -- tests/dashboard/v2/
```

Covers corporate email validation and completeness helpers against the battery wizard fixture.

## 110-Felder-Editor (PassPer)

Nach dem Wizard (oder direkt über **Weiter bearbeiten** auf der Produktpässe-Liste):

- Route: `/dashboard/v2/passports/{draftId}/editor?section=identity`
- Feldkatalog: `app/domain/battery/passport-field-catalog.json` (110 Felder, 10 Sektionen)
- **Vorschau** synchronisiert per `POST /api/dashboard/v2/passport-publish` und zeigt `/p/voltstride-720` im Dialog (gleiche Public-Seite wie Produktion)
- **Veröffentlichen** schreibt den gemappten Pass in den Server-Store (`voltstride-720`)

Referenzpass: [dppflash.de/p/voltstride-720](https://dppflash.de/p/voltstride-720/)

## Demo-DPP mit 100 % Readiness (manuell deployen)

Vorkonfigurierter Pass **PowerCell Demo 100 %** — alle 110 Felder bestätigt, Status `review`, Pass-ID `demo-ready-100`.

**Server (öffentliche Seite `/p/demo-ready-100`):**

```bash
npm run dev
npm run deploy:demo-dpp
# oder: curl -X POST http://localhost:3000/api/dashboard/v2/demo-deploy
```

Der Demo-Entwurf wird beim ersten Laden von **Produktpässe** / Hub automatisch in `dppflash_v2_drafts` angelegt (Badge **Demo 100 %**), sofern er noch nicht existiert.

**Optional — manuell per API (überschreibt nichts im Browser, liefert `seedDraft`):** Nach Login, in den DevTools auf der App-Origin:

```js
fetch('/api/dashboard/v2/demo-deploy', { method: 'POST' })
  .then((r) => r.json())
  .then(({ seedDraft }) => {
    const existing = JSON.parse(localStorage.getItem('dppflash_v2_drafts') || '[]');
    const drafts = [seedDraft, ...existing.filter((d) => d.id !== seedDraft.id)];
    localStorage.setItem('dppflash_v2_drafts', JSON.stringify(drafts));
    location.reload();
  });
```

| | |
|--|--|
| Pass-ID | `demo-ready-100` |
| Editor | `/dashboard/v2/passports/draft-demo-ready-100/editor` |
| Mock-Code | `app/dashboard/v2/mock/demoReady100Passport.ts` |

## Implementation map

| Area | Path |
|------|------|
| Auth + shell | `app/dashboard/v2/layout.tsx`, `lib/corporateEmail.ts`, `context/SessionProvider.tsx` |
| Mock domain | `app/dashboard/v2/mock/*` |
| Wizard UI | `app/dashboard/v2/passports/new/**`, `app/dashboard/v2/components/**` |
| PassPer catalog | `app/domain/battery/passport-field-catalog.json`, `passportFieldCatalog.ts` |
| Editor | `app/dashboard/v2/passports/[draftId]/editor/**` |
| Public preview | `app/p/passport/BatteryPublicPassportPreview.tsx`, `mapPassportFieldsToBatteryDPP.ts` |

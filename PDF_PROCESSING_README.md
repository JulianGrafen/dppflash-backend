# DPP-Flash: PDF & Daten-Verarbeitungspipeline

## Überblick

Das System implementiert einen **DSGVO-konformen** Workflow zur Extraktion von Produktdaten aus technischen Datenblättern (PDFs):

```
PDF Upload → Lokale Extraktion → AI-Strukturierung → Human-Validierung → DPP-Registry
                (pdfplumber)     (OpenAI lokal)
```

**Sicherheit:** Rohe PDFs verlassen den Server NICHT. Nur unverarbeiteter Text wird zu OpenAI gesendet (minimales Risiko).

---

## Architektur

### 1. **pdfExtractionService.ts**
- Lokale PDF-Verarbeitung mit `pdf-parse`
- Extrahiert Rohtext aus PDFs
- Validiert Plausibilität (Mindestzeichenlänge, Garbage-Check)
- Keine Netzwerk-Abhängigkeiten ✅

### 2. **documentStorageService.ts**
- Speichert PDFs in **Supabase Storage** (verschlüsselt)
- Metadaten in PostgreSQL
- **Multi-Tenancy:** Pfade folgen `tenants/{tenantId}/...`
- DSGVO-Recht-auf-Vergessenheit: `deletePdfDocument()`

### 3. **aiProvider.ts** (Interface)
- Abstraktion für verschiedene LLM-Provider
- Implementierungen: OpenAI, Ollama, Anthropic (zukünftig)
- Austauschbar via Env-Variable `AI_PROVIDER`

### 4. **openaiProvider.ts** (Implementierung)
- OpenAI gpt-4o Integration
- **JSON Schema Validation** für konsistente Outputs
- Structured Outputs für BATTERY & TEXTILE
- Human-in-the-Loop Suggestions

### 5. **documentProcessingService.ts** (Orchestrierung)
- End-to-End Pipeline
- Fehlerbehandlung auf jede Stufe
- Rückgabe strukturierter Daten für Validierungs-UI

### 6. **API Routes**
- `POST /api/documents/upload` – PDF hochladen & verarbeiten
- `POST /api/documents/validate` – Korrekturen speichern

---

## Workflow: Beispiel

### Schritt 1: PDF hochladen

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@datasheet.pdf" \
  -G --data-urlencode "tenantId=tenant-123" \
     --data-urlencode "productType=BATTERY"
```

**Response:**
```json
{
  "documentId": "uuid-...",
  "extractedData": {
    "hersteller": "TechVolt GmbH",
    "modellname": "PowerCell Pro T100",
    "kapazitaetKWh": 100,
    "chemischesSystem": "Lithium-Ionen (NMC)"
  },
  "confidence": 0.92,
  "warnings": [],
  "status": "SUCCESS"
}
```

### Schritt 2: Human-Validierung (Optional)

Nutzer überprüft Werte im UI, macht Korrektionen:

```bash
curl -X POST http://localhost:3000/api/documents/validate \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-123",
    "documentId": "uuid-...",
    "correctedData": {
      "hersteller": "TechVolt GmbH",
      "modellname": "PowerCell Pro T100",
      "kapazitaetKWh": 100.5,
      "chemischesSystem": "Lithium-Ionen (NCM)",
      "type": "BATTERY"
    }
  }'
```

### Schritt 3: Speichern in DPP-Registry

(Zukünftig: INSERT in `dpp_passports` Tabelle)

---

## Umgebungsvariablen

Siehe `.env.example`:

```bash
# Kopiere Beispiel
cp .env.example .env.local

# Fülle aus:
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

---

## Fehlerbehandlung

### Szenarien & Lösungen

| Fehler | Ursache | Lösung |
|--------|--------|--------|
| "PDF enthält keinen Text" | Scan-PDF ohne OCR | OCR hinzufügen oder manuell eingeben |
| "OpenAI API Error" | API-Quota überschritten | API-Limits überprüfen, Fallback zu Ollama |
| "Validierungsfehler: kapazitaetKWh" | Wert unrealistisch (z.B. -5) | Nutzer korrigiert im UI |
| "Zugriff verweigert" | Tenant-Mismatch | PDF gehört anderem Mandanten |

---

## Erweiterung: Neue Produktkategorie hinzufügen

1. **Type erweitern** in `dpp-types.ts`:
```typescript
export interface ElectronicsDPP extends BaseDPP {
  readonly type: 'ELECTRONICS';
  energieverbrauchKWh: number;
  recyclingQuote: number;
}
```

2. **OpenAI Schema hinzufügen** in `openaiProvider.ts`:
```typescript
const ELECTRONICS_SCHEMA = { /* ... */ };
```

3. **Provider-Logik aktualisieren**:
```typescript
if (typeHint === 'ELECTRONICS') {
  schema = ELECTRONICS_SCHEMA;
}
```

4. **Fertig!** System bleibt modular & zukunftssicher ✅

---

## Performance & Sicherheit

### Performance
- **PDF-Extraktion:** ~1-3s (lokal, hängt von Größe ab)
- **OpenAI-Anfrage:** ~2-5s (API-Latenz)
- **Gesamt:** ~5-10s für durchschnittliches Datenblatt

### Sicherheit (DSGVO ✅)
- PDFs in EU-Rechenzentrum (Supabase EU Region)
- Nur Rohtext zu OpenAI (keine sensiblen Rohdaten)
- Multi-Tenancy: Daten streng nach `tenantId` getrennt
- Verschlüsselte Storage-Buckets
- Recht-auf-Vergessenheit implementiert

---

## Testing

```bash
# Jest Tests (zukünftig)
npm test

# Manual API Test
npm run dev
# Dann über Postman/Curl testen
```

---

## Zukünftige Verbesserungen

- [ ] Lokale OCR für Scan-PDFs (Tesseract)
- [ ] Ollama-Integration (vollständig lokal, 100% DSGVO)
- [ ] Batch-Processing (mehrere PDFs gleichzeitig)
- [ ] Audit-Logs mit Änderungsverlauf
- [ ] Webhook-Notifications bei Validierung
- [ ] Export zu GS1 Digital Link Format

---

**Status:** MVP-Ready ✅  
**Zuletzt aktualisiert:** 2026-03-20

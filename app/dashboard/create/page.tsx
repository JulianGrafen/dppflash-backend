'use client';

import { useState, useEffect, useRef } from 'react';
import { DPPFactory } from '../../services/dppFormService';
import { ProductPassport } from '../../types/dpp-types';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import { AlertCircle, CheckCircle2, ChevronLeft, Clock, ExternalLink, File, FileUp, Loader2, Upload } from 'lucide-react';
import Link from 'next/link';

function captureProcessingDuration(
  startedAt: number | null,
  fallbackSeconds: number,
): number {
  if (startedAt === null) {
    return fallbackSeconds;
  }
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatProcessingDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} Sekunde${seconds === 1 ? '' : 'n'}`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) {
    return `${minutes} Minute${minutes === 1 ? '' : 'n'}`;
  }
  return `${minutes} Min. ${rest} Sek.`;
}

type CreateStep = 'select' | 'pdf-upload' | 'form' | 'result';

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

const CARD_CLASS =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]';

function CreateDashboardShell({
  children,
  title,
  subtitle,
  onBack,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#eef1f8] pb-10">
      <nav className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0c1929] text-[11px] font-bold leading-none text-white">
              DPP
            </span>
            <span className="text-sm font-bold tracking-tight text-[#0c1929]">
              flash <span className="font-normal text-slate-400">· Dashboard</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/sap-simulation"
              className="text-xs font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
            >
              SAP Simulation
            </Link>
            <Link
              href="/dashboard/rag-ingest"
              className="text-xs font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
            >
              RAG-Wissensbasis
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-[#0c1929]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Zurück
          </button>
        ) : null}

        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Digitaler Produktpass</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0c1929] sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
        </header>

        {children}
      </div>
    </div>
  );
}

function CreateStepIndicator({ step }: { readonly step: CreateStep }) {
  const activeIndex = step === 'select' || step === 'pdf-upload' ? 0 : step === 'form' ? 1 : 2;
  const steps = ['PDF hochladen', 'Daten prüfen', 'Fertig'] as const;

  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((label, index) => {
        const isActive = index === activeIndex;
        const isDone = index < activeIndex;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isDone
                  ? 'bg-emerald-100 text-emerald-800'
                  : isActive
                    ? 'bg-[#0c1929] text-white'
                    : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {isDone ? '✓' : index + 1}
            </span>
            <span
              className={[
                'truncate text-xs font-semibold',
                isActive ? 'text-[#0c1929]' : 'text-slate-500',
              ].join(' ')}
            >
              {label}
            </span>
            {index < steps.length - 1 ? (
              <span className="mx-1 hidden h-px flex-1 bg-slate-200 sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ErrorBanner({ message }: { readonly message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export default function CreateDashboard() {
  const [dpp, setDpp] = useState<ProductPassport | null>(null);
  const [step, setStep] = useState<'select' | 'pdf-upload' | 'form' | 'result'>('select');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
  const [pdfProcessingDurationSeconds, setPdfProcessingDurationSeconds] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const processingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (step !== 'pdf-upload' || !isLoading) {
      processingStartedAtRef.current = null;
      return;
    }

    processingStartedAtRef.current = Date.now();
    setProcessingElapsedSeconds(0);

    const interval = window.setInterval(() => {
      const startedAt = processingStartedAtRef.current;
      if (startedAt === null) {
        return;
      }
      setProcessingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(interval);
  }, [step, isLoading]);

  // Logger function for debugging
  const log = (msg: string, data?: unknown) => {
    console.log(`[Dashboard] ${msg}`, data || '');
  };

  // ============= PDF UPLOAD HANDLER =============

  const handlePdfUpload = async (file: File) => {
    log('PDF file selected');
    
    if (file.type !== 'application/pdf') {
      setErrorMessage('Nur PDF-Dateien sind erlaubt');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Datei ist zu groß (max 10 MB)');
      return;
    }

    setUploadedFile(file);
    setErrorMessage(null);
    setProcessingElapsedSeconds(0);
    setPdfProcessingDurationSeconds(null);
    setIsLoading(true);
    setStep('pdf-upload');

    try {
      log('Uploading PDF...', file.name);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `/api/documents/upload?tenantId=default`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const details = errorData.details || errorData.error || 'Unbekannter Fehler';
        throw new Error(`Upload Error: ${response.status} - ${details}`);
      }

      const result = await response.json();
      log('PDF processed successfully', result);
      setExtractedData(result);

      const productType = result.extractedData?.productType || 'BATTERY';
      const allExtractedFields = { ...(result.extractedData ?? {}) };
      delete allExtractedFields.productType;

      const savedDpp: ProductPassport = {
        id: result.productId,
        type: productType,
        createdAt: new Date(),
        hersteller: allExtractedFields.hersteller || '',
        modellname: allExtractedFields.modellname || '',
        ...allExtractedFields,
      } as any;

      setDpp(savedDpp);

      const duration = captureProcessingDuration(
        processingStartedAtRef.current,
        processingElapsedSeconds,
      );
      setPdfProcessingDurationSeconds(duration);
      setProcessingElapsedSeconds(duration);

      // confidence < 0.5 means 2+ mandatory fields are missing — show form to complete
      const confidence: number = result.confidence ?? 0;
      if (confidence < 0.5) {
        const missing = (result.warnings ?? []).join(', ') || 'Pflichtfelder fehlen';
        setErrorMessage(`Einige Felder konnten nicht erkannt werden. Bitte ergänzen Sie die Daten. (${missing})`);
        setStep('form');
      } else {
        setStep('result');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      log('PDF upload error:', msg);
      setErrorMessage(`PDF-Verarbeitung fehlgeschlagen: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ============= AUTO-SAVE FUNKTION =============

  const autoSaveProduct = async (productToSave: ProductPassport) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      log('Auto-saving product...', productToSave);
      log('Sending to API:', JSON.stringify(productToSave));
      
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productToSave),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        log('API Error response:', errorData);
        throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      log('Product auto-saved successfully', result);
      setDpp(result);
      setStep('result');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      log('Auto-save error:', msg);
      setErrorMessage(`Fehler beim Speichern: ${msg}`);
      // Zurück zum Start beim Fehler
      setStep('select');
    } finally {
      setIsLoading(false);
    }
  };

  // ============= EVENT HANDLERS =============

  const handleFieldChange = (field: string, value: string | number) => {
    log(`Field changed: ${field} = ${value}`);
    if (!dpp) return;

    const updated = { ...dpp };
    if (dpp.type === 'BATTERY') {
      if (field === 'hersteller') (updated as any).hersteller = value;
      if (field === 'modellname') (updated as any).modellname = value;
      if (field === 'kapazitaetKWh') (updated as any).kapazitaetKWh = Number(value);
      if (field === 'chemischesSystem') (updated as any).chemischesSystem = value;
    } else if (dpp.type === 'TEXTILE') {
      if (field === 'hersteller') (updated as any).hersteller = value;
      if (field === 'modellname') (updated as any).modellname = value;
      if (field === 'materialZusammensetzung') (updated as any).materialZusammensetzung = value;
      if (field === 'herkunftsland') (updated as any).herkunftsland = value;
    }
    setDpp(updated);
  };

  const handleSave = async () => {
    log('Save button clicked');
    if (!dpp) {
      setErrorMessage('Kein Produkt ausgewählt');
      return;
    }

    // Validierung
    if (!DPPFactory.isValid(dpp)) {
      setErrorMessage('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      log('Sending product to API...', dpp);
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dpp),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      log('Product saved successfully', result);
      setDpp(result);
      setStep('result');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      log('Save error:', msg);
      setErrorMessage(`Fehler beim Speichern: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    log('Back button clicked');
    if (step === 'result') {
      setStep('form');
    } else if (step === 'form') {
      setDpp(null);
      setExtractedData(null);
      setPdfProcessingDurationSeconds(null);
      setStep('select');
    } else if (step === 'pdf-upload') {
      setUploadedFile(null);
      setErrorMessage(null);
      setPdfProcessingDurationSeconds(null);
      setStep('select');
    }
  };

  // ============= RENDER LOGIC =============

  // STEP 1: SELECT
  if (step === 'select') {
    return (
      <CreateDashboardShell
        title="Neuen Produktpass erstellen"
        subtitle="PDF hochladen — die KI extrahiert Produktdaten und startet den Compliance-Scan automatisch."
      >
        <CreateStepIndicator step={step} />

        <div className={CARD_CLASS}>
          <div className="border-b border-slate-100 bg-[#0c1929] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <FileUp className="h-5 w-5 text-sky-300" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">PDF hochladen</h2>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Schritt 1 von 3
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <label
              htmlFor="pdf-upload"
              className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center transition hover:border-sky-300 hover:bg-sky-50/40"
            >
              <Upload className="mb-3 h-10 w-10 text-sky-600" strokeWidth={1.75} aria-hidden />
              <span className="text-sm font-semibold text-[#0c1929]">PDF-Datei auswählen</span>
              <span className="mt-1 text-xs text-slate-500">Max. 10 MB · nur PDF</span>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handlePdfUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {errorMessage ? <div className="mt-4"><ErrorBanner message={errorMessage} /></div> : null}
      </CreateDashboardShell>
    );
  }

  // STEP 1b: PDF UPLOAD WITH LOADING
  if (step === 'pdf-upload') {
    return (
      <CreateDashboardShell
        title="PDF wird verarbeitet"
        subtitle="Bitte warten Sie, während die KI die Daten extrahiert."
        onBack={handleGoBack}
      >
        <CreateStepIndicator step={step} />

        <div className={`${CARD_CLASS} p-6`}>
          <div className="flex flex-col items-center text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-sky-600" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Verstrichene Zeit</p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-[#0c1929]" aria-live="polite" aria-atomic="true">
              {processingElapsedSeconds}
              <span className="ml-1 text-2xl font-semibold text-slate-500">s</span>
            </p>

            {uploadedFile ? (
              <div className="mt-6 w-full rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-left">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  <p className="truncate text-sm font-medium text-slate-800">{uploadedFile.name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 space-y-3">
            <ErrorBanner message={errorMessage} />
            <button
              type="button"
              onClick={() => {
                setStep('select');
                setErrorMessage(null);
                setUploadedFile(null);
              }}
              className="text-sm font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900"
            >
              Erneut versuchen
            </button>
          </div>
        ) : null}
      </CreateDashboardShell>
    );
  }

  // STEP 2: FORM EDITING
  if (step === 'form' && dpp) {
    return (
      <CreateDashboardShell
        title="Daten ergänzen"
        subtitle="Einige Pflichtfelder konnten nicht vollständig erkannt werden."
        onBack={handleGoBack}
      >
        <CreateStepIndicator step={step} />

        <div className={CARD_CLASS}>
          <div className="space-y-5 p-6">
            <div className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Produkttyp: {dpp.type}
            </div>

            {extractedData && Number(extractedData.confidence) > 0 ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                <p className="text-sm font-semibold text-sky-950">Daten aus PDF extrahiert</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 max-w-xs rounded-full bg-sky-200">
                    <div
                      className="h-2 rounded-full bg-sky-600"
                      style={{ width: `${Math.min(extractedData.confidence * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-sky-900">
                    {Math.round(extractedData.confidence * 100)} %
                  </span>
                </div>
              </div>
            ) : null}

            <div>
              <label htmlFor="hersteller" className="mb-1.5 block text-sm font-medium text-slate-700">
                Hersteller *
              </label>
              <input
                id="hersteller"
                type="text"
                placeholder="z. B. Henkel AG & Co. KGaA"
                value={dpp.hersteller || ''}
                onChange={(e) => handleFieldChange('hersteller', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="modellname" className="mb-1.5 block text-sm font-medium text-slate-700">
                Modellname *
              </label>
              <input
                id="modellname"
                type="text"
                placeholder="z. B. Modell XY"
                value={dpp.modellname || ''}
                onChange={(e) => handleFieldChange('modellname', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {dpp.type === 'BATTERY' ? (
              <>
                <div>
                  <label htmlFor="kapazitaetKWh" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Kapazität (kWh) *
                  </label>
                  <input
                    id="kapazitaetKWh"
                    type="number"
                    placeholder="z. B. 75"
                    value={(dpp as any).kapazitaetKWh || ''}
                    onChange={(e) => handleFieldChange('kapazitaetKWh', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="chemischesSystem" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Chemisches System *
                  </label>
                  <input
                    id="chemischesSystem"
                    type="text"
                    placeholder="z. B. Lithium-Ionen (NMC)"
                    value={(dpp as any).chemischesSystem || ''}
                    onChange={(e) => handleFieldChange('chemischesSystem', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </>
            ) : null}

            {dpp.type === 'TEXTILE' ? (
              <>
                <div>
                  <label htmlFor="materialZusammensetzung" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Materialzusammensetzung *
                  </label>
                  <input
                    id="materialZusammensetzung"
                    type="text"
                    placeholder="z. B. 100 % Baumwolle"
                    value={(dpp as any).materialZusammensetzung || ''}
                    onChange={(e) => handleFieldChange('materialZusammensetzung', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="herkunftsland" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Herkunftsland *
                  </label>
                  <input
                    id="herkunftsland"
                    type="text"
                    placeholder="z. B. Deutschland"
                    value={(dpp as any).herkunftsland || ''}
                    onChange={(e) => handleFieldChange('herkunftsland', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </>
            ) : null}

            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={handleGoBack}
                disabled={isLoading}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0c1929] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Speichern…
                  </>
                ) : (
                  'Produktpass erstellen'
                )}
              </button>
            </div>
          </div>
        </div>
      </CreateDashboardShell>
    );
  }

  // STEP 3: RESULT with QR CODE
  if (step === 'result' && dpp) {
    return (
      <CreateDashboardShell
        title="Produktpass erstellt"
        subtitle="Der digitale Produktpass ist bereit — teilen Sie den QR-Code oder öffnen Sie die Live-Ansicht."
      >
        <CreateStepIndicator step={step} />

        <div className={`${CARD_CLASS} mb-5 p-6 text-center`}>
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" strokeWidth={1.5} aria-hidden />
          <p className="text-sm font-semibold text-emerald-800">Compliance Scan durchgeführt</p>
          {pdfProcessingDurationSeconds !== null ? (
            <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
              <Clock className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                Benötigte Zeit:{' '}
                <span className="font-bold tabular-nums">
                  {formatProcessingDuration(pdfProcessingDurationSeconds)}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        <div className={`${CARD_CLASS} mb-5 p-6`}>
          <p className="mb-4 text-center text-sm text-slate-600">
            QR-Code scannen, um den Produktpass zu öffnen
          </p>
          {dpp.id ? (
            <div className="space-y-4">
              <QRCodeDisplay
                productId={dpp.id}
                productName={dpp.modellname || dpp.type}
                productData={dpp as any}
              />
              <Link
                href={`/p/${dpp.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c1929] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Produktpass ansehen
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>

        <div className={`${CARD_CLASS} mb-5 p-6`}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Produktdetails</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ID</dt>
              <dd className="font-mono text-slate-900">{dpp.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Typ</dt>
              <dd className="font-medium text-slate-900">{dpp.type}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Hersteller</dt>
              <dd className="text-right text-slate-900">{dpp.hersteller || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Modell</dt>
              <dd className="text-right text-slate-900">{dpp.modellname || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              log('New product button clicked');
              setDpp(null);
              setExtractedData(null);
              setUploadedFile(null);
              setPdfProcessingDurationSeconds(null);
              setStep('select');
              setErrorMessage(null);
            }}
            className="flex-1 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            Neues Produkt
          </button>
        </div>
      </CreateDashboardShell>
    );
  }

  // Fallback (should not happen)
  return (
    <CreateDashboardShell title="Lädt…">
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" aria-hidden />
      </div>
    </CreateDashboardShell>
  );
}

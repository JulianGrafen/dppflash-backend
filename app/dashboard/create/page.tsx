'use client';

import { useState, useEffect } from 'react';
import { DPPFactory } from '../../services/dppFormService';
import { ProductPassport } from '../../types/dpp-types';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import { AlertCircle, ChevronLeft, Upload, File } from 'lucide-react';

export default function CreateDashboard() {
  const [dpp, setDpp] = useState<ProductPassport | null>(null);
  const [step, setStep] = useState<'select' | 'pdf-upload' | 'form' | 'result'>('select');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);

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
        throw new Error(`Upload Error: ${response.status}`);
      }

      const result = await response.json();
      log('PDF processed successfully', result);
      setExtractedData(result);

      const { productType, ...allExtractedFields } = result.extractedData;
      const savedDpp: ProductPassport = {
        id: result.productId,
        type: productType || 'BATTERY',
        createdAt: new Date(),
        ...allExtractedFields,
      } as any;

      setDpp(savedDpp);

      // Wenn Pflichtfelder fehlen → Form zum Nachbearbeiten öffnen, nicht abbrechen
      if (!result.extractedData?.hersteller || !result.extractedData?.modellname) {
        setErrorMessage(
          `Einige Felder konnten nicht automatisch erkannt werden (${!result.extractedData?.hersteller ? 'Hersteller' : 'Modellname'}). Bitte ergänzen Sie die Daten unten.`
        );
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

  const handleSelectCategory = (type: ProductPassport['type']) => {
    log(`Category selected: ${type}`);
    const newDpp = DPPFactory.createEmptyPassport(type);
    setDpp(newDpp);
    setErrorMessage(null);
    setStep('form');
  };

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
      setStep('select');
    } else if (step === 'pdf-upload') {
      setUploadedFile(null);
      setErrorMessage(null);
      setStep('select');
    }
  };

  // ============= RENDER LOGIC =============

  // STEP 1: SELECT CATEGORY
  if (step === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Neues Produkt erstellen
            </h1>
            <p className="text-gray-600">
              Wähle die Produktkategorie aus
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* BATTERY Button */}
            <button
              type="button"
              onClick={() => {
                log('BATTERY button clicked');
                handleSelectCategory('BATTERY');
              }}
              className="group relative p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg hover:bg-blue-50 transition-all duration-200 cursor-pointer text-left font-medium"
            >
              <div className="text-3xl mb-3">🔋</div>
              <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Batterie
              </h2>
              <p className="text-gray-600 text-sm mt-2">
                Digital Battery Passport für Batterien nach EU-Verordnung
              </p>
              <div className="mt-4 text-xs text-gray-500">
                Kapazität, Chemie, Herkunft
              </div>
            </button>

            {/* TEXTILE Button */}
            <button
              type="button"
              onClick={() => {
                log('TEXTILE button clicked');
                handleSelectCategory('TEXTILE');
              }}
              className="group relative p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg hover:bg-green-50 transition-all duration-200 cursor-pointer text-left font-medium"
            >
              <div className="text-3xl mb-3">👕</div>
              <h2 className="text-2xl font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                Textil
              </h2>
              <p className="text-gray-600 text-sm mt-2">
                Digital Textile Passport für Kleidung und Textilien
              </p>
              <div className="mt-4 text-xs text-gray-500">
                Material, Herkunftsland, Care Labels
              </div>
            </button>
          </div>

          {/* PDF UPLOAD SECTION */}
          <div className="mt-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-gray-600 font-medium">ODER</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <div
              className="border-2 border-dashed border-purple-300 rounded-xl p-10 text-center bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer"
              onClick={() => {
                const input = document.getElementById('pdf-upload');
                if (input instanceof HTMLInputElement) input.click();
              }}
            >
              <Upload className="w-12 h-12 text-purple-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                PDF Produktpass hochladen
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Lade einen Produktpass als PDF hoch und lasse unsere KI die Daten automatisch extrahieren
              </p>
              <div className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg font-medium text-sm">
                PDF-Datei auswählen
              </div>
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
              <p className="text-xs text-gray-500 mt-4">
                Max. 10 MB | Nur PDF
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 1b: PDF UPLOAD WITH LOADING
  if (step === 'pdf-upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              PDF wird verarbeitet
            </h1>
            <p className="text-gray-600">
              Bitte warten Sie, während die KI die Daten extrahiert...
            </p>
          </div>

          <div className="mt-10 bg-white rounded-xl shadow-lg p-8">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-6"></div>
              
              {uploadedFile && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <File className="w-5 h-5 text-gray-600" />
                    <p className="text-gray-700 font-medium">{uploadedFile.name}</p>
                  </div>
                  <p className="text-sm text-gray-500">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Fehler beim Upload</p>
                <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('select');
                  setErrorMessage(null);
                  setUploadedFile(null);
                }}
                className="ml-auto px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-red-800 text-sm font-medium cursor-pointer"
              >
                Zurück
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 2: FORM EDITING
  if (step === 'form' && dpp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header with back button */}
          <div className="flex items-center gap-4 mb-8">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              Zurück
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {dpp.type === 'BATTERY' ? '🔋 Batterie' : '👕 Textil'} bearbeiten
              </h1>
              <p className="text-gray-600">Schritt 2 von 3: Daten eingeben</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
            {/* Product Type Badge */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Produkttyp
              </label>
              <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium">
                {dpp.type}
              </div>
            </div>

            {/* Extracted Data Info */}
            {extractedData && Number(extractedData.confidence) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-blue-900 mb-1">
                      📄 Daten aus PDF extrahiert
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-800">
                      <div className="flex-1 bg-blue-200 rounded-full h-2 max-w-xs">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(extractedData.confidence * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-semibold">
                        {Math.round(extractedData.confidence * 100)}% Genauigkeit
                      </span>
                    </div>
                  </div>
                </div>
                {extractedData.warnings && extractedData.warnings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs font-medium text-blue-800 mb-1">⚠️ Hinweise:</p>
                    <ul className="space-y-1">
                      {extractedData.warnings.map((warning: string, i: number) => (
                        <li key={i} className="text-xs text-blue-700">
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Hersteller */}
            <div>
              <label htmlFor="hersteller" className="block text-sm font-semibold text-gray-700 mb-2">
                Hersteller *
              </label>
              <input
                id="hersteller"
                type="text"
                placeholder="z.B. Tesla Inc."
                value={dpp.hersteller || ''}
                onChange={(e) => handleFieldChange('hersteller', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Modellname */}
            <div>
              <label htmlFor="modellname" className="block text-sm font-semibold text-gray-700 mb-2">
                Modellname *
              </label>
              <input
                id="modellname"
                type="text"
                placeholder="z.B. Model 3 LFP 75"
                value={dpp.modellname || ''}
                onChange={(e) => handleFieldChange('modellname', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* BATTERY Form Fields */}
            {dpp.type === 'BATTERY' && (
              <>
                <div>
                  <label htmlFor="kapazitaetKWh" className="block text-sm font-semibold text-gray-700 mb-2">
                    Kapazität (kWh) *
                  </label>
                  <input
                    id="kapazitaetKWh"
                    type="number"
                    placeholder="z.B. 75"
                    value={(dpp as any).kapazitaetKWh || ''}
                    onChange={(e) => handleFieldChange('kapazitaetKWh', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="chemischesSystem" className="block text-sm font-semibold text-gray-700 mb-2">
                    Chemisches System *
                  </label>
                  <input
                    id="chemischesSystem"
                    type="text"
                    placeholder="z.B. Lithium-Ionen (NMC)"
                    value={(dpp as any).chemischesSystem || ''}
                    onChange={(e) => handleFieldChange('chemischesSystem', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </>
            )}

            {/* TEXTILE Form Fields */}
            {dpp.type === 'TEXTILE' && (
              <>
                <div>
                  <label htmlFor="materialZusammensetzung" className="block text-sm font-semibold text-gray-700 mb-2">
                    Materialzusammensetzung *
                  </label>
                  <input
                    id="materialZusammensetzung"
                    type="text"
                    placeholder="z.B. 100% Baumwolle"
                    value={(dpp as any).materialZusammensetzung || ''}
                    onChange={(e) => handleFieldChange('materialZusammensetzung', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="herkunftsland" className="block text-sm font-semibold text-gray-700 mb-2">
                    Herkunftsland *
                  </label>
                  <input
                    id="herkunftsland"
                    type="text"
                    placeholder="z.B. Deutschland"
                    value={(dpp as any).herkunftsland || ''}
                    onChange={(e) => handleFieldChange('herkunftsland', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{errorMessage}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t">
              <button
                type="button"
                onClick={handleGoBack}
                disabled={isLoading}
                className="px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Speichern...
                  </>
                ) : (
                  'Weiter zum QR-Code'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: RESULT with QR CODE
  if (step === 'result' && dpp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Erfolgreich erstellt!
            </h1>
            <p className="text-gray-600">
              Dein {dpp.type === 'BATTERY' ? 'Batterie' : 'Textil'} Passport ist bereit
            </p>
          </div>

          {/* QR Code Section */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Scanne diesen QR-Code, um das Produkt anzuzeigen
              </p>
              {dpp.id && (
                <QRCodeDisplay 
                  productId={dpp.id}
                  productName={dpp.modellname || dpp.type}
                  productData={dpp as any}
                />
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Produktdetails</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ID:</span>
                <span className="font-mono text-gray-900">{dpp.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Typ:</span>
                <span className="font-medium text-gray-900">{dpp.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hersteller:</span>
                <span className="text-gray-900">{dpp.hersteller || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Modell:</span>
                <span className="text-gray-900">{dpp.modellname || '—'}</span>
              </div>
              {dpp.type === 'BATTERY' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Kapazität:</span>
                    <span className="text-gray-900">{(dpp as any).kapazitaetKWh || '—'} kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chemisches System:</span>
                    <span className="text-gray-900">{(dpp as any).chemischesSystem || '—'}</span>
                  </div>
                </>
              )}
              {dpp.type === 'TEXTILE' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Material:</span>
                    <span className="text-gray-900">{(dpp as any).materialZusammensetzung || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Herkunft:</span>
                    <span className="text-gray-900">{(dpp as any).herkunftsland || '—'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                log('New product button clicked');
                setDpp(null);
                setExtractedData(null);
                setUploadedFile(null);
                setStep('select');
                setErrorMessage(null);
              }}
              className="flex-1 px-6 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors cursor-pointer"
            >
              + Neues Produkt
            </button>
            <button
              type="button"
              onClick={handleGoBack}
              className="flex-1 px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Zurück bearbeiten
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (should not happen)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <p className="text-gray-600">Lädt...</p>
      </div>
    </div>
  );
}

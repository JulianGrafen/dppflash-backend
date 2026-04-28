'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, Copy, Check } from 'lucide-react';

interface QRCodeDisplayProps {
  productId: string;
  productName: string;
  productData?: Record<string, unknown>;
  qrCodeDataUrl?: string; // Base64 PNG oder Data URL
  gtin?: string; // Optional GS1 Nummer
}

/**
 * QR-Code Display Komponente.
 * 
 * Features:
 * - Live QR-Code Anzeige
 * - Download als PNG
 * - Share/Copy Link
 * - Responsive Design
 */
export default function QRCodeDisplay({
  productId,
  productName,
  productData,
  qrCodeDataUrl,
  gtin,
}: QRCodeDisplayProps) {
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(qrCodeDataUrl || null);
  const [isLoading, setIsLoading] = useState(!qrCodeDataUrl);

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_DPP_URL || 'http://localhost:3000');

  // In stateless/serverless mode without Supabase persistence, add compact
  // fallback payload so /p/[id] can still render instead of 404.
  const isPersistentStorageConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const compactFallbackPayload = productData
    ? {
        id: productId,
        type: productData.type ?? 'OTHER',
        createdAt: productData.createdAt ?? new Date().toISOString(),
        language: productData.language ?? 'de',
        hersteller: productData.hersteller,
        modellname: productData.modellname,
        upi: productData.upi,
        gtin: productData.gtin,
        materialComposition: productData.materialComposition,
        recycledContent: productData.recycledContent,
        carbonFootprint: productData.carbonFootprint,
        substancesOfConcern: productData.substancesOfConcern,
        extractionConfidence: productData.extractionConfidence,
        extractionWarnings: productData.extractionWarnings,
      }
    : undefined;

  const fallbackQuery = !isPersistentStorageConfigured && compactFallbackPayload
    ? `?d=${encodeURIComponent(JSON.stringify(compactFallbackPayload))}`
    : '';

  const dppLink = `${baseUrl}/p/${productId}${fallbackQuery}`;

  // Generiere QR-Code wenn nicht vorhanden
  useEffect(() => {
    if (qrCodeDataUrl) {
      console.log(`[QRCodeDisplay] QR-Code Data URL provided, usando-a`);
      setQrUrl(qrCodeDataUrl);
      setIsLoading(false);
      return;
    }

    const generateQR = async () => {
      try {
        console.log(`[QRCodeDisplay] Gerando QR-Code para: ${dppLink}`);
        
        const response = await fetch('/api/qr-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, gtin }),
        });

        if (!response.ok) {
          throw new Error(`QR-Code API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[QRCodeDisplay] ✅ QR-Code gerado com sucesso`);
        setQrUrl(data.qrCodeDataUrl);
      } catch (error) {
        console.error('[QRCodeDisplay] ❌ Erro ao gerar QR-Code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateQR();
  }, [productId, gtin, qrCodeDataUrl, dppLink]);

  // Copy Link to Clipboard
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(dppLink);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
    }
  };

  // Download QR-Code
  const downloadQRCode = async () => {
    try {
      const response = await fetch('/api/qr-code/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      if (!response.ok) throw new Error('Download fehlgeschlagen');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dpp-${productId}-qr.png`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  // Share QR-Code
  const shareQRCode = async () => {
    if (!navigator.share) {
      // Fallback: Einfach copieren
      copyLink();
      return;
    }

    try {
      await navigator.share({
        title: `DPP: ${productName}`,
        text: `Digitaler Produktpass für ${productName}`,
        url: dppLink,
      });
    } catch (error) {
      // Nur bei echtem Fehler loggen (User-Cancel ist normal)
      if ((error as Error).name !== 'AbortError') {
        console.error('Share fehlgeschlagen:', error);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900">Digitaler Produktpass</h3>
        <p className="text-sm text-gray-500 mt-1">{productName}</p>
        <p className="text-xs text-gray-400 font-mono mt-2">ID: {productId}</p>
      </div>

      {/* QR-Code Display */}
      <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-center">
        {isLoading ? (
          <div className="text-gray-500 text-sm">QR-Code wird generiert...</div>
        ) : qrUrl ? (
          <div className="relative w-64 h-64">
            <img
              src={qrUrl}
              alt="DPP QR-Code"
              className="w-full h-full object-contain"
              onError={() => console.error('QR-Code Bild konnte nicht geladen werden')}
            />
          </div>
        ) : (
          <div className="text-red-500 text-sm">QR-Code konnte nicht generiert werden</div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        {/* Download */}
        <button
          type="button"
          onClick={downloadQRCode}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer font-medium"
          title="QR-Code als PNG herunterladen"
        >
          <Download size={16} />
          <span className="text-sm font-medium">Download</span>
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={shareQRCode}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer font-medium"
          title="DPP-Link teilen"
        >
          <Share2 size={16} />
          <span className="text-sm font-medium">Teilen</span>
        </button>

        {/* Copy Link */}
        <button
          type="button"
          onClick={copyLink}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer font-medium ${
            copiedToClipboard
              ? 'bg-gray-600 text-white'
              : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
          }`}
          title="Link in Zwischenablage kopieren"
        >
          {copiedToClipboard ? (
            <>
              <Check size={16} />
              <span className="text-sm font-medium">Kopiert!</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span className="text-sm font-medium">Link kopieren</span>
            </>
          )}
        </button>
      </div>

      {/* DPP Link Preview */}
      <div className="w-full mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500 mb-2 uppercase font-bold">DPP-Link</p>
        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded break-all">
          <code className="text-xs text-gray-700 flex-1 font-mono">{dppLink}</code>
        </div>
      </div>

      {/* Info */}
      <div className="text-center text-xs text-gray-500 max-w-sm">
        <p>
          📱 Nutzer können diesen QR-Code mit dem Smartphone scannen, um den Digitalen
          Produktpass anzusehen. Der QR-Code kann auf Verpackungen, Etiketten und Dokumenten
          angebracht werden.
        </p>
      </div>
    </div>
  );
}

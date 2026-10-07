'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import { buildPublicDppPassportPath } from '@/app/lib/publicDppUrl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  buildQrExportProductList,
  qrExportProductsToCsv,
  type QrExportProduct,
} from './qrExportProducts';
import {
  downloadCsvFile,
  downloadProductExportJson,
  downloadQrImage,
  fetchQrPreviewDataUrl,
} from './qrExportClient';

function QrPreviewThumb({ productId }: { readonly productId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchQrPreviewDataUrl(productId)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (failed) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (!dataUrl) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }

  return (
    <img
      src={dataUrl}
      alt=""
      className="h-14 w-14 rounded-md border border-slate-200 bg-white object-contain"
    />
  );
}

function ExportActions({ product }: { readonly product: QrExportProduct }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<void> | void) {
    setBusy(action);
    try {
      await fn();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 cursor-pointer"
        disabled={busy != null}
        onClick={() => run('png', () => downloadQrImage(product.productId, 'png'))}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        PNG
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 cursor-pointer"
        disabled={busy != null}
        onClick={() => run('svg', () => downloadQrImage(product.productId, 'svg'))}
      >
        SVG
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 cursor-pointer"
        disabled={busy != null}
        onClick={() => run('json', () => downloadProductExportJson(product))}
      >
        <FileJson className="h-3.5 w-3.5" aria-hidden />
        JSON
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 cursor-pointer"
        onClick={() =>
          run('copy', async () => {
            await navigator.clipboard.writeText(product.publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        Link
      </Button>
    </div>
  );
}

export function QrCodesExportPanel() {
  const products = useMemo(() => buildQrExportProductList(loadAllDrafts()), []);
  const publishedCount = products.filter((p) => p.source === 'published').length;

  function exportAllCsv() {
    const csv = qrExportProductsToCsv(products);
    downloadCsvFile('dpp-qr-export.csv', csv);
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-semibold text-[#0c1929]">Export pro Produkt</CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-sm">
              QR-Codes und Scan-Links für veröffentlichte Pässe sowie Katalog-SKUs aus dem Global PIM
              (Demo). Druckfertig als PNG/SVG oder als JSON/CSV für Etiketten und ERP.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 cursor-pointer"
            onClick={exportAllCsv}
            disabled={products.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Alle als CSV
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {publishedCount > 0 ? (
            <p className="mb-3 text-xs text-slate-500">
              {publishedCount} veröffentlichte{publishedCount === 1 ? 'r' : ''} Pass
              {publishedCount === 1 ? '' : 'e'} · {products.length} Produkte gesamt
            </p>
          ) : null}
        </CardContent>
      </Card>

      {products.length === 0 ? (
        <Card className="border-slate-200/90 shadow-sm">
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Noch keine Produkte für den Export. Pässe veröffentlichen oder Global-PIM-Onboarding abschließen.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200/90 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[4.5rem]">QR</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Pass-ID</TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                  <TableHead className="text-right">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.rowId}>
                    <TableCell>
                      <QrPreviewThumb productId={product.productId} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900">{product.productName}</p>
                      {product.sku ? (
                        <p className="text-xs text-slate-500">SKU {product.sku}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={buildPublicDppPassportPath(product.productId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {product.productId}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {product.source === 'published' ? (
                        <Badge variant="secondary" className="text-[10px]">Veröffentlicht</Badge>
                      ) : (
                        <div className="space-y-1">
                          {product.completionPercent != null ? (
                            <p className="text-xs tabular-nums text-slate-600">{product.completionPercent} %</p>
                          ) : null}
                          {product.statusLabel ? (
                            <p className="max-w-[12rem] truncate text-[11px] text-slate-500" title={product.statusLabel}>
                              {product.statusLabel}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ExportActions product={product} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

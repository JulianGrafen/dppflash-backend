import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/etl/run
 *
 * Body:
 * {
 *   sku_master_data: { sku, gtin, product_name, manufacturer_name, taric_code },
 *   raw_document: { filename, document_text }
 * }
 *
 * Runs `scripts/run-etl-pipeline.sh`, which prefers `.venv-langgraph/bin/python`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const skuMasterData = body.sku_master_data ?? {};
    const rawDocument = body.raw_document ?? {};
    const sapExport = body.sap_export;

    if (!sapExport && !rawDocument.document_text?.trim()) {
      return NextResponse.json(
        {
          error:
            'document_text oder sap_export ist erforderlich (SDS-Text, Produktbeschreibung oder SAP-JSON).',
        },
        { status: 400 },
      );
    }

    const payload = {
      sku_master_data: {
        sku: skuMasterData.sku?.trim() || null,
        gtin: skuMasterData.gtin?.trim() || null,
        product_name: skuMasterData.product_name?.trim() || null,
        manufacturer_name: skuMasterData.manufacturer_name?.trim() || null,
        taric_code: skuMasterData.taric_code?.trim() || null,
      },
      raw_document: {
        filename: rawDocument.filename?.trim() || 'sds.pdf',
        document_text: rawDocument.document_text?.trim() || null,
        product_type_hint: rawDocument.product_type_hint?.trim() || null,
      },
      sap_export: sapExport ?? null,
      supplier_odata: body.supplier_odata ?? null,
      max_extraction_attempts: body.max_extraction_attempts ?? 3,
    };

    const { runPipeline } = await import('@/app/lib/etl/runPipelineServer');
    const { stdout, stderr, exitCode } = await runPipeline(payload);

    if (exitCode !== 0) {
      let message = stderr.trim() || 'Pipeline failed.';
      try {
        const parsed = JSON.parse(stderr) as { error?: string };
        if (parsed.error) {
          message = parsed.error;
        }
      } catch {
        // keep raw stderr
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const result = JSON.parse(stdout);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

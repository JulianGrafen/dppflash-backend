import { NextRequest, NextResponse } from 'next/server';
import { saveProduct } from '@/app/services/productService';
import { ProductPassport } from '@/app/types/dpp-types';

/**
 * POST /api/products
 * Speichert ein neues Produkt.
 * 
 * Body: Partial<ProductPassport>
 * {
 *   type: "BATTERY" | "TEXTILE",
 *   hersteller: string,
 *   modellname: string,
 *   kapazitaetKWh?: number,
 *   chemischesSystem?: string,
 *   materialZusammensetzung?: string,
 *   herkunftsland?: string
 * }
 * 
 * Response:
 * {
 *   id: string,
 *   createdAt: Date,
 *   ... alle Produktfelder
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<ProductPassport>;

    console.log('📥 POST /api/products - Vollständiger Body:', JSON.stringify(body, null, 2));
    console.log('📥 Felder-Details:');
    console.log('  id:', body.id);
    console.log('  type:', body.type);
    console.log('  hersteller:', body.hersteller);
    console.log('  modellname:', body.modellname);
    console.log('  (typeof hersteller):', typeof body.hersteller);
    console.log('  (typeof modellname):', typeof body.modellname);

    // Validiere erforderliche Felder mit besserer Fehler-Ausgabe
    const hasType = Boolean(body.type);
    const hasHersteller = Boolean(body.hersteller) && body.hersteller !== '';
    const hasModellname = Boolean(body.modellname) && body.modellname !== '';

    console.log(`✓ Validierung: type=${hasType}, hersteller=${hasHersteller}, modellname=${hasModellname}`);

    if (!hasType || !hasHersteller || !hasModellname) {
      console.log('❌ Validierung fehlgeschlagen - fehlendes Feld(er)');
      return NextResponse.json(
        { error: 'Erforderlich: type, hersteller, modellname' },
        { status: 400 }
      );
    }

    // Speichere Produkt
    const savedProduct = await saveProduct(body);

    console.log('✅ Produto salvo com sucesso:', {
      id: savedProduct.id,
      type: savedProduct.type,
    });

    return NextResponse.json(savedProduct, { status: 201 });
  } catch (error) {
    console.error('❌ Erro ao salvar:', error);
    return NextResponse.json(
      {
        error: 'Fehler beim Speichern',
        details: error instanceof Error ? error.message : 'Unbekannt',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/products
 * Listet alle Produkte auf (später mit Pagination/Filter).
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    // Liste Produkte (zukünftig mit Tenant-Filtering)
    const { listProducts } = await import('@/app/services/productService');
    const products = await listProducts(tenantId || undefined);

    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    console.error('Fehler beim Abrufen:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen' },
      { status: 500 }
    );
  }
}

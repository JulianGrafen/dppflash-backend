import { NextResponse } from 'next/server';
import { mapPassportFieldsToBatteryDPP } from '@/app/domain/battery/mapPassportFieldsToBatteryDPP';
import {
  buildDemoReady100PassportFields,
  createDemoReady100Draft,
} from '@/app/dashboard/v2/mock/demoReady100Passport';
import {
  DEMO_READY_100_ID,
  DEMO_READY_100_PRODUCT_NAME,
  createDemoReady100PublicPassport,
} from '@/app/fixtures/demoReady100PublicPassport';
import { saveProductToStore } from '@/app/lib/server-store';

/**
 * POST /api/dashboard/v2/demo-deploy
 * Schreibt den 100 %-Readiness-Demo-Pass in den Server-Store (manuell / CI / Skript).
 */
export async function POST(request: Request) {
  try {
    const fields = buildDemoReady100PassportFields();
    const mapped = mapPassportFieldsToBatteryDPP(fields, {
      passId: DEMO_READY_100_ID,
      productName: DEMO_READY_100_PRODUCT_NAME,
    });
    const baseline = createDemoReady100PublicPassport();
    const product = {
      ...baseline,
      ...mapped,
      id: DEMO_READY_100_ID,
      passportFieldOverlay: {
        ...(baseline.passportFieldOverlay ?? {}),
        ...(mapped.passportFieldOverlay ?? {}),
      },
    };
    await saveProductToStore(product);

    const origin = new URL(request.url).origin;
    const publicUrl = `${origin}/p/${DEMO_READY_100_ID}`;
    const seedDraft = createDemoReady100Draft();

    return NextResponse.json({
      ok: true,
      passId: DEMO_READY_100_ID,
      publicUrl,
      editorPath: `/dashboard/v2/passports/${seedDraft.id}/editor`,
      seedDraft,
    });
  } catch (error) {
    console.error('[demo-deploy]', error);
    return NextResponse.json({ ok: false, message: 'Demo deploy failed' }, { status: 500 });
  }
}

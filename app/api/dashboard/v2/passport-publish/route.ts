import { NextResponse } from 'next/server';
import { mapPassportFieldsToBatteryDPP } from '@/app/domain/battery/mapPassportFieldsToBatteryDPP';
import { VOLTSTRIDE_720_ID } from '@/app/fixtures/voltstride720PublicPassport';
import { saveProductToStore } from '@/app/lib/server-store';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

type Body = {
  passportFields?: Record<string, PassportFieldValueState>;
  productName?: string;
  passId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const fields = body.passportFields ?? {};
    const passId = body.passId ?? VOLTSTRIDE_720_ID;
    const product = mapPassportFieldsToBatteryDPP(fields, {
      productName: body.productName,
      passId,
    });
    await saveProductToStore(product);
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      passId: product.id,
      publicUrl: `${origin}/p/${product.id}`,
    });
  } catch (error) {
    console.error('[passport-publish]', error);
    return NextResponse.json({ ok: false, message: 'Publish failed' }, { status: 500 });
  }
}

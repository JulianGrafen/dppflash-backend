import { NextRequest, NextResponse } from 'next/server';
import { updateProduct } from '@/app/services/productService';
import { assertSafeProductId } from '@/app/lib/security/safeProductId';
import { safeRelativeRedirectPath } from '@/app/lib/security/safeRedirectPath';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const productId = formData.get('productId');
    const returnUrl = formData.get('returnUrl');

    if (typeof productId !== 'string' || !productId.trim()) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    let safeProductId: string;

    try {
      safeProductId = assertSafeProductId(productId);
    } catch {
      return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
    }

    await updateProduct(safeProductId, {
      complianceStatus: 'COMPLIANT',
      enrichmentReview: {
        required: false,
        status: 'VALIDATED',
        validatedAt: new Date().toISOString(),
      },
    } as never);

    const fallbackPath = `/p/${safeProductId}`;
    const redirectPath = typeof returnUrl === 'string'
      ? safeRelativeRedirectPath(returnUrl, fallbackPath)
      : fallbackPath;

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

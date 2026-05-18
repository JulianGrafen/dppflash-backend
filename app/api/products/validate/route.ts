import { NextRequest, NextResponse } from 'next/server';
import { updateProduct, getProduct } from '@/app/services/productService';
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

    const validatedByField = formData.get('validatedBy');
    const auditor = typeof validatedByField === 'string' ? validatedByField.trim() : '';

    const existing = await getProduct(safeProductId);
    const prevReview =
      existing && existing.enrichmentReview && typeof existing.enrichmentReview === 'object'
        ? { ...(existing.enrichmentReview as Record<string, unknown>) }
        : {};

    await updateProduct(safeProductId, {
      complianceStatus: 'COMPLIANT',
      enrichmentReview: {
        ...prevReview,
        required: false,
        status: 'VALIDATED',
        validatedAt: new Date().toISOString(),
        ...(auditor.length > 0 ? { validatedBy: auditor } : {}),
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

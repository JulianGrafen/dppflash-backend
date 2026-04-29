import { NextRequest, NextResponse } from 'next/server';
import { updateProduct } from '@/app/services/productService';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const productId = formData.get('productId');
    const returnUrl = formData.get('returnUrl');

    if (typeof productId !== 'string' || !productId.trim()) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    await updateProduct(productId, {
      complianceStatus: 'COMPLIANT',
      enrichmentReview: {
        required: false,
        status: 'VALIDATED',
        validatedAt: new Date().toISOString(),
      },
    } as never);

    const redirectTarget = typeof returnUrl === 'string' && returnUrl.trim()
      ? returnUrl
      : `/p/${productId}`;

    return NextResponse.redirect(new URL(redirectTarget, request.url));
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

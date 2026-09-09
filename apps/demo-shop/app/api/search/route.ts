import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '../../../lib/products';
import { behaviorFor, currentVariant } from '../../../lib/variant';

export async function GET(request: NextRequest) {
  const behavior = behaviorFor(currentVariant());
  await new Promise((resolve) => setTimeout(resolve, behavior.searchDelayMs));
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const results = searchProducts(q);
  return NextResponse.json({ query: q, count: results.length, results });
}

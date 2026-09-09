import { NextRequest, NextResponse } from 'next/server';
import { behaviorFor, currentVariant } from '../../../lib/variant';

export async function POST(request: NextRequest) {
  const behavior = behaviorFor(currentVariant());
  const body = await request.json() as { quantity?: unknown };
  if (typeof body.quantity !== 'number' || body.quantity <= 0) {
    return NextResponse.json(behavior.invalidOrderBody, { status: behavior.invalidOrderStatus });
  }
  return NextResponse.json({ id: 'ord_demo_1049', quantity: body.quantity, status: 'created' }, { status: 201 });
}

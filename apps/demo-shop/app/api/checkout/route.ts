import { NextRequest, NextResponse } from 'next/server';
import { behaviorFor, currentVariant } from '../../../lib/variant';

export async function POST(request: NextRequest) {
  const body = await request.json() as { quantity?: number };
  if (!body.quantity || body.quantity < 1) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
  const behavior = behaviorFor(currentVariant());
  const webhookUrl = process.env.TRUTHSHOP_WEBHOOK_URL;
  if (webhookUrl) {
    for (const type of behavior.eventOrder) {
      await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-truthshop-event': type }, body: JSON.stringify({ type, orderId: 'ord_demo_1049' }) });
    }
  }
  return NextResponse.json({ ok: true, orderId: 'ord_demo_1049' });
}

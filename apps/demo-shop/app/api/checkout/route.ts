import { NextRequest, NextResponse } from 'next/server';
import { behaviorFor, currentVariant } from '../../../lib/variant';

export async function POST(request: NextRequest) {
  const body = await request.json() as { quantity?: number; webhookUrl?: string };
  if (!body.quantity || body.quantity < 1) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
  const behavior = behaviorFor(currentVariant());
  const webhookUrl = safeLoopbackWebhook(body.webhookUrl) ?? safeLoopbackWebhook(process.env.TRUTHSHOP_WEBHOOK_URL);
  if (webhookUrl) {
    for (const type of behavior.eventOrder) {
      await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-truthshop-event': type }, body: JSON.stringify({ type, orderId: 'ord_demo_1049' }) });
    }
  }
  return NextResponse.json({ ok: true, orderId: 'ord_demo_1049' });
}

function safeLoopbackWebhook(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:') return undefined;
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

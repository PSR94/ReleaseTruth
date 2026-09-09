import { afterEach, describe, expect, it } from 'vitest';
import { EventCollector } from './index.js';

const collectors: EventCollector[] = [];

afterEach(async () => {
  await Promise.all(collectors.splice(0).map((collector) => collector.close()));
});

describe('EventCollector', () => {
  it('preserves delivery order and emits only stable headers', async () => {
    const collector = new EventCollector();
    collectors.push(collector);
    const url = await collector.start();

    await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-truthshop-event': 'payment.completed',
        authorization: 'Bearer should-not-be-captured',
      },
      body: JSON.stringify({ type: 'payment.completed', id: 'pay_1' }),
    });
    await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-truthshop-event': 'invoice.generated',
      },
      body: JSON.stringify({ type: 'invoice.generated', id: 'inv_1' }),
    });

    const observation = collector.observation('checkout-events');
    const attributes = observation.attributes as {
      order: string[];
      events: Array<Record<string, unknown>>;
    };
    expect(attributes.order).toEqual([
      'payment.completed',
      'invoice.generated',
    ]);
    expect(attributes.events).toEqual([
      expect.objectContaining({
        id: 'event-1',
        sequence: 1,
        type: 'payment.completed',
        path: '/webhook',
        headers: {
          'content-type': 'application/json',
          'x-truthshop-event': 'payment.completed',
        },
      }),
      expect.objectContaining({
        id: 'event-2',
        sequence: 2,
        type: 'invoice.generated',
      }),
    ]);
  });
});

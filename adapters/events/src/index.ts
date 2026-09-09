import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Observation } from '@releasetruth/shared-types';

export interface CapturedEvent {
  sequence: number;
  method: string;
  path: string;
  headers: Record<string, string | string[]>;
  payload: unknown;
  receivedOffsetMs: number;
}

export class EventCollector {
  readonly events: CapturedEvent[] = [];
  #server: Server | undefined;
  #startedAt = 0;

  async start(): Promise<string> {
    if (this.#server !== undefined) throw new Error('event collector already started');
    this.#startedAt = performance.now();
    this.#server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let payload: unknown = text;
        try { payload = text.length === 0 ? null : JSON.parse(text); } catch { /* keep text */ }
        const headers = Object.fromEntries(Object.entries(request.headers)
          .filter(([name]) => !['authorization', 'cookie'].includes(name.toLowerCase()))
          .map(([name, value]) => [name, Array.isArray(value) ? value : value ?? '']));
        this.events.push({ sequence: this.events.length + 1, method: request.method ?? 'POST', path: request.url ?? '/', headers, payload, receivedOffsetMs: performance.now() - this.#startedAt });
        response.statusCode = 204;
        response.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.#server!.once('error', reject);
      this.#server!.listen(0, '127.0.0.1', () => resolve());
    });
    const address = this.#server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  observation(id: string): Observation {
    const stableEvents = this.events.map((event) => ({
      id: `event-${event.sequence}`,
      sequence: event.sequence,
      type: inferType(event.payload),
      method: event.method,
      path: event.path,
      headers: Object.fromEntries(Object.entries(event.headers).filter(([name]) => ['content-type', 'x-truthshop-event'].includes(name.toLowerCase()))),
      payload: event.payload,
    }));
    return { id, kind: 'event_sequence', attributes: { order: stableEvents.map((event) => event.type), events: stableEvents } };
  }

  async close(): Promise<void> {
    if (this.#server === undefined) return;
    await new Promise<void>((resolve, reject) => this.#server!.close((error) => error ? reject(error) : resolve()));
    this.#server = undefined;
  }
}

function inferType(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'type' in payload && typeof (payload as { type?: unknown }).type === 'string') return (payload as { type: string }).type;
  return '<unknown>';
}

/**
 * Test helpers: build the API over an in-memory JSON store and call it like
 * Fastify's inject(), so the tests read the same as before the Hono move.
 */
import { buildApp as buildRealApp, type AppOptions } from '../src/app';
import { JsonStore } from '../src/store/jsonStore';
import { MemoryProofStorage } from '../src/store/proofStorage';
import { StoreDb } from '../src/store/storeDb';

export interface InjectRequest {
  method: string;
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
}
export interface InjectResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  rawPayload: Buffer;
  json(): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type TestAppOptions = Omit<AppOptions, 'db'> & { store?: JsonStore; db?: AppOptions['db'] };

export function buildApp(opts: TestAppOptions) {
  const store = opts.store ?? new JsonStore(null);
  const db = opts.db ?? new StoreDb(store, new MemoryProofStorage());
  const built = buildRealApp({ ...opts, db });
  const inject = async (req: InjectRequest): Promise<InjectResponse> => {
    const isText = typeof req.payload === 'string';
    const headers: Record<string, string> = {
      ...(req.payload !== undefined && !isText ? { 'content-type': 'application/json' } : {}),
      ...(req.headers ?? {}),
    };
    const res = await built.app.request(req.url, {
      method: req.method,
      headers,
      body: req.payload === undefined ? undefined : isText ? (req.payload as string) : JSON.stringify(req.payload),
    });
    const raw = Buffer.from(await res.arrayBuffer());
    const text = raw.toString('utf8');
    return { statusCode: res.status, headers: Object.fromEntries(res.headers), body: text, rawPayload: raw, json: () => JSON.parse(text) };
  };
  return {
    ...built,
    db,
    store,
    app: Object.assign(built.app, { inject, close: async () => undefined }),
  };
}

/** Lets fire-and-forget work (Telegram sends, message edits) finish. */
export const tick = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
};

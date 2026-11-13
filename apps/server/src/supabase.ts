/**
 * Production entry: the whole API as one Supabase Edge Function (Deno).
 * `npm run build:supabase` bundles this file into supabase/functions/api/index.ts.
 *
 * The game calls https://<project>.supabase.co/functions/v1/api/... (VITE_API_URL
 * = https://<project>.supabase.co/functions/v1). Data: Postgres tables and the
 * private Storage bucket "proofs" (supabase/migrations/0001_init.sql).
 *
 * Function secrets (Supabase → Edge Functions → Secrets):
 *   ADMIN_TOKEN            admin panel password (required for the admin panel and the bot)
 *   PAYMENT_CARD_NUMBER    card players pay to
 *   PAYMENT_CARD_HOLDER    card holder name
 *   TELEGRAM_BOT_TOKEN     optional: receipts in Telegram with approve / reject buttons
 *   WEB_URL                the game's address, e.g. https://futbolchi-pro.vercel.app (CORS)
 *   optional: ADMIN_NICK, ADMIN_CONTACT_URL, PERSONA_PRICE_MINOR, CORS_ORIGINS,
 *             TELEGRAM_CHAT_ID, PAYMENT_EVENT_SECRET (derived from the service key if unset)
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 */
import { buildApp, type Logger } from './app';
import { DEFAULT_PRICE_MINOR } from './domain';
import { ManualPaymentProvider } from './payments/ManualPaymentProvider';
import { hmacHex } from './payments/signedEvents';
import { TelegramHttp, webhookSecretFor } from './notify/telegram';
import { SupabaseDb } from './store/supabaseDb';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
declare const EdgeRuntime: { waitUntil(work: Promise<unknown>): void } | undefined;

const env = (name: string): string | undefined => {
  const v = Deno.env.get(name)?.trim();
  return v ? v : undefined;
};

const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SECRET_KEY');
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing');

const functionsUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;
const webUrl = env('WEB_URL') ?? null;

const logger: Logger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

// Signs internal payment decisions; derived from the service key unless set.
const eventSecret = env('PAYMENT_EVENT_SECRET') ?? (await hmacHex(serviceKey, 'futbolchi-payment-events'));

const tgToken = env('TELEGRAM_BOT_TOKEN');
const telegram = tgToken
  ? {
      api: new TelegramHttp(tgToken),
      chatId: env('TELEGRAM_CHAT_ID') ?? null,
      adminUrl: webUrl ? `${webUrl.replace(/\/+$/, '')}/#/admin` : null,
      webhook: { url: `${functionsUrl}/api/telegram/webhook`, secret: await webhookSecretFor(tgToken) },
    }
  : null;

const card = env('PAYMENT_CARD_NUMBER');
if (!card) logger.warn('[payments] PAYMENT_CARD_NUMBER is not set — showing a placeholder card');
if (!env('ADMIN_TOKEN')) logger.warn('[admin] ADMIN_TOKEN is not set — the admin panel and the bot link are off');

const { app } = buildApp({
  db: new SupabaseDb(supabaseUrl, serviceKey),
  provider: new ManualPaymentProvider(eventSecret),
  priceMinor: Number(env('PERSONA_PRICE_MINOR') ?? DEFAULT_PRICE_MINOR),
  adminToken: env('ADMIN_TOKEN') ?? null,
  adminNick: env('ADMIN_NICK') ?? null,
  paymentCard: { number: card ?? '0000 0000 0000 0000', holder: env('PAYMENT_CARD_HOLDER') ?? 'KARTA EGASI' },
  contactUrl: env('ADMIN_CONTACT_URL') ?? 'https://t.me/futproadmin',
  webUrl,
  telegram,
  corsOrigins: [webUrl, ...(env('CORS_ORIGINS') ?? '').split(',')].filter((o): o is string => !!o && o.trim() !== ''),
  logger,
  // Telegram sends and message edits must finish after the response is sent.
  background: (work) => (typeof EdgeRuntime !== 'undefined' ? EdgeRuntime.waitUntil(work) : void work),
});

// Supabase hands the function "/api/…"; strip "/functions/v1" too in case a proxy keeps it.
Deno.serve((req) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/functions/v1/')) return app.fetch(req);
  url.pathname = url.pathname.slice('/functions/v1'.length);
  return app.fetch(new Request(url.toString(), req));
});

import './env';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { ManualPaymentProvider } from './payments/ManualPaymentProvider';
import { JsonStore } from './store/jsonStore';
import { DiskProofStorage } from './store/proofStorage';
import { TelegramHttp } from './notify/telegram';

const PORT = Number(process.env.PORT ?? 8787);
const isProd = process.env.NODE_ENV === 'production';
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));

const adminToken = process.env.ADMIN_TOKEN ?? (isProd ? null : 'dev-admin-token');
if (!process.env.ADMIN_TOKEN && !isProd) console.warn('[admin] using dev token "dev-admin-token" — set ADMIN_TOKEN');

// Typing this nickname on the name screen opens the admin login (the token is still required).
const adminNick = process.env.ADMIN_NICK ?? (isProd ? null : 'admin1121');

// Manual payments: card transfer + receipt upload + admin approval.
// TODO(payme/click): choose an automatic provider from env once one exists.
const secret = process.env.PAYMENT_EVENT_SECRET ?? (isProd ? null : 'dev-manual-secret');
if (!secret) throw new Error('PAYMENT_EVENT_SECRET is required in production.');
const provider = new ManualPaymentProvider(secret);

// The card players transfer to. Set both in the environment; the default is an obvious placeholder.
const paymentCard = {
  number: process.env.PAYMENT_CARD_NUMBER ?? '0000 0000 0000 0000',
  holder: process.env.PAYMENT_CARD_HOLDER ?? 'KARTA EGASI',
};
if (!process.env.PAYMENT_CARD_NUMBER) console.warn('[payments] PAYMENT_CARD_NUMBER is not set — showing a placeholder card');

// In dev the game runs on Vite (port 5173). Set WEB_URL when it lives elsewhere.
const webUrl = process.env.WEB_URL ?? (isProd ? null : 'http://localhost:5173');

// Players who wait too long can message the admin here (shown next to the receipt upload).
const contactUrl = process.env.ADMIN_CONTACT_URL ?? 'https://t.me/futproadmin';

// Optional admin bot: receipts arrive in Telegram with approve / reject buttons.
// TELEGRAM_CHAT_ID is optional: any chat can link by sending the admin token to the bot.
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const telegram = tgToken
  ? {
      api: new TelegramHttp(tgToken),
      chatId: process.env.TELEGRAM_CHAT_ID ?? null,
      adminUrl: webUrl ? `${webUrl}/#/admin` : null,
    }
  : null;

const { app, bot } = buildApp({
  store: new JsonStore(`${dataDir}/db.json`),
  proofs: new DiskProofStorage(`${dataDir}/proofs`),
  provider,
  adminToken,
  adminNick,
  paymentCard,
  contactUrl,
  telegram,
  webUrl,
  logger: true,
});
app
  .listen({ port: PORT, host: '127.0.0.1' })
  .then(() => bot?.start())
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

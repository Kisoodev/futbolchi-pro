import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { ManualPaymentProvider } from './payments/ManualPaymentProvider';
import { JsonStore } from './store/jsonStore';
import { DiskProofStorage } from './store/proofStorage';

const PORT = Number(process.env.PORT ?? 8787);
const isProd = process.env.NODE_ENV === 'production';
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));

const adminToken = process.env.ADMIN_TOKEN ?? (isProd ? null : 'dev-admin-token');
if (!process.env.ADMIN_TOKEN && !isProd) console.warn('[admin] using dev token "dev-admin-token" — set ADMIN_TOKEN');

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

const { app } = buildApp({
  store: new JsonStore(`${dataDir}/db.json`),
  proofs: new DiskProofStorage(`${dataDir}/proofs`),
  provider,
  adminToken,
  paymentCard,
  logger: true,
});
app.listen({ port: PORT, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

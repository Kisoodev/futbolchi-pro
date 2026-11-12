import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { MockPaymentProvider } from './payments/MockPaymentProvider';
import { JsonStore } from './store/jsonStore';

const PORT = Number(process.env.PORT ?? 8787);
const isProd = process.env.NODE_ENV === 'production';
const dataFile = process.env.DATA_FILE ?? fileURLToPath(new URL('../data/db.json', import.meta.url));

const adminToken = process.env.ADMIN_TOKEN ?? (isProd ? null : 'dev-admin-token');
if (!process.env.ADMIN_TOKEN && !isProd) console.warn('[admin] using dev token "dev-admin-token" — set ADMIN_TOKEN');

// TODO(payme/click): choose provider from env once real providers exist. Never use the mock in production.
if (isProd) throw new Error('MVP uses MockPaymentProvider only; refusing to start in production.');
const provider = new MockPaymentProvider(process.env.MOCK_WEBHOOK_SECRET ?? 'dev-mock-secret');

const { app } = buildApp({ store: new JsonStore(dataFile), provider, adminToken, logger: true });
app.listen({ port: PORT, host: '127.0.0.1' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

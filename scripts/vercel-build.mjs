/**
 * Vercel build: builds the game page (apps/web) and, if asked, copies it to
 * the folder the Vercel project serves. Works whatever the project's Root
 * Directory is:
 *   repo root   → vercel.json            → served from apps/web/dist
 *   apps/web    → apps/web/vercel.json   → served from apps/web/dist
 *   apps/server → apps/server "build"    → copied to apps/server/public
 * The API is not deployed on Vercel (see README → Deploy).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];

execSync('npm run build', { cwd: root, stdio: 'inherit' });

const dist = resolve(root, 'apps/web/dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('[vercel] build produced no apps/web/dist/index.html');
if (out) {
  const target = resolve(root, out);
  rmSync(target, { recursive: true, force: true });
  cpSync(dist, target, { recursive: true });
  console.log(`[vercel] game copied to ${out}`);
}

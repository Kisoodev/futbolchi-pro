/**
 * `npm run dev`: starts the API server and the web app together, with
 * prefixed output. Ctrl+C stops both; if either one exits, the other stops too.
 *
 * `npm run dev:phone` (--phone): the web app also listens on the local
 * network, so a phone on the same Wi-Fi or hotspot can open it. The API
 * server stays on localhost; the web app proxies /api to it.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const phone = process.argv.includes('--phone');
const env = { ...process.env, ...(phone ? { FUTBOLCHI_PHONE: '1' } : {}) };

const tasks = [
  { name: 'server', script: 'dev:server', color: '\x1b[36m' },
  { name: 'web', script: 'dev:web', color: '\x1b[32m' },
];
const reset = '\x1b[0m';
const children = [];
let stopping = false;

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  setTimeout(() => process.exit(code), 300);
}

for (const t of tasks) {
  const child = spawn('npm', ['run', t.script], { shell: true, env });
  children.push(child);
  const prefix = `${t.color}[${t.name}]${reset} `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!stopping) {
      process.stderr.write(`${prefix}stopped (exit ${code ?? 'signal'}) — stopping the other one too\n`);
      stopAll(code ?? 1);
    }
  });
}

console.log('\nO\'yin:  http://localhost:5173\nAdmin:  http://localhost:5173/#/admin\n');
if (phone) {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  console.log('Telefondan (shu Wi-Fi yoki hotspot):');
  for (const ip of ips) console.log(`  http://${ip}:5173`);
  console.log('Windows ruxsat so\'rasa, "Allow access" ni bosing.\n');
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

/**
 * `npm run dev`: starts the API server and the web app together, with
 * prefixed output. Ctrl+C stops both; if either one exits, the other stops too.
 */
import { spawn } from 'node:child_process';

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
  const child = spawn('npm', ['run', t.script], { shell: true, env: process.env });
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
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

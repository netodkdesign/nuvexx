// Desliga o Nuvexx que foi ligado com "npm run ligar".
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const PID_FILE = resolve(import.meta.dirname, '..', 'data', 'nuvexx.pid');

let pid = null;
try {
  pid = Number(readFileSync(PID_FILE, 'utf8'));
  process.kill(pid, 0);
} catch {
  pid = null;
}

if (pid) {
  // /T encerra também o app, que é filho do processo que vigia.
  execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  console.log('Nuvexx desligado.');
} else {
  console.log('O Nuvexx não estava ligado.');
}
rmSync(PID_FILE, { force: true });

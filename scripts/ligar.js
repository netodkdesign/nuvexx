// Liga o Nuvexx em segundo plano, sem janela aberta, e religa o app se ele cair.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATA = resolve(ROOT, 'data');
const PID_FILE = resolve(DATA, 'nuvexx.pid');
const LOG_FILE = resolve(DATA, 'nuvexx.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const RESTART_DELAY_MS = 5000;
// Mesmo código usado em src/index.js quando a porta já está ocupada.
const EXIT_PORT_IN_USE = 3;
const WATCH_FLAG = '--vigia';

function runningPid() {
  try {
    const pid = Number(readFileSync(PID_FILE, 'utf8'));
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function openLog() {
  try {
    if (statSync(LOG_FILE).size > MAX_LOG_BYTES) renameSync(LOG_FILE, `${LOG_FILE}.antigo`);
  } catch {
    // Primeira execução: o arquivo ainda não existe.
  }
  return openSync(LOG_FILE, 'a');
}

function watch() {
  const log = openLog();
  const startApp = () => {
    const app = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', resolve(ROOT, 'src/index.js')], {
      cwd: ROOT,
      stdio: ['ignore', log, log],
      windowsHide: true,
    });
    app.on('exit', (code) => {
      if (code === 0 || code === EXIT_PORT_IN_USE) {
        rmSync(PID_FILE, { force: true });
        process.exit(code);
      }
      writeFileSync(log, `${new Date().toISOString()} O app parou (código ${code}). Religando.\n`);
      setTimeout(startApp, RESTART_DELAY_MS);
    });
  };
  startApp();
}

if (process.argv.includes(WATCH_FLAG)) {
  watch();
} else {
  mkdirSync(DATA, { recursive: true });
  const pid = runningPid();
  if (pid) {
    console.log(`O Nuvexx já está ligado (processo ${pid}).`);
  } else {
    const watcher = spawn(process.execPath, [import.meta.filename, WATCH_FLAG], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    writeFileSync(PID_FILE, String(watcher.pid));
    watcher.unref();
    console.log('Nuvexx ligado em segundo plano. O registro fica em data/nuvexx.log.');
  }
}

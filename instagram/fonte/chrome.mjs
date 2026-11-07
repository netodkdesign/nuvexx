// Abre o Chrome do computador em segundo plano e conversa com ele. Usado pelos dois geradores.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export function abrirChrome() {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'nuvexx-instagram-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--force-color-profile=srgb',
    '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let saida = '';
    chrome.on('error', reject);
    chrome.stderr.on('data', (parte) => {
      saida += parte;
      const achado = saida.match(/DevTools listening on (ws:\S+)/);
      if (achado) resolve({ chrome, perfil, ws: achado[1] });
    });
  });
}

export async function conectar(endereco) {
  const socket = new WebSocket(endereco);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let proximo = 1;
  const pendentes = new Map();
  const ouvintes = new Map();
  socket.onmessage = ({ data }) => {
    const mensagem = JSON.parse(data);
    if (mensagem.id && pendentes.has(mensagem.id)) {
      const { resolve, reject } = pendentes.get(mensagem.id);
      pendentes.delete(mensagem.id);
      if (mensagem.error) reject(new Error(mensagem.error.message));
      else resolve(mensagem.result);
    } else if (mensagem.method && ouvintes.has(mensagem.method)) {
      ouvintes.get(mensagem.method)();
      ouvintes.delete(mensagem.method);
    }
  };
  const enviar = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = proximo++;
    pendentes.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const esperar = (method) => new Promise((resolve) => ouvintes.set(method, resolve));
  return { enviar, esperar, socket };
}

// Entrada do app na Vercel. Cada instância monta o app uma vez e atende os pedidos seguintes com ele.
// O vercel.json manda todos os endereços para cá, e o agendador da Vercel chama /cron/minuto a cada minuto.
import { attachDatabasePool, waitUntil } from '@vercel/functions';
import { loadConfig } from '../src/config.js';
import { createRuntime } from '../src/runtime.js';

let starting = null;

function runtime() {
  // Se a montagem falhar (banco fora do ar, segredo faltando), a próxima visita tenta de novo.
  starting ??= createRuntime(loadConfig(), { onPool: attachDatabasePool }).catch((err) => {
    starting = null;
    throw err;
  });
  return starting;
}

export default async function handler(req, res) {
  let app;
  try {
    app = await runtime();
  } catch (err) {
    console.error(`O Nuvexx não subiu: ${err.message}`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('O Nuvexx está fora do ar por alguns instantes. Tente de novo em seguida.');
    return;
  }
  // Depois de responder à Meta, o app ainda processa a mensagem: a Vercel espera esse trabalho terminar.
  const done = app.handler(req, res);
  waitUntil(done);
  await done;
}

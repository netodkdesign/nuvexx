// Servidor comum, que fica ligado o tempo todo: neste computador e na Fly.io. Na Vercel, a entrada é api/index.js.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { ensureEnvFile, ENV_PATH, loadConfig } from './config.js';
import { createRuntime } from './runtime.js';

// Avisa scripts/ligar.js que não adianta tentar de novo.
const EXIT_PORT_IN_USE = 3;

// No servidor, os segredos vêm do provedor: sem eles, o app para com uma mensagem clara.
const envCreated = !process.env.SESSAO_SEGREDO && process.env.AMBIENTE !== 'producao' && ensureEnvFile();
if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const config = loadConfig();

let runtime;
try {
  runtime = await createRuntime(config);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const { db, google, mailer, scheduler, handler } = runtime;
const server = createServer(handler);

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.error(`A porta ${config.port} já está em uso. O Nuvexx já está aberto? Se não, troque PORT no .env.`);
  process.exit(EXIT_PORT_IN_USE);
});

server.listen(config.port, () => {
  console.log(`Nuvexx rodando em http://localhost:${config.port} (${config.isProduction ? 'produção' : 'desenvolvimento'})`);
  if (envCreated) console.log('Arquivo .env criado com segredos aleatórios.');
  if (!mailer.isConfigured()) console.log('E-mail ainda não configurado: em desenvolvimento, as mensagens aparecem na tela de entrada.');
  if (!config.whatsapp.appSecret) console.log('WhatsApp (opcional) ainda não configurado: veja o README.md.');
  if (!config.transcription.apiKey) console.log('Áudio no WhatsApp (opcional) ainda não configurado: veja o README.md.');
  if (!google.isConfigured()) console.log('Google (opcional) ainda não configurado: veja o README.md.');
  // Aqui o próprio app é o relógio dos lembretes. Na Vercel, quem chama a rotina é o agendador dela.
  scheduler.start();
});

const shutdown = () => {
  scheduler.stop();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  server.closeAllConnections();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

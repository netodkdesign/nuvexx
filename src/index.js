import { existsSync } from 'node:fs';
import { ensureEnvFile, ENV_PATH, loadConfig } from './config.js';
import { connect } from './database.js';
import { openDb } from './db.js';
import { createMailer } from './email.js';
import { createGoogle } from './google.js';
import { createScheduler } from './scheduler.js';
import { createApp } from './server.js';

// Avisa scripts/ligar.js que não adianta tentar de novo.
const EXIT_PORT_IN_USE = 3;

// No servidor, os segredos vêm do provedor: sem eles, o app para com uma mensagem clara, logo abaixo.
const envCreated = !process.env.SESSAO_SEGREDO && process.env.AMBIENTE !== 'producao' && ensureEnvFile();
if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const config = loadConfig();

function stopIf(condition, message) {
  if (condition) {
    console.error(message);
    process.exit(1);
  }
}

const mailer = createMailer({ config });

stopIf(!config.sessionSecret || !config.encryptionKey, 'Defina SESSAO_SEGREDO e CRIPTO_CHAVE no arquivo .env antes de iniciar.');
if (config.isProduction) {
  stopIf(!config.databaseUrl, 'Em produção, defina DATABASE_URL com um PostgreSQL gerenciado.');
  stopIf(/localhost|127\.0\.0\.1/.test(config.appUrl), 'Em produção, defina APP_URL com o endereço público: ele vai nos links enviados por e-mail.');
  stopIf(!mailer.isConfigured(), 'Em produção, defina SMTP_URL e EMAIL_REMETENTE: sem e-mail, ninguém consegue criar conta nem recuperar a senha.');
  stopIf(!config.clientIpHeader, 'Em produção, defina CABECALHO_IP_CLIENTE com o cabeçalho que o provedor usa para o endereço do visitante. Sem ele, o limite de tentativas trata todos como a mesma pessoa.');
  stopIf(
    config.registration.open && !(config.company.name && config.company.cnpj && config.company.email),
    'Para abrir o cadastro, preencha EMPRESA_NOME, EMPRESA_CNPJ e EMPRESA_EMAIL: eles aparecem nos termos de uso.',
  );
}

const connection = await connect({ databaseUrl: config.databaseUrl, dataDir: config.localDataDir });
const db = await openDb(connection);
const google = createGoogle({ config, db });
const server = createApp({ config, db, google, mailer });
const scheduler = createScheduler({ db, google, config, mailer });

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

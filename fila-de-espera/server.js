// Liga a página da fila de espera. As configurações vêm do .env desta pasta, não do .env do app.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWaitlist, DEFAULT_DATA_DIR } from './waitlist.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STOP_TIMEOUT_MS = 4000;

try {
  process.loadEnvFile(resolve(HERE, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const env = process.env;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (env.AMBIENTE === 'producao') {
  // Sem PASTA_DADOS, a lista ficaria no disco da própria máquina e sumiria na publicação seguinte.
  const missing = ['EMPRESA_NOME', 'EMPRESA_CNPJ', 'EMPRESA_EMAIL', 'CABECALHO_IP_CLIENTE', 'PASTA_DADOS'].filter((key) => !env[key]);
  if (missing.length) fail(`Faltam estas variáveis para abrir a fila de espera: ${missing.join(', ')}`);
}

const port = Number(env.PORT) || 3200;
const server = await createWaitlist({
  dataDir: env.PASTA_DADOS || DEFAULT_DATA_DIR,
  clientIpHeader: (env.CABECALHO_IP_CLIENTE || '').toLowerCase(),
  company: { name: env.EMPRESA_NOME, cnpj: env.EMPRESA_CNPJ, email: env.EMPRESA_EMAIL },
}).catch((err) => fail(err.message));

server.listen(port, () => console.log(`Fila de espera em http://localhost:${port}`));

// Ao receber o aviso de desligar, termina o que está gravando antes de sair.
function stop() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), STOP_TIMEOUT_MS).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

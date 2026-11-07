// Monta as variáveis da Vercel e copia para a área de transferência, sem mostrar nada na tela.
// No painel da Vercel, cole no campo do nome (Key) das variáveis: ela separa uma por linha.
//   npm run vercel:segredos
// Leva os valores fixos do fly.toml, ajustados para a Vercel, e gera SESSAO_SEGREDO, CRIPTO_CHAVE e CRON_SECRET.
// Rode uma vez só. Trocar SESSAO_SEGREDO encerra todas as sessões, e trocar CRIPTO_CHAVE desconecta todos do Google.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const SECRETS = ['SESSAO_SEGREDO', 'CRIPTO_CHAVE', 'CRON_SECRET'];
// O que muda da Fly.io para a Vercel. PORT é da própria Vercel.
const VERCEL_OVERRIDES = { CABECALHO_IP_CLIENTE: 'x-real-ip', BANCO_CONEXOES: '3', NODEJS_HELPERS: '0' };
// Ficam com a pessoa, porque só ela tem esses valores.
export const MISSING = ['DATABASE_URL', 'DATABASE_SENHA', 'RESEND_CHAVE', 'EMAILS_LIBERADOS'];

// Lê a seção [env] do fly.toml: só linhas NOME = "valor".
export function flyEnv(toml) {
  const section = toml.match(/^\[env\]\s*$([\s\S]*?)(?=^\[)/m)?.[1] ?? '';
  return Object.fromEntries([...section.matchAll(/^\s*([A-Z_]+)\s*=\s*"([^"]*)"\s*$/gm)].map(([, name, value]) => [name, value]));
}

export function variablesBlock(toml, random = (size) => randomBytes(size).toString('hex')) {
  const { PORT, ...fixed } = flyEnv(toml);
  const values = { ...fixed, ...VERCEL_OVERRIDES, ...Object.fromEntries(SECRETS.map((name) => [name, random(32)])) };
  return Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n');
}

function copyCommand(platform = process.platform) {
  if (platform === 'win32') return ['clip', []];
  if (platform === 'darwin') return ['pbcopy', []];
  return ['xclip', ['-selection', 'clipboard']];
}

export function copy(text, platform = process.platform) {
  const [command, args] = copyCommand(platform);
  return new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => fail(new Error('Não consegui usar a área de transferência deste computador.')));
    child.on('close', (code) => (code === 0 ? done() : fail(new Error('A área de transferência recusou o texto.'))));
    child.stdin.end(text);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const block = variablesBlock(readFileSync(resolve(ROOT, 'fly.toml'), 'utf8'));
    await copy(block);
    console.log(`Copiadas ${block.split('\n').length} variáveis, com os segredos gerados agora.`);
    console.log('No painel da Vercel, em Environment Variables, cole no campo do nome (Key).');
    console.log(`Depois, adicione você mesmo: ${MISSING.join(', ')}.`);
    console.log('Não cole esses valores no chat.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

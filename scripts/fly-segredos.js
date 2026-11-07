// Grava os segredos na Fly.io. Os valores são digitados no terminal: não aparecem na tela nem ficam no histórico de comandos.
//   npm run fly:segredos   banco (Supabase), e-mail (Resend) e quem pode criar conta
//   npm run fly:whatsapp   ativa o número na Meta e grava as chaves do WhatsApp e do áudio
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { loadConfig, PASSWORD_SLOT, smtpUrl } from '../src/config.js';
import { poolOptions } from '../src/database.js';

export { smtpUrl };

const ROOT = resolve(import.meta.dirname, '..');
// No Resend, o usuário do SMTP é sempre este, e a senha é a chave de API.
const RESEND_LOGIN = 'resend';

export const secretLines = (secrets) =>
  Object.entries(secrets).filter(([, value]) => value).map(([name, value]) => `${name}=${value}`).join('\n');

export function databaseProblem(url) {
  if (!/^postgres(ql)?:\/\//.test(url)) return 'A conexão começa com postgresql://. No Supabase, clique em Connect e copie a do Session pooler.';
  let host;
  let port;
  try {
    ({ hostname: host, port } = new URL(url.replace(PASSWORD_SLOT, 'senha')));
  } catch {
    return 'Essa conexão está incompleta. Copie de novo, inteira, no Supabase.';
  }
  // A direta só funciona por IPv6, e o modo de transação não guarda o estado de que o app precisa.
  if (/^db\..+\.supabase\.co$/.test(host)) return 'Essa é a conexão direta. No Supabase, em Connect, copie a do Session pooler.';
  if (host.endsWith('.supabase.com') && port === '6543') return 'Essa é a do Transaction pooler. No Supabase, em Connect, copie a do Session pooler.';
  return null;
}

export function databaseError(err) {
  if (err.code === '28P01' || /password authentication failed/i.test(err.message)) {
    return 'A senha do banco não confere. No Supabase, em Database Settings, dá para criar uma nova.';
  }
  if (/tenant\/user .* not found/i.test(err.message)) return 'O Supabase não encontrou esse projeto. Copie a conexão de novo, em Connect.';
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code)) return 'Não consegui chegar ao banco. Confira a internet e a conexão copiada.';
  return `O banco recusou a conexão: ${err.message}`;
}

// Confere a conexão daqui mesmo, com o certificado que o app vai usar, antes de gravar qualquer coisa.
async function tryDatabase(url) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ ...poolOptions(url), connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return null;
  } catch (err) {
    return databaseError(err);
  } finally {
    await client.end().catch(() => {});
  }
}

async function askDatabase({ ask, print, checkDatabase }) {
  for (;;) {
    let url = await ask('Conexão do Session pooler do Supabase', { secret: true, check: databaseProblem });
    // O próprio comando põe a senha no lugar do marcador, já no formato que o endereço exige.
    if (PASSWORD_SLOT.test(url)) url = url.replace(PASSWORD_SLOT, encodeURIComponent(await ask('Senha do banco do Supabase', { secret: true })));
    print('Conferindo o banco...');
    const problem = await checkDatabase(url);
    if (!problem) {
      print('Banco conferido.');
      return url;
    }
    print(`${problem}\n`);
  }
}

const emailsProblem = (list) =>
  list.split(',').every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ? null : 'Confira os e-mails: separe por vírgula, sem outros caracteres.';
export const resendKeyProblem = (key) => (key.startsWith('re_') ? null : 'A chave do Resend começa com re_. Copie de novo no painel.');
const idProblem = (id) => (/^\d+$/.test(id) ? null : 'O ID tem só números.');
const pinProblem = (pin) => (/^\d{6}$/.test(pin) ? null : 'O PIN tem exatamente 6 números.');

export async function setupBase({ ask, fly, print = console.log, checkDatabase = tryDatabase }) {
  const existing = await fly(['secrets', 'list', '--json']);
  print('Cole cada valor e aperte Enter. Os campos secretos não aparecem na tela.\n');
  const secrets = {
    DATABASE_URL: await askDatabase({ ask, print, checkDatabase }),
    SMTP_URL: smtpUrl(RESEND_LOGIN, await ask('Chave de API do Resend', { secret: true, check: resendKeyProblem })),
    EMAILS_LIBERADOS: await ask('E-mails que podem criar conta, separados por vírgula', { check: emailsProblem }),
  };
  // Trocar estes dois encerra as sessões e desconecta o Google Agenda, então eles só nascem uma vez.
  for (const name of ['SESSAO_SEGREDO', 'CRIPTO_CHAVE']) {
    if (!existing.includes(name)) secrets[name] = randomBytes(32).toString('hex');
  }
  await fly(['secrets', 'import'], secretLines(secrets));
  print('\nSegredos gravados na Fly.io.');
}

export async function activateNumber({ graphBase, graphVersion, token, wabaId, phoneId, pin }, fetchImpl = fetch) {
  const call = async (step, path, body) => {
    const response = await fetchImpl(`${graphBase}/${graphVersion}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`A Meta recusou ${step}: ${data.error?.error_user_msg || data.error?.message || `erro ${response.status}`}`);
    return data;
  };
  await call('a assinatura dos avisos', `${wabaId}/subscribed_apps`, {});
  // A Meta só registra o número por aqui, e aceita 10 tentativas a cada 72 horas.
  await call('o registro do número', `${phoneId}/register`, { messaging_product: 'whatsapp', pin });
  return call('a consulta do número', `${phoneId}?fields=display_phone_number,verified_name,name_status`);
}

export async function setupWhatsApp({ ask, fly, whatsapp, appUrl, fetchImpl = fetch, print = console.log }) {
  await fly(['secrets', 'list', '--json']);
  print('Cole cada valor e aperte Enter. Os campos secretos não aparecem na tela.\n');
  const phoneId = await ask('ID do número de telefone', { check: idProblem });
  const wabaId = await ask('ID da conta do WhatsApp Business', { check: idProblem });
  const token = await ask('Token permanente', { secret: true });
  const appSecret = await ask('Chave secreta do app', { secret: true });
  const pin = await ask('PIN de 6 números. Crie um e guarde; se já criou, use o mesmo', { secret: true, check: pinProblem });
  const audioKey = await ask('Chave da Groq, para entender áudio (Enter para pular)', { secret: true, optional: true });

  const number = await activateNumber({ ...whatsapp, token, wabaId, phoneId, pin }, fetchImpl);
  print(`\nNúmero ativado: ${number.display_phone_number} (${number.verified_name}). Situação do nome: ${number.name_status}.`);

  const verifyToken = randomBytes(16).toString('hex');
  await fly(['secrets', 'import'], secretLines({
    WHATSAPP_ACCESS_TOKEN: token,
    WHATSAPP_APP_SECRET: appSecret,
    WHATSAPP_PHONE_NUMBER_ID: phoneId,
    WHATSAPP_NUMERO_PUBLICO: String(number.display_phone_number).replace(/\D/g, ''),
    WHATSAPP_VERIFY_TOKEN: verifyToken,
    TRANSCRICAO_CHAVE: audioKey,
  }));
  print('\nChaves gravadas na Fly.io. Agora, na configuração de webhook da Meta, cole:');
  print(`  URL de retorno: ${appUrl}/webhook`);
  print(`  Token de verificação: ${verifyToken}`);
}

function flyBinary() {
  const installed = join(homedir(), '.fly', 'bin', 'flyctl.exe');
  return existsSync(installed) ? installed : 'fly';
}

function runFly(args, input) {
  return new Promise((done, fail) => {
    // Na pasta principal: a fila de espera tem um fly.toml próprio.
    const child = spawn(flyBinary(), args, { cwd: ROOT, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (input !== undefined) process.stdout.write(chunk);
    });
    child.on('error', () => fail(new Error('Não encontrei o programa da Fly.io. Instale pelo passo a passo do README.')));
    child.on('close', (code) => {
      if (code === 0) done(output);
      else fail(new Error('A Fly.io recusou o comando. Confira se você entrou com "fly auth login" e se o app já foi criado.'));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

export function openTerminal({ input = process.stdin, screen = process.stdout } = {}) {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) screen.write(chunk);
      done();
    },
  });
  const reader = createInterface({ input, output, terminal: Boolean(input.isTTY) });
  const lines = reader[Symbol.asyncIterator]();
  // A entrada pode acabar antes da primeira pergunta, enquanto a Fly.io ainda responde.
  let closed = false;
  reader.on('close', () => { closed = true; });
  const interrupted = () => new Error('\nA digitação foi interrompida. Nada foi gravado.');
  const ask = async (label, { secret = false, optional = false, check = () => null } = {}) => {
    for (;;) {
      if (closed) throw interrupted();
      // Pelo prompt do leitor, e não por fora: ao apagar um caractere, ele redesenha a linha com esse texto.
      reader.setPrompt(`${label}: `);
      reader.prompt();
      muted = secret;
      const { value, done } = await lines.next();
      muted = false;
      if (done) throw interrupted();
      const answer = value.trim();
      if (secret) screen.write(answer ? `(recebido, ${answer.length} caracteres)\n` : '(em branco)\n');
      if (!answer && optional) return '';
      const problem = answer ? check(answer) : 'Esse campo é obrigatório.';
      if (!problem) return answer;
      screen.write(`${problem}\n`);
    }
  };
  return { ask, close: () => reader.close() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const terminal = openTerminal();
  const appUrl = readFileSync(join(ROOT, 'fly.toml'), 'utf8').match(/^\s*APP_URL = "(.+)"/m)?.[1];
  const setup = process.argv[2] === 'whatsapp' ? setupWhatsApp : setupBase;
  try {
    await setup({ ask: terminal.ask, fly: runFly, whatsapp: loadConfig().whatsapp, appUrl });
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    terminal.close();
  }
}

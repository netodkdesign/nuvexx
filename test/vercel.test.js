import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import handler from '../api/index.js';
import { loadConfig, withDatabasePassword } from '../src/config.js';
import { createMailer } from '../src/email.js';
import { startupProblem } from '../src/runtime.js';
import { createApp } from '../src/server.js';
import { readFileSync } from 'node:fs';
import { flyEnv, MISSING, variablesBlock } from '../scripts/vercel-segredos.js';
import { createTestDb, fakeMailer, noGoogle, quiet, testConfig } from './helpers.js';

let db;

before(async () => {
  ({ db } = await createTestDb());
});
after(() => db.close());

async function withCron(config, run) {
  const ticks = [];
  const app = createApp({ config, db, google: noGoogle, mailer: fakeMailer(), log: quiet, tick: async () => { ticks.push(Date.now()); } });
  await new Promise((done) => app.listen(0, done));
  const call = (authorization) => fetch(`http://127.0.0.1:${app.address().port}/cron/minuto`, { headers: authorization ? { Authorization: authorization } : {} });
  try {
    await run(call, ticks);
  } finally {
    app.closeAllConnections();
    await new Promise((done) => app.close(done));
  }
}

test('a rotina de cada minuto só roda com o segredo da Vercel', async () => {
  await withCron(testConfig({ CRON_SECRET: 'segredo-do-cron' }), async (call, ticks) => {
    assert.equal((await call()).status, 404);
    assert.equal((await call('Bearer outro-segredo')).status, 404);
    assert.equal(ticks.length, 0);
    const right = await call('Bearer segredo-do-cron');
    assert.equal(right.status, 200);
    assert.equal(ticks.length, 1);
  });
});

test('sem CRON_SECRET, a rotina não existe por fora', async () => {
  await withCron(testConfig(), async (call, ticks) => {
    assert.equal((await call('Bearer ')).status, 404);
    assert.equal((await call('Bearer undefined')).status, 404);
    assert.equal(ticks.length, 0);
  });
});

test('no painel, a conexão entra como o Supabase mostra, e a senha vai à parte', () => {
  const url = 'postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
  assert.equal(withDatabasePassword(url, 'p@ss/1'), url.replace('[YOUR-PASSWORD]', 'p%40ss%2F1'));
  assert.equal(withDatabasePassword(url, ''), url);
  assert.equal(withDatabasePassword('postgresql://u:s3nha@host/db', 'outra'), 'postgresql://u:s3nha@host/db');
  assert.equal(loadConfig({ DATABASE_URL: url, DATABASE_SENHA: 'x' }).databaseUrl, url.replace('[YOUR-PASSWORD]', 'x'));
});

test('com o Resend, basta a chave; e o número de conexões é ajustável', () => {
  const config = loadConfig({ RESEND_CHAVE: 're_abc' });
  assert.equal(config.email.smtpUrl, 'smtps://resend:re_abc@smtp.resend.com:465');
  assert.equal(loadConfig({ RESEND_CHAVE: 're_abc', SMTP_URL: 'smtp://outro' }).email.smtpUrl, 'smtp://outro');
  assert.equal(config.databasePoolSize, 10);
  assert.equal(loadConfig({ BANCO_CONEXOES: '3' }).databasePoolSize, 3);
});

test('em produção, o app explica o que falta antes de subir', () => {
  const production = (extra) => {
    const config = loadConfig({
      SESSAO_SEGREDO: 's', CRIPTO_CHAVE: 'c', DATABASE_URL: 'postgresql://u:p@h/db', APP_URL: 'https://app.nuvexx.com.br',
      RESEND_CHAVE: 're_x', EMAIL_REMETENTE: 'Nuvexx <a@b.com>', CABECALHO_IP_CLIENTE: 'x-real-ip', ...extra,
    });
    return startupProblem(config, createMailer({ config }));
  };
  assert.equal(production({}), null);
  assert.match(production({ SESSAO_SEGREDO: '' }), /SESSAO_SEGREDO/);
  assert.match(production({ DATABASE_URL: '' }), /DATABASE_URL/);
  assert.match(production({ DATABASE_URL: 'postgresql://u:[YOUR-PASSWORD]@h/db' }), /DATABASE_SENHA/);
  assert.match(production({ RESEND_CHAVE: '' }), /RESEND_CHAVE/);
  assert.match(production({ CABECALHO_IP_CLIENTE: '' }), /CABECALHO_IP_CLIENTE/);
});

test('na Vercel, se faltar configuração, o visitante vê um aviso, e a próxima visita tenta de novo', async () => {
  const saved = { ...process.env };
  try {
    process.env.AMBIENTE = 'producao';
    process.env.SESSAO_SEGREDO = 's';
    process.env.CRIPTO_CHAVE = 'c';
    delete process.env.DATABASE_URL;
    const errors = [];
    const originalError = console.error;
    console.error = (line) => errors.push(line);
    const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = body; } };
    try {
      await handler({ url: '/', headers: {} }, response);
    } finally {
      console.error = originalError;
    }
    assert.equal(response.statusCode, 503);
    assert.match(response.body, /fora do ar/);
    assert.match(errors[0], /DATABASE_URL/);
  } finally {
    process.env = saved;
  }
});

test('as variáveis da Vercel saem do fly.toml, ajustadas, com segredos novos e prontas para colar', () => {
  const toml = readFileSync(new URL('../fly.toml', import.meta.url), 'utf8');
  assert.equal(flyEnv(toml).APP_URL, 'https://app.nuvexx.com.br');
  const values = Object.fromEntries(variablesBlock(toml).split('\n').map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assert.equal(values.AMBIENTE, 'producao');
  assert.equal(values.EMAIL_REMETENTE, 'Nuvexx <nao-responda@avisos.nuvexx.com.br>');
  assert.equal(values.CABECALHO_IP_CLIENTE, 'x-real-ip');
  assert.equal(values.BANCO_CONEXOES, '3');
  assert.equal(values.NODEJS_HELPERS, '0');
  assert.equal(values.PORT, undefined);
  for (const name of ['SESSAO_SEGREDO', 'CRIPTO_CHAVE', 'CRON_SECRET']) assert.match(values[name], /^[0-9a-f]{64}$/);
  assert.equal(new Set([values.SESSAO_SEGREDO, values.CRIPTO_CHAVE, values.CRON_SECRET]).size, 3);
  for (const name of MISSING) assert.equal(values[name], undefined);
});

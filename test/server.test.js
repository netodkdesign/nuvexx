import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, afterEach, test } from 'node:test';
import { ensureEnvFile, loadConfig } from '../src/config.js';
import { createSession, signToken, verifyPassword } from '../src/auth.js';
import { todayIn } from '../src/dates.js';
import { createGoogle } from '../src/google.js';
import { canonicalPhone, formatPhone, isBrazilian, maskPhone, parseTypedPhone } from '../src/phone.js';
import { createApp } from '../src/server.js';
import { countWithoutPhone, extractMessages, sendTemplate, sendText } from '../src/whatsapp.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OTHER, OWNER, quiet, testConfig } from './helpers.js';

const APP_SECRET = 'segredo-do-app';
const VERIFY_TOKEN = 'token-de-verificacao';
const PASSWORD = 'uma-senha-bem-forte';
const EMAIL = 'ana@teste.com';

let db;
let reset;
let server;
let base;
let sent;
let mailer;
let cookie;
let messageCounter = 0;

const sign = (body) => `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;

function incoming(text, from = OWNER, type = 'text', id = `wamid.${(messageCounter += 1)}`) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '123' },
          messages: [{ id, from, type, timestamp: String(Math.floor(Date.now() / 1000)), ...(type === 'text' ? { text: { body: text } } : {}) }],
        },
      }],
    }],
  };
}

async function waitFor(condition, ms = 3000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((done) => setTimeout(done, 10));
  }
  return false;
}

async function postWebhook(payload, signature, target = base) {
  const body = JSON.stringify(payload);
  const response = await fetch(`${target}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature ?? sign(body) },
    body,
  });
  // O app responde antes de processar.
  await new Promise((done) => setTimeout(done, 60));
  return response;
}

const api = (path, { method = 'GET', body, headers = {}, session = cookie, target = base } = {}) =>
  fetch(`${target}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Cookie: session } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

const whatsapp = async (text, from = OWNER) => {
  const before = sent.length;
  await postWebhook(incoming(text, from));
  return sent.slice(before).map((message) => message.body).join('\n');
};

const post = (path, body, options = {}) => api(path, { method: 'POST', body, session: null, ...options });
const sessionOf = (response) => response.headers.getSetCookie().find((item) => item.startsWith('nuvexx_sessao=')).split(';')[0];
const tokenIn = (mail) => mail.text.match(/#\/(?:cadastro|nova-senha)\/(\S+)/)[1];
const lastMail = () => mailer.sent.at(-1);

async function createAccountViaSite(email = EMAIL, password = PASSWORD) {
  assert.equal((await post('/api/signup', { email })).status, 200);
  const response = await post('/api/signup/complete', { token: tokenIn(lastMail()), name: 'Ana', password, accepted: true });
  assert.equal(response.status, 201);
  return sessionOf(response);
}

async function linkWhatsApp(session, from = OWNER) {
  const { text } = await (await api('/api/whatsapp/link', { method: 'POST', session })).json();
  return whatsapp(text, from);
}

// Conta criada pelo site, com o WhatsApp conectado depois.
async function signUpAndLogin(from = OWNER) {
  const session = await createAccountViaSite(`${from}@teste.com`);
  assert.match(await linkWhatsApp(session, from), /agora está conectado/);
  return session;
}

async function startApp(config, extra = {}) {
  const app = createApp({
    config,
    db,
    google: noGoogle,
    mailer,
    log: quiet,
    sendText: async (_w, to, body) => {
      sent.push({ to, body });
    },
    ...extra,
  });
  await new Promise((done) => app.listen(0, done));
  return { app, url: `http://127.0.0.1:${app.address().port}` };
}

const stop = async (app) => {
  app.closeAllConnections();
  await new Promise((done) => app.close(done));
};

before(async () => {
  ({ db, reset } = await createTestDb());
});
after(() => db.close());

beforeEach(async () => {
  await reset();
  sent = [];
  mailer = fakeMailer();
  cookie = null;
  const started = await startApp(testConfig());
  server = started.app;
  base = started.url;
});

afterEach(() => stop(server));

// WhatsApp

test('quem entra pelo www vai para o endereço oficial, com o caminho junto', async () => {
  const askWithHost = (path, host, method = 'GET') => new Promise((done, fail) => {
    const { hostname, port } = new URL(base);
    const call = request({ hostname, port, path, method, headers: { Host: host } }, (response) => {
      response.resume();
      response.on('end', () => done({ status: response.statusCode, location: response.headers.location }));
    });
    call.on('error', fail);
    call.end();
  });
  assert.deepEqual(await askWithHost('/?a=1', 'www.app.test'), { status: 301, location: 'https://app.test/?a=1' });
  assert.deepEqual(await askWithHost('/termos', 'www.app.test', 'HEAD'), { status: 301, location: 'https://app.test/termos' });
  // Fica sempre no endereço configurado, mesmo com um caminho que imita outro site.
  assert.equal((await askWithHost('//outro.site/x', 'www.app.test')).location, 'https://app.test//outro.site/x');
  assert.equal((await askWithHost('/health', 'app.test')).status, 200);
  assert.equal((await askWithHost('/health', 'www.outro.site')).status, 200);
  // Uma mensagem enviada ao www não é redirecionada: ela seria perdida.
  assert.notEqual((await askWithHost('/webhook', 'www.app.test', 'POST')).status, 301);
});

test('webhook: verificação da Meta devolve o challenge só com o token certo', async () => {
  const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'abc123');
  const wrong = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=abc123`);
  assert.equal(wrong.status, 403);
});

test('webhook: assinatura errada ou ausente é recusada e nada é gravado', async () => {
  assert.equal((await postWebhook(incoming('oi'), 'sha256=00')).status, 401);
  const noSignature = await fetch(`${base}/webhook`, { method: 'POST', body: JSON.stringify(incoming('oi')) });
  assert.equal(noSignature.status, 401);
  assert.equal(await db.userByPhone(OWNER), null);
  assert.equal(sent.length, 0);
});

test('webhook: mensagem assinada recebe resposta no número de origem', async () => {
  await whatsapp('oi', '554799998888');
  assert.equal(sent[0].to, '554799998888');
  assert.match(sent[0].body, /ainda não está conectado/);
});

test('webhook: reenvio da mesma mensagem não duplica o gasto', async () => {
  await signUpAndLogin();
  const payload = incoming('mercado 50');
  await postWebhook(payload);
  await postWebhook(payload);
  const user = await db.userByPhone(OWNER);
  assert.equal((await db.forUser(user.id).allExpenses()).length, 1);
});

test('webhook: áudio recebe orientação; aviso de entrega é ignorado', async () => {
  await signUpAndLogin();
  const before = sent.length;
  await postWebhook(incoming('', OWNER, 'audio'));
  assert.match(sent[before].body, /só entendo mensagens de texto/);
  await postWebhook({ entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'x', status: 'delivered' }] } }] }] });
  assert.equal(sent.length, before + 1);
});

test('webhook: falha no envio não perde o gasto', async () => {
  await signUpAndLogin();
  const failing = await startApp(testConfig(), { sendText: async () => { throw new Error('token expirado'); } });
  await postWebhook(incoming('mercado 50'), undefined, failing.url);
  const user = await db.userByPhone(OWNER);
  assert.equal((await db.forUser(user.id).allExpenses()).length, 1);
  await stop(failing.app);
});

test('webhook: do aviso assinado até a resposta chegar na API da Meta, sem simulação no meio', async () => {
  const received = [];
  const fakeMeta = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ url: req.url, authorization: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"messages":[{"id":"wamid.resposta"}]}');
  });
  await new Promise((done) => fakeMeta.listen(0, done));
  const app = createApp({
    config: testConfig({ WHATSAPP_ACCESS_TOKEN: 'token-real', WHATSAPP_GRAPH_BASE: `http://127.0.0.1:${fakeMeta.address().port}` }),
    db,
    google: noGoogle,
    mailer,
    log: quiet,
  });
  await new Promise((done) => app.listen(0, done));
  try {
    await postWebhook(incoming('oi'), undefined, `http://127.0.0.1:${app.address().port}`);
    assert.ok(await waitFor(() => received.length === 1));
    assert.equal(received[0].url, '/v26.0/123/messages');
    assert.equal(received[0].authorization, 'Bearer token-real');
    assert.equal(received[0].body.to, OWNER);
    assert.match(received[0].body.text.body, /ainda não está conectado/);
  } finally {
    await stop(app);
    await stop(fakeMeta);
  }
});

test('mensagem sem o número do remetente fica de fora e é contada', () => {
  const withPhone = incoming('oi');
  assert.equal(extractMessages(withPhone, '123').length, 1);
  assert.equal(countWithoutPhone(withPhone, '123'), 0);

  const withoutPhone = incoming('oi');
  delete withoutPhone.entry[0].changes[0].value.messages[0].from;
  assert.deepEqual(extractMessages(withoutPhone, '123'), []);
  assert.equal(countWithoutPhone(withoutPhone, '123'), 1);
  assert.equal(countWithoutPhone(withoutPhone, 'outro-numero'), 0);
  assert.equal(countWithoutPhone({ entry: [{ changes: [{ field: 'messages', value: { statuses: [{}] } }] }] }, '123'), 0);
});

test('sendText e sendTemplate chamam a API da Meta no formato documentado', async () => {
  const calls = [];
  const fake = async (url, options) => {
    calls.push({ url, options });
    return { ok: true };
  };
  const config = loadConfig({ WHATSAPP_ACCESS_TOKEN: 'abc', WHATSAPP_PHONE_NUMBER_ID: '123' }).whatsapp;
  await sendText(config, OWNER, 'olá', fake);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v26.0/123/messages');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer abc');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: OWNER, type: 'text', text: { body: 'olá', preview_url: false },
  });

  await sendTemplate(config, OWNER, 'lembrete', ['Dentista', 'hoje'], fake);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    messaging_product: 'whatsapp',
    to: OWNER,
    type: 'template',
    template: {
      name: 'lembrete',
      language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Dentista' }, { type: 'text', text: 'hoje' }] }],
    },
  });

  await assert.rejects(
    sendText(config, OWNER, 'olá', async () => ({ ok: false, status: 401, text: async () => 'expirado' })),
    /A Meta recusou o envio \(401\): expirado/,
  );
});

test('números: formato canônico, digitação e privacidade', () => {
  assert.equal(canonicalPhone('+55 (47) 99999-8888'), '5547999998888');
  assert.equal(canonicalPhone('554799998888'), '5547999998888');
  assert.equal(canonicalPhone('554733334444'), '554733334444');
  assert.equal(canonicalPhone('14155550100'), '14155550100');
  assert.equal(parseTypedPhone('(47) 99999-8888'), '5547999998888');
  assert.equal(parseTypedPhone('47 9999-8888'), '5547999998888');
  assert.equal(isBrazilian('5547999998888'), true);
  assert.equal(isBrazilian('14155550100'), false);
  assert.equal(maskPhone('5547999998888'), '5547*****8888');
  assert.equal(formatPhone('5547999998888'), '(47) 99999-8888');
});

// Cadastro

test('cadastro: só existe conta depois de abrir o link do e-mail', async () => {
  const response = await post('/api/signup', { email: ' Ana@Teste.com ' });
  assert.equal(response.status, 200);
  assert.equal(await db.userByEmail(EMAIL), null);
  assert.equal(lastMail().to, EMAIL);
  assert.match(lastMail().text, /https:\/\/app\.test\/#\/cadastro\//);

  const token = tokenIn(lastMail());
  const invitation = await (await post('/api/signup/verify', { token })).json();
  assert.deepEqual(invitation, { email: EMAIL, name: '', google: false });

  const done = await post('/api/signup/complete', { token, name: 'Ana', password: PASSWORD, accepted: true });
  assert.equal(done.status, 201);
  const header = done.headers.get('set-cookie');
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.doesNotMatch(header, /Secure/);
  cookie = sessionOf(done);

  const me = await (await api('/api/me')).json();
  assert.equal(me.email, EMAIL);
  assert.equal(me.name, 'Ana');
  assert.equal(me.access, 'trial');
  assert.equal(me.has_password, true);
  assert.equal(me.whatsapp.phone, null);
  assert.ok((await (await api('/api/categories')).json()).length > 0);
  assert.equal((await db.userByEmail(EMAIL)).terms_version, '2026-11');
});

test('cadastro: a senha fica guardada só como hash', async () => {
  await createAccountViaSite();
  const { password_hash: stored } = await db.userByEmail(EMAIL);
  assert.match(stored, /^scrypt\$/);
  assert.ok(!stored.includes(PASSWORD));
  assert.equal(await verifyPassword(PASSWORD, stored), true);
  assert.equal(await verifyPassword('outra-senha', stored), false);
});

test('cadastro: e-mail que já tem conta recebe a mesma resposta e nada muda', async () => {
  await createAccountViaSite();
  const { password_hash: before } = await db.userByEmail(EMAIL);
  const fresh = await post('/api/signup', { email: 'novo@teste.com' });
  const existing = await post('/api/signup', { email: EMAIL });
  assert.equal(existing.status, fresh.status);
  assert.deepEqual(await existing.json(), await fresh.json());
  assert.match(lastMail().subject, /já tem uma conta/);
  assert.doesNotMatch(lastMail().text, /cadastro\//);
  assert.equal((await db.userByEmail(EMAIL)).password_hash, before);
});

test('cadastro: exige aceitar os termos, nome e uma senha razoável', async () => {
  await post('/api/signup', { email: EMAIL });
  const token = tokenIn(lastMail());
  const complete = (fields) => post('/api/signup/complete', { token, name: 'Ana', password: PASSWORD, accepted: true, ...fields });
  assert.equal((await complete({ accepted: false })).status, 400);
  assert.equal((await complete({ accepted: 'true' })).status, 400);
  assert.equal((await complete({ name: '  ' })).status, 400);
  assert.equal((await complete({ password: 'curta' })).status, 400);
  assert.equal((await complete({ password: '12345678' })).status, 400);
  assert.equal((await complete({ password: EMAIL })).status, 400);
  assert.equal((await complete({ password: 'x'.repeat(201) })).status, 400);
  assert.equal(await db.userByEmail(EMAIL), null);
  assert.equal((await complete({})).status, 201);
});

test('cadastro: link forjado, vencido ou repetido não cria conta', async () => {
  const config = testConfig();
  const body = { name: 'Ana', password: PASSWORD, accepted: true };
  assert.equal((await post('/api/signup/complete', { ...body, token: 'forjado.abc' })).status, 400);
  const expired = signToken(config, 'cadastro', { email: EMAIL }, -1000);
  assert.equal((await post('/api/signup/complete', { ...body, token: expired })).status, 400);
  assert.equal((await post('/api/signup/verify', { token: expired })).status, 400);
  // Um link de outro uso não serve para criar conta.
  const wrongPurpose = signToken(config, 'nova-senha', { email: EMAIL }, 60_000);
  assert.equal((await post('/api/signup/complete', { ...body, token: wrongPurpose })).status, 400);
  assert.equal(await db.userByEmail(EMAIL), null);

  await post('/api/signup', { email: EMAIL });
  const token = tokenIn(lastMail());
  assert.equal((await post('/api/signup/complete', { ...body, token })).status, 201);
  assert.equal((await post('/api/signup/complete', { ...body, token, password: 'outra-senha-forte' })).status, 409);
  assert.equal((await post('/api/login', { email: EMAIL, password: 'outra-senha-forte' })).status, 401);
});

test('cadastro fechado: só os e-mails liberados entram', async () => {
  const started = await startApp(testConfig({ CADASTRO_ABERTO: 'false', EMAILS_LIBERADOS: 'Liberado@Teste.com' }));
  const options = { target: started.url };
  assert.equal((await post('/api/signup', { email: EMAIL }, options)).status, 403);
  assert.equal(mailer.sent.length, 0);
  assert.equal((await post('/api/signup', { email: 'liberado@teste.com' }, options)).status, 200);
  assert.equal(mailer.sent.length, 1);
  await stop(started.app);
});

test('cadastro: e-mail inválido é recusado, e pedidos demais são bloqueados', async () => {
  assert.equal((await post('/api/signup', { email: 'sem-arroba' })).status, 400);
  for (let i = 0; i < 5; i += 1) assert.equal((await post('/api/signup', { email: EMAIL })).status, 200);
  assert.equal((await post('/api/signup', { email: EMAIL })).status, 429);
  assert.equal(mailer.sent.length, 5);
});

test('atrás do proxy, o limite por endereço separa os visitantes e não aceita endereço forjado', async () => {
  const started = await startApp(testConfig({ CABECALHO_IP_CLIENTE: 'Fly-Client-IP' }));
  const from = (ip, extra = {}) => ({ target: started.url, headers: { 'Fly-Client-IP': ip, ...extra } });
  for (let i = 0; i < 30; i += 1) {
    const email = `pessoa${i}@teste.com`;
    assert.equal((await post('/api/signup', { email }, from('200.0.0.1'))).status, 200);
  }
  const blocked = await post('/api/signup', { email: 'mais-uma@teste.com' }, from('200.0.0.1', { 'X-Forwarded-For': '9.9.9.9' }));
  assert.equal(blocked.status, 429);
  assert.equal((await post('/api/signup', { email: 'outra-pessoa@teste.com' }, from('200.0.0.2'))).status, 200);
  await stop(started.app);
});

// Entrar

test('login: e-mail e senha abrem a sessão no navegador, sem WhatsApp', async () => {
  await createAccountViaSite();
  const response = await post('/api/login', { email: 'ANA@teste.com', password: PASSWORD });
  assert.equal(response.status, 200);
  cookie = sessionOf(response);
  assert.equal((await (await api('/api/me')).json()).email, EMAIL);

  // Os dois assessores funcionam sem nada conectado.
  const chat = async (text) => (await (await api('/api/chat', { method: 'POST', body: { text } })).json()).reply;
  assert.match(await chat('mercado 50'), /^💰/);
  assert.match(await chat('dentista amanhã às 15h'), /^📅/);
  assert.equal((await (await api('/api/expenses')).json()).length, 1);
  assert.equal((await (await api('/api/appointments')).json()).length, 1);
  assert.equal(sent.length, 0);
});

test('login: atrás de HTTPS o cookie é marcado como seguro', async () => {
  await createAccountViaSite();
  const response = await post('/api/login', { email: EMAIL, password: PASSWORD }, { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.match(response.headers.get('set-cookie'), /Secure/);
});

test('login: e-mail sem conta e senha errada têm a mesma resposta', async () => {
  await createAccountViaSite();
  const unknown = await post('/api/login', { email: 'ninguem@teste.com', password: PASSWORD });
  const wrong = await post('/api/login', { email: EMAIL, password: 'senha-errada' });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await unknown.json(), await wrong.json());
});

test('login: muitas tentativas no mesmo e-mail são bloqueadas, até com a senha certa', async () => {
  await createAccountViaSite();
  for (let i = 0; i < 10; i += 1) await post('/api/login', { email: EMAIL, password: 'senha-errada' });
  assert.equal((await post('/api/login', { email: EMAIL, password: PASSWORD })).status, 429);
});

test('login: outro site não consegue entrar em uma conta', async () => {
  await createAccountViaSite();
  const response = await post('/api/login', { email: EMAIL, password: PASSWORD }, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(response.status, 403);
});

// Senha

test('esqueci a senha: o link troca a senha uma vez e encerra as outras sessões', async () => {
  const oldSession = await createAccountViaSite();
  const before = mailer.sent.length;

  const unknown = await post('/api/password/forgot', { email: 'ninguem@teste.com' });
  const known = await post('/api/password/forgot', { email: EMAIL });
  assert.equal(unknown.status, known.status);
  assert.deepEqual(await unknown.json(), await known.json());
  assert.equal(mailer.sent.length, before + 1);

  const token = tokenIn(lastMail());
  assert.equal((await post('/api/password/reset', { token, password: 'curta' })).status, 400);
  const response = await post('/api/password/reset', { token, password: 'senha-nova-e-forte' });
  assert.equal(response.status, 200);
  assert.match(lastMail().subject, /foi alterada/);

  assert.equal((await api('/api/me', { session: oldSession })).status, 401);
  assert.equal((await api('/api/me', { session: sessionOf(response) })).status, 200);
  assert.equal((await post('/api/login', { email: EMAIL, password: PASSWORD })).status, 401);
  assert.equal((await post('/api/login', { email: EMAIL, password: 'senha-nova-e-forte' })).status, 200);

  // O mesmo link não funciona de novo.
  assert.equal((await post('/api/password/reset', { token, password: 'mais-uma-senha-forte' })).status, 400);
});

test('esqueci a senha: link forjado ou vencido é recusado', async () => {
  await createAccountViaSite();
  const user = await db.userByEmail(EMAIL);
  const expired = signToken(testConfig(), 'nova-senha', { userId: user.id, v: user.session_version }, -1000);
  assert.equal((await post('/api/password/reset', { token: expired, password: 'senha-nova-e-forte' })).status, 400);
  assert.equal((await post('/api/password/reset', { token: 'forjado.abc', password: 'senha-nova-e-forte' })).status, 400);
});

test('trocar a senha exige a atual, mantém esta sessão e encerra as outras', async () => {
  cookie = await createAccountViaSite();
  const other = sessionOf(await post('/api/login', { email: EMAIL, password: PASSWORD }));

  const wrong = await api('/api/password', { method: 'POST', body: { current: 'errada', password: 'senha-nova-e-forte' } });
  assert.equal(wrong.status, 400);

  const response = await api('/api/password', { method: 'POST', body: { current: PASSWORD, password: 'senha-nova-e-forte' } });
  assert.equal(response.status, 200);
  assert.equal((await api('/api/me', { session: sessionOf(response) })).status, 200);
  assert.equal((await api('/api/me', { session: other })).status, 401);
  assert.match(lastMail().subject, /foi alterada/);
});

test('o nome e os lembretes por e-mail podem ser alterados', async () => {
  cookie = await createAccountViaSite();
  assert.equal((await api('/api/me', { method: 'PATCH', body: { name: '' } })).status, 400);
  assert.equal((await api('/api/me', { method: 'PATCH', body: { name: 'Ana Maria' } })).status, 200);
  assert.equal((await api('/api/me', { method: 'PATCH', body: { email_reminders: false } })).status, 200);
  const me = await (await api('/api/me')).json();
  assert.equal(me.name, 'Ana Maria');
  assert.equal(me.email_reminders, false);
});

// WhatsApp pela conta

test('WhatsApp: conectar e desconectar não muda o acesso pelo navegador', async () => {
  cookie = await createAccountViaSite();
  const link = await (await api('/api/whatsapp/link', { method: 'POST' })).json();
  assert.match(link.text, /^conectar [A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(link.url, null);

  assert.match(await whatsapp(link.text), /agora está conectado/);
  assert.equal((await (await api('/api/me')).json()).whatsapp.phone, '(47) 99999-8888');
  assert.match(lastMail().subject, /WhatsApp foi conectado/);
  assert.match(await whatsapp('mercado 50'), /^💰/);
  assert.equal((await (await api('/api/expenses')).json()).length, 1);

  assert.equal((await api('/api/whatsapp', { method: 'DELETE' })).status, 200);
  assert.equal((await (await api('/api/me')).json()).whatsapp.phone, null);
  assert.match(await whatsapp('mercado 60'), /ainda não está conectado/);

  // A conta e os dados continuam, e o navegador segue funcionando.
  assert.equal((await (await api('/api/expenses')).json()).length, 1);
  assert.equal((await post('/api/login', { email: EMAIL, password: PASSWORD })).status, 200);
});

test('WhatsApp: com o número do app configurado, devolve o link pronto', async () => {
  const started = await startApp(testConfig({ WHATSAPP_NUMERO_PUBLICO: '+55 47 99999-0000' }));
  cookie = await createAccountViaSite();
  const link = await (await api('/api/whatsapp/link', { method: 'POST', target: started.url })).json();
  assert.equal(link.url, `https://wa.me/5547999990000?text=${encodeURIComponent(link.text)}`);
  await stop(started.app);
});

test('WhatsApp: em produção sem o número do app, a opção fica indisponível', async () => {
  const config = loadConfig({ SESSAO_SEGREDO: 's', CRIPTO_CHAVE: 'k', CADASTRO_ABERTO: 'true' });
  const started = await startApp(config);
  const user = await createAccount(db, { email: EMAIL });
  const session = `nuvexx_sessao=${createSession(config, user)}`;
  const me = await (await api('/api/me', { session, target: started.url })).json();
  assert.equal(me.whatsapp.available, false);
  assert.equal((await api('/api/whatsapp/link', { method: 'POST', session, target: started.url })).status, 503);
  await stop(started.app);
});

test('dados exigem login, e sessão forjada é recusada', async () => {
  for (const path of ['/api/me', '/api/summary', '/api/expenses', '/api/categories', '/api/appointments', '/api/export.csv', '/api/account/export']) {
    assert.equal((await api(path)).status, 401, path);
  }
  assert.equal((await api('/api/chat', { method: 'POST', body: { text: 'mercado 50' } })).status, 401);
  assert.equal((await api('/api/whatsapp/link', { method: 'POST' })).status, 401);
  assert.equal((await api('/api/me', { session: 'nuvexx_sessao=1.1.9999999999999.forjado' })).status, 401);
});

test('sessão de quem apagou a conta deixa de valer', async () => {
  cookie = await signUpAndLogin();
  assert.equal((await api('/api/account', { method: 'DELETE' })).status, 200);
  assert.equal((await api('/api/me')).status, 401);
  assert.equal(await db.userByPhone(OWNER), null);
});

test('outro site não consegue alterar dados', async () => {
  cookie = await signUpAndLogin();
  const response = await api('/api/chat', { method: 'POST', body: { text: 'mercado 50' }, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(response.status, 403);
});

// Separação entre contas

test('uma pessoa não alcança os dados de outra pela API', async () => {
  const ownerSession = await signUpAndLogin(OWNER);
  const otherSession = await signUpAndLogin(OTHER);
  const today = todayIn('America/Sao_Paulo');

  await api('/api/chat', { method: 'POST', body: { text: 'mercado 50' }, session: ownerSession });
  await api('/api/chat', { method: 'POST', body: { text: 'dentista amanhã às 15h' }, session: ownerSession });
  const [expense] = await (await api('/api/expenses', { session: ownerSession })).json();
  const [appointment] = await (await api('/api/appointments', { session: ownerSession })).json();
  const ownerCategories = await (await api('/api/categories', { session: ownerSession })).json();

  const as = { session: otherSession };
  assert.deepEqual(await (await api('/api/expenses', as)).json(), []);
  assert.deepEqual(await (await api('/api/appointments', as)).json(), []);
  assert.equal((await (await api('/api/summary', as)).json()).total_cents, 0);

  const otherCategories = await (await api('/api/categories', as)).json();
  const body = { description: 'x', amount: '1', category_id: otherCategories[0].id, date: today };
  assert.equal((await api(`/api/expenses/${expense.id}`, { method: 'PUT', body, ...as })).status, 404);
  assert.equal((await api(`/api/expenses/${expense.id}`, { method: 'DELETE', ...as })).status, 404);
  assert.equal((await api(`/api/appointments/${appointment.id}`, { method: 'DELETE', ...as })).status, 404);
  assert.equal((await api(`/api/categories/${ownerCategories[0].id}`, { method: 'DELETE', ...as })).status, 404);

  // Não dá para lançar um gasto na categoria de outra pessoa.
  const foreign = await api('/api/expenses', { method: 'POST', body: { ...body, category_id: ownerCategories[0].id }, ...as });
  assert.equal(foreign.status, 400);

  // O que era da primeira pessoa continua lá.
  assert.equal((await (await api('/api/expenses', { session: ownerSession })).json()).length, 1);
  assert.equal((await (await api('/api/appointments', { session: ownerSession })).json()).length, 1);
});

// Finanças pelo app

test('criar, editar, aprender com a correção e apagar', async () => {
  cookie = await signUpAndLogin();
  const categories = await (await api('/api/categories')).json();
  const id = (name) => categories.find((c) => c.name === name).id;
  const today = todayIn('America/Sao_Paulo');

  const created = await api('/api/expenses', { method: 'POST', body: { description: 'Quiropraxia', amount: '200,50', category_id: id('Outros'), date: today } });
  assert.equal(created.status, 201);
  const row = await created.json();
  assert.equal(row.amount_cents, 20050);
  assert.equal(row.source, 'app');

  const edited = await api(`/api/expenses/${row.id}`, { method: 'PUT', body: { description: 'Quiropraxia', amount: '210', category_id: id('Saúde'), date: today } });
  assert.equal((await edited.json()).category_name, 'Saúde');

  const { reply } = await (await api('/api/chat', { method: 'POST', body: { text: 'quiropraxia 90' } })).json();
  assert.match(reply, /💊 Saúde/);

  assert.equal((await (await api('/api/expenses?q=QUIRO')).json()).length, 2);
  assert.equal((await api(`/api/expenses/${row.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await api(`/api/expenses/${row.id}`, { method: 'DELETE' })).status, 404);
});

test('valida o que recebe', async () => {
  cookie = await signUpAndLogin();
  const [{ id }] = await (await api('/api/categories')).json();
  const today = todayIn('America/Sao_Paulo');
  const post = (body) => api('/api/expenses', { method: 'POST', body });
  assert.equal((await post({ description: '', amount: '10', category_id: id, date: today })).status, 400);
  assert.equal((await post({ description: 'x', amount: '0', category_id: id, date: today })).status, 400);
  assert.equal((await post({ description: 'x', amount: 'abc', category_id: id, date: today })).status, 400);
  assert.equal((await post({ description: 'x', amount: '10', category_id: 9999, date: today })).status, 400);
  assert.equal((await post({ description: 'x', amount: '10', category_id: id, date: '2026-02-31' })).status, 400);
  assert.equal((await api('/api/summary?month=2026-13')).status, 400);

  const appointment = (body) => api('/api/appointments', { method: 'POST', body });
  assert.equal((await appointment({ title: '', date: today })).status, 400);
  assert.equal((await appointment({ title: 'x', date: '2026-02-31' })).status, 400);
  assert.equal((await appointment({ title: 'x', date: today, time: '25:00' })).status, 400);
  assert.equal((await appointment({ title: 'x', date: today, time: '10:00', end_time: '09:00' })).status, 400);
});

test('parcela apagada sozinha ou com a compra inteira', async () => {
  cookie = await signUpAndLogin();
  await api('/api/chat', { method: 'POST', body: { text: 'curso 300 em 3x' } });
  const user = await db.userByPhone(OWNER);
  const store = db.forUser(user.id);
  const [first, second] = await store.allExpenses();
  await api(`/api/expenses/${first.id}`, { method: 'DELETE' });
  assert.equal((await store.allExpenses()).length, 2);
  await api(`/api/expenses/${second.id}?group=1`, { method: 'DELETE' });
  assert.equal((await store.allExpenses()).length, 0);
});

test('categorias podem ser criadas, editadas e apagadas', async () => {
  cookie = await signUpAndLogin();
  const created = await (await api('/api/categories', { method: 'POST', body: { name: 'Bebê', emoji: '🍼', keywords: ['fralda', 'Pediatra'] } })).json();
  assert.deepEqual(created.keywords, ['fralda', 'pediatra']);
  assert.match((await (await api('/api/chat', { method: 'POST', body: { text: 'fralda 90' } })).json()).reply, /🍼 Bebê/);

  assert.equal((await api('/api/categories', { method: 'POST', body: { name: 'Bebê' } })).status, 409);
  assert.equal((await api(`/api/categories/${created.id}`, { method: 'DELETE' })).status, 200);

  const categories = await (await api('/api/categories')).json();
  const other = categories.find((c) => c.name === 'Outros');
  assert.equal((await api(`/api/categories/${other.id}`, { method: 'DELETE' })).status, 400);
  const [expense] = await (await api('/api/expenses')).json();
  assert.equal(expense.category_name, 'Outros');
});

test('resumo soma por categoria e traz seis meses', async () => {
  cookie = await signUpAndLogin();
  await api('/api/chat', { method: 'POST', body: { text: 'mercado 300' } });
  await api('/api/chat', { method: 'POST', body: { text: 'uber 100' } });
  const summary = await (await api('/api/summary')).json();
  assert.equal(summary.total_cents, 40000);
  assert.deepEqual(summary.categories.map((c) => [c.name, c.percent]), [['Mercado', 75], ['Transporte', 25]]);
  assert.equal(summary.history.length, 6);
  assert.equal(summary.history.at(-1).total_cents, 40000);
});

// Agenda pelo app

test('compromissos: criar, listar, editar e apagar', async () => {
  cookie = await signUpAndLogin();
  const created = await api('/api/appointments', { method: 'POST', body: { title: 'Dentista', date: '2099-01-10', time: '15:00' } });
  assert.equal(created.status, 201);
  const row = await created.json();
  assert.equal(row.end_time, '16:00');
  assert.equal(row.sync, 'not_connected');
  assert.equal(row.source, 'app');

  const list = await (await api('/api/appointments?from=2099-01-01&to=2099-02-01')).json();
  assert.equal(list.length, 1);

  const edited = await api(`/api/appointments/${row.id}`, { method: 'PUT', body: { title: 'Dentista Ana', date: '2099-01-11', time: '10:00', end_time: '10:30' } });
  const updated = await edited.json();
  assert.equal(updated.title, 'Dentista Ana');
  assert.equal(updated.end_time, '10:30');

  assert.equal((await api(`/api/appointments/${row.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await api(`/api/appointments/${row.id}`, { method: 'DELETE' })).status, 404);
});

// Teste grátis

test('teste vencido: consulta e exporta, mas não anota', async () => {
  cookie = await signUpAndLogin();
  await api('/api/chat', { method: 'POST', body: { text: 'mercado 50' } });
  const user = await db.userByPhone(OWNER);
  await db.setTrialEnd(user.id, new Date(Date.now() - 1000));

  const me = await (await api('/api/me')).json();
  assert.equal(me.access, 'expired');

  const [{ id: categoryId }] = await (await api('/api/categories')).json();
  const today = todayIn('America/Sao_Paulo');
  assert.equal((await api('/api/expenses', { method: 'POST', body: { description: 'x', amount: '1', category_id: categoryId, date: today } })).status, 402);
  assert.equal((await api('/api/appointments', { method: 'POST', body: { title: 'x', date: today } })).status, 402);
  assert.match((await (await api('/api/chat', { method: 'POST', body: { text: 'uber 20' } })).json()).reply, /teste grátis terminou/);

  assert.equal((await api('/api/expenses')).status, 200);
  assert.equal((await api('/api/export.csv')).status, 200);
  assert.equal((await api('/api/account/export')).status, 200);
});

// Conta e LGPD

test('a pessoa baixa todos os dados dela, e só os dela', async () => {
  cookie = await signUpAndLogin();
  const otherSession = await signUpAndLogin(OTHER);
  await api('/api/chat', { method: 'POST', body: { text: 'mercado 50' } });
  await api('/api/chat', { method: 'POST', body: { text: 'dentista amanhã às 15h' } });
  await api('/api/chat', { method: 'POST', body: { text: 'segredo de outra pessoa 99' }, session: otherSession });

  const response = await api('/api/account/export');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  const data = await response.json();
  assert.equal(data.conta.telefone, OWNER);
  assert.equal(data.conta.email, `${OWNER}@teste.com`);
  assert.equal(data.conta.nome, 'Ana');
  assert.equal(data.conta.termos, '2026-11');
  assert.doesNotMatch(JSON.stringify(data), /scrypt/);
  assert.equal(data.gastos.length, 1);
  assert.equal(data.compromissos.length, 1);
  assert.ok(data.categorias.length > 0);
  assert.doesNotMatch(JSON.stringify(data), /segredo de outra pessoa/);
});

test('apagar a conta remove tudo em definitivo', async () => {
  cookie = await signUpAndLogin();
  await api('/api/chat', { method: 'POST', body: { text: 'mercado 50' } });
  await api('/api/chat', { method: 'POST', body: { text: 'dentista amanhã às 15h' } });
  const user = await db.userByPhone(OWNER);
  await api('/api/account', { method: 'DELETE' });
  const store = db.forUser(user.id);
  assert.deepEqual(await store.allExpenses(), []);
  assert.deepEqual(await store.allAppointments(), []);
  assert.deepEqual(await store.categories(), []);
});

test('termos e privacidade trazem os dados da empresa e da versão', async () => {
  const started = await startApp(testConfig({ EMPRESA_NOME: 'Empresa <Teste>', EMPRESA_CNPJ: '00.000.000/0001-00', EMPRESA_EMAIL: 'contato@teste.com' }));
  for (const path of ['/termos', '/privacidade']) {
    const html = await (await fetch(`${started.url}${path}`)).text();
    assert.match(html, /Empresa &lt;Teste&gt;/);
    assert.match(html, /00\.000\.000\/0001-00/);
    assert.match(html, /contato@teste\.com/);
    assert.match(html, /2026-11/);
    assert.doesNotMatch(html, /\{\{/);
  }
  await stop(started.app);
});

// Google pelo app

test('link do Google: fora do prazo é recusado; válido mostra de quem é a conta', async () => {
  cookie = await signUpAndLogin();
  const config = testConfig({ GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'segredo' });
  const google = createGoogle({ config, db, log: quiet });
  const started = await startApp(config, { google });
  const user = await db.userByPhone(OWNER);

  const expired = signToken(config, 'google-inicio', { userId: user.id }, -1000);
  assert.equal((await fetch(`${started.url}/google/conectar?t=${expired}`)).status, 400);
  assert.equal((await fetch(`${started.url}/google/conectar?t=forjado.abc`)).status, 400);

  const { url } = await (await api('/api/google/link', { method: 'POST', target: started.url })).json();
  const page = await fetch(url.replace('https://app.test', started.url));
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, new RegExp(`${OWNER}@teste\\.com`));
  assert.match(html, /accounts\.google\.com/);

  await stop(started.app);
});

test('retorno do Google: estado forjado ou autorização negada não conectam', async () => {
  const config = testConfig({ GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'segredo' });
  const google = createGoogle({ config, db, log: quiet });
  const started = await startApp(config, { google });
  const user = await createAccount(db, { phone: OWNER });

  assert.equal((await fetch(`${started.url}/google/retorno?code=x&state=forjado.abc`)).status, 400);
  const state = signToken(config, 'google-estado', { userId: user.id }, 60_000);
  assert.equal((await fetch(`${started.url}/google/retorno?error=access_denied&state=${state}`)).status, 400);
  // Um link de início não serve como estado de retorno.
  const wrongPurpose = signToken(config, 'google-inicio', { userId: user.id }, 60_000);
  assert.equal((await fetch(`${started.url}/google/retorno?code=x&state=${wrongPurpose}`)).status, 400);
  assert.equal(await db.googleAccount(user.id), null);

  await stop(started.app);
});

// Entrar com o Google

const GOOGLE_SUB = 'google-123';
const googleConfig = () => testConfig({ GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'segredo' });

function idToken(claims) {
  const payload = {
    iss: 'https://accounts.google.com',
    aud: 'cliente',
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: GOOGLE_SUB,
    email: EMAIL,
    email_verified: true,
    name: 'Ana do Google',
    ...claims,
  };
  return `cabecalho.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.assinatura`;
}

async function startGoogleLogin(claims = {}) {
  const config = googleConfig();
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'acesso', id_token: idToken(claims) }) });
  return startApp(config, { google: createGoogle({ config, db, fetchImpl, log: quiet }) });
}

// Percorre o que o navegador faz: vai ao Google e volta com o estado e o cookie.
async function googleRoundTrip(url, { cookieOverride, code = 'codigo' } = {}) {
  const start = await fetch(`${url}/google/entrar`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get('location'));
  assert.equal(location.searchParams.get('scope'), 'openid email profile');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://app.test/google/retorno');
  const nonce = start.headers.getSetCookie()[0].split(';')[0];
  const params = new URLSearchParams({ state: location.searchParams.get('state') });
  if (code) params.set('code', code);
  return fetch(`${url}/google/retorno?${params}`, {
    redirect: 'manual',
    headers: cookieOverride === null ? {} : { Cookie: cookieOverride ?? nonce },
  });
}

test('Google: sem configuração, o botão não aparece e o endereço volta ao início', async () => {
  assert.equal((await (await fetch(`${base}/api/config`)).json()).google_login, false);
  const response = await fetch(`${base}/google/entrar`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/');
});

test('Google: conta nova só nasce depois de aceitar os termos, e não precisa de senha', async () => {
  const started = await startGoogleLogin();
  const options = { target: started.url };
  assert.equal((await (await fetch(`${started.url}/api/config`)).json()).google_login, true);

  const back = await googleRoundTrip(started.url);
  assert.equal(back.status, 302);
  const token = back.headers.get('location').match(/^\/#\/cadastro\/(.+)$/)[1];
  assert.equal(await db.userByEmail(EMAIL), null);
  assert.equal(back.headers.getSetCookie().some((item) => item.startsWith('nuvexx_sessao=')), false);

  const invitation = await (await post('/api/signup/verify', { token }, options)).json();
  assert.deepEqual(invitation, { email: EMAIL, name: 'Ana do Google', google: true });
  assert.equal((await post('/api/signup/complete', { token, name: 'Ana' }, options)).status, 400);

  const done = await post('/api/signup/complete', { token, name: 'Ana', accepted: true }, options);
  assert.equal(done.status, 201);
  const me = await (await api('/api/me', { session: sessionOf(done), target: started.url })).json();
  assert.equal(me.google_login, true);
  assert.equal(me.has_password, false);

  // Sem senha, não há como entrar por e-mail e senha.
  assert.equal((await post('/api/login', { email: EMAIL, password: '' }, options)).status, 401);

  // Da próxima vez, entra direto.
  const again = await googleRoundTrip(started.url);
  assert.equal(again.headers.get('location'), '/');
  const session = sessionOf(again);
  assert.equal((await (await api('/api/me', { session, target: started.url })).json()).email, EMAIL);

  // Sem senha, desligar o Google deixaria a pessoa sem como entrar.
  assert.equal((await api('/api/google/login', { method: 'DELETE', session, target: started.url })).status, 400);

  // O link de esqueci a senha cria a primeira senha.
  await post('/api/password/forgot', { email: EMAIL }, options);
  const reset = await post('/api/password/reset', { token: tokenIn(lastMail()), password: PASSWORD }, options);
  assert.equal(reset.status, 200);
  assert.equal((await post('/api/login', { email: EMAIL, password: PASSWORD }, options)).status, 200);
  assert.equal((await api('/api/google/login', { method: 'DELETE', session: sessionOf(reset), target: started.url })).status, 200);
  assert.equal((await db.userByEmail(EMAIL)).google_sub, null);
  await stop(started.app);
});

test('Google: mesmo e-mail de uma conta existente entra nela e avisa por e-mail', async () => {
  await createAccountViaSite();
  const started = await startGoogleLogin({ email: 'ANA@teste.com' });
  const back = await googleRoundTrip(started.url);
  assert.equal(back.headers.get('location'), '/');
  const me = await (await api('/api/me', { session: sessionOf(back), target: started.url })).json();
  assert.equal(me.email, EMAIL);
  assert.equal(me.google_login, true);
  assert.equal(me.has_password, true);
  assert.equal((await db.userByEmail(EMAIL)).google_sub, GOOGLE_SUB);
  assert.match(lastMail().subject, /também entra com o Google/);
  await stop(started.app);
});

test('Google: o retorno só vale no navegador que começou a entrada', async () => {
  await createAccountViaSite();
  const started = await startGoogleLogin();
  for (const cookieOverride of [null, 'nuvexx_google=de-outro-navegador']) {
    const back = await googleRoundTrip(started.url, { cookieOverride });
    assert.equal(back.status, 400);
    assert.deepEqual(back.headers.getSetCookie(), []);
  }
  assert.equal((await googleRoundTrip(started.url, { code: null })).status, 400);
  assert.equal((await db.userByEmail(EMAIL)).google_sub, null);
  await stop(started.app);
});

test('Google: identidade inválida ou e-mail não confirmado não entram', async () => {
  const invalid = [
    { email_verified: false },
    { aud: 'outro-app' },
    { iss: 'https://impostor.test' },
    { exp: Math.floor(Date.now() / 1000) - 10 },
  ];
  await createAccountViaSite();
  for (const claims of invalid) {
    const started = await startGoogleLogin(claims);
    const back = await googleRoundTrip(started.url);
    assert.equal(back.status, 502, JSON.stringify(claims));
    assert.deepEqual(back.headers.getSetCookie(), []);
    await stop(started.app);
  }
  assert.equal((await db.userByEmail(EMAIL)).google_sub, null);
});

test('Google: e-mail já ligado a outra conta Google é recusado', async () => {
  await createAccountViaSite();
  await db.setGoogleSub((await db.userByEmail(EMAIL)).id, 'outra-conta-google');
  const started = await startGoogleLogin();
  assert.equal((await googleRoundTrip(started.url)).status, 409);
  assert.equal((await db.userByEmail(EMAIL)).google_sub, 'outra-conta-google');
  await stop(started.app);
});

test('Google: cadastro fechado não aceita e-mail que não foi liberado', async () => {
  const config = testConfig({ GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'segredo', CADASTRO_ABERTO: 'false' });
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id_token: idToken() }) });
  const started = await startApp(config, { google: createGoogle({ config, db, fetchImpl, log: quiet }) });
  assert.equal((await googleRoundTrip(started.url)).status, 403);
  assert.equal(await db.userByEmail(EMAIL), null);
  await stop(started.app);
});

// Produção

test('em produção não existem os simuladores, e o HTTPS é exigido', async () => {
  const started = await startApp(loadConfig({ SESSAO_SEGREDO: 's', CRIPTO_CHAVE: 'k', CADASTRO_ABERTO: 'true' }));
  const response = await fetch(`${started.url}/api/dev/whatsapp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: OWNER, text: 'oi' }),
  });
  assert.equal(response.status, 401);
  assert.equal((await fetch(`${started.url}/api/dev/emails`)).status, 401);
  assert.equal(await db.userByPhone(OWNER), null);
  const config = await (await fetch(`${started.url}/api/config`)).json();
  assert.equal(config.is_dev, false);
  assert.match((await fetch(`${started.url}/`)).headers.get('strict-transport-security'), /max-age/);
  await stop(started.app);
});

test('sem configuração explícita, o app assume produção e cadastro fechado', () => {
  const config = loadConfig({});
  assert.equal(config.isProduction, true);
  assert.equal(config.registration.open, false);
});

test('em desenvolvimento, os simuladores percorrem o fluxo inteiro', async () => {
  await post('/api/signup', { email: EMAIL });
  const [mail] = await (await fetch(`${base}/api/dev/emails`)).json();
  assert.equal(mail.to, EMAIL);
  const done = await post('/api/signup/complete', { token: tokenIn(mail), name: 'Ana', password: PASSWORD, accepted: true });
  cookie = sessionOf(done);

  const { text } = await (await api('/api/whatsapp/link', { method: 'POST' })).json();
  const simulate = (message) => fetch(`${base}/api/dev/whatsapp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: '(47) 99999-8888', text: message }),
  }).then((r) => r.json());
  assert.match((await simulate(text)).reply, /agora está conectado/);
  assert.match((await simulate('mercado 50')).reply, /^💰/);
  assert.equal((await (await api('/api/expenses')).json()).length, 1);
});

test('primeira execução cria o .env com segredos aleatórios e não sobrescreve depois', () => {
  const folder = mkdtempSync(join(tmpdir(), 'nuvexx-'));
  const path = join(folder, '.env');
  try {
    assert.equal(ensureEnvFile(path), true);
    const first = readFileSync(path, 'utf8');
    assert.match(first, /^SESSAO_SEGREDO=\S{32,}$/m);
    assert.match(first, /^CRIPTO_CHAVE=\S{32,}$/m);
    assert.match(first, /^WHATSAPP_VERIFY_TOKEN=\S{16,}$/m);
    assert.match(first, /^WHATSAPP_APP_SECRET=$/m);
    assert.equal(ensureEnvFile(path), false);
    assert.equal(readFileSync(path, 'utf8'), first);
  } finally {
    rmSync(folder, { recursive: true });
  }
});

test('arquivos públicos têm proteção e rotas estranhas dão 404', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  for (const path of ['/.env', '/src/config.js', '/data/pg', '/package.json', '/node_modules/pg/package.json']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
});

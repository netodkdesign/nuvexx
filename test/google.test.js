import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAssistant } from '../src/assistant.js';
import { decryptSecret } from '../src/auth.js';
import { createGoogle, eventBody } from '../src/google.js';
import { createScheduler } from '../src/scheduler.js';
import { createAccount, createTestDb, OWNER, quiet, testConfig } from './helpers.js';

const NOW = new Date('2026-11-03T15:00:00Z');
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

let db;
let reset;
let config;
let google;
let assistant;
let calls;
let eventResponses;
let tokenResponse;

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

async function fakeFetch(url, options = {}) {
  calls.push({ url, method: options.method, headers: options.headers, body: options.body });
  if (url === TOKEN_URL) return tokenResponse;
  if (String(url).includes('/revoke')) return json(200, {});
  return eventResponses.shift() ?? json(200, { id: 'evento' });
}

const eventCalls = () => calls.filter((call) => String(call.url).startsWith(EVENTS_URL));
const say = (text, sentAt = NOW) => assistant.handleWhatsApp({ from: OWNER, text, sentAt });

const signUp = () => createAccount(db, { phone: OWNER, at: NOW });

before(async () => {
  ({ db, reset } = await createTestDb());
});
after(() => db.close());
beforeEach(async () => {
  await reset();
  calls = [];
  eventResponses = [];
  tokenResponse = json(200, { access_token: 'acesso', refresh_token: 'renovacao-secreta', expires_in: 3600 });
  config = testConfig({ GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'segredo' });
  google = createGoogle({ config, db, fetchImpl: fakeFetch, log: quiet });
  assistant = createAssistant({ db, config, google });
});

test('o endereço de autorização pede só a agenda e o acesso contínuo', () => {
  const url = new URL(google.authUrl('estado'));
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.events');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.test/google/retorno');
  assert.equal(url.searchParams.get('state'), 'estado');
});

test('o token do Google fica cifrado no banco', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  const { refresh_token: stored } = await db.googleAccount(user.id);
  assert.ok(!stored.includes('renovacao-secreta'));
  assert.equal(decryptSecret(config, stored), 'renovacao-secreta');
  // Outra chave não abre o token.
  assert.throws(() => decryptSecret({ encryptionKey: 'outra' }, stored));
});

test('sem conectar, o compromisso fica salvo e o app oferece a conexão', async () => {
  await signUp();
  const reply = await say('dentista quinta às 15h');
  assert.match(reply, /mande \*conectar google\*/);
  assert.equal(eventCalls().length, 0);
  assert.equal((await db.forUser(1).allAppointments()).length, 1);
});

test('conectado, todo compromisso criado vai para o Google na hora', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  calls = [];

  const reply = await say('dentista quinta às 15h');
  assert.match(reply, /Já está no seu Google Agenda/);

  const [call] = eventCalls();
  assert.equal(call.method, 'POST');
  assert.equal(call.headers.Authorization, 'Bearer acesso');
  const body = JSON.parse(call.body);
  assert.equal(body.summary, 'Dentista');
  assert.deepEqual(body.start, { dateTime: '2026-11-05T15:00:00', timeZone: 'America/Sao_Paulo' });
  assert.deepEqual(body.end, { dateTime: '2026-11-05T16:00:00', timeZone: 'America/Sao_Paulo' });
  assert.match(body.id, /^nuvexx\d+$/);

  const [row] = await db.forUser(user.id).allAppointments();
  assert.equal(row.sync_status, 'synced');
  assert.equal(row.google_event_id, body.id);
});

test('gastos não vão para o Google Agenda', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  calls = [];
  await say('mercado 50');
  assert.equal(eventCalls().length, 0);
});

test('compromisso do dia todo usa data, sem horário', () => {
  const body = eventBody({ title: 'Viagem', starts_on: '2026-11-05', start_time: null, end_time: null }, 'America/Sao_Paulo');
  assert.deepEqual(body.start, { date: '2026-11-05' });
  assert.deepEqual(body.end, { date: '2026-11-06' });
});

test('remarcar atualiza o mesmo evento, e cancelar apaga do Google', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  await say('dentista quinta às 15h');
  const [{ google_event_id: eventId }] = await db.forUser(user.id).allAppointments();
  calls = [];

  assert.match(await say('remarcar dentista para sexta às 10'), /Já está no seu Google Agenda/);
  assert.equal(eventCalls()[0].method, 'PATCH');
  assert.ok(eventCalls()[0].url.endsWith(`/${eventId}`));
  assert.equal(JSON.parse(eventCalls()[0].body).start.dateTime, '2026-11-06T10:00:00');

  calls = [];
  await say('cancelar dentista');
  assert.equal(eventCalls()[0].method, 'DELETE');
  assert.ok(eventCalls()[0].url.endsWith(`/${eventId}`));
});

test('se o Google falhar, o compromisso fica salvo e o envio é repetido depois', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  eventResponses = [json(500, {})];

  assert.match(await say('dentista quinta às 15h'), /Vou tentar de novo/);
  const store = db.forUser(user.id);
  let [row] = await store.allAppointments();
  assert.equal(row.sync_status, 'error');
  assert.equal(row.sync_attempts, 1);

  // Só tenta de novo depois da espera.
  calls = [];
  await google.processQueue(new Date(Date.now() - 1000));
  assert.equal(eventCalls().length, 0);

  await google.processQueue(new Date(Date.now() + 2 * 60 * 1000));
  [row] = await store.allAppointments();
  assert.equal(row.sync_status, 'synced');
});

test('reenvio de um evento que já chegou ao Google não duplica', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  calls = [];
  eventResponses = [json(409, {}), json(200, {})];
  await say('dentista quinta às 15h');
  assert.deepEqual(eventCalls().map((call) => call.method), ['POST', 'PATCH']);
  assert.equal((await db.forUser(user.id).allAppointments())[0].sync_status, 'synced');
});

test('evento apagado no Google volta como novo ao editar no app', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  await say('dentista quinta às 15h');
  calls = [];
  eventResponses = [json(404, {}), json(200, { id: 'novo-id' })];
  await say('remarcar dentista para sexta às 10');
  assert.deepEqual(eventCalls().map((call) => call.method), ['PATCH', 'POST']);
  assert.equal((await db.forUser(user.id).allAppointments())[0].google_event_id, 'novo-id');
});

test('ao conectar, os compromissos futuros já marcados são enviados', async () => {
  const user = await signUp();
  await say('dentista quinta às 15h');
  await say('reunião sexta às 10h');
  assert.equal(eventCalls().length, 0);

  await google.connect(user.id, 'codigo', NOW);
  await google.processQueue(new Date(Date.now() + 1000));
  assert.equal(eventCalls().length, 2);
  assert.ok((await db.forUser(user.id).allAppointments()).every((row) => row.sync_status === 'synced'));
});

test('acesso revogado no Google desfaz a conexão, sem perder o compromisso', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  google = createGoogle({ config, db, fetchImpl: fakeFetch, log: quiet });
  assistant = createAssistant({ db, config, google });
  tokenResponse = json(400, { error: 'invalid_grant' });

  assert.match(await say('dentista quinta às 15h'), /mande \*conectar google\*/);
  assert.equal(await db.googleAccount(user.id), null);
  assert.equal((await db.forUser(user.id).allAppointments()).length, 1);
});

test('desconectar revoga o acesso e mantém os compromissos', async () => {
  const user = await signUp();
  await google.connect(user.id, 'codigo', NOW);
  await say('dentista quinta às 15h');
  calls = [];
  await google.disconnect(user.id);
  assert.equal(await db.googleAccount(user.id), null);
  assert.ok(calls.some((call) => String(call.url).includes('/revoke')));
  assert.equal((await db.forUser(user.id).allAppointments()).length, 1);
});

test('conectar google pelo WhatsApp devolve um link assinado', async () => {
  await signUp();
  assert.match(await say('conectar google'), /https:\/\/app\.test\/google\/conectar\?t=\S+/);
});

// Lembretes

function schedulerWith(sent, extra = {}) {
  const cfg = testConfig({ GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'segredo', ...extra });
  return createScheduler({
    db,
    google,
    config: cfg,
    log: quiet,
    mailer: { send: async (message) => sent.push({ kind: 'email', ...message }) },
    sendText: async (_w, to, body) => sent.push({ kind: 'text', to, body }),
    sendTemplate: async (_w, to, name, parameters) => sent.push({ kind: 'template', to, name, parameters }),
  });
}

const REMINDER_TIME = new Date('2026-11-05T17:00:00Z');

test('dentro da janela de 24 horas, o lembrete vai como texto, uma vez só', async () => {
  const user = await signUp();
  await say('dentista quinta às 15h');
  await db.touchUser(user.id, OWNER, new Date(REMINDER_TIME.getTime() - 60 * 60 * 1000));
  const sent = [];
  const scheduler = schedulerWith(sent);

  await scheduler.tick(new Date(REMINDER_TIME.getTime() - 60 * 1000));
  assert.equal(sent.length, 0);

  await scheduler.tick(REMINDER_TIME);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'text');
  assert.match(sent[0].body, /Cris, Assessora de Agenda/);
  assert.match(sent[0].body, /Lembrete: \*Dentista\*, hoje, às 15:00/);

  await scheduler.tick(new Date(REMINDER_TIME.getTime() + 60 * 1000));
  assert.equal(sent.length, 1);
});

test('fora da janela, o lembrete usa o modelo aprovado', async () => {
  await signUp();
  await say('dentista quinta às 15h');
  const sent = [];
  await schedulerWith(sent, { WHATSAPP_MODELO_LEMBRETE: 'lembrete_compromisso' }).tick(REMINDER_TIME);
  assert.equal(sent[0].kind, 'template');
  assert.equal(sent[0].name, 'lembrete_compromisso');
  assert.deepEqual(sent[0].parameters, ['Dentista', 'hoje, às 15:00']);
});

test('fora da janela e sem modelo, o lembrete vai por e-mail, não para a Meta', async () => {
  const user = await signUp();
  await say('dentista quinta às 15h');
  const sent = [];
  await schedulerWith(sent).tick(REMINDER_TIME);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'email');
  assert.equal(sent[0].to, user.email);
  assert.match(sent[0].subject, /Lembrete: Dentista/);
  assert.match(sent[0].text, /Dentista, hoje, às 15:00/);
});

test('sem WhatsApp, o lembrete vai por e-mail', async () => {
  const user = await createAccount(db, { email: 'sem-whats@teste.com', at: NOW });
  await assistant.handlePanel({ user, text: 'dentista quinta às 15h', now: NOW });
  const sent = [];
  await schedulerWith(sent, { WHATSAPP_MODELO_LEMBRETE: 'lembrete_compromisso' }).tick(REMINDER_TIME);
  assert.deepEqual(sent.map((message) => [message.kind, message.to]), [['email', 'sem-whats@teste.com']]);
});

test('quem desligou os lembretes por e-mail não recebe', async () => {
  const user = await createAccount(db, { email: 'sem-whats@teste.com', at: NOW });
  await assistant.handlePanel({ user, text: 'dentista quinta às 15h', now: NOW });
  await db.updateProfile(user.id, { emailReminders: false });
  const sent = [];
  await schedulerWith(sent).tick(REMINDER_TIME);
  assert.equal(sent.length, 0);
});

test('se o WhatsApp falhar, o lembrete ainda chega por e-mail', async () => {
  const user = await signUp();
  await say('dentista quinta às 15h');
  await db.touchUser(user.id, OWNER, REMINDER_TIME);
  const mails = [];
  const scheduler = createScheduler({
    db,
    google,
    config,
    log: quiet,
    mailer: { send: async (message) => mails.push(message) },
    sendText: async () => { throw new Error('token expirado'); },
    sendTemplate: async () => {},
  });
  await scheduler.tick(REMINDER_TIME);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, user.email);
});

test('quem está com o acesso vencido não recebe lembrete', async () => {
  const user = await signUp();
  await say('dentista quinta às 15h');
  await db.setTrialEnd(user.id, new Date(REMINDER_TIME.getTime() - 1000));
  await db.touchUser(user.id, OWNER, REMINDER_TIME);
  const sent = [];
  await schedulerWith(sent).tick(REMINDER_TIME);
  assert.equal(sent.length, 0);
});

test('lembrete muito atrasado é descartado, e falha no envio não repete', async () => {
  const user = await signUp();
  await say('dentista quinta às 15h');
  await say('exame sexta às 15h');
  const late = new Date('2026-11-06T17:00:00Z');
  await db.touchUser(user.id, OWNER, late);

  const sent = [];
  await schedulerWith(sent).tick(late);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /Exame/);

  await say('treino sábado às 15h', late);
  const failing = createScheduler({
    db,
    google,
    config,
    log: quiet,
    mailer: { send: async () => { throw new Error('falhou também'); } },
    sendText: async () => { throw new Error('falhou'); },
    sendTemplate: async () => {},
  });
  const reminderAt = new Date('2026-11-07T17:00:00Z');
  await db.touchUser(user.id, OWNER, reminderAt);
  await failing.tick(reminderAt);
  assert.equal((await db.dueReminders(reminderAt)).length, 0);
});

test('a limpeza diária remove códigos vencidos e dados antigos, nunca a conta', async () => {
  const user = await signUp();
  await db.markProcessed('wamid.antigo');
  await db.saveWhatsappCode(user.id, 'hash-antigo', new Date('2026-09-01T15:00:00Z'));
  const later = new Date('2030-01-01T00:00:00Z');
  await db.cleanup(later);
  assert.ok(await db.userById(user.id));
  assert.equal(await db.markProcessed('wamid.antigo'), true);
  // Se o código ainda existisse, a nova gravação só o atualizaria; aqui ele precisa ter sumido.
  assert.equal(await db.useWhatsappCode('hash-antigo', new Date('2026-08-01T00:00:00Z')), null);
});

import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { parseAgenda } from '../src/agenda-parser.js';
import { createAssistant } from '../src/assistant.js';
import { createSession } from '../src/auth.js';
import { todayIn } from '../src/dates.js';
import { buildDayPlan, formatDuration } from '../src/day-plan.js';
import { createScheduler } from '../src/scheduler.js';
import { createApp } from '../src/server.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OWNER, quiet, testConfig } from './helpers.js';

const DAY = '2026-11-05';
// 5h30 em São Paulo são 8h30 em UTC.
const BRIEFING_AT = new Date('2026-11-05T08:30:00Z');

const appointment = (title, start, end) => ({ title, start_time: start, end_time: end });
const plan = (appointments, tasks = []) => buildDayPlan({ date: DAY, appointments, tasks });

let db;
let reset;
let config;
let mailer;

before(async () => {
  ({ db, reset } = await createTestDb());
});
after(() => db.close());
beforeEach(async () => {
  await reset();
  config = testConfig();
  mailer = fakeMailer();
});

function schedulerWith(sent, extra = {}) {
  const cfg = testConfig(extra);
  return createScheduler({
    db,
    google: noGoogle,
    config: cfg,
    log: quiet,
    mailer: { send: async (message) => sent.push({ kind: 'email', ...message }) },
    sendText: async (_w, to, body) => sent.push({ kind: 'text', to, body }),
    sendTemplate: async (_w, to, name, parameters) => sent.push({ kind: 'template', to, name, parameters }),
  });
}

const addDayAppointments = (store) => Promise.all([
  store.addAppointment({ title: 'Reunião do time', date: DAY, startTime: '09:00', endTime: '10:00', startsAt: new Date('2026-11-05T12:00:00Z'), remindAt: null, source: 'app' }),
  store.addAppointment({ title: 'Dentista', date: DAY, startTime: '15:00', endTime: '16:00', startsAt: new Date('2026-11-05T18:00:00Z'), remindAt: null, source: 'app' }),
]);

// Cálculo do dia

test('duração em texto', () => {
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(120), '2h');
  assert.equal(formatDuration(195), '3h15');
  assert.equal(formatDuration(65), '1h05');
});

test('dia cheio: começo, fim, tempo ocupado e o maior intervalo', () => {
  const result = plan([
    appointment('Alinhamento com sócios', '17:00', '17:45'),
    appointment('Reunião do time', '09:00', '10:00'),
    appointment('Dentista', '15:00', '16:00'),
    appointment('Call com investidor', '11:00', '11:45'),
  ]);
  assert.deepEqual(result.timed.map((row) => row.start_time), ['09:00', '11:00', '15:00', '17:00']);
  assert.equal(result.stats.count, 4);
  assert.equal(result.stats.start, '09:00');
  assert.equal(result.stats.end, '17:45');
  assert.equal(result.stats.busy_label, '3h30');
  assert.deepEqual(result.stats.free, { minutes: 195, label: '3h15', after: 'Call com investidor', before: 'Dentista' });
  assert.equal(
    result.message,
    'Seu dia vai das *09:00* às *17:45*, com *4 compromissos*. Você tem *3h15 livres* entre Call com investidor e Dentista.',
  );
  assert.equal(result.is_empty, false);
});

test('sobreposição não conta duas vezes e vira alerta', () => {
  const result = plan([appointment('A', '09:00', '11:00'), appointment('B', '10:00', '10:30'), appointment('C', '13:00', '14:00')]);
  assert.equal(result.stats.busy_minutes, 180);
  assert.equal(result.stats.end, '14:00');
  assert.deepEqual(result.stats.free, { minutes: 120, label: '2h', after: 'A', before: 'C' });
  assert.match(result.message, /Atenção: \*A\* e \*B\* ficam no mesmo horário/);
});

test('horários colados não inventam intervalo', () => {
  const result = plan([appointment('A', '09:00', '10:00'), appointment('B', '10:10', '11:00')]);
  assert.equal(result.stats.free, null);
  assert.match(result.message, /bem seguidos/);
});

test('a contagem da mensagem inclui o dia todo, como o número grande da página', () => {
  const result = plan([appointment('A', '09:00', '10:00'), appointment('B', '11:00', '12:00'), appointment('Viagem', null, null)]);
  assert.equal(result.stats.count, 3);
  assert.match(result.message, /com \*3 compromissos\*/);
  assert.match(result.message, /O dia todo: \*Viagem\*/);
});

test('compromisso que passa da meia-noite ocupa até o fim do dia e mostra o horário real', () => {
  const result = plan([appointment('Jantar', '20:00', '21:00'), appointment('Show', '23:30', '00:30')]);
  assert.equal(result.stats.end, '00:30');
  assert.equal(result.stats.busy_minutes, 90);
  assert.deepEqual(result.stats.free, { minutes: 150, label: '2h30', after: 'Jantar', before: 'Show' });
  assert.match(result.message, /das \*20:00\* às \*00:30\*/);
});

test('o resumo só conta compromissos de hoje', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: BRIEFING_AT });
  const store = db.forUser(user.id);
  await store.addAppointment({ title: 'Ontem', date: '2026-11-04', startTime: '09:00', endTime: '10:00', startsAt: new Date('2026-11-04T12:00:00Z'), remindAt: null, source: 'app' });
  await store.addAppointment({ title: 'Amanhã', date: '2026-11-06', startTime: '09:00', endTime: '10:00', startsAt: new Date('2026-11-06T12:00:00Z'), remindAt: null, source: 'app' });
  const sent = [];
  await schedulerWith(sent).tick(BRIEFING_AT);
  assert.equal(sent.length, 0);
});

test('um só compromisso, dia todo, tarefas e dia vazio', () => {
  assert.equal(plan([appointment('Dentista', '15:00', '16:00')]).message, 'Hoje você tem *Dentista*, às *15:00*.');

  const allDay = plan([appointment('Viagem', null, null)]);
  assert.equal(allDay.message, 'O dia todo: *Viagem*.');
  assert.equal(allDay.stats.count, 1);
  assert.equal(allDay.stats.start, null);

  const tasks = [
    { title: 'Pagar luz', due_on: DAY },
    { title: 'Ligar banco', due_on: DAY },
    { title: 'Velha', due_on: '2026-11-01' },
    { title: 'Depois', due_on: '2026-11-20' },
    { title: 'Sem data', due_on: null },
  ];
  const onlyTasks = plan([], tasks);
  assert.equal(onlyTasks.message, 'Sua agenda está livre hoje. Também tem *2 tarefas* para hoje: Pagar luz e Ligar banco. E há *1 tarefa atrasada*.');
  assert.equal(onlyTasks.is_empty, false);

  const empty = plan([], [{ title: 'Depois', due_on: '2026-11-20' }]);
  assert.equal(empty.is_empty, true);
  assert.match(empty.message, /livre hoje/);
});

test('muitas tarefas: cita três e conta o resto', () => {
  const tasks = ['A', 'B', 'C', 'D', 'E'].map((title) => ({ title, due_on: DAY }));
  assert.match(plan([], tasks).message, /\*5 tarefas\* para hoje: A, B, C e mais 2\./);
});

// Conversa

test('conversa: como é meu dia responde com a Cris', async () => {
  const user = await createAccount(db, { phone: OWNER, at: BRIEFING_AT });
  await addDayAppointments(db.forUser(user.id));
  const assistant = createAssistant({ db, config, google: noGoogle, mailer });
  for (const text of ['como é meu dia', 'como vai ser meu dia?', 'meu dia']) {
    assert.deepEqual(parseAgenda(text, DAY), { type: 'agenda_brief' }, text);
    const reply = await assistant.handleWhatsApp({ from: OWNER, text, sentAt: BRIEFING_AT });
    assert.match(reply, /^📅 \*Cris, Assessora de Agenda\*\nSeu dia vai das \*09:00\* às \*16:00\*/);
  }
});

// Envio às 5h30

test('resumo: sai às 5h30, uma vez por dia, e não antes', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: BRIEFING_AT });
  await addDayAppointments(db.forUser(user.id));
  const sent = [];
  const scheduler = schedulerWith(sent);

  await scheduler.tick(new Date('2026-11-05T08:29:00Z'));
  assert.equal(sent.length, 0);

  await scheduler.tick(BRIEFING_AT);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'email');
  assert.equal(sent[0].to, 'ana@teste.com');
  assert.equal(sent[0].subject, 'Seu dia hoje');
  assert.match(sent[0].text, /Bom dia, Pessoa!/);
  assert.match(sent[0].text, /Seu dia vai das 09:00 às 16:00, com 2 compromissos\./);
  assert.doesNotMatch(sent[0].text, /\*/);

  await scheduler.tick(new Date('2026-11-05T08:31:00Z'));
  assert.equal(sent.length, 1);

  const saved = await db.userById(user.id);
  assert.equal(saved.briefing_on, DAY);
  assert.equal(saved.briefing_channel, 'email');

  // No dia seguinte sai de novo, se houver o que contar.
  await db.forUser(user.id).addAppointment({ title: 'Exame', date: '2026-11-06', startTime: '08:00', endTime: '09:00', startsAt: new Date('2026-11-06T11:00:00Z'), remindAt: null, source: 'app' });
  await scheduler.tick(new Date('2026-11-06T08:30:00Z'));
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /Exame/);
});

test('resumo: com WhatsApp recente vai como texto; fora da janela, pelo modelo; sem modelo, por e-mail', async () => {
  const user = await createAccount(db, { phone: OWNER, at: new Date('2026-11-05T01:00:00Z') });
  await addDayAppointments(db.forUser(user.id));

  const inside = [];
  await schedulerWith(inside).tick(BRIEFING_AT);
  assert.equal(inside[0].kind, 'text');
  assert.equal(inside[0].to, OWNER);
  assert.match(inside[0].body, /^📅 \*Cris, Assessora de Agenda\*\nBom dia, Pessoa!\nSeu dia vai das \*09:00\*/);
  assert.equal((await db.userById(user.id)).briefing_channel, 'whatsapp');

  await db.markBriefing(user.id, '2026-11-01', null);
  await db.touchUser(user.id, OWNER, new Date('2026-11-01T01:00:00Z'));
  const template = [];
  await schedulerWith(template, { WHATSAPP_MODELO_RESUMO: 'resumo_do_dia' }).tick(BRIEFING_AT);
  assert.equal(template[0].kind, 'template');
  assert.equal(template[0].name, 'resumo_do_dia');
  assert.equal(template[0].parameters.length, 1);
  assert.doesNotMatch(template[0].parameters[0], /[*\n]/);

  await db.markBriefing(user.id, '2026-11-01', null);
  const email = [];
  await schedulerWith(email).tick(BRIEFING_AT);
  assert.equal(email[0].kind, 'email');
});

test('resumo: dia vazio, desligado ou teste vencido não enviam', async () => {
  const empty = await createAccount(db, { email: 'vazio@teste.com', at: BRIEFING_AT });
  const off = await createAccount(db, { email: 'desligado@teste.com', at: BRIEFING_AT });
  const expired = await createAccount(db, { email: 'vencido@teste.com', at: BRIEFING_AT });
  await addDayAppointments(db.forUser(off.id));
  await addDayAppointments(db.forUser(expired.id));
  await db.updateProfile(off.id, { dailyBriefing: false });
  await db.setTrialEnd(expired.id, new Date('2026-11-01T00:00:00Z'));

  const sent = [];
  await schedulerWith(sent).tick(BRIEFING_AT);
  assert.equal(sent.length, 0);
  assert.equal((await db.userById(empty.id)).briefing_channel, null);
  assert.equal((await db.userById(empty.id)).briefing_on, DAY);
});

test('resumo: depois das 10h já não sai, e falha no envio não derruba os outros', async () => {
  const first = await createAccount(db, { email: 'primeira@teste.com', at: BRIEFING_AT });
  const second = await createAccount(db, { email: 'segunda@teste.com', at: BRIEFING_AT });
  await addDayAppointments(db.forUser(first.id));
  await addDayAppointments(db.forUser(second.id));

  const late = [];
  await schedulerWith(late).tick(new Date('2026-11-05T13:00:00Z'));
  assert.equal(late.length, 0);

  const sent = [];
  const scheduler = createScheduler({
    db,
    google: noGoogle,
    config,
    log: quiet,
    mailer: {
      send: async (message) => {
        if (message.to === 'primeira@teste.com') throw new Error('falhou');
        sent.push(message);
      },
    },
    sendText: async () => {},
    sendTemplate: async () => {},
  });
  await scheduler.tick(BRIEFING_AT);
  assert.deepEqual(sent.map((message) => message.to), ['segunda@teste.com']);
  // Marcado antes de enviar: quem falhou não recebe repetido.
  assert.equal((await db.userById(first.id)).briefing_on, DAY);
  assert.equal((await db.userById(first.id)).briefing_channel, null);
});

// Pela API

test('API: o dia de hoje, só da própria pessoa, e a opção de desligar', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com' });
  const other = await createAccount(db, { email: 'outra@teste.com' });
  const today = todayIn(config.timeZone);
  const app = createApp({ config, db, google: noGoogle, mailer, log: quiet, sendText: async () => {} });
  await new Promise((done) => app.listen(0, done));
  const base = `http://127.0.0.1:${app.address().port}`;
  const client = (who) => (path, { method = 'GET', body } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(who ? { Cookie: `nuvexx_sessao=${createSession(config, who)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    const api = client(user);
    assert.equal((await client(null)('/api/agenda/day')).status, 401);

    await api('/api/appointments', { method: 'POST', body: { title: 'Dentista', date: today, time: '15:00' } });
    await api('/api/tasks', { method: 'POST', body: { title: 'Pagar luz', date: today } });

    const day = await (await api('/api/agenda/day')).json();
    assert.equal(day.date, today);
    assert.equal(day.stats.count, 1);
    assert.equal(day.stats.start, '15:00');
    assert.equal(day.tasks_today[0].title, 'Pagar luz');
    assert.match(day.message, /Dentista/);
    assert.deepEqual(day.briefing, { enabled: true, channel: null });

    const theirs = await (await client(other)('/api/agenda/day')).json();
    assert.equal(theirs.stats.count, 0);
    assert.equal(theirs.is_empty, true);

    await db.markBriefing(user.id, today, 'email');
    assert.equal((await (await api('/api/agenda/day')).json()).briefing.channel, 'email');

    assert.equal((await (await api('/api/me')).json()).daily_briefing, true);
    await api('/api/me', { method: 'PATCH', body: { daily_briefing: false } });
    assert.equal((await (await api('/api/me')).json()).daily_briefing, false);
    assert.equal((await (await api('/api/agenda/day')).json()).briefing.enabled, false);
    assert.equal((await (await api('/api/account/export')).json()).conta.resumo_do_dia, false);
  } finally {
    app.closeAllConnections();
    await new Promise((done) => app.close(done));
  }
});

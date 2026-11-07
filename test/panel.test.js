import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAssistant } from '../src/assistant.js';
import { createSession } from '../src/auth.js';
import { addMonths, shiftMonth, todayIn } from '../src/dates.js';
import { extractAccount, parseMessage } from '../src/parser.js';
import { expensesToCsv, panelData } from '../src/reports.js';
import { createScheduler } from '../src/scheduler.js';
import { createApp } from '../src/server.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OWNER, quiet, testConfig } from './helpers.js';

const NOW = new Date('2026-11-03T15:00:00Z');
const TODAY = '2026-11-03';

let db;
let reset;
let config;
let mailer;
let assistant;

before(async () => {
  ({ db, reset } = await createTestDb());
});
after(() => db.close());
beforeEach(async () => {
  await reset();
  config = testConfig();
  mailer = fakeMailer();
  assistant = createAssistant({ db, config, google: noGoogle, mailer });
});

const say = (text, sentAt = NOW, from = OWNER) => assistant.handleWhatsApp({ from, text, sentAt });
const signUp = () => createAccount(db, { phone: OWNER, at: NOW });

async function withApp(run) {
  const app = createApp({ config, db, google: noGoogle, mailer, log: quiet, sendText: async () => {} });
  await new Promise((done) => app.listen(0, done));
  const base = `http://127.0.0.1:${app.address().port}`;
  const client = (user) => (path, { method = 'GET', body } = {}) => fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(user ? { Cookie: `nuvexx_sessao=${createSession(config, user)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    await run(client);
  } finally {
    app.closeAllConnections();
    await new Promise((done) => app.close(done));
  }
}

// Entradas pela conversa

test('entradas: entende o valor, a descrição e a data', () => {
  assert.deepEqual(parseMessage('recebi 3000 de salário', TODAY), { type: 'income', amountCents: 300000, description: 'Salário', date: TODAY });
  assert.equal(parseMessage('salário 3000', TODAY).description, 'Salário');
  assert.equal(parseMessage('caiu o salário 5000', TODAY).description, 'Salário');
  assert.equal(parseMessage('entrou 500 do freela ontem', TODAY).date, '2026-11-02');
  assert.equal(parseMessage('recebi 200', TODAY).description, 'Entrada');
  assert.deepEqual(parseMessage('recebi', TODAY), { type: 'income', amountCents: null });
  assert.equal(parseMessage('entradas', TODAY).type, 'income_summary');
  assert.equal(parseMessage('quanto recebi em outubro', TODAY).period.month, '2026-10');
});

test('entradas: anota, soma no saldo do mês e pode ser desfeita', async () => {
  const user = await signUp();
  await say('mercado 50');
  const reply = await say('recebi 3000 de salário');
  assert.match(reply, /^💰 \*Caio, Assessor Financeiro\*/);
  assert.match(reply, /\*R\$ 3\.000,00\* de entrada/);
  assert.match(reply, /Saldo do mês: R\$ 2\.950,00/);
  assert.match(await say('recebi'), /Quanto entrou/);

  assert.match(await say('resumo'), /Entradas: R\$ 3\.000,00\nSaldo: R\$ 2\.950,00/);
  assert.match(await say('entradas'), /Total: \*R\$ 3\.000,00\*/);

  await new Promise((done) => setTimeout(done, 5));
  assert.match(await say('desfazer'), /Apaguei a entrada: Salário/);
  assert.equal((await db.forUser(user.id).allIncomes()).length, 0);
  assert.equal((await db.forUser(user.id).allExpenses()).length, 1);
});

// Contas

test('contas: reconhece a conta citada, sem deixá-la na descrição', () => {
  const accounts = [{ id: 1, name: 'Nubank' }, { id: 2, name: 'Cartão Inter' }, { id: 3, name: 'Inter' }];
  assert.deepEqual(extractAccount('mercado 50 no nubank', accounts), { account: accounts[0], text: 'mercado 50' });
  assert.equal(extractAccount('uber 20 no cartão inter', accounts).account.id, 2);
  assert.equal(extractAccount('feira 30 pelo Inter', accounts).account.id, 3);
  assert.equal(extractAccount('internet 100', accounts), null);
});

test('contas: gasto e entrada citados mudam o saldo; cartão mostra a fatura do mês', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  const nubank = await store.createAccount({ name: 'Nubank', kind: 'conta', openingCents: 100000 });
  const cartao = await store.createAccount({ name: 'Inter', kind: 'cartao', openingCents: 0 });

  assert.match(await say('mercado 50 no nubank'), /🛒 Mercado \(Nubank\)/);
  const [expense] = await store.allExpenses();
  assert.equal(expense.description, 'Mercado');
  assert.equal(expense.account_id, nubank.id);
  assert.equal(expense.account_name, 'Nubank');

  assert.match(await say('recebi 500 no nubank'), /de entrada em Nubank/);
  await say('uber 20 no inter');
  await store.addExpense({ description: 'TV', amountCents: 30000, categoryId: (await store.otherCategory()).id, date: TODAY, source: 'app', installments: 3, accountId: cartao.id });

  const balances = await store.accountBalances(TODAY);
  assert.equal(balances.find((row) => row.name === 'Nubank').balance_cents, 100000 - 5000 + 50000);
  // Só a parcela deste mês pesa na fatura.
  assert.equal(balances.find((row) => row.name === 'Inter').balance_cents, -(2000 + 10000));
  // Citar a conta numa consulta não muda a consulta.
  assert.doesNotMatch(await say('quanto gastei no nubank'), /Anotei/);

  await store.deleteAccount(nubank.id);
  assert.equal((await store.allExpenses()).find((row) => row.description === 'Mercado').account_id, null);
});

// Assessora de Tarefas

test('tarefas: responde como Nina, avisa, conclui, adia e apaga', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);

  const reply = await say('tarefa pagar luz sexta');
  assert.match(reply, /^📝 \*Nina, Assessora de Tarefas\*/);
  assert.match(reply, /\*Pagar luz\*: sexta, 06\/11/);
  assert.match(reply, /Te aviso às 8h/);
  const [task] = await store.openTasks();
  assert.equal(task.due_on, '2026-11-06');
  // 8h em São Paulo são 11h em UTC.
  assert.equal(new Date(task.remind_at).toISOString(), '2026-11-06T11:00:00.000Z');

  assert.match(await say('preciso comprar leite'), /\*Comprar leite\*: sem data/);
  assert.match(await say('tarefas'), /Pagar luz \(sexta, 06\/11\)[\s\S]*Comprar leite \(sem data\)/);
  assert.match(await say('tarefas de hoje'), /Nenhuma tarefa pendente/);

  assert.match(await say('adiar tarefa luz para segunda'), /\*Pagar luz\* agora é para segunda, 09\/11/);
  assert.match(await say('concluí pagar luz'), /🎉 \*Pagar luz\* concluída\. Falta 1 tarefa/);
  assert.match(await say('concluí pagar luz'), /Não encontrei/);
  assert.match(await say('feito'), /Qual tarefa/);
  assert.match(await say('apagar tarefa leite'), /Apaguei a tarefa \*Comprar leite\*/);
  assert.equal(await store.openTaskCount(), 0);
  assert.equal((await store.doneTasks()).length, 1);
});

test('tarefas: com horário, avisa 2 horas antes; só com o dia, às 8h', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);

  const reply = await say('tarefa pagar luz sexta às 15h');
  assert.match(reply, /\*Pagar luz\*: sexta, 06\/11, às 15:00/);
  assert.match(reply, /Te aviso 2 horas antes/);
  const [timed] = await store.openTasks();
  assert.equal(timed.due_time, '15:00');
  // 13h em São Paulo são 16h em UTC.
  assert.equal(new Date(timed.remind_at).toISOString(), '2026-11-06T16:00:00.000Z');
  assert.match(await say('tarefas'), /Pagar luz \(sexta, 06\/11, às 15:00\)/);

  // Mudar só o dia mantém o horário, e o aviso acompanha.
  assert.match(await say('adiar tarefa luz para segunda'), /segunda, 09\/11, às 15:00/);
  let [moved] = await store.openTasks();
  assert.equal(new Date(moved.remind_at).toISOString(), '2026-11-09T16:00:00.000Z');
  // Mudar só o horário mantém o dia.
  assert.match(await say('mudar tarefa luz para as 18h'), /segunda, 09\/11, às 18:00/);
  [moved] = await store.openTasks();
  assert.equal(new Date(moved.remind_at).toISOString(), '2026-11-09T19:00:00.000Z');

  // NOW é 12h em São Paulo: 13h fica a menos de 2 horas, então não há aviso nem promessa dele.
  const soon = await say('tarefa ligar banco hoje às 13h');
  assert.doesNotMatch(soon, /Te aviso/);
  assert.equal((await store.openTasks()).find((row) => row.title === 'Ligar banco').remind_at, null);

  assert.match(await say('tarefa antiga hoje às 11h'), /já passou/);
  assert.match(await say('adiar tarefa luz para hoje às 11h'), /já passou/);
});

test('tarefas: o lembrete diz o horário, e tarefa da mesma hora de hoje vira atrasada depois', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  await say('tarefa pagar luz sexta às 15h');
  const sent = [];
  const scheduler = createScheduler({
    db,
    google: noGoogle,
    config,
    log: quiet,
    mailer: { send: async (message) => sent.push(message) },
    sendText: async () => {},
    sendTemplate: async () => {},
  });
  const reminderAt = new Date('2026-11-06T16:00:00Z');
  await scheduler.tick(new Date(reminderAt.getTime() - 60_000));
  assert.equal(sent.length, 0);
  await scheduler.tick(reminderAt);
  assert.match(sent[0].text, /Pagar luz, hoje, às 15:00/);

  await say('tarefa ligar hoje às 13h');
  const later = new Date('2026-11-03T19:00:00Z');
  assert.match(await say('tarefas de hoje', later), /Ligar \(atrasada desde 03\/11, às 13:00\)/);
  assert.ok(await store.openTaskCount());
});

test('tarefas: atraso aparece na lista, data passada é recusada, desfazer alcança', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  assert.match(await say('tarefa velha 01/01/2020'), /já passou/);
  await store.addTask({ title: 'Atrasada', date: '2026-11-01', remindAt: null, source: 'app' });
  assert.match(await say('tarefas de hoje'), /Atrasada \(atrasada desde 01\/11\)/);

  await new Promise((done) => setTimeout(done, 5));
  await say('tarefa nova');
  await new Promise((done) => setTimeout(done, 5));
  assert.match(await say('desfazer'), /^📝[\s\S]*Apaguei a tarefa \*Nova\*/);
});

test('tarefas: cada mensagem continua indo para o assessor certo', async () => {
  await signUp();
  assert.match(await say('me lembra de ligar para o João sexta às 15h'), /^📅/);
  assert.match(await say('me lembra de ligar para o João sexta'), /^📝/);
  assert.match(await say('gastei 50 no mercado'), /^💰/);
  assert.match(await say('o que tenho hoje'), /^📅/);
  assert.match(await say('o que tenho que fazer hoje'), /^📝/);
});

test('tarefas: lembrete sai às 8h do dia, uma vez, e não para tarefa concluída', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  await say('tarefa pagar luz sexta');
  await say('tarefa ligar banco sexta');
  await store.setTaskDone((await store.openTasks()).find((row) => row.title === 'Ligar banco').id, NOW);
  // O resumo do dia também sai nesse horário e tem os próprios testes.
  await db.updateProfile(user.id, { dailyBriefing: false });

  const sent = [];
  const scheduler = createScheduler({
    db,
    google: noGoogle,
    config,
    log: quiet,
    mailer: { send: async (message) => sent.push({ kind: 'email', ...message }) },
    sendText: async (_w, to, body) => sent.push({ kind: 'text', to, body }),
    sendTemplate: async () => {},
  });
  const reminderAt = new Date('2026-11-06T11:00:00Z');
  await scheduler.tick(new Date(reminderAt.getTime() - 60_000));
  assert.equal(sent.length, 0);
  await scheduler.tick(reminderAt);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'email');
  assert.match(sent[0].text, /Pagar luz, hoje/);
  await scheduler.tick(new Date(reminderAt.getTime() + 60_000));
  assert.equal(sent.length, 1);
});

// Dados do painel

test('painel: soma o fluxo de cada mês e o acumulado do período', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const other = (await store.otherCategory()).id;
  const income = (date, value) => store.addIncome({ description: 'Salário', amountCents: value, date, source: 'app' });
  const expense = (date, value) => store.addExpense({ description: 'Conta', amountCents: value, categoryId: other, date, source: 'app' });
  await income('2026-10-01', 100000);
  await expense('2026-10-05', 40000);
  await income('2026-11-01', 150000);
  await expense('2026-11-02', 200000);
  await expense('2026-11-20', 10000);
  // Fora do período.
  await income('2026-01-01', 999900);

  const data = await panelData(store, { from: '2026-09', to: '2026-11', today: '2026-12-15' });
  assert.deepEqual(data.period.months, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(data.flow, [
    { month: '2026-09', income_cents: 0, expense_cents: 0, income_pending_cents: 0, expense_pending_cents: 0, balance_cents: 0, cumulative_cents: 0 },
    { month: '2026-10', income_cents: 100000, expense_cents: 40000, income_pending_cents: 0, expense_pending_cents: 0, balance_cents: 60000, cumulative_cents: 60000 },
    { month: '2026-11', income_cents: 150000, expense_cents: 210000, income_pending_cents: 0, expense_pending_cents: 0, balance_cents: -60000, cumulative_cents: 0 },
  ]);
  assert.equal(data.summary.income.total_cents, 150000);
  assert.equal(data.summary.income.change_percent, 50);
  assert.equal(data.summary.expense.change_percent, 425);
  assert.equal(data.summary.balance.total_cents, -60000);
  assert.equal(data.summary.balance.change_percent, -200);
  assert.equal(data.period.same_period, false);
  assert.equal(data.top_expenses[0].amount_cents, 200000);
  assert.equal(data.categories[0].percent, 100);
});

test('painel: mês em andamento compara com o mesmo período do anterior; sem base, sem porcentagem', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const today = todayIn(config.timeZone);
  const month = today.slice(0, 7);
  await store.addIncome({ description: 'Salário', amountCents: 100000, date: today, source: 'app' });

  const first = await panelData(store, { from: shiftMonth(month, -5), to: month, today });
  assert.equal(first.period.same_period, true);
  assert.equal(first.summary.income.change_percent, null);

  await store.addIncome({ description: 'Antes', amountCents: 50000, date: addMonths(today, -1), source: 'app' });
  const second = await panelData(store, { from: shiftMonth(month, -5), to: month, today });
  assert.equal(second.summary.income.previous_cents, 50000);
  assert.equal(second.summary.income.change_percent, 100);
});

test('planilha traz entradas e saídas, com o tipo e a conta', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const account = await store.createAccount({ name: 'Nubank', kind: 'conta', openingCents: 0 });
  await store.addIncome({ description: 'Salário', amountCents: 100000, date: '2026-11-01', source: 'app', accountId: account.id });
  await store.addExpense({ description: 'Mercado', amountCents: 5000, categoryId: (await store.otherCategory()).id, date: '2026-11-02', source: 'app' });
  const csv = expensesToCsv(await store.allExpenses(), await store.allIncomes());
  assert.match(csv, /Tipo;Conta/);
  assert.match(csv, /2026-11-01;Salário;;1000,00;;app;Entrada;Nubank/);
  assert.match(csv, /2026-11-02;Mercado;Outros;50,00;;app;Saída;/);
  assert.ok(csv.indexOf('Mercado') < csv.indexOf('Salário'));
});

// Pela API

test('API: entradas, contas e lançamentos juntos, com filtros e validação', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const [{ id: categoryId }] = await db.forUser(user.id).categories();
  await withApp(async (client) => {
    const api = client(user);
    const account = await (await api('/api/accounts', { method: 'POST', body: { name: 'Nubank', opening: '-1.000,50' } })).json();
    assert.equal(account.opening_cents, -100050);
    assert.equal((await api('/api/accounts', { method: 'POST', body: { name: 'Nubank' } })).status, 409);
    assert.equal((await api('/api/accounts', { method: 'POST', body: { name: '' } })).status, 400);
    assert.equal((await api('/api/accounts', { method: 'POST', body: { name: 'X', opening: 'abc' } })).status, 400);

    const income = await (await api('/api/incomes', { method: 'POST', body: { description: 'Salário', amount: '3000', date: TODAY, account_id: account.id } })).json();
    assert.equal(income.account_name, 'Nubank');
    assert.equal((await api('/api/incomes', { method: 'POST', body: { description: 'x', amount: '0', date: TODAY } })).status, 400);
    assert.equal((await api('/api/incomes', { method: 'POST', body: { description: 'x', amount: '1', date: TODAY, account_id: 9999 } })).status, 400);
    await api('/api/expenses', { method: 'POST', body: { description: 'Mercado', amount: '50', date: TODAY, category_id: categoryId, account_id: account.id } });

    const entries = (query) => api(`/api/entries?month=2026-11${query}`).then((r) => r.json());
    assert.equal((await entries('')).length, 2);
    assert.deepEqual((await entries('&type=income')).map((row) => row.kind), ['income']);
    assert.deepEqual((await entries('&type=expense')).map((row) => row.kind), ['expense']);
    assert.deepEqual((await entries(`&category_id=${categoryId}`)).map((row) => row.kind), ['expense']);
    assert.equal((await entries(`&account_id=${account.id}`)).length, 2);
    assert.equal((await entries('&q=SALARIO')).length, 1);

    const updated = await (await api(`/api/incomes/${income.id}`, { method: 'PUT', body: { description: 'Bônus', amount: '100', date: TODAY } })).json();
    assert.equal(updated.description, 'Bônus');
    assert.equal(updated.account_id, null);
    assert.equal((await api(`/api/incomes/${income.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await api(`/api/incomes/${income.id}`, { method: 'DELETE' })).status, 404);

    const exported = await (await api('/api/account/export')).json();
    assert.equal(exported.contas.length, 1);
    assert.equal(exported.gastos[0].account_name, 'Nubank');
    assert.equal(exported.paineis.length, 3);
  });
});

test('API: tarefas por tela, e quem não assinou não anota', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  await withApp(async (client) => {
    const api = client(user);
    const created = await (await api('/api/tasks', { method: 'POST', body: { title: 'Pagar luz', date: '2099-01-10' } })).json();
    assert.ok(created.remind_at);
    assert.equal((await api('/api/tasks', { method: 'POST', body: { title: '' } })).status, 400);
    assert.equal((await api('/api/tasks', { method: 'POST', body: { title: 'x', date: 'ontem' } })).status, 400);

    const timed = await (await api('/api/tasks', { method: 'POST', body: { title: 'Com hora', date: '2099-01-10', time: '15:00' } })).json();
    assert.equal(timed.due_time, '15:00');
    assert.equal(new Date(timed.remind_at).toISOString(), '2099-01-10T16:00:00.000Z');
    assert.equal((await api('/api/tasks', { method: 'POST', body: { title: 'x', date: '2099-01-10', time: '25:00' } })).status, 400);
    assert.equal((await api('/api/tasks', { method: 'POST', body: { title: 'x', time: '15:00' } })).status, 400);
    const noTime = await (await api(`/api/tasks/${timed.id}`, { method: 'PUT', body: { title: 'Com hora', date: '2099-01-10', time: null } })).json();
    assert.equal(noTime.due_time, null);
    assert.equal(new Date(noTime.remind_at).toISOString(), '2099-01-10T11:00:00.000Z');
    await api(`/api/tasks/${timed.id}`, { method: 'DELETE' });

    const edited = await (await api(`/api/tasks/${created.id}`, { method: 'PUT', body: { title: 'Pagar a luz', date: null } })).json();
    assert.equal(edited.title, 'Pagar a luz');
    assert.equal(edited.remind_at, null);

    await api(`/api/tasks/${created.id}`, { method: 'PUT', body: { done: true } });
    assert.deepEqual(await (await api('/api/tasks')).json(), []);
    assert.equal((await (await api('/api/tasks?status=done')).json()).length, 1);
    await api(`/api/tasks/${created.id}`, { method: 'PUT', body: { done: false } });
    assert.equal((await (await api('/api/tasks')).json()).length, 1);

    await db.setTrialEnd(user.id, new Date(Date.now() - 1000));
    assert.equal((await api('/api/tasks', { method: 'POST', body: { title: 'x' } })).status, 402);
    assert.equal((await api('/api/incomes', { method: 'POST', body: { description: 'x', amount: '1', date: TODAY } })).status, 402);
    assert.equal((await api('/api/accounts', { method: 'POST', body: { name: 'x' } })).status, 402);
    assert.equal((await api('/api/tasks')).status, 200);
  });
});

test('API: painéis prontos, personalizados e validados', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  await withApp(async (client) => {
    const api = client(user);
    const { panels, catalog } = await (await api('/api/panels')).json();
    assert.deepEqual(panels.map((panel) => panel.name), ['Visão geral', 'Fluxo', 'Gastos']);
    assert.ok(catalog.some((item) => item.id === 'fluxo'));
    // Abrir de novo não duplica os modelos.
    assert.equal((await (await api('/api/panels')).json()).panels.length, 3);

    const created = await (await api('/api/panels', { method: 'POST', body: { name: 'Para Ana', widgets: ['saldo', 'fluxo', 'saldo'] } })).json();
    assert.deepEqual(created.widgets, ['saldo', 'fluxo']);
    assert.equal((await api('/api/panels', { method: 'POST', body: { name: 'Para Ana', widgets: ['saldo'] } })).status, 409);
    assert.equal((await api('/api/panels', { method: 'POST', body: { name: 'Outro', widgets: [] } })).status, 400);
    assert.equal((await api('/api/panels', { method: 'POST', body: { name: 'Outro', widgets: ['inventado'] } })).status, 400);
    assert.equal((await api('/api/panels', { method: 'POST', body: { name: '', widgets: ['saldo'] } })).status, 400);

    // Só a ordem muda: o nome continua.
    const reordered = await (await api(`/api/panels/${created.id}`, { method: 'PUT', body: { widgets: ['fluxo', 'saldo'] } })).json();
    assert.deepEqual(reordered.widgets, ['fluxo', 'saldo']);
    assert.equal(reordered.name, 'Para Ana');

    assert.equal((await api('/api/panel-data?from=2026-13&to=2026-11')).status, 400);
    assert.equal((await api('/api/panel-data?from=2026-12&to=2026-11')).status, 400);
    assert.equal((await api('/api/panel-data?from=2020-01&to=2026-11')).status, 400);
    assert.equal((await (await api('/api/panel-data?to=2026-11')).json()).flow.length, 6);

    assert.equal((await api(`/api/panels/${created.id}`, { method: 'DELETE' })).status, 200);
    for (const panel of panels.slice(1)) await api(`/api/panels/${panel.id}`, { method: 'DELETE' });
    assert.equal((await api(`/api/panels/${panels[0].id}`, { method: 'DELETE' })).status, 400);
  });
});

test('API: uma conta não alcança contas, entradas, tarefas nem painéis de outra', async () => {
  const owner = await createAccount(db, { email: 'dona@teste.com', at: NOW });
  const other = await createAccount(db, { email: 'outra@teste.com', at: NOW });
  await withApp(async (client) => {
    const mine = client(owner);
    const theirs = client(other);
    const account = await (await mine('/api/accounts', { method: 'POST', body: { name: 'Nubank' } })).json();
    const income = await (await mine('/api/incomes', { method: 'POST', body: { description: 'Salário', amount: '3000', date: TODAY } })).json();
    const task = await (await mine('/api/tasks', { method: 'POST', body: { title: 'Segredo' } })).json();
    const panel = await (await mine('/api/panels', { method: 'POST', body: { name: 'Meu', widgets: ['saldo'] } })).json();

    assert.deepEqual(await (await theirs('/api/accounts')).json(), []);
    assert.deepEqual(await (await theirs('/api/tasks')).json(), []);
    assert.deepEqual(await (await theirs('/api/entries?month=2026-11')).json(), []);
    assert.equal((await (await theirs('/api/panel-data?to=2026-11')).json()).summary.income.total_cents, 0);

    assert.equal((await theirs(`/api/accounts/${account.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await theirs(`/api/incomes/${income.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await theirs(`/api/tasks/${task.id}`, { method: 'PUT', body: { done: true } })).status, 404);
    assert.equal((await theirs(`/api/panels/${panel.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await theirs(`/api/panels/${panel.id}/share`, { method: 'POST' })).status, 404);
    // Não dá para lançar na conta de outra pessoa.
    assert.equal((await theirs('/api/incomes', { method: 'POST', body: { description: 'x', amount: '1', date: TODAY, account_id: account.id } })).status, 400);

    for (const path of ['/api/accounts', '/api/tasks', '/api/panels', '/api/panel-data', '/api/entries']) {
      assert.equal((await client(null)(path)).status, 401, path);
    }
  });
});

test('compartilhar: mostra só os blocos do painel, vence, é revogável e não altera nada', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  await withApp(async (client) => {
    const api = client(user);
    const visitor = client(null);
    const open = (token, query = '') => visitor(`/api/shared${query}`, { method: 'POST', body: { token } });

    await api('/api/incomes', { method: 'POST', body: { description: 'Salário secreto', amount: '3000', date: TODAY } });
    await api('/api/tasks', { method: 'POST', body: { title: 'Tarefa secreta' } });
    await api('/api/accounts', { method: 'POST', body: { name: 'Conta secreta' } });
    const panel = await (await api('/api/panels', { method: 'POST', body: { name: 'Para Ana', widgets: ['saldo', 'fluxo'] } })).json();

    assert.equal((await open('inventado')).status, 404);
    assert.equal((await visitor('/api/shared', { method: 'POST', body: {} })).status, 404);

    const { url, expires_at: expiresAt } = await (await api(`/api/panels/${panel.id}/share`, { method: 'POST' })).json();
    const token = url.split('/').pop();
    assert.match(url, /^https:\/\/app\.test\/#\/compartilhado\//);
    assert.ok(new Date(expiresAt) > new Date());

    const shown = await (await open(token, '?to=2026-11')).json();
    assert.equal(shown.panel.name, 'Para Ana');
    assert.equal(shown.panel.owner, 'Pessoa');
    assert.deepEqual(shown.panel.widgets, ['saldo', 'fluxo']);
    assert.equal(shown.data.summary.income.total_cents, 300000);
    for (const hidden of ['accounts', 'tasks', 'recent', 'top_expenses', 'appointments', 'categories', 'upcoming']) {
      assert.equal(shown.data[hidden], undefined, hidden);
    }
    const text = JSON.stringify(shown);
    assert.doesNotMatch(text, /secret/);
    assert.doesNotMatch(text, /ana@teste/);

    // O link não abre a conta.
    assert.equal((await visitor('/api/me')).status, 401);

    // O banco guarda só o hash, e o painel informa até quando o link vale.
    const listed = (await (await api('/api/panels')).json()).panels.find((item) => item.id === panel.id);
    assert.ok(listed.share.expires_at);
    assert.equal(listed.share.token_hash, undefined);

    // Um novo link derruba o anterior.
    const second = (await (await api(`/api/panels/${panel.id}/share`, { method: 'POST' })).json()).url.split('/').pop();
    assert.equal((await open(token)).status, 404);
    assert.equal((await open(second)).status, 200);

    await api(`/api/panels/${panel.id}/share`, { method: 'DELETE' });
    assert.equal((await open(second)).status, 404);

    // Link vencido.
    const third = (await (await api(`/api/panels/${panel.id}/share`, { method: 'POST' })).json()).url.split('/').pop();
    const { hashShareToken } = await import('../src/auth.js');
    await db.forUser(user.id).saveShare(panel.id, hashShareToken(third), new Date(Date.now() - 1000));
    assert.equal((await open(third)).status, 404);
  });
});

test('fotos dos assessores são públicas, e os arquivos internos continuam fechados', async () => {
  await withApp(async (client) => {
    const visitor = client(null);
    for (const name of ['caio', 'cris', 'nina']) {
      const response = await visitor(`/assessores/${name}.svg`);
      assert.equal(response.status, 200, name);
      assert.match(response.headers.get('content-type'), /svg/);
    }
    assert.equal((await visitor('/theme.js')).status, 200);
    const favicon = await visitor('/favicon.ico');
    assert.equal(favicon.status, 200);
    assert.equal(favicon.headers.get('content-type'), 'image/x-icon');
    for (const path of ['/marca/logo-fundo-claro.png', '/marca/logo-fundo-escuro.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/icon-180.png']) {
      assert.equal((await visitor(path)).status, 200, path);
    }
    assert.equal((await visitor('/assessores/../../.env')).status, 404);
  });
});

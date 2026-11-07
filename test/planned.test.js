import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAssistant } from '../src/assistant.js';
import { createSession } from '../src/auth.js';
import { addDays, addMonths, monthOf, shiftMonth, todayIn } from '../src/dates.js';
import { parsePlanned } from '../src/planned-parser.js';
import { createRecurrence, occurrenceDate } from '../src/recurrences.js';
import { panelData } from '../src/reports.js';
import { createScheduler } from '../src/scheduler.js';
import { createApp } from '../src/server.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OWNER, quiet, testConfig } from './helpers.js';

// 3 de novembro de 2026 é uma terça-feira.
const TODAY = '2026-11-03';
const NOW = new Date('2026-11-03T15:00:00Z');

let db;
let reset;
let config;
let assistant;

before(async () => {
  ({ db, reset } = await createTestDb());
});
after(() => db.close());
beforeEach(async () => {
  await reset();
  config = testConfig();
  assistant = createAssistant({ db, config, google: noGoogle, mailer: fakeMailer() });
});

const say = (text, sentAt = NOW) => assistant.handleWhatsApp({ from: OWNER, text, sentAt });
const signUp = () => createAccount(db, { phone: OWNER, at: NOW });

// Mensagens

const PLANNED = [
  ['aluguel 1800 todo dia 10', 'expense', 'Aluguel', 180000, '2026-11-10', 'monthly'],
  ['salário 5000 todo dia 5', 'income', 'Salário', 500000, '2026-11-05', 'monthly'],
  ['salário 5000 todo dia 1', 'income', 'Salário', 500000, '2026-12-01', 'monthly'],
  ['todo dia 31 internet 100', 'expense', 'Internet', 10000, '2026-12-31', 'monthly'],
  ['netflix 55,90 todo mês', 'expense', 'Netflix', 5590, TODAY, 'monthly'],
  ['academia 120 toda semana', 'expense', 'Academia', 12000, TODAY, 'weekly'],
  ['toda segunda 50 academia', 'expense', 'Academia', 5000, '2026-11-09', 'weekly'],
  ['seguro 1200 todo ano dia 15/03', 'expense', 'Seguro', 120000, '2027-03-15', 'yearly'],
  ['recebo 800 de aluguel todo mês', 'income', 'Aluguel', 80000, TODAY, 'monthly'],
  ['vou receber 2000 dia 20', 'income', 'Entrada', 200000, '2026-11-20', null],
  ['a receber 1500 do cliente dia 25', 'income', 'Cliente', 150000, '2026-11-25', null],
  ['vou pagar 300 de luz dia 15', 'expense', 'Luz', 30000, '2026-11-15', null],
  ['pagar aluguel 1800 sexta', 'expense', 'Aluguel', 180000, '2026-11-06', null],
];

for (const [text, kind, description, amountCents, date, frequency] of PLANNED) {
  test(`previsto: "${text}"`, () => {
    assert.deepEqual(parsePlanned(text, TODAY), { type: 'planned', kind, description, amountCents, date, frequency });
  });
}

test('previsto: sem valor, pede; com dia impossível, avisa', () => {
  assert.deepEqual(parsePlanned('aluguel todo mês', TODAY), { type: 'planned_need_amount', isIncome: false });
  assert.deepEqual(parsePlanned('salário todo dia 5', TODAY), { type: 'planned_need_amount', isIncome: true });
  assert.equal(parsePlanned('internet 100 todo dia 45', TODAY).type, 'planned_invalid_day');
});

test('previsto: consulta e parada', () => {
  for (const text of ['quanto ainda vai sair', 'quanto vai entrar?', 'o que falta pagar', 'falta receber', 'a pagar', 'a receber', 'previsão', 'contas do mês']) {
    assert.deepEqual(parsePlanned(text, TODAY), { type: 'planned_summary' }, text);
  }
  assert.deepEqual(parsePlanned('cancelar repetição aluguel', TODAY), { type: 'planned_stop', query: 'aluguel' });
  assert.deepEqual(parsePlanned('parar de repetir o aluguel', TODAY), { type: 'planned_stop', query: 'aluguel' });
  assert.deepEqual(parsePlanned('cancelar a conta fixa do aluguel', TODAY), { type: 'planned_stop', query: 'aluguel' });
});

test('previsto: o que é de outros assessores passa direto', () => {
  for (const text of ['mercado 50', 'recebi 3000 de salário', 'dentista quinta às 15h', 'reunião toda semana às 15h', 'reunião toda semana às 15', 'pagar luz sexta', 'resumo', 'ajuda', '']) {
    assert.equal(parsePlanned(text, TODAY), null, text);
  }
});

test('repetição: dia 31 volta a ser 31 depois de um mês mais curto', () => {
  assert.equal(occurrenceDate('2026-10-31', 'monthly', 1), '2026-11-30');
  assert.equal(occurrenceDate('2026-10-31', 'monthly', 2), '2026-12-31');
  assert.equal(occurrenceDate('2026-11-03', 'weekly', 2), '2026-11-17');
  assert.equal(occurrenceDate('2024-02-29', 'yearly', 1), '2025-02-28');
  assert.equal(occurrenceDate('2024-02-29', 'yearly', 4), '2028-02-29');
});

// Conversa

test('conversa: repetição cria um ano de lançamentos, como previstos', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  const reply = await say('aluguel 1800 todo dia 10');
  assert.match(reply, /^💰 \*Caio, Assessor Financeiro\*/);
  assert.match(reply, /\*R\$ 1\.800,00\* de saída todo mês em 🏠 Moradia/);
  assert.match(reply, /Próxima: 10\/11/);

  const rows = (await store.allExpenses()).reverse();
  assert.equal(rows.length, 12);
  assert.equal(rows[0].spent_on, '2026-11-10');
  assert.equal(rows.at(-1).spent_on, '2027-10-10');
  assert.ok(rows.every((row) => row.category_name === 'Moradia' && row.recurrence_frequency === 'monthly'));

  await say('salário 5000 todo dia 5');
  assert.equal((await store.allIncomes()).length, 12);

  const summary = await say('quanto ainda vai sair');
  assert.match(summary, /\*Ainda em novembro\*/);
  assert.match(summary, /Vai entrar: \*R\$ 5\.000,00\*/);
  assert.match(summary, /Vai sair: \*R\$ 1\.800,00\*/);
  assert.match(summary, /05\/11 Salário: \+R\$ 5\.000,00[\s\S]*10\/11 Aluguel: −R\$ 1\.800,00/);

  assert.match(await say('resumo'), /Ainda vai entrar: R\$ 5\.000,00\nAinda vai sair: R\$ 1\.800,00/);
  assert.match(await say('aluguel todo mês'), /De quanto/);
});

test('conversa: lançamento futuro único, com a conta citada', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  const account = await store.createAccount({ name: 'Nubank', kind: 'conta', openingCents: 100000 });
  const reply = await say('vou pagar 300 de luz dia 15 no nubank');
  assert.match(reply, /\*R\$ 300,00\* de saída .*\(Nubank\)/);
  assert.match(reply, /Previsto para 15\/11/);
  const [row] = await store.allExpenses();
  assert.equal(row.account_id, account.id);
  assert.equal(row.description, 'Luz');
  // Ainda não saiu: o saldo da conta não muda antes da data.
  assert.equal((await store.accountBalances(TODAY))[0].balance_cents, 100000);
  assert.equal((await store.accountBalances('2026-11-15'))[0].balance_cents, 70000);
});

test('conversa: parar de repetir mantém o que já aconteceu', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  await createRecurrence(store, {
    kind: 'expense', description: 'Academia', amountCents: 10000, categoryId: (await store.otherCategory()).id, frequency: 'monthly', startOn: '2026-09-10', source: 'app',
  }, TODAY);
  assert.match(await say('cancelar repetição academia'), /não se repete mais/);
  const dates = (await store.allExpenses()).map((row) => row.spent_on).sort();
  assert.deepEqual(dates, ['2026-09-10', '2026-10-10']);
  assert.match(await say('cancelar repetição academia'), /Não encontrei/);

  // Depois de parar, a rotina não recria nada.
  const scheduler = createScheduler({ db, google: noGoogle, config, mailer: fakeMailer(), log: quiet, sendText: async () => {}, sendTemplate: async () => {} });
  await scheduler.tick(NOW);
  assert.equal((await store.allExpenses()).length, 2);
});

test('conversa: desfazer e corrigir valem para a repetição inteira', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  await say('mercado 50');
  await new Promise((done) => setTimeout(done, 5));
  await say('quiropraxia 200 todo dia 20');
  assert.match(await say('categoria saúde'), /\*Quiropraxia\* agora está em 💊 Saúde, em todas as repetições/);
  assert.ok((await store.allExpenses()).filter((row) => row.recurrence_id).every((row) => row.category_name === 'Saúde'));

  assert.match(await say('desfazer'), /Apaguei \*Quiropraxia\*, com todas as repetições/);
  assert.equal((await store.allExpenses()).length, 1);
  assert.equal(await store.lastRecurrence(), null);
  assert.match(await say('desfazer'), /Apaguei: Mercado/);
});

test('conversa: tarefa e compromisso continuam com as assessoras certas', async () => {
  await signUp();
  assert.match(await say('tarefa pagar aluguel 1800 todo mês'), /^📝/);
  assert.match(await say('reunião toda semana às 15h'), /^📅/);
  assert.match(await say('recebi 3000 de salário'), /^💰[\s\S]*de entrada/);
});

test('a rotina diária mantém um ano de repetições à frente, sem duplicar', async () => {
  const user = await signUp();
  const store = db.forUser(user.id);
  await say('salário 5000 todo dia 5');
  assert.equal((await store.allIncomes()).length, 12);
  const scheduler = createScheduler({ db, google: noGoogle, config, mailer: fakeMailer(), log: quiet, sendText: async () => {}, sendTemplate: async () => {} });
  await scheduler.tick(NOW);
  assert.equal((await store.allIncomes()).length, 12);

  const nextYear = createScheduler({ db, google: noGoogle, config, mailer: fakeMailer(), log: quiet, sendText: async () => {}, sendTemplate: async () => {} });
  await nextYear.tick(new Date('2026-12-06T15:00:00Z'));
  const dates = (await store.allIncomes()).map((row) => row.received_on).sort();
  // De novembro de 2026 a dezembro de 2027: o horizonte andou um mês e um dia.
  assert.equal(dates.length, 14);
  assert.equal(dates.at(-1), '2027-12-05');
  assert.equal(new Set(dates).size, dates.length);
});

// Painel

test('painel: separa o que já entrou e saiu do que ainda vai entrar e sair', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const other = (await store.otherCategory()).id;
  const income = (date, value, description = 'Entrada') => store.addIncome({ description, amountCents: value, date, source: 'app' });
  const expense = (date, value, description = 'Saída') => store.addExpense({ description, amountCents: value, categoryId: other, date, source: 'app' });
  await income('2026-11-01', 300000);
  await income('2026-11-20', 100000, 'Freela');
  await expense('2026-11-02', 50000);
  await expense(TODAY, 10000);
  await expense('2026-11-10', 180000, 'Aluguel');
  await income('2026-10-02', 200000);
  await expense('2026-10-03', 40000);
  await expense('2026-10-20', 999900);

  const current = await panelData(store, { from: '2026-06', to: '2026-11', today: TODAY });
  assert.equal(current.period.is_current, true);
  assert.equal(current.period.is_future, false);
  const { income: incomes, expense: expenses, balance } = current.summary;
  assert.deepEqual([incomes.total_cents, incomes.done_cents, incomes.pending_cents], [400000, 300000, 100000]);
  assert.deepEqual([expenses.total_cents, expenses.done_cents, expenses.pending_cents], [240000, 60000, 180000]);
  assert.deepEqual([balance.total_cents, balance.done_cents, balance.pending_cents], [160000, 240000, -80000]);
  // Compara o que já aconteceu com o mesmo período do mês anterior: o 999900 de 20/10 fica de fora.
  assert.equal(incomes.change_percent, 50);
  assert.equal(expenses.change_percent, 50);
  assert.deepEqual(current.upcoming.map((row) => [row.date, row.description, row.kind]), [
    ['2026-11-10', 'Aluguel', 'expense'],
    ['2026-11-20', 'Freela', 'income'],
  ]);
  const november = current.flow.at(-1);
  assert.equal(november.income_pending_cents, 100000);
  assert.equal(november.expense_pending_cents, 180000);

  // Mês passado: tudo já aconteceu.
  const past = await panelData(store, { from: '2026-05', to: '2026-10', today: TODAY });
  assert.equal(past.summary.income.pending_cents, 0);
  assert.equal(past.summary.expense.done_cents, past.summary.expense.total_cents);
  assert.deepEqual(past.upcoming, []);
  assert.equal(past.period.is_current, false);

  // Mês futuro: tudo ainda vai acontecer.
  await income('2026-12-05', 500000);
  const future = await panelData(store, { from: '2026-07', to: '2026-12', today: TODAY });
  assert.equal(future.period.is_future, true);
  assert.deepEqual([future.summary.income.done_cents, future.summary.income.pending_cents], [0, 500000]);
  assert.equal(future.upcoming.length, 1);
});

// Pela API

async function withApp(user, run) {
  const app = createApp({ config, db, google: noGoogle, mailer: fakeMailer(), log: quiet, sendText: async () => {} });
  await new Promise((done) => app.listen(0, done));
  const base = `http://127.0.0.1:${app.address().port}`;
  const client = (who) => (path, { method = 'GET', body } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: `nuvexx_sessao=${createSession(config, who)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    await run(client(user), client);
  } finally {
    app.closeAllConnections();
    await new Promise((done) => app.close(done));
  }
}

test('API: lançamento que se repete, com data final, edição e exclusão dos próximos', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const today = todayIn(config.timeZone);
  const start = addDays(today, 1);
  const [{ id: categoryId }, { id: otherCategoryId }] = await store.categories();
  await withApp(user, async (api) => {
    const created = await api('/api/expenses', { method: 'POST', body: { description: 'Curso', amount: '100', date: start, category_id: categoryId, repeat: 'monthly', repeat_until: addMonths(start, 3) } });
    assert.equal(created.status, 201);
    const rows = (await store.allExpenses()).sort((a, b) => a.spent_on.localeCompare(b.spent_on));
    assert.equal(rows.length, 4);

    assert.equal((await api('/api/expenses', { method: 'POST', body: { description: 'x', amount: '1', date: start, category_id: categoryId, repeat: 'sempre' } })).status, 400);
    assert.equal((await api('/api/expenses', { method: 'POST', body: { description: 'x', amount: '1', date: start, category_id: categoryId, repeat: 'monthly', repeat_until: today } })).status, 400);

    const entries = await (await api(`/api/entries?month=${monthOf(start)}`)).json();
    assert.equal(entries[0].planned, true);
    assert.equal(entries[0].recurrence_frequency, 'monthly');

    // Só esta: as outras continuam como estavam.
    await api(`/api/expenses/${rows[0].id}`, { method: 'PUT', body: { description: 'Curso avulso', amount: '150', date: start, category_id: categoryId } });
    assert.equal((await store.expense(rows[1].id)).amount_cents, 10000);

    // Esta e as próximas: a anterior não muda, e a categoria acompanha.
    await api(`/api/expenses/${rows[1].id}`, { method: 'PUT', body: { description: 'Curso novo', amount: '200', date: rows[1].spent_on, category_id: otherCategoryId, apply_next: true } });
    assert.equal((await store.expense(rows[0].id)).description, 'Curso avulso');
    for (const row of rows.slice(1)) {
      const saved = await store.expense(row.id);
      assert.equal(saved.description, 'Curso novo');
      assert.equal(saved.amount_cents, 20000);
      assert.equal(saved.category_id, otherCategoryId);
      assert.equal(saved.spent_on, row.spent_on);
    }
    const rule = await store.recurrence(rows[0].recurrence_id);
    assert.equal(rule.description, 'Curso novo');
    assert.equal(rule.amount_cents, 20000);

    // Só este apaga um; este e os próximos encerra a repetição.
    await api(`/api/expenses/${rows[3].id}`, { method: 'DELETE' });
    assert.equal((await store.allExpenses()).length, 3);
    await api(`/api/expenses/${rows[1].id}?next=1`, { method: 'DELETE' });
    assert.deepEqual((await store.allExpenses()).map((row) => row.id), [rows[0].id]);
    assert.ok((await store.recurrence(rows[0].recurrence_id)).end_on);
  });
});

test('API: entrada que se repete, e cada pessoa só alcança as próprias', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const other = await createAccount(db, { email: 'outra@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const today = todayIn(config.timeZone);
  await withApp(user, async (api, client) => {
    const start = addDays(today, 1);
    assert.equal((await api('/api/incomes', { method: 'POST', body: { description: 'Salário', amount: '5000', date: start, repeat: 'monthly' } })).status, 201);
    const rows = await store.allIncomes();
    assert.equal(rows.length >= 12, true);
    assert.equal(rows[0].recurrence_frequency, 'monthly');

    const theirs = client(other);
    assert.equal((await theirs(`/api/incomes/${rows[0].id}?next=1`, { method: 'DELETE' })).status, 404);
    assert.equal((await theirs(`/api/incomes/${rows[0].id}`, { method: 'PUT', body: { description: 'x', amount: '1', date: start, apply_next: true } })).status, 404);
    assert.equal((await store.allIncomes()).length, rows.length);
    assert.deepEqual(await (await theirs(`/api/entries?month=${monthOf(start)}`)).json(), []);

    // A lista vem da data mais nova para a mais antiga: rows[1] é a penúltima.
    await api(`/api/incomes/${rows[1].id}`, { method: 'PUT', body: { description: 'Salário novo', amount: '6000', date: rows[1].received_on, apply_next: true } });
    assert.equal((await store.income(rows[0].id)).amount_cents, 600000);
    assert.equal((await store.income(rows[1].id)).amount_cents, 600000);
    assert.equal((await store.income(rows[2].id)).amount_cents, 500000);

    const exported = await (await api('/api/account/export')).json();
    assert.equal(exported.repeticoes.length, 1);

    const data = await (await api(`/api/panel-data?to=${shiftMonth(monthOf(today), 1)}`)).json();
    assert.equal(data.period.is_future, true);
    assert.ok(data.summary.income.pending_cents >= 500000);
    assert.ok(data.upcoming.some((row) => row.kind === 'income'));
  });
});

test('apagar a categoria leva a repetição para Outros, e apagar a conta a desliga', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  const store = db.forUser(user.id);
  const category = (await store.categories()).find((row) => row.name === 'Lazer');
  const account = await store.createAccount({ name: 'Nubank', kind: 'conta', openingCents: 0 });
  const rule = await createRecurrence(store, {
    kind: 'expense', description: 'Clube', amountCents: 5000, categoryId: category.id, accountId: account.id, frequency: 'monthly', startOn: TODAY, source: 'app',
  }, TODAY);
  await store.deleteCategory(category.id);
  await store.deleteAccount(account.id);
  const saved = await store.recurrence(rule.id);
  assert.equal(saved.category_id, (await store.otherCategory()).id);
  assert.equal(saved.account_id, null);
  assert.ok((await store.allExpenses()).every((row) => row.category_name === 'Outros' && row.account_id === null));
});

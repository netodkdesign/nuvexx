import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAssistant } from '../src/assistant.js';
import { classify, DEFAULT_CATEGORIES } from '../src/categories.js';
import { hashLinkCode } from '../src/auth.js';
import { expensesToCsv } from '../src/reports.js';
import { normalizeKeyword } from '../src/text.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OTHER, OWNER, testConfig } from './helpers.js';

const NOW = new Date('2026-11-03T15:00:00Z');
const CODE = 'ABCD-2345';

let db;
let reset;
let config;
let assistant;
let mailer;

const say = (text, from = OWNER, sentAt = NOW) => assistant.handleWhatsApp({ from, text, sentAt });
const signUp = (from = OWNER, sentAt = NOW) => createAccount(db, { phone: from, at: sentAt });
const saveCode = (user, code = CODE, expiresAt = new Date(NOW.getTime() + 15 * 60 * 1000)) =>
  db.saveWhatsappCode(user.id, hashLinkCode(config, code), expiresAt);
const storeOf = async (phone = OWNER) => db.forUser((await db.userByPhone(phone)).id);
const allExpenses = async (phone = OWNER) => (await storeOf(phone)).allExpenses();
const allAppointments = async (phone = OWNER) => (await storeOf(phone)).allAppointments();

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

// Categorias

test('nenhuma palavra-chave padrão aparece em duas categorias', () => {
  const seen = new Map();
  for (const category of DEFAULT_CATEGORIES) {
    for (const keyword of category.keywords) {
      const normalized = normalizeKeyword(keyword);
      assert.ok(!seen.has(normalized), `"${normalized}" está em ${seen.get(normalized)} e ${category.name}`);
      seen.set(normalized, category.name);
    }
  }
});

test('classifica pelas palavras mais específicas e pela primeira citada', async () => {
  await signUp();
  const store = await storeOf();
  const categoryOf = async (text) => (await store.category(classify(text, await store.keywords())))?.name;
  const cases = {
    'Farmácia': 'Saúde',
    'Mercado livre': 'Compras',
    'Mercado': 'Mercado',
    'Pão de açúcar': 'Mercado',
    'Pão': 'Alimentação',
    'Uber eats': 'Alimentação',
    'Uber para o trabalho': 'Transporte',
    '99': 'Transporte',
    'Almoço no shopping': 'Alimentação',
    'Conta de luz': 'Moradia',
    'Passagem aérea': 'Lazer',
    'Celular novo': 'Compras',
    'Remédios': 'Saúde',
    'Oi fibra': 'Assinaturas',
    'Coisas das crianças': undefined,
  };
  for (const [text, expected] of Object.entries(cases)) assert.equal(await categoryOf(text), expected, text);
});

// WhatsApp: uma conexão opcional, nunca a porta de entrada

test('número sem conta recebe a orientação uma vez por dia, e nada é criado', async () => {
  const reply = await say('gastei 50 no mercado');
  assert.match(reply, /ainda não está conectado/);
  assert.match(reply, /https:\/\/app\.test/);
  assert.match(reply, /Conectar WhatsApp/);
  assert.equal(await say('mercado 50'), null);
  assert.equal(await say('oi'), null);
  assert.equal(await db.userByPhone(OWNER), null);
});

test('número de fora do Brasil sem conta não recebe resposta paga', async () => {
  assert.equal(await say('oi', '14155550100'), null);
});

test('conta sem WhatsApp usa os assessores normalmente', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  assert.equal(user.phone, null);
  assert.equal((await db.forUser(user.id).categories()).length, DEFAULT_CATEGORIES.length);
  assert.match(await assistant.handlePanel({ user, text: 'mercado 50', now: NOW }), /^💰/);
  assert.match(await assistant.handlePanel({ user, text: 'dentista quinta às 15h', now: NOW }), /^📅/);
});

test('o código certo liga o número à conta, uma vez só, e avisa por e-mail', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  await saveCode(user);

  const reply = await say(`conectar ${CODE.toLowerCase()}`, '554799998888');
  assert.match(reply, /agora está conectado/);
  assert.match(reply, /Assessor Financeiro/);

  const linked = await db.userByPhone(OWNER);
  assert.equal(linked.id, user.id);
  assert.equal(linked.wa_id, '554799998888');
  assert.deepEqual(mailer.sent.map((message) => message.to), ['ana@teste.com']);
  assert.match(mailer.sent[0].text, /\(47\) 99999-8888/);

  // O mesmo código, de outro número, não vale mais.
  assert.match(await say(`conectar ${CODE}`, OTHER), /venceu ou não existe/);
  assert.equal(await db.userByPhone(OTHER), null);

  // A partir daqui, as mensagens vão para a mesma conta.
  await say('mercado 50');
  assert.equal((await db.forUser(user.id).allExpenses()).length, 1);
});

test('código errado ou vencido não liga o número, e tentar demais bloqueia', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  await saveCode(user, CODE, new Date(NOW.getTime() - 1000));
  assert.match(await say(`conectar ${CODE}`), /venceu ou não existe/);

  await saveCode(user);
  for (let i = 0; i < 4; i += 1) assert.match(await say('conectar ZZZZ-ZZZZ'), /venceu ou não existe/);
  assert.equal(await say(`conectar ${CODE}`), null);
  assert.equal(await db.userByPhone(OWNER), null);
});

test('número de fora do Brasil não é conectado, e o código continua valendo', async () => {
  const user = await createAccount(db, { email: 'ana@teste.com', at: NOW });
  await saveCode(user);
  assert.match(await say(`conectar ${CODE}`, '14155550100'), /só funciona com números do Brasil/);
  assert.equal(await db.userByPhone('14155550100'), null);
  assert.match(await say(`conectar ${CODE}`), /agora está conectado/);
});

test('número já conectado não troca de conta sem desconectar antes', async () => {
  const owner = await signUp();
  const other = await createAccount(db, { email: 'outra@teste.com', at: NOW });
  await saveCode(other);
  assert.match(await say(`conectar ${CODE}`), /já está conectado/);
  assert.equal((await db.userByPhone(OWNER)).id, owner.id);

  assert.match(await say('desconectar whatsapp'), /desconectei/);
  assert.equal(await db.userByPhone(OWNER), null);
  assert.ok(await db.userById(owner.id));

  assert.match(await say(`conectar ${CODE}`), /agora está conectado/);
  assert.equal((await db.userByPhone(OWNER)).id, other.id);
});

test('conectar outro número substitui o anterior', async () => {
  const user = await signUp();
  await saveCode(user);
  assert.match(await say(`conectar ${CODE}`, OTHER), /agora está conectado/);
  assert.equal(await db.userByPhone(OWNER), null);
  assert.equal((await db.userByPhone(OTHER)).id, user.id);
});

test('pedir para entrar pelo WhatsApp devolve o endereço, nunca um código', async () => {
  await signUp();
  const reply = await say('entrar');
  assert.match(reply, /https:\/\/app\.test/);
  assert.doesNotMatch(reply, /\d{6}/);
});

test('o mesmo número com ou sem o nono dígito é a mesma conta', async () => {
  await signUp(OWNER);
  await say('mercado 10', '554799998888');
  assert.equal((await allExpenses(OWNER)).length, 1);
});

// Separação de dados

test('os dados de uma pessoa nunca aparecem para outra', async () => {
  await signUp(OWNER);
  await signUp(OTHER);
  await say('mercado 300', OWNER);
  await say('dentista quinta às 15h', OWNER);
  await say('uber 20', OTHER);

  assert.match(await say('resumo', OTHER), /Total: \*R\$ 20,00\*/);
  assert.doesNotMatch(await say('resumo', OTHER), /Mercado/);
  assert.match(await say('agenda', OTHER), /Nenhum compromisso/);
  assert.match(await say('quanto gastei de mercado', OTHER), /Não encontrei|Nenhum/);
  assert.equal((await allExpenses(OTHER)).length, 1);

  // Desfazer só alcança o que é da própria pessoa.
  await say('desfazer', OTHER);
  assert.equal((await allExpenses(OTHER)).length, 0);
  assert.equal((await allExpenses(OWNER)).length, 1);
  assert.equal((await allAppointments(OWNER)).length, 1);
});

test('correção de categoria ensina só quem corrigiu', async () => {
  await signUp(OWNER);
  await signUp(OTHER);
  await say('quiropraxia 200', OWNER);
  await say('categoria saúde', OWNER);
  assert.match(await say('quiropraxia 150', OWNER), /💊 Saúde/);
  assert.match(await say('quiropraxia 150', OTHER), /📦 Outros/);
});

test('um id de outra pessoa não dá acesso aos dados dela', async () => {
  const owner = await signUp(OWNER);
  const other = await signUp(OTHER);
  await say('mercado 300', OWNER);
  const ownerStore = db.forUser(owner.id);
  const otherStore = db.forUser(other.id);
  const [expense] = await ownerStore.allExpenses();
  const [category] = await ownerStore.categories();

  assert.equal(await otherStore.expense(expense.id), null);
  assert.equal(await otherStore.category(category.id), null);
  await otherStore.deleteExpense(expense);
  await otherStore.deleteCategory(category.id);
  assert.ok(await ownerStore.expense(expense.id));
  assert.ok(await ownerStore.category(category.id));
});

// Assessor Financeiro

test('responde como Assessor Financeiro e registra o gasto', async () => {
  await signUp();
  const reply = await say('gastei 50 no mercado');
  assert.match(reply, /^💰 \*Caio, Assessor Financeiro\*/);
  assert.match(reply, /\*R\$ 50,00\* em 🛒 Mercado/);
  assert.match(reply, /Mercado em novembro: R\$ 50,00/);
  const [row] = await allExpenses();
  assert.equal(row.amount_cents, 5000);
  assert.equal(row.spent_on, '2026-11-03');
  assert.equal(row.source, 'whatsapp');
});

test('usa o dia de São Paulo, não o do servidor', async () => {
  await signUp();
  await say('café 8', OWNER, new Date('2026-11-04T01:30:00Z'));
  assert.equal((await allExpenses())[0].spent_on, '2026-11-03');
});

test('sem categoria conhecida, vai para Outros, avisa e aprende com a correção', async () => {
  await signUp();
  assert.match(await say('quiropraxia 200'), /Não reconheci a categoria/);
  assert.equal((await allExpenses())[0].category_name, 'Outros');
  assert.match(await say('categoria saúde'), /\*Quiropraxia\* agora está em 💊 Saúde/);
  assert.equal((await allExpenses())[0].category_name, 'Saúde');
  assert.match(await say('quiropraxia 150'), /💊 Saúde/);
});

test('correção indica categorias quando o nome não existe', async () => {
  await signUp();
  await say('mercado 10');
  const reply = await say('categoria xablau');
  assert.match(reply, /Não achei a categoria "xablau"/);
  assert.match(reply, /🛒 Mercado/);
  assert.equal((await allExpenses())[0].category_name, 'Mercado');
});

test('parcelas entram uma por mês e a soma bate com o total', async () => {
  await signUp();
  assert.match(await say('tv 1000 em 3x'), /\*3x de R\$ 333,34\* em 🛍️ Compras/);
  const rows = (await allExpenses()).reverse();
  assert.deepEqual(rows.map((r) => r.spent_on), ['2026-11-03', '2026-12-03', '2027-01-03']);
  assert.deepEqual(rows.map((r) => r.amount_cents), [33334, 33333, 33333]);
  assert.deepEqual(rows.map((r) => r.installment), [1, 2, 3]);
});

test('parcela no dia 31 cai no último dia dos meses menores', async () => {
  await signUp();
  await say('31/10 curso 300 em 2x');
  const dates = (await allExpenses()).map((r) => r.spent_on).sort();
  assert.deepEqual(dates, ['2026-10-31', '2026-11-30']);
});

test('desfazer e corrigir valem para a compra parcelada inteira', async () => {
  await signUp();
  await say('curso 300 em 3x');
  await say('categoria lazer');
  assert.ok((await allExpenses()).every((r) => r.category_name === 'Lazer'));
  assert.match(await say('desfazer'), /Curso, 3 parcelas/);
  assert.equal((await allExpenses()).length, 0);
});

test('resumo mostra as categorias, a participação e a comparação', async () => {
  const user = await signUp(OWNER, new Date('2026-10-01T15:00:00Z'));
  await db.setPaidUntil(user.id, new Date('2027-01-01T00:00:00Z'));
  await say('mercado 100', OWNER, new Date('2026-10-02T15:00:00Z'));
  await say('mercado 300');
  await say('uber 100');
  const reply = await say('resumo');
  assert.match(reply, /Novembro de 2026/);
  assert.match(reply, /Total: \*R\$ 400,00\* em 2 lançamentos/);
  assert.match(reply, /🛒 Mercado: R\$ 300,00 \(75%\)/);
  assert.match(reply, /🚗 Transporte: R\$ 100,00 \(25%\)/);
  assert.match(reply, /▲ R\$ 300,00 a mais que o mesmo período de outubro/);
});

test('resumo de mês vazio não finge que há dados', async () => {
  await signUp();
  assert.match(await say('resumo outubro'), /Nenhum gasto anotado em outubro de 2026/);
});

test('consulta por categoria, por descrição e por palavra-chave', async () => {
  await signUp();
  await say('feira 80');
  await say('supermercado 120');
  await say('uber 30');
  await say('99 20');
  const byCategory = await say('Quanto gastei de mercado esse mês?');
  assert.match(byCategory, /🛒 Mercado, novembro de 2026/);
  assert.match(byCategory, /Total: \*R\$ 200,00\* em 2 lançamentos/);
  assert.match(await say('quanto gastei com uber'), /Total: \*R\$ 30,00\* em 1 lançamento/);
  assert.match(await say('quanto gastei com gasolina'), /🚗 Transporte/);
  assert.match(await say('quanto gastei com xablau'), /Não encontrei gastos com "xablau"/);
});

test('consulta de hoje só conta hoje', async () => {
  await signUp();
  await say('ontem mercado 50');
  await say('café 8');
  assert.match(await say('quanto gastei hoje'), /Total: \*R\$ 8,00\*/);
});

test('mensagem com várias linhas vira vários gastos', async () => {
  await signUp();
  assert.match(await say('mercado 50\nuber 20,50\nalmoço 30 ontem'), /Anotei 3 gastos/);
  assert.equal((await allExpenses()).length, 3);
});

test('entrada de dinheiro e texto solto não viram gasto', async () => {
  await signUp();
  assert.match(await say('recebi 3000 de salário'), /\*R\$ 3\.000,00\* de entrada/);
  assert.match(await say('mercado'), /Não entendi/);
  assert.match(await say('mercado\nuber'), /Não entendi/);
  assert.equal((await allExpenses()).length, 0);
});

test('apagar categoria leva os gastos para Outros sem mudar o total', async () => {
  await signUp();
  await say('mercado 50');
  const store = await storeOf();
  const mercado = (await store.categories()).find((c) => c.name === 'Mercado');
  await store.deleteCategory(mercado.id);
  assert.equal((await allExpenses())[0].category_name, 'Outros');
  assert.equal((await store.total('2026-11-01', '2026-12-01')).total_cents, 5000);
  // As palavras padrão da categoria apagada deixam de valer.
  assert.match(await say('mercado 20'), /📦 Outros/);
});

test('renomear categoria mantém as palavras padrão', async () => {
  await signUp();
  const store = await storeOf();
  const mercado = (await store.categories()).find((c) => c.name === 'Mercado');
  await store.updateCategory(mercado.id, { name: 'Supermercado', emoji: '🛒' });
  assert.match(await say('feira 20'), /🛒 Supermercado/);
});

test('planilha abre no Excel em português e neutraliza fórmulas', async () => {
  await signUp();
  await say('=cmd 50');
  const csv = expensesToCsv(await allExpenses());
  assert.ok(csv.startsWith('﻿Data;Descrição;Categoria;Valor'));
  assert.match(csv, /;'=cmd;Outros;50,00;/);
});

// Assessor de Agenda

test('responde como Assessor de Agenda e marca o compromisso', async () => {
  await signUp();
  const reply = await say('Marca o dentista quinta às três da tarde');
  assert.match(reply, /^📅 \*Cris, Assessora de Agenda\*/);
  assert.match(reply, /\*Dentista\*: quinta, 05\/11, às 15:00/);
  assert.match(reply, /Te aviso 1 hora antes/);
  const [row] = await allAppointments();
  assert.equal(row.starts_on, '2026-11-05');
  assert.equal(row.start_time, '15:00');
  assert.equal(row.end_time, '16:00');
  // 15:00 em São Paulo são 18:00 em UTC.
  assert.equal(new Date(row.starts_at).toISOString(), '2026-11-05T18:00:00.000Z');
  assert.equal(new Date(row.remind_at).toISOString(), '2026-11-05T17:00:00.000Z');
});

test('o nome do compromisso é o evento, não o pedido', async () => {
  await signUp();
  const requests = ['quero agendar minha reunião com José amanhã às 10', 'adicionar a minha agenda uma reunião com José sexta às 15h', 'Cris, marca reunião com José segunda às 9, por favor'];
  for (const text of requests) {
    const reply = await say(text);
    assert.match(reply, /^📅 \*Cris, Assessora de Agenda\*/, text);
    assert.match(reply, /\*Reunião com José\*/, text);
  }
  const rows = await allAppointments();
  assert.deepEqual(rows.map((row) => row.title), requests.map(() => 'Reunião com José'));
  // O mesmo verbo, com valor e sem falar de agenda, continua sendo gasto.
  assert.match(await say('adiciona gasto de 50 no mercado'), /^💰 \*Caio, Assessor Financeiro\*/);
});

// A Cris pergunta para quando e lembra do evento

const ASK = 'agendar minha reunião com José';
const pendingEvent = async () => (await storeOf()).pendingEvent(NOW);

const WHEN_ANSWERS = [
  ['amanhã às 10', /\*Reunião com José\*: amanhã, às 10:00/],
  ['sexta às 15h', /\*Reunião com José\*: sexta, 06\/11, às 15:00/],
  ['às 16h', /\*Reunião com José\*: hoje, às 16:00/],
  ['16h', /\*Reunião com José\*: hoje, às 16:00/],
  ['às 9', /\*Reunião com José\*: amanhã, às 09:00/],
  ['para amanhã às 10', /\*Reunião com José\*: amanhã, às 10:00/],
  ['pode ser sexta às 15h, por favor', /\*Reunião com José\*: sexta, 06\/11, às 15:00/],
  ['Marca pra amanhã às 10', /\*Reunião com José\*: amanhã, às 10:00/],
  ['amanhã 10', /\*Reunião com José\*: amanhã, às 10:00/],
  ['sexta 15', /\*Reunião com José\*: sexta, 06\/11, às 15:00/],
  ['terça 15', /\*Reunião com José\*: hoje, às 15:00/],
  ['15', /\*Reunião com José\*: hoje, às 15:00/],
  ['três da tarde', /\*Reunião com José\*: hoje, às 15:00/],
  ['dia 20 às 9:30', /\*Reunião com José\*: sexta, 20\/11, às 09:30/],
  ['amanhã', /\*Reunião com José\*: amanhã, o dia todo/],
  ['amanhã às 10 no escritório', /\*Reunião com José no escritório\*: amanhã, às 10:00/],
  ['amanhã às 10 na sala 3', /\*Reunião com José na sala 3\*: amanhã, às 10:00/],
  ['quinta de manhã', /\*Reunião com José de manhã\*: quinta, 05\/11, o dia todo/],
  ['reunião com José amanhã às 10', /\*Reunião com José\*: amanhã, às 10:00/],
  ['reunião amanhã às 10', /\*Reunião com José\*: amanhã, às 10:00/],
  ['reunião com José no escritório amanhã às 10', /\*Reunião com José no escritório\*: amanhã, às 10:00/],
];

for (const [answer, expected] of WHEN_ANSWERS) {
  test(`depois de "Para quando?", "${answer}" marca o evento guardado`, async () => {
    await signUp();
    assert.match(await say(ASK), /^📅 \*Cris, Assessora de Agenda\*\nPara quando é \*Reunião com José\*\?/);
    const reply = await say(answer);
    assert.match(reply, /^📅 \*Cris, Assessora de Agenda\*/);
    assert.match(reply, expected);
    assert.doesNotMatch(reply, /para quando/i);
    assert.equal((await allAppointments()).length, 1);
    assert.equal((await allExpenses()).length, 0);
    assert.equal(await pendingEvent(), null);
  });
}

test('sem pergunta em aberto, um horário sozinho não vira gasto', async () => {
  await signUp();
  for (const text of ['amanhã às 10', 'sexta às 15h', 'às 16h', '10h']) {
    assert.match(await say(text), /^📅 \*Cris, Assessora de Agenda\*\nMarcar o quê\?/, text);
  }
  assert.equal((await allExpenses()).length, 0);
  assert.equal((await allAppointments()).length, 0);
  // O que tem valor continua sendo gasto.
  for (const text of ['mercado 50', '50', 'amanhã 10']) assert.match(await say(text), /^💰/, text);
  assert.equal((await allExpenses()).length, 3);
});

test('a pergunta vence em 2 horas, e o horário não vira gasto nem evento', async () => {
  await signUp();
  await say(ASK);
  const later = new Date(NOW.getTime() + 2 * 60 * 60 * 1000 + 1000);
  assert.match(await say('amanhã às 10', OWNER, later), /Marcar o quê\?/);
  assert.equal((await allAppointments()).length, 0);
  assert.equal((await allExpenses()).length, 0);
});

test('horário que já passou pergunta de novo, sem esquecer o evento', async () => {
  await signUp();
  await say(ASK);
  const passed = await say('hoje às 9');
  assert.match(passed, /Esse horário já passou/);
  assert.match(passed, /Para quando é \*Reunião com José\*\?/);
  assert.equal((await allAppointments()).length, 0);
  assert.match(await say('amanhã às 9'), /\*Reunião com José\*: amanhã, às 09:00/);
});

test('dá para desistir, e o horário seguinte já não marca nada', async () => {
  for (const text of ['cancelar', 'deixa pra lá', 'não sei ainda', 'depois', 'desfazer']) {
    await reset();
    await signUp();
    await say(ASK);
    assert.match(await say(text), /Tudo bem, não marquei \*Reunião com José\*/, text);
    assert.equal(await pendingEvent(), null, text);
    assert.match(await say('amanhã às 10'), /Marcar o quê\?/, text);
    assert.equal((await allAppointments()).length, 0, text);
  }
});

test('outro assunto é atendido, e a pergunta volta no fim', async () => {
  await signUp();
  await say(ASK);
  const reminder = /📅 E \*Reunião com José\*, para quando\?/;
  const spent = await say('gastei 50 no mercado');
  assert.match(spent, /^💰/);
  assert.match(spent, reminder);
  const listed = await say('agenda de hoje');
  assert.match(listed, /Nenhum compromisso marcado/);
  assert.match(listed, reminder);
  const task = await say('tarefa pagar luz sexta');
  assert.match(task, /^📝/);
  assert.match(task, reminder);
  const dentist = await say('dentista quinta às 15h');
  assert.match(dentist, /\*Dentista\*: quinta, 05\/11, às 15:00/);
  assert.match(dentist, reminder);
  assert.equal((await allAppointments()).length, 1);

  assert.match(await say('sexta às 10'), /\*Reunião com José\*: sexta, 06\/11, às 10:00/);
  assert.deepEqual((await allAppointments()).map((row) => row.title).sort(), ['Dentista', 'Reunião com José']);
  assert.equal((await allExpenses()).length, 1);
});

test('o que não dá para entender repete só a pergunta', async () => {
  await signUp();
  await say(ASK);
  const reply = await say('talvez');
  assert.match(reply, /^📅 \*Cris, Assessora de Agenda\*\nNão entendi\.\n\nPara quando é \*Reunião com José\*\?/);
  assert.doesNotMatch(reply, /mercado 50/);
  assert.ok(await pendingEvent());
});

test('um pedido novo sem data troca o evento guardado', async () => {
  await signUp();
  await say(ASK);
  const reply = await say('marca dentista');
  assert.match(reply, /Para quando é \*Dentista\*\?/);
  assert.doesNotMatch(reply, /Reunião com José/);
  assert.match(await say('sexta às 10'), /\*Dentista\*: sexta, 06\/11, às 10:00/);
  assert.deepEqual((await allAppointments()).map((row) => row.title), ['Dentista']);
});

test('o evento guardado continua do WhatsApp para o site, e um pedido sem nome não guarda nada', async () => {
  const user = await signUp();
  assert.match(await say('agendar'), /Para quando\? Mande o dia e o horário, como \*dentista quinta às 15h\*/);
  assert.equal(await pendingEvent(), null);
  await say(ASK);
  const fresh = await db.userById(user.id);
  assert.match(await assistant.handlePanel({ user: fresh, text: 'amanhã às 10', now: NOW }), /\*Reunião com José\*: amanhã, às 10:00/);
  assert.equal((await allAppointments())[0].source, 'app');
});

test('com o teste grátis vencido, a resposta não marca nada', async () => {
  const user = await signUp();
  await say(ASK);
  await db.setTrialEnd(user.id, new Date('2020-01-01T00:00:00Z'));
  assert.match(await assistant.handlePanel({ user: await db.userById(user.id), text: 'amanhã às 10', now: NOW }), /teste grátis terminou/);
  assert.equal((await allAppointments()).length, 0);
});

test('o evento guardado é de cada pessoa, e a limpeza diária apaga o que venceu', async () => {
  await signUp();
  await signUp(OTHER);
  await say(ASK);
  assert.match(await say('amanhã às 10', OTHER), /Marcar o quê\?/);
  assert.equal((await allAppointments(OTHER)).length, 0);
  await db.cleanup(new Date(NOW.getTime() + 3 * 60 * 60 * 1000));
  assert.equal(await pendingEvent(), null);
});

test('cada mensagem vai para o assessor certo', async () => {
  await signUp();
  const finance = ['gastei 50 no mercado', 'uber 23,50', 'consulta 200', 'dentista quinta 200', 'resumo', 'últimos', 'categorias'];
  const agenda = ['dentista quinta às 15h', 'reunião com Ana amanhã às 10', 'agenda', 'o que tenho hoje', 'compromissos', 'cancelar dentista', 'marca dentista'];
  for (const text of finance) assert.match(await say(text), /^💰 \*Caio, Assessor Financeiro\*/, text);
  for (const text of agenda) assert.match(await say(text), /^📅 \*Cris, Assessora de Agenda\*/, text);
});

test('compromisso sem horário é do dia todo, com aviso às 8h', async () => {
  await signUp();
  assert.match(await say('reunião amanhã'), /amanhã, o dia todo/);
  const [row] = await allAppointments();
  assert.equal(row.start_time, null);
  assert.equal(new Date(row.remind_at).toISOString(), '2026-11-04T11:00:00.000Z');
});

test('recusa data que já passou', async () => {
  await signUp();
  assert.match(await say('reunião 01/01/2020 às 10h'), /já passou/);
  assert.equal((await allAppointments()).length, 0);
});

test('avisa quando o horário já está ocupado', async () => {
  await signUp();
  await say('dentista quinta às 15h');
  assert.match(await say('reunião quinta às 15h30'), /também tem \*Dentista\*, às 15:00/);
  assert.doesNotMatch(await say('treino quinta às 17h'), /também tem/);
});

test('lista os compromissos do período pedido, em ordem', async () => {
  await signUp();
  await say('reunião amanhã às 10');
  await say('dentista hoje às 15h');
  await say('exame dia 20 às 8h');

  const today = await say('o que tenho hoje');
  assert.match(today, /\*Hoje\*/);
  assert.match(today, /hoje, às 15:00: Dentista/);
  assert.doesNotMatch(today, /Reunião/);

  const all = await say('agenda');
  assert.ok(all.indexOf('Dentista') < all.indexOf('Reunião'));
  assert.ok(all.indexOf('Reunião') < all.indexOf('Exame'));
});

test('remarca e cancela pelo nome', async () => {
  await signUp();
  await say('dentista quinta às 15h');
  assert.match(await say('remarcar dentista para sexta às 10'), /\*Dentista\* agora é sexta, 06\/11, às 10:00/);
  let [row] = await allAppointments();
  assert.equal(row.starts_on, '2026-11-06');
  assert.equal(row.end_time, '11:00');
  assert.equal(new Date(row.remind_at).toISOString(), '2026-11-06T12:00:00.000Z');

  assert.match(await say('muda o dentista pra 16h'), /sexta, 06\/11, às 16:00/);
  [row] = await allAppointments();
  assert.equal(row.starts_on, '2026-11-06');

  assert.match(await say('cancelar dentista'), /Cancelei \*Dentista\*/);
  assert.equal((await allAppointments()).length, 0);
  assert.match(await say('cancelar dentista'), /Não encontrei/);
});

test('desfazer apaga o registro mais recente, seja gasto ou compromisso', async () => {
  await signUp();
  await say('mercado 50');
  await new Promise((done) => setTimeout(done, 5));
  await say('dentista quinta às 15h');
  assert.match(await say('desfazer'), /^📅[\s\S]*Cancelei \*Dentista\*/);
  assert.equal((await allAppointments()).length, 0);
  assert.equal((await allExpenses()).length, 1);
  assert.match(await say('desfazer'), /^💰[\s\S]*Apaguei: Mercado/);
  assert.match(await say('desfazer'), /Não há nada para desfazer/);
});

test('sem Google configurado, não oferece a conexão', async () => {
  await signUp();
  assert.doesNotMatch(await say('dentista quinta às 15h'), /Google/);
  assert.match(await say('conectar google'), /ainda não está disponível/);
});

// Conta

test('apagar a conta exige confirmação e remove tudo', async () => {
  const user = await signUp();
  await say('mercado 50');
  await say('dentista quinta às 15h');

  assert.match(await say('confirmar exclusão'), /mande primeiro/);
  assert.ok(await db.userById(user.id));

  assert.match(await say('apagar minha conta'), /sem volta/);
  assert.ok(await db.userById(user.id));

  assert.match(await say('confirmar exclusão'), /Apaguei sua conta/);
  assert.equal(await db.userById(user.id), null);
  assert.equal(await db.userByPhone(OWNER), null);
});

test('a confirmação de exclusão vence em 10 minutos', async () => {
  const user = await signUp();
  await say('apagar minha conta');
  const later = new Date(NOW.getTime() + 11 * 60 * 1000);
  assert.match(await say('confirmar exclusão', OWNER, later), /mande primeiro/);
  assert.ok(await db.userById(user.id));
});

test('limite diário protege o custo: avisa uma vez e para de responder', async () => {
  config = testConfig({ LIMITE_MENSAGENS_DIA: '2' });
  assistant = createAssistant({ db, config, google: noGoogle, mailer });
  await signUp();
  assert.ok(await say('mercado 1'));
  assert.ok(await say('mercado 2'));
  assert.match(await say('mercado 3'), /limite de 2 mensagens/);
  assert.equal(await say('mercado 4'), null);
  assert.equal((await allExpenses()).length, 2);
  // No dia seguinte volta ao normal.
  assert.ok(await say('mercado 5', OWNER, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)));
});

test('teste vencido: não anota, avisa uma vez por dia e mantém conta e dados', async () => {
  config = testConfig({ ASSINATURA_URL: 'https://pagar.test' });
  assistant = createAssistant({ db, config, google: noGoogle, mailer });
  await signUp();
  await say('mercado 50');
  const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
  const nextDay = new Date(later.getTime() + 24 * 60 * 60 * 1000);

  const blocked = await say('uber 20', OWNER, later);
  assert.match(blocked, /teste grátis terminou/);
  assert.match(blocked, /https:\/\/pagar\.test/);
  assert.equal(await say('uber 20', OWNER, later), null);
  assert.equal(await say('dentista quinta às 15h', OWNER, later), null);
  assert.match(await say('uber 20', OWNER, nextDay), /teste grátis terminou/);
  assert.equal((await allExpenses()).length, 1);
  assert.equal((await allAppointments()).length, 0);

  // Abrir o site, assinar e apagar a conta continuam disponíveis.
  assert.match(await say('entrar', OWNER, nextDay), /https:\/\/app\.test/);
  assert.match(await say('assinar', OWNER, nextDay), /https:\/\/pagar\.test/);
  assert.match(await say('apagar minha conta', OWNER, nextDay), /sem volta/);
});

test('assinatura em dia libera o uso depois do teste', async () => {
  const user = await signUp();
  const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
  await db.setPaidUntil(user.id, new Date(later.getTime() + 30 * 24 * 60 * 60 * 1000));
  assert.match(await say('uber 20', OWNER, later), /R\$ 20,00/);
  assert.match(await say('assinar', OWNER, later), /assinatura está ativa até/);
});

test('áudio e foto recebem orientação sem criar registro', async () => {
  await signUp();
  const reply = await assistant.handleWhatsApp({ from: OWNER, text: '', isText: false, sentAt: NOW });
  assert.match(reply, /só entendo mensagens de texto/);
  assert.equal((await allExpenses()).length, 0);
});

test('conversa no app usa os mesmos assessores', async () => {
  const user = await signUp();
  const reply = await assistant.handlePanel({ user, text: 'mercado 50', now: NOW });
  assert.match(reply, /^💰/);
  assert.equal((await allExpenses())[0].source, 'app');
  assert.match(await assistant.handlePanel({ user, text: 'entrar', now: NOW }), /já está no app/);
});

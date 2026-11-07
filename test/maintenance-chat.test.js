import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAssistant } from '../src/assistant.js';
import { parseApproxMonth, parseExpense, parseServiceText } from '../src/parser.js';
import { withoutVehicleMention } from '../src/vehicles.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OTHER, OWNER, quiet, testConfig } from './helpers.js';

// Quinta-feira, meio-dia em São Paulo.
const NOW = new Date('2026-11-05T15:00:00Z');
const TODAY = '2026-11-05';
const YESTERDAY = '2026-11-04';
const AFTER_TIME_LIMIT = new Date(NOW.getTime() + 2 * 60 * 60 * 1000 + 1000);

let db;
let reset;
let assistant;
let config;

before(async () => {
  ({ db, reset } = await createTestDb());
  config = testConfig();
  assistant = createAssistant({ db, config, google: noGoogle, mailer: fakeMailer(), log: quiet });
});
after(() => db.close());
beforeEach(() => reset());

const say = (text, { from = OWNER, sentAt = NOW } = {}) => assistant.handleWhatsApp({ from, text, sentAt });

async function setup(...vehicles) {
  const user = await createAccount(db, { phone: OWNER, at: NOW });
  const store = db.forUser(user.id);
  const created = [];
  for (const name of vehicles) created.push(await store.createVehicle({ name, plate: null }));
  return { user, store, vehicles: created };
}

const QUESTIONS = {
  vehicle: /Qual é o veículo|Foi no \*|Em qual veículo/,
  what: /Qual foi a manutenção/,
  place: /Onde foi feita/,
  date: /Quando foi feita/,
  amount: /Qual foi o valor/,
};

// Leitura do texto

test('a distância nunca vira valor', () => {
  assert.equal(parseExpense('uber 20 12 km', TODAY).amountCents, 2000);
  assert.equal(parseExpense('corrida 15 km', TODAY), null);
  assert.equal(parseExpense('gasolina 200 rodei 500 km', TODAY).amountCents, 20000);
  assert.equal(parseExpense('mercado 50', TODAY).amountCents, 5000);
  assert.equal(parseServiceText('óleo 250 com 85.000 km', TODAY).odometerKm, 85000);
  assert.equal(parseServiceText('óleo 250 com 85.000 km', TODAY).amountCents, 25000);
  assert.equal(parseServiceText('óleo aos 90 mil km', TODAY).odometerKm, 90000);
  assert.equal(parseServiceText('óleo', TODAY).odometerKm, null);
});

test('serviço pode vir sem valor e sem data', () => {
  assert.deepEqual(parseServiceText('troca de óleo', TODAY), { description: 'Troca de óleo', date: null, amountCents: 0, installments: 1, odometerKm: null });
  const full = parseServiceText('pneu 1200 em 3x ontem', TODAY);
  assert.equal(full.description, 'Pneu');
  assert.equal(full.date, YESTERDAY);
  assert.equal(full.amountCents, 120000);
  assert.equal(full.installments, 3);
});

test('o ano e o nome do veículo saem do texto, sem levar o resto', () => {
  const vehicles = [{ name: 'Honda Civic 2018' }];
  assert.equal(withoutVehicleMention('troca de óleo do civic 2018 250', vehicles), 'troca de óleo 250');
  assert.equal(withoutVehicleMention('troca de óleo do honda civic', vehicles), 'troca de óleo');
  assert.equal(withoutVehicleMention('pneu no meu carro 300', []), 'pneu 300');
  assert.equal(withoutVehicleMention('Troca de óleo', []), 'Troca de óleo');
});

test('o mês basta quando não se lembra o dia', () => {
  assert.equal(parseApproxMonth('03/2024', TODAY), '2024-03-01');
  assert.equal(parseApproxMonth('março de 2024', TODAY), '2024-03-01');
  assert.equal(parseApproxMonth('em março', TODAY), '2026-03-01');
  assert.equal(parseApproxMonth('dezembro', TODAY), '2025-12-01');
  assert.equal(parseApproxMonth('13/2024', TODAY), null);
  assert.equal(parseApproxMonth('qualquer coisa', TODAY), null);
});

// Só pergunta o que falta

test('com tudo na mensagem, anota sem nenhuma pergunta', async () => {
  const { store, vehicles: [civic] } = await setup('Honda Civic 2018', 'Yamaha Fazer');
  const reply = await say('troca de óleo do civic 250 na oficina do zé ontem com 85.000 km');
  assert.match(reply, /^💰 \*Caio, Assessor Financeiro\*\n✅ \*Manutenção anotada\* no histórico de \*Honda Civic 2018\*/);
  assert.match(reply, /🔧 Troca de óleo\n📍 Oficina do zé\n📅 04\/11\/2026\n🛣️ 85\.000 km\n💵 R\$ 250,00/);
  for (const question of Object.values(QUESTIONS)) assert.doesNotMatch(reply, question);
  assert.equal(await store.pendingService(NOW), null);
  const [row] = await store.maintenanceHistory();
  assert.deepEqual(
    { what: row.description, vehicle: row.vehicle_id, place: row.place, date: row.spent_on, cents: row.amount_cents, km: row.odometer_km },
    { what: 'Troca de óleo', vehicle: civic.id, place: 'Oficina do zé', date: YESTERDAY, cents: 25000, km: 85000 },
  );
});

test('pergunta na ordem pedida: veículo, manutenção, lugar, data e valor', async () => {
  const { store, vehicles: [civic] } = await setup('Honda Civic');
  const first = await say('fiz uma manutenção');
  assert.match(first, QUESTIONS.vehicle);
  assert.match(first, /Para desistir, mande \*cancelar\*/);
  assert.equal((await store.maintenanceHistory()).length, 0);
  assert.match(await say('sim'), QUESTIONS.what);
  assert.match(await say('troca da correia dentada'), QUESTIONS.place);
  assert.match(await say('na concessionária'), QUESTIONS.date);
  assert.match(await say('15/10'), QUESTIONS.amount);
  assert.equal((await store.maintenanceHistory()).length, 0);
  const done = await say('1.250,50');
  assert.match(done, /Manutenção anotada/);
  assert.match(done, /💵 R\$ 1\.250,50/);
  assert.doesNotMatch(done, /Sem valor/);
  const [row] = await store.maintenanceHistory();
  assert.deepEqual(
    { what: row.description, vehicle: row.vehicle_id, place: row.place, date: row.spent_on, cents: row.amount_cents },
    { what: 'Troca da correia dentada', vehicle: civic.id, place: 'Concessionária', date: '2026-10-15', cents: 125050 },
  );
});

test('valor: aceita os jeitos comuns de dizer, inclusive parcelado', async () => {
  const { store } = await setup('Honda Civic');
  for (const [answer, cents] of [['250', 25000], ['R$ 250,90', 25090], ['250 reais', 25000], ['foi 300', 30000], ['1 mil', 100000], ['uns 450', 45000], ['custou 80 no total', 8000]]) {
    assert.match(await say('freio do civic na oficina ontem'), QUESTIONS.amount, answer);
    assert.match(await say(answer), /Manutenção anotada/, answer);
    assert.equal((await store.lastExpense()).amount_cents, cents, answer);
  }
  await say('pneu do civic na borracharia ontem');
  assert.match(await say('1200 em 3x'), /R\$ 1\.200,00 em 3x/);
  assert.equal((await store.maintenanceHistory()).find((row) => row.description === 'Pneu').total_cents, 120000);
});

test('valor: pular, não lembrar e garantia salvam sem valor, sem mexer nas finanças', async () => {
  const { store } = await setup('Honda Civic');
  for (const answer of ['pular', 'não lembro', 'não sei', 'na garantia', 'de graça', '0']) {
    await say('freio do civic na oficina ontem');
    const done = await say(answer);
    assert.match(done, /Manutenção anotada/, answer);
    assert.match(done, /Sem valor, ela não muda suas finanças/, answer);
    assert.equal((await store.lastExpense()).amount_cents, 0, answer);
  }
  assert.equal((await store.total('2026-11-01', '2026-12-01')).total_cents, 0);
});

test('valor: o que não é valor é perguntado de novo, sem anotar', async () => {
  const { store } = await setup('Honda Civic');
  await say('freio do civic na oficina ontem');
  assert.match(await say('sim'), /Não entendi[\s\S]*Qual foi o valor/);
  assert.match(await say('caro demais'), /Não entendi[\s\S]*Qual foi o valor/);
  assert.equal((await store.allExpenses()).length, 0);
  assert.match(await say('200'), /Manutenção anotada/);
});

test('valor: outro gasto no meio da pergunta não vira o valor da manutenção', async () => {
  const { store } = await setup('Honda Civic');
  await say('freio do civic na oficina ontem');
  const reply = await say('mercado 50');
  assert.match(reply, /🛒 Mercado/);
  assert.match(reply, /Ainda falta um detalhe da manutenção\. Qual foi o valor/);
  assert.match(await say('200'), /R\$ 200,00/);
  assert.deepEqual((await store.allExpenses()).map((row) => [row.description, row.amount_cents]).sort(), [['Freio', 20000], ['Mercado', 5000]]);
});

test('valor que veio na frase não é perguntado', async () => {
  await setup('Honda Civic');
  assert.doesNotMatch(await say('freio do civic 200 na oficina'), QUESTIONS.amount);
  await say('cancelar');
  await say('fiz uma manutenção no civic');
  assert.match(await say('freio 200 na oficina'), QUESTIONS.date);
  assert.match(await say('ontem'), /R\$ 200,00/);
});

test('a data é perguntada quando não vem, em vez de assumir hoje', async () => {
  const { store } = await setup('Honda Civic');
  assert.match(await say('troca de óleo do civic 250 na oficina do zé'), QUESTIONS.date);
  assert.equal((await store.allExpenses()).length, 0);
  await say('ontem');
  assert.equal((await store.maintenanceHistory())[0].spent_on, YESTERDAY);
});

test('o que a frase já traz não é perguntado de novo', async () => {
  await setup('Honda Civic');
  const levei = await say('levei o civic na oficina do zé ontem 300');
  assert.match(levei, QUESTIONS.what);
  assert.doesNotMatch(levei, QUESTIONS.vehicle);
  assert.match(await say('embreagem'), /Manutenção anotada/);
});

test('uma resposta pode trazer mais de uma coisa', async () => {
  const { store } = await setup('Honda Civic');
  assert.match(await say('fiz uma manutenção no civic'), QUESTIONS.what);
  assert.match(await say('troca de óleo 250 na oficina do zé ontem'), /Manutenção anotada/);
  const [row] = await store.maintenanceHistory();
  assert.deepEqual([row.description, row.place, row.spent_on, row.amount_cents], ['Troca de óleo', 'Oficina do zé', YESTERDAY, 25000]);
});

test('o lugar pode trazer a data junto', async () => {
  const { store } = await setup('Honda Civic');
  assert.match(await say('troca de óleo do civic 250'), QUESTIONS.place);
  assert.match(await say('foi na oficina do zé ontem'), /Manutenção anotada/);
  const [row] = await store.maintenanceHistory();
  assert.deepEqual([row.place, row.spent_on], ['Oficina do zé', YESTERDAY]);
});

test('o ano do veículo e a quilometragem não viram valor', async () => {
  const { store } = await setup('Honda Civic 2018');
  assert.match(await say('troca de óleo do civic 2018 na oficina do zé ontem'), QUESTIONS.amount);
  await say('pular');
  assert.match(await say('pneu do civic com 90 mil km na borracharia hoje'), QUESTIONS.amount);
  await say('pular');
  const rows = await store.maintenanceHistory();
  assert.deepEqual(rows.map((row) => row.amount_cents), [0, 0]);
  assert.equal(rows[0].odometer_km, 90000);
});

test('frases comuns de manutenção entram na conversa', async () => {
  await setup('Honda Civic');
  for (const text of ['levei o carro na oficina do zé 300', 'troquei o óleo', 'revisão no carro 800', 'conserto da moto 200', 'troquei a lâmpada do carro', 'alinhamento 80', 'manutenção 300']) {
    assert.match(await say(text), /Vou anotar essa manutenção/, text);
    await say('cancelar');
  }
});

// Veículo

test('veículo: com vários, responde pelo número ou pelo nome', async () => {
  const { store, vehicles: [civic, fazer] } = await setup('Honda Civic', 'Yamaha Fazer');
  const list = await say('freio 200 na oficina ontem');
  assert.match(list, /1\. Honda Civic\n2\. Yamaha Fazer/);
  assert.match(await say('9'), /Não entendi/);
  assert.match(await say('sim'), /Não entendi/);
  assert.match(await say('2'), /Manutenção anotada/);
  assert.equal((await store.maintenanceHistory())[0].vehicle_id, fazer.id);

  await say('pneu 300 na borracharia ontem');
  assert.match(await say('foi no civic'), /Manutenção anotada/);
  assert.equal((await store.maintenanceHistory()).find((row) => row.description === 'Pneu').vehicle_id, civic.id);
  assert.equal((await store.vehicles()).length, 2);
});

test('veículo: nome com dúvida não decide e não cadastra outro', async () => {
  const { store } = await setup('Honda Civic', 'Honda Biz');
  await say('alinhamento 80 na oficina ontem');
  assert.match(await say('honda'), /Não entendi/);
  assert.equal((await store.vehicles()).length, 2);
  assert.match(await say('biz'), /Manutenção anotada/);
});

test('veículo: sem nenhum cadastrado, a resposta já cadastra', async () => {
  const { store } = await setup();
  assert.match(await say('troca de óleo 250 na oficina ontem'), /Mande o nome, como \*Honda Civic 2018\*/);
  const done = await say('Fusca 1970');
  assert.match(done, /Cadastrei o veículo \*Fusca 1970\*/);
  assert.match(done, /no histórico de \*Fusca 1970\*/);
  assert.deepEqual((await store.vehicles()).map((row) => row.name), ['Fusca 1970']);
});

test('veículo: pode ser outro, além do que está cadastrado', async () => {
  const { store } = await setup('Honda Civic');
  assert.match(await say('freio 200 na oficina ontem'), /Foi no \*Honda Civic\*/);
  assert.match(await say('não'), /Qual é o veículo, então/);
  assert.match(await say('não, foi no Fiat Uno'), /Cadastrei o veículo \*Fiat Uno\*/);
  assert.deepEqual((await store.vehicles()).map((row) => row.name), ['Honda Civic', 'Fiat Uno']);
});

test('veículo: resposta de outra pergunta não vira veículo', async () => {
  const { store } = await setup('Honda Civic');
  await say('troca de óleo 250');
  assert.match(await say('ontem'), /Não entendi/);
  assert.match(await say('oficina do zé'), /Não entendi/);
  assert.deepEqual((await store.vehicles()).map((row) => row.name), ['Honda Civic']);
  // A data que veio antes da hora fica guardada.
  assert.match(await say('sim'), QUESTIONS.place);
  assert.match(await say('pular'), /Manutenção anotada/);
  assert.equal((await store.maintenanceHistory())[0].spent_on, YESTERDAY);
});

test('veículo: pular deixa sem veículo, e a manutenção aparece para escolher depois', async () => {
  const { store } = await setup('Honda Civic');
  await say('freio 200 na oficina ontem');
  assert.match(await say('pular'), /sem veículo definido/);
  assert.equal((await store.maintenanceHistory())[0].vehicle_id, null);
});

// Outras respostas

test('lugar: pular ou não lembrar deixa em branco; sim e não são perguntados de novo', async () => {
  const { store } = await setup('Honda Civic');
  await say('freio do civic 200 ontem');
  assert.match(await say('sim'), /Não entendi/);
  assert.match(await say('não lembro'), /Manutenção anotada/);
  assert.equal((await store.maintenanceHistory())[0].place, null);
});

test('data: o mês serve; o que não é data é perguntado de novo, sem inventar', async () => {
  const { store } = await setup('Honda Civic');
  await say('correia do civic na oficina');
  assert.match(await say('talvez semana que vem'), /Não entendi/);
  assert.match(await say('31/02/2025'), /Não entendi/);
  assert.equal((await store.allExpenses()).length, 0);
  assert.match(await say('março de 2024'), QUESTIONS.amount);
  assert.match(await say('pular'), /01\/03\/2024/);
  assert.equal((await store.maintenanceHistory())[0].spent_on, '2024-03-01');
});

test('o que foi feito: frase vaga é perguntada de novo', async () => {
  await setup('Honda Civic');
  await say('fiz uma manutenção no civic');
  assert.match(await say('levei na oficina'), /Não entendi/);
  assert.match(await say('alinhamento'), QUESTIONS.place);
});

test('banco sem conta cadastrada não vira lugar, e conta cadastrada fica ligada', async () => {
  const { store } = await setup('Honda Civic');
  assert.match(await say('freio do civic 200 ontem no nubank'), QUESTIONS.place);
  await say('oficina do zé');
  let [row] = await store.maintenanceHistory();
  assert.deepEqual([row.description, row.place], ['Freio', 'Oficina do zé']);

  const account = await store.createAccount({ name: 'Itaú', kind: 'conta', openingCents: 0 });
  await say('alinhamento do civic 90 no itaú ontem na oficina do zé');
  [row] = (await store.maintenanceHistory()).filter((item) => item.description === 'Alinhamento');
  assert.equal(row.account_id, account.id);
  assert.equal(row.place, 'Oficina do zé');
});

test('parcelado guarda os detalhes uma vez e soma o total', async () => {
  const { store } = await setup('Honda Civic');
  await say('pneu do civic 1200 em 3x na borracharia');
  assert.match(await say('ontem'), /R\$ 1\.200,00 em 3x/);
  assert.equal((await store.allExpenses()).length, 3);
  const history = await store.maintenanceHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].total_cents, 120000);
});

// Sair da conversa

test('cancelar desiste sem apagar o último lançamento', async () => {
  const { store } = await setup('Honda Civic');
  await say('mercado 50');
  await say('troca de óleo 250');
  assert.match(await say('cancelar'), /não anotei essa manutenção/);
  assert.equal(await store.pendingService(NOW), null);
  assert.deepEqual((await store.allExpenses()).map((row) => row.description), ['Mercado']);
  // Sem conversa em aberto, cancelar volta a desfazer.
  assert.match(await say('cancelar'), /Apaguei/);
  assert.equal((await store.allExpenses()).length, 0);
});

test('assunto novo é atendido, e a pergunta volta no fim', async () => {
  const { store } = await setup('Honda Civic');
  await say('troca de óleo 250');

  const gasto = await say('mercado 50');
  assert.match(gasto, /🛒 Mercado/);
  assert.match(gasto, /Ainda falta um detalhe da manutenção\. Foi no \*Honda Civic\*/);

  const compromisso = await say('dentista amanhã às 15h');
  assert.match(compromisso, /Cris, Assessora de Agenda/);
  assert.match(compromisso, /Ainda falta um detalhe/);

  const tarefa = await say('tarefa pagar luz');
  assert.match(tarefa, /Nina, Assessora de Tarefas/);
  assert.match(tarefa, /Ainda falta um detalhe/);

  const resumo = await say('resumo');
  assert.match(resumo, /Total/);
  assert.match(resumo, /Ainda falta um detalhe/);

  assert.match(await say('ajuda'), /Ainda falta um detalhe/);
  assert.match(await say('sim'), QUESTIONS.place);
  await say('oficina do zé');
  assert.match(await say('ontem'), /Manutenção anotada/);
  assert.deepEqual((await store.allExpenses()).map((row) => row.description).sort(), ['Mercado', 'Troca de óleo']);
  assert.equal(await store.pendingService(NOW), null);
});

test('previsão no meio da conversa não vira resposta', async () => {
  const { store } = await setup('Honda Civic');
  await say('troca de óleo 250');
  const reply = await say('vou pagar 300 de luz dia 20');
  assert.match(reply, /Previsto/);
  assert.match(reply, /Ainda falta um detalhe/);
  assert.equal((await store.pendingService(NOW)).date, null);
});

test('número no nome da oficina não vira gasto', async () => {
  const { store } = await setup('Honda Civic');
  await say('freio do civic 200 ontem');
  assert.match(await say('Auto Center 2000'), /Manutenção anotada/);
  const [row] = await store.maintenanceHistory();
  assert.deepEqual([row.place, row.amount_cents], ['Auto Center 2000', 20000]);
  assert.equal((await store.allExpenses()).length, 1);
});

test('depois de 2 horas, a conversa acaba sozinha', async () => {
  const { store } = await setup('Honda Civic');
  await say('troca de óleo 250');
  assert.ok(await store.pendingService(NOW));
  assert.equal(await store.pendingService(AFTER_TIME_LIMIT), null);
  assert.match(await say('Oficina do Zé', { sentAt: AFTER_TIME_LIMIT }), /Vou anotar essa manutenção/);
  await say('cancelar', { sentAt: AFTER_TIME_LIMIT });

  await say('troca de óleo 250');
  await db.cleanup(AFTER_TIME_LIMIT);
  assert.equal(await store.pendingService(NOW), null);
});

// Onde não deve perguntar

test('o que não é manutenção continua igual', async () => {
  const { store } = await setup('Honda Civic');
  for (const [text, expected] of [
    ['quanto gastei com oficina', /Não encontrei/],
    ['como trocar pneu?', /Não entendi/],
    ['qual o melhor pneu', /Não entendi/],
    ['levar carro na oficina amanhã às 15h', /Cris, Assessora de Agenda/],
    ['tarefa levar carro na oficina', /Nina, Assessora de Tarefas/],
    ['gasolina 200', /🚗 Transporte/],
    ['seguro do carro 900', /🚗 Transporte/],
    ['lavagem do carro 40', /🚗 Transporte/],
    ['revisão de contrato 500', /📦 Outros/],
    ['manutenção do ar condicionado 200', /📦 Outros/],
    ['recebi 300 da oficina', /de entrada/],
    ['mercado 50', /🛒 Mercado/],
  ]) {
    const reply = await say(text);
    assert.match(reply, expected, text);
    assert.doesNotMatch(reply, /Vou anotar essa manutenção/, text);
    assert.equal(await store.pendingService(NOW), null, text);
  }
});

test('várias linhas de uma vez e repetição seguem sem perguntas', async () => {
  const { store } = await setup('Honda Civic');
  assert.match(await say('troca de óleo 250\nmercado 50'), /Anotei 2 gastos/);
  assert.equal(await store.pendingService(NOW), null);
  assert.equal((await store.maintenanceHistory())[0].vehicle_name, 'Honda Civic');
  assert.match(await say('revisão do carro 800 todo ano'), /todo ano/);
  assert.equal(await store.pendingService(NOW), null);
});

test('as perguntas da manutenção e da agenda andam juntas, sem uma pegar a resposta da outra', async () => {
  const { store } = await setup('Honda Civic');
  await say('agendar reunião com José');
  const started = await say('troca de óleo');
  assert.match(started, QUESTIONS.vehicle);
  assert.match(started, /📅 E \*Reunião com José\*, para quando\?/);
  assert.match(await say('sim'), QUESTIONS.place);
  assert.match(await say('oficina do zé'), QUESTIONS.date);
  assert.match(await say('ontem'), QUESTIONS.amount);
  const finished = await say('250');
  assert.match(finished, /Manutenção anotada/);
  assert.match(finished, /📅 E \*Reunião com José\*, para quando\?/);
  assert.equal((await store.maintenanceHistory()).length, 1);
  assert.equal((await store.allAppointments()).length, 0);
  assert.match(await say('amanhã às 10'), /\*Reunião com José\*: amanhã, às 10:00/);
  assert.equal(await store.pendingEvent(NOW), null);
});

test('resposta na hora em que o teste grátis já venceu não anota', async () => {
  const { store, user } = await setup('Honda Civic');
  await say('troca de óleo 250');
  await db.setTrialEnd(user.id, new Date('2020-01-01T00:00:00Z'));
  assert.match(await assistant.handlePanel({ user: await db.userById(user.id), text: 'sim', now: NOW }), /teste grátis terminou/);
  assert.equal((await store.allExpenses()).length, 0);
});

// Conta

test('a conversa continua do WhatsApp para o site, e depois de reiniciar o app', async () => {
  const { user, store } = await setup('Honda Civic');
  await say('troca de óleo 250 na oficina');
  const restarted = createAssistant({ db, config, google: noGoogle, mailer: fakeMailer(), log: quiet });
  const fresh = await db.userById(user.id);
  assert.match(await restarted.handlePanel({ user: fresh, text: 'sim', now: NOW }), QUESTIONS.date);
  assert.match(await restarted.handlePanel({ user: fresh, text: 'ontem', now: NOW }), /Manutenção anotada/);
  assert.equal((await store.maintenanceHistory())[0].source, 'app');
});

test('a conversa de uma pessoa não se mistura com a de outra', async () => {
  const { store } = await setup('Honda Civic');
  const other = await createAccount(db, { phone: OTHER, at: NOW });
  await say('troca de óleo 250');
  assert.match(await say('sim', { from: OTHER }), /Não entendi/);
  assert.equal(await db.forUser(other.id).pendingService(NOW), null);
  assert.equal((await store.pendingService(NOW)).asking, 'vehicle');
  await db.deleteUser(other.id);
  assert.ok(await store.pendingService(NOW));
});

test('apagar a conta leva a conversa em aberto junto', async () => {
  const { user, store } = await setup('Honda Civic');
  await say('troca de óleo 250');
  await db.deleteUser(user.id);
  assert.equal(await store.pendingService(NOW), null);
});

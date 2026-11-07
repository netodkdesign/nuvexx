import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAgenda } from '../src/agenda-parser.js';

// 3 de novembro de 2026 é uma terça-feira; o relógio marca 12:00.
const TODAY = '2026-11-03';
const NOW = '12:00';

const CREATES = [
  ['Marca o dentista quinta às três da tarde', { title: 'Dentista', date: '2026-11-05', time: '15:00', endTime: '16:00' }],
  ['dentista quinta às 15h', { title: 'Dentista', date: '2026-11-05', time: '15:00' }],
  ['Reunião com Ana amanhã às 10', { title: 'Reunião com Ana', date: '2026-11-04', time: '10:00' }],
  ['reunião às 15h com Ana amanhã', { title: 'Reunião com Ana', date: '2026-11-04', time: '15:00' }],
  ['marcar pediatra dia 20 às 9:30', { title: 'Pediatra', date: '2026-11-20', time: '09:30' }],
  ['consulta 20/11 14:30', { title: 'Consulta', date: '2026-11-20', time: '14:30' }],
  ['consulta dia 15 às 14h', { title: 'Consulta', date: '2026-11-15', time: '14:00', endTime: '15:00' }],
  ['consulta dia 1 às 14h', { title: 'Consulta', date: '2026-12-01', time: '14:00' }],
  ['exame 12 de dezembro às 8h', { title: 'Exame', date: '2026-12-12', time: '08:00' }],
  ['exame 10/01 às 8h', { title: 'Exame', date: '2027-01-10', time: '08:00' }],
  ['aula de inglês depois de amanhã 19h30', { title: 'Aula de inglês', date: '2026-11-05', time: '19:30' }],
  ['me lembra de pagar a luz amanhã às 9', { title: 'Pagar a luz', date: '2026-11-04', time: '09:00' }],
  ['almoço com João ao meio-dia de sexta', { title: 'Almoço com João', date: '2026-11-06', time: '12:00' }],
  ['treino hoje às 7 da noite', { title: 'Treino', date: TODAY, time: '19:00' }],
  ['reunião das 14h às 16h na sexta', { title: 'Reunião', date: '2026-11-06', time: '14:00', endTime: '16:00' }],
  ['reunião sexta 14h por 2 horas', { title: 'Reunião', date: '2026-11-06', time: '14:00', endTime: '16:00' }],
  ['call amanhã 10h por meia hora', { title: 'Call', date: '2026-11-04', time: '10:00', endTime: '10:30' }],
  // Só o horário: hoje, se ainda não passou; senão, amanhã.
  ['dentista às 15h', { title: 'Dentista', date: TODAY, time: '15:00' }],
  ['dentista às 9h', { title: 'Dentista', date: '2026-11-04', time: '09:00' }],
  // Dia da semana igual a hoje: hoje, se o horário ainda não passou.
  ['dentista terça às 15h', { title: 'Dentista', date: TODAY, time: '15:00' }],
  ['dentista terça às 9h', { title: 'Dentista', date: '2026-11-10', time: '09:00' }],
  ['dentista próxima terça às 15h', { title: 'Dentista', date: '2026-11-10', time: '15:00' }],
  // Sem horário: o dia todo.
  ['reunião amanhã', { title: 'Reunião', date: '2026-11-04', time: null, endTime: null }],
  ['agenda dentista quinta', { title: 'Dentista', date: '2026-11-05', time: null }],
  // O pedido em volta não faz parte do nome.
  ['agendar minha reunião com José amanhã às 10', { title: 'Reunião com José', date: '2026-11-04', time: '10:00' }],
  ['AGENDAR MINHA REUNIÃO COM JOSÉ AMANHÃ ÀS 10', { title: 'REUNIÃO COM JOSÉ', date: '2026-11-04', time: '10:00' }],
  ['quero agendar minha reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['adicionar a minha agenda uma reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['adiciona na minha agenda reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['adicione à agenda a reunião com José amanhã 10h', { title: 'Reunião com José' }],
  ['coloca na agenda reunião com José amanhã 10h', { title: 'Reunião com José' }],
  ['colocar na agenda reunião com José amanhã 10h', { title: 'Reunião com José' }],
  ['pode marcar uma reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['preciso agendar uma reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['marca pra mim uma reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['cria um evento reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['criar evento de lançamento amanhã às 10', { title: 'Lançamento' }],
  ['Cris, marca reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['cris marca reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['oi cris, pode agendar uma reunião com José amanhã às 10 por favor', { title: 'Reunião com José' }],
  ['bom dia, gostaria de marcar uma consulta amanhã às 10', { title: 'Consulta' }],
  ['reunião com José amanhã às 10 na minha agenda', { title: 'Reunião com José' }],
  ['reunião com José amanhã às 10, adiciona na agenda', { title: 'Reunião com José' }],
  ['reunião com José amanhã às 10, pode colocar na minha agenda por favor', { title: 'Reunião com José' }],
  ['tenho reunião com José amanhã às 10', { title: 'Reunião com José' }],
  ['quero agendar reunião na sala 3 amanhã às 10', { title: 'Reunião na sala 3' }],
  ['marca na agenda amanhã às 10', { title: 'Compromisso' }],
  // O que parece pedido, mas é o nome.
  ['minha mãe no médico amanhã às 10', { title: 'Minha mãe no médico' }],
  ['agendar minha mãe no médico amanhã às 10', { title: 'Minha mãe no médico' }],
  ['Cris e Ana no shopping amanhã às 15', { title: 'Cris e Ana no shopping' }],
  ['revisão da agenda do time amanhã às 10', { title: 'Revisão da agenda do time' }],
  ['reunião sobre a agenda amanhã às 10', { title: 'Reunião sobre a agenda' }],
  ['criar apresentação amanhã às 10', { title: 'Criar apresentação' }],
  ['evento da empresa amanhã às 10', { title: 'Evento da empresa' }],
];

for (const [input, expected] of CREATES) {
  test(`marcar: "${input}"`, () => {
    const parsed = parseAgenda(input, TODAY, NOW);
    assert.equal(parsed?.type, 'agenda_create', JSON.stringify(parsed));
    for (const [key, value] of Object.entries(expected)) assert.equal(parsed[key], value, key);
  });
}

// O que é do Assessor Financeiro precisa passar direto.
const NOT_AGENDA = [
  'gastei 50 no mercado', 'uber 23,50', 'mercado', '50', 'almoço 35 ontem', 'dia 15 gasolina 200', '15/10 feira 80',
  'dentista quinta 200', 'sexta-feira pizza 70', 'na segunda farmácia 30', 'paguei dentista ontem', 'R$ 200 dentista amanhã',
  'consulta 200', 'tv 1200 em 10x', 'gastei 200 no dentista quinta', 'segunda via do boleto 12', 'bla bla',
  // "Adicionar" e "colocar" também valem para gastos.
  'coloca 50 na poupança', 'adiciona gasto de 50 no mercado', 'adicionar 30 de gasolina amanhã', 'anota 50 mercado', 'adiciona mercado',
];

for (const input of NOT_AGENDA) {
  test(`não é agenda: "${input}"`, () => {
    assert.equal(parseAgenda(input, TODAY, NOW), null);
  });
}

test('sem dia nem horário, pergunta para quando', () => {
  assert.deepEqual(parseAgenda('marca dentista', TODAY, NOW), { type: 'agenda_need_when', title: 'Dentista' });
  for (const input of ['agendar minha reunião com José', 'quero agendar uma reunião com José', 'adicionar uma reunião com José na agenda', 'Cris, marca uma reunião com José']) {
    assert.deepEqual(parseAgenda(input, TODAY, NOW), { type: 'agenda_need_when', title: 'Reunião com José' }, input);
  }
});

test('remarcar e cancelar também entendem o pedido educado', () => {
  assert.deepEqual(parseAgenda('quero remarcar o dentista para sexta às 10', TODAY, NOW), {
    type: 'agenda_move', query: 'dentista', date: '2026-11-06', time: '10:00', endTime: '11:00',
  });
  assert.deepEqual(parseAgenda('Cris, pode cancelar o dentista', TODAY, NOW), { type: 'agenda_cancel', query: 'dentista' });
});

const LISTS = [
  ['agenda', null],
  ['minha agenda', null],
  ['compromissos', null],
  ['próximos compromissos', null],
  ['o que tenho hoje', { from: TODAY, to: '2026-11-04', label: 'Hoje' }],
  ['o que eu tenho amanhã?', { from: '2026-11-04', to: '2026-11-05', label: 'Amanhã' }],
  ['agenda de hoje', { from: TODAY, to: '2026-11-04', label: 'Hoje' }],
  ['compromissos da semana', { from: TODAY, to: '2026-11-09', label: 'Esta semana' }],
  ['agenda terça', { from: TODAY, to: '2026-11-04', label: 'Hoje' }],
  ['agenda dia 20', { from: '2026-11-20', to: '2026-11-21', label: null }],
];

for (const [input, range] of LISTS) {
  test(`listar: "${input}"`, () => {
    assert.deepEqual(parseAgenda(input, TODAY, NOW), { type: 'agenda_list', range });
  });
}

test('remarcar entende data, horário ou os dois', () => {
  assert.deepEqual(parseAgenda('remarcar dentista para sexta às 10', TODAY, NOW), {
    type: 'agenda_move', query: 'dentista', date: '2026-11-06', time: '10:00', endTime: '11:00',
  });
  assert.deepEqual(parseAgenda('adiar a reunião para amanhã', TODAY, NOW), {
    type: 'agenda_move', query: 'reuniao', date: '2026-11-04', time: null, endTime: null,
  });
  assert.deepEqual(parseAgenda('muda o dentista pra 16h', TODAY, NOW), {
    type: 'agenda_move', query: 'dentista', date: null, time: '16:00', endTime: '17:00',
  });
});

test('cancelar identifica o compromisso', () => {
  for (const input of ['cancelar dentista', 'desmarca o dentista', 'apagar o compromisso de dentista', 'Cancela meu dentista']) {
    assert.deepEqual(parseAgenda(input, TODAY, NOW), { type: 'agenda_cancel', query: 'dentista' }, input);
  }
});

test('conectar o Google Agenda', () => {
  for (const input of ['conectar google', 'conectar agenda', 'conecta o google agenda', 'sincronizar google', 'google agenda']) {
    assert.deepEqual(parseAgenda(input, TODAY, NOW), { type: 'agenda_connect' }, input);
  }
});

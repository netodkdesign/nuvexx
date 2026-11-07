import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTasks } from '../src/tasks-parser.js';

// 3 de novembro de 2026 é uma terça-feira.
const TODAY = '2026-11-03';

const CREATE = [
  ['tarefa pagar luz sexta', 'Pagar luz', '2026-11-06'],
  ['Nova tarefa: Ligar para o João amanhã', 'Ligar para o João', '2026-11-04'],
  ['anota tarefa comprar pão', 'Comprar pão', null],
  ['preciso comprar leite', 'Comprar leite', null],
  ['tenho que pagar o aluguel dia 10', 'Pagar o aluguel', '2026-11-10'],
  ['me lembra de renovar o seguro dia 20', 'Renovar o seguro', '2026-11-20'],
  ['lembrar de levar o carro na revisão', 'Levar o carro na revisão', null],
  ['tarefa revisar contrato 15/12', 'Revisar contrato', '2026-12-15'],
];

for (const [text, title, date] of CREATE) {
  test(`cria tarefa: "${text}"`, () => {
    const parsed = parseTasks(text, TODAY);
    assert.equal(parsed.type, 'task_create');
    assert.equal(parsed.title, title);
    assert.equal(parsed.date, date);
  });
}

test('tarefa com horário guarda o dia e a hora, sem deixá-los no título', () => {
  const parse = (text, nowTime) => {
    const { title, date, time } = parseTasks(text, TODAY, nowTime);
    return { title, date, time };
  };
  assert.deepEqual(parse('tarefa pagar luz sexta às 15h'), { title: 'Pagar luz', date: '2026-11-06', time: '15:00' });
  assert.deepEqual(parse('tarefa ligar para o banco amanhã 9h30'), { title: 'Ligar para o banco', date: '2026-11-04', time: '09:30' });
  assert.deepEqual(parse('tarefa enviar proposta dia 20 às 3 da tarde'), { title: 'Enviar proposta', date: '2026-11-20', time: '15:00' });
  // Só o horário: hoje, se ainda não passou; senão, amanhã.
  assert.deepEqual(parse('tarefa ligar para Ana às 15h', '10:00'), { title: 'Ligar para Ana', date: TODAY, time: '15:00' });
  assert.deepEqual(parse('tarefa ligar para Ana às 15h', '16:00'), { title: 'Ligar para Ana', date: '2026-11-04', time: '15:00' });
  // Terça dita numa terça: hoje, se a hora ainda não passou.
  assert.equal(parse('tarefa revisar terça às 15h', '10:00').date, TODAY);
  assert.equal(parse('tarefa revisar terça às 15h', '16:00').date, '2026-11-10');
  // Quanto tempo leva não é horário.
  assert.deepEqual(parse('tarefa estudar 3 horas'), { title: 'Estudar 3 horas', date: null, time: null });
});

test('tarefa sem título pede o que fazer', () => {
  assert.equal(parseTasks('tarefa', TODAY).type, 'task_need_title');
  assert.equal(parseTasks('nova tarefa', TODAY).type, 'task_need_title');
});

test('lembrete com horário fica para a agenda', () => {
  assert.equal(parseTasks('me lembra de ligar para o João sexta às 15h', TODAY), null);
  assert.equal(parseTasks('tenho que ir ao médico quinta às 10h', TODAY), null);
});

test('lista as tarefas pendentes, e o período pedido', () => {
  for (const text of ['tarefas', 'minhas tarefas', 'quais as tarefas', 'tarefas pendentes', 'pendências', 'o que tenho que fazer', 'o que preciso fazer?']) {
    assert.deepEqual(parseTasks(text, TODAY), { type: 'task_list', range: null }, text);
  }
  assert.equal(parseTasks('tarefas de hoje', TODAY).range.label, 'Hoje');
  assert.equal(parseTasks('o que tenho que fazer hoje', TODAY).range.label, 'Hoje');
  assert.equal(parseTasks('tarefas de amanhã', TODAY).range.from, '2026-11-04');
  const week = parseTasks('tarefas da semana', TODAY).range;
  assert.equal(week.to, '2026-11-08');
  assert.equal(week.includeOverdue, true);
});

test('conclui, apaga e adia pelo nome', () => {
  assert.deepEqual(parseTasks('concluí pagar luz', TODAY), { type: 'task_done', query: 'pagar luz' });
  assert.deepEqual(parseTasks('terminei a tarefa de pagar luz', TODAY), { type: 'task_done', query: 'pagar luz' });
  assert.deepEqual(parseTasks('feito pagar luz', TODAY), { type: 'task_done', query: 'pagar luz' });
  assert.deepEqual(parseTasks('feito', TODAY), { type: 'task_done', query: '' });
  assert.deepEqual(parseTasks('apagar tarefa pagar luz', TODAY), { type: 'task_delete', query: 'pagar luz' });
  assert.deepEqual(parseTasks('adiar tarefa pagar luz para segunda', TODAY), { type: 'task_move', query: 'pagar luz', date: '2026-11-09', time: null });
  assert.deepEqual(parseTasks('adiar tarefa pagar luz para segunda às 10h', TODAY), { type: 'task_move', query: 'pagar luz', date: '2026-11-09', time: '10:00' });
  assert.deepEqual(parseTasks('mudar tarefa pagar luz para as 18h', TODAY), { type: 'task_move', query: 'pagar luz', date: null, time: '18:00' });
});

test('o que é dos outros assessores passa direto', () => {
  for (const text of ['mercado 50', 'gastei 200 no dentista', 'dentista quinta às 15h', 'resumo', 'agenda', 'o que tenho hoje', 'recebi 3000', 'cancelar dentista', 'desfazer', 'ajuda', '']) {
    assert.equal(parseTasks(text, TODAY), null, text);
  }
});

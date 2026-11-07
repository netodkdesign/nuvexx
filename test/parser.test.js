import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMessage } from '../src/parser.js';
import { parseMoney } from '../src/text.js';

// 3 de novembro de 2026 é uma terça-feira.
const TODAY = '2026-11-03';

const EXPENSES = [
  ['gastei 62 na farmácia', { amountCents: 6200, description: 'Farmácia' }],
  ['uber 23,50', { amountCents: 2350, description: 'Uber' }],
  ['50 mercado', { amountCents: 5000, description: 'Mercado' }],
  ['R$ 1.234,56 aluguel', { amountCents: 123456, description: 'Aluguel' }],
  ['r$50 padaria', { amountCents: 5000, description: 'Padaria' }],
  ['paguei 120 de luz', { amountCents: 12000, description: 'Luz' }],
  ['almoço 35 reais ontem', { amountCents: 3500, description: 'Almoço', date: '2026-11-02' }],
  ['comprei tênis por 300', { amountCents: 30000, description: 'Tênis' }],
  ['Almoço com cliente 80', { amountCents: 8000, description: 'Almoço com cliente' }],
  ['uber para o trabalho 23.50', { amountCents: 2350, description: 'Uber para o trabalho' }],
  ['mercado 2 mil', { amountCents: 200000, description: 'Mercado' }],
  ['viagem 1,5 mil', { amountCents: 150000, description: 'Viagem' }],
  ['notebook 3k', { amountCents: 300000, description: 'Notebook' }],
  ['aluguel 1.800', { amountCents: 180000, description: 'Aluguel' }],
  ['gastei 40 com gasolina.', { amountCents: 4000, description: 'Gasolina' }],
  ['pastel 15 contos', { amountCents: 1500, description: 'Pastel' }],

  // Datas não podem ser confundidas com o valor
  ['dia 15 gasolina 200', { amountCents: 20000, description: 'Gasolina', date: '2026-10-15' }],
  ['gasolina 200 dia 2', { amountCents: 20000, description: 'Gasolina', date: '2026-11-02' }],
  ['15/10 mercado 80,90', { amountCents: 8090, description: 'Mercado', date: '2026-10-15' }],
  ['mercado 80 em 15/10/2025', { amountCents: 8000, description: 'Mercado', date: '2025-10-15' }],
  ['25/12 presente 100', { amountCents: 10000, description: 'Presente', date: '2025-12-25' }],
  ['anteontem pizza 70', { amountCents: 7000, description: 'Pizza', date: '2026-11-01' }],
  ['sexta-feira pizza 70', { amountCents: 7000, description: 'Pizza', date: '2026-10-30' }],
  ['na segunda farmácia 30', { amountCents: 3000, description: 'Farmácia', date: '2026-11-02' }],
  ['terça passada cinema 40', { amountCents: 4000, description: 'Cinema', date: '2026-10-27' }],
  ['segunda via do boleto 12', { amountCents: 1200, description: 'Segunda via do boleto', date: TODAY }],
  ['feira 60', { amountCents: 6000, description: 'Feira', date: TODAY }],
  ['dia 31 mercado 10', { amountCents: 1000, description: 'Mercado', date: '2026-10-31' }],

  // Mais de um número na mensagem
  ['iphone 15 3000', { amountCents: 300000, description: 'Iphone 15' }],
  ['3000 iphone 15', { amountCents: 300000, description: 'Iphone 15' }],
  ['2 pizzas 50', { amountCents: 5000, description: '2 pizzas' }],
  ['gastei 8 em 10 pães', { amountCents: 800, description: '10 pães' }],
  ['99 18', { amountCents: 1800, description: '99' }],
  ['99 18,50', { amountCents: 1850, description: '99' }],
  ['2x pizza 50', { amountCents: 5000, description: '2x pizza', installments: 1 }],

  // Forma de pagamento não faz parte da descrição
  ['mercado 200 no cartão', { amountCents: 20000, description: 'Mercado' }],
  ['padaria 12 no pix', { amountCents: 1200, description: 'Padaria' }],
  ['paguei 500 no cartão', { amountCents: 50000, description: 'Cartão' }],

  // Parcelas
  ['tv 1200 em 10x', { amountCents: 120000, description: 'Tv', installments: 10 }],
  ['sapato 300 3x', { amountCents: 30000, description: 'Sapato', installments: 3 }],
  ['12x de 100 sofá', { amountCents: 120000, description: 'Sofá', installments: 12 }],
  ['3x 50,00 curso', { amountCents: 15000, description: 'Curso', installments: 3 }],
  ['curso 4 parcelas de 80', { amountCents: 32000, description: 'Curso', installments: 4 }],
  ['notebook 3000 parcelado em 6 vezes', { amountCents: 300000, description: 'Notebook', installments: 6 }],
  ['1200 na tv em 10x', { amountCents: 120000, description: 'Tv', installments: 10 }],

  ['50', { amountCents: 5000, description: 'Sem descrição' }],
  ['total 50', { amountCents: 5000, description: 'Total' }],
];

for (const [input, expected] of EXPENSES) {
  test(`gasto: "${input}"`, () => {
    const parsed = parseMessage(input, TODAY);
    assert.equal(parsed.type, 'expense', `tipo era ${parsed.type}`);
    assert.equal(parsed.amountCents, expected.amountCents);
    assert.equal(parsed.description, expected.description);
    assert.equal(parsed.date, expected.date ?? TODAY);
    assert.equal(parsed.installments, expected.installments ?? 1);
  });
}

const INTENTS = [
  ['oi', 'help'], ['Olá!', 'help'], ['ajuda', 'help'], ['?', 'help'], ['', 'help'],
  ['valeu', 'thanks'],
  ['desfazer', 'undo'], ['Apagar o último', 'undo'], ['errei', 'undo'],
  ['categorias', 'categories'],
  ['últimos', 'recent'], ['extrato', 'recent'],
  ['recebi 3000 de salário', 'income'], ['salário 3000', 'income'],
  ['mercado', 'unknown'], ['apagar tudo', 'unknown'], ['bla bla', 'unknown'],
  ['entrar', 'login'], ['senha', 'login'], ['código', 'login'], ['esqueci minha senha', 'login'],
  ['conectar ABCD-2345', 'whatsapp_link'], ['conectar abcd2345', 'whatsapp_link'],
  ['desconectar whatsapp', 'whatsapp_unlink'], ['desconectar meu número', 'whatsapp_unlink'],
  ['assinar', 'subscribe'], ['meu plano', 'subscribe'], ['cancelar assinatura', 'subscribe'],
  ['apagar minha conta', 'delete_account'], ['excluir meus dados', 'delete_account'],
  ['confirmar exclusão', 'confirm_delete'],
];

for (const [input, type] of INTENTS) {
  test(`intenção: "${input}" é ${type}`, () => {
    assert.equal(parseMessage(input, TODAY).type, type);
  });
}

test('correção de categoria identifica o destino', () => {
  for (const input of ['categoria lazer', 'Muda para lazer', 'mudar categoria para lazer', 'era lazer', 'na verdade era de lazer']) {
    assert.deepEqual(parseMessage(input, TODAY), { type: 'recategorize', target: 'lazer' }, input);
  }
});

const SUMMARIES = [
  ['resumo', '2026-11', ''],
  ['Resumo do mês', '2026-11', ''],
  ['resumo outubro', '2026-10', ''],
  ['outubro', '2026-10', ''],
  ['resumo de março', '2026-03', ''],
  ['resumo dezembro', '2025-12', ''],
  ['resumo outubro 2025', '2025-10', ''],
  ['resumo 09/2026', '2026-09', ''],
  ['mês passado', '2026-10', ''],
  ['Quanto gastei esse mês?', '2026-11', ''],
  ['Quanto gastei de mercado esse mês?', '2026-11', 'mercado'],
  ['quanto gastei com uber em outubro', '2026-10', 'uber'],
  ['quanto eu gastei em alimentação no mês passado', '2026-10', 'alimentacao'],
  ['quanto gastei com 99', '2026-11', '99'],
];

for (const [input, month, query] of SUMMARIES) {
  test(`resumo: "${input}"`, () => {
    const parsed = parseMessage(input, TODAY);
    assert.equal(parsed.type, 'summary');
    assert.equal(parsed.period.month, month);
    assert.equal(parsed.query, query);
  });
}

test('resumo por período curto', () => {
  assert.deepEqual(parseMessage('quanto gastei hoje', TODAY).period, { kind: 'range', from: TODAY, to: '2026-11-04', label: 'Hoje' });
  assert.deepEqual(parseMessage('quanto gastei ontem', TODAY).period, { kind: 'range', from: '2026-11-02', to: TODAY, label: 'Ontem' });
  assert.deepEqual(parseMessage('quanto gastei essa semana', TODAY).period, { kind: 'range', from: '2026-11-02', to: '2026-11-04', label: 'Esta semana' });
});

test('parseMoney entende os formatos brasileiro e americano', () => {
  const cases = [
    ['50', 5000], ['50,9', 5090], ['50,90', 5090], ['50.90', 5090], ['1.234', 123400], ['1.234,56', 123456],
    ['1,234.56', 123456], ['1.234.567,89', 123456789], ['R$ 10', 1000], ['0', 0], ['abc', null], ['', null], ['-5', null],
    ['9.999.999,99', 999999999], ['10.000.000', null],
  ];
  for (const [input, expected] of cases) assert.equal(parseMoney(input), expected, input);
});

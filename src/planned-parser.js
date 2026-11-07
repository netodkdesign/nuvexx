import { takeDate } from './agenda-parser.js';
import { addMonths, makeDate } from './dates.js';
import { parseExpense, Working } from './parser.js';
import { fold } from './text.js';

const NWB = String.raw`(?<![\p{L}\p{N}])`;
const NWA = String.raw`(?![\p{L}\p{N}])`;
const regex = (source) => new RegExp(source, 'u');

// Datas de previsão olham para a frente: "dia 5" já passado é o do mês que vem.
const ANY_TIME = '23:59';
const DAY_START = '00:00';
const NO_DESCRIPTION = 'Sem descrição';
const NO_INCOME_DESCRIPTION = 'Entrada';
const DAY_SEARCH_MONTHS = 3;

const FUTURE_INCOME = /^(?:vou receber|vamos receber|vai entrar|a receber|receber)(?![\p{L}\p{N}])\s*(?:de\s+)?/u;
const FUTURE_EXPENSE = /^(?:vou pagar|vamos pagar|vou gastar|a pagar|pagar)(?![\p{L}\p{N}])\s*/u;
const INCOME_WORD = /^(?:recebo|recebemos|salario|meu salario|renda|pro labore|aposentadoria)(?![\p{L}\p{N}])/u;
const INCOME_VERB = /^(?:recebo|recebemos)(?![\p{L}\p{N}])\s*/u;

const EVERY_DAY = regex(`${NWB}tod[oa]s?\\s+(?:os\\s+)?(?:dias?\\s+)(\\d{1,2})${NWA}(?:\\s+de\\s+cada\\s+mes)?`);
const EVERY_MONTH = regex(`${NWB}(?:todo\\s+mes|todos\\s+os\\s+meses|por\\s+mes|mensal(?:mente)?|mensalidade\\s+de)${NWA}`);
const EVERY_WEEK = regex(`${NWB}(?:toda\\s+semana|todas\\s+as\\s+semanas|por\\s+semana|semanal(?:mente)?)${NWA}`);
const EVERY_YEAR = regex(`${NWB}(?:todo\\s+ano|todos\\s+os\\s+anos|por\\s+ano|anual(?:mente)?)${NWA}`);
const EVERY_WEEKDAY = regex(`${NWB}tod[oa]s?\\s+(?:as?\\s+|os\\s+)?(?=(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)s?)`);

// Com horário é compromisso, e fica com a agenda.
const HAS_TIME = /(?:^|\s)(?:as|pras)\s+\d|\d{1,2}(?:h|:)\d{0,2}(?![\p{L}\p{N}])/u;

const STOP = /^(?:cancelar|cancela|parar|para|encerrar|encerra|tirar|tira)\s+(?:de\s+repetir\s+|(?:a\s+)?(?:recorrencia|repeticao|conta\s+fixa)\s+)(?:de\s+|do\s+|da\s+|o\s+|a\s+)?(.+)$/;
const SUMMARY = /^(?:o\s*que\s+)?(?:quanto\s+)?(?:ainda\s+)?(?:falta|vai|vao|tem|tenho)\s+(?:a\s+|para\s+|pra\s+)?(?:entrar|sair|pagar|receber)(?:\s+(?:ainda|neste mes|nesse mes|este mes|esse mes|no mes))*$|^(?:o\s*que\s+)?(?:ainda\s+)?(?:falta)\s+(?:pagar|receber)$|^(?:previsao|previsto|previstos|a pagar|a receber|contas a pagar|contas do mes)$/;

function nextDayOfMonth(day, today) {
  const [year, month] = today.split('-').map(Number);
  for (let offset = 0; offset <= DAY_SEARCH_MONTHS; offset += 1) {
    const reference = addMonths(`${year}-${String(month).padStart(2, '0')}-01`, offset);
    const [y, m] = reference.split('-').map(Number);
    const date = makeDate(y, m, day);
    if (date && date >= today) return date;
  }
  return null;
}

export function parsePlanned(text, today) {
  const clean = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const simple = fold(clean).replace(/[?!.,;:]+$/g, '').trim();
  if (!simple) return null;

  const stop = STOP.exec(simple);
  if (stop) return { type: 'planned_stop', query: stop[1].trim() };
  if (SUMMARY.test(simple)) return { type: 'planned_summary' };

  const work = new Working(clean);
  const incomeVerb = work.take(FUTURE_INCOME);
  const expenseVerb = !incomeVerb && work.take(FUTURE_EXPENSE);

  let frequency = null;
  let day = null;
  const everyDay = work.take(EVERY_DAY);
  if (everyDay) {
    frequency = 'monthly';
    day = Number(everyDay[1]);
  } else if (work.take(EVERY_MONTH)) frequency = 'monthly';
  else if (work.take(EVERY_WEEK)) frequency = 'weekly';
  else if (work.take(EVERY_YEAR)) frequency = 'yearly';
  else if (work.take(EVERY_WEEKDAY)) frequency = 'weekly';

  if (!frequency && !incomeVerb && !expenseVerb) return null;
  if (HAS_TIME.test(work.norm)) return null;

  const isIncome = Boolean(incomeVerb) || INCOME_WORD.test(simple);
  const date = day ? nextDayOfMonth(day, today) : takeDate(work, today, ANY_TIME, DAY_START) ?? today;
  if (!date) return { type: 'planned_invalid_day' };

  const rest = new Working(work.orig.trim());
  rest.take(INCOME_VERB);
  const parsed = parseExpense(rest.orig.trim(), today);
  if (!parsed) return frequency ? { type: 'planned_need_amount', isIncome } : null;

  const description = parsed.description === NO_DESCRIPTION && isIncome ? NO_INCOME_DESCRIPTION : parsed.description;
  return { type: 'planned', kind: isIncome ? 'income' : 'expense', description, amountCents: parsed.amountCents, date, frequency };
}

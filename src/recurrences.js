import { addDays, addMonths } from './dates.js';

// Os lançamentos que se repetem ficam prontos com um ano de antecedência; a rotina diária completa o resto.
const HORIZON_MONTHS = 12;
const DAYS_IN_WEEK = 7;
const MONTHS_IN_YEAR = 12;

export const FREQUENCIES = { weekly: 'toda semana', monthly: 'todo mês', yearly: 'todo ano' };

// Sempre a partir da data inicial: "dia 31" volta a ser 31 depois de um mês mais curto.
export function occurrenceDate(start, frequency, index) {
  if (frequency === 'weekly') return addDays(start, index * DAYS_IN_WEEK);
  if (frequency === 'yearly') return addMonths(start, index * MONTHS_IN_YEAR);
  return addMonths(start, index);
}

function pendingDates(rule, today) {
  const horizon = addMonths(today, HORIZON_MONTHS);
  const dates = [];
  for (let index = rule.next_index; ; index += 1) {
    const date = occurrenceDate(rule.start_on, rule.frequency, index);
    if (date > horizon || (rule.end_on && date > rule.end_on)) return dates;
    dates.push(date);
  }
}

export async function extendRecurrence(store, rule, today) {
  const dates = pendingDates(rule, today);
  if (dates.length) await store.addOccurrences(rule, dates);
  return dates.length;
}

export async function createRecurrence(store, fields, today) {
  const rule = await store.addRecurrence(fields);
  await extendRecurrence(store, rule, today);
  return rule;
}

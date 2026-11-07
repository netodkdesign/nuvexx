// Datas sempre como texto "AAAA-MM-DD": gasto não tem hora, e assim o fuso do servidor não muda o dia.

export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (n) => String(n).padStart(2, '0');
const toUtc = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUtc = (date) => date.toISOString().slice(0, 10);

export function todayIn(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Hora local como "HH:MM".
export function timeIn(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('hour')}:${get('minute')}`;
}

function offsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - date.getTime();
}

// Instante real de um dia e hora marcados no fuso da pessoa.
export function zonedToUtc(ymd, hhmm, timeZone) {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

export function addMinutesToTime(hhmm, minutes) {
  const [hour, minute] = hhmm.split(':').map(Number);
  // Um compromisso que passaria da meia-noite termina às 23:59 do mesmo dia.
  const total = Math.min(hour * 60 + minute + minutes, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function isValidTime(hhmm) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hhmm ?? ''));
}

export function isValidDate(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && fromUtc(toUtc(ymd)) === ymd;
}

export const isValidMonth = (month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

export function makeDate(year, month, day) {
  const ymd = `${year}-${pad(month)}-${pad(day)}`;
  return isValidDate(ymd) ? ymd : null;
}

export function addDays(ymd, days) {
  const date = toUtc(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export const weekday = (ymd) => toUtc(ymd).getUTCDay();
export const monthOf = (ymd) => ymd.slice(0, 7);

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

// Dia 31 + 1 mês cai no último dia do mês seguinte.
export function addMonths(ymd, delta) {
  const month = shiftMonth(monthOf(ymd), delta);
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${pad(Math.min(Number(ymd.slice(8)), lastDay))}`;
}

// "to" é exclusivo.
export const monthRange = (month) => ({ from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` });

export const monthName = (month) => MONTHS[Number(month.slice(5)) - 1];
export const monthLabel = (month) => `${monthName(month)} de ${month.slice(0, 4)}`;

export function shortDate(ymd, today) {
  const label = `${ymd.slice(8)}/${ymd.slice(5, 7)}`;
  return today && ymd.slice(0, 4) !== today.slice(0, 4) ? `${label}/${ymd.slice(0, 4)}` : label;
}

export function relativeDate(ymd, today) {
  if (ymd === today) return 'hoje';
  if (ymd === addDays(today, -1)) return 'ontem';
  return shortDate(ymd, today);
}

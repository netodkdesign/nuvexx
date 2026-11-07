import { addDays, addMonths, monthOf, monthRange, shiftMonth } from './dates.js';

const HISTORY_MONTHS = 6;

export async function monthSummary(store, month, today) {
  const { from, to } = monthRange(month);
  const isCurrent = month === monthOf(today);
  const previousMonth = shiftMonth(month, -1);
  const previousRange = monthRange(previousMonth);
  // O mês em andamento é comparado com o mesmo período do anterior; senão ele sempre pareceria menor.
  const previousTo = isCurrent ? addDays(addMonths(today, -1), 1) : previousRange.to;

  const months = Array.from({ length: HISTORY_MONTHS }, (_, index) => shiftMonth(month, index - HISTORY_MONTHS + 1));
  const tomorrow = addDays(today, 1);
  const pendingFrom = tomorrow > from ? tomorrow : from;
  const [overall, income, pendingExpense, pendingIncome, previous, categories, history] = await Promise.all([
    store.total(from, to),
    store.incomeTotal(from, to),
    pendingFrom < to ? store.total(pendingFrom, to) : { total_cents: 0 },
    pendingFrom < to ? store.incomeTotal(pendingFrom, to) : { total_cents: 0 },
    store.total(previousRange.from, previousTo),
    store.totalsByCategory(from, to),
    Promise.all(months.map(async (item) => {
      const range = monthRange(item);
      return { month: item, ...(await store.total(range.from, range.to)) };
    })),
  ]);

  return {
    month,
    today,
    is_current: isCurrent,
    total_cents: overall.total_cents,
    count: overall.count,
    income_cents: income.total_cents,
    income_count: income.count,
    pending_expense_cents: pendingExpense.total_cents,
    pending_income_cents: pendingIncome.total_cents,
    previous: { month: previousMonth, total_cents: previous.total_cents, same_period: isCurrent },
    categories: categories.map((row) => ({
      ...row,
      percent: overall.total_cents ? Math.round((row.total_cents / overall.total_cents) * 100) : 0,
    })),
    history,
  };
}

function monthsBetween(from, to) {
  const months = [from];
  while (months.at(-1) < to) months.push(shiftMonth(months.at(-1), 1));
  return months;
}

// "total" é o mês inteiro; "done" é o que já aconteceu; "pending" é o que ainda vai acontecer.
// No mês em andamento, compara o que já aconteceu com o mesmo período do mês anterior.
function monthFigures(total, done, previous, compareDone) {
  const base = compareDone ? done : total;
  // Sem base para comparar, não há porcentagem que faça sentido.
  const changePercent = previous ? ((base - previous) / Math.abs(previous)) * 100 : null;
  return { total_cents: total, done_cents: done, pending_cents: total - done, previous_cents: previous, change_percent: changePercent };
}

const PANEL_LIST_SIZE = 5;
const PANEL_UPCOMING_SIZE = 8;
const PANEL_RECENT_SIZE = 6;
const PANEL_AGENDA_DAYS = 30;

// Tudo que os blocos do painel mostram. O mês em destaque é o último do período.
export async function panelData(store, { from, to, today }) {
  const months = monthsBetween(from, to);
  const start = monthRange(from).from;
  const end = monthRange(to).to;
  const focus = monthRange(to);
  const isCurrent = to === monthOf(today);
  const previousMonth = shiftMonth(to, -1);
  const previousRange = monthRange(previousMonth);
  // O mês em andamento é comparado com o mesmo período do anterior; senão ele sempre pareceria menor.
  const previousEnd = isCurrent ? addDays(addMonths(today, -1), 1) : previousRange.to;
  const tomorrow = addDays(today, 1);
  // Até onde o mês em destaque já aconteceu. Num mês futuro, nada; num mês passado, tudo.
  const doneEnd = tomorrow < focus.from ? focus.from : tomorrow > focus.to ? focus.to : tomorrow;
  const emptyTotal = { total_cents: 0, count: 0 };

  const [totals, income, expense, incomeDone, expenseDone, upcoming, previousIncome, previousExpense, accounts, categories, topExpenses, recentExpenses, recentIncomes, appointments, tasks, openTasks] = await Promise.all([
    store.monthlyTotals(start, end, today),
    store.incomeTotal(focus.from, focus.to),
    store.total(focus.from, focus.to),
    doneEnd > focus.from ? store.incomeTotal(focus.from, doneEnd) : emptyTotal,
    doneEnd > focus.from ? store.total(focus.from, doneEnd) : emptyTotal,
    doneEnd < focus.to ? store.plannedEntries(doneEnd, focus.to, PANEL_UPCOMING_SIZE) : [],
    store.incomeTotal(previousRange.from, previousEnd),
    store.total(previousRange.from, previousEnd),
    store.accountBalances(today),
    store.totalsByCategory(focus.from, focus.to),
    store.topExpenses(focus.from, focus.to, PANEL_LIST_SIZE),
    store.recentExpenses(today, PANEL_RECENT_SIZE),
    store.recentIncomes(today, PANEL_RECENT_SIZE),
    store.listAppointments({ from: today, to: addDays(today, PANEL_AGENDA_DAYS), limit: PANEL_LIST_SIZE }),
    store.openTasks(PANEL_LIST_SIZE),
    store.openTaskCount(),
  ]);

  const incomeByMonth = new Map(totals.incomes.map((row) => [row.month, row]));
  const expenseByMonth = new Map(totals.expenses.map((row) => [row.month, row]));
  let cumulative = 0;
  const flow = months.map((month) => {
    const incomeRow = incomeByMonth.get(month);
    const expenseRow = expenseByMonth.get(month);
    const incomeCents = incomeRow?.cents ?? 0;
    const expenseCents = expenseRow?.cents ?? 0;
    cumulative += incomeCents - expenseCents;
    return {
      month,
      income_cents: incomeCents,
      expense_cents: expenseCents,
      income_pending_cents: incomeRow?.pending_cents ?? 0,
      expense_pending_cents: expenseRow?.pending_cents ?? 0,
      balance_cents: incomeCents - expenseCents,
      cumulative_cents: cumulative,
    };
  });

  const recent = [
    ...recentExpenses.map((row) => ({ ...row, kind: 'expense', date: row.spent_on })),
    ...recentIncomes.map((row) => ({ ...row, kind: 'income', date: row.received_on })),
  ].sort((a, b) => (a.date === b.date ? new Date(b.created_at) - new Date(a.created_at) : b.date.localeCompare(a.date))).slice(0, PANEL_RECENT_SIZE);

  return {
    period: {
      from,
      to,
      months,
      month: to,
      today,
      range: focus,
      previous_month: previousMonth,
      same_period: isCurrent,
      is_current: isCurrent,
      is_future: to > monthOf(today),
    },
    flow,
    summary: {
      income: monthFigures(income.total_cents, incomeDone.total_cents, previousIncome.total_cents, isCurrent),
      expense: monthFigures(expense.total_cents, expenseDone.total_cents, previousExpense.total_cents, isCurrent),
      balance: monthFigures(
        income.total_cents - expense.total_cents,
        incomeDone.total_cents - expenseDone.total_cents,
        previousIncome.total_cents - previousExpense.total_cents,
        isCurrent,
      ),
    },
    upcoming,
    accounts,
    categories: categories.map((row) => ({
      ...row,
      percent: expense.total_cents ? Math.round((row.total_cents / expense.total_cents) * 100) : 0,
    })),
    top_expenses: topExpenses,
    recent,
    appointments,
    tasks: { rows: tasks, open_count: openTasks },
  };
}

const CSV_SEPARATOR = ';';

function csvCell(value) {
  let text = String(value ?? '');
  // Impede que o Excel execute como fórmula um texto vindo de uma mensagem.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Separador ";", vírgula decimal e BOM: é o formato que o Excel em português abre sem ajuste.
export function expensesToCsv(expenses, incomes = []) {
  const header = ['Data', 'Descrição', 'Categoria', 'Valor', 'Parcela', 'Origem', 'Tipo', 'Conta'];
  const money = (cents) => (cents / 100).toFixed(2).replace('.', ',');
  const rows = [
    ...expenses.map((row) => ({
      date: row.spent_on,
      cells: [
        row.spent_on, row.description, row.category_name, money(row.amount_cents),
        row.installment ? `${row.installment}/${row.installments}` : '', row.source, 'Saída', row.account_name,
      ],
    })),
    ...incomes.map((row) => ({
      date: row.received_on,
      cells: [row.received_on, row.description, '', money(row.amount_cents), '', row.source, 'Entrada', row.account_name],
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const lines = rows.map((row) => row.cells.map(csvCell).join(CSV_SEPARATOR));
  return `﻿${[header.join(CSV_SEPARATOR), ...lines].join('\r\n')}\r\n`;
}

import { classify, MAINTENANCE_SLUG } from '../categories.js';
import { addDays, monthLabel, monthName, monthOf, monthRange, relativeDate, shortDate } from '../dates.js';
import { createRecurrence, FREQUENCIES } from '../recurrences.js';
import { monthSummary } from '../reports.js';
import { capitalize, fold, formatBRL, normalizeKeyword } from '../text.js';
import { findVehicle, splitPlace } from '../vehicles.js';

const LIST_LIMIT = 10;
const NO_DESCRIPTION = 'Sem descrição';

const installmentSuffix = (row) => (row.installment ? ` (${row.installment}/${row.installments})` : '');
const countLabel = (count) => `${count} ${count === 1 ? 'lançamento' : 'lançamentos'}`;
const signedBRL = (cents) => `${cents < 0 ? '−' : ''}${formatBRL(Math.abs(cents))}`;

function expenseLine(row, today) {
  return `${shortDate(row.spent_on, today)} ${row.description}${installmentSuffix(row)}: ${formatBRL(row.amount_cents)}`;
}

function comparison(summary) {
  const before = summary.previous.total_cents;
  if (!before) return null;
  const diff = summary.total_cents - before;
  const name = monthName(summary.previous.month);
  const reference = summary.previous.same_period ? `o mesmo período de ${name}` : name;
  if (diff === 0) return `Igual a ${reference}.`;
  return `${diff > 0 ? '▲' : '▼'} ${formatBRL(Math.abs(diff))} ${diff > 0 ? 'a mais' : 'a menos'} que ${reference}.`;
}

async function resolveCategory(store, target) {
  const wanted = normalizeKeyword(target);
  if (!wanted) return null;
  const categories = await store.categories();
  const named = (test) => categories.find((c) => test(normalizeKeyword(c.name)));
  const direct = named((n) => n === wanted) ?? named((n) => n.startsWith(wanted)) ?? named((n) => n.includes(wanted));
  if (direct) return direct;
  const viaKeyword = classify(wanted, await store.keywords());
  return viaKeyword ? store.category(viaKeyword) : null;
}

// Manutenção escrita em mensagem já entra no histórico do veículo, com o lugar que a frase citar.
async function addExpenseOrService(store, { description, ...fields }) {
  const category = await store.category(fields.categoryId);
  if (category.slug !== MAINTENANCE_SLUG) return store.addExpense({ description, ...fields });
  const vehicles = await store.vehicles();
  const { what, place } = splitPlace(description, vehicles);
  const rows = await store.addExpense({ description: what, ...fields });
  await store.saveVehicleService(rows[0], { vehicleId: findVehicle(description, vehicles)?.id ?? null, place, odometerKm: null });
  return Promise.all(rows.map((row) => store.expense(row.id)));
}

async function serviceNote(row, store) {
  if (row.category_slug !== MAINTENANCE_SLUG) return null;
  if (row.vehicle_name) return `🔧 Entrou no histórico de *${row.vehicle_name}*${row.place ? `, feito em ${row.place}` : ''}.`;
  const vehicles = await store.vehicles();
  return vehicles.length
    ? '🔧 Escolha de qual veículo foi na aba *Veículos*, no app, para entrar no histórico certo.'
    : '🔧 Cadastre seu veículo na aba *Veículos*, no app, para guardar esse histórico.';
}

async function record(parsed, store, source, accountId = null) {
  const categoryId = classify(parsed.description, await store.keywords()) ?? (await store.otherCategory()).id;
  return addExpenseOrService(store, {
    description: parsed.description,
    amountCents: parsed.amountCents,
    categoryId,
    date: parsed.date,
    installments: parsed.installments,
    source,
    accountId,
  });
}

async function replyIncome(parsed, store, { today, source, account }) {
  if (!parsed.amountCents) return 'Quanto entrou? Mande, por exemplo, *recebi 3000 de salário*.';
  const row = await store.addIncome({
    description: parsed.description,
    amountCents: parsed.amountCents,
    date: parsed.date,
    source,
    accountId: account?.id ?? null,
  });
  const month = monthOf(row.received_on);
  const { from, to } = monthRange(month);
  const [income, expense] = await Promise.all([store.incomeTotal(from, to), store.total(from, to)]);
  const lines = [
    `✅ *${formatBRL(row.amount_cents)}* de entrada${account ? ` em ${account.name}` : ''}`,
    `${row.description}, ${relativeDate(row.received_on, today)}.`,
    '',
    `Entradas em ${monthName(month)}: ${formatBRL(income.total_cents)}`,
    `Saldo do mês: ${signedBRL(income.total_cents - expense.total_cents)}`,
  ];
  return lines.join('\n');
}

async function replyIncomeSummary({ period }, store, today) {
  const range = period.kind === 'month' ? monthRange(period.month) : period;
  const label = period.kind === 'month' ? monthLabel(period.month) : period.label.toLowerCase();
  const rows = await store.listIncomes({ from: range.from, to: range.to });
  if (!rows.length) return `Nenhuma entrada anotada em ${label}.`;
  const total = rows.reduce((sum, row) => sum + row.amount_cents, 0);
  const lines = rows.slice(0, LIST_LIMIT).map((row) => `${shortDate(row.received_on, today)} ${row.description}: ${formatBRL(row.amount_cents)}`);
  if (rows.length > LIST_LIMIT) lines.push(`…e mais ${rows.length - LIST_LIMIT} no app.`);
  return [`*Entradas, ${label}*`, `Total: *${formatBRL(total)}* em ${countLabel(rows.length)}`, '', ...lines].join('\n');
}

async function replyPlanned(parsed, store, { today, source, account }) {
  const { kind, description, amountCents, date, frequency } = parsed;
  const categoryId = kind === 'expense' ? classify(description, await store.keywords()) ?? (await store.otherCategory()).id : null;
  const accountId = account?.id ?? null;
  if (frequency) {
    await createRecurrence(store, { kind, description, amountCents, categoryId, accountId, frequency, startOn: date, source }, today);
  } else if (kind === 'income') {
    await store.addIncome({ description, amountCents, date, source, accountId });
  } else {
    await addExpenseOrService(store, { description, amountCents, categoryId, date, source, accountId });
  }

  const category = categoryId ? await store.category(categoryId) : null;
  const label = kind === 'income' ? 'de entrada' : 'de saída';
  const where = [category && `em ${category.emoji} ${category.name}`, account && `(${account.name})`].filter(Boolean).join(' ');
  const when = frequency ? `Próxima: ${relativeDate(date, today)}.` : `Previsto para ${relativeDate(date, today)}.`;
  const repeats = frequency ? ` ${FREQUENCIES[frequency]}` : '';
  const lines = [`✅ *${formatBRL(amountCents)}* ${label}${repeats}${where ? ` ${where}` : ''}`, `${description}. ${when}`];
  if (frequency) lines.push('', 'Já está no painel, nos próximos meses. Para parar, mande *cancelar repetição* e o nome.');
  return lines.join('\n');
}

async function replyPlannedSummary(store, today) {
  const month = monthOf(today);
  const { to } = monthRange(month);
  const rows = await store.plannedEntries(addDays(today, 1), to, LIST_LIMIT + 1);
  const [income, expense] = await Promise.all([store.incomeTotal(addDays(today, 1), to), store.total(addDays(today, 1), to)]);
  if (!income.count && !expense.count) return `Nada previsto para o resto de ${monthName(month)}.`;
  const lines = [
    `*Ainda em ${monthName(month)}*`,
    `Vai entrar: *${formatBRL(income.total_cents)}*`,
    `Vai sair: *${formatBRL(expense.total_cents)}*`,
    '',
    ...rows.slice(0, LIST_LIMIT).map((row) => `${shortDate(row.date, today)} ${row.description}: ${row.kind === 'income' ? '+' : '−'}${formatBRL(row.amount_cents)}`),
  ];
  if (rows.length > LIST_LIMIT) lines.push('…e mais no painel.');
  return lines.join('\n');
}

async function replyPlannedStop({ query }, store, { today }) {
  const rules = await store.activeRecurrencesOf(today);
  const rule = rules.find((row) => fold(row.description).includes(query));
  if (!rule) return `Não encontrei nenhuma repetição com "${query}".`;
  await store.endRecurrence(rule, addDays(today, 1));
  return `🗑️ *${rule.description}* não se repete mais. Tirei o que estava previsto a partir de amanhã.`;
}

async function replyExpense(parsed, store, { today, source, account }) {
  const rows = await record(parsed, store, source, account?.id ?? null);
  const [first] = rows;
  const categoryLabel = `${first.category_emoji} ${first.category_name}`;
  const inAccount = account ? ` (${account.name})` : '';
  const lines = [];
  if (rows.length > 1) {
    lines.push(`✅ *${rows.length}x de ${formatBRL(first.amount_cents)}* em ${categoryLabel}${inAccount}`);
    lines.push(`${first.description}, total de ${formatBRL(parsed.amountCents)}. Primeira parcela: ${relativeDate(first.spent_on, today)}.`);
  } else {
    lines.push(`✅ *${formatBRL(first.amount_cents)}* em ${categoryLabel}${inAccount}`);
    lines.push(`${first.description}, ${relativeDate(first.spent_on, today)}.`);
  }
  const month = monthOf(first.spent_on);
  const { from, to } = monthRange(month);
  const inCategory = (await store.totalsByCategory(from, to)).find((c) => c.id === first.category_id);
  if (inCategory) lines.push('', `${first.category_name} em ${monthName(month)}: ${formatBRL(inCategory.total_cents)}`);
  const note = await serviceNote(first, store);
  if (note) lines.push('', note);
  if (first.category_id === (await store.otherCategory()).id) {
    lines.push('', 'Não reconheci a categoria. Mande *categoria* e o nome, como *categoria lazer*, e da próxima vez já acerto.');
  }
  return lines.join('\n');
}

async function replyRecategorize(target, store) {
  const category = await resolveCategory(store, target);
  if (!category) {
    const list = (await store.categories()).map((c) => `${c.emoji} ${c.name}`).join('\n');
    return `Não achei a categoria "${target}". As disponíveis são:\n${list}`;
  }
  const [last, rule] = await Promise.all([store.lastExpense(), store.lastRecurrence()]);
  if (rule?.kind === 'expense' && (!last || new Date(rule.created_at) >= new Date(last.created_at))) {
    await store.setRecurrenceCategory(rule, category.id);
    await store.learn(rule.description, category.id);
    return `🔁 *${rule.description}* agora está em ${category.emoji} ${category.name}, em todas as repetições.`;
  }
  if (!last) return 'Ainda não há gasto seu para corrigir.';
  await store.setCategory(last, category.id);
  if (category.slug === MAINTENANCE_SLUG) {
    const vehicle = findVehicle(last.description, await store.vehicles());
    await store.saveVehicleService(last, { vehicleId: vehicle?.id ?? null, place: last.place, odometerKm: last.odometer_km });
  } else {
    await store.removeVehicleService(last);
  }
  if (last.description === NO_DESCRIPTION) return `🔁 O último gasto agora está em ${category.emoji} ${category.name}.`;
  await store.learn(last.description, category.id);
  return `🔁 *${last.description}* agora está em ${category.emoji} ${category.name}. Da próxima vez já coloco lá.`;
}

async function replyCategories(store) {
  const list = (await store.categories()).map((c) => `${c.emoji} ${c.name}`).join('\n');
  return `Estas são as categorias:\n${list}\n\nPara mudar o último gasto de lugar, mande *categoria lazer*, por exemplo.`;
}

async function replyRecent(store, today) {
  const rows = await store.recentExpenses(today, LIST_LIMIT);
  if (!rows.length) return 'Ainda não há gastos anotados. Experimente mandar *mercado 50*.';
  return ['*Últimos lançamentos*', ...rows.map((row) => expenseLine(row, today))].join('\n');
}

async function matchRows(store, period, query) {
  const range = period.kind === 'month' ? monthRange(period.month) : period;
  const all = await store.listExpenses({ from: range.from, to: range.to });
  if (!query) return { rows: all };
  const category = (await store.categories()).find((c) => {
    const name = normalizeKeyword(c.name);
    return name === query || name.startsWith(query);
  });
  if (category) return { rows: all.filter((r) => r.category_id === category.id), title: `${category.emoji} ${category.name}` };
  const byDescription = all.filter((r) => fold(r.description).includes(query));
  if (byDescription.length) return { rows: byDescription, title: capitalize(query) };
  const viaKeyword = await resolveCategory(store, query);
  if (viaKeyword) return { rows: all.filter((r) => r.category_id === viaKeyword.id), title: `${viaKeyword.emoji} ${viaKeyword.name}` };
  return { rows: [], title: capitalize(query) };
}

async function replySummary({ period, query }, store, today) {
  const periodLabel = period.kind === 'month' ? monthLabel(period.month) : period.label.toLowerCase();

  if (query) {
    const { rows, title } = await matchRows(store, period, query);
    if (!rows.length) return `Não encontrei gastos com "${query}" em ${periodLabel}.`;
    const total = rows.reduce((sum, row) => sum + row.amount_cents, 0);
    const lines = [
      `*${title}, ${periodLabel}*`,
      `Total: *${formatBRL(total)}* em ${countLabel(rows.length)}`,
      '',
      ...rows.slice(0, LIST_LIMIT).map((row) => expenseLine(row, today)),
    ];
    if (rows.length > LIST_LIMIT) lines.push(`…e mais ${rows.length - LIST_LIMIT} no app.`);
    return lines.join('\n');
  }

  if (period.kind === 'range') {
    const { rows } = await matchRows(store, period, '');
    if (!rows.length) return `Nenhum gasto anotado: ${periodLabel}.`;
    const total = rows.reduce((sum, row) => sum + row.amount_cents, 0);
    return [`*${period.label}*`, `Total: *${formatBRL(total)}*`, '', ...rows.slice(0, LIST_LIMIT).map((row) => expenseLine(row, today))].join('\n');
  }

  const summary = await monthSummary(store, period.month, today);
  if (!summary.count && !summary.income_count) return `Nenhum gasto anotado em ${monthLabel(period.month)}.`;
  const lines = [
    `📊 *${capitalize(monthLabel(period.month))}*`,
    `Total: *${formatBRL(summary.total_cents)}* em ${countLabel(summary.count)}`,
  ];
  if (summary.income_count) {
    lines.push(`Entradas: ${formatBRL(summary.income_cents)}`, `Saldo: ${signedBRL(summary.income_cents - summary.total_cents)}`);
  }
  if (summary.pending_income_cents) lines.push(`Ainda vai entrar: ${formatBRL(summary.pending_income_cents)}`);
  if (summary.pending_expense_cents) lines.push(`Ainda vai sair: ${formatBRL(summary.pending_expense_cents)}`);
  lines.push('', ...summary.categories.map((c) => `${c.emoji} ${c.name}: ${formatBRL(c.total_cents)} (${c.percent}%)`));
  const versus = comparison(summary);
  if (versus) lines.push('', versus);
  return lines.join('\n');
}

export const FINANCE_TYPES = new Set(['expense', 'categories', 'recent', 'recategorize', 'summary', 'income', 'income_summary']);
export const PLANNED_TYPES = new Set(['planned', 'planned_summary', 'planned_stop', 'planned_need_amount', 'planned_invalid_day']);

export function createFinanceAdvisor() {
  return {
    async handle(parsed, store, context) {
      switch (parsed.type) {
        case 'expense': return replyExpense(parsed, store, context);
        case 'categories': return replyCategories(store);
        case 'recent': return replyRecent(store, context.today);
        case 'recategorize': return replyRecategorize(parsed.target, store);
        case 'summary': return replySummary(parsed, store, context.today);
        case 'income': return replyIncome(parsed, store, context);
        case 'income_summary': return replyIncomeSummary(parsed, store, context.today);
        case 'planned': return replyPlanned(parsed, store, context);
        case 'planned_summary': return replyPlannedSummary(store, context.today);
        case 'planned_stop': return replyPlannedStop(parsed, store, context);
        case 'planned_need_amount':
          return parsed.isIncome
            ? 'De quanto? Mande, por exemplo, *salário 5000 todo dia 5*.'
            : 'De quanto? Mande, por exemplo, *aluguel 1800 todo dia 10*.';
        case 'planned_invalid_day': return 'Esse dia não existe. Mande um dia de 1 a 31, como *aluguel 1800 todo dia 10*.';
        default: throw new Error(`Pedido financeiro desconhecido: ${parsed.type}`);
      }
    },

    async handleBatch(items, store, { source }) {
      const lines = [];
      for (const parsed of items) {
        const rows = await record(parsed, store, source);
        const label = rows.length > 1 ? `${rows.length}x de ${formatBRL(rows[0].amount_cents)}` : formatBRL(rows[0].amount_cents);
        lines.push(`• ${rows[0].description}: *${label}* em ${rows[0].category_emoji} ${rows[0].category_name}`);
      }
      return [`✅ Anotei ${items.length} gastos:`, ...lines, '', 'Envie *desfazer* para apagar o último.'].join('\n');
    },

    async undo(last, store, today) {
      await store.deleteExpense(last, { wholeGroup: true });
      const what = last.group_id
        ? `${last.description}, ${last.installments} parcelas`
        : `${last.description}, ${formatBRL(last.amount_cents)} em ${shortDate(last.spent_on, today)}`;
      return `🗑️ Apaguei: ${what}.`;
    },

    async undoRecurrence(rule, store) {
      await store.deleteRecurrence(rule);
      return `🗑️ Apaguei *${rule.description}*, com todas as repetições.`;
    },

    async undoIncome(last, store, today) {
      await store.deleteIncome(last.id);
      return `🗑️ Apaguei a entrada: ${last.description}, ${formatBRL(last.amount_cents)} em ${shortDate(last.received_on, today)}.`;
    },
  };
}

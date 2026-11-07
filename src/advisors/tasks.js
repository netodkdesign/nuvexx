import { shortDate, zonedToUtc } from '../dates.js';
import { fold } from '../text.js';
import { describeDay } from './agenda.js';

const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
const ALL_DAY_REMINDER_TIME = '08:00';
const LIST_LIMIT = 15;

const pendingLabel = (count) => (count === 1 ? 'Falta 1 tarefa.' : `Faltam ${count} tarefas.`);

const isPast = (date, time, today, nowTime) => date < today || (date === today && Boolean(time) && time <= nowTime);

// O dia e o horário da tarefa, sem dizer se ela está atrasada.
export function describeDue(task, today) {
  const day = describeDay(task.due_on, today);
  return task.due_time ? `${day}, às ${task.due_time}` : day;
}

export function describeTask(task, today, nowTime) {
  if (!task.due_on) return 'sem data';
  if (isPast(task.due_on, task.due_time, today, nowTime)) {
    const since = shortDate(task.due_on, today);
    return `atrasada desde ${task.due_time ? `${since}, às ${task.due_time}` : since}`;
  }
  return describeDue(task, today);
}

export function createTasksAdvisor({ config }) {
  const { timeZone } = config;

  // Com horário, avisa 2 horas antes. Só com o dia, avisa às 8h desse dia.
  function reminderFor(date, time, now) {
    if (!date) return null;
    const at = time
      ? new Date(zonedToUtc(date, time, timeZone).getTime() - REMINDER_LEAD_MS)
      : zonedToUtc(date, ALL_DAY_REMINDER_TIME, timeZone);
    return at > now ? at : null;
  }

  const create = ({ title, date, time = null }, store, now, source) =>
    store.addTask({ title, date: date ?? null, time, remindAt: reminderFor(date, time, now), source });

  const update = (existing, { title, date, time = null }, store, now) =>
    store.updateTask(existing.id, { title, date: date ?? null, time, remindAt: reminderFor(date, time, now) });

  async function findOpen(query, store) {
    const rows = await store.openTasks();
    return rows.find((row) => fold(row.title).includes(query)) ?? null;
  }

  async function replyCreate(parsed, store, { now, today, nowTime, source }) {
    if (parsed.date && isPast(parsed.date, parsed.time, today, nowTime)) return 'Essa data já passou. Mande de novo com o dia certo.';
    const task = await create(parsed, store, now, source);
    const lines = [`✅ *${task.title}*: ${describeTask(task, today, nowTime)}.`];
    if (task.remind_at) lines.push(task.due_time ? 'Te aviso 2 horas antes.' : 'Te aviso às 8h desse dia.');
    return lines.join('\n');
  }

  async function replyList({ range }, store, { today, nowTime }) {
    const rows = (await store.openTasks()).filter((row) => {
      if (!range) return true;
      if (!row.due_on || row.due_on > range.to) return false;
      return range.includeOverdue || row.due_on >= range.from;
    });
    const label = range?.label ?? 'Tarefas pendentes';
    if (!rows.length) return `*${label}*\nNenhuma tarefa pendente.`;
    const lines = rows.slice(0, LIST_LIMIT).map((row) => `• ${row.title} (${describeTask(row, today, nowTime)})`);
    if (rows.length > LIST_LIMIT) lines.push(`…e mais ${rows.length - LIST_LIMIT} no app.`);
    return [`*${label}*`, ...lines].join('\n');
  }

  async function replyDone({ query }, store, { now }) {
    if (!query) return 'Qual tarefa? Mande, por exemplo, *concluí pagar luz*.';
    const task = await findOpen(query, store);
    if (!task) return `Não encontrei nenhuma tarefa pendente com "${query}".`;
    await store.setTaskDone(task.id, now);
    const left = await store.openTaskCount();
    return `🎉 *${task.title}* concluída. ${left ? pendingLabel(left) : 'Não falta mais nenhuma.'}`;
  }

  async function replyDelete({ query }, store) {
    const task = await findOpen(query, store);
    if (!task) return `Não encontrei nenhuma tarefa pendente com "${query}".`;
    await store.deleteTask(task.id);
    return `🗑️ Apaguei a tarefa *${task.title}*.`;
  }

  async function replyMove(parsed, store, { now, today, nowTime }) {
    const task = await findOpen(parsed.query, store);
    if (!task) return `Não encontrei nenhuma tarefa pendente com "${parsed.query}".`;
    // Mudar só o dia mantém o horário, e mudar só o horário mantém o dia.
    const date = parsed.date ?? task.due_on ?? today;
    const time = parsed.time ?? task.due_time;
    if (isPast(date, time, today, nowTime)) return 'Essa data já passou. Mande de novo com o dia certo.';
    const updated = await update(task, { title: task.title, date, time }, store, now);
    return `🔁 *${updated.title}* agora é para ${describeTask(updated, today, nowTime)}.`;
  }

  return {
    create,
    update,

    handle(parsed, store, context) {
      switch (parsed.type) {
        case 'task_create': return replyCreate(parsed, store, context);
        case 'task_list': return replyList(parsed, store, context);
        case 'task_done': return replyDone(parsed, store, context);
        case 'task_delete': return replyDelete(parsed, store);
        case 'task_move': return replyMove(parsed, store, context);
        case 'task_need_title': return 'Qual é a tarefa? Mande, por exemplo, *tarefa pagar luz sexta às 15h*.';
        default: throw new Error(`Pedido de tarefa desconhecido: ${parsed.type}`);
      }
    },

    async undo(last, store) {
      await store.deleteTask(last.id);
      return `🗑️ Apaguei a tarefa *${last.title}*.`;
    },
  };
}

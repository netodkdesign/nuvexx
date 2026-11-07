import { addDays } from './dates.js';

// Um intervalo menor que isso não vale a pena citar.
const MIN_FREE_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;
const TASKS_NAMED = 3;
const DAY_LIMIT = 200;

const toMinutes = (hhmm) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
};

const toTime = (total) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

const DAY_MINUTES = 24 * 60;

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

const countLabel = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function nameList(names) {
  const shown = names.slice(0, TASKS_NAMED);
  const hidden = names.length - shown.length;
  if (hidden > 0) return `${shown.join(', ')} e mais ${hidden}`;
  if (shown.length < 2) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} e ${shown.at(-1)}`;
}

// Soma o tempo ocupado sem contar duas vezes o que se sobrepõe, e acha o maior intervalo.
function measureDay(timed) {
  let busy = 0;
  let free = null;
  let overlap = null;
  let currentEnd = null;
  let endLabel = null;
  let lastRow = null;
  for (const row of timed) {
    const start = toMinutes(row.start_time);
    const rawEnd = row.end_time ? toMinutes(row.end_time) : start + DEFAULT_DURATION_MINUTES;
    // Um fim menor que o início passou da meia-noite: para hoje, ocupa até o fim do dia.
    const end = rawEnd > start ? rawEnd : DAY_MINUTES;
    if (currentEnd !== null && start < currentEnd) overlap ??= [lastRow.title, row.title];
    if (currentEnd !== null && start - currentEnd >= MIN_FREE_MINUTES && start - currentEnd > (free?.minutes ?? 0)) {
      free = { minutes: start - currentEnd, label: formatDuration(start - currentEnd), after: lastRow.title, before: row.title };
    }
    busy += Math.max(0, end - Math.max(start, currentEnd ?? start));
    if (currentEnd === null || end > currentEnd) {
      currentEnd = end;
      endLabel = row.end_time ?? toTime(end);
      lastRow = row;
    }
  }
  return { busy, free, overlap, end: endLabel };
}

function describeAppointments(timed, allDay, measured) {
  const lines = [];
  if (timed.length === 1) {
    lines.push(`Hoje você tem *${timed[0].title}*, às *${timed[0].start_time}*.`);
  } else if (timed.length > 1) {
    const total = timed.length + allDay.length;
    lines.push(`Seu dia vai das *${timed[0].start_time}* às *${measured.end}*, com *${total} compromissos*.`);
    if (measured.free) lines.push(`Você tem *${measured.free.label} livres* entre ${measured.free.after} e ${measured.free.before}.`);
    else if (!measured.overlap) lines.push('Os horários estão bem seguidos, então reserve um tempo para você.');
  }
  if (measured.overlap) lines.push(`Atenção: *${measured.overlap[0]}* e *${measured.overlap[1]}* ficam no mesmo horário.`);
  if (allDay.length) lines.push(`O dia todo: *${nameList(allDay.map((row) => row.title))}*.`);
  return lines;
}

function describeTasks(dueToday, overdue) {
  const lines = [];
  if (dueToday.length) {
    lines.push(`Também tem *${countLabel(dueToday.length, 'tarefa', 'tarefas')}* para hoje: ${nameList(dueToday.map((row) => row.title))}.`);
  }
  if (overdue.length) lines.push(`E há *${countLabel(overdue.length, 'tarefa atrasada', 'tarefas atrasadas')}*.`);
  return lines;
}

export function buildDayPlan({ date, appointments, tasks }) {
  const timed = appointments.filter((row) => row.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const allDay = appointments.filter((row) => !row.start_time);
  const dueToday = tasks.filter((row) => row.due_on === date);
  const overdue = tasks.filter((row) => row.due_on && row.due_on < date);
  const measured = measureDay(timed);
  const isEmpty = !appointments.length && !dueToday.length && !overdue.length;

  const appointmentLines = describeAppointments(timed, allDay, measured);
  const taskLines = describeTasks(dueToday, overdue);
  let lines;
  if (isEmpty) lines = ['Sua agenda está livre hoje. Nada marcado por enquanto.'];
  else if (!appointmentLines.length) lines = ['Sua agenda está livre hoje.', ...taskLines];
  else lines = [...appointmentLines, ...taskLines];

  return {
    date,
    timed,
    all_day: allDay,
    tasks_today: dueToday,
    overdue_count: overdue.length,
    is_empty: isEmpty,
    message: lines.join(' '),
    stats: {
      count: appointments.length,
      start: timed[0]?.start_time ?? null,
      end: measured.end,
      busy_minutes: measured.busy,
      busy_label: measured.busy ? formatDuration(measured.busy) : null,
      free: measured.free,
    },
  };
}

export async function dayPlan(store, date) {
  const [appointments, tasks] = await Promise.all([
    store.listAppointments({ from: date, to: addDays(date, 1), limit: DAY_LIMIT }),
    store.openTasks(),
  ]);
  return buildDayPlan({ date, appointments, tasks });
}

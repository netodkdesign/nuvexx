import { parseAgenda, parseWhen } from '../agenda-parser.js';
import { addDays, addMinutesToTime, shortDate, WEEKDAY_NAMES, weekday, zonedToUtc } from '../dates.js';
import { dayPlan } from '../day-plan.js';
import { SYNC } from '../google.js';
import { parseMessage } from '../parser.js';
import { parseTasks } from '../tasks-parser.js';
import { fold } from '../text.js';

const PENDING_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TITLE = 120;
const GIVE_UP = /^(?:cancelar|cancela|cancele|desistir|desisto|deixa|deixa pra la|deixa para la|esquece|nao|nao quero|nao sei|nao sei ainda|ainda nao sei|depois|depois eu vejo|depois vejo|agora nao)$/;
const REMINDER_LEAD_MS = 60 * 60 * 1000;
const ALL_DAY_REMINDER_TIME = '08:00';
const DEFAULT_DURATION_MINUTES = 60;
const UPCOMING_DAYS = 30;
const LIST_LIMIT = 15;

export function describeDay(date, today) {
  if (date === today) return 'hoje';
  if (date === addDays(today, 1)) return 'amanhã';
  return `${WEEKDAY_NAMES[weekday(date)]}, ${shortDate(date, today)}`;
}

export function describeWhen(appointment, today) {
  const day = describeDay(appointment.starts_on, today);
  return appointment.start_time ? `${day}, às ${appointment.start_time}` : `${day}, o dia todo`;
}

const whenQuestion = (title) => `Para quando é *${title}*? Mande o dia e o horário, como *amanhã às 10*. Para desistir, mande *cancelar*.`;

const hasPassed = ({ date, time }, { today, nowTime }) => date < today || (date === today && time && time <= nowTime);

const syncLine = {
  [SYNC.SYNCED]: 'Já está no seu Google Agenda.',
  [SYNC.RETRY]: 'O Google não respondeu agora. Vou tentar de novo, e o compromisso entra na sua agenda sozinho.',
};

export function createAgendaAdvisor({ config, google }) {
  const { timeZone, appUrl } = config;

  function schedule({ date, time }, now) {
    const startsAt = zonedToUtc(date, time ?? '00:00', timeZone);
    const reminder = time
      ? new Date(startsAt.getTime() - REMINDER_LEAD_MS)
      : zonedToUtc(date, ALL_DAY_REMINDER_TIME, timeZone);
    return { startsAt, remindAt: reminder > now ? reminder : null };
  }

  const notConnectedLine = () =>
    google.isConfigured() ? 'Para ele aparecer no Google Agenda, mande *conectar google*.' : null;

  const syncMessage = (status) => (status === SYNC.NOT_CONNECTED ? notConnectedLine() : syncLine[status]);

  async function create(fields, store, now, source) {
    const { startsAt, remindAt } = schedule(fields, now);
    const endTime = fields.time ? fields.endTime ?? addMinutesToTime(fields.time, DEFAULT_DURATION_MINUTES) : null;
    const appointment = await store.addAppointment({
      title: fields.title,
      date: fields.date,
      startTime: fields.time ?? null,
      endTime,
      startsAt,
      remindAt,
      source,
    });
    const status = await google.syncAppointment(appointment);
    return { appointment, status };
  }

  async function update(existing, fields, store, now) {
    const { startsAt, remindAt } = schedule(fields, now);
    const endTime = fields.time ? fields.endTime ?? addMinutesToTime(fields.time, DEFAULT_DURATION_MINUTES) : null;
    const appointment = await store.updateAppointment(existing.id, {
      title: fields.title,
      date: fields.date,
      startTime: fields.time ?? null,
      endTime,
      startsAt,
      remindAt,
    });
    const status = await google.syncAppointment(appointment);
    return { appointment, status };
  }

  async function remove(appointment, store) {
    await store.deleteAppointment(appointment.id);
    await google.removeEvent(appointment.user_id, appointment.google_event_id);
  }

  async function findUpcoming(query, store, today) {
    const rows = await store.listAppointments({ from: today, to: addDays(today, 365) });
    return rows.find((row) => fold(row.title).includes(query)) ?? null;
  }

  async function replyCreate(parsed, store, { now, today, nowTime, source }) {
    if (hasPassed(parsed, { today, nowTime })) return 'Essa data já passou. Mande de novo com o dia e o horário certos.';
    const conflict = parsed.time
      ? await store.conflictsWith({
        date: parsed.date,
        startTime: parsed.time,
        endTime: parsed.endTime ?? addMinutesToTime(parsed.time, DEFAULT_DURATION_MINUTES),
      })
      : null;
    const { appointment, status } = await create(parsed, store, now, source);
    const lines = [`✅ *${appointment.title}*: ${describeWhen(appointment, today)}.`];
    if (appointment.remind_at) lines.push(appointment.start_time ? 'Te aviso 1 hora antes.' : 'Te aviso às 8h desse dia.');
    if (conflict) lines.push(`⚠️ Nesse horário você também tem *${conflict.title}*, às ${conflict.start_time}.`);
    const sync = syncMessage(status);
    if (sync) lines.push(sync);
    return lines.join('\n');
  }

  async function replyList({ range }, store, today) {
    const from = range?.from ?? today;
    const to = range?.to ?? addDays(today, UPCOMING_DAYS);
    const rows = await store.listAppointments({ from, to, limit: LIST_LIMIT });
    const label = range?.label ?? (range ? describeDay(from, today) : 'Próximos 30 dias');
    if (!rows.length) return `*${label}*\nNenhum compromisso marcado.`;
    const lines = rows.map((row) => `• ${describeWhen(row, today)}: ${row.title}`);
    return [`*${label}*`, ...lines].join('\n');
  }

  async function replyMove(parsed, store, { now, today, nowTime }) {
    const existing = await findUpcoming(parsed.query, store, today);
    if (!existing) return `Não encontrei nenhum compromisso futuro com "${parsed.query}".`;
    const date = parsed.date ?? existing.starts_on;
    const time = parsed.time ?? existing.start_time;
    if (date < today || (date === today && time && time <= nowTime)) return 'Esse horário já passou. Mande de novo com o dia e o horário certos.';
    const { appointment, status } = await update(
      existing,
      { title: existing.title, date, time, endTime: parsed.time ? parsed.endTime : existing.end_time },
      store,
      now,
    );
    const lines = [`🔁 *${appointment.title}* agora é ${describeWhen(appointment, today)}.`];
    const sync = syncMessage(status);
    if (sync) lines.push(sync);
    return lines.join('\n');
  }

  async function replyCancel(parsed, store, { today }) {
    const existing = await findUpcoming(parsed.query, store, today);
    if (!existing) return `Não encontrei nenhum compromisso futuro com "${parsed.query}".`;
    await remove(existing, store);
    return `🗑️ Cancelei *${existing.title}*, que era ${describeWhen(existing, today)}.`;
  }

  async function askWhen(title, store, now) {
    await store.savePendingEvent(title, new Date(now.getTime() + PENDING_TTL_MS));
    return whenQuestion(title);
  }

  async function book(title, { date, time, endTime }, store, context) {
    const parsed = { title: title.slice(0, MAX_TITLE), date, time, endTime };
    // O evento continua guardado: a próxima resposta ainda pode acertar o dia.
    if (hasPassed(parsed, context)) return `Esse horário já passou.\n\n${whenQuestion(parsed.title)}`;
    await store.clearPendingEvent();
    return replyCreate(parsed, store, context);
  }

  return {
    create,
    update,
    remove,

    // Retorna null quando a mensagem é outro assunto, e a pergunta fica para depois.
    async answerPending({ title }, text, store, context) {
      const { now, today, nowTime } = context;
      const simple = fold(String(text ?? '')).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (GIVE_UP.test(simple) || parseMessage(text, today).type === 'undo') {
        await store.clearPendingEvent();
        return `Tudo bem, não marquei *${title}*.`;
      }
      if (parseTasks(text, today, nowTime)) return null;
      const request = parseAgenda(text, today, nowTime);
      // "Agenda de hoje" e "cancelar dentista" têm uma data ou um pedido, mas não respondem à pergunta.
      if (request && !['agenda_create', 'agenda_need_when'].includes(request.type)) return null;

      const when = parseWhen(text, today, nowTime);
      if (when) return book(when.detail ? `${title} ${when.detail}` : title, when, store, context);

      if (request?.type === 'agenda_need_when') return request.title ? askWhen(request.title, store, now) : whenQuestion(title);
      if (request?.type !== 'agenda_create') return null;
      // Mandou o evento de novo, inteiro: "reunião com José amanhã às 10".
      const [known, sent] = [fold(title), fold(request.title)];
      if (!known.includes(sent) && !sent.includes(known)) return null;
      return book(sent.length > known.length ? request.title : title, request, store, context);
    },

    reminder: ({ title }) => `📅 E *${title}*, para quando? Mande o dia e o horário, ou *cancelar* para desistir.`,

    askAgain: ({ title }) => `Não entendi.\n\n${whenQuestion(title)}`,

    needWhat: (text) => `Marcar o quê? Mande junto o que é, como *dentista ${String(text).trim().toLowerCase()}*.`,

    async handle(parsed, user, store, context) {
      switch (parsed.type) {
        case 'agenda_create': return replyCreate(parsed, store, context);
        case 'agenda_list': return replyList(parsed, store, context.today);
        case 'agenda_move': return replyMove(parsed, store, context);
        case 'agenda_cancel': return replyCancel(parsed, store, context);
        case 'agenda_need_when':
          return parsed.title ? askWhen(parsed.title, store, context.now) : 'Para quando? Mande o dia e o horário, como *dentista quinta às 15h*.';
        case 'agenda_connect': return context.connectReply(user);
        case 'agenda_brief': return (await dayPlan(store, context.today)).message;
        default: throw new Error(`Pedido de agenda desconhecido: ${parsed.type}`);
      }
    },

    async undo(last, store, today) {
      await remove(last, store);
      return `🗑️ Cancelei *${last.title}*, que era ${describeWhen(last, today)}.`;
    },

    googleStartLink: (token) => `${appUrl}/google/conectar?t=${token}`,
  };
}

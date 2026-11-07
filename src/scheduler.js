import { accessOf } from './access.js';
import { describeWhen } from './advisors/agenda.js';
import { describeDue } from './advisors/tasks.js';
import { ADVISORS, advisorHeading } from './assistant.js';
import { timeIn, todayIn } from './dates.js';
import { dayPlan } from './day-plan.js';
import { emails } from './email.js';
import { extendRecurrence } from './recurrences.js';
import { sendTemplate as sendWhatsAppTemplate, sendText as sendWhatsAppText } from './whatsapp.js';

const TICK_MS = 60_000;
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
// Depois de o app ter ficado fora do ar, um lembrete muito atrasado não ajuda mais.
const REMINDER_STALE_MS = 2 * 60 * 60 * 1000;
const BRIEFING_TIME = '05:30';
// Se o app ficou fora do ar, um "bom dia" depois disso já não ajuda.
const BRIEFING_LAST_TIME = '10:00';

export function createScheduler({
  db, google, config, mailer, sendText = sendWhatsAppText, sendTemplate = sendWhatsAppTemplate, log = console,
}) {
  const { whatsapp, timeZone, appUrl } = config;
  let timer = null;
  let running = false;
  let lastCleanupDay = null;

  // Retorna false quando a Meta não entregaria: fora da janela de 24 horas, só com modelo aprovado.
  async function remindByWhatsApp(row, when, now, advisor) {
    if (!row.wa_id) return false;
    const insideWindow = row.last_inbound_at && now - new Date(row.last_inbound_at) < SERVICE_WINDOW_MS;
    if (insideWindow) {
      await sendText(whatsapp, row.wa_id, `${advisorHeading(advisor)}\n⏰ Lembrete: *${row.title}*, ${when}.`);
      return true;
    }
    if (!whatsapp.reminderTemplate) return false;
    await sendTemplate(whatsapp, row.wa_id, whatsapp.reminderTemplate, [row.title, when]);
    return true;
  }

  // O WhatsApp é opcional: sem ele, ou se ele falhar, o lembrete vai por e-mail.
  async function sendReminder(row, when, now, advisor) {
    try {
      if (await remindByWhatsApp(row, when, now, advisor)) return;
    } catch (err) {
      log.error(`Lembrete ${row.id} pelo WhatsApp: ${err.message}`);
    }
    if (row.email_reminders) await mailer.send(emails.reminder({ to: row.email, title: row.title, when, appUrl }));
  }

  async function sendDue(rows, markDone, describe, advisor, now) {
    for (const row of rows) {
      // Marca antes de enviar: se algo falhar, a pessoa fica sem um lembrete, mas nunca recebe repetido.
      await markDone(row.id, now);
      const stale = now - new Date(row.remind_at) > REMINDER_STALE_MS;
      if (stale || accessOf(row, now) === 'expired') continue;
      try {
        await sendReminder(row, describe(row), now, advisor);
      } catch (err) {
        log.error(`Lembrete ${row.id}: ${err.message}`);
      }
    }
  }

  async function sendReminders(now) {
    const today = todayIn(timeZone, now);
    await sendDue(await db.dueReminders(now), db.markReminded, (row) => describeWhen(row, today), ADVISORS.agenda, now);
    await sendDue(await db.dueTaskReminders(now), db.markTaskReminded, (row) => describeDue(row, today), ADVISORS.tasks, now);
  }

  // Retorna por onde o resumo saiu. Fora da janela de 24 horas, a Meta só entrega modelo aprovado.
  async function deliverBriefing(user, plan, now) {
    const firstName = user.name.split(/\s+/)[0];
    if (user.wa_id) {
      try {
        const insideWindow = user.last_inbound_at && now - new Date(user.last_inbound_at) < SERVICE_WINDOW_MS;
        if (insideWindow) {
          await sendText(whatsapp, user.wa_id, `${advisorHeading(ADVISORS.agenda)}\nBom dia, ${firstName}!\n${plan.message}`);
          return 'whatsapp';
        }
        if (whatsapp.briefingTemplate) {
          await sendTemplate(whatsapp, user.wa_id, whatsapp.briefingTemplate, [plan.message.replace(/\*/g, '')]);
          return 'whatsapp';
        }
      } catch (err) {
        log.error(`Resumo do dia pelo WhatsApp: ${err.message}`);
      }
    }
    await mailer.send(emails.dailyBriefing({ to: user.email, name: firstName, message: plan.message, appUrl }));
    return 'email';
  }

  async function sendBriefings(now) {
    const time = timeIn(timeZone, now);
    if (time < BRIEFING_TIME || time >= BRIEFING_LAST_TIME) return;
    const today = todayIn(timeZone, now);
    for (const user of await db.usersAwaitingBriefing(today)) {
      // Marca antes de enviar, como nos lembretes: nunca sai repetido.
      await db.markBriefing(user.id, today, null);
      if (accessOf(user, now) === 'expired') continue;
      try {
        const plan = await dayPlan(db.forUser(user.id), today);
        // Dia sem nada marcado não vira mensagem nem custo.
        if (!plan.is_empty) await db.markBriefing(user.id, today, await deliverBriefing(user, plan, now));
      } catch (err) {
        log.error(`Resumo do dia da conta ${user.id}: ${err.message}`);
      }
    }
  }

  async function tick(now = new Date()) {
    if (running) return;
    running = true;
    try {
      await google.processQueue(now);
      await sendReminders(now);
      await sendBriefings(now);
      const day = todayIn(timeZone, now);
      if (day !== lastCleanupDay) {
        lastCleanupDay = day;
        await db.cleanup(now);
        for (const rule of await db.recurrencesToExtend(day)) await extendRecurrence(db.forUser(rule.user_id), rule, day);
      }
    } catch (err) {
      log.error(`Rotina periódica: ${err.message}`);
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    stop: () => clearInterval(timer),
  };
}

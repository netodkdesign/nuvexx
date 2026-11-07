import { accessOf } from './access.js';
import { createAgendaAdvisor } from './advisors/agenda.js';
import { createFinanceAdvisor, FINANCE_TYPES, PLANNED_TYPES } from './advisors/finance.js';
import { createMaintenanceAdvisor } from './advisors/maintenance.js';
import { createTasksAdvisor } from './advisors/tasks.js';
import { parseAgenda, parseWhen } from './agenda-parser.js';
import { createLimiter, hashLinkCode, signToken } from './auth.js';
import { shortDate, timeIn, todayIn } from './dates.js';
import { emails } from './email.js';
import { extractAccount, parseMessage } from './parser.js';
import { canonicalPhone, formatPhone, isBrazilian } from './phone.js';
import { parsePlanned } from './planned-parser.js';
import { fromSpeech } from './speech.js';
import { parseTasks } from './tasks-parser.js';
import { canTranscribe, UnsupportedAudioError } from './transcription.js';
import { MediaTooLargeError } from './whatsapp.js';

// Os nomes e as fotos também estão em public/app.js. Para trocar, mude nos dois lugares.
export const ADVISORS = {
  finance: { emoji: '💰', name: 'Caio', title: 'Assessor Financeiro' },
  agenda: { emoji: '📅', name: 'Cris', title: 'Assessora de Agenda' },
  tasks: { emoji: '📝', name: 'Nina', title: 'Assessora de Tarefas' },
};

export const advisorHeading = (advisor) => `${advisor.emoji} *${advisor.name}, ${advisor.title}*`;

const WHATSAPP_MAX_LENGTH = 4000;
const DELETION_WINDOW_MS = 10 * 60 * 1000;
const GOOGLE_LINK_TTL_MS = 30 * 60 * 1000;
const LINK_ATTEMPTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const NON_TEXT_REPLY = 'Por enquanto só entendo mensagens de texto. Mande escrito, como *mercado 50* ou *dentista quinta às 15h*.';
const NOT_TEXT_NOR_AUDIO_REPLY = 'Por enquanto só entendo texto e áudio. Mande escrito ou grave uma mensagem de voz, como *mercado 50* ou *dentista quinta às 15h*.';
const AUDIO_HELP = '🎤 Também entendo áudio: é só gravar, como *gastei 50 reais de gasolina*. Mande um pedido de cada vez.';
const AUDIO_TOO_LONG = 'Esse áudio é longo demais para mim. Grave um mais curto, com um pedido de cada vez, como *gastei 50 de gasolina*.';
const AUDIO_UNSUPPORTED = 'Não consigo ouvir esse tipo de arquivo. Grave uma mensagem de voz aqui mesmo no WhatsApp ou mande escrito.';
const AUDIO_FAILED = 'Não consegui ouvir esse áudio agora, e nada foi anotado. Tente de novo em instantes ou mande escrito, como *mercado 50*.';
const AUDIO_SILENT = 'Não consegui entender esse áudio, e nada foi anotado. Grave de novo, falando perto do microfone, ou mande escrito.';
const HEARD_MAX_LENGTH = 300;
const UNKNOWN_TEXT = 'Não entendi. Para anotar um gasto, mande o que foi e o valor, como *mercado 50*. Para marcar um compromisso, mande o dia e o horário, como *dentista quinta às 15h*. Para anotar uma tarefa, mande *tarefa pagar luz sexta às 15h*. Envie *ajuda* para ver tudo.';

const HELP_TEXT = [
  'Somos seus três assessores. É só mandar mensagem.',
  '',
  advisorHeading(ADVISORS.finance),
  '• gastei 50 no mercado',
  '• uber 23,50 no nubank',
  '• tv 1200 em 10x',
  '• recebi 3000 de salário',
  '• vou receber 2000 dia 20',
  '• aluguel 1800 todo dia 10',
  '• salário 5000 todo dia 5',
  '• troca de óleo 250 na oficina do zé: pergunto o que faltar e guardo no histórico do veículo',
  '• *quanto ainda vai sair* ou *a receber*',
  '• *resumo* ou *quanto gastei de mercado*',
  '• *categoria lazer*: corrige o último gasto',
  '',
  advisorHeading(ADVISORS.agenda),
  '• dentista quinta às 15h',
  '• reunião com Ana amanhã às 10',
  '• *agenda*, *o que tenho hoje* ou *como é meu dia*',
  '• *remarcar dentista para sexta às 9*',
  '• *cancelar dentista*',
  '• *conectar google*: liga ao Google Agenda',
  '',
  advisorHeading(ADVISORS.tasks),
  '• tarefa pagar luz sexta às 15h',
  '• preciso comprar leite',
  '• *tarefas* ou *o que tenho que fazer hoje*',
  '• *concluí pagar luz*',
  '• *adiar tarefa luz para segunda às 10h*',
  '• *apagar tarefa luz*',
  '',
  'Sua conta:',
  '• *desfazer*: apaga o último registro',
  '• *entrar*: endereço para abrir no navegador',
  '• *assinar*: sua assinatura',
  '• *desconectar whatsapp*',
  '• *apagar minha conta*',
].join('\n');

const sign = (advisor, body) => `${advisorHeading(advisor)}\n${body}`;

export function createAssistant({ db, config, google, mailer, log = console }) {
  const { timeZone, appUrl, product } = config;
  const finance = createFinanceAdvisor();
  const maintenance = createMaintenanceAdvisor();
  const agenda = createAgendaAdvisor({ config, google });
  const tasks = createTasksAdvisor({ config });
  const linkAttempts = createLimiter({ max: LINK_ATTEMPTS_PER_HOUR, windowMs: HOUR_MS });
  const strangerReplies = createLimiter({ max: 1, windowMs: DAY_MS });
  const dayLabel = (date) => {
    const day = todayIn(timeZone, date);
    return `${shortDate(day)}/${day.slice(0, 4)}`;
  };

  // Quem manda o código prova que o número é dele; quem gerou o código, que a conta é dele.
  async function linkNumber(phone, from, code, sentAt) {
    // A cobrança da Meta muda de país para país, e o serviço é para o Brasil.
    if (!isBrazilian(phone)) return 'Por enquanto, o WhatsApp só funciona com números do Brasil. Sua conta continua funcionando normalmente pelo site.';
    if (linkAttempts.blocked(phone)) return null;
    const userId = await db.useWhatsappCode(hashLinkCode(config, code), sentAt);
    if (!userId) {
      linkAttempts.hit(phone);
      return `Esse código venceu ou não existe. Gere outro em ${appUrl}, na aba Conta.`;
    }
    const user = await db.linkWhatsapp(userId, phone, from, sentAt);
    mailer.deliver(emails.whatsappLinked({ to: user.email, phone: formatPhone(phone) }));
    return `Pronto! Este número agora está conectado à sua conta.\n\n${HELP_TEXT}`;
  }

  // Cada resposta custa dinheiro: quem não tem conta recebe a orientação uma vez por dia.
  function strangerReply(phone) {
    if (!isBrazilian(phone) || strangerReplies.blocked(phone)) return null;
    strangerReplies.hit(phone);
    return [
      'Oi! Este número ainda não está conectado a uma conta do Nuvexx.',
      '',
      `Crie sua conta ou entre em ${appUrl}. Depois, na aba Conta, toque em *Conectar WhatsApp*.`,
    ].join('\n');
  }

  function linkAgainReply(source) {
    if (source !== 'whatsapp') return 'Esse código precisa ser enviado pelo WhatsApp, não por aqui.';
    return 'Este número já está conectado a uma conta. Para usar outra, mande *desconectar whatsapp* e depois o código de novo.';
  }

  async function unlinkReply(user) {
    if (!user.phone) return 'Seu WhatsApp não está conectado.';
    await db.unlinkWhatsapp(user.id);
    return `Pronto, desconectei o WhatsApp. Sua conta e seus dados continuam em ${appUrl}`;
  }

  function subscribeReply(user, now) {
    const access = accessOf(user, now);
    const status = {
      paid: `Sua assinatura está ativa até ${dayLabel(new Date(user.paid_until ?? now))}.`,
      trial: `Seu teste grátis vai até ${dayLabel(new Date(user.trial_ends_at ?? now))}.`,
      expired: 'Seu teste grátis terminou.',
    }[access];
    const link = product.subscribeUrl ? `Para assinar ou cancelar: ${product.subscribeUrl}` : 'A assinatura ainda não está disponível. Avisaremos você.';
    return `${status}\n${link}`;
  }

  async function requestDeletion(user, now) {
    await db.requestDeletion(user.id, now);
    return 'Isso apaga sua conta e todos os seus gastos e compromissos, sem volta. Os eventos já enviados ao Google Agenda continuam lá.\n\nPara confirmar, responda *confirmar exclusão* em até 10 minutos.';
  }

  async function confirmDeletion(user, now) {
    const requestedAt = user.deletion_requested_at ? new Date(user.deletion_requested_at).getTime() : 0;
    if (now.getTime() - requestedAt > DELETION_WINDOW_MS) return 'Para apagar sua conta, mande primeiro *apagar minha conta*.';
    await google.disconnect(user.id);
    await db.deleteUser(user.id);
    return 'Pronto. Apaguei sua conta e todos os seus dados.';
  }

  function connectReply(user) {
    if (!google.isConfigured()) return 'A conexão com o Google Agenda ainda não está disponível.';
    const token = signToken(config, 'google-inicio', { userId: user.id }, GOOGLE_LINK_TTL_MS);
    return `Abra este link para conectar o seu Google Agenda:\n${agenda.googleStartLink(token)}`;
  }

  function paywallText() {
    const next = product.subscribeUrl ? `Para continuar, assine: ${product.subscribeUrl}` : 'A assinatura ficará disponível em breve.';
    return `Seu teste grátis terminou, então não anotei esta mensagem.\n${next}\n\nSeus dados continuam guardados em ${appUrl}`;
  }

  async function undoLast(store, today) {
    const [expense, income, recurrence, appointment, task] = await Promise.all([
      store.lastExpense(), store.lastIncome(), store.lastRecurrence(), store.lastAppointment(), store.lastTask(),
    ]);
    const candidates = [
      expense && { row: expense, undo: async () => sign(ADVISORS.finance, await finance.undo(expense, store, today)) },
      income && { row: income, undo: async () => sign(ADVISORS.finance, await finance.undoIncome(income, store, today)) },
      recurrence && { row: recurrence, undo: async () => sign(ADVISORS.finance, await finance.undoRecurrence(recurrence, store)) },
      appointment && { row: appointment, undo: async () => sign(ADVISORS.agenda, await agenda.undo(appointment, store, today)) },
      task && { row: task, undo: async () => sign(ADVISORS.tasks, await tasks.undo(task, store)) },
    ].filter(Boolean);
    if (!candidates.length) return 'Não há nada para desfazer.';
    const newest = candidates.reduce((a, b) => (new Date(b.row.created_at) >= new Date(a.row.created_at) ? b : a));
    return newest.undo();
  }

  async function paywallReply(user, { source, usage, now }) {
    if (source !== 'whatsapp') return paywallText();
    // Cada resposta custa dinheiro: quem não assinou recebe o aviso uma vez por dia.
    if (usage?.paywall_warned) return null;
    await db.markPaywallWarned(user.id, todayIn(timeZone, now));
    return paywallText();
  }

  // O áudio vira texto e segue o mesmo caminho de uma mensagem escrita. A resposta mostra o que foi ouvido,
  // porque um número mal entendido só aparece para quem lê.
  async function respondToAudio(user, listen, options) {
    if (accessOf(user, options.now) === 'expired') return paywallReply(user, options);
    let heard;
    try {
      heard = await listen();
    } catch (err) {
      if (err instanceof MediaTooLargeError) return AUDIO_TOO_LONG;
      if (err instanceof UnsupportedAudioError) return AUDIO_UNSUPPORTED;
      log.error(`Áudio: ${err.message}`);
      return AUDIO_FAILED;
    }
    if (!heard) return AUDIO_SILENT;
    const reply = await respond(user, fromSpeech(heard), options);
    const shown = heard.length > HEARD_MAX_LENGTH ? `${heard.slice(0, HEARD_MAX_LENGTH)}…` : heard;
    const parts = [`🎤 Ouvi: "${shown}"`, reply];
    if (reply?.includes('✅')) parts.push('Ouvi errado? Mande *desfazer*.');
    return parts.filter(Boolean).join('\n\n');
  }

  // Com uma pergunta em aberto, a mensagem primeiro tenta ser a resposta.
  // Se for outro assunto, ele é atendido e a pergunta volta no fim.
  async function respond(user, text, options) {
    const { now, source } = options;
    if (accessOf(user, now) === 'expired') return route(user, text, options);
    const store = db.forUser(user.id);
    const context = { now, today: todayIn(timeZone, now), nowTime: timeIn(timeZone, now), source };

    const event = await store.pendingEvent(now);
    if (!event) return respondToService(user, text, options, store, context);
    const answer = await agenda.answerPending(event, text, store, context);
    if (answer) return sign(ADVISORS.agenda, answer);
    const reply = await respondToService(user, text, options, store, context);
    if (reply === UNKNOWN_TEXT) return sign(ADVISORS.agenda, agenda.askAgain(event));
    const stillPending = await store.pendingEvent(now);
    return reply && stillPending ? `${reply}\n\n${agenda.reminder(stillPending)}` : reply;
  }

  async function respondToService(user, text, options, store, context) {
    const pending = await store.pendingService(options.now);
    if (!pending) return route(user, text, options);
    const answer = await maintenance.answer(pending, text, store, context);
    if (answer) return sign(ADVISORS.finance, answer);
    const reply = await route(user, text, options);
    const stillPending = await store.pendingService(options.now);
    return reply && stillPending ? `${reply}\n\n${await maintenance.reminder(stillPending, store)}` : reply;
  }

  // Quem responde: pedidos da conta primeiro, depois tarefas e agenda quando há sinal delas, e por fim as finanças.
  async function route(user, text, { source, now, usage }) {
    const today = todayIn(timeZone, now);
    const nowTime = timeIn(timeZone, now);
    const store = db.forUser(user.id);
    const context = { now, today, nowTime, source, connectReply };
    const parsed = parseMessage(text, today);

    switch (parsed.type) {
      case 'help': return source === 'whatsapp' && canTranscribe(config) ? `${HELP_TEXT}\n\n${AUDIO_HELP}` : HELP_TEXT;
      case 'thanks': return 'Por nada! 😉';
      case 'login': return source === 'whatsapp' ? `Sua conta abre em qualquer navegador: ${appUrl}\nSe esqueceu a senha, use *Esqueci minha senha* na tela de entrada.` : 'Você já está no app.';
      case 'whatsapp_link': return linkAgainReply(source);
      case 'whatsapp_unlink': return unlinkReply(user);
      case 'subscribe': return subscribeReply(user, now);
      case 'delete_account': return requestDeletion(user, now);
      case 'confirm_delete': return confirmDeletion(user, now);
      default:
    }

    if (accessOf(user, now) === 'expired') return paywallReply(user, { source, usage, now });

    if (parsed.type === 'undo') return undoLast(store, today);

    const taskRequest = parseTasks(text, today, nowTime);
    if (taskRequest) return sign(ADVISORS.tasks, await tasks.handle(taskRequest, store, context));

    if (parsed.type === 'expense' || parsed.type === 'unknown' || parsed.type === 'income') {
      const planned = parsePlanned(text, today);
      if (planned && PLANNED_TYPES.has(planned.type)) {
        const mention = planned.type === 'planned' ? extractAccount(text, await store.accounts()) : null;
        const withoutAccount = mention && parsePlanned(mention.text, today);
        const request = withoutAccount?.type === 'planned' ? withoutAccount : planned;
        const account = request === withoutAccount ? mention.account : null;
        return sign(ADVISORS.finance, await finance.handle(request, store, { ...context, account }));
      }
    }

    if (parsed.type === 'expense' || parsed.type === 'unknown') {
      const agendaRequest = parseAgenda(text, today, nowTime);
      if (agendaRequest) return sign(ADVISORS.agenda, await agenda.handle(agendaRequest, user, store, context));
      // "Amanhã às 10" sozinho é um horário sem compromisso: o 10 não é um gasto de 10 reais.
      const when = parseWhen(text, today, nowTime);
      if (when?.marked && !when.detail) return sign(ADVISORS.agenda, agenda.needWhat(text));
      if (await maintenance.isService(text, store)) return sign(ADVISORS.finance, await maintenance.start(text, store, context));
    }

    // Várias linhas, todas com valor: cada linha é um gasto.
    const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 1) {
      const parsedLines = lines.map((line) => parseMessage(line, today));
      if (parsedLines.every((item) => item.type === 'expense')) {
        return sign(ADVISORS.finance, await finance.handleBatch(parsedLines, store, context));
      }
    }

    if (parsed.type === 'expense' || (parsed.type === 'income' && parsed.amountCents)) {
      const mention = extractAccount(text, await store.accounts());
      const withoutAccount = mention && parseMessage(mention.text, today);
      if (withoutAccount?.type === parsed.type) {
        return sign(ADVISORS.finance, await finance.handle(withoutAccount, store, { ...context, account: mention.account }));
      }
    }

    if (FINANCE_TYPES.has(parsed.type)) return sign(ADVISORS.finance, await finance.handle(parsed, store, context));
    return UNKNOWN_TEXT;
  }

  const clip = (reply) => (reply && reply.length > WHATSAPP_MAX_LENGTH ? `${reply.slice(0, WHATSAPP_MAX_LENGTH)}…` : reply);

  return {
    agenda,
    tasks,

    // Mensagem recebida pelo WhatsApp. Retorna o texto da resposta, ou null para não responder.
    async handleWhatsApp({ from, text, isText = true, sentAt = new Date(), listen = null }) {
      const phone = canonicalPhone(from);
      const user = await db.userByPhone(phone);
      if (!user) {
        const parsed = isText ? parseMessage(text, todayIn(timeZone, sentAt)) : null;
        return parsed?.type === 'whatsapp_link' ? linkNumber(phone, from, parsed.code, sentAt) : strangerReply(phone);
      }
      await db.touchUser(user.id, from, sentAt);
      const usage = await db.countUsage(user.id, todayIn(timeZone, sentAt));

      if (usage.messages > product.messageLimitPerDay) {
        if (usage.limit_warned) return null;
        await db.markLimitWarned(user.id, usage.day);
        return `Você chegou ao limite de ${product.messageLimitPerDay} mensagens por dia. Amanhã eu volto a anotar.`;
      }

      const options = { source: 'whatsapp', now: sentAt, usage };
      if (listen) return clip(await respondToAudio(user, listen, options));
      if (!isText) return canTranscribe(config) ? NOT_TEXT_NOR_AUDIO_REPLY : NON_TEXT_REPLY;
      return clip(await respond(user, text, options));
    },

    // Conversa dentro do app: não passa pela Meta, então não tem custo por mensagem.
    handlePanel: async ({ user, text, now = new Date() }) => clip(await respond(user, text, { source: 'app', now })),
  };
}

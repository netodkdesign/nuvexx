import { addDays, addMinutesToTime, makeDate, MONTHS, shiftMonth, weekday } from './dates.js';
import { Working } from './parser.js';
import { capitalize, fold } from './text.js';

const DEFAULT_DURATION_MINUTES = 60;
const MAX_TITLE = 120;
const NO_TITLE = 'Compromisso';

const NWB = String.raw`(?<![\p{L}\p{N}])`;
const NWA = String.raw`(?![\p{L}\p{N}])`;
const regex = (source) => new RegExp(source, 'u');

const NUMBER_WORDS = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 };
const HOUR = `\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')}`;
const PERIOD = String.raw`(?:\s+da\s+(manha|tarde|noite))?`;
const TIME_AFTER_AS = regex(`${NWB}(?:(?:para|pra|por volta)\\s+)?(?:as|pras)\\s+(${HOUR})(?:(?:h|:)(\\d{2})?)?(?:\\s*horas?)?${PERIOD}${NWA}`);
const TIME_WITH_MARK = regex(`${NWB}(\\d{1,2})(?:h(\\d{2})?|:(\\d{2}))${PERIOD}${NWA}`);
const TIME_WITH_WORD = regex(`${NWB}(\\d{1,2})\\s+horas?${PERIOD}${NWA}`);
const NOON = regex(`${NWB}(?:(?:ao|as|a)\\s+)?meio[- ]dia${NWA}`);
const MIDNIGHT = regex(`${NWB}(?:(?:a|as)\\s+)?meia[- ]noite${NWA}`);
const RANGE_END = String.raw`\s*(?:as|a|ate)\s+(\d{1,2})(?:(?:h|:)(\d{2})?)?(?:\s*horas?)?`;
// O início precisa de "das" ou de marca de hora: "dia 15 às 14h" é uma data e um horário, não um intervalo.
const RANGE_WITH_DAS = regex(`${NWB}das?\\s+(\\d{1,2})(?:(?:h|:)(\\d{2})?)?${RANGE_END}${NWA}`);
const RANGE_WITH_MARK = regex(`${NWB}(\\d{1,2})(?:h|:)(\\d{2})?${RANGE_END}${NWA}`);
const DURATION_HOURS = regex(`${NWB}(?:por|durante)\\s+(\\d{1,2})\\s*(?:h|horas?)${NWA}`);
const DURATION_MINUTES = regex(`${NWB}(?:por|durante)\\s+(\\d{1,3})\\s*(?:min|minutos?)${NWA}`);
const DURATION_HALF = regex(`${NWB}(?:por|durante)\\s+meia\\s+hora${NWA}`);

const MONTH_NAMES = MONTHS.map(fold);
const WEEKDAYS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const WEEKDAY = regex(
  `${NWB}(?:(proxima|proximo|na|no|nesta|neste|essa|esse)\\s+)?(${Object.keys(WEEKDAYS).join('|')})(?:-feira|\\s+feira)?(\\s+que\\s+vem)?(?!\\s+via)${NWA}`,
);

const CONNECT = /^(conectar|conecta|ligar|vincular|sincronizar)\s+(?:o\s+|a\s+|meu\s+|minha\s+)*(google|agenda|google agenda|calendario)$/;
const CREATE_VERB = /^(?:me\s+)?(?:marca|marcar|marque|agenda|agendar|agende|lembra|lembrar|lembre|lembrete|compromisso|novo compromisso|anota compromisso)\b/;
const FINANCE_START = /^(?:gastei|gastamos|gasto|gastos|paguei|pagamos|pago|comprei|compramos|custou|recebi|quanto|resumo|total)\b/;
const MONEY_MARK = /r\$|\breais\b/;

const BRIEF = /^(?:como\s+(?:e|esta|vai\s+ser|sera)\s+(?:o\s+)?meu\s+dia(?:\s+hoje)?|(?:o\s+)?meu\s+dia|resumo\s+de\s+hoje\s+da\s+agenda)$/;
const LIST_HEAD =/^(?:(?:qual|como)\s+(?:e\s+|esta\s+)?)?(?:(?:a|minha)\s+)*agenda\b|^(?:(?:meus|os)\s+)?(?:proximos\s+)?compromissos\b|^(?:o\s*que|oq|que)\s+(?:eu\s+)?(?:tenho|tem)\b|^tenho\s+(?:algo|compromisso|alguma coisa)\b/;
const LIST_FILLER = new Set(['de', 'da', 'do', 'para', 'pra', 'marcado', 'marcada', 'marcados', 'esta', 'essa', 'nesta', 'nessa', 'a', 'o', 'na', 'no', 'em', 'eu', 'tenho', 'minha', 'meus']);
const WEEK = regex(`${NWB}(?:(?:esta|essa|nesta|nessa|na|da|desta|dessa)\\s+)?semana${NWA}`);

const CANCEL = /^(?:cancelar|cancela|cancele|desmarcar|desmarca|desmarque|remover|remove|apagar|apaga|excluir|exclui)\s+(?:(?:o|a|meu|minha)\s+)?(?:compromisso\s+(?:de\s+|com\s+|do\s+|da\s+)?)?(.+)$/;
const MOVE = /^(?:remarcar|remarca|remarque|adiar|adia|adie|mudar|muda|mude|transferir|trocar)\s+(?:(?:o|a|meu|minha)\s+)?(.+?)\s+(?:para|pra)\s+(.+)$/;

const CONNECTORS = ['de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'com', 'pra', 'pro', 'para', 'o', 'a', 'os', 'as', 'um', 'uma', 'e', 'ao'];
const LEADING_NOISE = new Set([...CONNECTORS, 'me', 'marca', 'marcar', 'marque', 'agenda', 'agendar', 'agende', 'lembra', 'lembrar', 'lembre', 'lembrete', 'compromisso', 'novo', 'anota', 'anotar', 'tenho', 'que']);
const TRAILING_NOISE = new Set(CONNECTORS);

// O pedido que vem em volta do nome do evento: nada disto é o nome.
const GREETING = 'oi|ola|opa|ei|e ai|bom dia|boa tarde|boa noite|tudo bem|tudo bom';
const COURTESY = 'por favor|pfv|pf|favor|voce|vc|podes|pode|poderia|consegue|da pra|tem como|quero|queria|gostaria de|gostaria|preciso de|preciso|tenho de|tenho que|vou|vamos|me ajuda a';
const SCHEDULE_VERB = 'marca|marcar|marque|agenda|agendar|agende|adiciona|adicionar|adicione|acrescenta|acrescentar|acrescente|inclui|incluir|inclua|coloca|coloque|poe|ponha|bota|bote|cria|crie|anota|anotar|anote|registra|registre|salva|salve|lembra|lembrar|lembre|lembrete';
// No infinitivo, estes também são atividades: "criar apresentação" é o nome; "criar evento" é o pedido.
const ACTIVITY_VERB = 'colocar|botar|criar|registrar|salvar';
const CALENDAR = '(?:minha |meu |nossa )?(?:google agenda|google calendar|agenda|calendario)';
const TO_CALENDAR = `(?:(?:na|no|em|ao|a|para a|pra a|para|pra) )?${CALENDAR}`;
const EVENT_WORD = '(?:evento|compromisso)';

const REQUEST_HEAD = regex(`^(?:${[
  `(?:${GREETING})(?: cris)?`,
  `cris(?= (?:${COURTESY}|${SCHEDULE_VERB}|${ACTIVITY_VERB})(?: |$))`,
  COURTESY,
  'tenho|me|ai|pra mim|para mim',
  SCHEDULE_VERB,
  `(?:${ACTIVITY_VERB})(?= (?:(?:na|no|em|ao|a|para|pra|um|uma|o) )*(?:${CALENDAR}|(?:novo |nova )?${EVENT_WORD})(?: |$))`,
  TO_CALENDAR,
].join('|')})(?= |$)`);
const ASKED_TO_SCHEDULE = regex(`^(?:${SCHEDULE_VERB}|${ACTIVITY_VERB})$`);
const REQUEST_TAIL = regex(`(?:^| )(?:${[
  'por favor|pfv|pf|obrigado|obrigada|valeu|pra mim|para mim',
  `(?:(?:pode|podes|poderia|favor) )?(?:${SCHEDULE_VERB}|${ACTIVITY_VERB}) (?:ai|(?:isso |isto )?${TO_CALENDAR})`,
  `(?:na|no|em) ${CALENDAR}`,
].join('|')})$`);
// Depois de "criar" ou "adicionar", "evento" é o que se pede; sozinho, "evento da empresa" é o nome.
const AFTER_REQUEST = new Set(['evento', 'nova', 'novo']);
const POSSESSIVES = new Set(['minha', 'meu', 'minhas', 'meus', 'nossa', 'nosso']);
// "Minha reunião" é só a reunião, mas "minha mãe" é outra pessoa.
const RELATIVES = new Set(['mae', 'pai', 'filho', 'filha', 'filhos', 'filhas', 'esposa', 'esposo', 'marido', 'mulher', 'irma', 'irmao', 'avo', 'tia', 'tio', 'namorada', 'namorado', 'noiva', 'noivo', 'amiga', 'amigo', 'chefe', 'sogra', 'sogro', 'neta', 'neto', 'prima', 'primo', 'cunhada', 'cunhado']);
// "Quero agendar" e "cris, pode marcar" são tão pedido quanto "agendar".
const POLITE_OPENING = regex(`^(?:(?:${GREETING}|cris|${COURTESY})(?: |$))+`);
// Estes verbos também valem para gastos ("coloca 50 na poupança"): só pedem agenda quando dizem o que é.
const NAMED_REQUEST = regex(`^(?:${SCHEDULE_VERB}|${ACTIVITY_VERB})(?: .*)? (?:agenda|calendario|evento|compromisso|reuniao)${NWA}`);

// A resposta a "Para quando?" pode vir com palavras em volta, e o que sobra precisa ser um detalhe do evento.
const WHEN_HEAD = /^(?:(?:para|pra|pro|pode ser|vai ser|sera|fica|ficou|e|ok|sim|entao|marca|marcar|marque|agenda|agendar|agende|coloca|coloque)(?: |$))+/;
const WHEN_TAIL = /(?:(?:^| )(?:mesmo|por favor|pfv|pf|obrigado|obrigada|valeu|ok))+$/;
const WHEN_DETAIL = /^(?:no|na|nos|nas|em|com|de|da|do|a|ao|pela|pelo|por|via|online|presencial|remoto)(?: |$)/;
const BARE_HOUR = regex(`^(${HOUR})(?: horas?)?(?: da (manha|tarde|noite))?$`);

const pad = (n) => String(n).padStart(2, '0');
const hourFrom = (raw) => NUMBER_WORDS[raw] ?? Number(raw);

function timeFrom(hourRaw, minuteRaw, period) {
  let hour = hourFrom(hourRaw);
  const minute = Number(minuteRaw ?? 0);
  if (period && period !== 'manha' && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

export function takeTime(work) {
  const range = work.match(RANGE_WITH_DAS) ?? work.match(RANGE_WITH_MARK);
  if (range) {
    const start = timeFrom(range[1], range[2]);
    const end = timeFrom(range[3], range[4]);
    if (start && end && end > start) {
      work.cut(range);
      return { time: start, endTime: end };
    }
  }

  let time = null;
  let m;
  // "às 15h" vem antes de "15h" para o "às" sair junto e não ficar no meio do título.
  if ((m = work.match(TIME_AFTER_AS))) time = timeFrom(m[1], m[2], m[3]);
  else if ((m = work.match(TIME_WITH_MARK))) time = timeFrom(m[1], m[2] ?? m[3], m[4]);
  else if ((m = work.match(TIME_WITH_WORD))) time = timeFrom(m[1], null, m[2]);
  else if ((m = work.match(NOON))) time = '12:00';
  else if ((m = work.match(MIDNIGHT))) time = '00:00';
  if (!time) return null;
  work.cut(m);

  let minutes = DEFAULT_DURATION_MINUTES;
  let duration;
  if ((duration = work.take(DURATION_HOURS))) minutes = Number(duration[1]) * 60;
  else if ((duration = work.take(DURATION_MINUTES))) minutes = Number(duration[1]);
  else if (work.take(DURATION_HALF)) minutes = 30;
  return { time, endTime: addMinutesToTime(time, minutes) };
}

// Datas de compromisso olham para a frente: "dia 5" já passado é o do mês que vem.
export function takeDate(work, today, time, nowTime) {
  const [year, month] = today.split('-').map(Number);
  const nextMonth = () => shiftMonth(today.slice(0, 7), 1).split('-').map(Number);
  let m;

  if (work.take(regex(`${NWB}depois\\s+de\\s+amanha${NWA}`))) return addDays(today, 2);
  if (work.take(regex(`${NWB}amanha${NWA}`))) return addDays(today, 1);
  if (work.take(regex(`${NWB}hoje${NWA}`))) return today;

  if ((m = work.take(regex(`${NWB}(?:(?:no\\s+)?dia\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?(?![\\p{L}\\p{N}/])`)))) {
    const givenYear = m[3] ? Number(m[3].padStart(4, '20')) : year;
    const date = makeDate(givenYear, Number(m[2]), Number(m[1]));
    if (!date) return null;
    return !m[3] && date < today ? makeDate(year + 1, Number(m[2]), Number(m[1])) : date;
  }

  if ((m = work.take(regex(`${NWB}(?:(?:no\\s+)?dia\\s+)?(\\d{1,2})\\s+de\\s+(${MONTH_NAMES.join('|')})(?:\\s+de\\s+(\\d{4}))?${NWA}`)))) {
    const monthNumber = MONTH_NAMES.indexOf(m[2]) + 1;
    const givenYear = m[3] ? Number(m[3]) : year;
    const date = makeDate(givenYear, monthNumber, Number(m[1]));
    if (!date) return null;
    return !m[3] && date < today ? makeDate(year + 1, monthNumber, Number(m[1])) : date;
  }

  if ((m = work.take(regex(`${NWB}(?:no\\s+)?dia\\s+(\\d{1,2})${NWA}`)))) {
    const date = makeDate(year, month, Number(m[1]));
    if (date && date >= today) return date;
    const [nextYear, next] = nextMonth();
    return makeDate(nextYear, next, Number(m[1]));
  }

  if ((m = work.take(WEEKDAY))) {
    let daysAhead = (WEEKDAYS[m[2]] - weekday(today) + 7) % 7;
    const explicitNext = m[1] === 'proxima' || m[1] === 'proximo' || m[3];
    // "quinta" dita numa quinta é hoje, se o horário ainda não passou.
    if (daysAhead === 0 && (explicitNext || !time || time <= nowTime)) daysAhead = 7;
    return addDays(today, daysAhead);
  }
  return null;
}

const bareWord = (token) => fold(token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''));
const titleWords = (work) => work.orig.split(/\s+/).filter(Boolean);
const wordCount = (text) => text.trim().split(' ').length;
const withoutEdgePunctuation = (text) => text.replace(/^[,;:.\-–—!?]+|[,;:.\-–—!?]+$/g, '').trim();

function trimTitle(words) {
  const tokens = [...words];
  const isNoise = (token, noise) => {
    const bare = bareWord(token);
    return !bare || noise.has(bare);
  };
  while (tokens.length && isNoise(tokens[0], LEADING_NOISE)) tokens.shift();
  while (tokens.length && isNoise(tokens.at(-1), TRAILING_NOISE)) tokens.pop();
  return withoutEdgePunctuation(tokens.join(' '));
}

export const cleanTitle = (work) => trimTitle(titleWords(work));

// "Quero agendar minha reunião com José na agenda, por favor" é a "Reunião com José".
function eventTitle(work) {
  const rest = titleWords(work);
  const spoken = () => rest.map(bareWord).join(' ');

  let asked = false;
  while (rest.length) {
    const first = bareWord(rest[0]);
    const head = REQUEST_HEAD.exec(spoken());
    if (head) {
      asked ||= ASKED_TO_SCHEDULE.test(head[0]);
      rest.splice(0, wordCount(head[0]));
      continue;
    }
    // O nome da assessora só é chamado com vírgula: "Cris e Ana no shopping" é o nome do evento.
    const calledOut = first === 'cris' && /[,:!]$/.test(rest[0]);
    const possessive = POSSESSIVES.has(first) && rest.length > 1 && !RELATIVES.has(bareWord(rest[1]));
    if (first && !calledOut && !possessive && !(asked && AFTER_REQUEST.has(first)) && !LEADING_NOISE.has(first)) break;
    rest.shift();
  }

  for (;;) {
    while (rest.length && !bareWord(rest.at(-1))) rest.pop();
    const tail = REQUEST_TAIL.exec(spoken());
    if (!tail) return trimTitle(rest);
    rest.splice(-wordCount(tail[0]));
  }
}

// A resposta a "Para quando?": o dia, o horário ou os dois, talvez com um detalhe, como "amanhã às 10 no escritório".
// Qualquer outra coisa em volta é outro assunto, como "dentista quinta às 15h", e o retorno é null.
export function parseWhen(text, today, nowTime = '00:00') {
  const clean = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const work = new Working(clean);
  const marked = takeTime(work);
  let timeInfo = marked;
  let date = takeDate(work, today, marked?.time ?? null, nowTime);

  let rest = titleWords(work).filter((word) => bareWord(word));
  const spoken = () => rest.map(bareWord).join(' ');
  const head = WHEN_HEAD.exec(spoken());
  if (head) rest.splice(0, wordCount(head[0]));
  const tail = WHEN_TAIL.exec(spoken());
  if (tail) rest.splice(-wordCount(tail[0]));
  while (rest.length && TRAILING_NOISE.has(bareWord(rest.at(-1)))) rest.pop();

  // Depois de "Para quando?", um número sozinho é a hora: "amanhã 10", "três da tarde".
  if (!marked) {
    const bare = BARE_HOUR.exec(spoken());
    const time = bare && timeFrom(bare[1], null, bare[2]);
    if (time) {
      timeInfo = { time, endTime: addMinutesToTime(time, DEFAULT_DURATION_MINUTES) };
      date = takeDate(new Working(clean), today, time, nowTime);
      rest = [];
    }
  }
  if (!timeInfo && !date) return null;
  // Um número sem horário marcado é valor: "no mercado 50 amanhã" é gasto, e "às 10 na sala 3" é a sala.
  if (rest.length && (!WHEN_DETAIL.test(spoken()) || (!marked && /\d/.test(spoken())))) return null;

  return {
    // Só o horário: hoje, se ainda não passou; senão, amanhã.
    date: date ?? (timeInfo.time > nowTime ? today : addDays(today, 1)),
    time: timeInfo?.time ?? null,
    endTime: timeInfo?.endTime ?? null,
    detail: withoutEdgePunctuation(rest.join(' ')),
    marked: Boolean(marked),
  };
}

function parseList(simple, today) {
  const head = LIST_HEAD.exec(simple);
  if (!head) return null;
  const work = new Working(simple.slice(head[0].length));

  let range = null;
  if (work.take(WEEK)) {
    const sinceMonday = (weekday(today) + 6) % 7;
    range = { from: today, to: addDays(today, 7 - sinceMonday), label: 'Esta semana' };
  } else {
    const before = work.norm;
    // Numa consulta, "quinta" dita numa quinta é hoje mesmo.
    const date = takeDate(work, today, '23:59', '00:00');
    if (date) {
      const label = date === today ? 'Hoje' : date === addDays(today, 1) ? 'Amanhã' : null;
      range = { from: date, to: addDays(date, 1), label };
    } else if (before !== work.norm) {
      return null;
    }
  }

  const leftover = work.norm.split(/\s+/).filter((token) => token && !LIST_FILLER.has(token));
  // "agenda dentista quinta" é um pedido para marcar, não para listar.
  if (leftover.length) return null;
  return { type: 'agenda_list', range };
}

export function parseAgenda(text, today, nowTime = '00:00') {
  const clean = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const simple = fold(clean).replace(/[?!.,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!simple) return null;

  if (CONNECT.test(simple) || simple === 'google agenda') return { type: 'agenda_connect' };
  if (BRIEF.test(simple)) return { type: 'agenda_brief' };

  const list = parseList(simple, today);
  if (list) return list;

  const request = simple.replace(POLITE_OPENING, '');

  const move = MOVE.exec(request);
  if (move) {
    const work = new Working(move[2]);
    const timeInfo = takeTime(work);
    const date = takeDate(work, today, timeInfo?.time ?? null, nowTime);
    if (timeInfo || date) return { type: 'agenda_move', query: move[1].trim(), date, time: timeInfo?.time ?? null, endTime: timeInfo?.endTime ?? null };
  }

  const cancel = CANCEL.exec(request);
  if (cancel) return { type: 'agenda_cancel', query: cancel[1].trim() };

  if (FINANCE_START.test(simple) || MONEY_MARK.test(simple)) return null;

  const hasVerb = CREATE_VERB.test(request) || NAMED_REQUEST.test(request);
  const work = new Working(clean);
  const timeInfo = takeTime(work);
  const date = takeDate(work, today, timeInfo?.time ?? null, nowTime);
  // Sobrou número sem pedido de marcar: é gasto, como "dentista quinta 200".
  if (!hasVerb && /\d/.test(work.norm)) return null;
  if (!hasVerb && !timeInfo && !date) return null;

  const title = capitalize(eventTitle(work)).slice(0, MAX_TITLE);
  if (!title && !hasVerb) return null;
  if (!timeInfo && !date) return { type: 'agenda_need_when', title };

  return {
    type: 'agenda_create',
    title: title || NO_TITLE,
    // Só o horário: hoje, se ainda não passou; senão, amanhã.
    date: date ?? (timeInfo.time > nowTime ? today : addDays(today, 1)),
    time: timeInfo?.time ?? null,
    endTime: timeInfo?.endTime ?? null,
  };
}

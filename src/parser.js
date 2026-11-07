import { addDays, makeDate, MONTHS, monthOf, shiftMonth, weekday } from './dates.js';
import { capitalize, fold, MAX_CENTS, parseMoney } from './text.js';

const MAX_INSTALLMENTS = 60;
const MAX_DESCRIPTION = 120;
const MAX_ODOMETER_KM = 9_999_999;
export const NO_DESCRIPTION = 'Sem descrição';

const NOT_WORD_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NOT_WORD_AFTER = String.raw`(?![\p{L}\p{N}])`;
const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const LB = String.raw`(?<![\p{L}\p{N}.,/])`;
const RB = String.raw`(?![\p{L}\p{N}/])`;
const UNIT = String.raw`(?:\s*(mil|k)${NOT_WORD_AFTER})?`;
const CURRENCY_WORD = String.raw`(?:reais|real|contos?|pilas?)${NOT_WORD_AFTER}`;
const AMOUNT = String.raw`(?:r\$\s*)?(${NUM})${UNIT}(?:\s*${CURRENCY_WORD})?`;

const regex = (source) => new RegExp(source, 'u');

const HELP = /^(ajuda|help|menu|comandos|oi|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|como funciona)?$/;
const THANKS = /^(obrigad[oa]|obg|valeu|vlw|brigad[oa]|ok|beleza|show|top|blz)$/;
const LOGIN = /^(entrar|login|logar|acessar|acesso|painel|site|codigo|meu codigo|quero entrar|senha|esqueci a senha|esqueci minha senha)$/;
const WHATSAPP_LINK = /^conectar (?:codigo )?([a-z0-9]{4}-?[a-z0-9]{4})$/;
const WHATSAPP_UNLINK = /^desconectar (?:o |meu )?(?:whatsapp|numero)$/;
const SUBSCRIBE = /^(assinar|assinatura|minha assinatura|meu plano|plano|cancelar assinatura|cancelar minha assinatura)$/;
const DELETE_ACCOUNT = /^(apagar|excluir|deletar|cancelar|encerrar) (a )?(minha conta|meus dados|os meus dados|conta)$/;
const CONFIRM_DELETE = /^(confirmar|confirmo) (a )?exclusao$/;
const UNDO = /^(desfazer|desfaz|desfaca|apagar|apaga|apague|cancelar|cancela|cancele|excluir|exclui|remover|remove|deletar|errei)(\s+(o|a|ultimo|ultima|lancamento|gasto|isso))*$/;
const CATEGORIES = /^(categorias|lista de categorias|quais (as |sao as )?categorias)$/;
const RECENT = /^(ultimos|ultimas|ultimos gastos|ultimos lancamentos|lancamentos|extrato|lista|listar)$/;
const INCOME = /^(recebi|recebemos|recebido|ganhei|ganhamos|entrou|caiu|salario|renda)\b/;
const INCOME_VERB = regex(`^(?:recebi|recebemos|recebido|ganhei|ganhamos|entrou|caiu)${String.raw`(?![\p{L}\p{N}])`}\\s*`);
const INCOME_QUERY = /^(?:(?:minhas\s+)?entradas|quanto\s+(?:eu\s+)?(?:ja\s+)?(?:recebi|ganhei|entrou))(?=\s|$)/;
const NO_INCOME_DESCRIPTION = 'Entrada';
const RECATEGORIZE = [
  /^categoria\s+(?:para\s+|pra\s+|e\s+)?([^\d]+)$/,
  /^(?:muda|mudar|troca|trocar|corrige|corrigir|altera|alterar|coloca|coloque)\s+(?:(?:a\s+)?categoria\s+)?(?:para|pra|em)\s+([^\d]+)$/,
  /^(?:na verdade\s+)?era\s+(?:de\s+|em\s+)?([^\d]+)$/,
];

const SUMMARY_HEAD = /^(?:resumo|relatorio|balanco|total|meus gastos|gastos|quanto\s+(?:eu\s+)?(?:ja\s+)?(?:gastei|gastamos|foi|deu)|qual\s+(?:o|e\s+o)\s+total)\b/;
const MONTH_NAMES = MONTHS.map(fold).join('|');
const MONTH_WORD = regex(`${NOT_WORD_BEFORE}(?:(?:de|em|no|do)\\s+)?(?:mes\\s+de\\s+)?(${MONTH_NAMES})(?:\\s+(?:de\\s+)?(\\d{4}))?${NOT_WORD_AFTER}`);
const MONTH_NUMERIC = regex(`${NOT_WORD_BEFORE}(?:(?:de|em|no|do)\\s+)?(\\d{1,2})/(\\d{4})${NOT_WORD_AFTER}`);
const LAST_MONTH = regex(`${NOT_WORD_BEFORE}(?:(?:no|do)\\s+)?(?:mes passado|mes anterior|ultimo mes)${NOT_WORD_AFTER}`);
const THIS_MONTH = regex(`${NOT_WORD_BEFORE}(?:(?:este|esse|neste|nesse|deste|desse|no|do)\\s+)?mes(?:\\s+atual)?${NOT_WORD_AFTER}`);
const TODAY_WORD = regex(`${NOT_WORD_BEFORE}hoje${NOT_WORD_AFTER}`);
const YESTERDAY_WORD = regex(`${NOT_WORD_BEFORE}ontem${NOT_WORD_AFTER}`);
const WEEK_WORD = regex(`${NOT_WORD_BEFORE}(?:(?:esta|essa|nesta|nessa|na|da|desta|dessa)\\s+)?semana${NOT_WORD_AFTER}`);
const SUMMARY_FILLER = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'em', 'no', 'na', 'nos', 'nas', 'o', 'a', 'os', 'as', 'meu', 'minha', 'ate', 'agora', 'ja', 'por', 'categoria']);

const WEEKDAYS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const WEEKDAY = regex(
  `${NOT_WORD_BEFORE}(?:(na ultima|no ultimo|na|no|ultima|ultimo)\\s+)?(${Object.keys(WEEKDAYS).join('|')})(-feira|\\s+feira)?(\\s+passad[ao])?${NOT_WORD_AFTER}`,
);

const PAYMENT = regex(
  `${NOT_WORD_BEFORE}(?:no|na|pelo|pela|via|com|em|de)\\s+(?:cartao(?:\\s+de\\s+(?:credito|debito))?|credito|debito|pix|dinheiro|boleto)${NOT_WORD_AFTER}`,
);

const CONNECTORS = ['de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'num', 'numa', 'com', 'pra', 'pro', 'para', 'por', 'o', 'a', 'os', 'as', 'um', 'uma', 'e', 'reais', 'real', 'parcelado', 'parcelada', 'foi', 'deu', 'custou', 'saiu', 'ficou'];
const LEADING_NOISE = new Set([...CONNECTORS, 'eu', 'ja', 'acabei', 'gastei', 'gastamos', 'gasto', 'paguei', 'pagamos', 'pagar', 'pago', 'comprei', 'compramos', 'comprar', 'parcelei', 'anota', 'anotar', 'anote', 'lanca', 'lancar', 'lance', 'registra', 'registrar', 'registre', 'coloca', 'colocar', 'coloque', 'adiciona', 'adicionar', 'adicione', 'mais', 'uns', 'umas']);
const TRAILING_NOISE = new Set(CONNECTORS);

// Texto original e versão simplificada andam juntos: a busca é feita na simplificada
// ("almoco") e o que sobra mantém os acentos que a pessoa digitou ("Almoço").
export class Working {
  constructor(text) {
    this.orig = text;
    this.norm = fold(text);
  }

  match(re) {
    return re.exec(this.norm);
  }

  cut(match) {
    const start = match.index;
    const end = start + match[0].length;
    this.orig = `${this.orig.slice(0, start)} ${this.orig.slice(end)}`;
    this.norm = `${this.norm.slice(0, start)} ${this.norm.slice(end)}`;
  }

  take(re) {
    const match = this.match(re);
    if (match) this.cut(match);
    return match;
  }

  clone() {
    const copy = new Working('');
    copy.orig = this.orig;
    copy.norm = this.norm;
    return copy;
  }
}

function toCents(number, unit) {
  const cents = parseMoney(number);
  if (cents === null) return null;
  return unit ? cents * 1000 : cents;
}

export function takeDate(work, today) {
  const [year, month] = today.split('-').map(Number);

  let m = work.take(regex(`${LB}(?:(?:no\\s+)?dia\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${RB}`));
  if (m) {
    const givenYear = m[3] ? Number(m[3].padStart(4, '20')) : year;
    const date = makeDate(givenYear, Number(m[2]), Number(m[1]));
    if (!date) return null;
    // Sem ano, uma data no futuro só pode ser do ano passado: aqui se anota o que já foi gasto.
    return !m[3] && date > today ? makeDate(year - 1, Number(m[2]), Number(m[1])) : date;
  }

  m = work.take(regex(`${NOT_WORD_BEFORE}(?:no\\s+)?dia\\s+(\\d{1,2})${RB}`));
  if (m) {
    const date = makeDate(year, month, Number(m[1]));
    if (date && date <= today) return date;
    const [prevYear, prevMonth] = shiftMonth(monthOf(today), -1).split('-').map(Number);
    return makeDate(prevYear, prevMonth, Number(m[1]));
  }

  if (work.take(regex(`${NOT_WORD_BEFORE}(?:antes de ontem|anteontem)${NOT_WORD_AFTER}`))) return addDays(today, -2);
  if (work.take(YESTERDAY_WORD)) return addDays(today, -1);
  if (work.take(TODAY_WORD)) return today;

  m = work.match(WEEKDAY);
  // "segunda" sozinha pode ser "segunda via": só vale como dia com "na", "-feira" ou "passada".
  if (m && (m[1] || m[3] || m[4] || m[2] === 'sabado' || m[2] === 'domingo')) {
    work.cut(m);
    let daysAgo = (weekday(today) - WEEKDAYS[m[2]] + 7) % 7;
    if (daysAgo === 0 && (m[4] || /ultim/.test(m[1] ?? ''))) daysAgo = 7;
    return addDays(today, -daysAgo);
  }
  return null;
}

function takeInstallments(work) {
  const count = (raw) => {
    const n = Number(raw);
    return n >= 2 && n <= MAX_INSTALLMENTS ? n : null;
  };

  // Valor de cada parcela: "12x de 100", "3x 50,00", "10 parcelas de 80".
  for (const source of [
    `${LB}(\\d{1,3})\\s*x\\s*(?:de\\s+)?${AMOUNT}${RB}`,
    `${LB}(\\d{1,3})\\s+parcelas\\s+de\\s+${AMOUNT}${RB}`,
  ]) {
    const m = work.match(regex(source));
    if (m && count(m[1])) {
      const each = toCents(m[2], m[3]);
      if (!each) return null;
      work.cut(m);
      return { count: count(m[1]), amountCents: each * count(m[1]) };
    }
  }

  // Valor total: "1200 em 10x", "300 3x", "1200 parcelado em 10 vezes".
  const total = work.match(
    regex(`${LB}${AMOUNT}\\s+(?:parcelad[oa]\\s+)?(?:em\\s+)?(\\d{1,3})\\s*(?:x|vezes|parcelas)${NOT_WORD_AFTER}`),
  );
  if (total && count(total[3])) {
    const amountCents = toCents(total[1], total[2]);
    if (!amountCents) return null;
    work.cut(total);
    return { count: count(total[3]), amountCents };
  }

  // Número de parcelas separado do valor: "1200 na tv em 10x".
  const apart = work.match(
    regex(`${NOT_WORD_BEFORE}(?:parcelei\\s+|parcelad[oa]\\s+)?em\\s+(\\d{1,3})\\s*(?:x|vezes|parcelas)${NOT_WORD_AFTER}`),
  );
  if (apart && count(apart[1])) {
    work.cut(apart);
    return { count: count(apart[1]) };
  }
  return null;
}

function takeAmount(work) {
  const explicit = [
    regex(`${LB}r\\$\\s*(${NUM})${UNIT}${RB}`),
    regex(`${LB}(${NUM})${UNIT}\\s*${CURRENCY_WORD}`),
    regex(`${LB}(${NUM})\\s*(mil|k)${RB}`),
    regex(`(?:^|\\s)(?:gastei|gastamos|paguei|pagamos|pago|custou|deu|saiu|foi|ficou)\\s+(?:uns\\s+|umas\\s+|quase\\s+|mais\\s+de\\s+)?(${NUM})${RB}`),
  ];
  for (const re of explicit) {
    const m = work.take(re);
    if (m) return toCents(m[1], m[2]);
  }

  const numbers = [...work.norm.matchAll(new RegExp(`${LB}(${NUM})${RB}`, 'gu'))];
  if (!numbers.length) return null;
  const withCents = numbers.filter((m) => /[.,]\d{1,2}$/.test(m[1]));
  // Com mais de um número, "99" costuma ser o app de corrida: "99 18" são 18 reais.
  const notApp = numbers.filter((m) => m[1] !== '99');
  const pool = withCents.length ? withCents : notApp.length ? notApp : numbers;
  const best = pool.reduce((a, b) => (parseMoney(a[1]) >= parseMoney(b[1]) ? a : b));
  work.cut(best);
  return toCents(best[1]);
}

const stripEdges = (token) => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '');

function cleanDescription(work) {
  const tokens = work.orig.split(/\s+/).filter(Boolean);
  const isNoise = (token, noise) => {
    const bare = fold(stripEdges(token));
    return !bare || noise.has(bare);
  };
  while (tokens.length && isNoise(tokens[0], LEADING_NOISE)) tokens.shift();
  while (tokens.length && isNoise(tokens.at(-1), TRAILING_NOISE)) tokens.pop();
  return tokens.join(' ').replace(/^[,;:.\-–—!?]+|[,;:.\-–—!?]+$/g, '').trim();
}

function describe(work) {
  const withoutPayment = work.clone();
  withoutPayment.take(PAYMENT);
  // "mercado 200 no cartão" é mercado; "paguei 500 no cartão" só tem o cartão para descrever.
  const description = cleanDescription(withoutPayment) || cleanDescription(work);
  return capitalize(description).slice(0, MAX_DESCRIPTION) || NO_DESCRIPTION;
}

// Sai antes do valor: "85000 km" é distância, não dinheiro.
function takeDistance(work) {
  const found = work.take(regex(`${NOT_WORD_BEFORE}(?:(?:com|aos|a|em|no|na)\\s+)?(\\d{1,3}(?:\\.\\d{3})+|\\d+)(\\s*mil)?\\s*(?:kms?|quilometros)${NOT_WORD_AFTER}`));
  if (!found) return null;
  const kilometers = Number(found[1].replace(/\./g, '')) * (found[2] ? 1000 : 1);
  return kilometers <= MAX_ODOMETER_KM ? kilometers : null;
}

export function parseExpense(text, today) {
  const work = new Working(text);
  takeDistance(work);
  const date = takeDate(work, today) ?? today;
  const installments = takeInstallments(work);
  const amountCents = installments?.amountCents ?? takeAmount(work);
  if (!amountCents || amountCents > MAX_CENTS) return null;
  return {
    type: 'expense',
    amountCents,
    description: describe(work),
    date,
    installments: installments?.count ?? 1,
  };
}

// Na manutenção, valor e data podem faltar: quem cuida disso pergunta o que não veio.
export function parseServiceText(text, today) {
  const work = new Working(String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim());
  const odometerKm = takeDistance(work);
  const date = takeDate(work, today);
  const installments = takeInstallments(work);
  const amountCents = installments?.amountCents ?? takeAmount(work);
  const isValidAmount = amountCents && amountCents <= MAX_CENTS;
  return {
    description: describe(work),
    date,
    amountCents: isValidAmount ? amountCents : 0,
    installments: isValidAmount ? installments?.count ?? 1 : 1,
    odometerKm,
  };
}

// Tira do começo e do fim as palavras de ligação: "na oficina do zé" vira "oficina do zé".
export function cleanAnswer(text) {
  return capitalize(cleanDescription(new Working(String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()))).slice(0, MAX_DESCRIPTION);
}

// "03/2024" ou "março de 2024": quem não lembra o dia ainda ajuda com o mês. Fica como o dia 1º.
export function parseApproxMonth(text, today) {
  const work = new Working(fold(String(text ?? '')));
  // "31/02/2025" é uma data que não existe, não fevereiro de 2025.
  if (/\d{1,2}\/\d{1,2}\/\d/.test(work.norm)) return null;
  const numeric = work.match(MONTH_NUMERIC);
  if (numeric && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 12) return `${numeric[2]}-${numeric[1].padStart(2, '0')}-01`;
  const named = work.match(MONTH_WORD);
  if (!named) return null;
  const number = String(MONTHS.map(fold).indexOf(named[1]) + 1).padStart(2, '0');
  const year = named[2] ?? today.slice(0, 4);
  const month = `${year}-${number}`;
  // Sem ano, um mês que ainda não chegou é do ano passado.
  return `${!named[2] && month > monthOf(today) ? Number(year) - 1 : year}-${number}-01`;
}

function takePeriod(work, today) {
  const currentMonth = monthOf(today);
  let m = work.take(LAST_MONTH);
  if (m) return { kind: 'month', month: shiftMonth(currentMonth, -1) };

  m = work.take(MONTH_NUMERIC);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
    return { kind: 'month', month: `${m[2]}-${m[1].padStart(2, '0')}` };
  }

  m = work.take(MONTH_WORD);
  if (m) {
    const number = String(MONTHS.map(fold).indexOf(m[1]) + 1).padStart(2, '0');
    const year = m[2] ?? today.slice(0, 4);
    const month = `${year}-${number}`;
    // Sem ano, um mês que ainda não chegou é do ano passado.
    return { kind: 'month', month: !m[2] && month > currentMonth ? `${Number(year) - 1}-${number}` : month };
  }

  if (work.take(YESTERDAY_WORD)) {
    const day = addDays(today, -1);
    return { kind: 'range', from: day, to: today, label: 'Ontem' };
  }
  if (work.take(TODAY_WORD)) return { kind: 'range', from: today, to: addDays(today, 1), label: 'Hoje' };
  if (work.take(WEEK_WORD)) {
    const sinceMonday = (weekday(today) + 6) % 7;
    return { kind: 'range', from: addDays(today, -sinceMonday), to: addDays(today, 1), label: 'Esta semana' };
  }
  work.take(THIS_MONTH);
  return { kind: 'month', month: currentMonth };
}

function parseIncome(clean, today) {
  const work = new Working(clean);
  work.take(INCOME_VERB);
  const parsed = parseExpense(work.orig.trim(), today);
  if (!parsed) return { type: 'income', amountCents: null };
  return {
    type: 'income',
    amountCents: parsed.amountCents,
    description: parsed.description === NO_DESCRIPTION ? NO_INCOME_DESCRIPTION : parsed.description,
    date: parsed.date,
  };
}

// "mercado 50 no nubank": separa a conta citada, para ela não ficar na descrição.
export function extractAccount(text, accounts) {
  const byLongestName = [...accounts].sort((a, b) => b.name.length - a.name.length);
  for (const account of byLongestName) {
    const name = fold(account.name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const work = new Working(String(text ?? ''));
    const found = work.take(regex(
      `${NOT_WORD_BEFORE}(?:(?:no|na|pelo|pela|via|do|da|em|com|pro|para)\\s+)?(?:(?:cartao|conta)\\s+(?:(?:do|da|de)\\s+)?)?${name}${NOT_WORD_AFTER}`,
    ));
    if (found) return { account, text: work.orig.replace(/\s+/g, ' ').trim() };
  }
  return null;
}

function parseSummary(simple, today) {
  const head = SUMMARY_HEAD.exec(simple);
  const standalone = !head && regex(`^(?:(?:no|do|de|em)\\s+)?(?:mes passado|mes anterior|ultimo mes|mes|este mes|esse mes|(?:${MONTH_NAMES})(?:\\s+(?:de\\s+)?\\d{4})?)$`).test(simple);
  if (!head && !standalone) return null;

  const work = new Working(head ? simple.slice(head[0].length) : simple);
  const period = takePeriod(work, today);
  const query = work.norm
    .split(/\s+/)
    .filter((token) => token && !SUMMARY_FILLER.has(token))
    .join(' ');
  // "total 50" tem valor, então é um gasto e não uma consulta. "99" é o app de corrida.
  if (query.split(' ').some((token) => /\d/.test(token) && token !== '99')) return null;
  return { type: 'summary', period, query };
}

export function parseMessage(text, today) {
  const clean = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const simple = fold(clean).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (HELP.test(simple)) return { type: 'help' };
  if (THANKS.test(simple)) return { type: 'thanks' };
  if (LOGIN.test(simple)) return { type: 'login' };
  const link = WHATSAPP_LINK.exec(simple);
  if (link) return { type: 'whatsapp_link', code: link[1] };
  if (WHATSAPP_UNLINK.test(simple)) return { type: 'whatsapp_unlink' };
  if (SUBSCRIBE.test(simple)) return { type: 'subscribe' };
  if (DELETE_ACCOUNT.test(simple)) return { type: 'delete_account' };
  if (CONFIRM_DELETE.test(simple)) return { type: 'confirm_delete' };
  if (UNDO.test(simple)) return { type: 'undo' };
  if (CATEGORIES.test(simple)) return { type: 'categories' };
  if (RECENT.test(simple)) return { type: 'recent' };

  for (const re of RECATEGORIZE) {
    const m = re.exec(simple);
    if (m) return { type: 'recategorize', target: m[1].trim() };
  }

  const incomeQuery = INCOME_QUERY.exec(simple);
  if (incomeQuery) {
    const period = takePeriod(new Working(simple.slice(incomeQuery[0].length)), today);
    return { type: 'income_summary', period };
  }

  const summary = parseSummary(simple, today);
  if (summary) return summary;
  if (INCOME.test(simple)) return parseIncome(clean, today);

  return parseExpense(clean, today) ?? { type: 'unknown' };
}

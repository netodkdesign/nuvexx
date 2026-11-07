import { MONTHS } from './dates.js';
import { fold } from './text.js';

// O que se fala e não se escreve: a transcrição pode trazer "cinquenta reais" ou "às três e meia".
// Só vale para áudio. Em texto digitado, "dois irmãos" e "uma reunião" são palavras e ficam como estão.

const NUMBER_WORDS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};
const THOUSAND = 'mil';
const MONEY_WORDS = new Set(['reais', 'real', 'centavo', 'centavos', 'conto', 'contos', 'pila', 'pilas']);
const INSTALLMENT_WORDS = new Set(['vezes', 'parcelas']);
const MONTH_WORDS = new Set(MONTHS.map(fold));
// "Paguei cinquenta" é valor, e "paguei dois boletos" não é: depois do número só pode vir um conector ou nada.
const SPENT_WORDS = new Set(['gastei', 'gastamos', 'gasto', 'paguei', 'pagamos', 'pago', 'custou', 'deu', 'saiu', 'foi', 'foram', 'ficou', 'recebi', 'recebemos', 'ganhei']);
const AFTER_AMOUNT = new Set(['de', 'do', 'da', 'no', 'na', 'em', 'com', 'pra', 'pro', 'para', 'pelo', 'pela']);
// "Às três", "dia quinze" e "com dois" não são dinheiro.
const NOT_BEFORE_AMOUNT = new Set(['as', 'a', 'pras', 'dia', 'com', 'para', 'pra', 'de', 'do', 'da', 'e', 'um', 'uma', 'o', 'os']);
// "Dois de novembro" é uma data, e "três de manhã" é um horário.
const NOT_AFTER_CONNECTOR = new Set([...MONTH_WORDS, 'manha', 'tarde', 'noite', 'madrugada']);

const bare = (token) => fold(token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''));
const isNumberWord = (word) => word in NUMBER_WORDS || word === THOUSAND;
const magnitude = (value) => {
  if (value >= 100) return 100;
  if (value >= 20) return 10;
  // De 10 a 19 não vem unidade depois: "quinze e três" não é dezoito.
  return value >= 10 ? 1 : 0;
};

// Lê "dois mil quinhentos e trinta". Para onde a ordem quebra: em "vinte e três e cinquenta", o resto são os centavos.
function readNumber(words) {
  let total = 0;
  let current = 0;
  let room = Infinity;
  let used = 0;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word === 'e') continue;
    if (word === THOUSAND) {
      total += (current || 1) * 1000;
      current = 0;
      room = 1000;
    } else {
      const value = NUMBER_WORDS[word];
      if (value >= room) break;
      current += value;
      room = magnitude(value);
    }
    used = index + 1;
  }
  return { value: total + current, used };
}

function readAmount(words) {
  const { value, used } = readNumber(words);
  const rest = words.slice(used);
  if (rest[0] !== 'e' || rest.length < 2) return value === 0 ? null : { text: String(value), used };
  const cents = readNumber(rest.slice(1));
  if (cents.used !== rest.length - 1 || cents.value >= 100) return { text: String(value), used };
  return { text: `${value},${String(cents.value).padStart(2, '0')}`, used: words.length };
}

// A sequência de números que começa aqui, com os "e" do meio: "cento e vinte".
function numberRun(words, start) {
  let end = start;
  while (end < words.length) {
    if (isNumberWord(words[end])) end += 1;
    else if (words[end] === 'e' && isNumberWord(words[end + 1] ?? '')) end += 2;
    else break;
  }
  return words.slice(start, end);
}

// "Dia vinte" e "dois de dezembro".
function isDayOfMonth(run, before, after, afterNext) {
  if (before !== 'dia' && !(after === 'de' && MONTH_WORDS.has(afterNext))) return false;
  const { value, used } = readNumber(run);
  return used === run.length && value >= 1 && value <= 31;
}

function isAmount(run, before, after, afterNext, rawBefore) {
  if (MONEY_WORDS.has(after) || /^r\$$/i.test(rawBefore)) return true;
  if (INSTALLMENT_WORDS.has(after)) return before === 'em';
  // "Um" e "uma" sozinhos, sem "real" depois, são quase sempre artigos.
  if (run.length === 1 && NUMBER_WORDS[run[0]] === 1) return false;
  if (SPENT_WORDS.has(before)) return !after || AFTER_AMOUNT.has(after);
  if (!after) return !before || !NOT_BEFORE_AMOUNT.has(before);
  // "Cinquenta de gasolina", no começo da frase.
  return !before && AFTER_AMOUNT.has(after) && !NOT_AFTER_CONNECTOR.has(afterNext);
}

function spokenAmounts(text) {
  const tokens = text.split(' ');
  const words = tokens.map(bare);
  const output = [];
  let index = 0;
  while (index < tokens.length) {
    const before = words[index - 1] ?? '';
    // "Dia primeiro" e "primeiro de dezembro".
    if (words[index] === 'primeiro' && (before === 'dia' || (words[index + 1] === 'de' && MONTH_WORDS.has(words[index + 2])))) {
      output.push('1');
      index += 1;
      continue;
    }
    // Em "5 mil reais", o "mil" já tem o número dele.
    const afterDigits = words[index] === THOUSAND && /^\d/.test(tokens[index - 1] ?? '');
    const run = isNumberWord(words[index]) && !afterDigits ? numberRun(words, index) : [];
    const after = words[index + run.length] ?? '';
    const afterNext = words[index + run.length + 1] ?? '';
    const amount = run.length && (isDayOfMonth(run, before, after, afterNext) || isAmount(run, before, after, afterNext, tokens[index - 1] ?? ''))
      ? readAmount(run)
      : null;
    if (!amount) {
      output.push(tokens[index]);
      index += 1;
      continue;
    }
    // A pontuação da última palavra fica: "cinquenta," continua "50,".
    const last = tokens[index + amount.used - 1];
    output.push(`${amount.text}${last.match(/[\p{P}\p{S}]+$/u)?.[0] ?? ''}`);
    index += amount.used;
  }
  return output.join(' ');
}

// "50 reais e 30 centavos" e "cinquenta reais e trinta centavos", depois de lidos.
const withCents = (text) => text.replace(
  /(?<![\p{L}\p{N}])(\d+(?:\.\d{3})*)\s*(reais|real)\s+e\s+(\d{1,2})\s*centavos?(?![\p{L}\p{N}])/giu,
  (_, whole, currency, cents) => `${whole},${cents.padStart(2, '0')} ${currency}`,
);

// "50 centavos" sozinhos não são 50 reais.
const onlyCents = (text) => text.replace(
  /(?<![\p{L}\p{N},.])(\d{1,2})\s*centavos?(?![\p{L}\p{N}])/giu,
  (_, cents) => `0,${cents.padStart(2, '0')} reais`,
);

// "2 mil e 500 reais".
const withThousands = (text) => text.replace(
  /(?<![\p{L}\p{N}.,])(\d{1,3})\s*mil\s+(?:e\s+)?(\d{1,3})(?=\s*(?:reais|real|contos?|pilas?)?(?![\p{L}\p{N}]))/giu,
  (_, thousands, rest) => `${Number(thousands) * 1000 + Number(rest)}`,
);

const HOUR_WORD = Object.keys(NUMBER_WORDS).filter((word) => NUMBER_WORDS[word] <= 23).sort((a, b) => b.length - a.length).join('|');
const MINUTE_WORD = String.raw`(?:(?:vinte|trinta|quarenta|cinquenta)(?:\s+e\s+(?:um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove))?|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|cinco)`;
const HOUR_WORDS_WITH_ACCENT = HOUR_WORD.replace('tres', 'tres|três');
const CLOCK = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(às|as|pras)\s+(\d{1,2}|${HOUR_WORDS_WITH_ACCENT})\s+e\s+(meia|\d{1,2}|${MINUTE_WORD})(?=\s+da\s+(?:manh[ãa]|tarde|noite)|\s+horas?|[\s,.;!?]*$|\s+(?:de|na|no|em|com|para|pra)\s)`,
  'giu',
);

// "À uma" é a única hora dita sem o "as" do plural.
const ONE_OCLOCK = /(?<![\p{L}\p{N}])[àa]\s+uma(?=\s+(?:e\s+|da\s+(?:manh[ãa]|tarde|noite)|hora))/giu;

// "Às três e meia" e "às 10 e 15" viram 3:30 e 10:15. Os minutos precisam vir no fim do horário.
function spokenClock(text) {
  return text.replace(ONE_OCLOCK, 'às uma').replace(CLOCK, (whole, lead, hourRaw, minuteRaw) => {
    const hour = /^\d/.test(hourRaw) ? Number(hourRaw) : NUMBER_WORDS[fold(hourRaw)];
    const minuteText = fold(minuteRaw);
    const minutes = minuteText === 'meia' ? 30 : /^\d/.test(minuteText) ? Number(minuteText) : readNumber(minuteText.split(/\s+/)).value;
    if (hour > 23 || minutes > 59) return whole;
    return `${lead} ${hour}:${String(minutes).padStart(2, '0')}`;
  });
}

export function fromSpeech(text) {
  const clean = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/u, '');
  return withThousands(onlyCents(withCents(spokenAmounts(spokenClock(clean)))));
}

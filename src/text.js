export const MAX_CENTS = 999_999_999;

// Tira acentos e deixa em minúsculas sem mudar o tamanho do texto: as posições encontradas
// na versão simplificada valem também para o texto original.
export function fold(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const folded = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

export const normalizeKeyword = (text) => fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const normalizeEmail = (text) => String(text ?? '').trim().toLowerCase();
export const isValidEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function capitalize(text) {
  return text ? text[0].toLocaleUpperCase('pt-BR') + text.slice(1) : text;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (cents) => BRL.format(cents / 100).replace(/ /g, ' ');

// "1.234,56", "1234.56", "50,9", "1.234" e "R$ 50" viram centavos. Retorna null se não for valor.
export function parseMoney(raw) {
  const text = String(raw ?? '').trim().replace(/^r\$\s*/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const lastSep = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'));
  let whole = text;
  let fraction = '';
  if (lastSep !== -1) {
    const tail = text.slice(lastSep + 1);
    const sepCount = text.split(text[lastSep]).length - 1;
    // Um separador com até 2 dígitos depois é centavo; com 3 dígitos é milhar.
    if (tail.length <= 2 && sepCount === 1) {
      whole = text.slice(0, lastSep);
      fraction = tail;
    }
  }
  const cents = Number(whole.replace(/[.,]/g, '')) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

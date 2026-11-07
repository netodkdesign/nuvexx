import {
  createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

export const SESSION_COOKIE = 'nuvexx_sessao';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const LINK_CODE_MINUTES = 15;

const scrypt = promisify(scryptCallback);
// Custo indicado pela OWASP para usar 32 MiB de memória por senha.
const SCRYPT_COST = { N: 2 ** 15, r: 8, p: 3 };
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const LIMITER_MAX_KEYS = 10_000;
// Sem letras e números que se confundem, como 0 e O.
const LINK_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LINK_CODE_LENGTH = 8;

const sha256 = (value) => createHash('sha256').update(String(value)).digest();
const hmac = (key, value) => createHmac('sha256', key).update(value).digest('hex');

export const safeEqual = (a, b) => timingSafeEqual(sha256(a), sha256(b));

// Senha: guardada só como hash, com sal próprio. Os parâmetros ficam junto para o custo poder subir no futuro.
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_BYTES, { ...SCRYPT_COST, maxmem: SCRYPT_MAX_MEMORY });
  const { N, r, p } = SCRYPT_COST;
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [, N, r, p, salt, key] = stored.split('$');
  const expected = Buffer.from(key, 'base64url');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT_MAX_MEMORY,
  });
  return timingSafeEqual(actual, expected);
}

// A versão entra na sessão: trocar a senha encerra as sessões abertas em outros aparelhos.
export function createSession(config, user, now = Date.now()) {
  const payload = `${user.id}.${user.session_version}.${now + SESSION_MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${hmac(config.sessionSecret, `sessao:${payload}`)}`;
}

export function readSession(token, config, now = Date.now()) {
  const [userId, version, expires, signature] = String(token ?? '').split('.');
  if (!userId || !version || !expires || !signature || Number(expires) <= now) return null;
  const valid = safeEqual(signature, hmac(config.sessionSecret, `sessao:${userId}.${version}.${expires}`));
  return valid ? { userId: Number(userId), version: Number(version) } : null;
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return cookies;
}

// Código que liga um número de WhatsApp a uma conta: guardado só como hash.
export function generateLinkCode() {
  const chars = Array.from({ length: LINK_CODE_LENGTH }, () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export const hashLinkCode = (config, code) => hmac(config.sessionSecret, `whatsapp:${String(code).toUpperCase().replace('-', '')}`);

// Link de painel compartilhado: longo e aleatório, guardado só como hash.
export const generateShareToken = () => randomBytes(32).toString('base64url');
export const hashShareToken = (token) => sha256(token).toString('hex');

// Limite de tentativas, para quem tenta adivinhar senhas e códigos ou disparar e-mails.
export function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const recent = (key, now) => {
    const list = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  return {
    blocked: (key, now = Date.now()) => recent(key, now).length >= max,
    hit(key, now = Date.now()) {
      // Chaves que nunca mais voltam não podem se acumular na memória.
      if (hits.size >= LIMITER_MAX_KEYS) for (const old of [...hits.keys()]) recent(old, now);
      hits.set(key, [...recent(key, now), now]);
    },
    reset: (key) => hits.delete(key),
  };
}

// Link assinado de uso específico e curta duração, como o de cadastro ou o que conecta o Google Agenda.
export function signToken(config, purpose, data, ttlMs, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: now + ttlMs })).toString('base64url');
  return `${payload}.${hmac(config.sessionSecret, `${purpose}:${payload}`)}`;
}

export function verifyToken(config, purpose, token, now = Date.now()) {
  const [payload, signature] = String(token ?? '').split('.');
  if (!payload || !signature || !safeEqual(signature, hmac(config.sessionSecret, `${purpose}:${payload}`))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > now ? data : null;
  } catch {
    return null;
  }
}

// Tokens do Google ficam cifrados no banco: um vazamento do banco não dá acesso às agendas.
export function encryptSecret(config, text) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', sha256(config.encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(config, value) {
  const [iv, tag, encrypted] = String(value).split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', sha256(config.encryptionKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

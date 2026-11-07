// Recebe nome e WhatsApp e guarda em um CSV que abre direto no Excel.
// Esta pasta é temporária e não usa nada do app: veja o README.md.
import { createServer } from 'node:http';
import { constants } from 'node:fs';
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(HERE, 'public');

export const DEFAULT_DATA_DIR = resolve(HERE, 'dados');

const BODY_LIMIT = 4 * 1024;
const NAME_MIN = 2;
const NAME_MAX = 80;
const HOUR_MS = 60 * 60 * 1000;
const LIMITER_MAX_KEYS = 10_000;
// Folgado de propósito: operadoras de celular colocam muita gente atrás do mesmo endereço.
const SIGNUPS_PER_HOUR = 100;
const TIME_ZONE = 'America/Sao_Paulo';

// O BOM e o ponto e vírgula fazem o Excel em português abrir com os acentos e as colunas certos.
const CSV_HEADER = '﻿data_hora;nome;whatsapp\r\n';
// DDDs que existem no Brasil: evita guardar um número digitado errado, como (00) ou (20).
const VALID_AREA_CODES = /^(1[1-9]|2[1247-8]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/;

// Só o que está nesta lista é entregue. A pasta dos inscritos nunca pode ser baixada pelo site.
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/obrigado': ['obrigado.html', 'text/html; charset=utf-8'],
  '/pagina.css': ['pagina.css', 'text/css; charset=utf-8'],
  '/pagina.js': ['pagina.js', 'text/javascript; charset=utf-8'],
  '/favicon.ico': ['favicon.ico', 'image/x-icon'],
  '/logo-fundo-escuro.png': ['logo-fundo-escuro.png', 'image/png'],
  '/simbolo.png': ['simbolo.png', 'image/png'],
  '/fontes/poppins-300.woff2': ['fontes/poppins-300.woff2', 'font/woff2'],
  '/fontes/poppins-400.woff2': ['fontes/poppins-400.woff2', 'font/woff2'],
  '/fontes/poppins-500.woff2': ['fontes/poppins-500.woff2', 'font/woff2'],
  '/fontes/poppins-600.woff2': ['fontes/poppins-600.woff2', 'font/woff2'],
  '/assessores/caio.svg': ['assessores/caio.svg', 'image/svg+xml'],
  '/assessores/cris.svg': ['assessores/cris.svg', 'image/svg+xml'],
  '/assessores/nina.svg': ['assessores/nina.svg', 'image/svg+xml'],
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Aceita o número como a pessoa escrever e guarda sempre igual, como "(47) 99123-4567". Segue a regra
// do app: o celular fica com o 9 depois do DDD, para a mesma linha não entrar duas vezes. O formato
// com parênteses também impede o Excel de mostrar o número como 5,5E+12. Sem ";": nunca precisa de aspas.
function cleanWhatsapp(raw) {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').replace(/^55(?=\d{10,11}$)/, '');
  const match = digits.match(/^(\d{2})(\d{8,9})$/);
  if (!match || !VALID_AREA_CODES.test(match[1])) return null;

  const [, areaCode, number] = match;
  if (number.length === 9 && number[0] !== '9') return null;
  const full = /^[6-9]\d{7}$/.test(number) ? `9${number}` : number;
  // Número de mentira, como (11) 99999-9999.
  if (/^9?(\d)\1{7}$/.test(full)) return null;
  return `(${areaCode}) ${full.slice(0, -4)}-${full.slice(-4)}`;
}

function csvField(value) {
  // Um nome como =SOMA(A1) não pode virar fórmula quando a planilha for aberta.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    // Endereços que nunca mais voltam não podem se acumular na memória.
    if (hits.size >= LIMITER_MAX_KEYS) {
      for (const [old, list] of hits) if (now - list.at(-1) >= windowMs) hits.delete(old);
      if (hits.size >= LIMITER_MAX_KEYS) hits.clear();
    }
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    const allowed = recent.length < max;
    if (allowed) recent.push(now);
    hits.set(key, recent);
    return allowed;
  };
}

async function createStore(dataDir) {
  const file = resolve(dataDir, 'inscritos.csv');
  // Melhor não abrir do que abrir e perder inscrições: sem poder gravar, a página nem liga.
  try {
    await mkdir(dataDir, { recursive: true });
    await access(dataDir, constants.W_OK);
  } catch (err) {
    throw new Error(`Sem permissão para gravar em ${dataDir} (${err.code}).`);
  }

  const saved = await readFile(file, 'utf8').catch((err) => {
    if (err.code === 'ENOENT') return '';
    throw err;
  });
  // O WhatsApp é sempre a última coluna e nunca tem ";". O nome nunca tem quebra de linha.
  const numbers = new Set(
    saved.split(/\r?\n/).slice(1).filter(Boolean).map((line) => line.slice(line.lastIndexOf(';') + 1)),
  );

  async function write(row) {
    await writeFile(file, CSV_HEADER, { flag: 'wx', mode: 0o600 }).catch((err) => {
      if (err.code !== 'EEXIST') throw err;
    });
    await appendFile(file, row);
  }

  // Uma inscrição por vez: duas ao mesmo tempo não misturam linhas nem duplicam o número.
  let queue = Promise.resolve();
  return {
    add({ name, whatsapp }) {
      const job = queue.then(async () => {
        if (numbers.has(whatsapp)) return;
        const when = new Date().toLocaleString('sv-SE', { timeZone: TIME_ZONE });
        await write(`${when};${csvField(name)};${whatsapp}\r\n`);
        numbers.add(whatsapp);
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}

async function readJson(req) {
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
    throw new HttpError(415, 'Envie os dados em JSON.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new HttpError(413, 'Conteúdo grande demais.');
    chunks.push(chunk);
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Não foi possível ler os dados enviados.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'Não foi possível ler os dados enviados.');
  }
  return data;
}

export async function createWaitlist({
  dataDir = DEFAULT_DATA_DIR,
  company = {},
  clientIpHeader = '',
  rateLimit = { max: SIGNUPS_PER_HOUR, windowMs: HOUR_MS },
  log = console,
} = {}) {
  const store = await createStore(dataDir);
  const allowIp = createLimiter(rateLimit);
  const clientIp = (req) => (clientIpHeader && req.headers[clientIpHeader]) || req.socket.remoteAddress;

  async function signUp(req) {
    if (!allowIp(clientIp(req))) throw new HttpError(429, 'Muitas tentativas. Tente de novo mais tarde.');
    const body = await readJson(req);

    // Campo invisível que só robô preenche. A resposta é a mesma, para ele não perceber.
    if (body.site) return;

    const name = cleanName(body.nome);
    if (name.length < NAME_MIN) throw new HttpError(400, 'Informe seu nome.', 'nome');
    if (name.length > NAME_MAX) throw new HttpError(400, 'Use um nome mais curto.', 'nome');

    const whatsapp = cleanWhatsapp(body.whatsapp);
    if (!whatsapp) throw new HttpError(400, 'Informe seu WhatsApp com DDD, como (47) 99123-4567.', 'whatsapp');

    // Número repetido recebe a mesma resposta, para a página não revelar quem está na fila.
    await store.add({ name, whatsapp });
  }

  async function privacyPage() {
    const template = await readFile(resolve(PUBLIC_DIR, 'privacidade.html'), 'utf8');
    const missing = '[a preencher]';
    const values = {
      EMPRESA_NOME: company.name || missing,
      EMPRESA_CNPJ: company.cnpj || missing,
      EMPRESA_EMAIL: company.email || missing,
    };
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? escapeHtml(values[key]) : match));
  }

  async function route(req, res) {
    const pathname = req.url.split('?')[0];
    const reply = (status, body, type) => {
      res.writeHead(status, {
        ...SECURITY_HEADERS,
        'Content-Type': type,
        'Cache-Control': type.startsWith('application/json') ? 'no-store' : 'no-cache',
      });
      res.end(body);
    };

    if (pathname === '/inscrever' && req.method === 'POST') {
      await signUp(req);
      return reply(200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
    }
    if (req.method === 'GET' && pathname === '/health') {
      // A Fly.io consulta este endereço. Sem poder gravar, a página não está de pé de verdade.
      const healthy = await access(dataDir, constants.W_OK).then(() => true, () => false);
      return reply(healthy ? 200 : 503, JSON.stringify({ ok: healthy }), 'application/json; charset=utf-8');
    }
    if (req.method === 'GET' && pathname === '/privacidade') {
      return reply(200, await privacyPage(), 'text/html; charset=utf-8');
    }
    const file = STATIC_FILES[pathname];
    if (req.method === 'GET' && file) {
      return reply(200, await readFile(resolve(PUBLIC_DIR, file[0])), file[1]);
    }
    return reply(404, 'Página não encontrada.', 'text/plain; charset=utf-8');
  }

  return createServer((req, res) => {
    route(req, res).catch((err) => {
      const known = err instanceof HttpError;
      // Só o código do erro: o registro do servidor não recebe nome nem número.
      if (!known) log.error('Falha na fila de espera:', err.code ?? err.message);
      if (res.headersSent) return res.end();
      res.writeHead(known ? err.status : 500, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          erro: known ? err.message : 'Não foi possível guardar sua inscrição agora. Tente de novo em instantes.',
          campo: known ? err.field : undefined,
        }),
      );
    });
  });
}

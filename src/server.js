import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { accessOf, canWrite } from './access.js';
import { createAssistant } from './assistant.js';
import {
  createLimiter, createSession, generateLinkCode, generateShareToken, hashLinkCode, hashPassword, hashShareToken, LINK_CODE_MINUTES,
  parseCookies, PASSWORD_MAX, PASSWORD_MIN, readSession, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signToken, verifyPassword, verifyToken,
} from './auth.js';
import { classify, MAINTENANCE_SLUG } from './categories.js';
import { ROOT, TERMS_VERSION } from './config.js';
import { addDays, isValidDate, isValidMonth, isValidTime, monthOf, monthRange, shiftMonth, todayIn } from './dates.js';
import { dayPlan } from './day-plan.js';
import { createMailer, emails } from './email.js';
import { MAX_PANELS, pickSections, WIDGETS } from './panels.js';
import { formatPhone, maskPhone, parseTypedPhone } from './phone.js';
import { createRecurrence, FREQUENCIES } from './recurrences.js';
import { expensesToCsv, monthSummary, panelData } from './reports.js';
import { fold, isValidEmail, MAX_CENTS, normalizeEmail, normalizeKeyword, parseMoney } from './text.js';
import { splitHistory, vehicleSummary } from './vehicles.js';
import { canTranscribe, hearAudio } from './transcription.js';
import { countWithoutPhone, extractMessages, isNonText, sendText as sendWhatsAppText, validSignature, verifyWebhook } from './whatsapp.js';

const API_BODY_LIMIT = 64 * 1024;
// A Meta documenta avisos de até 3 MB.
const WEBHOOK_BODY_LIMIT = 4 * 1024 * 1024;
const MAX_DESCRIPTION = 120;
const MAX_CATEGORY_NAME = 40;
const MAX_NAME = 80;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SIGNUP_LINK_TTL_MS = DAY_MS;
const GOOGLE_SIGNUP_TTL_MS = 30 * MINUTE_MS;
const PASSWORD_LINK_TTL_MS = HOUR_MS;
const GOOGLE_COOKIE = 'nuvexx_google';
const GOOGLE_STATE_TTL_MS = 15 * MINUTE_MS;
const GOOGLE_LINK_TTL_MS = 30 * MINUTE_MS;
const AGENDA_DEFAULT_DAYS = 90;
const MAX_ACCOUNT_NAME = 40;
const MAX_VEHICLE_NAME = 60;
const MAX_PANEL_NAME = 40;
const DEFAULT_PERIOD_MONTHS = 6;
const MAX_PERIOD_MONTHS = 24;
const SHARE_TTL_MS = 30 * DAY_MS;
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'password', 'password1', 'senha123', 'senha1234',
  'qwerty123', 'abcd1234', 'abc12345', 'admin123', 'mudar123', 'brasil123', 'gastei123', 'nuvexx123', 'iloveyou',
]);

const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/favicon.ico': ['favicon.ico', 'image/x-icon'],
  '/marca/logo-fundo-claro.png': ['marca/logo-fundo-claro.png', 'image/png'],
  '/marca/logo-fundo-escuro.png': ['marca/logo-fundo-escuro.png', 'image/png'],
  '/icons/icon-180.png': ['icons/icon-180.png', 'image/png'],
  '/icons/icon-192.png': ['icons/icon-192.png', 'image/png'],
  '/icons/icon-512.png': ['icons/icon-512.png', 'image/png'],
  '/icons/maskable-512.png': ['icons/maskable-512.png', 'image/png'],
  '/theme.js': ['theme.js', 'text/javascript; charset=utf-8'],
  '/assessores/caio.svg': ['assessores/caio.svg', 'image/svg+xml'],
  '/assessores/cris.svg': ['assessores/cris.svg', 'image/svg+xml'],
  '/assessores/nina.svg': ['assessores/nina.svg', 'image/svg+xml'],
};
const LEGAL_PAGES = { '/termos': 'termos.html', '/privacidade': 'privacidade.html' };

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
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const sendJson = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

const sendHtml = (res, status, html) => send(res, status, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });

function simplePage(title, ...paragraphs) {
  const body = paragraphs.join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><link rel="stylesheet" href="/styles.css"><script src="/theme.js"></script></head>
<body><main class="simple-page"><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Conteúdo grande demais.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
    throw new HttpError(415, 'Envie os dados em JSON.');
  }
  try {
    return JSON.parse((await readBody(req, API_BODY_LIMIT)).toString('utf8') || '{}');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'JSON inválido.');
  }
}

// Compara pelo resumo de cada lado, para o tempo da comparação não revelar nada do segredo.
const sameSecret = (given, expected) => timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());

export const createApp = (options) => createServer(createHandler(options));

// Devolve a função que atende cada pedido. A promessa dela só termina quando o trabalho todo acabou,
// inclusive o que continua depois da resposta, como o processamento das mensagens do WhatsApp.
export function createHandler({ config, db, google, mailer = createMailer({ config }), sendText = sendWhatsAppText, log = console, tick = null }) {
  const assistant = createAssistant({ db, config, google, mailer, log });
  const wwwHost = `www.${new URL(config.appUrl).host}`;
  const loginByEmail = createLimiter({ max: 10, windowMs: 15 * MINUTE_MS });
  const loginByIp = createLimiter({ max: 50, windowMs: 15 * MINUTE_MS });
  const mailByEmail = createLimiter({ max: 5, windowMs: HOUR_MS });
  const mailByIp = createLimiter({ max: 30, windowMs: HOUR_MS });
  // Quem tenta entrar sem ter conta leva o mesmo tempo de quem erra a senha.
  const decoyHash = hashPassword(randomBytes(16).toString('hex'));

  const today = () => todayIn(config.timeZone);

  function cookieHeader(req, name, value, maxAge) {
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  const sessionCookie = (req, user) => cookieHeader(req, SESSION_COOKIE, createSession(config, user), SESSION_MAX_AGE_SECONDS);
  const clearSession = (req) => cookieHeader(req, SESSION_COOKIE, '', 0);

  // Atrás do proxy de HTTPS, a conexão vem sempre dele: o endereço real está no cabeçalho que ele
  // preenche. Cada provedor usa o seu, e só esse é confiável, porque o visitante não consegue forjá-lo.
  const clientIp = (req) => (config.clientIpHeader && req.headers[config.clientIpHeader]) || req.socket.remoteAddress;

  async function requireUser(req) {
    const session = readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE], config);
    const user = session ? await db.userById(session.userId) : null;
    if (!user || user.session_version !== session.version) throw new HttpError(401, 'Entre para continuar.');
    return user;
  }

  function validName(raw) {
    const name = String(raw ?? '').trim();
    if (!name) throw new HttpError(400, 'Conte como podemos chamar você.');
    if (name.length > MAX_NAME) throw new HttpError(400, `Use até ${MAX_NAME} caracteres no nome.`);
    return name;
  }

  function validEmail(raw) {
    const email = normalizeEmail(raw);
    if (!isValidEmail(email)) throw new HttpError(400, 'Informe um e-mail válido.');
    return email;
  }

  function validPassword(raw, email) {
    const password = String(raw ?? '');
    if (password.length < PASSWORD_MIN) throw new HttpError(400, `Use pelo menos ${PASSWORD_MIN} caracteres na senha.`);
    if (password.length > PASSWORD_MAX) throw new HttpError(400, `Use até ${PASSWORD_MAX} caracteres na senha.`);
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower) || lower === email) throw new HttpError(400, 'Essa senha é fácil de adivinhar. Escolha outra.');
    return password;
  }

  const canRegister = (email) => config.registration.open || config.registration.allowed.includes(email);

  // Vale para quem tem conta e para quem não tem, então o limite não revela nada.
  function limitMail(req, email) {
    const ip = clientIp(req);
    if (mailByEmail.blocked(email) || mailByIp.blocked(ip)) throw new HttpError(429, 'Muitos pedidos. Tente de novo em uma hora.');
    mailByEmail.hit(email);
    mailByIp.hit(ip);
  }

  // Sem conta nova antes de provar que o e-mail é da pessoa: a senha só é escolhida depois de abrir o link.
  async function handleSignup(req, res) {
    const email = validEmail((await readJson(req)).email);
    if (!canRegister(email)) throw new HttpError(403, 'O cadastro ainda não está aberto para este e-mail.');
    limitMail(req, email);
    if (await db.userByEmail(email)) {
      mailer.deliver(emails.accountExists({ to: email, link: config.appUrl }));
    } else {
      const token = signToken(config, 'cadastro', { email }, SIGNUP_LINK_TTL_MS);
      mailer.deliver(emails.signup({ to: email, link: `${config.appUrl}/#/cadastro/${token}` }));
    }
    // A mesma resposta nos dois casos: não revela quem tem conta.
    return sendJson(res, 200, { ok: true });
  }

  function signupData(token) {
    const data = verifyToken(config, 'cadastro', token);
    if (!data) throw new HttpError(400, 'Este link venceu. Peça outro para continuar.');
    if (!canRegister(data.email)) throw new HttpError(403, 'O cadastro ainda não está aberto para este e-mail.');
    return data;
  }

  async function handleSignupVerify(req, res) {
    const data = signupData((await readJson(req)).token);
    return sendJson(res, 200, { email: data.email, name: data.name ?? '', google: Boolean(data.sub) });
  }

  async function handleSignupComplete(req, res) {
    const body = await readJson(req);
    const data = signupData(body.token);
    const name = validName(body.name);
    if (body.accepted !== true) throw new HttpError(400, 'Para criar a conta, aceite os termos de uso e a política de privacidade.');
    const passwordHash = data.sub ? null : await hashPassword(validPassword(body.password, data.email));
    const now = new Date();
    const user = await db.createUser({
      name,
      email: data.email,
      passwordHash,
      googleSub: data.sub ?? null,
      termsVersion: TERMS_VERSION,
      acceptedAt: now,
      trialEndsAt: new Date(now.getTime() + config.product.trialDays * DAY_MS),
    });
    if (!user) throw new HttpError(409, 'Já existe uma conta com este e-mail. Entre com sua senha.');
    return sendJson(res, 201, { ok: true }, { 'Set-Cookie': sessionCookie(req, user) });
  }

  async function handleLogin(req, res) {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const ip = clientIp(req);
    if (loginByEmail.blocked(email) || loginByIp.blocked(ip)) throw new HttpError(429, 'Muitas tentativas. Espere 15 minutos.');
    const user = await db.userByEmail(email);
    const password = String(body.password ?? '').slice(0, PASSWORD_MAX);
    const valid = await verifyPassword(password, user?.password_hash ?? await decoyHash);
    if (!valid || !user?.password_hash) {
      loginByEmail.hit(email);
      loginByIp.hit(ip);
      // A mesma resposta para e-mail sem conta e senha errada: não revela quem tem conta.
      throw new HttpError(401, 'E-mail ou senha incorretos.');
    }
    loginByEmail.reset(email);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, user) });
  }

  async function handlePasswordForgot(req, res) {
    const email = validEmail((await readJson(req)).email);
    limitMail(req, email);
    const user = await db.userByEmail(email);
    if (user) {
      // A versão no link faz com que ele pare de funcionar assim que a senha mudar.
      const token = signToken(config, 'nova-senha', { userId: user.id, v: user.session_version }, PASSWORD_LINK_TTL_MS);
      mailer.deliver(emails.passwordReset({ to: email, link: `${config.appUrl}/#/nova-senha/${token}` }));
    }
    return sendJson(res, 200, { ok: true });
  }

  async function handlePasswordReset(req, res) {
    const body = await readJson(req);
    const data = verifyToken(config, 'nova-senha', body.token);
    const user = data ? await db.userById(data.userId) : null;
    if (!user || user.session_version !== data.v) throw new HttpError(400, 'Este link venceu ou já foi usado. Peça outro para continuar.');
    const updated = await db.setPassword(user.id, await hashPassword(validPassword(body.password, user.email)));
    mailer.deliver(emails.passwordChanged({ to: user.email }));
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, updated) });
  }

  async function handlePasswordChange(req, res, user) {
    const body = await readJson(req);
    if (loginByEmail.blocked(user.email)) throw new HttpError(429, 'Muitas tentativas. Espere 15 minutos.');
    const current = String(body.current ?? '').slice(0, PASSWORD_MAX);
    if (!user.password_hash || !(await verifyPassword(current, user.password_hash))) {
      loginByEmail.hit(user.email);
      throw new HttpError(400, 'A senha atual não confere.');
    }
    const updated = await db.setPassword(user.id, await hashPassword(validPassword(body.password, user.email)));
    mailer.deliver(emails.passwordChanged({ to: user.email }));
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, updated) });
  }

  const whatsappAvailable = () => Boolean(config.whatsapp.publicNumber) || !config.isProduction;

  function requireWrite(user) {
    if (!canWrite(user)) throw new HttpError(402, 'Seu teste grátis terminou. Assine para continuar anotando.');
  }

  function validMonth(value) {
    const month = value || monthOf(today());
    if (!isValidMonth(month)) throw new HttpError(400, 'Mês inválido.');
    return month;
  }

  // Conta é opcional, mas, quando vem, precisa ser da própria pessoa.
  async function accountIdFrom(body, store) {
    if (body.account_id === undefined || body.account_id === null || body.account_id === '') return null;
    const id = Number(body.account_id);
    if (!(await store.account(id))) throw new HttpError(400, 'Escolha uma conta válida.');
    return id;
  }

  async function entryFields(body, store, { amountOptional = false } = {}) {
    const description = String(body.description ?? '').trim();
    if (!description) throw new HttpError(400, 'Conte o que foi esse lançamento.');
    if (description.length > MAX_DESCRIPTION) throw new HttpError(400, `Use até ${MAX_DESCRIPTION} caracteres na descrição.`);
    const withoutAmount = amountOptional && !String(body.amount ?? '').trim();
    const amountCents = withoutAmount ? 0 : parseMoney(body.amount);
    if (!withoutAmount && !amountCents) throw new HttpError(400, 'Informe um valor maior que zero, como 50,90.');
    if (!isValidDate(String(body.date ?? ''))) throw new HttpError(400, 'Informe uma data válida.');
    return { description, amountCents, date: body.date, accountId: await accountIdFrom(body, store) };
  }

  async function expenseFields(body, store) {
    const categoryId = Number(body.category_id);
    const category = await store.category(categoryId);
    if (!category) throw new HttpError(400, 'Escolha uma categoria.');
    // Manutenção antiga pode entrar sem valor: o histórico importa mais que um preço que ninguém lembra.
    const isService = category.slug === MAINTENANCE_SLUG;
    return { ...(await entryFields(body, store, { amountOptional: isService })), categoryId, isService };
  }

  function vehicleFields(body) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(400, 'Dê um nome ao veículo, como Honda Civic 2018.');
    if (name.length > MAX_VEHICLE_NAME) throw new HttpError(400, `Use até ${MAX_VEHICLE_NAME} caracteres no nome.`);
    const plate = String(body.plate ?? '').trim().toUpperCase();
    if (plate && !/^[A-Z0-9-]{5,10}$/.test(plate)) throw new HttpError(400, 'Informe a placa só com letras e números, como ABC1D23.');
    return { name, plate: plate || null };
  }

  async function serviceFields(body, store) {
    const place = String(body.place ?? '').trim();
    if (place.length > MAX_DESCRIPTION) throw new HttpError(400, `Use até ${MAX_DESCRIPTION} caracteres no lugar.`);
    const kilometers = String(body.odometer_km ?? '').replace(/[.\s]/g, '');
    if (kilometers && !/^\d{1,7}$/.test(kilometers)) throw new HttpError(400, 'Informe a quilometragem só com números, como 85000.');
    const vehicleId = body.vehicle_id ? Number(body.vehicle_id) : null;
    if (vehicleId && !(await store.vehicle(vehicleId))) throw new HttpError(400, 'Escolha um veículo válido.');
    return { vehicleId, place: place || null, odometerKm: kilometers ? Number(kilometers) : null };
  }

  // Retorna null quando o lançamento não se repete.
  function repeatFields(body, startOn) {
    if (!body.repeat) return null;
    if (!FREQUENCIES[body.repeat]) throw new HttpError(400, 'Escolha como o lançamento se repete.');
    const endOn = body.repeat_until || null;
    if (endOn && (!isValidDate(String(endOn)) || endOn < startOn)) throw new HttpError(400, 'A data final precisa ser depois do primeiro lançamento.');
    return { frequency: body.repeat, endOn };
  }

  // "Este e os próximos": aplica à repetição, a partir desta ocorrência.
  async function saveRepeatingEdit(store, row, date, fields) {
    const rule = await store.recurrence(row.recurrence_id);
    if (rule) await store.updateRecurrenceFrom(rule, date, fields);
  }

  async function removeRepeatingFrom(store, row, date) {
    const rule = await store.recurrence(row.recurrence_id);
    if (rule) await store.endRecurrence(rule, date);
  }

  function accountFields(body) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(400, 'Dê um nome à conta.');
    if (name.length > MAX_ACCOUNT_NAME) throw new HttpError(400, `Use até ${MAX_ACCOUNT_NAME} caracteres no nome.`);
    const kind = body.kind === 'cartao' ? 'cartao' : 'conta';
    const raw = String(body.opening ?? '').trim();
    const negative = /^[-−]/.test(raw);
    const openingCents = raw ? parseMoney(raw.replace(/^[-−]\s*/, '')) : 0;
    if (openingCents === null || openingCents > MAX_CENTS) throw new HttpError(400, 'Informe um saldo válido, como 1.250,00.');
    return { name, kind, openingCents: kind === 'cartao' ? 0 : (negative ? -openingCents : openingCents) };
  }

  function taskFields(body) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new HttpError(400, 'Conte qual é a tarefa.');
    if (title.length > MAX_DESCRIPTION) throw new HttpError(400, `Use até ${MAX_DESCRIPTION} caracteres na tarefa.`);
    const date = body.date || null;
    if (date && !isValidDate(String(date))) throw new HttpError(400, 'Informe uma data válida.');
    const time = body.time || null;
    if (time && !isValidTime(time)) throw new HttpError(400, 'Informe um horário válido.');
    if (time && !date) throw new HttpError(400, 'Para usar um horário, escolha também o dia.');
    return { title, date, time };
  }

  function panelFields(body, current = null) {
    const name = body.name === undefined && current ? current.name : String(body.name ?? '').trim();
    if (!name) throw new HttpError(400, 'Dê um nome ao painel.');
    if (name.length > MAX_PANEL_NAME) throw new HttpError(400, `Use até ${MAX_PANEL_NAME} caracteres no nome.`);
    const list = body.widgets === undefined && current ? current.widgets : body.widgets;
    if (!Array.isArray(list) || !list.length) throw new HttpError(400, 'Escolha pelo menos um bloco.');
    const widgets = [...new Set(list.map(String))];
    if (widgets.some((id) => !WIDGETS[id])) throw new HttpError(400, 'Bloco desconhecido.');
    return { name, widgets };
  }

  function periodFrom(searchParams) {
    const to = validMonth(searchParams.get('to'));
    const from = searchParams.get('from') || shiftMonth(to, 1 - DEFAULT_PERIOD_MONTHS);
    if (!isValidMonth(from) || from > to || shiftMonth(from, MAX_PERIOD_MONTHS) <= to) throw new HttpError(400, 'Período inválido.');
    return { from, to, today: today() };
  }

  async function panelPayload(store, panel) {
    return { id: panel.id, name: panel.name, widgets: panel.widgets, share: await store.shareOf(panel.id) };
  }

  async function handleShared(req, res, url) {
    const { token } = await readJson(req);
    const panel = token ? await db.sharedPanel(hashShareToken(String(token)), new Date()) : null;
    if (!panel) throw new HttpError(404, 'Este link venceu ou deixou de ser compartilhado.');
    const data = await panelData(db.forUser(panel.user_id), periodFrom(url.searchParams));
    return sendJson(res, 200, {
      panel: { name: panel.name, widgets: panel.widgets, owner: panel.owner_name.split(/\s+/)[0] },
      data: pickSections(data, panel.widgets),
    });
  }

  function appointmentFields(body) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new HttpError(400, 'Conte qual é o compromisso.');
    if (title.length > MAX_DESCRIPTION) throw new HttpError(400, `Use até ${MAX_DESCRIPTION} caracteres no título.`);
    if (!isValidDate(String(body.date ?? ''))) throw new HttpError(400, 'Informe uma data válida.');
    const time = body.time || null;
    const endTime = body.end_time || null;
    if (time && !isValidTime(time)) throw new HttpError(400, 'Informe um horário válido.');
    if (endTime && (!isValidTime(endTime) || !time || endTime <= time)) throw new HttpError(400, 'O horário de término precisa ser depois do início.');
    return { title, date: body.date, time, endTime };
  }

  function categoryFields(body) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(400, 'Dê um nome à categoria.');
    if (name.length > MAX_CATEGORY_NAME) throw new HttpError(400, `Use até ${MAX_CATEGORY_NAME} caracteres no nome.`);
    const emoji = [...String(body.emoji ?? '').trim()].slice(0, 8).join('') || '📦';
    const keywords = Array.isArray(body.keywords) ? body.keywords.map(String).map((k) => k.trim()).filter(Boolean) : null;
    return { name, emoji, keywords };
  }

  function uniqueError(err, message) {
    return String(err.message).includes('unique') || err.code === '23505' ? new HttpError(409, message) : err;
  }

  const uniqueNameError = (err) => uniqueError(err, 'Já existe uma categoria com esse nome.');

  async function categoryPayload(store, row) {
    return { ...row, keywords: await store.keywordsOf(row.id) };
  }

  async function handleIncoming(message) {
    if (!(await db.markProcessed(message.id))) return;
    if (message.type !== 'text' && !isNonText(message)) return;
    const reply = await assistant.handleWhatsApp({
      from: message.from,
      text: message.text,
      isText: message.type === 'text',
      sentAt: message.sentAt,
      // Só é chamado depois de saber quem mandou: baixar e transcrever custa dinheiro.
      listen: message.audio && canTranscribe(config) ? () => hearAudio(config, message.audio) : null,
    });
    if (reply) await sendText(config.whatsapp, message.from, reply);
  }

  async function handleWebhookPost(req, res) {
    const raw = await readBody(req, WEBHOOK_BODY_LIMIT);
    if (!config.whatsapp.appSecret) throw new HttpError(503, 'WHATSAPP_APP_SECRET não configurado.');
    if (!validSignature(raw, req.headers['x-hub-signature-256'], config.whatsapp.appSecret)) {
      throw new HttpError(401, 'Assinatura inválida.');
    }
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new HttpError(400, 'JSON inválido.');
    }

    // Responde antes de processar: a Meta reenvia o aviso se a resposta demorar.
    send(res, 200, 'EVENT_RECEIVED', { 'Content-Type': 'text/plain; charset=utf-8' });
    const withoutPhone = countWithoutPhone(payload, config.whatsapp.phoneNumberId);
    if (withoutPhone) log.error(`WhatsApp: ${withoutPhone} mensagem(ns) sem o número do remetente ficaram sem resposta.`);
    for (const message of extractMessages(payload, config.whatsapp.phoneNumberId)) {
      try {
        await handleIncoming(message);
      } catch (err) {
        log.error(`WhatsApp (${maskPhone(message.from)}): ${err.message}`);
      }
    }
  }

  async function handleApi(req, res, url) {
    const { pathname, searchParams } = url;
    const { method } = req;

    // Uma página de outro site não pode entrar em uma conta nem alterar dados de quem está logado.
    if (method !== 'GET' && req.headers['sec-fetch-site'] === 'cross-site') {
      throw new HttpError(403, 'Origem não permitida.');
    }

    if (pathname === '/api/config' && method === 'GET') {
      return sendJson(res, 200, {
        trial_days: config.product.trialDays,
        is_dev: !config.isProduction,
        google_login: google.isConfigured(),
      });
    }

    if (method === 'POST') {
      if (pathname === '/api/login') return handleLogin(req, res);
      if (pathname === '/api/signup') return handleSignup(req, res);
      if (pathname === '/api/signup/verify') return handleSignupVerify(req, res);
      if (pathname === '/api/signup/complete') return handleSignupComplete(req, res);
      if (pathname === '/api/password/forgot') return handlePasswordForgot(req, res);
      if (pathname === '/api/password/reset') return handlePasswordReset(req, res);
      if (pathname === '/api/shared') return handleShared(req, res, url);
    }

    // Só em desenvolvimento: fazem o papel do WhatsApp e do e-mail para testar sem esses serviços.
    if (pathname === '/api/dev/whatsapp' && method === 'POST' && !config.isProduction) {
      const { from, text } = await readJson(req);
      const reply = await assistant.handleWhatsApp({ from: parseTypedPhone(from), text: String(text ?? '') });
      return sendJson(res, 200, { reply });
    }
    if (pathname === '/api/dev/emails' && method === 'GET' && !config.isProduction) return sendJson(res, 200, mailer.outbox ?? []);

    const user = await requireUser(req);
    const store = db.forUser(user.id);

    if (pathname === '/api/logout' && method === 'POST') {
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSession(req) });
    }

    if (pathname === '/api/me' && method === 'GET') {
      return sendJson(res, 200, {
        today: today(),
        name: user.name,
        email: user.email,
        has_password: Boolean(user.password_hash),
        google_login: Boolean(user.google_sub),
        email_reminders: user.email_reminders,
        daily_briefing: user.daily_briefing,
        is_dev: !config.isProduction,
        access: accessOf(user),
        trial_ends_at: user.trial_ends_at,
        paid_until: user.paid_until,
        subscribe_url: config.product.subscribeUrl,
        whatsapp: {
          available: whatsappAvailable(),
          number: config.whatsapp.publicNumber,
          phone: user.phone ? formatPhone(user.phone) : null,
        },
        google: { configured: google.isConfigured(), connected: Boolean(await db.googleAccount(user.id)) },
      });
    }

    if (pathname === '/api/me' && method === 'PATCH') {
      const body = await readJson(req);
      await db.updateProfile(user.id, {
        name: body.name === undefined ? null : validName(body.name),
        emailReminders: typeof body.email_reminders === 'boolean' ? body.email_reminders : null,
        dailyBriefing: typeof body.daily_briefing === 'boolean' ? body.daily_briefing : null,
      });
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/password' && method === 'POST') return handlePasswordChange(req, res, user);

    if (pathname === '/api/account' && method === 'DELETE') {
      await google.disconnect(user.id);
      await db.deleteUser(user.id);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSession(req) });
    }

    // Direito de portabilidade: a pessoa leva tudo que o app guarda sobre ela.
    if (pathname === '/api/account/export' && method === 'GET') {
      const [categories, expenses, appointments, incomes, accounts, tasks, panels, recurrences, vehicles] = await Promise.all([
        store.categories(), store.allExpenses(), store.allAppointments(), store.allIncomes(), store.accounts(), store.allTasks(), store.panels(), store.allRecurrences(), store.vehicles(),
      ]);
      const data = {
        conta: {
          nome: user.name,
          email: user.email,
          entra_com_google: Boolean(user.google_sub),
          telefone: user.phone,
          lembretes_por_email: user.email_reminders,
          resumo_do_dia: user.daily_briefing,
          criada_em: user.created_at,
          termos: user.terms_version,
          termos_aceitos_em: user.terms_accepted_at,
        },
        categorias: await Promise.all(categories.map((row) => categoryPayload(store, row))),
        contas: accounts,
        entradas: incomes,
        gastos: expenses,
        repeticoes: recurrences,
        veiculos: vehicles,
        manutencao_em_andamento: await store.pendingService(new Date()),
        compromisso_em_andamento: await store.pendingEvent(new Date()),
        compromissos: appointments,
        tarefas: tasks,
        paineis: panels.map(({ name, widgets }) => ({ nome: name, blocos: widgets })),
      };
      return send(res, 200, JSON.stringify(data, null, 2), {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="meus-dados-nuvexx.json"',
        'Cache-Control': 'no-store',
      });
    }

    if (pathname === '/api/chat' && method === 'POST') {
      const { text } = await readJson(req);
      const reply = await assistant.handlePanel({ user, text: String(text ?? '').slice(0, 2000) });
      return sendJson(res, 200, { reply });
    }

    if (pathname === '/api/summary' && method === 'GET') {
      return sendJson(res, 200, await monthSummary(store, validMonth(searchParams.get('month')), today()));
    }

    // Painéis

    if (pathname === '/api/panel-data' && method === 'GET') {
      return sendJson(res, 200, await panelData(store, periodFrom(searchParams)));
    }

    // Quanto ainda entra e sai fica no painel; aqui, só para a lista saber o que é previsão.
    const isPlanned = (date) => date > today();

    if (pathname === '/api/panels' && method === 'GET') {
      const panels = await store.panels();
      return sendJson(res, 200, {
        panels: await Promise.all(panels.map((panel) => panelPayload(store, panel))),
        catalog: Object.entries(WIDGETS).map(([id, { label }]) => ({ id, label })),
      });
    }

    if (pathname === '/api/panels' && method === 'POST') {
      const fields = panelFields(await readJson(req));
      if ((await store.panels()).length >= MAX_PANELS) throw new HttpError(400, `Você pode ter até ${MAX_PANELS} painéis.`);
      try {
        return sendJson(res, 201, await panelPayload(store, await store.createPanel(fields)));
      } catch (err) {
        throw uniqueError(err, 'Já existe um painel com esse nome.');
      }
    }

    const panelMatch = pathname.match(/^\/api\/panels\/(\d+)(\/share)?$/);
    if (panelMatch) {
      const panel = await store.panel(Number(panelMatch[1]));
      if (!panel) throw new HttpError(404, 'Painel não encontrado.');
      if (panelMatch[2] && method === 'POST') {
        // O endereço só aparece agora: o banco guarda apenas o hash.
        const token = generateShareToken();
        const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
        await store.saveShare(panel.id, hashShareToken(token), expiresAt);
        return sendJson(res, 201, { url: `${config.appUrl}/#/compartilhado/${token}`, expires_at: expiresAt });
      }
      if (panelMatch[2] && method === 'DELETE') {
        await store.deleteShare(panel.id);
        return sendJson(res, 200, { ok: true });
      }
      if (!panelMatch[2] && method === 'PUT') {
        const fields = panelFields(await readJson(req), panel);
        try {
          return sendJson(res, 200, await panelPayload(store, await store.updatePanel(panel.id, fields)));
        } catch (err) {
          throw uniqueError(err, 'Já existe um painel com esse nome.');
        }
      }
      if (!panelMatch[2] && method === 'DELETE') {
        if ((await store.panels()).length <= 1) throw new HttpError(400, 'Mantenha pelo menos um painel.');
        await store.deletePanel(panel.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    // Entradas e saídas juntas, na ordem em que aconteceram.
    if (pathname === '/api/entries' && method === 'GET') {
      const { from, to } = monthRange(validMonth(searchParams.get('month')));
      const type = searchParams.get('type');
      const categoryId = Number(searchParams.get('category_id')) || null;
      const accountId = Number(searchParams.get('account_id')) || null;
      const query = fold(searchParams.get('q') ?? '').trim();
      const [expenses, incomes] = await Promise.all([
        type === 'income' ? [] : store.listExpenses({ from, to, categoryId }),
        type === 'expense' || categoryId ? [] : store.listIncomes({ from, to }),
      ]);
      const rows = [
        ...expenses.map((row) => ({ ...row, kind: 'expense', date: row.spent_on, planned: isPlanned(row.spent_on) })),
        ...incomes.map((row) => ({ ...row, kind: 'income', date: row.received_on, planned: isPlanned(row.received_on) })),
      ]
        .filter((row) => (!accountId || row.account_id === accountId) && (!query || fold(row.description).includes(query)))
        .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
      return sendJson(res, 200, rows);
    }

    if (pathname === '/api/incomes' && method === 'POST') {
      requireWrite(user);
      const body = await readJson(req);
      const fields = await entryFields(body, store);
      const repeat = repeatFields(body, fields.date);
      if (repeat) {
        const rule = await createRecurrence(store, { ...fields, ...repeat, kind: 'income', startOn: fields.date, source: 'app' }, today());
        return sendJson(res, 201, { recurrence_id: rule.id });
      }
      return sendJson(res, 201, await store.addIncome({ ...fields, source: 'app' }));
    }

    const incomeMatch = pathname.match(/^\/api\/incomes\/(\d+)$/);
    if (incomeMatch) {
      const row = await store.income(Number(incomeMatch[1]));
      if (!row) throw new HttpError(404, 'Entrada não encontrada.');
      if (method === 'PUT') {
        requireWrite(user);
        const body = await readJson(req);
        const fields = await entryFields(body, store);
        if (body.apply_next && row.recurrence_id) await saveRepeatingEdit(store, row, row.received_on, fields);
        return sendJson(res, 200, await store.updateIncome(row.id, fields));
      }
      if (method === 'DELETE') {
        if (searchParams.get('next') === '1' && row.recurrence_id) await removeRepeatingFrom(store, row, row.received_on);
        else await store.deleteIncome(row.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (pathname === '/api/accounts' && method === 'GET') {
      return sendJson(res, 200, await store.accountBalances(today()));
    }

    if (pathname === '/api/accounts' && method === 'POST') {
      requireWrite(user);
      try {
        return sendJson(res, 201, await store.createAccount(accountFields(await readJson(req))));
      } catch (err) {
        throw uniqueError(err, 'Já existe uma conta com esse nome.');
      }
    }

    const accountMatch = pathname.match(/^\/api\/accounts\/(\d+)$/);
    if (accountMatch) {
      const row = await store.account(Number(accountMatch[1]));
      if (!row) throw new HttpError(404, 'Conta não encontrada.');
      if (method === 'PUT') {
        requireWrite(user);
        try {
          return sendJson(res, 200, await store.updateAccount(row.id, accountFields(await readJson(req))));
        } catch (err) {
          throw uniqueError(err, 'Já existe uma conta com esse nome.');
        }
      }
      if (method === 'DELETE') {
        await store.deleteAccount(row.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    // Veículos: o histórico vem dos gastos da categoria de manutenção.

    if (pathname === '/api/vehicles' && method === 'GET') {
      const [vehicles, history] = await Promise.all([store.vehicles(), store.maintenanceHistory()]);
      const { done } = splitHistory(history, today());
      return sendJson(res, 200, {
        vehicles: vehicles.map((vehicle) => ({ ...vehicle, summary: vehicleSummary(done.filter((row) => row.vehicle_id === vehicle.id)) })),
        unassigned_count: history.filter((row) => row.vehicle_id === null).length,
      });
    }

    if (pathname === '/api/vehicles' && method === 'POST') {
      requireWrite(user);
      try {
        return sendJson(res, 201, await store.createVehicle(vehicleFields(await readJson(req))));
      } catch (err) {
        throw uniqueError(err, 'Já existe um veículo com esse nome.');
      }
    }

    const vehicleHistoryMatch = pathname.match(/^\/api\/vehicles\/(\d+|none)\/history$/);
    if (vehicleHistoryMatch && method === 'GET') {
      const unassigned = vehicleHistoryMatch[1] === 'none';
      const vehicle = unassigned ? null : await store.vehicle(Number(vehicleHistoryMatch[1]));
      if (!unassigned && !vehicle) throw new HttpError(404, 'Veículo não encontrado.');
      const rows = (await store.maintenanceHistory()).filter((row) => row.vehicle_id === (vehicle?.id ?? null));
      const { done, planned } = splitHistory(rows, today());
      return sendJson(res, 200, { vehicle, done, planned, summary: vehicleSummary(done) });
    }

    const vehicleMatch = pathname.match(/^\/api\/vehicles\/(\d+)$/);
    if (vehicleMatch) {
      const row = await store.vehicle(Number(vehicleMatch[1]));
      if (!row) throw new HttpError(404, 'Veículo não encontrado.');
      if (method === 'PUT') {
        requireWrite(user);
        try {
          return sendJson(res, 200, await store.updateVehicle(row.id, vehicleFields(await readJson(req))));
        } catch (err) {
          throw uniqueError(err, 'Já existe um veículo com esse nome.');
        }
      }
      if (method === 'DELETE') {
        await store.deleteVehicle(row.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    // Tarefas

    if (pathname === '/api/tasks' && method === 'GET') {
      return sendJson(res, 200, await (searchParams.get('status') === 'done' ? store.doneTasks() : store.openTasks()));
    }

    if (pathname === '/api/tasks' && method === 'POST') {
      requireWrite(user);
      return sendJson(res, 201, await assistant.tasks.create(taskFields(await readJson(req)), store, new Date(), 'app'));
    }

    const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
    if (taskMatch) {
      const row = await store.task(Number(taskMatch[1]));
      if (!row) throw new HttpError(404, 'Tarefa não encontrada.');
      if (method === 'PUT') {
        requireWrite(user);
        const body = await readJson(req);
        if (typeof body.done === 'boolean') return sendJson(res, 200, await store.setTaskDone(row.id, body.done ? new Date() : null));
        return sendJson(res, 200, await assistant.tasks.update(row, taskFields(body), store, new Date()));
      }
      if (method === 'DELETE') {
        await store.deleteTask(row.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (pathname === '/api/expenses' && method === 'GET') {
      const { from, to } = monthRange(validMonth(searchParams.get('month')));
      const categoryId = Number(searchParams.get('category_id')) || null;
      const query = fold(searchParams.get('q') ?? '').trim();
      const rows = await store.listExpenses({ from, to, categoryId });
      return sendJson(res, 200, query ? rows.filter((row) => fold(row.description).includes(query)) : rows);
    }

    if (pathname === '/api/expenses' && method === 'POST') {
      requireWrite(user);
      const body = await readJson(req);
      const fields = await expenseFields(body, store);
      const repeat = repeatFields(body, fields.date);
      if (repeat) {
        if (!fields.amountCents) throw new HttpError(400, 'Informe o valor para repetir este lançamento.');
        const rule = await createRecurrence(store, { ...fields, ...repeat, kind: 'expense', startOn: fields.date, source: 'app' }, today());
        return sendJson(res, 201, { recurrence_id: rule.id });
      }
      const service = fields.isService ? await serviceFields(body, store) : null;
      const [row] = await store.addExpense({ ...fields, source: 'app' });
      if (!service) return sendJson(res, 201, row);
      await store.saveVehicleService(row, service);
      return sendJson(res, 201, await store.expense(row.id));
    }

    const expenseMatch = pathname.match(/^\/api\/expenses\/(\d+)$/);
    if (expenseMatch) {
      const row = await store.expense(Number(expenseMatch[1]));
      if (!row) throw new HttpError(404, 'Gasto não encontrado.');
      if (method === 'PUT') {
        requireWrite(user);
        const body = await readJson(req);
        const fields = await expenseFields(body, store);
        if (body.apply_next && row.recurrence_id && !fields.amountCents) throw new HttpError(400, 'Informe o valor para aplicar aos próximos.');
        const service = fields.isService ? await serviceFields(body, store) : null;
        if (fields.categoryId !== row.category_id) {
          await store.setCategory(row, fields.categoryId);
          await store.learn(fields.description, fields.categoryId);
        }
        if (body.apply_next && row.recurrence_id) await saveRepeatingEdit(store, row, row.spent_on, fields);
        if (row.group_id && fields.accountId !== row.account_id) await store.setExpenseAccount(row.group_id, fields.accountId);
        await store.updateExpense(row.id, fields);
        if (service) await store.saveVehicleService(row, service);
        else if (row.category_slug === MAINTENANCE_SLUG) await store.removeVehicleService(row);
        return sendJson(res, 200, await store.expense(row.id));
      }
      if (method === 'DELETE') {
        if (searchParams.get('next') === '1' && row.recurrence_id) await removeRepeatingFrom(store, row, row.spent_on);
        else await store.deleteExpense(row, { wholeGroup: searchParams.get('group') === '1' });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (pathname === '/api/export.csv' && method === 'GET') {
      const month = validMonth(searchParams.get('month'));
      const range = monthRange(month);
      const [expenses, incomes] = await Promise.all([store.listExpenses(range), store.listIncomes(range)]);
      return send(res, 200, expensesToCsv(expenses, incomes), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gastos-${month}.csv"`,
        'Cache-Control': 'no-store',
      });
    }

    if (pathname === '/api/categories' && method === 'GET') {
      const rows = await store.categories();
      return sendJson(res, 200, await Promise.all(rows.map((row) => categoryPayload(store, row))));
    }

    if (pathname === '/api/categories' && method === 'POST') {
      const { name, emoji, keywords } = categoryFields(await readJson(req));
      try {
        const row = await store.createCategory({ name, emoji });
        if (keywords) await store.setKeywords(row.id, keywords);
        return sendJson(res, 201, await categoryPayload(store, row));
      } catch (err) {
        throw uniqueNameError(err);
      }
    }

    const categoryMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
    if (categoryMatch) {
      const row = await store.category(Number(categoryMatch[1]));
      if (!row) throw new HttpError(404, 'Categoria não encontrada.');
      if (method === 'PUT') {
        const { name, emoji, keywords } = categoryFields(await readJson(req));
        try {
          await store.updateCategory(row.id, { name, emoji });
        } catch (err) {
          throw uniqueNameError(err);
        }
        if (keywords) await store.setKeywords(row.id, keywords);
        return sendJson(res, 200, await categoryPayload(store, await store.category(row.id)));
      }
      if (method === 'DELETE') {
        if (row.is_default) throw new HttpError(400, 'A categoria Outros não pode ser apagada.');
        if (row.slug === MAINTENANCE_SLUG) throw new HttpError(400, 'Esta categoria guarda o histórico dos seus veículos e não pode ser apagada.');
        await store.deleteCategory(row.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (pathname === '/api/classify' && method === 'GET') {
      const text = normalizeKeyword(searchParams.get('text') ?? '');
      return sendJson(res, 200, { category_id: classify(text, await store.keywords()) });
    }

    // Agenda

    if (pathname === '/api/agenda/day' && method === 'GET') {
      const date = today();
      const plan = await dayPlan(store, date);
      const sentToday = user.briefing_on === date && Boolean(user.briefing_channel);
      return sendJson(res, 200, { ...plan, briefing: { enabled: user.daily_briefing, channel: sentToday ? user.briefing_channel : null } });
    }

    if (pathname === '/api/appointments' && method === 'GET') {
      const from = searchParams.get('from') || today();
      const to = searchParams.get('to') || addDays(from, AGENDA_DEFAULT_DAYS);
      if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Período inválido.');
      return sendJson(res, 200, await store.listAppointments({ from, to }));
    }

    if (pathname === '/api/appointments' && method === 'POST') {
      requireWrite(user);
      const fields = appointmentFields(await readJson(req));
      const { appointment, status } = await assistant.agenda.create(fields, store, new Date(), 'app');
      return sendJson(res, 201, { ...appointment, sync: status });
    }

    const appointmentMatch = pathname.match(/^\/api\/appointments\/(\d+)$/);
    if (appointmentMatch) {
      const row = await store.appointment(Number(appointmentMatch[1]));
      if (!row) throw new HttpError(404, 'Compromisso não encontrado.');
      if (method === 'PUT') {
        requireWrite(user);
        const fields = appointmentFields(await readJson(req));
        const { appointment, status } = await assistant.agenda.update(row, fields, store, new Date());
        return sendJson(res, 200, { ...appointment, sync: status });
      }
      if (method === 'DELETE') {
        await assistant.agenda.remove(row, store);
        return sendJson(res, 200, { ok: true });
      }
    }

    // WhatsApp: opcional. O código vai na mensagem, e a resposta chega dentro da janela de serviço da Meta.

    if (pathname === '/api/whatsapp/link' && method === 'POST') {
      if (!whatsappAvailable()) throw new HttpError(503, 'A conexão com o WhatsApp ainda não está disponível.');
      const code = generateLinkCode();
      await db.saveWhatsappCode(user.id, hashLinkCode(config, code), new Date(Date.now() + LINK_CODE_MINUTES * MINUTE_MS));
      const text = `conectar ${code}`;
      const number = config.whatsapp.publicNumber;
      return sendJson(res, 200, {
        text,
        minutes: LINK_CODE_MINUTES,
        url: number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null,
      });
    }

    if (pathname === '/api/whatsapp' && method === 'DELETE') {
      await db.unlinkWhatsapp(user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/google/login' && method === 'DELETE') {
      if (!user.password_hash) throw new HttpError(400, 'Crie uma senha antes de desligar a entrada com o Google.');
      await db.setGoogleSub(user.id, null);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/google/link' && method === 'POST') {
      if (!google.isConfigured()) throw new HttpError(503, 'A conexão com o Google Agenda ainda não está disponível.');
      const token = signToken(config, 'google-inicio', { userId: user.id }, GOOGLE_LINK_TTL_MS);
      return sendJson(res, 200, { url: assistant.agenda.googleStartLink(token) });
    }

    if (pathname === '/api/google' && method === 'DELETE') {
      await google.disconnect(user.id);
      return sendJson(res, 200, { ok: true });
    }

    throw new HttpError(404, 'Rota não encontrada.');
  }

  // O link pode ser aberto em outro navegador, sem sessão. Por isso ele é assinado e mostra
  // de quem é a conta: quem recebe um link de outra pessoa percebe antes de autorizar.
  async function handleGoogleStart(res, url) {
    const data = verifyToken(config, 'google-inicio', url.searchParams.get('t'));
    const user = data ? await db.userById(data.userId) : null;
    if (!user || !google.isConfigured()) {
      return sendHtml(res, 400, simplePage('Link vencido', `<p>Peça um novo em <a href="${escapeHtml(config.appUrl)}/#/agenda">Agenda</a>.</p>`));
    }
    const state = signToken(config, 'google-estado', { userId: user.id }, GOOGLE_STATE_TTL_MS);
    return sendHtml(res, 200, simplePage(
      'Conectar o Google Agenda',
      `<p>Os compromissos da conta <strong>${escapeHtml(user.email)}</strong> serão enviados à sua agenda do Google.</p>`,
      '<p>Se esta conta não for sua, feche esta página.</p>',
      `<p><a class="btn btn-primary" href="${escapeHtml(google.authUrl(state))}">Continuar no Google</a></p>`,
    ));
  }

  // O cookie liga o retorno a este navegador: ninguém consegue fazer outra pessoa entrar na conta errada com um link pronto.
  function handleGoogleLogin(req, res) {
    if (!google.isConfigured()) return send(res, 302, '', { Location: '/' });
    const nonce = randomBytes(16).toString('hex');
    const state = signToken(config, 'google-entrada', { nonce }, GOOGLE_STATE_TTL_MS);
    return send(res, 302, '', {
      Location: google.loginUrl(state),
      'Set-Cookie': cookieHeader(req, GOOGLE_COOKIE, nonce, GOOGLE_STATE_TTL_MS / 1000),
      'Cache-Control': 'no-store',
    });
  }

  async function handleGoogleLoginReturn(req, res, url, state) {
    const failure = (status, text) => sendHtml(res, status, simplePage('Não foi possível entrar com o Google', `<p>${text}</p>`, '<p><a class="btn" href="/">Voltar</a></p>'));
    const code = url.searchParams.get('code');
    const nonce = parseCookies(req.headers.cookie)[GOOGLE_COOKIE];
    if (!code || !nonce || !safeEqual(nonce, state.nonce)) return failure(400, 'A autorização foi cancelada ou venceu. Tente de novo.');

    let identity;
    try {
      identity = await google.identity(code);
    } catch (err) {
      log.error(`Entrada com o Google: ${err.message}`);
      return failure(502, 'O Google não confirmou sua conta. Tente de novo em alguns minutos.');
    }

    const email = normalizeEmail(identity.email);
    let user = await db.userByGoogleSub(identity.sub);
    if (!user) {
      user = await db.userByEmail(email);
      if (user?.google_sub) return failure(409, 'Este e-mail já está ligado a outra conta do Google. Entre com sua senha.');
      if (user) {
        // O Google confirmou o e-mail, e a conta também nasceu de um e-mail confirmado: é a mesma pessoa.
        await db.setGoogleSub(user.id, identity.sub);
        mailer.deliver(emails.googleLinked({ to: user.email }));
      }
    }

    const clearNonce = cookieHeader(req, GOOGLE_COOKIE, '', 0);
    if (user) return send(res, 302, '', { Location: '/', 'Set-Cookie': [clearNonce, sessionCookie(req, user)], 'Cache-Control': 'no-store' });

    // Conta nova: ainda falta a pessoa aceitar os termos.
    if (!canRegister(email)) return failure(403, 'O cadastro ainda não está aberto para este e-mail.');
    const token = signToken(config, 'cadastro', { email, sub: identity.sub, name: identity.name }, GOOGLE_SIGNUP_TTL_MS);
    return send(res, 302, '', { Location: `/#/cadastro/${token}`, 'Set-Cookie': clearNonce, 'Cache-Control': 'no-store' });
  }

  async function handleGoogleReturn(req, res, url) {
    const login = verifyToken(config, 'google-entrada', url.searchParams.get('state'));
    if (login) return handleGoogleLoginReturn(req, res, url, login);

    const data = verifyToken(config, 'google-estado', url.searchParams.get('state'));
    const code = url.searchParams.get('code');
    if (!data || !code) {
      return sendHtml(res, 400, simplePage('Google Agenda não conectado', '<p>A autorização foi cancelada ou o link venceu. Você pode tentar de novo quando quiser.</p>', `<p><a class="btn" href="${escapeHtml(config.appUrl)}">Voltar ao app</a></p>`));
    }
    try {
      await google.connect(data.userId, code);
      await google.processQueue();
    } catch (err) {
      log.error(`Google Agenda: conexão: ${err.message}`);
      return sendHtml(res, 502, simplePage('Google Agenda não conectado', '<p>O Google não concluiu a conexão. Tente de novo em alguns minutos.</p>', `<p><a class="btn" href="${escapeHtml(config.appUrl)}">Voltar ao app</a></p>`));
    }
    return sendHtml(res, 200, simplePage('Google Agenda conectado', '<p>Pronto! Os seus compromissos agora vão para o Google Agenda.</p>', `<p><a class="btn btn-primary" href="${escapeHtml(config.appUrl)}/#/agenda">Voltar ao app</a></p>`));
  }

  async function serveLegalPage(res, file) {
    const template = await readFile(resolve(ROOT, 'public', file), 'utf8');
    const { name, cnpj, email } = config.company;
    const missing = '[a preencher]';
    const values = {
      EMPRESA_NOME: name || missing,
      EMPRESA_CNPJ: cnpj || missing,
      EMPRESA_EMAIL: email || missing,
      VERSAO: TERMS_VERSION,
      DIAS_TESTE: config.product.trialDays,
    };
    const html = template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? escapeHtml(values[key]) : match));
    return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  }

  // Na Vercel, o agendador dela chama este endereço a cada minuto, com o segredo combinado: é o relógio
  // dos lembretes, do resumo do dia e da sincronização com o Google. Para qualquer outro, ele não existe.
  async function handleCron(req, res) {
    const expected = config.cronSecret ? `Bearer ${config.cronSecret}` : '';
    if (!tick || !expected || !sameSecret(String(req.headers.authorization ?? ''), expected)) throw new HttpError(404, 'Página não encontrada.');
    await tick();
    return sendJson(res, 200, { ok: true });
  }

  async function route(req, res) {
    // A sessão e a volta do Google valem em um endereço só: quem digita "www" vai para o oficial.
    if (req.headers.host === wwwHost && (req.method === 'GET' || req.method === 'HEAD')) {
      return send(res, 301, '', { Location: `${config.appUrl}${req.url}` });
    }
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;

    if (pathname === '/webhook' && req.method === 'GET') {
      const challenge = verifyWebhook(url.searchParams, config.whatsapp.verifyToken);
      if (challenge === null) throw new HttpError(403, 'Token de verificação incorreto.');
      return send(res, 200, challenge, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (pathname === '/webhook' && req.method === 'POST') return handleWebhookPost(req, res);
    if (pathname === '/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });
    if (pathname === '/cron/minuto' && req.method === 'GET') return handleCron(req, res);
    if (pathname === '/google/conectar' && req.method === 'GET') return handleGoogleStart(res, url);
    if (pathname === '/google/entrar' && req.method === 'GET') return handleGoogleLogin(req, res);
    if (pathname === '/google/retorno' && req.method === 'GET') return handleGoogleReturn(req, res, url);
    if (pathname.startsWith('/api/')) return handleApi(req, res, url);
    if (LEGAL_PAGES[pathname] && req.method === 'GET') return serveLegalPage(res, LEGAL_PAGES[pathname]);

    const file = STATIC_FILES[pathname];
    if (file && req.method === 'GET') {
      const content = await readFile(resolve(ROOT, 'public', file[0]));
      return send(res, 200, content, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    }
    throw new HttpError(404, 'Página não encontrada.');
  }

  return (req, res) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    return route(req, res).catch((err) => {
      if (!(err instanceof HttpError)) log.error(err);
      if (res.headersSent) return res.end();
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      return sendJson(res, 500, { error: 'Algo deu errado no servidor.' });
    });
  };
}

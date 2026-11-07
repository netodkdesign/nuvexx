import { decryptSecret, encryptSecret } from './auth.js';
import { addDays } from './dates.js';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
// Para entrar no app basta saber quem é a pessoa: a agenda só é pedida se ela conectar depois.
const LOGIN_SCOPE = 'openid email profile';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const CALENDAR = 'primary';
const REQUEST_TIMEOUT_MS = 8000;
const TOKEN_MARGIN_MS = 60_000;

class GoogleAccessLost extends Error {}

export const SYNC = { SYNCED: 'synced', NOT_CONNECTED: 'not_connected', RETRY: 'retry' };

export function eventBody(appointment, timeZone) {
  const base = { summary: appointment.title, description: 'Criado pela assessora de agenda do Nuvexx.' };
  if (!appointment.start_time) {
    return { ...base, start: { date: appointment.starts_on }, end: { date: addDays(appointment.starts_on, 1) } };
  }
  return {
    ...base,
    start: { dateTime: `${appointment.starts_on}T${appointment.start_time}:00`, timeZone },
    end: { dateTime: `${appointment.starts_on}T${appointment.end_time}:00`, timeZone },
  };
}

export function createGoogle({ config, db, fetchImpl = fetch, log = console }) {
  const { google, appUrl, timeZone } = config;
  const redirectUri = `${appUrl}/google/retorno`;
  const accessTokens = new Map();

  const request = (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  async function tokenRequest(params) {
    const response = await request(google.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: google.clientId, client_secret: google.clientSecret, ...params }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  }

  async function accessToken(userId) {
    const cached = accessTokens.get(userId);
    if (cached && cached.expiresAt > Date.now() + TOKEN_MARGIN_MS) return cached.token;

    const account = await db.googleAccount(userId);
    if (!account) throw new GoogleAccessLost();
    const { ok, data } = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: decryptSecret(config, account.refresh_token),
    });
    if (!ok) {
      // A pessoa revogou o acesso, ou o token venceu: a conexão precisa ser refeita.
      if (data.error === 'invalid_grant') {
        await db.deleteGoogleAccount(userId);
        accessTokens.delete(userId);
        throw new GoogleAccessLost();
      }
      throw new Error(`Google recusou a renovação do acesso: ${data.error ?? 'erro desconhecido'}`);
    }
    accessTokens.set(userId, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
    return data.access_token;
  }

  async function calendarRequest(userId, method, path, body) {
    const token = await accessToken(userId);
    return request(`${google.calendarBase}/calendars/${CALENDAR}/events${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function failed(response, action) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google recusou ${action} (${response.status}): ${detail.slice(0, 200)}`);
  }

  // O id fixo evita evento duplicado quando uma tentativa é repetida.
  async function pushEvent(appointment) {
    const { user_id: userId, google_event_id: savedId } = appointment;
    const body = eventBody(appointment, timeZone);
    if (savedId) {
      const updated = await calendarRequest(userId, 'PATCH', `/${savedId}`, body);
      if (updated.ok) return savedId;
      // A pessoa apagou o evento no Google: ao editar aqui, ele volta como evento novo.
      if (updated.status !== 404 && updated.status !== 410) await failed(updated, 'a atualização');
      const recreated = await calendarRequest(userId, 'POST', '', body);
      if (!recreated.ok) await failed(recreated, 'a criação');
      return (await recreated.json()).id;
    }

    const eventId = `nuvexx${appointment.id}`;
    const created = await calendarRequest(userId, 'POST', '', { ...body, id: eventId });
    if (created.ok) return eventId;
    if (created.status !== 409) await failed(created, 'a criação');
    const updated = await calendarRequest(userId, 'PATCH', `/${eventId}`, body);
    if (!updated.ok) await failed(updated, 'a atualização');
    return eventId;
  }

  async function syncAppointment(appointment) {
    if (!(await db.googleAccount(appointment.user_id))) return SYNC.NOT_CONNECTED;
    try {
      await db.markSynced(appointment.id, await pushEvent(appointment));
      return SYNC.SYNCED;
    } catch (err) {
      if (err instanceof GoogleAccessLost) return SYNC.NOT_CONNECTED;
      await db.markSyncFailed(appointment.id);
      log.error(`Google Agenda: compromisso ${appointment.id}: ${err.message}`);
      return SYNC.RETRY;
    }
  }

  async function removeEvent(userId, eventId) {
    if (!eventId || !(await db.googleAccount(userId))) return;
    try {
      const response = await calendarRequest(userId, 'DELETE', `/${eventId}`);
      if (!response.ok && response.status !== 404 && response.status !== 410) await failed(response, 'a exclusão');
    } catch (err) {
      if (err instanceof GoogleAccessLost) return;
      await db.queueGoogleDeletion(userId, eventId);
      log.error(`Google Agenda: exclusão: ${err.message}`);
    }
  }

  return {
    isConfigured: () => Boolean(google.clientId && google.clientSecret),

    authUrl: (state) =>
      `${google.authBase}?${new URLSearchParams({
        client_id: google.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        // Sem isso, o Google só entrega o token de longa duração na primeira autorização.
        prompt: 'consent',
        state,
      })}`,

    loginUrl: (state) =>
      `${google.authBase}?${new URLSearchParams({
        client_id: google.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: LOGIN_SCOPE,
        prompt: 'select_account',
        state,
      })}`,

    // O token vem direto do Google, por conexão cifrada, então basta conferir para quem e quando ele vale.
    async identity(code) {
      const { ok, data } = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      if (!ok || !data.id_token) throw new Error(`Google não confirmou a entrada: ${data.error ?? 'sem identidade'}`);
      const claims = JSON.parse(Buffer.from(String(data.id_token).split('.')[1], 'base64url').toString('utf8'));
      if (!ISSUERS.has(claims.iss) || claims.aud !== google.clientId || claims.exp * 1000 <= Date.now()) {
        throw new Error('Identidade do Google inválida.');
      }
      if (!claims.sub || !claims.email || String(claims.email_verified) !== 'true') {
        throw new Error('O Google não confirmou o e-mail desta conta.');
      }
      return { sub: claims.sub, email: claims.email, name: claims.name ?? '' };
    },

    async connect(userId, code, now = new Date()) {
      const { ok, data } = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      if (!ok || !data.refresh_token) throw new Error(`Google não concluiu a conexão: ${data.error ?? 'sem token de renovação'}`);
      await db.saveGoogleAccount(userId, encryptSecret(config, data.refresh_token));
      accessTokens.set(userId, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
      await db.queueFutureAppointments(userId, now);
    },

    // Os eventos já criados continuam na agenda da pessoa; só o acesso do app é encerrado.
    async disconnect(userId) {
      const account = await db.googleAccount(userId);
      if (!account) return;
      accessTokens.delete(userId);
      await db.deleteGoogleAccount(userId);
      try {
        await request(google.revokeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: decryptSecret(config, account.refresh_token) }),
        });
      } catch (err) {
        log.error(`Google Agenda: revogação: ${err.message}`);
      }
    },

    syncAppointment,
    removeEvent,

    // Fila: o que falhou ou foi criado antes da conexão.
    async processQueue(now = new Date()) {
      for (const appointment of await db.appointmentsToSync(now)) await syncAppointment(appointment);
      for (const deletion of await db.googleDeletions()) {
        try {
          const response = await calendarRequest(deletion.user_id, 'DELETE', `/${deletion.google_event_id}`);
          if (response.ok || response.status === 404 || response.status === 410) await db.finishGoogleDeletion(deletion.id);
          else await db.failGoogleDeletion(deletion.id);
        } catch {
          await db.failGoogleDeletion(deletion.id);
        }
      }
    },
  };
}

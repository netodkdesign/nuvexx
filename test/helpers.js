import { loadConfig } from '../src/config.js';
import { connect } from '../src/database.js';
import { openDb } from '../src/db.js';
import { canonicalPhone } from '../src/phone.js';

export const OWNER = '5547999998888';
export const OTHER = '5511988887777';

// O mesmo PostgreSQL de produção, embutido e em memória. Com TEST_DATABASE_URL, roda em um servidor
// de verdade, passando pelo mesmo driver de produção: use um banco descartável, porque ele é apagado.
export async function createTestDb() {
  const connection = await connect({ databaseUrl: process.env.TEST_DATABASE_URL ?? '', dataDir: undefined });
  const db = await openDb(connection);
  return {
    db,
    reset: () => connection.exec('TRUNCATE users, processed_messages RESTART IDENTITY CASCADE'),
  };
}

export const testConfig = (extra = {}) => loadConfig({
  AMBIENTE: 'desenvolvimento',
  SESSAO_SEGREDO: 'segredo-de-sessao',
  CRIPTO_CHAVE: 'chave-de-teste',
  CADASTRO_ABERTO: 'true',
  APP_URL: 'https://app.test',
  WHATSAPP_VERIFY_TOKEN: 'token-de-verificacao',
  WHATSAPP_APP_SECRET: 'segredo-do-app',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: '123',
  ...extra,
});

export const noGoogle = {
  isConfigured: () => false,
  syncAppointment: async () => 'not_connected',
  removeEvent: async () => {},
  disconnect: async () => {},
  processQueue: async () => {},
};

export const quiet = { warn() {}, error() {}, log() {} };

export function fakeMailer() {
  const sent = [];
  return {
    sent,
    outbox: sent,
    isConfigured: () => true,
    send: async (message) => {
      sent.push(message);
    },
    deliver: (message) => {
      sent.push(message);
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Conta pronta, para os testes que não são sobre o cadastro. Com phone, já vem com o WhatsApp conectado.
export async function createAccount(db, { phone, email, at = new Date() } = {}) {
  const user = await db.createUser({
    name: 'Pessoa de Teste',
    email: email ?? `${phone ?? 'sem-whatsapp'}@teste.com`,
    passwordHash: null,
    termsVersion: '2026-11',
    acceptedAt: at,
    trialEndsAt: new Date(at.getTime() + 7 * DAY_MS),
  });
  return phone ? db.linkWhatsapp(user.id, canonicalPhone(phone), phone, at) : user;
}

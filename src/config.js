import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeEmail } from './text.js';

export const ROOT = resolve(import.meta.dirname, '..');
export const ENV_PATH = resolve(ROOT, '.env');
export const TERMS_VERSION = '2026-11';

// Primeira execução: cria o .env com segredos aleatórios, para o app nunca subir sem eles.
export function ensureEnvFile(path = ENV_PATH) {
  if (existsSync(path)) return false;
  const secrets = {
    SESSAO_SEGREDO: randomBytes(32).toString('hex'),
    CRIPTO_CHAVE: randomBytes(32).toString('hex'),
    WHATSAPP_VERIFY_TOKEN: randomBytes(16).toString('hex'),
  };
  const content = readFileSync(resolve(ROOT, '.env.example'), 'utf8').replace(
    /^(SESSAO_SEGREDO|CRIPTO_CHAVE|WHATSAPP_VERIFY_TOKEN)=.*$/gm,
    (_, key) => `${key}=${secrets[key]}`,
  );
  writeFileSync(path, content, { mode: 0o600 });
  return true;
}

const emailList = (value) => (value || '').split(',').map(normalizeEmail).filter(Boolean);

// O Supabase mostra a conexão com este marcador no lugar da senha.
export const PASSWORD_SLOT = /\[YOUR[-_]PASSWORD\]/i;
const RESEND_SMTP = 'smtp.resend.com:465';

// Símbolos no login, na chave ou na senha quebrariam o endereço sem esta conversão.
export const smtpUrl = (login, key, host = RESEND_SMTP) => `smtps://${encodeURIComponent(login)}:${encodeURIComponent(key)}@${host}`;
export const withDatabasePassword = (url, password) =>
  (password && PASSWORD_SLOT.test(url) ? url.replace(PASSWORD_SLOT, encodeURIComponent(password)) : url);

export function loadConfig(env = process.env) {
  const port = Number(env.PORT) || 3100;
  return {
    port,
    // O padrão é produção: os simuladores de WhatsApp e de e-mail só existem quando pedidos de forma explícita.
    isProduction: env.AMBIENTE !== 'desenvolvimento',
    timeZone: env.APP_TIMEZONE || 'America/Sao_Paulo',
    appUrl: (env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
    clientIpHeader: (env.CABECALHO_IP_CLIENTE || '').toLowerCase(),
    sessionSecret: env.SESSAO_SEGREDO || '',
    encryptionKey: env.CRIPTO_CHAVE || '',
    // No painel da Vercel, a conexão entra como o Supabase mostra, e a senha vai à parte, em DATABASE_SENHA.
    databaseUrl: withDatabasePassword(env.DATABASE_URL || '', env.DATABASE_SENHA),
    // Na Vercel, cada instância abre as próprias conexões: lá o número fica menor, para não esgotar o banco.
    databasePoolSize: Number(env.BANCO_CONEXOES) || 10,
    localDataDir: resolve(ROOT, 'data/pg'),
    // Segredo que a Vercel manda ao chamar a rotina de cada minuto. Sem ele, a rotina não abre por fora.
    cronSecret: env.CRON_SECRET || '',
    registration: {
      open: env.CADASTRO_ABERTO === 'true',
      allowed: emailList(env.EMAILS_LIBERADOS),
    },
    email: {
      // Com o Resend, basta a chave: o endereço do servidor de e-mail é montado aqui.
      smtpUrl: env.SMTP_URL || (env.RESEND_CHAVE ? smtpUrl('resend', env.RESEND_CHAVE) : ''),
      from: env.EMAIL_REMETENTE || '',
    },
    product: {
      trialDays: Number(env.TESTE_GRATIS_DIAS) || 7,
      messageLimitPerDay: Number(env.LIMITE_MENSAGENS_DIA) || 100,
      subscribeUrl: env.ASSINATURA_URL || '',
    },
    company: {
      name: env.EMPRESA_NOME || '',
      cnpj: env.EMPRESA_CNPJ || '',
      email: env.EMPRESA_EMAIL || '',
    },
    whatsapp: {
      verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
      appSecret: env.WHATSAPP_APP_SECRET || '',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      publicNumber: (env.WHATSAPP_NUMERO_PUBLICO || '').replace(/\D/g, ''),
      reminderTemplate: env.WHATSAPP_MODELO_LEMBRETE || '',
      briefingTemplate: env.WHATSAPP_MODELO_RESUMO || '',
      graphVersion: env.WHATSAPP_GRAPH_VERSION || 'v26.0',
      graphBase: env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com',
    },
    transcription: {
      apiKey: env.TRANSCRICAO_CHAVE || '',
      baseUrl: (env.TRANSCRICAO_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
      model: env.TRANSCRICAO_MODELO || 'whisper-large-v3',
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      authBase: env.GOOGLE_AUTH_BASE || 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
      revokeUrl: env.GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke',
      calendarBase: env.GOOGLE_CALENDAR_BASE || 'https://www.googleapis.com/calendar/v3',
    },
  };
}

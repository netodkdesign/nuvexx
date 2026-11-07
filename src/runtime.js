// Monta o app uma vez, a partir da configuração. O servidor comum (src/index.js) e a Vercel (api/index.js)
// usam este mesmo caminho, para os dois se comportarem igual.
import { connect } from './database.js';
import { openDb } from './db.js';
import { createMailer } from './email.js';
import { createGoogle } from './google.js';
import { createScheduler } from './scheduler.js';
import { createHandler } from './server.js';

// O que impede o app de subir, com a orientação de como resolver. Sem nada a resolver, devolve null.
export function startupProblem(config, mailer) {
  if (!config.sessionSecret || !config.encryptionKey) {
    return 'Defina SESSAO_SEGREDO e CRIPTO_CHAVE antes de iniciar: no arquivo .env, ou nos segredos do servidor.';
  }
  if (!config.isProduction) return null;
  if (!config.databaseUrl) return 'Em produção, defina DATABASE_URL com um PostgreSQL gerenciado.';
  if (/\[YOUR[-_]PASSWORD\]/i.test(config.databaseUrl)) return 'A conexão do banco ainda tem [YOUR-PASSWORD]: defina DATABASE_SENHA com a senha do banco.';
  if (/localhost|127\.0\.0\.1/.test(config.appUrl)) return 'Em produção, defina APP_URL com o endereço público: ele vai nos links enviados por e-mail.';
  if (!mailer.isConfigured()) return 'Em produção, defina RESEND_CHAVE (ou SMTP_URL) e EMAIL_REMETENTE: sem e-mail, ninguém consegue criar conta nem recuperar a senha.';
  if (!config.clientIpHeader) {
    return 'Em produção, defina CABECALHO_IP_CLIENTE com o cabeçalho que o provedor usa para o endereço do visitante. Sem ele, o limite de tentativas trata todos como a mesma pessoa.';
  }
  if (config.registration.open && !(config.company.name && config.company.cnpj && config.company.email)) {
    return 'Para abrir o cadastro, preencha EMPRESA_NOME, EMPRESA_CNPJ e EMPRESA_EMAIL: eles aparecem nos termos de uso.';
  }
  return null;
}

export async function createRuntime(config, { log = console, onPool } = {}) {
  const mailer = createMailer({ config });
  const problem = startupProblem(config, mailer);
  if (problem) throw new Error(problem);
  const connection = await connect({ databaseUrl: config.databaseUrl, dataDir: config.localDataDir, poolSize: config.databasePoolSize, onPool, log });
  const db = await openDb(connection);
  const google = createGoogle({ config, db });
  const scheduler = createScheduler({ db, google, config, mailer, log });
  const handler = createHandler({ config, db, google, mailer, log, tick: () => scheduler.tick() });
  return { db, google, mailer, scheduler, handler };
}

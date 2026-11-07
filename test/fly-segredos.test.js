import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import nodemailer from 'nodemailer';
import {
  activateNumber, databaseError, databaseProblem, openTerminal, resendKeyProblem, secretLines, setupBase, setupWhatsApp, smtpUrl,
} from '../scripts/fly-segredos.js';

const SUPABASE = 'postgresql://postgres.abcdefghijklmnopqrst:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
const withPassword = (password) => SUPABASE.replace('[YOUR-PASSWORD]', password);
const databaseOk = async () => null;

function fakeFly(existing = '[]') {
  const calls = [];
  return {
    calls,
    fly: async (args, input) => {
      calls.push({ args, input });
      return args[1] === 'list' ? existing : '';
    },
    imported: () => Object.fromEntries(calls.find((call) => call.args[1] === 'import')?.input.split('\n').map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }) ?? []),
  };
}

const scripted = (answers) => {
  const asked = [];
  return {
    asked,
    ask: async (label, options = {}) => {
      asked.push({ label, ...options });
      return answers.shift();
    },
  };
};

function fakeMeta(refuse) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method, authorization: options.headers.Authorization, body: options.body && JSON.parse(options.body) });
    if (refuse && url.includes(refuse)) {
      return { ok: false, status: 400, json: async () => ({ error: { message: 'PIN incorreto' } }) };
    }
    return { ok: true, json: async () => ({ success: true, display_phone_number: '+55 47 99999-8888', verified_name: 'Nuvexx', name_status: 'AVAILABLE_WITHOUT_REVIEW' }) };
  };
  return { calls, fetchImpl };
}

const whatsapp = { graphBase: 'https://meta.test', graphVersion: 'v26.0' };
const whatsappAnswers = () => ['123', '456', 'token-secreto', 'chave-secreta', '246810', ''];

function fakeConsole({ tty }) {
  const input = new PassThrough();
  if (tty) input.isTTY = true;
  let printed = '';
  const terminal = openTerminal({ input, screen: { write: (text) => { printed += text; } } });
  return { input, terminal, printed: () => printed };
}

for (const tty of [true, false]) {
  test(`o que é secreto não aparece na tela (${tty ? 'terminal' : 'entrada redirecionada'})`, async () => {
    const { input, terminal, printed } = fakeConsole({ tty });
    const visible = terminal.ask('Login');
    input.write('meu-login\n');
    assert.equal(await visible, 'meu-login');

    const hidden = terminal.ask('Chave', { secret: true });
    input.write('chave-muito-secreta\n');
    assert.equal(await hidden, 'chave-muito-secreta');
    terminal.close();

    assert.ok(printed().includes('Login: '));
    assert.ok(printed().includes('Chave: '));
    assert.ok(printed().includes('(recebido, 19 caracteres)'));
    assert.ok(!printed().includes('chave-muito-secreta'));
    if (tty) assert.ok(printed().includes('meu-login'));
  });
}

test('resposta inválida ou vazia é perguntada de novo, e a opcional pode ficar em branco', async () => {
  const { input, terminal, printed } = fakeConsole({ tty: false });
  const pin = terminal.ask('PIN', { secret: true, check: (value) => (/^\d{6}$/.test(value) ? null : 'O PIN tem 6 números.') });
  input.write('\n12\n246810\n');
  assert.equal(await pin, '246810');
  assert.ok(printed().includes('Esse campo é obrigatório.'));
  assert.ok(printed().includes('O PIN tem 6 números.'));

  const optional = terminal.ask('Groq', { secret: true, optional: true });
  input.write('\n');
  assert.equal(await optional, '');
  terminal.close();
});

test('se a digitação for interrompida, avisa que nada foi gravado', async () => {
  const { input, terminal } = fakeConsole({ tty: false });
  const answer = terminal.ask('Chave', { secret: true });
  input.end();
  await assert.rejects(answer, /Nada foi gravado/);
  terminal.close();
});

test('se a entrada acabar antes da primeira pergunta, também avisa que nada foi gravado', async () => {
  const { input, terminal } = fakeConsole({ tty: false });
  input.end();
  await once(input, 'end');
  await assert.rejects(terminal.ask('Chave', { secret: true }), /Nada foi gravado/);
  terminal.close();
});

test('o endereço SMTP do Resend aguenta chaves com símbolos', () => {
  const url = smtpUrl('resend', 're_ab/c+1:2@3');
  const { options } = nodemailer.createTransport(url);
  assert.equal(options.auth.user, 'resend');
  assert.equal(options.auth.pass, 're_ab/c+1:2@3');
  assert.equal(options.host, 'smtp.resend.com');
  assert.equal(Number(options.port), 465);
  assert.equal(options.secure, true);
});

test('a chave do Resend precisa começar com re_', () => {
  assert.equal(resendKeyProblem('re_abc123'), null);
  assert.match(resendKeyProblem('abc123'), /re_/);
});

test('a conexão do Supabase precisa ser a do Session pooler', () => {
  assert.equal(databaseProblem(SUPABASE), null);
  assert.equal(databaseProblem(withPassword('s3nha')), null);
  assert.match(databaseProblem(SUPABASE.replace(':5432/', ':6543/')), /Transaction pooler/);
  assert.match(databaseProblem('postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnopqrst.supabase.co:5432/postgres'), /direta/);
  assert.match(databaseProblem('qualquer coisa'), /postgresql:/);
  assert.match(databaseProblem('postgresql://['), /incompleta/);
});

test('os erros do banco viram uma orientação', () => {
  assert.match(databaseError(Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' })), /senha/);
  assert.match(databaseError(Object.assign(new Error('(ENOTFOUND) tenant/user postgres.abc not found'), { code: 'XX000' })), /não encontrou esse projeto/);
  assert.match(databaseError(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })), /internet/);
  assert.match(databaseError(new Error('algo novo')), /algo novo/);
});

test('a senha entra no lugar do marcador, no formato do endereço, e o banco é conferido antes', async () => {
  const flyFake = fakeFly();
  const checked = [];
  const questions = scripted([SUPABASE, 'p@ss:w/rd#1', 're_chave', 'a@b.com']);
  await setupBase({ ...questions, fly: flyFake.fly, print: () => {}, checkDatabase: async (url) => { checked.push(url); return null; } });
  assert.equal(flyFake.imported().DATABASE_URL, withPassword('p%40ss%3Aw%2Frd%231'));
  assert.deepEqual(checked, [withPassword('p%40ss%3Aw%2Frd%231')]);
  assert.equal(questions.asked[1].label, 'Senha do banco do Supabase');
  assert.equal(questions.asked[1].secret, true);
});

test('se o banco recusar, pergunta de novo e só grava a conexão que funcionou', async () => {
  const flyFake = fakeFly();
  const printed = [];
  const results = ['A senha do banco não confere.', null];
  await setupBase({
    ...scripted([SUPABASE, 'errada', SUPABASE, 'certa', 're_chave', 'a@b.com']),
    fly: flyFake.fly,
    print: (line) => printed.push(line),
    checkDatabase: async () => results.shift(),
  });
  assert.equal(flyFake.imported().DATABASE_URL, withPassword('certa'));
  assert.ok(printed.some((line) => line.includes('A senha do banco não confere.')));
});

test('com a senha já no endereço, não pergunta a senha', async () => {
  const flyFake = fakeFly();
  const questions = scripted([withPassword('s3nha'), 're_chave', 'a@b.com']);
  await setupBase({ ...questions, fly: flyFake.fly, print: () => {}, checkDatabase: databaseOk });
  assert.equal(flyFake.imported().DATABASE_URL, withPassword('s3nha'));
  assert.equal(questions.asked.length, 3);
});

test('campos vazios não viram segredo em branco', () => {
  assert.equal(secretLines({ A: 'um', B: '', C: 'x=y&z' }), 'A=um\nC=x=y&z');
});

test('os segredos gerados nascem uma vez só', async () => {
  const first = fakeFly();
  const questions = scripted([withPassword('s3nha'), 're_chave', 'a@b.com,c@d.com']);
  await setupBase({ ...questions, fly: first.fly, print: () => {}, checkDatabase: databaseOk });
  const secrets = first.imported();
  assert.equal(secrets.DATABASE_URL, withPassword('s3nha'));
  assert.equal(secrets.SMTP_URL, smtpUrl('resend', 're_chave'));
  assert.equal(questions.asked.length, 3);
  assert.equal(questions.asked[1].secret, true);
  assert.equal(questions.asked[1].check, resendKeyProblem);
  assert.equal(secrets.EMAILS_LIBERADOS, 'a@b.com,c@d.com');
  assert.match(secrets.SESSAO_SEGREDO, /^[0-9a-f]{64}$/);
  assert.match(secrets.CRIPTO_CHAVE, /^[0-9a-f]{64}$/);
  assert.notEqual(secrets.SESSAO_SEGREDO, secrets.CRIPTO_CHAVE);

  const again = fakeFly('[{"name":"SESSAO_SEGREDO"},{"name":"CRIPTO_CHAVE"}]');
  await setupBase({ ...scripted([withPassword('s3nha'), 're_chave', 'a@b.com']), fly: again.fly, print: () => {}, checkDatabase: databaseOk });
  assert.equal(again.imported().SESSAO_SEGREDO, undefined);
  assert.equal(again.imported().CRIPTO_CHAVE, undefined);
});

test('se a Fly.io recusar, nada é perguntado', async () => {
  const { ask, asked } = scripted([]);
  await assert.rejects(setupBase({ ask, fly: async () => { throw new Error('sem login'); }, print: () => {} }), /sem login/);
  assert.equal(asked.length, 0);
});

test('ativar o número assina os avisos, registra e consulta, nesta ordem', async () => {
  const meta = fakeMeta();
  const number = await activateNumber({ ...whatsapp, token: 't', wabaId: '456', phoneId: '123', pin: '246810' }, meta.fetchImpl);
  assert.deepEqual(meta.calls.map((call) => `${call.method} ${call.url}`), [
    'POST https://meta.test/v26.0/456/subscribed_apps',
    'POST https://meta.test/v26.0/123/register',
    'GET https://meta.test/v26.0/123?fields=display_phone_number,verified_name,name_status',
  ]);
  assert.ok(meta.calls.every((call) => call.authorization === 'Bearer t'));
  assert.deepEqual(meta.calls[1].body, { messaging_product: 'whatsapp', pin: '246810' });
  assert.equal(number.verified_name, 'Nuvexx');
});

test('o WhatsApp grava as chaves e mostra só o token do webhook', async () => {
  const flyFake = fakeFly();
  const printed = [];
  await setupWhatsApp({
    ...scripted(whatsappAnswers()),
    fly: flyFake.fly,
    whatsapp,
    appUrl: 'https://app.nuvexx.com.br',
    fetchImpl: fakeMeta().fetchImpl,
    print: (line) => printed.push(line),
  });
  const secrets = flyFake.imported();
  assert.equal(secrets.WHATSAPP_ACCESS_TOKEN, 'token-secreto');
  assert.equal(secrets.WHATSAPP_APP_SECRET, 'chave-secreta');
  assert.equal(secrets.WHATSAPP_PHONE_NUMBER_ID, '123');
  assert.equal(secrets.WHATSAPP_NUMERO_PUBLICO, '5547999998888');
  assert.equal(secrets.TRANSCRICAO_CHAVE, undefined);

  const screen = printed.join('\n');
  assert.ok(screen.includes('https://app.nuvexx.com.br/webhook'));
  assert.ok(screen.includes(secrets.WHATSAPP_VERIFY_TOKEN));
  for (const hidden of ['token-secreto', 'chave-secreta', '246810']) assert.ok(!screen.includes(hidden));
});

test('com a chave da Groq, o áudio também é gravado', async () => {
  const flyFake = fakeFly();
  const answers = whatsappAnswers();
  answers[5] = 'chave-groq';
  await setupWhatsApp({ ...scripted(answers), fly: flyFake.fly, whatsapp, appUrl: 'https://x', fetchImpl: fakeMeta().fetchImpl, print: () => {} });
  assert.equal(flyFake.imported().TRANSCRICAO_CHAVE, 'chave-groq');
});

test('se a Meta recusar o registro, nenhuma chave é gravada', async () => {
  const flyFake = fakeFly();
  await assert.rejects(
    setupWhatsApp({ ...scripted(whatsappAnswers()), fly: flyFake.fly, whatsapp, appUrl: 'https://x', fetchImpl: fakeMeta('/register').fetchImpl, print: () => {} }),
    /A Meta recusou o registro do número: PIN incorreto/,
  );
  assert.equal(flyFake.calls.some((call) => call.args[1] === 'import'), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWaitlist } from '../waitlist.js';

const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..');

const quiet = { error() {} };
const NUMBER = '(47) 99123-4567';
const numbered = (i) => `(47) 99100-${1000 + i}`;

async function listen(t, options) {
  const server = await createWaitlist({ log: quiet, ...options });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const stop = () =>
    new Promise((done) => {
      server.close(done);
      server.closeAllConnections();
    });
  t.after(stop);
  return { url: `http://127.0.0.1:${server.address().port}`, port: server.address().port, stop };
}

async function start(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'fila-de-espera-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const app = await listen(t, { dataDir, ...options });

  const signUp = (body, headers = {}) =>
    fetch(`${app.url}/inscrever`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const rows = async () => {
    const content = await readFile(join(dataDir, 'inscritos.csv'), 'utf8').catch((err) => {
      if (err.code === 'ENOENT') return '';
      throw err;
    });
    return content.split('\r\n').slice(1).filter(Boolean);
  };
  return { ...app, dataDir, signUp, rows };
}

test('a página abre com os cabeçalhos de segurança', async (t) => {
  const { url } = await start(t);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /fila de espera/i);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('todos os arquivos que a página usa existem', async (t) => {
  const { url } = await start(t);
  const html = await (await fetch(url)).text();
  const script = await (await fetch(`${url}/pagina.js`)).text();
  const styles = await (await fetch(`${url}/pagina.css`)).text();
  const paths = new Set([
    ...[...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((match) => match[1]),
    ...[...styles.matchAll(/url\("(\/[^"]*)"\)/g)].map((match) => match[1]),
  ]);
  assert.ok(paths.size >= 6, 'a página deveria citar seus arquivos');
  assert.ok([...paths].filter((path) => path.endsWith('.woff2')).length === 4, 'os quatro pesos da fonte');
  for (const name of script.matchAll(/quem: '(\w+)'/g)) paths.add(`/assessores/${name[1]}.svg`);
  for (const path of paths) {
    assert.equal((await fetch(url + path)).status, 200, path);
  }
});

test('a página não usa o que o bloqueio de segurança impediria', async (t) => {
  const { url } = await start(t);
  const html = await (await fetch(url)).text();
  assert.doesNotMatch(html, /\sstyle="/, 'atributo style é bloqueado pela política de segurança');
  assert.doesNotMatch(html, /<style|<script(?![^>]*\bsrc=)/, 'estilo e script precisam ficar em arquivos');
  assert.doesNotMatch(html, /(?:src|href)="https?:/, 'a página não carrega nada de fora');
  const styles = await (await fetch(`${url}/pagina.css`)).text();
  assert.doesNotMatch(styles, /url\("?https?:/, 'a fonte também fica na pasta');
});

test('a página não promete o que a Nuvexx não faz nem usa outra marca', async (t) => {
  const { url } = await start(t);
  const html = await (await fetch(url)).text();
  const script = await (await fetch(`${url}/pagina.js`)).text();
  const text = `${html}\n${script}`;
  for (const forbidden of [/meu ?assessor/i, /open finance/i, /nota fiscal/i, /homologad/i, /banco central/i, /embaixador/i]) {
    assert.doesNotMatch(text, forbidden);
  }
});

test('o formulário pede WhatsApp no lugar do e-mail e traz o aceite que a Meta exige', async (t) => {
  const { url } = await start(t);
  const html = await (await fetch(url)).text();
  assert.match(html, /<input id="whatsapp" name="whatsapp" type="tel"/);
  assert.doesNotMatch(html, /type="email"|name="email"/);
  assert.match(html, /aceita receber mensagens do Nuvexx no WhatsApp/);
  assert.match(html, /Para parar, é só avisar/);
  assert.doesNotMatch(html, /avisamos por e-mail|aviso por e-mail/i);

  const policy = await (await fetch(`${url}/privacidade`)).text();
  assert.match(policy, /número de WhatsApp/);
  assert.match(policy, /Meta/);
  assert.doesNotMatch(policy, /seu e-mail|envio de e-mail/);
});

test('depois da inscrição vem a página de obrigado, sem nenhum envio automático', async (t) => {
  const { url } = await start(t);
  const response = await fetch(`${url}/obrigado`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);

  const thanks = await response.text();
  assert.match(thanks, /<h1>Obrigado!<\/h1>/);
  assert.match(thanks, /avisamos pelo WhatsApp/);
  assert.match(thanks, /name="robots" content="noindex"/);
  assert.doesNotMatch(thanks, /e-mail|<form|\sstyle="/i);
  assert.doesNotMatch(thanks, /href="\/"|voltar/i, 'a página de obrigado não leva de volta à inicial');
  for (const match of thanks.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
    assert.equal((await fetch(url + match[1])).status, 200, match[1]);
  }

  assert.match(await (await fetch(`${url}/pagina.js`)).text(), /location\.assign\('\/obrigado'\)/);
  assert.doesNotMatch(await (await fetch(url)).text(), /id="pronto"/);
  for (const file of ['waitlist.js', 'public/inscrever.php']) {
    assert.doesNotMatch(await readFile(join(FOLDER, file), 'utf8'), /nodemailer|\bmail\(|smtp/i, file);
  }
});

test('a inscrição entra em um CSV pronto para o Excel', async (t) => {
  const { signUp, dataDir, rows } = await start(t);
  const response = await signUp({ nome: '  José   da Silva ', whatsapp: ' +55 (47) 99123-4567 ' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  const content = await readFile(join(dataDir, 'inscritos.csv'), 'utf8');
  assert.ok(content.startsWith('﻿data_hora;nome;whatsapp\r\n'));

  const [row] = await rows();
  assert.match(row, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2};José da Silva;\(47\) 99123-4567$/);
});

test('o número entra do jeito que a pessoa escrever e é guardado sempre igual', async (t) => {
  for (const [typed, stored] of [
    ['47991234567', NUMBER],
    ['(47) 99123-4567', NUMBER],
    ['47 99123 4567', NUMBER],
    ['+55 47 99123-4567', NUMBER],
    ['5547991234567', NUMBER],
    ['047991234567', NUMBER],
    ['47 9123-4567', NUMBER],
    ['554791234567', NUMBER],
    ['55991234567', '(55) 99123-4567'],
    ['(47) 3333-4444', '(47) 3333-4444'],
  ]) {
    const { signUp, rows } = await start(t);
    assert.equal((await signUp({ nome: 'Ana', whatsapp: typed })).status, 200, typed);
    assert.ok((await rows())[0].endsWith(`;${stored}`), `${typed}: ${(await rows())[0]}`);
  }
});

test('número repetido não entra de novo, mesmo escrito de outro jeito, e recebe a mesma resposta', async (t) => {
  const { signUp, rows } = await start(t);
  const first = await signUp({ nome: 'Ana', whatsapp: NUMBER });
  const second = await signUp({ nome: 'Outra Ana', whatsapp: '+55 47 99123-4567' });
  const withoutNine = await signUp({ nome: 'Mais uma Ana', whatsapp: '47 9123-4567' });
  assert.equal(second.status, first.status);
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(withoutNine.status, 200);
  assert.equal((await rows()).length, 1);
});

test('a lista continua valendo depois de religar a página', async (t) => {
  const { signUp, dataDir, rows, stop } = await start(t);
  await signUp({ nome: 'Ana; "Aninha"', whatsapp: NUMBER });
  await stop();

  const again = await listen(t, { dataDir });
  const response = await fetch(`${again.url}/inscrever`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Ana', whatsapp: NUMBER }),
  });
  assert.equal(response.status, 200);
  assert.equal((await rows()).length, 1);
});

test('dados inválidos não são guardados e apontam o campo', async (t) => {
  const { signUp, rows } = await start(t);
  const cases = [
    [{ nome: '', whatsapp: NUMBER }, 'nome'],
    [{ nome: 'A', whatsapp: NUMBER }, 'nome'],
    [{ nome: 'x'.repeat(81), whatsapp: NUMBER }, 'nome'],
    [{ nome: { a: 1 }, whatsapp: NUMBER }, 'nome'],
    [{ nome: 'Ana', whatsapp: '' }, 'whatsapp'],
    [{ nome: 'Ana' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: 'abc' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '123' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '99123-4567' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '(00) 99123-4567' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '(20) 99123-4567' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '(47) 89123-4567' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '(11) 99999-9999' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '+1 415 555 2671' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: '554799123456789' }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: ['47991234567'] }, 'whatsapp'],
    [{ nome: 'Ana', whatsapp: 47991234567 }, 'whatsapp'],
    [{ nome: 'Ana', email: 'ana@exemplo.com' }, 'whatsapp'],
  ];
  for (const [body, field] of cases) {
    const response = await signUp(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).campo, field, JSON.stringify(body));
  }
  assert.equal((await rows()).length, 0);
});

test('o nome não vira fórmula nem quebra as colunas da planilha', async (t) => {
  const { signUp, rows } = await start(t);
  await signUp({ nome: '=HYPERLINK("http://x")', whatsapp: numbered(1) });
  await signUp({ nome: 'Ana; "Aninha"', whatsapp: numbered(2) });
  await signUp({ nome: 'Linha\r\nquebrada\ttab', whatsapp: numbered(3) });

  const [formula, quoted, broken] = await rows();
  assert.ok(formula.endsWith(`;"'=HYPERLINK(""http://x"")";${numbered(1)}`), formula);
  assert.ok(quoted.endsWith(`;"Ana; ""Aninha""";${numbered(2)}`), quoted);
  assert.ok(broken.endsWith(`;Linha quebrada tab;${numbered(3)}`), broken);
});

test('o campo invisível preenchido responde igual e não guarda nada', async (t) => {
  const { signUp, rows } = await start(t);
  const response = await signUp({ nome: 'Robô', whatsapp: NUMBER, site: 'http://spam' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal((await rows()).length, 0);
});

test('pedidos malformados são recusados', async (t) => {
  const { url, rows } = await start(t);
  const post = (body, type = 'application/json') =>
    fetch(`${url}/inscrever`, { method: 'POST', headers: { 'Content-Type': type }, body });

  assert.equal((await post('nome=Ana', 'application/x-www-form-urlencoded')).status, 415);
  assert.equal((await post('{nada')).status, 400);
  assert.equal((await post('null')).status, 400);
  assert.equal((await post('[]')).status, 400);
  assert.equal((await post(JSON.stringify({ nome: 'x'.repeat(5000), whatsapp: NUMBER }))).status, 413);
  assert.equal((await rows()).length, 0);
});

test('o limite padrão aguenta muita gente atrás do mesmo endereço', async (t) => {
  const { signUp } = await start(t);
  for (let i = 0; i < 100; i += 1) {
    assert.equal((await signUp({ nome: 'Pessoa', whatsapp: numbered(i) })).status, 200);
  }
  assert.equal((await signUp({ nome: 'Pessoa', whatsapp: numbered(100) })).status, 429);
});

test('inscrições ao mesmo tempo não se misturam nem duplicam', async (t) => {
  const { signUp, rows } = await start(t, { rateLimit: { max: 1000, windowMs: 60_000 } });
  const numbers = Array.from({ length: 25 }, (_, i) => numbered(i));
  const responses = await Promise.all(
    [...numbers, ...numbers].map((whatsapp) => signUp({ nome: 'Pessoa', whatsapp })),
  );
  assert.ok(responses.every((response) => response.status === 200));

  const saved = (await rows()).map((row) => row.split(';').at(-1));
  assert.equal(saved.length, numbers.length);
  assert.deepEqual([...saved].sort(), [...numbers].sort());
});

test('se a gravação falhar, a pessoa vê o erro e consegue tentar de novo', async (t) => {
  const { signUp, dataDir, rows } = await start(t);
  const blocked = join(dataDir, 'inscritos.csv');
  await mkdir(blocked);

  const failed = await signUp({ nome: 'Ana', whatsapp: NUMBER });
  assert.equal(failed.status, 500);
  assert.match((await failed.json()).erro, /Tente de novo/);

  await rm(blocked, { recursive: true });
  assert.equal((await signUp({ nome: 'Ana', whatsapp: NUMBER })).status, 200);
  assert.equal((await rows()).length, 1);
});

test('o limite de tentativas vale por endereço e não é burlado por cabeçalho falso', async (t) => {
  const { signUp } = await start(t, { rateLimit: { max: 2, windowMs: 60_000 } });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await signUp({ nome: 'Ana', whatsapp: numbered(i) }, { 'fly-client-ip': `10.0.0.${i}` });
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('com o provedor configurado, o limite usa o endereço informado por ele', async (t) => {
  const { signUp } = await start(t, { clientIpHeader: 'fly-client-ip', rateLimit: { max: 1, windowMs: 60_000 } });
  const send = (ip, i) => signUp({ nome: 'Ana', whatsapp: numbered(i) }, { 'fly-client-ip': ip });
  assert.equal((await send('10.0.0.1', 1)).status, 200);
  assert.equal((await send('10.0.0.1', 2)).status, 429);
  assert.equal((await send('10.0.0.2', 3)).status, 200);
});

test('a lista de inscritos não pode ser baixada pelo site', async (t) => {
  const { signUp, port } = await start(t);
  await signUp({ nome: 'Ana', whatsapp: NUMBER });

  // Caminho cru, sem a limpeza que o fetch faria nos "..".
  const rawGet = (path) =>
    new Promise((done, fail) => {
      request({ host: '127.0.0.1', port, path }, (response) => {
        response.resume();
        response.on('end', () => done(response.statusCode));
      }).on('error', fail).end();
    });
  for (const path of [
    '/dados/inscritos.csv',
    '/inscritos.csv',
    '/../dados/inscritos.csv',
    '/%2e%2e/dados/inscritos.csv',
    '/public/../dados/inscritos.csv',
    '/..%5cdados%5cinscritos.csv',
    '/server.js',
    '/.env',
  ]) {
    assert.equal(await rawGet(path), 404, path);
  }
});

test('o áudio aparece como recurso do WhatsApp, sem prometer foto nem conversa do site', async (t) => {
  const { url } = await start(t);
  const html = await (await fetch(url)).text();
  assert.match(html, /Sim, pelo WhatsApp conectado/);
  assert.match(html, /Na conversa do site, por enquanto, só dá para escrever/);
  assert.match(html, /foto e vídeo ainda não são entendidos/);
  assert.doesNotMatch(html, /áudios? (pelo|no) site/i);
});

test('o endereço de saúde responde, e avisa quando não dá para gravar', async (t) => {
  const { url, dataDir } = await start(t);
  const healthy = await fetch(`${url}/health`);
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { ok: true });

  await rm(dataDir, { recursive: true });
  assert.equal((await fetch(`${url}/health`)).status, 503);
});

test('sem poder gravar na pasta dos dados, a página nem liga', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'fila-de-espera-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const notAFolder = join(dir, 'arquivo');
  await writeFile(notAFolder, 'x');
  await assert.rejects(createWaitlist({ dataDir: join(notAFolder, 'dados'), log: quiet }), /Sem permissão para gravar/);
});

function runServer(cwd, env) {
  const child = spawn(process.execPath, ['server.js'], { cwd, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((done) => child.on('exit', (code) => done(code)));
  return { child, exited, output: () => output };
}

function freePort() {
  return new Promise((done, fail) => {
    const probe = createNetServer();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

const PRODUCTION = {
  AMBIENTE: 'producao',
  CABECALHO_IP_CLIENTE: 'fly-client-ip',
  PASTA_DADOS: '',
  EMPRESA_NOME: 'Empresa de Teste',
  EMPRESA_CNPJ: '00.000.000/0001-00',
  EMPRESA_EMAIL: 'contato@exemplo.com',
};

test('em produção, a página se recusa a abrir sem disco ou sem os dados da empresa', async () => {
  const noDisk = runServer(FOLDER, { ...PRODUCTION, PORT: String(await freePort()) });
  assert.equal(await noDisk.exited, 1);
  assert.match(noDisk.output(), /Faltam estas variáveis.*PASTA_DADOS/);

  const noCompany = runServer(FOLDER, { ...PRODUCTION, PASTA_DADOS: tmpdir(), EMPRESA_CNPJ: '', PORT: String(await freePort()) });
  assert.equal(await noCompany.exited, 1);
  assert.match(noCompany.output(), /Faltam estas variáveis.*EMPRESA_CNPJ/);
});

test('roda em produção só com o que o Dockerfile copia, e grava a lista no disco indicado', async (t) => {
  const dockerfile = await readFile(join(FOLDER, 'Dockerfile'), 'utf8');
  const copied = [...dockerfile.matchAll(/^COPY (.+) \S+$/gm)].flatMap((match) => match[1].split(' '));
  assert.ok(copied.includes('public') && copied.includes('server.js'));

  const root = await mkdtemp(join(tmpdir(), 'fila-de-espera-imagem-'));
  const image = join(root, 'app');
  const disk = join(root, 'disco');
  await mkdir(image);
  for (const item of copied) await cp(join(FOLDER, item), join(image, item), { recursive: true });

  const port = await freePort();
  const app = runServer(image, { ...PRODUCTION, PASTA_DADOS: disk, PORT: String(port) });
  // Primeiro desliga: no Windows, a pasta de um processo ligado não pode ser apagada.
  t.after(async () => {
    app.child.kill();
    await app.exited;
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const url = `http://127.0.0.1:${port}`;
  for (let tries = 0; tries < 50; tries += 1) {
    if (await fetch(`${url}/health`).then((res) => res.ok, () => false)) break;
    await new Promise((done) => setTimeout(done, 100));
  }

  assert.equal((await fetch(`${url}/health`)).status, 200, app.output());
  const html = await (await fetch(url)).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((match) => match[1]);
  for (const path of [...assets, '/fontes/poppins-300.woff2', '/assessores/nina.svg']) {
    assert.equal((await fetch(url + path)).status, 200, path);
  }
  assert.match(await (await fetch(`${url}/privacidade`)).text(), /Empresa de Teste/);

  const saved = await fetch(`${url}/inscrever`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Ana', whatsapp: NUMBER }),
  });
  assert.equal(saved.status, 200);
  assert.match(await readFile(join(disk, 'inscritos.csv'), 'utf8'), /;Ana;\(47\) 99123-4567/);
  assert.deepEqual(await readdir(image).then((files) => files.filter((file) => file === 'dados')), []);
});

test('a configuração de publicação é da fila, não do app, e não leva dados nem segredos', async () => {
  const ownToml = await readFile(join(FOLDER, 'fly.toml'), 'utf8');
  const appToml = await readFile(join(FOLDER, '..', 'fly.toml'), 'utf8');
  const appName = (toml) => toml.match(/^app = "(.+)"$/m)[1];
  assert.notEqual(appName(ownToml), appName(appToml));

  const destination = ownToml.match(/^\s*destination = "(.+)"$/m)[1];
  assert.equal(ownToml.match(/^\s*PASTA_DADOS = "(.+)"$/m)[1], destination);
  assert.equal(ownToml.match(/^\s*internal_port = (\d+)$/m)[1], ownToml.match(/^\s*PORT = "(\d+)"$/m)[1]);

  const ignored = (await readFile(join(FOLDER, '.dockerignore'), 'utf8')).split(/\r?\n/);
  for (const entry of ['.env', 'dados', '*.csv']) assert.ok(ignored.includes(entry), entry);
});

test('a pasta não depende de nada do app', async () => {
  for (const file of ['server.js', 'waitlist.js', 'public/pagina.js']) {
    const source = await readFile(join(FOLDER, file), 'utf8');
    const outside = [...source.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter((path) => !path.startsWith('node:') && !path.startsWith('./'));
    assert.deepEqual(outside, [], file);
  }
  const manifest = JSON.parse(await readFile(join(FOLDER, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies, undefined);
});

test('a política mostra os dados da empresa e escapa o que vem de fora', async (t) => {
  const { url } = await start(t, { company: { name: 'Empresa <b>Teste</b>', cnpj: '00.000.000/0001-00' } });
  const html = await (await fetch(`${url}/privacidade`)).text();
  assert.match(html, /Empresa &lt;b&gt;Teste&lt;\/b&gt;/);
  assert.match(html, /00\.000\.000\/0001-00/);
  assert.match(html, /\[a preencher\]/);
  assert.doesNotMatch(html, /\{\{/);
});

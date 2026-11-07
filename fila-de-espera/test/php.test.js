// A recepção em PHP precisa se comportar como a do waitlist.js. Estes testes usam o PHP indicado em
// FILA_PHP e são pulados sem ele: rodar sem PHP não confere nada da versão publicada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHP = process.env.FILA_PHP ?? '';
const needsPhp = { skip: PHP ? false : 'defina FILA_PHP com o caminho do php' };

const NUMBER = '(47) 99123-4567';
const numbered = (i) => `(47) 99100-${1000 + i}`;

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

function phpString(text) {
  return `'${String(text).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

async function writeConfig(path, values) {
  const lines = Object.entries(values).map(([key, value]) => `  ${phpString(key)} => ${typeof value === 'number' ? value : phpString(value)},`);
  await writeFile(path, `<?php\nreturn [\n${lines.join('\n')}\n];\n`);
}

async function runPhp(t, configPath) {
  const port = await freePort();
  const child = spawn(PHP, ['-S', `127.0.0.1:${port}`, '-t', join(FOLDER, 'public'), join(FOLDER, 'test', 'roteador-php.php')], {
    env: { ...process.env, FILA_CONFIG: configPath },
    stdio: 'ignore',
  });
  const exited = new Promise((done) => child.on('exit', done));
  const url = `http://127.0.0.1:${port}`;
  t.after(async () => {
    child.kill();
    await exited;
  });
  for (let tries = 0; tries < 50; tries += 1) {
    if (await fetch(`${url}/privacidade`).then((res) => res.ok, () => false)) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  return url;
}

async function start(t, config = {}) {
  const root = await mkdtemp(join(tmpdir(), 'fila-de-espera-php-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const dataDir = join(root, 'fila-dados');
  const configPath = join(root, 'fila-config.php');
  await writeConfig(configPath, {
    empresa_nome: 'Empresa de Teste',
    empresa_cnpj: '00.000.000/0001-00',
    empresa_email: 'contato@nuvexx.com.br',
    pasta_dados: dataDir,
    ...config,
  });
  const url = await runPhp(t, configPath);

  const signUp = (body, headers = {}) =>
    fetch(`${url}/inscrever`, {
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
  return { url, root, dataDir, configPath, signUp, rows };
}

test('PHP: a inscrição entra em um CSV pronto para o Excel, e a resposta é a mesma da página', needsPhp, async (t) => {
  const { signUp, dataDir, rows } = await start(t);
  const response = await signUp({ nome: '  José   da Silva ', whatsapp: ' +55 (47) 99123-4567 ' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const content = await readFile(join(dataDir, 'inscritos.csv'), 'utf8');
  assert.ok(content.startsWith('﻿data_hora;nome;whatsapp\r\n'));
  const [row] = await rows();
  assert.match(row, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2};José da Silva;\(47\) 99123-4567$/);
});

test('PHP: o número é entendido e guardado igual à versão em Node', needsPhp, async (t) => {
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

test('PHP: número repetido não entra de novo e recebe a mesma resposta', needsPhp, async (t) => {
  const { signUp, rows } = await start(t);
  const first = await signUp({ nome: 'Ana', whatsapp: NUMBER });
  const second = await signUp({ nome: 'Outra Ana', whatsapp: '+55 47 99123-4567' });
  const withoutNine = await signUp({ nome: 'Mais uma Ana', whatsapp: '47 9123-4567' });
  assert.equal(second.status, first.status);
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(withoutNine.status, 200);
  assert.equal((await rows()).length, 1);
});

test('PHP: dados inválidos não são guardados e apontam o campo', needsPhp, async (t) => {
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
  ];
  for (const [body, field] of cases) {
    const response = await signUp(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).campo, field, JSON.stringify(body));
  }
  assert.equal((await rows()).length, 0);
});

test('PHP: o nome não vira fórmula nem quebra as colunas da planilha', needsPhp, async (t) => {
  const { signUp, rows } = await start(t);
  await signUp({ nome: '=HYPERLINK("http://x")', whatsapp: numbered(1) });
  await signUp({ nome: 'Ana; "Aninha"', whatsapp: numbered(2) });
  await signUp({ nome: 'Linha\r\nquebrada\ttab', whatsapp: numbered(3) });

  const [formula, quoted, broken] = await rows();
  assert.ok(formula.endsWith(`;"'=HYPERLINK(""http://x"")";${numbered(1)}`), formula);
  assert.ok(quoted.endsWith(`;"Ana; ""Aninha""";${numbered(2)}`), quoted);
  assert.ok(broken.endsWith(`;Linha quebrada tab;${numbered(3)}`), broken);
});

test('PHP: o campo invisível preenchido responde igual e não guarda nada', needsPhp, async (t) => {
  const { signUp, rows } = await start(t);
  const response = await signUp({ nome: 'Robô', whatsapp: NUMBER, site: 'http://spam' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal((await rows()).length, 0);
});

test('PHP: pedidos malformados são recusados', needsPhp, async (t) => {
  const { url, rows } = await start(t);
  const post = (body, type = 'application/json') =>
    fetch(`${url}/inscrever`, { method: 'POST', headers: { 'Content-Type': type }, body });

  assert.equal((await post('nome=Ana', 'application/x-www-form-urlencoded')).status, 415);
  assert.equal((await post('{nada')).status, 400);
  assert.equal((await post('null')).status, 400);
  assert.equal((await post('[]')).status, 400);
  assert.equal((await post(JSON.stringify({ nome: 'x'.repeat(5000), whatsapp: NUMBER }))).status, 413);
  assert.equal((await fetch(`${url}/inscrever`)).status, 404);
  assert.equal((await rows()).length, 0);
});

test('PHP: o limite de tentativas vale por endereço e não é burlado por cabeçalho falso', needsPhp, async (t) => {
  const { signUp, dataDir } = await start(t, { limite_por_hora: 2 });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const response = await signUp(
      { nome: 'Ana', whatsapp: numbered(i) },
      { 'X-Forwarded-For': `10.0.0.${i}`, 'Fly-Client-IP': `10.0.0.${i}` },
    );
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [200, 200, 429]);
  // O endereço de quem acessou nunca fica escrito no arquivo de controle.
  assert.doesNotMatch(await readFile(join(dataDir, 'limites.json'), 'utf8'), /127\.0\.0\.1/);
});

test('PHP: duas cópias gravando ao mesmo tempo não misturam linhas nem duplicam', needsPhp, async (t) => {
  const first = await start(t);
  const second = await runPhp(t, first.configPath);
  const numbers = Array.from({ length: 25 }, (_, i) => numbered(i));
  const send = (url, whatsapp) =>
    fetch(`${url}/inscrever`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Pessoa', whatsapp }),
    });
  const responses = await Promise.all(numbers.flatMap((number) => [send(first.url, number), send(second, number)]));
  assert.ok(responses.every((response) => response.status === 200));

  const saved = (await first.rows()).map((row) => row.split(';').at(-1));
  assert.deepEqual([...saved].sort(), [...numbers].sort());
});

test('PHP: se a gravação falhar, a pessoa vê o erro e consegue tentar de novo', needsPhp, async (t) => {
  const { signUp, dataDir, rows } = await start(t);
  await mkdir(join(dataDir, 'inscritos.csv'), { recursive: true });

  const failed = await signUp({ nome: 'Ana', whatsapp: NUMBER });
  assert.equal(failed.status, 500);
  assert.match((await failed.json()).erro, /Tente de novo/);

  await rm(join(dataDir, 'inscritos.csv'), { recursive: true });
  assert.equal((await signUp({ nome: 'Ana', whatsapp: NUMBER })).status, 200);
  assert.equal((await rows()).length, 1);
});

test('PHP: sem os dados da empresa, ou com a lista na área pública, não recebe inscrições', needsPhp, async (t) => {
  const noCompany = await start(t, { empresa_cnpj: '' });
  assert.equal((await noCompany.signUp({ nome: 'Ana', whatsapp: NUMBER })).status, 500);
  assert.equal((await noCompany.rows()).length, 0);

  const exposed = await start(t, { pasta_dados: join(FOLDER, 'public') });
  assert.equal((await exposed.signUp({ nome: 'Ana', whatsapp: NUMBER })).status, 500);
  await assert.rejects(readFile(join(FOLDER, 'public', 'inscritos.csv')), { code: 'ENOENT' });
});

test('PHP: sem indicar a pasta, a lista vai para fora da área pública', needsPhp, async (t) => {
  const loader = await readFile(join(FOLDER, 'public', 'fila-config-carregar.php'), 'utf8');
  assert.match(loader, /\$achada\['pasta_dados'\] = dirname\(__DIR__\)/);
  const { signUp, rows } = await start(t);
  assert.equal((await signUp({ nome: 'Ana', whatsapp: NUMBER })).status, 200);
  assert.equal((await rows()).length, 1);
});

test('PHP: a política mostra os dados da empresa, escapa o que vem de fora e esconde o modelo', needsPhp, async (t) => {
  const { url } = await start(t, { empresa_nome: 'Empresa <b>Teste</b>', empresa_cnpj: '' });
  const html = await (await fetch(`${url}/privacidade`)).text();
  assert.match(html, /Empresa &lt;b&gt;Teste&lt;\/b&gt;/);
  assert.match(html, /\[a preencher\]/);
  assert.match(html, /contato@nuvexx\.com\.br/);
  assert.doesNotMatch(html, /\{\{/);
  assert.equal((await fetch(`${url}/privacidade.html`)).status, 404);
});

test('PHP: a página funciona servida como arquivos, com o que o formulário precisa', needsPhp, async (t) => {
  const { url } = await start(t);
  const html = await (await fetch(url)).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((match) => match[1]);
  for (const path of assets) assert.equal((await fetch(url + path)).status, 200, path);
  assert.equal((await fetch(`${url}/inscritos.csv`)).status, 404);
  assert.match(await (await fetch(`${url}/obrigado`)).text(), /Obrigado!/);
});

// Os testes abaixo só leem os arquivos: valem também sem o PHP. O .htaccess em si só roda na hospedagem.
test('o .htaccess traz as mesmas proteções da versão em Node e os endereços da página', async () => {
  const htaccess = await readFile(join(FOLDER, 'public', '.htaccess'), 'utf8');
  const node = await readFile(join(FOLDER, 'waitlist.js'), 'utf8');
  const policy = node.match(/"(default-src [^"]+)"/)[1];
  assert.ok(htaccess.includes(`Content-Security-Policy "${policy}"`));
  for (const rule of ['X-Content-Type-Options "nosniff"', 'Referrer-Policy "no-referrer"', 'X-Frame-Options "DENY"']) {
    assert.ok(htaccess.includes(rule), rule);
  }
  assert.match(htaccess, /^RewriteRule \^inscrever\$ inscrever\.php \[L\]$/m);
  assert.match(htaccess, /^RewriteRule \^privacidade\$ privacidade\.php \[L\]$/m);
  assert.match(htaccess, /^RewriteRule \^obrigado\$ obrigado\.html \[L\]$/m);
  assert.match(htaccess, /^RewriteRule \^privacidade\\\.html\$ - \[R=404,L\]$/m);
  assert.match(htaccess, /^Options -Indexes$/m);
  // Um envio por engano já deixou a lista exposta na hospedagem: estas regras precisam continuar aqui.
  for (const name of ['dados', 'fila-dados', 'csv', 'md', 'toml', 'server\\.js', 'waitlist\\.js', 'package\\.json', 'Dockerfile', 'fila-config']) {
    assert.ok(htaccess.includes(name), name);
  }
  assert.doesNotMatch(htaccess, /well-known/, 'o certificado depende desse caminho, que precisa continuar aberto');
  assert.match(htaccess, /https:\/\/nuvexx\.com\.br/);
});

test('a configuração junto da página não aponta a lista para a área pública nem traz segredo', async () => {
  const config = await readFile(join(FOLDER, 'public', 'fila-config.php'), 'utf8');
  assert.doesNotMatch(config, /'pasta_dados'/, 'sem indicar, a lista vai para fora da área pública');
  assert.match(config, /'empresa_email' => 'contato@nuvexx\.com\.br'/);
  assert.match(config, /'empresa_nome' =>/);
  assert.match(config, /'empresa_cnpj' =>/);
  assert.doesNotMatch(config, /senha|token|chave|password/i);

  const loader = await readFile(join(FOLDER, 'public', 'fila-config-carregar.php'), 'utf8');
  assert.match(loader, /dirname\(__DIR__\) \. '\/fila-dados'/);
});

test('o site não entrega a configuração nem o arquivo que a carrega', async () => {
  const htaccess = await readFile(join(FOLDER, 'public', '.htaccess'), 'utf8');
  const rule = htaccess.match(/^RewriteRule \(\^\|\/\)\(fila-config.*$/m)?.[0];
  assert.ok(rule, 'a regra que bloqueia os arquivos de configuração');
  const pattern = new RegExp(rule.split(' ')[1]);
  assert.ok(pattern.test('fila-config.php'));
  assert.ok(pattern.test('fila-config-carregar.php'));
});

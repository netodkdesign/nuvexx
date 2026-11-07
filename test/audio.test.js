import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { createApp } from '../src/server.js';
import { fromSpeech } from '../src/speech.js';
import { parseAgenda } from '../src/agenda-parser.js';
import { parseMessage } from '../src/parser.js';
import { MAX_AUDIO_BYTES, transcribe, UnsupportedAudioError } from '../src/transcription.js';
import { downloadMedia, extractMessages, MediaTooLargeError } from '../src/whatsapp.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OTHER, OWNER, quiet, testConfig } from './helpers.js';

const APP_SECRET = 'segredo-do-app';
const META_TOKEN = 'token-da-meta';
const GROQ_KEY = 'chave-da-groq';
const TODAY = '2026-11-03';
const VOICE = 'audio/ogg; codecs=opus';

// Leitura do que foi falado

const SPOKEN = [
  ['Gastei 50 reais de gasolina.', 'Gastei 50 reais de gasolina'],
  ['Gastei cinquenta reais de gasolina.', 'Gastei 50 reais de gasolina'],
  ['gastei cinquenta de gasolina', 'gastei 50 de gasolina'],
  ['Cinquenta de gasolina.', '50 de gasolina'],
  ['gasolina cinquenta', 'gasolina 50'],
  ['Gasolina, cinquenta reais.', 'Gasolina, 50 reais'],
  ['Paguei cento e vinte reais no mercado', 'Paguei 120 reais no mercado'],
  ['deu cento e vinte no mercado', 'deu 120 no mercado'],
  ['Mercado vinte e três e cinquenta', 'Mercado 23,50'],
  ['café cinco e noventa', 'café 5,90'],
  ['Gastei vinte e três reais e cinquenta centavos no almoço', 'Gastei 23,50 reais no almoço'],
  ['Gastei 23 reais e 50 centavos no almoço', 'Gastei 23,50 reais no almoço'],
  ['bala cinquenta centavos', 'bala 0,50 reais'],
  ['um real de bala', '1 real de bala'],
  ['Gastei mil e duzentos reais na oficina', 'Gastei 1200 reais na oficina'],
  ['Gastei dois mil quinhentos e trinta reais', 'Gastei 2530 reais'],
  ['Gastei 2 mil e 500 reais na viagem', 'Gastei 2500 reais na viagem'],
  ['Gastei 2 mil e quinhentos reais na viagem', 'Gastei 2500 reais na viagem'],
  ['Gastei 5 mil reais na reforma', 'Gastei 5 mil reais na reforma'],
  ['tv dois mil reais em dez vezes', 'tv 2000 reais em 10 vezes'],
  ['Recebi três mil reais de salário', 'Recebi 3000 reais de salário'],
  // Os horários e as datas.
  ['Reunião amanhã às três e meia da tarde.', 'Reunião amanhã às 3:30 da tarde'],
  ['Dentista às 9 e 15', 'Dentista às 9:15'],
  ['Dentista à uma e meia da tarde', 'Dentista às 1:30 da tarde'],
  ['Dentista dia dois de dezembro às 9', 'Dentista dia 2 de dezembro às 9'],
  ['Dentista dois de dezembro às 9', 'Dentista 2 de dezembro às 9'],
  ['Consulta dia vinte e cinco às dez', 'Consulta dia 25 às dez'],
  ['Consulta dia primeiro às dez', 'Consulta dia 1 às dez'],
  ['Consulta primeiro de março às dez', 'Consulta 1 de março às dez'],
  // O que parece número, mas é palavra.
  ['Paguei dois boletos', 'Paguei dois boletos'],
  ['Comprei uma camisa', 'Comprei uma camisa'],
  ['Uma reunião amanhã às dez', 'Uma reunião amanhã às dez'],
  ['Dentista quinta às três da tarde', 'Dentista quinta às três da tarde'],
  ['Almoço com dois amigos sexta', 'Almoço com dois amigos sexta'],
  ['Cris e Ana amanhã às quinze', 'Cris e Ana amanhã às quinze'],
  ['fui duas vezes ao mercado', 'fui duas vezes ao mercado'],
  ['três de manhã', 'três de manhã'],
  ['Desfazer.', 'Desfazer'],
];

for (const [spoken, written] of SPOKEN) {
  test(`fala: "${spoken}"`, () => assert.equal(fromSpeech(spoken), written));
}

test('o que foi falado chega certo aos assessores', () => {
  const expense = (text) => parseMessage(fromSpeech(text), TODAY);
  assert.deepEqual([expense('Gastei cinquenta reais de gasolina.').amountCents, expense('Gastei cinquenta reais de gasolina.').description], [5000, 'Gasolina']);
  assert.equal(expense('Gastei 5 mil reais na reforma.').amountCents, 500000);
  assert.equal(expense('bala cinquenta centavos').amountCents, 50);
  const installments = expense('Comprei uma TV de dois mil e quinhentos reais em dez vezes.');
  assert.equal(installments.installments, 10);
  assert.equal(parseMessage(fromSpeech('Paguei dois boletos.'), TODAY).type, 'unknown');

  const event = (text) => parseAgenda(fromSpeech(text), TODAY, '12:00');
  assert.deepEqual(
    [event('Reunião com o José amanhã às três e meia da tarde.').title, event('Reunião com o José amanhã às três e meia da tarde.').time],
    ['Reunião com o José', '15:30'],
  );
  const dated = event('Marca pra mim dentista dia dois de dezembro às 9 e 15.');
  assert.deepEqual([dated.title, dated.date, dated.time], ['Dentista', '2026-12-02', '09:15']);
});

// O webhook

test('o id do áudio sai do webhook, e texto continua sem áudio', () => {
  const payload = (message) => ({ entry: [{ changes: [{ field: 'messages', value: { messages: [{ id: 'a', from: OWNER, timestamp: '1', ...message }] } }] }] });
  const [audio] = extractMessages(payload({ type: 'audio', audio: { id: 'midia-1', mime_type: VOICE, sha256: 'x=', voice: true } }));
  assert.deepEqual(audio.audio, { id: 'midia-1' });
  assert.equal(extractMessages(payload({ type: 'text', text: { body: 'oi' } }))[0].audio, null);
});

// A Meta e o serviço de transcrição, em um servidor local: as chamadas passam por HTTP de verdade.

let fake;
let fakeUrl;

function startFake() {
  const state = {
    calls: [],
    uploads: [],
    file: Buffer.from('OggS-audio-de-mentira'),
    fileSize: null,
    mimeType: VOICE,
    heard: 'Gastei 50 reais de gasolina.',
    transcribeStatus: 200,
    fileStatus: 200,
  };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      state.calls.push({ method: req.method, url: req.url, auth: req.headers.authorization });
      const json = (status, value) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (req.url === '/v26.0/midia-1' || req.url === '/v26.0/midia-2') {
        if (req.headers.authorization !== `Bearer ${META_TOKEN}`) return json(401, {});
        return json(200, {
          messaging_product: 'whatsapp',
          url: `${fakeUrl}/arquivo`,
          mime_type: state.mimeType,
          sha256: 'x=',
          file_size: String(state.fileSize ?? state.file.length),
          id: req.url.split('/').at(-1),
        });
      }
      if (req.url === '/arquivo') {
        if (req.headers.authorization !== `Bearer ${META_TOKEN}`) return json(401, {});
        res.writeHead(state.fileStatus, { 'Content-Type': state.mimeType });
        return res.end(state.file);
      }
      if (req.url === '/v1/audio/transcriptions') {
        if (req.headers.authorization !== `Bearer ${GROQ_KEY}`) return json(401, {});
        state.uploads.push({ type: req.headers['content-type'], body: body.toString('latin1') });
        return state.transcribeStatus === 200 ? json(200, { text: state.heard }) : json(state.transcribeStatus, { error: { message: 'recusado' } });
      }
      return json(404, {});
    });
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, state, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

let db;
let reset;
let app;
let base;
let sent;
let errors;
let counter = 0;

const audioConfig = (extra = {}) => testConfig({
  WHATSAPP_APP_SECRET: APP_SECRET,
  WHATSAPP_ACCESS_TOKEN: META_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: '123',
  WHATSAPP_GRAPH_BASE: fakeUrl,
  WHATSAPP_GRAPH_VERSION: 'v26.0',
  TRANSCRICAO_CHAVE: GROQ_KEY,
  TRANSCRICAO_URL: `${fakeUrl}/v1/`,
  TRANSCRICAO_MODELO: 'modelo-de-teste',
  ...extra,
});

async function startApp(config) {
  const started = createApp({
    config,
    db,
    google: noGoogle,
    mailer: fakeMailer(),
    log: { ...quiet, error: (line) => errors.push(line) },
    sendText: async (_whatsapp, to, body) => {
      sent.push({ to, body });
    },
  });
  await new Promise((done) => started.listen(0, done));
  return started;
}

const stop = async (server) => {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
};

function audioMessage(from = OWNER, id = `wamid.audio.${(counter += 1)}`, media = 'midia-1') {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '123' },
          messages: [{ id, from, type: 'audio', timestamp: String(Math.floor(Date.now() / 1000)), audio: { id: media, mime_type: VOICE, sha256: 'x=', voice: true } }],
        },
      }],
    }],
  };
}

function textMessage(text, from = OWNER) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '123' },
          messages: [{ id: `wamid.texto.${(counter += 1)}`, from, type: 'text', timestamp: String(Math.floor(Date.now() / 1000)), text: { body: text } }],
        },
      }],
    }],
  };
}

async function deliver(payload) {
  const before = sent.length;
  const body = JSON.stringify(payload);
  const response = await fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}` },
    body,
  });
  assert.equal(response.status, 200);
  const deadline = Date.now() + 3000;
  while (sent.length === before && Date.now() < deadline) await new Promise((done) => setTimeout(done, 10));
  // Dá tempo de aparecer uma segunda resposta, se houver.
  await new Promise((done) => setTimeout(done, 30));
  return sent.slice(before).map((message) => message.body).join('\n');
}

const signUp = (phone = OWNER) => createAccount(db, { phone, at: new Date() });
const storeOf = async (phone = OWNER) => db.forUser((await db.userByPhone(phone)).id);
const mediaCalls = () => fake.state.calls.filter((call) => call.url !== '/v1/audio/transcriptions');
const transcriptions = () => fake.state.uploads.length;

before(async () => {
  ({ db, reset } = await createTestDb());
});
after(() => db.close());

beforeEach(async () => {
  await reset();
  fake = await startFake();
  fakeUrl = fake.url;
  sent = [];
  errors = [];
  app = await startApp(audioConfig());
  base = `http://127.0.0.1:${app.address().port}`;
});

afterEach(async () => {
  await stop(app);
  fake.server.closeAllConnections();
  await new Promise((done) => fake.server.close(done));
});

test('um áudio dizendo que gastou 50 de gasolina vira o gasto, e a resposta mostra o que foi ouvido', async () => {
  await signUp();
  const reply = await deliver(audioMessage());
  assert.match(reply, /^🎤 Ouvi: "Gastei 50 reais de gasolina\."/);
  assert.match(reply, /💰 \*Caio, Assessor Financeiro\*/);
  assert.match(reply, /\*R\$ 50,00\*/);
  assert.match(reply, /Ouvi errado\? Mande \*desfazer\*\./);
  const [row] = await (await storeOf()).allExpenses();
  assert.equal(row.amount_cents, 5000);
  assert.equal(row.description, 'Gasolina');
  assert.equal(row.source, 'whatsapp');
});

test('baixa com o token da Meta nas duas etapas e envia o áudio ao serviço de transcrição', async () => {
  await signUp();
  await deliver(audioMessage());
  assert.deepEqual(mediaCalls().map((call) => [call.method, call.url, call.auth]), [
    ['GET', '/v26.0/midia-1', `Bearer ${META_TOKEN}`],
    ['GET', '/arquivo', `Bearer ${META_TOKEN}`],
  ]);
  const [upload] = fake.state.uploads;
  assert.match(upload.type, /^multipart\/form-data; boundary=/);
  assert.match(upload.body, /name="file"; filename="audio\.ogg"/);
  assert.match(upload.body, /Content-Type: audio\/ogg/);
  assert.match(upload.body, /OggS-audio-de-mentira/);
  assert.match(upload.body, /name="model"\r\n\r\nmodelo-de-teste/);
  assert.match(upload.body, /name="language"\r\n\r\npt/);
  // A chave de um serviço nunca vai para o outro.
  assert.ok(!mediaCalls().some((call) => call.auth?.includes(GROQ_KEY)));
});

test('valor falado por extenso também é entendido', async () => {
  await signUp();
  fake.state.heard = 'Gastei cinquenta reais de gasolina.';
  await deliver(audioMessage());
  assert.equal((await (await storeOf()).allExpenses())[0].amount_cents, 5000);
});

test('áudio também marca compromisso e tarefa, e responde ao "Para quando?"', async () => {
  await signUp();
  fake.state.heard = 'Marca dentista quinta às três da tarde.';
  assert.match(await deliver(audioMessage()), /📅 \*Cris, Assessora de Agenda\*[\s\S]*\*Dentista\*/);
  fake.state.heard = 'Tarefa pagar a luz sexta.';
  assert.match(await deliver(audioMessage()), /📝 \*Nina, Assessora de Tarefas\*[\s\S]*\*Pagar a luz\*/);
  await deliver(textMessage('agendar reunião com José'));
  fake.state.heard = 'Amanhã às dez.';
  assert.match(await deliver(audioMessage()), /\*Reunião com José\*: amanhã, às 10:00/);
  const store = await storeOf();
  assert.deepEqual((await store.allAppointments()).map((row) => row.title).sort(), ['Dentista', 'Reunião com José']);
  assert.equal((await store.allExpenses()).length, 0);
});

test('"desfazer" falado apaga o último lançamento, e o que não foi anotado não oferece desfazer', async () => {
  await signUp();
  await deliver(audioMessage());
  fake.state.heard = 'Desfazer.';
  assert.match(await deliver(audioMessage()), /🗑️/);
  assert.equal((await (await storeOf()).allExpenses()).length, 0);
  fake.state.heard = 'Bom, deixa eu pensar aqui.';
  const reply = await deliver(audioMessage());
  assert.match(reply, /🎤 Ouvi: "Bom, deixa eu pensar aqui\."/);
  assert.match(reply, /Não entendi/);
  assert.doesNotMatch(reply, /desfazer\*\.$/);
});

test('a mesma mensagem reenviada pela Meta não transcreve de novo nem anota duas vezes', async () => {
  await signUp();
  const payload = audioMessage();
  await deliver(payload);
  const body = JSON.stringify(payload);
  await fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}` },
    body,
  });
  await new Promise((done) => setTimeout(done, 80));
  assert.equal(transcriptions(), 1);
  assert.equal((await (await storeOf()).allExpenses()).length, 1);
});

test('número desconhecido não gera download nem transcrição', async () => {
  const reply = await deliver(audioMessage(OTHER));
  assert.doesNotMatch(reply, /🎤/);
  assert.equal(fake.state.calls.length, 0);
});

test('conta com o teste vencido não gera custo e recebe o aviso uma vez por dia', async () => {
  const user = await signUp();
  await db.setTrialEnd(user.id, new Date('2020-01-01T00:00:00Z'));
  assert.match(await deliver(audioMessage()), /teste grátis terminou/);
  assert.equal(fake.state.calls.length, 0);
  const before = sent.length;
  const body = JSON.stringify(audioMessage());
  await fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}` },
    body,
  });
  await new Promise((done) => setTimeout(done, 80));
  assert.equal(sent.length, before);
  assert.equal(fake.state.calls.length, 0);
});

test('quem passou do limite diário não gera download nem transcrição', async () => {
  await stop(app);
  app = await startApp(audioConfig({ LIMITE_MENSAGENS_DIA: '1' }));
  base = `http://127.0.0.1:${app.address().port}`;
  await signUp();
  await deliver(audioMessage());
  const used = fake.state.calls.length;
  assert.match(await deliver(audioMessage()), /limite de 1 mensagens/);
  assert.equal(fake.state.calls.length, used);
});

test('áudio longo demais é recusado antes de baixar', async () => {
  await signUp();
  fake.state.fileSize = MAX_AUDIO_BYTES + 1;
  assert.match(await deliver(audioMessage()), /longo demais/);
  assert.ok(!fake.state.calls.some((call) => call.url === '/arquivo'));
  assert.equal(transcriptions(), 0);
});

test('arquivo maior que o informado também é recusado, sem ir para a transcrição', async () => {
  await signUp();
  fake.state.fileSize = 10;
  fake.state.file = Buffer.alloc(MAX_AUDIO_BYTES + 1);
  assert.match(await deliver(audioMessage()), /longo demais/);
  assert.equal(transcriptions(), 0);
});

test('formato que o serviço não aceita recebe orientação', async () => {
  await signUp();
  fake.state.mimeType = 'audio/amr';
  assert.match(await deliver(audioMessage()), /Não consigo ouvir esse tipo de arquivo/);
  assert.equal(transcriptions(), 0);
});

test('falha na transcrição ou no download avisa, registra o erro e não anota nada', async () => {
  await signUp();
  fake.state.transcribeStatus = 500;
  assert.match(await deliver(audioMessage()), /Não consegui ouvir esse áudio agora, e nada foi anotado/);
  assert.match(errors.at(-1), /recusou o áudio \(500\)/);
  fake.state.transcribeStatus = 200;
  fake.state.fileStatus = 404;
  assert.match(await deliver(audioMessage()), /Não consegui ouvir esse áudio agora/);
  assert.match(errors.at(-1), /não entregou o arquivo \(404\)/);
  assert.equal((await (await storeOf()).allExpenses()).length, 0);
});

test('silêncio não anota nada, nem quando o serviço devolve a própria dica', async () => {
  await signUp();
  fake.state.heard = '   ';
  assert.match(await deliver(audioMessage()), /Não consegui entender esse áudio, e nada foi anotado/);
  fake.state.heard = 'Recado curto sobre gastos em reais, compromissos e tarefas, com valores e horários escritos em números.';
  assert.match(await deliver(audioMessage()), /Não consegui entender esse áudio/);
  assert.equal((await (await storeOf()).allExpenses()).length, 0);
});

test('sem a chave, o áudio recebe o aviso de antes e nada é baixado', async () => {
  await stop(app);
  app = await startApp(audioConfig({ TRANSCRICAO_CHAVE: '' }));
  base = `http://127.0.0.1:${app.address().port}`;
  await signUp();
  assert.match(await deliver(audioMessage()), /só entendo mensagens de texto/);
  assert.equal(fake.state.calls.length, 0);
});

test('foto recebe um aviso que menciona o áudio, e a ajuda ensina a usar', async () => {
  await signUp();
  const photo = audioMessage();
  const message = photo.entry[0].changes[0].value.messages[0];
  message.type = 'image';
  delete message.audio;
  message.image = { id: 'foto-1' };
  assert.match(await deliver(photo), /só entendo texto e áudio/);
  assert.equal(fake.state.calls.length, 0);
  assert.match(await deliver(textMessage('ajuda')), /🎤 Também entendo áudio/);
});

// As duas funções, direto

test('download: erro claro quando falta o token', async () => {
  await assert.rejects(downloadMedia({ accessToken: '' }, 'x', 10), /WHATSAPP_ACCESS_TOKEN/);
});

test('download: o tamanho informado pela Meta é verificado antes de baixar', async () => {
  let downloads = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/m')) return Response.json({ url: 'https://arquivo.test/a', mime_type: VOICE, file_size: '11' });
    downloads += 1;
    return new Response('audio');
  };
  await assert.rejects(downloadMedia({ accessToken: 't', graphBase: 'https://g.test', graphVersion: 'v1' }, 'm', 10, fetchImpl), MediaTooLargeError);
  assert.equal(downloads, 0);
});

test('transcrição: formato desconhecido nem chega a ser enviado', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return Response.json({ text: 'x' });
  };
  await assert.rejects(transcribe({ apiKey: 'k', baseUrl: 'https://t.test', model: 'm' }, { data: Buffer.from('x'), mimeType: 'audio/amr' }, fetchImpl), UnsupportedAudioError);
  assert.equal(called, false);
});

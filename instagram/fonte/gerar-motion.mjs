// Gera os vídeos: captura cada animação quadro a quadro e monta o MP4, sem som.
//   node instagram/fonte/gerar-motion.mjs             gera todos
//   node instagram/fonte/gerar-motion.mjs whatsapp    gera só esse
// Precisa do Chrome e do ffmpeg instalados.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirChrome, conectar } from './chrome.mjs';

const FONTE = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(FONTE, '..');
const QUADROS_POR_SEGUNDO = 30;

// `imagem` é um quadro salvo à parte. `conferir` lista os momentos em que cada cena está completa.
const VIDEOS = [
  {
    nome: 'motion',
    pagina: 'motion.html',
    largura: 1080,
    altura: 1920,
    qualidade: 15,
    destino: 'motion/fila-aberta.mp4',
    imagem: { arquivo: 'motion/capa.png', t: 3300 },
    conferir: [{ cena: 'a', t: 3300 }, { cena: 'b', t: 7300 }, { cena: 'c', t: 11200 }],
    // Fora daqui, o Instagram cobre o vídeo com o nome da conta, a legenda e os botões.
    area: { esquerda: 40, direita: 1040, topo: 250, base: 1440 },
  },
  {
    nome: 'whatsapp',
    pagina: 'whatsapp.html',
    largura: 1080,
    altura: 1080,
    qualidade: 17,
    destino: 'whatsapp/criativo.mp4',
    imagem: { arquivo: 'whatsapp/criativo.png', t: 5700 },
    conferir: [{ cena: 'a', t: 0 }, { cena: 'c', t: 5700 }],
    area: { esquerda: 40, direita: 1040, topo: 40, base: 1040 },
  },
];

const TIPOS = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function servidor() {
  return http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const caminho = path.join(FONTE, url);
    if (!caminho.startsWith(FONTE) || !fs.existsSync(caminho) || fs.statSync(caminho).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(caminho)] ?? 'application/octet-stream' });
    fs.createReadStream(caminho).pipe(res);
  });
}

function abrirFfmpeg(destino, qualidade) {
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(QUADROS_POR_SEGUNDO), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(qualidade), '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(QUADROS_POR_SEGUNDO), '-movflags', '+faststart',
    destino,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const terminou = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (codigo) => (codigo === 0 ? resolve() : reject(new Error(`ffmpeg saiu com o código ${codigo}`))));
  });
  return { ffmpeg, terminou };
}

const conferirTexto = (cena, area) => `(() => {
  const problemas = [];
  for (const elemento of document.querySelectorAll('[data-texto="${cena}"]')) {
    const faixa = document.createRange();
    faixa.selectNodeContents(elemento);
    const caixa = faixa.getBoundingClientRect();
    const nome = elemento.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40);
    if (caixa.left < ${area.esquerda} || caixa.right > ${area.direita}) problemas.push('largura: ' + nome + ' (' + Math.round(caixa.left) + ' a ' + Math.round(caixa.right) + ')');
    if (caixa.top < ${area.topo} || caixa.bottom > ${area.base}) problemas.push('altura: ' + nome + ' (' + Math.round(caixa.top) + ' a ' + Math.round(caixa.bottom) + ')');
  }
  return problemas;
})()`;

async function gerarVideo({ enviar, esperar }, sessao, porta, video, avisos) {
  await enviar('Emulation.setDeviceMetricsOverride', { width: video.largura, height: video.altura, deviceScaleFactor: 1, mobile: false }, sessao);
  const carregou = esperar('Page.loadEventFired');
  await enviar('Page.navigate', { url: `http://127.0.0.1:${porta}/${video.pagina}` }, sessao);
  await carregou;
  await enviar('Runtime.evaluate', { expression: 'window.pronto', awaitPromise: true }, sessao);

  const fotografar = async (t) => {
    await enviar('Runtime.evaluate', { expression: `quadro(${t})` }, sessao);
    const { data } = await enviar('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }, sessao);
    return Buffer.from(data, 'base64');
  };

  for (const { cena, t } of video.conferir) {
    await enviar('Runtime.evaluate', { expression: `quadro(${t})` }, sessao);
    const { result } = await enviar('Runtime.evaluate', { expression: conferirTexto(cena, video.area), returnByValue: true }, sessao);
    for (const problema of result.value) avisos.push(`${video.nome}, cena ${cena}: ${problema}`);
  }

  const destino = path.join(RAIZ, video.destino);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, video.imagem.arquivo), await fotografar(video.imagem.t));

  const { result: duracao } = await enviar('Runtime.evaluate', { expression: 'window.DURACAO', returnByValue: true }, sessao);
  const total = Math.round((duracao.value / 1000) * QUADROS_POR_SEGUNDO);
  const { ffmpeg, terminou } = abrirFfmpeg(destino, video.qualidade);
  for (let quadro = 0; quadro < total; quadro += 1) {
    const png = await fotografar((quadro * 1000) / QUADROS_POR_SEGUNDO);
    if (!ffmpeg.stdin.write(png)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
  }
  ffmpeg.stdin.end();
  await terminou;
  console.log(`${video.nome}: ${total} quadros em ${destino}`);
}

async function principal() {
  const filtro = process.argv[2];
  const escolhidos = VIDEOS.filter((video) => !filtro || video.nome === filtro);
  if (!escolhidos.length) throw new Error(`Nenhum vídeo chamado "${filtro}".`);

  const site = servidor();
  await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
  const { port: porta } = site.address();
  const { chrome, perfil, ws } = await abrirChrome();
  const avisos = [];

  try {
    const cdp = await conectar(ws);
    const { targetId } = await cdp.enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId: sessao } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
    await cdp.enviar('Page.enable', {}, sessao);
    for (const video of escolhidos) await gerarVideo(cdp, sessao, porta, video, avisos);
    cdp.socket.close();
  } finally {
    chrome.kill();
    site.close();
    setTimeout(() => fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }), 500);
  }

  if (avisos.length) {
    console.log(`\n${avisos.length} aviso(s):`);
    for (const aviso of avisos) console.log(`- ${aviso}`);
    process.exitCode = 1;
  } else {
    console.log('Nenhum texto fora da área segura.');
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

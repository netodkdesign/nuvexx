// Gera os PNGs dos carrosséis, em 1080 x 1350, com o Chrome instalado no computador.
//   node instagram/fonte/gerar.mjs             gera tudo
//   node instagram/fonte/gerar.mjs 04-cris     gera só as pastas com esse trecho no nome
//   node instagram/fonte/gerar.mjs perfil      gera só a foto de perfil e os destaques
// Ao final, avisa se algum texto estourou o slide ou chegou perto demais da borda.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARROSSEIS, SPRITE, montarSlide } from './carrosseis.mjs';
import { abrirChrome, conectar } from './chrome.mjs';
import { PECAS, paginaDaPeca, paginaDaVisaoDoPerfil } from './perfil.mjs';

const FONTE = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.resolve(FONTE, '..');
const PASTA_DO_PERFIL = 'perfil-e-destaques';
const LADO_DA_PECA = 1080;
const LARGURA = 1080;
const ALTURA = 1350;
// Na grade do perfil, o Instagram mostra o post em 3:4 e corta 34px de cada lado.
const CORTE_DA_GRADE = 34;

const TIPOS = { '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const paginaDoSlide = (html) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="/estilo.css"></head><body>${SPRITE}${html}</body></html>`;

function paginaDaVisao(carrossel) {
  const quadros = carrossel.slides.map((_, i) => `<img src="/png/${carrossel.pasta}/${numero(i)}.png" style="width:432px;height:540px;border-radius:14px">`).join('');
  return `<!doctype html><html><body style="margin:0;background:#2a2f3a"><div style="display:grid;grid-template-columns:repeat(4,432px);gap:20px;padding:20px;width:max-content">${quadros}</div></body></html>`;
}

const numero = (i) => String(i + 1).padStart(2, '0');

function servidor() {
  const arquivo = (res, caminho) => {
    if (!caminho.startsWith(SAIDA) || !fs.existsSync(caminho)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(caminho)] ?? 'application/octet-stream' });
    fs.createReadStream(caminho).pipe(res);
  };
  const html = (res, corpo) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(corpo);
  };
  return http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const [, raiz, a, b] = url.split('/');
    if (url === '/estilo.css') return arquivo(res, path.join(FONTE, 'estilo.css'));
    if (raiz === 'assets') return arquivo(res, path.join(FONTE, url));
    if (raiz === 'png') return arquivo(res, path.join(SAIDA, a, b));
    if (raiz === 'pecas') return arquivo(res, path.join(SAIDA, PASTA_DO_PERFIL, url.slice('/pecas/'.length)));
    if (raiz === 'peca' && PECAS[Number(a)]) return html(res, paginaDaPeca(PECAS[Number(a)]));
    if (raiz === 'visao-do-perfil') return html(res, paginaDaVisaoDoPerfil((peca) => `/pecas/${peca.arquivo}`));
    const carrossel = CARROSSEIS.find((c) => c.pasta === a);
    if (raiz === 's' && carrossel) return html(res, paginaDoSlide(montarSlide(carrossel, Number(b))));
    if (raiz === 'visao' && carrossel) return html(res, paginaDaVisao(carrossel));
    return res.writeHead(404).end();
  });
}

const VERIFICAR = `(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  const problemas = [];
  for (const area of document.querySelectorAll('.conteudo, .palco')) {
    const excesso = area.scrollHeight - area.clientHeight;
    if (excesso > 1) problemas.push(area.className + ' passou ' + excesso + 'px da altura');
  }
  const palco = document.querySelector('.palco');
  if (palco) {
    const fim = Math.max(...[...palco.children].map((filho) => filho.getBoundingClientRect().bottom));
    const limite = palco.getBoundingClientRect().bottom;
    if (fim > limite + 1) problemas.push('o palco passou ' + Math.round(fim - limite) + 'px');
  }
  const pe = document.querySelector('.pe .nota');
  const seta = document.querySelector('.pe .seta');
  if (pe && seta && pe.getBoundingClientRect().right > seta.getBoundingClientRect().left - 8) problemas.push('a nota encosta na seta');
  const passou = new Set();
  const caminhada = document.createTreeWalker(document.querySelector('.slide'), NodeFilter.SHOW_TEXT);
  while (caminhada.nextNode()) {
    const no = caminhada.currentNode;
    if (!no.textContent.trim()) continue;
    const dono = no.parentElement;
    if (dono.closest('.capa-tablet, .capa-relatorio, .celular-moldura')) continue;
    const faixa = document.createRange();
    faixa.selectNodeContents(no);
    const caixa = faixa.getBoundingClientRect();
    if (caixa.left < ${CORTE_DA_GRADE} || caixa.right > ${LARGURA - CORTE_DA_GRADE} || caixa.top < 20 || caixa.bottom > ${ALTURA - 20}) passou.add(no.textContent.trim().slice(0, 40));
  }
  for (const texto of passou) problemas.push('perto demais da borda: ' + texto);
  const fontes = [...document.fonts].filter((f) => f.status === 'loaded').length;
  if (!fontes) problemas.push('a fonte Poppins não carregou');
  return problemas;
})()`;

// As peças do perfil não têm texto corrido: basta esperar as imagens e conferir a fonte do "R$".
const SO_ESPERAR = `(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  const usaFonte = document.querySelector('svg text');
  const carregou = [...document.fonts].some((fonte) => fonte.status === 'loaded');
  return usaFonte && !carregou ? ['a fonte Poppins não carregou'] : [];
})()`;

async function capturar({ enviar, esperar }, sessao, porta, url, largura, altura, expressao = VERIFICAR) {
  await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false }, sessao);
  const carregou = esperar('Page.loadEventFired');
  await enviar('Page.navigate', { url: `http://127.0.0.1:${porta}${url}` }, sessao);
  await carregou;
  const { result } = await enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true }, sessao);
  const { data } = await enviar('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: largura, height: altura, scale: 1 },
  }, sessao);
  return { png: Buffer.from(data, 'base64'), problemas: result.value ?? [] };
}

function textoDasLegendas() {
  const blocos = CARROSSEIS.map((c) => `## ${c.pasta} (${c.slides.length} slides)\n\n${c.legenda}\n\n${c.hashtags}`);
  return `# Legendas dos carrosséis\n\nNa ordem sugerida de publicação. Este arquivo é gerado por \`fonte/gerar.mjs\`: para mudar um texto, edite \`fonte/carrosseis.mjs\`.\n\n${blocos.join('\n\n')}\n`;
}

async function principal() {
  const filtro = process.argv[2];
  const soPerfil = filtro === 'perfil';
  const escolhidos = soPerfil ? [] : CARROSSEIS.filter((c) => !filtro || c.pasta.includes(filtro));
  if (!soPerfil && !escolhidos.length) throw new Error(`Nenhum carrossel com "${filtro}" no nome.`);

  const http_ = servidor();
  await new Promise((resolve) => http_.listen(0, '127.0.0.1', resolve));
  const { port: porta } = http_.address();
  const { chrome, perfil, ws } = await abrirChrome();
  const avisos = [];
  let total = 0;

  try {
    const cdp = await conectar(ws);
    const { targetId } = await cdp.enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
    await cdp.enviar('Page.enable', {}, sessionId);

    fs.mkdirSync(path.join(SAIDA, 'visao-geral'), { recursive: true });
    for (const carrossel of escolhidos) {
      const pasta = path.join(SAIDA, carrossel.pasta);
      fs.rmSync(pasta, { recursive: true, force: true });
      fs.mkdirSync(pasta, { recursive: true });
      for (let i = 0; i < carrossel.slides.length; i += 1) {
        const { png, problemas } = await capturar(cdp, sessionId, porta, `/s/${carrossel.pasta}/${i}`, LARGURA, ALTURA);
        fs.writeFileSync(path.join(pasta, `${numero(i)}.png`), png);
        total += 1;
        for (const problema of problemas) avisos.push(`${carrossel.pasta}/${numero(i)}: ${problema}`);
      }
      const colunas = 4;
      const linhas = Math.ceil(carrossel.slides.length / colunas);
      const { png } = await capturar(cdp, sessionId, porta, `/visao/${carrossel.pasta}`, 20 + colunas * 452, 20 + linhas * 560);
      fs.writeFileSync(path.join(SAIDA, 'visao-geral', `${carrossel.pasta}.png`), png);
      console.log(`${carrossel.pasta}: ${carrossel.slides.length} slides`);
    }

    if (!filtro || soPerfil) {
      const pasta = path.join(SAIDA, PASTA_DO_PERFIL);
      fs.rmSync(pasta, { recursive: true, force: true });
      for (const [i, peca] of PECAS.entries()) {
        const destino = path.join(pasta, peca.arquivo);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        const { png, problemas } = await capturar(cdp, sessionId, porta, `/peca/${i}`, LADO_DA_PECA, LADO_DA_PECA, SO_ESPERAR);
        fs.writeFileSync(destino, png);
        for (const problema of problemas) avisos.push(`${peca.arquivo}: ${problema}`);
      }
      const { png } = await capturar(cdp, sessionId, porta, '/visao-do-perfil', 1620, 600, SO_ESPERAR);
      fs.writeFileSync(path.join(SAIDA, 'visao-geral', `${PASTA_DO_PERFIL}.png`), png);
      console.log(`${PASTA_DO_PERFIL}: ${PECAS.length} imagens`);
    }
    cdp.socket.close();
  } finally {
    chrome.kill();
    http_.close();
    setTimeout(() => fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }), 500);
  }

  if (!filtro) fs.writeFileSync(path.join(SAIDA, 'legendas.md'), textoDasLegendas());
  if (total) console.log(`\n${total} slides gerados em ${SAIDA}`);
  if (avisos.length) {
    console.log(`\n${avisos.length} aviso(s):`);
    for (const aviso of avisos) console.log(`- ${aviso}`);
    process.exitCode = 1;
  } else {
    console.log('Nenhum aviso: fontes carregadas, e nenhum texto estourou nem ficou perto demais da borda.');
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

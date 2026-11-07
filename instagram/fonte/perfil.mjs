// A foto de perfil e as capas dos destaques: círculos concêntricos, cada um em uma cor da marca.
// O Instagram corta a imagem em círculo, então tudo fica dentro do círculo inscrito no quadrado.

const FUNDO = '#0B1220';
const BRANCO = '#FFFFFF';
const NAVY = '#101828';
const ANEL = '#4D5A6F'; // Slate da marca, um pouco mais fechado sobre o fundo escuro

const LADO = 1080;
const CENTRO = LADO / 2;

function misturar(de, para, peso) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const partes = [0, 1, 2].map((i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * peso));
  return `#${partes.map((parte) => parte.toString(16).padStart(2, '0')).join('')}`;
}

const DEGRADE = `<linearGradient id="degrade" x1="0" y1="0" x2="1" y2="0.55"><stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#7657FF"/></linearGradient>`;

// Ícones de 24 unidades, no traço da página, um pouco mais grosso para aguentar o tamanho pequeno.
const ICONES = {
  conversa: (traco) => `<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.500 4v-4A2.500 2.500 0 0 1 4 13.500Z" fill="none" stroke="${traco}" stroke-width="2.1" stroke-linejoin="round"/>`,
  agenda: (traco) => `<g fill="none" stroke="${traco}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.8" y="5.3" width="16.400" height="15" rx="2.800"/><path d="M3.800 10.300h16.400M8.300 3v4M15.700 3v4"/></g><circle cx="15.300" cy="15.300" r="1.700" fill="${traco}"/>`,
  tarefas: (traco) => `<g fill="none" stroke="${traco}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.800" y="3.800" width="16.400" height="16.400" rx="4"/><path d="m8 12.300 2.900 2.900L16.200 9.200"/></g>`,
  escudo: (traco) => `<g fill="none" stroke="${traco}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.800 4.800 5.900v5.700c0 4.600 3 8.100 7.200 9.700 4.200-1.600 7.200-5.100 7.200-9.700V5.900Z"/><path d="m8.800 12 2.300 2.300 4.100-4.500"/></g>`,
};

const icone = (nome, traco, tamanho) => {
  const escala = tamanho / 24;
  const inicio = CENTRO - tamanho / 2;
  return `<g transform="translate(${inicio} ${inicio}) scale(${escala})">${ICONES[nome](traco)}</g>`;
};

const reais = (cor) => `<text x="${CENTRO}" y="${CENTRO}" fill="${cor}" font-family="Poppins" font-weight="600" font-size="236" letter-spacing="-8" text-anchor="middle" dominant-baseline="central">R$</text>`;

const SIMBOLO_LARGURA = 739;
const SIMBOLO_ALTURA = 287;

const simbolo = (largura, { branco = false } = {}) => {
  const altura = (largura * SIMBOLO_ALTURA) / SIMBOLO_LARGURA;
  return `<image href="/assets/simbolo-marca.png" x="${CENTRO - largura / 2}" y="${CENTRO - altura / 2}" width="${largura}" height="${altura}" ${branco ? 'filter="url(#branco)"' : ''}/>`;
};

// Do disco mais largo para o mais estreito. O último é o núcleo, que recebe o conteúdo.
function circulo({ discos, conteudo, fio = false }) {
  const formas = discos.map(({ r, cor }) => `<circle cx="${CENTRO}" cy="${CENTRO}" r="${r}" fill="${cor}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
    <defs>${DEGRADE}<filter id="branco"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter></defs>
    <rect width="${LADO}" height="${LADO}" fill="${FUNDO}"/>
    <circle cx="${CENTRO}" cy="${CENTRO}" r="498" fill="none" stroke="${ANEL}" stroke-width="40"/>
    ${fio ? `<circle cx="${CENTRO}" cy="${CENTRO}" r="447" fill="none" stroke="${ANEL}" stroke-width="3" opacity="0.6"/>` : ''}
    ${formas}
    ${conteudo}
  </svg>`;
}

// O anel de degraus do anexo: do fundo até a cor, ficando mais forte perto do centro.
const RAIOS_ESCURO = [424, 374, 328, 284];
const degraus = (cor, pesos = [0.13, 0.27, 0.45, 0.68]) =>
  RAIOS_ESCURO.map((r, i) => ({ r, cor: misturar(FUNDO, cor, pesos[i]) }));

// Núcleo e ícone grandes: no perfil, o destaque aparece com cerca de 64 pontos de diâmetro.
const NUCLEO_DESTAQUE = 240;
const TAMANHO_ICONE = 306;

const destaque = ({ cor, nucleo = cor, pesos, conteudo }) => circulo({
  fio: true,
  discos: [...degraus(cor, pesos), { r: NUCLEO_DESTAQUE, cor: nucleo }],
  conteudo,
});

const AZUL = '#2563EB';
const VIOLETA = '#7657FF';
const INDIGO = '#A5B4FC';
const CLOUD = '#F1F5F9';
const MEIO_DO_DEGRADE = misturar(AZUL, VIOLETA, 0.5);

// Na foto de perfil, o desenho claro do anexo: disco branco e degraus até o núcleo forte.
const fotoDePerfil = () => circulo({
  discos: [
    { r: 450, cor: BRANCO },
    { r: 402, cor: misturar(BRANCO, INDIGO, 0.3) },
    { r: 356, cor: misturar(BRANCO, INDIGO, 0.62) },
    { r: 310, cor: 'url(#degrade)' },
  ],
  conteudo: simbolo(486, { branco: true }),
});

export const PECAS = [
  { arquivo: 'foto-de-perfil.png', rotulo: 'Nuvexx', desenho: fotoDePerfil },
  {
    arquivo: 'destaques/01-conheca.png',
    rotulo: 'Conheça',
    desenho: () => destaque({ cor: MEIO_DO_DEGRADE, nucleo: 'url(#degrade)', conteudo: icone('conversa', BRANCO, TAMANHO_ICONE) }),
  },
  {
    arquivo: 'destaques/02-financas.png',
    rotulo: 'Finanças',
    desenho: () => destaque({ cor: AZUL, conteudo: reais(BRANCO) }),
  },
  {
    arquivo: 'destaques/03-agenda.png',
    rotulo: 'Agenda',
    desenho: () => destaque({ cor: VIOLETA, conteudo: icone('agenda', BRANCO, TAMANHO_ICONE) }),
  },
  {
    arquivo: 'destaques/04-tarefas.png',
    rotulo: 'Tarefas',
    desenho: () => destaque({ cor: INDIGO, conteudo: icone('tarefas', NAVY, TAMANHO_ICONE) }),
  },
  {
    arquivo: 'destaques/05-seus-dados.png',
    rotulo: 'Seus dados',
    desenho: () => destaque({ cor: CLOUD, pesos: [0.1, 0.22, 0.38, 0.6], conteudo: icone('escudo', NAVY, TAMANHO_ICONE) }),
  },
];

export const paginaDaPeca = (peca) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  @font-face { font-family: Poppins; font-weight: 600; src: url("/assets/fontes/poppins-600.woff2") format("woff2"); }
  html, body { margin: 0; background: ${FUNDO}; }
  svg { display: block; }
</style></head><body>${peca.desenho()}</body></html>`;

// Só para revisar: como o conjunto fica no perfil, no tamanho real, nos temas escuro e claro do Instagram.
export function paginaDaVisaoDoPerfil(enderecoDaPeca) {
  const [foto, ...destaques] = PECAS;
  const painel = (tema) => {
    const escuro = tema === 'escuro';
    const fundo = escuro ? '#000000' : '#FFFFFF';
    const texto = escuro ? '#F5F5F5' : '#111111';
    const apoio = escuro ? '#A8A8A8' : '#737373';
    const contorno = escuro ? '#363636' : '#DBDBDB';
    return `<section style="width:780px;padding:36px 0 44px;background:${fundo};color:${texto};font:400 28px/1.35 Poppins, 'Segoe UI', sans-serif;overflow:hidden">
      <div style="display:flex;align-items:center;gap:36px;padding:0 32px">
        <img src="${enderecoDaPeca(foto)}" style="width:172px;height:172px;border-radius:50%">
        <div><div style="font-weight:600;font-size:32px">Nuvexx</div><div style="color:${apoio}">nuvexx.com.br</div></div>
      </div>
      <div style="display:flex;gap:26px;padding:40px 32px 0">
        ${destaques.map((peca) => `<figure style="flex:none;margin:0;width:128px;text-align:center">
          <div style="width:128px;height:128px;padding:5px;border:2px solid ${contorno};border-radius:50%;box-sizing:border-box"><img src="${enderecoDaPeca(peca)}" style="display:block;width:100%;height:100%;border-radius:50%"></div>
          <figcaption style="margin-top:10px;font-size:23px;white-space:nowrap">${peca.rotulo}</figcaption>
        </figure>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin:40px 32px 0;padding-top:28px;border-top:2px solid ${contorno}">
        <img src="${enderecoDaPeca(foto)}" style="width:64px;height:64px;border-radius:50%">
        <span style="font-weight:600">nuvexx</span><span style="color:${apoio}">como aparece no feed</span>
      </div>
    </section>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Poppins; font-weight: 400; src: url("/assets/fontes/poppins-400.woff2") format("woff2"); }
    @font-face { font-family: Poppins; font-weight: 600; src: url("/assets/fontes/poppins-600.woff2") format("woff2"); }
    body { margin: 0; background: #2a2f3a; }
  </style></head><body><div style="display:flex;gap:20px;padding:20px;width:max-content">${painel('escuro')}${painel('claro')}</div></body></html>`;
}

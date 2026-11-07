// Os carrosséis do Instagram. Os textos e as respostas dos assessores vêm da página da fila
// e do próprio app: não anuncie aqui nada que o app não faça.

const ASSESSORES = {
  caio: { nome: 'Caio', cargo: 'Assessor Financeiro' },
  cris: { nome: 'Cris', cargo: 'Assessora de Agenda' },
  nina: { nome: 'Nina', cargo: 'Assessora de Tarefas' },
};

const DADOS_DE_EXEMPLO = 'Dados de exemplo.';

const forte = (texto) => texto.replace(/\*(.+?)\*/g, '<strong>$1</strong>');
const retrato = (quem) => `/assets/assessores/${quem}.svg`;

// ---------- Peças ----------

export const SPRITE = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19.5 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-escudo" viewBox="0 0 24 24"><path d="M12 3 5 6v5.5c0 4.5 2.9 7.900 7 9.500 4.100-1.600 7-5 7-9.500V6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m9 12 2.200 2.200L15.200 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-tela" viewBox="0 0 24 24"><rect x="3" y="4.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="15" y="9" width="6" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 19.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-conversa" viewBox="0 0 24 24"><path d="M4 6.500A2.500 2.500 0 0 1 6.500 4h11A2.500 2.500 0 0 1 20 6.500v7a2.500 2.500 0 0 1-2.500 2.500H11l-4.500 4v-4A2.500 2.500 0 0 1 4 13.500Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-blocos" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
  <symbol id="i-dados" viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19.500h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-carta" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 7.500 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-onda" viewBox="0 0 120 24"><g fill="currentColor"><rect x="0" y="9" width="3" height="6" rx="1.5"/><rect x="6" y="6" width="3" height="12" rx="1.5"/><rect x="12" y="3" width="3" height="18" rx="1.5"/><rect x="18" y="7" width="3" height="10" rx="1.5"/><rect x="24" y="1" width="3" height="22" rx="1.5"/><rect x="30" y="5" width="3" height="14" rx="1.5"/><rect x="36" y="8" width="3" height="8" rx="1.5"/><rect x="42" y="4" width="3" height="16" rx="1.5"/><rect x="48" y="0" width="3" height="24" rx="1.5"/><rect x="54" y="6" width="3" height="12" rx="1.5"/><rect x="60" y="9" width="3" height="6" rx="1.5"/><rect x="66" y="3" width="3" height="18" rx="1.5"/><rect x="72" y="7" width="3" height="10" rx="1.5"/><rect x="78" y="2" width="3" height="20" rx="1.5"/><rect x="84" y="5" width="3" height="14" rx="1.5"/><rect x="90" y="8" width="3" height="8" rx="1.5"/><rect x="96" y="6" width="3" height="12" rx="1.5"/><rect x="102" y="4" width="3" height="16" rx="1.5"/><rect x="108" y="9" width="3" height="6" rx="1.5"/><rect x="114" y="7" width="3" height="10" rx="1.5"/></g></symbol>
</svg>`;

const icone = (nome) => `<svg aria-hidden="true"><use href="#i-${nome}"/></svg>`;

const sai = (texto) => `<div class="bolha sai"><p>${forte(texto)}</p></div>`;

const audio = (duracao) => `<div class="bolha sai"><div class="audio"><span class="audio-tocar"></span><svg class="onda" viewBox="0 0 120 24" preserveAspectRatio="none"><use href="#i-onda"/></svg><small>${duracao}</small></div></div>`;

const entra = (quem, ...linhas) => {
  const { nome, cargo } = ASSESSORES[quem];
  return `<div class="bolha entra ${quem}">
    <div class="quem"><img src="${retrato(quem)}" alt=""><strong>${nome}</strong><small>${cargo}</small></div>
    ${linhas.map((linha) => `<p>${forte(linha)}</p>`).join('')}
  </div>`;
};

const cena = (quem, ...bolhas) => `<div class="cena ${quem}">${bolhas.join('')}</div>`;

const flutuante = (quem, rotulo, valor, extra = '', estilo = '') =>
  `<div class="flutuante ${quem} ${extra}" style="${estilo}"><span>${rotulo}</span><strong>${valor}</strong></div>`;

const contas = (linhas) => `<ul class="contas">${linhas.map(([rotulo, valor, detalhe]) =>
  `<li><span>${rotulo}${detalhe ? `<small>${detalhe}</small>` : ''}</span><strong>${valor}</strong></li>`).join('')}</ul>`;

const kpis = () => `<div class="kpis">
  <div class="kpi"><small>Entradas</small><strong class="valor-entrada">R$ 6.200</strong></div>
  <div class="kpi"><small>Saídas</small><strong class="valor-saida">R$ 4.130</strong></div>
  <div class="kpi"><small>Saldo do mês</small><strong>R$ 2.070</strong></div>
</div>`;

const tabletTopo = () => `<div class="tablet-topo">
  <img src="/assets/logo-fundo-escuro.png" alt="">
  <span class="tablet-quem"><img src="${retrato('caio')}" alt=""> Finanças, por Caio</span>
</div>`;

const abas = (ativa) => `<div class="abas">${['Visão geral', 'Fluxo', 'Gastos'].map((aba) =>
  `<span class="aba ${aba === ativa ? 'ativa' : ''}">${aba}</span>`).join('')}</div>`;

const aindaVai = () => `<div class="cartao-painel">
  <h4>Ainda vai acontecer</h4>
  <ul class="linhas">
    <li><span>Vai entrar</span><strong>R$ 0</strong></li>
    <li><span>Vai sair</span><strong>R$ 650</strong></li>
    <li><span>Saldo previsto</span><strong>R$ 1.420</strong></li>
  </ul>
</div>`;

// Barra com a ponta de cima arredondada e a base reta, apoiada no eixo.
const barra = (classe, x, topo, base, largura = 26, raio = 4) =>
  `<path class="${classe}" d="M${x} ${base}V${topo + raio}a${raio} ${raio} 0 0 1 ${raio}-${raio}h${largura - 2 * raio}a${raio} ${raio} 0 0 1 ${raio} ${raio}V${base}Z"/>`;

const graficoFluxo = () => {
  const meses = [
    ['jun', 124, 92], ['jul', 124, 101], ['ago', 131, 87],
    ['set', 126, 94], ['out', 133, 105], ['nov', 133, 89],
  ];
  const base = 170;
  const previsto = 14;
  const barras = meses.map(([rotulo, entrada, saida], i) => {
    const x = 12 + i * 80;
    const topoSaida = base - saida;
    const atual = rotulo === 'nov';
    return `${barra('barra-entrada', x, base - entrada, base)}
      ${barra('barra-saida', x + 30, topoSaida, base)}
      ${atual ? barra('barra-prevista', x + 30, topoSaida - 2 - previsto, topoSaida - 2) : ''}
      <text x="${x + 28}" y="194" class="${atual ? 'atual' : ''}">${rotulo}</text>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 480 200" aria-hidden="true">
    <line class="eixo" x1="0" x2="480" y1="170" y2="170"/>
    ${barras}
  </svg>`;
};

const categorias = () => {
  const linhas = [['🏠 Moradia', 2100], ['🛒 Mercado', 860], ['🚗 Transporte', 420], ['🍽️ Alimentação', 390], ['🛍️ Compras', 360]];
  const maior = linhas[0][1];
  return `<ul class="categorias">${linhas.map(([rotulo, valor]) =>
    `<li><span>${rotulo}</span><strong>R$ ${valor.toLocaleString('pt-BR')}</strong><i class="medida" style="width:${(valor / maior) * 100}%"></i></li>`).join('')}</ul>`;
};

const relatorio = ({ comValores }) => {
  const itens = [
    ['Troca de pneu', '08/11/2026 · Borracharia · 84.200 km', 'R$ 900,00'],
    ['Troca de óleo', '12/08/2026 · Oficina do Zé · 81.050 km', 'R$ 250,00'],
    ['Pastilhas de freio', '20/05/2026 · Oficina do Zé · 78.300 km', 'R$ 340,00'],
  ];
  return `<div class="caixa-valores"><span class="caixa ${comValores ? 'marcada' : ''}">${comValores ? icone('check') : ''}</span>Mostrar os valores</div>
    <h3>Honda Civic</h3>
    <p class="relatorio-sub">Histórico de manutenção</p>
    <ul class="relatorio-lista">${itens.map(([servico, detalhe, valor]) =>
    `<li><strong>${servico}</strong><span>${detalhe}</span>${comValores ? `<b>${valor}</b>` : ''}</li>`).join('')}</ul>
    <p class="relatorio-nota">Informações anotadas pelo dono. Este relatório não é vistoria nem laudo.</p>`;
};

const promessa = (titulo, detalhe, nomeIcone = 'escudo') =>
  `<div class="promessa">${icone(nomeIcone)}<div><strong>${titulo}</strong>${detalhe ? `<span>${detalhe}</span>` : ''}</div></div>`;

// ---------- Tipos de slide ----------

// `n` e `i` entram em `montar`, para o fundo saber em que parte do panorama está.
const capa = (corpo) => ({ tipo: 'capa', corpo });

const tela = ({ titulo, apoio, palco, nota, depois, grande }) => ({
  tipo: 'tela',
  nota,
  corpo: `<div class="conteudo">
    ${titulo ? `<h2 class="${grande ? 'grande' : ''}">${titulo}</h2>` : ''}
    ${apoio ? `<p class="apoio">${forte(apoio)}</p>` : ''}
    <div class="palco">${palco ?? ''}${depois ? `<p class="apoio depois">${forte(depois)}</p>` : ''}</div>
  </div>`,
});

const manifesto = ({ titulo, realce, apoio }) => tela({
  palco: `<div class="manifesto">
    <h2 class="grande">${titulo}</h2>
    <h2 class="grande realce">${realce}</h2>
    <p class="apoio">${forte(apoio)}</p>
  </div>`,
});

const fechamento = () => ({ tipo: 'fechamento' });

const capaAssessor = ({ h1, quem, flutuantes }) => capa(`
  <div class="capa-texto"><h1>${h1}</h1></div>
  <div class="retrato-grande"><img src="${retrato(quem)}" alt=""></div>
  <div class="flutuantes">${flutuantes}</div>
  <div class="capa-rodape"><span class="arraste">Arraste <span aria-hidden="true">→</span></span></div>
`);

// ---------- Os carrosséis ----------

export const CARROSSEIS = [
  {
    pasta: '01-conheca-o-nuvexx',
    tema: 'escuro',
    luzes: ['#7657FF', '#2563EB'],
    selo: true,
    slides: [
      capa(`
        <div class="capa-texto capa-centro"><h1>Escreva ou fale.<br>Seu dia fica em ordem.</h1></div>
        <div class="celular-moldura">
          <span class="celular-halo"></span><span class="celular-aro"></span>
          <div class="celular"><div class="tela">
            <div class="barra-celular"><span>09:00</span><span class="ilha"></span><span class="sinais"></span></div>
            <div class="app-topo"><img class="simbolo" src="/assets/simbolo.png" alt=""><div><div>Nuvexx</div><small>Caio, Cris e Nina</small></div></div>
            <div class="conversa">
              ${sai('gastei 50 no mercado')}
              ${entra('caio', '✅ *R$ 50,00* em 🛒 Mercado', 'Mercado, hoje.')}
              ${audio('0:04')}
              ${entra('cris', '🎤 Ouvi: "Marca dentista quinta às três da tarde."', '✅ *Dentista*: quinta, 12/11, às 15:00.')}
            </div>
          </div></div>
        </div>
        ${flutuante('caio', '🛒 Mercado', 'R$ 50,00', 'solto', 'left:44px;top:560px')}
        ${flutuante('cris', '📅 Dentista', 'quinta, 15:00', 'solto', 'right:44px;top:720px')}
        ${flutuante('nina', '📝 Pagar luz', 'sexta, 15:00', 'solto', 'left:44px;top:940px')}
        <div class="capa-rodape" style="left:auto;right:44px;bottom:60px"><span class="arraste">Arraste <span aria-hidden="true">→</span></span></div>
      `),
      manifesto({
        titulo: 'Gasto que sumiu da cabeça, consulta esquecida, conta que venceu ontem.',
        realce: 'Quase sempre, só faltou anotar.',
        apoio: 'Escreva ou grave um áudio na hora, do jeito que vier.',
      }),
      tela({
        titulo: 'Um assessor para cada parte da sua rotina.',
        palco: `<div class="equipe">
          <div class="membro caio"><img src="${retrato('caio')}" alt=""><div><h3>Caio</h3><small>Assessor Financeiro</small><p>Cuida do seu dinheiro.</p></div></div>
          <div class="membro cris"><img src="${retrato('cris')}" alt=""><div><h3>Cris</h3><small>Assessora de Agenda</small><p>Cuida da sua agenda.</p></div></div>
          <div class="membro nina"><img src="${retrato('nina')}" alt=""><div><h3>Nina</h3><small>Assessora de Tarefas</small><p>Cuida das suas tarefas.</p></div></div>
        </div>`,
        nota: 'Os assessores são personagens virtuais, e os retratos são ilustrações.',
      }),
      tela({
        titulo: 'Você não escolhe com quem falar.',
        apoio: 'A mensagem vai sozinha para quem resolve.',
        palco: `<div class="triagem">
          <div class="pedido-resultado"><span class="pedido-texto">gastei 50 no mercado</span>
            <div class="resultado caio"><img src="${retrato('caio')}" alt=""><div><strong>R$ 50,00</strong><span>🛒 Mercado</span></div></div></div>
          <div class="pedido-resultado"><span class="pedido-texto">marca reunião com Ana amanhã às 10</span>
            <div class="resultado cris"><img src="${retrato('cris')}" alt=""><div><strong>Reunião com Ana</strong><span>amanhã, às 10:00</span></div></div></div>
          <div class="pedido-resultado"><span class="pedido-texto">me lembra de renovar o seguro dia 20</span>
            <div class="resultado nina"><img src="${retrato('nina')}" alt=""><div><strong>Renovar o seguro</strong><span>dia 20</span></div></div></div>
        </div>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'E, se tiver horário, vira aviso.',
        palco: cena('cris',
          entra('cris', '⏰ Lembrete: *Reunião com Ana*, hoje, às 10:00.'),
          entra('nina', '⏰ Lembrete: *Pagar luz*, hoje, às 15:00.')),
        depois: 'A Cris avisa 1 hora antes, e a Nina, 2 horas antes. Pelo WhatsApp, se estiver conectado, ou por e-mail.',
        nota: DADOS_DE_EXEMPLO,
      }),
      fechamento(),
    ],
    legenda: `Gasto que sumiu da cabeça, consulta esquecida, conta que venceu ontem. Quase sempre, só faltou anotar.

O Nuvexx são três assessores virtuais na mesma conversa: Caio cuida do seu dinheiro, Cris da sua agenda e Nina das suas tarefas. Você escreve pelo site ou grava um áudio no WhatsApp, do seu jeito, e eles anotam e avisam.

O lançamento oficial é em breve. A fila de espera não tem custo e não cria conta: o link está na bio.

Os assessores são personagens virtuais, e as conversas usam dados de exemplo.`,
    hashtags: '#nuvexx #organização #produtividade #rotina #vidaorganizada',
  },

  {
    pasta: '02-caio-financas',
    tema: 'escuro',
    quem: 'caio',
    luzes: ['#2563EB', '#7657FF'],
    slides: [
      capaAssessor({
        quem: 'caio',
        h1: 'Veja para onde o dinheiro foi, e o que ainda vai sair.',
        flutuantes: flutuante('caio', '🛒 Mercado', 'R$ 50,00') + flutuante('caio', '🚗 Transporte', 'R$ 23,50') + flutuante('caio', '🏠 Moradia', 'R$ 1.800,00'),
      }),
      tela({
        titulo: 'Gastou ou recebeu, é só escrever.',
        apoio: 'O Caio anota e já coloca no lugar certo.',
        palco: cena('caio',
          sai('gastei 50 no mercado'),
          entra('caio', '✅ *R$ 50,00* em 🛒 Mercado', 'Mercado, hoje.'),
          sai('recebi 3000 de salário'),
          entra('caio', '✅ *R$ 3.000,00* de entrada', 'Salário, hoje.')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Cada gasto cai na categoria certa.',
        palco: `<ul class="etiquetas">
          <li>🛒 Mercado</li><li>🍽️ Alimentação</li><li>🚗 Transporte</li><li>🏠 Moradia</li>
          <li>📱 Assinaturas</li><li>💊 Saúde</li><li>🎓 Educação</li><li>🎉 Lazer</li>
          <li>🛍️ Compras</li><li>🐾 Pets</li><li>🔧 Manutenção de Veículo</li>
        </ul>
        ${cena('caio',
    sai('categoria lazer'),
    entra('caio', '🔁 *Presente* agora está em 🎉 Lazer. Da próxima vez já coloco lá.'))}`,
        nota: 'Se errar, é só corrigir. Dados de exemplo.',
      }),
      tela({
        titulo: 'Cada conta e cartão no seu lugar.',
        palco: contas([
          ['Conta corrente', 'R$ 3.482,10'],
          ['Poupança', 'R$ 5.000,00'],
          ['Cartão de crédito', 'R$ 1.246,90', 'gasto no mês'],
        ]),
        depois: 'O saldo é o inicial mais as entradas menos os gastos. Tudo vem do que você anota: não há ligação com bancos.',
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'O parcelado e o que se repete também.',
        palco: cena('caio',
          sai('tv 1200 em 10x'),
          entra('caio', '✅ *10x de R$ 120,00* em 🛍️ Compras', 'Tv, total de R$ 1.200,00. Primeira parcela: hoje.'),
          sai('aluguel 1800 todo dia 10'),
          entra('caio', '✅ *R$ 1.800,00* de saída todo mês em 🏠 Moradia', 'Aluguel. Próxima: 10/11.')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Pergunte do seu jeito.',
        apoio: 'Resumo do mês, total de uma categoria, o que ainda vai entrar e sair.',
        palco: cena('caio',
          sai('quanto ainda vai sair'),
          entra('caio', '*Ainda em novembro*', 'Vai entrar: *R$ 0,00*<br>Vai sair: *R$ 2.100,00*', '10/11 Aluguel: −R$ 1.800,00<br>15/11 Luz: −R$ 300,00')),
        nota: DADOS_DE_EXEMPLO,
      }),
      fechamento(),
    ],
    legenda: `Sabe aquele gasto que você jura que não fez? É só anotar na hora.

Escreva "gastei 50 no mercado", e o Caio coloca na categoria certa. Ele também calcula o saldo de cada conta, cuida de parcelas e do que se repete, e responde quanto ainda vai sair no mês.

Tudo vem do que você anota: não há ligação com bancos, e o Nuvexx não movimenta dinheiro.

O lançamento é em breve. Entre na fila de espera pelo link na bio.

Caio é um personagem virtual, e os valores são de exemplo.`,
    hashtags: '#nuvexx #finançaspessoais #controlefinanceiro #organizaçãofinanceira #dinheiro',
  },

  {
    pasta: '03-painel',
    tema: 'escuro',
    quem: 'caio',
    luzes: ['#7657FF', '#2563EB'],
    slides: [
      capa(`
        <div class="capa-texto"><h1>Seus números no painel, na ordem que você quiser.</h1></div>
        <div class="tablet capa-tablet">
          ${tabletTopo()}${abas('Visão geral')}${kpis()}
          <div class="duas">${aindaVai()}
            <div class="cartao-painel"><h4>Próximos compromissos</h4><ul class="linhas">
              <li><span>Reunião com Ana</span><strong>amanhã, 10:00</strong></li>
              <li><span>Dentista</span><strong>quinta, 15:00</strong></li>
              <li><span>Pagar luz</span><strong>sexta, 15:00</strong></li>
            </ul></div>
          </div>
        </div>
        <div class="capa-rodape" style="left:auto;right:60px"><span class="arraste">Arraste <span aria-hidden="true">→</span></span></div>
      `),
      tela({
        titulo: 'O mês inteiro em uma olhada.',
        apoio: 'Entradas, saídas, saldo e o que ainda vai acontecer até o fim do mês.',
        palco: `<div class="tablet">${abas('Visão geral')}${kpis()}<div style="height:16px"></div>${aindaVai()}</div>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Seis meses de fluxo, lado a lado.',
        palco: `<div class="tablet">${abas('Fluxo')}<div class="cartao-painel">
          <h4>Fluxo mensal, 6 meses</h4>
          ${graficoFluxo()}
          <ul class="legenda">
            <li><i class="l-entrada"></i><span>Entradas em novembro</span><strong>R$ 6.200</strong></li>
            <li><i class="l-saida"></i><span>Saídas em novembro</span><strong>R$ 4.130</strong></li>
            <li><i class="l-prevista"></i><span>Ainda vai sair</span><strong>R$ 650</strong></li>
          </ul>
        </div></div>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Os gastos por categoria, do maior para o menor.',
        palco: `<div class="tablet">${abas('Gastos')}<div class="cartao-painel"><h4>Gastos por categoria</h4>${categorias()}</div></div>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Arraste os blocos e deixe do seu jeito.',
        apoio: 'Cada painel tem a própria ordem, e ela fica salva na sua conta.',
        palco: `<div class="blocos">
          <div class="bloquinho"><span class="alca"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Saldo do mês</span></div>
          <div class="bloquinho erguido"><span class="alca"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Gastos por categoria</span></div>
          <div class="bloquinho vaga">Solte aqui</div>
          <div class="bloquinho"><span class="alca"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Próximos compromissos</span></div>
          <div class="bloquinho"><span class="alca"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Tarefas pendentes</span></div>
        </div>`,
      }),
      tela({
        titulo: 'Quer mostrar para alguém? Gere um link.',
        palco: `<div class="cartao-link">
          <div class="cartao-link-topo"><span class="icone-redondo">${icone('link')}</span><div><strong>Link só de leitura</strong><span>Quem abre só vê, e não mexe em nada.</span></div></div>
          <ul class="marcas">
            <li>Vale por 30 dias</li>
            <li>Traz apenas os blocos daquele painel</li>
            <li>Criar outro ou parar de compartilhar cancela o anterior</li>
          </ul>
        </div>`,
      }),
      fechamento(),
    ],
    legenda: `Entradas, saídas, saldo, o que ainda vai acontecer, fluxo de 6 meses e gastos por categoria, tudo em um painel só.

Você arrasta os blocos e organiza cada painel do seu jeito. E, se quiser mostrar para alguém, gera um link só de leitura, que vale por 30 dias.

O painel usa o que você anota com o Caio, sem ligação com bancos.

O lançamento é em breve. Entre na fila de espera pelo link na bio.

Caio é um personagem virtual, e os valores são de exemplo.`,
    hashtags: '#nuvexx #finançaspessoais #controlefinanceiro #planejamentofinanceiro #organização',
  },

  {
    pasta: '04-cris-agenda',
    tema: 'claro',
    quem: 'cris',
    luzes: ['#7657FF', '#2563EB'],
    slides: [
      capaAssessor({
        quem: 'cris',
        h1: 'Sua agenda, sem abrir agenda.',
        flutuantes: flutuante('cris', '📅 Reunião com Ana', 'amanhã, 10:00') + flutuante('cris', '📅 Dentista', 'quinta, 15:00') + flutuante('cris', '⏰ Te aviso', '1 hora antes'),
      }),
      tela({
        titulo: 'Escreveu ou gravou, marcou.',
        apoio: 'Diga o compromisso e o dia. A Cris marca e avisa antes.',
        palco: cena('cris',
          audio('0:04'),
          entra('cris', '🎤 Ouvi: "Marca dentista quinta às três da tarde."', '✅ *Dentista*: quinta, 12/11, às 15:00.', 'Te aviso 1 hora antes.')),
        nota: `${DADOS_DE_EXEMPLO} O áudio funciona pelo WhatsApp conectado.`,
      }),
      tela({
        titulo: 'Sem o dia, ela pergunta.<br>Mudou de ideia,<br>é só pedir de novo.',
        palco: cena('cris',
          sai('agendar reunião com José'),
          entra('cris', 'Para quando é *Reunião com José*? Mande o dia e o horário, como *amanhã às 10*.'),
          sai('remarcar dentista para sexta às 9'),
          entra('cris', '🔁 *Dentista* agora é sexta, 13/11, às 09:00.')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        palco: `<div class="hora">09:00</div>
          ${cena('cris', entra('cris', '⏰ Lembrete: *Reunião com Ana*, hoje, às 10:00.'))}
          <h2 style="margin-top:24px">Uma hora antes, o aviso chega.</h2>
          <p class="apoio">Pelo WhatsApp, se estiver conectado, ou por e-mail.</p>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        palco: `<div class="hora">05:30</div>
          ${cena('cris', entra('cris', 'Bom dia, Ana!', 'Seu dia vai das *10:00* às *16:00*, com *2 compromissos*. Você tem *4h livres* entre Reunião com Ana e Dentista.'))}
          <h2 style="margin-top:24px">Você acorda sabendo como vai ser o dia.</h2>
          <p class="apoio">Dia sem nada marcado não gera envio, e você pode desligar.</p>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'O dia inteiro em uma linha.',
        palco: `<svg class="arco" viewBox="0 -28 400 186" aria-hidden="true">
          <path class="arco-base" d="M30 150A170 170 0 0 1 370 150"/>
          <path class="arco-ocupado" d="M62.5 50A170 170 0 0 1 100 12.5"/>
          <path class="arco-ocupado" d="M300 12.5A170 170 0 0 1 337.5 50"/>
          <circle class="arco-agora" cx="173" cy="-18" r="9"/>
          <text class="arco-hora" x="52" y="30" text-anchor="end">10:00</text>
          <text class="arco-hora" x="348" y="30">15:00</text>
          <text class="arco-livre" x="200" y="92" text-anchor="middle">4h livres</text>
          <text class="arco-apoio" x="200" y="120" text-anchor="middle">entre Reunião com Ana e Dentista</text>
        </svg>`,
        depois: 'A tela da agenda mostra o dia em arco, com a hora atual e o maior intervalo livre no centro.',
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Se quiser, vai também para o Google Agenda.',
        palco: `<ol class="semana">
          <li><small>seg</small>9</li><li><small>ter</small>10</li><li><small>qua</small>11</li><li class="hoje"><small>qui</small>12</li><li><small>sex</small>13</li><li><small>sáb</small>14</li><li><small>dom</small>15</li>
        </ol>
        <div class="evento"><strong>Dentista</strong><span>quinta, 15:00 às 16:00</span></div>`,
        depois: 'Os compromissos vão do Nuvexx para a sua agenda, inclusive os marcados antes de conectar. É opcional.',
        nota: DADOS_DE_EXEMPLO,
      }),
      fechamento(),
    ],
    legenda: `Diga o compromisso e o dia. A Cris marca, avisa 1 hora antes e, às 5h30, conta como será o seu dia, com os compromissos, o maior intervalo livre e as tarefas de hoje.

Mudou de ideia? É só escrever "remarcar dentista para sexta às 9". E, se você quiser, os compromissos vão também para o Google Agenda.

O lançamento é em breve. Entre na fila de espera pelo link na bio.

Cris é uma personagem virtual, e os compromissos são de exemplo.`,
    hashtags: '#nuvexx #agenda #organização #produtividade #rotina',
  },

  {
    pasta: '05-nina-tarefas',
    tema: 'escuro',
    quem: 'nina',
    luzes: ['#A5B4FC', '#7657FF'],
    slides: [
      capaAssessor({
        quem: 'nina',
        h1: 'Anotou com a Nina, saiu da cabeça.',
        flutuantes: flutuante('nina', '📝 Pagar luz', 'sexta, 15:00') + flutuante('nina', '📝 Comprar leite', 'sem data') + flutuante('nina', '📝 Renovar o seguro', 'dia 20'),
      }),
      tela({
        palco: `<span class="passo-numero">1</span>
          <h2>Anote, com ou sem data.</h2>
          <p class="apoio">Comece com “tarefa” para marcar horário, ou escreva “preciso” e o que falta fazer.</p>
          ${cena('nina',
          sai('tarefa pagar luz sexta às 15h'),
          entra('nina', '✅ *Pagar luz*: sexta, 13/11, às 15:00.', 'Te aviso 2 horas antes.'),
          sai('preciso comprar leite'),
          entra('nina', '✅ *Comprar leite*: sem data.'))}`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        palco: `<span class="passo-numero">2</span>
          <h2>Receba o aviso.</h2>
          <div class="hora" style="margin-top:20px">13:00</div>
          ${cena('nina', entra('nina', '⏰ Lembrete: *Pagar luz*, hoje, às 15:00.'))}
          <p class="apoio">Com horário, ela avisa 2 horas antes. Só com o dia, o aviso sai às 8h.</p>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Precisa de mais tempo? É só pedir para adiar.',
        palco: cena('nina',
          sai('adiar tarefa luz para segunda às 10h'),
          entra('nina', '🔁 *Pagar luz* agora é para segunda, 16/11, às 10:00.'),
          sai('tarefas'),
          entra('nina', '*Tarefas pendentes*', '• Pagar luz (segunda, 16/11, às 10:00)<br>• Comprar leite (sem data)')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        palco: `<span class="passo-numero">3</span>
          <h2>Terminou? Avise.</h2>
          ${cena('nina',
          sai('concluí comprar leite'),
          entra('nina', '🎉 *Comprar leite* concluída. Falta 1 tarefa.'))}
          <p class="apoio">A Nina risca da lista e conta o que ainda falta fazer.</p>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      fechamento(),
    ],
    legenda: `Pendência com dia, com horário ou sem nada disso: a Nina guarda, avisa e risca quando você terminar.

Com horário, ela avisa 2 horas antes. Só com o dia, o aviso sai às 8h. Se precisar de mais tempo, é só pedir para adiar.

O lançamento é em breve. Entre na fila de espera pelo link na bio.

Nina é uma personagem virtual, e as tarefas são de exemplo.`,
    hashtags: '#nuvexx #tarefas #produtividade #organização #rotina',
  },

  {
    pasta: '06-historico-do-veiculo',
    tema: 'escuro',
    quem: 'caio',
    luzes: ['#2563EB', '#A5B4FC'],
    slides: [
      capa(`
        <div class="capa-texto"><h1 style="font-size:92px">O histórico do seu carro, pronto para mostrar a quem for comprar.</h1></div>
        <div class="relatorio capa-relatorio">${relatorio({ comValores: false })}</div>
        <div class="capa-rodape" style="left:auto;right:60px;bottom:60px"><span class="arraste">Arraste <span aria-hidden="true">→</span></span></div>
      `),
      tela({
        titulo: 'Cada manutenção fica guardada.',
        apoio: 'Com data, serviço, oficina e quilometragem.',
        palco: cena('caio',
          sai('troca de pneu 900 no civic na borracharia ontem'),
          entra('caio', '✅ *Manutenção anotada* no histórico de *Honda Civic*', '🔧 Troca de pneu<br>📍 Borracharia<br>📅 08/11/2026<br>💵 R$ 900,00')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'O Caio pergunta só o que faltar.',
        palco: cena('caio',
          sai('troca de óleo 250 no civic'),
          entra('caio', 'Onde foi feita? Mande o nome da oficina ou *pular*, se não lembrar.'),
          sai('oficina do zé'),
          entra('caio', 'Quando foi feita? Mande *hoje*, *ontem* ou a data, como *15/10*.')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Na hora de vender, é só abrir o relatório.',
        palco: `<div class="relatorio">${relatorio({ comValores: false })}</div>`,
        depois: 'Salve em PDF e mostre a quem for comprar.',
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Os valores só aparecem se você marcar.',
        palco: `<div class="relatorio">${relatorio({ comValores: true })}</div>`,
        nota: DADOS_DE_EXEMPLO,
      }),
      fechamento(),
    ],
    legenda: `Na hora de vender o carro, todo mundo pergunta: e a manutenção?

Cada serviço fica guardado com data, oficina e quilometragem. É só escrever "troca de pneu 900 no civic na borracharia ontem", e o Caio pergunta só o que faltar.

Depois, o relatório vira um PDF para mostrar a quem for comprar, e os valores só aparecem se você marcar.

São informações anotadas por você: o relatório não é vistoria nem laudo.

O lançamento é em breve. Entre na fila de espera pelo link na bio.

Caio é um personagem virtual, e os dados são de exemplo.`,
    hashtags: '#nuvexx #carro #manutençãoautomotiva #carrosusados #organização',
  },

  {
    pasta: '07-audio-no-whatsapp',
    tema: 'escuro',
    onda: true,
    luzes: ['#2563EB', '#7657FF'],
    slides: [
      capa(`
        <div class="capa-texto"><h1>Um áudio no WhatsApp resolve.</h1></div>
        <div class="capa-audio"><span class="audio-tocar"></span><svg class="onda" viewBox="0 0 120 24" preserveAspectRatio="none"><use href="#i-onda"/></svg></div>
        <div class="capa-audio-resultados">
          ${flutuante('caio', '🚗 Gasolina', 'R$ 50,00')}
          ${flutuante('cris', '📅 Dentista', 'quinta, 15:00')}
          ${flutuante('nina', '📝 Comprar leite', 'sem data')}
        </div>
        <div class="capa-rodape" style="left:auto;right:80px;bottom:60px"><span class="arraste">Arraste <span aria-hidden="true">→</span></span></div>
      `),
      tela({
        titulo: 'O gasto fica anotado antes de você chegar.',
        apoio: 'Saindo do posto, grave o que gastou.',
        palco: cena('caio',
          audio('0:03'),
          entra('caio', '🎤 Ouvi: "Gastei 50 reais de gasolina."', '✅ *R$ 50,00* em 🚗 Transporte', 'Gasolina, hoje.')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'O assessor mostra o que ouviu.',
        apoio: 'Ouviu errado? É só mandar <strong>desfazer</strong>.',
        palco: cena('cris',
          audio('0:04'),
          entra('cris', '🎤 Ouvi: "Marca dentista quinta às três da tarde."', '✅ *Dentista*: quinta, 12/11, às 15:00.', 'Ouvi errado? Mande *desfazer*.')),
        nota: DADOS_DE_EXEMPLO,
      }),
      tela({
        titulo: 'Um pedido de cada vez.',
        apoio: 'Cada áudio vai para o assessor certo.',
        palco: cena('nina',
          audio('0:02'),
          entra('nina', '🎤 Ouvi: "Preciso comprar leite."', '✅ *Comprar leite*: sem data.'),
          audio('0:03'),
          entra('caio', '🎤 Ouvi: "Almoço 38 reais."', '✅ *R$ 38,00* em 🍽️ Alimentação')),
        nota: DADOS_DE_EXEMPLO,
      }),
      manifesto({
        titulo: 'O Nuvexx não grava seus áudios.',
        realce: 'Fica só o que foi anotado.',
        apoio: 'Para transformar a voz em texto, o áudio passa por um serviço de transcrição, como explica a nossa política de privacidade.',
      }),
      tela({
        titulo: 'Prefere digitar? Também dá.',
        palco: `<div class="promessas compactas">
          ${promessa('Computador ou celular', 'Abra no navegador, sem instalar nada.', 'tela')}
          ${promessa('Site ou WhatsApp', 'A aba Conversa fica no site. WhatsApp é opcional.', 'conversa')}
          ${promessa('Botões, se preferir', 'Tudo também dá para fazer por formulários.', 'blocos')}
          ${promessa('Avisos por e-mail', 'Sem WhatsApp, os lembretes chegam por lá.', 'carta')}
        </div>`,
        nota: 'O áudio funciona pelo WhatsApp conectado. Na conversa do site, por enquanto, só dá para escrever.',
      }),
      fechamento(),
    ],
    legenda: `Saindo do posto, no meio da rua, com a mão ocupada: grave um áudio no WhatsApp, e o assessor certo anota.

Ele responde mostrando o que ouviu e, se ouvir errado, é só mandar "desfazer". O Nuvexx não grava o áudio nem o texto transcrito: fica só o que foi anotado. Para virar texto, o áudio passa por um serviço de transcrição, como explica a política de privacidade.

Prefere digitar? Tudo funciona também pelo site, sem instalar nada. Conectar o WhatsApp é opcional.

O lançamento é em breve. Entre na fila de espera pelo link na bio.

Os assessores são personagens virtuais, e as conversas usam dados de exemplo.`,
    hashtags: '#nuvexx #whatsapp #produtividade #organização #rotina',
  },

  {
    pasta: '08-seus-dados',
    tema: 'claro',
    luzes: ['#2563EB', '#7657FF'],
    slides: [
      capa(`
        <div class="capa-texto"><h1>Seus números são só seus.</h1></div>
        <svg class="escudo-grande" viewBox="0 0 24 24" aria-hidden="true">
          <defs><linearGradient id="grad-escudo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#7657FF"/></linearGradient></defs>
          <path d="M12 3 5 6v5.5c0 4.5 2.9 7.9 7 9.5 4.1-1.6 7-5 7-9.500V6Z" fill="url(#grad-escudo)"/>
          <path d="m9 12 2.200 2.200L15.200 10" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="flutuantes" style="top:640px">
          <div class="flutuante"><strong>Não pede dados bancários</strong></div>
          <div class="flutuante"><strong>Não movimenta dinheiro</strong></div>
          <div class="flutuante"><strong>Sem publicidade</strong></div>
        </div>
        <div class="capa-rodape"><span class="arraste">Arraste <span aria-hidden="true">→</span></span></div>
      `),
      tela({
        titulo: 'O Nuvexx não se conecta ao seu banco.',
        palco: `<div class="promessas">
          ${promessa('Não pede dados bancários', 'Sem acesso ao seu banco.')}
          ${promessa('Não movimenta dinheiro', 'Só anota o que você informa.')}
        </div>`,
        depois: 'Os saldos vêm só do que você anota.',
      }),
      tela({
        titulo: 'Cada conta só vê os próprios dados.',
        palco: `<div class="promessas">
          ${promessa('Seus números são só seus', 'Cada conta só enxerga o que é dela.')}
          ${promessa('Senha guardada só como hash', 'Ninguém lê a sua senha.')}
        </div>`,
      }),
      tela({
        titulo: 'Seus áudios não ficam guardados.',
        palco: `<div class="promessas">
          ${promessa('O Nuvexx não grava seus áudios', 'Nem o texto transcrito: fica só o que foi anotado.')}
        </div>`,
        depois: 'Para transformar a voz em texto, o áudio passa por um serviço de transcrição, como explica a nossa política de privacidade.',
      }),
      tela({
        titulo: 'Os dados são seus, e a decisão também.',
        palco: `<div class="promessas">
          ${promessa('Baixe tudo o que você anotou', 'Quando quiser, pela aba Conta.', 'dados')}
          ${promessa('Apague a conta, se preferir', 'Sempre que quiser, pela aba Conta.')}
          ${promessa('Sem publicidade', 'Não vendemos seus dados.')}
        </div>`,
      }),
      fechamento(),
    ],
    legenda: `Um app que cuida do seu dinheiro e da sua rotina precisa ser claro sobre os seus dados. Então, aqui vai:

O Nuvexx não pede dados bancários e não movimenta dinheiro. Cada conta só vê os próprios dados, e a senha fica guardada só como hash. O Nuvexx não grava o áudio: para virar texto, ele só passa por um serviço de transcrição. E você pode baixar tudo ou apagar a conta quando quiser. Sem publicidade.

O lançamento é em breve. Entre na fila de espera pelo link na bio.`,
    hashtags: '#nuvexx #privacidade #segurançadigital #dados #organização',
  },
];

// ---------- Montagem ----------

function panorama(carrossel, i, n) {
  const claro = carrossel.tema === 'claro';
  const alfa = claro ? '30' : '66';
  const luzes = [];
  for (let k = 0; k <= n; k += 1) {
    const cor = carrossel.luzes[k % carrossel.luzes.length];
    const x = 1080 * k + (k % 2 ? 760 : 60);
    const y = k % 2 ? 40 : 780;
    luzes.push(`<i class="luz" style="left:${x - 620}px;top:${y - 620}px;width:1240px;height:1240px;background:radial-gradient(circle, ${cor}${alfa}, ${cor}1c 44%, transparent 68%)"></i>`);
  }
  // O "xx" da marca, enorme e bem apagado, cruzando os slides aos pares.
  const xis = [];
  for (let k = 0; k < n; k += 2) {
    xis.push(`<i class="xis" style="left:${1080 * k + 330}px;top:${k % 4 ? -40 : 470}px;width:1500px;height:952px;opacity:${claro ? 0.05 : 0.07}"></i>`);
  }
  let onda = '';
  if (carrossel.onda) {
    const largura = n * 1080;
    const barras = [];
    for (let x = 0, s = 7; x < largura; x += 24) {
      s = (s * 73 + 41) % 101;
      const altura = 8 + (s % 36);
      barras.push(`<rect x="${x}" y="${46 - altura}" width="10" height="${altura}" rx="5"/>`);
    }
    onda = `<svg class="onda-fundo" width="${largura}" viewBox="0 0 ${largura} 46"><g fill="currentColor">${barras.join('')}</g></svg>`;
  }
  return `<div class="panorama" style="left:${-1080 * i}px;width:${1080 * n}px">${luzes.join('')}${xis.join('')}${onda}</div><div class="pontos"></div>`;
}

function etiqueta(quem) {
  if (!quem) return '';
  return `<span class="etiqueta"><img src="${retrato(quem)}" alt="">${ASSESSORES[quem].nome}, ${ASSESSORES[quem].cargo.replace(/^Assessora? /, '').replace(/^de /, '').toLowerCase()}</span>`;
}

function slideFechamento(i, n) {
  const xis = `<i class="xis" style="left:${180}px;top:560px;width:1500px;height:952px"></i>`;
  return `<div class="slide fechamento">
    ${xis}
    <div class="cabecalho"><img class="logo" src="/assets/logo-fundo-escuro.png" alt=""></div>
    <div class="fechamento-corpo">
      <div class="trio"><img src="${retrato('caio')}" alt=""><img src="${retrato('cris')}" alt=""><img src="${retrato('nina')}" alt=""></div>
      <h2>Entre na fila e comece quando abrir.</h2>
      <p>Não tem custo e não cria conta. Quando você puder começar a usar, avisamos pelo WhatsApp.</p>
      <div class="fechamento-acao"><span class="botao-final">nuvexx.com.br <span aria-hidden="true">→</span></span><span class="na-bio">Link na bio</span></div>
    </div>
    <div class="fechamento-fim"><span>${icone('check')}7 dias de teste grátis para começar</span></div>
  </div>`;
}

export function montarSlide(carrossel, i) {
  const n = carrossel.slides.length;
  const slide = carrossel.slides[i];
  if (slide.tipo === 'fechamento') return slideFechamento(i, n);
  const claro = carrossel.tema === 'claro';
  const logo = claro ? '/assets/logo-fundo-claro.png' : '/assets/logo-fundo-escuro.png';
  const direita = slide.tipo === 'capa' && carrossel.selo
    ? '<span class="selo"><span class="selo-ponto"></span><span><strong>Lançamento oficial</strong> em breve</span></span>'
    : etiqueta(carrossel.quem);
  const pe = slide.tipo === 'capa'
    ? ''
    : `<div class="pe">${slide.nota ? `<p class="nota">${slide.nota}</p>` : ''}<span class="seta" aria-hidden="true">→</span></div>`;
  return `<div class="slide ${claro ? 'claro' : ''}">
    ${panorama(carrossel, i, n)}
    <div class="cabecalho"><img class="logo" src="${logo}" alt="">${direita}</div>
    ${slide.corpo}
    ${pe}
  </div>`;
}

document.documentElement.classList.add('js');

const pedeMenosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Só anima o que está na tela, para não gastar bateria de quem está em outra parte da página.
function quandoVisivel(elemento, aoEntrar, aoSair) {
  new IntersectionObserver(
    ([registro]) => (registro.isIntersecting ? aoEntrar() : aoSair?.()),
    { threshold: 0.2 },
  ).observe(elemento);
}

function criarDigitando() {
  const bolha = document.createElement('div');
  bolha.className = 'bolha entra digitando';
  bolha.setAttribute('aria-hidden', 'true');
  bolha.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
  return bolha;
}

function iniciarMenu() {
  const topo = document.getElementById('topo');
  const botao = document.getElementById('abrir-menu');
  const definir = (aberto) => {
    topo.classList.toggle('aberto', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar o menu' : 'Abrir o menu');
  };
  botao.addEventListener('click', () => definir(!topo.classList.contains('aberto')));
  document.getElementById('menu').addEventListener('click', (evento) => {
    if (evento.target.closest('a')) definir(false);
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && topo.classList.contains('aberto')) {
      definir(false);
      botao.focus();
    }
  });
}

function iniciarRevelacao() {
  if (pedeMenosMovimento) return;
  const observador = new IntersectionObserver((registros) => {
    for (const registro of registros) {
      if (!registro.isIntersecting) continue;
      registro.target.classList.remove('oculto');
      observador.unobserve(registro.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const elemento of document.querySelectorAll('.revelar')) {
    if (elemento.getBoundingClientRect().top < innerHeight) continue;
    elemento.classList.add('oculto');
    observador.observe(elemento);
  }
}

function iniciarConversaDoTopo() {
  const conversa = document.getElementById('conversa-topo');
  if (pedeMenosMovimento) return;
  const bolhas = [...conversa.querySelectorAll('.bolha')];
  // A primeira troca de mensagens fica sempre à vista: o celular nunca aparece vazio.
  const fixas = 2;
  const digitando = criarDigitando();
  let ativo = false;
  let rodando = false;
  // Na primeira vez, a conversa espera o celular terminar de chegar.
  let pausaAntes = 1700;

  const esconder = (bolha) => {
    bolha.classList.add('oculta');
    bolha.classList.remove('surgindo');
  };
  const mostrar = (bolha) => {
    bolha.classList.remove('oculta');
    bolha.classList.add('surgindo');
  };

  async function rodar() {
    if (rodando) return;
    rodando = true;
    while (ativo) {
      bolhas.slice(fixas).forEach(esconder);
      await espera(pausaAntes);
      pausaAntes = 900;
      for (const bolha of bolhas.slice(fixas)) {
        if (!ativo) break;
        if (bolha.classList.contains('entra')) {
          // O "digitando" aparece no espaço já reservado da resposta, sem mexer na altura do celular.
          digitando.style.top = `${bolha.offsetTop}px`;
          conversa.append(digitando);
          await espera(900);
          digitando.remove();
        } else {
          await espera(700);
        }
        mostrar(bolha);
        await espera(350);
      }
      if (ativo) await espera(4000);
    }
    // Quem volta para esta parte da página não encontra a conversa pela metade.
    digitando.remove();
    bolhas.forEach(mostrar);
    rodando = false;
  }

  quandoVisivel(conversa, () => { ativo = true; rodar(); }, () => { ativo = false; });
}

function iniciarLuzDoTopo() {
  if (pedeMenosMovimento) return;
  const heroi = document.getElementById('inicio');
  quandoVisivel(heroi, () => heroi.classList.remove('pausado'), () => heroi.classList.add('pausado'));
}

const MENSAGENS_TRIAGEM = [
  { texto: '🎤 gastei 50 reais de gasolina', coluna: 'caio', titulo: 'R$ 50,00', detalhe: '🚗 Transporte' },
  { texto: 'marca reunião com Ana amanhã às 10', coluna: 'cris', titulo: 'Reunião com Ana', detalhe: 'amanhã, às 10:00' },
  { texto: 'me lembra de renovar o seguro dia 20', coluna: 'nina', titulo: 'Renovar o seguro', detalhe: 'dia 20' },
  { texto: 'recebi 3000 de salário', coluna: 'caio', titulo: 'R$ 3.000,00', detalhe: 'Entrada' },
  { texto: '🎤 marca dentista quinta às três da tarde', coluna: 'cris', titulo: 'Dentista', detalhe: 'quinta, às 15:00' },
  { texto: 'preciso comprar leite', coluna: 'nina', titulo: 'Comprar leite', detalhe: 'sem data' },
  { texto: 'almoço 38', coluna: 'caio', titulo: 'R$ 38,00', detalhe: '🍽️ Alimentação' },
];

function iniciarTriagem() {
  if (pedeMenosMovimento) return;
  const area = document.getElementById('triagem');
  const texto = document.getElementById('triagem-texto');
  let ativo = false;
  let rodando = false;
  let proxima = 0;

  async function rodar() {
    if (rodando) return;
    rodando = true;
    while (ativo) {
      const mensagem = MENSAGENS_TRIAGEM[proxima];
      proxima = (proxima + 1) % MENSAGENS_TRIAGEM.length;

      texto.textContent = '';
      for (const letra of mensagem.texto) {
        if (!ativo) break;
        texto.textContent += letra;
        await espera(38);
      }
      await espera(600);
      if (!ativo) break;

      const lista = area.querySelector(`[data-coluna="${mensagem.coluna}"]`);
      const item = document.createElement('li');
      item.className = 'novo';
      const titulo = document.createElement('strong');
      titulo.textContent = mensagem.titulo;
      const detalhe = document.createElement('span');
      detalhe.textContent = mensagem.detalhe;
      item.append(titulo, detalhe);
      lista.prepend(item);
      const limite = innerWidth < 760 ? 2 : 3;
      while (lista.children.length > limite) lista.lastElementChild.remove();

      texto.textContent = '';
      await espera(700);
    }
    rodando = false;
  }

  quandoVisivel(area, () => { ativo = true; rodar(); }, () => { ativo = false; });
}

function iniciarDia() {
  const secao = document.getElementById('dia');
  const botoes = [...secao.querySelectorAll('.dia-botao')];
  const cenas = [...secao.querySelectorAll('.cena-item')];
  const INTERVALO_MS = 5000;
  let atual = 0;
  let relogio = null;
  let automatico = !pedeMenosMovimento;

  const mostrar = (indice) => {
    atual = indice;
    cenas.forEach((cena, i) => cena.classList.toggle('ativa', i === indice));
    botoes.forEach((botao, i) => {
      botao.classList.toggle('feito', i < indice);
      if (i === indice) botao.setAttribute('aria-current', 'true');
      else botao.removeAttribute('aria-current');
    });
  };
  const parar = () => {
    clearInterval(relogio);
    relogio = null;
  };

  botoes.forEach((botao, i) => {
    botao.addEventListener('click', () => {
      // Quem escolheu um momento está lendo: a troca automática não volta.
      automatico = false;
      parar();
      mostrar(i);
    });
  });

  mostrar(0);
  quandoVisivel(
    secao,
    () => {
      if (!automatico || relogio) return;
      relogio = setInterval(() => mostrar((atual + 1) % cenas.length), INTERVALO_MS);
    },
    parar,
  );
}

const ASSESSORES = {
  caio: { nome: 'Caio', cargo: 'Assessor Financeiro' },
  cris: { nome: 'Cris', cargo: 'Assessora de Agenda' },
  nina: { nome: 'Nina', cargo: 'Assessora de Tarefas' },
};

// Respostas reais dos assessores do app. *assim* vira negrito, como nas mensagens de verdade.
const PEDIDOS = [
  { quem: 'caio', pedido: 'gastei 50 no mercado', resposta: '✅ *R$ 50,00* em 🛒 Mercado\nMercado, hoje.\nMercado em novembro: R$ 50,00' },
  { quem: 'cris', pedido: '🎤 marca dentista quinta às três da tarde', audio: '0:04', resposta: '🎤 Ouvi: "Marca dentista quinta às três da tarde."\n✅ *Dentista*: quinta, 12/11, às 15:00.\nTe aviso 1 hora antes.\nOuvi errado? Mande *desfazer*.' },
  { quem: 'nina', pedido: 'tarefa pagar luz sexta às 15h', resposta: '✅ *Pagar luz*: sexta, 13/11, às 15:00.\nTe aviso 2 horas antes.' },
  { quem: 'caio', pedido: '🎤 gastei 50 reais de gasolina', audio: '0:03', resposta: '🎤 Ouvi: "Gastei 50 reais de gasolina."\n✅ *R$ 50,00* em 🚗 Transporte\nGasolina, hoje.\nTransporte em novembro: R$ 50,00\nOuvi errado? Mande *desfazer*.' },
  { quem: 'cris', pedido: 'remarcar dentista para sexta às 9', resposta: '🔁 *Dentista* agora é sexta, 13/11, às 09:00.' },
  { quem: 'nina', pedido: 'preciso comprar leite', resposta: '✅ *Comprar leite*: sem data.' },
];

function criarParagrafo(linha) {
  const paragrafo = document.createElement('p');
  linha.split('*').forEach((trecho, i) => {
    if (i % 2 === 0) {
      paragrafo.append(trecho);
    } else {
      const forte = document.createElement('strong');
      forte.textContent = trecho;
      paragrafo.append(forte);
    }
  });
  return paragrafo;
}

function criarBolhaDoAssessor({ quem, resposta }) {
  const { nome, cargo } = ASSESSORES[quem];
  const bolha = document.createElement('div');
  bolha.className = `bolha entra ${quem}`;

  const topo = document.createElement('div');
  topo.className = 'quem';
  const retrato = document.createElement('img');
  retrato.src = `/assessores/${quem}.svg`;
  retrato.alt = '';
  retrato.width = 20;
  retrato.height = 20;
  const forte = document.createElement('strong');
  forte.textContent = nome;
  const pequeno = document.createElement('small');
  pequeno.textContent = cargo;
  topo.append(retrato, forte, pequeno);

  bolha.append(topo, ...resposta.split('\n').map(criarParagrafo));
  return bolha;
}

function criarBolhaDaPessoa({ pedido, audio }) {
  const bolha = document.createElement('div');
  bolha.className = 'bolha sai';
  if (!audio) {
    bolha.append(criarParagrafo(pedido));
    return bolha;
  }
  bolha.innerHTML = `<div class="audio" role="img" aria-label="Mensagem de áudio"><span class="audio-tocar"></span><svg class="onda"><use href="#i-onda"/></svg><small>${audio}</small></div>`;
  return bolha;
}

function iniciarDemonstracao() {
  const conversa = document.getElementById('demo-conversa');
  const area = document.getElementById('demo-pedidos');
  const rolar = () => conversa.scrollTo({ top: conversa.scrollHeight, behavior: pedeMenosMovimento ? 'auto' : 'smooth' });
  let ocupado = false;

  for (const item of PEDIDOS) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `pedido ${item.quem}`;
    botao.textContent = item.pedido;
    botao.addEventListener('click', async () => {
      if (ocupado) return;
      ocupado = true;
      botao.classList.add('usado');

      conversa.append(criarBolhaDaPessoa(item));
      rolar();

      const digitando = criarDigitando();
      conversa.append(digitando);
      rolar();
      await espera(pedeMenosMovimento ? 0 : 700);
      digitando.remove();

      conversa.append(criarBolhaDoAssessor(item));
      rolar();
      ocupado = false;
    });
    area.append(botao);
  }
}

function iniciarAbas() {
  const botoes = [...document.querySelectorAll('.aba')];
  const conteudos = [...document.querySelectorAll('.aba-conteudo')];
  const mostrar = (nome) => {
    botoes.forEach((botao) => botao.setAttribute('aria-pressed', String(botao.dataset.aba === nome)));
    conteudos.forEach((conteudo) => conteudo.classList.toggle('ativa', conteudo.dataset.conteudo === nome));
  };
  botoes.forEach((botao) => botao.addEventListener('click', () => mostrar(botao.dataset.aba)));
  mostrar('geral');
}

// Só organiza o que a pessoa digita. Quem confere o número é o servidor.
function mascararTelefone(valor) {
  const numeros = valor.replace(/\D/g, '');
  // O preenchimento automático costuma trazer o +55: esse fica como veio, e o servidor entende.
  if (valor.trim().startsWith('+') || numeros.length > 11) return valor;
  if (numeros.length === 0) return '';
  if (numeros.length <= 2) return `(${numeros}`;
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  const corte = numeros.length === 11 ? 7 : 6;
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, corte)}-${numeros.slice(corte)}`;
}

function iniciarFormulario() {
  const form = document.getElementById('inscricao');
  const caixaErro = document.getElementById('erro');
  const botao = form.querySelector('button');

  form.elements.whatsapp.addEventListener('input', ({ target }) => {
    // Editando no meio do número, a máscara não entra, para o cursor não pular para o fim.
    if (target.selectionStart === target.value.length) target.value = mascararTelefone(target.value);
  });
  // Quem já está corrigindo não precisa continuar vendo o erro.
  form.addEventListener('input', () => { caixaErro.hidden = true; });

  const mostrarErro = (mensagem, campo) => {
    caixaErro.textContent = mensagem;
    caixaErro.hidden = false;
    if (campo) form.elements[campo]?.focus();
  };

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    caixaErro.hidden = true;
    botao.disabled = true;

    const { nome, whatsapp, site } = form.elements;
    try {
      const resposta = await fetch('/inscrever', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.value, whatsapp: whatsapp.value, site: site.value }),
      });
      if (resposta.ok) {
        location.assign('/obrigado');
        return;
      }
      const dados = await resposta.json().catch(() => ({}));
      mostrarErro(dados.erro || 'Não foi possível guardar sua inscrição agora. Tente de novo em instantes.', dados.campo);
    } catch {
      mostrarErro('Não foi possível enviar. Confira sua conexão e tente de novo.');
    } finally {
      botao.disabled = false;
    }
  });
}

iniciarMenu();
iniciarFormulario();
iniciarAbas();
iniciarDia();
iniciarDemonstracao();
iniciarLuzDoTopo();
iniciarConversaDoTopo();
iniciarTriagem();
iniciarRevelacao();

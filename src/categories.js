import { normalizeKeyword } from './text.js';

export const OTHER_CATEGORY = 'Outros';
export const MAINTENANCE_CATEGORY = 'Manutenção de Veículo';

// Categorias e palavras iniciais de cada pessoa. Ela pode editar no painel, e o app aprende com as correções.
export const DEFAULT_CATEGORIES = [
  {
    name: 'Mercado',
    emoji: '🛒',
    keywords: [
      'mercado', 'supermercado', 'mercadinho', 'minimercado', 'hipermercado', 'mercearia', 'feira',
      'hortifruti', 'sacolão', 'açougue', 'atacadão', 'atacarejo', 'assaí', 'carrefour', 'pão de açúcar',
      'compras', 'compras do mês', 'compra do mês', 'verdura', 'fruta', 'legumes', 'carne', 'frango',
      'arroz', 'feijão', 'leite', 'ovos', 'produtos de limpeza', 'material de limpeza',
    ],
  },
  {
    name: 'Alimentação',
    emoji: '🍽️',
    keywords: [
      'almoço', 'jantar', 'janta', 'lanche', 'café', 'café da manhã', 'cafeteria', 'restaurante',
      'lanchonete', 'ifood', 'rappi', 'uber eats', 'pizza', 'pizzaria', 'hambúrguer', 'burger',
      'mcdonalds', 'mc donalds', 'burger king', 'bk', 'subway', 'kfc', 'starbucks', 'padaria', 'pão',
      'sorvete', 'açaí', 'churrasco', 'marmita', 'marmitex', 'quentinha', 'pastel', 'coxinha', 'salgado',
      'sushi', 'comida', 'delivery', 'doce', 'bolo', 'refrigerante', 'água de coco', 'água mineral',
    ],
  },
  {
    name: 'Transporte',
    emoji: '🚗',
    keywords: [
      'uber', '99', '99pop', '99 pop', 'táxi', 'cabify', 'indriver', 'ônibus', 'metrô', 'trem', 'vlt',
      'bilhete único', 'passagem', 'gasolina', 'combustível', 'etanol', 'álcool', 'diesel', 'gnv', 'posto',
      'estacionamento', 'zona azul', 'pedágio', 'sem parar', 'ipva', 'licenciamento',
      'seguro do carro', 'seguro auto', 'lava rápido', 'lava jato', 'lavagem',
      'multa', 'carro', 'moto', 'bicicleta', 'patinete',
    ],
  },
  {
    name: MAINTENANCE_CATEGORY,
    emoji: '🔧',
    keywords: [
      'oficina', 'mecânico', 'mecânica', 'funilaria', 'funileiro', 'borracharia', 'borracheiro', 'autopeças', 'auto peças',
      'troca de óleo', 'troca do óleo', 'troquei o óleo', 'troquei óleo', 'trocamos o óleo', 'óleo do carro', 'óleo da moto', 'óleo do motor',
      'filtro de óleo', 'pneu', 'troca de pneu',
      'alinhamento', 'balanceamento', 'freio', 'pastilha de freio', 'embreagem', 'amortecedor', 'suspensão', 'escapamento',
      'correia dentada', 'bateria do carro', 'bateria da moto', 'revisão do carro', 'revisão da moto', 'revisão do veículo',
      'conserto do carro', 'conserto da moto', 'manutenção do carro', 'manutenção da moto', 'manutenção do veículo', 'guincho',
    ],
  },
  {
    name: 'Moradia',
    emoji: '🏠',
    keywords: [
      'aluguel', 'condomínio', 'iptu', 'luz', 'conta de luz', 'energia', 'água', 'conta de água', 'gás',
      'botijão', 'internet', 'wifi', 'wi fi', 'faxina', 'diarista', 'reforma', 'pintor', 'eletricista',
      'encanador', 'móveis', 'móvel', 'sofá', 'colchão', 'geladeira', 'fogão', 'máquina de lavar',
      'microondas', 'cortina', 'tapete', 'seguro residencial', 'mudança',
    ],
  },
  {
    name: 'Assinaturas',
    emoji: '📱',
    keywords: [
      'assinatura', 'netflix', 'spotify', 'disney', 'prime video', 'amazon prime', 'hbo', 'max', 'globoplay',
      'youtube', 'youtube premium', 'apple music', 'icloud', 'google one', 'chatgpt', 'claude', 'deezer',
      'paramount', 'telecine', 'celular', 'plano de celular', 'recarga', 'telefone', 'tim', 'vivo', 'claro', 'oi',
    ],
  },
  {
    name: 'Saúde',
    emoji: '💊',
    keywords: [
      'farmácia', 'drogaria', 'drogasil', 'droga raia', 'raia', 'pacheco', 'pague menos', 'panvel', 'remédio',
      'vitamina', 'suplemento', 'whey', 'creatina', 'médico', 'médica', 'consulta', 'dentista', 'exame',
      'hospital', 'plano de saúde', 'unimed', 'amil', 'psicólogo', 'psicóloga', 'terapia', 'fisioterapia',
      'fisio', 'óculos', 'lente', 'vacina', 'academia', 'smart fit', 'smartfit', 'crossfit', 'pilates',
      'nutricionista',
    ],
  },
  {
    name: 'Educação',
    emoji: '🎓',
    keywords: [
      'escola', 'colégio', 'faculdade', 'universidade', 'curso', 'mensalidade da escola',
      'mensalidade da faculdade', 'material escolar', 'livro', 'apostila', 'caderno', 'inglês', 'idioma',
      'aula', 'udemy', 'alura', 'matrícula', 'creche', 'kindle', 'concurso',
    ],
  },
  {
    name: 'Lazer',
    emoji: '🎉',
    keywords: [
      'cinema', 'show', 'teatro', 'museu', 'balada', 'bar', 'boteco', 'cerveja', 'chopp', 'chope', 'vinho',
      'drink', 'festa', 'ingresso', 'viagem', 'hotel', 'pousada', 'airbnb', 'booking', 'passagem aérea',
      'passeio', 'parque', 'praia', 'clube', 'jogo', 'steam', 'playstation', 'xbox', 'nintendo', 'futebol',
      'boliche',
    ],
  },
  {
    name: 'Compras',
    emoji: '🛍️',
    keywords: [
      'roupa', 'camisa', 'camiseta', 'calça', 'blusa', 'vestido', 'bermuda', 'sapato', 'tênis', 'chinelo',
      'bolsa', 'mochila', 'shopping', 'amazon', 'mercado livre', 'mercadolivre', 'shopee', 'shein',
      'aliexpress', 'magalu', 'magazine luiza', 'casas bahia', 'americanas', 'renner', 'riachuelo', 'c&a',
      'zara', 'presente', 'eletrônico', 'celular novo', 'notebook', 'computador', 'fone', 'tv', 'televisão',
      'videogame',
    ],
  },
  {
    name: 'Cuidados pessoais',
    emoji: '💇',
    keywords: [
      'salão', 'cabeleireiro', 'cabelo', 'corte de cabelo', 'barbeiro', 'barbearia', 'barba', 'manicure',
      'unha', 'sobrancelha', 'depilação', 'estética', 'massagem', 'perfume', 'maquiagem', 'shampoo', 'creme',
      'boticário', 'natura', 'sephora', 'desodorante',
    ],
  },
  {
    name: 'Pets',
    emoji: '🐾',
    keywords: [
      'ração', 'veterinário', 'veterinária', 'vet', 'petshop', 'pet shop', 'banho e tosa', 'tosa', 'pet',
      'cachorro', 'gato', 'areia de gato', 'petz', 'cobasi',
    ],
  },
  {
    name: 'Impostos e taxas',
    emoji: '🧾',
    keywords: [
      'imposto', 'imposto de renda', 'irpf', 'darf', 'guia das', 'mei', 'inss', 'taxa', 'tarifa', 'anuidade',
      'juros', 'iof', 'cartório', 'seguro', 'seguro de vida', 'empréstimo', 'financiamento', 'consórcio',
    ],
  },
  { name: OTHER_CATEGORY, emoji: '📦', isDefault: true, keywords: [] },
];

// Liga a categoria de cada pessoa às palavras padrão, mesmo que ela renomeie a categoria.
export const categorySlug = (name) => normalizeKeyword(name);
export const MAINTENANCE_SLUG = categorySlug(MAINTENANCE_CATEGORY);
export const DEFAULT_KEYWORDS = new Map(
  DEFAULT_CATEGORIES.map((item) => [categorySlug(item.name), item.keywords.map(normalizeKeyword)]),
);

const wordsOf = (text) => ` ${normalizeKeyword(text)} `;

// Escolhe a categoria da palavra-chave encontrada no texto. Vence, nesta ordem: o que o app aprendeu,
// a frase com mais palavras ("mercado livre" antes de "mercado") e o que aparece primeiro
// ("almoço no shopping" é almoço).
export function classify(text, keywords) {
  const haystack = wordsOf(text);
  let best = null;
  for (const { keyword, category_id: categoryId, learned } of keywords) {
    let position = haystack.indexOf(` ${keyword} `);
    if (position === -1) position = haystack.indexOf(` ${keyword}s `);
    if (position === -1) continue;
    const candidate = { categoryId, learned: learned ? 1 : 0, words: keyword.split(' ').length, position };
    if (
      !best ||
      candidate.learned > best.learned ||
      (candidate.learned === best.learned && candidate.words > best.words) ||
      (candidate.learned === best.learned && candidate.words === best.words && candidate.position < best.position)
    ) {
      best = candidate;
    }
  }
  return best?.categoryId ?? null;
}

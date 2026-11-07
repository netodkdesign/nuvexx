const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEARCH_DELAY_MS = 200;
const TOAST_MS = 2600;
const PAST_DAYS = 90;
const LINK_POLL_MS = 3000;
const DEV_MAILS_SHOWN = 3;
const THEME_KEY = 'nuvexx-tema';
const CHART_MONTHS = 6;
const REPEAT_OPTIONS = [['', 'Não repete'], ['weekly', 'Toda semana'], ['monthly', 'Todo mês'], ['yearly', 'Todo ano']];
const REPEAT_LABELS = { weekly: 'toda semana', monthly: 'todo mês', yearly: 'todo ano' };
// Liga a categoria ao histórico dos veículos, mesmo que a pessoa renomeie a categoria.
const MAINTENANCE_SLUG = 'manutencao de veiculo';
const UNASSIGNED_ROUTE = 'sem-veiculo';
const NO_VALUE = 'Sem valor';
const FLOW_HEIGHT = 300;
const FLOW_MARGIN = { top: 22, right: 14, bottom: 28, left: 54 };
const FLOW_MAX_BAR = 44;
const FLOW_BAR_GAP = 4;
const FLOW_TICKS = 4;
const ARC_FIRST_HOUR = 8;
const ARC_LAST_HOUR = 20;
const ARC_WIDE_MIN = 640;
const ARC_MAX_LABELS = 8;
const ARC_TITLE_MAX = 24;
const ARC_TITLE_MIN = 10;
const ARC_TIME_CHARS = 5;
const ARC_CHAR_WIDTH = 8;
const ARC_NOW_HALF_WIDTH = 46;
const ARC_REFRESH_MS = 60_000;
const ARC_MAX_RATIO = 0.42;
// O celular é alto e estreito: um arco baixo deixaria um vão vazio acima dele, então pode subir quase tanto quanto é largo.
const ARC_PHONE_MAX_RATIO = 0.95;
const ARC_NOW_GAP = 20;
const ARC_INTRO_MS = 1800;
// O número do centro e a legenda chegam perto do fim, quando a linha já está quase pronta.
const ARC_CENTER_AT = 0.9;
const AGENDA_ADD_ID = 'adicionar-evento';
const BRIEFING_CHANNELS = { whatsapp: 'no WhatsApp', email: 'por e-mail' };

// Os nomes e as fotos também estão em src/assistant.js. Para trocar, mude nos dois lugares.
const ADVISORS = {
  finance: { id: 'finance', name: 'Caio', title: 'Assessor Financeiro', area: 'Finanças', role: 'Cuida de todas as suas finanças', photo: '/assessores/caio.svg', home: '#/painel' },
  agenda: { id: 'agenda', name: 'Cris', title: 'Assessora de Agenda', area: 'Agenda', role: 'Cuida da sua agenda e dos seus compromissos', photo: '/assessores/cris.svg', home: '#/agenda' },
  tasks: { id: 'tasks', name: 'Nina', title: 'Assessora de Tarefas', area: 'Tarefas', role: 'Cuida das suas tarefas e pendências', photo: '/assessores/nina.svg', home: '#/tarefas' },
};
// A tela inicial: é ela que abre ao entrar na conta. O logo em public/index.html também leva a ela.
const HOME_ROUTE = ADVISORS.agenda.home;

const SUGGESTIONS = ['gastei 50 no mercado', 'recebi 3000 de salário', 'aluguel 1800 todo dia 10', 'troca de óleo 250 na oficina do zé', 'quanto ainda vai sair','dentista quinta às 15h', 'tarefa pagar luz sexta às 15h', 'o que tenho hoje', 'tarefas', 'resumo', 'desfazer', 'ajuda'];

const CHAT_INTRO = { me: false, text: 'Escreva do seu jeito. Gastos e entradas vão para o Caio; compromissos, para a Cris; tarefas, para a Nina.' };

const ICONS = {
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  car: 'M4 13l2-6a2 2 0 0 1 2-1.400h8a2 2 0 0 1 2 1.400l2 6v4H4v-4ZM4 13h16M6 17v2M18 17v2M8 15h.01M16 15h.01',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  eye: 'M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7-10-7-10-7ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  eyeOff: 'M3 3l18 18M10.600 5.100A10 10 0 0 1 12 5c6.500 0 10 7 10 7a17 17 0 0 1-3.200 4.100M6.500 6.500A17 17 0 0 0 2 12s3.500 7 10 7a10 10 0 0 0 5.500-1.600M9.900 9.900a3 3 0 0 0 4.200 4.200',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  transfer: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  bank: 'M3 10h18M12 3l9 5H3l9-5ZM5 10v8M10 10v8M14 10v8M19 10v8M3 21h18',
  tag: 'M20.600 13.400 13.400 20.600a2 2 0 0 1-2.800 0L3 13V3h10l7.600 7.600a2 2 0 0 1 0 2.800ZM7.500 7.500h.01',
  chat: 'M21 12a8.500 8.500 0 0 1-12.600 7.400L3 21l1.600-5.400A8.500 8.500 0 1 1 21 12Z',
  phone: 'M22 16.900v3a2 2 0 0 1-2.200 2 19.800 19.800 0 0 1-8.600-3.100 19.500 19.500 0 0 1-6-6A19.800 19.800 0 0 1 2.100 4.200 2 2 0 0 1 4.100 2h3a2 2 0 0 1 2 1.700c.1 1 .4 1.900.7 2.800a2 2 0 0 1-.4 2.100L8.100 9.900a16 16 0 0 0 6 6l1.300-1.300a2 2 0 0 1 2.100-.4c.9.3 1.800.6 2.800.7a2 2 0 0 1 1.700 2Z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.200 4.200l2.100 2.100M17.700 17.700l2.100 2.100M1 12h3M20 12h3M4.200 19.800l2.100-2.100M17.700 6.300l2.100-2.100',
  moon: 'M21 12.800A9 9 0 1 1 11.200 3a7 7 0 0 0 9.800 9.800Z',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M18 6 6 18M6 6l12 12',
};

const GOOGLE_MARK = [
  ['#4285F4', 'M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z'],
  ['#34A853', 'M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z'],
  ['#FBBC05', 'M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z'],
  ['#EA4335', 'M12 4.8c1.8 0 3.3.6 4.6 1.8L20 3.2A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z'],
];

const view = document.getElementById('view');
const freshState = () => ({
  me: null,
  today: null,
  month: null,
  view: null,
  categoryId: '',
  accountId: '',
  entryType: '',
  query: '',
  showPast: false,
  showDone: false,
  arcIntro: false,
  briefingDismissed: false,
  reportValues: false,
  categories: [],
  accounts: [],
  vehicles: [],
  period: { to: null },
  organizing: false,
  chat: [CHAT_INTRO],
});
const state = freshState();
let renderToken = 0;
let installPrompt = null;
let appConfig = null;
let shellReady = false;
let afterRender = null;

// Ajudantes

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style') Object.assign(el.style, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el && !key.startsWith('aria') && key !== 'list') el[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...children.flat().filter(Boolean));
  return el;
}

function icon(name, className) {
  return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', ...(className ? { class: className } : {}) }, svg('path', { d: ICONS[name] }));
}

const formatNumber = (cents) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl = (cents) => `${cents < 0 ? '−' : ''}R$ ${formatNumber(Math.abs(cents))}`;
const compact = (cents) => (cents / 100).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const capitalize = (text) => (text ? text[0].toLocaleUpperCase('pt-BR') + text.slice(1) : text);

const monthNumber = (month) => Number(month.slice(5)) - 1;
const monthName = (month) => MONTHS[monthNumber(month)];
const monthLabel = (month) => `${monthName(month)} de ${month.slice(0, 4)}`;

function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addDays(ymd, days) {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayLabel(ymd) {
  if (ymd === state.today) return 'Hoje';
  if (ymd === addDays(state.today, -1)) return 'Ontem';
  if (ymd === addDays(state.today, 1)) return 'Amanhã';
  const [year, month, day] = ymd.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
  return `${weekday}, ${day} de ${MONTHS[month - 1]}`;
}

const dateLabel = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const shortDay = (ymd) => `${ymd.slice(8)}/${ymd.slice(5, 7)}`;
const installmentLabel = (row) => (row.installment ? ` (${row.installment}/${row.installments})` : '');
const canWrite = () => state.me?.access !== 'expired';

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (response.headers.get('content-type') ?? '').includes('json') ? await response.json() : null;
  if (response.status === 401 && path !== '/api/login') {
    showLogin();
    throw new Error('sessao');
  }
  if (!response.ok) throw new Error(data?.error ?? 'Algo deu errado. Tente de novo.');
  return data;
}

function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, TOAST_MS);
}

// Para botões cuja falha não tem um formulário onde aparecer.
const withToast = (action) => async (event) => {
  try {
    await action(event);
  } catch (err) {
    if (err.message !== 'sessao') showToast(err.message);
    render();
  }
};

// Dica ao passar o mouse ou focar. Só complementa: todo valor também aparece na tela.
const tooltip = document.getElementById('tooltip');
function placeTooltip(x, y) {
  const margin = 12;
  const { width, height } = tooltip.getBoundingClientRect();
  tooltip.style.left = `${Math.min(Math.max(margin, x + margin), window.innerWidth - width - margin)}px`;
  tooltip.style.top = `${Math.max(margin, y - height - margin)}px`;
}
function bindTooltip(el, value, ...details) {
  const show = () => {
    tooltip.replaceChildren(h('strong', { text: value }), ...details.map((text) => h('span', { text })));
    tooltip.hidden = false;
  };
  const hide = () => {
    tooltip.hidden = true;
  };
  el.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    show();
    placeTooltip(event.clientX, event.clientY);
  });
  el.addEventListener('pointermove', (event) => {
    if (!tooltip.hidden) placeTooltip(event.clientX, event.clientY);
  });
  el.addEventListener('pointerleave', hide);
  el.addEventListener('focus', () => {
    show();
    const box = el.getBoundingClientRect();
    placeTooltip(box.left, box.top);
  });
  el.addEventListener('blur', hide);
  el.addEventListener('click', hide);
}

const formError = () => h('p', { class: 'form-error', role: 'alert', hidden: true });

function showFormError(element, err) {
  element.textContent = err.message;
  element.hidden = false;
}

function passwordField(label, input, headerLink) {
  const toggle = h('button', {
    class: 'password-toggle',
    type: 'button',
    'aria-label': 'Mostrar senha',
    onclick: (event) => {
      event.preventDefault();
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      toggle.replaceChildren(icon(showing ? 'eye' : 'eyeOff'));
    },
  }, icon('eye'));
  return h('label', { class: 'field' },
    h('span', { class: 'field-head' }, h('span', { text: label }), headerLink),
    h('span', { class: 'password-wrap' }, input, toggle),
  );
}

function openDialog(title, ...content) {
  const dialog = h('dialog', { 'aria-label': title }, h('h2', { class: 'dialog-title', text: title }), ...content);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

// Peças compartilhadas

function advisorHeader({ name, title, role, photo }) {
  return h('div', { class: 'advisor' },
    h('img', { class: 'advisor-photo', src: photo, alt: `Retrato de ${name}`, width: 52, height: 52 }),
    h('div', {},
      h('h1', { class: 'advisor-name', text: `${name}, ${title}` }),
      h('p', { class: 'advisor-role', text: role }),
    ),
  );
}

function paywallBanner() {
  if (canWrite()) return null;
  return h('div', { class: 'banner', role: 'status' },
    h('strong', { text: 'Seu teste grátis terminou.' }),
    h('span', { text: ' Você pode consultar e baixar seus dados, mas precisa assinar para continuar anotando.' }),
    state.me.subscribe_url && h('a', { class: 'btn btn-primary', href: state.me.subscribe_url, target: '_blank', rel: 'noopener', text: 'Assinar' }),
  );
}

async function loadCategories() {
  state.categories = await api('/api/categories');
  return state.categories;
}

async function loadAccounts() {
  state.accounts = await api('/api/accounts');
  return state.accounts;
}

async function loadVehicles() {
  state.vehicles = (await api('/api/vehicles')).vehicles;
  return state.vehicles;
}

function categoryOptions(selected) {
  return state.categories.map((category) =>
    h('option', { value: String(category.id), selected: String(category.id) === String(selected), text: `${category.emoji} ${category.name}` }),
  );
}

function accountOptions(selected) {
  return state.accounts.map((account) =>
    h('option', { value: String(account.id), selected: String(account.id) === String(selected), text: account.name }),
  );
}

// Lançamento: entrada ou gasto, criar e editar

// Com service, abre direto como manutenção, a partir da página de veículos.
async function openEntryDialog(row, initialKind = 'expense', service = null) {
  await Promise.all([loadCategories(), loadAccounts(), loadVehicles()]);
  let kind = row ? row.kind ?? 'expense' : initialKind;
  const other = state.categories.find((category) => category.is_default);
  const maintenance = state.categories.find((category) => category.slug === MAINTENANCE_SLUG);
  const description = h('input', { required: true, maxLength: 120, value: row?.description ?? '', autocomplete: 'off' });
  const amount = h('input', { required: true, inputMode: 'decimal', autocomplete: 'off', placeholder: '0,00', value: row?.amount_cents ? formatNumber(row.amount_cents).replace(/\./g, '') : '' });
  const date = h('input', { type: 'date', required: true, value: row?.spent_on ?? row?.received_on ?? state.today });
  const category = h('select', {}, categoryOptions(row?.category_id ?? (service ? maintenance?.id : other?.id)));
  const account = h('select', {}, h('option', { value: '', text: 'Sem conta', selected: !row?.account_id }), accountOptions(row?.account_id));
  const categoryField = h('label', { class: 'field wide', hidden: kind === 'income' || Boolean(service) }, h('span', { text: 'Categoria' }), category);
  const repeat = h('select', {}, REPEAT_OPTIONS.map(([value, text]) => h('option', { value, text })));
  const repeatField = h('label', { class: 'field' }, h('span', { text: 'Repetir' }), repeat);
  const repeatUntil = h('input', { type: 'date' });
  const repeatUntilField = h('label', { class: 'field', hidden: true }, h('span', { text: 'Até quando (opcional)' }), repeatUntil);
  repeat.addEventListener('change', () => {
    repeatUntilField.hidden = !repeat.value;
  });
  const applyNext = h('input', { type: 'checkbox' });
  const error = formError();
  const title = h('h2', { class: 'dialog-title' });

  // Os campos da manutenção: quando, onde e o que foi feito em cada veículo.
  const onlyVehicle = state.vehicles.length === 1 ? state.vehicles[0].id : '';
  const vehicle = h('select', {},
    h('option', { value: '', text: 'Sem veículo definido' }),
    state.vehicles.map((item) => h('option', { value: String(item.id), text: item.name, selected: String(item.id) === String(row?.vehicle_id ?? service?.vehicleId ?? onlyVehicle) })),
  );
  const place = h('input', { maxLength: 120, value: row?.place ?? '', placeholder: 'Oficina do Zé', autocomplete: 'off' });
  const odometer = h('input', { inputMode: 'numeric', maxLength: 9, value: row?.odometer_km ?? '', placeholder: '85000', autocomplete: 'off' });
  const whatLabel = h('span');
  const amountLabel = h('span');
  const whenLabel = h('span');
  const vehicleField = h('label', { class: 'field wide' }, h('span', { text: 'Veículo' }), vehicle);
  const placeField = h('label', { class: 'field wide' }, h('span', { text: 'Onde foi feito' }), place);
  const odometerField = h('label', { class: 'field wide' }, h('span', { text: 'Quilometragem (opcional)' }), odometer);
  const noVehicleHint = h('p', { class: 'hint', style: { marginTop: '6px' }, text: 'Cadastre seu veículo na aba Veículos para separar este histórico.' });
  const futureHint = h('p', { class: 'hint', style: { marginTop: '6px' }, text: 'Pode usar uma data futura: o valor aparece como “ainda vai entrar” ou “ainda vai sair”.' });
  const noAccountHint = h('p', { class: 'hint', style: { marginTop: '6px' }, hidden: state.accounts.length > 0, text: 'Cadastre suas contas em Contas e cartões para ver o saldo de cada uma.' });

  const isService = () => kind === 'expense' && category.value === String(maintenance?.id);
  const syncService = () => {
    const on = isService();
    vehicleField.hidden = !on || !state.vehicles.length;
    noVehicleHint.hidden = !on || state.vehicles.length > 0;
    placeField.hidden = !on;
    odometerField.hidden = !on;
    futureHint.hidden = on;
    noAccountHint.hidden = on || state.accounts.length > 0;
    whatLabel.textContent = on ? 'Peça trocada ou serviço feito' : 'O que foi';
    amountLabel.textContent = on ? 'Valor (R$), se souber' : 'Valor (R$)';
    whenLabel.textContent = on ? 'Quando foi feito' : 'Data';
    amount.required = !on;
    repeatField.hidden = on;
    if (on) {
      repeat.value = '';
      repeatUntilField.hidden = true;
    }
    if (on) title.textContent = row ? 'Editar manutenção' : 'Nova manutenção';
    else title.textContent = `${row ? 'Editar' : kind === 'income' ? 'Nova' : 'Novo'} ${kind === 'income' ? 'entrada' : 'gasto'}`;
  };

  let categoryTouched = Boolean(row) || Boolean(service);
  category.addEventListener('change', () => {
    categoryTouched = true;
    syncService();
  });
  // Sugere a categoria enquanto a pessoa ainda não escolheu nenhuma.
  description.addEventListener('blur', async () => {
    if (kind !== 'expense' || categoryTouched || !description.value.trim()) return;
    const { category_id: suggested } = await api(`/api/classify?text=${encodeURIComponent(description.value)}`);
    if (suggested && !categoryTouched) {
      category.value = String(suggested);
      syncService();
    }
  });

  const typeButtons = !row && !service && [['expense', 'Saída'], ['income', 'Entrada']].map(([value, label]) =>
    h('button', {
      type: 'button',
      text: label,
      'aria-pressed': String(kind === value),
      onclick: () => {
        kind = value;
        typeButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(['expense', 'income'][index] === kind)));
        categoryField.hidden = kind === 'income';
        syncService();
      },
    }),
  );

  const close = () => dialog.close();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const base = {
      description: description.value,
      amount: amount.value,
      date: date.value,
      account_id: account.value || null,
      ...(row ? { apply_next: applyNext.checked } : { repeat: repeat.value || null, repeat_until: repeatUntil.value || null }),
    };
    const path = kind === 'income' ? '/api/incomes' : '/api/expenses';
    const on = isService();
    const body = kind === 'income' ? base : {
      ...base,
      category_id: Number(category.value),
      ...(on ? { vehicle_id: vehicle.value || null, place: place.value, odometer_km: odometer.value } : {}),
    };
    try {
      await api(row ? `${path}/${row.id}` : path, { method: row ? 'PUT' : 'POST', body });
      close();
      if (on) showToast(row ? 'Manutenção atualizada.' : 'Manutenção anotada.');
      else showToast(row ? 'Lançamento atualizado.' : 'Lançamento anotado.');
      // Uma manutenção antiga não pode levar o painel para o mês dela.
      if (!row && !on) state.month = date.value.slice(0, 7);
      render();
    } catch (err) {
      showFormError(error, err);
    }
  };

  const form = h('form', { onsubmit: submit },
    typeButtons && h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tipo de lançamento' }, typeButtons),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field wide' }, whatLabel, description),
      vehicleField,
      placeField,
      h('label', { class: 'field' }, whenLabel, date),
      h('label', { class: 'field' }, amountLabel, amount),
      odometerField,
      categoryField,
      h('label', { class: 'field wide' }, h('span', { text: 'Conta ou cartão' }), account),
      !row && repeatField,
      !row && repeatUntilField,
    ),
    noVehicleHint,
    !row && futureHint,
    row?.recurrence_id && h('label', { class: 'check-field', style: { marginTop: '10px' } }, applyNext, h('span', {
      text: `Repete ${REPEAT_LABELS[row.recurrence_frequency] ?? ''}. Aplicar também aos próximos (a data muda só neste).`,
    })),
    noAccountHint,
    row?.installment && h('p', { class: 'hint', style: { marginTop: '6px' }, text: `Parcela ${row.installment} de ${row.installments}. A mudança de categoria e de conta vale para todas; o resto, só para esta.` }),
    error,
    h('div', { class: 'dialog-actions' },
      row && h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar', onclick: () => confirmDeleteEntry(row, close) }),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: close }),
      h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
    ),
  );
  const dialog = openDialog('Lançamento', form);
  dialog.querySelector('.dialog-title').replaceWith(title);
  syncService();
  if (!row) description.focus();
}

function confirmDeleteEntry(row, closeParent) {
  const income = row.kind === 'income';
  const remove = async (query = '') => {
    await api(`${income ? '/api/incomes' : '/api/expenses'}/${row.id}${query}`, { method: 'DELETE' });
    dialog.close();
    closeParent();
    showToast('Lançamento apagado.');
    render();
  };
  const repeating = Boolean(row.recurrence_id);
  const dialog = openDialog(
    row.installment ? 'Apagar parcela?' : 'Apagar este lançamento?',
    h('p', { text: `${row.description}${installmentLabel(row)}, ${brl(row.amount_cents)}.` }),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
      row.installment && h('button', { class: 'btn btn-danger', type: 'button', text: `Todas as ${row.installments}`, onclick: () => remove('?group=1') }),
      repeating && h('button', { class: 'btn btn-danger', type: 'button', text: 'Este e os próximos', onclick: () => remove('?next=1') }),
      h('button', { class: 'btn btn-danger', type: 'button', text: row.installment ? 'Só esta' : repeating ? 'Só este' : 'Apagar', onclick: () => remove() }),
    ),
  );
}

function entryRow(row, readOnly = false) {
  const income = row.kind === 'income';
  const date = row.date ?? row.spent_on ?? row.received_on;
  const planned = date > state.today;
  const details = [
    planned && (income ? `Vai entrar em ${shortDay(date)}` : `Vai sair em ${shortDay(date)}`),
    !planned && (income ? 'Entrada' : row.category_name),
    REPEAT_LABELS[row.recurrence_frequency],
    row.vehicle_name,
    row.place,
    row.account_name,
  ].filter(Boolean).join(' · ');
  const content = [
    h('span', { class: `row-mark${income ? ' is-income' : planned ? ' is-planned' : ''}`, 'aria-hidden': 'true' }),
    h('span', { class: 'row-emoji', 'aria-hidden': 'true', text: income ? '💵' : row.category_emoji }),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title', text: `${row.description}${installmentLabel(row)}` }),
      h('span', { class: 'row-sub', text: details }),
    ),
    h('span', { class: 'row-amount', text: row.amount_cents ? `${income ? '+ ' : ''}${brl(row.amount_cents)}` : NO_VALUE }),
  ];
  if (readOnly) return h('div', { class: 'row' }, content);
  return h('button', { class: 'row', type: 'button', onclick: withToast(() => openEntryDialog(row)) }, content);
}

function setMonth(month) {
  state.month = month;
  render();
}

function monthBar(...actions) {
  const current = state.today.slice(0, 7);
  return h('header', { class: 'topbar' },
    h('div', { class: 'month' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mês anterior', onclick: () => setMonth(shiftMonth(state.month, -1)) }, icon('left')),
      h('div', { class: 'month-label', 'aria-live': 'polite', text: monthLabel(state.month) }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Próximo mês', onclick: () => setMonth(shiftMonth(state.month, 1)) }, icon('right')),
      state.month !== current && h('button', { class: 'link-btn', type: 'button', text: 'Hoje', 'aria-label': 'Voltar para o mês atual', onclick: () => setMonth(current) }),
    ),
    h('div', { class: 'topbar-actions' }, actions),
  );
}

function emptyMonth() {
  return h('div', { class: 'empty' },
    h('strong', { text: `Nada anotado em ${monthName(state.month)}` }),
    h('p', { text: 'Use o botão Novo lançamento ou escreva “gastei 50 no mercado” na Conversa.' }),
    h('a', { class: 'btn', href: '#/conversa', text: 'Abrir a Conversa' }),
  );
}

const newEntryButton = () => canWrite() && h('button', {
  class: 'btn btn-primary btn-add',
  type: 'button',
  'aria-label': 'Novo lançamento',
  onclick: withToast(() => openEntryDialog()),
}, icon('plus'), h('span', { class: 'btn-label', text: 'Novo lançamento' }));

// Painel: blocos

const WIDGET_SIZE = {
  entradas: 'kpi', saidas: 'kpi', saldo: 'kpi', contas: 'kpi', previstos: 'half', fluxo: 'wide', categorias: 'half', maiores: 'half', recentes: 'half', agenda: 'half', tarefas: 'half',
};

const KPIS = {
  entradas: { title: 'Entradas', key: 'income', series: 'income_cents', spark: 'spark-income', upIsGood: true, doneLabel: 'Já entrou', pendingLabel: 'Ainda vai entrar' },
  saidas: { title: 'Saídas', key: 'expense', series: 'expense_cents', spark: 'spark-expense', upIsGood: false, doneLabel: 'Já saiu', pendingLabel: 'Ainda vai sair' },
  saldo: { title: 'Saldo do mês', plannedTitle: 'Saldo previsto', key: 'balance', series: 'balance_cents', spark: 'spark-balance', upIsGood: true, doneLabel: 'Até hoje' },
};

function savePanelOrder(panel, widgets) {
  return api(`/api/panels/${panel.id}`, { method: 'PUT', body: { widgets } });
}

function widgetMenu(id, title, ctx) {
  const { panel } = ctx;
  const index = panel.widgets.indexOf(id);
  const move = (delta) => withToast(async () => {
    const widgets = [...panel.widgets];
    widgets.splice(index, 1);
    widgets.splice(index + delta, 0, id);
    await savePanelOrder(panel, widgets);
    render();
  });
  const remove = withToast(async () => {
    await savePanelOrder(panel, panel.widgets.filter((item) => item !== id));
    showToast('Bloco removido deste painel.');
    render();
  });
  return h('details', { class: 'widget-menu' },
    h('summary', { 'aria-label': `Opções de ${title}` }, icon('more')),
    h('div', { class: 'widget-menu-list' },
      h('button', { type: 'button', text: 'Mover para antes', disabled: index === 0, onclick: move(-1) }),
      h('button', { type: 'button', text: 'Mover para depois', disabled: index === panel.widgets.length - 1, onclick: move(1) }),
      h('button', { type: 'button', text: 'Remover deste painel', disabled: panel.widgets.length === 1, onclick: remove }),
    ),
  );
}

function widgetShell(id, { title, subtitle }, body, ctx) {
  return h('section', { class: `widget w-${WIDGET_SIZE[id]}`, 'data-widget': id, 'aria-label': title },
    h('div', { class: 'widget-head' },
      ctx.organizing && h('span', {
        class: 'widget-grip',
        title: 'Arraste para organizar',
        'aria-hidden': 'true',
        // Só a alça arrasta: assim dá para selecionar texto e tocar nos botões do bloco.
        onpointerdown: (event) => {
          event.currentTarget.closest('.widget').draggable = true;
        },
        onpointerup: (event) => {
          event.currentTarget.closest('.widget').draggable = false;
        },
      }, icon('grip')),
      h('div', { class: 'widget-titles' },
        h('h3', { class: 'widget-title', text: title }),
        subtitle && h('p', { class: 'widget-sub', text: subtitle }),
      ),
      ctx.organizing && widgetMenu(id, title, ctx),
    ),
    body,
  );
}

function sparkline(values, className) {
  const width = 84;
  const height = 28;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => [
    pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2),
    height - pad - ((value - min) / span) * (height - pad * 2),
  ]);
  const d = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return svg('svg', { class: 'spark', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' }, svg('path', { d, class: className }));
}

function deltaBadge(item, period, upIsGood) {
  // Num mês que ainda não chegou, comparar diria só que falta anotar.
  if (item.change_percent === null || period.is_future) return null;
  const percent = item.change_percent;
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  const text = Math.abs(percent).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const previous = monthName(period.previous_month);
  // O mês em andamento é comparado até o mesmo dia do mês anterior.
  const detail = period.same_period ? `Comparado com ${previous} até o dia ${Number(period.today.slice(8))}` : `Comparado com ${previous} inteiro`;
  const good = percent === 0 ? '' : (percent > 0) === upIsGood ? ' is-good' : ' is-bad';
  return h('span', { class: `delta${good}`, title: detail },
    h('span', { 'aria-hidden': 'true', text: percent > 0 ? '▲' : percent < 0 ? '▼' : '=' }),
    `${sign}${text}% vs. ${previous}`,
  );
}

function kpiLine(label, cents) {
  return h('div', { class: 'kpi-line' }, h('span', { text: label }), h('strong', { text: brl(cents) }));
}

function kpiWidget(id, data, ctx) {
  const spec = KPIS[id];
  const item = data.summary[spec.key];
  const { is_current: isCurrent, is_future: isFuture } = data.period;
  const planned = isCurrent || isFuture;
  const title = planned && spec.plannedTitle ? spec.plannedTitle : spec.title;
  return widgetShell(id, { title },
    [
      h('p', { class: 'kpi-value', text: brl(item.total_cents) }),
      isCurrent && h('div', { class: 'kpi-lines' },
        kpiLine(spec.doneLabel, item.done_cents),
        spec.pendingLabel && kpiLine(spec.pendingLabel, item.pending_cents),
      ),
      isFuture && spec.pendingLabel && h('p', { class: 'hint', text: 'Previsto para o mês' }),
      h('div', { class: 'kpi-foot' },
        deltaBadge(item, data.period, spec.upIsGood),
        sparkline(data.flow.map((row) => row[spec.series]), spec.spark),
      ),
    ],
    ctx,
  );
}

function accountsWidget(data, ctx) {
  const rows = data.accounts;
  const largest = Math.max(...rows.map((row) => Math.abs(row.balance_cents)), 1);
  const body = rows.length
    ? h('div', { class: 'account-list' }, rows.map((row) => h('div', {},
      h('div', { class: 'account-line' },
        h('span', { class: 'account-line-name', text: row.name }),
        h('span', { class: 'account-line-value', text: brl(row.balance_cents) }),
      ),
      h('div', { class: 'account-track' },
        h('div', { class: `account-fill${row.balance_cents < 0 ? ' is-negative' : ''}`, style: { width: `${(Math.abs(row.balance_cents) / largest) * 100}%` } }),
      ),
    )))
    : h('div', { class: 'widget-empty' },
      'Nenhuma conta cadastrada.',
      !ctx.readOnly && h('div', {}, h('a', { href: '#/contas', text: 'Cadastrar conta' })),
    );
  return widgetShell('contas', { title: 'Saldo por conta' }, body, ctx);
}

function niceTicks(min, max) {
  const span = max - min || 100000;
  const rough = span / FLOW_TICKS;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((value) => value >= rough);
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);
  const ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(value);
  return ticks;
}

const barPath = (x, top, bottom, width) => {
  const radius = Math.min(4, bottom - top, width / 2);
  return `M${x} ${bottom}V${top + radius}Q${x} ${top} ${x + radius} ${top}H${x + width - radius}Q${x + width} ${top} ${x + width} ${top + radius}V${bottom}Z`;
};

function flowSvg(flow, width) {
  const { top, right, bottom, left } = FLOW_MARGIN;
  const plotWidth = Math.max(width - left - right, 10);
  const plotHeight = FLOW_HEIGHT - top - bottom;
  const values = flow.flatMap((row) => [row.income_cents, row.expense_cents, row.cumulative_cents]);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const low = ticks[0];
  const high = ticks.at(-1);
  const y = (value) => top + plotHeight - ((value - low) / (high - low)) * plotHeight;
  const slot = plotWidth / flow.length;
  const barWidth = Math.min(FLOW_MAX_BAR, Math.max(4, (slot * 0.66 - FLOW_BAR_GAP) / 2));
  const center = (index) => left + slot * index + slot / 2;
  const showEveryLabel = slot >= 34;

  const grid = ticks.map((value) => svg('g', {},
    svg('line', { class: value === 0 ? 'flow-zero' : 'flow-grid', x1: left, x2: left + plotWidth, y1: y(value), y2: y(value) }),
    svg('text', { class: 'flow-text', x: left - 8, y: y(value) + 4, 'text-anchor': 'end' }, document.createTextNode(value === 0 ? 'R$ 0' : compact(value))),
  ));

  // A parte que ainda vai acontecer fica por cima, mais clara, com um respiro entre as duas.
  const bars = flow.flatMap((row, index) => {
    const zero = y(0);
    const bar = (total, pending, x, className) => {
      if (total <= 0) return [];
      const done = total - pending;
      const doneTop = y(done);
      return [
        done > 0 && svg('rect', { class: className, x, y: doneTop, width: barWidth, height: Math.max(zero - doneTop, 0) }),
        pending > 0 && svg('path', { class: `${className} flow-pending`, d: barPath(x, y(total), done > 0 ? doneTop - 2 : zero, barWidth) }),
      ];
    };
    return [
      bar(row.income_cents, row.income_pending_cents, center(index) - barWidth - FLOW_BAR_GAP / 2, 'flow-income'),
      bar(row.expense_cents, row.expense_pending_cents, center(index) + FLOW_BAR_GAP / 2, 'flow-expense'),
    ].flat();
  });

  const labels = flow.map((row, index) => (showEveryLabel || index % 2 === 0) && svg('text', {
    class: 'flow-text',
    x: center(index),
    y: FLOW_HEIGHT - 8,
    'text-anchor': 'middle',
  }, document.createTextNode(SHORT_MONTHS[monthNumber(row.month)])));

  const linePoints = flow.map((row, index) => `${center(index)},${y(row.cumulative_cents)}`).join(' ');
  const dots = flow.map((row, index) => svg('circle', { class: 'flow-dot', cx: center(index), cy: y(row.cumulative_cents), r: 4 }));
  const last = flow.at(-1);
  const endLabel = svg('text', {
    class: 'flow-end',
    x: Math.min(center(flow.length - 1) + 6, left + plotWidth),
    y: Math.max(y(last.cumulative_cents) - 10, 12),
    'text-anchor': 'end',
  }, document.createTextNode(`R$ ${compact(last.cumulative_cents)}`));

  // A faixa do mês inteiro é o alvo: ninguém precisa acertar a barra ou o ponto.
  const bands = flow.map((row, index) => {
    const label = capitalize(monthLabel(row.month));
    const lines = [
      `Entradas: ${brl(row.income_cents)}`,
      row.income_pending_cents > 0 && `Ainda vai entrar: ${brl(row.income_pending_cents)}`,
      `Saídas: ${brl(row.expense_cents)}`,
      row.expense_pending_cents > 0 && `Ainda vai sair: ${brl(row.expense_pending_cents)}`,
      `Saldo do mês: ${brl(row.balance_cents)}`,
      `Acumulado: ${brl(row.cumulative_cents)}`,
    ].filter(Boolean);
    const band = svg('rect', {
      class: 'flow-band',
      x: left + slot * index,
      y: top,
      width: slot,
      height: plotHeight,
      tabindex: 0,
      'aria-label': `${label}. ${lines.join('. ')}.`,
    });
    bindTooltip(band, label, ...lines);
    return band;
  });

  return svg('svg', { viewBox: `0 0 ${width} ${FLOW_HEIGHT}`, height: FLOW_HEIGHT, role: 'group', 'aria-label': 'Entradas, saídas e saldo acumulado por mês' },
    grid, bands, bars, labels,
    svg('polyline', { class: 'flow-line', points: linePoints }),
    dots, endLabel,
  );
}

function flowTable(flow) {
  const header = ['Mês', 'Entradas', 'Saídas', 'Saldo', 'Acumulado'];
  return h('details', { class: 'chart-table' },
    h('summary', { text: 'Ver em tabela' }),
    h('div', { class: 'chart-table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {}, header.map((text) => h('th', { scope: 'col', text })))),
        h('tbody', {}, flow.map((row) => h('tr', {},
          h('td', { text: capitalize(monthLabel(row.month)) }),
          h('td', { text: brl(row.income_cents) }),
          h('td', { text: brl(row.expense_cents) }),
          h('td', { text: brl(row.balance_cents) }),
          h('td', { text: brl(row.cumulative_cents) }),
        ))),
      ),
    ),
  );
}

function flowWidget(data, ctx) {
  const { flow } = data;
  const chart = h('div', { class: 'flow-chart' });
  const draw = () => {
    if (chart.clientWidth) chart.replaceChildren(flowSvg(flow, chart.clientWidth));
  };
  new ResizeObserver(draw).observe(chart);
  const first = flow[0].month;
  const lastMonth = flow.at(-1).month;
  return widgetShell('fluxo', { title: `Fluxo mensal · ${plural(flow.length, 'mês', 'meses')}`, subtitle: `${monthLabel(first)} a ${monthLabel(lastMonth)}` },
    [
      h('div', { class: 'legend' },
        h('span', {}, h('i', { class: 'legend-bar income' }), 'Entradas'),
        h('span', {}, h('i', { class: 'legend-bar expense' }), 'Saídas'),
        h('span', {}, h('i', { class: 'legend-bar planned' }), 'Previsto'),
        h('span', {}, h('i', { class: 'legend-line' }), 'Saldo acumulado'),
      ),
      chart,
      flowTable(flow),
    ],
    ctx,
  );
}

function categoriesWidget(data, ctx) {
  const { categories, period } = data;
  const largest = categories[0]?.total_cents || 1;
  const rows = categories.map((category) => {
    const content = [
      h('span', { class: 'cat-top' },
        h('span', { class: 'cat-name', text: `${category.emoji} ${category.name}` }),
        h('span', { class: 'cat-value', text: brl(category.total_cents) }),
      ),
      h('span', { class: 'cat-bottom' },
        h('span', { class: 'cat-track' }, h('span', { class: 'cat-bar', style: { display: 'block', width: `${(category.total_cents / largest) * 100}%` } })),
        h('span', { class: 'cat-percent', text: `${category.percent}%` }),
      ),
    ];
    if (ctx.readOnly) return h('li', {}, h('div', { class: 'cat-row' }, content));
    const button = h('button', {
      class: 'cat-row',
      type: 'button',
      'aria-label': `${category.name}: ${brl(category.total_cents)}, ${category.percent}% do mês. Ver lançamentos.`,
      onclick: () => {
        Object.assign(state, { categoryId: String(category.id), accountId: '', entryType: '', query: '', month: period.month });
        location.hash = '#/lancamentos';
      },
    }, content);
    bindTooltip(button, brl(category.total_cents), category.name, `${plural(category.count, 'lançamento', 'lançamentos')} · ${category.percent}% do mês`);
    return h('li', {}, button);
  });
  return widgetShell('categorias', { title: 'Gastos por categoria', subtitle: monthLabel(period.month) },
    rows.length ? h('ol', { class: 'cat-list' }, rows) : h('p', { class: 'widget-empty', text: 'Nenhum gasto neste mês.' }),
    ctx,
  );
}

const listWidget = (id, title, subtitle, rows, empty, ctx) => widgetShell(id, { title, subtitle },
  rows.length ? h('div', { class: 'rows' }, rows) : h('p', { class: 'widget-empty', text: empty }),
  ctx,
);

function agendaWidget(data, ctx) {
  const rows = data.appointments.map((row) => h('div', { class: 'row' },
    h('span', { class: 'row-time', text: row.start_time ?? 'Dia todo' }),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title', text: row.title }),
      h('span', { class: 'row-sub', text: dayLabel(row.starts_on) }),
    ),
  ));
  return listWidget('agenda', 'Próximos compromissos', 'próximos 30 dias', rows, 'Nenhum compromisso marcado.', ctx);
}

function tasksWidget(data, ctx) {
  const { rows, open_count: count } = data.tasks;
  const items = rows.map((row) => h('div', { class: 'task-row' },
    !ctx.readOnly && h('input', {
      type: 'checkbox',
      'aria-label': `Concluir ${row.title}`,
      onchange: withToast(async () => {
        await api(`/api/tasks/${row.id}`, { method: 'PUT', body: { done: true } });
        showToast('Tarefa concluída.');
        render();
      }),
    }),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title', text: row.title }),
      h('span', { class: `row-sub${isTaskLate(row) ? ' task-late' : ''}`, text: taskDue(row) }),
    ),
  ));
  return listWidget('tarefas', 'Tarefas pendentes', plural(count, 'pendente', 'pendentes'), items, 'Nenhuma tarefa pendente.', ctx);
}

function plannedWidget(data, ctx) {
  const { is_current: isCurrent, is_future: isFuture, month } = data.period;
  const title = isFuture ? `Previsto para ${monthName(month)}` : 'Ainda neste mês';
  const empty = isCurrent || isFuture ? 'Nada previsto. Anote uma data futura ou um lançamento que se repete.' : 'Este mês já terminou.';
  return listWidget('previstos', title, null, data.upcoming.map((row) => entryRow(row, ctx.readOnly)), empty, ctx);
}

const WIDGET_VIEWS = {
  entradas: (data, ctx) => kpiWidget('entradas', data, ctx),
  saidas: (data, ctx) => kpiWidget('saidas', data, ctx),
  saldo: (data, ctx) => kpiWidget('saldo', data, ctx),
  contas: accountsWidget,
  previstos: plannedWidget,
  fluxo: flowWidget,
  categorias: categoriesWidget,
  maiores: (data, ctx) => listWidget('maiores', 'Maiores gastos', monthLabel(data.period.month), data.top_expenses.map((row) => entryRow(row, ctx.readOnly)), 'Nenhum gasto neste mês.', ctx),
  recentes: (data, ctx) => listWidget('recentes', 'Últimos lançamentos', null, data.recent.map((row) => entryRow(row, ctx.readOnly)), 'Nada anotado ainda.', ctx),
  agenda: agendaWidget,
  tarefas: tasksWidget,
};

function widgetGrid(widgets, data, ctx) {
  const grid = h('div', { class: 'widgets' }, widgets.filter((id) => WIDGET_VIEWS[id]).map((id) => WIDGET_VIEWS[id](data, ctx)));
  if (ctx.organizing) enableDrag(grid, ctx.panel);
  return grid;
}

function enableDrag(grid, panel) {
  let dragged = null;
  grid.addEventListener('dragstart', (event) => {
    dragged = event.target.closest?.('.widget');
    if (!dragged) return;
    dragged.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragged.dataset.widget);
  });
  grid.addEventListener('dragover', (event) => {
    if (!dragged) return;
    event.preventDefault();
    const over = event.target.closest?.('.widget');
    if (!over || over === dragged) return;
    const box = over.getBoundingClientRect();
    const after = event.clientX > box.left + box.width / 2;
    grid.insertBefore(dragged, after ? over.nextSibling : over);
  });
  grid.addEventListener('drop', (event) => event.preventDefault());
  grid.addEventListener('dragend', withToast(async () => {
    if (!dragged) return;
    dragged.classList.remove('is-dragging');
    dragged.draggable = false;
    dragged = null;
    const widgets = [...grid.querySelectorAll('.widget')].map((card) => card.dataset.widget);
    if (widgets.join() === panel.widgets.join()) return;
    await savePanelOrder(panel, widgets);
    showToast('Organização salva.');
    render();
  }));
}

// Painel: tela

// O painel mostra um mês; o gráfico de fluxo traz os meses anteriores para dar contexto.
function periodRange() {
  const { to } = state.period;
  return { from: shiftMonth(to, 1 - CHART_MONTHS), to };
}

function monthControl() {
  const current = state.today.slice(0, 7);
  const go = (month) => () => {
    state.period.to = month;
    render();
  };
  return h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mês anterior', onclick: go(shiftMonth(state.period.to, -1)) }, icon('left')),
    h('span', { class: 'month-nav-label', 'aria-live': 'polite', text: capitalize(monthLabel(state.period.to)) }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Próximo mês', onclick: go(shiftMonth(state.period.to, 1)) }, icon('right')),
    state.period.to !== current && h('button', { class: 'link-btn', type: 'button', text: 'Mês atual', onclick: go(current) }),
  );
}

function panelOptions(panel, catalog, panels) {
  const close = (event) => {
    event.currentTarget.closest('details').open = false;
  };
  const item = (text, action) => h('button', {
    type: 'button',
    text,
    onclick: (event) => {
      close(event);
      action();
    },
  });
  return h('details', { class: 'widget-menu dash-menu' },
    h('summary', { 'aria-label': 'Mais opções do painel', title: 'Mais opções' }, icon('more')),
    h('div', { class: 'widget-menu-list' },
      item('Organizar blocos', () => {
        state.organizing = true;
        render();
      }),
      item('Editar este painel', () => openPanelDialog(panel, catalog, panels.length > 1)),
      item('Criar novo painel', () => openPanelDialog(null, catalog, false)),
      item('Compartilhar', () => openShareDialog(panel)),
    ),
  );
}

function openPanelDialog(panel, catalog, canDelete) {
  const name = h('input', { required: true, maxLength: 40, value: panel?.name ?? '', autocomplete: 'off' });
  const chosen = new Set(panel?.widgets ?? ['entradas', 'saidas', 'saldo']);
  const options = catalog.map(({ id, label }) => {
    const input = h('input', {
      type: 'checkbox',
      checked: chosen.has(id),
      onchange: (event) => {
        if (event.target.checked) chosen.add(id);
        else chosen.delete(id);
      },
    });
    return h('label', { class: 'check-field' }, input, h('span', { text: label }));
  });
  const error = formError();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    // Mantém a ordem que a pessoa já organizou e põe os blocos novos no fim.
    const kept = (panel?.widgets ?? []).filter((id) => chosen.has(id));
    const added = catalog.map(({ id }) => id).filter((id) => chosen.has(id) && !kept.includes(id));
    const body = { name: name.value, widgets: [...kept, ...added] };
    try {
      const saved = await api(panel ? `/api/panels/${panel.id}` : '/api/panels', { method: panel ? 'PUT' : 'POST', body });
      dialog.close();
      showToast('Painel salvo.');
      if (location.hash === `#/painel/${saved.id}`) render();
      else location.hash = `#/painel/${saved.id}`;
    } catch (err) {
      showFormError(error, err);
    }
  };
  const remove = withToast(async () => {
    await api(`/api/panels/${panel.id}`, { method: 'DELETE' });
    dialog.close();
    showToast('Painel apagado.');
    location.hash = '#/painel';
    render();
  });
  const dialog = openDialog(panel ? 'Editar layout' : 'Novo painel',
    h('form', { onsubmit: submit },
      h('label', { class: 'field' }, h('span', { text: 'Nome do painel' }), name),
      h('p', { class: 'field', style: { marginTop: '12px' }, text: 'Blocos' }),
      h('div', { class: 'widget-options' }, options),
      error,
      h('div', { class: 'dialog-actions' },
        panel && canDelete && h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar painel', onclick: remove }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
        h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      ),
    ),
  );
  if (!panel) name.focus();
}

function openShareDialog(panel) {
  const body = h('div', {});
  const showShared = ({ url, expires_at: expiresAt }) => {
    const input = h('input', { class: 'share-url', readOnly: true, value: url, 'aria-label': 'Link do painel', onfocus: (event) => event.target.select() });
    body.replaceChildren(
      h('p', { text: 'Pronto. Guarde este link: ele só aparece agora.' }),
      input,
      h('p', { class: 'hint', text: `Vale até ${dateLabel(expiresAt)}. Quem tiver o link vê este painel sem precisar de conta.` }),
      h('div', { class: 'dialog-actions' },
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: 'Copiar link',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(url);
              showToast('Link copiado.');
            } catch {
              input.select();
              showToast('Copie o link selecionado.');
            }
          },
        }),
        h('button', { class: 'btn', type: 'button', text: 'Fechar', onclick: () => dialog.close() }),
      ),
    );
  };
  const create = withToast(async () => {
    showShared(await api(`/api/panels/${panel.id}/share`, { method: 'POST' }));
    render();
  });
  const stop = withToast(async () => {
    await api(`/api/panels/${panel.id}/share`, { method: 'DELETE' });
    dialog.close();
    showToast('O link deixou de funcionar.');
    render();
  });
  body.append(
    h('p', { text: `Crie um link para mostrar o painel “${panel.name}” a outra pessoa, como quem faz a sua contabilidade. Ela só vê os blocos deste painel e não consegue alterar nada.` }),
    panel.share && h('p', { class: 'hint', style: { marginTop: '10px' }, text: `Há um link ativo até ${dateLabel(panel.share.expires_at)}. Criar outro cancela o anterior.` }),
    h('div', { class: 'dialog-actions' },
      panel.share && h('button', { class: 'btn btn-danger', type: 'button', text: 'Parar de compartilhar', onclick: stop }),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
      h('button', { class: 'btn btn-primary', type: 'button', text: panel.share ? 'Criar outro link' : 'Criar link', onclick: create }),
    ),
  );
  const dialog = openDialog('Compartilhar painel', body);
}

async function renderPainel(param) {
  const range = periodRange();
  const [{ panels, catalog }, data] = await Promise.all([
    api('/api/panels'),
    api(`/api/panel-data?from=${range.from}&to=${range.to}`),
  ]);
  const panel = panels.find((item) => String(item.id) === param) ?? panels[0];
  const ctx = { readOnly: false, organizing: state.organizing, panel };
  return h('div', {},
    paywallBanner(),
    h('header', { class: 'dash-head' },
      h('h1', { class: 'dash-title', text: 'Análises' }),
      newEntryButton(),
    ),
    h('div', { class: 'dash-bar' },
      monthControl(),
      h('div', { class: 'dash-tabs' },
        h('nav', { class: 'panel-tabs', 'aria-label': 'Painéis' },
          panels.map((item) => h('a', { class: 'panel-tab', href: `#/painel/${item.id}`, 'aria-current': item.id === panel.id ? 'page' : null, text: item.name })),
        ),
        panelOptions(panel, catalog, panels),
      ),
    ),
    state.organizing && h('div', { class: 'organize-bar', role: 'status' },
      h('span', { text: 'Arraste os blocos pela alça ou use o menu de cada um.' }),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: 'Concluir',
        onclick: () => {
          state.organizing = false;
          render();
        },
      }),
    ),
    widgetGrid(panel.widgets, data, ctx),
  );
}

// Lançamentos

async function renderLancamentos() {
  await Promise.all([loadCategories(), loadAccounts()]);
  const list = h('div', { 'aria-live': 'polite' });
  let listToken = 0;

  const loadList = async () => {
    const token = ++listToken;
    const params = new URLSearchParams({ month: state.month });
    if (state.entryType) params.set('type', state.entryType);
    if (state.categoryId) params.set('category_id', state.categoryId);
    if (state.accountId) params.set('account_id', state.accountId);
    if (state.query) params.set('q', state.query);
    const rows = await api(`/api/entries?${params}`);
    if (token !== listToken) return;
    if (!rows.length) {
      const filtered = state.categoryId || state.accountId || state.entryType || state.query;
      list.replaceChildren(filtered
        ? h('div', { class: 'empty' }, h('strong', { text: 'Nada encontrado' }), h('p', { text: 'Tente outro filtro ou outra busca.' }))
        : emptyMonth());
      return;
    }
    const days = new Map();
    for (const row of rows) days.set(row.date, [...(days.get(row.date) ?? []), row]);
    const sum = (items, kind) => items.filter((row) => row.kind === kind).reduce((total, row) => total + row.amount_cents, 0);
    list.replaceChildren(
      h('p', { class: 'hint', style: { marginBottom: '10px' }, text: `${plural(rows.length, 'lançamento', 'lançamentos')} · Entradas ${brl(sum(rows, 'income'))} · Saídas ${brl(sum(rows, 'expense'))}` }),
      ...[...days].map(([day, items]) => h('section', { class: 'day' },
        h('div', { class: 'day-head' },
          h('span', { class: 'day-name', text: dayLabel(day) }),
          h('span', { text: brl(sum(items, 'income') - sum(items, 'expense')) }),
        ),
        h('div', { class: 'rows' }, items.map((row) => entryRow(row))),
      )),
    );
  };

  let searchTimer;
  const search = h('input', {
    type: 'search',
    placeholder: 'Buscar pela descrição',
    'aria-label': 'Buscar pela descrição',
    value: state.query,
    oninput: (event) => {
      state.query = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadList, SEARCH_DELAY_MS);
    },
  });
  const filterSelect = (label, key, options) => h('select', {
    'aria-label': label,
    onchange: (event) => {
      state[key] = event.target.value;
      loadList();
    },
  }, options);
  const type = filterSelect('Filtrar por tipo', 'entryType', [
    ['', 'Entradas e saídas'], ['income', 'Só entradas'], ['expense', 'Só saídas'],
  ].map(([value, text]) => h('option', { value, text, selected: state.entryType === value })));
  const category = filterSelect('Filtrar por categoria', 'categoryId', [
    h('option', { value: '', text: 'Todas as categorias', selected: !state.categoryId }), ...categoryOptions(state.categoryId),
  ]);
  const account = filterSelect('Filtrar por conta', 'accountId', [
    h('option', { value: '', text: 'Todas as contas', selected: !state.accountId }), ...accountOptions(state.accountId),
  ]);

  await loadList();
  return h('div', {},
    advisorHeader(ADVISORS.finance),
    paywallBanner(),
    monthBar(newEntryButton()),
    h('div', { class: 'filters' },
      h('div', { class: 'wide' }, search),
      type,
      category,
      account,
      h('a', { class: 'btn', href: `/api/export.csv?month=${state.month}`, download: `lancamentos-${state.month}.csv` }, icon('download'), 'Planilha'),
    ),
    list,
  );
}

// Contas e cartões

function openAccountDialog(account) {
  const name = h('input', { required: true, maxLength: 40, value: account?.name ?? '', autocomplete: 'off', placeholder: 'Nubank' });
  const kind = h('select', {},
    h('option', { value: 'conta', text: 'Conta', selected: account?.kind !== 'cartao' }),
    h('option', { value: 'cartao', text: 'Cartão de crédito', selected: account?.kind === 'cartao' }),
  );
  const opening = h('input', { inputMode: 'decimal', autocomplete: 'off', placeholder: '0,00', value: account?.opening_cents ? formatNumber(account.opening_cents).replace(/\./g, '') : '' });
  const openingField = h('label', { class: 'field wide', hidden: account?.kind === 'cartao' }, h('span', { text: 'Saldo de hoje antes dos lançamentos (R$)' }), opening);
  kind.addEventListener('change', () => {
    openingField.hidden = kind.value === 'cartao';
  });
  const error = formError();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const body = { name: name.value, kind: kind.value, opening: opening.value };
    try {
      await api(account ? `/api/accounts/${account.id}` : '/api/accounts', { method: account ? 'PUT' : 'POST', body });
      dialog.close();
      showToast('Conta salva.');
      render();
    } catch (err) {
      showFormError(error, err);
    }
  };
  const remove = () => {
    const confirmation = openDialog(`Apagar ${account.name}?`,
      h('p', { text: 'Os lançamentos continuam, só deixam de estar ligados a esta conta.' }),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => confirmation.close() }),
        h('button', {
          class: 'btn btn-danger',
          type: 'button',
          text: 'Apagar',
          onclick: withToast(async () => {
            await api(`/api/accounts/${account.id}`, { method: 'DELETE' });
            confirmation.close();
            dialog.close();
            showToast('Conta apagada.');
            render();
          }),
        }),
      ),
    );
  };
  const dialog = openDialog(account ? 'Editar conta' : 'Nova conta ou cartão',
    h('form', { onsubmit: submit },
      h('div', { class: 'form-grid' },
        h('label', { class: 'field wide' }, h('span', { text: 'Nome' }), name),
        h('label', { class: 'field wide' }, h('span', { text: 'Tipo' }), kind),
        openingField,
      ),
      h('p', { class: 'hint', style: { marginTop: '6px' }, text: 'Quando o saldo for negativo, comece com um sinal de menos.' }),
      error,
      h('div', { class: 'dialog-actions' },
        account && h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar', onclick: remove }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
        h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      ),
    ),
  );
  if (!account) name.focus();
}

async function renderContas() {
  const accounts = await loadAccounts();
  const monthWord = monthName(state.today.slice(0, 7));
  return h('div', {},
    advisorHeader(ADVISORS.finance),
    paywallBanner(),
    h('header', { class: 'topbar' },
      h('p', { class: 'muted topbar-text', text: 'O saldo é calculado com o que você anota aqui. Por enquanto, o app não se liga aos bancos.' }),
      canWrite() && h('button', { class: 'btn btn-primary btn-add', type: 'button', 'aria-label': 'Nova conta', onclick: () => openAccountDialog() },
        icon('plus'), h('span', { class: 'btn-label', text: 'Nova conta' })),
    ),
    accounts.length
      ? h('div', { class: 'rows' }, accounts.map((account) => h('button', { class: 'row', type: 'button', onclick: () => openAccountDialog(account) },
        h('span', { class: `row-mark${account.balance_cents < 0 ? '' : ' is-income'}`, 'aria-hidden': 'true' }),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title', text: account.name }),
          h('span', { class: 'row-sub', text: account.kind === 'cartao' ? `Cartão · fatura de ${monthWord}` : 'Conta' }),
        ),
        h('span', { class: 'row-amount', text: brl(account.balance_cents) }),
      )))
      : h('div', { class: 'empty panel' },
        h('strong', { text: 'Nenhuma conta cadastrada' }),
        h('p', { text: 'Cadastre suas contas e cartões. Depois, é só escrever “mercado 50 no nubank” na Conversa.' }),
      ),
  );
}

// Categorias

function openCategoryDialog(category) {
  const name = h('input', { required: true, maxLength: 40, value: category?.name ?? '', autocomplete: 'off' });
  const emoji = h('input', { maxLength: 8, value: category?.emoji ?? '📦', 'aria-label': 'Emoji', autocomplete: 'off' });
  const keywords = h('textarea', { value: category?.keywords.join(', ') ?? '', placeholder: 'fralda, pediatra, berço' });
  const error = formError();

  const submit = async (event) => {
    event.preventDefault();
    const body = { name: name.value, emoji: emoji.value, keywords: keywords.value.split(',') };
    try {
      if (category) await api(`/api/categories/${category.id}`, { method: 'PUT', body });
      else await api('/api/categories', { method: 'POST', body });
      dialog.close();
      showToast('Categoria salva.');
      render();
    } catch (err) {
      showFormError(error, err);
    }
  };

  const confirmRemove = () => {
    const confirmation = openDialog(
      `Apagar ${category.name}?`,
      h('p', { text: 'Os gastos desta categoria vão para Outros. O total do mês não muda.' }),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => confirmation.close() }),
        h('button', {
          class: 'btn btn-danger',
          type: 'button',
          text: 'Apagar',
          onclick: async () => {
            await api(`/api/categories/${category.id}`, { method: 'DELETE' });
            confirmation.close();
            dialog.close();
            showToast('Categoria apagada.');
            render();
          },
        }),
      ),
    );
  };

  const dialog = openDialog(category ? 'Editar categoria' : 'Nova categoria',
    h('form', { onsubmit: submit },
      h('div', { class: 'form-grid' },
        h('label', { class: 'field wide' }, h('span', { text: 'Nome' }), name),
        h('label', { class: 'field wide' }, h('span', { text: 'Emoji' }), emoji),
        h('label', { class: 'field wide' }, h('span', { text: 'Suas palavras para esta categoria' }), keywords),
      ),
      h('p', { class: 'hint', style: { marginTop: '6px' }, text: 'Separe por vírgula. Elas se somam às palavras que o assessor já reconhece, e valem só para você.' }),
      error,
      h('div', { class: 'dialog-actions' },
        category && !category.is_default && category.slug !== MAINTENANCE_SLUG && h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar', onclick: confirmRemove }),
        category?.slug === MAINTENANCE_SLUG && h('a', { class: 'btn', href: '#/veiculos', text: 'Ver histórico', onclick: () => dialog.close() }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
        h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      ),
    ),
  );
}

async function renderCategorias() {
  const categories = await loadCategories();
  return h('div', {},
    advisorHeader(ADVISORS.finance),
    paywallBanner(),
    h('header', { class: 'topbar' },
      h('p', { class: 'muted topbar-text', text: 'Quando você corrige a categoria de um gasto, o assessor aprende e acerta da próxima vez.' }),
      h('button', { class: 'btn btn-primary btn-add', type: 'button', 'aria-label': 'Nova categoria', onclick: () => openCategoryDialog() },
        icon('plus'), h('span', { class: 'btn-label', text: 'Nova categoria' })),
    ),
    h('div', { class: 'rows' }, categories.map((category) =>
      h('button', { class: 'row', type: 'button', onclick: () => openCategoryDialog(category) },
        h('span', { class: 'row-emoji', 'aria-hidden': 'true', text: category.emoji }),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title', text: category.name }),
          h('span', { class: 'row-sub cat-edit-sub', text: category.slug === MAINTENANCE_SLUG ? 'O histórico completo fica na aba Veículos' : category.keywords.join(', ') || (category.is_default ? 'Para o que nenhuma outra categoria reconhece' : 'Usa as palavras que o assessor já reconhece') }),
        ),
      ),
    )),
  );
}

// Veículos: o raio-x de tudo que já foi feito, a partir dos gastos da categoria de manutenção.

const fullDate = (ymd) => `${ymd.slice(8)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
const formatKm = (km) => `${km.toLocaleString('pt-BR')} km`;
const serviceCount = (count) => plural(count, 'manutenção', 'manutenções');
const serviceAmount = (row) => (row.total_cents ? brl(row.total_cents) : NO_VALUE);

function vehicleFormFields(vehicle) {
  const name = h('input', { required: true, maxLength: 60, value: vehicle?.name ?? '', autocomplete: 'off', placeholder: 'Honda Civic 2018' });
  const plate = h('input', { maxLength: 10, value: vehicle?.plate ?? '', autocomplete: 'off', placeholder: 'ABC1D23' });
  return {
    name,
    grid: h('div', { class: 'form-grid' },
      h('label', { class: 'field wide' }, h('span', { text: 'Nome do veículo' }), name),
      h('label', { class: 'field wide' }, h('span', { text: 'Placa (opcional)' }), plate),
    ),
    body: () => ({ name: name.value, plate: plate.value }),
  };
}

function openVehicleDialog(vehicle) {
  const fields = vehicleFormFields(vehicle);
  const error = formError();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      const saved = await api(vehicle ? `/api/vehicles/${vehicle.id}` : '/api/vehicles', { method: vehicle ? 'PUT' : 'POST', body: fields.body() });
      dialog.close();
      showToast('Veículo salvo.');
      if (location.hash === `#/veiculos/${saved.id}`) render();
      else location.hash = `#/veiculos/${saved.id}`;
    } catch (err) {
      showFormError(error, err);
    }
  };
  const remove = () => {
    const confirmation = openDialog(`Apagar ${vehicle.name}?`,
      h('p', { text: 'As manutenções continuam nas suas finanças, só ficam sem veículo definido.' }),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => confirmation.close() }),
        h('button', {
          class: 'btn btn-danger',
          type: 'button',
          text: 'Apagar',
          onclick: withToast(async () => {
            await api(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
            confirmation.close();
            dialog.close();
            showToast('Veículo apagado.');
            location.hash = '#/veiculos';
          }),
        }),
      ),
    );
  };
  const dialog = openDialog(vehicle ? 'Editar veículo' : 'Novo veículo',
    h('form', { onsubmit: submit },
      fields.grid,
      error,
      h('div', { class: 'dialog-actions' },
        vehicle && h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar', onclick: remove }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
        h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      ),
    ),
  );
  if (!vehicle) fields.name.focus();
}

function firstVehicleForm() {
  const fields = vehicleFormFields();
  const error = formError();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      const saved = await api('/api/vehicles', { method: 'POST', body: fields.body() });
      showToast('Veículo salvo.');
      location.hash = `#/veiculos/${saved.id}`;
    } catch (err) {
      showFormError(error, err);
    }
  };
  return h('section', { class: 'panel vehicle-start' },
    h('h2', { class: 'panel-title', text: 'Cadastre seu veículo' }),
    h('p', { class: 'muted account-text', text: 'Anote cada manutenção: quando foi, onde e o que foi trocado. Na hora de vender, é só gerar o relatório com tudo que já foi feito.' }),
    h('form', { onsubmit: submit }, fields.grid, error, h('button', { class: 'btn btn-primary', type: 'submit', text: 'Cadastrar veículo' })),
  );
}

function serviceRow(row) {
  const details = [
    row.place,
    row.odometer_km !== null && formatKm(row.odometer_km),
    row.installments && `em ${row.installments}x`,
  ].filter(Boolean).join(' · ');
  return h('button', { class: 'row', type: 'button', onclick: withToast(() => openEntryDialog(row)) },
    h('span', { class: 'service-date', text: fullDate(row.spent_on) }),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title', text: row.description }),
      details && h('span', { class: 'row-sub', text: details }),
    ),
    h('span', { class: 'row-amount', text: serviceAmount(row) }),
  );
}

function serviceGroups(done) {
  const years = new Map();
  for (const row of done) {
    const year = row.spent_on.slice(0, 4);
    years.set(year, [...(years.get(year) ?? []), row]);
  }
  return [...years].map(([year, rows]) => h('section', { class: 'day' },
    h('div', { class: 'day-head' }, h('span', { text: year }), h('span', { text: serviceCount(rows.length) })),
    h('div', { class: 'rows' }, rows.map(serviceRow)),
  ));
}

function vehicleStats({ service_count: count, total_cents: total, last_on: lastOn, last_km: lastKm }) {
  const stat = (label, value) => h('div', { class: 'vehicle-stat' }, h('span', { text: label }), h('strong', { text: value }));
  return h('div', { class: 'vehicle-stats' },
    stat('Manutenções', String(count)),
    stat('Total investido', brl(total)),
    stat('Última', lastOn ? fullDate(lastOn) : 'Nenhuma'),
    stat('Quilometragem', lastKm === null ? 'Não informada' : formatKm(lastKm)),
  );
}

async function renderVeiculos(param) {
  const { vehicles, unassigned_count: unassignedCount } = await api('/api/vehicles');
  state.vehicles = vehicles;
  const showUnassigned = unassignedCount > 0 && (param === UNASSIGNED_ROUTE || !vehicles.length);
  const selected = showUnassigned ? null : vehicles.find((item) => String(item.id) === param) ?? vehicles[0] ?? null;
  const history = selected || showUnassigned ? await api(`/api/vehicles/${selected?.id ?? 'none'}/history`) : null;
  const addService = withToast(() => openEntryDialog(null, 'expense', { vehicleId: selected?.id }));

  return h('div', {},
    advisorHeader(ADVISORS.finance),
    paywallBanner(),
    (vehicles.length > 1 || (vehicles.length > 0 && unassignedCount > 0)) && h('nav', { class: 'dash-tabs vehicle-tabs', 'aria-label': 'Veículos' },
      vehicles.map((item) => h('a', { class: 'panel-tab', href: `#/veiculos/${item.id}`, 'aria-current': item.id === selected?.id ? 'page' : null, text: item.name })),
      unassignedCount > 0 && h('a', { class: 'panel-tab', href: `#/veiculos/${UNASSIGNED_ROUTE}`, 'aria-current': showUnassigned ? 'page' : null, text: `Sem veículo (${unassignedCount})` }),
    ),
    !vehicles.length && canWrite() && firstVehicleForm(),
    selected && h('section', { class: 'panel vehicle-card' },
      h('div', { class: 'vehicle-head' },
        h('div', {},
          h('h1', { class: 'vehicle-name', text: selected.name }),
          selected.plate && h('p', { class: 'vehicle-plate', text: selected.plate }),
        ),
        canWrite() && h('button', { class: 'btn', type: 'button', text: 'Editar', onclick: () => openVehicleDialog(selected) }),
      ),
      vehicleStats(history.summary),
      h('div', { class: 'account-actions vehicle-actions' },
        canWrite() && h('button', { class: 'btn btn-primary', type: 'button', onclick: addService }, icon('plus'), 'Adicionar manutenção'),
        history.done.length > 0 && h('a', { class: 'btn', href: `#/relatorio-veiculo/${selected.id}`, text: 'Ver relatório' }),
        canWrite() && h('button', { class: 'btn', type: 'button', text: 'Novo veículo', onclick: () => openVehicleDialog() }),
      ),
    ),
    showUnassigned && h('p', { class: 'muted vehicle-note', text: vehicles.length
      ? 'Estas manutenções ainda não têm veículo. Toque em cada uma para escolher.'
      : 'Estas manutenções vão para o histórico quando você cadastrar o veículo e escolher o veículo em cada uma.' }),
    history?.planned.length > 0 && h('section', { class: 'day' },
      h('div', { class: 'day-head' }, h('span', { text: 'Previstas' }), h('span', { text: String(history.planned.length) })),
      h('div', { class: 'rows' }, history.planned.map(serviceRow)),
    ),
    history && (history.done.length
      ? serviceGroups(history.done)
      : !history.planned.length && h('div', { class: 'empty panel' },
        h('strong', { text: 'Nenhuma manutenção anotada' }),
        h('p', { text: 'Pode começar pelas mais antigas. Também dá para escrever “troca de óleo 250 na oficina do zé” na Conversa.' }),
      )),
  );
}

function printReport(vehicle) {
  const title = document.title;
  // Vira o nome sugerido para o arquivo PDF.
  document.title = `Histórico de manutenção - ${vehicle.name}`;
  window.addEventListener('afterprint', () => {
    document.title = title;
  }, { once: true });
  window.print();
}

async function renderVehicleReport(param) {
  const { vehicle, done, summary } = await api(`/api/vehicles/${Number(param)}/history`);
  const showValues = state.reportValues;
  const toggle = h('input', {
    type: 'checkbox',
    checked: showValues,
    onchange: (event) => {
      state.reportValues = event.target.checked;
      render();
    },
  });
  const fact = (label, value) => value && h('div', { class: 'report-fact' }, h('span', { text: label }), h('strong', { text: value }));
  const period = done.length && (summary.first_on === summary.last_on ? fullDate(summary.first_on) : `${fullDate(summary.first_on)} a ${fullDate(summary.last_on)}`);
  return h('div', { class: 'report-page' },
    h('div', { class: 'report-toolbar' },
      h('a', { class: 'btn', href: `#/veiculos/${vehicle.id}` }, icon('left'), 'Voltar'),
      h('label', { class: 'check-field' }, toggle, h('span', { text: 'Mostrar os valores' })),
      done.length > 0 && h('button', { class: 'btn btn-primary', type: 'button', onclick: () => printReport(vehicle) }, icon('download'), 'Salvar em PDF'),
    ),
    done.length > 0 && h('p', { class: 'hint report-tip', text: 'Na janela que abrir, escolha “Salvar como PDF” como destino.' }),
    h('article', { class: 'report' },
      h('header', { class: 'report-head' },
        h('img', { class: 'logo report-logo', src: '/marca/logo-fundo-claro.png', alt: 'Nuvexx', width: 1420, height: 287 }),
        h('p', { class: 'report-kicker', text: 'Histórico de manutenção' }),
        h('h1', { class: 'report-title', text: vehicle.name }),
        vehicle.plate && h('p', { class: 'report-plate', text: `Placa ${vehicle.plate}` }),
      ),
      h('div', { class: 'report-facts' },
        fact('Manutenções', String(summary.service_count)),
        fact('Período', period),
        fact('Última quilometragem', summary.last_km === null ? null : formatKm(summary.last_km)),
        showValues && fact('Total investido', brl(summary.total_cents)),
      ),
      done.length
        ? h('table', { class: 'report-table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col', text: 'Data' }),
            h('th', { scope: 'col', text: 'Peça trocada ou serviço' }),
            h('th', { scope: 'col', text: 'Onde foi feito' }),
            h('th', { scope: 'col', text: 'Km' }),
            showValues && h('th', { scope: 'col', class: 'report-number', text: 'Valor' }),
          )),
          h('tbody', {}, done.map((row) => h('tr', {},
            h('td', { 'data-label': 'Data', text: fullDate(row.spent_on) }),
            h('td', { 'data-label': 'Serviço', text: row.description }),
            h('td', { 'data-label': 'Onde', text: row.place ?? '—' }),
            h('td', { 'data-label': 'Km', text: row.odometer_km === null ? '—' : row.odometer_km.toLocaleString('pt-BR') }),
            showValues && h('td', { 'data-label': 'Valor', class: 'report-number', text: serviceAmount(row) }),
          ))),
        )
        : h('p', { class: 'report-empty', text: 'Nenhuma manutenção anotada para este veículo.' }),
      h('footer', { class: 'report-foot' },
        h('p', { text: `Gerado pelo Nuvexx em ${fullDate(state.today)}.` }),
        h('p', { text: 'As informações foram anotadas pelo dono do veículo e não foram conferidas. Este relatório não é uma vistoria nem um laudo técnico.' }),
      ),
    ),
  );
}

// Agenda

async function connectGoogle() {
  try {
    const { url } = await api('/api/google/link', { method: 'POST' });
    location.href = url;
  } catch (err) {
    showToast(err.message);
  }
}

function googleCard() {
  const { configured, connected } = state.me.google;
  if (connected) {
    return h('div', { class: 'google-card' },
      icon('check', 'check-mark ok'),
      h('div', { class: 'check-body' },
        h('div', { class: 'check-title', text: 'Conectado ao Google Agenda' }),
        h('div', { class: 'check-sub', text: 'Tudo que você marcar vai para a sua agenda.' }),
      ),
    );
  }
  if (!configured) {
    return h('div', { class: 'google-card' },
      h('div', { class: 'check-body' },
        h('div', { class: 'check-title', text: 'Google Agenda' }),
        h('div', { class: 'check-sub', text: 'A conexão ainda não está disponível. Seus compromissos ficam guardados aqui e serão enviados quando você conectar.' }),
      ),
    );
  }
  return h('div', { class: 'google-card' },
    h('div', { class: 'check-body' },
      h('div', { class: 'check-title', text: 'Leve seus compromissos para o Google Agenda' }),
      h('div', { class: 'check-sub', text: 'Conecte uma vez, e tudo que você marcar vai para lá sozinho.' }),
    ),
    h('button', { class: 'btn btn-primary', type: 'button', text: 'Conectar', onclick: connectGoogle }),
  );
}

// Os mesmos campos servem para adicionar, na página, e para editar, na janela.
function appointmentFields(row) {
  const title = h('input', { required: true, maxLength: 120, value: row?.title ?? '', autocomplete: 'off' });
  const date = h('input', { type: 'date', required: true, value: row?.starts_on ?? state.today });
  const time = h('input', { type: 'time', value: row?.start_time ?? '' });
  const endTime = h('input', { type: 'time', value: row?.end_time ?? '' });
  return {
    grid: h('div', { class: 'form-grid' },
      h('label', { class: 'field wide' }, h('span', { text: 'O que é' }), title),
      h('label', { class: 'field wide' }, h('span', { text: 'Dia' }), date),
      h('label', { class: 'field' }, h('span', { text: 'Início' }), time),
      h('label', { class: 'field' }, h('span', { text: 'Término' }), endTime),
    ),
    hint: h('p', { class: 'hint', style: { marginTop: '6px' }, text: 'Sem início, vale para o dia todo. Sem término, dura 1 hora.' }),
    body: () => ({ title: title.value, date: date.value, time: time.value || null, end_time: endTime.value || null }),
  };
}

function appointmentAddCard() {
  const fields = appointmentFields();
  const error = formError();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      await api('/api/appointments', { method: 'POST', body: fields.body() });
      showToast('Evento adicionado.');
      render();
    } catch (err) {
      showFormError(error, err);
    }
  };
  return h('section', { class: 'agenda-add', id: AGENDA_ADD_ID },
    h('h2', { class: 'section-title', text: 'Adicionar evento' }),
    h('form', { onsubmit: submit },
      fields.grid,
      h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      fields.hint,
      error,
    ),
  );
}

function goToAddCard() {
  const card = document.getElementById(AGENDA_ADD_ID);
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  card.scrollIntoView({ behavior, block: 'start' });
  card.querySelector('input').focus({ preventScroll: true });
}

function openAppointmentDialog(row) {
  const fields = appointmentFields(row);
  const error = formError();

  const close = () => dialog.close();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      await api(`/api/appointments/${row.id}`, { method: 'PUT', body: fields.body() });
      close();
      showToast('Compromisso atualizado.');
      render();
    } catch (err) {
      showFormError(error, err);
    }
  };

  const confirmRemove = () => {
    const confirmation = openDialog(
      'Cancelar este compromisso?',
      h('p', { text: row.google_event_id ? `${row.title}. Ele também sai do seu Google Agenda.` : `${row.title}.` }),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', text: 'Voltar', onclick: () => confirmation.close() }),
        h('button', {
          class: 'btn btn-danger',
          type: 'button',
          text: 'Cancelar compromisso',
          onclick: async () => {
            await api(`/api/appointments/${row.id}`, { method: 'DELETE' });
            confirmation.close();
            close();
            showToast('Compromisso cancelado.');
            render();
          },
        }),
      ),
    );
  };

  const dialog = openDialog('Editar compromisso',
    h('form', { onsubmit: submit },
      fields.grid,
      fields.hint,
      error,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-danger', type: 'button', text: 'Cancelar compromisso', onclick: confirmRemove }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Voltar', onclick: close }),
        h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      ),
    ),
  );
}

function appointmentRow(row) {
  const syncNote = !state.me.google.connected ? null
    : row.sync_status === 'synced' ? 'No Google Agenda'
      : 'Enviando ao Google Agenda';
  return h('button', { class: 'row', type: 'button', onclick: () => openAppointmentDialog(row) },
    h('span', { class: 'row-time', text: row.start_time ?? 'Dia todo' }),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title', text: row.title }),
      (row.end_time || syncNote) && h('span', { class: 'row-sub', text: [row.end_time && `até ${row.end_time}`, syncNote].filter(Boolean).join(' · ') }),
    ),
  );
}

const clockMinutes = (hhmm) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
};

const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const boxesTouch = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Procura um lugar livre para cada rótulo: fora do arco ou dentro dele. Sem espaço, ele fica só na lista abaixo.
// Na tela estreita, o rótulo é só o horário: nome e horário não caberiam em todos os pontos.
function placeArcLabels(points, reserved, width, bottom, showTitles, crossesLine) {
  const taken = [...reserved];
  const isFree = (box) => !crossesLine(box) && !taken.some((other) => boxesTouch(box, other));
  return points.map((point) => {
    const onLeft = point.x < width / 2;
    const spots = [
      { x: point.x + (onLeft ? -12 : 12), y: point.y - (showTitles ? 26 : 12), anchor: onLeft ? 'end' : 'start' },
      { x: point.x + (onLeft ? 14 : -14), y: point.y + (showTitles ? 26 : 20), anchor: onLeft ? 'start' : 'end' },
      // Nas pontas do arco, as outras duas saem da tela ou caem sobre as horas da base.
      { x: point.x + (onLeft ? 14 : -14), y: point.y + 3, anchor: onLeft ? 'start' : 'end' },
    ];
    for (const spot of spots) {
      const room = Math.floor((spot.anchor === 'end' ? spot.x : width - spot.x) / ARC_CHAR_WIDTH);
      if (room < (showTitles ? ARC_TITLE_MIN : ARC_TIME_CHARS)) continue;
      const title = showTitles ? shorten(point.title, Math.min(ARC_TITLE_MAX, room)) : '';
      // O horário fica embaixo do nome: um nome curto não deixa o rótulo mais estreito que ele.
      const labelWidth = Math.max(title.length, ARC_TIME_CHARS) * ARC_CHAR_WIDTH;
      const left = spot.anchor === 'end' ? spot.x - labelWidth : spot.x;
      const box = { left, right: left + labelWidth, top: spot.y - 14, bottom: spot.y + (showTitles ? 26 : 5) };
      if (box.top < 0 || box.bottom > bottom || !isFree(box)) continue;
      taken.push(box);
      return { ...spot, title };
    }
    return null;
  });
}

// O dia como um arco, do nascer ao pôr do sol: quanto mais cedo ou mais tarde, mais baixo o ponto.
function dayArcSvg(plan, width, height, now) {
  const wide = width >= ARC_WIDE_MIN;
  const margin = wide ? Math.max(70, width * 0.1) : 18;
  const baseY = height - 34;
  // Numa tela muito alta, o arco fica apoiado embaixo em vez de virar uma torre.
  const topY = Math.max(wide ? 64 : 52, baseY - width * (wide ? ARC_MAX_RATIO : ARC_PHONE_MAX_RATIO));
  // Quanto mais alto em relação à largura, mais arredondado, para o topo não virar uma ponta.
  const roundness = 2 + Math.max(0, (baseY - topY) / (width - margin * 2) - 0.5);

  const starts = plan.timed.map((row) => clockMinutes(row.start_time));
  // Um horário de fim menor que o de início passou da meia-noite.
  const ends = plan.timed.map((row, index) => Math.max(starts[index], clockMinutes(row.end_time ?? row.start_time)));
  const nowMinutes = clockMinutes(now);
  // A linha cresce para caber tudo, inclusive a hora atual: o resumo chega às 5h30, antes das 8h.
  const from = Math.min(ARC_FIRST_HOUR * 60, ...[...starts, nowMinutes].map((value) => Math.floor(value / 60) * 60));
  const to = Math.max(ARC_LAST_HOUR * 60, ...[...ends, nowMinutes].map((value) => Math.ceil(value / 60) * 60));
  const span = to - from;
  const x = (minutes) => margin + ((minutes - from) / span) * (width - margin * 2);
  const y = (minutes) => {
    const position = ((minutes - from) / span) * 2 - 1;
    return baseY - (baseY - topY) * (1 - Math.abs(position) ** roundness);
  };
  const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const text = (className, attrs, content) => svg('text', { class: className, ...attrs }, document.createTextNode(content));

  // Trechos curtos: num arco alto, um trecho longo atravessaria um texto sem nenhum ponto cair dentro dele.
  const steps = 288;
  const line = Array.from({ length: steps + 1 }, (_, index) => {
    const minutes = from + (span * index) / steps;
    return { x: x(minutes), y: y(minutes) };
  });
  const d = line.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const crossesLine = (box) => line.some((point) => point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom);

  // Quanto da linha já foi percorrido em cada hora, para cada horário surgir quando ela chega nele.
  const walked = [0];
  for (let index = 1; index <= steps; index += 1) {
    walked.push(walked[index - 1] + Math.hypot(line[index].x - line[index - 1].x, line[index].y - line[index - 1].y));
  }
  const reachedAt = (minutes) => {
    const position = ((minutes - from) / span) * steps;
    const index = Math.min(Math.floor(position), steps - 1);
    return (walked[index] + (walked[index + 1] - walked[index]) * (position - index)) / walked[steps];
  };
  const reveal = (at, ...children) => svg('g', { class: 'arc-reveal', 'data-at': at.toFixed(3) }, ...children);

  const gradient = svg('linearGradient', { id: 'arco-do-dia', x1: 0, x2: 1, y1: 0, y2: 0 },
    svg('stop', { offset: '0', 'stop-color': '#a5b4fc', 'stop-opacity': '0.2' }),
    svg('stop', { offset: '0.28', 'stop-color': '#fff', 'stop-opacity': '0.75' }),
    svg('stop', { offset: '0.5', 'stop-color': '#fff', 'stop-opacity': '0.95' }),
    svg('stop', { offset: '0.72', 'stop-color': '#fff', 'stop-opacity': '0.75' }),
    svg('stop', { offset: '1', 'stop-color': '#a5b4fc', 'stop-opacity': '0.2' }),
  );

  const points = plan.timed.map((row, index) => ({ row, title: row.title, x: x(starts[index]), y: y(starts[index]) }));
  const dotBox = ({ x: px, y: py }, size) => ({ left: px - size, right: px + size, top: py - size, bottom: py + size });

  const nowX = x(nowMinutes);
  const nowY = y(nowMinutes);
  // No arco alto do celular, o número do centro fica mais embaixo, onde o arco é mais largo.
  const middleY = topY + (baseY - topY) * (wide ? 0.42 : 0.56);
  const centerHalf = wide ? 80 : 62;
  const centerBox = { left: width / 2 - centerHalf, right: width / 2 + centerHalf, top: middleY - 34, bottom: middleY + 34 };
  const dotBoxes = points.map((point) => dotBox(point, 9));

  // O "Agora" fica acima do ponto, ou em volta dele quando ali a linha passaria por cima do texto.
  const inward = nowX < width / 2 ? 1 : -1;
  const toCenter = inward > 0 ? 'start' : 'end';
  const toEdge = inward > 0 ? 'end' : 'start';
  const nowSpots = [
    { x: Math.min(Math.max(nowX, ARC_NOW_HALF_WIDTH), width - ARC_NOW_HALF_WIDTH), y: nowY - (wide ? 28 : 22), anchor: 'middle' },
    { x: nowX + inward * ARC_NOW_GAP, y: nowY + 5, anchor: toCenter },
    { x: nowX - inward * ARC_NOW_GAP, y: nowY + 5, anchor: toEdge },
    { x: nowX - inward * ARC_NOW_GAP, y: nowY - 16, anchor: toEdge },
    { x: nowX + inward * ARC_NOW_GAP, y: nowY + 28, anchor: toCenter },
  ];
  const nowBox = ({ x: spotX, y: spotY, anchor }) => {
    const shift = { start: 0, middle: ARC_NOW_HALF_WIDTH, end: ARC_NOW_HALF_WIDTH * 2 }[anchor];
    return { left: spotX - shift, right: spotX - shift + ARC_NOW_HALF_WIDTH * 2, top: spotY - 14, bottom: spotY + 4 };
  };
  const fitsWithoutTouching = (spot) => {
    const box = nowBox(spot);
    return box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height - 26
      && ![centerBox, ...dotBoxes].some((other) => boxesTouch(box, other));
  };
  // Sem lugar perfeito, a linha cruzar o texto ainda é melhor que um texto em cima de outro.
  const nowSpot = nowSpots.find((spot) => fitsWithoutTouching(spot) && !crossesLine(nowBox(spot)))
    ?? nowSpots.find(fitsWithoutTouching)
    ?? nowSpots[0];
  const nowMark = [
    svg('circle', { cx: nowX, cy: nowY, r: wide ? 13 : 10, class: 'arc-sun' }),
    text('arc-now', { x: nowSpot.x, y: nowSpot.y, 'text-anchor': nowSpot.anchor }, `Agora · ${now}`),
  ];

  const reserved = [centerBox, ...dotBoxes, dotBox({ x: nowX, y: nowY }, 17), nowBox(nowSpot)];
  const labels = points.length <= ARC_MAX_LABELS ? placeArcLabels(points, reserved, width, height - 26, wide, crossesLine) : [];

  const events = points.map((point, index) => {
    const { row } = point;
    const dot = svg('g', { class: 'arc-event', tabindex: 0, 'aria-label': `${row.start_time}, ${row.title}` },
      svg('circle', { cx: point.x, cy: point.y, r: 14, class: 'arc-hit' }),
      svg('circle', { cx: point.x, cy: point.y, r: 5, class: 'arc-dot' }),
    );
    bindTooltip(dot, row.title, row.end_time ? `${row.start_time} às ${row.end_time}` : row.start_time);
    const label = labels[index];
    return reveal(reachedAt(starts[index]),
      dot,
      label?.title && text('arc-title', { x: label.x, y: label.y, 'text-anchor': label.anchor }, label.title),
      label && text('arc-time', { x: label.x, y: label.title ? label.y + 21 : label.y, 'text-anchor': label.anchor }, row.start_time),
    );
  });

  const { free, busy_label: busy, count } = plan.stats;
  let headline = null;
  if (free) headline = [free.label, 'de intervalo livre'];
  else if (busy) headline = [busy, 'ocupadas hoje'];
  else if (!count) headline = ['Dia livre', 'nada marcado'];
  const center = headline && [
    text('arc-big', { x: width / 2, y: middleY, 'text-anchor': 'middle' }, headline[0]),
    text('arc-small', { x: width / 2, y: middleY + 26, 'text-anchor': 'middle' }, headline[1]),
  ];

  return svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': 'Linha do tempo de hoje', 'data-from': from, 'data-to': to },
    svg('defs', {}, gradient),
    svg('path', { d, class: 'arc-line', stroke: 'url(#arco-do-dia)' }),
    center && reveal(ARC_CENTER_AT, center),
    events,
    reveal(reachedAt(nowMinutes), nowMark),
    reveal(0, text('arc-small', { x: x(from), y: height - 8, 'text-anchor': 'middle' }, clock(from))),
    reveal(ARC_CENTER_AT, text('arc-small', { x: width / 2, y: height - 8, 'text-anchor': 'middle' }, 'Seu dia, em uma visão')),
    reveal(1, text('arc-small', { x: x(to), y: height - 8, 'text-anchor': 'middle' }, clock(to))),
  );
}

const easeInOut = (progress) => (progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2);

// A linha se desenha de uma ponta à outra, com o relógio correndo na frente, e cada horário aparece quando ela chega nele.
function playArcIntro(drawn, startedAt, onEnd) {
  const line = drawn.querySelector('.arc-line');
  const length = line.getTotalLength();
  const first = line.getPointAtLength(0);
  const last = line.getPointAtLength(length);
  const from = Number(drawn.dataset.from);
  const to = Number(drawn.dataset.to);
  const reveals = [...drawn.querySelectorAll('.arc-reveal')];
  const hour = svg('text', { class: 'arc-tip-time', y: -16, 'text-anchor': 'middle' }, document.createTextNode(''));
  const tip = svg('g', { class: 'arc-tip' }, svg('circle', { r: 6 }), hour);
  drawn.classList.add('is-intro');
  line.style.strokeDasharray = length;
  line.style.strokeDashoffset = length;
  drawn.append(tip);

  let frame = null;
  const step = (time) => {
    if (!drawn.isConnected) return;
    const progress = Math.min(Math.max(time - startedAt, 0) / ARC_INTRO_MS, 1);
    const reached = easeInOut(progress);
    const point = line.getPointAtLength(length * reached);
    line.style.strokeDashoffset = length * (1 - reached);
    tip.setAttribute('transform', `translate(${point.x} ${point.y})`);
    const minutes = from + ((point.x - first.x) / (last.x - first.x)) * (to - from);
    hour.textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`;
    for (const item of reveals) {
      if (Number(item.dataset.at) <= reached) item.classList.add('is-shown');
    }
    if (progress < 1) {
      frame = requestAnimationFrame(step);
      return;
    }
    tip.remove();
    onEnd();
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

function dayArc(plan, withIntro) {
  const box = h('div', { class: 'day-arc' });
  // Só ao abrir a aba, e nunca para quem pediu menos movimento ao sistema.
  let intro = withIntro && !matchMedia('(prefers-reduced-motion: reduce)').matches ? { startedAt: null, stop: null } : null;
  const draw = () => {
    if (!box.clientWidth) return;
    // O ponto sob o cursor é substituído e não avisaria que o cursor saiu.
    tooltip.hidden = true;
    intro?.stop?.();
    const drawn = dayArcSvg(plan, box.clientWidth, box.clientHeight, nowTime());
    box.replaceChildren(drawn);
    if (!intro) return;
    // Um redesenho no meio da animação, como ao girar o celular, continua de onde ela estava.
    intro.startedAt ??= performance.now();
    intro.stop = playArcIntro(drawn, intro.startedAt, () => {
      intro = null;
    });
  };
  new ResizeObserver(draw).observe(box);
  const timer = setInterval(() => {
    if (box.isConnected) draw();
    else clearInterval(timer);
  }, ARC_REFRESH_MS);
  return box;
}

async function dismissBriefing(event) {
  if (state.briefingDismissed) return;
  state.briefingDismissed = true;
  const balloon = event.currentTarget.closest('.briefing');
  // Com a altura fixada, a animação recolhe o espaço e o que está embaixo sobe aos poucos.
  balloon.style.height = `${balloon.offsetHeight}px`;
  balloon.className = 'briefing is-leaving';
  await Promise.allSettled(balloon.getAnimations().map((animation) => animation.finished));
  balloon.remove();
}

// A mensagem do dia chega como uma notificação: ao abrir a aba, ela cai logo antes de a linha do dia terminar.
function briefingCard(plan, arriving) {
  const { name, title, photo } = ADVISORS.agenda;
  const { channel } = plan.briefing;
  return h('section', { class: arriving ? 'briefing is-arriving' : 'briefing', 'aria-label': `Mensagem de ${name}` },
    h('img', { class: 'briefing-photo', src: photo, alt: `Retrato de ${name}`, width: 46, height: 46 }),
    h('div', { class: 'briefing-body' },
      h('p', { class: 'briefing-head' },
        h('strong', { class: 'briefing-name', text: name }),
        h('span', { class: 'briefing-role', text: title }),
        h('span', { class: 'briefing-time', text: 'agora' }),
      ),
      h('p', { class: 'briefing-text' }, formatChat(plan.message)),
      channel && h('p', { class: 'briefing-sent' }, icon('check'), `Enviado hoje ${BRIEFING_CHANNELS[channel]}`),
    ),
    h('button', { class: 'briefing-close', type: 'button', 'aria-label': `Dispensar a mensagem de ${name}`, onclick: dismissBriefing }, icon('close')),
  );
}

function dayHero(plan) {
  const { count, start, end, busy_label: busy } = plan.stats;
  const stat = (label, value) => value && h('div', { class: 'day-stat' }, h('span', { text: label }), h('strong', { text: value }));
  return h('section', { class: 'day-hero' },
    h('div', { class: 'day-summary' },
      h('div', { class: 'day-numbers' },
        h('h1', { class: 'day-eyebrow', text: 'Compromissos de hoje' }),
        h('p', { class: 'day-count' }, h('strong', { text: String(count) }), count === 1 ? 'compromisso' : 'compromissos'),
        (start || end || busy) && h('div', { class: 'day-stats' }, stat('Começa', start), stat('Termina', end), stat('Ocupado', busy)),
        plan.all_day.length > 0 && h('p', { class: 'day-all-day', text: `O dia todo: ${plan.all_day.map((row) => row.title).join(', ')}` }),
      ),
      !state.briefingDismissed && briefingCard(plan, state.arcIntro),
    ),
    dayArc(plan, state.arcIntro),
    canWrite() && h('button', { class: 'btn day-cue', type: 'button', onclick: goToAddCard }, 'Adicionar evento', icon('down')),
  );
}

async function renderAgenda() {
  const from = state.showPast ? addDays(state.today, -PAST_DAYS) : state.today;
  const to = state.showPast ? state.today : addDays(state.today, 365);
  const [rows, plan] = await Promise.all([api(`/api/appointments?from=${from}&to=${to}`), api('/api/agenda/day')]);
  const ordered = state.showPast ? [...rows].reverse() : rows;
  const days = new Map();
  for (const row of ordered) days.set(row.starts_on, [...(days.get(row.starts_on) ?? []), row]);

  return h('div', {},
    paywallBanner(),
    dayHero(plan),
    canWrite() && appointmentAddCard(),
    googleCard(),
    h('header', { class: 'topbar' },
      h('h2', { class: 'section-title', text: state.showPast ? 'Compromissos anteriores' : 'Próximos compromissos' }),
    ),
    days.size
      ? [...days].map(([day, items]) => h('section', { class: 'day' },
        h('div', { class: 'day-head' }, h('span', { class: 'day-name', text: dayLabel(day) })),
        h('div', { class: 'rows' }, items.map(appointmentRow)),
      ))
      : h('div', { class: 'empty panel' },
        h('strong', { text: state.showPast ? 'Nada nos últimos meses' : 'Sua agenda está livre' }),
        !state.showPast && h('p', { text: 'Adicione um evento acima ou escreva “dentista quinta às 15h” na Conversa.' }),
        !state.showPast && h('a', { class: 'btn', href: '#/conversa', text: 'Abrir a Conversa' }),
      ),
    h('button', {
      class: 'link-btn past-toggle',
      type: 'button',
      text: state.showPast ? 'Ver próximos compromissos' : 'Ver compromissos anteriores',
      onclick: () => {
        state.showPast = !state.showPast;
        render();
      },
    }),
  );
}

// Tarefas

const nowTime = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function isTaskLate(row) {
  if (!row.due_on) return false;
  return row.due_on < state.today || (row.due_on === state.today && Boolean(row.due_time) && row.due_time <= nowTime());
}

function taskDue(row) {
  if (!row.due_on) return 'Sem data';
  const at = row.due_time ? `, às ${row.due_time}` : '';
  if (isTaskLate(row)) return `Atrasada desde ${shortDay(row.due_on)}${at}`;
  return `${capitalize(dayLabel(row.due_on))}${at}`;
}

function openTaskDialog(row) {
  const title = h('input', { required: true, maxLength: 120, value: row.title, autocomplete: 'off' });
  const date = h('input', { type: 'date', value: row.due_on ?? '' });
  const time = h('input', { type: 'time', value: row.due_time ?? '' });
  const error = formError();
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      await api(`/api/tasks/${row.id}`, { method: 'PUT', body: { title: title.value, date: date.value || null, time: time.value || null } });
      dialog.close();
      showToast('Tarefa atualizada.');
      render();
    } catch (err) {
      showFormError(error, err);
    }
  };
  const remove = withToast(async () => {
    await api(`/api/tasks/${row.id}`, { method: 'DELETE' });
    dialog.close();
    showToast('Tarefa apagada.');
    render();
  });
  const dialog = openDialog('Editar tarefa',
    h('form', { onsubmit: submit },
      h('div', { class: 'form-grid' },
        h('label', { class: 'field wide' }, h('span', { text: 'O que fazer' }), title),
        h('label', { class: 'field' }, h('span', { text: 'Dia (opcional)' }), date),
        h('label', { class: 'field' }, h('span', { text: 'Horário (opcional)' }), time),
      ),
      h('p', { class: 'hint', style: { marginTop: '6px' }, text: 'Com horário, a Nina avisa 2 horas antes. Só com o dia, avisa às 8h desse dia.' }),
      error,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar', onclick: remove }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: () => dialog.close() }),
        h('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' }),
      ),
    ),
  );
}

function taskRow(row, done = false) {
  return h('div', { class: `task-row${done ? ' is-done' : ''}` },
    h('input', {
      type: 'checkbox',
      checked: done,
      'aria-label': done ? `Reabrir ${row.title}` : `Concluir ${row.title}`,
      onchange: withToast(async (event) => {
        await api(`/api/tasks/${row.id}`, { method: 'PUT', body: { done: event.target.checked } });
        showToast(event.target.checked ? 'Tarefa concluída.' : 'Tarefa reaberta.');
        render();
      }),
    }),
    h('button', { class: 'task-open', type: 'button', onclick: () => openTaskDialog(row) },
      h('span', { class: 'row-title', text: row.title }),
      !done && h('span', { class: `row-sub${isTaskLate(row) ? ' task-late' : ''}`, text: taskDue(row) }),
    ),
  );
}

async function renderTarefas() {
  const [open, done] = await Promise.all([api('/api/tasks'), state.showDone ? api('/api/tasks?status=done') : []]);
  const title = h('input', { required: true, maxLength: 120, placeholder: 'O que precisa ser feito?', 'aria-label': 'Nova tarefa', autocomplete: 'off' });
  const date = h('input', { type: 'date', 'aria-label': 'Dia (opcional)' });
  const time = h('input', { type: 'time', 'aria-label': 'Horário (opcional)' });
  const add = async (event) => {
    event.preventDefault();
    try {
      await api('/api/tasks', { method: 'POST', body: { title: title.value, date: date.value || null, time: time.value || null } });
      showToast('Tarefa anotada.');
      render();
    } catch (err) {
      // Sem redesenhar a tela: o que a pessoa digitou continua no formulário.
      if (err.message !== 'sessao') showToast(err.message);
    }
  };
  const groups = [
    ['Atrasadas', open.filter(isTaskLate)],
    ['Hoje', open.filter((row) => row.due_on === state.today && !isTaskLate(row))],
    ['Próximas', open.filter((row) => row.due_on && row.due_on > state.today)],
    ['Sem data', open.filter((row) => !row.due_on)],
  ].filter(([, rows]) => rows.length);

  return h('div', {},
    advisorHeader(ADVISORS.tasks),
    paywallBanner(),
    canWrite() && h('form', { class: 'task-add', onsubmit: add },
      title,
      date,
      time,
      h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Anotar'),
    ),
    canWrite() && h('p', { class: 'hint task-hint', text: 'Com horário, a Nina avisa 2 horas antes. Só com o dia, avisa às 8h desse dia.' }),
    groups.length
      ? groups.map(([label, rows]) => h('section', { class: 'day' },
        h('div', { class: 'day-head' }, h('span', { class: 'day-name', text: label }), h('span', { text: String(rows.length) })),
        h('div', { class: 'rows' }, rows.map((row) => taskRow(row))),
      ))
      : h('div', { class: 'empty panel' },
        h('strong', { text: 'Nenhuma tarefa pendente' }),
        h('p', { text: 'Anote aqui em cima ou escreva “tarefa pagar luz sexta às 15h” na Conversa.' }),
      ),
    state.showDone && done.length > 0 && h('section', { class: 'day' },
      h('div', { class: 'day-head' }, h('span', { class: 'day-name', text: 'Concluídas' })),
      h('div', { class: 'rows' }, done.map((row) => taskRow(row, true))),
    ),
    h('button', {
      class: 'link-btn past-toggle',
      type: 'button',
      text: state.showDone ? 'Esconder as concluídas' : 'Ver as concluídas',
      onclick: () => {
        state.showDone = !state.showDone;
        render();
      },
    }),
  );
}

// Conversa

function formatChat(text) {
  // *negrito* do WhatsApp. O texto entra como nó de texto, nunca como HTML.
  const parts = text.split(/\*([^*\n]+)\*/);
  return parts.map((part, index) => (index % 2 ? h('strong', { text: part }) : document.createTextNode(part)));
}

const chatBubble = (message) => h('div', { class: `bubble${message.me ? ' me' : ''}` }, formatChat(message.text));

function chatPanel() {
  const thread = h('div', { class: 'thread', 'aria-live': 'polite' }, state.chat.map(chatBubble));
  const input = h('input', { placeholder: 'Mensagem', 'aria-label': 'Mensagem', autocomplete: 'off', maxLength: 2000 });

  const push = (message) => {
    state.chat.push(message);
    thread.append(chatBubble(message));
    thread.scrollTop = thread.scrollHeight;
  };
  const send = async (text) => {
    const message = text.trim();
    if (!message) return;
    push({ me: true, text: message });
    input.value = '';
    try {
      const { reply } = await api('/api/chat', { method: 'POST', body: { text: message } });
      push({ me: false, text: reply });
    } catch (err) {
      push({ me: false, text: err.message === 'sessao' ? 'Entre de novo para continuar.' : err.message });
    }
  };

  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
  });
  return h('section', { class: 'chat' },
    thread,
    h('div', { class: 'chips' }, SUGGESTIONS.map((text) => h('button', { class: 'chip', type: 'button', text, onclick: () => send(text) }))),
    h('form', {
      class: 'chat-form',
      onsubmit: (event) => {
        event.preventDefault();
        send(input.value);
      },
    }, input, h('button', { class: 'btn btn-primary', type: 'submit', text: 'Enviar' })),
  );
}

async function renderConversa() {
  const { number, phone } = state.me.whatsapp;
  return h('div', {},
    h('header', { class: 'topbar' },
      h('div', {},
        h('h1', { class: 'page-title', text: 'Conversa' }),
        h('p', { class: 'muted', text: 'Fale com seus três assessores por aqui.' }),
      ),
      h('div', { class: 'team' }, Object.values(ADVISORS).map(({ name, photo }) => h('img', { src: photo, alt: name, title: name, width: 34, height: 34 }))),
      number && phone && h('a', { class: 'btn', href: `https://wa.me/${number}`, target: '_blank', rel: 'noopener', text: 'Abrir no WhatsApp' }),
    ),
    chatPanel(),
  );
}

// Conta

function installCard() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) return null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let content;
  if (installPrompt) {
    content = h('button', {
      class: 'btn',
      type: 'button',
      text: 'Instalar o app',
      onclick: async () => {
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        render();
      },
    });
  } else if (isIos) {
    content = h('p', { class: 'check-sub', text: 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.' });
  } else {
    content = h('p', { class: 'check-sub', text: 'No menu do navegador, escolha “Instalar app” ou “Adicionar à tela inicial”.' });
  }
  return h('section', { class: 'panel' },
    h('h2', { class: 'panel-title', text: 'Instalar no celular (opcional)' }),
    h('p', { class: 'muted account-text', text: 'O Nuvexx funciona em qualquer navegador. Se quiser, deixe-o também na tela inicial do celular.' }),
    content,
  );
}

function planText(me) {
  if (me.access === 'paid') return `Assinatura ativa até ${dateLabel(me.paid_until)}.`;
  if (me.access === 'trial') return `Teste grátis até ${dateLabel(me.trial_ends_at)}.`;
  return 'Seu teste grátis terminou.';
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  showLogin();
}

function openDeleteAccountDialog() {
  const input = h('input', { autocomplete: 'off', 'aria-label': 'Digite APAGAR para confirmar' });
  const error = formError();
  const dialog = openDialog('Apagar minha conta',
    h('form', {
      onsubmit: async (event) => {
        event.preventDefault();
        if (input.value.trim().toUpperCase() !== 'APAGAR') {
          error.textContent = 'Digite APAGAR para confirmar.';
          error.hidden = false;
          return;
        }
        await api('/api/account', { method: 'DELETE' });
        dialog.close();
        showLogin();
      },
    },
      h('p', { text: 'Isso apaga sua conta e todos os seus lançamentos, contas, compromissos e tarefas, sem volta. Os eventos já enviados ao Google Agenda continuam lá.' }),
      h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { text: 'Digite APAGAR para confirmar' }), input),
      error,
      h('div', { class: 'dialog-actions' },
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', text: 'Voltar', onclick: () => dialog.close() }),
        h('button', { class: 'btn btn-danger', type: 'submit', text: 'Apagar tudo' }),
      ),
    ),
  );
}

function profilePanel(me) {
  const name = h('input', { required: true, maxLength: 80, value: me.name, autocomplete: 'name' });
  const error = formError();
  return h('section', { class: 'panel' },
    h('h2', { class: 'panel-title', text: 'Seu perfil' }),
    h('p', { class: 'account-email', text: me.email }),
    h('form', {
      class: 'account-form account-text',
      onsubmit: async (event) => {
        event.preventDefault();
        error.hidden = true;
        try {
          await api('/api/me', { method: 'PATCH', body: { name: name.value } });
          showToast('Nome salvo.');
        } catch (err) {
          showFormError(error, err);
        }
      },
    },
      h('label', { class: 'field' }, h('span', { text: 'Nome' }), name),
      error,
      h('button', { class: 'btn', type: 'submit', text: 'Salvar nome' }),
    ),
    h('button', { class: 'btn', type: 'button', text: 'Sair', onclick: logout }),
  );
}

function passwordPanel(me) {
  const heading = h('h2', { class: 'panel-title', text: 'Senha e entrada' });
  const googleRow = me.google_login
    ? [
      h('hr', { class: 'account-divider' }),
      h('p', { class: 'muted account-text', text: 'Você também entra com a sua conta Google.' }),
      me.has_password && h('button', {
        class: 'btn',
        type: 'button',
        text: 'Desligar a entrada com o Google',
        onclick: async () => {
          await api('/api/google/login', { method: 'DELETE' });
          showToast('Entrada com o Google desligada.');
          render();
        },
      }),
    ]
    : [
      appConfig?.google_login && h('hr', { class: 'account-divider' }),
      appConfig?.google_login && h('p', { class: 'hint', text: 'Para entrar também com o Google, use “Continuar com o Google” na tela de entrada, com uma conta Google deste mesmo e-mail.' }),
    ];

  if (!me.has_password) {
    return h('section', { class: 'panel' },
      heading,
      h('p', { class: 'muted account-text', text: 'Sua conta ainda não tem senha. Se quiser uma, enviamos um link para o seu e-mail.' }),
      h('button', {
        class: 'btn',
        type: 'button',
        text: 'Receber link para criar senha',
        onclick: async () => {
          try {
            await api('/api/password/forgot', { method: 'POST', body: { email: me.email } });
            showToast('Link enviado para o seu e-mail.');
          } catch (err) {
            showToast(err.message);
          }
        },
      }),
      googleRow,
    );
  }

  const current = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const next = h('input', { type: 'password', required: true, minLength: 8, maxLength: 200, autocomplete: 'new-password' });
  const error = formError();
  return h('section', { class: 'panel' },
    heading,
    h('form', {
      class: 'account-form account-text',
      onsubmit: async (event) => {
        event.preventDefault();
        error.hidden = true;
        try {
          await api('/api/password', { method: 'POST', body: { current: current.value, password: next.value } });
          current.value = '';
          next.value = '';
          showToast('Senha alterada. As outras sessões foram encerradas.');
        } catch (err) {
          showFormError(error, err);
        }
      },
    },
      passwordField('Senha atual', current),
      passwordField('Nova senha', next),
      h('p', { class: 'hint', text: 'Use pelo menos 8 caracteres.' }),
      error,
      h('button', { class: 'btn', type: 'submit', text: 'Trocar senha' }),
    ),
    googleRow,
  );
}

function devWhatsappBox(message) {
  const phone = h('input', { type: 'tel', value: '(47) 99999-8888', 'aria-label': 'Número do simulador', autocomplete: 'off' });
  const replies = h('div', { class: 'dev-replies', 'aria-live': 'polite' });
  const send = async (event) => {
    event.preventDefault();
    const text = message.value.trim();
    if (!text) return;
    const { reply } = await api('/api/dev/whatsapp', { method: 'POST', body: { from: phone.value, text } });
    replies.replaceChildren(chatBubble({ me: true, text }), chatBubble({ me: false, text: reply ?? '(sem resposta)' }));
    message.value = '';
  };
  return h('div', {},
    h('hr', { class: 'account-divider' }),
    h('p', { class: 'dev-title', text: 'Simulador do WhatsApp (só em desenvolvimento)' }),
    phone,
    h('form', { class: 'dev-form', onsubmit: send }, message, h('button', { class: 'btn', type: 'submit', text: 'Enviar' })),
    replies,
  );
}

function whatsappPanel(me) {
  const { available, phone } = me.whatsapp;
  if (!available) return null;
  const heading = h('h2', { class: 'panel-title', text: 'WhatsApp (opcional)' });

  if (phone) {
    const devMessage = h('input', { placeholder: 'Mensagem', 'aria-label': 'Mensagem do simulador', autocomplete: 'off' });
    return h('section', { class: 'panel' },
      heading,
      h('p', { class: 'muted account-text', text: `Conectado ao número ${phone}. Você também pode falar com os assessores por lá e receber os lembretes.` }),
      h('button', {
        class: 'btn',
        type: 'button',
        text: 'Desconectar',
        onclick: async () => {
          await api('/api/whatsapp', { method: 'DELETE' });
          showToast('WhatsApp desconectado.');
          render();
        },
      }),
      me.is_dev && devWhatsappBox(devMessage),
    );
  }

  return h('section', { class: 'panel' },
    heading,
    h('p', { class: 'muted account-text', text: 'Anote gastos, marque compromissos e receba lembretes também por mensagem. Tudo continua funcionando aqui sem ele.' }),
    h('a', { class: 'btn', href: WHATSAPP_ROUTE, text: 'Conectar WhatsApp' }),
  );
}

// Página de conexão: é para onde o botão do menu superior leva enquanto não há número conectado.

const WHATSAPP_ROUTE = '#/whatsapp';
const whatsappChatUrl = (number) => `https://wa.me/${number}`;
const readableNumber = (number) => `+${number.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '55 $1 $2-$3')}`;

// O botão do menu superior depende de haver um número conectado.
async function refreshMe() {
  state.me = await api('/api/me');
  paintActions();
  return state.me;
}

function waitForWhatsappLink(card) {
  clearInterval(renderWhatsapp.timer);
  renderWhatsapp.timer = setInterval(async () => {
    if (!card.isConnected) {
      clearInterval(renderWhatsapp.timer);
      return;
    }
    const current = await api('/api/me');
    if (current.whatsapp.phone) {
      clearInterval(renderWhatsapp.timer);
      showToast('WhatsApp conectado.');
      render();
    }
  }, LINK_POLL_MS);
}

// O número não é digitado: quem envia a mensagem com o código prova que ele é seu.
function whatsappConnectForm(me) {
  const { number } = me.whatsapp;
  const steps = h('div', { 'aria-live': 'polite' }, h('p', { class: 'hint', text: 'Preparando sua mensagem...' }));
  const devMessage = h('input', { placeholder: 'Mensagem', 'aria-label': 'Mensagem do simulador', autocomplete: 'off' });
  const step = (...content) => h('li', {}, h('div', { class: 'whatsapp-step' }, content));
  const createCode = async () => {
    try {
      const { text, url, minutes } = await api('/api/whatsapp/link', { method: 'POST' });
      steps.replaceChildren(
        h('ol', { class: 'whatsapp-steps' },
          url && step(
            h('p', { text: 'Abra o WhatsApp no celular que você quer conectar.' }),
            h('a', { class: 'btn btn-primary', href: url, target: '_blank', rel: 'noopener', text: 'Abrir no WhatsApp' }),
          ),
          step(
            h('p', { text: number ? `Envie esta mensagem para o número ${readableNumber(number)}, sem mudar o texto:` : 'Envie esta mensagem, sem mudar o texto:' }),
            h('span', { class: 'link-text whatsapp-message', text }),
          ),
          step(h('p', { text: 'Pronto. Esta tela atualiza sozinha quando a mensagem chegar.' })),
        ),
        h('p', { class: 'hint whatsapp-expiry' },
          `O código vale por ${minutes} minutos. `,
          h('button', { class: 'link-btn', type: 'button', text: 'Gerar outro código', onclick: createCode }),
        ),
      );
      devMessage.value = text;
      waitForWhatsappLink(steps);
    } catch (err) {
      if (err.message === 'sessao') return;
      steps.replaceChildren(
        h('p', { class: 'form-error', text: err.message }),
        h('button', { class: 'btn whatsapp-retry', type: 'button', text: 'Tentar de novo', onclick: createCode }),
      );
    }
  };
  createCode();
  return h('section', { class: 'panel' },
    h('p', { class: 'muted account-text', text: 'Anote gastos, marque compromissos e receba lembretes também por mensagem. Basta enviar uma mensagem do seu celular.' }),
    steps,
    me.is_dev && devWhatsappBox(devMessage),
  );
}

function whatsappConnected({ phone, number }) {
  return h('section', { class: 'panel' },
    h('p', { class: 'muted account-text', text: `Número ${phone}. Agora você também pode falar com os assessores por lá e receber os lembretes.` }),
    number && h('a', { class: 'btn btn-primary', href: whatsappChatUrl(number), target: '_blank', rel: 'noopener', text: 'Abrir no WhatsApp' }),
    h('p', { class: 'hint whatsapp-expiry' }, 'Para desconectar este número, vá até a ', h('a', { href: '#/conta', text: 'Conta' }), '.'),
  );
}

async function renderWhatsapp() {
  const me = await refreshMe();
  const { available, phone } = me.whatsapp;
  let content;
  if (!available) content = h('section', { class: 'panel' }, h('p', { class: 'muted', text: 'A conexão com o WhatsApp ainda não está disponível. Tudo continua funcionando aqui sem ele.' }));
  else if (phone) content = whatsappConnected(me.whatsapp);
  else content = whatsappConnectForm(me);
  return h('div', { class: 'account' },
    h('h1', { class: 'page-title', text: phone ? 'WhatsApp conectado' : 'Conectar WhatsApp' }),
    content,
  );
}

function remindersPanel(me) {
  const toggle = h('input', {
    type: 'checkbox',
    checked: me.email_reminders,
    onchange: async (event) => {
      await api('/api/me', { method: 'PATCH', body: { email_reminders: event.target.checked } });
      showToast(event.target.checked ? 'Lembretes por e-mail ligados.' : 'Lembretes por e-mail desligados.');
    },
  });
  const briefing = h('input', {
    type: 'checkbox',
    checked: me.daily_briefing,
    onchange: async (event) => {
      await api('/api/me', { method: 'PATCH', body: { daily_briefing: event.target.checked } });
      showToast(event.target.checked ? 'Resumo do dia ligado.' : 'Resumo do dia desligado.');
    },
  });
  return h('section', { class: 'panel' },
    h('h2', { class: 'panel-title', text: 'Lembretes' }),
    h('p', { class: 'muted account-text', text: me.whatsapp.phone
      ? 'Os lembretes de compromissos e tarefas vão pelo WhatsApp. Se ele não puder entregar, vão por e-mail.'
      : 'Os lembretes de compromissos e tarefas vão para o seu e-mail.' }),
    h('label', { class: 'check-field' }, toggle, h('span', { text: 'Receber lembretes por e-mail' })),
    h('hr', { class: 'account-divider' }),
    h('p', { class: 'muted account-text', text: 'Às 5h30, a Cris conta como será o seu dia. Se não houver nada marcado, ela não envia.' }),
    h('label', { class: 'check-field' }, briefing, h('span', { text: 'Receber o resumo do dia' })),
  );
}

async function renderConta() {
  const me = await refreshMe();
  appConfig ??= await api('/api/config');
  const { configured, connected } = me.google;
  return h('div', { class: 'account' },
    h('h1', { class: 'page-title', text: 'Conta' }),
    profilePanel(me),
    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'Assinatura' }),
      h('p', { class: 'muted account-text', text: planText(me) }),
      me.subscribe_url
        ? h('a', { class: 'btn btn-primary', href: me.subscribe_url, target: '_blank', rel: 'noopener', text: me.access === 'paid' ? 'Gerenciar assinatura' : 'Assinar' })
        : h('p', { class: 'hint', text: 'A assinatura ficará disponível em breve.' }),
    ),
    passwordPanel(me),
    whatsappPanel(me),
    remindersPanel(me),
    configured && h('section', { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'Google Agenda (opcional)' }),
      h('p', { class: 'muted account-text', text: connected ? 'Conectado. Seus compromissos vão para a sua agenda.' : 'Ainda não conectado.' }),
      connected
        ? h('button', {
          class: 'btn',
          type: 'button',
          text: 'Desconectar',
          onclick: async () => {
            await api('/api/google', { method: 'DELETE' });
            showToast('Google Agenda desconectado.');
            render();
          },
        })
        : h('button', { class: 'btn btn-primary', type: 'button', text: 'Conectar', onclick: connectGoogle }),
    ),
    installCard(),
    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title', text: 'Seus dados' }),
      h('p', { class: 'muted account-text', text: 'Eles são só seus. Você pode levar uma cópia ou apagar tudo quando quiser.' }),
      h('div', { class: 'account-actions' },
        h('a', { class: 'btn', href: '/api/account/export', download: 'meus-dados-nuvexx.json' }, icon('download'), 'Baixar meus dados'),
        h('button', { class: 'btn btn-danger', type: 'button', text: 'Apagar minha conta', onclick: openDeleteAccountDialog }),
      ),
    ),
    h('p', { class: 'hint legal-links' }, h('a', { href: '/termos', text: 'Termos de uso' }), ' · ', h('a', { href: '/privacidade', text: 'Privacidade' })),
  );
}

// Tema

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function themeButton() {
  const button = h('button', {
    class: 'icon-btn appbar-btn',
    type: 'button',
    onclick: () => {
      const next = currentTheme() === 'light' ? 'dark' : 'light';
      if (next === 'light') document.documentElement.dataset.theme = 'light';
      else delete document.documentElement.dataset.theme;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Sem acesso ao armazenamento, o tema vale só até fechar a página.
      }
      paint();
    },
  });
  const paint = () => {
    const light = currentTheme() === 'light';
    button.setAttribute('aria-label', light ? 'Usar tema escuro' : 'Usar tema claro');
    button.title = light ? 'Usar tema escuro' : 'Usar tema claro';
    button.replaceChildren(icon(light ? 'moon' : 'sun'));
  };
  paint();
  return button;
}

// Boas-vindas: aparece logo depois do cadastro, para ninguém cair numa tela vazia sem saber por onde começar.

const WELCOME_ROUTE = '#/boas-vindas';

function goThenDo(route, action) {
  afterRender = action;
  location.hash = route;
}

const WELCOME_STEPS = [
  {
    advisor: ADVISORS.finance,
    text: 'Anota entradas e gastos e mostra quanto ainda vai entrar e sair no mês.',
    action: 'Anotar um gasto',
    start: withToast(async () => {
      location.hash = ADVISORS.finance.home;
      await openEntryDialog();
    }),
  },
  {
    advisor: ADVISORS.agenda,
    text: 'Guarda seus compromissos, avisa antes de cada um e conta às 5h30 como será o seu dia.',
    action: 'Marcar um compromisso',
    start: () => goThenDo(ADVISORS.agenda.home, goToAddCard),
  },
  {
    advisor: ADVISORS.tasks,
    text: 'Anota suas pendências e avisa 2 horas antes do horário combinado.',
    action: 'Anotar uma tarefa',
    start: () => goThenDo(ADVISORS.tasks.home, () => document.querySelector('.task-add input').focus()),
  },
];

function welcomeCard({ advisor, text, action, start }) {
  return h('article', { class: 'welcome-card', 'data-advisor': advisor.id },
    h('div', { class: 'welcome-who' },
      h('img', { src: advisor.photo, alt: `Retrato de ${advisor.name}`, width: 64, height: 64 }),
      h('div', {},
        h('h2', { class: 'welcome-name', text: advisor.name }),
        h('p', { class: 'welcome-role', text: advisor.title }),
      ),
    ),
    h('p', { class: 'welcome-text', text }),
    canWrite() && h('button', { class: 'btn btn-primary btn-block', type: 'button', text: action, onclick: start }),
  );
}

function renderBoasVindas() {
  const { name, access, trial_ends_at: trialEnds, whatsapp } = state.me;
  return h('div', { class: 'welcome' },
    h('header', { class: 'welcome-hero' },
      h('h1', { class: 'welcome-title', text: `Boas-vindas, ${name.split(/\s+/)[0]}!` }),
      h('p', { class: 'welcome-intro', text: 'Seus três assessores já estão a postos. Por onde você quer começar?' }),
    ),
    h('div', { class: 'welcome-cards' }, WELCOME_STEPS.map(welcomeCard)),
    h('div', { class: 'welcome-foot' },
      h('p', {}, 'Prefere escrever? Na ', h('a', { href: '#/conversa', text: 'Conversa' }), ', é só mandar “gastei 50 no mercado” ou “dentista quinta às 15h”.'),
      whatsapp.available && !whatsapp.phone && h('p', {}, 'Para usar também pelo WhatsApp, ', h('a', { href: WHATSAPP_ROUTE, text: 'conecte seu número' }), '.'),
      access === 'trial' && h('p', { text: `Seu teste grátis vai até ${dateLabel(trialEnds)}.` }),
      h('a', { class: 'btn', href: HOME_ROUTE, text: 'Ir para a agenda' }),
    ),
  );
}

// Navegação

const VIEWS = {
  'boas-vindas': renderBoasVindas,
  painel: renderPainel,
  lancamentos: renderLancamentos,
  contas: renderContas,
  veiculos: renderVeiculos,
  'relatorio-veiculo': renderVehicleReport,
  categorias: renderCategorias,
  agenda: renderAgenda,
  tarefas: renderTarefas,
  conversa: renderConversa,
  conta: renderConta,
  whatsapp: renderWhatsapp,
};
const ADVISOR_OF = { painel: 'finance', lancamentos: 'finance', contas: 'finance', veiculos: 'finance', 'relatorio-veiculo': 'finance', categorias: 'finance', agenda: 'agenda', tarefas: 'tasks' };
const FINANCE_RAIL = [
  ['painel', 'chart', 'Painel'],
  ['lancamentos', 'transfer', 'Lançamentos'],
  ['contas', 'bank', 'Contas e cartões'],
  ['veiculos', 'car', 'Veículos'],
  ['categorias', 'tag', 'Categorias'],
];

function setupShell() {
  if (shellReady) return;
  shellReady = true;
  document.getElementById('advisor-switch').replaceChildren(...Object.values(ADVISORS).map((advisor) =>
    h('a', { class: 'advisor-pill', href: advisor.home, 'data-advisor': advisor.id },
      h('img', { src: advisor.photo, alt: '', width: 36, height: 36 }),
      h('span', { class: 'advisor-pill-text' },
        h('span', { class: 'advisor-pill-area', text: advisor.area }),
        h('span', { class: 'advisor-pill-by', text: `por ${advisor.name}` }),
      ),
    ),
  ));
  document.getElementById('rail').replaceChildren(...FINANCE_RAIL.map(([name, iconName, label]) =>
    h('a', { class: 'rail-item', href: `#/${name}`, 'data-view': name, title: label, 'aria-label': label },
      icon(iconName),
      h('span', { class: 'rail-label', text: label }),
    ),
  ));
}

function markCurrentView() {
  document.querySelectorAll('[data-view]').forEach((item) => {
    if (item.dataset.view === state.view) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function paintActions() {
  const { available, number, phone } = state.me.whatsapp;
  // Sem número conectado, o botão leva à página de conexão. Com número, direto para a conversa.
  const opensChat = Boolean(number && phone);
  document.getElementById('appbar-actions').replaceChildren(
    themeButton(),
    h('a', { class: 'icon-btn appbar-btn', href: '#/conversa', 'data-view': 'conversa', title: 'Conversa', 'aria-label': 'Conversa' }, icon('chat')),
    available && h('a', {
      class: 'btn btn-whatsapp',
      href: opensChat ? whatsappChatUrl(number) : WHATSAPP_ROUTE,
      target: opensChat ? '_blank' : null,
      rel: opensChat ? 'noopener' : null,
      'data-view': opensChat ? null : 'whatsapp',
      'aria-label': phone ? 'Abrir no WhatsApp' : 'Conectar WhatsApp',
    }, icon('phone'), h('span', { text: 'WhatsApp' })),
    h('a', { class: 'icon-btn appbar-btn', href: '#/conta', 'data-view': 'conta', title: 'Conta', 'aria-label': 'Conta' }, icon('user')),
  );
  markCurrentView();
}

function currentRoute() {
  const [rawName, param] = location.hash.replace(/^#\//, '').split('/');
  const name = rawName === 'resumo' ? 'painel' : rawName;
  return VIEWS[name] ? { name, param } : { name: HOME_ROUTE.slice(2) };
}

async function render() {
  const { name, param } = currentRoute();
  const changedView = name !== state.view;
  state.view = name;
  if (changedView) {
    // A linha do dia se desenha ao abrir a aba, não a cada anotação feita com ela aberta.
    state.arcIntro = true;
    // O balão dispensado volta na próxima abertura, para a mensagem do dia não se perder.
    state.briefingDismissed = false;
  }
  const advisorId = ADVISOR_OF[name];
  document.body.dataset.advisor = advisorId ?? 'finance';
  document.querySelectorAll('.advisor-pill').forEach((item) => {
    if (item.dataset.advisor === advisorId) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  markCurrentView();
  document.getElementById('rail').hidden = advisorId !== 'finance';
  // No celular, o menu de finanças rola de lado: a aba atual não pode ficar escondida.
  document.querySelector('.rail-item[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  tooltip.hidden = true;

  const token = ++renderToken;
  view.setAttribute('aria-busy', 'true');
  try {
    const content = await VIEWS[name](param);
    if (token !== renderToken) return;
    view.replaceChildren(content);
    // Só aqui: um desenho descartado no caminho não pode gastar a animação da aba.
    state.arcIntro = false;
    if (changedView) window.scrollTo(0, 0);
    const action = afterRender;
    afterRender = null;
    action?.();
  } catch (err) {
    if (token !== renderToken || err.message === 'sessao') return;
    view.replaceChildren(h('div', { class: 'empty' }, h('strong', { text: 'Não foi possível carregar' }), h('p', { text: err.message })));
  } finally {
    if (token === renderToken) view.removeAttribute('aria-busy');
  }
}

// Painel compartilhado: abre sem conta e só para leitura.

const SHARED_ROUTE = /^#\/compartilhado\/(.+)$/;

async function showShared(token) {
  document.getElementById('shell').hidden = true;
  document.getElementById('login').hidden = true;
  const section = document.getElementById('shared');
  section.hidden = false;
  document.body.dataset.advisor = 'finance';
  try {
    const { panel, data } = await api('/api/shared', { method: 'POST', body: { token } });
    state.today = data.period.today;
    section.replaceChildren(h('div', { class: 'shared-inner' },
      h('header', { class: 'shared-head' },
        h('div', {},
          h('h1', { class: 'dash-title', text: panel.name }),
          h('p', { class: 'dash-sub', text: `Compartilhado por ${panel.owner} · somente leitura · ${monthLabel(data.period.month)}` }),
        ),
        h('span', { class: 'brand' },
          h('img', { class: 'logo logo-on-dark', src: '/marca/logo-fundo-escuro.png', alt: 'Nuvexx', width: 1420, height: 287 }),
          h('img', { class: 'logo logo-on-light', src: '/marca/logo-fundo-claro.png', alt: 'Nuvexx', width: 1420, height: 287 }),
        ),
      ),
      widgetGrid(panel.widgets, data, { readOnly: true }),
    ));
  } catch (err) {
    section.replaceChildren(h('div', { class: 'empty' },
      h('strong', { text: 'Não foi possível abrir este painel' }),
      h('p', { text: err.message }),
      h('a', { class: 'btn', href: '/', text: 'Ir para o Nuvexx' }),
    ));
  }
}

// Entrada: criar conta, entrar e recuperar a senha

const authBox = document.getElementById('auth');

const emailInput = (value = '') => h('input', { type: 'email', required: true, maxLength: 254, autocomplete: 'username', placeholder: 'voce@email.com', value });
const authField = (label, input) => h('label', { class: 'field' }, h('span', { text: label }), input);
// Depois de enviar um formulário, o endereço continua igual: o link precisa abrir a tela de novo mesmo assim.
const authLink = (href, text) => h('a', {
  href,
  text,
  onclick: () => {
    if (location.hash === href) showAuth();
  },
});

function googleButton() {
  if (!appConfig?.google_login) return null;
  const mark = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, GOOGLE_MARK.map(([fill, d]) => svg('path', { fill, d })));
  return [
    h('div', { class: 'auth-or', text: 'ou' }),
    h('a', { class: 'btn btn-block btn-google', href: '/google/entrar' }, mark, 'Continuar com o Google'),
  ];
}

function authForm({ title, intro, google = false, fields, submit, onSubmit, footer }) {
  const error = formError();
  const button = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: submit });
  const form = h('form', {
    class: 'login-form',
    onsubmit: async (event) => {
      event.preventDefault();
      error.hidden = true;
      button.disabled = true;
      try {
        await onSubmit();
      } catch (err) {
        showFormError(error, err);
      } finally {
        button.disabled = false;
        refreshDevMails();
      }
    },
  }, fields, error, button);
  const googleOption = google ? googleButton() : null;
  authBox.replaceChildren(
    h('div', { class: 'auth-head' },
      h('h2', { class: 'auth-title', text: title }),
      typeof intro === 'string' ? h('p', { class: 'auth-intro', text: intro }) : intro,
    ),
    form,
    ...(googleOption ?? (footer ? [h('hr', { class: 'auth-rule' })] : [])),
    ...(footer ? [h('div', { class: 'auth-links' }, footer)] : []),
  );
}

function authMessage(title, text, ...links) {
  authBox.replaceChildren(
    h('div', { class: 'auth-head' },
      h('h2', { class: 'auth-title', text: title }),
      h('p', { class: 'auth-intro', text }),
    ),
    h('hr', { class: 'auth-rule' }),
    h('div', { class: 'auth-links' }, links),
  );
}

function signInView() {
  const email = emailInput();
  const password = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  authForm({
    title: 'Que bom ter você de volta.',
    intro: h('p', { class: 'auth-quote' }, '“Seus três assessores já estão ', h('strong', { text: 'a postos' }), '.”'),
    google: true,
    fields: [authField('E-mail', email), passwordField('Senha', password, authLink('#/esqueci-senha', 'Esqueceu?'))],
    submit: 'Entrar',
    onSubmit: async () => {
      await api('/api/login', { method: 'POST', body: { email: email.value, password: password.value } });
      password.value = '';
      // O endereço ainda pode ser o da última tela de quem saiu da conta: entrar sempre começa pela tela inicial.
      history.replaceState(null, '', HOME_ROUTE);
      await enterApp();
    },
    footer: h('span', {}, 'Ainda não tem conta? ', authLink('#/criar-conta', 'Criar conta')),
  });
}

function signUpView() {
  const email = emailInput();
  authForm({
    title: 'Criar conta',
    intro: `${appConfig.trial_days} dias grátis para experimentar.`,
    google: true,
    fields: [authField('Seu e-mail', email)],
    submit: 'Continuar',
    onSubmit: async () => {
      await api('/api/signup', { method: 'POST', body: { email: email.value } });
      authMessage(
        'Confira seu e-mail',
        `Enviamos um link para ${email.value}. Abra-o para escolher sua senha e concluir o cadastro. Se não chegar, veja no spam.`,
        authLink('#/criar-conta', 'Usar outro e-mail'),
      );
    },
    footer: h('span', {}, 'Já tem conta? ', authLink('#/entrar', 'Entrar')),
  });
}

function forgotView() {
  const email = emailInput();
  authForm({
    title: 'Esqueci minha senha',
    intro: 'Enviamos um link para você criar uma nova senha.',
    fields: [authField('Seu e-mail', email)],
    submit: 'Enviar link',
    onSubmit: async () => {
      await api('/api/password/forgot', { method: 'POST', body: { email: email.value } });
      authMessage(
        'Confira seu e-mail',
        `Se houver uma conta com ${email.value}, o link chega em instantes e vale por 1 hora. Se não chegar, veja no spam.`,
        authLink('#/entrar', 'Voltar para a entrada'),
      );
    },
    footer: authLink('#/entrar', 'Voltar para a entrada'),
  });
}

async function finishSignUpView(token) {
  let invitation;
  try {
    invitation = await api('/api/signup/verify', { method: 'POST', body: { token } });
  } catch (err) {
    authMessage('Link vencido', err.message, authLink('#/criar-conta', 'Pedir outro link'));
    return;
  }
  const name = h('input', { required: true, maxLength: 80, autocomplete: 'name', value: invitation.name });
  const password = h('input', { type: 'password', required: true, minLength: 8, maxLength: 200, autocomplete: 'new-password' });
  const accepted = h('input', { type: 'checkbox', required: true });
  authForm({
    title: 'Concluir cadastro',
    intro: invitation.email,
    fields: [
      authField('Como podemos chamar você', name),
      !invitation.google && passwordField('Crie uma senha', password),
      !invitation.google && h('p', { class: 'hint', text: 'Use pelo menos 8 caracteres.' }),
      h('label', { class: 'check-field' }, accepted, h('span', {},
        'Li e aceito os ',
        h('a', { href: '/termos', target: '_blank', rel: 'noopener', text: 'termos de uso' }),
        ' e a ',
        h('a', { href: '/privacidade', target: '_blank', rel: 'noopener', text: 'política de privacidade' }),
        '. Tenho 18 anos ou mais.',
      )),
    ],
    submit: 'Criar minha conta',
    onSubmit: async () => {
      await api('/api/signup/complete', { method: 'POST', body: { token, name: name.value, password: password.value, accepted: accepted.checked } });
      await enterApp(WELCOME_ROUTE);
    },
  });
}

function newPasswordView(token) {
  const password = h('input', { type: 'password', required: true, minLength: 8, maxLength: 200, autocomplete: 'new-password' });
  authForm({
    title: 'Criar nova senha',
    fields: [passwordField('Nova senha', password), h('p', { class: 'hint', text: 'Use pelo menos 8 caracteres.' })],
    submit: 'Salvar nova senha',
    onSubmit: async () => {
      await api('/api/password/reset', { method: 'POST', body: { token, password: password.value } });
      showToast('Senha alterada.');
      await enterApp();
    },
    footer: authLink('#/esqueci-senha', 'Pedir outro link'),
  });
}

const AUTH_ROUTES = [
  [/^#\/cadastro\/(.+)$/, finishSignUpView],
  [/^#\/nova-senha\/(.+)$/, newPasswordView],
  [/^#\/criar-conta$/, signUpView],
  [/^#\/esqueci-senha$/, forgotView],
  [/^#\/entrar$/, signInView],
];
const authRoute = () => AUTH_ROUTES.find(([pattern]) => pattern.test(location.hash));

// Só onde um e-mail é esperado: o simulador não pode tirar a tela de entrada do lugar.
async function refreshDevMails() {
  const box = document.getElementById('dev-box');
  box.hidden = true;
  if (!appConfig?.is_dev || !/^#\/(criar-conta|esqueci-senha)$/.test(location.hash)) return;
  const mails = await api('/api/dev/emails');
  if (!mails.length) return;
  const items = mails.slice(0, DEV_MAILS_SHOWN).map((mail) => {
    const link = mail.text.match(/https?:\/\/\S+/)?.[0];
    return h('div', { class: 'dev-mail' },
      h('strong', { text: mail.subject }),
      h('span', { class: 'hint', text: mail.to }),
      link && h('a', { href: link, text: 'Abrir o link do e-mail' }),
    );
  });
  box.replaceChildren(h('p', { class: 'dev-title', text: 'E-mails enviados (só em desenvolvimento)' }), ...items);
  box.hidden = false;
}

// Mostra a entrada de acordo com o endereço: quem não tem sessão cai em "Entrar".
async function showAuth() {
  document.getElementById('shell').hidden = true;
  document.getElementById('shared').hidden = true;
  document.getElementById('login').hidden = false;
  appConfig ??= await api('/api/config');
  const route = authRoute();
  if (route) await route[1](...location.hash.match(route[0]).slice(1));
  else signInView();
  refreshDevMails();
}

function showLogin() {
  clearInterval(renderWhatsapp.timer);
  // A próxima pessoa neste navegador não pode ver a conversa e os filtros da anterior.
  Object.assign(state, freshState());
  return showAuth();
}

async function enterApp(home = HOME_ROUTE) {
  state.me = await api('/api/me');
  state.today = state.me.today;
  state.month ??= state.today.slice(0, 7);
  state.period.to ??= state.today.slice(0, 7);
  document.getElementById('login').hidden = true;
  document.getElementById('shared').hidden = true;
  document.getElementById('shell').hidden = false;
  // Tira o link de cadastro ou de nova senha do endereço e do histórico.
  if (authRoute()) history.replaceState(null, '', home);
  setupShell();
  paintActions();
  render();
}

window.addEventListener('hashchange', () => {
  const shared = location.hash.match(SHARED_ROUTE);
  if (shared) showShared(shared[1]);
  else if (authRoute() || !state.me) showAuth();
  else {
    document.getElementById('login').hidden = true;
    document.getElementById('shared').hidden = true;
    document.getElementById('shell').hidden = false;
    render();
  }
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});
document.addEventListener('click', (event) => {
  document.querySelectorAll('details.widget-menu[open]').forEach((menu) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});

// Um link recebido por e-mail vale mesmo com outra conta aberta neste navegador.
const sharedAtStart = location.hash.match(SHARED_ROUTE);
if (sharedAtStart) showShared(sharedAtStart[1]);
else if (/^#\/(cadastro|nova-senha)\//.test(location.hash)) showAuth();
else enterApp().catch(() => {});

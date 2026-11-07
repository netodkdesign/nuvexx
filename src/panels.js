// Blocos que podem entrar em um painel. "section" diz de qual parte dos dados cada um precisa:
// um painel compartilhado só entrega o que os blocos dele mostram.
export const WIDGETS = {
  entradas: { label: 'Entradas', section: 'flow' },
  saidas: { label: 'Saídas', section: 'flow' },
  saldo: { label: 'Saldo do mês', section: 'flow' },
  contas: { label: 'Saldo por conta', section: 'accounts' },
  previstos: { label: 'Ainda vai entrar e sair', section: 'upcoming' },
  fluxo: { label: 'Fluxo mensal', section: 'flow' },
  categorias: { label: 'Gastos por categoria', section: 'categories' },
  maiores: { label: 'Maiores gastos', section: 'top_expenses' },
  recentes: { label: 'Últimos lançamentos', section: 'recent' },
  agenda: { label: 'Próximos compromissos', section: 'appointments' },
  tarefas: { label: 'Tarefas pendentes', section: 'tasks' },
};

export const DEFAULT_PANELS = [
  { name: 'Visão geral', widgets: ['entradas', 'saidas', 'saldo', 'contas', 'previstos', 'categorias', 'fluxo', 'agenda', 'tarefas'] },
  { name: 'Fluxo', widgets: ['entradas', 'saidas', 'saldo', 'contas', 'fluxo'] },
  { name: 'Gastos', widgets: ['saidas', 'categorias', 'maiores', 'recentes'] },
];

export const MAX_PANELS = 12;

// Quem recebe o link de um painel vê valores e categorias, não o veículo nem a oficina.
const LISTS_WITH_VEHICLES = new Set(['top_expenses', 'recent']);
const withoutVehicle = ({ vehicle_id: _id, vehicle_name: _name, place: _place, odometer_km: _km, category_slug: _slug, ...row }) => row;

export function pickSections(data, widgets) {
  const sections = new Set(widgets.map((id) => WIDGETS[id]?.section));
  const picked = { period: data.period };
  for (const key of ['flow', 'summary', 'accounts', 'upcoming', 'categories', 'top_expenses', 'recent', 'appointments', 'tasks']) {
    const section = key === 'summary' ? 'flow' : key;
    if (sections.has(section)) picked[key] = LISTS_WITH_VEHICLES.has(key) ? data[key].map(withoutVehicle) : data[key];
  }
  return picked;
}

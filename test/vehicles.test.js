import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAssistant } from '../src/assistant.js';
import { createSession } from '../src/auth.js';
import { classify, MAINTENANCE_CATEGORY, MAINTENANCE_SLUG } from '../src/categories.js';
import { connect } from '../src/database.js';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { findVehicle, splitHistory, splitPlace, vehicleSummary } from '../src/vehicles.js';
import { createAccount, createTestDb, fakeMailer, noGoogle, OWNER, quiet, testConfig } from './helpers.js';

const NOW = new Date('2026-11-05T15:00:00Z');
const TODAY = '2026-11-05';

let db;
let reset;
let config;
let mailer;
let server;
let base;

before(async () => {
  ({ db, reset } = await createTestDb());
  config = testConfig();
  mailer = fakeMailer();
  server = createApp({ config, db, google: noGoogle, mailer, log: quiet, sendText: async () => {} });
  await new Promise((done) => server.listen(0, done));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await db.close();
});
beforeEach(() => reset());

const client = (user) => async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(user ? { Cookie: `nuvexx_sessao=${createSession(config, user)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
};

const maintenanceOf = async (store) => (await store.categories()).find((row) => row.slug === MAINTENANCE_SLUG);

async function setup(email = 'ana@teste.com') {
  const user = await createAccount(db, { email, at: NOW });
  const store = db.forUser(user.id);
  return { user, store, api: client(user), categoryId: (await maintenanceOf(store)).id };
}

const service = (categoryId, extra = {}) => ({ description: 'Troca de óleo', amount: '250', date: '2026-03-10', category_id: categoryId, place: 'Oficina do Zé', odometer_km: '85.000', ...extra });

// Texto

test('separa o serviço do lugar, e "no carro" não é lugar', () => {
  assert.deepEqual(splitPlace('Troca de óleo na oficina do zé'), { what: 'Troca de óleo', place: 'Oficina do zé' });
  assert.deepEqual(splitPlace('Freio no carro na oficina do zé'), { what: 'Freio no carro', place: 'Oficina do zé' });
  assert.deepEqual(splitPlace('Pneu no carro'), { what: 'Pneu no carro', place: null });
  assert.deepEqual(splitPlace('Troca de óleo'), { what: 'Troca de óleo', place: null });
  assert.deepEqual(splitPlace('Alinhamento no civic', [{ name: 'Honda Civic 2018' }]), { what: 'Alinhamento no civic', place: null });
});

test('escolhe o veículo: com um só, ele; com vários, só o citado sem dúvida', () => {
  const civic = { id: 1, name: 'Honda Civic 2018' };
  const biz = { id: 2, name: 'Honda Biz' };
  assert.equal(findVehicle('Troca de óleo', [civic]), civic);
  assert.equal(findVehicle('Troca de óleo', []), null);
  assert.equal(findVehicle('Troca de óleo', [civic, biz]), null);
  assert.equal(findVehicle('Pneu do civic', [civic, biz]), civic);
  assert.equal(findVehicle('Revisão da Biz', [civic, biz]), biz);
  assert.equal(findVehicle('Revisão da honda', [civic, biz]), null);
});

test('resume o histórico e deixa o futuro de fora', () => {
  const rows = [
    { spent_on: '2026-12-01', total_cents: 100, odometer_km: null },
    { spent_on: '2026-03-10', total_cents: 25000, odometer_km: 85000 },
    { spent_on: '2024-01-02', total_cents: 0, odometer_km: 40000 },
  ];
  const { done, planned } = splitHistory(rows, TODAY);
  assert.equal(planned.length, 1);
  assert.deepEqual(vehicleSummary(done), { service_count: 2, total_cents: 25000, first_on: '2024-01-02', last_on: '2026-03-10', last_km: 85000 });
  assert.deepEqual(vehicleSummary([]), { service_count: 0, total_cents: 0, first_on: null, last_on: null, last_km: null });
});

// Categoria

test('toda conta nova já tem a categoria, que reconhece as palavras de manutenção', async () => {
  const { store, categoryId } = await setup();
  assert.equal((await store.category(categoryId)).name, MAINTENANCE_CATEGORY);
  const keywords = await store.keywords();
  for (const text of ['Troca de óleo', 'pneu novo', 'Oficina do Zé', 'alinhamento e balanceamento', 'revisão do carro', 'pastilha de freio']) {
    assert.equal(classify(text, keywords), categoryId, text);
  }
  const transport = (await store.categories()).find((row) => row.name === 'Transporte');
  for (const text of ['gasolina', 'lavagem do carro', 'seguro do carro', 'carro']) assert.equal(classify(text, keywords), transport.id, text);
});

test('a mudança no banco cria a categoria para quem já tinha conta e não duplica', async () => {
  const connection = await connect({ databaseUrl: process.env.TEST_DATABASE_URL ?? '', dataDir: undefined });
  try {
    const fresh = await openDb(connection);
    await connection.exec('TRUNCATE users, processed_messages RESTART IDENTITY CASCADE');
    const antiga = await createAccount(fresh, { email: 'antiga@teste.com', at: NOW });
    const propria = await createAccount(fresh, { email: 'propria@teste.com', at: NOW });

    // Volta ao banco de antes: sem a categoria, e com uma pessoa que criou uma de mesmo nome por conta própria.
    await connection.exec(`
      DROP TABLE pending_events; DROP TABLE pending_services; DROP TABLE vehicle_services; DROP TABLE vehicles;
      DELETE FROM categories WHERE slug = '${MAINTENANCE_SLUG}';
      DELETE FROM schema_version WHERE version >= 6
    `);
    await connection.query(`INSERT INTO categories (user_id, name, emoji) VALUES ($1, $2, '🚙')`, [propria.id, MAINTENANCE_CATEGORY]);

    const migrated = await openDb(connection);
    const ofOld = await maintenanceOf(migrated.forUser(antiga.id));
    assert.equal(ofOld.name, MAINTENANCE_CATEGORY);
    assert.equal(ofOld.emoji, '🔧');
    assert.equal(ofOld.is_default, false);
    const own = (await migrated.forUser(propria.id).categories()).filter((row) => row.name === MAINTENANCE_CATEGORY);
    assert.equal(own.length, 1);
    assert.equal(own[0].slug, MAINTENANCE_SLUG);
    assert.equal(own[0].emoji, '🚙');
    await connection.exec('TRUNCATE users, processed_messages RESTART IDENTITY CASCADE');
  } finally {
    await connection.close();
  }
});

test('a categoria de manutenção não pode ser apagada, mas pode ser renomeada', async () => {
  const { api, store, categoryId } = await setup();
  const removed = await api(`/api/categories/${categoryId}`, { method: 'DELETE' });
  assert.equal(removed.status, 400);
  assert.match(removed.data.error, /histórico/);
  assert.equal((await api(`/api/categories/${categoryId}`, { method: 'PUT', body: { name: 'Carro', emoji: '🚗' } })).status, 200);
  assert.equal((await maintenanceOf(store)).name, 'Carro');
});

// Veículos e manutenções

test('veículos: cria, valida, edita e apaga, sem perder as manutenções', async () => {
  const { api, categoryId, store } = await setup();
  assert.equal((await api('/api/vehicles', { method: 'POST', body: { name: '' } })).status, 400);
  assert.equal((await api('/api/vehicles', { method: 'POST', body: { name: 'Civic', plate: 'placa inválida!' } })).status, 400);
  const created = await api('/api/vehicles', { method: 'POST', body: { name: 'Honda Civic', plate: 'abc1d23' } });
  assert.equal(created.status, 201);
  assert.equal(created.data.plate, 'ABC1D23');
  assert.equal((await api('/api/vehicles', { method: 'POST', body: { name: 'Honda Civic' } })).status, 409);

  const renamed = await api(`/api/vehicles/${created.data.id}`, { method: 'PUT', body: { name: 'Civic 2018', plate: '' } });
  assert.equal(renamed.data.name, 'Civic 2018');
  assert.equal(renamed.data.plate, null);

  const { data: expense } = await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: created.data.id }) });
  assert.equal(expense.vehicle_name, 'Civic 2018');
  await api(`/api/vehicles/${created.data.id}`, { method: 'DELETE' });
  const kept = await store.expense(expense.id);
  assert.equal(kept.description, 'Troca de óleo');
  assert.equal(kept.vehicle_id, null);
  assert.equal(kept.place, 'Oficina do Zé');
  assert.equal((await api('/api/vehicles')).data.unassigned_count, 1);
});

test('manutenção: guarda quando, onde, o que e a quilometragem, e aparece no histórico', async () => {
  const { api, categoryId } = await setup();
  const { data: vehicle } = await api('/api/vehicles', { method: 'POST', body: { name: 'Civic', plate: 'ABC1D23' } });
  const created = await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: vehicle.id }) });
  assert.equal(created.status, 201);
  assert.equal(created.data.place, 'Oficina do Zé');
  assert.equal(created.data.odometer_km, 85000);
  assert.equal(created.data.category_slug, MAINTENANCE_SLUG);

  await api('/api/expenses', { method: 'POST', body: service(categoryId, { description: 'Pneus', amount: '1200,50', date: '2024-05-20', vehicle_id: vehicle.id, place: '', odometer_km: '' }) });
  await api('/api/expenses', { method: 'POST', body: service(categoryId, { description: 'Revisão futura', date: '2099-01-01', vehicle_id: vehicle.id }) });

  const { data } = await api(`/api/vehicles/${vehicle.id}/history`);
  assert.equal(data.vehicle.name, 'Civic');
  assert.deepEqual(data.done.map((row) => [row.description, row.spent_on, row.place, row.odometer_km, row.total_cents]), [
    ['Troca de óleo', '2026-03-10', 'Oficina do Zé', 85000, 25000],
    ['Pneus', '2024-05-20', null, null, 120050],
  ]);
  assert.deepEqual(data.planned.map((row) => row.description), ['Revisão futura']);
  assert.equal(data.summary.service_count, 2);
  assert.equal(data.summary.total_cents, 145050);
  assert.equal(data.summary.last_km, 85000);

  const { data: list } = await api('/api/vehicles');
  assert.equal(list.vehicles[0].summary.service_count, 2);
  assert.equal(list.unassigned_count, 0);
});

test('manutenção antiga pode entrar sem valor e não muda os totais; outro gasto continua exigindo valor', async () => {
  const { api, categoryId, store } = await setup();
  const withoutValue = await api('/api/expenses', { method: 'POST', body: service(categoryId, { amount: '' }) });
  assert.equal(withoutValue.status, 201);
  assert.equal(withoutValue.data.amount_cents, 0);
  assert.equal((await store.total('2026-03-01', '2026-04-01')).total_cents, 0);

  const other = (await store.categories()).find((row) => row.name === 'Mercado');
  assert.equal((await api('/api/expenses', { method: 'POST', body: { description: 'Arroz', amount: '', date: TODAY, category_id: other.id } })).status, 400);
  assert.equal((await api('/api/expenses', { method: 'POST', body: service(categoryId, { amount: '0' }) })).status, 400);
  assert.equal((await api('/api/expenses', { method: 'POST', body: service(categoryId, { amount: 'abc' }) })).status, 400);
  // Repetição precisa de valor: sem ele, o banco recusaria.
  assert.equal((await api('/api/expenses', { method: 'POST', body: service(categoryId, { amount: '', repeat: 'yearly' }) })).status, 400);
  // Quem sai da categoria precisa ganhar um valor.
  assert.equal((await api(`/api/expenses/${withoutValue.data.id}`, { method: 'PUT', body: { description: 'Arroz', amount: '', date: TODAY, category_id: other.id } })).status, 400);
});

test('manutenção: quilometragem inválida não deixa gasto para trás', async () => {
  const { api, categoryId, store } = await setup();
  assert.equal((await api('/api/expenses', { method: 'POST', body: service(categoryId, { odometer_km: 'muitos' }) })).status, 400);
  assert.equal((await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: 999 }) })).status, 400);
  assert.equal((await store.allExpenses()).length, 0);
});

test('editar: muda os detalhes; sair da categoria tira do histórico; apagar remove tudo', async () => {
  const { api, categoryId, store } = await setup();
  const { data: vehicle } = await api('/api/vehicles', { method: 'POST', body: { name: 'Civic' } });
  const { data: row } = await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: vehicle.id }) });

  const edited = await api(`/api/expenses/${row.id}`, { method: 'PUT', body: service(categoryId, { description: 'Óleo e filtro', amount: '300', vehicle_id: vehicle.id, place: 'Auto Center', odometer_km: '90000' }) });
  assert.equal(edited.data.description, 'Óleo e filtro');
  assert.equal(edited.data.place, 'Auto Center');
  assert.equal(edited.data.odometer_km, 90000);

  const other = (await store.categories()).find((item) => item.name === 'Transporte');
  const moved = await api(`/api/expenses/${row.id}`, { method: 'PUT', body: { description: 'Gasolina', amount: '300', date: TODAY, category_id: other.id } });
  assert.equal(moved.data.place, null);
  assert.equal((await api(`/api/vehicles/${vehicle.id}/history`)).data.done.length, 0);

  const { data: second } = await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: vehicle.id }) });
  await api(`/api/expenses/${second.id}`, { method: 'DELETE' });
  assert.equal((await api(`/api/vehicles/${vehicle.id}/history`)).data.done.length, 0);
});

test('compra parcelada conta como um serviço só, com o valor total', async () => {
  const { store, categoryId, api } = await setup();
  const vehicle = await store.createVehicle({ name: 'Civic', plate: null });
  const rows = await store.addExpense({ description: 'Pneus', amountCents: 120000, categoryId, date: '2026-01-10', installments: 3, source: 'app' });
  await store.saveVehicleService(rows[1], { vehicleId: vehicle.id, place: 'Borracharia', odometerKm: 50000 });

  const { data } = await api(`/api/vehicles/${vehicle.id}/history`);
  assert.equal(data.done.length, 1);
  assert.equal(data.done[0].total_cents, 120000);
  assert.equal(data.done[0].spent_on, '2026-01-10');
  assert.equal(data.done[0].place, 'Borracharia');
  assert.equal(data.summary.service_count, 1);
  // Qualquer parcela mostra os mesmos detalhes.
  assert.equal((await store.expense(rows[2].id)).vehicle_name, 'Civic');
});

// Mensagens

test('conversa: corrigir a categoria leva para o histórico e tira dele', async () => {
  const user = await createAccount(db, { phone: OWNER, at: NOW });
  const store = db.forUser(user.id);
  const vehicle = await store.createVehicle({ name: 'Honda Civic', plate: null });
  const assistant = createAssistant({ db, config, google: noGoogle, mailer });
  const say = (text) => assistant.handleWhatsApp({ from: OWNER, text, sentAt: NOW });

  await say('vidro elétrico 400');
  assert.equal((await store.maintenanceHistory()).length, 0);
  assert.match(await say('categoria manutenção'), /🔧 Manutenção de Veículo/);
  const history = await store.maintenanceHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].vehicle_id, vehicle.id);

  await say('troca de óleo do civic 250 na oficina do zé ontem');
  assert.equal((await store.lastExpense()).place, 'Oficina do zé');
  assert.match(await say('categoria transporte'), /🚗 Transporte/);
  const moved = await store.lastExpense();
  assert.equal(moved.place, null);
  assert.equal(moved.vehicle_id, null);
  assert.equal((await store.maintenanceHistory()).length, 1);
});

// Isolamento

test('uma pessoa nunca vê nem usa o veículo de outra', async () => {
  const ana = await setup('ana@teste.com');
  const bia = await setup('bia@teste.com');
  const { data: vehicle } = await ana.api('/api/vehicles', { method: 'POST', body: { name: 'Civic', plate: 'ABC1D23' } });
  const { data: row } = await ana.api('/api/expenses', { method: 'POST', body: service(ana.categoryId, { vehicle_id: vehicle.id }) });

  assert.equal((await bia.api(`/api/vehicles/${vehicle.id}/history`)).status, 404);
  assert.equal((await bia.api(`/api/vehicles/${vehicle.id}`, { method: 'PUT', body: { name: 'Roubado' } })).status, 404);
  assert.equal((await bia.api(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await bia.api('/api/expenses', { method: 'POST', body: service(bia.categoryId, { vehicle_id: vehicle.id }) })).status, 400);
  assert.equal((await bia.api(`/api/expenses/${row.id}`)).status, 404);
  assert.deepEqual((await bia.api('/api/vehicles')).data, { vehicles: [], unassigned_count: 0 });

  await bia.store.saveVehicleService(row, { vehicleId: null, place: 'Invadido', odometerKm: 1 });
  assert.equal((await ana.store.expense(row.id)).place, 'Oficina do Zé');
  await bia.store.removeVehicleService(row);
  assert.equal((await ana.store.expense(row.id)).place, 'Oficina do Zé');

  assert.equal((await client(null)('/api/vehicles')).status, 401);
  assert.equal((await client(null)(`/api/vehicles/${vehicle.id}/history`)).status, 401);
});

test('teste vencido só consulta: não cria veículo nem manutenção, mas vê o relatório', async () => {
  const { api, user, categoryId } = await setup();
  const { data: vehicle } = await api('/api/vehicles', { method: 'POST', body: { name: 'Civic' } });
  await db.setTrialEnd(user.id, new Date('2020-01-01T00:00:00Z'));
  assert.equal((await api('/api/vehicles', { method: 'POST', body: { name: 'Outro' } })).status, 402);
  assert.equal((await api(`/api/vehicles/${vehicle.id}`, { method: 'PUT', body: { name: 'Novo' } })).status, 402);
  assert.equal((await api('/api/expenses', { method: 'POST', body: service(categoryId) })).status, 402);
  assert.equal((await api(`/api/vehicles/${vehicle.id}/history`)).status, 200);
});

test('painel compartilhado não entrega veículo, lugar nem quilometragem; baixar os dados entrega', async () => {
  const { api, categoryId } = await setup();
  const { data: vehicle } = await api('/api/vehicles', { method: 'POST', body: { name: 'Civic Secreto', plate: 'ABC1D23' } });
  const month = new Date().toISOString().slice(0, 7);
  await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: vehicle.id, date: `${month}-01` }) });

  const { data: { panels } } = await api('/api/panels');
  const panel = panels.find((row) => row.widgets.includes('maiores'));
  const { data: { url } } = await api(`/api/panels/${panel.id}/share`, { method: 'POST', body: {} });
  const token = url.split('/').at(-1);
  const shared = await client(null)(`/api/shared?from=${month}&to=${month}`, { method: 'POST', body: { token } });
  assert.equal(shared.status, 200);
  assert.ok(shared.data.data.top_expenses.length > 0);
  const text = JSON.stringify(shared.data);
  for (const secret of ['Civic Secreto', 'ABC1D23', 'Oficina do Zé', '85000', 'vehicle_id', 'odometer_km']) assert.ok(!text.includes(secret), secret);

  const exported = await api('/api/account/export');
  assert.equal(exported.data.veiculos[0].name, 'Civic Secreto');
  assert.equal(exported.data.gastos[0].place, 'Oficina do Zé');
});

test('apagar a conta leva os veículos junto', async () => {
  const { user, api, categoryId, store } = await setup();
  const { data: vehicle } = await api('/api/vehicles', { method: 'POST', body: { name: 'Civic' } });
  await api('/api/expenses', { method: 'POST', body: service(categoryId, { vehicle_id: vehicle.id }) });
  await db.deleteUser(user.id);
  assert.deepEqual(await store.vehicles(), []);
  assert.deepEqual(await store.maintenanceHistory(), []);
});

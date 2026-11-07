import { randomUUID } from 'node:crypto';
import { categorySlug, DEFAULT_CATEGORIES, DEFAULT_KEYWORDS, MAINTENANCE_SLUG } from './categories.js';
import { addMonths, monthOf, monthRange } from './dates.js';
import { DEFAULT_PANELS } from './panels.js';
import { normalizeKeyword } from './text.js';

const MIGRATION_LOCK = 727001;
const SYNC_BATCH = 50;
const REMINDER_BATCH = 100;
const BRIEFING_BATCH = 200;
const SYNC_MAX_DELAY_MINUTES = 360;

const MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    session_version INTEGER NOT NULL DEFAULT 1,
    email_reminders BOOLEAN NOT NULL DEFAULT true,
    phone TEXT UNIQUE,
    wa_id TEXT,
    terms_version TEXT NOT NULL,
    terms_accepted_at TIMESTAMPTZ NOT NULL,
    trial_ends_at TIMESTAMPTZ NOT NULL,
    paid_until TIMESTAMPTZ,
    deletion_requested_at TIMESTAMPTZ,
    last_inbound_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE categories (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    slug TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, name)
  );
  CREATE TABLE keywords (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    label TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, keyword)
  );
  CREATE TABLE expenses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    spent_on DATE NOT NULL,
    source TEXT NOT NULL,
    group_id UUID,
    installment INTEGER,
    installments INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX expenses_user_date ON expenses (user_id, spent_on DESC, id DESC);
  CREATE INDEX expenses_group ON expenses (group_id) WHERE group_id IS NOT NULL;
  CREATE TABLE appointments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    starts_on DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    remind_at TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    source TEXT NOT NULL,
    google_event_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
    sync_attempts INTEGER NOT NULL DEFAULT 0,
    sync_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX appointments_user_start ON appointments (user_id, starts_at);
  CREATE INDEX appointments_reminder ON appointments (remind_at) WHERE reminded_at IS NULL AND remind_at IS NOT NULL;
  CREATE INDEX appointments_sync ON appointments (sync_after) WHERE sync_status <> 'synced';
  CREATE TABLE google_accounts (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE google_deletions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE whatsapp_codes (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE usage_daily (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    limit_warned BOOLEAN NOT NULL DEFAULT false,
    paywall_warned BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, day)
  );
  CREATE TABLE processed_messages (
    id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  `,
  `
  CREATE TABLE accounts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'conta' CHECK (kind IN ('conta', 'cartao')),
    opening_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
  );
  ALTER TABLE expenses ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
  CREATE TABLE incomes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    received_on DATE NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX incomes_user_date ON incomes (user_id, received_on DESC, id DESC);
  CREATE TABLE tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_on DATE,
    remind_at TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    done_at TIMESTAMPTZ,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX tasks_user ON tasks (user_id, done_at, due_on);
  CREATE INDEX tasks_reminder ON tasks (remind_at) WHERE reminded_at IS NULL AND remind_at IS NOT NULL AND done_at IS NULL;
  CREATE TABLE panels (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    widgets TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, name)
  );
  CREATE TABLE panel_shares (
    panel_id INTEGER PRIMARY KEY REFERENCES panels(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  `,
  `
  ALTER TABLE tasks ADD COLUMN due_time TEXT;
  `,
  `
  CREATE TABLE recurrences (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    start_on DATE NOT NULL,
    end_on DATE,
    next_index INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX recurrences_user ON recurrences (user_id, id);
  ALTER TABLE expenses ADD COLUMN recurrence_id INTEGER REFERENCES recurrences(id) ON DELETE SET NULL;
  ALTER TABLE incomes ADD COLUMN recurrence_id INTEGER REFERENCES recurrences(id) ON DELETE SET NULL;
  CREATE INDEX expenses_recurrence ON expenses (recurrence_id) WHERE recurrence_id IS NOT NULL;
  CREATE INDEX incomes_recurrence ON incomes (recurrence_id) WHERE recurrence_id IS NOT NULL;
  UPDATE panels SET widgets = replace(widgets, '"contas","fluxo","categorias"', '"contas","previstos","categorias","fluxo"') WHERE name = 'Visão geral';
  `,
  `
  ALTER TABLE users ADD COLUMN daily_briefing BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE users ADD COLUMN briefing_on DATE;
  ALTER TABLE users ADD COLUMN briefing_channel TEXT;
  `,
  `
  CREATE TABLE vehicles (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    plate TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
  );
  CREATE TABLE vehicle_services (
    expense_id INTEGER PRIMARY KEY REFERENCES expenses(id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    place TEXT,
    odometer_km INTEGER CHECK (odometer_km >= 0)
  );
  CREATE INDEX vehicle_services_vehicle ON vehicle_services (vehicle_id);
  ALTER TABLE expenses DROP CONSTRAINT expenses_amount_cents_check;
  ALTER TABLE expenses ADD CONSTRAINT expenses_amount_cents_check CHECK (amount_cents >= 0);
  INSERT INTO categories (user_id, name, emoji, slug, position)
    SELECT id, 'Manutenção de Veículo', '🔧', 'manutencao de veiculo', 3 FROM users
    ON CONFLICT (user_id, name) DO UPDATE SET slug = EXCLUDED.slug;
  `,
  `
  CREATE TABLE pending_services (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );
  `,
  `
  CREATE TABLE pending_events (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );
  `,
  // No Supabase, a API automática dele daria acesso às tabelas a quem tivesse a chave pública do projeto.
  // Com a segurança por linha ligada e sem regras, ela não vê nada; o app entra como dono das tabelas e
  // não é afetado. Fora do Supabase, os papéis anon e authenticated não existem, e a segunda parte não roda.
  // Tabela nova precisa de ENABLE ROW LEVEL SECURITY na própria mudança: um teste confere.
  `
  DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename); END LOOP; END $$;
  DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated; END IF; END $$;
  `,
];

// Onde cada tipo de lançamento fica guardado. Os nomes vêm só daqui, nunca de quem usa o app.
const ENTRY_TABLES = {
  income: { table: 'incomes', dateColumn: 'received_on' },
  expense: { table: 'expenses', dateColumn: 'spent_on' },
};

async function migrate(connection) {
  await connection.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
  await connection.transaction(async (tx) => {
    // Se duas cópias do app subirem juntas, só uma aplica as mudanças.
    await tx.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
    const { rows } = await tx.query('SELECT COALESCE(MAX(version), 0)::int AS version FROM schema_version');
    for (let index = rows[0].version; index < MIGRATIONS.length; index += 1) {
      for (const statement of MIGRATIONS[index].split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
        await tx.query(statement);
      }
      await tx.query('INSERT INTO schema_version (version) VALUES ($1)', [index + 1]);
    }
  });
}

// Numa compra parcelada, os detalhes da manutenção ficam na primeira parcela e valem para todas.
const FIRST_OF_PURCHASE = 'COALESCE((SELECT MIN(g.id) FROM expenses g WHERE g.group_id = e.group_id), e.id)';

const SERVICE_JOIN = `
  LEFT JOIN vehicle_services s ON s.expense_id = ${FIRST_OF_PURCHASE}
  LEFT JOIN vehicles v ON v.id = s.vehicle_id
`;

const EXPENSE_SELECT = `
  SELECT e.*, c.name AS category_name, c.emoji AS category_emoji, c.slug AS category_slug, a.name AS account_name,
    r.frequency AS recurrence_frequency, s.vehicle_id, s.place, s.odometer_km, v.name AS vehicle_name
  FROM expenses e JOIN categories c ON c.id = e.category_id LEFT JOIN accounts a ON a.id = e.account_id
  LEFT JOIN recurrences r ON r.id = e.recurrence_id
  ${SERVICE_JOIN}
`;

const INCOME_SELECT = `
  SELECT i.*, a.name AS account_name, r.frequency AS recurrence_frequency
  FROM incomes i LEFT JOIN accounts a ON a.id = i.account_id
  LEFT JOIN recurrences r ON r.id = i.recurrence_id
`;

const panelRow = (row) => row && { ...row, widgets: JSON.parse(row.widgets) };

export async function openDb(connection) {
  await migrate(connection);
  const { query, transaction } = connection;
  const one = async (sql, params) => (await query(sql, params)).rows[0] ?? null;
  const all = async (sql, params) => (await query(sql, params)).rows;

  // Tudo que pertence a uma pessoa passa por aqui: toda consulta já leva o user_id.
  function forUser(userId) {
    const expense = (id) => one(`${EXPENSE_SELECT} WHERE e.id = $1 AND e.user_id = $2`, [id, userId]);
    const category = (id) => one('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
    const categories = () => all('SELECT * FROM categories WHERE user_id = $1 ORDER BY is_default, position, name', [userId]);
    const otherCategory = () => one('SELECT * FROM categories WHERE user_id = $1 AND is_default', [userId]);

    const learn = async (keyword, categoryId, executor = { query }) => {
      const normalized = normalizeKeyword(keyword);
      if (normalized.length < 2 || normalized.length > 60) return;
      await executor.query(`
        INSERT INTO keywords (user_id, keyword, label, category_id) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, keyword) DO UPDATE SET label = EXCLUDED.label, category_id = EXCLUDED.category_id
      `, [userId, normalized, keyword.trim().toLocaleLowerCase('pt-BR'), categoryId]);
    };

    const appointment = (id) => one('SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [id, userId]);

    return {
      categories,
      category,
      otherCategory,

      async createCategory({ name, emoji }) {
        const { position } = await one('SELECT COALESCE(MAX(position), 0) + 1 AS position FROM categories WHERE user_id = $1 AND NOT is_default', [userId]);
        return one('INSERT INTO categories (user_id, name, emoji, position) VALUES ($1, $2, $3, $4) RETURNING *', [userId, name, emoji, position]);
      },

      updateCategory: (id, { name, emoji }) =>
        one('UPDATE categories SET name = $1, emoji = $2 WHERE id = $3 AND user_id = $4 RETURNING *', [name, emoji, id, userId]),

      // Os gastos da categoria apagada vão para "Outros"; nenhum valor some do total.
      async deleteCategory(id) {
        const other = await otherCategory();
        await transaction(async (tx) => {
          await tx.query('UPDATE expenses SET category_id = $1 WHERE category_id = $2 AND user_id = $3', [other.id, id, userId]);
          await tx.query('UPDATE recurrences SET category_id = $1 WHERE category_id = $2 AND user_id = $3', [other.id, id, userId]);
          await tx.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
        });
      },

      // As palavras da própria pessoa vencem as palavras padrão.
      async keywords() {
        const own = await all('SELECT keyword, category_id FROM keywords WHERE user_id = $1', [userId]);
        const defaults = (await categories()).flatMap((row) =>
          (DEFAULT_KEYWORDS.get(row.slug) ?? []).map((keyword) => ({ keyword, category_id: row.id, learned: false })),
        );
        return [...own.map((row) => ({ ...row, learned: true })), ...defaults];
      },

      async keywordsOf(categoryId) {
        const rows = await all('SELECT label FROM keywords WHERE user_id = $1 AND category_id = $2 ORDER BY keyword', [userId, categoryId]);
        return rows.map((row) => row.label);
      },

      async setKeywords(categoryId, keywords) {
        await transaction(async (tx) => {
          await tx.query('DELETE FROM keywords WHERE user_id = $1 AND category_id = $2', [userId, categoryId]);
          for (const keyword of keywords) await learn(keyword, categoryId, tx);
        });
      },

      learn,

      // Parcelado vira uma linha por mês, para cada mês mostrar só o que pesa nele.
      // Os centavos que sobram da divisão ficam nas primeiras parcelas, e a soma bate com o total.
      async addExpense({ description, amountCents, categoryId, date, source, installments = 1, accountId = null }) {
        const groupId = installments > 1 ? randomUUID() : null;
        const base = Math.floor(amountCents / installments);
        const remainder = amountCents - base * installments;
        const ids = await transaction(async (tx) => {
          const created = [];
          for (let index = 0; index < installments; index += 1) {
            const { rows } = await tx.query(`
              INSERT INTO expenses (user_id, description, amount_cents, category_id, spent_on, source, group_id, installment, installments, account_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
            `, [
              userId, description, base + (index < remainder ? 1 : 0), categoryId, addMonths(date, index), source,
              groupId, groupId ? index + 1 : null, groupId ? installments : null, accountId,
            ]);
            created.push(rows[0].id);
          }
          return created;
        });
        return Promise.all(ids.map(expense));
      },

      expense,

      async updateExpense(id, { description, amountCents, categoryId, date, accountId = null }) {
        await query(
          'UPDATE expenses SET description = $1, amount_cents = $2, category_id = $3, spent_on = $4, account_id = $5 WHERE id = $6 AND user_id = $7',
          [description, amountCents, categoryId, date, accountId, id, userId],
        );
        return expense(id);
      },

      // A compra parcelada inteira sai da mesma conta.
      setExpenseAccount: (groupId, accountId) =>
        query('UPDATE expenses SET account_id = $1 WHERE group_id = $2 AND user_id = $3', [accountId, groupId, userId]),

      // Muda a categoria da compra inteira, com todas as parcelas.
      async setCategory(row, categoryId) {
        if (row.group_id) await query('UPDATE expenses SET category_id = $1 WHERE group_id = $2 AND user_id = $3', [categoryId, row.group_id, userId]);
        else await query('UPDATE expenses SET category_id = $1 WHERE id = $2 AND user_id = $3', [categoryId, row.id, userId]);
      },

      async deleteExpense(row, { wholeGroup = false } = {}) {
        if (wholeGroup && row.group_id) await query('DELETE FROM expenses WHERE group_id = $1 AND user_id = $2', [row.group_id, userId]);
        else await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [row.id, userId]);
      },

      // O que se repete é desfeito pela repetição inteira: ver lastRecurrence.
      lastExpense: () => one(`${EXPENSE_SELECT} WHERE e.user_id = $1 AND e.recurrence_id IS NULL ORDER BY e.id DESC LIMIT 1`, [userId]),

      recentExpenses: (today, limit) =>
        all(`${EXPENSE_SELECT} WHERE e.user_id = $1 AND e.spent_on <= $2 ORDER BY e.spent_on DESC, e.id DESC LIMIT $3`, [userId, today, limit]),

      listExpenses({ from, to, categoryId = null }) {
        const filter = categoryId ? 'AND e.category_id = $4' : '';
        const params = categoryId ? [userId, from, to, categoryId] : [userId, from, to];
        return all(`${EXPENSE_SELECT} WHERE e.user_id = $1 AND e.spent_on >= $2 AND e.spent_on < $3 ${filter} ORDER BY e.spent_on DESC, e.id DESC`, params);
      },

      allExpenses: () => all(`${EXPENSE_SELECT} WHERE e.user_id = $1 ORDER BY e.spent_on DESC, e.id DESC`, [userId]),

      total: (from, to) =>
        one(`
          SELECT COALESCE(SUM(amount_cents), 0)::float8 AS total_cents, COUNT(*)::int AS count
          FROM expenses WHERE user_id = $1 AND spent_on >= $2 AND spent_on < $3
        `, [userId, from, to]),

      totalsByCategory: (from, to) =>
        all(`
          SELECT c.id, c.name, c.emoji, SUM(e.amount_cents)::float8 AS total_cents, COUNT(*)::int AS count
          FROM expenses e JOIN categories c ON c.id = e.category_id
          WHERE e.user_id = $1 AND e.spent_on >= $2 AND e.spent_on < $3
          GROUP BY c.id, c.name, c.emoji ORDER BY total_cents DESC
        `, [userId, from, to]),

      topExpenses: (from, to, limit) =>
        all(`${EXPENSE_SELECT} WHERE e.user_id = $1 AND e.spent_on >= $2 AND e.spent_on < $3 ORDER BY e.amount_cents DESC, e.id DESC LIMIT $4`, [userId, from, to, limit]),

      // Entradas de dinheiro

      income: (id) => one(`${INCOME_SELECT} WHERE i.id = $1 AND i.user_id = $2`, [id, userId]),

      async addIncome({ description, amountCents, date, source, accountId = null }) {
        const { id } = await one(`
          INSERT INTO incomes (user_id, description, amount_cents, received_on, source, account_id)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [userId, description, amountCents, date, source, accountId]);
        return one(`${INCOME_SELECT} WHERE i.id = $1`, [id]);
      },

      async updateIncome(id, { description, amountCents, date, accountId = null }) {
        await query(
          'UPDATE incomes SET description = $1, amount_cents = $2, received_on = $3, account_id = $4 WHERE id = $5 AND user_id = $6',
          [description, amountCents, date, accountId, id, userId],
        );
        return one(`${INCOME_SELECT} WHERE i.id = $1 AND i.user_id = $2`, [id, userId]);
      },

      deleteIncome: (id) => query('DELETE FROM incomes WHERE id = $1 AND user_id = $2', [id, userId]),

      lastIncome: () => one(`${INCOME_SELECT} WHERE i.user_id = $1 AND i.recurrence_id IS NULL ORDER BY i.id DESC LIMIT 1`, [userId]),

      listIncomes: ({ from, to }) =>
        all(`${INCOME_SELECT} WHERE i.user_id = $1 AND i.received_on >= $2 AND i.received_on < $3 ORDER BY i.received_on DESC, i.id DESC`, [userId, from, to]),

      recentIncomes: (today, limit) =>
        all(`${INCOME_SELECT} WHERE i.user_id = $1 AND i.received_on <= $2 ORDER BY i.received_on DESC, i.id DESC LIMIT $3`, [userId, today, limit]),

      allIncomes: () => all(`${INCOME_SELECT} WHERE i.user_id = $1 ORDER BY i.received_on DESC, i.id DESC`, [userId]),

      incomeTotal: (from, to) =>
        one(`
          SELECT COALESCE(SUM(amount_cents), 0)::float8 AS total_cents, COUNT(*)::int AS count
          FROM incomes WHERE user_id = $1 AND received_on >= $2 AND received_on < $3
        `, [userId, from, to]),

      // "pending" é o que tem data depois de hoje: ainda vai entrar ou sair.
      async monthlyTotals(from, to, today) {
        const totals = ({ table, dateColumn }) => all(`
          SELECT to_char(${dateColumn}, 'YYYY-MM') AS month,
            SUM(amount_cents)::float8 AS cents,
            COALESCE(SUM(amount_cents) FILTER (WHERE ${dateColumn} > $4), 0)::float8 AS pending_cents
          FROM ${table} WHERE user_id = $1 AND ${dateColumn} >= $2 AND ${dateColumn} < $3 GROUP BY 1
        `, [userId, from, to, today]);
        const [incomes, expenses] = await Promise.all([totals(ENTRY_TABLES.income), totals(ENTRY_TABLES.expense)]);
        return { incomes, expenses };
      },

      // Lançamentos com data futura dentro do período, do mais próximo ao mais distante.
      async plannedEntries(from, to, limit) {
        const [expenses, incomes] = await Promise.all([
          all(`${EXPENSE_SELECT} WHERE e.user_id = $1 AND e.spent_on >= $2 AND e.spent_on < $3 ORDER BY e.spent_on, e.id LIMIT $4`, [userId, from, to, limit]),
          all(`${INCOME_SELECT} WHERE i.user_id = $1 AND i.received_on >= $2 AND i.received_on < $3 ORDER BY i.received_on, i.id LIMIT $4`, [userId, from, to, limit]),
        ]);
        return [
          ...expenses.map((row) => ({ ...row, kind: 'expense', date: row.spent_on })),
          ...incomes.map((row) => ({ ...row, kind: 'income', date: row.received_on })),
        ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
      },

      // Repetições: cada ocorrência é um lançamento comum, com a própria data.

      recurrence: (id) => one('SELECT * FROM recurrences WHERE id = $1 AND user_id = $2', [id, userId]),

      addRecurrence: ({ kind, description, amountCents, categoryId = null, accountId = null, frequency, startOn, endOn = null, source }) =>
        one(`
          INSERT INTO recurrences (user_id, kind, description, amount_cents, category_id, account_id, frequency, start_on, end_on, source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [userId, kind, description, amountCents, categoryId, accountId, frequency, startOn, endOn, source]),

      async addOccurrences(rule, dates) {
        const { table, dateColumn } = ENTRY_TABLES[rule.kind];
        const categoryId = rule.kind === 'expense' ? rule.category_id ?? (await otherCategory()).id : null;
        await transaction(async (tx) => {
          for (const date of dates) {
            if (rule.kind === 'expense') {
              await tx.query(`
                INSERT INTO expenses (user_id, description, amount_cents, category_id, spent_on, source, account_id, recurrence_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `, [userId, rule.description, rule.amount_cents, categoryId, date, rule.source, rule.account_id, rule.id]);
            } else {
              await tx.query(`
                INSERT INTO ${table} (user_id, description, amount_cents, ${dateColumn}, source, account_id, recurrence_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [userId, rule.description, rule.amount_cents, date, rule.source, rule.account_id, rule.id]);
            }
          }
          await tx.query('UPDATE recurrences SET next_index = next_index + $1 WHERE id = $2 AND user_id = $3', [dates.length, rule.id, userId]);
        });
      },

      // Vale para esta ocorrência e as próximas, e para as que ainda vão ser criadas. As datas não mudam.
      async updateRecurrenceFrom(rule, fromDate, { description, amountCents, categoryId = null, accountId = null }) {
        const { table, dateColumn } = ENTRY_TABLES[rule.kind];
        await transaction(async (tx) => {
          await tx.query(`
            UPDATE recurrences SET description = $1, amount_cents = $2, category_id = $3, account_id = $4 WHERE id = $5 AND user_id = $6
          `, [description, amountCents, rule.kind === 'expense' ? categoryId : null, accountId, rule.id, userId]);
          await tx.query(`
            UPDATE ${table} SET description = $1, amount_cents = $2, account_id = $3
            WHERE recurrence_id = $4 AND user_id = $5 AND ${dateColumn} >= $6
          `, [description, amountCents, accountId, rule.id, userId, fromDate]);
          if (rule.kind === 'expense') {
            await tx.query(`
              UPDATE expenses SET category_id = $1 WHERE recurrence_id = $2 AND user_id = $3 AND spent_on >= $4
            `, [categoryId, rule.id, userId, fromDate]);
          }
        });
      },

      // Para de repetir a partir desta data. O que veio antes continua, porque já aconteceu.
      async endRecurrence(rule, fromDate) {
        const { table, dateColumn } = ENTRY_TABLES[rule.kind];
        await transaction(async (tx) => {
          await tx.query(`DELETE FROM ${table} WHERE recurrence_id = $1 AND user_id = $2 AND ${dateColumn} >= $3`, [rule.id, userId, fromDate]);
          await tx.query(`
            UPDATE recurrences SET end_on = ($1::date - 1) WHERE id = $2 AND user_id = $3
          `, [fromDate, rule.id, userId]);
        });
      },

      // Apaga a repetição com todas as ocorrências.
      async deleteRecurrence(rule) {
        const { table } = ENTRY_TABLES[rule.kind];
        await transaction(async (tx) => {
          await tx.query(`DELETE FROM ${table} WHERE recurrence_id = $1 AND user_id = $2`, [rule.id, userId]);
          await tx.query('DELETE FROM recurrences WHERE id = $1 AND user_id = $2', [rule.id, userId]);
        });
      },

      setRecurrenceCategory: (rule, categoryId) =>
        transaction(async (tx) => {
          await tx.query('UPDATE recurrences SET category_id = $1 WHERE id = $2 AND user_id = $3', [categoryId, rule.id, userId]);
          await tx.query('UPDATE expenses SET category_id = $1 WHERE recurrence_id = $2 AND user_id = $3', [categoryId, rule.id, userId]);
        }),

      lastRecurrence: () => one('SELECT * FROM recurrences WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]),
      activeRecurrencesOf: (today) =>
        all('SELECT * FROM recurrences WHERE user_id = $1 AND (end_on IS NULL OR end_on > $2) ORDER BY id', [userId, today]),
      allRecurrences: () => all('SELECT * FROM recurrences WHERE user_id = $1 ORDER BY id', [userId]),

      // Contas e cartões

      accounts: () => all('SELECT * FROM accounts WHERE user_id = $1 ORDER BY kind, name', [userId]),
      account: (id) => one('SELECT * FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]),

      createAccount: ({ name, kind, openingCents }) =>
        one('INSERT INTO accounts (user_id, name, kind, opening_cents) VALUES ($1, $2, $3, $4) RETURNING *', [userId, name, kind, openingCents]),

      updateAccount: (id, { name, kind, openingCents }) =>
        one('UPDATE accounts SET name = $1, kind = $2, opening_cents = $3 WHERE id = $4 AND user_id = $5 RETURNING *', [name, kind, openingCents, id, userId]),

      // Os lançamentos continuam, só deixam de estar ligados à conta.
      deleteAccount: (id) => query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]),

      // Veículos. A data e o valor de cada manutenção ficam no gasto, para não existirem duas versões.

      vehicles: () => all('SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at, id', [userId]),
      vehicle: (id) => one('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [id, userId]),

      createVehicle: ({ name, plate }) =>
        one('INSERT INTO vehicles (user_id, name, plate) VALUES ($1, $2, $3) RETURNING *', [userId, name, plate]),

      updateVehicle: (id, { name, plate }) =>
        one('UPDATE vehicles SET name = $1, plate = $2 WHERE id = $3 AND user_id = $4 RETURNING *', [name, plate, id, userId]),

      // As manutenções continuam nas finanças, só ficam sem veículo definido.
      deleteVehicle: (id) => query('DELETE FROM vehicles WHERE id = $1 AND user_id = $2', [id, userId]),

      saveVehicleService: (row, { vehicleId, place, odometerKm }) =>
        query(`
          INSERT INTO vehicle_services (expense_id, vehicle_id, place, odometer_km)
          SELECT ${FIRST_OF_PURCHASE}, $2::int, $3::text, $4::int FROM expenses e WHERE e.id = $1 AND e.user_id = $5
          ON CONFLICT (expense_id) DO UPDATE SET vehicle_id = EXCLUDED.vehicle_id, place = EXCLUDED.place, odometer_km = EXCLUDED.odometer_km
        `, [row.id, vehicleId, place, odometerKm, userId]),

      removeVehicleService: (row) =>
        query(`DELETE FROM vehicle_services WHERE expense_id = (SELECT ${FIRST_OF_PURCHASE} FROM expenses e WHERE e.id = $1 AND e.user_id = $2)`, [row.id, userId]),

      // Tudo da categoria de manutenção, mesmo o que veio sem detalhes. Uma compra parcelada conta como um serviço só.
      maintenanceHistory: () =>
        all(`
          SELECT * FROM (
            SELECT e.*, s.vehicle_id, s.place, s.odometer_km, v.name AS vehicle_name, a.name AS account_name,
              (SUM(e.amount_cents) OVER service)::float8 AS total_cents,
              ROW_NUMBER() OVER (service ORDER BY e.spent_on, e.id) AS service_order
            FROM expenses e JOIN categories c ON c.id = e.category_id LEFT JOIN accounts a ON a.id = e.account_id
            ${SERVICE_JOIN}
            WHERE e.user_id = $1 AND c.slug = $2
            WINDOW service AS (PARTITION BY COALESCE(e.group_id::text, e.id::text))
          ) AS history
          WHERE service_order = 1 ORDER BY spent_on DESC, id DESC
        `, [userId, MAINTENANCE_SLUG]),

      // A manutenção que está sendo contada em mensagens, enquanto o assessor pergunta o que falta.
      async pendingService(now) {
        const row = await one('SELECT data FROM pending_services WHERE user_id = $1 AND expires_at > $2', [userId, now]);
        return row && JSON.parse(row.data);
      },

      savePendingService: (data, expiresAt) =>
        query(`
          INSERT INTO pending_services (user_id, data, expires_at) VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at
        `, [userId, JSON.stringify(data), expiresAt]),

      clearPendingService: () => query('DELETE FROM pending_services WHERE user_id = $1', [userId]),

      // O evento que a assessora de agenda já conhece, enquanto espera saber para quando é.
      pendingEvent: (now) => one('SELECT title FROM pending_events WHERE user_id = $1 AND expires_at > $2', [userId, now]),

      savePendingEvent: (title, expiresAt) =>
        query(`
          INSERT INTO pending_events (user_id, title, expires_at) VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET title = EXCLUDED.title, expires_at = EXCLUDED.expires_at
        `, [userId, title, expiresAt]),

      clearPendingEvent: () => query('DELETE FROM pending_events WHERE user_id = $1', [userId]),

      // Conta: saldo até hoje. Cartão: quanto já foi gasto no mês, que é a fatura em aberto.
      async accountBalances(today) {
        const { from, to } = monthRange(monthOf(today));
        const rows = await all(`
          SELECT a.*,
            COALESCE((SELECT SUM(i.amount_cents) FROM incomes i WHERE i.account_id = a.id AND i.received_on <= $2), 0)::float8 AS income_cents,
            COALESCE((SELECT SUM(e.amount_cents) FROM expenses e WHERE e.account_id = a.id AND e.spent_on <= $2), 0)::float8 AS expense_cents,
            COALESCE((SELECT SUM(e.amount_cents) FROM expenses e WHERE e.account_id = a.id AND e.spent_on >= $3 AND e.spent_on < $4), 0)::float8 AS month_expense_cents
          FROM accounts a WHERE a.user_id = $1 ORDER BY a.kind, a.name
        `, [userId, today, from, to]);
        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          opening_cents: row.opening_cents,
          balance_cents: row.kind === 'cartao' ? -row.month_expense_cents : row.opening_cents + row.income_cents - row.expense_cents,
        }));
      },

      // Tarefas

      task: (id) => one('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]),

      addTask: ({ title, date, time = null, remindAt, source }) =>
        one(
          'INSERT INTO tasks (user_id, title, due_on, due_time, remind_at, source) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [userId, title, date, time, remindAt, source],
        ),

      updateTask: (id, { title, date, time = null, remindAt }) =>
        one(`
          UPDATE tasks SET title = $1, due_on = $2, due_time = $3, remind_at = $4, reminded_at = NULL
          WHERE id = $5 AND user_id = $6 RETURNING *
        `, [title, date, time, remindAt, id, userId]),

      setTaskDone: (id, doneAt) => one('UPDATE tasks SET done_at = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [doneAt, id, userId]),
      deleteTask: (id) => query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]),
      lastTask: () => one('SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]),

      // As com data vêm primeiro, da mais antiga para a mais nova; no mesmo dia, as com horário.
      openTasks: (limit = 200) =>
        all('SELECT * FROM tasks WHERE user_id = $1 AND done_at IS NULL ORDER BY due_on NULLS LAST, due_time NULLS LAST, id LIMIT $2', [userId, limit]),

      doneTasks: (limit = 50) =>
        all('SELECT * FROM tasks WHERE user_id = $1 AND done_at IS NOT NULL ORDER BY done_at DESC, id DESC LIMIT $2', [userId, limit]),

      async openTaskCount() {
        const { count } = await one('SELECT COUNT(*)::int AS count FROM tasks WHERE user_id = $1 AND done_at IS NULL', [userId]);
        return count;
      },

      allTasks: () => all('SELECT * FROM tasks WHERE user_id = $1 ORDER BY id', [userId]),

      // Painéis

      // Quem nunca abriu o painel recebe os modelos prontos, que depois pode mudar à vontade.
      async panels() {
        const list = () => all('SELECT * FROM panels WHERE user_id = $1 ORDER BY position, id', [userId]);
        let rows = await list();
        if (!rows.length) {
          await transaction(async (tx) => {
            for (const [index, panel] of DEFAULT_PANELS.entries()) {
              await tx.query(`
                INSERT INTO panels (user_id, name, widgets, position) VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, name) DO NOTHING
              `, [userId, panel.name, JSON.stringify(panel.widgets), index]);
            }
          });
          rows = await list();
        }
        return rows.map(panelRow);
      },

      panel: async (id) => panelRow(await one('SELECT * FROM panels WHERE id = $1 AND user_id = $2', [id, userId])),

      createPanel: async ({ name, widgets }) => {
        const { position } = await one('SELECT COALESCE(MAX(position), 0) + 1 AS position FROM panels WHERE user_id = $1', [userId]);
        return panelRow(await one(
          'INSERT INTO panels (user_id, name, widgets, position) VALUES ($1, $2, $3, $4) RETURNING *',
          [userId, name, JSON.stringify(widgets), position],
        ));
      },

      updatePanel: async (id, { name, widgets }) => panelRow(await one(
        'UPDATE panels SET name = $1, widgets = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
        [name, JSON.stringify(widgets), id, userId],
      )),

      deletePanel: (id) => query('DELETE FROM panels WHERE id = $1 AND user_id = $2', [id, userId]),

      // Cada painel tem um só link: criar outro invalida o anterior.
      saveShare: (panelId, tokenHash, expiresAt) =>
        query(`
          INSERT INTO panel_shares (panel_id, token_hash, expires_at)
          SELECT id, $2, $3 FROM panels WHERE id = $1 AND user_id = $4
          ON CONFLICT (panel_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at
        `, [panelId, tokenHash, expiresAt, userId]),

      deleteShare: (panelId) =>
        query('DELETE FROM panel_shares WHERE panel_id = $1 AND panel_id IN (SELECT id FROM panels WHERE user_id = $2)', [panelId, userId]),

      shareOf: (panelId) =>
        one(`
          SELECT s.expires_at FROM panel_shares s JOIN panels p ON p.id = s.panel_id
          WHERE s.panel_id = $1 AND p.user_id = $2
        `, [panelId, userId]),

      // Agenda

      appointment,

      addAppointment: ({ title, date, startTime, endTime, startsAt, remindAt, source }) =>
        one(`
          INSERT INTO appointments (user_id, title, starts_on, start_time, end_time, starts_at, remind_at, source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [userId, title, date, startTime, endTime, startsAt, remindAt, source]),

      // Qualquer alteração volta a "pendente" para o Google receber a versão nova.
      updateAppointment: (id, { title, date, startTime, endTime, startsAt, remindAt }) =>
        one(`
          UPDATE appointments SET title = $1, starts_on = $2, start_time = $3, end_time = $4, starts_at = $5,
            remind_at = $6, reminded_at = NULL, sync_status = 'pending', sync_attempts = 0, sync_after = now()
          WHERE id = $7 AND user_id = $8 RETURNING *
        `, [title, date, startTime, endTime, startsAt, remindAt, id, userId]),

      deleteAppointment: (id) => query('DELETE FROM appointments WHERE id = $1 AND user_id = $2', [id, userId]),

      lastAppointment: () => one('SELECT * FROM appointments WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]),

      listAppointments: ({ from, to, limit = 200 }) =>
        all(`
          SELECT * FROM appointments WHERE user_id = $1 AND starts_on >= $2 AND starts_on < $3
          ORDER BY starts_on, start_time NULLS FIRST, id LIMIT $4
        `, [userId, from, to, limit]),

      allAppointments: () => all('SELECT * FROM appointments WHERE user_id = $1 ORDER BY starts_on, start_time NULLS FIRST', [userId]),

      // Outro compromisso no mesmo dia que ocupa parte do horário pedido.
      conflictsWith: ({ date, startTime, endTime, ignoreId = null }) =>
        one(`
          SELECT * FROM appointments
          WHERE user_id = $1 AND starts_on = $2 AND start_time IS NOT NULL AND start_time < $4 AND end_time > $3
            AND ($5::int IS NULL OR id <> $5)
          ORDER BY start_time LIMIT 1
        `, [userId, date, startTime, endTime, ignoreId]),
    };
  }

  return {
    forUser,
    close: () => connection.close(),

    userById: (id) => one('SELECT * FROM users WHERE id = $1', [id]),
    userByEmail: (email) => one('SELECT * FROM users WHERE email = $1', [email]),
    userByGoogleSub: (sub) => one('SELECT * FROM users WHERE google_sub = $1', [sub]),
    userByPhone: (phone) => one('SELECT * FROM users WHERE phone = $1', [phone]),

    // Cria a conta com as categorias e a versão dos termos aceita, como prova do consentimento.
    // Retorna null se o e-mail já tem conta.
    createUser: ({ name, email, passwordHash = null, googleSub = null, termsVersion, acceptedAt, trialEndsAt }) =>
      transaction(async (tx) => {
        const { rows } = await tx.query(`
          INSERT INTO users (name, email, password_hash, google_sub, terms_version, terms_accepted_at, trial_ends_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING RETURNING *
        `, [name, email, passwordHash, googleSub, termsVersion, acceptedAt, trialEndsAt]);
        const user = rows[0];
        if (!user) return null;
        for (const [index, item] of DEFAULT_CATEGORIES.entries()) {
          await tx.query(`
            INSERT INTO categories (user_id, name, emoji, slug, is_default, position) VALUES ($1, $2, $3, $4, $5, $6)
          `, [user.id, item.name, item.emoji, categorySlug(item.name), Boolean(item.isDefault), index]);
        }
        return user;
      }),

    updateProfile: (id, { name = null, emailReminders = null, dailyBriefing = null }) =>
      one(`
        UPDATE users SET name = COALESCE($1, name), email_reminders = COALESCE($2, email_reminders),
          daily_briefing = COALESCE($3, daily_briefing)
        WHERE id = $4 RETURNING *
      `, [name, emailReminders, dailyBriefing, id]),

    // Mudar a versão encerra as outras sessões e invalida links de nova senha já enviados.
    setPassword: (id, passwordHash) =>
      one('UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING *', [passwordHash, id]),

    setGoogleSub: (id, sub) => query('UPDATE users SET google_sub = $1 WHERE id = $2', [sub, id]),

    touchUser: (id, waId, at) => query('UPDATE users SET wa_id = $1, last_inbound_at = $2 WHERE id = $3', [waId, at, id]),

    // WhatsApp: opcional, ligado à conta por um código enviado do próprio número.

    saveWhatsappCode: (userId, codeHash, expiresAt) =>
      query(`
        INSERT INTO whatsapp_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at
      `, [userId, codeHash, expiresAt]),

    // Cada código funciona uma vez. Retorna de quem ele era, ou null se não vale.
    async useWhatsappCode(codeHash, now) {
      const row = await one('DELETE FROM whatsapp_codes WHERE code_hash = $1 AND expires_at > $2 RETURNING user_id', [codeHash, now]);
      return row?.user_id ?? null;
    },

    linkWhatsapp: (id, phone, waId, at) =>
      one('UPDATE users SET phone = $1, wa_id = $2, last_inbound_at = $3 WHERE id = $4 RETURNING *', [phone, waId, at, id]),

    unlinkWhatsapp: (id) => query('UPDATE users SET phone = NULL, wa_id = NULL, last_inbound_at = NULL WHERE id = $1', [id]),

    setPaidUntil: (id, paidUntil) => one('UPDATE users SET paid_until = $1 WHERE id = $2 RETURNING *', [paidUntil, id]),
    setTrialEnd: (id, trialEndsAt) => one('UPDATE users SET trial_ends_at = $1 WHERE id = $2 RETURNING *', [trialEndsAt, id]),
    requestDeletion: (id, at) => query('UPDATE users SET deletion_requested_at = $1 WHERE id = $2', [at, id]),
    // Apaga em cascata tudo que pertence à pessoa.
    deleteUser: (id) => query('DELETE FROM users WHERE id = $1', [id]),

    // Limites

    countUsage: (userId, day) =>
      one(`
        INSERT INTO usage_daily (user_id, day, messages) VALUES ($1, $2, 1)
        ON CONFLICT (user_id, day) DO UPDATE SET messages = usage_daily.messages + 1 RETURNING *
      `, [userId, day]),

    markLimitWarned: (userId, day) => query('UPDATE usage_daily SET limit_warned = true WHERE user_id = $1 AND day = $2', [userId, day]),
    markPaywallWarned: (userId, day) => query('UPDATE usage_daily SET paywall_warned = true WHERE user_id = $1 AND day = $2', [userId, day]),

    // Retorna false se a mensagem já foi vista: a Meta reenvia avisos e cada um só pode ser tratado uma vez.
    async markProcessed(messageId) {
      const rows = await all('INSERT INTO processed_messages (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id', [messageId]);
      return rows.length > 0;
    },

    // Google

    googleAccount: (userId) => one('SELECT * FROM google_accounts WHERE user_id = $1', [userId]),

    saveGoogleAccount: (userId, refreshToken) =>
      query(`
        INSERT INTO google_accounts (user_id, refresh_token) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, connected_at = now()
      `, [userId, refreshToken]),

    deleteGoogleAccount: (userId) => query('DELETE FROM google_accounts WHERE user_id = $1', [userId]),

    // Ao conectar, os compromissos que ainda vão acontecer entram na fila de envio.
    queueFutureAppointments: (userId, now) =>
      query(`
        UPDATE appointments SET sync_status = 'pending', sync_attempts = 0, sync_after = now()
        WHERE user_id = $1 AND starts_at >= $2 AND sync_status <> 'synced'
      `, [userId, now]),

    appointmentsToSync: (now) =>
      all(`
        SELECT a.* FROM appointments a JOIN google_accounts g ON g.user_id = a.user_id
        WHERE a.sync_status <> 'synced' AND a.sync_after <= $1 ORDER BY a.sync_after LIMIT ${SYNC_BATCH}
      `, [now]),

    markSynced: (id, eventId) =>
      query(`UPDATE appointments SET google_event_id = $1, sync_status = 'synced', sync_attempts = 0 WHERE id = $2`, [eventId, id]),

    // Cada falha espera mais antes de tentar de novo, até o máximo de 6 horas.
    markSyncFailed: (id) =>
      query(`
        UPDATE appointments SET sync_status = 'error', sync_attempts = sync_attempts + 1,
          sync_after = now() + make_interval(mins => LEAST(${SYNC_MAX_DELAY_MINUTES}, (sync_attempts + 1) * (sync_attempts + 1)))
        WHERE id = $1
      `, [id]),

    queueGoogleDeletion: (userId, eventId) => query('INSERT INTO google_deletions (user_id, google_event_id) VALUES ($1, $2)', [userId, eventId]),

    googleDeletions: () =>
      all(`
        SELECT d.* FROM google_deletions d JOIN google_accounts g ON g.user_id = d.user_id
        ORDER BY d.id LIMIT ${SYNC_BATCH}
      `),

    finishGoogleDeletion: (id) => query('DELETE FROM google_deletions WHERE id = $1', [id]),
    failGoogleDeletion: (id) => query('UPDATE google_deletions SET attempts = attempts + 1 WHERE id = $1', [id]),

    // Lembretes

    dueReminders: (now) =>
      all(`
        SELECT a.*, u.email, u.email_reminders, u.wa_id, u.last_inbound_at, u.trial_ends_at, u.paid_until
        FROM appointments a JOIN users u ON u.id = a.user_id
        WHERE a.remind_at IS NOT NULL AND a.reminded_at IS NULL AND a.remind_at <= $1
        ORDER BY a.remind_at LIMIT ${REMINDER_BATCH}
      `, [now]),

    markReminded: (id, at) => query('UPDATE appointments SET reminded_at = $1 WHERE id = $2', [at, id]),

    dueTaskReminders: (now) =>
      all(`
        SELECT t.*, u.email, u.email_reminders, u.wa_id, u.last_inbound_at, u.trial_ends_at, u.paid_until
        FROM tasks t JOIN users u ON u.id = t.user_id
        WHERE t.remind_at IS NOT NULL AND t.reminded_at IS NULL AND t.done_at IS NULL AND t.remind_at <= $1
        ORDER BY t.remind_at LIMIT ${REMINDER_BATCH}
      `, [now]),

    markTaskReminded: (id, at) => query('UPDATE tasks SET reminded_at = $1 WHERE id = $2', [at, id]),

    // Resumo do dia: quem ainda não foi atendido hoje.
    usersAwaitingBriefing: (today) =>
      all(`
        SELECT * FROM users
        WHERE daily_briefing AND (briefing_on IS NULL OR briefing_on < $1)
        ORDER BY id LIMIT ${BRIEFING_BATCH}
      `, [today]),

    markBriefing: (id, day, channel) => query('UPDATE users SET briefing_on = $1, briefing_channel = $2 WHERE id = $3', [day, channel, id]),

    recurrencesToExtend: (today) => all('SELECT * FROM recurrences WHERE end_on IS NULL OR end_on >= $1 ORDER BY id', [today]),

    // Painel compartilhado: encontrado só pelo link, sem sessão.
    async sharedPanel(tokenHash, now) {
      const row = await one(`
        SELECT p.*, u.name AS owner_name FROM panel_shares s
        JOIN panels p ON p.id = s.panel_id JOIN users u ON u.id = p.user_id
        WHERE s.token_hash = $1 AND s.expires_at > $2
      `, [tokenHash, now]);
      return panelRow(row);
    },

    // Limpeza diária: dados que não precisam continuar guardados.
    async cleanup(now) {
      await query(`DELETE FROM processed_messages WHERE received_at < $1::timestamptz - interval '30 days'`, [now]);
      await query('DELETE FROM whatsapp_codes WHERE expires_at < $1', [now]);
      await query('DELETE FROM panel_shares WHERE expires_at < $1', [now]);
      await query('DELETE FROM pending_services WHERE expires_at < $1', [now]);
      await query('DELETE FROM pending_events WHERE expires_at < $1', [now]);
      await query(`DELETE FROM usage_daily WHERE day < ($1::timestamptz - interval '90 days')::date`, [now]);
    },
  };
}

// Conexão com o PostgreSQL. Sem DATABASE_URL, usa o PGlite (o mesmo PostgreSQL, embutido) para
// rodar e testar no computador sem instalar nada.
import { readFileSync } from 'node:fs';

const DATE_OID = 1082;
const POOL_SIZE = 10;
// Data de gasto ou compromisso não tem hora: fica como texto "AAAA-MM-DD", sem conversão de fuso.
const keepDateAsText = (value) => value;

// O Supabase assina os certificados com uma autoridade própria, que o Node não conhece. Sem ela, ou a
// conexão é recusada, ou segue sem conferir quem está do outro lado. Essa raiz vale até 2031.
const SUPABASE_HOST = /\.supabase\.(co|com)$/;
const SUPABASE_CA = new URL('./certs/supabase-root-2021.crt', import.meta.url);
// No endereço, qualquer um destes substituiria a autoridade acima.
const SSL_PARAMS = ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

export function poolOptions(url) {
  const address = new URL(url);
  if (!SUPABASE_HOST.test(address.hostname)) return { connectionString: url };
  const found = SSL_PARAMS.filter((name) => address.searchParams.has(name));
  for (const name of found) address.searchParams.delete(name);
  return { connectionString: found.length ? address.toString() : url, ssl: { ca: readFileSync(SUPABASE_CA, 'utf8') } };
}

async function connectPostgres(url, log, { poolSize = POOL_SIZE, onPool } = {}) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(DATE_OID, keepDateAsText);
  const pool = new pg.Pool({ ...poolOptions(url), max: poolSize });
  pool.on('error', (err) => log.error(`Banco de dados: ${err.message}`));
  // Na Vercel, devolve as conexões paradas antes de a instância adormecer.
  onPool?.(pool);

  const wrap = (client) => ({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      return { rows: result.rows, count: result.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool),
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectEmbedded(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = await PGlite.create({ dataDir, parsers: { [DATE_OID]: keepDateAsText } });
  const wrap = (client) => ({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      return { rows: result.rows, count: result.affectedRows ?? 0 };
    },
  });
  return {
    ...wrap(db),
    exec: (sql) => db.exec(sql),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
}

export async function connect({ databaseUrl, dataDir, poolSize, onPool, log = console }) {
  return databaseUrl ? connectPostgres(databaseUrl, log, { poolSize, onPool }) : connectEmbedded(dataDir);
}

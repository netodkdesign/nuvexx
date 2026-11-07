import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { test } from 'node:test';
import { connect, poolOptions } from '../src/database.js';
import { openDb } from '../src/db.js';

const POOLER = 'postgresql://postgres.abcdefghijklmnopqrst:p%40ss@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

test('fora do Supabase, a conexão segue como veio', () => {
  const url = 'postgresql://dono:s3nha@banco.exemplo.com/app?sslmode=require';
  assert.deepEqual(poolOptions(url), { connectionString: url });
});

test('no Supabase, a conexão confere o certificado com a autoridade dele', () => {
  const options = poolOptions(POOLER);
  assert.equal(options.connectionString, POOLER);
  assert.match(options.ssl.ca, /BEGIN CERTIFICATE/);
  assert.equal(options.ssl.rejectUnauthorized, undefined);
});

test('no Supabase, parâmetros de SSL no endereço saem, porque substituiriam a autoridade', () => {
  const options = poolOptions(`${POOLER}?sslmode=require&application_name=nuvexx`);
  const address = new URL(options.connectionString);
  assert.equal(address.searchParams.has('sslmode'), false);
  assert.equal(address.searchParams.get('application_name'), 'nuvexx');
  assert.equal(decodeURIComponent(address.password), 'p@ss');
});

test('toda tabela tem a segurança por linha ligada, para a API automática do Supabase não ver nada', async () => {
  const connection = await connect({ databaseUrl: process.env.TEST_DATABASE_URL ?? '', dataDir: undefined });
  try {
    await openDb(connection);
    const { rows } = await connection.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1
    `);
    assert.deepEqual(rows.map((row) => row.relname), [], 'Ligue a segurança por linha nessas tabelas, numa mudança nova.');
  } finally {
    await connection.close();
  }
});

test('a autoridade do Supabase guardada no app ainda vale por mais de 90 dias', () => {
  const root = new X509Certificate(poolOptions(POOLER).ssl.ca);
  assert.match(root.subject, /CN=Supabase Root 2021 CA/);
  assert.equal(root.ca, true);
  const daysLeft = (new Date(root.validTo) - Date.now()) / 86_400_000;
  assert.ok(daysLeft > 90, `A raiz do Supabase vence em ${Math.round(daysLeft)} dias: baixe a nova no painel dele.`);
});

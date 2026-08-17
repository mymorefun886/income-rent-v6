// lib/db.js — PostgreSQL connection (pg)
// Reads DATABASE_URL from environment; falls back to local defaults.
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aios',
  max: 4,                     // sync is single-worker, 4 connections is enough
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected pool error:', err.message);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`[db] slow query (${duration}ms): ${text.substring(0, 80)}...`);
  }
  return res;
}

export async function getClient() {
  return pool.connect();
}

export async function end() {
  await pool.end();
}

export default { query, getClient, end };

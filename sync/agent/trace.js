// agent/trace.js — Query Trace Log v1.0
// Records every agent invocation for audit, regression testing, and drift detection.
// Table: system.query_trace

import { query } from '../lib/db.js';

// Ensure trace table exists
export async function ensureTraceTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system.query_trace (
      id              BIGSERIAL PRIMARY KEY,
      question        TEXT NOT NULL,
      question_hash   TEXT NOT NULL,
      intent          TEXT NOT NULL,
      params          JSONB,
      result_count    INTEGER,
      top_school      TEXT,
      top_score       INTEGER,
      execution_ms    INTEGER,
      signal_count    INTEGER,
      error_message   TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trace_intent ON system.query_trace (intent)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trace_created ON system.query_trace (created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trace_hash ON system.query_trace (question_hash)`);
}

import crypto from 'crypto';

function hashQuestion(q) {
  return crypto.createHash('sha256').update(q.trim().toLowerCase()).digest('hex').substring(0, 16);
}

/**
 * Wrap an agent ask() call with tracing.
 */
export async function tracedAsk(pool, question, askFn) {
  const started = Date.now();
  const qHash = hashQuestion(question);
  let trace = {
    question,
    question_hash: qHash,
    intent: 'unknown',
    params: null,
    result_count: 0,
    top_school: null,
    top_score: null,
    execution_ms: 0,
    signal_count: 0,
    error_message: null,
  };

  try {
    const response = await askFn(pool, question);
    trace.intent = response.intent || 'unknown';
    trace.result_count = response.meta?.count || 0;
    trace.params = response.meta?.preferences || response.meta?.filters || null;
    if (response.meta?.count > 0 && response.answer) {
      // Extract top school from answer (first numbered item)
      const m = response.answer.match(/\d+\.\s*\*\*(.+?)\*\*/);
      if (m) trace.top_school = m[1];
    }
    trace.execution_ms = Date.now() - started;
    return response;
  } catch (err) {
    trace.error_message = err.message;
    trace.execution_ms = Date.now() - started;
    throw err;
  } finally {
    // Fire-and-forget insert (don't block response)
    pool.query(`
      INSERT INTO system.query_trace (question, question_hash, intent, params, result_count, top_school, execution_ms, error_message)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [trace.question, trace.question_hash, trace.intent, JSON.stringify(trace.params),
        trace.result_count, trace.top_school, trace.execution_ms, trace.error_message])
      .catch(e => console.error('[trace] insert failed:', e.message));
  }
}

/**
 * Check if a question has produced a different answer than last time (drift detection).
 */
export async function checkDrift(pool, question) {
  const qHash = hashQuestion(question);
  const history = await pool.query(
    `SELECT result_count, top_school, intent, created_at FROM system.query_trace
     WHERE question_hash = $1 ORDER BY created_at DESC LIMIT 10`,
    [qHash]
  );
  if (history.rows.length < 2) return { drifted: false, reason: 'insufficient_history' };

  const latest = history.rows[0];
  const previous = history.rows[1];

  if (latest.result_count !== previous.result_count) {
    return {
      drifted: true,
      reason: `result count changed: ${previous.result_count} → ${latest.result_count}`,
      previous: { count: previous.result_count, top: previous.top_school, at: previous.created_at },
      latest:   { count: latest.result_count,   top: latest.top_school,   at: latest.created_at },
    };
  }

  return { drifted: false };
}

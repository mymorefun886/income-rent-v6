// agent/index.js — Education Agent v1.0
// Single entry point for Hermes. Accepts natural language, returns structured answer.
//
// Usage:
//   import { ask } from './agent/index.js';
//   const response = await ask(pool, '41校網天主教小學');
//   console.log(response.answer);
//
// Architecture:
//   User Question → Intent Classifier (rule-based) → Query Router → Composer → Answer
//
// Deterministic. No ML. No RAG. No SQL generation. Sits on frozen v1.0 Query Layer.

import { classifyIntent } from './intent.js';
import { routeIntent } from './router.js';
import { composeAnswer } from './composer.js';

/**
 * Ask the Education Agent a question about Hong Kong schools.
 * @param {Pool} pool - pg Pool connected to aios database
 * @param {string} question - natural language question (Chinese or English)
 * @returns {{ question, answer, intent, meta }}
 */
export async function ask(pool, question) {
  // 1. Classify intent (rule-based, deterministic)
  const { intent, params } = classifyIntent(question);

  // 2. Route to correct query API
  const result = await routeIntent(pool, { intent, params });

  // 3. Compose human-readable answer
  const response = composeAnswer(question, { intent, params }, result);

  return response;
}

// ── CLI runner for testing ────────────────────────────────────────────────────
async function main() {
  const question = process.argv[2];
  if (!question) { console.error('Usage: node agent/index.js "<question>"'); process.exit(1); }

  const pg = await import('pg');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://hermes:Mf848886@192.168.9.2:5435/aios',
    max: 4,
  });

  const response = await ask(pool, question);
  console.log(response.answer);
  await pool.end();
}

if (process.argv[1]?.includes('agent/index')) {
  main().catch(err => { console.error(err); process.exit(1); });
}

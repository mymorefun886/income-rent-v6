// lib/sync_engine.js — Core sync framework
// Handles sync_source registration, sync_log audit trail, and hash-based change detection.
import crypto from 'crypto';
import { query } from './db.js';

// ── Source registration ────────────────────────────────────────────────────────

/**
 * Ensure a row exists in system.sync_source. Creates it if missing.
 * Safe to call before every sync — idempotent upsert.
 */
export async function registerSource({ sourceName, sourceType, endpoint, updateFreq }) {
  await query(`
    INSERT INTO system.sync_source (source_name, source_type, endpoint, update_freq)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (source_name) DO UPDATE SET
      source_type = EXCLUDED.source_type,
      endpoint    = EXCLUDED.endpoint,
      update_freq = COALESCE(EXCLUDED.update_freq, system.sync_source.update_freq),
      updated_at  = NOW()
  `, [sourceName, sourceType, endpoint, updateFreq]);
}

// ── Sync execution ─────────────────────────────────────────────────────────────

/**
 * Wrap a sync job with logging and error handling.
 *
 * @param {object} opts
 * @param {string} opts.sourceName  - e.g. 'csdi_school_master'
 * @param {() => Promise<{hash: string, rows: number}>} opts.syncFn - the actual sync logic
 * @returns {Promise<{status: string, rows: number}>}
 */
export async function runSync({ sourceName, syncFn }) {
  const startedAt = new Date().toISOString();
  let logId = null;

  // Record the attempt
  const res = await query(`
    INSERT INTO system.sync_log (source_name, started_at, status)
    VALUES ($1, $2, 'running')
    RETURNING id
  `, [sourceName, startedAt]);
  logId = res.rows[0].id;

  // Get current row count for comparison
  const before = await query(
    `SELECT row_count FROM system.sync_source WHERE source_name = $1`,
    [sourceName]
  );
  const rowsBefore = before.rows[0]?.row_count || 0;

  try {
    const result = await syncFn();

    // Check if content changed
    const prevHash = await query(
      `SELECT source_hash FROM system.sync_source WHERE source_name = $1`,
      [sourceName]
    );
    const changed = !prevHash.rows[0]?.source_hash ||
                     prevHash.rows[0].source_hash !== result.hash;

    const finishedAt = new Date().toISOString();
    const status = changed ? 'ok' : 'unchanged';

    await query(`
      UPDATE system.sync_log
      SET finished_at = $2, status = $3, rows_before = $4, rows_after = $5
      WHERE id = $1
    `, [logId, finishedAt, status, rowsBefore, result.rows]);

    await query(`
      UPDATE system.sync_source
      SET last_sync_at    = $2,
          last_success_at = $2,
          source_hash     = $3,
          row_count       = $4,
          updated_at      = NOW()
      WHERE source_name = $1
    `, [sourceName, finishedAt, result.hash, result.rows]);

    return { status, rows: result.rows };
  } catch (err) {
    const finishedAt = new Date().toISOString();
    await query(`
      UPDATE system.sync_log
      SET finished_at = $2, status = 'error', rows_before = $3, error_message = $4
      WHERE id = $1
    `, [logId, finishedAt, rowsBefore, err.message]);

    await query(`
      UPDATE system.sync_source
      SET last_sync_at = $2, updated_at = NOW()
      WHERE source_name = $1
    `, [sourceName, finishedAt]);

    throw err;  // re-raise so the caller can handle it
  }
}

// ── Hash utilities ──────────────────────────────────────────────────────────────

export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Lightweight change check: HEAD request to get ETag or Last-Modified.
 * Returns {etag, lastModified, changed: bool} relative to the last known hash.
 */
export async function checkRemoteChange(url, lastHash) {
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    const etag = resp.headers.get('etag');
    const lastModified = resp.headers.get('last-modified');
    const currentFingerprint = etag || lastModified || null;
    return {
      etag,
      lastModified,
      changed: currentFingerprint ? currentFingerprint !== lastHash : true,
    };
  } catch {
    // If HEAD fails, assume changed and let the full fetch decide
    return { changed: true };
  }
}

export default { registerSource, runSync, sha256, checkRemoteChange };

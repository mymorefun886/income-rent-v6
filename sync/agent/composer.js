// agent/composer.js — Response Composer v1.0
// Formats query results into structured, human-readable output for Hermes.
// Structure: FACT → RECOMMENDATION → EXPLANATION TRACE → SIGNAL

import { buildTrace } from '../query/explain.js';

const LEVEL_TC = { kindergarten: '幼稚園', primary: '小學', secondary: '中學', special: '特殊學校' };
const TYPE_TC  = { aided: '津貼', govt: '官立', private: '私立', dss: '直資', esf: '英基', international: '國際', caput: '按位津貼' };

/**
 * Compose a human-readable response from a query result.
 */
export function composeAnswer(question, { intent, params }, result) {
  if (!result || result.error) {
    return {
      question,
      answer: '抱歉，未能找到符合條件的學校。請嘗試調整查詢條件。',
      intent,
      debug: result?.error || 'no_results',
    };
  }

  const schools = result.schools || [];
  const count = schools.length;

  const sections = [];

  // ── FACT section ──────────────────────────────────────────────────────────
  sections.push(`**查詢結果：${count} 間${LEVEL_TC[params.level] || '學校'}**\n`);

  if (count === 0) {
    sections.push('沒有符合條件的學校。');
    return { question, answer: sections.join('\n'), intent };
  }

  // ── School list ───────────────────────────────────────────────────────────
  schools.slice(0, 8).forEach((s, i) => {
    const type = TYPE_TC[s.school_type] || s.school_type || '';
    const moi = s.medium_of_instruction ? ` | ${s.medium_of_instruction}` : '';
    const religion = s.religion ? ` | ${s.religion}` : '';
    const mtr = s.mtr_distance_m != null ? ` | MTR ${s.nearest_mtr_stn} ${s.mtr_distance_m}m` : '';
    const vacancy = s.vacancy && Object.keys(s.vacancy).length > 0
      ? ` | 學位: ${Object.entries(s.vacancy).map(([k,v]) => k + '=' + (v === 'available' ? '有位' : '已滿')).join(', ')}`
      : '';

    sections.push(`${i + 1}. **${s.name_tc}** - ${type}${religion}${moi}${mtr}${vacancy}`);

    // Reasons
    if (s.reasons && s.reasons.length > 0) {
      sections.push(`   → ${s.reasons.join('，')}`);
    }
  });

  if (count > 8) sections.push(`\n... 及其他 ${count - 8} 間學校。`);

  // ── RECOMMENDATION section ─────────────────────────────────────────────────
  if (intent === 'recommend_schools' && count > 0 && schools[0].score != null) {
    sections.push(`\n---`);
    sections.push(`**推薦分析** (基於 v1.0 評分規則)`);
    sections.push(`最高分: ${schools[0].name_tc} (${schools[0].score}分)`);
    if (schools[0].reasons?.length > 0) {
      sections.push(`加分原因: ${schools[0].reasons.join('，')}`);
    }
  }

  // ── EXPLANATION TRACE section (for recommend) ──────────────────────────────
  if (intent === 'recommend_schools' && count > 0 && schools[0].score != null) {
    const trace = buildTrace(params, schools);
    sections.push(`\n---`);
    sections.push(`**評分規則** (v1.0，完全透明)`);
    Object.entries(trace.score_rules).forEach(([k, v]) => {
      sections.push(`  ${v.label}: +${v.weight}`);
    });
    sections.push(`\n所有評分均為規則計算，不含隨機性或機器學習。`);
  }

  // ── SIGNAL section (annotation only) ───────────────────────────────────────
  const schoolsWithSignals = schools.filter(s => s.signals?.length > 0);
  if (schoolsWithSignals.length > 0) {
    sections.push(`\n---`);
    sections.push(`**相關資訊** (僅供參考，不影響排序)`);
    schoolsWithSignals.slice(0, 3).forEach(s => {
      s.signals.slice(0, 2).forEach(sig => {
        sections.push(`  📰 ${s.name_tc}: ${sig.title || sig.summary}`);
      });
    });
  }

  // ── Meta ───────────────────────────────────────────────────────────────────
  sections.push(`\n---`);
  sections.push(`*查詢引擎: aiOS Education v1.0 | 結果可重現 | Frozen 2026-06-14*`);

  return {
    question,
    answer: sections.join('\n'),
    intent,
    meta: { count, intent, scorer_version: 'v1.0' },
  };
}

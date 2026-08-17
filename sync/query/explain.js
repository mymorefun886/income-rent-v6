// query/explain.js — Explanation Trace Builder v1.0
// Every decision path is traceable. Every score has a source. Signals are non-causal.
//
// Output structure for any recommendation:
// {
//   decision_path: { filters_applied, candidates_before, candidates_after, steps },
//   results: [{ school, scores: { breakdown }, signals: [{ non_causal: true, ... }] }],
//   meta: { scorer_version: 'v1.0', deterministic: true, frozen_at: '2026-06-14' }
// }

const SCORER_VERSION = 'v1.0';

const SCORE_RULES = {
  religion_match:      { weight: 10, label: '宗教匹配' },
  moi_match:           { weight: 10, label: '教學語言匹配' },
  mtr_under_500:       { weight: 15, label: '步行可達MTR (<500m)' },
  mtr_under_1000:      { weight: 10, label: '鄰近MTR (<1000m)' },
  has_vacancy:         { weight: 5,  label: '有學位' },
  outdoor_playground:  { weight: 5,  label: '有戶外操場 (KG)' },
  non_profit:          { weight: 5,  label: '非牟利 (KG)' },
  joining_scheme:      { weight: 3,  label: '參加幼稚園教育計劃 (KG)' },
};

/**
 * Build an explanation trace for a recommendation result.
 * @param {object} query - the original query parameters
 * @param {object[]} schools - ordered result list with individual scores
 * @returns explanation trace object
 */
export function buildTrace(query, schools) {
  const breakdown = schools.map(s => {
    const reasons = [];
    const detail = {};

    if (s._score_religion)     { detail.religion_match     = s._score_religion; reasons.push({ rule: 'religion_match', label: '宗教匹配', score: s._score_religion }); }
    if (s._score_moi)          { detail.moi_match          = s._score_moi;      reasons.push({ rule: 'moi_match', label: '教學語言匹配', score: s._score_moi }); }
    if (s._score_mtr)          { detail.mtr_proximity      = s._score_mtr;      reasons.push({ rule: s.mtr_distance_m <= 500 ? 'mtr_under_500' : 'mtr_under_1000', label: 'MTR距離 ' + s.mtr_distance_m + 'm', score: s._score_mtr }); }
    if (s._score_vacancy)      { detail.vacancy            = s._score_vacancy;  reasons.push({ rule: 'has_vacancy', label: '有學位', score: s._score_vacancy }); }
    if (s._score_playground)   { detail.outdoor_playground = s._score_playground; reasons.push({ rule: 'outdoor_playground', label: '有戶外操場', score: s._score_playground }); }
    if (s._score_nonprofit)    { detail.non_profit         = s._score_nonprofit; reasons.push({ rule: 'non_profit', label: '非牟利', score: s._score_nonprofit }); }
    if (s._score_scheme)       { detail.joining_scheme     = s._score_scheme;   reasons.push({ rule: 'joining_scheme', label: '參加計劃', score: s._score_scheme }); }

    return {
      school_code: s.school_code,
      name_tc: s.name_tc,
      name_en: s.name_en,
      total_score: s.score,
      score_breakdown: detail,
      reasons,
      signals: (s.signals || []).map(sig => ({
        ...sig,
        non_causal: true,
        note: 'This signal does not influence ranking. For context only.',
      })),
    };
  });

  return {
    decision_path: {
      query,
      scorer_version: SCORER_VERSION,
      deterministic: true,
      total_candidates: schools.length,
      rule_count: Object.keys(SCORE_RULES).length,
      note: 'All scores are rule-based. No ML, no randomness, no signal influence.',
    },
    score_rules: SCORE_RULES,
    results: breakdown,
    meta: {
      frozen_at: '2026-06-14',
      contract_version: 'v1.0',
      reproducibility: 'Running the same query against the same data will produce identical results.',
    },
  };
}

export default { buildTrace, SCORE_RULES, SCORER_VERSION };

// agent/intent.js — Rule-based intent classifier v1.0
// No ML, no fuzzy. Maps Cantonese/Chinese/English questions to { intent, params }.
// Deterministic: same question → same classification.

const INTENTS = {
  schools_in_net:      { api: 'schoolsInNet',      desc: '查詢某校網的學校' },
  get_school_by_name:  { api: 'getSchoolByName',   desc: '查詢特定學校資料' },
  search_schools:      { api: 'searchSchools',     desc: '多條件篩選學校' },
  compare_schools:     { api: 'compareSchools',    desc: '比較多間學校' },
  school_accessibility:{ api: 'schoolAccessibility',desc: '查詢地點附近學校' },
  recommend_schools:   { api: 'recommendSchools',  desc: '推薦學校' },
};

// ── Level detection ──────────────────────────────────────────────────────────

function detectLevel(q) {
  if (/小學|primary|pri/i.test(q)) return 'primary';
  if (/中學|secondary|sec/i.test(q)) return 'secondary';
  if (/幼稚園|幼兒園|kg|kindergarten|nursery|preschool/i.test(q)) return 'kindergarten';
  if (/特殊|special/i.test(q)) return 'special';
  return null;
}

// ── Net code extraction ──────────────────────────────────────────────────────

function detectNet(q) {
  // "41校網", "net 41", "POA 41", "SSPA KL2", "校網41"
  const m = q.match(/(?:校網|net|poa|sspa)\s*(\d{1,3}|[A-Z]{2}\d)/i);
  if (m) return { net_code: m[1], net_type: /sspa/i.test(m[0]) ? 'SSPA' : 'POA' };
  const m2 = q.match(/(\d{1,3})\s*(?:校網|net)/i);
  if (m2) return { net_code: m2[1], net_type: 'POA' };
  return null;
}

// ── Religion detection ───────────────────────────────────────────────────────

function detectReligion(q) {
  if (/天主教|catholic/i.test(q)) return 'catholic';
  if (/基督教|christian|protestant/i.test(q)) return 'christian';
  if (/佛教|buddhist/i.test(q)) return 'buddhist';
  if (/道教|taoist/i.test(q)) return 'taoist';
  if (/伊斯蘭|islam|muslim/i.test(q)) return 'islam';
  if (/無宗教|no religion/i.test(q)) return null;
  return null;
}

// ── MOI detection ────────────────────────────────────────────────────────────

function detectMOI(q) {
  if (/英文|英語|emi|english/i.test(q) && !/中英文|雙語/i.test(q)) return 'English';
  if (/中文|中文中學|cmi|chinese/i.test(q) && !/中英文|雙語/i.test(q)) return 'Chinese';
  return null;
}

// ── MTR distance ─────────────────────────────────────────────────────────────

function detectMTRDistance(q) {
  if (/步行.*?mtr|mtr.*?步行|近.*?mtr|mtr.*?近|地鐵站|港鐵站/i.test(q)) return 500;
  if (/500米|500m|步行可達|walking distance/i.test(q)) return 500;
  if (/1公里|1000米|1000m|一公里/i.test(q)) return 1000;
  return null;
}

// ── District detection ───────────────────────────────────────────────────────

const DISTRICTS = [
  'Central and Western', 'Eastern', 'Southern', 'Wan Chai',
  'Kowloon City', 'Kwun Tong', 'Sham Shui Po', 'Wong Tai Sin', 'Yau Tsim Mong',
  'Islands', 'Kwai Tsing', 'North', 'Sai Kung', 'Sha Tin', 'Tai Po', 'Tsuen Wan', 'Tuen Mun', 'Yuen Long',
];

const DISTRICT_ALIAS = {
  '中西區': 'CENTRAL AND WESTERN', '中環': 'CENTRAL AND WESTERN', '東區': 'EASTERN',
  '南區': 'SOUTHERN', '灣仔': 'WAN CHAI', '九龍城': 'KOWLOON CITY', '九龍塘': 'KOWLOON CITY',
  '觀塘': 'KWUN TONG', '深水埗': 'SHAM SHUI PO', '黃大仙': 'WONG TAI SIN',
  '油尖旺': 'YAU TSIM MONG', '旺角': 'YAU TSIM MONG', '尖沙咀': 'YAU TSIM MONG',
  '離島': 'ISLANDS', '葵青': 'KWAI TSING', '北區': 'NORTH', '西貢': 'SAI KUNG',
  '沙田': 'SHA TIN', '大埔': 'TAI PO', '荃灣': 'TSUEN WAN', '屯門': 'TUEN MUN', '元朗': 'YUEN LONG',
  '將軍澳': 'SAI KUNG', '馬鞍山': 'SHA TIN', '上水': 'NORTH', '粉嶺': 'NORTH',
};

function detectDistrict(q) {
  for (const [alias, district] of Object.entries(DISTRICT_ALIAS)) {
    if (q.includes(alias)) return district;
  }
  for (const d of DISTRICTS) {
    if (q.toLowerCase().includes(d.toLowerCase())) return d.toUpperCase();
  }
  return null;
}

// ── School type detection ────────────────────────────────────────────────────

function detectSchoolType(q) {
  if (/津貼|津校|aided/i.test(q)) return 'aided';
  if (/官立|government|govt/i.test(q)) return 'govt';
  if (/私立|private/i.test(q)) return 'private';
  if (/直資|dss/i.test(q)) return 'dss';
  if (/國際|international|intl/i.test(q)) return 'international';
  if (/英基|esf/i.test(q)) return 'esf';
  return null;
}

// ── Name extraction for comparison ───────────────────────────────────────────

function detectCompareNames(q) {
  // "比較A同B", "A vs B", "A同B邊間好"
  const m = q.match(/(?:比較|compare|vs\.?)\s*(.+?)(?:$|邊間|邊個|which)/i);
  if (!m) return null;
  const names = m[1].split(/\s*(?:同|vs\.?|、|and|&)\s*/i).filter(n => n.length >= 2);
  return names.length >= 2 ? names : null;
}

// ── Main classifier ──────────────────────────────────────────────────────────

export function classifyIntent(question) {
  const q = question.trim();
  const params = {};

  // 1. Compare schools?
  const compareNames = detectCompareNames(q);
  if (compareNames) {
    return { intent: 'compare_schools', params: { names: compareNames } };
  }

  // 2. Recommend?
  if (/推薦|recommend|揀|揀學校|邊間好|邊間學校好|邊間抵讀|建議|推介|揀邊間/i.test(q)) {
    params.level = detectLevel(q);
    params.religion = detectReligion(q);
    params.medium_of_instruction = detectMOI(q);
    const net = detectNet(q);
    if (net) { params.net_type = net.net_type; params.net_code = net.net_code; }
    params.mtr_distance_max = detectMTRDistance(q);
    params.school_type = detectSchoolType(q);
    params.district = detectDistrict(q);
    return { intent: 'recommend_schools', params };
  }

  // 3. Schools in net WITHOUT additional filters (pure net listing)
  const net2 = detectNet(q);
  const hasFilters = detectReligion(q) || detectMOI(q) || detectSchoolType(q) || detectDistrict(q) || detectMTRDistance(q);
  if (net2 && !hasFilters) {
    params.net_type = net2.net_type;
    params.net_code = net2.net_code;
    params.level = detectLevel(q);
    return { intent: 'schools_in_net', params };
  }

  // 4. Search (multi-filter) — net + filters, or any combination of 2+ filters
  if (hasFilters) {
    params.level = detectLevel(q);
    params.religion = detectReligion(q);
    params.medium_of_instruction = detectMOI(q);
    params.school_type = detectSchoolType(q);
    params.district = detectDistrict(q);
    params.mtr_distance_max = detectMTRDistance(q);
    if (net2) { params.net_type = net2.net_type; params.net_code = net2.net_code; }
    // If net + filters → use search_schools (deterministic filtering, not scoring)
    // If recommend keyword → use recommend_schools
    if (/推薦|recommend|揀|揀學校|邊間好|邊間學校好|邊間抵讀|建議|推介|揀邊間/i.test(q)) {
      return { intent: 'recommend_schools', params };
    }
    return { intent: 'search_schools', params };
  }

  // 5. Accessibility?
  if (/附近|near|步行|距離|方圓|周邊|around|within/i.test(q)) {
    params.level = detectLevel(q);
    params.mtr_distance_max = detectMTRDistance(q) || 500;
    params.district = detectDistrict(q);
    params.religion = detectReligion(q);
    params.school_type = detectSchoolType(q);
    return { intent: 'school_accessibility', params };
  }

  // 6. Single school lookup (default)
  let name = q.replace(/[?？]/g, '').trim();
  // Strip noise words
  name = name.replace(/\s*(?:資料|資訊|info|詳情|概覽|簡介|介紹|點樣|好唔好|好嗎|如何|怎麼樣)\s*/gi, '');
  return { intent: 'get_school_by_name', params: { name } };
}

export { INTENTS };

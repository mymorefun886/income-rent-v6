// agent/router.js — Query Router v1.0
// Maps intent → API call. No SQL generation. No parameter injection.
// Uses frozen v1.0 Query Layer APIs.

import { schoolsInNet } from '../query/schools_in_net.js';
import { getSchoolByName } from '../query/get_school_by_name.js';
import { searchSchools } from '../query/search_schools.js';
import { compareSchools } from '../query/compare_schools.js';
import { schoolAccessibility } from '../query/school_accessibility.js';
import { recommendSchools } from '../query/recommend_schools.js';

const ROUTES = {
  schools_in_net:       schoolsInNet,
  get_school_by_name:   getSchoolByName,
  search_schools:       searchSchools,
  compare_schools:      compareSchools,
  school_accessibility: schoolAccessibility,
  recommend_schools:    recommendSchools,
};

/**
 * Route a classified intent to the correct query API.
 * For compare_schools, resolves school names to codes first.
 */
export async function routeIntent(pool, { intent, params }) {
  if (!ROUTES[intent]) {
    throw new Error(`Unknown intent: ${intent}. Available: ${Object.keys(ROUTES).join(', ')}`);
  }

  // compare_schools: resolve names to school_codes
  if (intent === 'compare_schools' && params.names) {
    const codes = [];
    for (const name of params.names) {
      const result = await getSchoolByName(pool, { name });
      if (result.schools.length > 0) {
        codes.push(result.schools[0].school_code);
      }
    }
    if (codes.length < 2) {
      return { error: 'need_at_least_2_schools', found: codes.length };
    }
    return ROUTES[intent](pool, { school_codes: codes.slice(0, 5) });
  }

  return ROUTES[intent](pool, params);
}

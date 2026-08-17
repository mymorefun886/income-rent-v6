-- 002_views.sql
-- Compatibility views: map core.school back to the legacy table names.
-- Each view is a thin wrapper — zero maintenance, zero storage.
-- Old queries and applications continue to work without modification.
--
-- Usage: CREATE SCHEMA IF NOT EXISTS edu; then run this file.

-- =============================================================================
-- KINDERGARTEN (8 views)
-- =============================================================================

CREATE OR REPLACE VIEW edu.kg_csdi AS
SELECT * FROM core.school WHERE level = 'kindergarten';

CREATE OR REPLACE VIEW edu.kindergarten AS
SELECT * FROM core.school WHERE level = 'kindergarten';

-- If core.school_profile has kindergarten data via CHSC:
-- CREATE OR REPLACE VIEW edu.kg_overview_geo AS ...
-- Otherwise this view will be wired when the CHSC KG profile source is integrated.

-- For tables backed by core.school_vacancy:
-- CREATE OR REPLACE VIEW edu.kg_vacancy AS SELECT * FROM core.school_vacancy;

-- =============================================================================
-- PRIMARY SCHOOLS (6 views) — the Phase 1 targets
-- =============================================================================

CREATE OR REPLACE VIEW edu.aided_primary_schools AS
SELECT * FROM core.school WHERE level = 'primary' AND school_type = 'aided';

CREATE OR REPLACE VIEW edu.govt_primary_schools AS
SELECT * FROM core.school WHERE level = 'primary' AND school_type = 'govt';

CREATE OR REPLACE VIEW edu.private_primary_schools AS
SELECT * FROM core.school WHERE level = 'primary' AND school_type = 'private';

CREATE OR REPLACE VIEW edu.dss_primary_schools AS
SELECT * FROM core.school WHERE level = 'primary' AND school_type = 'dss';

CREATE OR REPLACE VIEW edu.esf_primary_schools AS
SELECT * FROM core.school WHERE level = 'primary' AND school_type = 'esf';

CREATE OR REPLACE VIEW edu.international_schools_primary AS
SELECT * FROM core.school WHERE level = 'primary' AND school_type = 'international';

-- CHSC primary school profile: superset of the old primary_school table
CREATE OR REPLACE VIEW edu.primary_school AS
SELECT
    s.school_code,
    s.name_tc,
    s.name_en,
    s.district,
    s.school_type,
    s.geom,
    p.school_year,
    p.student_count,
    p.teacher_count,
    p.class_count,
    p.religion,
    p.medium_of_instruction,
    p.profile_json
FROM core.school s
LEFT JOIN core.school_profile p ON s.school_code = p.school_code
WHERE s.level = 'primary';

-- =============================================================================
-- SECONDARY SCHOOLS (7 views)
-- =============================================================================

CREATE OR REPLACE VIEW edu.aided_secondary_schools AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'aided';

CREATE OR REPLACE VIEW edu.govt_secondary_schools AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'govt';

CREATE OR REPLACE VIEW edu.private_secondary_schools AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'private';

CREATE OR REPLACE VIEW edu.dss_secondary_schools AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'dss';

CREATE OR REPLACE VIEW edu.esf_secondary_schools AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'esf';

CREATE OR REPLACE VIEW edu.international_schools_secondary AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'international';

CREATE OR REPLACE VIEW edu.caput_secondary_schools AS
SELECT * FROM core.school WHERE level = 'secondary' AND school_type = 'caput';

CREATE OR REPLACE VIEW edu.secondary_school AS
SELECT
    s.school_code,
    s.name_tc,
    s.name_en,
    s.district,
    s.school_type,
    s.geom,
    p.school_year,
    p.student_count,
    p.teacher_count,
    p.class_count,
    p.religion,
    p.medium_of_instruction,
    p.profile_json
FROM core.school s
LEFT JOIN core.school_profile p ON s.school_code = p.school_code
WHERE s.level = 'secondary';

-- =============================================================================
-- ENROLLMENT (proxied to core when Phase 2 adds the table)
-- =============================================================================
-- CREATE OR REPLACE VIEW edu.primary_enrollment AS SELECT * FROM core.school_enrollment WHERE level = 'primary';
-- CREATE OR REPLACE VIEW edu.secondary_enrollment AS SELECT * FROM core.school_enrollment WHERE level = 'secondary';

-- =============================================================================
-- SCHOOL NET (POA / SSPA mapped through core.school_net)
-- =============================================================================
-- CREATE OR REPLACE VIEW edu.school_nets AS SELECT * FROM core.school_net;
-- CREATE OR REPLACE VIEW edu.poa_allocation AS SELECT * FROM core.school_net WHERE net_type = 'POA';
-- CREATE OR REPLACE VIEW edu.sspa_school_nets AS SELECT * FROM core.school_net WHERE net_type = 'SSPA';

-- =============================================================================
-- PHASE 1 ACCEPTANCE QUERY
-- =============================================================================
-- Run this to verify Phase 1 is complete:
--
-- SELECT
--     s.school_code,
--     s.name_tc,
--     s.school_type,
--     s.district,
--     n.net_code,
--     v.vacancy_count
-- FROM core.school s
-- LEFT JOIN core.school_net n
--     ON s.school_code = n.school_code AND n.net_type = 'POA'
-- LEFT JOIN core.school_vacancy v
--     ON s.school_code = v.school_code
-- WHERE s.level = 'primary'
--   AND n.net_code = '41';

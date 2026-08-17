-- 000_seed_sources.sql
-- Register all Phase 1 data sources in system.sync_source.
-- Run AFTER 001_init_schema.sql, BEFORE running the sync engine.

INSERT INTO system.sync_source (source_name, source_type, endpoint, update_freq) VALUES
-- School Master (16 CSDI layers, managed by csdi_school_master.js adapter)
('csdi_school_master',   'csdi_arcgis', 'https://portal.csdi.gov.hk (16 EDB school layers)', 'monthly'),

-- CHSC School Profiles (to be wired in Phase 1b)
('chsc_primary_profile',   'ckan_csv', 'https://www.chsc.hk/datagovhk/psp_2025_en.csv', 'annual'),
('chsc_secondary_profile',  'ckan_csv', 'https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv', 'annual'),

-- EDB KG Vacancy (to be wired in Phase 1c)
('edb_kg_vacancy',         'http_csv', 'http://www.edb.gov.hk/attachment/en/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/K1-K3_vacancy_information_en_202627.csv', 'as_needed'),

-- CSDI School Nets (to be wired in Phase 1d)
('csdi_poa_net',   'csdi_wfs', 'edb_rcd_1633320960920_77011', 'annual'),
('csdi_sspa_net',  'csdi_wfs', 'edb_rcd_1633321165670_11194', 'annual')
ON CONFLICT (source_name) DO UPDATE SET
  endpoint    = EXCLUDED.endpoint,
  update_freq = EXCLUDED.update_freq,
  updated_at  = NOW();

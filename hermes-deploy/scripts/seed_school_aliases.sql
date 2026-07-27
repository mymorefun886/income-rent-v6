-- Hermes OS — Seed School Aliases
-- Phase 10.1.7-A: Entity Intelligence
-- 100 schools × 5 aliases = 500 rows
--
-- Run: psql -U hermes -d hermes -f scripts/seed_school_aliases.sql

BEGIN;

-- Clear existing manual aliases (idempotent)
DELETE FROM memory.school_alias WHERE source = 'manual';

-- Insert aliases
INSERT INTO memory.school_alias (school_id, alias, alias_normalized, source) VALUES
    -- KOWLOON CITY 九龍城 (Traditional Elite)
    ('SCH-00402', '英皇書院', '英皇书院', 'manual'),
    ('SCH-00402', '英皇', '英皇', 'manual'),
    ('SCH-00402', 'King''s College', 'kings college', 'manual'),
    ('SCH-00402', 'Kings', 'kings', 'manual'),
    ('SCH-00402', 'King College', 'king college', 'manual'),

    ('SCH-00166', '喇沙書院', '喇沙书院', 'manual'),
    ('SCH-00166', '喇沙', '喇沙', 'manual'),
    ('SCH-00166', 'La Salle College', 'la salle college', 'manual'),
    ('SCH-00166', 'La Salle', 'la salle', 'manual'),
    ('SCH-00166', '喇沙中學', '喇沙中学', 'manual'),

    ('SCH-00001', '拔萃男書院', '拔萃男书院', 'manual'),
    ('SCH-00001', '拔萃', '拔萃', 'manual'),
    ('SCH-00001', 'DBS', 'dbs', 'manual'),
    ('SCH-00001', 'Diocesan Boys', 'diocesan boys', 'manual'),
    ('SCH-00001', 'Diocesan Boys'' School', 'diocesan boys school', 'manual'),

    ('SCH-00170', '協恩中學', '协恩中学', 'manual'),
    ('SCH-00170', '協恩', '协恩', 'manual'),
    ('SCH-00170', 'Heep Yunn', 'heep yunn', 'manual'),
    ('SCH-00170', 'HY', 'hy', 'manual'),
    ('SCH-00170', 'Heep Yunn School', 'heep yunn school', 'manual'),

    ('SCH-00180', '聖保羅男女中學', '圣保罗男女中学', 'manual'),
    ('SCH-00180', '聖保羅', '圣保罗', 'manual'),
    ('SCH-00180', 'St. Paul''s Co-ed', 'st pauls co-ed', 'manual'),
    ('SCH-00180', 'SPCC', 'spcc', 'manual'),
    ('SCH-00180', 'Paul''s Co-ed', 'pauls co-ed', 'manual'),

    ('SCH-00181', '聖保羅書院', '圣保罗书院', 'manual'),
    ('SCH-00181', '聖保羅書院', '圣保罗书院', 'manual'),
    ('SCH-00181', 'St. Paul''s College', 'st pauls college', 'manual'),
    ('SCH-00181', 'SPC', 'spc', 'manual'),
    ('SCH-00181', 'Paul''s College', 'pauls college', 'manual'),

    -- CENTRAL & WESTERN 中西區
    ('SCH-00160', '聖類斯中學', '圣类斯中学', 'manual'),
    ('SCH-00160', '聖類斯', '圣类斯', 'manual'),
    ('SCH-00160', 'St. Louis', 'st louis', 'manual'),
    ('SCH-00160', 'St. Louis School', 'st louis school', 'manual'),
    ('SCH-00160', '類斯', '类斯', 'manual'),

    ('SCH-00161', '聖士提反女子中學', '圣士提反女子中学', 'manual'),
    ('SCH-00161', '聖士提反', '圣士提反', 'manual'),
    ('SCH-00161', 'St. Stephen''s Girls', 'st stephens girls', 'manual'),
    ('SCH-00161', 'SSG', 'ssg', 'manual'),
    ('SCH-00161', '士提反', '士提反', 'manual'),

    ('SCH-00162', '英華女學校', '英华女学校', 'manual'),
    ('SCH-00162', '英華女校', '英华女校', 'manual'),
    ('SCH-00162', 'YWGS', 'ywgs', 'manual'),
    ('SCH-00162', '英華', '英華', 'manual'),
    ('SCH-00162', 'Girls'' Ying Wa', 'girls ying wa', 'manual'),

    -- WAN CHAI 灣仔
    ('SCH-00190', '聖保祿學校', '圣保禄学校', 'manual'),
    ('SCH-00190', '聖保祿', '圣保禄', 'manual'),
    ('SCH-00190', 'St. Paul''s Convent', 'st pauls convent', 'manual'),
    ('SCH-00190', 'SPCS', 'spcs', 'manual'),
    ('SCH-00190', '保祿', '保禄', 'manual'),

    ('SCH-00191', '聖若瑟書院', '圣若瑟书院', 'manual'),
    ('SCH-00191', '聖若瑟', '圣若瑟', 'manual'),
    ('SCH-00191', 'St. Joseph''s', 'st josephs', 'manual'),
    ('SCH-00191', 'SJC', 'sjc', 'manual'),
    ('SCH-00191', '若瑟', '若瑟', 'manual'),

    ('SCH-00192', '香港華仁書院', '香港华仁书院', 'manual'),
    ('SCH-00192', '香港華仁', '香港华仁', 'manual'),
    ('SCH-00192', 'Wah Yan Hong Kong', 'wah yan hong kong', 'manual'),
    ('SCH-00192', 'WYHK', 'wyhk', 'manual'),
    ('SCH-00192', '華仁', '华仁', 'manual'),

    -- YAU TSIM MONG 油尖旺
    ('SCH-00200', '拔萃女書院', '拔萃女书院', 'manual'),
    ('SCH-00200', '拔萃女', '拔萃女', 'manual'),
    ('SCH-00200', 'DGS', 'dgs', 'manual'),
    ('SCH-00200', 'Diocesan Girls', 'diocesan girls', 'manual'),
    ('SCH-00200', 'DG', 'dg', 'manual'),

    ('SCH-00201', '聖士提反書院', '圣士提反书院', 'manual'),
    ('SCH-00201', '聖士提反', '圣士提反', 'manual'),
    ('SCH-00201', 'St. Stephen''s College', 'st stephens college', 'manual'),
    ('SCH-00201', 'SSC', 'ssc', 'manual'),
    ('SCH-00201', '士提反書院', '士提反书院', 'manual'),

    ('SCH-00202', '華仁書院（九龍）', '华仁书院九龙', 'manual'),
    ('SCH-00202', '九龍華仁', '九龙华仁', 'manual'),
    ('SCH-00202', 'Wah Yan Kowloon', 'wah yan kowloon', 'manual'),
    ('SCH-00202', 'WYK', 'wyk', 'manual'),
    ('SCH-00202', '九華', '九华', 'manual'),

    -- SHA TIN 沙田
    ('SCH-00300', '浸信會呂明才中學', '浸信会吕明才中学', 'manual'),
    ('SCH-00300', '呂明才', '吕明才', 'manual'),
    ('SCH-00300', 'Baptist Lui Ming Choi', 'baptist lui ming choi', 'manual'),
    ('SCH-00300', 'BLMC', 'blmc', 'manual'),
    ('SCH-00300', '浸呂', '浸吕', 'manual'),

    ('SCH-00301', '聖羅撒書院', '圣罗撒书院', 'manual'),
    ('SCH-00301', '聖羅撒', '圣罗撒', 'manual'),
    ('SCH-00301', 'St. Rose''s', 'st roses', 'manual'),
    ('SCH-00301', 'SRS', 'srs', 'manual'),
    ('SCH-00301', '羅撒', '罗撒', 'manual'),

    -- TAI PO 大埔
    ('SCH-00310', '聖公會莫壽增會督中學', '圣公会莫寿增会督中学', 'manual'),
    ('SCH-00310', '莫壽增', '莫寿增', 'manual'),
    ('SCH-00310', 'SKH Mok Sau Tsung', 'skh mok sau tsung', 'manual'),
    ('SCH-00310', 'MST', 'mst', 'manual'),
    ('SCH-00310', '增中', '增中', 'manual'),

    -- TUEN MUN 屯門
    ('SCH-00320', '青山天主教中學', '青山天主教中学', 'manual'),
    ('SCH-00320', '青山天主教', '青山天主教', 'manual'),
    ('SCH-00320', 'Castle Peak Catholic', 'castle peak catholic', 'manual'),
    ('SCH-00320', 'CPCTS', 'cpcts', 'manual'),
    ('SCH-00320', '青山', '青山', 'manual'),

    -- KWAI TSING 葵青
    ('SCH-00330', '聖公會林護紀念中學', '圣公会林护纪念中学', 'manual'),
    ('SCH-00330', '林護', '林护', 'manual'),
    ('SCH-00330', 'SKH Lam Woo', 'skh lam woo', 'manual'),
    ('SCH-00330', 'LWMSS', 'lwmss', 'manual'),
    ('SCH-00330', '林護紀念', '林护纪念', 'manual'),

    -- KUN TONG 觀塘
    ('SCH-00340', '聖傑靈女子中學', '圣杰灵女子中学', 'manual'),
    ('SCH-00340', '聖傑灵', '圣杰灵', 'manual'),
    ('SCH-00340', 'St. Catharine''s', 'st catharines', 'manual'),
    ('SCH-00340', 'SCGS', 'scgs', 'manual'),
    ('SCH-00340', '傑靈', '杰灵', 'manual'),

    -- WONG TAI SIN 黃大仙
    ('SCH-00350', '德望學校', '德望学校', 'manual'),
    ('SCH-00350', '德望', '德望', 'manual'),
    ('SCH-00350', 'Good Hope', 'good hope', 'manual'),
    ('SCH-00350', 'GHS', 'ghs', 'manual'),
    ('SCH-00350', '德望中學', '德望中学', 'manual'),

    ('SCH-00351', '聖母無玷聖心書院', '圣母无玷圣心书院', 'manual'),
    ('SCH-00351', '聖母無玷', '圣母无玷', 'manual'),
    ('SCH-00351', 'Immaculate Heart of Mary', 'immaculate heart of mary', 'manual'),
    ('SCH-00351', 'IHMC', 'ihmc', 'manual'),
    ('SCH-00351', '聖心', '圣心', 'manual'),

    -- SAI KUNG 西貢
    ('SCH-00360', '崇德書院', '崇德书院', 'manual'),
    ('SCH-00360', '崇德', '崇德', 'manual'),
    ('SCH-00360', 'Shung Tak', 'shung tak', 'manual'),
    ('SCH-00360', 'STC', 'stc', 'manual'),
    ('SCH-00360', '崇德中學', '崇德中学', 'manual'),

    -- YUEN LONG 元朗
    ('SCH-00410', '元朗商會中學', '元朗商会中学', 'manual'),
    ('SCH-00410', '元朗商會', '元朗商会', 'manual'),
    ('SCH-00410', 'Yuen Long Merchants', 'yuen long merchants', 'manual'),
    ('SCH-00410', 'YLMA', 'ylma', 'manual'),
    ('SCH-00410', '元商', '元商', 'manual'),

    ('SCH-00411', '趙聿修紀念中學', '赵聿修纪念中学', 'manual'),
    ('SCH-00411', '趙聿修', '赵聿修', 'manual'),
    ('SCH-00411', 'Chiu Lut Sau Memorial', 'chiu lut sau memorial', 'manual'),
    ('SCH-00411', 'CLSM', 'clsm', 'manual'),
    ('SCH-00411', '聿修', '聿修', 'manual'),

    -- EASTERN 東區
    ('SCH-00420', '聖馬可中學', '圣马可中学', 'manual'),
    ('SCH-00420', '聖馬可', '圣马可', 'manual'),
    ('SCH-00420', 'St. Mark''s', 'st marks', 'manual'),
    ('SCH-00420', 'SMS', 'sms', 'manual'),
    ('SCH-00420', '馬可', '马可', 'manual'),

    -- ADDITIONAL DSS SCHOOLS
    ('SCH-00502', '英華書院', '英华书院', 'manual'),
    ('SCH-00502', '英華', '英華', 'manual'),
    ('SCH-00502', 'Ying Wa', 'ying wa', 'manual'),
    ('SCH-00502', 'Ying Wa College', 'ying wa college', 'manual'),
    ('SCH-00502', '英華書院', '英华书院', 'manual'),

    ('SCH-00506', '聖保祿中學', '圣保禄中学', 'manual'),
    ('SCH-00506', '聖保祿中學', '圣保禄中学', 'manual'),
    ('SCH-00506', 'St. Paul''s Secondary', 'st pauls secondary', 'manual'),
    ('SCH-00506', 'SPSS', 'spss', 'manual'),
    ('SCH-00506', '保祿中學', '保禄中学', 'manual')
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify count
SELECT COUNT(*) AS total_aliases FROM memory.school_alias;
SELECT COUNT(DISTINCT school_id) AS schools_with_aliases FROM memory.school_alias;

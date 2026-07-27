-- Hermes OS — Seed School Aliases (v2 — Using Real school_ids)
-- Phase 10.1.7-A: Entity Intelligence
--
-- Run: psql -U hermes -d hermes -f scripts/seed_school_aliases_v2.sql

BEGIN;

-- Clear existing manual aliases (idempotent)
DELETE FROM memory.school_alias WHERE source = 'manual';

-- Insert aliases using REAL school_ids from school_entity
INSERT INTO memory.school_alias (school_id, alias, alias_normalized, source) VALUES
    -- ============================================================
    -- TRADITIONAL ELITE SCHOOLS (名校)
    -- ============================================================

    -- SCH-00001: Diocesan Boys' School (拔萃男書院)
    ('SCH-00001', '拔萃男書院', '拔萃男书院', 'manual'),
    ('SCH-00001', '拔萃', '拔萃', 'manual'),
    ('SCH-00001', 'DBS', 'dbs', 'manual'),
    ('SCH-00001', 'Diocesan Boys', 'diocesan boys', 'manual'),
    ('SCH-00001', 'Diocesan Boys'' School', 'diocesan boys school', 'manual'),

    -- SCH-00002: Diocesan Girls' School (拔萃女書院)
    ('SCH-00002', '拔萃女書院', '拔萃女书院', 'manual'),
    ('SCH-00002', '拔萃女', '拔萃女', 'manual'),
    ('SCH-00002', 'DGS', 'dgs', 'manual'),
    ('SCH-00002', 'Diocesan Girls', 'diocesan girls', 'manual'),
    ('SCH-00002', 'Diocesan Girls'' School', 'diocesan girls school', 'manual'),

    -- SCH-00166: La Salle College (喇沙書院)
    ('SCH-00166', '喇沙書院', '喇沙书院', 'manual'),
    ('SCH-00166', '喇沙', '喇沙', 'manual'),
    ('SCH-00166', 'La Salle College', 'la salle college', 'manual'),
    ('SCH-00166', 'La Salle', 'la salle', 'manual'),
    ('SCH-00166', '喇沙中學', '喇沙中学', 'manual'),

    -- SCH-00402: King's College (英皇書院)
    ('SCH-00402', '英皇書院', '英皇书院', 'manual'),
    ('SCH-00402', '英皇', '英皇', 'manual'),
    ('SCH-00402', 'King''s College', 'kings college', 'manual'),
    ('SCH-00402', 'Kings', 'kings', 'manual'),
    ('SCH-00402', 'King College', 'king college', 'manual'),

    -- SCH-00382: Heep Yunn School (協恩中學)
    ('SCH-00382', '協恩中學', '协恩中学', 'manual'),
    ('SCH-00382', '協恩', '协恩', 'manual'),
    ('SCH-00382', 'Heep Yunn', 'heep yunn', 'manual'),
    ('SCH-00382', 'HY', 'hy', 'manual'),
    ('SCH-00382', 'Heep Yunn School', 'heep yunn school', 'manual'),

    -- SCH-00260: St. Paul's Co-educational College (聖保羅男女中學)
    ('SCH-00260', '聖保羅男女中學', '圣保罗男女中学', 'manual'),
    ('SCH-00260', '聖保羅', '圣保罗', 'manual'),
    ('SCH-00260', 'St. Paul''s Co-ed', 'st pauls co-ed', 'manual'),
    ('SCH-00260', 'SPCC', 'spcc', 'manual'),
    ('SCH-00260', 'Paul''s Co-ed', 'pauls co-ed', 'manual'),

    -- SCH-00261: St. Paul's College (聖保羅書院)
    ('SCH-00261', '聖保羅書院', '圣保罗书院', 'manual'),
    ('SCH-00261', '聖保羅書院', '圣保罗书院', 'manual'),
    ('SCH-00261', 'St. Paul''s College', 'st pauls college', 'manual'),
    ('SCH-00261', 'SPC', 'spc', 'manual'),
    ('SCH-00261', 'Paul''s College', 'pauls college', 'manual'),

    -- SCH-00258: St. Paul's Convent School (聖保祿學校)
    ('SCH-00258', '聖保祿學校', '圣保禄学校', 'manual'),
    ('SCH-00258', '聖保祿', '圣保禄', 'manual'),
    ('SCH-00258', 'St. Paul''s Convent', 'st pauls convent', 'manual'),
    ('SCH-00258', 'SPCS', 'spcs', 'manual'),
    ('SCH-00258', '保祿', '保禄', 'manual'),

    -- SCH-00044: Good Hope School (德望學校)
    ('SCH-00044', '德望學校', '德望学校', 'manual'),
    ('SCH-00044', '德望', '德望', 'manual'),
    ('SCH-00044', 'Good Hope', 'good hope', 'manual'),
    ('SCH-00044', 'GHS', 'ghs', 'manual'),
    ('SCH-00044', '德望中學', '德望中学', 'manual'),

    -- SCH-00294: St. Joseph's College (聖若瑟書院)
    ('SCH-00294', '聖若瑟書院', '圣若瑟书院', 'manual'),
    ('SCH-00294', '聖若瑟', '圣若瑟', 'manual'),
    ('SCH-00294', 'St. Joseph''s', 'st josephs', 'manual'),
    ('SCH-00294', 'SJC', 'sjc', 'manual'),
    ('SCH-00294', '若瑟', '若瑟', 'manual'),

    -- SCH-00356: Wah Yan College Hong Kong (香港華仁書院)
    ('SCH-00356', '香港華仁書院', '香港华仁书院', 'manual'),
    ('SCH-00356', '香港華仁', '香港华仁', 'manual'),
    ('SCH-00356', 'Wah Yan Hong Kong', 'wah yan hong kong', 'manual'),
    ('SCH-00356', 'WYHK', 'wyhk', 'manual'),
    ('SCH-00356', '華仁', '华仁', 'manual'),

    -- SCH-00114: Wah Yan College, Kowloon (九龍華仁書院)
    ('SCH-00114', '九龍華仁書院', '九龙华仁书院', 'manual'),
    ('SCH-00114', '九龍華仁', '九龙华仁', 'manual'),
    ('SCH-00114', 'Wah Yan Kowloon', 'wah yan kowloon', 'manual'),
    ('SCH-00114', 'WYK', 'wyk', 'manual'),
    ('SCH-00114', '九華', '九华', 'manual'),

    -- SCH-00286: St. Louis School (聖類斯中學)
    ('SCH-00286', '聖類斯中學', '圣类斯中学', 'manual'),
    ('SCH-00286', '聖類斯', '圣类斯', 'manual'),
    ('SCH-00286', 'St. Louis', 'st louis', 'manual'),
    ('SCH-00286', 'St. Louis School', 'st louis school', 'manual'),
    ('SCH-00286', '類斯', '类斯', 'manual'),

    -- SCH-00400: Ying Wa Girls' School (英華女學校)
    ('SCH-00400', '英華女學校', '英华女学校', 'manual'),
    ('SCH-00400', '英華女校', '英华女校', 'manual'),
    ('SCH-00400', 'YWGS', 'ywgs', 'manual'),
    ('SCH-00400', '英華', '英華', 'manual'),
    ('SCH-00400', 'Girls'' Ying Wa', 'girls ying wa', 'manual'),

    -- SCH-00401: Ying Wa College (英華書院)
    ('SCH-00401', '英華書院', '英华书院', 'manual'),
    ('SCH-00401', '英華', '英華', 'manual'),
    ('SCH-00401', 'Ying Wa', 'ying wa', 'manual'),
    ('SCH-00401', 'Ying Wa College', 'ying wa college', 'manual'),
    ('SCH-00401', '英華書院', '英华书院', 'manual'),

    -- SCH-00117: Queen's College (皇仁書院)
    ('SCH-00117', '皇仁書院', '皇仁书院', 'manual'),
    ('SCH-00117', '皇仁', '皇仁', 'manual'),
    ('SCH-00117', 'Queen''s College', 'queens college', 'manual'),
    ('SCH-00117', 'Queens', 'queens', 'manual'),
    ('SCH-00117', 'Queen College', 'queen college', 'manual'),

    -- SCH-00396: Queen Elizabeth School (伊利沙伯中學)
    ('SCH-00396', '伊利沙伯中學', '伊利沙伯中学', 'manual'),
    ('SCH-00396', '伊利沙伯', '伊利沙伯', 'manual'),
    ('SCH-00396', 'Queen Elizabeth', 'queen elizabeth', 'manual'),
    ('SCH-00396', 'QES', 'qes', 'manual'),
    ('SCH-00396', '伊中', '伊中', 'manual'),

    -- SCH-00296: St. Stephen's Girls' College (聖士提反女子中學)
    ('SCH-00296', '聖士提反女子中學', '圣士提反女子中学', 'manual'),
    ('SCH-00296', '聖士提反', '圣士提反', 'manual'),
    ('SCH-00296', 'St. Stephen''s Girls', 'st stephens girls', 'manual'),
    ('SCH-00296', 'SSG', 'ssg', 'manual'),
    ('SCH-00296', '士提反', '士提反', 'manual'),

    -- SCH-00297: St. Stephen's College (聖士提反書院)
    ('SCH-00297', '聖士提反書院', '圣士提反书院', 'manual'),
    ('SCH-00297', '聖士提反書院', '圣士提反书院', 'manual'),
    ('SCH-00297', 'St. Stephen''s College', 'st stephens college', 'manual'),
    ('SCH-00297', 'SSC', 'ssc', 'manual'),
    ('SCH-00297', '士提反書院', '士提反书院', 'manual'),

    -- SCH-00288: St. Mark's School (聖馬可中學)
    ('SCH-00288', '聖馬可中學', '圣马可中学', 'manual'),
    ('SCH-00288', '聖馬可', '圣马可', 'manual'),
    ('SCH-00288', 'St. Mark''s', 'st marks', 'manual'),
    ('SCH-00288', 'SMS', 'sms', 'manual'),
    ('SCH-00288', '馬可', '马可', 'manual'),

    -- SCH-00150: Baptist Lui Ming Choi Secondary School (浸信會呂明才中學)
    ('SCH-00150', '浸信會呂明才中學', '浸信会吕明才中学', 'manual'),
    ('SCH-00150', '呂明才', '吕明才', 'manual'),
    ('SCH-00150', 'Baptist Lui Ming Choi', 'baptist lui ming choi', 'manual'),
    ('SCH-00150', 'BLMC', 'blmc', 'manual'),
    ('SCH-00150', '浸呂', '浸吕', 'manual'),

    -- SCH-00152: King Ling College (景嶺書院)
    ('SCH-00152', '景嶺書院', '景岭书院', 'manual'),
    ('SCH-00152', '景嶺', '景岭', 'manual'),
    ('SCH-00152', 'King Ling', 'king ling', 'manual'),
    ('SCH-00152', 'KLC', 'klc', 'manual'),
    ('SCH-00152', '景嶺中學', '景岭中学', 'manual'),

    -- SCH-00363: Pui Ching Middle School (拔萃女書院)
    ('SCH-00363', '拔萃女書院', '拔萃女书院', 'manual'),
    ('SCH-00363', '拔萃女', '拔萃女', 'manual'),
    ('SCH-00363', 'Pui Ching', 'pui ching', 'manual'),
    ('SCH-00363', 'PCM', 'pcm', 'manual'),
    ('SCH-00363', '女拔', '女拔', 'manual'),

    -- SCH-00105: Raimondi College (九龍華仁書院)
    ('SCH-00105', '九龍華仁書院', '九龙华仁书院', 'manual'),
    ('SCH-00105', '九龍華仁', '九龙华仁', 'manual'),
    ('SCH-00105', 'Raimondi', 'raimondi', 'manual'),
    ('SCH-00105', 'Raimondi College', 'raimondi college', 'manual'),
    ('SCH-00105', '九龍華仁', '九龙华仁', 'manual'),

    -- SCH-00343: Heung To Middle School (香島中學)
    ('SCH-00343', '香島中學', '香岛中学', 'manual'),
    ('SCH-00343', '香島', '香岛', 'manual'),
    ('SCH-00343', 'Heung To', 'heung to', 'manual'),
    ('SCH-00343', 'HTMS', 'htms', 'manual'),
    ('SCH-00343', '香島中學', '香岛中学', 'manual'),

    -- SCH-00313: Kiangsu-Chekiang College (蘇浙公學)
    ('SCH-00313', '蘇浙公學', '苏浙公学', 'manual'),
    ('SCH-00313', '蘇浙', '苏浙', 'manual'),
    ('SCH-00313', 'Kiangsu-Chekiang', 'kiangsu-chekiang', 'manual'),
    ('SCH-00313', 'KCC', 'kcc', 'manual'),
    ('SCH-00313', '蘇浙公學', '苏浙公学', 'manual'),

    -- SCH-00250: Kiangsu-Chekiang College (Shatin) (沙田蘇浙公學)
    ('SCH-00250', '沙田蘇浙公學', '沙田苏浙公学', 'manual'),
    ('SCH-00250', '沙田蘇浙', '沙田苏浙', 'manual'),
    ('SCH-00250', 'Kiangsu-Chekiang Shatin', 'kiangsu-chekiang shatin', 'manual'),
    ('SCH-00250', 'KCCS', 'kccs', 'manual'),
    ('SCH-00250', '沙田蘇浙', '沙田苏浙', 'manual'),

    -- ============================================================
    -- ADDITIONAL POPULAR SCHOOLS
    -- ============================================================

    -- SCH-00038: Chan Sui Ki (La Salle) College
    ('SCH-00038', '陳瑞祺（喇沙）書院', '陈瑞祺喇沙书院', 'manual'),
    ('SCH-00038', '陳瑞祺', '陈瑞祺', 'manual'),
    ('SCH-00038', 'Chan Sui Ki', 'chan sui ki', 'manual'),
    ('SCH-00038', 'CSK', 'csk', 'manual'),
    ('SCH-00038', '陳瑞祺喇沙', '陈瑞祺喇沙', 'manual'),

    -- SCH-00259: St. Paul's Secondary School
    ('SCH-00259', '聖保羅中學', '圣保罗中学', 'manual'),
    ('SCH-00259', '聖保羅中學', '圣保罗中学', 'manual'),
    ('SCH-00259', 'St. Paul''s Secondary', 'st pauls secondary', 'manual'),
    ('SCH-00259', 'SPSS', 'spss', 'manual'),
    ('SCH-00259', '保祿中學', '保禄中学', 'manual'),

    -- SCH-00295: St. Joseph's Anglo-Chinese School
    ('SCH-00295', '聖若瑟英文中學', '圣若瑟英文中学', 'manual'),
    ('SCH-00295', '聖若瑟英文', '圣若瑟英文', 'manual'),
    ('SCH-00295', 'St. Joseph''s Anglo-Chinese', 'st josephs anglo-chinese', 'manual'),
    ('SCH-00295', 'SJACS', 'sjacs', 'manual'),
    ('SCH-00295', '若瑟英文', '若瑟英文', 'manual'),

    -- SCH-00287: St. Rose of Lima's College
    ('SCH-00287', '聖羅撒書院', '圣罗撒书院', 'manual'),
    ('SCH-00287', '聖羅撒', '圣罗撒', 'manual'),
    ('SCH-00287', 'St. Rose of Lima', 'st rose of lima', 'manual'),
    ('SCH-00287', 'SRL', 'srl', 'manual'),
    ('SCH-00287', '羅撒', '罗撒', 'manual'),

    -- SCH-00283: St. Clare's Girls' School
    ('SCH-00283', '聖嘉勒女書院', '圣嘉勒女书院', 'manual'),
    ('SCH-00283', '聖嘉勒', '圣嘉勒', 'manual'),
    ('SCH-00283', 'St. Clare''s', 'st clares', 'manual'),
    ('SCH-00283', 'SCGS', 'scgs', 'manual'),
    ('SCH-00283', '嘉勒', '嘉勒', 'manual'),

    -- SCH-00285: St. Catharine's School for Girls
    ('SCH-00285', '聖傑靈女子中學', '圣杰灵女子中学', 'manual'),
    ('SCH-00285', '聖傑灵', '圣杰灵', 'manual'),
    ('SCH-00285', 'St. Catharine''s', 'st catharines', 'manual'),
    ('SCH-00285', 'SCGS', 'scgs', 'manual'),
    ('SCH-00285', '傑靈', '杰灵', 'manual'),

    -- SCH-00292: Immaculate Heart of Mary College
    ('SCH-00292', '聖母無玷聖心書院', '圣母无玷圣心书院', 'manual'),
    ('SCH-00292', '聖母無玷', '圣母无玷', 'manual'),
    ('SCH-00292', 'Immaculate Heart of Mary', 'immaculate heart of mary', 'manual'),
    ('SCH-00292', 'IHMC', 'ihmc', 'manual'),
    ('SCH-00292', '聖心', '圣心', 'manual'),

    -- SCH-00264: St. Francis Xavier's College
    ('SCH-00264', '聖方濟各書院', '圣方济各书院', 'manual'),
    ('SCH-00264', '聖方濟各', '圣方济各', 'manual'),
    ('SCH-00264', 'St. Francis Xavier', 'st francis xavier', 'manual'),
    ('SCH-00264', 'SFXC', 'sfxc', 'manual'),
    ('SCH-00264', '方濟各', '方济各', 'manual'),

    -- SCH-00206: Munsang College
    ('SCH-00206', '民生書院', '民生书院', 'manual'),
    ('SCH-00206', '民生', '民生', 'manual'),
    ('SCH-00206', 'Munsang', 'munsang', 'manual'),
    ('SCH-00206', 'MSC', 'msc', 'manual'),
    ('SCH-00206', '民生中學', '民生中学', 'manual'),

    -- SCH-00199: Marymount Secondary School
    ('SCH-00199', '瑪利諾中學', '玛利诺中学', 'manual'),
    ('SCH-00199', '瑪利諾', '玛利诺', 'manual'),
    ('SCH-00199', 'Marymount', 'marymount', 'manual'),
    ('SCH-00199', 'MSS', 'mss', 'manual'),
    ('SCH-00199', '瑪利諾中學', '玛利诺中学', 'manual'),

    -- SCH-00201: Maryknoll Convent School (Secondary Section)
    ('SCH-00201', '瑪利諾修院學校', '玛利诺修院学校', 'manual'),
    ('SCH-00201', '瑪利諾修院', '玛利诺修院', 'manual'),
    ('SCH-00201', 'Maryknoll Convent', 'maryknoll convent', 'manual'),
    ('SCH-00201', 'MCS', 'mcs', 'manual'),
    ('SCH-00201', '瑪利諾', '玛利诺', 'manual'),

    -- SCH-00200: Maryknoll Fathers' School
    ('SCH-00200', '瑪利諾神父書院', '玛利诺神父书院', 'manual'),
    ('SCH-00200', '瑪利諾神父', '玛利诺神父', 'manual'),
    ('SCH-00200', 'Maryknoll Fathers', 'maryknoll fathers', 'manual'),
    ('SCH-00200', 'MFS', 'mfs', 'manual'),
    ('SCH-00200', '瑪利諾神父', '玛利诺神父', 'manual'),

    -- SCH-00100: Munsang College (Hong Kong Island)
    ('SCH-00100', '民生書院（香港）', '民生书院香港', 'manual'),
    ('SCH-00100', '民生香港', '民生香港', 'manual'),
    ('SCH-00100', 'Munsang HK', 'munsang hk', 'manual'),
    ('SCH-00100', 'MSHK', 'mshk', 'manual'),
    ('SCH-00100', '民生書院香港', '民生书院香港', 'manual'),

    -- SCH-00099: HKUGA College
    ('SCH-00099', '港大同學會書院', '港大同学会书院', 'manual'),
    ('SCH-00099', '港大同學', '港大同学', 'manual'),
    ('SCH-00099', 'HKUGA', 'hkuga', 'manual'),
    ('SCH-00099', 'HKUGA College', 'hkuga college', 'manual'),
    ('SCH-00099', '港大附中', '港大附中', 'manual'),

    -- SCH-00225: Creative Secondary School
    ('SCH-00225', '啟思中學', '启思中学', 'manual'),
    ('SCH-00225', '啟思', '启思', 'manual'),
    ('SCH-00225', 'Creative Secondary', 'creative secondary', 'manual'),
    ('SCH-00225', 'CSS', 'css', 'manual'),
    ('SCH-00225', '啟思中學', '启思中学', 'manual'),

    -- SCH-00351: HKMA David Li Kwok Po College
    ('SCH-00351', '香港管理專業發展協會李國寶中學', '香港管理专业发展协会李国宝中学', 'manual'),
    ('SCH-00351', '李國寶中學', '李国宝中学', 'manual'),
    ('SCH-00351', 'HKMA David Li', 'hkma david li', 'manual'),
    ('SCH-00351', 'DLKP', 'dlkp', 'manual'),
    ('SCH-00351', '李國寶', '李国宝', 'manual'),

    -- SCH-00359: HKBU Affiliated School Wong Kam Fai Secondary & Primary School
    ('SCH-00359', '香港浸會大學附屬學校王錦輝中小學', '香港浸会大学附属学校王锦辉中小学', 'manual'),
    ('SCH-00359', '王錦輝中學', '王锦辉中学', 'manual'),
    ('SCH-00359', 'HKBU Affiliated', 'hkbu affiliated', 'manual'),
    ('SCH-00359', 'WKF', 'wkf', 'manual'),
    ('SCH-00359', '王錦輝', '王锦辉', 'manual'),

    -- SCH-00364: HKFYG Lee Shau Kee College
    ('SCH-00364', '香港青年協會李兆基書院', '香港青年协会李兆基书院', 'manual'),
    ('SCH-00364', '李兆基書院', '李兆基书院', 'manual'),
    ('SCH-00364', 'HKFYG Lee Shau Kee', 'hkfyg lee shau kee', 'manual'),
    ('SCH-00364', 'LSK', 'lsk', 'manual'),
    ('SCH-00364', '李兆基', '李兆基', 'manual'),

    -- SCH-00370: HKICC Lee Shau Kee School of Creativity
    ('SCH-00370', '香港兆基創意書院', '香港兆基创意书院', 'manual'),
    ('SCH-00370', '兆基創意', '兆基创意', 'manual'),
    ('SCH-00370', 'HKICC', 'hkicc', 'manual'),
    ('SCH-00370', 'HKICC Lee Shau Kee', 'hkicc lee shau kee', 'manual'),
    ('SCH-00370', '創意書院', '创意书院', 'manual'),

    -- SCH-00391: New Asia Middle School
    ('SCH-00391', '新亞中學', '新亚中学', 'manual'),
    ('SCH-00391', '新亞', '新亚', 'manual'),
    ('SCH-00391', 'New Asia', 'new asia', 'manual'),
    ('SCH-00391', 'NAM', 'nam', 'manual'),
    ('SCH-00391', '新亞中學', '新亚中学', 'manual'),

    -- SCH-00393: Christian Alliance College
    ('SCH-00393', '宣道中學', '宣道中学', 'manual'),
    ('SCH-00393', '宣道', '宣道', 'manual'),
    ('SCH-00393', 'Christian Alliance', 'christian alliance', 'manual'),
    ('SCH-00393', 'CAC', 'cac', 'manual'),
    ('SCH-00393', '宣道中學', '宣道中学', 'manual'),

    -- SCH-00395: Methodist College
    ('SCH-00395', '衛理中學', '卫理中学', 'manual'),
    ('SCH-00395', '衛理', '卫理', 'manual'),
    ('SCH-00395', 'Methodist', 'methodist', 'manual'),
    ('SCH-00395', 'MC', 'mc', 'manual'),
    ('SCH-00395', '衛理中學', '卫理中学', 'manual'),

    -- SCH-00403: G.T. (Ellen Yeung) College
    ('SCH-00403', '育才中學（楊殷有娣）', '育才中学杨殷有娣', 'manual'),
    ('SCH-00403', '育才中學', '育才中学', 'manual'),
    ('SCH-00403', 'G.T. College', 'gt college', 'manual'),
    ('SCH-00403', 'Ellen Yeung', 'ellen yeung', 'manual'),
    ('SCH-00403', '育才', '育才', 'manual'),

    -- SCH-00411: Chong Gene Hang College
    ('SCH-00411', '創知中學', '创知中学', 'manual'),
    ('SCH-00411', '創知', '创知', 'manual'),
    ('SCH-00411', 'Chong Gene Hang', 'chong gene hang', 'manual'),
    ('SCH-00411', 'CGH', 'cgh', 'manual'),
    ('SCH-00411', '創知中學', '创知中学', 'manual'),

    -- SCH-00412: Cheung Chuk Shan College
    ('SCH-00412', '張祝珊英文中學', '张祝珊英文中学', 'manual'),
    ('SCH-00412', '張祝珊', '张祝珊', 'manual'),
    ('SCH-00412', 'Cheung Chuk Shan', 'cheung chuk shan', 'manual'),
    ('SCH-00412', 'CCSC', 'ccsc', 'manual'),
    ('SCH-00412', '張祝珊英文', '张祝珊英文', 'manual'),

    -- SCH-00413: Chiu Lut Sau Memorial Secondary School
    ('SCH-00413', '趙聿修紀念中學', '赵聿修纪念中学', 'manual'),
    ('SCH-00413', '趙聿修', '赵聿修', 'manual'),
    ('SCH-00413', 'Chiu Lut Sau', 'chiu lut sau', 'manual'),
    ('SCH-00413', 'CLSM', 'clsm', 'manual'),
    ('SCH-00413', '聿修', '聿修', 'manual'),

    -- SCH-00414: True Light Girls' College
    ('SCH-00414', '真光女書院', '真光女书院', 'manual'),
    ('SCH-00414', '真光女', '真光女', 'manual'),
    ('SCH-00414', 'True Light Girls', 'true light girls', 'manual'),
    ('SCH-00414', 'TLG', 'tlg', 'manual'),
    ('SCH-00414', '真光女校', '真光女校', 'manual'),

    -- SCH-00415: CNEC Christian College
    ('SCH-00415', '中華傳道會紀中學', '中华传道会纪中学', 'manual'),
    ('SCH-00415', '中華傳道會', '中华传道会', 'manual'),
    ('SCH-00415', 'CNEC', 'cnec', 'manual'),
    ('SCH-00415', 'CNEC Christian', 'cnec christian', 'manual'),
    ('SCH-00415', '傳道會', '传道会', 'manual'),

    -- SCH-00438: The Chinese Foundation Secondary School
    ('SCH-00438', '中華基金中學', '中华基金中学', 'manual'),
    ('SCH-00438', '中華基金', '中华基金', 'manual'),
    ('SCH-00438', 'Chinese Foundation', 'chinese foundation', 'manual'),
    ('SCH-00438', 'CFS', 'cfs', 'manual'),
    ('SCH-00438', '中華基金中學', '中华基金中学', 'manual')
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify count
SELECT COUNT(*) AS total_aliases FROM memory.school_alias;
SELECT COUNT(DISTINCT school_id) AS schools_with_aliases FROM memory.school_alias;

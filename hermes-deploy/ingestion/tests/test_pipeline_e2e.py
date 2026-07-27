# Tests: Full Pipeline End-to-End
# Verifies raw → normalize → entity → attributes pipeline with fixture data.

import json
import pytest
from unittest.mock import patch, MagicMock

from normalizer import normalize_row
from entity_resolver import resolve, _detect_language
from downloader import parse_csv_rows, compute_checksum


# Fixture: a minimal 5-school CSV with realistic data
FIXTURE_CSV = """district,school_name,school_address,school_tel,school_website,school_email,school_fax,,principal_name,school_supervisor,year_founded,school_sponsoring_body_type,school_mission_and_character,school_type,student_gender,school_size,school_area_sqm,pta_name,sponsoring_body,religion,pta_chairman,student_union_president,classes_s1,classes_s2,classes_s3,classes_s4,classes_s5,classes_s6,teacher_count,teacher_qualification_master_percent,teacher_qualification_bachelor_percent,teacher_experience_0_4y_percent,teacher_experience_5_9y_percent,teacher_experience_10plus_percent,teacher_qualification_special_education_percent,subjects_s1_s3_chinese,subjects_s1_s3_english,subjects_s1_s3_others,subjects_s4_s6_chinese,subjects_s4_s6_english,subjects_s4_s6_others,elective_subjects_s4_s6_chinese,elective_subjects_s4_s6_english,elective_subjects_s4_s6_others,applied_learning_s4_s6_chinese,applied_learning_s4_s6_english,applied_learning_s4_s6_others,total_classes,moi_s1,moi_s2,moi_s3,moi_s4,moi_s5,fees_s1,fees_s2,fees_s3,fees_s4,fees_s5,fees_s6,facility_library,facility_school_hall,facility_playground,facility_stem_room,facility_self_study_room,facility_career_resource_room,facility_student_activity_room,facility_music_room,facility_art_room,facility_computer_room,facility_home_economics_room,facility_design_technology_room,facility_visual_arts_room,facility_language_room,facility_geography_room,facility_science_laboratory,facility_biology_laboratory,facility_chemistry_laboratory,facility_physics_laboratory,language_policy,learning_and_teaching_strategies,school_based_curriculum,four_key_tasks,life_wide_learning,gifted_education,career_guidance,student_support,whole_person_development,healthy_school_policy,extracurricular_activities,school_ethos,parent_teacher_association,alumni_association,school_based_after_school_programme,school_assembly,moral_civic_education,religious_activities,class_teacher_period,other_learning_experiences,student_award_scheme,subject_week,exchange_programmes,study_tours,school_sports_days,swimming_gala
Kowloon City,Diocesan Boys' School,"131 Argyle Street, Kowloon",27115191,https://www.dbs.edu.hk,office@dbs.edu.hk,27110832,,Mr. Cheng,Mr. Cheng,1869,Sheng Kung Hui,To provide a liberal education based on Christian principles,DSS,Boys,6000,10000,DBS PTA,Sheng Kung Hui,Christian,Mr. Chan,,5,5,5,5,5,5,95,45,98,20,30,50,15,"Chinese; Chinese History; Putonghua","English Language; Mathematics; Science","French; Japanese","Chinese; Chinese History; Liberal Studies","English Language; Mathematics; Biology; Chemistry; Physics","French; Japanese","","Economics; BAFS; ICT","","","",30,English,English,English,English,English,52500,52500,52500,52500,52500,52500,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,No,No,Yes,Yes,Yes,Yes,Yes,Yes,Yes,English as medium of instruction,Student-centered learning approach,School-based curriculum development,Reading and writing across curriculum,Life-wide learning activities,"Gifted education program for high achievers",Career guidance and counseling,Student support team in place,Whole-person development emphasis,Healthy school policy in place,"Sports; Music; Drama; Debate","Christian ethos with emphasis on moral education",Active PTA,Active alumni network,After-school enrichment programs,Weekly school assembly,"Moral and civic education integrated","Christian fellowship and worship",Class teacher period daily,"Community service; Leadership training","Academic achievement awards",Subject week activities,"Exchange programs with overseas schools","Study tours to mainland China and abroad",Annual sports days,Annual swimming gala
Central & Western,King's College,"63A Bonham Road, Hong Kong",25470310,https://www.kings.edu.hk,office@kings.edu.hk,25470732,,Dr. Tang,Dr. Tang,1926,Government,To provide quality education,Government,Boys,4000,8000,KC PTA,,Christian,,,,4,4,4,4,4,4,72,50,98,15,25,60,20,"Chinese; Chinese History","English Language; Mathematics","Putonghua","Chinese; Chinese History; Citizenship","English Language; Mathematics; Biology; Chemistry; Physics; Economics","","","","","","",24,English,English,English,English,English,0,0,0,0,0,0,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,No,No,Yes,Yes,Yes,Yes,Yes,Yes,Yes,English as medium of instruction,Traditional academic approach with modern methods,Strong liberal arts curriculum,Reading program,"Life-wide learning emphasis","Gifted education support",Career counseling available,Student support services,Whole-person development focus,Health education program,"Music; Sports; Debate; Community Service","Strong tradition of academic excellence",Active PTA,Strong alumni association,After-school tutoring,Weekly assembly,"Moral education emphasis",Christian fellowship,Class teacher system,"Community service opportunities","Scholarships and awards",Subject enrichment weeks,"International exchange programs","Cultural exchange programs",Annual sports day,Annual swimming competition
Sha Tin,Shatin College,"3 Lai Wo Lane, Sha Tin",26991811,https://www.shatincollege.edu.hk,info@shatincollege.edu.hk,26991810,,Ms. Lee,Ms. Lee,1982,ESF,Academic excellence and personal growth,Private,Co-ed,3000,12000,STC PTA,ESF,,,,5,5,5,5,5,5,85,50,98,25,35,40,10,"Chinese","English Language; Mathematics; Science; Humanities","French; Spanish","Chinese","English Language; Mathematics; Biology; Chemistry; Physics; Economics; History; Geography","French; Spanish","","Business; Computer Science; Art","","","",30,English,English,English,English,English,85000,85000,85000,85000,85000,85000,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,English only policy,IB Middle Years Programme,IB curriculum framework,Interdisciplinary learning,"Extensive CAS program","Gifted and talented program",University and career counseling,Student support services,Holistic development,Healthy living program,"Sports; Music; Drama; Model UN; Robotics","International school ethos",Active PTA,Active alumni,Enrichment programs,Assemblies,Global citizenship,Multi-faith activities,Advisory system,"CAS activities across all areas","IB learner profile awards",Interdisciplinary units,"Global exchange programs","International trips and expeditions",Sports day,Swimming sports
Wan Chai,Marymount Secondary School,"123 Blue Pool Road, Happy Valley",25728221,https://www.marymount.edu.hk,office@marymount.edu.hk,25728222,,Sr. Chan,Sr. Chan,1927,Catholic Mission,Marymount education based on Catholic values,Aided,Girls,3500,9000,MM PTA,Catholic Mission,Catholic,,,,4,4,4,4,4,4,68,48,97,20,30,50,12,"Chinese; Chinese History","English Language; Mathematics; Science","French","Chinese; Chinese History; Liberal Studies","English Language; Mathematics; Biology; Chemistry; Physics; Economics","French","","BAFS; Visual Arts","","","",24,English,English,English,English,English,0,0,0,0,0,0,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,No,No,Yes,Yes,Yes,Yes,Yes,Yes,No,English as medium of instruction,Student-centered learning,Values-based curriculum,Critical thinking emphasis,"Service learning program","Gifted education support",Career guidance services,Student support network,Whole-person development,Healthy school initiative,"Sports; Music; Dance; Community Service","Catholic values and traditions",Active PTA,Strong alumnae network,After-school programs,Weekly assembly,"Values education",Religious activities and mass,Class teacher period,"Service learning; Leadership","Academic and conduct awards",Subject-based activities,"Exchange programs","Cultural and educational tours",Annual sports day,Annual swimming gala
Yuen Long,CCC Kei Yuen College,"1 Fung Cheung Road, Yuen Long",24757111,https://www.kyc.edu.hk,info@kyc.edu.hk,24757112,,Mr. Wong,Wong,1992,CCC,Christian education with academic rigor,Aided,Co-ed,2500,7000,KYC PTA,CCC,Christian,,,,5,5,5,5,5,5,62,42,95,22,32,46,14,"Chinese; Chinese History; Putonghua","English Language; Mathematics; Science","","Chinese; Chinese History; Citizenship","English Language; Mathematics; Biology; Chemistry; Economics","","","BAFS; ICT; Tourism","","","",30,Chinese,Chinese,English,English,English,0,0,0,0,0,0,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,Yes,No,No,No,Yes,Yes,Yes,Yes,No,No,Chinese as medium of instruction with English emphasis,Activity-based learning,School-based curriculum,Biliteracy and trilingualism,"Life-wide learning","Gifted education program",Career counseling,Student support available,Character development,Health education,"Sports; Music; Volleyball; IT Club","Christian character building",Active PTA,Alumni association,After-school tutorial,Weekly assembly,"Moral and civic education",Christian fellowship,Class teacher system,"Community service","Academic improvement awards",Language week activities,"Mainland exchange programs","Study tours",Sports day,Swimming meet
"""


class TestCSVParsing:
    def test_parse_5_schools(self):
        rows = parse_csv_rows(FIXTURE_CSV.encode("utf-8"))
        assert len(rows) == 5

    def test_districts_match(self):
        rows = parse_csv_rows(FIXTURE_CSV.encode("utf-8"))
        districts = [r.get("district", "") for r in rows]
        assert "Kowloon City" in districts
        assert "Central & Western" in districts
        assert "Sha Tin" in districts
        assert "Wan Chai" in districts
        assert "Yuen Long" in districts

    def test_checksum_stable(self):
        checksum1 = compute_checksum(FIXTURE_CSV.encode("utf-8"))
        checksum2 = compute_checksum(FIXTURE_CSV.encode("utf-8"))
        assert checksum1 == checksum2
        assert len(checksum1) == 64  # SHA256


class TestNormalizeAll:
    def test_all_5_normalize_without_error(self):
        rows = parse_csv_rows(FIXTURE_CSV.encode("utf-8"))
        for row in rows:
            entity, attrs = normalize_row(row)
            assert entity["canonical_name"], f"Empty name for row: {row.get('1', 'unknown')}"
            assert entity["district"], f"Empty district for {entity['canonical_name']}"
            assert len(attrs) > 0, f"No attributes for {entity['canonical_name']}"

    def test_school_types_correct(self):
        rows = parse_csv_rows(FIXTURE_CSV.encode("utf-8"))
        types = []
        for row in rows:
            entity, _ = normalize_row(row)
            types.append(entity["school_type"])
        assert "DSS" in types
        assert "Government" in types
        assert "Private" in types
        assert "Aided" in types

    def test_fees_range(self):
        rows = parse_csv_rows(FIXTURE_CSV.encode("utf-8"))
        fees = []
        for row in rows:
            _, attrs = normalize_row(row)
            for a in attrs:
                if a.attr_key == "fees_s1":
                    fees.append(int(a.attr_value))
        assert 0 in fees       # Government/Aided schools
        assert 52500 in fees   # DSS
        assert 85000 in fees   # Private/ESF

    def test_academic_signals_present_on_all(self):
        rows = parse_csv_rows(FIXTURE_CSV.encode("utf-8"))
        for row in rows:
            _, attrs = normalize_row(row)
            signal_count = sum(1 for a in attrs if a.attr_key.startswith("academic_signal_"))
            assert signal_count == 3, f"Expected 3 academic signals, got {signal_count}"


class TestEntityResolutionEndToEnd:
    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_duplicate_names_resolve_same(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        mock_next_id.return_value = "SCH-00001"
        mock_alias.return_value = None

        # First call: new entity
        mock_lookup.return_value = None
        sid1, is_new1 = resolve("St Pauls Co Ed", "en", "CHSC")

        # Second call: same normalized name
        mock_lookup.return_value = "SCH-00001"
        sid2, is_new2 = resolve("St. Paul's Co-Ed.", "en", "CHSC")

        assert sid1 == "SCH-00001"
        assert sid2 == "SCH-00001"
        assert is_new1 is True
        assert is_new2 is False

    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_different_districts_different_entities(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        mock_alias.return_value = None
        mock_next_id.side_effect = ["SCH-00001", "SCH-00002"]

        # School A
        mock_lookup.return_value = None
        sid1, _ = resolve("St Pauls Primary School Kowloon", "en", "CHSC")

        # School B — same name pattern but actually different school
        mock_lookup.return_value = None
        sid2, _ = resolve("St Pauls Primary School Hong Kong Island", "en", "CHSC")

        # Different names → different IDs if lookup returns None for both
        assert sid1 != sid2

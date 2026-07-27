# Education Engine — HK Domain Constants
# Hong Kong K-12 school system reference data

# 18 districts
HK_DISTRICTS = [
    "Central and Western", "Eastern", "Islands", "Kowloon City",
    "Kwai Tsing", "Kwun Tong", "North", "Sai Kung",
    "Sha Tin", "Sham Shui Po", "Southern", "Tai Po",
    "Tsuen Wan", "Tuen Mun", "Wan Chai", "Wong Tai Sin",
    "Yau Tsim Mong", "Yuen Long",
]

# School banding (Band 1 = top academic, Band 3 = lowest)
SCHOOL_BANDS = ["Band 1", "Band 2", "Band 3"]

# School types
SCHOOL_TYPES = [
    "government", "aided", "direct_subsidy_scheme", "private", "international",
]

# Education levels
LEVELS = ["kindergarten", "primary", "secondary"]

# Language of instruction
LANGUAGES = ["chinese", "english", "bilingual"]

# Gender policy
GENDER_POLICIES = ["co_ed", "boys_only", "girls_only"]

# Religious affiliations common in HK
RELIGIONS = [
    "catholic", "protestant", "buddhist", "taoist", "muslim", "none",
]

# Evaluation criteria for school matching
DEFAULT_CRITERIA = [
    "academic_performance",
    "language_of_instruction",
    "location_proximity",
    "religious_affiliation",
    "school_fees",
    "extracurricular_activities",
    "school_facilities",
    "teacher_student_ratio",
    "university_admission_rate",
]

# Family profile fields
FAMILY_PROFILE_FIELDS = [
    "preferred_districts",
    "max_annual_fee",
    "preferred_language",
    "religious_preference",
    "commute_tolerance_minutes",
    "has_siblings_in_school",
    "sibling_school_ids",
]

# Child profile fields
CHILD_PROFILE_FIELDS = [
    "age",
    "grade_level",
    "academic_level",
    "language_strength",
    "special_needs",
    "extracurricular_interests",
    "personality_type",
    "target_band",
    "gender",
]

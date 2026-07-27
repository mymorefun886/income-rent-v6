# School Network Data Template

## Overview

This template defines the data structure for Hong Kong school admission networks.
Two tables need to be populated:

1. **school_network**: Maps primary schools to secondary school nets
2. **secondary_network_school**: Maps secondary nets to secondary schools

---

## Table 1: school_network

**Purpose**: Maps a primary school to the secondary school nets it feeds into.

**Columns**:
| Column | Type | Description | Example |
|--------|------|-------------|---------|
| primary_school_id | VARCHAR(20) | CHSC school ID | SCH-00123 |
| secondary_net | VARCHAR(50) | Secondary school net identifier | K3 |
| district | VARCHAR(100) | District name | Kowloon City |
| allocation_year | VARCHAR(20) | Academic year | 2025_2026 |
| source | VARCHAR(100) | Data source | EDB_2025 |
| confidence | FLOAT | Data confidence | 1.0 |

**Sample Data**:
```csv
primary_school_id,secondary_net,district,allocation_year,source,confidence
SCH-00123,K3,Kowloon City,2025_2026,EDB_2025,1.0
SCH-00124,K3,Kowloon City,2025_2026,EDB_2025,1.0
SCH-00125,K2,Kowloon City,2025_2026,EDB_2025,1.0
```

---

## Table 2: secondary_network_school

**Purpose**: Maps a secondary school net to the secondary schools within it.

**Columns**:
| Column | Type | Description | Example |
|--------|------|-------------|---------|
| secondary_net | VARCHAR(50) | Secondary school net identifier | K3 |
| secondary_school_id | VARCHAR(20) | CHSC school ID | SCH-00456 |
| allocation_year | VARCHAR(20) | Academic year | 2025_2026 |
| priority | INTEGER | Allocation priority (1=highest) | 1 |
| source | VARCHAR(100) | Data source | EDB_2025 |
| confidence | FLOAT | Data confidence | 1.0 |

**Sample Data**:
```csv
secondary_net,secondary_school_id,allocation_year,priority,source,confidence
K3,SCH-00456,2025_2026,1,EDB_2025,1.0
K3,SCH-00457,2025_2026,2,EDB_2025,1.0
K3,SCH-00458,2025_2026,3,EDB_2025,1.0
K2,SCH-00459,2025_2026,1,EDB_2025,1.0
```

---

## Secondary School Nets by District

### Primary School Nets (小學學校網)

| District | Net Numbers |
|----------|-------------|
| Central and Western | 11, 12 |
| Wan Chai | 12 |
| Eastern | 14, 15, 16 |
| Southern | 18 |
| Yau Tsim Mong | 31, 32 |
| Sham Shui Po | 34, 35 |
| Kowloon City | 34, 35, 41 |
| Wong Tai Sin | 43, 45 |
| Kwun Tong | 46, 48 |
| Kwai Tsing | 64, 65 |
| Tsuen Wan | 64, 65 |
| Tuen Mun | 69, 70 |
| Yuen Long | 72, 73, 74 |
| North | 80, 81 |
| Tai Po | 84, 85 |
| Sai Kung | 95 |
| Islands | 98, 99 |

### Secondary School Nets (中學學校網)

| District | Net Numbers |
|----------|-------------|
| Central and Western | 1 |
| Wan Chai | 1 |
| Eastern | 1 |
| Southern | 1 |
| Yau Tsim Mong | 2 |
| Sham Shui Po | 2 |
| Kowloon City | 3 |
| Wong Tai Sin | 3 |
| Kwun Tong | 3 |
| Kwai Tsing | 4 |
| Tsuen Wan | 4 |
| Tuen Mun | 5 |
| Yuen Long | 5 |
| North | 6 |
| Tai Po | 6 |
| Sai Kung | 7 |
| Islands | 8 |

---

## Data Sources

### Primary Sources
1. **EDB Website**: https://www.edb.gov.hk/en/student-parents/sch-info/sch-search/schlocation.html
2. **Data.gov.hk**: Search for "school net" or "學校網"
3. **CHSC**: Secondary school profiles include net information

### Recommended Approach
1. Download school net data from EDB
2. Map to CHSC school IDs using school names
3. Populate both tables
4. Validate with known school-net relationships

---

## Validation Rules

### Rule 1: School Net Resolution
- Input: Primary school district
- Expected: List of secondary nets
- Test: Kowloon City → [K1, K2, K3]

### Rule 2: Admission Filter
- Input: Secondary net
- Expected: List of schools in that net
- Test: K3 → [DBS, La Salle, ...]

### Rule 3: Cross-district Schools
- Some schools serve multiple districts
- Should appear in multiple nets if applicable

---

## Import Script

Use the following SQL to import from CSV:

```sql
-- Import school_network
COPY memory.school_network(primary_school_id, secondary_net, district, allocation_year, source, confidence)
FROM '/path/to/school_network.csv' DELIMITER ',' CSV HEADER;

-- Import secondary_network_school
COPY memory.secondary_network_school(secondary_net, secondary_school_id, allocation_year, priority, source, confidence)
FROM '/path/to/secondary_network_school.csv' DELIMITER ',' CSV HEADER;
```

---

## Next Steps

1. **Populate school_network**: Map primary schools to secondary nets
2. **Populate secondary_network_school**: Map nets to secondary schools
3. **Validate**: Test with known school-net relationships
4. **Integrate**: Connect to Ranking Engine as Hard Constraint Layer

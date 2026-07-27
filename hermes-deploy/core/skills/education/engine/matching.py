# Education Engine — Constraint-Based School Matching
# Filters schools by hard constraints from query extraction + memory.
# Uses v2 schema fields (district, school_type, student_gender, fees_s1-s6).


def match_schools(schools: list[dict], family, child,
                  query_constraints=None) -> tuple[list[dict], list[str]]:
    """
    Filter schools by hard constraints. Returns (eligible_schools, rejected_reasons).

    Constraint priority:
    1. Query constraints (district, gender, school_type) — HARD filters
    2. Memory-based constraints (fee, language) — HARD filters
    """
    eligible = []
    reasons = []

    for school in schools:
        reject_reasons = []

        # === HARD CONSTRAINTS FROM QUERY EXTRACTION ===
        if query_constraints:
            # District hard filter — must match if specified
            if query_constraints.districts:
                school_district = school.get("district", "")
                if school_district not in query_constraints.districts:
                    reject_reasons.append(
                        f"district: {school_district} not in {query_constraints.districts}")

            # Gender hard filter
            if query_constraints.gender:
                school_gender = school.get("student_gender", "")
                if school_gender != query_constraints.gender:
                    reject_reasons.append(f"gender: school={school_gender}")

            # School type hard filter
            if query_constraints.school_types:
                school_type = school.get("school_type", "")
                if school_type not in query_constraints.school_types:
                    reject_reasons.append(f"type: {school_type}")

        # === PREFERENCE MEMORY CONSTRAINTS (Phase 10.2) ===
        # Filter out schools the parent explicitly rejected
        if query_constraints and query_constraints.avoid_schools:
            school_id = school.get("school_id", "")
            if school_id in query_constraints.avoid_schools:
                reject_reasons.append(f"avoid: parent previously rejected ({school_id})")

        # === MEMORY-BASED CONSTRAINTS (adapted for v2 schema) ===
        # Fee constraint (use fees_s1-s6 from v2 payload)
        if family.max_annual_fee > 0:
            for i in range(1, 7):
                fee = school.get(f"fees_s{i}")
                if fee and fee > family.max_annual_fee:
                    reject_reasons.append(f"fee S{i}: {fee} > {family.max_annual_fee}")
                    break

        # Gender policy check (from child profile)
        child_gender = child.to_dict().get("gender", "")
        school_gender = school.get("student_gender", "")
        if child_gender and school_gender:
            if school_gender == "boys_only" and child_gender != "male":
                reject_reasons.append("boys-only school, child not male")
            elif school_gender == "girls_only" and child_gender != "female":
                reject_reasons.append("girls-only school, child not female")

        if reject_reasons:
            reasons.append(f"{school.get('name', 'unknown')}: {'; '.join(reject_reasons)}")
        else:
            eligible.append(school)

    return eligible, reasons

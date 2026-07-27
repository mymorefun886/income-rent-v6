-- =========================================================================
-- Phase 10.1.9: Database Constraint Migration
-- FREEZE: FK constraints + indexes for trace linkage
--
-- IMPORTANT: This migration is IDEMPOTIENT — safe to run multiple times.
-- All ADD CONSTRAINT use IF NOT EXISTS (via DO block for PostgreSQL).
-- All CREATE INDEX use IF NOT EXISTS.
--
-- Relationship:
--   recommendation_session (parent)
--       ├── recommendation_result (child)
--       ├── recommendation_trace (child)
--       └── recommendation_feedback (child)
--
-- Rule: Feedback is a RESULT, not a trace owner.
-- =========================================================================

-- 1. recommendation_result → recommendation_session
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_result_session'
        AND table_schema = 'memory'
        AND table_name = 'recommendation_result'
    ) THEN
        ALTER TABLE memory.recommendation_result
        ADD CONSTRAINT fk_result_session
        FOREIGN KEY (session_id) REFERENCES memory.recommendation_session(id);
    END IF;
END$$;

-- 2. recommendation_trace → recommendation_session
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_trace_session'
        AND table_schema = 'memory'
        AND table_name = 'recommendation_trace'
    ) THEN
        ALTER TABLE memory.recommendation_trace
        ADD CONSTRAINT fk_trace_session
        FOREIGN KEY (session_id) REFERENCES memory.recommendation_session(id);
    END IF;
END$$;

-- 3. recommendation_feedback → recommendation_session
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_feedback_session'
        AND table_schema = 'memory'
        AND table_name = 'recommendation_feedback'
    ) THEN
        ALTER TABLE memory.recommendation_feedback
        ADD CONSTRAINT fk_feedback_session
        FOREIGN KEY (session_id) REFERENCES memory.recommendation_session(id);
    END IF;
END$$;

-- 4. recommendation_feedback → recommendation_result (optional, if result_id exists)
-- Note: result_id may be NULL for direct feedback without session context
-- So we don't add FK here — application-level validation instead

-- 5. Indexes for trace lookup performance
CREATE INDEX IF NOT EXISTS idx_result_session_id
ON memory.recommendation_result (session_id);

CREATE INDEX IF NOT EXISTS idx_trace_session_id
ON memory.recommendation_trace (session_id);

CREATE INDEX IF NOT EXISTS idx_feedback_session_id
ON memory.recommendation_feedback (session_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
ON memory.recommendation_feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_school_id
ON memory.recommendation_feedback (school_id);

-- 6. Composite index for analytics (Phase 11 Learning)
CREATE INDEX IF NOT EXISTS idx_feedback_user_school
ON memory.recommendation_feedback (user_id, school_id);

-- 7. Verify constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'memory'
    AND tc.table_name IN ('recommendation_result', 'recommendation_trace', 'recommendation_feedback')
ORDER BY tc.table_name;

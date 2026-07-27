-- =========================================================================
-- Phase 10.1.7-D/E: Schema upgrades
-- 1. school_alias: add locale, alias_type, confidence
-- 2. recommendation_feedback: add locale for learning analysis
--
-- IMPORTANT: This migration is IDEMPOTENT — safe to run multiple times.
-- All ALTER TABLE use ADD COLUMN IF NOT EXISTS.
-- All CREATE INDEX use IF NOT EXISTS.
-- =========================================================================

-- 1. Upgrade school_alias table
-- Add locale column (default 'en' for existing rows)
ALTER TABLE memory.school_alias
ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- Add alias_type column (official, short, abbreviation, historical)
ALTER TABLE memory.school_alias
ADD COLUMN IF NOT EXISTS alias_type TEXT NOT NULL DEFAULT 'official';

-- Add confidence column for alias matching priority
ALTER TABLE memory.school_alias
ADD COLUMN IF NOT EXISTS confidence FLOAT NOT NULL DEFAULT 1.0;

-- Update locale for existing Chinese aliases (detected by CJK regex)
-- Idempotent: safe to re-run (only updates rows that match CJK pattern)
UPDATE memory.school_alias
SET locale = 'zh-TW',
    alias_type = CASE
        WHEN alias ~ '書院|中學|小學|學校' THEN 'official'
        WHEN length(alias) <= 3 THEN 'short'
        ELSE 'official'
    END
WHERE alias ~ '一-鿿';

-- Create index for locale-based lookups
CREATE INDEX IF NOT EXISTS idx_school_alias_locale
ON memory.school_alias (school_id, locale);

-- Create index for alias_type filtering
CREATE INDEX IF NOT EXISTS idx_school_alias_type
ON memory.school_alias (alias_type);

-- 2. Upgrade recommendation_feedback table
-- Add locale column for learning analysis (Phase 10.1.7-E)
ALTER TABLE memory.recommendation_feedback
ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'zh-TW';

-- Create index for locale-based analytics
CREATE INDEX IF NOT EXISTS idx_feedback_locale
ON memory.recommendation_feedback (user_id, locale);

-- Verify the changes
SELECT 'school_alias columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'memory' AND table_name = 'school_alias'
ORDER BY ordinal_position;

SELECT 'recommendation_feedback columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'memory' AND table_name = 'recommendation_feedback'
ORDER BY ordinal_position;

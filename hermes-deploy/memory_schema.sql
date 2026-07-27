-- Hermes OS — Memory Schema v1.0
-- Shared memory layer for cross-agent context

CREATE SCHEMA IF NOT EXISTS memory;

-- User profiles: family context, background, roles
CREATE TABLE IF NOT EXISTS memory.user_profile (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    key VARCHAR(128) NOT NULL,
    value TEXT NOT NULL,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- Preferences: long-term preferences across domains
CREATE TABLE IF NOT EXISTS memory.preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    domain VARCHAR(64) NOT NULL,
    key VARCHAR(128) NOT NULL,
    value TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    source VARCHAR(64) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, domain, key)
);

-- Events: timeline of interactions and decisions
CREATE TABLE IF NOT EXISTS memory.events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    event_type VARCHAR(64) NOT NULL,
    domain VARCHAR(64) DEFAULT 'general',
    summary TEXT NOT NULL,
    detail JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decisions: important AI-assisted decisions with rationale
CREATE TABLE IF NOT EXISTS memory.decisions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default',
    domain VARCHAR(64) NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT,
    alternatives JSONB DEFAULT '[]',
    outcome JSONB DEFAULT '{}',
    decided_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON memory.user_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user_domain ON memory.preferences(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON memory.events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_domain ON memory.events(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_decisions_user_domain ON memory.decisions(user_id, domain);

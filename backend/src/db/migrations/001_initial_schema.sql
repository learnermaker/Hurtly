-- BodyTrace Initial Schema Migration
-- Creates all core tables with foreign keys, indexes, and timestamp defaults.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAIN_SESSIONS
-- ============================================================
CREATE TABLE pain_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(50) NOT NULL DEFAULT 'in-progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pain_sessions_user_id ON pain_sessions(user_id);

-- ============================================================
-- PAIN_MARKERS
-- ============================================================
CREATE TABLE pain_markers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES pain_sessions(id) ON DELETE CASCADE,
  region_id   VARCHAR(100) NOT NULL,
  region_name VARCHAR(255) NOT NULL,
  coordinates JSONB       NOT NULL,
  boundary    JSONB,
  intensity   INTEGER     NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
  status      VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pain_markers_session_id ON pain_markers(session_id);

-- ============================================================
-- SYMPTOM_DESCRIPTORS
-- ============================================================
CREATE TABLE symptom_descriptors (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id    UUID        NOT NULL UNIQUE REFERENCES pain_markers(id) ON DELETE CASCADE,
  pain_type    VARCHAR(50) NOT NULL,
  intensity    INTEGER     NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
  frequency    VARCHAR(50) NOT NULL,
  duration     VARCHAR(50) NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FOLLOW_UP_RESPONSES
-- ============================================================
CREATE TABLE follow_up_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  descriptor_id UUID        NOT NULL REFERENCES symptom_descriptors(id) ON DELETE CASCADE,
  question_id   VARCHAR(255) NOT NULL,
  question_text TEXT        NOT NULL,
  response      TEXT        NOT NULL,
  answered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_up_responses_descriptor_id ON follow_up_responses(descriptor_id);

-- ============================================================
-- SYMPTOM_SIGNALS
-- ============================================================
CREATE TABLE symptom_signals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id         UUID        NOT NULL UNIQUE REFERENCES pain_markers(id) ON DELETE CASCADE,
  anatomical_region VARCHAR(255) NOT NULL,
  pain_type         VARCHAR(50) NOT NULL,
  intensity         INTEGER     NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
  frequency         VARCHAR(50) NOT NULL,
  duration          VARCHAR(50) NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_json          JSONB       NOT NULL
);

-- ============================================================
-- BODY_MAPS
-- ============================================================
CREATE TABLE body_maps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_body_maps_user_id ON body_maps(user_id);

-- ============================================================
-- INSIGHT_REPORTS
-- ============================================================
CREATE TABLE insight_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patterns          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  frequency_trends  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  intensity_changes JSONB       NOT NULL DEFAULT '[]'::jsonb,
  disclaimer        TEXT        NOT NULL DEFAULT 'This report is informational and does not constitute medical advice.',
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_reports_user_id ON insight_reports(user_id);

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   UUID,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

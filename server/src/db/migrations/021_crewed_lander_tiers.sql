-- 021_crewed_lander_tiers.sql
-- Milestone 1.6: Progressive 4-Tier Lander Chassis, Embarked Crew State & Casualty/Survival Ledger

ALTER TABLE player_landers
  ADD COLUMN IF NOT EXISTS tier INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS crew_capacity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active_expedition_crew JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Ensure any existing rows have valid tier / capacity
UPDATE player_landers
SET
  tier = COALESCE(NULLIF(tier, 0), 1),
  crew_capacity = GREATEST(1, COALESCE(NULLIF(crew_capacity, 0), 1))
WHERE tier IS NULL OR tier < 1 OR crew_capacity IS NULL OR crew_capacity < 1;

-- Memorial & Survival Outcome Ledger
CREATE TABLE IF NOT EXISTS crew_casualties (
  id VARCHAR(80) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crew_name VARCHAR(128) NOT NULL,
  callsign VARCHAR(32) NOT NULL DEFAULT '',
  rarity VARCHAR(16) NOT NULL,
  specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  aptitude INT NOT NULL DEFAULT 50,
  grit INT NOT NULL DEFAULT 50,
  planet_id VARCHAR(64) NOT NULL,
  planet_name VARCHAR(128) NOT NULL,
  lander_name VARCHAR(64) NOT NULL,
  outcome VARCHAR(32) NOT NULL, -- 'KIA' | 'EJECTED_CASTAWAY'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_casualties_account ON crew_casualties(account_id, created_at DESC);


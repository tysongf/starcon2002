-- 006_apex_titans_and_continuous_expedition.sql
-- Procedural Apex Titans, Anchored Boss Lairs & Continuous Surface Expeditions

ALTER TABLE planet_fauna
  ADD COLUMN IF NOT EXISTS is_apex BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stun_hits_required INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_stun_hits INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_enraged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lair_x NUMERIC(6, 2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS lair_y NUMERIC(6, 2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS lair_name VARCHAR(128) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_planet_fauna_apex ON planet_fauna(planet_id, is_apex);


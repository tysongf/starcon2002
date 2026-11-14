-- 013_hyperspace_interceptions.sql
-- Milestone 0.9 Day 39: Hyperspace Alien Radar Blips, Hunter AI & Tactical Interceptions

-- 1. Add decoys remaining and warp immunity timestamp to ships table
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS decoys_remaining INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS hyperspace_immunity_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Index for rapid lookup of active hyperspace vessels
CREATE INDEX IF NOT EXISTS idx_ships_hyperspace_immunity 
  ON ships(hyperspace_immunity_until) 
  WHERE is_in_hyperspace = TRUE;


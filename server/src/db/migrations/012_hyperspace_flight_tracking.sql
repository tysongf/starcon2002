-- 012_hyperspace_flight_tracking.sql
-- Milestone 0.9 Day 38: Authoritative Real-Time Hyperspace Flight & Fuel Logistics

-- 1. Add hyperspace coordinates and in-flight flag to ships table
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS is_in_hyperspace BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hyperspace_x REAL DEFAULT 500.0,
  ADD COLUMN IF NOT EXISTS hyperspace_y REAL DEFAULT 500.0;

-- 2. Index coordinates for rapid spatial and encounter queries
CREATE INDEX IF NOT EXISTS idx_ships_hyperspace_coords 
  ON ships(hyperspace_x, hyperspace_y) 
  WHERE is_in_hyperspace = TRUE;


-- 017_flagship_hulls_and_workbench.sql
-- Milestone 1.2: 24-Hull Starship Taxonomy, Flagship Promotion & Engineering Workbench

-- 1. Engineering Crafting Currency on Accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS tech_components INT NOT NULL DEFAULT 25 CHECK (tech_components >= 0);

-- 2. Flagship Engineering Budgets, Taxonomy & Variable Slot Layout on Ships
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS flagship_name VARCHAR(128) NOT NULL DEFAULT 'UNS Endeavour',
  ADD COLUMN IF NOT EXISTS main_hull_class VARCHAR(32) NOT NULL DEFAULT 'CORVETTE',
  ADD COLUMN IF NOT EXISTS hull_subtype VARCHAR(64) NOT NULL DEFAULT 'Sol Endeavour Corvette',
  ADD COLUMN IF NOT EXISTS faction_id VARCHAR(32) NOT NULL DEFAULT 'FACTION_SOL',
  ADD COLUMN IF NOT EXISTS power_grid_max NUMERIC(8, 2) NOT NULL DEFAULT 120.0,
  ADD COLUMN IF NOT EXISTS cpu_max NUMERIC(8, 2) NOT NULL DEFAULT 180.0,
  ADD COLUMN IF NOT EXISTS base_speed NUMERIC(6, 2) NOT NULL DEFAULT 60.0,
  ADD COLUMN IF NOT EXISTS base_turn_rate NUMERIC(5, 2) NOT NULL DEFAULT 2.4,
  ADD COLUMN IF NOT EXISTS high_slots INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS mid_slots INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS low_slots INT NOT NULL DEFAULT 2;

-- 3. Hull Seed & Taxonomy Metadata on Hangar Vessels
ALTER TABLE player_fleet
  ADD COLUMN IF NOT EXISTS hull_seed INT NOT NULL DEFAULT 12345,
  ADD COLUMN IF NOT EXISTS main_hull_class VARCHAR(32) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hull_subtype VARCHAR(64) DEFAULT NULL;

-- Backfill taxonomy metadata for existing baseline fleet escorts
UPDATE player_fleet SET main_hull_class = 'CRUISER_DREADNOUGHT', hull_subtype = 'Sol Vanguard Missile Cruiser', hull_seed = 41001
  WHERE hull_class = 'SOL_CRUISER' AND main_hull_class IS NULL;
UPDATE player_fleet SET main_hull_class = 'INTERCEPTOR', hull_subtype = 'Kryll Shadow-Runner', hull_seed = 41002
  WHERE hull_class = 'KRYLL_RUNNER' AND main_hull_class IS NULL;
UPDATE player_fleet SET main_hull_class = 'DESTROYER', hull_subtype = 'Vaelic Imperial Interdictor', hull_seed = 41003
  WHERE hull_class = 'VAELIC_INTERDICTOR' AND main_hull_class IS NULL;
UPDATE player_fleet SET main_hull_class = 'FRIGATE', hull_subtype = 'Phorid Bio-Spore Frigate', hull_seed = 41004
  WHERE hull_class = 'PHORID_FRIGATE' AND main_hull_class IS NULL;
UPDATE player_fleet SET main_hull_class = 'CRUISER_DREADNOUGHT', hull_subtype = 'Lithos Crystalline Monitor', hull_seed = 41005
  WHERE hull_class = 'LITHOS_MONITOR' AND main_hull_class IS NULL;


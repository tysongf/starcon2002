-- 007_fleet_hangar_and_command_bridge.sql
-- Milestone 0.8: Fleet Command & Task Force Operations
-- Player Fleet Hangar Roster, Command Bridge Outfitting Blueprints & Starter Escorts

-- 1. Player Starship Fleet Roster & Garage
CREATE TABLE IF NOT EXISTS player_fleet (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    blueprint_id VARCHAR(64) NOT NULL,
    hull_class VARCHAR(64) NOT NULL,       -- 'SOL_CRUISER', 'VAELIC_INTERDICTOR', 'KRYLL_RUNNER', etc.
    faction_id VARCHAR(32) NOT NULL,
    hull INT NOT NULL DEFAULT 150,
    max_hull INT NOT NULL DEFAULT 150,
    shield INT NOT NULL DEFAULT 100,
    max_shield INT NOT NULL DEFAULT 100,
    speed NUMERIC(5, 2) NOT NULL DEFAULT 60.0,
    turn_rate NUMERIC(5, 2) NOT NULL DEFAULT 2.4,
    firepower INT NOT NULL DEFAULT 35,
    special_ability VARCHAR(64) NOT NULL,  -- 'POINT_DEFENSE', 'PLASMA_BARRAGE', 'DECOY_HOLO', etc.
    fitted_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    deployment_slot INT DEFAULT NULL,      -- NULL = In Hangar Reserve; 1..4 = Active Wingman
    status VARCHAR(32) NOT NULL DEFAULT 'READY', -- 'READY', 'DEPLOYED', 'DESTROYED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_fleet_account ON player_fleet(account_id);
CREATE INDEX IF NOT EXISTS idx_player_fleet_slot ON player_fleet(account_id, deployment_slot);

-- 2. Command Bridge Modules in equipment_blueprints
INSERT INTO equipment_blueprints (id, name, slot_type, main_category, subtype, manufacturer, base_rarity, power_grid_cost, cpu_cost, base_price, base_stats, description)
VALUES
  ('MOD_BRIDGE_T1', 'Tactical Command Bridge Mk.I', 'MID', 'UTILITY_DRONE', 'Command Bridge', 'Sol Industrial', 'COMMON', 8.0, 20.0, 350,
   '{"maxWingmen": 1, "bridgeTier": 1}'::jsonb,
   'Standard single-channel fleet coordination bridge. Enables command over 1 active combat wingman.'),

  ('MOD_BRIDGE_T2', 'Tactical Operations Bridge Mk.II', 'MID', 'UTILITY_DRONE', 'Command Bridge', 'Sol Industrial', 'UNCOMMON', 14.0, 35.0, 750,
   '{"maxWingmen": 2, "bridgeTier": 2}'::jsonb,
   'Dual-channel encrypted tactical routing bus. Coordinates 2 active combat wingmen in tight formation.'),

  ('MOD_BRIDGE_T3', 'Fleet Operations Center Mk.III', 'MID', 'UTILITY_DRONE', 'Command Bridge', 'Vaelic Ironworks', 'RARE', 22.0, 50.0, 1500,
   '{"maxWingmen": 3, "bridgeTier": 3}'::jsonb,
   'Advanced multi-vector fleet telemetry center. Manages up to 3 active combat wingmen simultaneously.'),

  ('MOD_BRIDGE_T4', 'Admiral''s Flag Bridge Mk.IV', 'MID', 'UTILITY_DRONE', 'Command Bridge', 'Sol Industrial', 'EPIC', 30.0, 65.0, 3200,
   '{"maxWingmen": 4, "bridgeTier": 4}'::jsonb,
   'Supreme fleet command nexus with quantum datalink arrays. Commands a full 4-wingman battle flotilla.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slot_type = EXCLUDED.slot_type,
  main_category = EXCLUDED.main_category,
  subtype = EXCLUDED.subtype,
  manufacturer = EXCLUDED.manufacturer,
  base_rarity = EXCLUDED.base_rarity,
  power_grid_cost = EXCLUDED.power_grid_cost,
  cpu_cost = EXCLUDED.cpu_cost,
  base_price = EXCLUDED.base_price,
  base_stats = EXCLUDED.base_stats,
  description = EXCLUDED.description;

-- 3. Seed Initial Starter Escorts for acc_sol_captain
INSERT INTO player_fleet (
    id, account_id, name, blueprint_id, hull_class, faction_id,
    hull, max_hull, shield, max_shield, speed, turn_rate, firepower,
    special_ability, fitted_modules, deployment_slot, status
) VALUES
(
    'fleet_escort_sol_01', 'acc_sol_captain', 'Sol Vanguard Escort Alpha', 'HULL_SOL_CRUISER', 'SOL_CRUISER', 'FACTION_SOL',
    150, 150, 100, 100, 65.0, 2.5, 35,
    'POINT_DEFENSE', '[]'::jsonb, 1, 'READY'
),
(
    'fleet_escort_kryll_01', 'acc_sol_captain', 'Kryll Skrit Shadow Runner', 'HULL_KRYLL_RUNNER', 'KRYLL_RUNNER', 'FACTION_KRYLL',
    100, 100, 80, 80, 85.0, 3.2, 28,
    'DECOY_HOLO', '[]'::jsonb, NULL, 'READY'
)
ON CONFLICT (id) DO NOTHING;


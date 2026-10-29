-- Wayward Void Core Relational Schema (PostgreSQL 16)
-- Authoritative data persistence for accounts, ships, cargo, sectors, and ports.

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  callsign VARCHAR(64) NOT NULL,
  credits BIGINT NOT NULL DEFAULT 1000 CHECK (credits >= 0),
  faction_id VARCHAR(64) NOT NULL DEFAULT 'FACTION_SOL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ships (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  hull_class VARCHAR(32) NOT NULL DEFAULT 'CORVETTE',
  hull_seed INT NOT NULL DEFAULT 12345,
  current_sector_id INT NOT NULL DEFAULT 1,
  fuel INT NOT NULL DEFAULT 100 CHECK (fuel >= 0),
  max_fuel INT NOT NULL DEFAULT 100,
  armor INT NOT NULL DEFAULT 100 CHECK (armor >= 0),
  max_armor INT NOT NULL DEFAULT 100,
  shield INT NOT NULL DEFAULT 100 CHECK (shield >= 0),
  max_shield INT NOT NULL DEFAULT 100,
  cargo_capacity INT NOT NULL DEFAULT 40,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ship_cargo (
  ship_id VARCHAR(64) NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
  commodity_id VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (ship_id, commodity_id)
);

CREATE TABLE IF NOT EXISTS sectors (
  id INT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  system_seed INT NOT NULL,
  controlling_faction VARCHAR(64) NOT NULL DEFAULT 'FACTION_SOL',
  connected_sectors JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS ports (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  port_class INT NOT NULL DEFAULT 1,
  faction_id VARCHAR(64) NOT NULL DEFAULT 'FACTION_SOL',
  tariff_rate REAL NOT NULL DEFAULT 0.05
);

CREATE TABLE IF NOT EXISTS port_inventory (
  port_id VARCHAR(64) NOT NULL REFERENCES ports(id) ON DELETE CASCADE,
  commodity_id VARCHAR(64) NOT NULL,
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  demand INT NOT NULL DEFAULT 0 CHECK (demand >= 0),
  capacity INT NOT NULL DEFAULT 2000,
  buy_price REAL NOT NULL DEFAULT 25.0,
  sell_price REAL NOT NULL DEFAULT 25.0,
  PRIMARY KEY (port_id, commodity_id)
);

-- Seed Initial Pilot Account & Ship
INSERT INTO accounts (id, username, callsign, credits, faction_id)
VALUES ('acc_sol_captain', 'cmdr_vance', 'Vance', 2500, 'FACTION_SOL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ships (id, account_id, hull_class, hull_seed, current_sector_id, fuel, max_fuel, armor, max_armor, shield, max_shield, cargo_capacity)
VALUES ('ship_sol_flagship', 'acc_sol_captain', 'CORVETTE', 12345, 1, 100, 100, 100, 100, 100, 100, 40)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Static 3-Sector Graph (Sector 1 <-> Sector 2 <-> Sector 3)
INSERT INTO sectors (id, name, system_seed, controlling_faction, connected_sectors)
VALUES 
  (1, 'Sol-Perimeter Nexus', 101, 'FACTION_SOL', '[2]'::jsonb),
  (2, 'Void Expanse Hazard Zone', 202, 'FACTION_SOL', '[1, 3]'::jsonb),
  (3, 'Obsidian Smelter Station', 303, 'FACTION_LITHOS', '[2]'::jsonb)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  system_seed = EXCLUDED.system_seed,
  controlling_faction = EXCLUDED.controlling_faction,
  connected_sectors = EXCLUDED.connected_sectors;

-- Seed Initial Ports (Sector 1: Aegis Terminal, Sector 3: Obsidian Foundry)
INSERT INTO ports (id, name, sector_id, port_class, faction_id, tariff_rate)
VALUES 
  ('PORT_AEGIS_01', 'Aegis Terminal', 1, 1, 'FACTION_SOL', 0.05),
  ('PORT_SMELTER_01', 'Obsidian Foundry 3', 3, 2, 'FACTION_LITHOS', 0.06)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  sector_id = EXCLUDED.sector_id,
  port_class = EXCLUDED.port_class,
  tariff_rate = EXCLUDED.tariff_rate;

-- Seed Commodity Stock at Ports
INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
VALUES 
  ('PORT_AEGIS_01', 'COMM_FUEL', 2450, 500, 4000, 24.5, 26.2),
  ('PORT_AEGIS_01', 'COMM_RATIONS', 1200, 600, 2000, 38.0, 41.5),
  ('PORT_AEGIS_01', 'COMM_ORE', 400, 1800, 2500, 62.0, 68.0),
  ('PORT_AEGIS_01', 'COMM_ALLOY', 450, 900, 1500, 152.0, 160.0),
  ('PORT_SMELTER_01', 'COMM_FUEL', 750, 1200, 2500, 32.0, 35.0),
  ('PORT_SMELTER_01', 'COMM_RATIONS', 550, 1400, 2000, 52.0, 56.5),
  ('PORT_SMELTER_01', 'COMM_ORE', 2300, 300, 4000, 35.0, 38.0),
  ('PORT_SMELTER_01', 'COMM_ALLOY', 1250, 400, 2500, 115.0, 122.0)
ON CONFLICT (port_id, commodity_id) DO UPDATE SET 
  stock = EXCLUDED.stock,
  demand = EXCLUDED.demand,
  buy_price = EXCLUDED.buy_price,
  sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- MILESTONE 0.3: REAL-TIME COMBAT, PERSISTENT WRECKS & SCAVENGER TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment_blueprints (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slot_type VARCHAR(16) NOT NULL, -- 'HIGH', 'MID', 'LOW'
  category VARCHAR(32) NOT NULL,  -- 'WEAPON', 'MINING', 'PROPULSION', 'SHIELD', 'REACTOR', 'HULL', 'CARGO'
  manufacturer VARCHAR(64) NOT NULL DEFAULT 'Sol Industrial',
  base_rarity VARCHAR(16) NOT NULL DEFAULT 'COMMON', -- 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'
  power_grid_cost NUMERIC(8, 2) NOT NULL, -- MW
  cpu_cost NUMERIC(8, 2) NOT NULL,        -- tf
  base_price INT NOT NULL DEFAULT 400,
  base_stats JSONB NOT NULL,              -- { damage, fireCooldown, muzzleSpeed, energyCost, etc }
  description TEXT
);

CREATE TABLE IF NOT EXISTS player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
  blueprint_id VARCHAR(64) REFERENCES equipment_blueprints(id),
  custom_name VARCHAR(128) NOT NULL DEFAULT 'Equipment Module',
  rarity VARCHAR(16) NOT NULL DEFAULT 'COMMON',
  affixes JSONB DEFAULT '[]'::jsonb,
  is_fitted BOOLEAN DEFAULT false,
  fit_slot VARCHAR(16) DEFAULT NULL, -- 'H1', 'H2', 'M1', 'M2', 'L1', 'L2'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe Alter Migrations for existing PGLite databases
ALTER TABLE equipment_blueprints ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'WEAPON';
ALTER TABLE equipment_blueprints ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(64) NOT NULL DEFAULT 'Sol Industrial';
ALTER TABLE equipment_blueprints ADD COLUMN IF NOT EXISTS base_price INT NOT NULL DEFAULT 400;

ALTER TABLE player_inventory ADD COLUMN IF NOT EXISTS custom_name VARCHAR(128) NOT NULL DEFAULT 'Equipment Module';
ALTER TABLE player_inventory ADD COLUMN IF NOT EXISTS fit_slot VARCHAR(16) DEFAULT NULL;


CREATE TABLE IF NOT EXISTS sector_wrecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id INT REFERENCES sectors(id) ON DELETE CASCADE,
  original_hull_type VARCHAR(64) NOT NULL,
  pos_x NUMERIC(10, 2) NOT NULL,
  pos_z NUMERIC(10, 2) NOT NULL,
  remaining_materials INT NOT NULL DEFAULT 50,
  towed_by_account_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persistent_scavengers (
  id VARCHAR(64) PRIMARY KEY,
  sector_id INT REFERENCES sectors(id) ON DELETE CASCADE,
  faction_id VARCHAR(32) NOT NULL,
  hull_type VARCHAR(64) NOT NULL,
  current_hp INT NOT NULL,
  current_shields INT NOT NULL,
  pos_x NUMERIC(10, 2) NOT NULL,
  pos_z NUMERIC(10, 2) NOT NULL,
  looted_cargo JSONB DEFAULT '[]'::jsonb,
  transponder_active BOOLEAN DEFAULT false,
  victim_account_id VARCHAR(64) DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
  contract_type VARCHAR(32) NOT NULL DEFAULT 'REVENGE_BOUNTY',
  target_scavenger_id VARCHAR(64) REFERENCES persistent_scavengers(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  reward_credits INT DEFAULT 0,
  status VARCHAR(16) DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Equipment Blueprints Catalog
INSERT INTO equipment_blueprints (id, name, slot_type, category, manufacturer, base_rarity, power_grid_cost, cpu_cost, base_price, base_stats, description)
VALUES
  ('MOD_PULSE_01', 'Sol-Standard Pulse Cannon', 'HIGH', 'WEAPON', 'Sol Industrial', 'COMMON', 16.0, 30.0, 450, 
   '{"damage": 14, "fireCooldown": 0.16, "muzzleSpeed": 78, "energyCost": 8, "weaponType": "PULSE"}'::jsonb, 
   'Standard high-velocity kinetic pulse battery. Low capacitor draw with high cycle rate.'),
  
  ('MOD_PLASMA_01', 'Vaelic Heavy Plasma Accelerator', 'HIGH', 'WEAPON', 'Vaelic Ironworks', 'RARE', 35.0, 55.0, 1200, 
   '{"damage": 44, "fireCooldown": 0.45, "muzzleSpeed": 48, "energyCost": 22, "weaponType": "PLASMA"}'::jsonb, 
   'High-impact superheated plasma bolt. Deals devastating hull damage at the cost of high capacitor consumption.'),
  
  ('MOD_FLAK_01', 'Phorid Scatter Flak Blaster', 'HIGH', 'WEAPON', 'Phorid Biotech', 'UNCOMMON', 22.0, 40.0, 750, 
   '{"damage": 13, "fireCooldown": 0.35, "muzzleSpeed": 66, "energyCost": 18, "weaponType": "FLAK", "pellets": 3}'::jsonb, 
   'Tri-pellet scattershot cannon designed for close-quarters dogfighting and point defense.'),
  
  ('MOD_MINING_01', 'Lithos Focused Mining Laser', 'HIGH', 'MINING', 'Lithos Axiom', 'COMMON', 18.0, 25.0, 500, 
   '{"miningPower": 15, "range": 45, "energyCost": 12, "weaponType": "MINING"}'::jsonb, 
   'Harmonic resonance beam tuned for dissecting planetary ore deposits and derelict spacecraft hulls.'),
  
  ('MOD_AFTERBURNER_01', 'Overdrive Afterburner Core', 'MID', 'PROPULSION', 'Sol Industrial', 'UNCOMMON', 30.0, 20.0, 600, 
   '{"thrustMultiplier": 2.2, "maxSpeed": 48, "energyDrain": 38}'::jsonb, 
   'Direct reactor injection manifold that delivers a 2.2x emergency combat thrust boost on Shift.'),
  
  ('MOD_SHIELD_01', 'Vaelic Bulwark Shield Matrix', 'MID', 'SHIELD', 'Vaelic Ironworks', 'RARE', 28.0, 45.0, 950, 
   '{"shieldCapacity": 40, "shieldRecharge": 6.0, "boostAmount": 35, "boostCooldown": 6.0}'::jsonb, 
   'Hexagonal electrostatic emitter matrix that reinforces maximum shield capacity and passive dissipation.'),
  
  ('MOD_ECM_01', 'Lithos Resonant Sensor Jammer', 'MID', 'SHIELD', 'Lithos Axiom', 'EPIC', 22.0, 50.0, 1400, 
   '{"lockBreakRadius": 60, "cooldown": 12.0}'::jsonb, 
   'Emits broad-spectrum electromagnetic interference that disrupts hostile radar lock-on acquisition.'),
  
  ('MOD_REACTOR_01', 'Vaelic Compact Reactor Core', 'LOW', 'REACTOR', 'Vaelic Ironworks', 'UNCOMMON', 0.0, 15.0, 650, 
   '{"energyRegenMultiplier": 1.15, "maxEnergyBonus": 20}'::jsonb, 
   'Auxiliary fusion reactor augment that increases ship capacitor capacity and regeneration rate by 15%.'),
  
  ('MOD_ARMOR_01', 'Reinforced Plasteel Armor Plating', 'LOW', 'HULL', 'Sol Industrial', 'COMMON', 12.0, 0.0, 400, 
   '{"maxHpBonus": 25}'::jsonb, 
   'Dense multilayer plasteel sheets welded to ship bulkheads, providing +25 maximum Hull Integrity.'),
  
  ('MOD_CARGO_01', 'Expanded Hold Nanofiber Rig', 'LOW', 'CARGO', 'Phorid Biotech', 'COMMON', 8.0, 10.0, 350, 
   '{"cargoHoldBonus": 20}'::jsonb, 
   'Pressurized micro-lattice storage bays expanding hold volume by 20 cubic meters.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slot_type = EXCLUDED.slot_type,
  category = EXCLUDED.category,
  manufacturer = EXCLUDED.manufacturer,
  base_rarity = EXCLUDED.base_rarity,
  power_grid_cost = EXCLUDED.power_grid_cost,
  cpu_cost = EXCLUDED.cpu_cost,
  base_price = EXCLUDED.base_price,
  base_stats = EXCLUDED.base_stats,
  description = EXCLUDED.description;

-- Seed Initial Player Inventory (Fitted 2H/2M/2L + Locker items)
INSERT INTO player_inventory (id, account_id, blueprint_id, custom_name, rarity, affixes, is_fitted, fit_slot)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-111111111111', 'acc_sol_captain', 'MOD_PULSE_01', 'Sol-Standard Pulse Cannon', 'COMMON', '[]'::jsonb, true, 'H1'),
  ('a1b2c3d4-e5f6-7890-abcd-222222222222', 'acc_sol_captain', 'MOD_PLASMA_01', 'Calibrated Vaelic Plasma Accelerator', 'RARE', '[{"stat": "damage", "multiplier": 1.15}]'::jsonb, true, 'H2'),
  ('a1b2c3d4-e5f6-7890-abcd-333333333333', 'acc_sol_captain', 'MOD_AFTERBURNER_01', 'Overdrive Afterburner Core', 'UNCOMMON', '[{"stat": "maxSpeed", "multiplier": 1.08}]'::jsonb, true, 'M1'),
  ('a1b2c3d4-e5f6-7890-abcd-444444444444', 'acc_sol_captain', 'MOD_FLAK_01', 'Scatter Flak Blaster of Ruin', 'EPIC', '[{"stat": "damage", "multiplier": 1.25}]'::jsonb, true, 'M2'),
  ('a1b2c3d4-e5f6-7890-abcd-555555555555', 'acc_sol_captain', 'MOD_REACTOR_01', 'Vaelic Compact Reactor Core Mk II', 'UNCOMMON', '[]'::jsonb, true, 'L1'),
  ('a1b2c3d4-e5f6-7890-abcd-666666666666', 'acc_sol_captain', 'MOD_ARMOR_01', 'Reinforced Plasteel Armor Plating', 'COMMON', '[]'::jsonb, true, 'L2'),
  ('a1b2c3d4-e5f6-7890-abcd-777777777777', 'acc_sol_captain', 'MOD_MINING_01', 'Lithos Focused Mining Laser', 'COMMON', '[]'::jsonb, false, NULL),
  ('a1b2c3d4-e5f6-7890-abcd-888888888888', 'acc_sol_captain', 'MOD_CARGO_01', 'Expanded Hold Nanofiber Rig', 'COMMON', '[]'::jsonb, false, NULL)
ON CONFLICT (id) DO NOTHING;



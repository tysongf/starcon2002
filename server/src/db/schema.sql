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

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS target_name VARCHAR(128) NOT NULL DEFAULT 'Hegemony Scout Hunter';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS target_entity_id VARCHAR(64) DEFAULT NULL;


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

CREATE TABLE IF NOT EXISTS killmails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victim_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
  killer_id VARCHAR(64) NOT NULL,
  killer_name VARCHAR(128) NOT NULL,
  sector_id INT REFERENCES sectors(id) ON DELETE CASCADE,
  loss_valuation INT NOT NULL DEFAULT 0,
  dropped_items JSONB DEFAULT '[]'::jsonb,
  destroyed_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
  contract_type VARCHAR(32) NOT NULL DEFAULT 'REVENGE_BOUNTY',
  target_scavenger_id VARCHAR(64) REFERENCES persistent_scavengers(id) ON DELETE CASCADE,
  target_name VARCHAR(128) NOT NULL DEFAULT 'Hegemony Scout Hunter',
  target_entity_id VARCHAR(64) DEFAULT NULL,
  is_public BOOLEAN DEFAULT false,
  reward_credits INT DEFAULT 0,
  status VARCHAR(16) DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Persistent Scavengers
INSERT INTO persistent_scavengers (id, sector_id, faction_id, hull_type, current_hp, current_shields, pos_x, pos_z, looted_cargo, transponder_active)
VALUES 
  ('scavenger_salvage_01', 2, 'Scavenger Guild', 'Vulture-Class Salvager', 95, 40, -18.0, 16.0, '[{"name": "Titanium Scrap", "quantity": 12, "unitValue": 90}]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Revenge Contract
INSERT INTO contracts (id, creator_account_id, contract_type, target_scavenger_id, target_name, target_entity_id, is_public, reward_credits, status)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'acc_sol_captain', 'REVENGE_BOUNTY', 'scavenger_salvage_01', 'Vulture-01 [Scavenger Guild]', 'scavenger_salvage_01', true, 2500, 'OPEN')
ON CONFLICT (id) DO NOTHING;

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

-- ============================================================================
-- Day 15: Persistent Sector Ship Wrecks, In-Situ Salvage & Elastic Towing
-- ============================================================================
CREATE TABLE IF NOT EXISTS wrecks (
    id VARCHAR(64) PRIMARY KEY,
    sector_id INT NOT NULL REFERENCES sectors(id),
    ship_name VARCHAR(64) NOT NULL,
    ship_class VARCHAR(32) NOT NULL,
    faction VARCHAR(32) NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    z FLOAT NOT NULL,
    rotation FLOAT DEFAULT 0.0,
    scrap_remaining INT DEFAULT 100,
    max_scrap INT DEFAULT 100,
    hull_intactness FLOAT DEFAULT 1.0,
    is_towed BOOLEAN DEFAULT false,
    towed_by_account_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Initial Derelict Wrecks in Sector 2 (Hazard Zone)
INSERT INTO wrecks (id, sector_id, ship_name, ship_class, faction, x, y, z, rotation, scrap_remaining, max_scrap, hull_intactness)
VALUES 
  ('wreck_ancient_cruiser_01', 2, 'Derelict Hegemony Cruiser', 'Hegemony Vanguard', 'Hegemony Drone Fleet', 35.0, 0.0, -45.0, 0.78, 250, 250, 0.85),
  ('wreck_freighter_derelict_02', 2, 'Shattered Bulk Hauler Wreck', 'Mammoth Industrial', 'Independent Traders', -50.0, 0.0, 25.0, 2.35, 180, 180, 0.60)
ON CONFLICT (id) DO UPDATE SET
  scrap_remaining = EXCLUDED.scrap_remaining,
  max_scrap = EXCLUDED.max_scrap,
  hull_intactness = EXCLUDED.hull_intactness;
-- Day 16: Star Control II Alien Comms & Branching Dialogue System
CREATE TABLE IF NOT EXISTS player_dialog_state (
    account_id VARCHAR(64) NOT NULL,
    npc_id VARCHAR(64) NOT NULL,
    current_node_id VARCHAR(64) NOT NULL,
    flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (account_id, npc_id)
);

-- Day 17: Faction Reputation Matrix & Diplomatic Ceasefire Truces
CREATE TABLE IF NOT EXISTS faction_standings (
    account_id VARCHAR(64) NOT NULL,
    faction_id VARCHAR(32) NOT NULL,
    standing INT NOT NULL DEFAULT 0, -- -100 to +100
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (account_id, faction_id)
);

CREATE TABLE IF NOT EXISTS diplomatic_truces (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    sector_id INT NOT NULL,
    faction_id VARCHAR(32) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Baseline Faction Standings for Player
INSERT INTO faction_standings (account_id, faction_id, standing)
VALUES
    ('acc_sol_captain', 'FACTION_SOL', 35),
    ('acc_sol_captain', 'FACTION_HEGEMONY', -25),
    ('acc_sol_captain', 'FACTION_PHORID', 15),
    ('acc_sol_captain', 'FACTION_KRYLL', 5)
ON CONFLICT (account_id, faction_id) DO NOTHING;

-- Day 18: Planetary Orbital Survey, Surface Mineral Scanners & Atmospheric Probes
CREATE TABLE IF NOT EXISTS planets (
    id VARCHAR(64) PRIMARY KEY,
    sector_id INT NOT NULL,
    name VARCHAR(128) NOT NULL,
    archetype VARCHAR(32) NOT NULL, -- 'TERRESTRIAL' | 'VOLCANIC' | 'BARREN' | 'GAS_GIANT' | 'PRECURSOR_RUIN'
    radius FLOAT NOT NULL DEFAULT 22.0,
    pos_x FLOAT NOT NULL,
    pos_y FLOAT NOT NULL DEFAULT 0.0,
    pos_z FLOAT NOT NULL,
    texture_seed INT NOT NULL,
    atmosphere_color VARCHAR(16) NOT NULL,
    atmosphere_density FLOAT NOT NULL,
    surface_temp_k INT NOT NULL,
    hazard_class VARCHAR(32) NOT NULL,
    habitability_rating INT NOT NULL, -- 0 to 100%
    controlling_faction VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planet_surveys (
    account_id VARCHAR(64) NOT NULL,
    planet_id VARCHAR(64) NOT NULL,
    scanned_minerals BOOLEAN NOT NULL DEFAULT FALSE,
    scanned_bio BOOLEAN NOT NULL DEFAULT FALSE,
    scanned_anomalies BOOLEAN NOT NULL DEFAULT FALSE,
    survey_completion INT NOT NULL DEFAULT 0, -- 0 to 100%
    discovered_hotspots JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_data_sold BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (account_id, planet_id)
);

CREATE TABLE IF NOT EXISTS planet_beacons (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    planet_id VARCHAR(64) NOT NULL,
    beacon_type VARCHAR(32) NOT NULL DEFAULT 'SENSOR_PROBE',
    surface_lat FLOAT NOT NULL,
    surface_lng FLOAT NOT NULL,
    yield_summary VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Canonical Celestial Planets for Sectors 1 through 5
INSERT INTO planets (id, sector_id, name, archetype, radius, pos_x, pos_y, pos_z, texture_seed, atmosphere_color, atmosphere_density, surface_temp_k, hazard_class, habitability_rating, controlling_faction, description)
VALUES
    ('planet_sec1_aegis', 1, 'Aegis Prime', 'BARREN', 24.0, -140.0, 0.0, 180.0, 101, '#38bdf8', 0.12, 215, 'LOW_RADIATION', 18, 'FACTION_SOL', 'Airless metallic moon rich in heavy silicate crust and structural plasteel strata.'),
    ('planet_sec2_charybdis', 2, 'Charybdis Minor', 'VOLCANIC', 26.0, 160.0, 0.0, -170.0, 202, '#f97316', 0.85, 780, 'EXTREME_THERMAL', 5, 'FACTION_HEGEMONY', 'Tectonically unstable lava world venting superheated sulfur and high-grade mineral ore.'),
    ('planet_sec3_ignis', 3, 'Ignis Tartarus', 'PRECURSOR_RUIN', 28.0, -180.0, 0.0, -150.0, 303, '#a855f7', 0.40, 110, 'IONIC_DISRUPTIONS', 24, 'FACTION_HEGEMONY', 'Glaciated tomb world crisscrossed with dormant Precursor conduits and energy monoliths.'),
    ('planet_sec4_mycelia', 4, 'Mycelia IV', 'TERRESTRIAL', 25.0, 150.0, 0.0, 140.0, 404, '#10b981', 1.05, 292, 'BIOLOGICAL_SPORES', 84, 'FACTION_PHORID', 'Lush photosynthetic planetary biome covered in dense fungal canopies and bio-protein reserves.'),
    ('planet_sec5_skrit', 5, 'Skrit-V', 'GAS_GIANT', 34.0, -220.0, 0.0, 190.0, 505, '#f59e0b', 4.50, 85, 'HIGH_PRESSURE_STORMS', 0, 'FACTION_KRYLL', 'Massive banded gas giant with cryo-hydrocarbon rings suitable for Deuterium fuel skimming.')
ON CONFLICT (id) DO NOTHING;

-- Day 19: Colony Outposts, Terraforming & Mining Infrastructure
CREATE TABLE IF NOT EXISTS colonies (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    planet_id VARCHAR(64) NOT NULL,
    beacon_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    surface_lat FLOAT NOT NULL,
    surface_lng FLOAT NOT NULL,
    commodity_id VARCHAR(64) NOT NULL,
    population INT NOT NULL DEFAULT 100,
    max_population INT NOT NULL DEFAULT 500,
    stockpiled_amount INT NOT NULL DEFAULT 0,
    silo_capacity INT NOT NULL DEFAULT 50,
    derrick_tier INT NOT NULL DEFAULT 1,
    habitation_tier INT NOT NULL DEFAULT 1,
    terraformer_tier INT NOT NULL DEFAULT 1,
    silo_tier INT NOT NULL DEFAULT 1,
    terraforming_progress FLOAT NOT NULL DEFAULT 0.0,
    last_harvest_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


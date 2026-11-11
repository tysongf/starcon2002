-- 001_initial_schema.sql
-- Wayward Void Core Relational Schema

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

CREATE TABLE IF NOT EXISTS equipment_blueprints (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slot_type VARCHAR(16) NOT NULL, -- 'HIGH', 'MID', 'LOW'
  category VARCHAR(32) NOT NULL DEFAULT 'WEAPON',  -- 'WEAPON', 'MINING', 'PROPULSION', 'SHIELD', 'REACTOR', 'HULL', 'CARGO'
  manufacturer VARCHAR(64) NOT NULL DEFAULT 'Sol Industrial',
  base_rarity VARCHAR(16) NOT NULL DEFAULT 'COMMON',
  power_grid_cost NUMERIC(8, 2) NOT NULL,
  cpu_cost NUMERIC(8, 2) NOT NULL,
  base_price INT NOT NULL DEFAULT 400,
  base_stats JSONB NOT NULL,
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
  fit_slot VARCHAR(16) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS player_dialog_state (
  account_id VARCHAR(64) NOT NULL,
  npc_id VARCHAR(64) NOT NULL,
  current_node_id VARCHAR(64) NOT NULL,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (account_id, npc_id)
);

CREATE TABLE IF NOT EXISTS faction_standings (
  account_id VARCHAR(64) NOT NULL,
  faction_id VARCHAR(32) NOT NULL,
  standing INT NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS planets (
  id VARCHAR(64) PRIMARY KEY,
  sector_id INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  archetype VARCHAR(32) NOT NULL,
  radius FLOAT NOT NULL DEFAULT 22.0,
  pos_x FLOAT NOT NULL,
  pos_y FLOAT NOT NULL DEFAULT 0.0,
  pos_z FLOAT NOT NULL,
  texture_seed INT NOT NULL,
  atmosphere_color VARCHAR(16) NOT NULL,
  atmosphere_density FLOAT NOT NULL,
  surface_temp_k INT NOT NULL,
  hazard_class VARCHAR(32) NOT NULL,
  habitability_rating INT NOT NULL,
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
  survey_completion INT NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS precursor_sites (
  id VARCHAR(64) PRIMARY KEY,
  planet_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  site_type VARCHAR(64) NOT NULL DEFAULT 'MONOLITH',
  surface_lat FLOAT NOT NULL,
  surface_lng FLOAT NOT NULL,
  required_freq INT NOT NULL,
  required_phase INT NOT NULL,
  required_damping INT NOT NULL,
  is_deciphered BOOLEAN NOT NULL DEFAULT FALSE,
  codex_title VARCHAR(128) NOT NULL,
  codex_text TEXT NOT NULL,
  relic_reward INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_precursor_planet FOREIGN KEY (planet_id) REFERENCES planets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS precursor_research (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  tech_id VARCHAR(64) NOT NULL,
  is_synthesized BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_account_tech UNIQUE (account_id, tech_id)
);

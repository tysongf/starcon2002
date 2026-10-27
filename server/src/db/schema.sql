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

-- Seed Initial Static Sectors if empty
INSERT INTO sectors (id, name, system_seed, controlling_faction, connected_sectors)
VALUES 
  (1, 'Sol-Perimeter Nexus', 101, 'FACTION_SOL', '[2, 3]'::jsonb),
  (2, 'Phorid Deep Outpost', 102, 'FACTION_PHORID', '[1, 3]'::jsonb),
  (3, 'Iron Forge Smelter', 103, 'FACTION_SOL', '[1, 2]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Ports
INSERT INTO ports (id, name, sector_id, port_class, faction_id, tariff_rate)
VALUES 
  ('PORT_AEGIS_01', 'Aegis Terminal', 1, 1, 'FACTION_SOL', 0.05),
  ('PORT_PHORID_01', 'Phorid Bargain-Spire 9', 2, 4, 'FACTION_PHORID', 0.08),
  ('PORT_SMELTER_01', 'Iron Forge Smelter 3', 3, 3, 'FACTION_SOL', 0.04)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Commodity Stock at Aegis Terminal
INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
VALUES 
  ('PORT_AEGIS_01', 'COMM_FUEL', 2450, 500, 4000, 24.5, 26.2),
  ('PORT_AEGIS_01', 'COMM_RATIONS', 1200, 600, 2000, 38.0, 41.5),
  ('PORT_AEGIS_01', 'COMM_ORE', 400, 1800, 2500, 62.0, 68.0),
  ('PORT_AEGIS_01', 'COMM_ALLOY', 450, 900, 1500, 152.0, 160.0)
ON CONFLICT (port_id, commodity_id) DO NOTHING;

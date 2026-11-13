-- 005_xenobiology_and_colony_biotech.sql
-- Xenobiology genetics, species mastery, and colony biotechnology schema

CREATE TABLE IF NOT EXISTS player_biotech_research (
  account_id VARCHAR(64) PRIMARY KEY REFERENCES accounts(id),
  bio_data_points INT DEFAULT 0,
  biosphere_tier INT DEFAULT 1,
  unlocked_projects JSONB DEFAULT '[]'::jsonb,
  species_mastery JSONB DEFAULT '{}'::jsonb,
  active_stims JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial baseline research record for sol captain
INSERT INTO player_biotech_research (account_id, bio_data_points, biosphere_tier, unlocked_projects, species_mastery, active_stims)
VALUES ('acc_sol_captain', 0, 1, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)
ON CONFLICT (account_id) DO NOTHING;

-- Seed COMM_BIO_SPECIMENS into port inventories for open-market trade
INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
VALUES 
  ('PORT_AEGIS_01', 'COMM_BIO_SPECIMENS', 50, 200, 500, 92.0, 95.0),
  ('PORT_SMELTER_01', 'COMM_BIO_SPECIMENS', 20, 150, 400, 89.0, 92.0)
ON CONFLICT (port_id, commodity_id) DO UPDATE SET
  buy_price = EXCLUDED.buy_price,
  sell_price = EXCLUDED.sell_price;

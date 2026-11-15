-- 020_procedural_crew_and_stations.sql
-- Milestone 1.5: Procedural Crew Specialists, Stations, Tiered Ship Bays, Colony Modules & Crew Economy

-- 1. Hull Bay Slots on Player Flagship (`ships`)
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS bay_slots INT NOT NULL DEFAULT 2;

UPDATE ships SET bay_slots = CASE COALESCE(main_hull_class, 'CORVETTE')
  WHEN 'INTERCEPTOR' THEN 1
  WHEN 'CORVETTE' THEN 2
  WHEN 'FRIGATE' THEN 3
  WHEN 'HAULER' THEN 4
  WHEN 'INDUSTRIAL_EXTRACTOR' THEN 4
  WHEN 'DESTROYER' THEN 5
  WHEN 'CRUISER' THEN 6
  WHEN 'DREADNOUGHT' THEN 8
  ELSE 2
END;

-- 2. Crew Economic State & Refresh Nonce on Accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS crew_arrears_cycles INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crew_refresh_nonce INT NOT NULL DEFAULT 0;

-- 3. Colony Specialty Modules State on Colonies
ALTER TABLE colonies
  ADD COLUMN IF NOT EXISTS colony_modules JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Procedural Crew Roster Table
CREATE TABLE IF NOT EXISTS crew_roster (
  id VARCHAR(80) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seed BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  callsign VARCHAR(32) NOT NULL,
  faction_id VARCHAR(32) NOT NULL,
  species VARCHAR(64) NOT NULL,
  age INT NOT NULL DEFAULT 30,
  rarity VARCHAR(16) NOT NULL,
  primary_specialty VARCHAR(32) NOT NULL,
  specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  aptitude INT NOT NULL DEFAULT 50,
  grit INT NOT NULL DEFAULT 50,
  efficiency INT NOT NULL DEFAULT 50,
  trait_id VARCHAR(48) NOT NULL,
  trait_label VARCHAR(64) NOT NULL,
  trait_desc TEXT NOT NULL DEFAULT '',
  morale INT NOT NULL DEFAULT 100,
  base_salary INT NOT NULL DEFAULT 15,
  hiring_fee INT NOT NULL DEFAULT 150,
  market_value INT NOT NULL DEFAULT 150,
  assignment_type VARCHAR(24) NOT NULL DEFAULT 'RESERVE', -- 'RESERVE' | 'SHIP_BAY' | 'COLONY'
  assigned_bay_slot VARCHAR(16) DEFAULT NULL,             -- e.g. 'BRIDGE#1' | 'B1#1' | 'B1#2'
  assigned_colony_id VARCHAR(64) DEFAULT NULL,
  assigned_module_key VARCHAR(48) DEFAULT NULL,
  origin_source VARCHAR(32) NOT NULL DEFAULT 'STARPORT',
  origin_label VARCHAR(128) NOT NULL DEFAULT 'Starport Concourse',
  cycles_served INT NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_roster_account ON crew_roster(account_id);
CREATE INDEX IF NOT EXISTS idx_crew_roster_assignment ON crew_roster(account_id, assignment_type);
CREATE INDEX IF NOT EXISTS idx_crew_roster_colony ON crew_roster(assigned_colony_id);

-- 5. Tracks Claimed/Hired Market Applicants so Pools Stay Clean After Hiring
CREATE TABLE IF NOT EXISTS crew_market_claims (
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  listing_id VARCHAR(128) NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, listing_id)
);

-- 6. Seed Tiered Ship Station Bay Blueprints ('BAY' slots) & Complementary Support Modules ('MID'/'LOW')
INSERT INTO equipment_blueprints (
  id, name, slot_type, main_category, subtype, manufacturer, base_rarity,
  power_grid_cost, cpu_cost, base_price, base_stats, description
) VALUES
  -- Research Bays Mk.I-IV
  ('MOD_BAY_RESEARCH_T1', 'Research Bay Mk.I', 'BAY', 'UTILITY_DRONE', 'Research Bay Mk.I', 'Sol Industrial', 'COMMON', 8.0, 16.0, 480,
   '{"bayDepartment":"SCIENCE","stationCount":1,"researchYieldBonus":0.08,"subtype":"Research Bay Mk.I"}'::jsonb,
   'Compact orbital science lab opening 1 Science Station (+8% base research return + officer bonuses).'),
  ('MOD_BAY_RESEARCH_T2', 'Research Bay Mk.II', 'BAY', 'UTILITY_DRONE', 'Research Bay Mk.II', 'Sol Industrial', 'UNCOMMON', 14.0, 26.0, 1050,
   '{"bayDepartment":"SCIENCE","stationCount":2,"researchYieldBonus":0.15,"subtype":"Research Bay Mk.II"}'::jsonb,
   'Dual-wing xenobiology & physics lab hosting 2 Science Officers simultaneously.'),
  ('MOD_BAY_RESEARCH_T3', 'Research Bay Mk.III', 'BAY', 'UTILITY_DRONE', 'Research Bay Mk.III', 'Warden Reliquary', 'RARE', 22.0, 38.0, 2100,
   '{"bayDepartment":"SCIENCE","stationCount":3,"researchYieldBonus":0.24,"subtype":"Research Bay Mk.III"}'::jsonb,
   'Pressurized spectral telemetry deck housing 3 full Science Officer Stations.'),
  ('MOD_BAY_RESEARCH_T4', 'Research Bay Mk.IV', 'BAY', 'UTILITY_DRONE', 'Research Bay Mk.IV', 'Warden Reliquary', 'EPIC', 30.0, 52.0, 3900,
   '{"bayDepartment":"SCIENCE","stationCount":4,"researchYieldBonus":0.35,"subtype":"Research Bay Mk.IV"}'::jsonb,
   'Flagship Precursor-grade science institute supporting 4 active Science Officers in orbit.'),

  -- Mining Operations Bays Mk.I-III
  ('MOD_BAY_MINING_T1', 'Mining Operations Bay Mk.I', 'BAY', 'UTILITY_DRONE', 'Mining Operations Bay Mk.I', 'Miners Guild', 'COMMON', 8.0, 14.0, 440,
   '{"bayDepartment":"ENGINEERING","stationCount":1,"miningRateBonus":0.10,"subtype":"Mining Operations Bay Mk.I"}'::jsonb,
   'Ore assay bench & beam telemetry link opening 1 Extraction Officer Station.'),
  ('MOD_BAY_MINING_T2', 'Mining Operations Bay Mk.II', 'BAY', 'UTILITY_DRONE', 'Mining Operations Bay Mk.II', 'Miners Guild', 'UNCOMMON', 14.0, 22.0, 980,
   '{"bayDepartment":"ENGINEERING","stationCount":2,"miningRateBonus":0.20,"subtype":"Mining Operations Bay Mk.II"}'::jsonb,
   'Twin deep-core laser telemetry array supporting 2 Extraction Officers.'),
  ('MOD_BAY_MINING_T3', 'Mining Operations Bay Mk.III', 'BAY', 'UTILITY_DRONE', 'Mining Operations Bay Mk.III', 'Miners Guild', 'RARE', 20.0, 32.0, 1950,
   '{"bayDepartment":"ENGINEERING","stationCount":3,"miningRateBonus":0.32,"subtype":"Mining Operations Bay Mk.III"}'::jsonb,
   'Heavy smelting & spectral fracturing command deck seating 3 Extraction Specialists.'),

  -- Gunnery & Tactical Decks Mk.I-III
  ('MOD_BAY_GUNNERY_T1', 'Gunnery & Tactical Deck Mk.I', 'BAY', 'OFFENSE', 'Gunnery & Tactical Deck Mk.I', 'Vaelic Ironworks', 'COMMON', 10.0, 16.0, 520,
   '{"bayDepartment":"OPERATIONS","stationCount":1,"combatDamageBonus":0.07,"subtype":"Gunnery & Tactical Deck Mk.I"}'::jsonb,
   'Fire-control targeting console opening 1 Combat Operations Station.'),
  ('MOD_BAY_GUNNERY_T2', 'Gunnery & Tactical Deck Mk.II', 'BAY', 'OFFENSE', 'Gunnery & Tactical Deck Mk.II', 'Vaelic Ironworks', 'UNCOMMON', 16.0, 26.0, 1180,
   '{"bayDepartment":"OPERATIONS","stationCount":2,"combatDamageBonus":0.14,"subtype":"Gunnery & Tactical Deck Mk.II"}'::jsonb,
   'Linked broadside fire-control pit hosting 2 Combat Officers simultaneously.'),
  ('MOD_BAY_GUNNERY_T3', 'Gunnery & Tactical Deck Mk.III', 'BAY', 'OFFENSE', 'Gunnery & Tactical Deck Mk.III', 'Sol Industrial', 'RARE', 24.0, 38.0, 2350,
   '{"bayDepartment":"OPERATIONS","stationCount":3,"combatDamageBonus":0.22,"subtype":"Gunnery & Tactical Deck Mk.III"}'::jsonb,
   'Capital FleetCIC & marine ready-room accommodating 3 Combat Specialists.'),

  -- Engineering Decks Mk.I-III
  ('MOD_BAY_ENGINEERING_T1', 'Engineering Deck Mk.I', 'BAY', 'DEFENSE', 'Engineering Deck Mk.I', 'Lithos Matrix', 'COMMON', 0.0, 12.0, 500,
   '{"bayDepartment":"ENGINEERING","stationCount":1,"powerGridBonus":12,"subtype":"Engineering Deck Mk.I"}'::jsonb,
   'Auxiliary diagnostic shop seating 1 Engineering Officer (+12 MW grid headroom).'),
  ('MOD_BAY_ENGINEERING_T2', 'Engineering Deck Mk.II', 'BAY', 'DEFENSE', 'Engineering Deck Mk.II', 'Lithos Matrix', 'UNCOMMON', 0.0, 18.0, 1120,
   '{"bayDepartment":"ENGINEERING","stationCount":2,"powerGridBonus":24,"subtype":"Engineering Deck Mk.II"}'::jsonb,
   'Dual damage-control & plasma conduit workshop for 2 Engineering Officers.'),
  ('MOD_BAY_ENGINEERING_T3', 'Engineering Deck Mk.III', 'BAY', 'DEFENSE', 'Engineering Deck Mk.III', 'Sol Industrial', 'RARE', 0.0, 24.0, 2250,
   '{"bayDepartment":"ENGINEERING","stationCount":3,"powerGridBonus":40,"subtype":"Engineering Deck Mk.III"}'::jsonb,
   'Full reactor calibration foundry supporting 3 Engineering Officers (+40 MW grid).'),

  -- Medbay & Cryo Wards Mk.I-II
  ('MOD_BAY_MEDBAY_T1', 'Medbay & Cryo Ward Mk.I', 'BAY', 'COMMERCE', 'Medbay & Cryo Ward Mk.I', 'Phorid Bio-Foundry', 'COMMON', 6.0, 12.0, 460,
   '{"bayDepartment":"OPERATIONS","stationCount":1,"moraleBonus":0.10,"subtype":"Medbay & Cryo Ward Mk.I"}'::jsonb,
   'Automated surgical triage & cryo berth seating 1 Medical/Support Officer.'),
  ('MOD_BAY_MEDBAY_T2', 'Medbay & Cryo Ward Mk.II', 'BAY', 'COMMERCE', 'Medbay & Cryo Ward Mk.II', 'Phorid Bio-Foundry', 'UNCOMMON', 10.0, 18.0, 1020,
   '{"bayDepartment":"OPERATIONS","stationCount":2,"moraleBonus":0.20,"subtype":"Medbay & Cryo Ward Mk.II"}'::jsonb,
   'Multi-ward regeneration & lander decontamination bay seating 2 Medical Officers.'),

  -- Astrogation & Trade Suites Mk.I-II
  ('MOD_BAY_ASTROGATION_T1', 'Astrogation & Trade Suite Mk.I', 'BAY', 'TRAVEL', 'Astrogation & Trade Suite Mk.I', 'Galactic Consortium', 'COMMON', 6.0, 16.0, 490,
   '{"bayDepartment":"COMMERCE","stationCount":1,"navTradeBonus":0.08,"subtype":"Astrogation & Trade Suite Mk.I"}'::jsonb,
   'Star-chart holotable & market ticker console seating 1 Nav/Trade Officer.'),
  ('MOD_BAY_ASTROGATION_T2', 'Astrogation & Trade Suite Mk.II', 'BAY', 'TRAVEL', 'Astrogation & Trade Suite Mk.II', 'Galactic Consortium', 'UNCOMMON', 10.0, 26.0, 1150,
   '{"bayDepartment":"COMMERCE","stationCount":2,"navTradeBonus":0.16,"subtype":"Astrogation & Trade Suite Mk.II"}'::jsonb,
   'Diplomatic envoy lounge & warp telemetry bridge seating 2 Nav/Commerce Officers.'),

  -- Portable MID/LOW Crew Support Modules
  ('MOD_CREW_POD_T2', 'Expanded Crew Quarters Pod Mk.II', 'LOW', 'COMMERCE', 'Crew Pod', 'Galactic Consortium', 'RARE', 12.0, 20.0, 1280,
   '{"crewCapacityBonus":36,"moraleBonus":0.18,"cargoHoldBonus":15,"subtype":"Crew Pod"}'::jsonb,
   'Twin-level pressurized officer quarters expanding reserve berths and stabilizing crew morale.'),
  ('MOD_SCANNER_DEEPCORE', 'Deep-Core Scanner Link', 'MID', 'UTILITY_DRONE', 'Deep-Core Scanner Link', 'Miners Guild', 'UNCOMMON', 12.0, 22.0, 740,
   '{"miningRateBonus":0.14,"rareOreLuckBonus":0.12,"scannerRangeBonus":30,"subtype":"Deep-Core Scanner Link"}'::jsonb,
   'Sub-surface seismic lidar node paired with Miner & Geologist telemetry consoles.'),
  ('MOD_BIO_TELEMETRY_NODE', 'Automated Bio-Telemetry Node', 'LOW', 'COMMERCE', 'Bio-Telemetry Node', 'Phorid Bio-Foundry', 'UNCOMMON', 10.0, 24.0, 820,
   '{"researchYieldBonus":0.16,"crewCapacityBonus":4,"moraleBonus":0.08,"subtype":"Bio-Telemetry Node"}'::jsonb,
   'Cryo-linked specimen analysis bus feeding live orbital telemetry to onboard Science Officers.')
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


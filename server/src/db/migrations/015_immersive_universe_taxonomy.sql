-- 015_immersive_universe_taxonomy.sql
-- Milestone 1.0: 15x3 Planet Taxonomy, Xenodex Species Discovery Log & Procedural Hardware Subtypes

-- 1. Extend planets table with 15x3 Taxonomy, Sheet geophysical ratings & palette
ALTER TABLE planets
  ADD COLUMN IF NOT EXISTS main_class VARCHAR(48),
  ADD COLUMN IF NOT EXISTS subtype VARCHAR(64),
  ADD COLUMN IF NOT EXISTS abundance_rating INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tectonics_rating INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS atmosphere_rating INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS density_rating INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS orbit_index INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS planet_palette JSONB;

CREATE INDEX IF NOT EXISTS idx_planets_sector_orbit ON planets(sector_id, orbit_index);
CREATE INDEX IF NOT EXISTS idx_planets_subtype ON planets(subtype);

-- 2. Enrich Canonical Sectors 1-5 Planets (preserving exact IDs and legacy archetypes)
UPDATE planets SET
  main_class = 'METALLIC_ORE',
  subtype = 'Auric Lode',
  abundance_rating = 10,
  tectonics_rating = 2,
  atmosphere_rating = 1,
  density_rating = 8,
  orbit_index = 1,
  planet_palette = '{"base":"#451a03","band1":"#d97706","band2":"#78350f","accent":"#fde047","glow":"#fbbf24","atmosphere":"#f59e0b","patternStyle":"CRATERED","hasRings":false,"hasClouds":false,"emissiveStrength":0.3}'::jsonb
WHERE id = 'planet_sec1_aegis';

UPDATE planets SET
  main_class = 'PYRO_TECTONIC',
  subtype = 'Magmatic Crucible',
  abundance_rating = 8,
  tectonics_rating = 10,
  atmosphere_rating = 6,
  density_rating = 7,
  orbit_index = 1,
  planet_palette = '{"base":"#1c1917","band1":"#ea580c","band2":"#44403c","accent":"#facc15","glow":"#f97316","atmosphere":"#fb923c","patternStyle":"MAGMA_FISSURE","hasRings":false,"hasClouds":false,"emissiveStrength":0.85}'::jsonb
WHERE id = 'planet_sec2_charybdis';

UPDATE planets SET
  main_class = 'PRECURSOR_ANOMALOUS',
  subtype = 'Xenolithic Vault',
  abundance_rating = 8,
  tectonics_rating = 2,
  atmosphere_rating = 3,
  density_rating = 8,
  orbit_index = 1,
  planet_palette = '{"base":"#1e1b4b","band1":"#9333ea","band2":"#312e81","accent":"#f0abfc","glow":"#a855f7","atmosphere":"#a855f7","patternStyle":"PRECURSOR_GLYPH","hasRings":false,"hasClouds":false,"emissiveStrength":0.75}'::jsonb
WHERE id = 'planet_sec3_ignis';

UPDATE planets SET
  main_class = 'FUNGAL_MYCELIAL',
  subtype = 'Mycelial Superorganism',
  abundance_rating = 8,
  tectonics_rating = 2,
  atmosphere_rating = 7,
  density_rating = 4,
  orbit_index = 1,
  planet_palette = '{"base":"#1e1b4b","band1":"#10b981","band2":"#6d28d9","accent":"#5eead4","glow":"#34d399","atmosphere":"#10b981","patternStyle":"MYCELIAL_WEB","hasRings":false,"hasClouds":true,"emissiveStrength":0.65}'::jsonb
WHERE id = 'planet_sec4_mycelia';

UPDATE planets SET
  main_class = 'GAS_ICE_GIANT',
  subtype = 'Jovian Hydrogen',
  abundance_rating = 7,
  tectonics_rating = 0,
  atmosphere_rating = 10,
  density_rating = 2,
  orbit_index = 1,
  planet_palette = '{"base":"#92400e","band1":"#f59e0b","band2":"#78350f","accent":"#fef3c7","glow":"#fbbf24","atmosphere":"#f59e0b","patternStyle":"BANDED","hasRings":true,"hasClouds":false,"emissiveStrength":0.12}'::jsonb
WHERE id = 'planet_sec5_skrit';

-- 3. Galactic Xenodex Discovery Table (Lazy-seeded species persistence)
CREATE TABLE IF NOT EXISTS discovered_species (
  id VARCHAR(192) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  species_uid VARCHAR(128) NOT NULL,
  planet_id VARCHAR(64) NOT NULL,
  common_name VARCHAR(128) NOT NULL,
  scientific_name VARCHAR(128) NOT NULL,
  kingdom VARCHAR(32) NOT NULL,
  species_class VARCHAR(32) NOT NULL,
  covering VARCHAR(32),
  size_meters REAL,
  trophic_role VARCHAR(48),
  adaptation_trait VARCHAR(64),
  rarity_tier VARCHAR(24) DEFAULT 'COMMON',
  genotype_json JSONB DEFAULT '{}'::jsonb,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, species_uid)
);

CREATE INDEX IF NOT EXISTS idx_discovered_species_account ON discovered_species(account_id);

-- 4. Procedural Ship Module Subtypes & Inventory Metadata
ALTER TABLE equipment_blueprints
  ADD COLUMN IF NOT EXISTS main_category VARCHAR(32),
  ADD COLUMN IF NOT EXISTS subtype VARCHAR(48);

ALTER TABLE player_inventory
  ADD COLUMN IF NOT EXISTS main_category VARCHAR(32),
  ADD COLUMN IF NOT EXISTS subtype VARCHAR(48),
  ADD COLUMN IF NOT EXISTS tech_prefix VARCHAR(48),
  ADD COLUMN IF NOT EXISTS tech_suffix VARCHAR(48);

INSERT INTO equipment_blueprints (id, name, slot_type, category, main_category, subtype, manufacturer, base_rarity, power_grid_cost, cpu_cost, base_price, base_stats, description)
VALUES
  ('MOD_SUB_LASER_TURRET', 'Laser Turret', 'HIGH', 'WEAPON', 'OFFENSE', 'Laser Turret', 'Galactic Consortium', 'COMMON', 15.0, 26.0, 520,
   '{"damage":15,"fireCooldown":0.16,"muzzleSpeed":92,"energyCost":7,"weaponType":"PULSE","subtype":"Laser Turret"}'::jsonb,
   'Coherent high-frequency beam turret delivering rapid accurate strikes with minimal capacitor drag.'),
  ('MOD_SUB_ION_CANNON', 'Ion Cannon', 'HIGH', 'WEAPON', 'OFFENSE', 'Ion Cannon', 'Galactic Consortium', 'UNCOMMON', 24.0, 38.0, 820,
   '{"damage":24,"fireCooldown":0.28,"muzzleSpeed":74,"energyCost":14,"shieldDamageBonus":1.5,"weaponType":"PULSE","subtype":"Ion Cannon"}'::jsonb,
   'Charged ion-stream ordnance specialized in stripping hostile deflector shields.'),
  ('MOD_SUB_RAILGUN', 'Railgun', 'HIGH', 'WEAPON', 'OFFENSE', 'Railgun', 'Galactic Consortium', 'RARE', 32.0, 44.0, 1150,
   '{"damage":46,"fireCooldown":0.48,"muzzleSpeed":120,"energyCost":18,"armorPierce":0.25,"weaponType":"PLASMA","subtype":"Railgun"}'::jsonb,
   'Electromagnetic hyper-velocity mass driver firing tungsten-carbide slugs through hull plating.'),
  ('MOD_SUB_TORPEDO_BAY', 'Torpedo Bay', 'HIGH', 'WEAPON', 'OFFENSE', 'Torpedo Bay', 'Galactic Consortium', 'RARE', 30.0, 48.0, 1350,
   '{"damage":64,"fireCooldown":0.72,"muzzleSpeed":54,"energyCost":24,"splashRadius":18,"weaponType":"PLASMA","subtype":"Torpedo Bay"}'::jsonb,
   'Guided heavy warhead salvo bay engineered for anti-capital hull breaches.'),
  ('MOD_SUB_SHIELD_GEN', 'Shield Generator', 'MID', 'SHIELD', 'DEFENSE', 'Shield Generator', 'Galactic Consortium', 'UNCOMMON', 26.0, 40.0, 920,
   '{"shieldCapacity":48,"shieldRecharge":7.5,"boostAmount":38,"boostCooldown":6.0,"subtype":"Shield Generator"}'::jsonb,
   'Harmonic electrostatic emitter envelope reinforcing maximum deflector capacity and recharge rate.'),
  ('MOD_SUB_HULL_PLATING', 'Hull Plating', 'LOW', 'HULL', 'DEFENSE', 'Hull Plating', 'Galactic Consortium', 'COMMON', 10.0, 8.0, 480,
   '{"maxHpBonus":36,"hazardResistance":0.15,"subtype":"Hull Plating"}'::jsonb,
   'Composite alloy bulkhead armor raising maximum structural integrity and hazard resilience.'),
  ('MOD_SUB_POWER_CORE', 'Power Core', 'LOW', 'REACTOR', 'DEFENSE', 'Power Core', 'Galactic Consortium', 'UNCOMMON', 0.0, 14.0, 740,
   '{"energyRegenMultiplier":1.18,"maxEnergyBonus":28,"subtype":"Power Core"}'::jsonb,
   'Auxiliary compact fusion manifold boosting capacitor ceiling and energy regeneration.'),
  ('MOD_SUB_ENGINEERING_BAY', 'Engineering Bay', 'LOW', 'HULL', 'DEFENSE', 'Engineering Bay', 'Galactic Consortium', 'UNCOMMON', 14.0, 28.0, 860,
   '{"hullAutoRepair":2.5,"maxHpBonus":18,"repairEfficiency":1.25,"subtype":"Engineering Bay"}'::jsonb,
   'Automated micro-welding repair rig sustaining active structural restoration during expeditions.'),
  ('MOD_SUB_PLASMA_DRIVE', 'Plasma Drive', 'MID', 'PROPULSION', 'TRAVEL', 'Plasma Drive', 'Galactic Consortium', 'UNCOMMON', 24.0, 18.0, 680,
   '{"thrustMultiplier":2.35,"maxSpeed":52,"energyDrain":34,"subtype":"Plasma Drive"}'::jsonb,
   'Magnetoplasmadynamic vectoring thruster delivering high acceleration and combat agility.'),
  ('MOD_SUB_FUEL_POD', 'Fuel Pod', 'LOW', 'PROPULSION', 'TRAVEL', 'Fuel Pod', 'Galactic Consortium', 'COMMON', 6.0, 10.0, 460,
   '{"maxFuelBonus":45,"fuelEfficiency":0.88,"subtype":"Fuel Pod"}'::jsonb,
   'Cryo-pressurized deuterium expansion tank extending deep-void hyperspace range.'),
  ('MOD_SUB_HYPERDRIVE_BOOSTER', 'Hyperdrive Booster', 'LOW', 'PROPULSION', 'TRAVEL', 'Hyperdrive Booster', 'Galactic Consortium', 'RARE', 16.0, 26.0, 1250,
   '{"warpApDiscount":2,"topSpeedBonus":20,"fuelEfficiency":0.82,"subtype":"Hyperdrive Booster"}'::jsonb,
   'Subspace warp-field compressor cutting jump lane AP draw and accelerating interstellar cruise.'),
  ('MOD_SUB_CARGO_BAY', 'Cargo Bay', 'LOW', 'CARGO', 'COMMERCE', 'Cargo Bay', 'Galactic Consortium', 'COMMON', 8.0, 10.0, 420,
   '{"cargoHoldBonus":30,"subtype":"Cargo Bay"}'::jsonb,
   'Grav-stabilized pressurized freight hold expanding merchant cargo capacity.'),
  ('MOD_SUB_CREW_POD', 'Crew Pod', 'LOW', 'CARGO', 'COMMERCE', 'Crew Pod', 'Galactic Consortium', 'UNCOMMON', 10.0, 16.0, 620,
   '{"crewCapacityBonus":18,"moraleBonus":0.1,"cargoHoldBonus":10,"subtype":"Crew Pod"}'::jsonb,
   'Modular life-support habitation wing expanding crew quarters and fleet support efficiency.'),
  ('MOD_SUB_MINING_DRONE', 'Mining Drone', 'HIGH', 'MINING', 'UTILITY_DRONE', 'Mining Drone', 'Galactic Consortium', 'UNCOMMON', 16.0, 24.0, 640,
   '{"miningPower":22,"range":55,"energyCost":10,"weaponType":"MINING","subtype":"Mining Drone"}'::jsonb,
   'Autonomous harmonic ore-extraction drone swarm dissecting planetary and asteroid strata.'),
  ('MOD_SUB_SALVAGE_DRONE', 'Salvage Drone', 'MID', 'UTILITY', 'UTILITY_DRONE', 'Salvage Drone', 'Galactic Consortium', 'UNCOMMON', 14.0, 30.0, 780,
   '{"salvageYieldBonus":0.35,"tractorRange":65,"scannerRangeBonus":25,"subtype":"Salvage Drone"}'::jsonb,
   'Magnetic tractor-recovery drone bay amplifying derelict wreck scrap yield and scan range.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slot_type = EXCLUDED.slot_type,
  category = EXCLUDED.category,
  main_category = EXCLUDED.main_category,
  subtype = EXCLUDED.subtype,
  power_grid_cost = EXCLUDED.power_grid_cost,
  cpu_cost = EXCLUDED.cpu_cost,
  base_price = EXCLUDED.base_price,
  base_stats = EXCLUDED.base_stats,
  description = EXCLUDED.description;


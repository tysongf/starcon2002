-- 008_shipyard_blueprints_and_colony_gantry.sql
-- Milestone 0.8 Day 33: Orbital Shipyard Manufacturing & Colony Industrial Gantry

-- 1. Shipyard Hull Blueprints Catalog
CREATE TABLE IF NOT EXISTS shipyard_blueprints (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    hull_class VARCHAR(64) NOT NULL,
    faction_id VARCHAR(32) NOT NULL,
    tier INT NOT NULL DEFAULT 1,
    credit_cost INT NOT NULL,
    ap_cost INT NOT NULL DEFAULT 10,
    alloy_cost INT NOT NULL DEFAULT 20,
    ore_cost INT NOT NULL DEFAULT 15,
    fuel_cost INT NOT NULL DEFAULT 10,
    required_reputation INT NOT NULL DEFAULT 0,
    base_hull INT NOT NULL,
    base_shield INT NOT NULL,
    base_speed NUMERIC(5, 2) NOT NULL,
    base_turn_rate NUMERIC(5, 2) NOT NULL,
    base_firepower INT NOT NULL,
    special_ability VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 5 Canonical Faction Hull Blueprints
INSERT INTO shipyard_blueprints (
    id, name, hull_class, faction_id, tier,
    credit_cost, ap_cost, alloy_cost, ore_cost, fuel_cost, required_reputation,
    base_hull, base_shield, base_speed, base_turn_rate, base_firepower, special_ability, description
) VALUES
(
    'HULL_SOL_CRUISER', 'Sol Vanguard Missile Cruiser', 'SOL_CRUISER', 'FACTION_SOL', 1,
    850, 8, 18, 12, 8, 10,
    150, 100, 65.0, 2.5, 35, 'POINT_DEFENSE',
    'Versatile Sol Alliance battlecruiser featuring twin kinetic rail batteries and automated point-defense flak interception.'
),
(
    'HULL_VAELIC_INTERDICTOR', 'Vaelic Imperial Interdictor', 'VAELIC_INTERDICTOR', 'FACTION_VAELIC', 2,
    1200, 10, 24, 18, 12, 15,
    180, 140, 52.0, 2.0, 45, 'PLASMA_BARRAGE',
    'Heavily shielded Hegemony warship designed to interdict hostile shipping with high-energy plasma barrages.'
),
(
    'HULL_KRYLL_RUNNER', 'Kryll Skrit Shadow-Runner', 'KRYLL_RUNNER', 'FACTION_KRYLL', 1,
    700, 6, 12, 10, 6, 5,
    100, 80, 85.0, 3.2, 28, 'DECOY_HOLO',
    'Agile cartel blockade runner equipped with holographic sensor ghost emitters to break enemy target locks.'
),
(
    'HULL_PHORID_FRIGATE', 'Phorid Bio-Spore Frigate', 'PHORID_FRIGATE', 'FACTION_PHORID', 1,
    1100, 10, 20, 14, 15, 15,
    140, 110, 68.0, 2.8, 38, 'BIO_SPORE_CLOUD',
    'Grown from bio-synthetic chitin alloys, this living frigate vents caustic spore clouds that dissolve hostile armor.'
),
(
    'HULL_LITHOS_MONITOR', 'Lithos Crystalline Monitor', 'LITHOS_MONITOR', 'FACTION_LITHOS', 2,
    1400, 12, 28, 22, 10, 10,
    220, 120, 45.0, 1.8, 50, 'SHOCKWAVE',
    'Monolithic silicon-armored dreadnought possessing resonant harmonic shockwave emitters that stagger nearby battlecraft.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    hull_class = EXCLUDED.hull_class,
    faction_id = EXCLUDED.faction_id,
    tier = EXCLUDED.tier,
    credit_cost = EXCLUDED.credit_cost,
    ap_cost = EXCLUDED.ap_cost,
    alloy_cost = EXCLUDED.alloy_cost,
    ore_cost = EXCLUDED.ore_cost,
    fuel_cost = EXCLUDED.fuel_cost,
    required_reputation = EXCLUDED.required_reputation,
    base_hull = EXCLUDED.base_hull,
    base_shield = EXCLUDED.base_shield,
    base_speed = EXCLUDED.base_speed,
    base_turn_rate = EXCLUDED.base_turn_rate,
    base_firepower = EXCLUDED.base_firepower,
    special_ability = EXCLUDED.special_ability,
    description = EXCLUDED.description;

-- 2. Add Shipyard Facility Tier to Colonies
ALTER TABLE colonies
ADD COLUMN IF NOT EXISTS shipyard_tier INT NOT NULL DEFAULT 0;


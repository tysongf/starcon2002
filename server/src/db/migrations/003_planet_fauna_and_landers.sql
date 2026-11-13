-- Migration 003: Planetary Alien Fauna, Specimen Sampling & Modular Landers

-- 1. Planetary Alien Fauna Table
CREATE TABLE IF NOT EXISTS planet_fauna (
    id VARCHAR(64) PRIMARY KEY,
    planet_id VARCHAR(64) REFERENCES planets(id) ON DELETE CASCADE,
    species_name VARCHAR(128) NOT NULL,
    species_class VARCHAR(32) NOT NULL, -- 'GRAZER', 'CARNIVORE'
    color VARCHAR(32) NOT NULL,
    base_hp INT NOT NULL DEFAULT 50,
    movement_speed NUMERIC(5, 2) NOT NULL DEFAULT 35.0,
    aggro_range NUMERIC(5, 2) NOT NULL DEFAULT 120.0,
    attack_damage INT NOT NULL DEFAULT 15,
    bio_unit_value INT NOT NULL DEFAULT 10,
    stun_duration_seconds NUMERIC(4, 1) NOT NULL DEFAULT 12.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Player Landers Table
CREATE TABLE IF NOT EXISTS player_landers (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL DEFAULT 'Vanguard Mk.I Lander',
    hull INT NOT NULL DEFAULT 100,
    max_hull INT NOT NULL DEFAULT 100,
    fuel NUMERIC(6, 2) NOT NULL DEFAULT 100.0,
    max_fuel NUMERIC(6, 2) NOT NULL DEFAULT 100.0,
    cargo_capacity INT NOT NULL DEFAULT 25,
    fitted_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planet_fauna_planet ON planet_fauna(planet_id);
CREATE INDEX IF NOT EXISTS idx_player_landers_account ON player_landers(account_id);

-- 3. Seed Canonical Planet Fauna
INSERT INTO planet_fauna (
    id, planet_id, species_name, species_class, color, base_hp, movement_speed, aggro_range, attack_damage, bio_unit_value, stun_duration_seconds
) VALUES
(
    'fauna_aegis_grazer_01',
    'planet_sec1_aegis',
    'Aegis Bio-Spore Strider',
    'GRAZER',
    '#4ade80',
    40,
    30.0,
    0.0,
    0,
    12,
    12.0
),
(
    'fauna_aegis_carnivore_01',
    'planet_sec1_aegis',
    'Silicon Mantis',
    'CARNIVORE',
    '#f87171',
    60,
    45.0,
    140.0,
    15,
    25,
    12.0
),
(
    'fauna_charybdis_grazer_01',
    'planet_sec2_charybdis',
    'Obsidian Crustacean',
    'GRAZER',
    '#38bdf8',
    50,
    25.0,
    0.0,
    0,
    15,
    12.0
),
(
    'fauna_charybdis_carnivore_01',
    'planet_sec2_charybdis',
    'Charybdian Sand Stalker',
    'CARNIVORE',
    '#ef4444',
    75,
    50.0,
    150.0,
    20,
    35,
    12.0
),
(
    'fauna_ignis_grazer_01',
    'planet_sec3_ignis',
    'Pyrite Chit-Beetle',
    'GRAZER',
    '#fbbf24',
    45,
    28.0,
    0.0,
    0,
    10,
    12.0
),
(
    'fauna_ignis_carnivore_01',
    'planet_sec3_ignis',
    'Magma Serpent',
    'CARNIVORE',
    '#f97316',
    80,
    48.0,
    140.0,
    22,
    40,
    12.0
)
ON CONFLICT (id) DO NOTHING;

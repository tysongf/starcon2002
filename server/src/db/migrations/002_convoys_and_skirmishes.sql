-- Migration 002: Faction Convoys, Contested Sector Skirmishes & Escort Contracts

-- 1. Faction Convoys Table
CREATE TABLE IF NOT EXISTS convoys (
    id VARCHAR(64) PRIMARY KEY,
    faction_id VARCHAR(32) NOT NULL,
    convoy_type VARCHAR(32) NOT NULL, -- 'COMMERCE', 'TITHE_HAULER', 'SMUGGLER', 'ORE_BARGE'
    name VARCHAR(128) NOT NULL,
    hauler_hull VARCHAR(32) NOT NULL,
    escort_count INT NOT NULL DEFAULT 2,
    cargo_manifest JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { commodityId, name, quantity, unitValue }
    origin_port_id VARCHAR(64) REFERENCES ports(id),
    destination_port_id VARCHAR(64) REFERENCES ports(id),
    current_sector_id INT NOT NULL REFERENCES sectors(id),
    target_sector_id INT REFERENCES sectors(id),
    route_path INT[] NOT NULL, -- Array of sector IDs along flight corridor e.g. [1, 2, 3]
    departure_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    arrival_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_TRANSIT', -- 'IN_TRANSIT', 'DOCKED', 'INTERDICTED', 'DESTROYED', 'SURRENDERED'
    warp_charge_seconds FLOAT NOT NULL DEFAULT 30.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Contested Sector Skirmishes Table
CREATE TABLE IF NOT EXISTS sector_skirmishes (
    id VARCHAR(64) PRIMARY KEY,
    sector_id INT NOT NULL REFERENCES sectors(id),
    initiator_faction_id VARCHAR(32) NOT NULL,
    defender_faction_id VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RESOLVED_INITIATOR', 'RESOLVED_DEFENDER', 'EXPIRED'
    influence_shift INT NOT NULL DEFAULT 15,
    hazard_level VARCHAR(16) NOT NULL DEFAULT 'HIGH', -- 'MODERATE', 'HIGH', 'EXTREME'
    briefing TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Mercenary Escort Contracts Table
CREATE TABLE IF NOT EXISTS escort_contracts (
    id VARCHAR(64) PRIMARY KEY,
    convoy_id VARCHAR(64) NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(id),
    reward_credits INT NOT NULL,
    reputation_gain INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ACCEPTED', 'COMPLETED', 'FAILED'
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_convoys_status_sector ON convoys(status, current_sector_id);
CREATE INDEX IF NOT EXISTS idx_skirmishes_sector ON sector_skirmishes(sector_id, status);
CREATE INDEX IF NOT EXISTS idx_escort_contracts_convoy ON escort_contracts(convoy_id);

-- Baseline Seed Data for Convoys
INSERT INTO convoys (
    id, faction_id, convoy_type, name, hauler_hull, escort_count,
    cargo_manifest, origin_port_id, destination_port_id, current_sector_id,
    target_sector_id, route_path, departure_time, arrival_time, status, warp_charge_seconds
) VALUES
(
    'convoy_hegemony_tithe_01',
    'FACTION_VAELIC',
    'TITHE_HAULER',
    'Vaelic Imperial Tithe Carrier IX',
    'HEGEMONY_TITHE_CARRIER',
    2,
    '[{"commodityId": "COMM_ORE", "name": "Silicate Ore", "quantity": 40, "unitValue": 70}, {"commodityId": "COMM_ALLOY", "name": "Plasteel Alloy", "quantity": 25, "unitValue": 150}]'::jsonb,
    'PORT_SMELTER_01',
    'PORT_AEGIS_01',
    2,
    1,
    ARRAY[3, 2, 1],
    NOW() - INTERVAL '2 minutes',
    NOW() + INTERVAL '4 minutes',
    'IN_TRANSIT',
    30.0
),
(
    'convoy_sol_freight_01',
    'FACTION_SOL',
    'COMMERCE',
    'Sol-Perimeter Bulk Freighter Atlas',
    'SOL_HEAVY_FREIGHTER',
    2,
    '[{"commodityId": "COMM_RATIONS", "name": "Bio-Protein Rations", "quantity": 50, "unitValue": 35}, {"commodityId": "COMM_FUEL", "name": "Deuterium Fuel", "quantity": 30, "unitValue": 20}]'::jsonb,
    'PORT_AEGIS_01',
    'PORT_SMELTER_01',
    1,
    2,
    ARRAY[1, 2, 3],
    NOW() - INTERVAL '1 minute',
    NOW() + INTERVAL '5 minutes',
    'IN_TRANSIT',
    30.0
),
(
    'convoy_kryll_smuggler_01',
    'FACTION_KRYLL',
    'SMUGGLER',
    'Cartel Shadow Runner Skrit-Luck',
    'KRYLL_BLOCKADE_RUNNER',
    1,
    '[{"commodityId": "COMM_CONTRABAND", "name": "Neuro-Stimulant Ampoules", "quantity": 15, "unitValue": 280}]'::jsonb,
    'PORT_SMELTER_01',
    'PORT_AEGIS_01',
    2,
    1,
    ARRAY[3, 2, 1],
    NOW(),
    NOW() + INTERVAL '3 minutes',
    'IN_TRANSIT',
    25.0
)
ON CONFLICT (id) DO NOTHING;

-- Baseline Seed Data for Contested Sector Skirmishes
INSERT INTO sector_skirmishes (
    id, sector_id, initiator_faction_id, defender_faction_id, status, influence_shift, hazard_level, briefing, start_time, expires_at
) VALUES
(
    'skirmish_sec2_hegemony_kryll',
    2,
    'FACTION_VAELIC',
    'FACTION_KRYLL',
    'ACTIVE',
    20,
    'HIGH',
    'Vaelic interdictor patrols have intercepted a Kryll Free Cartel raiding party near the Charybdis jump corridor. Heavy plasma and flak fire detected.',
    NOW(),
    NOW() + INTERVAL '45 minutes'
)
ON CONFLICT (id) DO NOTHING;

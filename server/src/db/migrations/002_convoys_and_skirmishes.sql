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

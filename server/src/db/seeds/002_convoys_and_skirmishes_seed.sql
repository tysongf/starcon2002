-- Seed 002: Faction Convoys, Sector Skirmishes & Escort Contracts

-- 1. Faction Convoys
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

-- 2. Contested Sector Skirmishes
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

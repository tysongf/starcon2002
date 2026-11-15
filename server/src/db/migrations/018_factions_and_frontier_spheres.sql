-- 018_factions_and_frontier_spheres.sql
-- Milestone 1.3: Extensible 8-Faction Universe, Frontier Star Systems (61-66),
-- Frontier Ports, Planet Anchors & 8-Class Hull Backfill

-- 1. Backfill split CRUISER / DREADNOUGHT main_hull_class on ships & player_fleet
UPDATE ships
SET main_hull_class = CASE
  WHEN UPPER(hull_class) IN ('SOL_CRUISER', 'VAELIC_CRUISER', 'PHORID_CRUISER', 'KRYLL_CRUISER', 'LITHOS_CRUISER', 'WARDEN_CRUISER', 'MINERS_CRUISER', 'FREEBOOTER_CRUISER') THEN 'CRUISER'
  ELSE 'DREADNOUGHT'
END
WHERE main_hull_class = 'CRUISER_DREADNOUGHT';

UPDATE player_fleet
SET main_hull_class = CASE
  WHEN UPPER(hull_class) IN ('SOL_CRUISER', 'VAELIC_CRUISER', 'PHORID_CRUISER', 'KRYLL_CRUISER', 'LITHOS_CRUISER', 'WARDEN_CRUISER', 'MINERS_CRUISER', 'FREEBOOTER_CRUISER') THEN 'CRUISER'
  ELSE 'DREADNOUGHT'
END
WHERE main_hull_class = 'CRUISER_DREADNOUGHT';

-- 2. Realign Precursor Neutron Vault Systems (51-53) to Remnant Precursor Wardens
UPDATE sectors
SET controlling_faction = 'FACTION_WARDENS',
    connected_sectors = CASE
      WHEN id = 51 THEN '[52]'::jsonb
      WHEN id = 52 THEN '[51, 53]'::jsonb
      WHEN id = 53 THEN '[52]'::jsonb
      ELSE connected_sectors
    END
WHERE id IN (51, 52, 53);

-- 3. Seed Frontier Star Systems (Sectors 61-66) for Deep-Core Miners Guild & Freebooter Armada
INSERT INTO sectors (id, name, system_seed, controlling_faction, connected_sectors, coordinates_x, coordinates_y, spectral_class, star_radius, hazard_level, description)
VALUES
  (61, 'Deep-Core Foundry Hub', 6161, 'FACTION_MINERS_GUILD', '[62, 63]'::jsonb, 790.0, 440.0, 'ORANGE_K', 1.4, 2, 'Primary industrial headquarters of the Deep-Core Miners Guild, ringed by robotic ore crushers and heavy alloy foundries.'),
  (62, 'Borehole Vein 9', 6262, 'FACTION_MINERS_GUILD', '[61, 63]'::jsonb, 835.0, 470.0, 'RED_M', 0.9, 3, 'Dense iron-silicate debris belt riddled with seismic strip-drills and union ore haulers.'),
  (63, 'Slag Furnace Expanse', 6363, 'FACTION_MINERS_GUILD', '[61, 62]'::jsonb, 815.0, 395.0, 'YELLOW_G', 1.2, 2, 'Thermal refining nexus orbiting an active yellow star powering continuous plasma-kiln freighters.'),
  (64, 'Cutthroat Cove', 6464, 'FACTION_FREEBOOTERS', '[65, 66]'::jsonb, 260.0, 620.0, 'RED_M', 0.8, 3, 'Infamous black-flag anchorage of the Freebooter Armada tucked behind magnetized scrap barricades.'),
  (65, 'Bloodwake Shoals', 6565, 'FACTION_FREEBOOTERS', '[64, 66]'::jsonb, 220.0, 575.0, 'ORANGE_K', 1.0, 4, 'Treacherous corsair ambush corridor choked with gutted freighter hulks and plasma-flare reefs.'),
  (66, 'Red-Flag Bastion', 6666, 'FACTION_FREEBOOTERS', '[64, 65]'::jsonb, 195.0, 650.0, 'BLUE_O', 1.5, 4, 'Outer Freebooter gun-platform cluster staging long-range commerce raids against Guild and Sol convoys.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  controlling_faction = EXCLUDED.controlling_faction,
  connected_sectors = EXCLUDED.connected_sectors,
  coordinates_x = EXCLUDED.coordinates_x,
  coordinates_y = EXCLUDED.coordinates_y,
  spectral_class = EXCLUDED.spectral_class,
  star_radius = EXCLUDED.star_radius,
  hazard_level = EXCLUDED.hazard_level,
  description = EXCLUDED.description;

-- 4. Seed Frontier Orbital Ports for the 3 New Factions
INSERT INTO ports (id, name, sector_id, port_class, faction_id, tariff_rate)
VALUES
  ('PORT_WARDEN_01', 'Chronicle Reliquary Station', 52, 2, 'FACTION_WARDENS', 0.06),
  ('PORT_MINERS_01', 'Deep-Core Foundry Rig 7', 61, 1, 'FACTION_MINERS_GUILD', 0.04),
  ('PORT_FREEBOOTER_01', 'Cutthroat Cove Black-Dock', 64, 2, 'FACTION_FREEBOOTERS', 0.08)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sector_id = EXCLUDED.sector_id,
  faction_id = EXCLUDED.faction_id,
  tariff_rate = EXCLUDED.tariff_rate;

-- 5. Seed Market Commodity Pools on Frontier Ports
INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
VALUES
  ('PORT_WARDEN_01', 'COMM_FUEL', 1200, 800, 3000, 29.0, 31.5),
  ('PORT_WARDEN_01', 'COMM_RATIONS', 600, 900, 2000, 46.0, 49.5),
  ('PORT_WARDEN_01', 'COMM_ORE', 500, 1400, 2500, 58.0, 63.0),
  ('PORT_WARDEN_01', 'COMM_ALLOY', 700, 900, 2000, 138.0, 145.0),
  ('PORT_WARDEN_01', 'COMM_BIO_SPECIMENS', 60, 220, 450, 96.0, 102.0),

  ('PORT_MINERS_01', 'COMM_FUEL', 1400, 1000, 3500, 25.5, 27.5),
  ('PORT_MINERS_01', 'COMM_RATIONS', 400, 1600, 2200, 54.0, 58.0),
  ('PORT_MINERS_01', 'COMM_ORE', 3100, 200, 5000, 31.0, 34.0),
  ('PORT_MINERS_01', 'COMM_ALLOY', 1650, 350, 3000, 109.0, 116.0),
  ('PORT_MINERS_01', 'COMM_BIO_SPECIMENS', 15, 160, 350, 88.0, 92.0),

  ('PORT_FREEBOOTER_01', 'COMM_FUEL', 950, 1300, 2800, 30.5, 33.5),
  ('PORT_FREEBOOTER_01', 'COMM_RATIONS', 700, 1200, 2200, 49.0, 53.0),
  ('PORT_FREEBOOTER_01', 'COMM_ORE', 900, 1100, 2500, 48.0, 52.0),
  ('PORT_FREEBOOTER_01', 'COMM_ALLOY', 950, 850, 2200, 126.0, 134.0),
  ('PORT_FREEBOOTER_01', 'COMM_BIO_SPECIMENS', 40, 200, 400, 94.0, 99.0)
ON CONFLICT (port_id, commodity_id) DO NOTHING;

-- 6. Seed Planetary Anchors for Sectors 61-66
INSERT INTO planets (
  id, sector_id, name, main_class, subtype, radius, pos_x, pos_y, pos_z, texture_seed, orbit_index,
  atmosphere_color, atmosphere_density, surface_temp_k, hazard_class, habitability_rating,
  abundance_rating, tectonics_rating, atmosphere_rating, density_rating, controlling_faction, planet_palette, description
)
VALUES
  ('planet_sec61_foundry', 61, 'Foundry Rock VII', 'METALLIC_ORE', 'Ferrous Ridge', 25.0, 145.0, 0.0, -135.0, 6101, 1,
   '#f97316', 0.18, 410, 'SEISMIC_TREMORS', 12, 10, 7, 2, 9, 'FACTION_MINERS_GUILD',
   '{"base":"#431407","band1":"#f97316","band2":"#7c2d12","accent":"#fdba74","glow":"#fb923c","atmosphere":"#f97316","patternStyle":"CRATERED","hasRings":false,"hasClouds":false,"emissiveStrength":0.45}'::jsonb,
   'Dense metallic planetoid cored by automated Deep-Core Guild strip shafts.'),
  ('planet_sec62_borehole', 62, 'Veinworld Nine', 'PYRO_TECTONIC', 'Magmatic Crucible', 23.0, -165.0, 0.0, 120.0, 6201, 1,
   '#ea580c', 0.65, 690, 'EXTREME_THERMAL', 6, 9, 9, 4, 8, 'FACTION_MINERS_GUILD',
   '{"base":"#1c1917","band1":"#dc2626","band2":"#7c2d12","accent":"#fde047","glow":"#f97316","atmosphere":"#ea580c","patternStyle":"MAGMA_FISSURE","hasRings":false,"hasClouds":false,"emissiveStrength":0.78}'::jsonb,
   'Fractured volcanic crust venting rare tungsten-silicate ore plumes.'),
  ('planet_sec63_slag', 63, 'Kiln Prime', 'METALLIC_ORE', 'Auric Lode', 26.0, 175.0, 0.0, 140.0, 6301, 1,
   '#fbbf24', 0.22, 355, 'LOW_RADIATION', 18, 9, 4, 3, 8, 'FACTION_MINERS_GUILD',
   '{"base":"#3f2e12","band1":"#d97706","band2":"#78350f","accent":"#fef08a","glow":"#f59e0b","atmosphere":"#fbbf24","patternStyle":"CRATERED","hasRings":true,"hasClouds":false,"emissiveStrength":0.3}'::jsonb,
   'Ringed slag-shepherd world supporting orbital ore refinement platforms.'),
  ('planet_sec64_cove', 64, 'Cutthroat Crag', 'ICE_CRYO', 'Methane Glacier', 22.0, -140.0, 0.0, -160.0, 6401, 1,
   '#fb7185', 0.35, 130, 'SUBZERO_TEMP', 14, 7, 3, 4, 5, 'FACTION_FREEBOOTERS',
   '{"base":"#1e1b4b","band1":"#be123c","band2":"#312e81","accent":"#fda4af","glow":"#fb7185","atmosphere":"#e11d48","patternStyle":"GLACIAL","hasRings":false,"hasClouds":false,"emissiveStrength":0.35}'::jsonb,
   'Frozen corsair sanctuary hiding subterranean fuel cisterns beneath nitrogen glaciers.'),
  ('planet_sec65_shoals', 65, 'Bloodwake Drift-IV', 'PYRO_TECTONIC', 'Sulfur Caldera', 24.0, 155.0, 0.0, -125.0, 6501, 1,
   '#f43f5e', 0.72, 540, 'CORROSIVE_STORMS', 8, 8, 8, 6, 7, 'FACTION_FREEBOOTERS',
   '{"base":"#270915","band1":"#e11d48","band2":"#4c0519","accent":"#fecdd3","glow":"#f43f5e","atmosphere":"#fb7185","patternStyle":"MAGMA_FISSURE","hasRings":false,"hasClouds":true,"emissiveStrength":0.72}'::jsonb,
   'Storm-lashed volcanic rock masking Freebooter ambush beacons.'),
  ('planet_sec66_bastion', 66, 'Red-Flag Monolith', 'PRECURSOR_ANOMALOUS', 'Xenolithic Vault', 27.0, -180.0, 0.0, 150.0, 6601, 1,
   '#fb7185', 0.42, 195, 'IONIC_DISRUPTIONS', 22, 8, 2, 4, 8, 'FACTION_FREEBOOTERS',
   '{"base":"#18181b","band1":"#be123c","band2":"#27272a","accent":"#fda4af","glow":"#fb7185","atmosphere":"#f43f5e","patternStyle":"PRECURSOR_GLYPH","hasRings":true,"hasClouds":false,"emissiveStrength":0.65}'::jsonb,
   'Captured outlier bastion anchored beside a dormant Precursor relay ring.')
ON CONFLICT (id) DO NOTHING;

-- 7. Seed default standings for new factions on any existing accounts
INSERT INTO faction_standings (account_id, faction_id, standing)
SELECT a.id, v.faction_id, v.standing
FROM accounts a
CROSS JOIN (
  VALUES
    ('FACTION_WARDENS', 0),
    ('FACTION_MINERS_GUILD', 10),
    ('FACTION_FREEBOOTERS', -15)
) AS v(faction_id, standing)
ON CONFLICT (account_id, faction_id) DO NOTHING;


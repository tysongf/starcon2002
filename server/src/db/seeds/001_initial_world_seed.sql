-- initial_world_seed.sql
-- Wayward Void Initial World Seed Data

-- 1. Pilot Account & Ship
INSERT INTO accounts (id, username, callsign, credits, faction_id)
VALUES ('acc_sol_captain', 'cmdr_vance', 'Vance', 2500, 'FACTION_SOL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ships (id, account_id, hull_class, hull_seed, current_sector_id, fuel, max_fuel, armor, max_armor, shield, max_shield, cargo_capacity)
VALUES ('ship_sol_flagship', 'acc_sol_captain', 'CORVETTE', 12345, 1, 100, 100, 100, 100, 100, 100, 40)
ON CONFLICT (id) DO NOTHING;

-- 2. Sectors (1 Sol, 2 Void, 3 Smelter, 4 Phorid, 5 Kryll)
INSERT INTO sectors (id, name, system_seed, controlling_faction, connected_sectors)
VALUES 
  (1, 'Sol-Perimeter Nexus', 101, 'FACTION_SOL', '[2]'::jsonb),
  (2, 'Void Expanse Hazard Zone', 202, 'FACTION_SOL', '[1, 3]'::jsonb),
  (3, 'Obsidian Smelter Station', 303, 'FACTION_LITHOS', '[2, 4, 5]'::jsonb),
  (4, 'Mycelia Spore Reach', 404, 'FACTION_PHORID', '[3]'::jsonb),
  (5, 'Skrit Cartel Drift', 505, 'FACTION_KRYLL', '[3]'::jsonb)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  system_seed = EXCLUDED.system_seed,
  controlling_faction = EXCLUDED.controlling_faction,
  connected_sectors = EXCLUDED.connected_sectors;

-- 3. Ports
INSERT INTO ports (id, name, sector_id, port_class, faction_id, tariff_rate)
VALUES 
  ('PORT_AEGIS_01', 'Aegis Terminal', 1, 1, 'FACTION_SOL', 0.05),
  ('PORT_SMELTER_01', 'Obsidian Foundry 3', 3, 2, 'FACTION_LITHOS', 0.06)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  sector_id = EXCLUDED.sector_id,
  port_class = EXCLUDED.port_class,
  tariff_rate = EXCLUDED.tariff_rate;

-- 4. Port Commodity Inventories
INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
VALUES 
  ('PORT_AEGIS_01', 'COMM_FUEL', 2450, 500, 4000, 24.5, 26.2),
  ('PORT_AEGIS_01', 'COMM_RATIONS', 1200, 600, 2000, 38.0, 41.5),
  ('PORT_AEGIS_01', 'COMM_ORE', 400, 1800, 2500, 62.0, 68.0),
  ('PORT_AEGIS_01', 'COMM_ALLOY', 450, 900, 1500, 152.0, 160.0),
  ('PORT_SMELTER_01', 'COMM_FUEL', 750, 1200, 2500, 32.0, 35.0),
  ('PORT_SMELTER_01', 'COMM_RATIONS', 550, 1400, 2000, 52.0, 56.5),
  ('PORT_SMELTER_01', 'COMM_ORE', 2300, 300, 4000, 35.0, 38.0),
  ('PORT_SMELTER_01', 'COMM_ALLOY', 1250, 400, 2500, 115.0, 122.0)
ON CONFLICT (port_id, commodity_id) DO UPDATE SET 
  stock = EXCLUDED.stock,
  demand = EXCLUDED.demand,
  buy_price = EXCLUDED.buy_price,
  sell_price = EXCLUDED.sell_price;

-- 5. Persistent Scavengers
INSERT INTO persistent_scavengers (id, sector_id, faction_id, hull_type, current_hp, current_shields, pos_x, pos_z, looted_cargo, transponder_active)
VALUES 
  ('scavenger_salvage_01', 2, 'Scavenger Guild', 'Vulture-Class Salvager', 95, 40, -18.0, 16.0, '[{"name": "Titanium Scrap", "quantity": 12, "unitValue": 90}]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Revenge Contracts
INSERT INTO contracts (id, creator_account_id, contract_type, target_scavenger_id, target_name, target_entity_id, is_public, reward_credits, status)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'acc_sol_captain', 'REVENGE_BOUNTY', 'scavenger_salvage_01', 'Vulture-01 [Scavenger Guild]', 'scavenger_salvage_01', true, 2500, 'OPEN')
ON CONFLICT (id) DO NOTHING;

-- 7. Equipment Blueprints Catalog
INSERT INTO equipment_blueprints (id, name, slot_type, main_category, subtype, manufacturer, base_rarity, power_grid_cost, cpu_cost, base_price, base_stats, description)
VALUES
  ('MOD_PULSE_01', 'Sol-Standard Pulse Cannon', 'HIGH', 'OFFENSE', 'Laser Turret', 'Sol Industrial', 'COMMON', 16.0, 30.0, 450, 
   '{"damage": 14, "fireCooldown": 0.16, "muzzleSpeed": 78, "energyCost": 8, "weaponType": "PULSE"}'::jsonb, 
   'Standard high-velocity kinetic pulse battery. Low capacitor draw with high cycle rate.'),
  
  ('MOD_PLASMA_01', 'Vaelic Heavy Plasma Accelerator', 'HIGH', 'OFFENSE', 'Railgun', 'Vaelic Ironworks', 'RARE', 35.0, 55.0, 1200, 
   '{"damage": 44, "fireCooldown": 0.45, "muzzleSpeed": 48, "energyCost": 22, "weaponType": "PLASMA"}'::jsonb, 
   'High-impact superheated plasma bolt. Deals devastating hull damage at the cost of high capacitor consumption.'),
  
  ('MOD_FLAK_01', 'Phorid Scatter Flak Blaster', 'HIGH', 'OFFENSE', 'Ion Cannon', 'Phorid Biotech', 'UNCOMMON', 22.0, 40.0, 750, 
   '{"damage": 13, "fireCooldown": 0.35, "muzzleSpeed": 66, "energyCost": 18, "weaponType": "FLAK", "pellets": 3}'::jsonb, 
   'Tri-pellet scattershot cannon designed for close-quarters dogfighting and point defense.'),
  
  ('MOD_MINING_01', 'Lithos Focused Mining Laser', 'HIGH', 'UTILITY_DRONE', 'Mining Drone', 'Lithos Axiom', 'COMMON', 18.0, 25.0, 500, 
   '{"miningPower": 15, "range": 45, "energyCost": 12, "weaponType": "MINING"}'::jsonb, 
   'Harmonic resonance beam tuned for dissecting planetary ore deposits and derelict spacecraft hulls.'),
  
  ('MOD_AFTERBURNER_01', 'Overdrive Afterburner Core', 'MID', 'TRAVEL', 'Plasma Drive', 'Sol Industrial', 'UNCOMMON', 30.0, 20.0, 600, 
   '{"thrustMultiplier": 2.2, "maxSpeed": 48, "energyDrain": 38}'::jsonb, 
   'Direct reactor injection manifold that delivers a 2.2x emergency combat thrust boost on Shift.'),
  
  ('MOD_SHIELD_01', 'Vaelic Bulwark Shield Matrix', 'MID', 'DEFENSE', 'Shield Generator', 'Vaelic Ironworks', 'RARE', 28.0, 45.0, 950, 
   '{"shieldCapacity": 40, "shieldRecharge": 6.0, "boostAmount": 35, "boostCooldown": 6.0}'::jsonb, 
   'Hexagonal electrostatic emitter matrix that reinforces maximum shield capacity and passive dissipation.'),
  
  ('MOD_ECM_01', 'Lithos Resonant Sensor Jammer', 'MID', 'UTILITY_DRONE', 'Salvage Drone', 'Lithos Axiom', 'EPIC', 22.0, 50.0, 1400, 
   '{"lockBreakRadius": 60, "cooldown": 12.0}'::jsonb, 
   'Emits broad-spectrum electromagnetic interference that disrupts hostile radar lock-on acquisition.'),
  
  ('MOD_REACTOR_01', 'Vaelic Compact Reactor Core', 'LOW', 'DEFENSE', 'Power Core', 'Vaelic Ironworks', 'UNCOMMON', 0.0, 15.0, 650, 
   '{"energyRegenMultiplier": 1.15, "maxEnergyBonus": 20}'::jsonb, 
   'Auxiliary fusion reactor augment that increases ship capacitor capacity and regeneration rate by 15%.'),
  
  ('MOD_ARMOR_01', 'Reinforced Plasteel Armor Plating', 'LOW', 'DEFENSE', 'Hull Plating', 'Sol Industrial', 'COMMON', 12.0, 0.0, 400, 
   '{"maxHpBonus": 25}'::jsonb, 
   'Dense multilayer plasteel sheets welded to ship bulkheads, providing +25 maximum Hull Integrity.'),
  
  ('MOD_CARGO_01', 'Expanded Hold Nanofiber Rig', 'LOW', 'COMMERCE', 'Cargo Bay', 'Phorid Biotech', 'COMMON', 8.0, 10.0, 350, 
   '{"cargoHoldBonus": 20}'::jsonb, 
   'Pressurized micro-lattice storage bays expanding hold volume by 20 cubic meters.')
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

-- 8. Prototype Precursor Blueprints
INSERT INTO equipment_blueprints (id, name, slot_type, main_category, subtype, manufacturer, base_rarity, power_grid_cost, cpu_cost, base_price, base_stats, description)
VALUES
  ('BP_PRECURSOR_PHASE_LANCE', 'Precursor Phase Lance', 'HIGH', 'OFFENSE', 'Torpedo Bay', 'Precursor Builders', 'LEGENDARY', 18.0, 24.0, 5000,
   '{"damage": 145, "fireCooldown": 1.2, "energyCost": 28, "shieldPierce": 0.75, "range": 450}',
   'Ancient Precursor beam projector that discharges coherent harmonic phase energy, bypassing 75% of conventional deflector shielding.'),
  ('BP_PRECURSOR_TACHYON_DRIVE', 'Tachyon Warp Accelerator', 'LOW', 'TRAVEL', 'Hyperdrive Booster', 'Precursor Builders', 'LEGENDARY', 14.0, 18.0, 4500,
   '{"warpApDiscount": 3, "topSpeedBonus": 35, "fuelEfficiency": 0.5}',
   'Subspace tachyon folding engine that compresses jump lane transit, reducing sector warp AP expenditure by 3 AP and halving fuel burn.'),
  ('BP_PRECURSOR_CRYSTAL_SHIELD', 'Crystalline Matrix Shield', 'MID', 'DEFENSE', 'Shield Generator', 'Precursor Builders', 'LEGENDARY', 16.0, 22.0, 4800,
   '{"maxShield": 350, "rechargeRate": 45, "harmonicDamping": 0.4}',
   'Resonant crystalline shield array that rapidly restores deflector integrity under sustained kinetic or thermal bombardment.'),
  ('BP_PRECURSOR_BIOSPHERE_GEN', 'Living Biosphere Matrix', 'LOW', 'DEFENSE', 'Engineering Bay', 'Precursor Builders', 'LEGENDARY', 10.0, 15.0, 4000,
   '{"colonyHabitationBonus": 25, "populationGrowthMultiplier": 1.5}',
   'Compact biome synthesis core that enhances planetary environmental stabilization, providing +25% colony habitability rating.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slot_type = EXCLUDED.slot_type,
  main_category = EXCLUDED.main_category,
  subtype = EXCLUDED.subtype,
  manufacturer = EXCLUDED.manufacturer,
  base_rarity = EXCLUDED.base_rarity,
  base_stats = EXCLUDED.base_stats,
  description = EXCLUDED.description;

-- 9. Initial Player Inventory (Fitted 2H/2M/2L + Locker items)
INSERT INTO player_inventory (id, account_id, blueprint_id, custom_name, rarity, affixes, main_category, subtype, is_fitted, fit_slot)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-111111111111', 'acc_sol_captain', 'MOD_PULSE_01', 'Sol-Standard Pulse Cannon', 'COMMON', '[]'::jsonb, 'OFFENSE', 'Laser Turret', true, 'H1'),
  ('a1b2c3d4-e5f6-7890-abcd-222222222222', 'acc_sol_captain', 'MOD_PLASMA_01', 'Calibrated Vaelic Plasma Accelerator', 'RARE', '[{"stat": "damage", "multiplier": 1.15}]'::jsonb, 'OFFENSE', 'Railgun', true, 'H2'),
  ('a1b2c3d4-e5f6-7890-abcd-333333333333', 'acc_sol_captain', 'MOD_AFTERBURNER_01', 'Overdrive Afterburner Core', 'UNCOMMON', '[{"stat": "maxSpeed", "multiplier": 1.08}]'::jsonb, 'TRAVEL', 'Plasma Drive', true, 'M1'),
  ('a1b2c3d4-e5f6-7890-abcd-444444444444', 'acc_sol_captain', 'MOD_FLAK_01', 'Scatter Flak Blaster of Ruin', 'EPIC', '[{"stat": "damage", "multiplier": 1.25}]'::jsonb, 'OFFENSE', 'Ion Cannon', true, 'M2'),
  ('a1b2c3d4-e5f6-7890-abcd-555555555555', 'acc_sol_captain', 'MOD_REACTOR_01', 'Vaelic Compact Reactor Core Mk II', 'UNCOMMON', '[]'::jsonb, 'DEFENSE', 'Power Core', true, 'L1'),
  ('a1b2c3d4-e5f6-7890-abcd-666666666666', 'acc_sol_captain', 'MOD_ARMOR_01', 'Reinforced Plasteel Armor Plating', 'COMMON', '[]'::jsonb, 'DEFENSE', 'Hull Plating', true, 'L2'),
  ('a1b2c3d4-e5f6-7890-abcd-777777777777', 'acc_sol_captain', 'MOD_MINING_01', 'Lithos Focused Mining Laser', 'COMMON', '[]'::jsonb, 'UTILITY_DRONE', 'Mining Drone', false, NULL),
  ('a1b2c3d4-e5f6-7890-abcd-888888888888', 'acc_sol_captain', 'MOD_CARGO_01', 'Expanded Hold Nanofiber Rig', 'COMMON', '[]'::jsonb, 'COMMERCE', 'Cargo Bay', false, NULL)
ON CONFLICT (id) DO NOTHING;

-- 10. Initial Derelict Wrecks in Sector 2
INSERT INTO wrecks (id, sector_id, ship_name, ship_class, faction, x, y, z, rotation, scrap_remaining, max_scrap, hull_intactness)
VALUES 
  ('wreck_ancient_cruiser_01', 2, 'Derelict Hegemony Cruiser', 'Hegemony Vanguard', 'Hegemony Drone Fleet', 35.0, 0.0, -45.0, 0.78, 250, 250, 0.85),
  ('wreck_freighter_derelict_02', 2, 'Shattered Bulk Hauler Wreck', 'Mammoth Industrial', 'Independent Traders', -50.0, 0.0, 25.0, 2.35, 180, 180, 0.60)
ON CONFLICT (id) DO UPDATE SET
  scrap_remaining = EXCLUDED.scrap_remaining,
  max_scrap = EXCLUDED.max_scrap,
  hull_intactness = EXCLUDED.hull_intactness;

-- 11. Baseline Faction Standings
INSERT INTO faction_standings (account_id, faction_id, standing)
VALUES
  ('acc_sol_captain', 'FACTION_SOL', 35),
  ('acc_sol_captain', 'FACTION_HEGEMONY', -25),
  ('acc_sol_captain', 'FACTION_PHORID', 15),
  ('acc_sol_captain', 'FACTION_KRYLL', 5),
  ('acc_sol_captain', 'FACTION_LITHOS', 0)
ON CONFLICT (account_id, faction_id) DO NOTHING;

-- 12. Celestial Planets
INSERT INTO planets (id, sector_id, name, main_class, subtype, radius, pos_x, pos_y, pos_z, texture_seed, orbit_index, atmosphere_color, atmosphere_density, surface_temp_k, hazard_class, habitability_rating, abundance_rating, tectonics_rating, atmosphere_rating, density_rating, controlling_faction, planet_palette, description)
VALUES
  ('planet_sec1_aegis', 1, 'Aegis Prime', 'METALLIC_ORE', 'Auric Lode', 24.0, -140.0, 0.0, 180.0, 101, 1, '#38bdf8', 0.12, 215, 'LOW_RADIATION', 18, 10, 2, 1, 8, 'FACTION_SOL', '{"base":"#451a03","band1":"#d97706","band2":"#78350f","accent":"#fde047","glow":"#fbbf24","atmosphere":"#f59e0b","patternStyle":"CRATERED","hasRings":false,"hasClouds":false,"emissiveStrength":0.3}'::jsonb, 'Airless metallic moon rich in heavy silicate crust and structural plasteel strata.'),
  ('planet_sec2_charybdis', 2, 'Charybdis Minor', 'PYRO_TECTONIC', 'Magmatic Crucible', 26.0, 160.0, 0.0, -170.0, 202, 1, '#f97316', 0.85, 780, 'EXTREME_THERMAL', 5, 8, 10, 6, 7, 'FACTION_HEGEMONY', '{"base":"#1c1917","band1":"#ea580c","band2":"#44403c","accent":"#facc15","glow":"#f97316","atmosphere":"#fb923c","patternStyle":"MAGMA_FISSURE","hasRings":false,"hasClouds":false,"emissiveStrength":0.85}'::jsonb, 'Tectonically unstable lava world venting superheated sulfur and high-grade mineral ore.'),
  ('planet_sec3_ignis', 3, 'Ignis Tartarus', 'PRECURSOR_ANOMALOUS', 'Xenolithic Vault', 28.0, -180.0, 0.0, -150.0, 303, 1, '#a855f7', 0.40, 110, 'IONIC_DISRUPTIONS', 24, 8, 2, 3, 8, 'FACTION_LITHOS', '{"base":"#1e1b4b","band1":"#9333ea","band2":"#312e81","accent":"#f0abfc","glow":"#a855f7","atmosphere":"#a855f7","patternStyle":"PRECURSOR_GLYPH","hasRings":false,"hasClouds":false,"emissiveStrength":0.75}'::jsonb, 'Glaciated tomb world crisscrossed with dormant Precursor conduits and energy monoliths.'),
  ('planet_sec4_mycelia', 4, 'Mycelia IV', 'FUNGAL_MYCELIAL', 'Mycelial Superorganism', 25.0, 150.0, 0.0, 140.0, 404, 1, '#10b981', 1.05, 292, 'BIOLOGICAL_SPORES', 84, 8, 2, 7, 4, 'FACTION_PHORID', '{"base":"#1e1b4b","band1":"#10b981","band2":"#6d28d9","accent":"#5eead4","glow":"#34d399","atmosphere":"#10b981","patternStyle":"MYCELIAL_WEB","hasRings":false,"hasClouds":true,"emissiveStrength":0.65}'::jsonb, 'Lush photosynthetic planetary biome covered in dense fungal canopies and bio-protein reserves.'),
  ('planet_sec5_skrit', 5, 'Skrit-V', 'GAS_ICE_GIANT', 'Jovian Hydrogen', 34.0, -220.0, 0.0, 190.0, 505, 1, '#f59e0b', 4.50, 85, 'HIGH_PRESSURE_STORMS', 0, 7, 0, 10, 2, 'FACTION_KRYLL', '{"base":"#92400e","band1":"#f59e0b","band2":"#78350f","accent":"#fef3c7","glow":"#fbbf24","atmosphere":"#f59e0b","patternStyle":"BANDED","hasRings":true,"hasClouds":false,"emissiveStrength":0.12}'::jsonb, 'Massive banded gas giant with cryo-hydrocarbon rings suitable for Deuterium fuel skimming.')
ON CONFLICT (id) DO NOTHING;

-- 13. Precursor Megastructure Sites
INSERT INTO precursor_sites (id, planet_id, name, site_type, surface_lat, surface_lng, required_freq, required_phase, required_damping, codex_title, codex_text, relic_reward)
VALUES
  ('site_aegis_monolith', 'planet_sec1_aegis', 'Aegis Resonance Monolith', 'MONOLITH', 22.0, -40.0, 440, 180, 50,
   'Chronicles of the First Builders: The Hyper-Spatial Fold',
   'Transmission Archive #001: Before the Great Silence, the Precursor builders spanned ten thousand star systems. They did not conquer the void through sheer velocity; rather, they folded subspace using harmonic tachyon field resonators. Their celestial monoliths served as interstellar guidance beacons, anchored to planetary crusts to stabilize jump gates against cosmic shear.',
   1),
  ('site_charybdis_forge', 'planet_sec2_charybdis', 'Charybdis Geothermal Crucible', 'ENERGY_VAULT', -15.0, 60.0, 520, 240, 60,
   'Chronicles of the First Builders: Sub-Crustal Synthesis',
   'Transmission Archive #004: In the volcanic mantle of Charybdis, thermal energy was harnessed to temper crystalline phase matrices. The extreme tectonic pressures permitted the stabilization of superdense relativistic alloys.',
   2),
  ('site_ignis_vault', 'planet_sec3_ignis', 'Ignis Subterranean Energy Vault', 'ENERGY_VAULT', -35.0, 85.0, 720, 90, 75,
   'The Dark Void Resonance: The Unbroken Defense',
   'Transmission Archive #002: Beneath the permafrost of Ignis Tartarus lies an automated defensive battery constructed during the First Interstellar War. The phase lances were engineered to project high-energy coherent beams capable of bypassing polarized shields. The builders sealed the vault when the cosmic void entities breached the outer rim.',
   2),
  ('site_mycelia_conduit', 'planet_sec4_mycelia', 'Mycelia Biomorphic Matrix', 'CONDUIT_RUIN', 12.0, 145.0, 330, 270, 40,
   'Biosphere Genesis Protocols: The Living Matrix',
   'Transmission Archive #003: Planetary ecosystems across the Orion-Perimeter were not natural accidents. The builders cultivated biomorphic matrices to nurse emerging species and scrub toxic atmospheres. These harmonic bio-generators can elevate hostile worlds into thriving gardens within a single orbital generation.',
   1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  required_freq = EXCLUDED.required_freq,
  required_phase = EXCLUDED.required_phase,
  required_damping = EXCLUDED.required_damping,
  codex_title = EXCLUDED.codex_title,
  codex_text = EXCLUDED.codex_text,
  relic_reward = EXCLUDED.relic_reward;

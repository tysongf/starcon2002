-- 011_galactic_star_systems.sql
-- Milestone 0.9 Day 37: The Galactic Coordinate Engine & Unified Starmap

-- 1. Alter sectors table with continuous galactic coordinates and spectral telemetry
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS coordinates_x REAL DEFAULT 500.0,
  ADD COLUMN IF NOT EXISTS coordinates_y REAL DEFAULT 500.0,
  ADD COLUMN IF NOT EXISTS spectral_class VARCHAR(32) DEFAULT 'YELLOW_G',
  ADD COLUMN IF NOT EXISTS star_radius REAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS hazard_level INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. Add active navigation target to player ships for course-lock persistence
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS nav_target_sector_id INT REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sectors_coordinates ON sectors(coordinates_x, coordinates_y);

-- 3. Update Canonical Lore Sectors 1-5 with precise galactic coordinates
UPDATE sectors SET
  coordinates_x = 500.0,
  coordinates_y = 500.0,
  spectral_class = 'YELLOW_G',
  star_radius = 1.2,
  hazard_level = 0,
  description = 'Sol-Perimeter Nexus. The historical heart of the Sol Alliance and central trade crossroad of the charted core.'
WHERE id = 1;

UPDATE sectors SET
  coordinates_x = 535.0,
  coordinates_y = 480.0,
  spectral_class = 'BLUE_O',
  star_radius = 1.6,
  hazard_level = 3,
  description = 'Void Expanse Hazard Zone. A volatile blue supergiant cluster riddled with plasma eddies and hostile Hegemony automated patrol drones.'
WHERE id = 2;

UPDATE sectors SET
  coordinates_x = 580.0,
  coordinates_y = 460.0,
  spectral_class = 'ORANGE_K',
  star_radius = 1.1,
  hazard_level = 1,
  description = 'Obsidian Smelter Station. Heavy industrial mining system orbiting a dense orange star, governed by the Lithos Axiom foundry guild.'
WHERE id = 3;

UPDATE sectors SET
  coordinates_x = 440.0,
  coordinates_y = 540.0,
  spectral_class = 'RED_M',
  star_radius = 0.8,
  hazard_level = 2,
  description = 'Mycelia Spore Reach. Deep crimson red dwarf system enveloped by Phorid bio-nebulae and spore-bearing asteroid rings.'
WHERE id = 4;

UPDATE sectors SET
  coordinates_x = 620.0,
  coordinates_y = 520.0,
  spectral_class = 'WHITE_A',
  star_radius = 1.0,
  hazard_level = 1,
  description = 'Skrit Cartel Drift. A glittering A-type white star surrounded by freebooter scrap bastions and shadowy black-market convoys.'
WHERE id = 5;

-- 4. Seed Remaining 55 Star Systems (Sectors 6 through 60)
INSERT INTO sectors (id, name, system_seed, controlling_faction, connected_sectors, coordinates_x, coordinates_y, spectral_class, star_radius, hazard_level, description)
VALUES
  -- Sol Alliance Core & Outlying Colonies (Sectors 6-10)
  (6, 'Alpha Centauri Hub', 606, 'FACTION_SOL', '[1]'::jsonb, 480.0, 520.0, 'YELLOW_G', 1.1, 0, 'Thriving agricultural and orbital habitat hub, sister system to Sol Nexus.'),
  (7, 'Barnard''s Redoubt', 707, 'FACTION_SOL', '[1]'::jsonb, 515.0, 470.0, 'RED_M', 0.8, 1, 'Sol defensive radar listening post monitoring subspace vectors toward the Void Expanse.'),
  (8, 'Sirius Apex Prime', 808, 'FACTION_SOL', '[1]'::jsonb, 530.0, 540.0, 'WHITE_A', 1.7, 0, 'Brilliant binary beacon hosting high-tech energy research platforms and advanced military yards.'),
  (9, 'Procyon Deep Sound', 909, 'FACTION_SOL', '[1, 6]'::jsonb, 470.0, 480.0, 'YELLOW_G', 1.3, 0, 'Peaceful colonial expanse famous for deuterium refinery facilities and orbital grain silos.'),
  (10, 'Tau Ceti Reach', 1010, 'FACTION_SOL', '[6]'::jsonb, 510.0, 530.0, 'YELLOW_G', 1.0, 0, 'Sol Alliance scientific survey colony pioneering deep planetary terraforming.'),

  -- Vaelic Imperial Hegemony Sphere (Sectors 11-16)
  (11, 'Vael Prime (Imperial Throne)', 1111, 'FACTION_VAELIC', '[]'::jsonb, 350.0, 320.0, 'BLUE_O', 1.8, 4, 'Seat of the Vaelic High Command. A colossal fortress world enclosed by heavy plasma defense citadels.'),
  (12, 'Khor-Vael Gantry', 1212, 'FACTION_VAELIC', '[11]'::jsonb, 380.0, 360.0, 'BLUE_O', 1.5, 3, 'Massive orbital drydocks where Hegemony Battlecarriers and Heavy Interdictors are forged.'),
  (13, 'Interdictor Bastion 9', 1313, 'FACTION_VAELIC', '[11, 12]'::jsonb, 410.0, 390.0, 'WHITE_A', 1.4, 3, 'Forward military garrison enforcing strict blockade perimeters and high imperial tariffs.'),
  (14, 'Dread Talon Armory', 1414, 'FACTION_VAELIC', '[11]'::jsonb, 320.0, 290.0, 'RED_M', 0.9, 4, 'Volatile military proving ground test-firing heavy plasma spinal lances.'),
  (15, 'Sovereign Watch', 1515, 'FACTION_VAELIC', '[12]'::jsonb, 360.0, 270.0, 'ORANGE_K', 1.2, 2, 'Imperial border listening station triangulating unauthorized civilian warp wakes.'),
  (16, 'Iron Crucible', 1616, 'FACTION_VAELIC', '[13]'::jsonb, 430.0, 340.0, 'BLUE_O', 1.6, 3, 'Heavy plasma smelter extracting raw antimatter isotopes from stellar flares.'),

  -- Kryll Cartel Shadow Rim (Sectors 17-22)
  (17, 'Smuggler''s Notch', 1717, 'FACTION_KRYLL', '[5]'::jsonb, 680.0, 560.0, 'WHITE_A', 1.2, 2, 'Clandestine freebooter trading post hidden inside dense asteroid dust lanes.'),
  (18, 'Void Haven Anchorage', 1818, 'FACTION_KRYLL', '[17]'::jsonb, 710.0, 600.0, 'ORANGE_K', 1.0, 3, 'Notorious den of mercenaries, black-market arms dealers, and refurbished starship brokers.'),
  (19, 'Shadow Drift Corridor', 1919, 'FACTION_KRYLL', '[5, 17]'::jsonb, 650.0, 590.0, 'RED_M', 0.7, 2, 'Debris-strewn corridor famous for low-sensor cloaked cargo runs and decoy drone workshops.'),
  (20, 'Rust Nebula Depot', 2020, 'FACTION_KRYLL', '[18]'::jsonb, 720.0, 540.0, 'ORANGE_K', 1.1, 3, 'Salvage yard converting broken battle wrecks into modified pirate attack skiffs.'),
  (21, 'Scrapper''s Rest', 2121, 'FACTION_KRYLL', '[18]'::jsonb, 690.0, 630.0, 'WHITE_A', 0.9, 2, 'Frontier chop-shop famous for illegal reactor overclocking and afterburner tuning.'),
  (22, 'Black Sand Bastion', 2222, 'FACTION_KRYLL', '[19]'::jsonb, 640.0, 640.0, 'RED_M', 0.8, 3, 'Outer hideout protected by proximity mines and automated decoy transmitters.'),

  -- Lithos Axiom Harmonic Expanse (Sectors 23-28)
  (23, 'Prism Core Spire', 2323, 'FACTION_LITHOS', '[3]'::jsonb, 630.0, 380.0, 'WHITE_A', 1.5, 1, 'The crystalline sovereign cathedral of the Lithos Axiom, pulsing with harmonic shield frequencies.'),
  (24, 'Axiom Ridge Quarry', 2424, 'FACTION_LITHOS', '[23]'::jsonb, 670.0, 420.0, 'ORANGE_K', 1.2, 1, 'Deep-core automated quarry harvesting pure resonance crystals and silicate alloy matrices.'),
  (25, 'Crystalline Spires', 2525, 'FACTION_LITHOS', '[23]'::jsonb, 660.0, 360.0, 'WHITE_A', 1.4, 2, 'Towering natural crystalline orbital monoliths used as harmonic communication relays.'),
  (26, 'Harmonic Beacon 4', 2626, 'FACTION_LITHOS', '[3, 23]'::jsonb, 610.0, 340.0, 'YELLOW_G', 1.1, 1, 'Long-range guidance array guiding heavy crystal freight barges between foundry nodes.'),
  (27, 'Quartz Abyss', 2727, 'FACTION_LITHOS', '[24]'::jsonb, 690.0, 390.0, 'ORANGE_K', 1.0, 2, 'Rich mineral void where gravity shear splits silicate asteroids into glassy facets.'),
  (28, 'Monolith Drift', 2828, 'FACTION_LITHOS', '[25]'::jsonb, 640.0, 320.0, 'WHITE_A', 1.3, 1, 'Ancient monolithic geode floating in perpetual harmonic lock with its white companion star.'),

  -- Phorid Swarm Hive Cluster (Sectors 29-34)
  (29, 'Bio-Spore Prime', 2929, 'FACTION_PHORID', '[4]'::jsonb, 390.0, 610.0, 'RED_M', 0.9, 4, 'Living organic mothership biome feeding upon radioactive comet streams and bio-matter.'),
  (30, 'Chitin Depths', 3030, 'FACTION_PHORID', '[29]'::jsonb, 420.0, 650.0, 'RED_M', 0.8, 3, 'Vast organic breeding incubator spawning hyper-regenerative carapace armor frigate hulls.'),
  (31, 'Mycelial Vent 7', 3131, 'FACTION_PHORID', '[4, 29]'::jsonb, 370.0, 640.0, 'ORANGE_K', 1.0, 3, 'Spore venting vent-system dispersing caustic aerosols across local sub-light corridors.'),
  (32, 'Infested Grotto', 3232, 'FACTION_PHORID', '[30]'::jsonb, 440.0, 680.0, 'RED_M', 0.7, 4, 'Dark organic cavern sector where dormant bio-spore hulls awaken at the scent of burning fuel.'),
  (33, 'Larval Reach', 3333, 'FACTION_PHORID', '[29]'::jsonb, 360.0, 590.0, 'YELLOW_G', 1.1, 3, 'Hydrocarbon-rich nursery feeding millions of synthetic bio-nanite swarms.'),
  (34, 'Corrosive Rift', 3434, 'FACTION_PHORID', '[31]'::jsonb, 340.0, 660.0, 'RED_M', 0.8, 4, 'Hazardous aerosol cloud that rapidly erodes kinetic starship armor plating.'),

  -- Deep Frontier & Remote Star Systems (Sectors 35-50)
  (35, 'Vega Starlight', 3535, 'FACTION_SOL', '[]'::jsonb, 580.0, 610.0, 'BLUE_O', 2.1, 1, 'A blazing sapphire beacon casting incandescent light across virgin uninhabited mineral worlds.'),
  (36, 'Arcturus Furnace', 3636, 'FACTION_LITHOS', '[]'::jsonb, 740.0, 480.0, 'ORANGE_K', 2.4, 2, 'Colossal orange giant radiating extreme thermal currents, rich in silicate magma chambers.'),
  (37, 'Betelgeuse Apex', 3737, 'FACTION_VAELIC', '[]'::jsonb, 260.0, 410.0, 'RED_M', 3.0, 3, 'Unstable red supergiant on the verge of supernova; its flare storms conceal outlaw outposts.'),
  (38, 'Rigel Crystalline', 3838, 'FACTION_SOL', '[]'::jsonb, 550.0, 720.0, 'BLUE_O', 2.8, 2, 'Luminous blue supergiant illuminating sprawling ice fields and deep deuterium pockets.'),
  (39, 'Aldebaran Hollows', 3939, 'FACTION_LITHOS', '[]'::jsonb, 780.0, 350.0, 'ORANGE_K', 1.7, 1, 'Ancient planetary graveyard where shattered mantle fragments drift through amber light.'),
  (40, 'Antares Blood Star', 4040, 'FACTION_PHORID', '[]'::jsonb, 310.0, 720.0, 'RED_M', 2.9, 4, 'Pulsing crimson leviathan star harboring strange alien spores and biological anomalies.'),
  (41, 'Spica Twins', 4141, 'FACTION_SOL', '[]'::jsonb, 620.0, 700.0, 'BLUE_O', 1.9, 1, 'Close-orbiting binary blue stars generating intense gravitational slingshot warp lanes.'),
  (42, 'Pollux Haven', 4242, 'FACTION_SOL', '[]'::jsonb, 470.0, 430.0, 'ORANGE_K', 1.2, 0, 'Gentle orange giant providing ideal solar stability for orbital hydroponic domes.'),
  (43, 'Castor Quad-Cluster', 4343, 'FACTION_SOL', '[]'::jsonb, 450.0, 410.0, 'WHITE_A', 1.5, 1, 'Rare quadruple stellar system linked by intricate gravitational resonance orbits.'),
  (44, 'Deneb Outer Bastion', 4444, 'FACTION_VAELIC', '[]'::jsonb, 220.0, 330.0, 'WHITE_A', 2.5, 3, 'Deep-void Hegemony observation outpost guarding against deep space incursions.'),
  (45, 'Regulus King Star', 4545, 'FACTION_SOL', '[]'::jsonb, 410.0, 460.0, 'BLUE_O', 1.6, 1, 'Rapidly spinning blue star flattened at the poles, casting violent equatorial plasma belts.'),
  (46, 'Bellatrix Raider Point', 4646, 'FACTION_KRYLL', '[]'::jsonb, 760.0, 620.0, 'BLUE_O', 1.8, 3, 'Remote blue star serving as staging point for long-range pirate raiding flotillas.'),
  (47, 'Alnilam Void Gateway', 4747, 'FACTION_SOL', '[]'::jsonb, 590.0, 770.0, 'BLUE_O', 2.2, 2, 'Middle gem of Orion''s belt, anchoring high-energy sub-space communication antennas.'),
  (48, 'Polaris Anchor', 4848, 'FACTION_SOL', '[]'::jsonb, 500.0, 850.0, 'YELLOW_G', 1.9, 0, 'The North Star. The ultimate navigational calibration beacon for interstellar explorers.'),
  (49, 'Canopus Super-Core', 4949, 'FACTION_SOL', '[]'::jsonb, 500.0, 150.0, 'WHITE_A', 2.7, 1, 'Blindingly luminous southern supergiant visible from every corner of the charted galaxy.'),
  (50, 'Achernar Oblate', 5050, 'FACTION_LITHOS', '[]'::jsonb, 820.0, 240.0, 'BLUE_O', 2.0, 2, 'The least spherical star known, rotating at 250 km/s with immense equatorial centrifugal shear.'),

  -- Precursor Relic & Anomaly Systems (Sectors 51-60)
  (51, 'Zeta Draconis Vault', 5151, 'FACTION_SOL', '[]'::jsonb, 460.0, 810.0, 'NEUTRON', 0.5, 3, 'Pulsing neutron star emitting rhythmic electromagnetic signals encoding ancient star charts.'),
  (52, 'Precursor Nexus Beta', 5252, 'FACTION_SOL', '[]'::jsonb, 530.0, 880.0, 'NEUTRON', 0.4, 4, 'Surrounded by crystalline orbital rings constructed by a long-vanished precursor civilization.'),
  (53, 'Quasi-Rift Gateway Alpha', 5353, 'FACTION_SOL', '[]'::jsonb, 480.0, 920.0, 'NEUTRON', 0.3, 5, 'A flickering neon-green sub-space tear in reality whispering of Precursor Quasi-Space transit.'),
  (54, 'Epsilon Eridani Outpost', 5454, 'FACTION_SOL', '[]'::jsonb, 440.0, 380.0, 'ORANGE_K', 1.0, 0, 'Sol frontier settlement orbiting an active orange dwarf with pristine planetary rings.'),
  (55, 'Groombridge Bastion', 5555, 'FACTION_VAELIC', '[]'::jsonb, 290.0, 250.0, 'RED_M', 0.7, 3, 'Imperial border fort guarding remote helium-3 mining platforms against Kryll scavengers.'),
  (56, 'Wolf 359 Salvage Graveyard', 5656, 'FACTION_KRYLL', '[]'::jsonb, 620.0, 480.0, 'RED_M', 0.6, 2, 'Ancient battleground littered with hundreds of cold, derelict starship hulls.'),
  (57, 'Ross 128 Quiet Zone', 5757, 'FACTION_SOL', '[]'::jsonb, 540.0, 390.0, 'RED_M', 0.7, 0, 'Inactive red dwarf system designated as an interstellar wildlife conservation sanctuary.'),
  (58, 'Luyten''s Flare Hub', 5858, 'FACTION_SOL', '[]'::jsonb, 460.0, 560.0, 'RED_M', 0.8, 1, 'Active flare star producing periodic auroras across its inhabited continental colony world.'),
  (59, 'Kapteyn''s Ancient Gate', 5959, 'FACTION_LITHOS', '[]'::jsonb, 720.0, 280.0, 'RED_M', 0.6, 2, 'Oldest known star in the local cluster, carrying an artificial Precursor Dyson swarm ring.'),
  (60, 'Omega Terminus', 6060, 'FACTION_VAELIC', '[]'::jsonb, 150.0, 150.0, 'NEUTRON', 0.4, 5, 'The edge of charted space. A violently spinning pulsar where gravity bends space into impossible arcs.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  system_seed = EXCLUDED.system_seed,
  controlling_faction = EXCLUDED.controlling_faction,
  coordinates_x = EXCLUDED.coordinates_x,
  coordinates_y = EXCLUDED.coordinates_y,
  spectral_class = EXCLUDED.spectral_class,
  star_radius = EXCLUDED.star_radius,
  hazard_level = EXCLUDED.hazard_level,
  description = EXCLUDED.description;


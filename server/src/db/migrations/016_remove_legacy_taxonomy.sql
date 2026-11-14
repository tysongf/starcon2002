-- 016_remove_legacy_taxonomy.sql
-- Removes old planets.archetype and equipment_blueprints.category columns after migrating
-- all records natively onto 15x3 planetary taxonomy and 5x3 equipment taxonomy.

-- 1. Ensure all planets carry native main_class, subtype, and palette
UPDATE planets SET
  main_class = COALESCE(main_class, 'METALLIC_ORE'),
  subtype = COALESCE(subtype, 'Auric Lode'),
  planet_palette = COALESCE(
    planet_palette,
    '{"base":"#451a03","band1":"#d97706","band2":"#78350f","accent":"#fde047","glow":"#fbbf24","atmosphere":"#f59e0b","patternStyle":"CRATERED","hasRings":false,"hasClouds":false,"emissiveStrength":0.3}'::jsonb
  )
WHERE main_class IS NULL OR subtype IS NULL OR planet_palette IS NULL;

ALTER TABLE planets
  ALTER COLUMN main_class SET DEFAULT 'METALLIC_ORE',
  ALTER COLUMN subtype SET DEFAULT 'Auric Lode';

ALTER TABLE planets DROP COLUMN IF EXISTS archetype;

-- 2. Backfill native main_category and subtype onto all starter, bridge, and precursor blueprints
UPDATE equipment_blueprints SET main_category = 'OFFENSE', subtype = 'Laser Turret' WHERE id = 'MOD_PULSE_01';
UPDATE equipment_blueprints SET main_category = 'OFFENSE', subtype = 'Railgun' WHERE id = 'MOD_PLASMA_01';
UPDATE equipment_blueprints SET main_category = 'OFFENSE', subtype = 'Ion Cannon' WHERE id = 'MOD_FLAK_01';
UPDATE equipment_blueprints SET main_category = 'UTILITY_DRONE', subtype = 'Mining Drone' WHERE id = 'MOD_MINING_01';
UPDATE equipment_blueprints SET main_category = 'TRAVEL', subtype = 'Plasma Drive' WHERE id = 'MOD_AFTERBURNER_01';
UPDATE equipment_blueprints SET main_category = 'DEFENSE', subtype = 'Shield Generator' WHERE id = 'MOD_SHIELD_01';
UPDATE equipment_blueprints SET main_category = 'UTILITY_DRONE', subtype = 'Salvage Drone' WHERE id = 'MOD_ECM_01';
UPDATE equipment_blueprints SET main_category = 'DEFENSE', subtype = 'Power Core' WHERE id = 'MOD_REACTOR_01';
UPDATE equipment_blueprints SET main_category = 'DEFENSE', subtype = 'Hull Plating' WHERE id = 'MOD_ARMOR_01';
UPDATE equipment_blueprints SET main_category = 'COMMERCE', subtype = 'Cargo Bay' WHERE id = 'MOD_CARGO_01';
UPDATE equipment_blueprints SET main_category = 'UTILITY_DRONE', subtype = 'Command Bridge' WHERE id LIKE 'MOD_BRIDGE_%';
UPDATE equipment_blueprints SET main_category = 'OFFENSE', subtype = 'Torpedo Bay' WHERE id = 'BP_PRECURSOR_PHASE_LANCE';
UPDATE equipment_blueprints SET main_category = 'TRAVEL', subtype = 'Hyperdrive Booster' WHERE id = 'BP_PRECURSOR_TACHYON_DRIVE';
UPDATE equipment_blueprints SET main_category = 'DEFENSE', subtype = 'Shield Generator' WHERE id = 'BP_PRECURSOR_CRYSTAL_SHIELD';
UPDATE equipment_blueprints SET main_category = 'DEFENSE', subtype = 'Engineering Bay' WHERE id = 'BP_PRECURSOR_BIOSPHERE_GEN';

UPDATE equipment_blueprints SET
  main_category = COALESCE(
    main_category,
    CASE slot_type
      WHEN 'HIGH' THEN 'OFFENSE'
      WHEN 'MID' THEN 'DEFENSE'
      ELSE 'DEFENSE'
    END
  ),
  subtype = COALESCE(
    subtype,
    CASE slot_type
      WHEN 'HIGH' THEN 'Laser Turret'
      WHEN 'MID' THEN 'Shield Generator'
      ELSE 'Hull Plating'
    END
  )
WHERE main_category IS NULL OR subtype IS NULL;

UPDATE player_inventory pi SET
  main_category = COALESCE(pi.main_category, eb.main_category, 'OFFENSE'),
  subtype = COALESCE(pi.subtype, eb.subtype, 'Laser Turret')
FROM equipment_blueprints eb
WHERE pi.blueprint_id = eb.id
  AND (pi.main_category IS NULL OR pi.subtype IS NULL);

ALTER TABLE equipment_blueprints
  ALTER COLUMN main_category SET DEFAULT 'OFFENSE',
  ALTER COLUMN subtype SET DEFAULT 'Laser Turret';

ALTER TABLE equipment_blueprints DROP COLUMN IF EXISTS category;


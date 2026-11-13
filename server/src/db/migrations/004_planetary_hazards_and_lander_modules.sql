-- 004_planetary_hazards_and_lander_modules.sql
-- Planetary environmental hazards and lander outfitting modules schema

-- 1. Add hazard classification columns to planets table
ALTER TABLE planets 
ADD COLUMN IF NOT EXISTS hazard_thermal_level INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS hazard_ion_level INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS hazard_caustic_level INT DEFAULT 0;

-- 2. Add status and module columns to player_landers
ALTER TABLE player_landers
ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';

-- 3. Seed canonical planetary hazard ratings
UPDATE planets SET hazard_thermal_level = 0, hazard_ion_level = 0, hazard_caustic_level = 0 WHERE id = 'planet_sec1_aegis';
UPDATE planets SET hazard_thermal_level = 0, hazard_ion_level = 2, hazard_caustic_level = 1 WHERE id = 'planet_sec2_charybdis';
UPDATE planets SET hazard_thermal_level = 3, hazard_ion_level = 0, hazard_caustic_level = 0 WHERE id = 'planet_sec3_ignis';
UPDATE planets SET hazard_thermal_level = 0, hazard_ion_level = 0, hazard_caustic_level = 2 WHERE id = 'planet_sec4_mycelia';
UPDATE planets SET hazard_thermal_level = 1, hazard_ion_level = 1, hazard_caustic_level = 0 WHERE id = 'planet_sec5_skrit';


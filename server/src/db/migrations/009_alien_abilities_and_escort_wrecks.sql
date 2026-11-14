-- 009_alien_abilities_and_escort_wrecks.sql
-- Milestone 0.8 Day 35: Alien Hull Asymmetry, Signature Fleet Abilities & Wreck Refurbishment

-- 1. Extend Wrecks table with blueprint and fleet escort links
ALTER TABLE wrecks ADD COLUMN IF NOT EXISTS blueprint_id VARCHAR(64);
ALTER TABLE wrecks ADD COLUMN IF NOT EXISTS fleet_ship_id VARCHAR(64);

-- 2. Restore canonical Day 33 ability designations for backwards compatibility
UPDATE shipyard_blueprints 
SET special_ability = 'PLASMA_BARRAGE' 
WHERE id = 'HULL_VAELIC_INTERDICTOR';

UPDATE shipyard_blueprints 
SET special_ability = 'SHOCKWAVE' 
WHERE id = 'HULL_LITHOS_MONITOR';

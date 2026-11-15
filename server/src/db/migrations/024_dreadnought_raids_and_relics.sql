-- ============================================================================
-- Migration 024: Roaming Dreadnought World Bosses, Precursor Relics & MMORPG Synergy Modules
-- ============================================================================

-- 1. Persistent Raid World Boss Encounters
CREATE TABLE IF NOT EXISTS raid_encounters (
  id VARCHAR(64) PRIMARY KEY,
  boss_archetype VARCHAR(48) NOT NULL,
  boss_name VARCHAR(128) NOT NULL,
  faction_id VARCHAR(48) NOT NULL,
  sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | DEFEATED | DESPAWNED
  max_hp INT NOT NULL,
  hp INT NOT NULL,
  max_shields INT NOT NULL,
  shields INT NOT NULL,
  phase INT NOT NULL DEFAULT 1,
  enrage_at TIMESTAMPTZ,
  spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_relocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  defeated_at TIMESTAMPTZ,
  winner_account_id VARCHAR(64),
  winner_squadron_id VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_raid_encounters_status_sector
  ON raid_encounters(status, sector_id);

-- 2. Raid Damage & Support Contribution Ledger
CREATE TABLE IF NOT EXISTS raid_contributions (
  encounter_id VARCHAR(64) NOT NULL REFERENCES raid_encounters(id) ON DELETE CASCADE,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  squadron_id VARCHAR(64),
  damage_dealt INT NOT NULL DEFAULT 0,
  healing_done INT NOT NULL DEFAULT 0,
  support_score INT NOT NULL DEFAULT 0,
  deaths INT NOT NULL DEFAULT 0,
  claimed_payout BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (encounter_id, account_id)
);

-- 3. Squadron Need / Greed / Pass Raid Loot Rolls
CREATE TABLE IF NOT EXISTS raid_loot_rolls (
  id VARCHAR(64) PRIMARY KEY,
  encounter_id VARCHAR(64) NOT NULL REFERENCES raid_encounters(id) ON DELETE CASCADE,
  squadron_id VARCHAR(64),
  eligible_account_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_type VARCHAR(32) NOT NULL, -- MYTHIC_MODULE | RELIC_HULL | COLONY_CORE
  item_name VARCHAR(128) NOT NULL,
  item_payload JSONB NOT NULL,
  bids JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN', -- OPEN | AWARDED
  winner_account_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  awarded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_raid_loot_rolls_status
  ON raid_loot_rolls(status, expires_at);

-- 4. Unlocked Precursor Relic Ship Hulls & Outpost Colony Core Permits
CREATE TABLE IF NOT EXISTS player_relic_unlocks (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blueprint_id VARCHAR(64) NOT NULL,
  unlock_type VARCHAR(32) NOT NULL, -- SHIP_HULL | OUTPOST_BUILDING
  title VARCHAR(128) NOT NULL,
  charges_remaining INT NOT NULL DEFAULT 1,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_relic_unlocks_acc
  ON player_relic_unlocks(account_id, unlock_type);

-- 5. Seed the 13 Thematic MMORPG Inter-Squadron Synergy Modules into equipment_blueprints
INSERT INTO equipment_blueprints (
  id, name, slot_type, main_category, subtype, manufacturer, base_rarity,
  power_grid_cost, cpu_cost, base_price, base_stats, description
)
VALUES
  ('MOD_SYNERGY_TAUNT_EMITTER', 'Vaelic IFF Threat Spoofer', 'MID', 'DEFENSE', 'Threat Spoofer', 'Vaelic Vanguard Forge', 'UNCOMMON', 8.0, 14.0, 680,
   '{"synergyKey":"TAUNT_EMITTER","role":"TANK","cooldownSec":12,"energyCost":16,"rangeMeters":240,"durationSec":8,"basePower":25}'::jsonb,
   'Forces Dreadnought & hostile escort AI threat onto your hull for 8s and reinforces shield harmonics (+25% damage mitigation).'),
  ('MOD_SYNERGY_BASTION_DOME', 'Lithos Basalt Deflector Sphere', 'MID', 'DEFENSE', 'Deflector Dome', 'Lithos Heavy Citadel', 'RARE', 14.0, 18.0, 1250,
   '{"synergyKey":"BASTION_DOME","role":"TANK","cooldownSec":18,"energyCost":24,"rangeMeters":105,"durationSec":6,"basePower":35}'::jsonb,
   'Projects a 105m Bastion field for 6s: 35% of damage hitting Squadron & Allied ships inside is absorbed onto your shields.'),
  ('MOD_SYNERGY_INTERCEPT_TETHER', 'Warden Graviton Guardian Link', 'MID', 'DEFENSE', 'Guardian Link', 'Star Wardens Armory', 'UNCOMMON', 10.0, 15.0, 920,
   '{"synergyKey":"INTERCEPT_TETHER","role":"TANK","cooldownSec":14,"energyCost":18,"rangeMeters":175,"durationSec":8,"basePower":50}'::jsonb,
   'Links to a targeted Squadron/Allied ship for 8s, diverting 50% of incoming damage from that ally onto your Tank shields.'),
  ('MOD_SYNERGY_SHIELD_TRANSFUSER', 'Sol-Aegis Shield Projection Beam', 'HIGH', 'DEFENSE', 'Shield Projector', 'Sol Aegis Naval Works', 'COMMON', 11.0, 14.0, 740,
   '{"synergyKey":"SHIELD_TRANSFUSER","role":"HEALER","cooldownSec":5,"energyCost":16,"rangeMeters":190,"durationSec":0,"basePower":165}'::jsonb,
   'Channels focused shield harmonics to restore +165 base Shield HP onto a targeted Squadron or Allied vessel.'),
  ('MOD_SYNERGY_NANITE_REPAIRER', 'Miners Nanite Weld Projector', 'HIGH', 'DEFENSE', 'Hull Projector', 'Deep-Core Guild Foundry', 'UNCOMMON', 12.0, 16.0, 890,
   '{"synergyKey":"NANITE_REPAIRER","role":"HEALER","cooldownSec":8,"energyCost":20,"rangeMeters":175,"durationSec":4,"basePower":110}'::jsonb,
   'Projects welding nanites restoring +110 base Hull Armor immediately plus +18 Hull/sec repair-over-time for 4s.'),
  ('MOD_SYNERGY_CLEANSE_PULSE', 'Precursor Phase-Purge Nullifier', 'MID', 'DEFENSE', 'Purge Matrix', 'Sol Applied Sciences', 'RARE', 9.0, 18.0, 1100,
   '{"synergyKey":"CLEANSE_PULSE","role":"HEALER","cooldownSec":12,"energyCost":18,"rangeMeters":140,"durationSec":3,"basePower":3}'::jsonb,
   'Emits a 140m harmonic cleanse wave dispelling Gravity Wells, EMP Disruption, and Armor Etch on Allies + 3s immunity.'),
  ('MOD_SYNERGY_EMERGENCY_REBOOT', 'Phorid Bio-Stasis Revival Core', 'MID', 'DEFENSE', 'Revival Core', 'Phorid Symbiont Guild', 'RARE', 13.0, 20.0, 1650,
   '{"synergyKey":"EMERGENCY_REBOOT","role":"HEALER","cooldownSec":45,"energyCost":30,"rangeMeters":165,"durationSec":0,"basePower":250}'::jsonb,
   'Emergency save pulse: stabilizes critical allies (<35% HP with +250 Shield/+120 Hull) or reconstructs a Squadron Escape Pod in the sector.'),
  ('MOD_SYNERGY_TARGET_PAINTER', 'Kryll Hunter Target Designator', 'MID', 'OFFENSE', 'Target Designator', 'Kryll Apex Ballistics', 'UNCOMMON', 7.0, 14.0, 780,
   '{"synergyKey":"TARGET_PAINTER","role":"DEBUFFER","cooldownSec":10,"energyCost":14,"rangeMeters":230,"durationSec":10,"basePower":20}'::jsonb,
   'Locks subspace telemetry onto a target for 10s, increasing incoming damage from ALL Squadron & Allied attackers by +20%.'),
  ('MOD_SYNERGY_ARMOR_CORRODER', 'Phorid Acid-Spore Hull Etcher', 'HIGH', 'OFFENSE', 'Corrosive Projector', 'Phorid Symbiont Guild', 'RARE', 11.0, 15.0, 1050,
   '{"synergyKey":"ARMOR_CORRODER","role":"DEBUFFER","cooldownSec":6,"energyCost":16,"rangeMeters":185,"durationSec":12,"basePower":10}'::jsonb,
   'Etches Dreadnought plating (-10% armor resistance per stack, max 3 stacks / +30% extra hull vulnerability for whole Squadron).'),
  ('MOD_SYNERGY_STASIS_WEB', 'Freebooter Inertial Drag Projector', 'MID', 'OFFENSE', 'Stasis Projector', 'Freebooter Syndicate Rig', 'UNCOMMON', 8.0, 14.0, 720,
   '{"synergyKey":"STASIS_WEB","role":"DEBUFFER","cooldownSec":10,"energyCost":14,"rangeMeters":180,"durationSec":6,"basePower":55}'::jsonb,
   'Projects a gravimetric drag web cutting enemy speed by 55% for 6s — ideal for pinning Repair Drones & rival raiders.'),
  ('MOD_SYNERGY_CAPACITOR_RELAY', 'Lithos Crystal Dynamo Conduit', 'HIGH', 'TRAVEL', 'Capacitor Conduit', 'Lithos Crystal Conclave', 'UNCOMMON', 9.0, 14.0, 820,
   '{"synergyKey":"CAPACITOR_RELAY","role":"BUFFER","cooldownSec":7,"energyCost":12,"rangeMeters":190,"durationSec":8,"basePower":65}'::jsonb,
   'Transfers +65 Capacitor Energy directly to a Squadron/Allied pilot and boosts their Energy Regen by +35% for 8s.'),
  ('MOD_SYNERGY_HARMONIC_COMMAND_LINK', 'Sol Fleet C3 Synaptic Array', 'LOW', 'COMMERCE', 'Command Link', 'Sol Fleet Command', 'RARE', 10.0, 16.0, 1480,
   '{"synergyKey":"HARMONIC_COMMAND_LINK","role":"BUFFER","cooldownSec":0,"energyCost":0,"rangeMeters":170,"durationSec":0,"basePower":12}'::jsonb,
   'Continuous 170m Squadron Command Aura granting nearby Squadron & Peer Allies +12% Firepower, +12% Shield Regen & +10% Speed.'),
  ('MOD_SYNERGY_OVERCLOCK_SYNCHRONIZER', 'Kryll Crimson Overclock Synchronizer', 'LOW', 'OFFENSE', 'Fleet Overclock', 'Kryll Apex Ballistics', 'RARE', 12.0, 18.0, 1850,
   '{"synergyKey":"OVERCLOCK_SYNCHRONIZER","role":"BUFFER","cooldownSec":55,"energyCost":25,"rangeMeters":195,"durationSec":10,"basePower":30}'::jsonb,
   'Squadron Surge (55s CD): Overclocks all Squadron & Peer Allies within 195m with +30% Fire Rate & +25% Thruster Impulse for 10s.')
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


/**
 * Milestone 1.9: Classical MMORPG Inter-Squadron Ship Synergy Modules
 *
 * Thematic Wayward Void equipment modules fitted on Flagships (HIGH / MID / LOW slots)
 * that unlock Tank, Healer/Logi, Debuffer/CC, and Command Buffer roles in 12-pilot Squadrons.
 */

export type SynergyRole = 'TANK' | 'HEALER' | 'DEBUFFER' | 'BUFFER';
export type SynergyTargetMode = 'ENEMY' | 'ALLY' | 'SELF_AOE' | 'PASSIVE_AURA';

export interface SynergyModuleSpec {
  blueprintId: string;
  synergyKey:
    | 'TAUNT_EMITTER'
    | 'BASTION_DOME'
    | 'INTERCEPT_TETHER'
    | 'SHIELD_TRANSFUSER'
    | 'NANITE_REPAIRER'
    | 'CLEANSE_PULSE'
    | 'EMERGENCY_REBOOT'
    | 'TARGET_PAINTER'
    | 'ARMOR_CORRODER'
    | 'STASIS_WEB'
    | 'CAPACITOR_RELAY'
    | 'HARMONIC_COMMAND_LINK'
    | 'OVERCLOCK_SYNCHRONIZER';
  name: string;
  shortLabel: string;
  role: SynergyRole;
  slotType: 'HIGH' | 'MID' | 'LOW';
  mainCategory: 'OFFENSE' | 'DEFENSE' | 'TRAVEL' | 'COMMERCE';
  subtype: string;
  manufacturer: string;
  powerGridCost: number;
  cpuCost: number;
  basePrice: number;
  cooldownSec: number;
  energyCost: number;
  rangeMeters: number;
  durationSec: number;
  basePower: number;
  targetMode: SynergyTargetMode;
  crewSpecialties: readonly string[];
  description: string;
}

export const SYNERGY_MODULES: readonly SynergyModuleSpec[] = [
  // =========================================================================
  // TANK / VANGUARD ROLES
  // =========================================================================
  {
    blueprintId: 'MOD_SYNERGY_TAUNT_EMITTER',
    synergyKey: 'TAUNT_EMITTER',
    name: 'Vaelic IFF Threat Spoofer',
    shortLabel: 'IFF TAUNT',
    role: 'TANK',
    slotType: 'MID',
    mainCategory: 'DEFENSE',
    subtype: 'Threat Spoofer',
    manufacturer: 'Vaelic Vanguard Forge',
    powerGridCost: 8,
    cpuCost: 14,
    basePrice: 680,
    cooldownSec: 12,
    energyCost: 16,
    rangeMeters: 240,
    durationSec: 8,
    basePower: 25, // +25% shield mitigation while tanking
    targetMode: 'ENEMY',
    crewSpecialties: ['Tactician', 'Pilot'],
    description: 'Forces Dreadnought & hostile escort AI threat onto your hull for 8s and reinforces shield harmonics (+25% damage mitigation).',
  },
  {
    blueprintId: 'MOD_SYNERGY_BASTION_DOME',
    synergyKey: 'BASTION_DOME',
    name: 'Lithos Basalt Deflector Sphere',
    shortLabel: 'AEGIS DOME',
    role: 'TANK',
    slotType: 'MID',
    mainCategory: 'DEFENSE',
    subtype: 'Deflector Dome',
    manufacturer: 'Lithos Heavy Citadel',
    powerGridCost: 14,
    cpuCost: 18,
    basePrice: 1250,
    cooldownSec: 18,
    energyCost: 24,
    rangeMeters: 105,
    durationSec: 6,
    basePower: 35, // redirects 35% of nearby ally incoming damage to Tank shields
    targetMode: 'SELF_AOE',
    crewSpecialties: ['Engineer', 'Tactician'],
    description: 'Projects a 105m Bastion field for 6s: 35% of damage hitting Squadron & Allied ships inside is absorbed onto your shields.',
  },
  {
    blueprintId: 'MOD_SYNERGY_INTERCEPT_TETHER',
    synergyKey: 'INTERCEPT_TETHER',
    name: 'Warden Graviton Guardian Link',
    shortLabel: 'GUARD LINK',
    role: 'TANK',
    slotType: 'MID',
    mainCategory: 'DEFENSE',
    subtype: 'Guardian Link',
    manufacturer: 'Star Wardens Armory',
    powerGridCost: 10,
    cpuCost: 15,
    basePrice: 920,
    cooldownSec: 14,
    energyCost: 18,
    rangeMeters: 175,
    durationSec: 8,
    basePower: 50, // intercepts 50% of damage on targeted ally
    targetMode: 'ALLY',
    crewSpecialties: ['Tactician', 'Engineer'],
    description: 'Links to a targeted Squadron/Allied ship for 8s, diverting 50% of incoming damage from that ally onto your Tank shields.',
  },

  // =========================================================================
  // HEALER / LOGISTICS ROLES
  // =========================================================================
  {
    blueprintId: 'MOD_SYNERGY_SHIELD_TRANSFUSER',
    synergyKey: 'SHIELD_TRANSFUSER',
    name: 'Sol-Aegis Shield Projection Beam',
    shortLabel: 'SHIELD BEAM',
    role: 'HEALER',
    slotType: 'HIGH',
    mainCategory: 'DEFENSE',
    subtype: 'Shield Projector',
    manufacturer: 'Sol Aegis Naval Works',
    powerGridCost: 11,
    cpuCost: 14,
    basePrice: 740,
    cooldownSec: 5,
    energyCost: 16,
    rangeMeters: 190,
    durationSec: 0,
    basePower: 165, // +165 Shield restoration
    targetMode: 'ALLY',
    crewSpecialties: ['Engineer', 'Scientist'],
    description: 'Channels focused shield harmonics to restore +165 base Shield HP onto a targeted Squadron or Allied vessel.',
  },
  {
    blueprintId: 'MOD_SYNERGY_NANITE_REPAIRER',
    synergyKey: 'NANITE_REPAIRER',
    name: 'Miners Nanite Weld Projector',
    shortLabel: 'NANITE WELD',
    role: 'HEALER',
    slotType: 'HIGH',
    mainCategory: 'DEFENSE',
    subtype: 'Hull Projector',
    manufacturer: 'Deep-Core Guild Foundry',
    powerGridCost: 12,
    cpuCost: 16,
    basePrice: 890,
    cooldownSec: 8,
    energyCost: 20,
    rangeMeters: 175,
    durationSec: 4,
    basePower: 110, // +110 instant Hull + 18/s HoT over 4s
    targetMode: 'ALLY',
    crewSpecialties: ['Engineer', 'Mechanic'],
    description: 'Projects welding nanites restoring +110 base Hull Armor immediately plus +18 Hull/sec repair-over-time for 4s.',
  },
  {
    blueprintId: 'MOD_SYNERGY_CLEANSE_PULSE',
    synergyKey: 'CLEANSE_PULSE',
    name: 'Precursor Phase-Purge Nullifier',
    shortLabel: 'PHASE PURGE',
    role: 'HEALER',
    slotType: 'MID',
    mainCategory: 'DEFENSE',
    subtype: 'Purge Matrix',
    manufacturer: 'Sol Applied Sciences',
    powerGridCost: 9,
    cpuCost: 18,
    basePrice: 1100,
    cooldownSec: 12,
    energyCost: 18,
    rangeMeters: 140,
    durationSec: 3,
    basePower: 3, // 3s debuff immunity + removes Gravity/EMP/Burn
    targetMode: 'SELF_AOE',
    crewSpecialties: ['Medic', 'Scientist'],
    description: 'Emits a 140m harmonic cleanse wave dispelling Gravity Wells, EMP Disruption, and Armor Etch on Allies + 3s immunity.',
  },
  {
    blueprintId: 'MOD_SYNERGY_EMERGENCY_REBOOT',
    synergyKey: 'EMERGENCY_REBOOT',
    name: 'Phorid Bio-Stasis Revival Core',
    shortLabel: 'CRYO REVIVE',
    role: 'HEALER',
    slotType: 'MID',
    mainCategory: 'DEFENSE',
    subtype: 'Revival Core',
    manufacturer: 'Phorid Symbiont Guild',
    powerGridCost: 13,
    cpuCost: 20,
    basePrice: 1650,
    cooldownSec: 45,
    energyCost: 30,
    rangeMeters: 165,
    durationSec: 0,
    basePower: 250, // emergency +250 Shields + 120 Hull OR revives Squadron Escape Pod
    targetMode: 'ALLY',
    crewSpecialties: ['Medic', 'Xenobiologist'],
    description: 'Emergency save pulse: stabilizes critical allies (<35% HP with +250 Shield/+120 Hull) or reconstructs a Squadron Escape Pod in the sector.',
  },

  // =========================================================================
  // DEBUFFER / CROWD CONTROL ROLES
  // =========================================================================
  {
    blueprintId: 'MOD_SYNERGY_TARGET_PAINTER',
    synergyKey: 'TARGET_PAINTER',
    name: 'Kryll Hunter Target Designator',
    shortLabel: 'PAINTER',
    role: 'DEBUFFER',
    slotType: 'MID',
    mainCategory: 'OFFENSE',
    subtype: 'Target Designator',
    manufacturer: 'Kryll Apex Ballistics',
    powerGridCost: 7,
    cpuCost: 14,
    basePrice: 780,
    cooldownSec: 10,
    energyCost: 14,
    rangeMeters: 230,
    durationSec: 10,
    basePower: 20, // +20% incoming Squadron damage amplification
    targetMode: 'ENEMY',
    crewSpecialties: ['Tactician', 'Gunnery'],
    description: 'Locks subspace telemetry onto a target for 10s, increasing incoming damage from ALL Squadron & Allied attackers by +20%.',
  },
  {
    blueprintId: 'MOD_SYNERGY_ARMOR_CORRODER',
    synergyKey: 'ARMOR_CORRODER',
    name: 'Phorid Acid-Spore Hull Etcher',
    shortLabel: 'HULL ETCHER',
    role: 'DEBUFFER',
    slotType: 'HIGH',
    mainCategory: 'OFFENSE',
    subtype: 'Corrosive Projector',
    manufacturer: 'Phorid Symbiont Guild',
    powerGridCost: 11,
    cpuCost: 15,
    basePrice: 1050,
    cooldownSec: 6,
    energyCost: 16,
    rangeMeters: 185,
    durationSec: 12,
    basePower: 10, // -10% armor mitigation per stack, up to 3 stacks = -30%
    targetMode: 'ENEMY',
    crewSpecialties: ['Scientist', 'Gunnery'],
    description: 'Etches Dreadnought plating (-10% armor resistance per stack, max 3 stacks / +30% extra hull vulnerability for whole Squadron).',
  },
  {
    blueprintId: 'MOD_SYNERGY_STASIS_WEB',
    synergyKey: 'STASIS_WEB',
    name: 'Freebooter Inertial Drag Projector',
    shortLabel: 'STASIS WEB',
    role: 'DEBUFFER',
    slotType: 'MID',
    mainCategory: 'OFFENSE',
    subtype: 'Stasis Projector',
    manufacturer: 'Freebooter Syndicate Rig',
    powerGridCost: 8,
    cpuCost: 14,
    basePrice: 720,
    cooldownSec: 10,
    energyCost: 14,
    rangeMeters: 180,
    durationSec: 6,
    basePower: 55, // -55% target speed
    targetMode: 'ENEMY',
    crewSpecialties: ['Pilot', 'Tactician'],
    description: 'Projects a gravimetric drag web cutting enemy speed by 55% for 6s — ideal for pinning Repair Drones & rival raiders.',
  },

  // =========================================================================
  // BUFFER / FLEET COMMAND ROLES
  // =========================================================================
  {
    blueprintId: 'MOD_SYNERGY_CAPACITOR_RELAY',
    synergyKey: 'CAPACITOR_RELAY',
    name: 'Lithos Crystal Dynamo Conduit',
    shortLabel: 'CAP RELAY',
    role: 'BUFFER',
    slotType: 'HIGH',
    mainCategory: 'TRAVEL',
    subtype: 'Capacitor Conduit',
    manufacturer: 'Lithos Crystal Conclave',
    powerGridCost: 9,
    cpuCost: 14,
    basePrice: 820,
    cooldownSec: 7,
    energyCost: 12,
    rangeMeters: 190,
    durationSec: 8,
    basePower: 65, // +65 instant energy + 35% regen boost for 8s
    targetMode: 'ALLY',
    crewSpecialties: ['Engineer', 'Navigator'],
    description: 'Transfers +65 Capacitor Energy directly to a Squadron/Allied pilot and boosts their Energy Regen by +35% for 8s.',
  },
  {
    blueprintId: 'MOD_SYNERGY_HARMONIC_COMMAND_LINK',
    synergyKey: 'HARMONIC_COMMAND_LINK',
    name: 'Sol Fleet C3 Synaptic Array',
    shortLabel: 'C3 AURA',
    role: 'BUFFER',
    slotType: 'LOW',
    mainCategory: 'COMMERCE',
    subtype: 'Command Link',
    manufacturer: 'Sol Fleet Command',
    powerGridCost: 10,
    cpuCost: 16,
    basePrice: 1480,
    cooldownSec: 0,
    energyCost: 0,
    rangeMeters: 170,
    durationSec: 0,
    basePower: 12, // +12% Damage, +12% Shield Regen, +10% Speed aura
    targetMode: 'PASSIVE_AURA',
    crewSpecialties: ['Commander', 'Tactician'],
    description: 'Continuous 170m Squadron Command Aura granting nearby Squadron & Peer Allies +12% Firepower, +12% Shield Regen & +10% Speed.',
  },
  {
    blueprintId: 'MOD_SYNERGY_OVERCLOCK_SYNCHRONIZER',
    synergyKey: 'OVERCLOCK_SYNCHRONIZER',
    name: 'Kryll Crimson Overclock Synchronizer',
    shortLabel: 'OVERCLOCK',
    role: 'BUFFER',
    slotType: 'LOW',
    mainCategory: 'OFFENSE',
    subtype: 'Fleet Overclock',
    manufacturer: 'Kryll Apex Ballistics',
    powerGridCost: 12,
    cpuCost: 18,
    basePrice: 1850,
    cooldownSec: 55,
    energyCost: 25,
    rangeMeters: 195,
    durationSec: 10,
    basePower: 30, // +30% Fire Rate & +25% Speed burst for all nearby Allies
    targetMode: 'SELF_AOE',
    crewSpecialties: ['Commander', 'Pilot'],
    description: 'Squadron Surge (55s CD): Overclocks all Squadron & Peer Allies within 195m with +30% Fire Rate & +25% Thruster Impulse for 10s.',
  },
];

export const SYNERGY_MODULE_BY_BLUEPRINT = new Map<string, SynergyModuleSpec>(
  SYNERGY_MODULES.map((m) => [m.blueprintId, m])
);

export const SYNERGY_MODULE_BY_KEY = new Map<string, SynergyModuleSpec>(
  SYNERGY_MODULES.map((m) => [m.synergyKey, m])
);


/**
 * Milestone 1.0: Procedural Ship Module System
 * Curated from Ship Modules (Main Categories + Subtypes) & Tech Items (Prefixes + Suffixes).
 * Pairs Tech Prefixes with mechanical stat/element affixes and Subtypes with compatible Tech Suffixes.
 */

import type { DroppedModule, LootAffix } from '../services/LootGenerator';
import { createMulberry32, rngPick } from './DeterministicPRNG';
import {
  ALL_FACTION_IDS,
  FACTION_REGISTRY,
  normalizeFactionId,
  type PrefixFamily,
} from '../../../shared/FactionRegistry';

export type { PrefixFamily };

export type ModuleMainCategory =
  | 'OFFENSE'
  | 'DEFENSE'
  | 'TRAVEL'
  | 'COMMERCE'
  | 'UTILITY_DRONE';

export type ModuleSubtype =
  | 'Laser Turret'
  | 'Ion Cannon'
  | 'Railgun'
  | 'Torpedo Bay'
  | 'Shield Generator'
  | 'Hull Plating'
  | 'Power Core'
  | 'Engineering Bay'
  | 'Plasma Drive'
  | 'Fuel Pod'
  | 'Hyperdrive Booster'
  | 'Cargo Bay'
  | 'Crew Pod'
  | 'Mining Drone'
  | 'Salvage Drone'
  | 'Deep-Core Scanner Link'
  | 'Bio-Telemetry Node';

export interface TechPrefixDef {
  prefix: string;
  family: PrefixFamily;
  flavor: string;
  primaryStat: LootAffix['stat'];
  primaryBonusMin: number;
  primaryBonusMax: number;
  secondaryStat?: LootAffix['stat'];
  secondaryMultiplier?: number;
  minRarity?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

export interface ModuleSubtypeDef {
  subtype: ModuleSubtype;
  mainCategory: ModuleMainCategory;
  blueprintId: string;
  slotType: 'HIGH' | 'MID' | 'LOW' | 'BAY';
  basePrice: number;
  powerGridCost: number;
  cpuCost: number;
  baseStats: Record<string, any>;
  compatibleSuffixes: readonly string[];
  description: string;
}

export const TECH_PREFIXES: readonly TechPrefixDef[] = [
  // Velocity / Temporal
  { prefix: 'Tachyon', family: 'VELOCITY_TEMPORAL', flavor: 'Subspace phase-shifted fire cadence & thrust', primaryStat: 'muzzleSpeed', primaryBonusMin: 0.16, primaryBonusMax: 0.34, secondaryStat: 'fireCooldown', secondaryMultiplier: 0.88 },
  { prefix: 'Hyperspace', family: 'VELOCITY_TEMPORAL', flavor: 'High-velocity fold projection', primaryStat: 'thrustMultiplier', primaryBonusMin: 0.14, primaryBonusMax: 0.30 },
  { prefix: 'Subspace', family: 'VELOCITY_TEMPORAL', flavor: 'Low-drag subspace resonance', primaryStat: 'fireCooldown', primaryBonusMin: -0.18, primaryBonusMax: -0.08 },
  { prefix: 'Inertial', family: 'VELOCITY_TEMPORAL', flavor: 'Kinetic compensator stabilization', primaryStat: 'thrustMultiplier', primaryBonusMin: 0.10, primaryBonusMax: 0.24 },
  { prefix: 'Temporal', family: 'VELOCITY_TEMPORAL', flavor: 'Chronometric cycle compression', primaryStat: 'fireCooldown', primaryBonusMin: -0.24, primaryBonusMax: -0.12, minRarity: 'RARE' },
  { prefix: 'Kinetic', family: 'VELOCITY_TEMPORAL', flavor: 'High-impulse projectile acceleration', primaryStat: 'muzzleSpeed', primaryBonusMin: 0.12, primaryBonusMax: 0.26 },

  // Annihilation / High-Energy
  { prefix: 'Antimatter', family: 'ANNIHILATION_ENERGY', flavor: 'Pair-annihilation destructive yield', primaryStat: 'damage', primaryBonusMin: 0.22, primaryBonusMax: 0.44, secondaryStat: 'powerGridCost', secondaryMultiplier: 1.12 },
  { prefix: 'Singularity', family: 'ANNIHILATION_ENERGY', flavor: 'Micro-singularity energy core', primaryStat: 'damage', primaryBonusMin: 0.28, primaryBonusMax: 0.50, minRarity: 'EPIC' },
  { prefix: 'Atomic', family: 'ANNIHILATION_ENERGY', flavor: 'Fission-boosted thermal discharge', primaryStat: 'damage', primaryBonusMin: 0.12, primaryBonusMax: 0.24 },
  { prefix: 'Neutron', family: 'ANNIHILATION_ENERGY', flavor: 'Dense neutronium mass-coupling', primaryStat: 'damage', primaryBonusMin: 0.16, primaryBonusMax: 0.32 },
  { prefix: 'Quark', family: 'ANNIHILATION_ENERGY', flavor: 'Sub-hadronic plasma containment', primaryStat: 'damage', primaryBonusMin: 0.18, primaryBonusMax: 0.36, minRarity: 'RARE' },
  { prefix: 'Dark Matter', family: 'ANNIHILATION_ENERGY', flavor: 'Exotic non-baryonic phase output', primaryStat: 'damage', primaryBonusMin: 0.25, primaryBonusMax: 0.46, minRarity: 'EPIC' },

  // Electromagnetic / Flux
  { prefix: 'Ionic', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Capacitor-saving ionized harmonics', primaryStat: 'energyCost', primaryBonusMin: -0.22, primaryBonusMax: -0.10 },
  { prefix: 'Ionic Flux', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Overdriven arc-flux cycling', primaryStat: 'shieldCapacity', primaryBonusMin: 0.15, primaryBonusMax: 0.30 },
  { prefix: 'Magnetic', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Inductive rail & deflector containment', primaryStat: 'shieldCapacity', primaryBonusMin: 0.12, primaryBonusMax: 0.25 },
  { prefix: 'Electron', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Streamlined particle bus efficiency', primaryStat: 'energyCost', primaryBonusMin: -0.18, primaryBonusMax: -0.08 },
  { prefix: 'Flux', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Balanced capacitor wave modulation', primaryStat: 'shieldCapacity', primaryBonusMin: 0.10, primaryBonusMax: 0.22 },
  { prefix: 'Spectral', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Multi-band harmonic frequency tuning', primaryStat: 'muzzleSpeed', primaryBonusMin: 0.14, primaryBonusMax: 0.28 },
  { prefix: 'Photon', family: 'ELECTROMAGNETIC_FLUX', flavor: 'Coherent optical beam focusing', primaryStat: 'energyCost', primaryBonusMin: -0.20, primaryBonusMax: -0.10 },

  // Gravitic / Spatial
  { prefix: 'Graviton', family: 'GRAVITIC_SPATIAL', flavor: 'Localized mass-shearing field', primaryStat: 'powerGridCost', primaryBonusMin: -0.20, primaryBonusMax: -0.10 },
  { prefix: 'Gravitic', family: 'GRAVITIC_SPATIAL', flavor: 'Compact spatial compression matrix', primaryStat: 'thrustMultiplier', primaryBonusMin: 0.12, primaryBonusMax: 0.26 },
  { prefix: 'Gravitational', family: 'GRAVITIC_SPATIAL', flavor: 'Deep-well structural reinforcement', primaryStat: 'shieldCapacity', primaryBonusMin: 0.14, primaryBonusMax: 0.28 },
  { prefix: 'Antigravitic', family: 'GRAVITIC_SPATIAL', flavor: 'Zero-mass cargo & hull suspension', primaryStat: 'powerGridCost', primaryBonusMin: -0.24, primaryBonusMax: -0.12 },
  { prefix: 'Phase', family: 'GRAVITIC_SPATIAL', flavor: 'Inter-dimensional deflection bypass', primaryStat: 'damage', primaryBonusMin: 0.16, primaryBonusMax: 0.34, minRarity: 'UNCOMMON' },
  { prefix: 'Axion', family: 'GRAVITIC_SPATIAL', flavor: 'Dark-field harmonic dampening', primaryStat: 'cpuCost', primaryBonusMin: -0.22, primaryBonusMax: -0.10 },
  { prefix: 'Boson', family: 'GRAVITIC_SPATIAL', flavor: 'Force-carrier coherence amplifier', primaryStat: 'shieldCapacity', primaryBonusMin: 0.16, primaryBonusMax: 0.32 },

  // Quantum / Precision
  { prefix: 'Quantum', family: 'QUANTUM_PRECISION', flavor: 'Ultra-low CPU entanglement routing', primaryStat: 'cpuCost', primaryBonusMin: -0.25, primaryBonusMax: -0.12 },
  { prefix: 'Positronic', family: 'QUANTUM_PRECISION', flavor: 'Zero-latency predictive targeting bus', primaryStat: 'cpuCost', primaryBonusMin: -0.22, primaryBonusMax: -0.10, secondaryStat: 'muzzleSpeed', secondaryMultiplier: 1.12 },
  { prefix: 'Holographic', family: 'QUANTUM_PRECISION', flavor: 'Optical interference projection matrix', primaryStat: 'shieldCapacity', primaryBonusMin: 0.12, primaryBonusMax: 0.26 },
  { prefix: 'Neutrino', family: 'QUANTUM_PRECISION', flavor: 'Weak-interaction stealth efficiency', primaryStat: 'energyCost', primaryBonusMin: -0.22, primaryBonusMax: -0.12 },
  { prefix: 'Subatomic', family: 'QUANTUM_PRECISION', flavor: 'Precision micro-lattice fabrication', primaryStat: 'cpuCost', primaryBonusMin: -0.18, primaryBonusMax: -0.09 },

  // Nano / Biomorphic
  { prefix: 'Nanotech', family: 'NANO_BIOMORPHIC', flavor: 'Self-repairing structural nanite weave', primaryStat: 'shieldCapacity', primaryBonusMin: 0.15, primaryBonusMax: 0.32 },
  { prefix: 'Cybernetic', family: 'NANO_BIOMORPHIC', flavor: 'Integrated autonomous control loop', primaryStat: 'cpuCost', primaryBonusMin: -0.20, primaryBonusMax: -0.10 },
  { prefix: 'Molecular', family: 'NANO_BIOMORPHIC', flavor: 'Bonded lattice thermal stability', primaryStat: 'powerGridCost', primaryBonusMin: -0.16, primaryBonusMax: -0.08 },
  { prefix: 'Diatomic', family: 'NANO_BIOMORPHIC', flavor: 'Lightweight twin-valence casing', primaryStat: 'energyCost', primaryBonusMin: -0.16, primaryBonusMax: -0.08 },

  // Psionic / Exotic
  { prefix: 'Psionic', family: 'PSIONIC_EXOTIC', flavor: 'Precursor neural-resonant overdrive', primaryStat: 'damage', primaryBonusMin: 0.22, primaryBonusMax: 0.42, secondaryStat: 'energyCost', secondaryMultiplier: 0.85, minRarity: 'RARE' },
  { prefix: 'Synaptic', family: 'PSIONIC_EXOTIC', flavor: 'Biomorphic bridge reflex coupling', primaryStat: 'fireCooldown', primaryBonusMin: -0.22, primaryBonusMax: -0.12, secondaryStat: 'cpuCost', secondaryMultiplier: 0.85, minRarity: 'RARE' },
];

export const MODULE_SUBTYPE_CATALOG: readonly ModuleSubtypeDef[] = [
  // OFFENSE (HIGH)
  {
    subtype: 'Laser Turret',
    mainCategory: 'OFFENSE',
    blueprintId: 'MOD_SUB_LASER_TURRET',
    slotType: 'HIGH',
    basePrice: 520,
    powerGridCost: 15.0,
    cpuCost: 26.0,
    baseStats: { damage: 15, fireCooldown: 0.16, muzzleSpeed: 92, energyCost: 7, weaponType: 'PULSE', subtype: 'Laser Turret' },
    compatibleSuffixes: ['Emitter', 'Blaster', 'Focus', 'Crystal', 'Modulator', 'Amplifier'],
    description: 'Coherent high-frequency beam turret delivering rapid accurate strikes with minimal capacitor drag.',
  },
  {
    subtype: 'Ion Cannon',
    mainCategory: 'OFFENSE',
    blueprintId: 'MOD_SUB_ION_CANNON',
    slotType: 'HIGH',
    basePrice: 820,
    powerGridCost: 24.0,
    cpuCost: 38.0,
    baseStats: { damage: 24, fireCooldown: 0.28, muzzleSpeed: 74, energyCost: 14, shieldDamageBonus: 1.5, weaponType: 'PULSE', subtype: 'Ion Cannon' },
    compatibleSuffixes: ['Cannon', 'Disintegrator', 'Inducer', 'Inhibitor', 'Emitter', 'Bifurcator'],
    description: 'Charged ion-stream ordnance specialized in stripping hostile deflector shields (+50% vs shields).',
  },
  {
    subtype: 'Railgun',
    mainCategory: 'OFFENSE',
    blueprintId: 'MOD_SUB_RAILGUN',
    slotType: 'HIGH',
    basePrice: 1150,
    powerGridCost: 32.0,
    cpuCost: 44.0,
    baseStats: { damage: 46, fireCooldown: 0.48, muzzleSpeed: 120, energyCost: 18, armorPierce: 0.25, weaponType: 'PLASMA', subtype: 'Railgun' },
    compatibleSuffixes: ['Accelerator', 'Cannon', 'Annihilator', 'Inducer', 'Cyclotron'],
    description: 'Electromagnetic hyper-velocity mass driver firing tungsten-carbide slugs straight through hull plating.',
  },
  {
    subtype: 'Torpedo Bay',
    mainCategory: 'OFFENSE',
    blueprintId: 'MOD_SUB_TORPEDO_BAY',
    slotType: 'HIGH',
    basePrice: 1350,
    powerGridCost: 30.0,
    cpuCost: 48.0,
    baseStats: { damage: 64, fireCooldown: 0.72, muzzleSpeed: 54, energyCost: 24, splashRadius: 18, weaponType: 'PLASMA', subtype: 'Torpedo Bay' },
    compatibleSuffixes: ['Annihilator', 'Catalyst', 'Combinator', 'Bifurcator', 'Disintegrator'],
    description: 'Guided heavy warhead salvo bay engineered for devastating anti-capital hull breaches.',
  },

  // DEFENSE (MID / LOW)
  {
    subtype: 'Shield Generator',
    mainCategory: 'DEFENSE',
    blueprintId: 'MOD_SUB_SHIELD_GEN',
    slotType: 'MID',
    basePrice: 920,
    powerGridCost: 26.0,
    cpuCost: 40.0,
    baseStats: { shieldCapacity: 48, shieldRecharge: 7.5, boostAmount: 38, boostCooldown: 6.0, subtype: 'Shield Generator' },
    compatibleSuffixes: ['Shield', 'Deflector', 'Matrix', 'Buffer', 'Dampener', 'Lattice'],
    description: 'Harmonic electrostatic emitter envelope reinforcing maximum deflector capacity and recharge rate.',
  },
  {
    subtype: 'Hull Plating',
    mainCategory: 'DEFENSE',
    blueprintId: 'MOD_SUB_HULL_PLATING',
    slotType: 'LOW',
    basePrice: 480,
    powerGridCost: 10.0,
    cpuCost: 8.0,
    baseStats: { maxHpBonus: 36, hazardResistance: 0.15, subtype: 'Hull Plating' },
    compatibleSuffixes: ['Biomatrix', 'Lattice', 'Matrix', 'Shield', 'Dampener'],
    description: 'Composite alloy bulkhead armor raising maximum structural integrity and thermal/caustic resilience.',
  },
  {
    subtype: 'Power Core',
    mainCategory: 'DEFENSE',
    blueprintId: 'MOD_SUB_POWER_CORE',
    slotType: 'LOW',
    basePrice: 740,
    powerGridCost: 0.0,
    cpuCost: 14.0,
    baseStats: { energyRegenMultiplier: 1.18, maxEnergyBonus: 28, subtype: 'Power Core' },
    compatibleSuffixes: ['Generator', 'Capacitor', 'Regulator', 'Transformer', 'Cyclotron', 'Rectifier'],
    description: 'Auxiliary compact fusion manifold boosting capacitor ceiling and continuous energy regeneration.',
  },
  {
    subtype: 'Engineering Bay',
    mainCategory: 'DEFENSE',
    blueprintId: 'MOD_SUB_ENGINEERING_BAY',
    slotType: 'LOW',
    basePrice: 860,
    powerGridCost: 14.0,
    cpuCost: 28.0,
    baseStats: { hullAutoRepair: 2.5, maxHpBonus: 18, repairEfficiency: 1.25, subtype: 'Engineering Bay' },
    compatibleSuffixes: ['Biomatrix', 'Synthesizer', 'Recycler', 'Regulator', 'Processor', 'Helix'],
    description: 'Automated micro-welding repair rig sustaining active structural restoration during prolonged expeditions.',
  },

  // TRAVEL (MID / LOW)
  {
    subtype: 'Plasma Drive',
    mainCategory: 'TRAVEL',
    blueprintId: 'MOD_SUB_PLASMA_DRIVE',
    slotType: 'MID',
    basePrice: 680,
    powerGridCost: 24.0,
    cpuCost: 18.0,
    baseStats: { thrustMultiplier: 2.35, maxSpeed: 52, energyDrain: 34, subtype: 'Plasma Drive' },
    compatibleSuffixes: ['Engine', 'Accelerator', 'Coil', 'Synchrotron', 'Converter'],
    description: 'Magnetoplasmadynamic vectoring thruster delivering high acceleration and combat agility.',
  },
  {
    subtype: 'Fuel Pod',
    mainCategory: 'TRAVEL',
    blueprintId: 'MOD_SUB_FUEL_POD',
    slotType: 'LOW',
    basePrice: 460,
    powerGridCost: 6.0,
    cpuCost: 10.0,
    baseStats: { maxFuelBonus: 45, fuelEfficiency: 0.88, subtype: 'Fuel Pod' },
    compatibleSuffixes: ['Recycler', 'Buffer', 'Synthesizer', 'Converter', 'Regulator'],
    description: 'Cryo-pressurized deuterium expansion tank reducing hyperspace burn and extending deep-void range.',
  },
  {
    subtype: 'Hyperdrive Booster',
    mainCategory: 'TRAVEL',
    blueprintId: 'MOD_SUB_HYPERDRIVE_BOOSTER',
    slotType: 'LOW',
    basePrice: 1250,
    powerGridCost: 16.0,
    cpuCost: 26.0,
    baseStats: { warpApDiscount: 2, topSpeedBonus: 20, fuelEfficiency: 0.82, subtype: 'Hyperdrive Booster' },
    compatibleSuffixes: ['Hyperdrive', 'Accelerator', 'Coil', 'Inverter', 'Modulator'],
    description: 'Subspace warp-field compressor cutting jump lane AP draw and accelerating interstellar cruise.',
  },

  // COMMERCE (LOW)
  {
    subtype: 'Cargo Bay',
    mainCategory: 'COMMERCE',
    blueprintId: 'MOD_SUB_CARGO_BAY',
    slotType: 'LOW',
    basePrice: 420,
    powerGridCost: 8.0,
    cpuCost: 10.0,
    baseStats: { cargoHoldBonus: 30, subtype: 'Cargo Bay' },
    compatibleSuffixes: ['Buffer', 'Combinator', 'Matrix', 'Lattice', 'Quantifier'],
    description: 'Grav-stabilized pressurized freight hold adding +30 cubic meters of merchant cargo capacity.',
  },
  {
    subtype: 'Crew Pod',
    mainCategory: 'COMMERCE',
    blueprintId: 'MOD_SUB_CREW_POD',
    slotType: 'LOW',
    basePrice: 620,
    powerGridCost: 10.0,
    cpuCost: 16.0,
    baseStats: { crewCapacityBonus: 18, moraleBonus: 0.1, cargoHoldBonus: 10, subtype: 'Crew Pod' },
    compatibleSuffixes: ['Biomatrix', 'Regulator', 'Controller', 'Synthesizer', 'Buffer'],
    description: 'Modular life-support habitation wing expanding crew quarters, colony readiness, and wingman efficiency.',
  },

  // UTILITY / DRONES (HIGH / MID)
  {
    subtype: 'Mining Drone',
    mainCategory: 'UTILITY_DRONE',
    blueprintId: 'MOD_SUB_MINING_DRONE',
    slotType: 'HIGH',
    basePrice: 640,
    powerGridCost: 16.0,
    cpuCost: 24.0,
    baseStats: { miningPower: 22, range: 55, energyCost: 10, weaponType: 'MINING', subtype: 'Mining Drone' },
    compatibleSuffixes: ['Analyser', 'Scanner', 'Processor', 'Xenophage', 'Astrophage', 'Disintegrator'],
    description: 'Autonomous harmonic ore-extraction drone swarm capable of dissecting dense planetary & asteroid strata.',
  },
  {
    subtype: 'Salvage Drone',
    mainCategory: 'UTILITY_DRONE',
    blueprintId: 'MOD_SUB_SALVAGE_DRONE',
    slotType: 'MID',
    basePrice: 780,
    powerGridCost: 14.0,
    cpuCost: 30.0,
    baseStats: { salvageYieldBonus: 0.35, tractorRange: 65, scannerRangeBonus: 25, subtype: 'Salvage Drone' },
    compatibleSuffixes: ['Processor', 'Recycler', 'Sequencer', 'Coupler', 'Transceiver', 'Controller'],
    description: 'Magnetic tractor-recovery drone bay amplifying derelict wreck scrap yield and loot scan fidelity.',
  },
  {
    subtype: 'Deep-Core Scanner Link',
    mainCategory: 'UTILITY_DRONE',
    blueprintId: 'MOD_SCANNER_DEEPCORE',
    slotType: 'MID',
    basePrice: 740,
    powerGridCost: 12.0,
    cpuCost: 22.0,
    baseStats: { miningRateBonus: 0.14, rareOreLuckBonus: 0.12, scannerRangeBonus: 30, subtype: 'Deep-Core Scanner Link' },
    compatibleSuffixes: ['Scanner', 'Analyser', 'Sequencer', 'Transceiver'],
    description: 'Sub-surface seismic lidar node paired with Miner & Geologist telemetry consoles (+14% yield, +12% rare ore).',
  },
  {
    subtype: 'Bio-Telemetry Node',
    mainCategory: 'COMMERCE',
    blueprintId: 'MOD_BIO_TELEMETRY_NODE',
    slotType: 'LOW',
    basePrice: 820,
    powerGridCost: 10.0,
    cpuCost: 24.0,
    baseStats: { researchYieldBonus: 0.16, crewCapacityBonus: 4, moraleBonus: 0.08, subtype: 'Bio-Telemetry Node' },
    compatibleSuffixes: ['Biomatrix', 'Sequencer', 'Controller', 'Processor'],
    description: 'Cryo-linked specimen analysis bus feeding live orbital telemetry to onboard Science Officers (+16% research, +4 Berths).',
  },
];

const SUBTYPE_MAP = new Map<string, ModuleSubtypeDef>(
  MODULE_SUBTYPE_CATALOG.map((s) => [s.subtype.toLowerCase(), s])
);

export function getModuleSubtypeDef(subtype: string): ModuleSubtypeDef | undefined {
  return SUBTYPE_MAP.get(subtype.toLowerCase());
}

export interface ProceduralModuleOptions {
  seed?: string | number;
  rarity?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  preferredSlot?: 'HIGH' | 'MID' | 'LOW';
  preferredCategory?: ModuleMainCategory;
  preferredSubtype?: ModuleSubtype;
  factionAffinity?: string;
}

export interface ProceduralDroppedModule extends DroppedModule {
  mainCategory: ModuleMainCategory;
  subtype: ModuleSubtype;
  techPrefix: string;
  techSuffix: string;
  prefixFamily: PrefixFamily;
}

const RARITY_MULT_TABLE: Record<string, { weight: number; statScale: number; priceMult: number }> = {
  COMMON: { weight: 50, statScale: 0.65, priceMult: 1.0 },
  UNCOMMON: { weight: 28, statScale: 1.0, priceMult: 1.55 },
  RARE: { weight: 14, statScale: 1.35, priceMult: 2.5 },
  EPIC: { weight: 6, statScale: 1.75, priceMult: 4.2 },
  LEGENDARY: { weight: 2, statScale: 2.25, priceMult: 7.5 },
};

const FACTION_PREFIX_FAMILIES: Record<string, readonly PrefixFamily[]> = ALL_FACTION_IDS.reduce(
  (acc, fid) => {
    acc[fid] = FACTION_REGISTRY[fid].preferredPrefixFamilies;
    return acc;
  },
  {} as Record<string, readonly PrefixFamily[]>
);

function pickRarityDeterministic(rng: () => number): 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' {
  const roll = rng() * 100;
  let acc = 0;
  for (const key of ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const) {
    acc += RARITY_MULT_TABLE[key].weight;
    if (roll <= acc) return key;
  }
  return 'COMMON';
}

function formatStatLabel(stat: string, mult: number): string {
  const pct = Math.round((mult - 1) * 100);
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct}% ${stat.toUpperCase()}`;
}

export interface RolledModuleAttributes {
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  prefixDef: TechPrefixDef;
  techSuffix: string;
  customName: string;
  affixes: LootAffix[];
  powerGridCost: number;
  cpuCost: number;
  basePrice: number;
}

const DEFAULT_SUFFIXES: readonly string[] = ['Emitter', 'Matrix', 'Processor', 'Generator'];

/**
 * Shared prefix, suffix, and rarity affix synthesizer for both catalog blueprints and standalone procgen items.
 */
export function rollModulePrefixAndAffixes(params: {
  subtype: string;
  slotType: 'HIGH' | 'MID' | 'LOW' | 'BAY';
  compatibleSuffixes?: readonly string[];
  basePowerGridCost: number;
  baseCpuCost: number;
  basePrice: number;
  rarity?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  factionAffinity?: string;
  rng?: () => number;
}): RolledModuleAttributes {
  const rng = params.rng || Math.random;
  const rarity = params.rarity || pickRarityDeterministic(rng);

  const rarityOrder = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  const rIdx = rarityOrder.indexOf(rarity);
  const allowedPrefixes = TECH_PREFIXES.filter((p) => (p.minRarity ? rarityOrder.indexOf(p.minRarity) <= rIdx : true));

  const factionFamilies = params.factionAffinity
    ? FACTION_PREFIX_FAMILIES[normalizeFactionId(params.factionAffinity)]
    : undefined;
  let prefixDef: TechPrefixDef;
  if (factionFamilies && rng() < 0.65) {
    const facMatches = allowedPrefixes.filter((p) => factionFamilies.includes(p.family));
    prefixDef = facMatches.length > 0 ? rngPick(rng, facMatches) : rngPick(rng, allowedPrefixes);
  } else {
    prefixDef = rngPick(rng, allowedPrefixes);
  }

  const suffixes = params.compatibleSuffixes && params.compatibleSuffixes.length > 0 ? params.compatibleSuffixes : DEFAULT_SUFFIXES;
  const techSuffix = rngPick(rng, suffixes);
  const customName = `${prefixDef.prefix} ${params.subtype} ${techSuffix}`;

  const scale = RARITY_MULT_TABLE[rarity].statScale;
  const affixes: LootAffix[] = [];
  let pgMult = 1.0;
  let cpuMult = 1.0;

  const rawDelta = prefixDef.primaryBonusMin + rng() * (prefixDef.primaryBonusMax - prefixDef.primaryBonusMin);
  const primaryMult = Math.max(0.55, Math.round((1 + rawDelta * scale) * 100) / 100);
  if (primaryMult !== 1.0) {
    affixes.push({
      stat: prefixDef.primaryStat,
      multiplier: primaryMult,
      label: formatStatLabel(prefixDef.primaryStat, primaryMult),
    });
    if (prefixDef.primaryStat === 'powerGridCost') pgMult *= primaryMult;
    if (prefixDef.primaryStat === 'cpuCost') cpuMult *= primaryMult;
  }

  if (rarity !== 'COMMON' && prefixDef.secondaryStat && prefixDef.secondaryMultiplier) {
    const secMult = Math.round(prefixDef.secondaryMultiplier * 100) / 100;
    affixes.push({
      stat: prefixDef.secondaryStat,
      multiplier: secMult,
      label: formatStatLabel(prefixDef.secondaryStat, secMult),
    });
    if (prefixDef.secondaryStat === 'powerGridCost') pgMult *= secMult;
    if (prefixDef.secondaryStat === 'cpuCost') cpuMult *= secMult;
  }

  const extraRolls = rarity === 'RARE' ? 1 : rarity === 'EPIC' ? 2 : rarity === 'LEGENDARY' ? 3 : 0;
  const bonusStatsPool: LootAffix['stat'][] =
    params.slotType === 'HIGH'
      ? ['damage', 'muzzleSpeed', 'energyCost', 'cpuCost']
      : params.slotType === 'MID'
      ? ['shieldCapacity', 'thrustMultiplier', 'energyCost', 'powerGridCost']
      : ['powerGridCost', 'cpuCost', 'energyCost'];

  for (let i = 0; i < extraRolls; i++) {
    const stat = rngPick(rng, bonusStatsPool);
    const isReduction = stat === 'energyCost' || stat === 'powerGridCost' || stat === 'cpuCost';
    const pct = (0.07 + rng() * 0.14) * (isReduction ? -1 : 1);
    const mult = Math.round((1 + pct) * 100) / 100;
    affixes.push({ stat, multiplier: mult, label: formatStatLabel(stat, mult) });
    if (stat === 'powerGridCost') pgMult *= mult;
    if (stat === 'cpuCost') cpuMult *= mult;
  }

  return {
    rarity,
    prefixDef,
    techSuffix,
    customName,
    affixes,
    powerGridCost: Math.round(params.basePowerGridCost * pgMult * 10) / 10,
    cpuCost: Math.round(params.baseCpuCost * cpuMult * 10) / 10,
    basePrice: Math.round(params.basePrice * RARITY_MULT_TABLE[rarity].priceMult),
  };
}

/**
 * Generates a functional procedural ship module pairing a Subtype chassis,
 * a mechanically meaningful Tech Prefix, and a compatible Tech Suffix.
 */
export function generateProceduralModule(opts: ProceduralModuleOptions = {}): ProceduralDroppedModule {
  const rng = opts.seed !== undefined ? createMulberry32(opts.seed) : Math.random;

  let pool = [...MODULE_SUBTYPE_CATALOG];
  if (opts.preferredSubtype) {
    const exact = pool.filter((s) => s.subtype === opts.preferredSubtype);
    if (exact.length > 0) pool = exact;
  } else if (opts.preferredCategory) {
    const byCat = pool.filter((s) => s.mainCategory === opts.preferredCategory);
    if (byCat.length > 0) pool = byCat;
  } else if (opts.preferredSlot) {
    const bySlot = pool.filter((s) => s.slotType === opts.preferredSlot);
    if (bySlot.length > 0) pool = bySlot;
  }
  const sub = rngPick(rng, pool);

  const rolled = rollModulePrefixAndAffixes({
    subtype: sub.subtype,
    slotType: sub.slotType,
    compatibleSuffixes: sub.compatibleSuffixes,
    basePowerGridCost: sub.powerGridCost,
    baseCpuCost: sub.cpuCost,
    basePrice: sub.basePrice,
    rarity: opts.rarity,
    factionAffinity: opts.factionAffinity,
    rng,
  });

  return {
    blueprintId: sub.blueprintId,
    name: sub.subtype,
    customName: rolled.customName,
    slotType: sub.slotType,
    manufacturer: opts.factionAffinity ? `${opts.factionAffinity.replace('FACTION_', '')} Foundry` : 'Galactic Consortium',
    rarity: rolled.rarity,
    powerGridCost: rolled.powerGridCost,
    cpuCost: rolled.cpuCost,
    basePrice: rolled.basePrice,
    baseStats: { ...sub.baseStats },
    affixes: rolled.affixes,
    description: `${sub.description} [${rolled.prefixDef.prefix}: ${rolled.prefixDef.flavor}]`,
    mainCategory: sub.mainCategory,
    subtype: sub.subtype,
    techPrefix: rolled.prefixDef.prefix,
    techSuffix: rolled.techSuffix,
    prefixFamily: rolled.prefixDef.family,
  };
}

/**
 * Deterministically generates 6-8 rotating procedural station shop items for a sector.
 */
export function generateStationShopStock(
  sectorId: number,
  controllingFaction: string = 'FACTION_SOL',
  epochBucket: number = 1
): ProceduralDroppedModule[] {
  const stockCount = 8;
  const items: ProceduralDroppedModule[] = [];
  const categories: ModuleMainCategory[] = [
    'OFFENSE',
    'OFFENSE',
    'DEFENSE',
    'DEFENSE',
    'TRAVEL',
    'COMMERCE',
    'UTILITY_DRONE',
    'UTILITY_DRONE',
  ];

  for (let i = 0; i < stockCount; i++) {
    const seedStr = `station_shop_sec${sectorId}_epoch${epochBucket}_slot${i}`;
    const rng = createMulberry32(seedStr);
    const rarityRoll = rng();
    const rarity: ProceduralDroppedModule['rarity'] =
      rarityRoll > 0.94 ? 'LEGENDARY' :
      rarityRoll > 0.80 ? 'EPIC' :
      rarityRoll > 0.55 ? 'RARE' :
      rarityRoll > 0.25 ? 'UNCOMMON' : 'COMMON';

    items.push(
      generateProceduralModule({
        seed: seedStr,
        rarity,
        preferredCategory: categories[i],
        factionAffinity: controllingFaction,
      })
    );
  }
  return items;
}


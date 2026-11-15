/**
 * Milestone 1.4: Spectral- & Faction-Tied Space Mining Catalog
 * Deterministic mineral taxonomy, sector belt generation, and ship/drone mining profiles.
 */

export type OreRarityTier = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'EXOTIC';

export interface SpaceOreDef {
  id: string;
  name: string;
  tier: OreRarityTier;
  basePrice: number;
  veinColor: number;
  coreColor: number;
  emissiveHex: string;
  techComponentChance: number; // Bonus Tech Components on precision completion
  guaranteedTechComponents: number;
  minersGuildStanding: number;
  heatPerTick: number;
  spectralWeights: Record<string, number>;
  factionWeights: Record<string, number>;
  description: string;
}

export interface AsteroidNode {
  id: string;
  x: number;
  z: number;
  radius: number;
  seed: number;
  oreCommodityId: string;
  oreName: string;
  veinColor: number;
  coreColor: number;
  emissiveHex: string;
  tier: OreRarityTier;
  hp: number;
  maxHp: number;
  fractured50: boolean;
  remainingYield: number;
  maxYield: number;
  depletedUntil: number | null;
  heatState: 'NORMAL' | 'VENT_CHARGING' | 'COOLED';
  ventChargeUntil: number | null;
  ventCooldownUntil: number | null;
}

export interface MiningCapabilities {
  mainHullClass: string;
  beamPower: number;          // Raw units extracted scale
  unitsPerTick: number;       // Units extracted per 0.5s precision tick
  beamRange: number;          // Max lock-on mining distance (m)
  yieldMultiplier: number;    // Yield multiplier applied per depletion
  scoopRadius: number;        // Ore canister pickup radius (m)
  energyCostPerSec: number;   // Capacitor drain per second while beaming
  heatGenMultiplier: number;  // Heat buildup multiplier
  droneCount: number;
}

export const SPACE_ORES: Record<string, SpaceOreDef> = {
  COMM_ORE: {
    id: 'COMM_ORE',
    name: 'Silicate Ore',
    tier: 'COMMON',
    basePrice: 60,
    veinColor: 0x38bdf8,
    coreColor: 0x5a6375,
    emissiveHex: '#38bdf8',
    techComponentChance: 0,
    guaranteedTechComponents: 0,
    minersGuildStanding: 0,
    heatPerTick: 4.5,
    spectralWeights: { YELLOW_G: 50, ORANGE_K: 35, RED_M: 30, BLUE_O: 20, WHITE_A: 25, NEUTRON: 10 },
    factionWeights: { FACTION_SOL: 50, FACTION_MINERS_GUILD: 35 },
    description: 'Unprocessed heavy silicate mineral rocks mined from asteroids.',
  },
  COMM_PYRITE_ORE: {
    id: 'COMM_PYRITE_ORE',
    name: 'Sulfur Pyrite',
    tier: 'COMMON',
    basePrice: 78,
    veinColor: 0xf59e0b,
    coreColor: 0x57412c,
    emissiveHex: '#f59e0b',
    techComponentChance: 0.15,
    guaranteedTechComponents: 0,
    minersGuildStanding: 0,
    heatPerTick: 5.5,
    spectralWeights: { ORANGE_K: 48, RED_M: 42, YELLOW_G: 25, WHITE_A: 15, BLUE_O: 10, NEUTRON: 10 },
    factionWeights: { FACTION_MINERS_GUILD: 55, FACTION_FREEBOOTERS: 25 },
    description: 'Iron-sulfide asteroid ore prized by industrial foundries and blast smelters.',
  },
  COMM_CRYO_ICE: {
    id: 'COMM_CRYO_ICE',
    name: 'Cryo-Deuterium Ice',
    tier: 'UNCOMMON',
    basePrice: 90,
    veinColor: 0x67e8f9,
    coreColor: 0x3b4d66,
    emissiveHex: '#67e8f9',
    techComponentChance: 0.2,
    guaranteedTechComponents: 0,
    minersGuildStanding: 1,
    heatPerTick: 3.0,
    spectralWeights: { BLUE_O: 48, WHITE_A: 42, YELLOW_G: 20, ORANGE_K: 15, RED_M: 12, NEUTRON: 15 },
    factionWeights: { FACTION_SOL: 25, FACTION_WARDENS: 25, FACTION_FREEBOOTERS: 30 },
    description: 'Glacial comet-rock rich in trapped deuterium; refines into starship fuel on pickup.',
  },
  COMM_TITANIUM_ORE: {
    id: 'COMM_TITANIUM_ORE',
    name: 'Titanium-Ferrite',
    tier: 'UNCOMMON',
    basePrice: 125,
    veinColor: 0x94a3b8,
    coreColor: 0x334155,
    emissiveHex: '#cbd5e1',
    techComponentChance: 0.3,
    guaranteedTechComponents: 0,
    minersGuildStanding: 1,
    heatPerTick: 6.5,
    spectralWeights: { WHITE_A: 42, BLUE_O: 38, YELLOW_G: 20, ORANGE_K: 28, RED_M: 12, NEUTRON: 18 },
    factionWeights: { FACTION_HEGEMONY: 50, FACTION_MINERS_GUILD: 40 },
    description: 'High-density aerospace ferrite lattice alloyed naturally inside hyper-metallic belts.',
  },
  COMM_LITHIUM_QUARTZ: {
    id: 'COMM_LITHIUM_QUARTZ',
    name: 'Lithium-Quartz Crystal',
    tier: 'RARE',
    basePrice: 195,
    veinColor: 0xc084fc,
    coreColor: 0x3b2c59,
    emissiveHex: '#c084fc',
    techComponentChance: 0.35,
    guaranteedTechComponents: 1,
    minersGuildStanding: 1,
    heatPerTick: 8.5,
    spectralWeights: { WHITE_A: 40, NEUTRON: 28, BLUE_O: 22, ORANGE_K: 16, YELLOW_G: 10, RED_M: 8 },
    factionWeights: { FACTION_LITHOS: 55, FACTION_MINERS_GUILD: 25 },
    description: 'Resonant piezo-crystalline veins essential for capacitor matrices and beam optics.',
  },
  COMM_PHORID_RESIN: {
    id: 'COMM_PHORID_RESIN',
    name: 'Bio-Amber Resin',
    tier: 'RARE',
    basePrice: 210,
    veinColor: 0x4ade80,
    coreColor: 0x26402e,
    emissiveHex: '#4ade80',
    techComponentChance: 0.3,
    guaranteedTechComponents: 1,
    minersGuildStanding: 1,
    heatPerTick: 8.0,
    spectralWeights: { RED_M: 48, ORANGE_K: 24, YELLOW_G: 14, BLUE_O: 8, WHITE_A: 8, NEUTRON: 10 },
    factionWeights: { FACTION_PHORID: 65, FACTION_FREEBOOTERS: 20 },
    description: 'Fossilized mycorrhizal amber nodules grown around carbonaceous drift boulders.',
  },
  COMM_OBSIDIAN_MATRIX: {
    id: 'COMM_OBSIDIAN_MATRIX',
    name: 'Obsidian Monolith Shard',
    tier: 'EPIC',
    basePrice: 310,
    veinColor: 0xf43f5e,
    coreColor: 0x1c1917,
    emissiveHex: '#f43f5e',
    techComponentChance: 0.5,
    guaranteedTechComponents: 1,
    minersGuildStanding: 1,
    heatPerTick: 11.0,
    spectralWeights: { ORANGE_K: 28, NEUTRON: 36, BLUE_O: 18, WHITE_A: 16, RED_M: 10, YELLOW_G: 6 },
    factionWeights: { FACTION_HEGEMONY: 35, FACTION_KRYLL: 35, FACTION_MINERS_GUILD: 25 },
    description: 'Vitreous volcanic hyper-dense glass veined with dark matter slag.',
  },
  COMM_AETHER_CORE: {
    id: 'COMM_AETHER_CORE',
    name: 'Precursor Aether-Core',
    tier: 'EXOTIC',
    basePrice: 460,
    veinColor: 0x2dd4bf,
    coreColor: 0x0f172a,
    emissiveHex: '#2dd4bf',
    techComponentChance: 1.0,
    guaranteedTechComponents: 2,
    minersGuildStanding: 2,
    heatPerTick: 13.5,
    spectralWeights: { NEUTRON: 48, BLUE_O: 14, WHITE_A: 10, ORANGE_K: 5, RED_M: 4, YELLOW_G: 3 },
    factionWeights: { FACTION_WARDENS: 70, FACTION_LITHOS: 20, FACTION_KRYLL: 20 },
    description: 'Ancient Precursor zero-point crystalline lattice radiating exotic containment fields.',
  },
};

export interface SectorMiningProfile {
  spectralClass: string;
  controllingFaction: string;
  hazardLevel: number;
}

/**
 * Known core sector defaults so synchronous SectorRoom constructors
 * immediately populate accurate belts before optional async DB refresh.
 */
const SECTOR_MINING_DEFAULTS: Record<number, SectorMiningProfile> = {
  1: { spectralClass: 'YELLOW_G', controllingFaction: 'FACTION_SOL', hazardLevel: 1 },
  2: { spectralClass: 'ORANGE_K', controllingFaction: 'FACTION_MINERS_GUILD', hazardLevel: 3 },
  3: { spectralClass: 'RED_M', controllingFaction: 'FACTION_LITHOS', hazardLevel: 2 },
  4: { spectralClass: 'BLUE_O', controllingFaction: 'FACTION_HEGEMONY', hazardLevel: 3 },
  5: { spectralClass: 'RED_M', controllingFaction: 'FACTION_PHORID', hazardLevel: 4 },
  6: { spectralClass: 'WHITE_A', controllingFaction: 'FACTION_LITHOS', hazardLevel: 3 },
  7: { spectralClass: 'NEUTRON', controllingFaction: 'FACTION_KRYLL', hazardLevel: 5 },
  51: { spectralClass: 'NEUTRON', controllingFaction: 'FACTION_WARDENS', hazardLevel: 4 },
  52: { spectralClass: 'NEUTRON', controllingFaction: 'FACTION_WARDENS', hazardLevel: 3 },
  53: { spectralClass: 'BLUE_O', controllingFaction: 'FACTION_WARDENS', hazardLevel: 4 },
  61: { spectralClass: 'ORANGE_K', controllingFaction: 'FACTION_MINERS_GUILD', hazardLevel: 2 },
  62: { spectralClass: 'RED_M', controllingFaction: 'FACTION_MINERS_GUILD', hazardLevel: 3 },
  63: { spectralClass: 'YELLOW_G', controllingFaction: 'FACTION_MINERS_GUILD', hazardLevel: 2 },
  64: { spectralClass: 'BLUE_O', controllingFaction: 'FACTION_FREEBOOTERS', hazardLevel: 4 },
  65: { spectralClass: 'RED_M', controllingFaction: 'FACTION_FREEBOOTERS', hazardLevel: 4 },
  66: { spectralClass: 'NEUTRON', controllingFaction: 'FACTION_FREEBOOTERS', hazardLevel: 5 },
  201: { spectralClass: 'RED_M', controllingFaction: 'FACTION_KRYLL', hazardLevel: 5 },
};

export function getDefaultSectorMiningProfile(sectorId: number): SectorMiningProfile {
  if (SECTOR_MINING_DEFAULTS[sectorId]) {
    return SECTOR_MINING_DEFAULTS[sectorId];
  }
  const spectrals = ['YELLOW_G', 'ORANGE_K', 'RED_M', 'BLUE_O', 'WHITE_A', 'NEUTRON'];
  const factions = [
    'FACTION_SOL',
    'FACTION_HEGEMONY',
    'FACTION_KRYLL',
    'FACTION_PHORID',
    'FACTION_LITHOS',
    'FACTION_WARDENS',
    'FACTION_MINERS_GUILD',
    'FACTION_FREEBOOTERS',
  ];
  return {
    spectralClass: spectrals[Math.abs(sectorId) % spectrals.length],
    controllingFaction: factions[Math.abs(sectorId) % factions.length],
    hazardLevel: Math.min(5, Math.max(1, (Math.abs(sectorId) % 5) + 1)),
  };
}

class DeterministicPRNG {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) || 1337;
  }
  public next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

function selectOreForSector(
  prng: DeterministicPRNG,
  spectralClass: string,
  controllingFaction: string,
  hazardLevel: number,
  sectorId: number
): SpaceOreDef {
  const oreList = Object.values(SPACE_ORES);
  const weights = oreList.map((ore) => {
    const specW = ore.spectralWeights[spectralClass] ?? 12;
    const facW = ore.factionWeights[controllingFaction] ?? 8;
    let tierBoost = 1.0;
    if (ore.tier === 'RARE' && hazardLevel >= 2) tierBoost = 1.2 + hazardLevel * 0.15;
    if (ore.tier === 'EPIC' && hazardLevel >= 3) tierBoost = 1.15 + hazardLevel * 0.2;
    if (ore.tier === 'EXOTIC') {
      tierBoost = spectralClass === 'NEUTRON' || controllingFaction === 'FACTION_WARDENS' ? 1.8 : Math.max(0.35, hazardLevel * 0.25);
    }
    if (controllingFaction === 'FACTION_MINERS_GUILD' && ore.tier !== 'COMMON') {
      tierBoost *= 1.3;
    }
    // Sector 2 deep void guarantees rich diversity including Pyrite, Cryo, Quartz & Titanium
    if (sectorId === 2 && (ore.id === 'COMM_PYRITE_ORE' || ore.id === 'COMM_TITANIUM_ORE' || ore.id === 'COMM_LITHIUM_QUARTZ')) {
      tierBoost *= 1.4;
    }
    return Math.max(1, (specW + facW) * tierBoost);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = prng.next() * totalWeight;
  for (let i = 0; i < oreList.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return oreList[i];
  }
  return SPACE_ORES.COMM_ORE;
}

/**
 * Generates 28–44 deterministic AsteroidNodes for any sector room.
 */
export function generateSectorAsteroids(
  sectorId: number,
  spectralClass?: string,
  controllingFaction?: string,
  hazardLevel?: number
): Map<string, AsteroidNode> {
  const fallback = getDefaultSectorMiningProfile(sectorId);
  const spec = spectralClass || fallback.spectralClass;
  const fac = controllingFaction || fallback.controllingFaction;
  const hazard = typeof hazardLevel === 'number' ? hazardLevel : fallback.hazardLevel;

  const prng = new DeterministicPRNG(sectorId * 7919 + 424242);
  const isMineralHub = fac === 'FACTION_MINERS_GUILD' || fac === 'FACTION_LITHOS' || spec === 'NEUTRON' || sectorId === 2;
  const count = isMineralHub
    ? Math.floor(prng.range(36, 45))
    : Math.floor(prng.range(28, 36));

  const nodes = new Map<string, AsteroidNode>();

  for (let i = 0; i < count; i++) {
    const ore = selectOreForSector(prng, spec, fac, hazard, sectorId);
    const radius = Math.round(prng.range(2.2, 6.8) * 10) / 10;

    // Position in a belt ring outside central warp/dock origin (32m to 126m)
    const angle = prng.range(0, Math.PI * 2);
    const dist = i < 4 ? prng.range(30, 50) : prng.range(34, 126);
    const x = Math.round(Math.cos(angle) * dist * 10) / 10;
    const z = Math.round(Math.sin(angle) * dist * 10) / 10;

    const tierHpMult =
      ore.tier === 'EXOTIC' ? 2.1 :
      ore.tier === 'EPIC' ? 1.75 :
      ore.tier === 'RARE' ? 1.45 :
      ore.tier === 'UNCOMMON' ? 1.2 : 1.0;

    const maxHp = Math.round((70 + radius * 16) * tierHpMult);
    const baseYield = Math.round(6 + radius * 1.4 + (ore.tier === 'COMMON' ? 3 : ore.tier === 'UNCOMMON' ? 2 : 1));
    const id = `ast_${sectorId}_${i + 1}`;

    nodes.set(id, {
      id,
      x,
      z,
      radius,
      seed: Math.floor(prng.range(1000, 999999)),
      oreCommodityId: ore.id,
      oreName: ore.name,
      veinColor: ore.veinColor,
      coreColor: ore.coreColor,
      emissiveHex: ore.emissiveHex,
      tier: ore.tier,
      hp: maxHp,
      maxHp,
      fractured50: false,
      remainingYield: baseYield,
      maxYield: baseYield,
      depletedUntil: null,
      heatState: 'NORMAL',
      ventChargeUntil: null,
      ventCooldownUntil: null,
    });
  }

  return nodes;
}

/**
 * Computes ship mining capabilities from Main Hull Class + fitted modules (Mining Drones / Lasers).
 */
export function computeMiningCapabilities(
  mainHullClass: string | undefined,
  fittedModules: any[] = []
): MiningCapabilities {
  const hull = (mainHullClass || 'CORVETTE').toUpperCase();
  const isExtractor = hull === 'INDUSTRIAL_EXTRACTOR';
  const isHauler = hull === 'HAULER';

  let dronePowerSum = 0;
  let maxModuleRange = 0;
  let energyCostSum = 0;
  let droneCount = 0;

  for (const mod of fittedModules) {
    if (!mod) continue;
    const stats = mod.baseStats || mod.base_stats || {};
    const subtype = mod.subtype || stats.subtype || '';
    if (subtype === 'Mining Drone' || stats.weaponType === 'MINING' || Number(stats.miningPower || 0) > 0) {
      droneCount += 1;
      dronePowerSum += Number(stats.miningPower || 18);
      maxModuleRange = Math.max(maxModuleRange, Number(stats.range || 55));
      energyCostSum += Number(stats.energyCost || 10);
    }
  }

  const intrinsicPower = isExtractor ? 16 : 8;
  const rawPower = intrinsicPower + dronePowerSum;
  const rateMultiplier = isExtractor ? 1.55 : 1.0;
  const beamPower = Math.round(rawPower * rateMultiplier);

  // Units pulled per 0.5s precision tick (minimum 1 unit/tick, scaling smoothly with Mining Drones & Extractor)
  const unitsPerTick = Math.max(1, Math.round(beamPower / 12));

  const baseRange = Math.max(45, maxModuleRange);
  const beamRange = Math.round(baseRange * (isExtractor ? 1.4 : 1.0));
  const yieldMultiplier = isExtractor ? 1.35 : 1.0;
  const scoopRadius = Math.round(14 * (isExtractor ? 1.4 : isHauler ? 1.2 : 1.0) * 10) / 10;

  const baseDrainPerSec = droneCount > 0 ? Math.max(6, energyCostSum * 0.75) : 7.0;
  const energyCostPerSec = Math.round(baseDrainPerSec * (isExtractor ? 0.5 : 1.0) * 10) / 10;
  const heatGenMultiplier = isExtractor ? 0.85 : 1.0;

  return {
    mainHullClass: hull,
    beamPower,
    unitsPerTick,
    beamRange,
    yieldMultiplier,
    scoopRadius,
    energyCostPerSec,
    heatGenMultiplier,
    droneCount,
  };
}


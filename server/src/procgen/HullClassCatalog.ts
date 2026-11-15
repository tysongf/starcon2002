/**
 * Milestone 1.3: 8 Main Ship Classes x 8 Canonical Factions = 64 Playable Starship Hulls.
 * Pure Passive Hull Stats Only (Armor, Shield, Speed, TurnRate, Cargo, Fuel, PowerGrid MW, CPU tf, Variable H/M/L Slots).
 */

import { ALL_FACTION_IDS, FACTION_REGISTRY, type FactionId } from '../../../shared/FactionRegistry';

export type MainHullClass =
  | 'INTERCEPTOR'
  | 'CORVETTE'
  | 'FRIGATE'
  | 'HAULER'
  | 'INDUSTRIAL_EXTRACTOR'
  | 'DESTROYER'
  | 'CRUISER'
  | 'DREADNOUGHT';

export interface HullGeometryProfile {
  lengthMult: number;
  widthMult: number;
  heightMult: number;
  wingSpread: number;
  weaponHardpoints: number;
}

export interface HullSubtypeDef {
  hullClass: string;
  mainClass: MainHullClass;
  displayName: string;
  factionId: FactionId;
  tier: 1 | 2 | 3;
  highSlots: 1 | 2 | 3;
  midSlots: 1 | 2 | 3;
  lowSlots: 1 | 2 | 3;
  baySlots: number;
  powerGridMax: number;
  cpuMax: number;
  baseArmor: number;
  baseShield: number;
  maxFuel: number;
  cargoCapacity: number;
  baseSpeed: number;
  baseTurnRate: number;
  baseFirepower: number;
  creditCost: number;
  alloyCost: number;
  oreCost: number;
  fuelCost: number;
  apCost: number;
  requiredReputation: number;
  hullSeedDefault: number;
  geometryProfile: HullGeometryProfile;
  description: string;
}

interface MainClassBaseline {
  mainClass: MainHullClass;
  label: string;
  shortLabel: string;
  roleSummary: string;
  tier: 1 | 2 | 3;
  highSlots: 1 | 2 | 3;
  midSlots: 1 | 2 | 3;
  lowSlots: 1 | 2 | 3;
  baySlots: number;
  powerGridMax: number;
  cpuMax: number;
  baseArmor: number;
  baseShield: number;
  maxFuel: number;
  cargoCapacity: number;
  baseSpeed: number;
  baseTurnRate: number;
  baseFirepower: number;
  creditCost: number;
  alloyCost: number;
  oreCost: number;
  fuelCost: number;
  apCost: number;
  requiredReputation: number;
  geometryProfile: HullGeometryProfile;
}

const MAIN_CLASS_BASELINES: readonly MainClassBaseline[] = [
  {
    mainClass: 'INTERCEPTOR',
    label: 'Interceptor',
    shortLabel: 'INTERCEPTOR',
    roleSummary: 'High-velocity reconnaissance & strike craft (5 slots)',
    tier: 1,
    highSlots: 2,
    midSlots: 2,
    lowSlots: 1,
    baySlots: 1,
    powerGridMax: 105,
    cpuMax: 175,
    baseArmor: 100,
    baseShield: 85,
    maxFuel: 120,
    cargoCapacity: 45,
    baseSpeed: 84,
    baseTurnRate: 3.3,
    baseFirepower: 28,
    creditCost: 900,
    alloyCost: 10,
    oreCost: 8,
    fuelCost: 10,
    apCost: 14,
    requiredReputation: 0,
    geometryProfile: { lengthMult: 0.78, widthMult: 0.72, heightMult: 0.65, wingSpread: 0.9, weaponHardpoints: 2 },
  },
  {
    mainClass: 'CORVETTE',
    label: 'Corvette',
    shortLabel: 'CORVETTE',
    roleSummary: 'Balanced multi-role frontier patrol chassis (6 slots)',
    tier: 1,
    highSlots: 2,
    midSlots: 2,
    lowSlots: 2,
    baySlots: 2,
    powerGridMax: 120,
    cpuMax: 185,
    baseArmor: 115,
    baseShield: 105,
    maxFuel: 115,
    cargoCapacity: 55,
    baseSpeed: 64,
    baseTurnRate: 2.5,
    baseFirepower: 28,
    creditCost: 1100,
    alloyCost: 12,
    oreCost: 10,
    fuelCost: 10,
    apCost: 16,
    requiredReputation: 0,
    geometryProfile: { lengthMult: 1.0, widthMult: 1.0, heightMult: 1.0, wingSpread: 1.0, weaponHardpoints: 2 },
  },
  {
    mainClass: 'FRIGATE',
    label: 'Frigate',
    shortLabel: 'FRIGATE',
    roleSummary: 'Reinforced mid-weight tactical escort & sensor hull (7 slots)',
    tier: 2,
    highSlots: 2,
    midSlots: 3,
    lowSlots: 2,
    baySlots: 3,
    powerGridMax: 145,
    cpuMax: 225,
    baseArmor: 150,
    baseShield: 135,
    maxFuel: 130,
    cargoCapacity: 70,
    baseSpeed: 64,
    baseTurnRate: 2.55,
    baseFirepower: 38,
    creditCost: 1950,
    alloyCost: 20,
    oreCost: 16,
    fuelCost: 15,
    apCost: 20,
    requiredReputation: 5,
    geometryProfile: { lengthMult: 1.18, widthMult: 1.12, heightMult: 1.05, wingSpread: 1.15, weaponHardpoints: 3 },
  },
  {
    mainClass: 'HAULER',
    label: 'Heavy Hauler',
    shortLabel: 'HAULER',
    roleSummary: 'Deep-range expedition freighter & bulk logistics barge (6 slots)',
    tier: 2,
    highSlots: 1,
    midSlots: 2,
    lowSlots: 3,
    baySlots: 4,
    powerGridMax: 140,
    cpuMax: 205,
    baseArmor: 175,
    baseShield: 125,
    maxFuel: 205,
    cargoCapacity: 200,
    baseSpeed: 46,
    baseTurnRate: 1.85,
    baseFirepower: 24,
    creditCost: 2250,
    alloyCost: 24,
    oreCost: 26,
    fuelCost: 24,
    apCost: 22,
    requiredReputation: 0,
    geometryProfile: { lengthMult: 1.38, widthMult: 1.48, heightMult: 1.32, wingSpread: 0.9, weaponHardpoints: 2 },
  },
  {
    mainClass: 'INDUSTRIAL_EXTRACTOR',
    label: 'Industrial Extractor',
    shortLabel: 'EXTRACTOR',
    roleSummary: 'Reinforced core-drilling harvester & heavy ore silo hull (7 slots)',
    tier: 2,
    highSlots: 1,
    midSlots: 3,
    lowSlots: 3,
    baySlots: 4,
    powerGridMax: 155,
    cpuMax: 220,
    baseArmor: 200,
    baseShield: 140,
    maxFuel: 220,
    cargoCapacity: 230,
    baseSpeed: 42,
    baseTurnRate: 1.75,
    baseFirepower: 26,
    creditCost: 2650,
    alloyCost: 28,
    oreCost: 34,
    fuelCost: 26,
    apCost: 25,
    requiredReputation: 0,
    geometryProfile: { lengthMult: 1.36, widthMult: 1.54, heightMult: 1.4, wingSpread: 0.95, weaponHardpoints: 2 },
  },
  {
    mainClass: 'DESTROYER',
    label: 'Destroyer',
    shortLabel: 'DESTROYER',
    roleSummary: '3-High-Slot linebreaker & heavy ordnance platform (7 slots)',
    tier: 2,
    highSlots: 3,
    midSlots: 2,
    lowSlots: 2,
    baySlots: 5,
    powerGridMax: 175,
    cpuMax: 235,
    baseArmor: 180,
    baseShield: 145,
    maxFuel: 135,
    cargoCapacity: 65,
    baseSpeed: 58,
    baseTurnRate: 2.3,
    baseFirepower: 48,
    creditCost: 3000,
    alloyCost: 30,
    oreCost: 24,
    fuelCost: 18,
    apCost: 25,
    requiredReputation: 10,
    geometryProfile: { lengthMult: 1.38, widthMult: 1.18, heightMult: 1.12, wingSpread: 1.22, weaponHardpoints: 4 },
  },
  {
    mainClass: 'CRUISER',
    label: 'Cruiser',
    shortLabel: 'CRUISER',
    roleSummary: 'Heavy command cruiser with 3H/2M/3L broadside parity (8 slots)',
    tier: 3,
    highSlots: 3,
    midSlots: 2,
    lowSlots: 3,
    baySlots: 6,
    powerGridMax: 195,
    cpuMax: 270,
    baseArmor: 215,
    baseShield: 165,
    maxFuel: 150,
    cargoCapacity: 85,
    baseSpeed: 53,
    baseTurnRate: 2.1,
    baseFirepower: 56,
    creditCost: 4300,
    alloyCost: 42,
    oreCost: 34,
    fuelCost: 24,
    apCost: 30,
    requiredReputation: 15,
    geometryProfile: { lengthMult: 1.56, widthMult: 1.36, heightMult: 1.28, wingSpread: 1.22, weaponHardpoints: 4 },
  },
  {
    mainClass: 'DREADNOUGHT',
    label: 'Dreadnought',
    shortLabel: 'DREADNOUGHT',
    roleSummary: 'Capital juggernaut unlocking all 9 module sockets & peak budgets (9 slots)',
    tier: 3,
    highSlots: 3,
    midSlots: 3,
    lowSlots: 3,
    baySlots: 8,
    powerGridMax: 220,
    cpuMax: 295,
    baseArmor: 250,
    baseShield: 190,
    maxFuel: 150,
    cargoCapacity: 90,
    baseSpeed: 46,
    baseTurnRate: 1.8,
    baseFirepower: 64,
    creditCost: 5600,
    alloyCost: 54,
    oreCost: 46,
    fuelCost: 28,
    apCost: 35,
    requiredReputation: 20,
    geometryProfile: { lengthMult: 1.72, widthMult: 1.52, heightMult: 1.42, wingSpread: 1.25, weaponHardpoints: 5 },
  },
];

export const MAIN_HULL_CLASS_META: ReadonlyArray<{
  mainClass: MainHullClass;
  label: string;
  roleSummary: string;
}> = MAIN_CLASS_BASELINES.map((b) => ({
  mainClass: b.mainClass,
  label: b.label,
  roleSummary: b.roleSummary,
}));

interface HullCellMeta {
  hullClass: string;
  displayName: string;
  overrides?: Partial<Omit<HullSubtypeDef, 'hullClass' | 'mainClass' | 'displayName' | 'factionId'>>;
}

const MATRIX_NAMES: Record<MainHullClass, Record<FactionId, HullCellMeta>> = {
  INTERCEPTOR: {
    FACTION_SOL: { hullClass: 'SOL_DART', displayName: 'Sol Strike-Dart Interceptor' },
    FACTION_HEGEMONY: { hullClass: 'VAELIC_TALON', displayName: 'Vaelic Talon Interceptor' },
    FACTION_PHORID: { hullClass: 'PHORID_SPOREWING', displayName: 'Phorid Sporewing Scout' },
    FACTION_KRYLL: {
      hullClass: 'KRYLL_RUNNER',
      displayName: 'Kryll Shadow-Runner',
      overrides: { highSlots: 2, midSlots: 3, lowSlots: 1, hullSeedDefault: 41002 },
    },
    FACTION_LITHOS: { hullClass: 'LITHOS_SHARD', displayName: 'Lithos Prism-Shard Interceptor' },
    FACTION_WARDENS: { hullClass: 'WARDEN_SPARK', displayName: 'Warden Chrono-Spark Interceptor' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_PROSPECTOR', displayName: 'Guild Seam-Runner Interceptor' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_RAZOR', displayName: 'Freebooter Razor-Skiff' },
  },
  CORVETTE: {
    FACTION_SOL: {
      hullClass: 'CORVETTE',
      displayName: 'Sol Endeavour Corvette',
      overrides: {
        powerGridMax: 120,
        cpuMax: 180,
        baseArmor: 100,
        baseShield: 100,
        maxFuel: 100,
        cargoCapacity: 40,
        baseSpeed: 60,
        baseTurnRate: 2.4,
        baseFirepower: 24,
        hullSeedDefault: 12345,
      },
    },
    FACTION_HEGEMONY: { hullClass: 'VAELIC_CORVETTE', displayName: 'Vaelic Praetorian Corvette' },
    FACTION_PHORID: { hullClass: 'PHORID_CORVETTE', displayName: 'Phorid Rhizome Corvette' },
    FACTION_KRYLL: { hullClass: 'KRYLL_CUTLASS', displayName: 'Kryll Cutlass Corvette' },
    FACTION_LITHOS: { hullClass: 'LITHOS_FACET', displayName: 'Lithos Facet Corvette' },
    FACTION_WARDENS: { hullClass: 'WARDEN_CORVETTE', displayName: 'Warden Aegis Corvette' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_CORVETTE', displayName: 'Guild Drill-Escort Corvette' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_CORVETTE', displayName: 'Freebooter Reaver Corvette' },
  },
  FRIGATE: {
    FACTION_SOL: { hullClass: 'SOL_AEGIS_FRIGATE', displayName: 'Sol Aegis Perimeter Frigate' },
    FACTION_HEGEMONY: { hullClass: 'VAELIC_WARDEN', displayName: 'Vaelic Blockade Frigate' },
    FACTION_PHORID: {
      hullClass: 'PHORID_FRIGATE',
      displayName: 'Phorid Bio-Spore Frigate',
      overrides: { hullSeedDefault: 41004 },
    },
    FACTION_KRYLL: { hullClass: 'KRYLL_FRIGATE', displayName: 'Kryll Scavenger Frigate' },
    FACTION_LITHOS: { hullClass: 'LITHOS_FRIGATE', displayName: 'Lithos Vector Frigate' },
    FACTION_WARDENS: { hullClass: 'WARDEN_FRIGATE', displayName: 'Warden Reliquary Frigate' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_FRIGATE', displayName: 'Guild Bulkhead Frigate' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_FRIGATE', displayName: 'Freebooter Broadside Frigate' },
  },
  HAULER: {
    FACTION_SOL: { hullClass: 'SOL_CARAVEL', displayName: 'Sol Merchant Caravel' },
    FACTION_HEGEMONY: { hullClass: 'VAELIC_HAULER', displayName: 'Vaelic Tithe Transport' },
    FACTION_PHORID: { hullClass: 'PHORID_PODSHIP', displayName: 'Phorid Spore-Pod Freighter' },
    FACTION_KRYLL: { hullClass: 'KRYLL_MULE', displayName: 'Kryll Smuggler Mule' },
    FACTION_LITHOS: { hullClass: 'LITHOS_BARGE', displayName: 'Lithos Tessellation Barge' },
    FACTION_WARDENS: { hullClass: 'WARDEN_ARK', displayName: 'Warden Vault-Courier Hauler' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_HAULER', displayName: 'Guild Mammoth Ore Barge' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_SMUGGLER', displayName: 'Freebooter Blockade Runner' },
  },
  INDUSTRIAL_EXTRACTOR: {
    FACTION_SOL: { hullClass: 'SOL_EXTRACTOR', displayName: 'Sol Deep-Survey Extractor' },
    FACTION_HEGEMONY: { hullClass: 'VAELIC_EXTRACTOR', displayName: 'Vaelic Core-Tithe Extractor' },
    FACTION_PHORID: { hullClass: 'PHORID_EXTRACTOR', displayName: 'Phorid Bio-Siphon Extractor' },
    FACTION_KRYLL: { hullClass: 'KRYLL_HARVESTER', displayName: 'Kryll Ore-Skimmer Extractor' },
    FACTION_LITHOS: { hullClass: 'LITHOS_EXTRACTOR', displayName: 'Lithos Silicate Bore Extractor' },
    FACTION_WARDENS: { hullClass: 'WARDEN_EXTRACTOR', displayName: 'Warden Relic-Core Extractor' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_EXTRACTOR', displayName: 'Guild Goliath Strip-Extractor' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_EXTRACTOR', displayName: 'Freebooter Claim-Jumper Extractor' },
  },
  DESTROYER: {
    FACTION_SOL: { hullClass: 'SOL_LANCE', displayName: 'Sol Frontier Lance Destroyer' },
    FACTION_HEGEMONY: {
      hullClass: 'VAELIC_INTERDICTOR',
      displayName: 'Vaelic Imperial Interdictor',
      overrides: { hullSeedDefault: 41003 },
    },
    FACTION_PHORID: { hullClass: 'PHORID_THORN', displayName: 'Phorid Thornback Destroyer' },
    FACTION_KRYLL: { hullClass: 'KRYLL_MARAUDER', displayName: 'Kryll Marauder Destroyer' },
    FACTION_LITHOS: { hullClass: 'LITHOS_DESTROYER', displayName: 'Lithos Lattice Destroyer' },
    FACTION_WARDENS: { hullClass: 'WARDEN_DESTROYER', displayName: 'Warden Null-Spear Destroyer' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_DESTROYER', displayName: 'Guild Bore-Breaker Destroyer' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_DESTROYER', displayName: 'Freebooter Corsair Destroyer' },
  },
  CRUISER: {
    FACTION_SOL: {
      hullClass: 'SOL_CRUISER',
      displayName: 'Sol Vanguard Missile Cruiser',
      overrides: {
        powerGridMax: 190,
        cpuMax: 265,
        baseArmor: 200,
        baseShield: 155,
        maxFuel: 140,
        cargoCapacity: 75,
        baseSpeed: 56,
        baseTurnRate: 2.2,
        baseFirepower: 56,
        requiredReputation: 25,
        hullSeedDefault: 41001,
      },
    },
    FACTION_HEGEMONY: { hullClass: 'VAELIC_CRUISER', displayName: 'Vaelic Prefect Battlecruiser' },
    FACTION_PHORID: { hullClass: 'PHORID_CRUISER', displayName: 'Phorid Mycelial Cruiser' },
    FACTION_KRYLL: { hullClass: 'KRYLL_CRUISER', displayName: 'Kryll Scrap-Baron Cruiser' },
    FACTION_LITHOS: { hullClass: 'LITHOS_CRUISER', displayName: 'Lithos Prism Heavy Cruiser' },
    FACTION_WARDENS: { hullClass: 'WARDEN_CRUISER', displayName: 'Warden Monolith Cruiser' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_CRUISER', displayName: 'Guild Foundry-Guard Cruiser' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_CRUISER', displayName: 'Freebooter Reaver Cruiser' },
  },
  DREADNOUGHT: {
    FACTION_SOL: { hullClass: 'SOL_DREADNOUGHT', displayName: 'Sol Apex Siege Dreadnought' },
    FACTION_HEGEMONY: {
      hullClass: 'VAELIC_SOVEREIGN',
      displayName: 'Vaelic Sovereign Dreadnought',
      overrides: { powerGridMax: 215, cpuMax: 285, baseArmor: 235, baseShield: 185, baseSpeed: 48, baseTurnRate: 1.9, baseFirepower: 64 },
    },
    FACTION_PHORID: {
      hullClass: 'PHORID_LEVIATHAN',
      displayName: 'Phorid Canopy Leviathan',
      overrides: { powerGridMax: 205, cpuMax: 295, baseArmor: 220, baseShield: 170, maxFuel: 185, baseSpeed: 50, baseTurnRate: 2.0, baseFirepower: 60 },
    },
    FACTION_KRYLL: { hullClass: 'KRYLL_DREADNOUGHT', displayName: 'Kryll Scrap-Titan Juggernaut' },
    FACTION_LITHOS: {
      hullClass: 'LITHOS_MONITOR',
      displayName: 'Lithos Crystalline Monitor',
      overrides: {
        powerGridMax: 225,
        cpuMax: 300,
        baseArmor: 265,
        baseShield: 195,
        maxFuel: 125,
        cargoCapacity: 85,
        baseSpeed: 44,
        baseTurnRate: 1.8,
        baseFirepower: 62,
        requiredReputation: 0,
        hullSeedDefault: 41005,
      },
    },
    FACTION_WARDENS: { hullClass: 'WARDEN_DREADNOUGHT', displayName: 'Warden Epoch Dreadnought' },
    FACTION_MINERS_GUILD: { hullClass: 'MINERS_DREADNOUGHT', displayName: 'Guild Core-Cracker Dreadnought' },
    FACTION_FREEBOOTERS: { hullClass: 'FREEBOOTER_DREADNOUGHT', displayName: 'Freebooter Black-Flag Dreadnought' },
  },
};

function synthesizeHullDef(
  baseline: MainClassBaseline,
  classIndex: number,
  factionId: FactionId,
  factionIndex: number
): HullSubtypeDef {
  const faction = FACTION_REGISTRY[factionId];
  const d = faction.hullDoctrine;
  const meta = MATRIX_NAMES[baseline.mainClass][factionId];
  const ov = meta.overrides || {};

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const hullSeedDefault = ov.hullSeedDefault ?? (10000 * (classIndex + 1) + 400 + factionIndex * 11);

  return {
    hullClass: meta.hullClass,
    mainClass: baseline.mainClass,
    displayName: meta.displayName,
    factionId,
    tier: ov.tier ?? baseline.tier,
    highSlots: ov.highSlots ?? baseline.highSlots,
    midSlots: ov.midSlots ?? baseline.midSlots,
    lowSlots: ov.lowSlots ?? baseline.lowSlots,
    baySlots: ov.baySlots ?? baseline.baySlots,
    powerGridMax: ov.powerGridMax ?? Math.round(baseline.powerGridMax * d.powerGridMult),
    cpuMax: ov.cpuMax ?? Math.round(baseline.cpuMax * d.cpuMult),
    baseArmor: ov.baseArmor ?? Math.round(baseline.baseArmor * d.armorMult),
    baseShield: ov.baseShield ?? Math.round(baseline.baseShield * d.shieldMult),
    maxFuel: ov.maxFuel ?? Math.round(baseline.maxFuel * d.fuelMult),
    cargoCapacity: ov.cargoCapacity ?? Math.round(baseline.cargoCapacity * d.cargoMult),
    baseSpeed: ov.baseSpeed ?? Math.round(baseline.baseSpeed * d.speedMult),
    baseTurnRate: ov.baseTurnRate ?? round2(baseline.baseTurnRate * d.turnRateMult),
    baseFirepower: ov.baseFirepower ?? Math.round(baseline.baseFirepower * d.firepowerMult),
    creditCost: ov.creditCost ?? Math.round((baseline.creditCost * d.creditMult) / 50) * 50,
    alloyCost: ov.alloyCost ?? Math.max(8, Math.round(baseline.alloyCost * (0.9 + (d.armorMult - 1) * 0.6))),
    oreCost: ov.oreCost ?? Math.max(6, Math.round(baseline.oreCost * (0.95 + (d.cargoMult - 1) * 0.4))),
    fuelCost: ov.fuelCost ?? Math.max(8, Math.round(baseline.fuelCost * d.fuelMult)),
    apCost: ov.apCost ?? baseline.apCost,
    requiredReputation:
      ov.requiredReputation ??
      Math.max(0, baseline.requiredReputation + (baseline.tier >= 2 ? d.minRepOffset : 0)),
    hullSeedDefault,
    geometryProfile: ov.geometryProfile ?? { ...baseline.geometryProfile },
    description: `${baseline.label}-class hull engineered by ${faction.name}. ${d.loreFlavor}`,
  };
}

export const HULL_CLASS_CATALOG: readonly HullSubtypeDef[] = MAIN_CLASS_BASELINES.flatMap(
  (baseline, classIdx) =>
    ALL_FACTION_IDS.map((fid, facIdx) => synthesizeHullDef(baseline, classIdx, fid, facIdx))
);

const HULL_MAP = new Map<string, HullSubtypeDef>(
  HULL_CLASS_CATALOG.map((h) => [h.hullClass.toUpperCase(), h])
);

const DEFAULT_HULL = HULL_CLASS_CATALOG.find((h) => h.hullClass === 'CORVETTE')!;

export function getHullDef(hullClass?: string | null): HullSubtypeDef {
  if (!hullClass) return DEFAULT_HULL;
  return HULL_MAP.get(hullClass.toUpperCase()) || DEFAULT_HULL;
}

export function findExactHullDef(hullClass: string): HullSubtypeDef | undefined {
  return HULL_MAP.get(hullClass.toUpperCase());
}

export function getHullsByMainClass(mainClass?: MainHullClass, factionId?: string): HullSubtypeDef[] {
  return HULL_CLASS_CATALOG.filter((h) => {
    if (mainClass && h.mainClass !== mainClass) return false;
    if (factionId && factionId !== 'ALL' && h.factionId !== factionId) return false;
    return true;
  });
}

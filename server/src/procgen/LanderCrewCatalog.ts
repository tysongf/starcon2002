/**
 * Milestone 1.6: Progressive 4-Tier Lander Chassis, 17-Specialty Surface Modifiers,
 * Active [1]-[4] Lander Abilities, Grit Survival Rolls & Veteran Progression.
 */

import { diminishingStackSum, type CrewSpecialtyId } from './CrewCatalog';

export interface LanderTierDef {
  tier: 1 | 2 | 3 | 4;
  name: string;
  crewCapacity: number;
  maxHull: number;
  maxFuel: number;
  cargoCapacity: number;
  creditCost: number;
  speedMult: number;
  radarRadiusMult: number;
  hazardReductionBonus: number;
  biteReductionBonus: number;
  description: string;
}

export const LANDER_CHASSIS_TIERS: Record<number, LanderTierDef> = {
  1: {
    tier: 1,
    name: 'Vanguard Mk.I Lander',
    crewCapacity: 1,
    maxHull: 100,
    maxFuel: 100,
    cargoCapacity: 25,
    creditCost: 1000,
    speedMult: 1.0,
    radarRadiusMult: 1.0,
    hazardReductionBonus: 0,
    biteReductionBonus: 0,
    description: 'Standard orbital drop craft seating 1 Specialist.',
  },
  2: {
    tier: 2,
    name: 'Pathfinder Mk.II Survey Pod',
    crewCapacity: 2,
    maxHull: 140,
    maxFuel: 135,
    cargoCapacity: 38,
    creditCost: 2600,
    speedMult: 1.1,
    radarRadiusMult: 1.18,
    hazardReductionBonus: 0,
    biteReductionBonus: 0,
    description: 'Twin-seat planetary reconnaissance hull (+10% speed, wider seismic radar).',
  },
  3: {
    tier: 3,
    name: 'Surveyor Mk.III Deep-Range Craft',
    crewCapacity: 3,
    maxHull: 185,
    maxFuel: 175,
    cargoCapacity: 52,
    creditCost: 5200,
    speedMult: 1.18,
    radarRadiusMult: 1.32,
    hazardReductionBonus: 0.15,
    biteReductionBonus: 0.08,
    description: 'Three-seat heavy explorer with reinforced environmental insulation (-15% hazards).',
  },
  4: {
    tier: 4,
    name: 'Leviathan Mk.IV Assault Drop-Rig',
    crewCapacity: 4,
    maxHull: 245,
    maxFuel: 220,
    cargoCapacity: 72,
    creditCost: 9800,
    speedMult: 1.25,
    radarRadiusMult: 1.45,
    hazardReductionBonus: 0.22,
    biteReductionBonus: 0.20,
    description: 'Four-seat Apex Titan & Level-3 extreme hazard assault rig.',
  },
};

export function getLanderTierDef(tier?: number | null): LanderTierDef {
  const t = Number(tier || 1);
  return LANDER_CHASSIS_TIERS[t] || LANDER_CHASSIS_TIERS[1];
}

export type LanderAbilityId =
  | 'ARC_SHOCKWAVE'
  | 'SEISMIC_VEIN_CRACKER'
  | 'NANO_GEL_PATCH'
  | 'OVERLOAD_CAPACITOR'
  | 'AFTERBURNER_SURGE';

export interface LanderActiveAbility {
  slotIndex: number; // 1..4 hotkey
  abilityId: LanderAbilityId;
  name: string;
  icon: string;
  cooldownSec: number;
  description: string;
  grantedByName: string;
  grantedBySpecialty: CrewSpecialtyId;
}

export interface EmbarkedCrewSnapshot {
  id: string;
  seed: number;
  name: string;
  callsign: string;
  factionId: string;
  species: string;
  rarity: string;
  primarySpecialty: CrewSpecialtyId;
  specialties: CrewSpecialtyId[];
  aptitude: number;
  grit: number;
  efficiency: number;
  traitId: string;
  traitLabel: string;
  traitDesc: string;
  morale: number;
  previousAssignmentType: 'RESERVE' | 'SHIP_BAY';
  previousBaySlot: string | null;
}

export interface LanderCrewEffects {
  mineralYieldMult: number;
  bonusMineralChance: number;
  bioYieldMult: number;
  stunDurationMult: number;
  stunCooldownMult: number;
  extraTitanStunChance: number;
  biteDamageMult: number;
  passiveHullRegenPerSec: number;
  speedMult: number;
  fuelBurnMult: number;
  radarRadiusMult: number;
  discoveryRadiusMult: number;
  thermalResistBonus: number;
  ionResistBonus: number;
  causticResistBonus: number;
  cargoCapBonusPct: number;
  beaconRangeMult: number;
  beaconFuelBonus: number;
  extraMaxHullPct: number;
  precursorBonusEnabled: boolean;
  hazardPayDiscount: number;
  activeAbilities: LanderActiveAbility[];
}

function getSpecialtyAbilitySpec(spec: CrewSpecialtyId): Omit<LanderActiveAbility, 'slotIndex' | 'grantedByName' | 'grantedBySpecialty'> {
  switch (spec) {
    case 'Soldier':
    case 'Gunner':
      return {
        abilityId: 'ARC_SHOCKWAVE',
        name: 'Arc Shockwave',
        icon: '⚡',
        cooldownSec: 28,
        description: '360° stun shockwave (120px) paralyzing predators & +2 Apex Titan stun hits.',
      };
    case 'Miner':
    case 'Geologist':
    case 'Chemist':
      return {
        abilityId: 'SEISMIC_VEIN_CRACKER',
        name: 'Vein Cracker',
        icon: '⛏️',
        cooldownSec: 30,
        description: '2x seismic scan pulse + doubles mineral harvest yield for 12s.',
      };
    case 'Biologist':
    case 'Medic':
      return {
        abilityId: 'NANO_GEL_PATCH',
        name: 'Nano-Gel Patch',
        icon: '💉',
        cooldownSec: 26,
        description: 'Restores +32 Hull, vents -45°C heat & grants 8s Caustic immunity.',
      };
    case 'Engineer':
    case 'Mechanic':
    case 'Physicist':
    case 'Archaeologist':
      return {
        abilityId: 'OVERLOAD_CAPACITOR',
        name: 'Overload Capacitor',
        icon: '🔧',
        cooldownSec: 30,
        description: 'Clears Ion/Flameout scramble, restores +18 Hull & reveals Precursor sites.',
      };
    default:
      return {
        abilityId: 'AFTERBURNER_SURGE',
        name: 'Afterburner Surge',
        icon: '🚀',
        cooldownSec: 22,
        description: '+75% thruster velocity with zero fuel consumption for 7s.',
      };
  }
}

/**
 * Computes combined passive multipliers & up to 4 hotkeyed Active Abilities from embarked specialists.
 */
export function computeLanderCrewEffects(
  embarked: EmbarkedCrewSnapshot[],
  tierDef: LanderTierDef
): LanderCrewEffects {
  const buckets = new Map<CrewSpecialtyId, number[]>();

  for (const c of embarked) {
    const statWeight = 0.72 + (Number(c.aptitude || 50) + Number(c.efficiency || 50)) / 360;
    const moraleFactor = (c.morale ?? 100) < 20 ? 0.25 : (c.morale ?? 100) < 50 ? 0.65 : 1.0;
    const eff = statWeight * moraleFactor;
    for (const sp of c.specialties) {
      const arr = buckets.get(sp) || [];
      arr.push(eff);
      buckets.set(sp, arr);
    }
  }

  const stack = (sp: CrewSpecialtyId, base: number): number => {
    const list = buckets.get(sp);
    if (!list || list.length === 0) return 0;
    return base * diminishingStackSum(list);
  };

  // Deduplicate active abilities cleanly across embarked seats up to crewCapacity (max 4)
  const seenAbilities = new Set<LanderAbilityId>();
  const activeAbilities: LanderActiveAbility[] = [];
  for (const c of embarked) {
    if (activeAbilities.length >= Math.min(4, tierDef.crewCapacity)) break;
    let chosenSpec = c.primarySpecialty;
    let specDef = getSpecialtyAbilitySpec(chosenSpec);
    if (seenAbilities.has(specDef.abilityId)) {
      const alt = c.specialties.find((s) => !seenAbilities.has(getSpecialtyAbilitySpec(s).abilityId));
      if (alt) {
        chosenSpec = alt;
        specDef = getSpecialtyAbilitySpec(alt);
      }
    }
    if (!seenAbilities.has(specDef.abilityId)) {
      seenAbilities.add(specDef.abilityId);
      activeAbilities.push({
        slotIndex: activeAbilities.length + 1,
        ...specDef,
        grantedByName: c.name,
        grantedBySpecialty: chosenSpec,
      });
    }
  }

  const soldierReduc = stack('Soldier', 0.20);
  const gunnerPower = stack('Gunner', 0.55);
  const minerYield = stack('Miner', 0.24);
  const geoScan = stack('Geologist', 0.24);
  const geoBonus = stack('Geologist', 0.18);
  const chemCaustic = stack('Chemist', 0.20);
  const chemBio = stack('Chemist', 0.12);
  const bioYield = stack('Biologist', 0.28);
  const bioStun = stack('Biologist', 0.28);
  const medicRegen = stack('Medic', 0.55);
  const pilotSpeed = stack('Pilot', 0.18);
  const navFuel = stack('Navigator', 0.22);
  const astroDetect = stack('Astronomer', 0.40);
  const engHazard = stack('Engineer', 0.20);
  const mechHull = stack('Mechanic', 0.16);
  const physIon = stack('Physicist', 0.24);
  const archBonus = stack('Archaeologist', 1.0);
  const merchCargo = stack('Merchant', 0.20);
  const settlerBeacon = stack('Settler', 0.45);
  const diploDiscount = stack('Diplomat', 0.25);

  return {
    mineralYieldMult: Number((1 + minerYield + stack('Geologist', 0.08)).toFixed(3)),
    bonusMineralChance: Math.min(0.65, geoBonus),
    bioYieldMult: Number((1 + bioYield + chemBio).toFixed(3)),
    stunDurationMult: Number((1 + bioStun + stack('Medic', 0.10)).toFixed(3)),
    stunCooldownMult: Math.max(0.55, Number((1 - stack('Soldier', 0.15) - stack('Gunner', 0.14)).toFixed(3))),
    extraTitanStunChance: Math.min(1.0, gunnerPower),
    biteDamageMult: Math.max(0.45, Number((1 - tierDef.biteReductionBonus - soldierReduc).toFixed(3))),
    passiveHullRegenPerSec: Number((medicRegen + stack('Mechanic', 0.18)).toFixed(2)),
    speedMult: Number((tierDef.speedMult * (1 + pilotSpeed)).toFixed(3)),
    fuelBurnMult: Math.max(0.45, Number((1 - navFuel).toFixed(3))),
    radarRadiusMult: Number((tierDef.radarRadiusMult * (1 + geoScan + stack('Astronomer', 0.15))).toFixed(3)),
    discoveryRadiusMult: Number((1 + astroDetect).toFixed(3)),
    thermalResistBonus: Math.min(0.85, tierDef.hazardReductionBonus + engHazard + stack('Medic', 0.10)),
    ionResistBonus: Math.min(0.85, tierDef.hazardReductionBonus + engHazard + physIon),
    causticResistBonus: Math.min(0.85, tierDef.hazardReductionBonus + chemCaustic),
    cargoCapBonusPct: Math.min(0.60, merchCargo),
    beaconRangeMult: Number((1 + settlerBeacon).toFixed(2)),
    beaconFuelBonus: settlerBeacon > 0 ? Math.round(10 + settlerBeacon * 10) : 0,
    extraMaxHullPct: Math.min(0.50, mechHull),
    precursorBonusEnabled: archBonus > 0 || physIon > 0,
    hazardPayDiscount: Math.min(0.5, diploDiscount),
    activeAbilities,
  };
}

/**
 * Deterministic Grit Survival Roll on Lander Destruction (hull <= 0).
 * High Grit yields up to 85% chance to survive inside an orbital CASTAWAY pod.
 */
export function evaluateGritSurvivalRoll(
  crew: EmbarkedCrewSnapshot,
  planetSeedFactor: number
): { survived: boolean; survivalChance: number; roll: number } {
  const grit = Number(crew.grit || 50);
  const traitBonus = crew.traitId === 'STALWART' || crew.traitId === 'UNBREAKABLE' ? 0.10 : 0;
  const survivalChance = Math.min(0.85, Math.max(0.10, 0.15 + (grit - 40) * 0.011 + traitBonus));

  // Deterministic normalized roll [0, 1)
  let h = (Number(crew.seed || 1337) ^ Math.imul(planetSeedFactor, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  const roll = (h >>> 0) / 4294967296;

  return {
    survived: roll < survivalChance,
    survivalChance: Number(survivalChance.toFixed(3)),
    roll: Number(roll.toFixed(4)),
  };
}

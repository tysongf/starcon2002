/**
 * Milestone 1.5: Procedural Crew Specialties, Stat Rolling, Station Bays & Colony Modules.
 * Implements the 17 Specialties across 4 Departments, 1->5 multi-specialty scaling by Rarity,
 * deterministic faction-weighted procedural generation, salary/brokerage formulas,
 * diminishing stacking returns, Tiered Ship Bay specs, and Colony N-Specialist gating rules.
 */

import { createMulberry32, rngFloat, rngInt, rngPick } from './DeterministicPRNG';
import {
  ALL_FACTION_IDS,
  FACTION_REGISTRY,
  normalizeFactionId,
  type FactionId,
} from '../../../shared/FactionRegistry';

export type CrewDepartment = 'OPERATIONS' | 'ENGINEERING' | 'SCIENCE' | 'COMMERCE';

export type CrewSpecialtyId =
  | 'Pilot'
  | 'Soldier'
  | 'Navigator'
  | 'Gunner'
  | 'Medic'
  | 'Engineer'
  | 'Mechanic'
  | 'Geologist'
  | 'Miner'
  | 'Diplomat'
  | 'Merchant'
  | 'Biologist'
  | 'Physicist'
  | 'Astronomer'
  | 'Settler'
  | 'Chemist'
  | 'Archaeologist';

export type CrewRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface SpecialtyDef {
  id: CrewSpecialtyId;
  department: CrewDepartment;
  icon: string;
  title: string;
  focusStatLabel: string;
  bonusSummary: string;
  baseSalaryWeight: number;
}

export const CREW_SPECIALTIES: readonly SpecialtyDef[] = [
  // OPERATIONS (Flight & Combat)
  { id: 'Pilot', department: 'OPERATIONS', icon: '✈️', title: 'Helm Pilot', focusStatLabel: 'Sublight Agility', bonusSummary: 'Max speed, turn rate & thruster evasion', baseSalaryWeight: 1.05 },
  { id: 'Navigator', department: 'OPERATIONS', icon: '🧭', title: 'Astrogator', focusStatLabel: 'Warp Routing', bonusSummary: 'Hyperspace jump fuel & AP reduction', baseSalaryWeight: 1.1 },
  { id: 'Gunner', department: 'OPERATIONS', icon: '🎯', title: 'Ordnance Gunner', focusStatLabel: 'Weaponry', bonusSummary: 'Weapon damage, muzzle velocity & cadence', baseSalaryWeight: 1.12 },
  { id: 'Soldier', department: 'OPERATIONS', icon: '🛡️', title: 'Marine Trooper', focusStatLabel: 'Security & Boarding', bonusSummary: 'Garrison strength, ambush defense & drone DPS', baseSalaryWeight: 1.0 },
  { id: 'Medic', department: 'OPERATIONS', icon: '⚕️', title: 'Field Surgeon', focusStatLabel: 'Crew Survival', bonusSummary: 'Morale stability, hazard injury & lander resilience', baseSalaryWeight: 1.08 },

  // ENGINEERING (Power, Repair & Extraction)
  { id: 'Engineer', department: 'ENGINEERING', icon: '⚡', title: 'Systems Engineer', focusStatLabel: 'Reactor & Grid', bonusSummary: 'Power Grid MW, CPU tf & shield recharge rate', baseSalaryWeight: 1.18 },
  { id: 'Mechanic', department: 'ENGINEERING', icon: '🔧', title: 'Hull Mechanic', focusStatLabel: 'Hull & Salvage', bonusSummary: 'Wreck salvage yield & hull repair efficiency', baseSalaryWeight: 1.04 },
  { id: 'Miner', department: 'ENGINEERING', icon: '⛏️', title: 'Deep-Core Miner', focusStatLabel: 'Extraction Rate', bonusSummary: 'Space beam yield/speed & thermal vent headroom', baseSalaryWeight: 1.05 },
  { id: 'Geologist', department: 'ENGINEERING', icon: '🪨', title: 'Exo-Geologist', focusStatLabel: 'Mineral Assay', bonusSummary: 'Rare/exotic ore grade weighting & derrick yield', baseSalaryWeight: 1.12 },

  // SCIENCE (Research, Survey & Precursor)
  { id: 'Biologist', department: 'SCIENCE', icon: '🧬', title: 'Xenobiologist', focusStatLabel: 'Bio-Synthesis', bonusSummary: 'Xenobiology Bio-Data yield & biosphere growth', baseSalaryWeight: 1.15 },
  { id: 'Physicist', department: 'SCIENCE', icon: '⚛️', title: 'Quantum Physicist', focusStatLabel: 'Subspace Theory', bonusSummary: 'Precursor research yield & energy efficiency', baseSalaryWeight: 1.2 },
  { id: 'Astronomer', department: 'SCIENCE', icon: '🔭', title: 'Void Astronomer', focusStatLabel: 'Deep Scanning', bonusSummary: 'Starmap scan radius & quasispace anomaly range', baseSalaryWeight: 1.1 },
  { id: 'Chemist', department: 'SCIENCE', icon: '⚗️', title: 'Cryo-Chemist', focusStatLabel: 'Refining & Hazmat', bonusSummary: 'Cryo-ice fuel refining, refinery yield & acid resist', baseSalaryWeight: 1.12 },
  { id: 'Archaeologist', department: 'SCIENCE', icon: '🏺', title: 'Xeno-Archaeologist', focusStatLabel: 'Precursor Relics', bonusSummary: 'Precursor artifact discovery & excavation yield', baseSalaryWeight: 1.22 },

  // COMMERCE & COLONIZATION
  { id: 'Merchant', department: 'COMMERCE', icon: '💹', title: 'Trade Factor', focusStatLabel: 'Market Margin', bonusSummary: 'Port trade margins, contract payouts & colony tax', baseSalaryWeight: 1.15 },
  { id: 'Diplomat', department: 'COMMERCE', icon: '🕊️', title: 'Envoy Diplomat', focusStatLabel: 'Faction Relations', bonusSummary: 'Standing gain, bribe discounts & hail recruitment', baseSalaryWeight: 1.16 },
  { id: 'Settler', department: 'COMMERCE', icon: '🏙️', title: 'Frontier Pioneer', focusStatLabel: 'Colony Growth', bonusSummary: 'Colony population cap/growth & local wage offset', baseSalaryWeight: 1.0 },
];

export const SPECIALTY_MAP = new Map<CrewSpecialtyId, SpecialtyDef>(
  CREW_SPECIALTIES.map((s) => [s.id, s])
);

export const ALL_SPECIALTY_IDS: readonly CrewSpecialtyId[] = CREW_SPECIALTIES.map((s) => s.id);

export interface RarityTierSpec {
  rarity: CrewRarity;
  specialtyCount: 1 | 2 | 3 | 4 | 5;
  statMin: number;
  statMax: number;
  powerFactor: number;
  salaryMult: number;
  hireFeeMult: number;
  weight: number;
  color: string;
}

export const CREW_RARITY_SPECS: Record<CrewRarity, RarityTierSpec> = {
  COMMON: { rarity: 'COMMON', specialtyCount: 1, statMin: 24, statMax: 58, powerFactor: 1.0, salaryMult: 1.0, hireFeeMult: 1.0, weight: 48, color: '#94a3b8' },
  UNCOMMON: { rarity: 'UNCOMMON', specialtyCount: 2, statMin: 38, statMax: 72, powerFactor: 1.22, salaryMult: 1.55, hireFeeMult: 1.8, weight: 30, color: '#34d399' },
  RARE: { rarity: 'RARE', specialtyCount: 3, statMin: 52, statMax: 86, powerFactor: 1.48, salaryMult: 2.35, hireFeeMult: 3.1, weight: 15, color: '#38bdf8' },
  EPIC: { rarity: 'EPIC', specialtyCount: 4, statMin: 66, statMax: 95, powerFactor: 1.78, salaryMult: 3.4, hireFeeMult: 5.2, weight: 5.5, color: '#c084fc' },
  LEGENDARY: { rarity: 'LEGENDARY', specialtyCount: 5, statMin: 80, statMax: 100, powerFactor: 2.15, salaryMult: 4.9, hireFeeMult: 8.5, weight: 1.5, color: '#f59e0b' },
};

export interface CrewTraitDef {
  id: string;
  label: string;
  description: string;
  bonusKey: string;
  bonusValue: number;
}

export const CREW_TRAITS: readonly CrewTraitDef[] = [
  { id: 'VOID_BORN', label: 'Void-Born Instinct', description: '+6% sublight agility and zero zero-G fatigue.', bonusKey: 'flightSpeedBonus', bonusValue: 0.06 },
  { id: 'DEEP_CORE_VETERAN', label: 'Deep-Core Veteran', description: '+10% asteroid beam yield and thermal stability.', bonusKey: 'miningYieldBonus', bonusValue: 0.1 },
  { id: 'XENO_SAVANT', label: 'Xenobiology Savant', description: '+12% Bio-Data extracted per planetary organism.', bonusKey: 'bioDataBonus', bonusValue: 0.12 },
  { id: 'SLIPSTREAM_ACE', label: 'Slipstream Pathfinder', description: '-8% hyperspace warp fuel consumption.', bonusKey: 'warpFuelDiscount', bonusValue: 0.08 },
  { id: 'FRUGAL_QUARTERMASTER', label: 'Frugal Quartermaster', description: 'Reduces this officer cycle salary demand by 20%.', bonusKey: 'salaryDiscount', bonusValue: 0.2 },
  { id: 'RELIC_HUNTER', label: 'Precursor Savant', description: '+12% Precursor fragment & wreck relic discovery.', bonusKey: 'precursorBonus', bonusValue: 0.12 },
  { id: 'BIO_STABILIZER', label: 'Bio-Containment Expert', description: '+8% planetary hazard tolerance & lander survival.', bonusKey: 'hazardResist', bonusValue: 0.08 },
  { id: 'IRON_DISCIPLINE', label: 'Iron Discipline', description: 'Morale loss from overdue wages halved.', bonusKey: 'moraleProtection', bonusValue: 0.5 },
  { id: 'PLASMA_TUNER', label: 'Overclocked Capacitor', description: '+8% weapon damage and energy recharge.', bonusKey: 'weaponDamageBonus', bonusValue: 0.08 },
  { id: 'SILVER_TONGUE', label: 'Silver-Tongued Envoy', description: '+10% faction standing gains and hail recruitment discount.', bonusKey: 'reputationGainBonus', bonusValue: 0.1 },
  { id: 'STARPORT_BROKER', label: 'Guild Exchange Broker', description: '+8% colony tax surplus and +10% resale brokerage value.', bonusKey: 'tradeMarginBonus', bonusValue: 0.08 },
  { id: 'CRYO_REFINER', label: 'Cryogenic Distiller', description: '+15% fuel refined from harvested Cryo-Ice.', bonusKey: 'fuelRefineBonus', bonusValue: 0.15 },
];

export interface ShipBayBlueprintDef {
  blueprintId: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  department: CrewDepartment;
  stationCount: 1 | 2 | 3 | 4;
  acceptedSpecialties: readonly CrewSpecialtyId[];
  powerGridCost: number;
  cpuCost: number;
  basePrice: number;
  baseRarity: CrewRarity;
  baseStats: Record<string, any>;
  description: string;
}

export const SHIP_BAY_BLUEPRINTS: readonly ShipBayBlueprintDef[] = [
  // Research Bays Mk.I-IV (up to 4 Research Officers in one Mk.IV Bay!)
  {
    blueprintId: 'MOD_BAY_RESEARCH_T1', name: 'Research Bay Mk.I', tier: 1, department: 'SCIENCE', stationCount: 1,
    acceptedSpecialties: ['Biologist', 'Physicist', 'Astronomer', 'Chemist', 'Archaeologist'],
    powerGridCost: 8, cpuCost: 16, basePrice: 480, baseRarity: 'COMMON',
    baseStats: { bayDepartment: 'SCIENCE', stationCount: 1, researchYieldBonus: 0.08, subtype: 'Research Bay Mk.I' },
    description: 'Compact orbital science lab opening 1 Science Station (+8% base research return + officer bonuses).',
  },
  {
    blueprintId: 'MOD_BAY_RESEARCH_T2', name: 'Research Bay Mk.II', tier: 2, department: 'SCIENCE', stationCount: 2,
    acceptedSpecialties: ['Biologist', 'Physicist', 'Astronomer', 'Chemist', 'Archaeologist'],
    powerGridCost: 14, cpuCost: 26, basePrice: 1050, baseRarity: 'UNCOMMON',
    baseStats: { bayDepartment: 'SCIENCE', stationCount: 2, researchYieldBonus: 0.15, subtype: 'Research Bay Mk.II' },
    description: 'Dual-wing xenobiology & physics lab hosting 2 Science Officers simultaneously.',
  },
  {
    blueprintId: 'MOD_BAY_RESEARCH_T3', name: 'Research Bay Mk.III', tier: 3, department: 'SCIENCE', stationCount: 3,
    acceptedSpecialties: ['Biologist', 'Physicist', 'Astronomer', 'Chemist', 'Archaeologist'],
    powerGridCost: 22, cpuCost: 38, basePrice: 2100, baseRarity: 'RARE',
    baseStats: { bayDepartment: 'SCIENCE', stationCount: 3, researchYieldBonus: 0.24, subtype: 'Research Bay Mk.III' },
    description: 'Pressurized spectral telemetry deck housing 3 full Science Officer Stations.',
  },
  {
    blueprintId: 'MOD_BAY_RESEARCH_T4', name: 'Research Bay Mk.IV', tier: 4, department: 'SCIENCE', stationCount: 4,
    acceptedSpecialties: ['Biologist', 'Physicist', 'Astronomer', 'Chemist', 'Archaeologist'],
    powerGridCost: 30, cpuCost: 52, basePrice: 3900, baseRarity: 'EPIC',
    baseStats: { bayDepartment: 'SCIENCE', stationCount: 4, researchYieldBonus: 0.35, subtype: 'Research Bay Mk.IV' },
    description: 'Flagship Precursor-grade science institute supporting 4 active Science Officers in orbit.',
  },

  // Mining Operations Bays Mk.I-III
  {
    blueprintId: 'MOD_BAY_MINING_T1', name: 'Mining Operations Bay Mk.I', tier: 1, department: 'ENGINEERING', stationCount: 1,
    acceptedSpecialties: ['Miner', 'Geologist', 'Chemist', 'Engineer'],
    powerGridCost: 8, cpuCost: 14, basePrice: 440, baseRarity: 'COMMON',
    baseStats: { bayDepartment: 'ENGINEERING', stationCount: 1, miningRateBonus: 0.1, subtype: 'Mining Operations Bay Mk.I' },
    description: 'Ore assay bench & beam telemetry link opening 1 Extraction Officer Station.',
  },
  {
    blueprintId: 'MOD_BAY_MINING_T2', name: 'Mining Operations Bay Mk.II', tier: 2, department: 'ENGINEERING', stationCount: 2,
    acceptedSpecialties: ['Miner', 'Geologist', 'Chemist', 'Engineer'],
    powerGridCost: 14, cpuCost: 22, basePrice: 980, baseRarity: 'UNCOMMON',
    baseStats: { bayDepartment: 'ENGINEERING', stationCount: 2, miningRateBonus: 0.2, subtype: 'Mining Operations Bay Mk.II' },
    description: 'Twin deep-core laser telemetry array supporting 2 Extraction Officers.',
  },
  {
    blueprintId: 'MOD_BAY_MINING_T3', name: 'Mining Operations Bay Mk.III', tier: 3, department: 'ENGINEERING', stationCount: 3,
    acceptedSpecialties: ['Miner', 'Geologist', 'Chemist', 'Engineer'],
    powerGridCost: 20, cpuCost: 32, basePrice: 1950, baseRarity: 'RARE',
    baseStats: { bayDepartment: 'ENGINEERING', stationCount: 3, miningRateBonus: 0.32, subtype: 'Mining Operations Bay Mk.III' },
    description: 'Heavy smelting & spectral fracturing command deck seating 3 Extraction Specialists.',
  },

  // Gunnery & Tactical Decks Mk.I-III
  {
    blueprintId: 'MOD_BAY_GUNNERY_T1', name: 'Gunnery & Tactical Deck Mk.I', tier: 1, department: 'OPERATIONS', stationCount: 1,
    acceptedSpecialties: ['Gunner', 'Soldier', 'Pilot'],
    powerGridCost: 10, cpuCost: 16, basePrice: 520, baseRarity: 'COMMON',
    baseStats: { bayDepartment: 'OPERATIONS', stationCount: 1, combatDamageBonus: 0.07, subtype: 'Gunnery & Tactical Deck Mk.I' },
    description: 'Fire-control targeting console opening 1 Combat Operations Station.',
  },
  {
    blueprintId: 'MOD_BAY_GUNNERY_T2', name: 'Gunnery & Tactical Deck Mk.II', tier: 2, department: 'OPERATIONS', stationCount: 2,
    acceptedSpecialties: ['Gunner', 'Soldier', 'Pilot'],
    powerGridCost: 16, cpuCost: 26, basePrice: 1180, baseRarity: 'UNCOMMON',
    baseStats: { bayDepartment: 'OPERATIONS', stationCount: 2, combatDamageBonus: 0.14, subtype: 'Gunnery & Tactical Deck Mk.II' },
    description: 'Linked broadside fire-control pit hosting 2 Combat Officers simultaneously.',
  },
  {
    blueprintId: 'MOD_BAY_GUNNERY_T3', name: 'Gunnery & Tactical Deck Mk.III', tier: 3, department: 'OPERATIONS', stationCount: 3,
    acceptedSpecialties: ['Gunner', 'Soldier', 'Pilot'],
    powerGridCost: 24, cpuCost: 38, basePrice: 2350, baseRarity: 'RARE',
    baseStats: { bayDepartment: 'OPERATIONS', stationCount: 3, combatDamageBonus: 0.22, subtype: 'Gunnery & Tactical Deck Mk.III' },
    description: 'Capital FleetCIC & marine ready-room accommodating 3 Combat Specialists.',
  },

  // Engineering & Damage Control Bays Mk.I-III
  {
    blueprintId: 'MOD_BAY_ENGINEERING_T1', name: 'Engineering Deck Mk.I', tier: 1, department: 'ENGINEERING', stationCount: 1,
    acceptedSpecialties: ['Engineer', 'Mechanic', 'Physicist'],
    powerGridCost: 0, cpuCost: 12, basePrice: 500, baseRarity: 'COMMON',
    baseStats: { bayDepartment: 'ENGINEERING', stationCount: 1, powerGridBonus: 12, subtype: 'Engineering Deck Mk.I' },
    description: 'Auxiliary diagnostic shop seating 1 Engineering Officer (+12 MW grid headroom).',
  },
  {
    blueprintId: 'MOD_BAY_ENGINEERING_T2', name: 'Engineering Deck Mk.II', tier: 2, department: 'ENGINEERING', stationCount: 2,
    acceptedSpecialties: ['Engineer', 'Mechanic', 'Physicist'],
    powerGridCost: 0, cpuCost: 18, basePrice: 1120, baseRarity: 'UNCOMMON',
    baseStats: { bayDepartment: 'ENGINEERING', stationCount: 2, powerGridBonus: 24, subtype: 'Engineering Deck Mk.II' },
    description: 'Dual damage-control & plasma conduit workshop for 2 Engineering Officers.',
  },
  {
    blueprintId: 'MOD_BAY_ENGINEERING_T3', name: 'Engineering Deck Mk.III', tier: 3, department: 'ENGINEERING', stationCount: 3,
    acceptedSpecialties: ['Engineer', 'Mechanic', 'Physicist'],
    powerGridCost: 0, cpuCost: 24, basePrice: 2250, baseRarity: 'RARE',
    baseStats: { bayDepartment: 'ENGINEERING', stationCount: 3, powerGridBonus: 40, subtype: 'Engineering Deck Mk.III' },
    description: 'Full reactor calibration foundry supporting 3 Engineering Officers (+40 MW grid).',
  },

  // Medbay & Cryo Wards Mk.I-II
  {
    blueprintId: 'MOD_BAY_MEDBAY_T1', name: 'Medbay & Cryo Ward Mk.I', tier: 1, department: 'OPERATIONS', stationCount: 1,
    acceptedSpecialties: ['Medic', 'Biologist', 'Settler'],
    powerGridCost: 6, cpuCost: 12, basePrice: 460, baseRarity: 'COMMON',
    baseStats: { bayDepartment: 'OPERATIONS', stationCount: 1, moraleBonus: 0.1, subtype: 'Medbay & Cryo Ward Mk.I' },
    description: 'Automated surgical triage & cryo berth seating 1 Medical/Support Officer.',
  },
  {
    blueprintId: 'MOD_BAY_MEDBAY_T2', name: 'Medbay & Cryo Ward Mk.II', tier: 2, department: 'OPERATIONS', stationCount: 2,
    acceptedSpecialties: ['Medic', 'Biologist', 'Settler'],
    powerGridCost: 10, cpuCost: 18, basePrice: 1020, baseRarity: 'UNCOMMON',
    baseStats: { bayDepartment: 'OPERATIONS', stationCount: 2, moraleBonus: 0.2, subtype: 'Medbay & Cryo Ward Mk.II' },
    description: 'Multi-ward regeneration & lander decontamination bay seating 2 Medical Officers.',
  },

  // Astrogation & Commerce Suites Mk.I-II
  {
    blueprintId: 'MOD_BAY_ASTROGATION_T1', name: 'Astrogation & Trade Suite Mk.I', tier: 1, department: 'COMMERCE', stationCount: 1,
    acceptedSpecialties: ['Navigator', 'Astronomer', 'Merchant', 'Diplomat'],
    powerGridCost: 6, cpuCost: 16, basePrice: 490, baseRarity: 'COMMON',
    baseStats: { bayDepartment: 'COMMERCE', stationCount: 1, navTradeBonus: 0.08, subtype: 'Astrogation & Trade Suite Mk.I' },
    description: 'Star-chart holotable & market ticker console seating 1 Nav/Trade Officer.',
  },
  {
    blueprintId: 'MOD_BAY_ASTROGATION_T2', name: 'Astrogation & Trade Suite Mk.II', tier: 2, department: 'COMMERCE', stationCount: 2,
    acceptedSpecialties: ['Navigator', 'Astronomer', 'Merchant', 'Diplomat'],
    powerGridCost: 10, cpuCost: 26, basePrice: 1150, baseRarity: 'UNCOMMON',
    baseStats: { bayDepartment: 'COMMERCE', stationCount: 2, navTradeBonus: 0.16, subtype: 'Astrogation & Trade Suite Mk.II' },
    description: 'Diplomatic envoy lounge & warp telemetry bridge seating 2 Nav/Commerce Officers.',
  },
];

export const SHIP_BAY_BLUEPRINT_MAP = new Map<string, ShipBayBlueprintDef>(
  SHIP_BAY_BLUEPRINTS.map((b) => [b.blueprintId, b])
);

export type ColonyModuleKey =
  | 'RESEARCH_INSTITUTE'
  | 'ORE_REFINERY'
  | 'COLONIAL_MEDBAY'
  | 'TRADE_EXCHANGE'
  | 'FRONTIER_GARRISON'
  | 'DIPLOMATIC_CONSULATE'
  | 'ASTRO_OBSERVATORY'
  | 'ARCH_EXCAVATION';

export interface ColonyModuleDef {
  key: ColonyModuleKey;
  name: string;
  icon: string;
  maxTier: 3;
  acceptedSpecialties: readonly CrewSpecialtyId[];
  baseCreditCost: number;
  baseApCost: number;
  baseAlloyCost: number;
  benefitSummary: string;
}

export const COLONY_MODULES: readonly ColonyModuleDef[] = [
  {
    key: 'RESEARCH_INSTITUTE', name: 'Xeno-Research Institute', icon: '🔬', maxTier: 3,
    acceptedSpecialties: ['Biologist', 'Physicist', 'Chemist'],
    baseCreditCost: 450, baseApCost: 4, baseAlloyCost: 10,
    benefitSummary: '+15% / +30% / +50% global Research yield + passive Bio-Data synthesis.',
  },
  {
    key: 'ORE_REFINERY', name: 'Orbital Ore Refinery', icon: '🏭', maxTier: 3,
    acceptedSpecialties: ['Miner', 'Geologist', 'Chemist'],
    baseCreditCost: 420, baseApCost: 4, baseAlloyCost: 12,
    benefitSummary: '+20% / +40% / +65% Colony extraction rate & rare mineral assay value.',
  },
  {
    key: 'COLONIAL_MEDBAY', name: 'Colonial Medbay Complex', icon: '🏥', maxTier: 3,
    acceptedSpecialties: ['Medic', 'Biologist', 'Settler'],
    baseCreditCost: 380, baseApCost: 3, baseAlloyCost: 8,
    benefitSummary: '+15% / +30% / +50% population cap growth & crew morale regeneration.',
  },
  {
    key: 'TRADE_EXCHANGE', name: 'Merchant Trade Exchange', icon: '🏦', maxTier: 3,
    acceptedSpecialties: ['Merchant', 'Diplomat'],
    baseCreditCost: 460, baseApCost: 4, baseAlloyCost: 8,
    benefitSummary: '+45 / +100 / +180 Cr/cycle local wage subsidy offsetting crew upkeep.',
  },
  {
    key: 'FRONTIER_GARRISON', name: 'Frontier Defense Garrison', icon: '🏰', maxTier: 3,
    acceptedSpecialties: ['Soldier', 'Gunner', 'Pilot'],
    baseCreditCost: 440, baseApCost: 4, baseAlloyCost: 14,
    benefitSummary: 'Boosts local security, raider deterrence & fleet combat readiness.',
  },
  {
    key: 'DIPLOMATIC_CONSULATE', name: 'Diplomatic Consulate', icon: '🏛️', maxTier: 3,
    acceptedSpecialties: ['Diplomat', 'Merchant'],
    baseCreditCost: 480, baseApCost: 4, baseAlloyCost: 10,
    benefitSummary: '+10% / +20% / +35% faction standing gains & starport applicant quality.',
  },
  {
    key: 'ASTRO_OBSERVATORY', name: 'Deep-Space Observatory', icon: '📡', maxTier: 3,
    acceptedSpecialties: ['Astronomer', 'Navigator', 'Physicist'],
    baseCreditCost: 430, baseApCost: 4, baseAlloyCost: 10,
    benefitSummary: 'Extends regional starmap scan telemetry & warp efficiency.',
  },
  {
    key: 'ARCH_EXCAVATION', name: 'Precursor Dig Site', icon: '🪨', maxTier: 3,
    acceptedSpecialties: ['Archaeologist', 'Geologist'],
    baseCreditCost: 520, baseApCost: 5, baseAlloyCost: 12,
    benefitSummary: 'Passively unearths Precursor artifacts & boosts relic research yields.',
  },
];

export const COLONY_MODULE_MAP = new Map<ColonyModuleKey, ColonyModuleDef>(
  COLONY_MODULES.map((m) => [m.key, m])
);

export interface CrewRequirementSpec {
  requiredCount: number;
  acceptedSpecialties: readonly CrewSpecialtyId[];
  label: string;
}

/**
 * Hard N-Specialist gating rules for Colony core facilities & Specialty Colony Modules.
 */
export const COLONY_FACILITY_CREW_REQUIREMENTS: Record<string, Record<number, CrewRequirementSpec>> = {
  DERRICK: {
    2: { requiredCount: 1, acceptedSpecialties: ['Miner', 'Geologist'], label: '1x Miner or Geologist' },
    3: { requiredCount: 2, acceptedSpecialties: ['Miner', 'Geologist', 'Engineer'], label: '2x Miner / Geologist / Engineer' },
  },
  HABITATION: {
    2: { requiredCount: 1, acceptedSpecialties: ['Settler'], label: '1x Settler' },
    3: { requiredCount: 2, acceptedSpecialties: ['Settler', 'Medic', 'Biologist'], label: '2x Settler / Medic / Biologist' },
  },
  TERRAFORMER: {
    2: { requiredCount: 1, acceptedSpecialties: ['Biologist', 'Chemist'], label: '1x Biologist or Chemist' },
    3: { requiredCount: 2, acceptedSpecialties: ['Biologist', 'Chemist', 'Physicist'], label: '2x Biologist / Chemist / Physicist' },
  },
  SILO: {
    2: { requiredCount: 1, acceptedSpecialties: ['Merchant', 'Engineer', 'Settler'], label: '1x Merchant / Engineer / Settler' },
    3: { requiredCount: 2, acceptedSpecialties: ['Merchant', 'Engineer', 'Settler'], label: '2x Merchant / Engineer / Settler' },
  },
  SHIPYARD: {
    1: { requiredCount: 1, acceptedSpecialties: ['Mechanic', 'Engineer'], label: '1x Mechanic or Engineer' },
    2: { requiredCount: 2, acceptedSpecialties: ['Mechanic', 'Engineer'], label: '2x Mechanic / Engineer' },
  },
};

export function getColonyModuleUpgradeRequirement(moduleKey: ColonyModuleKey, targetTier: number): CrewRequirementSpec | null {
  const def = COLONY_MODULE_MAP.get(moduleKey);
  if (!def || targetTier < 1 || targetTier > def.maxTier) return null;
  return {
    requiredCount: targetTier, // Tier 1 -> 1 specialist, Tier 2 -> 2, Tier 3 -> 3!
    acceptedSpecialties: def.acceptedSpecialties,
    label: `${targetTier}x (${def.acceptedSpecialties.join(' / ')})`,
  };
}

const FACTION_FIRST_NAMES: Record<FactionId, readonly string[]> = {
  FACTION_SOL: ['Elena', 'Marcus', 'Tessa', 'Kieran', 'Nadia', 'Julian', 'Soren', 'Aria'],
  FACTION_HEGEMONY: ['Cassius', 'Valeria', 'Tiberon', 'Livia', 'Drusus', 'Octavia', 'Severus', 'Nero'],
  FACTION_PHORID: ['Mycel', 'Virex', 'Sporeth', 'Chitinis', 'Lichen', 'Sylva', 'Hypha', 'Ophrys'],
  FACTION_KRYLL: ['Rusk', 'Vexis', 'Krag', 'Skrit', 'Zedrik', 'Nyxx', 'Brax', 'Tarn'],
  FACTION_LITHOS: ['Quartz', 'Beryl', 'Silex', 'Feldspar', 'Pyrox', 'Obsid', 'Corun', 'Mica'],
  FACTION_WARDENS: ['Chronis', 'Aevum', 'Vesper', 'Solstice', 'Eon', 'Kairo', 'Axiom', 'Zenith'],
  FACTION_MINERS_GUILD: ['Boreas', 'Torin', 'Magna', 'Orin', 'Petra', 'Ferris', 'Cairn', 'Gideon'],
  FACTION_FREEBOOTERS: ['Dax', 'Riven', 'Kestrel', 'Sable', 'Cutter', 'Vane', 'Rook', 'Marlowe'],
};

const FACTION_SURNAMES: Record<FactionId, readonly string[]> = {
  FACTION_SOL: ['Vance', 'Kovacs', 'Chen', 'Mercer', 'Reyes', 'Lindqvist', 'Sato', 'Keller'],
  FACTION_HEGEMONY: ['Aurelius', 'Corvus', 'Vael', 'Decimus', 'Tarkin', 'Cassian', 'Octavian', 'Sulla'],
  FACTION_PHORID: ['Rhizoma', 'Thallus', 'Canopy', 'Mycorrh', 'Sporos', 'Veld', 'Xylem', 'Bryo'],
  FACTION_KRYLL: ['Vorr', 'Scrapjaw', 'Krell', 'Rift', 'Grimalk', 'Spire', 'Cinder', 'Shank'],
  FACTION_LITHOS: ['Facet', 'Stratum', 'Lattice', 'Prism', 'Geode', 'Basalt', 'Crystalline', 'Monolith'],
  FACTION_WARDENS: ['Orrery', 'Temporal', 'Epoch', 'Vigil', 'Meridian', 'Aegis', 'Continuum', 'Relic'],
  FACTION_MINERS_GUILD: ['Deepvein', 'Slagborn', 'Anvil', 'Corell', 'Pyrite', 'Smelter', 'Drillhead', 'Rockwell'],
  FACTION_FREEBOOTERS: ['Cross', 'Blackstar', 'Hawke', 'Drift', 'Corsair', 'Flint', 'Gale', 'Redwake'],
};

export interface ProceduralCrewCandidate {
  listingId: string;
  seed: number;
  name: string;
  callsign: string;
  factionId: FactionId;
  factionName: string;
  species: string;
  age: number;
  rarity: CrewRarity;
  primarySpecialty: CrewSpecialtyId;
  specialties: CrewSpecialtyId[];
  aptitude: number;
  grit: number;
  efficiency: number;
  traitId: string;
  traitLabel: string;
  traitDesc: string;
  baseSalary: number;
  hiringFee: number;
  marketValue: number;
  originSource: 'STARPORT' | 'COLONY' | 'RESCUE_POD' | 'CAPTAIN_HAIL';
  originLabel: string;
  bio: string;
}

export function pickCrewRarity(rng: () => number, minRarity?: CrewRarity): CrewRarity {
  const order: CrewRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  const minIdx = minRarity ? order.indexOf(minRarity) : 0;
  const eligible = order.slice(minIdx);
  const totalWeight = eligible.reduce((s, r) => s + CREW_RARITY_SPECS[r].weight, 0);
  let roll = rng() * totalWeight;
  for (const r of eligible) {
    roll -= CREW_RARITY_SPECS[r].weight;
    if (roll <= 0) return r;
  }
  return eligible[eligible.length - 1];
}

/**
 * Generates a deterministic procedural crew candidate with Rarity-scaled Specialties (1->5),
 * rolled Core Stats, Procedural Trait, Faction identity, and balanced salary/brokerage pricing.
 */
export function generateProceduralCrewCandidate(params: {
  listingId: string;
  seed: number;
  factionId?: string;
  preferredSpecialties?: readonly CrewSpecialtyId[];
  forcedRarity?: CrewRarity;
  minRarity?: CrewRarity;
  originSource: 'STARPORT' | 'COLONY' | 'RESCUE_POD' | 'CAPTAIN_HAIL';
  originLabel: string;
  discountMultiplier?: number;
}): ProceduralCrewCandidate {
  const rng = createMulberry32(params.seed >>> 0);
  const factionId = params.factionId ? normalizeFactionId(params.factionId) : rngPick(rng, ALL_FACTION_IDS);
  const faction = FACTION_REGISTRY[factionId];
  const species = faction.captain.species;

  const rarity = params.forcedRarity || pickCrewRarity(rng, params.minRarity);
  const rSpec = CREW_RARITY_SPECS[rarity];

  const first = rngPick(rng, FACTION_FIRST_NAMES[factionId]);
  const last = rngPick(rng, FACTION_SURNAMES[factionId]);
  const name = `${first} ${last}`;

  // Pick N unique specialties (1=Common ... 5=Legendary)
  const chosen: CrewSpecialtyId[] = [];
  const preferredPool = (params.preferredSpecialties || []).filter((s) => SPECIALTY_MAP.has(s));
  if (preferredPool.length > 0 && rng() < 0.78) {
    chosen.push(rngPick(rng, preferredPool));
  } else {
    chosen.push(rngPick(rng, ALL_SPECIALTY_IDS));
  }

  let guard = 0;
  while (chosen.length < rSpec.specialtyCount && guard < 100) {
    guard++;
    const candidatePool = preferredPool.length > 0 && rng() < 0.45 ? preferredPool : ALL_SPECIALTY_IDS;
    const pick = rngPick(rng, candidatePool);
    if (!chosen.includes(pick)) chosen.push(pick);
  }

  const aptitude = rngInt(rng, rSpec.statMin, rSpec.statMax);
  const grit = rngInt(rng, Math.max(20, rSpec.statMin - 5), rSpec.statMax);
  const efficiency = rngInt(rng, Math.max(20, rSpec.statMin - 5), rSpec.statMax);
  const age = rngInt(rng, 23, 56);

  const trait = rngPick(rng, CREW_TRAITS);
  const primarySpec = SPECIALTY_MAP.get(chosen[0])!;

  const statAvg = (aptitude + grit + efficiency) / 3;
  const rawSalary =
    (10 + (statAvg - 20) * 0.25) *
    primarySpec.baseSalaryWeight *
    rSpec.salaryMult *
    (trait.id === 'FRUGAL_QUARTERMASTER' ? 0.8 : 1.0);
  const baseSalary = Math.max(8, Math.round(rawSalary));

  const discount = params.discountMultiplier ?? 1.0;
  const rawHire = (110 + statAvg * 2.2) * rSpec.hireFeeMult * discount;
  const hiringFee = params.originSource === 'RESCUE_POD' ? 0 : Math.max(80, Math.round(rawHire / 5) * 5);
  const marketValue = Math.max(90, Math.round(((110 + statAvg * 2.2) * rSpec.hireFeeMult) / 5) * 5);

  const callsignTag = `${primarySpec.id.slice(0, 3).toUpperCase()}-${String((params.seed >>> 0) % 900 + 100)}`;
  const bio = `${faction.shortName} ${primarySpec.title.toLowerCase()} recruited via ${params.originLabel}. ${chosen.length > 1 ? `Cross-certified in ${chosen.slice(1).join(', ')}. ` : ''}${trait.description}`;

  return {
    listingId: params.listingId,
    seed: params.seed >>> 0,
    name,
    callsign: callsignTag,
    factionId,
    factionName: faction.name,
    species,
    age,
    rarity,
    primarySpecialty: chosen[0],
    specialties: chosen,
    aptitude,
    grit,
    efficiency,
    traitId: trait.id,
    traitLabel: trait.label,
    traitDesc: trait.description,
    baseSalary,
    hiringFee,
    marketValue,
    originSource: params.originSource,
    originLabel: params.originLabel,
    bio,
  };
}

/**
 * Smooth diminishing stacking helper: sum_i (value_i * 0.78^i) sorted highest first.
 */
export function diminishingStackSum(values: number[]): number {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => b - a);
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i] * Math.pow(0.78, i);
  }
  return Math.round(total * 1000) / 1000;
}

export interface CrewComputedBonuses {
  stationedShipCount: number;
  stationedColonyCount: number;
  reserveCount: number;
  totalShipStationsUnlocked: number;
  bayYieldBonuses: {
    researchBayBonus: number;
    miningBayBonus: number;
    combatBayBonus: number;
    powerGridBayBonus: number;
    moraleBayBonus: number;
    navTradeBayBonus: number;
  };
  /** Aggregate multipliers (e.g. 0.18 = +18% return) across gameplay loops */
  miningYieldBonus: number;
  miningSpeedBonus: number;
  rareOreLuckBonus: number;
  researchBioDataBonus: number;
  researchPrecursorBonus: number;
  weaponDamageBonus: number;
  fireCadenceBonus: number;
  flightSpeedBonus: number;
  shieldRegenBonus: number;
  powerGridBonusMW: number;
  cpuBonusTF: number;
  salvageYieldBonus: number;
  tradeMarginBonus: number;
  warpFuelDiscount: number;
  reputationGainBonus: number;
  colonyOutputBonus: number;
  colonyPopGrowthBonus: number;
  hazardResistBonus: number;
  grossCycleSalary: number;
  colonyWageSubsidy: number;
  netCycleUpkeep: number;
}

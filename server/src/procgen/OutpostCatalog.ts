/**
 * Milestone 1.7: Outpost Multi-Layer Colony Structure & Terrain Catalog
 * 4 Layers (0 Surface, -1 Shallow Crust, -2 Mid Mantle, -3 Deep Core) x 12x12 Grid
 */

import type { ColonyModuleKey } from './CrewCatalog';

export type OutpostLayer = 0 | -1 | -2 | -3;

export type TerrainType =
  | 'FLAT'
  | 'CRATER'
  | 'BEDROCK'
  | 'GEO_VENT'
  | 'DEEP_GEO_VENT'
  | 'ORE_SEAM_L1'
  | 'RARE_SEAM_L2'
  | 'DEEP_SEAM_L3'
  | 'WATER_POCKET';

export type BuildingCategory =
  | 'INFRASTRUCTURE'
  | 'CORE'
  | 'POWER'
  | 'LIFE_SUPPORT'
  | 'HABITAT'
  | 'STORAGE'
  | 'EXTRACTION'
  | 'INDUSTRY'
  | 'SCIENCE'
  | 'TERRAFORM'
  | 'ORBITAL';

export type BuildingTypeId =
  | 'TRANSIT_TUBE'
  | 'ACCESS_SHAFT'
  | 'COMMAND_HUB'
  | 'SOLAR_ARRAY'
  | 'GEOTHERMAL_PLANT'
  | 'TOKAMAK_FUSION'
  | 'AGRIDOME'
  | 'COLONIAL_MEDBAY'
  | 'UNDERGROUND_RESIDENCE'
  | 'STORAGE_WAREHOUSE'
  | 'ORE_MINE_L1'
  | 'DEEP_CORE_EXTRACTOR'
  | 'ORE_REFINERY'
  | 'RESEARCH_INSTITUTE'
  | 'BIOSPHERE_DOME'
  | 'ATMOS_PROCESSOR'
  | 'SPACEPORT_GANTRY'
  | 'TRADE_EXCHANGE'
  | 'FRONTIER_GARRISON'
  | 'DIPLOMATIC_CONSULATE'
  | 'ASTRO_OBSERVATORY'
  | 'ARCH_EXCAVATION'
  | 'PRECURSOR_SINGULARITY_CORE'
  | 'QUANTUM_ASSEMBLY_NEXUS'
  | 'SUBSPACE_AEGIS_CITADEL';

export interface OutpostBuildingDef {
  id: BuildingTypeId;
  requiresRelicBlueprint?: boolean;
  name: string;
  icon: string;
  category: BuildingCategory;
  allowedLayers: readonly OutpostLayer[];
  buildTimeSec: number;
  creditCost: number;
  alloyCost: number;
  powerDeltaMW: number;
  o2Delta: number;
  workersRequired: number;
  popCapacityBonus: number;
  siloCapacityBonus: number;
  extractionRateBase: number;
  extractionMultBonus: number;
  terraformRateBonus: number;
  moraleBonus: number;
  maxPerColony?: number;
  mappedModuleKey?: ColonyModuleKey;
  colorHex: string;
  description: string;
}

export const OUTPOST_BUILDINGS: readonly OutpostBuildingDef[] = [
  {
    id: 'TRANSIT_TUBE',
    name: 'Transit Tube',
    icon: '🔗',
    category: 'INFRASTRUCTURE',
    allowedLayers: [0, -1, -2, -3],
    buildTimeSec: 2,
    creditCost: 40,
    alloyCost: 0,
    powerDeltaMW: 0,
    o2Delta: 0,
    workersRequired: 0,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#38bdf8',
    description: 'Pressurized corridor linking adjacent buildings to the Power & O2 Grid.',
  },
  {
    id: 'ACCESS_SHAFT',
    name: 'Access Shaft',
    icon: '⬇️',
    category: 'INFRASTRUCTURE',
    allowedLayers: [0, -1, -2, -3],
    buildTimeSec: 5,
    creditCost: 180,
    alloyCost: 2,
    powerDeltaMW: -2,
    o2Delta: 0,
    workersRequired: 0,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#fbbf24',
    description: 'Vertical elevator & conduit shaft connecting matching (x,y) coordinates across depths.',
  },
  {
    id: 'COMMAND_HUB',
    name: 'Command Hub (Seed Lander)',
    icon: '🛸',
    category: 'CORE',
    allowedLayers: [0],
    buildTimeSec: 0,
    creditCost: 0,
    alloyCost: 0,
    powerDeltaMW: 25,
    o2Delta: 22,
    workersRequired: 10,
    popCapacityBonus: 500,
    siloCapacityBonus: 50,
    extractionRateBase: 1.5,
    extractionMultBonus: 0,
    terraformRateBonus: 0.25,
    moraleBonus: 10,
    maxPerColony: 1,
    colorHex: '#00f0ff',
    description: 'Central colony command root at (5,5). Provides starter power, O2 & network root.',
  },
  {
    id: 'SOLAR_ARRAY',
    name: 'Photovoltaic Solar Array',
    icon: '☀️',
    category: 'POWER',
    allowedLayers: [0],
    buildTimeSec: 6,
    creditCost: 220,
    alloyCost: 2,
    powerDeltaMW: 25,
    o2Delta: 0,
    workersRequired: 4,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#fde047',
    description: 'Surface photovoltaic wings generating +25 MW clean grid power.',
  },
  {
    id: 'GEOTHERMAL_PLANT',
    name: 'Geothermal Tap',
    icon: '🌋',
    category: 'POWER',
    allowedLayers: [0, -1, -2, -3],
    buildTimeSec: 12,
    creditCost: 480,
    alloyCost: 5,
    powerDeltaMW: 55,
    o2Delta: 0,
    workersRequired: 10,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#f97316',
    description: 'Subterranean heat exchanger (+55 MW base; 2.0x MW over Geothermal Vents!).',
  },
  {
    id: 'TOKAMAK_FUSION',
    name: 'Tokamak Fusion Core',
    icon: '⚛️',
    category: 'POWER',
    allowedLayers: [-2, -3],
    buildTimeSec: 22,
    creditCost: 1100,
    alloyCost: 10,
    powerDeltaMW: 140,
    o2Delta: 0,
    workersRequired: 18,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#818cf8',
    description: 'Deep-mantle magnetic confinement reactor generating +140 MW.',
  },
  {
    id: 'AGRIDOME',
    name: 'Hydroponic Agridome',
    icon: '🌿',
    category: 'LIFE_SUPPORT',
    allowedLayers: [0],
    buildTimeSec: 8,
    creditCost: 260,
    alloyCost: 2,
    powerDeltaMW: -6,
    o2Delta: 24,
    workersRequired: 8,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 5,
    colorHex: '#4ade80',
    description: 'Pressurized crop & O2 greenhouse (+24 O2, +35% over Water Pockets).',
  },
  {
    id: 'COLONIAL_MEDBAY',
    name: 'Colonial Med-Clinic',
    icon: '🏥',
    category: 'LIFE_SUPPORT',
    allowedLayers: [0, -1],
    buildTimeSec: 14,
    creditCost: 420,
    alloyCost: 4,
    powerDeltaMW: -8,
    o2Delta: 18,
    workersRequired: 10,
    popCapacityBonus: 150,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 14,
    mappedModuleKey: 'COLONIAL_MEDBAY',
    colorHex: '#34d399',
    description: 'Medical & life-support ward boosting Morale (+14), O2 & population growth.',
  },
  {
    id: 'UNDERGROUND_RESIDENCE',
    name: 'Underground Residence',
    icon: '🏘️',
    category: 'HABITAT',
    allowedLayers: [-1, -2],
    buildTimeSec: 10,
    creditCost: 380,
    alloyCost: 3,
    powerDeltaMW: -8,
    o2Delta: -10,
    workersRequired: 5,
    popCapacityBonus: 1000,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 4,
    colorHex: '#60a5fa',
    description: 'Radiation-shielded subterranean arcology (+1000 Pop Cap; advances Habitation Tier).',
  },
  {
    id: 'STORAGE_WAREHOUSE',
    name: 'Logistics Warehouse',
    icon: '📦',
    category: 'STORAGE',
    allowedLayers: [0, -1],
    buildTimeSec: 7,
    creditCost: 300,
    alloyCost: 3,
    powerDeltaMW: -3,
    o2Delta: 0,
    workersRequired: 4,
    popCapacityBonus: 0,
    siloCapacityBonus: 200,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#94a3b8',
    description: 'Bulk cargo storage vault (+200 Silo Capacity per unit; advances Silo Tier).',
  },
  {
    id: 'ORE_MINE_L1',
    name: 'Subsurface Ore Mine',
    icon: '⛏️',
    category: 'EXTRACTION',
    allowedLayers: [-1],
    buildTimeSec: 9,
    creditCost: 340,
    alloyCost: 3,
    powerDeltaMW: -10,
    o2Delta: 0,
    workersRequired: 14,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 4.5,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#f59e0b',
    description: 'Shallow crust excavator (+4.5 u/min; +75% yield on L1 Ore Seams).',
  },
  {
    id: 'DEEP_CORE_EXTRACTOR',
    name: 'Deep Core Extractor',
    icon: '🔩',
    category: 'EXTRACTION',
    allowedLayers: [-2, -3],
    buildTimeSec: 18,
    creditCost: 780,
    alloyCost: 7,
    powerDeltaMW: -20,
    o2Delta: 0,
    workersRequired: 20,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 9.0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 0,
    colorHex: '#ec4899',
    description: 'Heavy mantle/core drill (+9.0 u/min; +85% yield on Rare L2 & Deep L3 Seams).',
  },
  {
    id: 'ORE_REFINERY',
    name: 'Ore Smelter & Refinery',
    icon: '🔥',
    category: 'INDUSTRY',
    allowedLayers: [-1, -2],
    buildTimeSec: 14,
    creditCost: 500,
    alloyCost: 5,
    powerDeltaMW: -14,
    o2Delta: 0,
    workersRequired: 14,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 1.5,
    extractionMultBonus: 0.22,
    terraformRateBonus: 0,
    moraleBonus: 0,
    mappedModuleKey: 'ORE_REFINERY',
    colorHex: '#fb7185',
    description: 'Refines raw ore & slag (+22% global Colony extraction efficiency).',
  },
  {
    id: 'RESEARCH_INSTITUTE',
    name: 'Subsurface Science Lab',
    icon: '🔬',
    category: 'SCIENCE',
    allowedLayers: [0, -1, -2],
    buildTimeSec: 16,
    creditCost: 550,
    alloyCost: 5,
    powerDeltaMW: -14,
    o2Delta: 0,
    workersRequired: 12,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0.1,
    moraleBonus: 4,
    mappedModuleKey: 'RESEARCH_INSTITUTE',
    colorHex: '#22d3ee',
    description: 'Xeno-Research lab (+15% global Science yield + Research Bio-Data generation).',
  },
  {
    id: 'BIOSPHERE_DOME',
    name: 'Chaparral Biosphere Dome',
    icon: '🧬',
    category: 'SCIENCE',
    allowedLayers: [0],
    buildTimeSec: 15,
    creditCost: 540,
    alloyCost: 5,
    powerDeltaMW: -10,
    o2Delta: 22,
    workersRequired: 8,
    popCapacityBonus: 200,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0.2,
    moraleBonus: 12,
    colorHex: '#a3e635',
    description: 'Ecological bio-dome boosting Morale (+12), O2 (+22), and Biosphere rating.',
  },
  {
    id: 'ATMOS_PROCESSOR',
    name: 'Atmosphere Processor',
    icon: '🌀',
    category: 'TERRAFORM',
    allowedLayers: [0],
    buildTimeSec: 16,
    creditCost: 520,
    alloyCost: 5,
    powerDeltaMW: -16,
    o2Delta: 16,
    workersRequired: 10,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0.65,
    moraleBonus: 4,
    colorHex: '#38bdf8',
    description: 'Planetary atmospheric scrubber accelerating Terraforming & Habitability.',
  },
  {
    id: 'SPACEPORT_GANTRY',
    name: 'Orbital Shipyard Gantry',
    icon: '🚀',
    category: 'ORBITAL',
    allowedLayers: [0],
    buildTimeSec: 20,
    creditCost: 650,
    alloyCost: 8,
    powerDeltaMW: -18,
    o2Delta: 0,
    workersRequired: 16,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 3,
    colorHex: '#e879f9',
    description: 'Heavy launch & hull fabrication gantry (each active unit raises Colony Shipyard Tier).',
  },
  {
    id: 'TRADE_EXCHANGE',
    name: 'Colonial Trade Exchange',
    icon: '💹',
    category: 'INDUSTRY',
    allowedLayers: [0, -1],
    buildTimeSec: 14,
    creditCost: 500,
    alloyCost: 4,
    powerDeltaMW: -10,
    o2Delta: 6,
    workersRequired: 10,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 6,
    mappedModuleKey: 'TRADE_EXCHANGE',
    colorHex: '#10b981',
    description: 'Commerce clearinghouse (+45/+100/+180 Cr/cycle local Crew Wage Subsidy).',
  },
  {
    id: 'FRONTIER_GARRISON',
    name: 'Bastion Defense Garrison',
    icon: '🛡️',
    category: 'ORBITAL',
    allowedLayers: [0],
    buildTimeSec: 18,
    creditCost: 620,
    alloyCost: 7,
    powerDeltaMW: -14,
    o2Delta: 0,
    workersRequired: 14,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 10,
    mappedModuleKey: 'FRONTIER_GARRISON',
    colorHex: '#ef4444',
    description: 'Armored security bastion guarding colony peace & raising Morale (+10).',
  },
  {
    id: 'DIPLOMATIC_CONSULATE',
    name: 'Xenodiplomatic Consulate',
    icon: '🏛️',
    category: 'SCIENCE',
    allowedLayers: [0],
    buildTimeSec: 16,
    creditCost: 580,
    alloyCost: 4,
    powerDeltaMW: -8,
    o2Delta: 6,
    workersRequired: 8,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 8,
    mappedModuleKey: 'DIPLOMATIC_CONSULATE',
    colorHex: '#f472b6',
    description: 'Alien envoy embassy generating faction standing & Morale.',
  },
  {
    id: 'ASTRO_OBSERVATORY',
    name: 'Deep-Space Observatory',
    icon: '🔭',
    category: 'SCIENCE',
    allowedLayers: [0],
    buildTimeSec: 15,
    creditCost: 560,
    alloyCost: 4,
    powerDeltaMW: -12,
    o2Delta: 0,
    workersRequired: 10,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0,
    moraleBonus: 4,
    mappedModuleKey: 'ASTRO_OBSERVATORY',
    colorHex: '#a78bfa',
    description: 'Long-range telemetry dome aiding sector exploration & astrogation.',
  },
  {
    id: 'ARCH_EXCAVATION',
    name: 'Precursor Relic Vault',
    icon: '🏺',
    category: 'SCIENCE',
    allowedLayers: [-2, -3],
    buildTimeSec: 25,
    creditCost: 920,
    alloyCost: 9,
    powerDeltaMW: -22,
    o2Delta: 0,
    workersRequired: 16,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 2.0,
    extractionMultBonus: 0.12,
    terraformRateBonus: 0,
    moraleBonus: 6,
    mappedModuleKey: 'ARCH_EXCAVATION',
    colorHex: '#c084fc',
    description: 'Deep-core Precursor dig (+25% bonus on L3 Deep Seams, unearths relic traces).',
  },
];

/**
 * Milestone 1.9: Endgame Outpost Precursor Colony Cores unlocked from Dreadnought World Boss drops.
 */
export const OUTPOST_RELIC_BUILDINGS: readonly OutpostBuildingDef[] = [
  {
    id: 'PRECURSOR_SINGULARITY_CORE',
    requiresRelicBlueprint: true,
    name: 'Zero-Point Singularity Reactor',
    icon: '⚛️',
    category: 'POWER',
    allowedLayers: [-2, -3],
    buildTimeSec: 20,
    creditCost: 1400,
    alloyCost: 14,
    powerDeltaMW: 140,
    o2Delta: 0,
    workersRequired: 8,
    popCapacityBonus: 0,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0.15,
    terraformRateBonus: 0,
    moraleBonus: 8,
    maxPerColony: 1,
    colorHex: '#f43f5e',
    description: 'Precursor vacuum-energy core delivering +140 MW continuous grid power and +15% industrial resonance.',
  },
  {
    id: 'QUANTUM_ASSEMBLY_NEXUS',
    requiresRelicBlueprint: true,
    name: 'Precursor Quantum Fabricator',
    icon: '💠',
    category: 'INDUSTRY',
    allowedLayers: [-1, -2, -3],
    buildTimeSec: 22,
    creditCost: 1600,
    alloyCost: 16,
    powerDeltaMW: -30,
    o2Delta: 0,
    workersRequired: 12,
    popCapacityBonus: 0,
    siloCapacityBonus: 120,
    extractionRateBase: 4.5,
    extractionMultBonus: 0.45,
    terraformRateBonus: 0,
    moraleBonus: 10,
    maxPerColony: 1,
    colorHex: '#e879f9',
    description: 'Subterranean molecular assembler (+45% Colony extraction yield, +120 Silo capacity, +10 Morale).',
  },
  {
    id: 'SUBSPACE_AEGIS_CITADEL',
    requiresRelicBlueprint: true,
    name: 'Planetary Subspace Aegis Dome',
    icon: '🛸',
    category: 'ORBITAL',
    allowedLayers: [0],
    buildTimeSec: 24,
    creditCost: 1500,
    alloyCost: 15,
    powerDeltaMW: -25,
    o2Delta: 35,
    workersRequired: 10,
    popCapacityBonus: 80,
    siloCapacityBonus: 0,
    extractionRateBase: 0,
    extractionMultBonus: 0,
    terraformRateBonus: 0.04,
    moraleBonus: 22,
    maxPerColony: 1,
    colorHex: '#38bdf8',
    description: 'Precursor planetary shield & atmospheric stabilizer (+35 O2, +80 Pop cap, +22 Morale, accelerated terraforming).',
  },
];

export const OUTPOST_BUILDING_MAP = new Map<BuildingTypeId, OutpostBuildingDef>(
  [...OUTPOST_BUILDINGS, ...OUTPOST_RELIC_BUILDINGS].map((b) => [b.id, b])
);

export function getOutpostBuildingDef(id: string | null | undefined): OutpostBuildingDef | null {
  if (!id) return null;
  return OUTPOST_BUILDING_MAP.get(id as BuildingTypeId) || null;
}

export function mapFacilityToOutpostBuilding(
  facilityType: 'DERRICK' | 'HABITATION' | 'TERRAFORMER' | 'SILO' | 'SHIPYARD'
): BuildingTypeId {
  switch (facilityType) {
    case 'DERRICK': return 'ORE_MINE_L1';
    case 'HABITATION': return 'UNDERGROUND_RESIDENCE';
    case 'TERRAFORMER': return 'ATMOS_PROCESSOR';
    case 'SILO': return 'STORAGE_WAREHOUSE';
    case 'SHIPYARD': return 'SPACEPORT_GANTRY';
  }
}

export function mapModuleKeyToOutpostBuilding(moduleKey: ColonyModuleKey): BuildingTypeId {
  return moduleKey as BuildingTypeId;
}


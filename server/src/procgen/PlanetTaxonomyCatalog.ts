/**
 * 15 Main Planet Classes x 3 Subtypes = 45 Creative Planet Types.
 * Native first-class taxonomy with full geophysical profiles, palettes, and resource curves.
 */

import { createMulberry32, rngFloat, rngInt } from './DeterministicPRNG';

export type PlanetMainClass =
  | 'LIVING_BIOSPHERE'
  | 'HYDROSPHERE'
  | 'CAUSTIC_SOLVENT'
  | 'CRYO_GLACIAL'
  | 'PYRO_TECTONIC'
  | 'METALLIC_ORE'
  | 'CRYSTALLINE_GEM'
  | 'SILICATE_DESERT'
  | 'RARE_EARTH'
  | 'RADIOLOGIC_ISOTOPIC'
  | 'MAGNETOSPHERIC'
  | 'GAS_ICE_GIANT'
  | 'FUNGAL_MYCELIAL'
  | 'SYNTHETIC_CYBERNETIC'
  | 'PRECURSOR_ANOMALOUS';

export type PlanetPatternStyle =
  | 'ARCHIPELAGO'
  | 'BANDED'
  | 'CRATERED'
  | 'MAGMA_FISSURE'
  | 'CRYSTAL_FACETS'
  | 'MYCELIAL_WEB'
  | 'CYBER_GRID'
  | 'PRECURSOR_GLYPH';

export interface PlanetPalette {
  base: string;
  band1: string;
  band2: string;
  accent: string;
  glow: string;
  atmosphere: string;
  patternStyle: PlanetPatternStyle;
  hasRings: boolean;
  hasClouds: boolean;
  emissiveStrength: number;
}

export interface PlanetSubtypeDef {
  subtype: string;
  mainClass: PlanetMainClass;
  mainClassLabel: string;
  abundanceRating: number;   // 1-10
  tectonicsRating: number;   // 1-10
  atmosphereRating: number;  // 0-10
  densityRating: number;     // 1-10
  surfaceTempK: number;
  atmosphereDensity: number; // Bar
  habitabilityRating: number; // 0-100
  hazardClass: string;
  hazardLevels: { thermal: number; ion: number; caustic: number };
  lifeMultiplier: number; // Relative species abundance
  primaryResource: string;
  exoticResource: string;
  palette: PlanetPalette;
  description: string;
}

export const PLANET_SUBTYPE_CATALOG: readonly PlanetSubtypeDef[] = [
  // 1. LIVING_BIOSPHERE (TERRESTRIAL)
  {
    subtype: 'Verdant Jungle',
    mainClass: 'LIVING_BIOSPHERE',
    mainClassLabel: 'Living Biosphere',
    abundanceRating: 7,
    tectonicsRating: 3,
    atmosphereRating: 6,
    densityRating: 5,
    surfaceTempK: 298,
    atmosphereDensity: 1.15,
    habitabilityRating: 88,
    hazardClass: 'DENSE_CANOPY_SPORES',
    hazardLevels: { thermal: 0, ion: 0, caustic: 1 },
    lifeMultiplier: 1.5,
    primaryResource: 'Bio-Protein Sap',
    exoticResource: 'Canopy Amber Resin',
    palette: {
      base: '#065f46', band1: '#10b981', band2: '#047857', accent: '#6ee7b7',
      glow: '#34d399', atmosphere: '#34d399', patternStyle: 'ARCHIPELAGO',
      hasRings: false, hasClouds: true, emissiveStrength: 0.15,
    },
    description: 'Hyper-oxygenated rainforest supercontinents teeming with multi-tiered xenofauna and luminous flora.',
  },
  {
    subtype: 'Mire Fen',
    mainClass: 'LIVING_BIOSPHERE',
    mainClassLabel: 'Living Biosphere',
    abundanceRating: 6,
    tectonicsRating: 2,
    atmosphereRating: 7,
    densityRating: 4,
    surfaceTempK: 294,
    atmosphereDensity: 1.3,
    habitabilityRating: 72,
    hazardClass: 'BIOLOGICAL_SPORES',
    hazardLevels: { thermal: 0, ion: 0, caustic: 2 },
    lifeMultiplier: 1.4,
    primaryResource: 'Peat Bio-Polymers',
    exoticResource: 'Venomous Mire Culture',
    palette: {
      base: '#1e3a2f', band1: '#4d7c0f', band2: '#0f766e', accent: '#a3e635',
      glow: '#84cc16', atmosphere: '#65a30d', patternStyle: 'ARCHIPELAGO',
      hasRings: false, hasClouds: true, emissiveStrength: 0.2,
    },
    description: 'Geothermal marsh-basins shrouded in acidic pollen fog and rich organic sludge reserves.',
  },
  {
    subtype: 'Savanna Canopy',
    mainClass: 'LIVING_BIOSPHERE',
    mainClassLabel: 'Living Biosphere',
    abundanceRating: 6,
    tectonicsRating: 2,
    atmosphereRating: 5,
    densityRating: 5,
    surfaceTempK: 291,
    atmosphereDensity: 1.0,
    habitabilityRating: 94,
    hazardClass: 'SEASONAL_GALES',
    hazardLevels: { thermal: 0, ion: 0, caustic: 0 },
    lifeMultiplier: 1.35,
    primaryResource: 'Nitrogen Grain Silos',
    exoticResource: 'Solar Nectar',
    palette: {
      base: '#15803d', band1: '#eab308', band2: '#0284c7', accent: '#fde047',
      glow: '#bef264', atmosphere: '#38bdf8', patternStyle: 'ARCHIPELAGO',
      hasRings: false, hasClouds: true, emissiveStrength: 0.1,
    },
    description: 'Sunlit golden grassplains and warm shallow seas prized for colony agricultural settlements.',
  },

  // 2. HYDROSPHERE (TERRESTRIAL)
  {
    subtype: 'Abyssal Pelagic',
    mainClass: 'HYDROSPHERE',
    mainClassLabel: 'Hydrosphere',
    abundanceRating: 5,
    tectonicsRating: 4,
    atmosphereRating: 6,
    densityRating: 4,
    surfaceTempK: 282,
    atmosphereDensity: 1.25,
    habitabilityRating: 66,
    hazardClass: 'ABYSSAL_SQUALLS',
    hazardLevels: { thermal: 0, ion: 1, caustic: 0 },
    lifeMultiplier: 1.3,
    primaryResource: 'Abyssal Brine Salts',
    exoticResource: 'Bathyal Photoprotein',
    palette: {
      base: '#0c4a6e', band1: '#1d4ed8', band2: '#0369a1', accent: '#38bdf8',
      glow: '#22d3ee', atmosphere: '#0ea5e9', patternStyle: 'ARCHIPELAGO',
      hasRings: false, hasClouds: true, emissiveStrength: 0.25,
    },
    description: 'Unbroken ultramarine world-ocean with volcanic trench vents lighting the deep benthic zone.',
  },
  {
    subtype: 'Pellucid Archipelagic',
    mainClass: 'HYDROSPHERE',
    mainClassLabel: 'Hydrosphere',
    abundanceRating: 6,
    tectonicsRating: 3,
    atmosphereRating: 5,
    densityRating: 5,
    surfaceTempK: 289,
    atmosphereDensity: 1.05,
    habitabilityRating: 82,
    hazardClass: 'TIDAL_RESONANCE',
    hazardLevels: { thermal: 0, ion: 0, caustic: 0 },
    lifeMultiplier: 1.25,
    primaryResource: 'Silica Reef Limestone',
    exoticResource: 'Opalescent Pearl Ore',
    palette: {
      base: '#0284c7', band1: '#67e8f9', band2: '#0e7490', accent: '#f0f9ff',
      glow: '#a5f3fc', atmosphere: '#7dd3fc', patternStyle: 'ARCHIPELAGO',
      hasRings: true, hasClouds: true, emissiveStrength: 0.15,
    },
    description: 'Crystal-clear opalescent oceans dotted with sunlit white-chalk island chains and ring debris.',
  },
  {
    subtype: 'Cyanic Atoll',
    mainClass: 'HYDROSPHERE',
    mainClassLabel: 'Hydrosphere',
    abundanceRating: 6,
    tectonicsRating: 5,
    atmosphereRating: 6,
    densityRating: 5,
    surfaceTempK: 279,
    atmosphereDensity: 1.18,
    habitabilityRating: 61,
    hazardClass: 'AMMONIA_SPRAY',
    hazardLevels: { thermal: 0, ion: 0, caustic: 1 },
    lifeMultiplier: 1.2,
    primaryResource: 'Cupric Sea-Nodules',
    exoticResource: 'Cyanic Kelp Extract',
    palette: {
      base: '#115e59', band1: '#2dd4bf', band2: '#06b6d4', accent: '#99f6e4',
      glow: '#5eead4', atmosphere: '#14b8a6', patternStyle: 'ARCHIPELAGO',
      hasRings: false, hasClouds: true, emissiveStrength: 0.2,
    },
    description: 'Vibrant turquoise copper-ammonia seas swept by fierce bi-annual super-tides.',
  },

  // 3. CAUSTIC_SOLVENT (VOLCANIC)
  {
    subtype: 'Sulfuric Acidic',
    mainClass: 'CAUSTIC_SOLVENT',
    mainClassLabel: 'Caustic & Solvent',
    abundanceRating: 6,
    tectonicsRating: 6,
    atmosphereRating: 8,
    densityRating: 6,
    surfaceTempK: 495,
    atmosphereDensity: 3.4,
    habitabilityRating: 8,
    hazardClass: 'EXTREME_CAUSTIC_RAIN',
    hazardLevels: { thermal: 1, ion: 0, caustic: 3 },
    lifeMultiplier: 0.65,
    primaryResource: 'Vitriol Sulfur Crystal',
    exoticResource: 'Acid-Resistant Membrane',
    palette: {
      base: '#713f12', band1: '#a3e635', band2: '#ca8a04', accent: '#d9f99d',
      glow: '#bef264', atmosphere: '#a3e635', patternStyle: 'BANDED',
      hasRings: false, hasClouds: true, emissiveStrength: 0.25,
    },
    description: 'Pressurized chartreuse clouds of condensed sulfuric acid rain relentlessly over blistered plateaus.',
  },
  {
    subtype: 'Halide Brine',
    mainClass: 'CAUSTIC_SOLVENT',
    mainClassLabel: 'Caustic & Solvent',
    abundanceRating: 7,
    tectonicsRating: 5,
    atmosphereRating: 5,
    densityRating: 5,
    surfaceTempK: 420,
    atmosphereDensity: 1.6,
    habitabilityRating: 12,
    hazardClass: 'CAUSTIC_GEYSERS',
    hazardLevels: { thermal: 1, ion: 1, caustic: 2 },
    lifeMultiplier: 0.7,
    primaryResource: 'Alkali Halide Salts',
    exoticResource: 'Fluorite Phase Crystals',
    palette: {
      base: '#4c1d95', band1: '#c084fc', band2: '#a21caf', accent: '#f0abfc',
      glow: '#e879f9', atmosphere: '#c084fc', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.2,
    },
    description: 'Boiling alkali salt basins punctuated by explosive halogen geysers.',
  },
  {
    subtype: 'Chlorine Vapor',
    mainClass: 'CAUSTIC_SOLVENT',
    mainClassLabel: 'Caustic & Solvent',
    abundanceRating: 5,
    tectonicsRating: 4,
    atmosphereRating: 7,
    densityRating: 5,
    surfaceTempK: 390,
    atmosphereDensity: 2.2,
    habitabilityRating: 10,
    hazardClass: 'TOXIC_CHLORINE_FOG',
    hazardLevels: { thermal: 0, ion: 1, caustic: 3 },
    lifeMultiplier: 0.75,
    primaryResource: 'Chloride Slag Ore',
    exoticResource: 'Chemo-Spore Sacs',
    palette: {
      base: '#14532d', band1: '#84cc16', band2: '#3f6212', accent: '#fde047',
      glow: '#a3e635', atmosphere: '#84cc16', patternStyle: 'BANDED',
      hasRings: false, hasClouds: true, emissiveStrength: 0.18,
    },
    description: 'Dense emerald-amber chlorine atmosphere that rapidly dissolves unsealed hull plating.',
  },

  // 4. CRYO_GLACIAL (BARREN)
  {
    subtype: 'Rime Tundra',
    mainClass: 'CRYO_GLACIAL',
    mainClassLabel: 'Cryo-Glacial',
    abundanceRating: 4,
    tectonicsRating: 3,
    atmosphereRating: 4,
    densityRating: 5,
    surfaceTempK: 165,
    atmosphereDensity: 0.48,
    habitabilityRating: 38,
    hazardClass: 'CRYOGENIC_SQUALLS',
    hazardLevels: { thermal: 0, ion: 1, caustic: 0 },
    lifeMultiplier: 0.85,
    primaryResource: 'Glacial Nitrogen Ice',
    exoticResource: 'Cryo-Adaptogen Moss',
    palette: {
      base: '#334155', band1: '#bae6fd', band2: '#64748b', accent: '#f8fafc',
      glow: '#7dd3fc', atmosphere: '#bae6fd', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: true, emissiveStrength: 0.1,
    },
    description: 'Wind-scoured nitrogen glaciers concealing geothermal pockets beneath miles of blue rime.',
  },
  {
    subtype: 'Hydrocarbon Cryo-Dune',
    mainClass: 'CRYO_GLACIAL',
    mainClassLabel: 'Cryo-Glacial',
    abundanceRating: 7,
    tectonicsRating: 2,
    atmosphereRating: 6,
    densityRating: 4,
    surfaceTempK: 98,
    atmosphereDensity: 1.45,
    habitabilityRating: 15,
    hazardClass: 'HYDROCARBON_MIST',
    hazardLevels: { thermal: 0, ion: 1, caustic: 1 },
    lifeMultiplier: 0.75,
    primaryResource: 'Liquid Methane Ice',
    exoticResource: 'Tholin Hydrocarbon Pitch',
    palette: {
      base: '#78350f', band1: '#d97706', band2: '#451a03', accent: '#fbbf24',
      glow: '#f59e0b', atmosphere: '#d97706', patternStyle: 'BANDED',
      hasRings: false, hasClouds: true, emissiveStrength: 0.08,
    },
    description: 'Orange-hazed Titan-class world carved by liquid methane rivers and sticky tholin dunes.',
  },
  {
    subtype: 'Selenic Permafrost',
    mainClass: 'CRYO_GLACIAL',
    mainClassLabel: 'Cryo-Glacial',
    abundanceRating: 3,
    tectonicsRating: 1,
    atmosphereRating: 1,
    densityRating: 4,
    surfaceTempK: 118,
    atmosphereDensity: 0.05,
    habitabilityRating: 22,
    hazardClass: 'VACUUM_FROST',
    hazardLevels: { thermal: 0, ion: 0, caustic: 0 },
    lifeMultiplier: 0.5,
    primaryResource: 'Selenic Ice Crust',
    exoticResource: 'Sub-Brine Polyps',
    palette: {
      base: '#475569', band1: '#cbd5e1', band2: '#94a3b8', accent: '#f1f5f9',
      glow: '#e2e8f0', atmosphere: '#94a3b8', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.05,
    },
    description: 'Brilliant cratered water-ice crust cracked by tidal flexing over deep subsurface oceans.',
  },

  // 5. PYRO_TECTONIC (VOLCANIC)
  {
    subtype: 'Magmatic Crucible',
    mainClass: 'PYRO_TECTONIC',
    mainClassLabel: 'Pyro-Tectonic',
    abundanceRating: 8,
    tectonicsRating: 10,
    atmosphereRating: 6,
    densityRating: 7,
    surfaceTempK: 890,
    atmosphereDensity: 0.95,
    habitabilityRating: 4,
    hazardClass: 'EXTREME_THERMAL',
    hazardLevels: { thermal: 3, ion: 1, caustic: 1 },
    lifeMultiplier: 0.6,
    primaryResource: 'Igneous Heavy Slag',
    exoticResource: 'Pyro-Core Garnet',
    palette: {
      base: '#1c1917', band1: '#ea580c', band2: '#44403c', accent: '#facc15',
      glow: '#f97316', atmosphere: '#fb923c', patternStyle: 'MAGMA_FISSURE',
      hasRings: false, hasClouds: false, emissiveStrength: 0.85,
    },
    description: 'Fractured obsidian crust split by glowing incandescent magma seas and violent pyroclastic plumes.',
  },
  {
    subtype: 'Basalt Flood',
    mainClass: 'PYRO_TECTONIC',
    mainClassLabel: 'Pyro-Tectonic',
    abundanceRating: 6,
    tectonicsRating: 9,
    atmosphereRating: 5,
    densityRating: 6,
    surfaceTempK: 640,
    atmosphereDensity: 0.78,
    habitabilityRating: 7,
    hazardClass: 'ASH_LIGHTNING',
    hazardLevels: { thermal: 2, ion: 2, caustic: 0 },
    lifeMultiplier: 0.65,
    primaryResource: 'Columnar Basalt Ore',
    exoticResource: 'Static Ash Glass',
    palette: {
      base: '#292524', band1: '#991b1b', band2: '#57534e', accent: '#f87171',
      glow: '#ef4444', atmosphere: '#ef4444', patternStyle: 'MAGMA_FISSURE',
      hasRings: false, hasClouds: false, emissiveStrength: 0.55,
    },
    description: 'Colossal crimson shield volcanoes venting black ash thunderheads charged with static lightning.',
  },
  {
    subtype: 'Primordial Ember',
    mainClass: 'PYRO_TECTONIC',
    mainClassLabel: 'Pyro-Tectonic',
    abundanceRating: 9,
    tectonicsRating: 10,
    atmosphereRating: 7,
    densityRating: 8,
    surfaceTempK: 960,
    atmosphereDensity: 1.4,
    habitabilityRating: 2,
    hazardClass: 'MANTLE_UPHEAVAL',
    hazardLevels: { thermal: 3, ion: 2, caustic: 1 },
    lifeMultiplier: 0.5,
    primaryResource: 'Superheated Ferric Alloy',
    exoticResource: 'Proto-Planetary Ember Core',
    palette: {
      base: '#450a0a', band1: '#f97316', band2: '#7f1d1d', accent: '#fef08a',
      glow: '#fbbf24', atmosphere: '#f97316', patternStyle: 'MAGMA_FISSURE',
      hasRings: false, hasClouds: false, emissiveStrength: 0.9,
    },
    description: 'Unsettled proto-world still cooling from planetary accretion, brimming with heavy mantle metals.',
  },

  // 6. METALLIC_ORE (BARREN)
  {
    subtype: 'Auric Lode',
    mainClass: 'METALLIC_ORE',
    mainClassLabel: 'Metallic & Ore-Rich',
    abundanceRating: 10,
    tectonicsRating: 2,
    atmosphereRating: 1,
    densityRating: 8,
    surfaceTempK: 225,
    atmosphereDensity: 0.12,
    habitabilityRating: 18,
    hazardClass: 'LOW_RADIATION',
    hazardLevels: { thermal: 0, ion: 1, caustic: 0 },
    lifeMultiplier: 0.55,
    primaryResource: 'High-Grade Plasteel Ore',
    exoticResource: 'Refined Auric Bullion',
    palette: {
      base: '#451a03', band1: '#d97706', band2: '#78350f', accent: '#fde047',
      glow: '#fbbf24', atmosphere: '#f59e0b', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.3,
    },
    description: 'Heavy metallic world laced with glinting precious-metal veins exposed by ancient impacts.',
  },
  {
    subtype: 'Cupric Rustworld',
    mainClass: 'METALLIC_ORE',
    mainClassLabel: 'Metallic & Ore-Rich',
    abundanceRating: 8,
    tectonicsRating: 3,
    atmosphereRating: 2,
    densityRating: 6,
    surfaceTempK: 260,
    atmosphereDensity: 0.25,
    habitabilityRating: 25,
    hazardClass: 'OXIDE_DUST_SQUALLS',
    hazardLevels: { thermal: 0, ion: 0, caustic: 1 },
    lifeMultiplier: 0.7,
    primaryResource: 'Oxidized Copper Ore',
    exoticResource: 'Malachite Conductors',
    palette: {
      base: '#7c2d12', band1: '#14b8a6', band2: '#9a3412', accent: '#5eead4',
      glow: '#2dd4bf', atmosphere: '#fb923c', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.15,
    },
    description: 'Rust-red iron deserts contrasted with sprawling verdigris copper-sulfate mesas.',
  },
  {
    subtype: 'Ferric Foundry',
    mainClass: 'METALLIC_ORE',
    mainClassLabel: 'Metallic & Ore-Rich',
    abundanceRating: 9,
    tectonicsRating: 4,
    atmosphereRating: 0,
    densityRating: 9,
    surfaceTempK: 205,
    atmosphereDensity: 0.02,
    habitabilityRating: 12,
    hazardClass: 'SOLAR_HARD_VACUUM',
    hazardLevels: { thermal: 1, ion: 1, caustic: 0 },
    lifeMultiplier: 0.4,
    primaryResource: 'Nickel-Iron Ingots',
    exoticResource: 'Dense Core Titanium',
    palette: {
      base: '#1e293b', band1: '#64748b', band2: '#334155', accent: '#e2e8f0',
      glow: '#94a3b8', atmosphere: '#64748b', patternStyle: 'CRATERED',
      hasRings: true, hasClouds: false, emissiveStrength: 0.12,
    },
    description: 'Shattered metallic core of a larger protoplanet, prized by orbital shipyards for bulk steel.',
  },

  // 7. CRYSTALLINE_GEM (BARREN)
  {
    subtype: 'Ruby Corundum',
    mainClass: 'CRYSTALLINE_GEM',
    mainClassLabel: 'Crystalline & Gemstone',
    abundanceRating: 9,
    tectonicsRating: 3,
    atmosphereRating: 2,
    densityRating: 6,
    surfaceTempK: 245,
    atmosphereDensity: 0.18,
    habitabilityRating: 16,
    hazardClass: 'LASER_REFRACTION',
    hazardLevels: { thermal: 1, ion: 1, caustic: 0 },
    lifeMultiplier: 0.6,
    primaryResource: 'Corundum Crystal Shards',
    exoticResource: 'Ruby Focusing Prisms',
    palette: {
      base: '#4c0519', band1: '#e11d48', band2: '#881337', accent: '#fda4af',
      glow: '#fb7185', atmosphere: '#f43f5e', patternStyle: 'CRYSTAL_FACETS',
      hasRings: false, hasClouds: false, emissiveStrength: 0.45,
    },
    description: 'Towering crimson aluminum-oxide crystal spires that refract starlight into dazzling flares.',
  },
  {
    subtype: 'Sapphire Quartzite',
    mainClass: 'CRYSTALLINE_GEM',
    mainClassLabel: 'Crystalline & Gemstone',
    abundanceRating: 8,
    tectonicsRating: 4,
    atmosphereRating: 2,
    densityRating: 6,
    surfaceTempK: 210,
    atmosphereDensity: 0.22,
    habitabilityRating: 20,
    hazardClass: 'PIEZOELECTRIC_ARCS',
    hazardLevels: { thermal: 0, ion: 2, caustic: 0 },
    lifeMultiplier: 0.65,
    primaryResource: 'Quartzite Silicate',
    exoticResource: 'Sapphire Capacitor Matrix',
    palette: {
      base: '#172554', band1: '#2563eb', band2: '#1e3a8a', accent: '#93c5fd',
      glow: '#60a5fa', atmosphere: '#3b82f6', patternStyle: 'CRYSTAL_FACETS',
      hasRings: true, hasClouds: false, emissiveStrength: 0.5,
    },
    description: 'Cobalt crystalline plains generating continuous piezoelectric lightning beneath tectonic stress.',
  },
  {
    subtype: 'Emerald Beryl',
    mainClass: 'CRYSTALLINE_GEM',
    mainClassLabel: 'Crystalline & Gemstone',
    abundanceRating: 9,
    tectonicsRating: 2,
    atmosphereRating: 3,
    densityRating: 5,
    surfaceTempK: 255,
    atmosphereDensity: 0.35,
    habitabilityRating: 28,
    hazardClass: 'VITREOUS_SHARDS',
    hazardLevels: { thermal: 0, ion: 1, caustic: 1 },
    lifeMultiplier: 0.7,
    primaryResource: 'Vitreous Beryl Ore',
    exoticResource: 'Emerald Lattice Lenses',
    palette: {
      base: '#022c22', band1: '#10b981', band2: '#065f46', accent: '#a7f3d0',
      glow: '#34d399', atmosphere: '#10b981', patternStyle: 'CRYSTAL_FACETS',
      hasRings: false, hasClouds: false, emissiveStrength: 0.45,
    },
    description: 'Glassy emerald chasms sparkling across low-gravity flats with remarkable orbital albedo.',
  },

  // 8. SILICATE_DESERT (BARREN)
  {
    subtype: 'Arid Regolith',
    mainClass: 'SILICATE_DESERT',
    mainClassLabel: 'Silicate & Dust Desert',
    abundanceRating: 3,
    tectonicsRating: 2,
    atmosphereRating: 3,
    densityRating: 5,
    surfaceTempK: 315,
    atmosphereDensity: 0.32,
    habitabilityRating: 42,
    hazardClass: 'ABRASIVE_DUST_STORMS',
    hazardLevels: { thermal: 1, ion: 0, caustic: 0 },
    lifeMultiplier: 0.75,
    primaryResource: 'Desiccated Silicate Dust',
    exoticResource: 'Fossilized Amber Chitin',
    palette: {
      base: '#7c2d12', band1: '#d97706', band2: '#9a3412', accent: '#fed7aa',
      glow: '#fb923c', atmosphere: '#f59e0b', patternStyle: 'BANDED',
      hasRings: false, hasClouds: true, emissiveStrength: 0.08,
    },
    description: 'Sweeping iron-oxide ergs and ancient dried river canyons scarred by continent-scale sandstorms.',
  },
  {
    subtype: 'Oolitic Chalk',
    mainClass: 'SILICATE_DESERT',
    mainClassLabel: 'Silicate & Dust Desert',
    abundanceRating: 4,
    tectonicsRating: 1,
    atmosphereRating: 2,
    densityRating: 4,
    surfaceTempK: 240,
    atmosphereDensity: 0.16,
    habitabilityRating: 30,
    hazardClass: 'MICRO_METEORITE_RAIN',
    hazardLevels: { thermal: 0, ion: 0, caustic: 0 },
    lifeMultiplier: 0.6,
    primaryResource: 'Oolitic Carbonate',
    exoticResource: 'Chondrite Meteoric Iron',
    palette: {
      base: '#78716c', band1: '#e7e5e4', band2: '#a8a29e', accent: '#fafaf9',
      glow: '#d6d3d1', atmosphere: '#e7e5e4', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.05,
    },
    description: 'Pale carbonate spheroid dunes littered with carbonaceous chondrite impact craters.',
  },
  {
    subtype: 'Telluric Silt',
    mainClass: 'SILICATE_DESERT',
    mainClassLabel: 'Silicate & Dust Desert',
    abundanceRating: 6,
    tectonicsRating: 3,
    atmosphereRating: 3,
    densityRating: 5,
    surfaceTempK: 280,
    atmosphereDensity: 0.4,
    habitabilityRating: 36,
    hazardClass: 'TELLURIDE_VAPOR',
    hazardLevels: { thermal: 0, ion: 1, caustic: 1 },
    lifeMultiplier: 0.7,
    primaryResource: 'Tellurium Silt Alloy',
    exoticResource: 'Semiconductor Oxide',
    palette: {
      base: '#581c87', band1: '#9f1239', band2: '#831843', accent: '#fda4af',
      glow: '#f43f5e', atmosphere: '#be123c', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.12,
    },
    description: 'Maroon evaporite basins prized for high-purity tellurium and semiconductor mineral deposits.',
  },

  // 9. RARE_EARTH (BARREN)
  {
    subtype: 'Lanthanide Monazite',
    mainClass: 'RARE_EARTH',
    mainClassLabel: 'Rare-Earth & Lanthanide',
    abundanceRating: 9,
    tectonicsRating: 4,
    atmosphereRating: 2,
    densityRating: 7,
    surfaceTempK: 230,
    atmosphereDensity: 0.15,
    habitabilityRating: 14,
    hazardClass: 'LANTHANIDE_GLOW_DUST',
    hazardLevels: { thermal: 0, ion: 2, caustic: 0 },
    lifeMultiplier: 0.55,
    primaryResource: 'Lanthanide Monazite Sand',
    exoticResource: 'Neodymium Flux Cores',
    palette: {
      base: '#1e1b4b', band1: '#6366f1', band2: '#312e81', accent: '#c7d2fe',
      glow: '#818cf8', atmosphere: '#6366f1', patternStyle: 'CRYSTAL_FACETS',
      hasRings: false, hasClouds: false, emissiveStrength: 0.45,
    },
    description: 'Phosphorescent cerium and neodymium salt crusts glowing faintly violet along fault scarps.',
  },
  {
    subtype: 'Yttric Badlands',
    mainClass: 'RARE_EARTH',
    mainClassLabel: 'Rare-Earth & Lanthanide',
    abundanceRating: 9,
    tectonicsRating: 5,
    atmosphereRating: 1,
    densityRating: 7,
    surfaceTempK: 200,
    atmosphereDensity: 0.08,
    habitabilityRating: 10,
    hazardClass: 'STATIC_ASH_CHARGES',
    hazardLevels: { thermal: 0, ion: 2, caustic: 0 },
    lifeMultiplier: 0.5,
    primaryResource: 'Yttric Superconductors',
    exoticResource: 'High-Tc Yttrium Coils',
    palette: {
      base: '#27272a', band1: '#22d3ee', band2: '#3f3f46', accent: '#a5f3fc',
      glow: '#06b6d4', atmosphere: '#22d3ee', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.35,
    },
    description: 'Heavy yttrium-rich ash ridges essential for shipyard warp-coil and shield capacitor alloys.',
  },
  {
    subtype: 'Carbide Obsidian',
    mainClass: 'RARE_EARTH',
    mainClassLabel: 'Rare-Earth & Lanthanide',
    abundanceRating: 8,
    tectonicsRating: 2,
    atmosphereRating: 1,
    densityRating: 8,
    surfaceTempK: 270,
    atmosphereDensity: 0.06,
    habitabilityRating: 11,
    hazardClass: 'RAZOR_BASALT_PLATES',
    hazardLevels: { thermal: 1, ion: 1, caustic: 0 },
    lifeMultiplier: 0.45,
    primaryResource: 'Silicon-Carbide Plate',
    exoticResource: 'Diamondoid Armor Dust',
    palette: {
      base: '#09090b', band1: '#52525b', band2: '#18181b', accent: '#f4f4f5',
      glow: '#a1a1aa', atmosphere: '#71717a', patternStyle: 'CRYSTAL_FACETS',
      hasRings: false, hasClouds: false, emissiveStrength: 0.2,
    },
    description: 'Mirror-smooth black silicon-carbide plateaus nearly impervious to conventional drill heads.',
  },

  // 10. RADIOLOGIC_ISOTOPIC (VOLCANIC)
  {
    subtype: 'Fissionable Wasteland',
    mainClass: 'RADIOLOGIC_ISOTOPIC',
    mainClassLabel: 'Radiologic & Isotopic',
    abundanceRating: 9,
    tectonicsRating: 7,
    atmosphereRating: 4,
    densityRating: 9,
    surfaceTempK: 520,
    atmosphereDensity: 0.65,
    habitabilityRating: 3,
    hazardClass: 'NATURAL_FISSION_VENTS',
    hazardLevels: { thermal: 2, ion: 2, caustic: 1 },
    lifeMultiplier: 0.55,
    primaryResource: 'Fissionable Uranium Ore',
    exoticResource: 'Vitrified Reactor Glass',
    palette: {
      base: '#052e16', band1: '#22c55e', band2: '#14532d', accent: '#bbf7d0',
      glow: '#4ade80', atmosphere: '#22c55e', patternStyle: 'MAGMA_FISSURE',
      hasRings: false, hasClouds: false, emissiveStrength: 0.8,
    },
    description: 'Self-sustaining natural nuclear geysers boil across green vitrified glass basins.',
  },
  {
    subtype: 'Fluorescent Aurora',
    mainClass: 'RADIOLOGIC_ISOTOPIC',
    mainClassLabel: 'Radiologic & Isotopic',
    abundanceRating: 7,
    tectonicsRating: 5,
    atmosphereRating: 5,
    densityRating: 6,
    surfaceTempK: 340,
    atmosphereDensity: 0.85,
    habitabilityRating: 19,
    hazardClass: 'IONIZING_AURORA',
    hazardLevels: { thermal: 1, ion: 3, caustic: 0 },
    lifeMultiplier: 0.8,
    primaryResource: 'Phosphor Isotope Dust',
    exoticResource: 'Aurora Plasma Cells',
    palette: {
      base: '#3b0764', band1: '#ec4899', band2: '#10b981', accent: '#67e8f9',
      glow: '#f472b6', atmosphere: '#a855f7', patternStyle: 'BANDED',
      hasRings: false, hasClouds: true, emissiveStrength: 0.75,
    },
    description: 'Continuous magnetospheric particle rain ignites neon-magenta and green ground fluorescence.',
  },
  {
    subtype: 'Ultraviolet Scorch',
    mainClass: 'RADIOLOGIC_ISOTOPIC',
    mainClassLabel: 'Radiologic & Isotopic',
    abundanceRating: 6,
    tectonicsRating: 6,
    atmosphereRating: 2,
    densityRating: 7,
    surfaceTempK: 710,
    atmosphereDensity: 0.14,
    habitabilityRating: 4,
    hazardClass: 'IONIZING_UV_FLARES',
    hazardLevels: { thermal: 3, ion: 2, caustic: 0 },
    lifeMultiplier: 0.5,
    primaryResource: 'Irradiated Titanium',
    exoticResource: 'Solarized Crystal Matrix',
    palette: {
      base: '#2e1065', band1: '#8b5cf6', band2: '#4c1d95', accent: '#e9d5ff',
      glow: '#c084fc', atmosphere: '#a78bfa', patternStyle: 'MAGMA_FISSURE',
      hasRings: false, hasClouds: false, emissiveStrength: 0.65,
    },
    description: 'Close-orbit world stripped of ozone, glowing ultraviolet along razor-edged caldera ridges.',
  },

  // 11. MAGNETOSPHERIC (BARREN)
  {
    subtype: 'Lodestone Dynamo',
    mainClass: 'MAGNETOSPHERIC',
    mainClassLabel: 'Magnetospheric & Gravitic',
    abundanceRating: 8,
    tectonicsRating: 6,
    atmosphereRating: 2,
    densityRating: 8,
    surfaceTempK: 235,
    atmosphereDensity: 0.18,
    habitabilityRating: 12,
    hazardClass: 'EXTREME_MAGNETIC_FLUX',
    hazardLevels: { thermal: 0, ion: 3, caustic: 0 },
    lifeMultiplier: 0.6,
    primaryResource: 'Magnetite Core Shards',
    exoticResource: 'Flux-Suspended Iron Arcs',
    palette: {
      base: '#1e293b', band1: '#38bdf8', band2: '#0f172a', accent: '#7dd3fc',
      glow: '#0ea5e9', atmosphere: '#38bdf8', patternStyle: 'BANDED',
      hasRings: true, hasClouds: false, emissiveStrength: 0.5,
    },
    description: 'Super-charged dipolar magnetic field lines levitate shimmering ribbons of metallic dust into orbit.',
  },
  {
    subtype: 'Quasi-Degenerate Core',
    mainClass: 'MAGNETOSPHERIC',
    mainClassLabel: 'Magnetospheric & Gravitic',
    abundanceRating: 10,
    tectonicsRating: 1,
    atmosphereRating: 1,
    densityRating: 10,
    surfaceTempK: 190,
    atmosphereDensity: 0.09,
    habitabilityRating: 5,
    hazardClass: 'HYPER_GRAVITY_2_8G',
    hazardLevels: { thermal: 1, ion: 2, caustic: 0 },
    lifeMultiplier: 0.45,
    primaryResource: 'Neutronium-Laced Alloy',
    exoticResource: 'Compressed Graviton Plate',
    palette: {
      base: '#020617', band1: '#6366f1', band2: '#1e1b4b', accent: '#e0e7ff',
      glow: '#818cf8', atmosphere: '#4f46e5', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.4,
    },
    description: 'Impossibly dense hyper-gravity remnant (`2.8g`) packed with exotic trans-uranic ores.',
  },
  {
    subtype: 'Cimmerian Shadow',
    mainClass: 'MAGNETOSPHERIC',
    mainClassLabel: 'Magnetospheric & Gravitic',
    abundanceRating: 5,
    tectonicsRating: 3,
    atmosphereRating: 2,
    densityRating: 6,
    surfaceTempK: 88,
    atmosphereDensity: 0.14,
    habitabilityRating: 9,
    hazardClass: 'ZERO_ALBEDO_DARKNESS',
    hazardLevels: { thermal: 0, ion: 1, caustic: 0 },
    lifeMultiplier: 0.65,
    primaryResource: 'Pitch-Carbon Ore',
    exoticResource: 'Umbral Bio-Silk',
    palette: {
      base: '#030712', band1: '#1f2937', band2: '#111827', accent: '#4b5563',
      glow: '#6366f1', atmosphere: '#312e81', patternStyle: 'CRATERED',
      hasRings: false, hasClouds: false, emissiveStrength: 0.12,
    },
    description: 'Absorbs 98% of incident starlight across velvet-black carbon plains lit only by nocturnal fauna.',
  },

  // 12. GAS_ICE_GIANT (GAS_GIANT)
  {
    subtype: 'Jovian Hydrogen',
    mainClass: 'GAS_ICE_GIANT',
    mainClassLabel: 'Gas & Ice Giant',
    abundanceRating: 7,
    tectonicsRating: 0,
    atmosphereRating: 10,
    densityRating: 2,
    surfaceTempK: 110,
    atmosphereDensity: 4.5,
    habitabilityRating: 0,
    hazardClass: 'HIGH_PRESSURE_STORMS',
    hazardLevels: { thermal: 1, ion: 2, caustic: 0 },
    lifeMultiplier: 0.75,
    primaryResource: 'Deuterium Gas Reserves',
    exoticResource: 'Metallic Hydrogen Droplets',
    palette: {
      base: '#92400e', band1: '#f59e0b', band2: '#78350f', accent: '#fef3c7',
      glow: '#fbbf24', atmosphere: '#f59e0b', patternStyle: 'BANDED',
      hasRings: true, hasClouds: false, emissiveStrength: 0.12,
    },
    description: 'Colossal banded gas giant churning with anticyclonic hurricanes and rich Deuterium jet streams.',
  },
  {
    subtype: 'Noble Neon-Xenon',
    mainClass: 'GAS_ICE_GIANT',
    mainClassLabel: 'Gas & Ice Giant',
    abundanceRating: 8,
    tectonicsRating: 0,
    atmosphereRating: 10,
    densityRating: 2,
    surfaceTempK: 145,
    atmosphereDensity: 3.8,
    habitabilityRating: 0,
    hazardClass: 'IONIZED_NOBLE_CURRENTS',
    hazardLevels: { thermal: 0, ion: 2, caustic: 0 },
    lifeMultiplier: 0.8,
    primaryResource: 'Ionized Xenon Fuel',
    exoticResource: 'Harmonic Neon Cloud-Cells',
    palette: {
      base: '#1e1b4b', band1: '#06b6d4', band2: '#7c3aed', accent: '#a5f3fc',
      glow: '#22d3ee', atmosphere: '#38bdf8', patternStyle: 'BANDED',
      hasRings: true, hasClouds: false, emissiveStrength: 0.45,
    },
    description: 'Tranquil luminescent noble-gas atmosphere glowing cyan-violet—prime hunting ground for fuel skimmers.',
  },
  {
    subtype: 'Indigo Cryo-Giant',
    mainClass: 'GAS_ICE_GIANT',
    mainClassLabel: 'Gas & Ice Giant',
    abundanceRating: 7,
    tectonicsRating: 0,
    atmosphereRating: 10,
    densityRating: 3,
    surfaceTempK: 72,
    atmosphereDensity: 5.0,
    habitabilityRating: 0,
    hazardClass: 'SUPERSONIC_DIAMOND_HAIL',
    hazardLevels: { thermal: 0, ion: 2, caustic: 1 },
    lifeMultiplier: 0.7,
    primaryResource: 'Cryo-Helium Slush',
    exoticResource: 'Micro-Diamond Core Hail',
    palette: {
      base: '#1e1b4b', band1: '#4338ca', band2: '#581c87', accent: '#c4b5fd',
      glow: '#818cf8', atmosphere: '#6366f1', patternStyle: 'BANDED',
      hasRings: true, hasClouds: false, emissiveStrength: 0.2,
    },
    description: 'Deep indigo ice giant swept by supersonic winds that compress methane soot into falling diamonds.',
  },

  // 13. FUNGAL_MYCELIAL (TERRESTRIAL)
  {
    subtype: 'Mycelial Superorganism',
    mainClass: 'FUNGAL_MYCELIAL',
    mainClassLabel: 'Fungal & Xeno-Mycelial',
    abundanceRating: 8,
    tectonicsRating: 2,
    atmosphereRating: 7,
    densityRating: 4,
    surfaceTempK: 290,
    atmosphereDensity: 1.08,
    habitabilityRating: 80,
    hazardClass: 'PSIONIC_SPORE_BLOOM',
    hazardLevels: { thermal: 0, ion: 1, caustic: 2 },
    lifeMultiplier: 1.65,
    primaryResource: 'Bioluminescent Hyphae',
    exoticResource: 'Neural Mycelium Synapses',
    palette: {
      base: '#1e1b4b', band1: '#10b981', band2: '#6d28d9', accent: '#5eead4',
      glow: '#34d399', atmosphere: '#10b981', patternStyle: 'MYCELIAL_WEB',
      hasRings: false, hasClouds: true, emissiveStrength: 0.65,
    },
    description: 'An entire biosphere linked by a planetary-scale glowing neural mycelium processing faint signals.',
  },
  {
    subtype: 'Spore-Drift Canopy',
    mainClass: 'FUNGAL_MYCELIAL',
    mainClassLabel: 'Fungal & Xeno-Mycelial',
    abundanceRating: 6,
    tectonicsRating: 3,
    atmosphereRating: 8,
    densityRating: 3,
    surfaceTempK: 276,
    atmosphereDensity: 1.5,
    habitabilityRating: 64,
    hazardClass: 'AERIAL_SPORE_CURRENTS',
    hazardLevels: { thermal: 0, ion: 0, caustic: 2 },
    lifeMultiplier: 1.45,
    primaryResource: 'Buoyant Gas-Sacs',
    exoticResource: 'Aero-Lichen Filaments',
    palette: {
      base: '#312e81', band1: '#c084fc', band2: '#0d9488', accent: '#f5d0fe',
      glow: '#e879f9', atmosphere: '#c084fc', patternStyle: 'MYCELIAL_WEB',
      hasRings: false, hasClouds: true, emissiveStrength: 0.45,
    },
    description: 'Low-gravity plateaus eclipsed by continent-wide drifts of buoyant gas-filled fungal balloons.',
  },
  {
    subtype: 'Chitinous Reefworld',
    mainClass: 'FUNGAL_MYCELIAL',
    mainClassLabel: 'Fungal & Xeno-Mycelial',
    abundanceRating: 7,
    tectonicsRating: 2,
    atmosphereRating: 6,
    densityRating: 5,
    surfaceTempK: 296,
    atmosphereDensity: 1.12,
    habitabilityRating: 71,
    hazardClass: 'SWARM_DEFENSE_POLYPS',
    hazardLevels: { thermal: 0, ion: 0, caustic: 1 },
    lifeMultiplier: 1.5,
    primaryResource: 'Calcified Exo-Chitin',
    exoticResource: 'Living Coral Circuitry',
    palette: {
      base: '#701a75', band1: '#fb7185', band2: '#0f766e', accent: '#fecdd3',
      glow: '#f43f5e', atmosphere: '#fb7185', patternStyle: 'MYCELIAL_WEB',
      hasRings: false, hasClouds: true, emissiveStrength: 0.4,
    },
    description: 'Whole continents grown from calcareous chitin hives and sentient oceanic coral spires.',
  },

  // 14. SYNTHETIC_CYBERNETIC (PRECURSOR_RUIN)
  {
    subtype: 'Ecumenopolis Derelict',
    mainClass: 'SYNTHETIC_CYBERNETIC',
    mainClassLabel: 'Synthetic & Cybernetic',
    abundanceRating: 7,
    tectonicsRating: 1,
    atmosphereRating: 4,
    densityRating: 7,
    surfaceTempK: 248,
    atmosphereDensity: 0.42,
    habitabilityRating: 34,
    hazardClass: 'DEFENSE_GRID_STATIC',
    hazardLevels: { thermal: 0, ion: 2, caustic: 0 },
    lifeMultiplier: 0.75,
    primaryResource: 'Salvaged Structural Alloy',
    exoticResource: 'Ancient Transit Cores',
    palette: {
      base: '#1e293b', band1: '#475569', band2: '#0f172a', accent: '#f59e0b',
      glow: '#38bdf8', atmosphere: '#64748b', patternStyle: 'CYBER_GRID',
      hasRings: true, hasClouds: false, emissiveStrength: 0.55,
    },
    description: 'Continent-spanning rusted arcologies and shattered orbital elevators from a vanished star empire.',
  },
  {
    subtype: 'Nano-Lattice Foundry',
    mainClass: 'SYNTHETIC_CYBERNETIC',
    mainClassLabel: 'Synthetic & Cybernetic',
    abundanceRating: 9,
    tectonicsRating: 4,
    atmosphereRating: 2,
    densityRating: 7,
    surfaceTempK: 310,
    atmosphereDensity: 0.24,
    habitabilityRating: 14,
    hazardClass: 'NANITE_DISASSEMBLY',
    hazardLevels: { thermal: 1, ion: 2, caustic: 1 },
    lifeMultiplier: 0.65,
    primaryResource: 'Self-Assembling Hex Alloy',
    exoticResource: 'Dormant Grey-Swarm Seed',
    palette: {
      base: '#0f172a', band1: '#06b6d4', band2: '#334155', accent: '#67e8f9',
      glow: '#22d3ee', atmosphere: '#06b6d4', patternStyle: 'CYBER_GRID',
      hasRings: false, hasClouds: false, emissiveStrength: 0.7,
    },
    description: 'Geometric hexagonal plateaus continuously sculpted by dormant planetary nanotech assemblers.',
  },
  {
    subtype: 'Computronium Husk',
    mainClass: 'SYNTHETIC_CYBERNETIC',
    mainClassLabel: 'Synthetic & Cybernetic',
    abundanceRating: 8,
    tectonicsRating: 1,
    atmosphereRating: 1,
    densityRating: 8,
    surfaceTempK: 175,
    atmosphereDensity: 0.08,
    habitabilityRating: 18,
    hazardClass: 'QUANTUM_EMP_PULSES',
    hazardLevels: { thermal: 1, ion: 3, caustic: 0 },
    lifeMultiplier: 0.6,
    primaryResource: 'Positronic Silica Wafers',
    exoticResource: 'Cooling Cryo-Heatsinks',
    palette: {
      base: '#020617', band1: '#3b82f6', band2: '#1e293b', accent: '#93c5fd',
      glow: '#60a5fa', atmosphere: '#3b82f6', patternStyle: 'CYBER_GRID',
      hasRings: false, hasClouds: false, emissiveStrength: 0.8,
    },
    description: 'Matrioshka-scale crystalline logic monoliths radiating faint residual waste heat into deep space.',
  },

  // 15. PRECURSOR_ANOMALOUS (PRECURSOR_RUIN)
  {
    subtype: 'Xenolithic Vault',
    mainClass: 'PRECURSOR_ANOMALOUS',
    mainClassLabel: 'Precursor & Anomalous',
    abundanceRating: 8,
    tectonicsRating: 2,
    atmosphereRating: 3,
    densityRating: 8,
    surfaceTempK: 135,
    atmosphereDensity: 0.4,
    habitabilityRating: 24,
    hazardClass: 'IONIC_DISRUPTIONS',
    hazardLevels: { thermal: 0, ion: 2, caustic: 0 },
    lifeMultiplier: 0.8,
    primaryResource: 'Monolithic Basalt Alloy',
    exoticResource: 'Precursor Harmonic Conduits',
    palette: {
      base: '#1e1b4b', band1: '#9333ea', band2: '#312e81', accent: '#f0abfc',
      glow: '#a855f7', atmosphere: '#a855f7', patternStyle: 'PRECURSOR_GLYPH',
      hasRings: false, hasClouds: false, emissiveStrength: 0.75,
    },
    description: 'Glaciated tomb world carved with impossible black-stone monoliths and dormant tachyon vaults.',
  },
  {
    subtype: 'Tachyon Resonator',
    mainClass: 'PRECURSOR_ANOMALOUS',
    mainClassLabel: 'Precursor & Anomalous',
    abundanceRating: 9,
    tectonicsRating: 5,
    atmosphereRating: 4,
    densityRating: 6,
    surfaceTempK: 220,
    atmosphereDensity: 0.55,
    habitabilityRating: 26,
    hazardClass: 'TEMPORAL_PHASE_SHEAR',
    hazardLevels: { thermal: 1, ion: 3, caustic: 0 },
    lifeMultiplier: 0.85,
    primaryResource: 'Phase-Shifted Alloy',
    exoticResource: 'Tachyon Fold Capacitors',
    palette: {
      base: '#0f172a', band1: '#14b8a6', band2: '#7e22ce', accent: '#5eead4',
      glow: '#2dd4bf', atmosphere: '#2dd4bf', patternStyle: 'PRECURSOR_GLYPH',
      hasRings: true, hasClouds: false, emissiveStrength: 0.85,
    },
    description: 'Anomalous world caught in faint chronometric eddies where craters shimmer in dual-phase light.',
  },
  {
    subtype: 'Void-Crystal Relic',
    mainClass: 'PRECURSOR_ANOMALOUS',
    mainClassLabel: 'Precursor & Anomalous',
    abundanceRating: 10,
    tectonicsRating: 2,
    atmosphereRating: 2,
    densityRating: 9,
    surfaceTempK: 95,
    atmosphereDensity: 0.2,
    habitabilityRating: 15,
    hazardClass: 'QUASISPACE_HARMONIC',
    hazardLevels: { thermal: 0, ion: 3, caustic: 1 },
    lifeMultiplier: 0.9,
    primaryResource: 'Dark-Matter Quartz',
    exoticResource: 'QuasiSpace Lattice Cores',
    palette: {
      base: '#020617', band1: '#10b981', band2: '#4c1d95', accent: '#6ee7b7',
      glow: '#10b981', atmosphere: '#34d399', patternStyle: 'PRECURSOR_GLYPH',
      hasRings: true, hasClouds: false, emissiveStrength: 0.9,
    },
    description: 'Dark-matter laced crystalline world resonating with the emerald harmonics of QuasiSpace.',
  },
];

const SUBTYPE_MAP = new Map<string, PlanetSubtypeDef>(
  PLANET_SUBTYPE_CATALOG.map((s) => [s.subtype.toLowerCase(), s])
);

export function getPlanetSubtypeDef(subtype?: string | null, mainClass?: string | null): PlanetSubtypeDef {
  if (subtype) {
    const exact = SUBTYPE_MAP.get(subtype.toLowerCase());
    if (exact) return exact;
  }
  if (mainClass) {
    const mc = mainClass.toUpperCase();
    const byClass = PLANET_SUBTYPE_CATALOG.find((s) => s.mainClass === mc);
    if (byClass) return byClass;
  }
  return PLANET_SUBTYPE_CATALOG[0];
}

export function getAllPlanetSubtypes(): readonly PlanetSubtypeDef[] {
  return PLANET_SUBTYPE_CATALOG;
}

export function getDistinctMainClasses(): Array<{ mainClass: PlanetMainClass; label: string; subtypes: PlanetSubtypeDef[] }> {
  const grouped = new Map<PlanetMainClass, { label: string; subtypes: PlanetSubtypeDef[] }>();
  for (const def of PLANET_SUBTYPE_CATALOG) {
    let entry = grouped.get(def.mainClass);
    if (!entry) {
      entry = { label: def.mainClassLabel, subtypes: [] };
      grouped.set(def.mainClass, entry);
    }
    entry.subtypes.push(def);
  }
  return Array.from(grouped.entries()).map(([mainClass, v]) => ({
    mainClass,
    label: v.label,
    subtypes: v.subtypes,
  }));
}

/**
 * Curated Planet Name Bank drawn from Sheet 9 (Planet Names) & classic sci-fi exo-roots
 */
const PLANET_ROOT_NAMES: readonly string[] = [
  'Vaelora', 'Daltos', 'Xalton', 'Elrenus', 'Zathyria', 'Niustea', 'Dairus', 'Muloth',
  'Pulvion', 'Kebriea', 'Trora', 'Meotera', 'Hoboth', 'Braxorus', 'Trilles', 'Luxetania',
  'Senov', 'Corix', 'Saopra', 'Lezuna', 'Lopetis', 'Yadranov', 'Vazyke', 'Brichi',
  'Bodimia', 'Ceseon', 'Thebos', 'Rizen', 'Menov', 'Kelviri', 'Hazuno', 'Tryria',
  'Echion', 'Beruta', 'Norix', 'Kuenia', 'Tatorox', 'Tashan', 'Vraxis', 'Brolos',
  'Delamis', 'Nryn', 'Orinth', 'Thalassa', 'Krynn', 'Solara', 'Cinder', 'Phoris',
  'Vespera', 'Kallisto', 'Hyperion', 'Nereus', 'Zephyria', 'Aurelia', 'Selenos', 'Calypso',
  'Moros', 'Tantalus', 'Onyxia', 'Halcyon', 'Cygnus', 'Lyra', 'Altair', 'Borealis',
  'Drakonis', 'Erebus', 'Gorgon', 'Icarus', 'Juno', 'Kronos', 'Ladon', 'Midas',
  'Nyx', 'Oberon', 'Pelops', 'Quasar', 'Rhea', 'Styx', 'Titanis', 'Umbra',
  'Valkyr', 'Weyland', 'Xenos', 'Ymir', 'Zuben', 'Arcturia', 'Bellona', 'Carina',
  'Diomedes', 'Elysium', 'Fornax', 'Galatea', 'Helios', 'Ilium', 'Janus', 'Kestrel',
];

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

export interface GeneratedSectorPlanetRow {
  id: string;
  sectorId: number;
  name: string;
  mainClass: PlanetMainClass;
  subtype: string;
  radius: number;
  posX: number;
  posY: number;
  posZ: number;
  textureSeed: number;
  orbitIndex: number;
  atmosphereColor: string;
  atmosphereDensity: number;
  surfaceTempK: number;
  hazardClass: string;
  habitabilityRating: number;
  hazardThermalLevel: number;
  hazardIonLevel: number;
  hazardCausticLevel: number;
  abundanceRating: number;
  tectonicsRating: number;
  atmosphereRating: number;
  densityRating: number;
  controllingFaction: string;
  palette: PlanetPalette;
  description: string;
}

export interface SectorMetaInput {
  id: number;
  name: string;
  controllingFaction: string;
}

const FACTION_CLASS_AFFINITIES: Record<string, PlanetMainClass[]> = {
  FACTION_SOL: ['LIVING_BIOSPHERE', 'HYDROSPHERE', 'SILICATE_DESERT', 'METALLIC_ORE', 'CRYO_GLACIAL'],
  FACTION_HEGEMONY: ['PYRO_TECTONIC', 'METALLIC_ORE', 'SYNTHETIC_CYBERNETIC', 'MAGNETOSPHERIC', 'RADIOLOGIC_ISOTOPIC'],
  FACTION_VAELIC: ['PYRO_TECTONIC', 'METALLIC_ORE', 'SYNTHETIC_CYBERNETIC', 'RADIOLOGIC_ISOTOPIC', 'GAS_ICE_GIANT'],
  FACTION_LITHOS: ['CRYSTALLINE_GEM', 'RARE_EARTH', 'PRECURSOR_ANOMALOUS', 'METALLIC_ORE', 'SILICATE_DESERT'],
  FACTION_PHORID: ['FUNGAL_MYCELIAL', 'LIVING_BIOSPHERE', 'CAUSTIC_SOLVENT', 'HYDROSPHERE', 'RADIOLOGIC_ISOTOPIC'],
  FACTION_KRYLL: ['CAUSTIC_SOLVENT', 'CRYO_GLACIAL', 'GAS_ICE_GIANT', 'MAGNETOSPHERIC', 'SILICATE_DESERT'],
};

/**
 * Deterministically builds planets for Sectors 1-60, guaranteeing all 45 planet subtypes appear
 * multiple times while preserving canonical Sectors 1-5 initial planet IDs.
 */
export function buildGalaxyCompanionPlanets(sectors: SectorMetaInput[]): GeneratedSectorPlanetRow[] {
  const results: GeneratedSectorPlanetRow[] = [];
  let globalSubtypeCursor = 0;
  let nameCursor = 0;

  for (const sector of sectors) {
    const rng = createMulberry32(`galaxy_sector_planets_${sector.id}`);
    const isStarter = sector.id >= 1 && sector.id <= 5;
    // Sectors 1-5 already have 1 canonical primary planet (orbit 1); add 1-2 companion worlds there.
    // Sectors 6-60 get 3-4 planets each (~190 total worlds across the galaxy).
    const startOrbit = isStarter ? 2 : 1;
    const endOrbit = isStarter ? (sector.id <= 2 ? 3 : 2) : (sector.id % 3 === 0 ? 4 : 3);
    const affinities = FACTION_CLASS_AFFINITIES[sector.controllingFaction] || [];

    for (let orbit = startOrbit; orbit <= endOrbit; orbit++) {
      // Every 2nd planet advances the deterministic round-robin cursor across all 45 subtypes
      // to guarantee full 45/45 coverage; others pick with faction affinity.
      let def: PlanetSubtypeDef;
      if (orbit === startOrbit || globalSubtypeCursor < PLANET_SUBTYPE_CATALOG.length * 2) {
        def = PLANET_SUBTYPE_CATALOG[globalSubtypeCursor % PLANET_SUBTYPE_CATALOG.length];
        globalSubtypeCursor++;
      } else if (affinities.length > 0 && rng() < 0.7) {
        const chosenClass = affinities[Math.floor(rng() * affinities.length)];
        const pool = PLANET_SUBTYPE_CATALOG.filter((s) => s.mainClass === chosenClass);
        def = pool[Math.floor(rng() * pool.length)];
      } else {
        def = PLANET_SUBTYPE_CATALOG[Math.floor(rng() * PLANET_SUBTYPE_CATALOG.length)];
      }

      const baseRoot = PLANET_ROOT_NAMES[nameCursor % PLANET_ROOT_NAMES.length];
      const suffixNum = ROMAN_NUMERALS[(orbit - 1) % ROMAN_NUMERALS.length];
      nameCursor++;
      const name = `${baseRoot} ${suffixNum}`;

      // Place planets in distinct well-spaced orbital angles around sector center (0,0,0)
      const angle = ((orbit * 2.18) + sector.id * 0.77 + rngFloat(rng, -0.25, 0.25)) % (Math.PI * 2);
      const orbitDist = 115 + orbit * 58 + rngFloat(rng, -12, 16);
      const posX = Math.round(Math.cos(angle) * orbitDist * 10) / 10;
      const posZ = Math.round(Math.sin(angle) * orbitDist * 10) / 10;
      const posY = Math.round(rngFloat(rng, -6, 6) * 10) / 10;

      const radius =
        def.mainClass === 'GAS_ICE_GIANT'
          ? rngInt(rng, 30, 38)
          : rngInt(rng, 20, 29);

      const textureSeed = sector.id * 1000 + orbit * 97 + rngInt(rng, 1, 89);

      results.push({
        id: `planet_sec${sector.id}_orb${orbit}`,
        sectorId: sector.id,
        name,
        mainClass: def.mainClass,
        subtype: def.subtype,
        radius,
        posX,
        posY,
        posZ,
        textureSeed,
        orbitIndex: orbit,
        atmosphereColor: def.palette.atmosphere,
        atmosphereDensity: def.atmosphereDensity,
        surfaceTempK: def.surfaceTempK + rngInt(rng, -14, 14),
        hazardClass: def.hazardClass,
        habitabilityRating: Math.max(0, Math.min(100, def.habitabilityRating + rngInt(rng, -5, 5))),
        hazardThermalLevel: def.hazardLevels.thermal,
        hazardIonLevel: def.hazardLevels.ion,
        hazardCausticLevel: def.hazardLevels.caustic,
        abundanceRating: def.abundanceRating,
        tectonicsRating: def.tectonicsRating,
        atmosphereRating: def.atmosphereRating,
        densityRating: def.densityRating,
        controllingFaction: sector.controllingFaction || 'FACTION_SOL',
        palette: def.palette,
        description: def.description,
      });
    }
  }

  return results;
}


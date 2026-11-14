/**
 * Milestone 1.0: Pure Xenobiological Procedural Lifeform Engine
 * Generates deterministic, lazy-seeded alien species across 5 Kingdoms using
 * pure xenobiological syllables + scientific binomials (zero Earth animal words).
 * Physical body-plan scales & coverings are distilled from the design Animals & Plants tabs.
 */

import { createMulberry32, rngFloat, rngInt, rngPick } from './DeterministicPRNG';
import { getPlanetSubtypeDef, type PlanetMainClass } from './PlanetTaxonomyCatalog';

export type BiologicalKingdom =
  | 'XENO_FAUNA'
  | 'XENO_FLORA'
  | 'MYCO_COLONY'
  | 'LITHO_MORPH'
  | 'ELECTRO_PLASMOID';

export type BodyPlanType =
  | 'HEXAPOD_STALKER'
  | 'ARMORED_CRAWLER'
  | 'WINGED_GLIDER'
  | 'SINUOUS_DRIFTER'
  | 'RADIAL_POLYPOID'
  | 'EXOTHERMIC_POD'
  | 'SOLAR_FROND'
  | 'CRYSTAL_SHARD'
  | 'PLASMA_FILAMENT';

export type BodyCovering =
  | 'chitin'
  | 'scales'
  | 'plates'
  | 'spines'
  | 'membrane'
  | 'spores'
  | 'crystal-lattice'
  | 'bio-gel'
  | 'fronds'
  | 'carapace';

export type TrophicRole =
  | 'Autotroph'
  | 'Chemotroph'
  | 'Filter-Grazer'
  | 'Lithovore'
  | 'Ambush Predator'
  | 'Apex Hunter'
  | 'Void-Symbiote';

export interface ProceduralLifeform {
  speciesUid: string;
  speciesIndex: number;
  planetId: string;
  planetSubtype: string;
  commonName: string;       // Pure xenobiological syllables + ecological hyphen tag
  scientificName: string;   // Latin/xeno binomial
  kingdom: BiologicalKingdom;
  speciesClass: 'GRAZER' | 'CARNIVORE'; // Compatibility with Lander stun/aggro loop
  isApex: boolean;
  bodyPlan: BodyPlanType;
  covering: BodyCovering;
  sizeMeters: number;       // 0.4m - 14.0m (curated from 1.0-10.0 scale)
  locomotion: string;
  trophicRole: TrophicRole;
  adaptationTrait: string;
  behaviorSummary: string;
  primaryColor: string;
  accentColor: string;
  glowColor: string;
  baseHp: number;
  movementSpeed: number;
  aggroRange: number;
  attackDamage: number;
  bioUnitValue: number;
  creditValue: number;
  rarityTier: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC';
  description: string;
}

const GENUS_PREFIXES: readonly string[] = [
  'Vael', 'Kyr', 'Zeph', 'Thal', 'Onyx', 'Mirel', 'Xyl', 'Brax',
  'Cael', 'Nyr', 'Vor', 'Qir', 'Taur', 'Drak', 'Syr', 'Orin',
  'Kaen', 'Vex', 'Ulth', 'Zor', 'Pyrr', 'Cryo', 'Myk', 'Lith',
  'Nex', 'Aeth', 'Rha', 'Jor', 'Khor', 'Skar', 'Phyr', 'Nym',
  'Laz', 'Ech', 'Trik', 'Vorg', 'Hal', 'Ytt', 'Xen', 'Gyr',
  'Oph', 'Kael', 'Dros', 'Phor', 'Sel', 'Bhor', 'Cal', 'Arct',
];

const GENUS_LIGATURES: readonly string[] = [
  "'", 'o', 'a', 'i', 'e', 'u', 'ar', 'il', 'or', 'an', 'yn', 'ax',
];

const GENUS_ROOTS: readonly string[] = [
  'rix', 'vor', 'lith', 'nath', 'dris', 'phyte', 'zoan', 'morf',
  'cene', 'ther', 'poda', 'gast', 'myx', 'vex', 'kara', 'thid',
  'plex', 'lume', 'spire', 'kor', 'zoid', 'crin', 'phora', 'nema',
];

const BIOME_EPITHETS: Record<PlanetMainClass, readonly string[]> = {
  LIVING_BIOSPHERE: ['Canopy', 'Sylvan', 'Tropic', 'Verdant', 'Chloro'],
  HYDROSPHERE: ['Abyssal', 'Pelagic', 'Bathyal', 'Benthic', 'Nautic'],
  CAUSTIC_SOLVENT: ['Vitriol', 'Halide', 'Caustic', 'Sulfate', 'Brine'],
  CRYO_GLACIAL: ['Cryo', 'Rime', 'Glacial', 'Boreal', 'Tholin'],
  PYRO_TECTONIC: ['Pyro', 'Magma', 'Igneous', 'Basalt', 'Caldera'],
  METALLIC_ORE: ['Ferric', 'Auric', 'Cupric', 'Slag', 'Alloy'],
  CRYSTALLINE_GEM: ['Prism', 'Quartz', 'Facet', 'Corundum', 'Vitreous'],
  SILICATE_DESERT: ['Regolith', 'Oolitic', 'Dune', 'Telluric', 'Arid'],
  RARE_EARTH: ['Lanthan', 'Yttric', 'Monazite', 'Carbide', 'Cerian'],
  RADIOLOGIC_ISOTOPIC: ['Isotope', 'Radiant', 'Fission', 'Aurora', 'Gamma'],
  MAGNETOSPHERIC: ['Dynamo', 'Flux', 'Lode', 'Torsion', 'Umbral'],
  GAS_ICE_GIANT: ['Jovian', 'Aether', 'Strat', 'Vortex', 'Cyclonic'],
  FUNGAL_MYCELIAL: ['Myco', 'Hyphal', 'Spore', 'Neural', 'Chitin'],
  SYNTHETIC_CYBERNETIC: ['Nano', 'Circuit', 'Lattice', 'Positric', 'Ferro'],
  PRECURSOR_ANOMALOUS: ['Tachyon', 'Xenolith', 'Phase', 'Harmonic', 'Void'],
};

const ROLE_DESCRIPTORS: Record<TrophicRole, readonly string[]> = {
  Autotroph: ['Radiophore', 'Heliobloom', 'Photosynth', 'Canopy-Pod', 'Solar-Bulb'],
  Chemotroph: ['Chemosynth', 'Vent-Siphon', 'Brine-Bulb', 'Exotherm', 'Sludge-Frond'],
  'Filter-Grazer': ['Skimmer', 'Strider', 'Filterer', 'Sifter', 'Drifter'],
  Lithovore: ['Lithovore', 'Ore-Borer', 'Silicate-Grazer', 'Crystovore', 'Basalt-Chewer'],
  'Ambush Predator': ['Stalker', 'Lancer', 'Pouncer', 'Maw-Lurker', 'Venom-Dart'],
  'Apex Hunter': ['Ravager', 'Leviathan', 'Apex-Rend', 'Titan-Maw', 'Sovereign'],
  'Void-Symbiote': ['Symbiote', 'Phase-Weft', 'Resonator', 'Spark-Leech', 'Flux-Mite'],
};

const KINGDOM_CONFIGS: Record<
  BiologicalKingdom,
  {
    bodyPlans: readonly BodyPlanType[];
    coverings: readonly BodyCovering[];
    locomotions: readonly string[];
    binomialPrefix: readonly string[];
  }
> = {
  XENO_FAUNA: {
    bodyPlans: ['HEXAPOD_STALKER', 'ARMORED_CRAWLER', 'WINGED_GLIDER', 'SINUOUS_DRIFTER'],
    coverings: ['chitin', 'scales', 'plates', 'spines', 'carapace'],
    locomotions: ['Hexapod Gait', 'Segmented Crawl', 'Membrane Glide', 'Sub-Regolith Burrow', 'Bipedal Bound'],
    binomialPrefix: ['Xenopoda', 'Carapaxa', 'Theriomorph', 'Velocirostra', 'Chitinognath'],
  },
  XENO_FLORA: {
    bodyPlans: ['EXOTHERMIC_POD', 'SOLAR_FROND', 'RADIAL_POLYPOID'],
    coverings: ['fronds', 'membrane', 'spines', 'bio-gel'],
    locomotions: ['Sessile Root-Anchor', 'Creeping Stolon', 'Thermal Bulb-Pulse'],
    binomialPrefix: ['Pyrocarp', 'Heliophyton', 'Cryobulba', 'Selenocarp', 'Floravex'],
  },
  MYCO_COLONY: {
    bodyPlans: ['RADIAL_POLYPOID', 'SINUOUS_DRIFTER', 'SOLAR_FROND'],
    coverings: ['spores', 'bio-gel', 'chitin', 'membrane'],
    locomotions: ['Pneumatic Spore-Drift', 'Mycelial Creep', 'Pulsing Sac-Jet'],
    binomialPrefix: ['Myconema', 'Sporoceph', 'Hyphalux', 'Chitinomyx', 'Symbiopore'],
  },
  LITHO_MORPH: {
    bodyPlans: ['CRYSTAL_SHARD', 'ARMORED_CRAWLER', 'RADIAL_POLYPOID'],
    coverings: ['crystal-lattice', 'plates', 'carapace'],
    locomotions: ['Piezoelectric Slide', 'Tectonic Roll', 'Slow Crystal Accretion'],
    binomialPrefix: ['Lithospora', 'Crystallozoa', 'Silicavore', 'Magnetolith', 'Corundomorpha'],
  },
  ELECTRO_PLASMOID: {
    bodyPlans: ['PLASMA_FILAMENT', 'SINUOUS_DRIFTER', 'WINGED_GLIDER'],
    coverings: ['membrane', 'bio-gel', 'crystal-lattice'],
    locomotions: ['Magnetospheric Drift', 'Ion-Jet Propulsion', 'Eddy-Current Surf'],
    binomialPrefix: ['Electrophora', 'Plasmazoa', 'Fluxonema', 'Tachyozoan', 'Ionovortex'],
  },
};

const ADAPTATION_TRAITS: readonly string[] = [
  'Thermal Carapace Insulation',
  'Bioluminescent Lure Nodes',
  'Caustic Hemolymph Secretion',
  'Piezoelectric Static Discharge',
  'Sub-Harmonic Echo Location',
  'Phase-Refractive Camouflage',
  'Cryo-Glycol Antifreeze Sap',
  'Aerosol Neuro-Spore Cloud',
  'Heavy-Metal Bone Lattice',
  'Ionized Gas-Bladder Buoyancy',
  'Exothermic Vent-Seed Burst',
  'Magnetite Compass Ganglia',
];

const RARITY_TIERS: ReadonlyArray<{ tier: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC'; weight: number; mult: number }> = [
  { tier: 'COMMON', weight: 45, mult: 1.0 },
  { tier: 'UNCOMMON', weight: 30, mult: 1.35 },
  { tier: 'RARE', weight: 18, mult: 1.9 },
  { tier: 'EXOTIC', weight: 7, mult: 2.8 },
];

const PLANET_KINGDOM_BIAS: Record<PlanetMainClass, readonly BiologicalKingdom[]> = {
  LIVING_BIOSPHERE: ['XENO_FAUNA', 'XENO_FAUNA', 'XENO_FLORA', 'MYCO_COLONY'],
  HYDROSPHERE: ['XENO_FAUNA', 'MYCO_COLONY', 'XENO_FLORA', 'ELECTRO_PLASMOID'],
  CAUSTIC_SOLVENT: ['MYCO_COLONY', 'LITHO_MORPH', 'XENO_FLORA', 'XENO_FAUNA'],
  CRYO_GLACIAL: ['XENO_FAUNA', 'XENO_FLORA', 'LITHO_MORPH', 'MYCO_COLONY'],
  PYRO_TECTONIC: ['LITHO_MORPH', 'XENO_FLORA', 'XENO_FAUNA', 'ELECTRO_PLASMOID'],
  METALLIC_ORE: ['LITHO_MORPH', 'LITHO_MORPH', 'XENO_FAUNA', 'ELECTRO_PLASMOID'],
  CRYSTALLINE_GEM: ['LITHO_MORPH', 'LITHO_MORPH', 'ELECTRO_PLASMOID', 'XENO_FLORA'],
  SILICATE_DESERT: ['XENO_FAUNA', 'LITHO_MORPH', 'XENO_FLORA'],
  RARE_EARTH: ['LITHO_MORPH', 'ELECTRO_PLASMOID', 'XENO_FAUNA'],
  RADIOLOGIC_ISOTOPIC: ['ELECTRO_PLASMOID', 'XENO_FLORA', 'MYCO_COLONY', 'LITHO_MORPH'],
  MAGNETOSPHERIC: ['ELECTRO_PLASMOID', 'LITHO_MORPH', 'XENO_FAUNA'],
  GAS_ICE_GIANT: ['ELECTRO_PLASMOID', 'MYCO_COLONY', 'XENO_FAUNA'],
  FUNGAL_MYCELIAL: ['MYCO_COLONY', 'MYCO_COLONY', 'XENO_FAUNA', 'XENO_FLORA'],
  SYNTHETIC_CYBERNETIC: ['LITHO_MORPH', 'ELECTRO_PLASMOID', 'XENO_FAUNA'],
  PRECURSOR_ANOMALOUS: ['ELECTRO_PLASMOID', 'LITHO_MORPH', 'MYCO_COLONY', 'XENO_FAUNA'],
};

function synthesizeGenusWord(rng: () => number): string {
  const pre = rngPick(rng, GENUS_PREFIXES);
  const lig = rngPick(rng, GENUS_LIGATURES);
  const root = rngPick(rng, GENUS_ROOTS);
  const raw = `${pre}${lig}${root}`;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildScientificBinomial(rng: () => number, kingdom: BiologicalKingdom, genusWord: string): string {
  const cfg = KINGDOM_CONFIGS[kingdom];
  const latinGenus = rngPick(rng, cfg.binomialPrefix);
  const cleanSpeciesRoot = genusWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const ending = rng() < 0.5 ? 'ensis' : 'i';
  const speciesEpithet = cleanSpeciesRoot.slice(0, Math.min(8, cleanSpeciesRoot.length)) + ending;
  return `${latinGenus} ${speciesEpithet}`;
}

function pickWeightedRarity(rng: () => number): { tier: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC'; mult: number } {
  const roll = rng() * 100;
  let acc = 0;
  for (const item of RARITY_TIERS) {
    acc += item.weight;
    if (roll <= acc) return { tier: item.tier, mult: item.mult };
  }
  return { tier: 'COMMON', mult: 1.0 };
}

export interface PlanetEcosystemInput {
  id: string;
  name?: string;
  subtype?: string | null;
  archetype?: string;
  textureSeed?: number;
}

/**
 * Deterministically generates 4 to 8 unique xenobiological species for any planet.
 * Calling with the same planet seed/subtype always reproduces identical genotypes.
 */
export function generatePlanetEcosystem(planet: PlanetEcosystemInput): ProceduralLifeform[] {
  const def = getPlanetSubtypeDef(planet.subtype, planet.archetype);
  const seed = planet.textureSeed || 101;
  const masterRng = createMulberry32(`xeno_eco_${planet.id}_${seed}_${def.subtype}`);

  // Scale species richness by planet lifeMultiplier (4 on harsh worlds, 6-8 on lush worlds)
  const baseCount = Math.round(4 * def.lifeMultiplier + (masterRng() * 2));
  const speciesCount = Math.max(4, Math.min(8, baseCount));

  const kingdomPool = PLANET_KINGDOM_BIAS[def.mainClass] || ['XENO_FAUNA', 'XENO_FLORA', 'LITHO_MORPH'];
  const epithets = BIOME_EPITHETS[def.mainClass] || ['Xenic'];
  const list: ProceduralLifeform[] = [];
  const usedNames = new Set<string>();

  for (let idx = 0; idx < speciesCount; idx++) {
    const rng = createMulberry32(`xeno_sp_${planet.id}_${seed}_${def.subtype}_idx${idx}`);
    const nonFloraPool = kingdomPool.filter((k) => k !== 'XENO_FLORA');
    const kingdom: BiologicalKingdom = idx === 0
      ? 'XENO_FAUNA'
      : idx === 1 && def.lifeMultiplier >= 1.0
      ? 'XENO_FLORA'
      : idx === 2
      ? rngPick(rng, nonFloraPool.length > 0 ? nonFloraPool : (['XENO_FAUNA'] as readonly BiologicalKingdom[]))
      : rngPick(rng, kingdomPool);

    const kCfg = KINGDOM_CONFIGS[kingdom];
    const bodyPlan = rngPick(rng, kCfg.bodyPlans);
    const covering = rngPick(rng, kCfg.coverings);
    const locomotion = rngPick(rng, kCfg.locomotions);

    // Ensure every planet has at least 1 GRAZER (idx 0) and 1 CARNIVORE/Predator (idx 2)
    let trophicRole: TrophicRole;
    let speciesClass: 'GRAZER' | 'CARNIVORE';
    if (idx === 2) {
      trophicRole = rng() < 0.3 ? 'Apex Hunter' : 'Ambush Predator';
      speciesClass = 'CARNIVORE';
    } else if (kingdom === 'XENO_FLORA') {
      trophicRole = rng() < 0.5 ? 'Autotroph' : 'Chemotroph';
      speciesClass = 'GRAZER';
    } else if (idx === 0) {
      trophicRole = kingdom === 'LITHO_MORPH' ? 'Lithovore' : 'Filter-Grazer';
      speciesClass = 'GRAZER';
    } else {
      const roles: TrophicRole[] = ['Filter-Grazer', 'Lithovore', 'Ambush Predator', 'Void-Symbiote', 'Chemotroph'];
      trophicRole = rngPick(rng, roles);
      speciesClass = trophicRole === 'Ambush Predator' || trophicRole === 'Apex Hunter' ? 'CARNIVORE' : 'GRAZER';
    }

    let genusWord = synthesizeGenusWord(rng);
    const bioEpithet = rngPick(rng, epithets);
    const roleEpithet = rngPick(rng, ROLE_DESCRIPTORS[trophicRole]);
    let commonName = `${genusWord} ${bioEpithet}-${roleEpithet}`;
    let safety = 0;
    while (usedNames.has(commonName) && safety < 8) {
      genusWord = synthesizeGenusWord(rng);
      commonName = `${genusWord} ${bioEpithet}-${roleEpithet}`;
      safety++;
    }
    usedNames.add(commonName);

    const scientificName = buildScientificBinomial(rng, kingdom, genusWord);
    const rarity = pickWeightedRarity(rng);
    const sizeMeters = Math.round(rngFloat(rng, kingdom === 'XENO_FLORA' ? 0.6 : 0.9, trophicRole === 'Apex Hunter' ? 9.8 : 5.4) * 10) / 10;
    const trait = rngPick(rng, ADAPTATION_TRAITS);

    // Color synthesis blended between planet palette and contrasting organism hues
    const colorPool = [
      def.palette.accent,
      def.palette.glow,
      '#4ade80',
      '#38bdf8',
      '#f472b6',
      '#fbbf24',
      '#a855f7',
      '#fb7185',
      '#2dd4bf',
    ];
    const primaryColor = rngPick(rng, colorPool);
    const accentColor = def.palette.accent;
    const glowColor = def.palette.glow;

    const isSessile = kingdom === 'XENO_FLORA';
    const baseHp = isSessile ? rngInt(rng, 25, 45) : speciesClass === 'CARNIVORE' ? rngInt(rng, 58, 95) : rngInt(rng, 35, 60);
    const movementSpeed = isSessile ? 4.0 : speciesClass === 'CARNIVORE' ? rngInt(rng, 42, 62) : rngInt(rng, 24, 38);
    const aggroRange = speciesClass === 'CARNIVORE' ? rngInt(rng, 125, 175) : 0;
    const attackDamage = speciesClass === 'CARNIVORE' ? rngInt(rng, 14, 28) : 0;
    const hazardBonus = (def.hazardLevels.thermal + def.hazardLevels.ion + def.hazardLevels.caustic) * 3;
    const bioUnitValue = Math.round((10 + idx * 3 + hazardBonus) * rarity.mult);
    const creditValue = Math.round(bioUnitValue * 18 * rarity.mult);

    const behaviorSummary =
      isSessile
        ? `Exothermic flora cluster anchored via ${locomotion.toLowerCase()}; emits harvestable spores.`
        : speciesClass === 'CARNIVORE'
        ? `Territorial ${trophicRole.toLowerCase()} utilizing ${trait.toLowerCase()}.`
        : `Docile ${trophicRole.toLowerCase()} traversing ${def.subtype.toLowerCase()} terrain via ${locomotion.toLowerCase()}.`;

    list.push({
      speciesUid: `xeno_${planet.id}_s${seed}_${idx}`,
      speciesIndex: idx,
      planetId: planet.id,
      planetSubtype: def.subtype,
      commonName,
      scientificName,
      kingdom,
      speciesClass,
      isApex: false,
      bodyPlan,
      covering,
      sizeMeters,
      locomotion,
      trophicRole,
      adaptationTrait: trait,
      behaviorSummary,
      primaryColor,
      accentColor,
      glowColor,
      baseHp,
      movementSpeed,
      aggroRange,
      attackDamage,
      bioUnitValue,
      creditValue,
      rarityTier: rarity.tier,
      description: `${sizeMeters}m ${covering}-clad ${kingdom.replace('_', ' ').toLowerCase()} endemic to ${def.subtype} worlds; exhibits ${trait.toLowerCase()}.`,
    });
  }

  return list;
}


/**
 * Single-Source Canonical Faction Registry (Milestone 1.3)
 * Powers Diplomacy, cascades, 3D Hull Styles, Captain Encounters,
 * Module Affinities, UI Badges, and Starship Hull Doctrines across Client & Server.
 */

export type FactionId =
  | 'FACTION_SOL'
  | 'FACTION_HEGEMONY'
  | 'FACTION_PHORID'
  | 'FACTION_KRYLL'
  | 'FACTION_LITHOS'
  | 'FACTION_WARDENS'
  | 'FACTION_MINERS_GUILD'
  | 'FACTION_FREEBOOTERS';

export type PrefixFamily =
  | 'ANNIHILATION_ENERGY'
  | 'VELOCITY_TEMPORAL'
  | 'GRAVITIC_SPATIAL'
  | 'PSIONIC_EXOTIC'
  | 'NANO_BIOMORPHIC'
  | 'ELECTROMAGNETIC_FLUX'
  | 'QUANTUM_PRECISION';

export type CaptainPersonality =
  | 'STERN_WARDEN'
  | 'SPORE_MYSTIC'
  | 'GREEDY_BROKER'
  | 'MATHEMATICAL_AUDITOR'
  | 'FRONTIER_PIONEER'
  | 'ANCIENT_SENTINEL'
  | 'CORE_FOREMAN'
  | 'CORSAIR_RAIDER';

export interface FactionCascadeRule {
  targetFactionId: FactionId;
  multiplier: number;
}

export interface FactionPalette {
  primary: number;
  secondary: number;
  canopy: number;
  engineBulkhead: number;
  engineGlow: number;
  metal: number;
}

export interface FactionMaterialProps {
  roughness: number;
  metalness: number;
  emissiveIntensity: number;
}

export interface FactionStructuralProps {
  lengthMult: number;
  widthMult: number;
  heightMult: number;
  wingSpreadMult: number;
  wingSweep: number;
}

export interface FactionHullStyle {
  id: FactionId;
  displayName: string;
  factionTag: string;
  culturalSummary: string;
  shapeGrammar: 'MODULAR_INDUSTRIAL' | 'SEGMENTED_CHITIN' | 'CRYSTALLINE_FACET' | 'ANGULAR_OBSIDIAN';
  palette: FactionPalette;
  materials: FactionMaterialProps;
  structural: FactionStructuralProps;
}

export interface FactionCaptainTemplate {
  species: string;
  factionName: string;
  personality: CaptainPersonality;
  titles: string[];
  firstNames: string[];
  epithets: string[];
  vesselPrefixes: string[];
  vesselClasses: string[];
  greetings: {
    HIGH: string[];
    MID: string[];
    LOW: string[];
  };
  systemLoreLines: string[];
  rumorHooks: string[];
}

export interface FactionHullDoctrine {
  codePrefix: string;
  namePrefix: string;
  loreFlavor: string;
  armorMult: number;
  shieldMult: number;
  speedMult: number;
  turnRateMult: number;
  cargoMult: number;
  fuelMult: number;
  powerGridMult: number;
  cpuMult: number;
  firepowerMult: number;
  creditMult: number;
  slotBias: 'BALANCED' | 'HIGH' | 'MID' | 'LOW';
  minRepOffset: number;
}

export interface FactionRegistryEntry {
  id: FactionId;
  name: string;
  shortName: string;
  crestIcon: string;
  primaryColor: string;
  description: string;
  startingStanding: number;
  cascades: readonly FactionCascadeRule[];
  preferredPrefixFamilies: readonly PrefixFamily[];
  captain: FactionCaptainTemplate;
  hullStyle: FactionHullStyle;
  hullDoctrine: FactionHullDoctrine;
}

export const ALL_FACTION_IDS: readonly FactionId[] = [
  'FACTION_SOL',
  'FACTION_HEGEMONY',
  'FACTION_PHORID',
  'FACTION_KRYLL',
  'FACTION_LITHOS',
  'FACTION_WARDENS',
  'FACTION_MINERS_GUILD',
  'FACTION_FREEBOOTERS',
];

export const FACTION_REGISTRY: Record<FactionId, FactionRegistryEntry> = {
  FACTION_SOL: {
    id: 'FACTION_SOL',
    name: 'Sol-Perimeter Alliance',
    shortName: 'SOL ALLIANCE',
    crestIcon: '🚀',
    primaryColor: '#38bdf8',
    description: 'Frontier human coalition fighting for trade sovereignty and liberation from Hegemony tributes.',
    startingStanding: 35,
    cascades: [
      { targetFactionId: 'FACTION_HEGEMONY', multiplier: -0.7 },
      { targetFactionId: 'FACTION_PHORID', multiplier: 0.3 },
    ],
    preferredPrefixFamilies: ['VELOCITY_TEMPORAL', 'QUANTUM_PRECISION'],
    captain: {
      species: 'SOL',
      factionName: 'Sol-Perimeter Alliance',
      personality: 'FRONTIER_PIONEER',
      titles: ['Marshal', 'Rangers Captain', 'Perimeter Commander', 'Pathfinder'],
      firstNames: ['Elena', 'Marcus', 'Tarek', 'Soren', 'Kira', 'Jace', 'Nadia', 'Cole'],
      epithets: ['Vance', 'Reyes', 'Okafor', 'Lindqvist', 'Navarro', 'Kovac', 'Sterling', 'Solis'],
      vesselPrefixes: ['UNS', 'SOL', 'CSV'],
      vesselClasses: ['Frontier Cutter', 'Aegis Escort', 'Pathfinder Corvette', 'Sentinel Frigate'],
      greetings: {
        HIGH: [
          'Good to share a star lane with an Alliance friend in {sector}. Telemetry over {planet} ({subtype}) is clean—let us coordinate.',
          'Solid signal, Commander! Welcome to {sector}. Keep your scanners tuned near {planet}; we have frontier leads worth your hold.',
        ],
        MID: [
          'This is Sol-Perimeter patrol broadcasting from {sector}. State your flight plan near {planet} ({subtype}) and keep weapons safed.',
          'Unfamiliar transponder around {planet}. Under this {spectral} glare, we verify every independent hull before trading coordinates.',
        ],
        LOW: [
          'Sol patrol warning! Your standing puts you under embargo in {sector}. Post bond near {planet} or turn around immediately.',
          'Hostile flag detected under this {spectral} sun! Explain yourself over {planet} or eat rail-lance fire!',
        ],
      },
      systemLoreLines: [
        'We chart every gravity eddy in {sector}. {planet} ({subtype}) feeds relay beacons across the whole core sector.',
        'Long patrols under a {spectral} star burn dry fast—smart captains check fuel reserves before crossing {planet} orbit.',
      ],
      rumorHooks: [
        'A long-range beacon spotted an uncharted ore-rich world one jump out. Sol Navigation wants surface survey packets.',
        'Raider signatures keep ambushing supply barges near an adjacent trade lane. Clear them out and Sol quartermasters will reward you.',
      ],
    },
    hullStyle: {
      id: 'FACTION_SOL',
      displayName: 'Sol-Perimeter League',
      factionTag: 'TERRAN_REMNANT',
      culturalSummary: 'Pragmatic, battle-worn modular scrap-rigs built from industrial plasteel.',
      shapeGrammar: 'MODULAR_INDUSTRIAL',
      palette: {
        primary: 0x3a4454,
        secondary: 0x38bdf8,
        canopy: 0x0f172a,
        engineBulkhead: 0x1e293b,
        engineGlow: 0x38bdf8,
        metal: 0x64748b,
      },
      materials: { roughness: 0.6, metalness: 0.3, emissiveIntensity: 0.4 },
      structural: { lengthMult: 1.0, widthMult: 1.0, heightMult: 1.0, wingSpreadMult: 1.0, wingSweep: 0 },
    },
    hullDoctrine: {
      codePrefix: 'SOL',
      namePrefix: 'Sol',
      loreFlavor: 'Balanced frontier modular framing with dependable reactor headroom.',
      armorMult: 1.0,
      shieldMult: 1.0,
      speedMult: 1.02,
      turnRateMult: 1.02,
      cargoMult: 1.0,
      fuelMult: 1.05,
      powerGridMult: 1.02,
      cpuMult: 1.02,
      firepowerMult: 1.0,
      creditMult: 1.0,
      slotBias: 'BALANCED',
      minRepOffset: 0,
    },
  },

  FACTION_HEGEMONY: {
    id: 'FACTION_HEGEMONY',
    name: 'Vaelic Hegemony',
    shortName: 'VAELIC HEGEMONY',
    crestIcon: '🦅',
    primaryColor: '#ef4444',
    description: 'Authoritarian galactic empire demanding strict sector tariffs, mineral tithes, and absolute obedience.',
    startingStanding: -25,
    cascades: [
      { targetFactionId: 'FACTION_SOL', multiplier: -0.7 },
      { targetFactionId: 'FACTION_PHORID', multiplier: -0.4 },
    ],
    preferredPrefixFamilies: ['ANNIHILATION_ENERGY', 'GRAVITIC_SPATIAL'],
    captain: {
      species: 'VAELIC',
      factionName: 'Vaelic Hegemony',
      personality: 'STERN_WARDEN',
      titles: ['Warden-Executor', 'Legate', 'Tribune', 'Blockade Prefect'],
      firstNames: ['Vorash', 'Kaelith', 'Dravos', 'Malkor', 'Theron', 'Vexis', 'Sarkhan', 'Zorath'],
      epithets: ['of the Iron Writ', 'the Unyielding', 'Obsidian-Claw', 'Shield-Breaker', 'of Cohort IX', 'Star-Taxer'],
      vesselPrefixes: ['VHS', 'IMP', 'HGM'],
      vesselClasses: ['Interdictor Dreadnought', 'Obsidian Frigate', 'Tariff Cutter', 'Prefect Cruiser'],
      greetings: {
        HIGH: [
          'Imperial honors hold in {sector}. Your vessel is cleared over {planet} ({subtype}) by Hegemony decree—do not abuse that privilege.',
          'Rare to encounter a tributary whose ledgers balance. Proceed across {sector} under the {spectral} beacon.',
        ],
        MID: [
          'Halt, pilot. You cross Vaelic-monitored lanes near {planet} ({subtype}). Submit transit justification or remit tariff in {sector}.',
          'Under this {spectral} glare, our targeting optics track every weld on your hull. Speak swiftly near {planet}.',
        ],
        LOW: [
          'Trespasser! Your transponder carries Imperial arrest warrants in {sector}. Drop shields over {planet} and pay restitution or burn.',
          'Hostile insurgent logged! Defiant vessels near {planet} ({subtype}) become salvage targets!',
        ],
      },
      systemLoreLines: [
        '{planet} is cataloged as a {subtype} resource asset. Unauthorized landing triggers orbital defense protocols.',
        'Three Imperial cruisers swept {sector} under this {spectral} sun last cycle; order endures through vigilance.',
      ],
      rumorHooks: [
        'Imperial telemetry flagged an unverified orbital anomaly within two jumps. Bring back clean tactical scans and the Legate forgets old fines.',
        'Smuggler escorts have been skimming refined alloy lanes nearby. Break their formation and claim Hegemony amnesty.',
      ],
    },
    hullStyle: {
      id: 'FACTION_HEGEMONY',
      displayName: 'The Vaelic Hegemony',
      factionTag: 'HEGEMONY_ENFORCER',
      culturalSummary: 'Totalitarian biomechanical empire; brutalist obsidian spearheads enforcing quarantine.',
      shapeGrammar: 'ANGULAR_OBSIDIAN',
      palette: {
        primary: 0x111113,
        secondary: 0x3a3d40,
        canopy: 0x050507,
        engineBulkhead: 0x1f2124,
        engineGlow: 0xe63946,
        metal: 0x4a4d52,
      },
      materials: { roughness: 0.35, metalness: 0.65, emissiveIntensity: 0.9 },
      structural: { lengthMult: 1.25, widthMult: 0.95, heightMult: 0.9, wingSpreadMult: 1.1, wingSweep: -900 },
    },
    hullDoctrine: {
      codePrefix: 'VAELIC',
      namePrefix: 'Vaelic',
      loreFlavor: 'High-pressure obsidian armor and spinal weapon capacitance built for suppression.',
      armorMult: 1.18,
      shieldMult: 1.05,
      speedMult: 0.96,
      turnRateMult: 0.94,
      cargoMult: 0.88,
      fuelMult: 0.95,
      powerGridMult: 1.1,
      cpuMult: 1.02,
      firepowerMult: 1.16,
      creditMult: 1.15,
      slotBias: 'HIGH',
      minRepOffset: 5,
    },
  },

  FACTION_PHORID: {
    id: 'FACTION_PHORID',
    name: 'Phorid Sporeborn',
    shortName: 'PHORID SPOREBORN',
    crestIcon: '🍄',
    primaryColor: '#a855f7',
    description: 'Deep fungal collective consciousness seeking symbiotic ecological balance and ancient Precursor wisdom.',
    startingStanding: 15,
    cascades: [
      { targetFactionId: 'FACTION_HEGEMONY', multiplier: -0.5 },
      { targetFactionId: 'FACTION_SOL', multiplier: 0.2 },
    ],
    preferredPrefixFamilies: ['NANO_BIOMORPHIC', 'PSIONIC_EXOTIC'],
    captain: {
      species: 'PHORID',
      factionName: 'Phorid Sporeborn',
      personality: 'SPORE_MYSTIC',
      titles: ['Mycelial Cantor', 'Bloom Tender', 'Spore-Navigator', 'Symbiont Envoy'],
      firstNames: ['Lichen-Vex', 'Sporesong', 'Thallus', 'Mycelis', 'Gloe', 'Rhizoma', 'Vesper-Cap', 'Spora'],
      epithets: ['of the Deep Root', 'Halo-Weaver', 'Star-Germinant', 'Root-Speaker', 'Chitin-Song', 'Canopy-Drifter'],
      vesselPrefixes: ['PHR', 'MYC', 'BIO'],
      vesselClasses: ['Carapace Frigate', 'Spore Barge', 'Mycelial Corvette', 'Tendril Cruiser'],
      greetings: {
        HIGH: [
          'The mycelial chorus warms to your hull resonance in {sector}. Drift gently near {planet} ({subtype})—we trade bloom-secrets gladly.',
          'Harmonic greetings, traveler! Even under cold {spectral} radiance, {planet} recognizes stewards of living worlds.',
        ],
        MID: [
          'We taste ionized exhaust across {sector}. Pause beside {planet} ({subtype}) and let our tendrils verify your intent.',
          'The {spectral} star breathes softly over {planet}. State whether you harvest in greed or barter in balance.',
        ],
        LOW: [
          'Blight-bearer! Our spore clouds recoil from your transponder in {sector}. Tithe sanctuary fuel near {planet} or feel corrosive pods!',
          'Your wake fractures {planet} equilibrium! Retreat from this {spectral} cradle or feed the brood.',
        ],
      },
      systemLoreLines: [
        'Below lies {planet}, a {subtype} cradle. Listen closely and you will feel how this {spectral} sun feeds unseen ecosystems.',
        'Every ship leaves scars on {sector} ether; we mend the bloom whenever greedy miners tear through.',
      ],
      rumorHooks: [
        'Mycelial dreams whisper of an unexplored {subtype} Eden nearby with rare endemic life waiting to be cataloged without harm.',
        'A forgotten probe fractured near a spore-rich moon one jump out—recover its biosphere telemetry before Hegemony fire burns it.',
      ],
    },
    hullStyle: {
      id: 'FACTION_PHORID',
      displayName: 'The Phorid Exchange',
      factionTag: 'CHITIN_COMMERCE',
      culturalSummary: 'Hyper-capitalist mollusks; segmented ceramic chitin hulls with high surface clutter.',
      shapeGrammar: 'SEGMENTED_CHITIN',
      palette: {
        primary: 0xe8d8a6,
        secondary: 0x3a7d6e,
        canopy: 0x2b382d,
        engineBulkhead: 0x5a4a35,
        engineGlow: 0xff9f1c,
        metal: 0x8c7853,
      },
      materials: { roughness: 0.82, metalness: 0.12, emissiveIntensity: 0.6 },
      structural: { lengthMult: 0.9, widthMult: 1.25, heightMult: 1.2, wingSpreadMult: 1.35, wingSweep: -400 },
    },
    hullDoctrine: {
      codePrefix: 'PHORID',
      namePrefix: 'Phorid',
      loreFlavor: 'Regenerative chitin-composite hulls boasting cavernous deuterium bladders and high CPU.',
      armorMult: 1.08,
      shieldMult: 0.94,
      speedMult: 0.98,
      turnRateMult: 1.0,
      cargoMult: 1.08,
      fuelMult: 1.25,
      powerGridMult: 1.0,
      cpuMult: 1.15,
      firepowerMult: 1.0,
      creditMult: 1.05,
      slotBias: 'MID',
      minRepOffset: 0,
    },
  },

  FACTION_KRYLL: {
    id: 'FACTION_KRYLL',
    name: 'Kryll Free Cartel',
    shortName: 'KRYLL CARTEL',
    crestIcon: '🐀',
    primaryColor: '#f59e0b',
    description: 'Hyper-capitalist rodentoid scavenger clans trading illicit rumors, scrap alloys, and surplus hyperdrives.',
    startingStanding: 5,
    cascades: [],
    preferredPrefixFamilies: ['ELECTROMAGNETIC_FLUX', 'GRAVITIC_SPATIAL'],
    captain: {
      species: 'KRYLL',
      factionName: 'Kryll Free Cartel',
      personality: 'GREEDY_BROKER',
      titles: ['Scrap Baron', 'Fixer-Captain', 'Ledger Rat', 'Salvage Kingpin'],
      firstNames: ['Skrit', 'Zik', 'Razzik', 'Brix', 'Nibble', 'Vexel', 'Krak', 'Tink'],
      epithets: ['Eight-Claw', 'Wire-Tooth', 'Quick-Lock', 'Double-Cut', 'Brass-Ear', 'of Rust Row'],
      vesselPrefixes: ['KFC', 'SCR', 'RAT'],
      vesselClasses: ['Vulture Skiff', 'Junk-Rigged Gunboat', 'Tug Interceptor', 'Cutlass Hauler'],
      greetings: {
        HIGH: [
          'Heh-heh! Favorite customer enters {sector}! Forget the tax drones—what shiny scrap or dirty credits are we flipping over {planet} ({subtype}) today?',
          'My whiskers twitched when your transponder hit {spectral} range! Pull alongside near {planet}, friend—I saved the best off-book leads for you.',
        ],
        MID: [
          'Easy on the trigger, big-ship! Nobody shoots first around {planet} ({subtype}) unless nobody wants to get paid in {sector}. Talking costs zero credits.',
          'Scanning hold... hmm, decent plating! Under this {spectral} glare even a Kryll skiff can trade a rumor or siphon some fuel.',
        ],
        LOW: [
          'Chittering alarms! That is the hull that stiffed Cartel syndicates! Pay docking protection in {sector} RIGHT NOW or we strip your paint over {planet}!',
          'Bad credit, worse attitude! Empty half a hold of fuel around {planet} or my twin scatter-batteries open a salvage yard here!',
        ],
      },
      systemLoreLines: [
        'Word in {sector} is {planet} ({subtype}) spits up nasty storms—great for snapping freighter tow cables, bad for cheap shields.',
        'This {spectral} star blinds patrol scanners every twenty minutes. Best window for quiet wreck-pulling you will find all week!',
      ],
      rumorHooks: [
        'Psst! Freshly cracked derelict drifting quiet in a neighboring lane—plenty of chassis tech inside if you dodge the scavengers.',
        'One of our ex-partners skipped town with a Cartel strongbox. Pop his thruster array and keep half the custom hardware!',
      ],
    },
    hullStyle: {
      id: 'FACTION_KRYLL',
      displayName: 'Kryll Free Cartel',
      factionTag: 'CARTEL_SCAVENGER',
      culturalSummary: 'Agile rust-gold scavenger frames tuned for erratic burn vectors and overdriven thrusters.',
      shapeGrammar: 'MODULAR_INDUSTRIAL',
      palette: {
        primary: 0x78350f,
        secondary: 0xf59e0b,
        canopy: 0x1e293b,
        engineBulkhead: 0x451a03,
        engineGlow: 0xfbbf24,
        metal: 0x92400e,
      },
      materials: { roughness: 0.72, metalness: 0.45, emissiveIntensity: 0.65 },
      structural: { lengthMult: 0.94, widthMult: 1.05, heightMult: 0.9, wingSpreadMult: 1.18, wingSweep: -250 },
    },
    hullDoctrine: {
      codePrefix: 'KRYLL',
      namePrefix: 'Kryll',
      loreFlavor: 'Overclocked scavenger thrusters and agile maneuvering vanes at the cost of thin armor.',
      armorMult: 0.88,
      shieldMult: 0.94,
      speedMult: 1.18,
      turnRateMult: 1.18,
      cargoMult: 1.08,
      fuelMult: 1.06,
      powerGridMult: 0.95,
      cpuMult: 1.06,
      firepowerMult: 1.02,
      creditMult: 0.9,
      slotBias: 'MID',
      minRepOffset: -10,
    },
  },

  FACTION_LITHOS: {
    id: 'FACTION_LITHOS',
    name: 'The Lithos Axiom',
    shortName: 'LITHOS AXIOM',
    crestIcon: '💠',
    primaryColor: '#8ee3ef',
    description: 'Silicon-crystalline geometers who administer the Obsidian Smelter and guard Precursor ruins with mathematical detachment.',
    startingStanding: 0,
    cascades: [],
    preferredPrefixFamilies: ['QUANTUM_PRECISION', 'ELECTROMAGNETIC_FLUX'],
    captain: {
      species: 'LITHOS',
      factionName: 'The Lithos Axiom',
      personality: 'MATHEMATICAL_AUDITOR',
      titles: ['Arch-Geometer', 'Axiom Arbiter', 'Facet Surveyor', 'Lattice Warden'],
      firstNames: ['Kael-9', 'Prism-4', 'Hexa-12', 'Onyx-3', 'Vektor-7', 'Beryl-2', 'Silo-11', 'Quartz-6'],
      epithets: ['Orthogonal', 'Zero-Remainder', 'of the Fourth Lattice', 'Calibrated', 'Prime-Facet', 'Axiomatic'],
      vesselPrefixes: ['LAX', 'GEO', 'ARC'],
      vesselClasses: ['Prism Cruiser', 'Octahedral Sentinel', 'Lattice Corvette', 'Tessellation Bark'],
      greetings: {
        HIGH: [
          'Resonance verified, Ally-Variable. Your trajectory near {planet} ({subtype}) aligns with Axiom symmetry. Query our lattice in {sector}.',
          'Probability of constructive exchange in {sector}: 97.4%. Our crystalline patrol yields clear vector around {planet}.',
        ],
        MID: [
          'Transmission acknowledged. State vector and commercial intent near {planet} ({subtype}). {sector} remains under Axiom geometric watch.',
          'Solar flux from this {spectral} body requires constant calibration. Maintain non-hostile bearing beside {planet}.',
        ],
        LOW: [
          'Anomaly threshold exceeded. Your faction standing registers negative equilibrium. Remit compensatory tribute near {planet} or face harmonic dissolution.',
          'Discordant vessel detected in {sector}. Probability of peaceful transit without restitution: 3.1%.',
        ],
      },
      systemLoreLines: [
        'Geophysical audit of {planet} registers class {subtype}. Harmonic resonance under this {spectral} star deviates by 0.042 radians.',
        'Sector {sector} symmetry remains within acceptable tolerances. Precursor fractures remain sealed.',
      ],
      rumorHooks: [
        'Axiom triangulations isolate an unverified planetary anomaly nearby. Deploy a surface sensor beacon and transmit clean ratios for compensation.',
        'An unauthorized kinetic wreck perturbs local gravity calculations one jump away. Dismantle its hull mass and claim an Axiom module.',
      ],
    },
    hullStyle: {
      id: 'FACTION_LITHOS',
      displayName: 'The Lithos Axiom',
      factionTag: 'RESONANT_GEOMETER',
      culturalSummary: 'Silicon-crystalline beings; pristine faceted geometries seeking mathematical harmony.',
      shapeGrammar: 'CRYSTALLINE_FACET',
      palette: {
        primary: 0x2e1a47,
        secondary: 0x8ee3ef,
        canopy: 0x180b2a,
        engineBulkhead: 0x482868,
        engineGlow: 0xf72585,
        metal: 0x7b5e99,
      },
      materials: { roughness: 0.18, metalness: 0.85, emissiveIntensity: 0.8 },
      structural: { lengthMult: 1.15, widthMult: 0.85, heightMult: 0.85, wingSpreadMult: 0.9, wingSweep: 800 },
    },
    hullDoctrine: {
      codePrefix: 'LITHOS',
      namePrefix: 'Lithos',
      loreFlavor: 'Faceted silicate crystal bulkheads offering supreme armor, shield, and CPU precision.',
      armorMult: 1.22,
      shieldMult: 1.18,
      speedMult: 0.88,
      turnRateMult: 0.88,
      cargoMult: 1.0,
      fuelMult: 0.92,
      powerGridMult: 1.12,
      cpuMult: 1.14,
      firepowerMult: 1.05,
      creditMult: 1.18,
      slotBias: 'LOW',
      minRepOffset: 0,
    },
  },

  FACTION_WARDENS: {
    id: 'FACTION_WARDENS',
    name: 'Remnant Precursor Wardens',
    shortName: 'PRECURSOR WARDENS',
    crestIcon: '🔱',
    primaryColor: '#2dd4bf',
    description: 'Ancient cybernetic caretakers preserving Precursor monoliths, neutron vaults, and quasi-space rifts.',
    startingStanding: 0,
    cascades: [
      { targetFactionId: 'FACTION_FREEBOOTERS', multiplier: -0.5 },
      { targetFactionId: 'FACTION_LITHOS', multiplier: 0.35 },
    ],
    preferredPrefixFamilies: ['QUANTUM_PRECISION', 'PSIONIC_EXOTIC'],
    captain: {
      species: 'WARDENS',
      factionName: 'Remnant Precursor Wardens',
      personality: 'ANCIENT_SENTINEL',
      titles: ['Vault Sentinel', 'Chronicle Keeper', 'Echo Arbiter', 'Rift Custodian'],
      firstNames: ['Aethel-01', 'Chronon', 'Solon-V', 'Nyx-Relay', 'Khora', 'Vaelen-Prime', 'Orpheon', 'Zeta-9'],
      epithets: ['of the Sealed Vault', 'Threshold-Guard', 'Rift-Attuned', 'Precursor-Bound', 'Star-Custodian', 'Epoch-Watch'],
      vesselPrefixes: ['RPW', 'ANC', 'ARC'],
      vesselClasses: ['Monolith Sentinel', 'Aegis Reliquary', 'Null-Lattice Spear', 'Epoch Custodian'],
      greetings: {
        HIGH: [
          'Caretaker cipher accepted in {sector}. The vault harmonies around {planet} ({subtype}) recognize a worthy archivist.',
          'Long cycles pass beneath this {spectral} beacon. Pass {planet} freely—ancient systems remain aligned to your transponder.',
        ],
        MID: [
          'Precursor perimeter active in {sector}. Do not disturb buried pylons upon {planet} ({subtype}); state your transit purpose.',
          'Telemetry scanned under {spectral} radiation. Relic seekers are tolerated only so long as Vault seals remain intact.',
        ],
        LOW: [
          'Defilement alarm triggered in {sector}! Reliquary violators near {planet} ({subtype}) face immediate containment erasure!',
          'Unauthorized artifact interference! Remit restitution before {planet} orbital cannons lock your reactor!',
        ],
      },
      systemLoreLines: [
        '{planet} ({subtype}) sits atop sub-mantle Precursor waveguides older than Sol navigation itself.',
        'Neutron harmonics in {sector} fluctuate whenever corsairs probe nearby quasi-space fractures.',
      ],
      rumorHooks: [
        'Vault arrays detected an awakening Precursor resonance on a frontier moon nearby. Decipher its glyphs before Freebooters strip it.',
        'A dormant Warden courier drifted off-vector one jump away; recover its databanks and earn Vault commendation.',
      ],
    },
    hullStyle: {
      id: 'FACTION_WARDENS',
      displayName: 'Remnant Precursor Wardens',
      factionTag: 'ANCIENT_CUSTODIAN',
      culturalSummary: 'Sleek gilded-obsidian relic hulls channeling luminescent teal harmonic containment fields.',
      shapeGrammar: 'CRYSTALLINE_FACET',
      palette: {
        primary: 0x134e4a,
        secondary: 0x2dd4bf,
        canopy: 0x042f2e,
        engineBulkhead: 0x1e293b,
        engineGlow: 0x5eead4,
        metal: 0xfacc15,
      },
      materials: { roughness: 0.24, metalness: 0.78, emissiveIntensity: 0.85 },
      structural: { lengthMult: 1.18, widthMult: 0.92, heightMult: 0.88, wingSpreadMult: 1.05, wingSweep: 600 },
    },
    hullDoctrine: {
      codePrefix: 'WARDEN',
      namePrefix: 'Warden',
      loreFlavor: 'Precursor phase-shielding and pristine harmonic reactors prioritizing Shield, PG, and CPU.',
      armorMult: 0.96,
      shieldMult: 1.24,
      speedMult: 1.0,
      turnRateMult: 1.12,
      cargoMult: 0.9,
      fuelMult: 1.05,
      powerGridMult: 1.18,
      cpuMult: 1.18,
      firepowerMult: 1.1,
      creditMult: 1.22,
      slotBias: 'MID',
      minRepOffset: 5,
    },
  },

  FACTION_MINERS_GUILD: {
    id: 'FACTION_MINERS_GUILD',
    name: 'Deep-Core Miners Guild',
    shortName: 'MINERS GUILD',
    crestIcon: '⛏️',
    primaryColor: '#f97316',
    description: 'Heavy orbital union governing deep-core strip mining, industrial extractors, and high-tonnage logistics.',
    startingStanding: 10,
    cascades: [
      { targetFactionId: 'FACTION_FREEBOOTERS', multiplier: -0.6 },
      { targetFactionId: 'FACTION_SOL', multiplier: 0.25 },
    ],
    preferredPrefixFamilies: ['GRAVITIC_SPATIAL', 'VELOCITY_TEMPORAL'],
    captain: {
      species: 'MINERS_GUILD',
      factionName: 'Deep-Core Miners Guild',
      personality: 'CORE_FOREMAN',
      titles: ['Shift Foreman', 'Pit-Boss', 'Rig Superintendent', 'Union Hauler Captain'],
      firstNames: ['Braddock', 'Maren', 'Hector', 'Gretchen', 'Dax', 'Otis', 'Yara', 'Vorn'],
      epithets: ['Iron-Seam', 'Drill-Bit', 'Core-Cracker', 'Slag-Runner', 'Ten-Ton', 'of Rig 44'],
      vesselPrefixes: ['DCM', 'RIG', 'GLD'],
      vesselClasses: ['Core Extractor', 'Ore Barge', 'Foundry Tug', 'Heavy Rig Escort'],
      greetings: {
        HIGH: [
          'Union badge checks out, Chief! Plenty of hot magma seams around {planet} ({subtype}) in {sector}—pull in for clean haulage rates.',
          'Solid welding on your frame! Miners Guild rigs keep {sector} fed under this {spectral} furnace. Need fuel or ore leads?',
        ],
        MID: [
          'Watch your thruster wash near our tethers in {sector}! {planet} ({subtype}) crews run tight bore shifts. State your business.',
          'Deep-Core Guild hail. If you are prospecting under this {spectral} star, keep clear of active seismic charges over {planet}.',
        ],
        LOW: [
          'Scab vessel! Guild claims cover every asteroid belt in {sector}! Cough up claim fees near {planet} or meet mining lasers!',
          'You crossed a union picket line! Drop ore salvage around {planet} ({subtype}) before our industrial cutters open your hull!',
        ],
      },
      systemLoreLines: [
        'Gravity drills pulled forty kilotons out of {planet} ({subtype}) last quarter—tough crust, richer payout.',
        'Dust clouds around this {spectral} star coat sensors thick; Guild barges carry triple bulkheads for a reason.',
      ],
      rumorHooks: [
        'One of our unmanned core-probes hit a dense metallic vein two jumps out. Run a geological survey and claim a Guild finder bonus.',
        'Freebooter skiffs hit an ore convoy outside the belt. Crack their ambusher hulls and the Foundry credits your ledger.',
      ],
    },
    hullStyle: {
      id: 'FACTION_MINERS_GUILD',
      displayName: 'Deep-Core Miners Guild',
      factionTag: 'INDUSTRIAL_EXTRACTORS',
      culturalSummary: 'Hazard-orange utility hulls welded with reinforced ore-crushing prows and oversized tanks.',
      shapeGrammar: 'MODULAR_INDUSTRIAL',
      palette: {
        primary: 0x475569,
        secondary: 0xf97316,
        canopy: 0x0f172a,
        engineBulkhead: 0x334155,
        engineGlow: 0xfb923c,
        metal: 0x94a3b8,
      },
      materials: { roughness: 0.68, metalness: 0.42, emissiveIntensity: 0.55 },
      structural: { lengthMult: 0.96, widthMult: 1.24, heightMult: 1.18, wingSpreadMult: 1.12, wingSweep: 200 },
    },
    hullDoctrine: {
      codePrefix: 'MINERS',
      namePrefix: 'Guild',
      loreFlavor: 'Ultra-reinforced mining bulkheads boasting extreme Armor, Cargo Capacity, and Fuel endurance.',
      armorMult: 1.25,
      shieldMult: 0.92,
      speedMult: 0.86,
      turnRateMult: 0.85,
      cargoMult: 1.35,
      fuelMult: 1.22,
      powerGridMult: 1.06,
      cpuMult: 0.94,
      firepowerMult: 0.92,
      creditMult: 0.96,
      slotBias: 'LOW',
      minRepOffset: -5,
    },
  },

  FACTION_FREEBOOTERS: {
    id: 'FACTION_FREEBOOTERS',
    name: 'Freebooter Armada',
    shortName: 'FREEBOOTER ARMADA',
    crestIcon: '🏴‍☠️',
    primaryColor: '#fb7185',
    description: 'Lawless scrap-tech corsairs raiding frontier convoys with jury-rigged overdriven weapon batteries.',
    startingStanding: -15,
    cascades: [
      { targetFactionId: 'FACTION_MINERS_GUILD', multiplier: -0.6 },
      { targetFactionId: 'FACTION_SOL', multiplier: -0.4 },
      { targetFactionId: 'FACTION_KRYLL', multiplier: 0.3 },
    ],
    preferredPrefixFamilies: ['ANNIHILATION_ENERGY', 'VELOCITY_TEMPORAL'],
    captain: {
      species: 'FREEBOOTERS',
      factionName: 'Freebooter Armada',
      personality: 'CORSAIR_RAIDER',
      titles: ['Corsair Commodore', 'Reaver Captain', 'Black-Flag Skipper', 'Broadside Boss'],
      firstNames: ['Dante', 'Kestrel', 'Vane', 'Sable', 'Rook', 'Jax', 'Nyx', 'Garrick'],
      epithets: ['Void-Cut', 'Burn-And-Run', 'the Ironhook', 'Red-Wake', 'Nine-Scars', 'of Drift Zero'],
      vesselPrefixes: ['FBA', 'CRZ', 'BLK'],
      vesselClasses: ['Corsair Raider', 'Scrap Broadside Frigate', 'Reaver Gunship', 'Cutthroat Skiff'],
      greetings: {
        HIGH: [
          'Haha! Raise the crimson pennant in {sector}! Good to see a pirate-friendly hull cruising {planet} ({subtype})—want hot contraband tips?',
          'Armada recognizes bold captains! Under this {spectral} blaze, our gunboats cover your six around {planet}.',
        ],
        MID: [
          'Hold steady, spacer! These lanes off {planet} ({subtype}) pay Armada toll in {sector}. Sweeten the deal or keep your trigger finger cold.',
          'Nice shields you got gleaming in this {spectral} light. Talk fast near {planet}—our broadsides itch.',
        ],
        LOW: [
          'Fresh prize in {sector}! Cut engines over {planet} ({subtype}) and dump fuel NOW or our scrap cannons carve you into confetti!',
          'You crossed Freebooter waters with empty pockets and bad blood! Prepare to be boarded around {planet}!',
        ],
      },
      systemLoreLines: [
        'Gravity shadows behind {planet} ({subtype}) let raiders kill transponders and drift silent for days.',
        'Every Sol courier cutting through {sector} underestimates how hot a {spectral} ambush turns when our afterburners ignite.',
      ],
      rumorHooks: [
        'Fat Guild ore barge limped off-lane one jump from here with busted thrusters. Crack its escort and split the prize!',
        'Heard whispers of a high-yield stash buried near an uninhabited rock nearby—bring back clean coords for an Armada cut.',
      ],
    },
    hullStyle: {
      id: 'FACTION_FREEBOOTERS',
      displayName: 'Freebooter Armada',
      factionTag: 'SCRAP_CORSAIR',
      culturalSummary: 'Asymmetric crimson-plated interceptor and broadside hulls packed with extra gun mounts.',
      shapeGrammar: 'ANGULAR_OBSIDIAN',
      palette: {
        primary: 0x3f1d28,
        secondary: 0xfb7185,
        canopy: 0x090d16,
        engineBulkhead: 0x27272a,
        engineGlow: 0xf43f5e,
        metal: 0x71717a,
      },
      materials: { roughness: 0.45, metalness: 0.62, emissiveIntensity: 0.85 },
      structural: { lengthMult: 1.08, widthMult: 1.02, heightMult: 0.92, wingSpreadMult: 1.22, wingSweep: -650 },
    },
    hullDoctrine: {
      codePrefix: 'FREEBOOTER',
      namePrefix: 'Freebooter',
      loreFlavor: 'Jury-rigged corsair intercept frames delivering blistering Speed and raw Firepower.',
      armorMult: 0.9,
      shieldMult: 0.88,
      speedMult: 1.15,
      turnRateMult: 1.14,
      cargoMult: 1.05,
      fuelMult: 0.98,
      powerGridMult: 1.06,
      cpuMult: 0.96,
      firepowerMult: 1.22,
      creditMult: 0.92,
      slotBias: 'HIGH',
      minRepOffset: -10,
    },
  },
};

/**
 * Normalizes any faction string variant into one of the 8 canonical FactionIds.
 */
export function normalizeFactionId(raw?: string | null): FactionId {
  const upper = (raw || 'FACTION_SOL').toUpperCase();
  if (upper in FACTION_REGISTRY) return upper as FactionId;
  if (upper.includes('VAELIC') || upper.includes('HEGEMONY')) return 'FACTION_HEGEMONY';
  if (upper.includes('PHORID')) return 'FACTION_PHORID';
  if (upper.includes('KRYLL')) return 'FACTION_KRYLL';
  if (upper.includes('LITHOS')) return 'FACTION_LITHOS';
  if (upper.includes('WARDEN')) return 'FACTION_WARDENS';
  if (upper.includes('MINER')) return 'FACTION_MINERS_GUILD';
  if (upper.includes('FREEBOOTER')) return 'FACTION_FREEBOOTERS';
  return 'FACTION_SOL';
}

export function getFactionEntry(raw?: string | null): FactionRegistryEntry {
  return FACTION_REGISTRY[normalizeFactionId(raw)];
}


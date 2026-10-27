export interface FactionPalette {
  primary: number;        // Main hull plating
  secondary: number;      // Trim, fins, accent panels
  canopy: number;         // Cockpit / bridge / sensory array
  engineBulkhead: number; // Aft engine cowlings and structural frames
  engineGlow: number;     // Emissive plasma thrust output
  metal: number;          // Hardpoints, kinetic barrels, conduits
}

export interface FactionMaterialProps {
  roughness: number;
  metalness: number;
  emissiveIntensity: number;
}

export interface FactionStructuralProps {
  lengthMult: number;     // Longitudinal scaling
  widthMult: number;      // Transverse scaling
  heightMult: number;     // Vertical profile
  wingSpreadMult: number; // Wing / outrigger spread
  wingSweep: number;      // Additional forward or back sweep (in millispaces)
}

export interface FactionStyle {
  id: string;
  displayName: string;
  factionTag: string;
  culturalSummary: string;
  shapeGrammar: string;
  palette: FactionPalette;
  materials: FactionMaterialProps;
  structural: FactionStructuralProps;
}

export const FACTION_STYLES: Record<string, FactionStyle> = {
  FACTION_SOL: {
    id: 'FACTION_SOL',
    displayName: 'Sol-Perimeter League',
    factionTag: 'TERRAN_REMNANT',
    culturalSummary: 'Pragmatic, battle-worn modular scrap-rigs built from industrial plasteel.',
    shapeGrammar: 'MODULAR_INDUSTRIAL',
    palette: {
      primary: 0x3a4454,        // Industrial battleship grey
      secondary: 0x38bdf8,      // High-visibility cyan navigation trim
      canopy: 0x0f172a,         // Polarized flight canopy
      engineBulkhead: 0x1e293b, // Cast-iron engine housing
      engineGlow: 0x38bdf8,     // Standard ion-drive blue
      metal: 0x64748b,          // Titanium-tungsten plating
    },
    materials: {
      roughness: 0.6,
      metalness: 0.3,
      emissiveIntensity: 0.4,
    },
    structural: {
      lengthMult: 1.0,
      widthMult: 1.0,
      heightMult: 1.0,
      wingSpreadMult: 1.0,
      wingSweep: 0,
    },
  },

  FACTION_PHORID: {
    id: 'FACTION_PHORID',
    displayName: 'The Phorid Exchange',
    factionTag: 'CHITIN_COMMERCE',
    culturalSummary: 'Hyper-capitalist mollusks; segmented ceramic chitin hulls with high surface clutter.',
    shapeGrammar: 'SEGMENTED_CHITIN',
    palette: {
      primary: 0xe8d8a6,        // Pale chalky ceramic yellow / weathered bone
      secondary: 0x3a7d6e,      // Faded oxidized verdigris teal
      canopy: 0x2b382d,         // Murky compound sensory dome
      engineBulkhead: 0x5a4a35, // Hardened carapace bracket
      engineGlow: 0xff9f1c,     // Volatile chemical amber thruster flame
      metal: 0x8c7853,          // Raw brass and copper-shielded conduits
    },
    materials: {
      roughness: 0.82,          // Matte unpolished ceramic
      metalness: 0.12,          // Mostly non-metallic organic composite
      emissiveIntensity: 0.6,
    },
    structural: {
      lengthMult: 0.9,          // Stockier, heavier hull
      widthMult: 1.25,          // Broad cargo-carrying outriggers
      heightMult: 1.2,          // Bulky hunchbacked dorsal profile
      wingSpreadMult: 1.35,     // Wide sweeping cargo outriggers
      wingSweep: -400,          // Forward-angled grasping wings
    },
  },

  FACTION_LITHOS: {
    id: 'FACTION_LITHOS',
    displayName: 'The Lithos Axiom',
    factionTag: 'RESONANT_GEOMETER',
    culturalSummary: 'Silicon-crystalline beings; pristine faceted geometries seeking mathematical harmony.',
    shapeGrammar: 'CRYSTALLINE_FACET',
    palette: {
      primary: 0x2e1a47,        // Deep resonant amethyst purple
      secondary: 0x8ee3ef,      // Shimmering quartz cyan facet edges
      canopy: 0x180b2a,         // Monolithic crystalline core
      engineBulkhead: 0x482868, // Resonator housing ring
      engineGlow: 0xf72585,     // High-energy radiant magenta harmonic beam
      metal: 0x7b5e99,          // Superconducting prismatic alloy
    },
    materials: {
      roughness: 0.18,          // Mirror-like polished mineral crystal
      metalness: 0.85,          // High electro-crystalline reflection
      emissiveIntensity: 0.8,
    },
    structural: {
      lengthMult: 1.15,         // Elongated geometric dart
      widthMult: 0.85,          // Slender, mathematically precise
      heightMult: 0.85,         // Knife-edge faceted profile
      wingSpreadMult: 0.9,      // Compact crystalline stabilizing facets
      wingSweep: 800,           // Sharp rearward angle
    },
  },

  FACTION_VAELIC: {
    id: 'FACTION_VAELIC',
    displayName: 'The Vaelic Hegemony',
    factionTag: 'HEGEMONY_ENFORCER',
    culturalSummary: 'Totalitarian biomechanical empire; brutalist obsidian spearheads enforcing quarantine.',
    shapeGrammar: 'ANGULAR_OBSIDIAN',
    palette: {
      primary: 0x111113,        // Matte carbon obsidian slab
      secondary: 0x3a3d40,      // Cold gunmetal titanium bevels
      canopy: 0x050507,         // Armored sensor slits (zero glass)
      engineBulkhead: 0x1f2124, // Heavy reinforced containment block
      engineGlow: 0xe63946,     // Menacing blood-crimson plasma vent
      metal: 0x4a4d52,          // Dense kinetic penetrator alloy
    },
    materials: {
      roughness: 0.35,          // Semi-matte cold obsidian
      metalness: 0.65,          // Heavy armored metallic sheen
      emissiveIntensity: 0.9,
    },
    structural: {
      lengthMult: 1.25,         // Aggressive predatory spearhead
      widthMult: 0.95,          // Razor-sharp prow profile
      heightMult: 0.9,          // Low radar cross-section
      wingSpreadMult: 1.1,      // Forward-raked interdiction blades
      wingSweep: -900,          // Swept forward like a raptor
    },
  },
};

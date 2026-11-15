/**
 * Deterministic Galactic Mission & Multi-Step Story Chain Generator (Milestone 1.1)
 * Anchors contracts to real Sectors (1-60), Procedural Planets (45 subtypes),
 * Galactic Xenodex lifeforms, Derelict Wrecks, and Syndicate Targets.
 */

import { createMulberry32, rngInt, rngPick } from './DeterministicPRNG';
import { CanonicalFactionId, normalizeCanonicalFaction } from './FrontierCaptainGenerator';

export type MissionSourceType = 'BOARD' | 'CAPTAIN_RUMOR' | 'STORY_CHAIN';
export type MissionType =
  | 'XENOBIOLOGY_SURVEY'
  | 'PLANET_RECON'
  | 'WRECK_RECOVERY'
  | 'SYNDICATE_BOUNTY';

export type ModuleRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ModuleCategory = 'OFFENSE' | 'DEFENSE' | 'TRAVEL' | 'COMMERCE' | 'UTILITY_DRONE';
export type StoryBranchChoice = 'LOYAL_HANDOFF' | 'BLACK_MARKET_AUCTION';

export interface CandidatePlanetRow {
  id: string;
  sectorId: number;
  sectorName: string;
  controllingFaction: string;
  name: string;
  mainClass: string;
  subtype: string;
  habitabilityRating: number;
}

export interface CandidateSectorRow {
  id: number;
  name: string;
  controllingFaction: string;
  hazardLevel: number;
  spectralClass: string;
}

export interface GeneratedMissionSpec {
  sourceType: MissionSourceType;
  missionType: MissionType;
  issuerFactionId: CanonicalFactionId;
  giverName: string;
  title: string;
  briefing: string;
  targetSectorId: number;
  targetPlanetId: string | null;
  targetMetadata: Record<string, any>;
  progress: Record<string, any>;
  chainStage: number;
  chainTotalStages: number;
  isUrgent: boolean;
  urgentMinutes: number | null;
  boardExpiresMinutes: number;
  rewardCredits: number;
  rewardStanding: number;
  rewardModuleRarity: ModuleRarity | null;
  rewardModuleCategory: ModuleCategory | null;
}

const FACTION_GIVERS: Record<CanonicalFactionId, readonly string[]> = {
  FACTION_SOL: ['Sol Astrometry Directorate', 'Commander Elena Vance', 'Frontier Cartography Desk'],
  FACTION_HEGEMONY: ['Hegemony Sector Tribune', 'Legate Vorik', 'Imperial Pacification Office'],
  FACTION_PHORID: ['Chorus Xenobiology Circle', 'Myceliarch Syla', 'Sporeborne Archivist'],
  FACTION_KRYLL: ['Kryll Salvage Syndicate', 'Fixer-Baron Zik', 'Rust-Row Ledger Broker'],
  FACTION_LITHOS: ['Lithos Axiom Triangulator', 'Arch-Geometer Hexa-12', 'Obsidian Survey Council'],
  FACTION_WARDENS: ['Vault Sentinel Aethel-01', 'Chronicle Reliquary Arbiter', 'Precursor Echo Council'],
  FACTION_MINERS_GUILD: ['Deep-Core Union Dispatch', 'Shift Foreman Braddock', 'Foundry Rig Assay Desk'],
  FACTION_FREEBOOTERS: ['Cutthroat Cove Quartermaster', 'Corsair Commodore Vane', 'Black-Flag Contract Board'],
};

const FACTION_CATEGORY_AFFINITY: Record<CanonicalFactionId, readonly ModuleCategory[]> = {
  FACTION_SOL: ['TRAVEL', 'DEFENSE', 'UTILITY_DRONE'],
  FACTION_HEGEMONY: ['OFFENSE', 'DEFENSE'],
  FACTION_PHORID: ['UTILITY_DRONE', 'TRAVEL', 'DEFENSE'],
  FACTION_KRYLL: ['COMMERCE', 'UTILITY_DRONE', 'OFFENSE'],
  FACTION_LITHOS: ['DEFENSE', 'OFFENSE', 'TRAVEL'],
  FACTION_WARDENS: ['DEFENSE', 'TRAVEL', 'OFFENSE'],
  FACTION_MINERS_GUILD: ['COMMERCE', 'UTILITY_DRONE', 'DEFENSE'],
  FACTION_FREEBOOTERS: ['OFFENSE', 'TRAVEL', 'COMMERCE'],
};

const SYNDICATE_CALLSIGNS = [
  'Corsair Ravager Vex',
  'Black-Hull Marauder Krill',
  'Null-Flag Raider Solis',
  'Iron-Claw Cutthroat Brix',
  'Renegade Interdictor Kael',
  'Void-Slicer Scavenger Dray',
] as const;

const WRECK_CLASSES = [
  'Precursor Survey Sloop',
  'Hegemony Recon Corvette',
  'Kryll Vault Freighter',
  'Lithos Prism Probe',
  'Sol Deep-Range Frigate',
] as const;

const STORY_CHAIN_THEMES = [
  {
    code: 'SPORE_RESONANCE',
    titlePrefix: 'Echoes Beneath the Canopy',
    preferredFaction: 'FACTION_PHORID' as CanonicalFactionId,
    stages: ['PLANET_RECON', 'XENOBIOLOGY_SURVEY', 'WRECK_RECOVERY'] as MissionType[],
    stageTitles: [
      'Stage 1: Triangulate Sub-Surface Bio-Anomaly',
      'Stage 2: Sequence Dominant Endemic Genome',
      'Stage 3: Recover Crushed Survey Vault Core',
    ],
    rivalFaction: 'FACTION_KRYLL' as CanonicalFactionId,
  },
  {
    code: 'IRON_CIPHER',
    titlePrefix: 'The Broken Cipher Wing',
    preferredFaction: 'FACTION_HEGEMONY' as CanonicalFactionId,
    stages: ['WRECK_RECOVERY', 'SYNDICATE_BOUNTY', 'PLANET_RECON'] as MissionType[],
    stageTitles: [
      'Stage 1: Salvage Shattered Courier Derelict',
      'Stage 2: Eliminate Cipher Thief Gunship',
      'Stage 3: Lock Telemetry Relay on Target World',
    ],
    rivalFaction: 'FACTION_LITHOS' as CanonicalFactionId,
  },
  {
    code: 'AXIOM_HORIZON',
    titlePrefix: 'Equations of the Outer Rim',
    preferredFaction: 'FACTION_LITHOS' as CanonicalFactionId,
    stages: ['PLANET_RECON', 'WRECK_RECOVERY', 'SYNDICATE_BOUNTY'] as MissionType[],
    stageTitles: [
      'Stage 1: Plant Calibration Beacon on Frontier World',
      'Stage 2: Extract Fused Precursor Core Wreck',
      'Stage 3: Neutralize Intercepting Syndicate Claimer',
    ],
    rivalFaction: 'FACTION_HEGEMONY' as CanonicalFactionId,
  },
] as const;

const RARITY_ORDER: readonly ModuleRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

export function upgradeRarityTier(rarity: ModuleRarity | null, steps: number = 1): ModuleRarity {
  const startIdx = rarity ? Math.max(0, RARITY_ORDER.indexOf(rarity)) : 0;
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, startIdx + steps)];
}

function buildArchetypeMission(params: {
  rng: () => number;
  missionType: MissionType;
  sourceType: MissionSourceType;
  issuerFactionId: CanonicalFactionId;
  giverName?: string;
  boardSectorId: number;
  targetSector: CandidateSectorRow;
  targetPlanet: CandidatePlanetRow | null;
  chainStage: number;
  chainTotalStages: number;
  chainThemeCode?: string;
  customTitle?: string;
  isUrgent: boolean;
  rarityOverride?: ModuleRarity;
}): GeneratedMissionSpec {
  const {
    rng,
    missionType,
    sourceType,
    issuerFactionId,
    giverName,
    boardSectorId,
    targetSector,
    targetPlanet,
    chainStage,
    chainTotalStages,
    chainThemeCode,
    customTitle,
    isUrgent,
    rarityOverride,
  } = params;

  const giver = giverName || rngPick(rng, FACTION_GIVERS[issuerFactionId]);
  const distanceFactor = Math.max(1, Math.min(8, Math.ceil(Math.abs(targetSector.id - boardSectorId) / 6) + (targetSector.id >= 6 ? 1 : 0)));
  const hazardBonus = (targetSector.hazardLevel || 0) * 180;
  const stageScale = 1 + (chainStage - 1) * 0.45;
  const rumorScale = sourceType === 'CAPTAIN_RUMOR' ? 1.3 : 1.0;

  const rewardCredits = Math.round((750 + distanceFactor * 260 + hazardBonus + rngInt(rng, 80, 320)) * stageScale * rumorScale);
  const rewardStanding = (chainStage === chainTotalStages && chainTotalStages > 1 ? 12 : 6) + (sourceType === 'CAPTAIN_RUMOR' ? 3 : 0);

  let baseRarity: ModuleRarity = 'UNCOMMON';
  if (rarityOverride) {
    baseRarity = rarityOverride;
  } else if (chainTotalStages > 1 && chainStage === chainTotalStages) {
    baseRarity = rng() > 0.35 ? 'EPIC' : 'RARE';
  } else if (sourceType === 'CAPTAIN_RUMOR' || targetSector.id >= 20) {
    baseRarity = rng() > 0.45 ? 'RARE' : 'UNCOMMON';
  } else if (rng() > 0.72) {
    baseRarity = 'RARE';
  }

  const rewardModuleCategory = rngPick(rng, FACTION_CATEGORY_AFFINITY[issuerFactionId]);
  const urgentMinutes = isUrgent ? 15 + Math.min(12, distanceFactor * 2) : null;

  const planetLabel = targetPlanet ? `${targetPlanet.name} (${targetPlanet.subtype})` : `Sector ${targetSector.id} Survey Body`;

  if (missionType === 'XENOBIOLOGY_SURVEY') {
    const requiredSpecies = chainTotalStages > 1 ? 2 : rngInt(rng, 1, 2);
    return {
      sourceType,
      missionType,
      issuerFactionId,
      giverName: giver,
      title: customTitle || `Xenodex Specimen Sweep: ${targetPlanet?.name || targetSector.name}`,
      briefing: `Travel to ${targetSector.name} (Sector ${targetSector.id}) and perform a BIO sweep or surface fauna scan on ${planetLabel} to catalog at least ${requiredSpecies} endemic species into the Galactic Xenodex.`,
      targetSectorId: targetSector.id,
      targetPlanetId: targetPlanet?.id || null,
      targetMetadata: {
        targetSectorName: targetSector.name,
        targetPlanetName: targetPlanet?.name || `${targetSector.name} Prime`,
        targetPlanetSubtype: targetPlanet?.subtype || 'Living Biosphere',
        requiredSpeciesCount: requiredSpecies,
        chainThemeCode,
      },
      progress: {
        currentCount: 0,
        requiredCount: requiredSpecies,
        label: `0/${requiredSpecies} Species Indexed`,
      },
      chainStage,
      chainTotalStages,
      isUrgent,
      urgentMinutes,
      boardExpiresMinutes: 45,
      rewardCredits,
      rewardStanding,
      rewardModuleRarity: baseRarity,
      rewardModuleCategory,
    };
  }

  if (missionType === 'PLANET_RECON') {
    const mode = rng() > 0.45 ? 'BEACON' : 'FULL_SURVEY';
    return {
      sourceType,
      missionType,
      issuerFactionId,
      giverName: giver,
      title: customTitle || `${mode === 'BEACON' ? 'Atmospheric Beacon Drop' : 'Full Cartographic Survey'}: ${targetPlanet?.name || targetSector.name}`,
      briefing:
        mode === 'BEACON'
          ? `Chart ${targetSector.name} (Sector ${targetSector.id}) and launch an Atmospheric Surface Probe beacon onto ${planetLabel} (${targetPlanet?.mainClass || 'PLANETARY'}).`
          : `Reach 100% orbital survey completion across Minerals, Bio, and Anomalies on ${planetLabel} in ${targetSector.name} (Sector ${targetSector.id}).`,
      targetSectorId: targetSector.id,
      targetPlanetId: targetPlanet?.id || null,
      targetMetadata: {
        targetSectorName: targetSector.name,
        targetPlanetName: targetPlanet?.name || `${targetSector.name} Prime`,
        targetPlanetSubtype: targetPlanet?.subtype || 'Frontier World',
        reconMode: mode,
        chainThemeCode,
      },
      progress: {
        currentCount: 0,
        requiredCount: mode === 'BEACON' ? 1 : 100,
        label: mode === 'BEACON' ? '0/1 Beacon Deployed' : '0% Surveyed',
      },
      chainStage,
      chainTotalStages,
      isUrgent,
      urgentMinutes,
      boardExpiresMinutes: 45,
      rewardCredits,
      rewardStanding,
      rewardModuleRarity: baseRarity,
      rewardModuleCategory,
    };
  }

  if (missionType === 'WRECK_RECOVERY') {
    const wreckClass = rngPick(rng, WRECK_CLASSES);
    const wreckName = `${wreckClass} #${rngInt(rng, 104, 899)}`;
    return {
      sourceType,
      missionType,
      issuerFactionId,
      giverName: giver,
      title: customTitle || `Derelict Recovery: ${wreckName}`,
      briefing: `Transponder echoes locate ${wreckName} drifting in ${targetSector.name} (Sector ${targetSector.id}). Laser-mine its scrap core completely or tow and dismantle it at a Salvage Bay.`,
      targetSectorId: targetSector.id,
      targetPlanetId: null,
      targetMetadata: {
        targetSectorName: targetSector.name,
        wreckName,
        wreckClass,
        chainThemeCode,
      },
      progress: {
        currentCount: 0,
        requiredCount: 1,
        label: '0/1 Derelict Salvaged',
      },
      chainStage,
      chainTotalStages,
      isUrgent,
      urgentMinutes,
      boardExpiresMinutes: 45,
      rewardCredits,
      rewardStanding,
      rewardModuleRarity: baseRarity,
      rewardModuleCategory,
    };
  }

  // SYNDICATE_BOUNTY
  const targetCallsign = rngPick(rng, SYNDICATE_CALLSIGNS);
  return {
    sourceType,
    missionType: 'SYNDICATE_BOUNTY',
    issuerFactionId,
    giverName: giver,
    title: customTitle || `Bounty Warrant: ${targetCallsign}`,
    briefing: `Hostile raider ${targetCallsign} is preying on lanes inside ${targetSector.name} (Sector ${targetSector.id}). Enter tactical space and destroy the target vessel.`,
    targetSectorId: targetSector.id,
    targetPlanetId: null,
    targetMetadata: {
      targetSectorName: targetSector.name,
      targetCallsign,
      hullClass: targetSector.id >= 20 ? 'HEGEMONY_INTERCEPTOR' : 'PIRATE_RAIDER',
      chainThemeCode,
    },
    progress: {
      currentCount: 0,
      requiredCount: 1,
      label: `0/1 Target Destroyed`,
    },
    chainStage,
    chainTotalStages,
    isUrgent,
    urgentMinutes,
    boardExpiresMinutes: 45,
    rewardCredits: Math.round(rewardCredits * 1.15),
    rewardStanding: rewardStanding + 2,
    rewardModuleRarity: baseRarity,
    rewardModuleCategory,
  };
}

/**
 * Generates up to `count` varied board missions anchored to nearby/frontier sectors & real planets.
 */
export function generateStationBoardMissions(params: {
  seedKey: string;
  boardSectorId: number;
  boardFaction: string;
  candidateSectors: CandidateSectorRow[];
  candidatePlanets: CandidatePlanetRow[];
  count?: number;
}): GeneratedMissionSpec[] {
  const { seedKey, boardSectorId, boardFaction, candidateSectors, candidatePlanets, count = 5 } = params;
  const rng = createMulberry32(seedKey);

  const sectorPool = candidateSectors.length > 0
    ? candidateSectors
    : [{ id: boardSectorId, name: `Sector ${boardSectorId}`, controllingFaction: boardFaction, hazardLevel: 1, spectralClass: 'YELLOW_G' }];

  const archetypes: MissionType[] = ['XENOBIOLOGY_SURVEY', 'PLANET_RECON', 'WRECK_RECOVERY', 'SYNDICATE_BOUNTY'];
  const allFactions: CanonicalFactionId[] = ['FACTION_SOL', 'FACTION_HEGEMONY', 'FACTION_PHORID', 'FACTION_KRYLL', 'FACTION_LITHOS'];
  const localFaction = normalizeCanonicalFaction(boardFaction);

  const specs: GeneratedMissionSpec[] = [];
  for (let i = 0; i < count; i++) {
    const slotRng = createMulberry32(`${seedKey}_SLOT_${i}`);
    const isStoryStart = i === 0 && slotRng() > 0.25;
    const isUrgent = !isStoryStart && (i === 1 || slotRng() > 0.72);

    const targetSector = rngPick(slotRng, sectorPool);
    const matchingPlanets = candidatePlanets.filter((p) => p.sectorId === targetSector.id);
    const planetPool = matchingPlanets.length > 0 ? matchingPlanets : candidatePlanets;
    const bioPlanets = planetPool.filter((p) => p.habitabilityRating >= 3 || p.mainClass === 'LIVING_BIOSPHERE' || p.mainClass === 'FUNGAL_MYCELIAL');

    if (isStoryStart) {
      const theme = rngPick(slotRng, STORY_CHAIN_THEMES);
      const firstType = theme.stages[0];
      const chosenPlanet = firstType === 'XENOBIOLOGY_SURVEY' && bioPlanets.length > 0
        ? rngPick(slotRng, bioPlanets)
        : planetPool.length > 0
          ? rngPick(slotRng, planetPool)
          : null;

      specs.push(
        buildArchetypeMission({
          rng: slotRng,
          missionType: firstType,
          sourceType: 'STORY_CHAIN',
          issuerFactionId: i === 0 ? theme.preferredFaction : localFaction,
          boardSectorId,
          targetSector,
          targetPlanet: chosenPlanet,
          chainStage: 1,
          chainTotalStages: theme.stages.length,
          chainThemeCode: theme.code,
          customTitle: `[CHAIN 1/${theme.stages.length}] ${theme.titlePrefix}`,
          isUrgent: false,
          rarityOverride: 'UNCOMMON',
        })
      );
      continue;
    }

    const missionType = archetypes[i % archetypes.length];
    const issuerFactionId = i % 2 === 0 ? localFaction : rngPick(slotRng, allFactions);
    const chosenPlanet = missionType === 'XENOBIOLOGY_SURVEY' && bioPlanets.length > 0
      ? rngPick(slotRng, bioPlanets)
      : planetPool.length > 0
        ? rngPick(slotRng, planetPool)
        : null;

    specs.push(
      buildArchetypeMission({
        rng: slotRng,
        missionType,
        sourceType: 'BOARD',
        issuerFactionId,
        boardSectorId,
        targetSector,
        targetPlanet: chosenPlanet,
        chainStage: 1,
        chainTotalStages: 1,
        isUrgent,
      })
    );
  }

  return specs;
}

/**
 * Generates Stage k+1 of an active Story Chain when Stage k completes.
 */
export function generateNextStoryStage(params: {
  seedKey: string;
  boardSectorId: number;
  issuerFactionId: CanonicalFactionId;
  giverName: string;
  nextStage: number;
  totalStages: number;
  themeCode?: string;
  candidateSectors: CandidateSectorRow[];
  candidatePlanets: CandidatePlanetRow[];
}): GeneratedMissionSpec {
  const {
    seedKey,
    boardSectorId,
    issuerFactionId,
    giverName,
    nextStage,
    totalStages,
    themeCode,
    candidateSectors,
    candidatePlanets,
  } = params;
  const rng = createMulberry32(seedKey);
  const theme = STORY_CHAIN_THEMES.find((t) => t.code === themeCode) || STORY_CHAIN_THEMES[0];
  const stageIdx = Math.max(0, Math.min(theme.stages.length - 1, nextStage - 1));
  const missionType = theme.stages[stageIdx];

  const sector = candidateSectors.length > 0
    ? rngPick(rng, candidateSectors)
    : { id: boardSectorId, name: `Sector ${boardSectorId}`, controllingFaction: issuerFactionId, hazardLevel: 2, spectralClass: 'ORANGE_K' };
  const sectorPlanets = candidatePlanets.filter((p) => p.sectorId === sector.id);
  const planetPool = sectorPlanets.length > 0 ? sectorPlanets : candidatePlanets;
  const targetPlanet = planetPool.length > 0 ? rngPick(rng, planetPool) : null;

  return buildArchetypeMission({
    rng,
    missionType,
    sourceType: 'STORY_CHAIN',
    issuerFactionId,
    giverName,
    boardSectorId,
    targetSector: sector,
    targetPlanet,
    chainStage: nextStage,
    chainTotalStages: totalStages,
    chainThemeCode: theme.code,
    customTitle: `[CHAIN ${nextStage}/${totalStages}] ${theme.stageTitles[stageIdx] || theme.titlePrefix}`,
    isUrgent: false,
    rarityOverride: nextStage === totalStages ? 'EPIC' : 'RARE',
  });
}

/**
 * Generates a high-value Secret Rumor Contract offered mid-dialogue by a Frontier Captain.
 */
export function generateCaptainRumorMission(params: {
  seedKey: string;
  originSectorId: number;
  factionId: CanonicalFactionId;
  captainName: string;
  candidateSectors: CandidateSectorRow[];
  candidatePlanets: CandidatePlanetRow[];
}): GeneratedMissionSpec {
  const { seedKey, originSectorId, factionId, captainName, candidateSectors, candidatePlanets } = params;
  const rng = createMulberry32(seedKey);

  const sectorPool = candidateSectors.length > 0
    ? candidateSectors
    : [{ id: originSectorId, name: `Sector ${originSectorId}`, controllingFaction: factionId, hazardLevel: 2, spectralClass: 'BLUE_O' }];
  const targetSector = rngPick(rng, sectorPool);
  const sectorPlanets = candidatePlanets.filter((p) => p.sectorId === targetSector.id);
  const planetPool = sectorPlanets.length > 0 ? sectorPlanets : candidatePlanets;
  const targetPlanet = planetPool.length > 0 ? rngPick(rng, planetPool) : null;

  const factionPreferredTypes: Record<CanonicalFactionId, MissionType> = {
    FACTION_PHORID: 'XENOBIOLOGY_SURVEY',
    FACTION_LITHOS: 'PLANET_RECON',
    FACTION_KRYLL: 'WRECK_RECOVERY',
    FACTION_HEGEMONY: 'SYNDICATE_BOUNTY',
    FACTION_SOL: rng() > 0.5 ? 'PLANET_RECON' : 'WRECK_RECOVERY',
    FACTION_WARDENS: 'PLANET_RECON',
    FACTION_MINERS_GUILD: 'WRECK_RECOVERY',
    FACTION_FREEBOOTERS: 'SYNDICATE_BOUNTY',
  };

  const missionType = factionPreferredTypes[factionId];
  const isStoryChain = rng() > 0.65;
  const theme = rngPick(rng, STORY_CHAIN_THEMES);

  return buildArchetypeMission({
    rng,
    missionType: isStoryChain ? theme.stages[0] : missionType,
    sourceType: 'CAPTAIN_RUMOR',
    issuerFactionId: factionId,
    giverName: captainName,
    boardSectorId: originSectorId,
    targetSector,
    targetPlanet,
    chainStage: 1,
    chainTotalStages: isStoryChain ? 2 : 1,
    chainThemeCode: isStoryChain ? theme.code : undefined,
    customTitle: isStoryChain
      ? `[SECRET CHAIN 1/2] ${captainName}'s Rumor: ${theme.titlePrefix}`
      : `[SECRET RUMOR] ${captainName}'s Encrypted Lead`,
    isUrgent: false,
    rarityOverride: 'RARE',
  });
}

export function getStoryBranchMeta(themeCode?: string, issuerFactionId: CanonicalFactionId = 'FACTION_SOL'): {
  rivalFactionId: CanonicalFactionId;
  loyalLabel: string;
  rivalLabel: string;
} {
  const found = STORY_CHAIN_THEMES.find((t) => t.code === themeCode);
  const rivalFactionId = found && found.rivalFaction !== issuerFactionId ? found.rivalFaction : issuerFactionId === 'FACTION_KRYLL' ? 'FACTION_LITHOS' : 'FACTION_KRYLL';
  return {
    rivalFactionId,
    loyalLabel: `Deliver exclusively to ${issuerFactionId.replace('FACTION_', '')} Command (+Standing & Standard Payout)`,
    rivalLabel: `Auction decoded intel to ${rivalFactionId.replace('FACTION_', '')} Brokers (+65% Credits, -8 Issuer Standing, +10 Broker Standing)`,
  };
}


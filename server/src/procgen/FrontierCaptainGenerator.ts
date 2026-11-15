/**
 * Deterministic Procedural Frontier Alien Captain Generator (Milestone 1.1)
 * Synthesizes sector patrol commanders, multi-turn standing-reactive dialogue trees,
 * live barter trades, truce/bribe/bluff resolutions, and secret rumor mission hooks.
 */

import { createMulberry32, rngInt, rngPick } from './DeterministicPRNG';
import {
  ALL_FACTION_IDS,
  FACTION_REGISTRY,
  normalizeFactionId,
  type CaptainPersonality,
  type FactionId,
} from '../../../shared/FactionRegistry';

export type CanonicalFactionId = FactionId;
export type CaptainSpecies = string;
export type { CaptainPersonality };

export type StandingMood = 'FRIENDLY' | 'CURIOUS' | 'CAUTIOUS' | 'AGGRESSIVE';

export interface SectorAnchorPlanet {
  id: string;
  name: string;
  mainClass: string;
  subtype: string;
}

export interface SectorContextInput {
  sectorId: number;
  sectorName: string;
  controllingFaction: string;
  spectralClass: string;
  hazardLevel: number;
  planets: SectorAnchorPlanet[];
}

export interface CaptainDialogOption {
  id: string;
  label: string;
  actionType:
    | 'GOTO_NODE'
    | 'OFFER_RUMOR'
    | 'ACCEPT_RUMOR'
    | 'BARTER_FUEL'
    | 'BARTER_SALVAGE'
    | 'RECRUIT_SPECIALIST'
    | 'BRIBE_CREDITS'
    | 'BRIBE_FUEL'
    | 'BLUFF'
    | 'TRUCE_PACT'
    | 'ATTACK'
    | 'PEACEFUL_PASS'
    | 'CLOSE';
  nextNodeId?: string;
  costCredits?: number;
  costFuel?: number;
  standingDelta?: number;
  hintTag?: string;
}

export interface CaptainDialogNode {
  nodeId: string;
  text: string;
  mood: StandingMood;
  options: CaptainDialogOption[];
}

export interface ProceduralCaptainProfile {
  captainKey: string;
  slotIndex: number;
  sectorId: number;
  factionId: CanonicalFactionId;
  factionName: string;
  species: CaptainSpecies;
  personality: CaptainPersonality;
  name: string;
  title: string;
  vesselName: string;
  vesselClass: string;
  anchorPlanetName: string;
  anchorPlanetSubtype: string;
  spectralClass: string;
  bribeCredits: number;
  bribeFuel: number;
  barterFuelCostCredits: number;
  barterFuelGain: number;
  nodes: Record<string, CaptainDialogNode>;
}

interface FactionCaptainTemplate {
  species: CaptainSpecies;
  factionName: string;
  personality: CaptainPersonality;
  titles: readonly string[];
  firstNames: readonly string[];
  epithets: readonly string[];
  vesselPrefixes: readonly string[];
  vesselClasses: readonly string[];
  greetings: Record<'HIGH' | 'MID' | 'LOW', readonly string[]>;
  systemLoreLines: readonly string[];
  rumorHooks: readonly string[];
}

const FACTION_TEMPLATES: Record<CanonicalFactionId, FactionCaptainTemplate> = ALL_FACTION_IDS.reduce(
  (acc, fid) => {
    acc[fid] = FACTION_REGISTRY[fid].captain;
    return acc;
  },
  {} as Record<CanonicalFactionId, FactionCaptainTemplate>
);

/**
 * Normalizes any faction identifier variant into one of the 8 canonical factions.
 */
export function normalizeCanonicalFaction(rawFaction?: string | null): CanonicalFactionId {
  return normalizeFactionId(rawFaction);
}

function interpolateTemplate(
  raw: string,
  ctx: { sectorName: string; planetName: string; planetSubtype: string; spectral: string }
): string {
  return raw
    .replace(/\{sector\}/g, ctx.sectorName)
    .replace(/\{planet\}/g, ctx.planetName)
    .replace(/\{subtype\}/g, ctx.planetSubtype)
    .replace(/\{spectral\}/g, ctx.spectral.replace(/_/g, ' '));
}

function buildCaptainTree(params: {
  template: FactionCaptainTemplate;
  standing: number;
  sectorName: string;
  anchorPlanetName: string;
  anchorPlanetSubtype: string;
  spectralClass: string;
  bribeCredits: number;
  bribeFuel: number;
  barterFuelCostCredits: number;
  barterFuelGain: number;
  hasUnclaimedRumor: boolean;
  isInterception: boolean;
  rng: () => number;
}): Record<string, CaptainDialogNode> {
  const {
    template,
    standing,
    sectorName,
    anchorPlanetName,
    anchorPlanetSubtype,
    spectralClass,
    bribeCredits,
    bribeFuel,
    barterFuelCostCredits,
    barterFuelGain,
    hasUnclaimedRumor,
    isInterception,
    rng,
  } = params;

  const tierKey: 'HIGH' | 'MID' | 'LOW' = standing >= 20 ? 'HIGH' : standing <= -15 ? 'LOW' : 'MID';
  const greetingMood: StandingMood =
    tierKey === 'HIGH' ? 'FRIENDLY' : tierKey === 'LOW' ? 'AGGRESSIVE' : template.personality === 'SPORE_MYSTIC' ? 'CURIOUS' : 'CAUTIOUS';

  const ctx = {
    sectorName,
    planetName: anchorPlanetName,
    planetSubtype: anchorPlanetSubtype,
    spectral: spectralClass,
  };

  const greetingText = interpolateTemplate(rngPick(rng, template.greetings[tierKey]), ctx);
  const loreText = interpolateTemplate(rngPick(rng, template.systemLoreLines), ctx);
  const rumorText = interpolateTemplate(rngPick(rng, template.rumorHooks), ctx);

  const greetingOptions: CaptainDialogOption[] = [];

  if (tierKey === 'LOW' || isInterception) {
    greetingOptions.push({
      id: 'OPT_BRIBE_CR',
      label: `Remit Passage Toll (${bribeCredits} Cr)`,
      actionType: 'BRIBE_CREDITS',
      costCredits: bribeCredits,
      hintTag: 'SAFE PASS',
    });
    greetingOptions.push({
      id: 'OPT_BRIBE_FUEL',
      label: `Transfer Deuterium Tribute (${bribeFuel} Fuel)`,
      actionType: 'BRIBE_FUEL',
      costFuel: bribeFuel,
      hintTag: 'FUEL TOLL',
    });
    greetingOptions.push({
      id: 'OPT_BLUFF',
      label: '[Fleet Authority] Assert diplomatic immunity & demand stand-down',
      actionType: 'BLUFF',
      hintTag: 'CHANCE / FLEET',
    });
  }

  greetingOptions.push({
    id: 'OPT_ASK_SECTOR',
    label: `Request local telemetry on ${anchorPlanetName} & ${sectorName}`,
    actionType: 'GOTO_NODE',
    nextNodeId: 'SYSTEM_INTEL',
  });

  greetingOptions.push({
    id: 'OPT_ASK_BARTER',
    label: `Open field supply exchange (${barterFuelGain} Fuel for ${barterFuelCostCredits} Cr)`,
    actionType: 'GOTO_NODE',
    nextNodeId: 'BARTER',
    hintTag: 'TRADE',
  });

  if (hasUnclaimedRumor) {
    greetingOptions.push({
      id: 'OPT_ASK_RUMOR',
      label: 'Ask about off-ledger leads, wrecks, or anomalies nearby',
      actionType: 'OFFER_RUMOR',
      nextNodeId: 'RUMOR_PITCH',
      hintTag: 'SECRET RUMOR',
    });
  }

  if (tierKey === 'LOW') {
    greetingOptions.push({
      id: 'OPT_TRUCE',
      label: 'Negotiate temporary Sector Ceasefire Pact (350 Cr)',
      actionType: 'TRUCE_PACT',
      costCredits: 350,
      hintTag: 'CEASEFIRE',
    });
    greetingOptions.push({
      id: 'OPT_ATTACK',
      label: 'Cut comms and engage hostile patrol! ⚔️',
      actionType: 'ATTACK',
      hintTag: 'COMBAT',
    });
  } else {
    greetingOptions.push({
      id: 'OPT_PASS',
      label: isInterception ? 'Acknowledge clearance and resume hyperspace vector' : 'Clear channel & maintain orbit',
      actionType: isInterception ? 'PEACEFUL_PASS' : 'CLOSE',
    });
  }

  const nodes: Record<string, CaptainDialogNode> = {
    GREETING: {
      nodeId: 'GREETING',
      text: greetingText,
      mood: greetingMood,
      options: greetingOptions,
    },
    SYSTEM_INTEL: {
      nodeId: 'SYSTEM_INTEL',
      text: `${loreText} If your scanner array is calibrated, surveying ${anchorPlanetName} or charting nearby lanes will pay dividends.`,
      mood: tierKey === 'LOW' ? 'CAUTIOUS' : 'CURIOUS',
      options: [
        ...(hasUnclaimedRumor
          ? [
              {
                id: 'OPT_INTEL_TO_RUMOR',
                label: 'Anything unusual beyond standard charts? (Ask for Secret Rumor)',
                actionType: 'OFFER_RUMOR' as const,
                nextNodeId: 'RUMOR_PITCH',
                hintTag: 'SECRET RUMOR',
              },
            ]
          : []),
        {
          id: 'OPT_INTEL_BACK',
          label: 'Return to primary comms channel',
          actionType: 'GOTO_NODE',
          nextNodeId: 'GREETING',
        },
        {
          id: 'OPT_INTEL_CLOSE',
          label: isInterception ? 'Resume hyperspace course' : 'Close channel',
          actionType: isInterception ? 'PEACEFUL_PASS' : 'CLOSE',
        },
      ],
    },
    BARTER: {
      nodeId: 'BARTER',
      text: `Field reserves are tight out in ${sectorName}, but we can transfer ${barterFuelGain} units of pressurized deuterium fuel for ${barterFuelCostCredits} Cr—or buy refined hull scrap telemetry.`,
      mood: 'CURIOUS',
      options: [
        {
          id: 'OPT_DO_BARTER_FUEL',
          label: `Purchase ${barterFuelGain} Fuel (${barterFuelCostCredits} Cr)`,
          actionType: 'BARTER_FUEL',
          costCredits: barterFuelCostCredits,
          hintTag: `+${barterFuelGain} FUEL`,
        },
        {
          id: 'OPT_DO_BARTER_SALVAGE',
          label: 'Transmit spare navigational pings (+140 Cr, +2 Standing)',
          actionType: 'BARTER_SALVAGE',
          standingDelta: 2,
          hintTag: '+140 CR',
        },
        {
          id: 'OPT_RECRUIT_CREW',
          label: '🤝 Recruit Shipboard Specialist from their Crew',
          actionType: 'RECRUIT_SPECIALIST',
          hintTag: 'CREW HIRE',
        },
        {
          id: 'OPT_BARTER_BACK',
          label: 'Decline exchange and return',
          actionType: 'GOTO_NODE',
          nextNodeId: 'GREETING',
        },
      ],
    },
    RUMOR_PITCH: {
      nodeId: 'RUMOR_PITCH',
      text: `${rumorText} Take the encrypted coordinates on your mission log—complete the run and you keep the credits plus salvage hardware.`,
      mood: 'FRIENDLY',
      options: [
        {
          id: 'OPT_ACCEPT_RUMOR',
          label: '📜 Download encrypted coordinates & ACCEPT Secret Mission',
          actionType: 'ACCEPT_RUMOR',
          hintTag: 'ADD TO LOG',
        },
        {
          id: 'OPT_RUMOR_DECLINE',
          label: 'Hold coordinates for later and return',
          actionType: 'GOTO_NODE',
          nextNodeId: 'GREETING',
        },
      ],
    },
    RESOLVED_PEACEFUL: {
      nodeId: 'RESOLVED_PEACEFUL',
      text: `Vector logged, Captain. Safe burn across ${sectorName}.`,
      mood: 'FRIENDLY',
      options: [
        {
          id: 'OPT_END_CLOSE',
          label: 'End transmission',
          actionType: 'CLOSE',
        },
      ],
    },
  };

  return nodes;
}

/**
 * Generates deterministic sector patrol captains (1-2 per sector) anchored to the sector's faction,
 * star spectral class, and real local planets.
 */
export function generateSectorCaptains(
  ctx: SectorContextInput,
  standingResolver: (factionId: CanonicalFactionId) => number,
  claimedRumorKeys: Set<string> = new Set(),
  count?: number
): ProceduralCaptainProfile[] {
  const rng = createMulberry32(`CAPTAINS_SECTOR_${ctx.sectorId}`);
  const captainCount = count ?? (ctx.sectorId >= 6 ? (rng() > 0.42 ? 2 : 1) : 1);

  const primaryFaction = normalizeCanonicalFaction(ctx.controllingFaction);
  const secondaryPool: readonly CanonicalFactionId[] = ALL_FACTION_IDS;

  const results: ProceduralCaptainProfile[] = [];
  for (let slot = 0; slot < captainCount; slot++) {
    const slotRng = createMulberry32(`CAPTAIN_${ctx.sectorId}_SLOT_${slot}`);
    const factionId: CanonicalFactionId =
      slot === 0 ? primaryFaction : rngPick(slotRng, secondaryPool);
    const tpl = FACTION_TEMPLATES[factionId];

    const name = `${rngPick(slotRng, tpl.firstNames)} ${rngPick(slotRng, tpl.epithets)}`;
    const title = rngPick(slotRng, tpl.titles);
    const vesselName = `${rngPick(slotRng, tpl.vesselPrefixes)} ${rngPick(slotRng, ['Sovereign', 'Vanguard', 'Facet', 'Tendril', 'Vector', 'Strider', 'Lumen', 'Rift'])}-${rngInt(slotRng, 2, 19)}`;
    const vesselClass = rngPick(slotRng, tpl.vesselClasses);

    const anchorPlanet =
      ctx.planets.length > 0
        ? ctx.planets[slot % ctx.planets.length]
        : { id: 'PLANET_NONE', name: `${ctx.sectorName} Prime`, mainClass: 'METALLIC_ORE', subtype: 'Auric Lode' };

    const captainKey = `CAPTAIN_S${ctx.sectorId}_${slot}`;
    const standing = standingResolver(factionId);
    const bribeCredits = 160 + Math.min(450, ctx.sectorId * 8) + rngInt(slotRng, 0, 90);
    const bribeFuel = 12 + rngInt(slotRng, 3, 18);
    const barterFuelCostCredits = 140 + rngInt(slotRng, 0, 70);
    const barterFuelGain = 22 + rngInt(slotRng, 4, 16);

    const nodes = buildCaptainTree({
      template: tpl,
      standing,
      sectorName: ctx.sectorName,
      anchorPlanetName: anchorPlanet.name,
      anchorPlanetSubtype: anchorPlanet.subtype,
      spectralClass: ctx.spectralClass || 'YELLOW_G',
      bribeCredits,
      bribeFuel,
      barterFuelCostCredits,
      barterFuelGain,
      hasUnclaimedRumor: !claimedRumorKeys.has(captainKey),
      isInterception: false,
      rng: slotRng,
    });

    results.push({
      captainKey,
      slotIndex: slot,
      sectorId: ctx.sectorId,
      factionId,
      factionName: tpl.factionName,
      species: tpl.species,
      personality: tpl.personality,
      name,
      title,
      vesselName,
      vesselClass,
      anchorPlanetName: anchorPlanet.name,
      anchorPlanetSubtype: anchorPlanet.subtype,
      spectralClass: ctx.spectralClass || 'YELLOW_G',
      bribeCredits,
      bribeFuel,
      barterFuelCostCredits,
      barterFuelGain,
      nodes,
    });
  }

  return results;
}

/**
 * Generates an upgraded multi-turn Captain encounter for Hyperspace Interceptions.
 */
export function generateInterceptionCaptain(params: {
  blipId: string;
  factionId: string;
  sectorId?: number;
  sectorName?: string;
  standing: number;
}): ProceduralCaptainProfile {
  const canonical = normalizeCanonicalFaction(params.factionId);
  const tpl = FACTION_TEMPLATES[canonical];
  const rng = createMulberry32(`INTERCEPT_${params.blipId}_${canonical}`);

  const name = `${rngPick(rng, tpl.firstNames)} ${rngPick(rng, tpl.epithets)}`;
  const title = rngPick(rng, tpl.titles);
  const vesselName = `${rngPick(rng, tpl.vesselPrefixes)} ${rngPick(rng, ['Interceptor', 'Dagger', 'Lattice', 'Prowler', 'Spore'])}-${rngInt(rng, 10, 99)}`;
  const vesselClass = rngPick(rng, tpl.vesselClasses);

  const sectorName = params.sectorName || 'Deep Hyperspace Corridor';
  const anchorPlanetName = 'Subspace Beacon Relay';
  const anchorPlanetSubtype = 'Interstellar Rift';
  const bribeCredits = 220 + rngInt(rng, 30, 180);
  const bribeFuel = 18 + rngInt(rng, 4, 16);

  const nodes = buildCaptainTree({
    template: tpl,
    standing: params.standing,
    sectorName,
    anchorPlanetName,
    anchorPlanetSubtype,
    spectralClass: 'QUASISPACE_CORONA',
    bribeCredits,
    bribeFuel,
    barterFuelCostCredits: 190,
    barterFuelGain: 25,
    hasUnclaimedRumor: true,
    isInterception: true,
    rng,
  });

  return {
    captainKey: `INTERCEPT_${params.blipId}`,
    slotIndex: 0,
    sectorId: params.sectorId || 2,
    factionId: canonical,
    factionName: tpl.factionName,
    species: tpl.species,
    personality: tpl.personality,
    name,
    title,
    vesselName,
    vesselClass,
    anchorPlanetName,
    anchorPlanetSubtype,
    spectralClass: 'QUASISPACE_CORONA',
    bribeCredits,
    bribeFuel,
    barterFuelCostCredits: 190,
    barterFuelGain: 25,
    nodes,
  };
}


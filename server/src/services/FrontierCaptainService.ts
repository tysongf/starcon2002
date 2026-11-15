import { db } from '../db/Database';
import { reputationService } from './ReputationService';
import { GalacticMissionRecord, galacticMissionService } from './GalacticMissionService';
import {
  CanonicalFactionId,
  CaptainDialogOption,
  CaptainSpecies,
  ProceduralCaptainProfile,
  StandingMood,
  generateInterceptionCaptain,
  generateSectorCaptains,
  normalizeCanonicalFaction,
} from '../procgen/FrontierCaptainGenerator';

export interface CaptainContactSummary {
  captainKey: string;
  sectorId: number;
  factionId: CanonicalFactionId;
  factionName: string;
  species: CaptainSpecies;
  name: string;
  title: string;
  vesselName: string;
  vesselClass: string;
  mood: StandingMood;
  hasUnclaimedRumor: boolean;
}

export interface CaptainDialogStateResponse {
  captainKey: string;
  sectorId: number;
  factionId: CanonicalFactionId;
  factionName: string;
  species: CaptainSpecies;
  speakerName: string;
  title: string;
  vesselName: string;
  vesselClass: string;
  currentNodeId: string;
  mood: StandingMood;
  text: string;
  options: CaptainDialogOption[];
  rumorMission?: GalacticMissionRecord | null;
}

export interface CaptainResponseOutcome {
  success: boolean;
  actionTaken: string;
  closed: boolean;
  combatStarted: boolean;
  peacefulResolved: boolean;
  notification?: string;
  remainingCredits?: number;
  remainingFuel?: number;
  rumorMission?: GalacticMissionRecord | null;
  acceptedMission?: GalacticMissionRecord | null;
  dialog: CaptainDialogStateResponse;
  combatSetup?: {
    encounterId: string;
    factionId: string;
    enemySquadron: Array<{ type: string; hull: number; shield: number; weapons: string[] }>;
  };
}

export class FrontierCaptainService {
  private async loadSectorContext(sectorId: number) {
    const sRes = await db.query<any>(
      `SELECT id, name, controlling_faction, COALESCE(spectral_class, 'YELLOW_G') as spectral_class, COALESCE(hazard_level, 0) as hazard_level
       FROM sectors WHERE id = $1`,
      [sectorId]
    );
    const sRow = sRes.rows[0] || {
      id: sectorId,
      name: `Frontier Sector ${sectorId}`,
      controlling_faction: 'FACTION_SOL',
      spectral_class: 'YELLOW_G',
      hazard_level: 1,
    };

    const pRes = await db.query<any>(
      'SELECT id, name, main_class, subtype FROM planets WHERE sector_id = $1 ORDER BY orbit_index ASC',
      [sectorId]
    );

    return {
      sectorId: Number(sRow.id),
      sectorName: sRow.name,
      controllingFaction: sRow.controlling_faction,
      spectralClass: sRow.spectral_class,
      hazardLevel: Number(sRow.hazard_level || 0),
      planets: pRes.rows.map((p) => ({
        id: p.id,
        name: p.name,
        mainClass: p.main_class,
        subtype: p.subtype,
      })),
    };
  }

  private async getStandingMap(accountId: string): Promise<Map<CanonicalFactionId, number>> {
    const standings = await reputationService.getStandings(accountId);
    const map = new Map<CanonicalFactionId, number>();
    for (const s of standings) {
      map.set(normalizeCanonicalFaction(s.factionId), Number(s.standing || 0));
    }
    return map;
  }

  private async getClaimedRumorKeys(accountId: string, sectorId: number): Promise<Set<string>> {
    const res = await db.query<{ captain_key: string; status: string }>(
      `SELECT e.captain_key, m.status
       FROM frontier_captain_encounters e
       JOIN galactic_missions m ON m.id = e.rumor_mission_id
       WHERE e.account_id = $1 AND e.sector_id = $2 AND m.status != 'OFFERED'`,
      [accountId, sectorId]
    );
    return new Set(res.rows.map((r) => r.captain_key));
  }

  public async getSectorCaptains(
    accountId: string = 'acc_sol_captain',
    sectorId: number
  ): Promise<CaptainContactSummary[]> {
    const ctx = await this.loadSectorContext(sectorId);
    const standingMap = await this.getStandingMap(accountId);
    const claimedRumorKeys = await this.getClaimedRumorKeys(accountId, sectorId);

    const profiles = generateSectorCaptains(
      ctx,
      (fid) => standingMap.get(fid) ?? 0,
      claimedRumorKeys
    );

    return profiles.map((p) => ({
      captainKey: p.captainKey,
      sectorId: p.sectorId,
      factionId: p.factionId,
      factionName: p.factionName,
      species: p.species,
      name: p.name,
      title: p.title,
      vesselName: p.vesselName,
      vesselClass: p.vesselClass,
      mood: p.nodes.GREETING.mood,
      hasUnclaimedRumor: !claimedRumorKeys.has(p.captainKey),
    }));
  }

  private async resolveProfile(
    accountId: string,
    captainKey: string,
    sectorId: number
  ): Promise<ProceduralCaptainProfile> {
    if (captainKey.startsWith('INTERCEPT_')) {
      const standingMap = await this.getStandingMap(accountId);
      const encRes = await db.query<{ faction_id: string }>(
        'SELECT faction_id FROM frontier_captain_encounters WHERE account_id = $1 AND captain_key = $2',
        [accountId, captainKey]
      );
      const factionId = normalizeCanonicalFaction(encRes.rows[0]?.faction_id || 'FACTION_HEGEMONY');
      return generateInterceptionCaptain({
        blipId: captainKey.replace(/^INTERCEPT_/, ''),
        factionId,
        sectorId,
        standing: standingMap.get(factionId) ?? -20,
      });
    }

    const ctx = await this.loadSectorContext(sectorId);
    const standingMap = await this.getStandingMap(accountId);
    const claimedRumorKeys = await this.getClaimedRumorKeys(accountId, sectorId);
    const profiles = generateSectorCaptains(ctx, (fid) => standingMap.get(fid) ?? 0, claimedRumorKeys);
    return profiles.find((p) => p.captainKey === captainKey) || profiles[0];
  }

  public async openCaptainComms(
    accountId: string = 'acc_sol_captain',
    captainKey: string,
    sectorId: number
  ): Promise<CaptainDialogStateResponse> {
    const profile = await this.resolveProfile(accountId, captainKey, sectorId);

    await db.query(
      `INSERT INTO frontier_captain_encounters (account_id, captain_key, sector_id, faction_id, current_node_id)
       VALUES ($1, $2, $3, $4, 'GREETING')
       ON CONFLICT (account_id, captain_key)
       DO UPDATE SET current_node_id = 'GREETING', last_hailed_at = NOW()`,
      [accountId, profile.captainKey, sectorId, profile.factionId]
    );

    const node = profile.nodes.GREETING;
    return {
      captainKey: profile.captainKey,
      sectorId,
      factionId: profile.factionId,
      factionName: profile.factionName,
      species: profile.species,
      speakerName: profile.name,
      title: `${profile.title} — ${profile.vesselName}`,
      vesselName: profile.vesselName,
      vesselClass: profile.vesselClass,
      currentNodeId: 'GREETING',
      mood: node.mood,
      text: node.text,
      options: node.options,
    };
  }

  public async respondToCaptain(params: {
    accountId?: string;
    captainKey: string;
    sectorId: number;
    optionId: string;
  }): Promise<CaptainResponseOutcome> {
    const accountId = params.accountId || 'acc_sol_captain';
    const profile = await this.resolveProfile(accountId, params.captainKey, params.sectorId);

    const encRes = await db.query<{ current_node_id: string; rumor_mission_id: string | null }>(
      'SELECT current_node_id, rumor_mission_id FROM frontier_captain_encounters WHERE account_id = $1 AND captain_key = $2',
      [accountId, profile.captainKey]
    );

    const currentNodeId = encRes.rows[0]?.current_node_id || 'GREETING';
    const currentNode = profile.nodes[currentNodeId] || profile.nodes.GREETING;
    const chosen =
      currentNode.options.find((o) => o.id === params.optionId) ||
      Object.values(profile.nodes)
        .flatMap((n) => n.options)
        .find((o) => o.id === params.optionId);

    if (!chosen) {
      throw new Error(`Invalid dialog option ${params.optionId} for ${profile.captainKey}`);
    }

    let nextNodeId = chosen.nextNodeId || currentNodeId;
    let customText: string | null = null;
    let customMood: StandingMood | null = null;
    let closed = false;
    let combatStarted = false;
    let peacefulResolved = false;
    let notification: string | undefined;
    let remainingCredits: number | undefined;
    let remainingFuel: number | undefined;
    let rumorMission: GalacticMissionRecord | null = null;
    let acceptedMission: GalacticMissionRecord | null = null;
    let combatSetup: CaptainResponseOutcome['combatSetup'];

    switch (chosen.actionType) {
      case 'CLOSE':
      case 'PEACEFUL_PASS': {
        closed = true;
        peacefulResolved = true;
        nextNodeId = 'RESOLVED_PEACEFUL';
        break;
      }

      case 'GOTO_NODE': {
        nextNodeId = chosen.nextNodeId || 'GREETING';
        break;
      }

      case 'OFFER_RUMOR': {
        nextNodeId = chosen.nextNodeId || 'RUMOR_PITCH';
        rumorMission = await galacticMissionService.getOrCreateCaptainRumorMission({
          accountId,
          originSectorId: params.sectorId,
          factionId: profile.factionId,
          captainKey: profile.captainKey,
          captainName: profile.name,
        });
        break;
      }

      case 'ACCEPT_RUMOR': {
        const mission = await galacticMissionService.getOrCreateCaptainRumorMission({
          accountId,
          originSectorId: params.sectorId,
          factionId: profile.factionId,
          captainKey: profile.captainKey,
          captainName: profile.name,
        });
        acceptedMission =
          mission.status === 'OFFERED'
            ? await galacticMissionService.acceptMission(accountId, mission.id)
            : mission;
        nextNodeId = 'RESOLVED_PEACEFUL';
        customText = `Coordinates uploaded to your Galactic Mission Log: "${acceptedMission.title}" (Target: Sector ${acceptedMission.targetSectorId}). Good hunting, Captain.`;
        customMood = 'FRIENDLY';
        notification = `📜 Accepted Secret Rumor: ${acceptedMission.title}`;
        break;
      }

      case 'BARTER_FUEL': {
        const cost = chosen.costCredits ?? profile.barterFuelCostCredits;
        const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
        const curCredits = Number(accRes.rows[0]?.credits || 0);
        if (curCredits < cost) {
          customText = `Insufficient credits (${curCredits} Cr < ${cost} Cr). Come back when your ledger balances.`;
          customMood = 'CAUTIOUS';
          nextNodeId = 'BARTER';
          break;
        }
        remainingCredits = curCredits - cost;
        await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [remainingCredits, accountId]);
        const shipUpd = await db.query<{ fuel: number }>(
          `UPDATE ships SET fuel = LEAST(max_fuel, fuel + $1) WHERE account_id = $2 RETURNING fuel`,
          [profile.barterFuelGain, accountId]
        );
        remainingFuel = Number(shipUpd.rows[0]?.fuel || 0);
        nextNodeId = 'GREETING';
        customText = `Deuterium transfer complete (+${profile.barterFuelGain} Fuel). Pleasure operating in ${params.sectorId > 5 ? 'the Frontier' : 'the Core'} with you.`;
        customMood = 'FRIENDLY';
        notification = `⛽ Purchased +${profile.barterFuelGain} Fuel for ${cost} Cr`;
        break;
      }

      case 'BARTER_SALVAGE': {
        await db.query('UPDATE accounts SET credits = credits + 140 WHERE id = $1', [accountId]);
        const accAfter = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
        remainingCredits = Number(accAfter.rows[0]?.credits || 0);
        await reputationService.modifyStanding(accountId, profile.factionId, 2, `Field telemetry trade with ${profile.name}`);
        nextNodeId = 'GREETING';
        customText = `Clean astrometry pings received. Wired 140 Cr and logged +2 goodwill with ${profile.factionName}.`;
        customMood = 'FRIENDLY';
        notification = `📡 Sold nav telemetry (+140 Cr, +2 Standing)`;
        break;
      }

      case 'BRIBE_CREDITS': {
        const cost = chosen.costCredits ?? profile.bribeCredits;
        const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
        const curCredits = Number(accRes.rows[0]?.credits || 0);
        if (curCredits < cost) {
          customText = `Your coffers are short (${curCredits} Cr < ${cost} Cr)! Pay up in fuel or prepare for weapons lock!`;
          customMood = 'AGGRESSIVE';
          nextNodeId = 'GREETING';
          break;
        }
        remainingCredits = curCredits - cost;
        await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [remainingCredits, accountId]);
        await reputationService.modifyStanding(accountId, profile.factionId, 4, `Toll paid to ${profile.name}`);
        nextNodeId = 'RESOLVED_PEACEFUL';
        peacefulResolved = true;
        customText = `Passage toll of ${cost} Cr accepted. Transponder marked green—move along.`;
        customMood = 'CURIOUS';
        notification = `🪙 Remitted ${cost} Cr passage toll for safe clearance.`;
        break;
      }

      case 'BRIBE_FUEL': {
        const fuelCost = chosen.costFuel ?? profile.bribeFuel;
        const shipRes = await db.query<{ fuel: number }>('SELECT fuel FROM ships WHERE account_id = $1', [accountId]);
        const curFuel = Number(shipRes.rows[0]?.fuel || 0);
        if (curFuel < fuelCost) {
          customText = `Deuterium tank below required tribute (${curFuel} < ${fuelCost} Fuel)!`;
          customMood = 'AGGRESSIVE';
          nextNodeId = 'GREETING';
          break;
        }
        const shipUpd = await db.query<{ fuel: number }>(
          'UPDATE ships SET fuel = fuel - $1 WHERE account_id = $2 RETURNING fuel',
          [fuelCost, accountId]
        );
        remainingFuel = Number(shipUpd.rows[0]?.fuel || 0);
        nextNodeId = 'RESOLVED_PEACEFUL';
        peacefulResolved = true;
        customText = `Fuel cells siphoned (${fuelCost} Fuel). Clearing lane ahead of your bow.`;
        customMood = 'CURIOUS';
        notification = `⛽ Transferred ${fuelCost} Fuel for safe clearance.`;
        break;
      }

      case 'BLUFF': {
        const fleetRes = await db.query<{ total: string }>(
          'SELECT COUNT(*) as total FROM player_fleet WHERE account_id = $1 AND status = $2',
          [accountId, 'ESCORTING']
        );
        const escortCount = parseInt(fleetRes.rows[0]?.total || '0', 10);
        const standings = await this.getStandingMap(accountId);
        const standing = standings.get(profile.factionId) ?? 0;
        // Deterministic bluff edge based on escort wingmen and reputation
        const succeeds = escortCount >= 1 || standing >= -5 || profile.species === 'KRYLL';
        if (succeeds) {
          peacefulResolved = true;
          nextNodeId = 'RESOLVED_PEACEFUL';
          customText = `*Static crackles as tactical scanners measure your transponder.* Understood, Commander. Standing down targeting solutions—lane is yours.`;
          customMood = 'CAUTIOUS';
          notification = `🛡️ Fleet authority bluff succeeded—patrol stood down.`;
        } else {
          combatStarted = true;
          nextNodeId = 'GREETING';
          customText = `Hollow threats do not fool ${profile.vesselName}! Weapons free—intercepting now!`;
          customMood = 'AGGRESSIVE';
          combatSetup = {
            encounterId: `cpt_combat_${Date.now()}`,
            factionId: profile.factionId,
            enemySquadron: [
              { type: profile.vesselClass, hull: 160, shield: 110, weapons: ['PULSE_LASER', 'ION_CANNON'] },
            ],
          };
        }
        break;
      }

      case 'TRUCE_PACT': {
        const truceRes = await reputationService.requestCeasefireTruce(accountId, params.sectorId, profile.factionId);
        remainingCredits = truceRes.remainingCredits;
        peacefulResolved = true;
        nextNodeId = 'RESOLVED_PEACEFUL';
        customText = `Temporary Sector Ceasefire registered for 10 minutes in Sector ${params.sectorId}. Conduct your business peacefully.`;
        customMood = 'FRIENDLY';
        notification = `🕊️ Ceasefire Truce active in Sector ${params.sectorId}`;
        break;
      }

      case 'ATTACK': {
        combatStarted = true;
        nextNodeId = 'GREETING';
        customText = `Comms severed! ${profile.vesselName} breaking orbit for tactical engagement!`;
        customMood = 'AGGRESSIVE';
        combatSetup = {
          encounterId: `cpt_combat_${Date.now()}`,
          factionId: profile.factionId,
          enemySquadron: [
            { type: profile.vesselClass, hull: 160, shield: 110, weapons: ['PULSE_LASER', 'ION_CANNON'] },
            { type: 'Escort Skiff', hull: 95, shield: 55, weapons: ['PULSE_LASER'] },
          ],
        };
        break;
      }
    }

    await db.query(
      `UPDATE frontier_captain_encounters
       SET current_node_id = $1, last_hailed_at = NOW()
       WHERE account_id = $2 AND captain_key = $3`,
      [nextNodeId, accountId, profile.captainKey]
    );

    const targetNode = profile.nodes[nextNodeId] || profile.nodes.GREETING;
    return {
      success: true,
      actionTaken: chosen.actionType,
      closed,
      combatStarted,
      peacefulResolved,
      notification,
      remainingCredits,
      remainingFuel,
      rumorMission,
      acceptedMission,
      combatSetup,
      dialog: {
        captainKey: profile.captainKey,
        sectorId: params.sectorId,
        factionId: profile.factionId,
        factionName: profile.factionName,
        species: profile.species,
        speakerName: profile.name,
        title: `${profile.title} — ${profile.vesselName}`,
        vesselName: profile.vesselName,
        vesselClass: profile.vesselClass,
        currentNodeId: nextNodeId,
        mood: customMood || targetNode.mood,
        text: customText || targetNode.text,
        options: targetNode.options,
        rumorMission,
      },
    };
  }

  /**
   * Registers a Hyperspace Interception Captain into `frontier_captain_encounters`
   * and returns the procedural Captain profile for multi-turn Comms.
   */
  public async registerInterceptionCaptain(params: {
    accountId: string;
    blipId: string;
    factionId: string;
    sectorId?: number;
    sectorName?: string;
  }): Promise<{
    captain: ProceduralCaptainProfile;
    dialog: CaptainDialogStateResponse;
  }> {
    const standingMap = await this.getStandingMap(params.accountId);
    const canonical = normalizeCanonicalFaction(params.factionId);
    const captain = generateInterceptionCaptain({
      blipId: params.blipId,
      factionId: canonical,
      sectorId: params.sectorId || 2,
      sectorName: params.sectorName,
      standing: standingMap.get(canonical) ?? -20,
    });

    await db.query(
      `INSERT INTO frontier_captain_encounters (account_id, captain_key, sector_id, faction_id, current_node_id)
       VALUES ($1, $2, $3, $4, 'GREETING')
       ON CONFLICT (account_id, captain_key)
       DO UPDATE SET faction_id = EXCLUDED.faction_id, current_node_id = 'GREETING', last_hailed_at = NOW()`,
      [params.accountId, captain.captainKey, params.sectorId || 2, captain.factionId]
    );

    const node = captain.nodes.GREETING;
    return {
      captain,
      dialog: {
        captainKey: captain.captainKey,
        sectorId: params.sectorId || 2,
        factionId: captain.factionId,
        factionName: captain.factionName,
        species: captain.species,
        speakerName: captain.name,
        title: `${captain.title} — ${captain.vesselName}`,
        vesselName: captain.vesselName,
        vesselClass: captain.vesselClass,
        currentNodeId: 'GREETING',
        mood: node.mood,
        text: node.text,
        options: node.options,
      },
    };
  }
}

export const frontierCaptainService = new FrontierCaptainService();


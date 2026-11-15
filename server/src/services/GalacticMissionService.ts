import crypto from 'node:crypto';
import { db } from '../db/Database';
import { LootGenerator } from './LootGenerator';
import { outfittingService } from './OutfittingService';
import { reputationService } from './ReputationService';
import { wreckService } from './WreckService';
import { CanonicalFactionId, normalizeCanonicalFaction } from '../procgen/FrontierCaptainGenerator';
import {
  CandidatePlanetRow,
  CandidateSectorRow,
  GeneratedMissionSpec,
  MissionSourceType,
  MissionType,
  ModuleCategory,
  ModuleRarity,
  StoryBranchChoice,
  generateCaptainRumorMission,
  generateNextStoryStage,
  generateStationBoardMissions,
  getStoryBranchMeta,
  upgradeRarityTier,
} from '../procgen/GalacticMissionGenerator';

export const MAX_ACTIVE_MISSIONS = 5;
export const BOARD_REFRESH_COST_CREDITS = 50;

export interface GalacticMissionRecord {
  id: string;
  accountId: string;
  boardSectorId: number;
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
  chainId: string | null;
  chainStage: number;
  chainTotalStages: number;
  storyBranch: StoryBranchChoice | null;
  isUrgent: boolean;
  urgentExpiresAt: string | null;
  boardExpiresAt: string;
  rewardCredits: number;
  rewardStanding: number;
  rewardModuleRarity: ModuleRarity | null;
  rewardModuleCategory: ModuleCategory | null;
  claimedReward: Record<string, any> | null;
  status: 'OFFERED' | 'ACTIVE' | 'READY_TO_CLAIM' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  branchMeta?: {
    rivalFactionId: CanonicalFactionId;
    loyalLabel: string;
    rivalLabel: string;
  };
}

export type BountySpawnCallback = (
  sectorId: number,
  missionId: string,
  callsign: string,
  factionId: string,
  hullClass?: string
) => void;

export class GalacticMissionService {
  private bountySpawnCallbacks: BountySpawnCallback[] = [];

  public onBountyMissionActivated(cb: BountySpawnCallback): void {
    this.bountySpawnCallbacks.push(cb);
  }

  private mapRow(row: any): GalacticMissionRecord {
    const parseJson = (val: any, fallback: any) =>
      val == null ? fallback : typeof val === 'string' ? JSON.parse(val) : val;

    const targetMetadata = parseJson(row.target_metadata_json, {});
    const issuerFactionId = normalizeCanonicalFaction(row.issuer_faction_id);
    const chainTotalStages = Number(row.chain_total_stages || 1);
    const chainStage = Number(row.chain_stage || 1);

    const record: GalacticMissionRecord = {
      id: row.id,
      accountId: row.account_id,
      boardSectorId: Number(row.board_sector_id),
      sourceType: row.source_type,
      missionType: row.mission_type,
      issuerFactionId,
      giverName: row.giver_name,
      title: row.title,
      briefing: row.briefing,
      targetSectorId: Number(row.target_sector_id),
      targetPlanetId: row.target_planet_id || null,
      targetMetadata,
      progress: parseJson(row.progress_json, {}),
      chainId: row.chain_id || null,
      chainStage,
      chainTotalStages,
      storyBranch: row.story_branch || null,
      isUrgent: Boolean(row.is_urgent),
      urgentExpiresAt: row.urgent_expires_at ? new Date(row.urgent_expires_at).toISOString() : null,
      boardExpiresAt: new Date(row.board_expires_at).toISOString(),
      rewardCredits: Number(row.reward_credits),
      rewardStanding: Number(row.reward_standing),
      rewardModuleRarity: row.reward_module_rarity || null,
      rewardModuleCategory: row.reward_module_category || null,
      claimedReward: parseJson(row.claimed_reward_json, null),
      status: row.status,
      acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    };

    if (chainTotalStages > 1 && chainStage === chainTotalStages) {
      record.branchMeta = getStoryBranchMeta(targetMetadata.chainThemeCode, issuerFactionId);
    }
    return record;
  }

  private async loadGalaxyCandidates(anchorSectorId: number): Promise<{
    sectors: CandidateSectorRow[];
    planets: CandidatePlanetRow[];
  }> {
    const sRes = await db.query<any>(
      `SELECT id, name, controlling_faction, COALESCE(hazard_level, 0) as hazard_level, COALESCE(spectral_class, 'YELLOW_G') as spectral_class
       FROM sectors
       ORDER BY
         CASE WHEN id = $1 THEN 999 ELSE 0 END,
         CASE WHEN id >= 6 THEN 0 ELSE 1 END,
         ABS(id - $1) ASC`,
      [anchorSectorId]
    );

    const candidateSectors: CandidateSectorRow[] = sRes.rows
      .filter((r) => Number(r.id) !== anchorSectorId)
      .slice(0, 14)
      .map((r) => ({
        id: Number(r.id),
        name: r.name,
        controllingFaction: r.controlling_faction,
        hazardLevel: Number(r.hazard_level || 0),
        spectralClass: r.spectral_class || 'YELLOW_G',
      }));

    if (candidateSectors.length === 0 && sRes.rows.length > 0) {
      const r = sRes.rows[0];
      candidateSectors.push({
        id: Number(r.id),
        name: r.name,
        controllingFaction: r.controlling_faction,
        hazardLevel: Number(r.hazard_level || 0),
        spectralClass: r.spectral_class || 'YELLOW_G',
      });
    }

    const sectorIds = candidateSectors.map((s) => s.id);
    const pRes = await db.query<any>(
      `SELECT p.id, p.sector_id, s.name as sector_name, p.controlling_faction, p.name, p.main_class, p.subtype, p.habitability_rating
       FROM planets p
       JOIN sectors s ON s.id = p.sector_id
       WHERE p.sector_id = ANY($1::int[])`,
      [sectorIds]
    );

    const candidatePlanets: CandidatePlanetRow[] = pRes.rows.map((r) => ({
      id: r.id,
      sectorId: Number(r.sector_id),
      sectorName: r.sector_name,
      controllingFaction: r.controlling_faction,
      name: r.name,
      mainClass: r.main_class,
      subtype: r.subtype,
      habitabilityRating: Number(r.habitability_rating || 1),
    }));

    return { sectors: candidateSectors, planets: candidatePlanets };
  }

  private async insertGeneratedMission(
    accountId: string,
    boardSectorId: number,
    spec: GeneratedMissionSpec,
    options?: {
      chainId?: string | null;
      status?: 'OFFERED' | 'ACTIVE';
    }
  ): Promise<GalacticMissionRecord> {
    const chainId = options?.chainId ?? (spec.chainTotalStages > 1 ? crypto.randomUUID() : null);
    const status = options?.status ?? 'OFFERED';
    const acceptedAt = status === 'ACTIVE' ? new Date() : null;
    const urgentExpiresAt = spec.isUrgent && spec.urgentMinutes
      ? new Date(Date.now() + spec.urgentMinutes * 60_000)
      : null;
    const boardExpiresAt = urgentExpiresAt ?? new Date(Date.now() + spec.boardExpiresMinutes * 60_000);

    const res = await db.query<any>(
      `INSERT INTO galactic_missions (
        account_id, board_sector_id, source_type, mission_type, issuer_faction_id, giver_name,
        title, briefing, target_sector_id, target_planet_id, target_metadata_json, progress_json,
        chain_id, chain_stage, chain_total_stages, is_urgent, urgent_expires_at, board_expires_at,
        reward_credits, reward_standing, reward_module_rarity, reward_module_category,
        status, accepted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11::jsonb, $12::jsonb,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24
      ) RETURNING *`,
      [
        accountId,
        boardSectorId,
        spec.sourceType,
        spec.missionType,
        spec.issuerFactionId,
        spec.giverName,
        spec.title,
        spec.briefing,
        spec.targetSectorId,
        spec.targetPlanetId,
        JSON.stringify(spec.targetMetadata),
        JSON.stringify(spec.progress),
        chainId,
        spec.chainStage,
        spec.chainTotalStages,
        spec.isUrgent,
        urgentExpiresAt,
        boardExpiresAt,
        spec.rewardCredits,
        spec.rewardStanding,
        spec.rewardModuleRarity,
        spec.rewardModuleCategory,
        status,
        acceptedAt,
      ]
    );

    const mission = this.mapRow(res.rows[0]);
    if (status === 'ACTIVE') {
      await this.materializeActiveMissionTarget(mission);
    }
    return mission;
  }

  /**
   * Ensures target wrecks or syndicate bounty ships exist when a mission becomes ACTIVE.
   */
  private async materializeActiveMissionTarget(mission: GalacticMissionRecord): Promise<void> {
    if (mission.missionType === 'WRECK_RECOVERY' && !mission.targetMetadata.wreckId) {
      const wreckName = mission.targetMetadata.wreckName || 'Frontier Derelict Core';
      const wreckClass = mission.targetMetadata.wreckClass || 'Precursor Survey Sloop';
      const created = await wreckService.createWreck(
        mission.targetSectorId,
        wreckName,
        wreckClass,
        mission.issuerFactionId,
        42,
        0,
        -38,
        0.65,
        85,
        0.82
      );
      const updatedMeta = { ...mission.targetMetadata, wreckId: created.id };
      await db.query(
        'UPDATE galactic_missions SET target_metadata_json = $1::jsonb WHERE id = $2',
        [JSON.stringify(updatedMeta), mission.id]
      );
      mission.targetMetadata = updatedMeta;
    } else if (mission.missionType === 'SYNDICATE_BOUNTY') {
      const callsign = mission.targetMetadata.targetCallsign || 'Corsair Raider';
      const hullClass = mission.targetMetadata.hullClass || 'HEGEMONY_INTERCEPTOR';
      for (const cb of this.bountySpawnCallbacks) {
        cb(mission.targetSectorId, mission.id, callsign, mission.issuerFactionId, hullClass);
      }
    }
  }

  public async getBoard(
    accountId: string = 'acc_sol_captain',
    sectorId: number = 1
  ): Promise<{
    sectorId: number;
    boardOffers: GalacticMissionRecord[];
    activeMissions: GalacticMissionRecord[];
    rumorOffers: GalacticMissionRecord[];
    completedCount: number;
    maxActiveSlots: number;
  }> {
    // Expire stale unaccepted board offers
    await db.query(
      `UPDATE galactic_missions
       SET status = 'EXPIRED'
       WHERE account_id = $1 AND status = 'OFFERED' AND board_expires_at < NOW()`,
      [accountId]
    );

    // Sync active missions with live telemetry first
    await this.syncProgress(accountId);

    // Check existing offers for this station sector
    const existingRes = await db.query<any>(
      `SELECT * FROM galactic_missions
       WHERE account_id = $1 AND board_sector_id = $2 AND status = 'OFFERED' AND source_type != 'CAPTAIN_RUMOR'
       ORDER BY created_at ASC`,
      [accountId, sectorId]
    );

    let boardOffers = existingRes.rows.map((r) => this.mapRow(r));
    if (boardOffers.length === 0) {
      const sectorRes = await db.query<{ controlling_faction: string }>(
        'SELECT controlling_faction FROM sectors WHERE id = $1',
        [sectorId]
      );
      const boardFaction = sectorRes.rows[0]?.controlling_faction || 'FACTION_SOL';
      const { sectors, planets } = await this.loadGalaxyCandidates(sectorId);
      const cycleBucket = Math.floor(Date.now() / (45 * 60_000));
      const specs = generateStationBoardMissions({
        seedKey: `BOARD_${accountId}_S${sectorId}_${cycleBucket}`,
        boardSectorId: sectorId,
        boardFaction,
        candidateSectors: sectors,
        candidatePlanets: planets,
        count: 5,
      });

      const inserted: GalacticMissionRecord[] = [];
      for (const spec of specs) {
        inserted.push(await this.insertGeneratedMission(accountId, sectorId, spec, { status: 'OFFERED' }));
      }
      boardOffers = inserted;
    }

    const activeRes = await db.query<any>(
      `SELECT * FROM galactic_missions
       WHERE account_id = $1 AND status IN ('ACTIVE', 'READY_TO_CLAIM')
       ORDER BY CASE WHEN status = 'READY_TO_CLAIM' THEN 0 ELSE 1 END, accepted_at ASC`,
      [accountId]
    );

    const rumorRes = await db.query<any>(
      `SELECT * FROM galactic_missions
       WHERE account_id = $1 AND status = 'OFFERED' AND source_type = 'CAPTAIN_RUMOR'
       ORDER BY created_at DESC`,
      [accountId]
    );

    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM galactic_missions WHERE account_id = $1 AND status = 'COMPLETED'`,
      [accountId]
    );

    return {
      sectorId,
      boardOffers,
      activeMissions: activeRes.rows.map((r) => this.mapRow(r)),
      rumorOffers: rumorRes.rows.map((r) => this.mapRow(r)),
      completedCount: parseInt(countRes.rows[0]?.total || '0', 10),
      maxActiveSlots: MAX_ACTIVE_MISSIONS,
    };
  }

  public async refreshBoard(accountId: string, sectorId: number): Promise<{
    success: boolean;
    remainingCredits: number;
    boardOffers: GalacticMissionRecord[];
  }> {
    const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    if (accRes.rows.length === 0) throw new Error('Account not found');
    const credits = Number(accRes.rows[0].credits);
    if (credits < BOARD_REFRESH_COST_CREDITS) {
      throw new Error(`INSUFFICIENT_CREDITS: Refreshing contracts costs ${BOARD_REFRESH_COST_CREDITS} Cr.`);
    }

    const remainingCredits = credits - BOARD_REFRESH_COST_CREDITS;
    await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [remainingCredits, accountId]);

    await db.query(
      `UPDATE galactic_missions
       SET status = 'EXPIRED'
       WHERE account_id = $1 AND board_sector_id = $2 AND status = 'OFFERED' AND source_type != 'CAPTAIN_RUMOR'`,
      [accountId, sectorId]
    );

    const sectorRes = await db.query<{ controlling_faction: string }>(
      'SELECT controlling_faction FROM sectors WHERE id = $1',
      [sectorId]
    );
    const boardFaction = sectorRes.rows[0]?.controlling_faction || 'FACTION_SOL';
    const { sectors, planets } = await this.loadGalaxyCandidates(sectorId);

    const specs = generateStationBoardMissions({
      seedKey: `REFRESH_${accountId}_S${sectorId}_${Date.now()}`,
      boardSectorId: sectorId,
      boardFaction,
      candidateSectors: sectors,
      candidatePlanets: planets,
      count: 5,
    });

    const boardOffers: GalacticMissionRecord[] = [];
    for (const spec of specs) {
      boardOffers.push(await this.insertGeneratedMission(accountId, sectorId, spec, { status: 'OFFERED' }));
    }

    return { success: true, remainingCredits, boardOffers };
  }

  public async acceptMission(accountId: string, missionId: string): Promise<GalacticMissionRecord> {
    const activeCountRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM galactic_missions WHERE account_id = $1 AND status IN ('ACTIVE', 'READY_TO_CLAIM')`,
      [accountId]
    );
    const activeCount = parseInt(activeCountRes.rows[0]?.total || '0', 10);
    if (activeCount >= MAX_ACTIVE_MISSIONS) {
      throw new Error(`MISSION_CAP_REACHED: Maximum ${MAX_ACTIVE_MISSIONS} active missions allowed.`);
    }

    const mRes = await db.query<any>(
      'SELECT * FROM galactic_missions WHERE id = $1 AND account_id = $2',
      [missionId, accountId]
    );
    if (mRes.rows.length === 0) throw new Error('Mission not found.');
    const row = mRes.rows[0];
    if (row.status !== 'OFFERED') {
      throw new Error(`Mission cannot be accepted from status ${row.status}.`);
    }

    const upd = await db.query<any>(
      `UPDATE galactic_missions
       SET status = 'ACTIVE', accepted_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [missionId, accountId]
    );

    const mission = this.mapRow(upd.rows[0]);
    await this.materializeActiveMissionTarget(mission);
    await this.syncProgress(accountId);

    const refreshed = await db.query<any>('SELECT * FROM galactic_missions WHERE id = $1', [missionId]);
    return this.mapRow(refreshed.rows[0]);
  }

  public async abandonMission(accountId: string, missionId: string): Promise<void> {
    const res = await db.query<{ id: string }>(
      `UPDATE galactic_missions SET status = 'ABANDONED'
       WHERE id = $1 AND account_id = $2 AND status IN ('ACTIVE', 'READY_TO_CLAIM')
       RETURNING id`,
      [missionId, accountId]
    );
    if (res.rows.length === 0) {
      throw new Error('Active mission not found to abandon.');
    }
  }

  /**
   * Re-evaluates all ACTIVE missions against live DB state (Xenodex discoveries,
   * planetary surveys, probe beacons, and salvaged wrecks).
   */
  public async syncProgress(accountId: string): Promise<GalacticMissionRecord[]> {
    const res = await db.query<any>(
      `SELECT * FROM galactic_missions WHERE account_id = $1 AND status = 'ACTIVE'`,
      [accountId]
    );

    const updatedMissions: GalacticMissionRecord[] = [];
    for (const row of res.rows) {
      const mission = this.mapRow(row);
      let isReady = false;
      let progress = { ...mission.progress };

      if (mission.missionType === 'XENOBIOLOGY_SURVEY' && mission.targetPlanetId) {
        const required = Number(mission.targetMetadata.requiredSpeciesCount || progress.requiredCount || 1);
        const spRes = await db.query<{ total: string }>(
          'SELECT COUNT(*) as total FROM discovered_species WHERE account_id = $1 AND planet_id = $2',
          [accountId, mission.targetPlanetId]
        );
        const foundCount = parseInt(spRes.rows[0]?.total || '0', 10);
        const capped = Math.min(required, foundCount);
        progress = {
          currentCount: capped,
          requiredCount: required,
          label: `${capped}/${required} Species Indexed`,
        };
        if (foundCount >= required) isReady = true;
      } else if (mission.missionType === 'PLANET_RECON' && mission.targetPlanetId) {
        const mode = mission.targetMetadata.reconMode || 'FULL_SURVEY';
        if (mode === 'BEACON') {
          const bRes = await db.query<{ total: string }>(
            'SELECT COUNT(*) as total FROM planet_beacons WHERE account_id = $1 AND planet_id = $2',
            [accountId, mission.targetPlanetId]
          );
          const count = parseInt(bRes.rows[0]?.total || '0', 10);
          progress = {
            currentCount: Math.min(1, count),
            requiredCount: 1,
            label: count > 0 ? '1/1 Beacon Deployed' : '0/1 Beacon Deployed',
          };
          if (count > 0) isReady = true;
        } else {
          const svRes = await db.query<{ survey_completion: number }>(
            'SELECT survey_completion FROM planet_surveys WHERE account_id = $1 AND planet_id = $2',
            [accountId, mission.targetPlanetId]
          );
          const pct = Number(svRes.rows[0]?.survey_completion || 0);
          progress = {
            currentCount: pct,
            requiredCount: 100,
            label: `${pct}% Surveyed`,
          };
          if (pct >= 100) isReady = true;
        }
      } else if (mission.missionType === 'WRECK_RECOVERY') {
        const targetWreckId = mission.targetMetadata.wreckId;
        if (targetWreckId) {
          const wRes = await db.query<{ scrap_remaining: number }>(
            'SELECT scrap_remaining FROM wrecks WHERE id = $1',
            [targetWreckId]
          );
          // Wreck either no longer exists (dismantled/refurbished) or scrap_remaining <= 0
          if (wRes.rows.length === 0 || Number(wRes.rows[0].scrap_remaining) <= 0) {
            progress = { currentCount: 1, requiredCount: 1, label: '1/1 Derelict Salvaged' };
            isReady = true;
          }
        }
      }

      const nextStatus = isReady ? 'READY_TO_CLAIM' : 'ACTIVE';
      const updRes = await db.query<any>(
        `UPDATE galactic_missions
         SET progress_json = $1::jsonb, status = $2
         WHERE id = $3
         RETURNING *`,
        [JSON.stringify(progress), nextStatus, mission.id]
      );
      updatedMissions.push(this.mapRow(updRes.rows[0]));
    }

    return updatedMissions;
  }

  public async recordWreckSalvaged(accountId: string, wreckId: string, sectorId: number): Promise<void> {
    const res = await db.query<any>(
      `SELECT * FROM galactic_missions
       WHERE account_id = $1 AND status = 'ACTIVE' AND mission_type = 'WRECK_RECOVERY'`,
      [accountId]
    );
    for (const row of res.rows) {
      const m = this.mapRow(row);
      if (m.targetMetadata.wreckId === wreckId || Number(m.targetSectorId) === Number(sectorId)) {
        await db.query(
          `UPDATE galactic_missions
           SET status = 'READY_TO_CLAIM',
               progress_json = '{"currentCount":1,"requiredCount":1,"label":"1/1 Derelict Salvaged"}'::jsonb
           WHERE id = $1`,
          [m.id]
        );
      }
    }
  }

  public async recordBountyKill(
    accountId: string,
    sectorId: number,
    targetName: string,
    entityId?: string
  ): Promise<void> {
    const res = await db.query<any>(
      `SELECT * FROM galactic_missions
       WHERE account_id = $1 AND status = 'ACTIVE' AND mission_type = 'SYNDICATE_BOUNTY' AND target_sector_id = $2`,
      [accountId, sectorId]
    );
    for (const row of res.rows) {
      const m = this.mapRow(row);
      const callsign = (m.targetMetadata.targetCallsign || '').toLowerCase();
      const matchById = entityId && entityId.includes(m.id);
      const matchByName = callsign && targetName.toLowerCase().includes(callsign);
      if (matchById || matchByName) {
        await db.query(
          `UPDATE galactic_missions
           SET status = 'READY_TO_CLAIM',
               progress_json = '{"currentCount":1,"requiredCount":1,"label":"1/1 Target Destroyed"}'::jsonb
           WHERE id = $1`,
          [m.id]
        );
      }
    }
  }

  public async claimMission(
    accountId: string,
    missionId: string,
    branchChoice?: StoryBranchChoice
  ): Promise<{
    success: boolean;
    mission: GalacticMissionRecord;
    creditsAwarded: number;
    urgentBonusApplied: boolean;
    standingDelta: number;
    rivalStandingDelta?: { factionId: CanonicalFactionId; delta: number };
    awardedModule: any;
    remainingCredits: number;
    nextStageMission: GalacticMissionRecord | null;
  }> {
    await this.syncProgress(accountId);

    const mRes = await db.query<any>(
      'SELECT * FROM galactic_missions WHERE id = $1 AND account_id = $2',
      [missionId, accountId]
    );
    if (mRes.rows.length === 0) throw new Error('Mission not found.');

    const mission = this.mapRow(mRes.rows[0]);
    if (mission.status !== 'READY_TO_CLAIM') {
      throw new Error(`Mission is ${mission.status}, not READY_TO_CLAIM.`);
    }

    const nowMs = Date.now();
    const urgentBonusApplied =
      mission.isUrgent &&
      mission.urgentExpiresAt !== null &&
      nowMs <= new Date(mission.urgentExpiresAt).getTime();

    const isFinalStoryTurnIn = mission.chainTotalStages > 1 && mission.chainStage === mission.chainTotalStages;
    const chosenBranch: StoryBranchChoice | null = isFinalStoryTurnIn
      ? branchChoice || 'LOYAL_HANDOFF'
      : null;

    let creditsAwarded = mission.rewardCredits;
    let standingDelta = mission.rewardStanding;
    let targetRarity: ModuleRarity = mission.rewardModuleRarity || 'UNCOMMON';
    let rivalStandingDelta: { factionId: CanonicalFactionId; delta: number } | undefined;

    if (urgentBonusApplied) {
      creditsAwarded = Math.round(creditsAwarded * 1.5);
      standingDelta += 5;
      targetRarity = upgradeRarityTier(targetRarity, 1);
    }

    if (chosenBranch === 'BLACK_MARKET_AUCTION') {
      const meta = getStoryBranchMeta(mission.targetMetadata.chainThemeCode, mission.issuerFactionId);
      creditsAwarded = Math.round(creditsAwarded * 1.65);
      standingDelta = -8;
      targetRarity = upgradeRarityTier(targetRarity, 1);
      rivalStandingDelta = { factionId: meta.rivalFactionId, delta: 10 };
    } else if (chosenBranch === 'LOYAL_HANDOFF') {
      standingDelta += 8;
    }

    // 1. Grant Credits
    await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [creditsAwarded, accountId]);
    const accAfter = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const remainingCredits = Number(accAfter.rows[0]?.credits || 0);

    // 2. Grant Faction Standing shifts
    await reputationService.modifyStanding(accountId, mission.issuerFactionId, standingDelta, `Mission: ${mission.title}`);
    if (rivalStandingDelta) {
      await reputationService.modifyStanding(
        accountId,
        rivalStandingDelta.factionId,
        rivalStandingDelta.delta,
        `Black Market Story Branch: ${mission.title}`
      );
    }

    // 3. Forge & Award Procedural Ship Module
    const catalog = await outfittingService.getCatalog();
    const preferredPool = mission.rewardModuleCategory
      ? catalog.filter((bp: any) => bp.main_category === mission.rewardModuleCategory)
      : catalog;
    const dropPool = preferredPool.length > 0 ? preferredPool : catalog;

    let awardedModule: any = null;
    if (dropPool.length > 0) {
      const dropped = LootGenerator.generateDrop(dropPool, targetRarity);
      awardedModule = await outfittingService.addLootToPlayer(accountId, dropped);
    }

    const claimedRewardJson = {
      creditsAwarded,
      urgentBonusApplied,
      standingDelta,
      rivalStandingDelta: rivalStandingDelta || null,
      awardedModule,
      storyBranch: chosenBranch,
    };

    const completedRes = await db.query<any>(
      `UPDATE galactic_missions
       SET status = 'COMPLETED',
           story_branch = $1,
           claimed_reward_json = $2::jsonb,
           completed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [chosenBranch, JSON.stringify(claimedRewardJson), mission.id]
    );

    // 4. Advance Story Chain if earlier stage
    let nextStageMission: GalacticMissionRecord | null = null;
    if (mission.chainStage < mission.chainTotalStages) {
      const { sectors, planets } = await this.loadGalaxyCandidates(mission.targetSectorId);
      const nextSpec = generateNextStoryStage({
        seedKey: `CHAIN_${mission.chainId}_STAGE_${mission.chainStage + 1}`,
        boardSectorId: mission.boardSectorId,
        issuerFactionId: mission.issuerFactionId,
        giverName: mission.giverName,
        nextStage: mission.chainStage + 1,
        totalStages: mission.chainTotalStages,
        themeCode: mission.targetMetadata.chainThemeCode,
        candidateSectors: sectors,
        candidatePlanets: planets,
      });

      nextStageMission = await this.insertGeneratedMission(accountId, mission.boardSectorId, nextSpec, {
        chainId: mission.chainId,
        status: 'ACTIVE',
      });
    }

    return {
      success: true,
      mission: this.mapRow(completedRes.rows[0]),
      creditsAwarded,
      urgentBonusApplied,
      standingDelta,
      rivalStandingDelta,
      awardedModule,
      remainingCredits,
      nextStageMission,
    };
  }

  /**
   * Creates or fetches an offered Secret Rumor mission granted by a Frontier Captain.
   */
  public async getOrCreateCaptainRumorMission(params: {
    accountId: string;
    originSectorId: number;
    factionId: CanonicalFactionId;
    captainKey: string;
    captainName: string;
  }): Promise<GalacticMissionRecord> {
    const existing = await db.query<any>(
      `SELECT m.*
       FROM frontier_captain_encounters e
       JOIN galactic_missions m ON m.id = e.rumor_mission_id
       WHERE e.account_id = $1 AND e.captain_key = $2
         AND m.status IN ('OFFERED', 'ACTIVE', 'READY_TO_CLAIM')`,
      [params.accountId, params.captainKey]
    );
    if (existing.rows.length > 0) {
      return this.mapRow(existing.rows[0]);
    }

    const { sectors, planets } = await this.loadGalaxyCandidates(params.originSectorId);
    const spec = generateCaptainRumorMission({
      seedKey: `RUMOR_${params.accountId}_${params.captainKey}`,
      originSectorId: params.originSectorId,
      factionId: params.factionId,
      captainName: params.captainName,
      candidateSectors: sectors,
      candidatePlanets: planets,
    });

    const created = await this.insertGeneratedMission(params.accountId, params.originSectorId, spec, {
      status: 'OFFERED',
    });

    await db.query(
      `INSERT INTO frontier_captain_encounters (account_id, captain_key, sector_id, faction_id, rumor_mission_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_id, captain_key)
       DO UPDATE SET rumor_mission_id = EXCLUDED.rumor_mission_id, last_hailed_at = NOW()`,
      [params.accountId, params.captainKey, params.originSectorId, params.factionId, created.id]
    );

    return created;
  }
}

export const galacticMissionService = new GalacticMissionService();

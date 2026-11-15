import crypto from 'node:crypto';
import { db } from '../db/Database';
import { SYNERGY_MODULES } from '../procgen/SynergyModuleCatalog';
import { rollModulePrefixAndAffixes } from '../procgen/ProceduralModuleCatalog';
import { RELIC_HULL_CATALOG } from '../procgen/HullClassCatalog';
import { OUTPOST_RELIC_BUILDINGS } from '../procgen/OutpostCatalog';
import { socialHubService } from './SocialHubService';

export type BossArchetypeId = 'CHRONO_MONOLITH' | 'HEGEMONY_LEVIATHAN' | 'PHORID_HIVEMOTHER';

export interface RaidBossArchetypeDef {
  id: BossArchetypeId;
  bossName: string;
  factionId: string;
  maxHp: number;
  maxShields: number;
  pylonCount: number;
  hullSeed: number;
  title: string;
  description: string;
}

export const RAID_BOSS_ARCHETYPES: Record<BossArchetypeId, RaidBossArchetypeDef> = {
  CHRONO_MONOLITH: {
    id: 'CHRONO_MONOLITH',
    bossName: 'Ur-Quan Vaelic Dread-Ark',
    factionId: 'FACTION_VAELIC',
    maxHp: 18000,
    maxShields: 12000,
    pylonCount: 4,
    hullSeed: 77001,
    title: 'Precursor Temporal Citadel',
    description: 'Ancient Vaelic singularity dreadnought projecting a 90% Aegis shield matrix until its orbital Pylons collapse.',
  },
  HEGEMONY_LEVIATHAN: {
    id: 'HEGEMONY_LEVIATHAN',
    bossName: 'Sa-Matra Vindicator Colossus',
    factionId: 'FACTION_HEGEMONY',
    maxHp: 20000,
    maxShields: 10000,
    pylonCount: 3,
    hullSeed: 77002,
    title: 'Armored Siege Dreadnought',
    description: 'Massive Hegemony fleet flagship fitted with sweeping thermal beam batteries and Bastion shield emitters.',
  },
  PHORID_HIVEMOTHER: {
    id: 'PHORID_HIVEMOTHER',
    bossName: 'Mycelial Overmind Spore-Barge',
    factionId: 'FACTION_PHORID',
    maxHp: 17000,
    maxShields: 11000,
    pylonCount: 4,
    hullSeed: 77003,
    title: 'Bio-Mechanical Apex Titan',
    description: 'Colossal Phorid organism protected by carapace glands and tethered Gravity Wells + Nurse Repair swarms.',
  },
};

const RELOCATE_INTERVAL_MS = 12 * 60 * 1000;
const ROLL_WINDOW_MS = 60 * 1000;

export class RaidDirectorService {
  private initialized = false;
  private schedulerTimer: NodeJS.Timeout | null = null;

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.ensureActiveWorldBosses();
    this.schedulerTimer = setInterval(() => {
      void this.tickScheduler();
    }, 30_000);
  }

  public stop(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private async getEligibleFrontierSectors(): Promise<number[]> {
    const res = await db.query<{ id: number }>(
      `SELECT id FROM sectors
       WHERE id >= 4
         AND id NOT IN (11, 17, 23, 29, 52, 61, 64)
       ORDER BY hazard_level DESC, id ASC
       LIMIT 24`
    );
    if (res.rows.length > 0) return res.rows.map((r) => Number(r.id));
    const fallback = await db.query<{ id: number }>(`SELECT id FROM sectors WHERE id >= 4 ORDER BY id ASC LIMIT 8`);
    return fallback.rows.map((r) => Number(r.id));
  }

  public async ensureActiveWorldBosses(): Promise<void> {
    const active = await db.query<any>(`SELECT * FROM raid_encounters WHERE status = 'ACTIVE'`);
    const needed = Math.max(0, 2 - active.rows.length);
    if (needed === 0) return;

    const eligible = await this.getEligibleFrontierSectors();
    if (eligible.length === 0) return;

    const usedSectors = new Set(active.rows.map((r: any) => Number(r.sector_id)));
    const archetypes = Object.keys(RAID_BOSS_ARCHETYPES) as BossArchetypeId[];

    for (let i = 0; i < needed; i++) {
      const candidates = eligible.filter((s) => !usedSectors.has(s));
      const sectorId = candidates.length > 0
        ? candidates[crypto.randomInt(0, candidates.length)]
        : eligible[0];
      usedSectors.add(sectorId);

      const archId = archetypes[(active.rows.length + i) % archetypes.length];
      await this.spawnEncounterRow(archId, sectorId);
    }
  }

  private async tickScheduler(): Promise<void> {
    try {
      await this.resolveExpiredRolls();
      const active = await db.query<any>(`SELECT * FROM raid_encounters WHERE status = 'ACTIVE'`);
      const now = Date.now();
      for (const enc of active.rows) {
        // Only relocate unengaged bosses at full HP
        const lastMoved = new Date(enc.last_relocated_at).getTime();
        if (enc.hp === enc.max_hp && now - lastMoved >= RELOCATE_INTERVAL_MS) {
          const eligible = await this.getEligibleFrontierSectors();
          const others = eligible.filter((s) => s !== Number(enc.sector_id));
          if (others.length > 0) {
            const nextSec = others[crypto.randomInt(0, others.length)];
            await db.query(
              `UPDATE raid_encounters SET sector_id = $1, last_relocated_at = NOW() WHERE id = $2`,
              [nextSec, enc.id]
            );
            socialHubService.broadcastAll('RAID_ALERT', {
              encounterId: enc.id,
              bossName: enc.boss_name,
              sectorId: nextSec,
              message: `☠️ DREADNOUGHT SIGNAL RELOCATED: ${enc.boss_name} warped into Frontier Sector ${nextSec}!`,
            });
          }
        }
      }
      await this.ensureActiveWorldBosses();
    } catch {}
  }

  private async spawnEncounterRow(
    archetypeId: BossArchetypeId,
    sectorId: number,
    overrides?: { maxHp?: number; maxShields?: number }
  ) {
    const def = RAID_BOSS_ARCHETYPES[archetypeId] || RAID_BOSS_ARCHETYPES.CHRONO_MONOLITH;
    const id = `raid_${crypto.randomBytes(6).toString('hex')}`;
    const maxHp = Math.max(200, Math.round(overrides?.maxHp ?? def.maxHp));
    const maxShields = Math.max(0, Math.round(overrides?.maxShields ?? def.maxShields));

    await db.query(
      `INSERT INTO raid_encounters (
         id, boss_archetype, boss_name, faction_id, sector_id, status, max_hp, hp, max_shields, shields, phase
       ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6, $7, $7, 1)`,
      [id, def.id, def.bossName, def.factionId, sectorId, maxHp, maxShields]
    );

    socialHubService.broadcastAll('RAID_ALERT', {
      encounterId: id,
      bossName: def.bossName,
      archetype: def.id,
      sectorId,
      message: `☠️ WORLD BOSS DETECTED: ${def.bossName} materialized in Frontier Sector ${sectorId}!`,
    });

    return this.getEncounterById(id);
  }

  public async debugSpawnBoss(opts: {
    sectorId: number;
    archetype?: BossArchetypeId;
    maxHp?: number;
    maxShields?: number;
  }) {
    const sectorId = Number(opts.sectorId);
    if (!Number.isFinite(sectorId) || sectorId < 4) {
      throw new Error('Dreadnought World Bosses can only spawn in Frontier sectors (sectorId >= 4).');
    }
    const secCheck = await db.query(`SELECT id FROM sectors WHERE id = $1`, [sectorId]);
    if (secCheck.rows.length === 0) {
      throw new Error(`Frontier sector ${sectorId} not found.`);
    }

    // Despawn any existing active boss in that specific sector for clean deterministic replacement
    await db.query(
      `UPDATE raid_encounters SET status = 'DESPAWNED' WHERE sector_id = $1 AND status = 'ACTIVE'`,
      [sectorId]
    );

    const archetype = opts.archetype && RAID_BOSS_ARCHETYPES[opts.archetype]
      ? opts.archetype
      : 'CHRONO_MONOLITH';

    return this.spawnEncounterRow(archetype, sectorId, {
      maxHp: opts.maxHp,
      maxShields: opts.maxShields,
    });
  }

  public async getEncounterById(encounterId: string) {
    const res = await db.query<any>(
      `SELECT r.*, s.name AS sector_name, s.coordinates_x, s.coordinates_y, s.hazard_level
       FROM raid_encounters r
       JOIN sectors s ON s.id = r.sector_id
       WHERE r.id = $1`,
      [encounterId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const def = RAID_BOSS_ARCHETYPES[r.boss_archetype as BossArchetypeId] || RAID_BOSS_ARCHETYPES.CHRONO_MONOLITH;
    return {
      id: r.id,
      bossArchetype: r.boss_archetype as BossArchetypeId,
      bossName: r.boss_name,
      factionId: r.faction_id,
      sectorId: Number(r.sector_id),
      sectorName: r.sector_name,
      coordinatesX: Number(r.coordinates_x ?? 500),
      coordinatesY: Number(r.coordinates_y ?? 500),
      hazardLevel: Number(r.hazard_level ?? 3),
      status: r.status,
      maxHp: Number(r.max_hp),
      hp: Number(r.hp),
      maxShields: Number(r.max_shields),
      shields: Number(r.shields),
      phase: Number(r.phase),
      enrageAt: r.enrage_at,
      pylonCount: def.pylonCount,
      hullSeed: def.hullSeed,
      title: def.title,
      description: def.description,
    };
  }

  public async getActiveBossForSector(sectorId: number) {
    const res = await db.query<{ id: string }>(
      `SELECT id FROM raid_encounters WHERE sector_id = $1 AND status = 'ACTIVE' ORDER BY spawned_at DESC LIMIT 1`,
      [sectorId]
    );
    if (res.rows.length === 0) return null;
    return this.getEncounterById(res.rows[0].id);
  }

  public async getActiveRaids() {
    await this.ensureActiveWorldBosses();
    const res = await db.query<any>(
      `SELECT r.*, s.name AS sector_name, s.coordinates_x, s.coordinates_y, s.hazard_level
       FROM raid_encounters r
       JOIN sectors s ON s.id = r.sector_id
       WHERE r.status = 'ACTIVE'
       ORDER BY r.spawned_at DESC`
    );

    const raids = [];
    for (const r of res.rows) {
      const contrib = await db.query<any>(
        `SELECT c.account_id, a.callsign, c.squadron_id, c.damage_dealt, c.healing_done, c.support_score
         FROM raid_contributions c
         JOIN accounts a ON a.id = c.account_id
         WHERE c.encounter_id = $1
         ORDER BY (c.damage_dealt + c.healing_done + c.support_score) DESC
         LIMIT 10`,
        [r.id]
      );
      const def = RAID_BOSS_ARCHETYPES[r.boss_archetype as BossArchetypeId] || RAID_BOSS_ARCHETYPES.CHRONO_MONOLITH;
      raids.push({
        id: r.id,
        bossArchetype: r.boss_archetype,
        bossName: r.boss_name,
        factionId: r.faction_id,
        title: def.title,
        sectorId: Number(r.sector_id),
        sectorName: r.sector_name,
        coordinatesX: Number(r.coordinates_x ?? 500),
        coordinatesY: Number(r.coordinates_y ?? 500),
        hazardLevel: Number(r.hazard_level ?? 3),
        maxHp: Number(r.max_hp),
        hp: Number(r.hp),
        maxShields: Number(r.max_shields),
        shields: Number(r.shields),
        phase: Number(r.phase),
        enrageAt: r.enrage_at,
        contributors: contrib.rows.map((c) => ({
          accountId: c.account_id,
          callsign: c.callsign,
          squadronId: c.squadron_id,
          damageDealt: Number(c.damage_dealt),
          healingDone: Number(c.healing_done),
          supportScore: Number(c.support_score),
          totalScore: Number(c.damage_dealt) + Number(c.healing_done) + Number(c.support_score),
        })),
      });
    }
    return raids;
  }

  public async getRaidHistory(limit: number = 15) {
    const res = await db.query<any>(
      `SELECT r.*, s.name AS sector_name, a.callsign AS winner_callsign
       FROM raid_encounters r
       JOIN sectors s ON s.id = r.sector_id
       LEFT JOIN accounts a ON a.id = r.winner_account_id
       WHERE r.status = 'DEFEATED'
       ORDER BY r.defeated_at DESC
       LIMIT $1`,
      [Math.min(50, Math.max(1, limit))]
    );
    return res.rows.map((r) => ({
      id: r.id,
      bossName: r.boss_name,
      bossArchetype: r.boss_archetype,
      sectorId: Number(r.sector_id),
      sectorName: r.sector_name,
      winnerAccountId: r.winner_account_id,
      winnerCallsign: r.winner_callsign,
      winnerSquadronId: r.winner_squadron_id,
      defeatedAt: r.defeated_at,
    }));
  }

  public async syncBossState(
    encounterId: string,
    hp: number,
    shields: number,
    phase: number,
    enrageAtMs?: number | null
  ): Promise<void> {
    await db.query(
      `UPDATE raid_encounters
       SET hp = $1, shields = $2, phase = $3,
           enrage_at = COALESCE($4, enrage_at)
       WHERE id = $5 AND status = 'ACTIVE'`,
      [
        Math.max(0, Math.round(hp)),
        Math.max(0, Math.round(shields)),
        phase,
        enrageAtMs ? new Date(enrageAtMs).toISOString() : null,
        encounterId,
      ]
    );
  }

  public async recordContribution(
    encounterId: string,
    accountId: string,
    squadronId: string | null | undefined,
    deltas: { damageDealt?: number; healingDone?: number; supportScore?: number; deaths?: number }
  ): Promise<void> {
    const dmg = Math.max(0, Math.round(deltas.damageDealt || 0));
    const heal = Math.max(0, Math.round(deltas.healingDone || 0));
    const sup = Math.max(0, Math.round(deltas.supportScore || 0));
    const deaths = Math.max(0, Math.round(deltas.deaths || 0));
    if (dmg + heal + sup + deaths === 0) return;

    await db.query(
      `INSERT INTO raid_contributions (encounter_id, account_id, squadron_id, damage_dealt, healing_done, support_score, deaths, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (encounter_id, account_id) DO UPDATE SET
         squadron_id = COALESCE(EXCLUDED.squadron_id, raid_contributions.squadron_id),
         damage_dealt = raid_contributions.damage_dealt + EXCLUDED.damage_dealt,
         healing_done = raid_contributions.healing_done + EXCLUDED.healing_done,
         support_score = raid_contributions.support_score + EXCLUDED.support_score,
         deaths = raid_contributions.deaths + EXCLUDED.deaths,
         updated_at = NOW()`,
      [encounterId, accountId, squadronId || null, dmg, heal, sup, deaths]
    );
  }

  /**
   * Finalizes Dreadnought destruction: awards direct contribution payouts and creates
   * Need/Greed/Pass Squadron loot rolls for MYTHIC gear, Tier-4 Relic Hulls, and Outpost Precursor Cores.
   */
  public async finalizeBossDefeat(
    encounterId: string,
    killerAccountId: string,
    killerSquadronId: string | null
  ): Promise<{
    winningSquadronId: string | null;
    winningAccountId: string;
    rolls: any[];
    payouts: Array<{ accountId: string; credits: number; bioData: number }>;
  }> {
    const enc = await this.getEncounterById(encounterId);
    if (!enc) throw new Error('Encounter not found.');

    const contribRes = await db.query<any>(
      `SELECT * FROM raid_contributions WHERE encounter_id = $1`,
      [encounterId]
    );

    const entries = contribRes.rows.map((r) => {
      const dmg = Number(r.damage_dealt || 0);
      const heal = Number(r.healing_done || 0);
      const sup = Number(r.support_score || 0);
      return {
        accountId: r.account_id as string,
        squadronId: (r.squadron_id as string | null) || null,
        weightedScore: dmg + heal * 1.15 + sup * 1.25,
      };
    });

    if (!entries.some((e) => e.accountId === killerAccountId)) {
      entries.push({ accountId: killerAccountId, squadronId: killerSquadronId, weightedScore: 100 });
    }

    const totalScore = Math.max(1, entries.reduce((s, e) => s + e.weightedScore, 0));

    // Determine winning Squadron or top individual pilot
    const squadTotals = new Map<string, number>();
    let topSolo = entries[0];
    for (const e of entries) {
      if (e.weightedScore > topSolo.weightedScore) topSolo = e;
      if (e.squadronId) {
        squadTotals.set(e.squadronId, (squadTotals.get(e.squadronId) || 0) + e.weightedScore);
      }
    }

    let winningSquadronId: string | null = killerSquadronId;
    let bestSquadScore = -1;
    for (const [sqId, sc] of squadTotals.entries()) {
      if (sc > bestSquadScore) {
        bestSquadScore = sc;
        winningSquadronId = sqId;
      }
    }

    const winningAccountId = topSolo?.accountId || killerAccountId;

    await db.query(
      `UPDATE raid_encounters
       SET status = 'DEFEATED', hp = 0, shields = 0, defeated_at = NOW(),
           winner_account_id = $1, winner_squadron_id = $2
       WHERE id = $3`,
      [winningAccountId, winningSquadronId, encounterId]
    );

    // Direct payouts for qualifying contributors (>= 2% share)
    const payouts: Array<{ accountId: string; credits: number; bioData: number }> = [];
    const qualifyingContributors: string[] = [];

    for (const e of entries) {
      const share = e.weightedScore / totalScore;
      if (share >= 0.02 || e.accountId === killerAccountId) {
        qualifyingContributors.push(e.accountId);
        const credits = 3000 + Math.round(share * 9000);
        const bioData = 25 + Math.round(share * 75);
        await db.query(`UPDATE accounts SET credits = credits + $1 WHERE id = $2`, [credits, e.accountId]);
        await db.query(
          `INSERT INTO player_biotech_research (account_id, bio_data_points)
           VALUES ($1, $2)
           ON CONFLICT (account_id) DO UPDATE SET bio_data_points = player_biotech_research.bio_data_points + $2`,
          [e.accountId, bioData]
        );
        await db.query(
          `UPDATE raid_contributions SET claimed_payout = TRUE WHERE encounter_id = $1 AND account_id = $2`,
          [encounterId, e.accountId]
        );
        payouts.push({ accountId: e.accountId, credits, bioData });
      }
    }

    // Eligible loot rollers = qualifying members in winning Squadron (or winning solo pilot)
    const eligibleAccountIds = winningSquadronId
      ? entries
          .filter((e) => e.squadronId === winningSquadronId && qualifyingContributors.includes(e.accountId))
          .map((e) => e.accountId)
      : [winningAccountId];

    if (eligibleAccountIds.length === 0) {
      eligibleAccountIds.push(winningAccountId);
    }

    // Synthesize 3 Endgame Raid Drops (Mythic Module, Tier-4 Relic Ship Blueprint, Outpost Precursor Core)
    const synMod = SYNERGY_MODULES[crypto.randomInt(0, SYNERGY_MODULES.length)];
    const rolledMythic = rollModulePrefixAndAffixes({
      subtype: synMod.subtype,
      slotType: synMod.slotType,
      basePowerGridCost: synMod.powerGridCost,
      baseCpuCost: synMod.cpuCost,
      basePrice: synMod.basePrice,
      rarity: 'MYTHIC',
    });

    const relicHull = RELIC_HULL_CATALOG[crypto.randomInt(0, RELIC_HULL_CATALOG.length)];
    const colonyCore = OUTPOST_RELIC_BUILDINGS[crypto.randomInt(0, OUTPOST_RELIC_BUILDINGS.length)];

    const lootSpecs = [
      {
        itemType: 'MYTHIC_MODULE' as const,
        itemName: `${rolledMythic.customName} (${synMod.name})`,
        payload: {
          blueprintId: synMod.blueprintId,
          customName: `${rolledMythic.customName} [${synMod.shortLabel}]`,
          rarity: 'MYTHIC',
          affixes: rolledMythic.affixes,
          mainCategory: synMod.mainCategory,
          subtype: synMod.subtype,
          techPrefix: rolledMythic.prefixDef.prefix,
          techSuffix: rolledMythic.techSuffix,
        },
      },
      {
        itemType: 'RELIC_HULL' as const,
        itemName: `${relicHull.displayName} Fabrication Permit`,
        payload: {
          blueprintId: relicHull.hullClass,
          title: `${relicHull.displayName} (Tier-4 Relic Hull)`,
          charges: 1,
        },
      },
      {
        itemType: 'COLONY_CORE' as const,
        itemName: `${colonyCore.name} Colony Core Permit`,
        payload: {
          blueprintId: colonyCore.id,
          title: `${colonyCore.name} (Precursor Core)`,
          charges: 1,
        },
      },
    ];

    const createdRolls: any[] = [];
    const expiresAt = new Date(Date.now() + ROLL_WINDOW_MS).toISOString();

    for (const spec of lootSpecs) {
      const rollId = `roll_${crypto.randomBytes(6).toString('hex')}`;
      await db.query(
        `INSERT INTO raid_loot_rolls (
           id, encounter_id, squadron_id, eligible_account_ids, item_type, item_name, item_payload, expires_at
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8)`,
        [
          rollId,
          encounterId,
          winningSquadronId,
          JSON.stringify(eligibleAccountIds),
          spec.itemType,
          spec.itemName,
          JSON.stringify(spec.payload),
          expiresAt,
        ]
      );

      // Single eligible pilot receives immediate auto-award cleanly!
      if (eligibleAccountIds.length === 1) {
        const awarded = await this.awardRollToWinner(rollId, eligibleAccountIds[0]);
        createdRolls.push(awarded);
      } else {
        createdRolls.push({
          id: rollId,
          encounterId,
          squadronId: winningSquadronId,
          eligibleAccountIds,
          itemType: spec.itemType,
          itemName: spec.itemName,
          itemPayload: spec.payload,
          status: 'OPEN',
          expiresAt,
        });
      }
    }

    socialHubService.broadcastAll('RAID_ALERT', {
      encounterId,
      bossName: enc.bossName,
      sectorId: enc.sectorId,
      winnerAccountId: winningAccountId,
      winnerSquadronId: winningSquadronId,
      message: `🏆 DREADNOUGHT DESTROYED! ${enc.bossName} fell in Sector ${enc.sectorId}!`,
    });

    for (const accId of eligibleAccountIds) {
      socialHubService.pushToAccount(accId, 'RAID_LOOT_ROLLS', {
        encounterId,
        rolls: createdRolls,
      });
    }

    return { winningSquadronId, winningAccountId, rolls: createdRolls, payouts };
  }

  public async getOpenRollsForAccount(accountId: string) {
    await this.resolveExpiredRolls();
    const res = await db.query<any>(
      `SELECT * FROM raid_loot_rolls
       WHERE status = 'OPEN'
         AND eligible_account_ids ? $1
       ORDER BY created_at DESC`,
      [accountId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      encounterId: r.encounter_id,
      squadronId: r.squadron_id,
      eligibleAccountIds: r.eligible_account_ids,
      itemType: r.item_type,
      itemName: r.item_name,
      itemPayload: r.item_payload,
      bids: r.bids || {},
      status: r.status,
      expiresAt: r.expires_at,
    }));
  }

  public async submitRollBid(
    accountId: string,
    rollId: string,
    bidType: 'NEED' | 'GREED' | 'PASS'
  ) {
    const res = await db.query<any>(`SELECT * FROM raid_loot_rolls WHERE id = $1`, [rollId]);
    if (res.rows.length === 0) throw new Error('Loot roll not found.');
    const roll = res.rows[0];
    if (roll.status !== 'OPEN') throw new Error('Loot roll has already been awarded.');

    const eligible: string[] = Array.isArray(roll.eligible_account_ids) ? roll.eligible_account_ids : [];
    if (!eligible.includes(accountId)) {
      throw new Error('You are not eligible to bid on this Squadron raid drop.');
    }

    const bids: Record<string, { choice: string; score: number }> = { ...(roll.bids || {}) };
    const rand = crypto.randomInt(1, 101);
    const weight = bidType === 'NEED' ? 1000 : bidType === 'GREED' ? 100 : -1000;
    bids[accountId] = { choice: bidType, score: weight + rand };

    await db.query(`UPDATE raid_loot_rolls SET bids = $1::jsonb WHERE id = $2`, [
      JSON.stringify(bids),
      rollId,
    ]);

    // Check if everyone voted -> resolve immediately!
    const allVoted = eligible.every((id) => Boolean(bids[id]));
    if (allVoted) {
      return this.resolveRollById(rollId);
    }

    return {
      id: roll.id,
      status: 'OPEN',
      bids,
      allVoted: false,
      winnerAccountId: null,
    };
  }

  public async resolveExpiredRolls(): Promise<void> {
    const expired = await db.query<{ id: string }>(
      `SELECT id FROM raid_loot_rolls WHERE status = 'OPEN' AND expires_at <= NOW()`
    );
    for (const row of expired.rows) {
      await this.resolveRollById(row.id);
    }
  }

  public async resolveRollById(rollId: string) {
    const res = await db.query<any>(`SELECT * FROM raid_loot_rolls WHERE id = $1`, [rollId]);
    if (res.rows.length === 0) return null;
    const roll = res.rows[0];
    if (roll.status === 'AWARDED') return roll;

    const eligible: string[] = Array.isArray(roll.eligible_account_ids) ? roll.eligible_account_ids : [];
    const bids: Record<string, { choice: string; score: number }> = roll.bids || {};

    let bestAccountId: string = eligible[0];
    let bestScore = -99999;

    for (const accId of eligible) {
      const b = bids[accId];
      if (b && b.score > bestScore) {
        bestScore = b.score;
        bestAccountId = accId;
      }
    }

    return this.awardRollToWinner(rollId, bestAccountId);
  }

  private async awardRollToWinner(rollId: string, winnerAccountId: string) {
    const res = await db.query<any>(`SELECT * FROM raid_loot_rolls WHERE id = $1`, [rollId]);
    if (res.rows.length === 0) throw new Error('Roll missing');
    const roll = res.rows[0];
    if (roll.status === 'AWARDED') return roll;

    const payload = roll.item_payload || {};
    if (roll.item_type === 'MYTHIC_MODULE') {
      await db.query(
        `INSERT INTO player_inventory (
           id, account_id, blueprint_id, custom_name, rarity, affixes, main_category, subtype, tech_prefix, tech_suffix, is_fitted
         ) VALUES ($1, $2, $3, $4, 'MYTHIC', $5::jsonb, $6, $7, $8, $9, FALSE)`,
        [
          crypto.randomUUID(),
          winnerAccountId,
          payload.blueprintId,
          payload.customName || roll.item_name,
          JSON.stringify(payload.affixes || []),
          payload.mainCategory || 'DEFENSE',
          payload.subtype || 'Module',
          payload.techPrefix || 'Precursor',
          payload.techSuffix || 'Core',
        ]
      );
    } else if (roll.item_type === 'RELIC_HULL') {
      await this.grantRelicUnlock(
        winnerAccountId,
        payload.blueprintId,
        'SHIP_HULL',
        payload.title || roll.item_name,
        payload.charges || 1
      );
    } else if (roll.item_type === 'COLONY_CORE') {
      await this.grantRelicUnlock(
        winnerAccountId,
        payload.blueprintId,
        'OUTPOST_BUILDING',
        payload.title || roll.item_name,
        payload.charges || 1
      );
    }

    await db.query(
      `UPDATE raid_loot_rolls
       SET status = 'AWARDED', winner_account_id = $1, awarded_at = NOW()
       WHERE id = $2`,
      [winnerAccountId, rollId]
    );

    socialHubService.pushToAccount(winnerAccountId, 'RAID_LOOT_AWARDED', {
      rollId,
      itemType: roll.item_type,
      itemName: roll.item_name,
    });

    return {
      id: roll.id,
      encounterId: roll.encounter_id,
      itemType: roll.item_type,
      itemName: roll.item_name,
      itemPayload: payload,
      status: 'AWARDED',
      winnerAccountId,
    };
  }

  public async grantRelicUnlock(
    accountId: string,
    blueprintId: string,
    unlockType: 'SHIP_HULL' | 'OUTPOST_BUILDING',
    title: string,
    charges: number = 1
  ): Promise<void> {
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM player_relic_unlocks WHERE account_id = $1 AND blueprint_id = $2 LIMIT 1`,
      [accountId, blueprintId]
    );
    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE player_relic_unlocks SET charges_remaining = charges_remaining + $1 WHERE id = $2`,
        [charges, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO player_relic_unlocks (id, account_id, blueprint_id, unlock_type, title, charges_remaining)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [`relic_${crypto.randomBytes(6).toString('hex')}`, accountId, blueprintId, unlockType, title, charges]
      );
    }
  }

  public async hasRelicUnlock(accountId: string, blueprintId: string): Promise<boolean> {
    const res = await db.query<{ charges_remaining: number }>(
      `SELECT charges_remaining FROM player_relic_unlocks
       WHERE account_id = $1 AND blueprint_id = $2 AND charges_remaining > 0
       LIMIT 1`,
      [accountId, blueprintId]
    );
    return res.rows.length > 0;
  }

  public async consumeRelicUnlock(accountId: string, blueprintId: string): Promise<boolean> {
    const res = await db.query<{ id: string }>(
      `UPDATE player_relic_unlocks
       SET charges_remaining = charges_remaining - 1
       WHERE account_id = $1 AND blueprint_id = $2 AND charges_remaining > 0
       RETURNING id`,
      [accountId, blueprintId]
    );
    return res.rows.length > 0;
  }

  public async getAccountRelics(accountId: string) {
    const res = await db.query<any>(
      `SELECT * FROM player_relic_unlocks WHERE account_id = $1 AND charges_remaining > 0 ORDER BY unlocked_at DESC`,
      [accountId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      blueprintId: r.blueprint_id,
      unlockType: r.unlock_type,
      title: r.title,
      chargesRemaining: Number(r.charges_remaining),
      unlockedAt: r.unlocked_at,
    }));
  }
}

export const raidDirectorService = new RaidDirectorService();

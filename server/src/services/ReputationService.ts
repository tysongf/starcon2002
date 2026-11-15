import { db } from '../db/Database';
import { crewService } from './CrewService';
import {
  ALL_FACTION_IDS,
  FACTION_REGISTRY,
  normalizeFactionId,
  type FactionId,
} from '../../../shared/FactionRegistry';

export type { FactionId };
export type StandingTier = 'HONORED' | 'FRIENDLY' | 'NEUTRAL' | 'HOSTILE' | 'NEMESIS';

export interface FactionMetadata {
  id: FactionId;
  name: string;
  crestIcon: string;
  description: string;
  primaryColor: string;
}

export const FACTION_METADATA: Record<FactionId, FactionMetadata> = ALL_FACTION_IDS.reduce(
  (acc, fid) => {
    const entry = FACTION_REGISTRY[fid];
    acc[fid] = {
      id: entry.id,
      name: entry.name,
      crestIcon: entry.crestIcon,
      description: entry.description,
      primaryColor: entry.primaryColor,
    };
    return acc;
  },
  {} as Record<FactionId, FactionMetadata>
);

/**
 * Day 21: Airspace clearance verdict for operating around a faction-controlled planet.
 * Hostile factions (standing < 0) require an active ceasefire truce in the planet's sector.
 */
export interface AirspaceClearance {
  cleared: boolean;
  planetId: string;
  planetName: string;
  sectorId: number;
  factionId: string;
  factionName: string;
  standing: number;
  truceRequired: boolean;
  truceActive: boolean;
  truceExpiresAt: string | null;
}

export interface FactionStanding {
  factionId: FactionId;
  name: string;
  crestIcon: string;
  standing: number; // -100 to +100
  tier: StandingTier;
  perkDesc: string;
  discountPercent: number;
  surchargePercent: number;
  isDockingPermitted: boolean;
  primaryColor: string;
}

export class ReputationService {
  /**
   * Translates a numerical standing (-100 to +100) into named tier and market trade modifier
   */
  public getTierDetails(score: number): {
    tier: StandingTier;
    discountPercent: number;
    surchargePercent: number;
    perkDesc: string;
    isDockingPermitted: boolean;
  } {
    if (score >= 60) {
      return {
        tier: 'HONORED',
        discountPercent: 15,
        surchargePercent: 0,
        perkDesc: '15% Market & Outfitting Discount // Priority Docking Clearance',
        isDockingPermitted: true,
      };
    } else if (score >= 20) {
      return {
        tier: 'FRIENDLY',
        discountPercent: 5,
        surchargePercent: 0,
        perkDesc: '5% Market Discount // Standard Diplomatic Welcome',
        isDockingPermitted: true,
      };
    } else if (score >= -19) {
      return {
        tier: 'NEUTRAL',
        discountPercent: 0,
        surchargePercent: 0,
        perkDesc: 'Standard Interstellar Commerce Rates',
        isDockingPermitted: true,
      };
    } else if (score >= -59) {
      return {
        tier: 'HOSTILE',
        discountPercent: 0,
        surchargePercent: 25,
        perkDesc: '25% Tariff Surcharge // Armed Interception on Radar Lock',
        isDockingPermitted: true,
      };
    } else {
      return {
        tier: 'NEMESIS',
        discountPercent: 0,
        surchargePercent: 50,
        perkDesc: 'Shoot-on-Sight Order // Station Clamps Locked Out Without Bribe',
        isDockingPermitted: false,
      };
    }
  }

  /**
   * Retrieves all faction standings for an account, seeding baseline defaults if first query.
   */
  public async getStandings(accountId: string): Promise<FactionStanding[]> {
    const { rows } = await db.query<any>(
      `SELECT faction_id, standing FROM faction_standings WHERE account_id = $1`,
      [accountId]
    );

    const standingsMap = new Map<string, number>();
    for (const r of rows) {
      standingsMap.set(r.faction_id, parseInt(r.standing, 10));
    }

    const results: FactionStanding[] = [];

    for (const fid of ALL_FACTION_IDS) {
      const entry = FACTION_REGISTRY[fid];
      let score = standingsMap.get(fid);
      if (score === undefined) {
        score = entry.startingStanding;
        await db.query(
          `INSERT INTO faction_standings (account_id, faction_id, standing)
           VALUES ($1, $2, $3)
           ON CONFLICT (account_id, faction_id) DO UPDATE SET standing = EXCLUDED.standing`,
          [accountId, fid, score]
        );
      }

      const details = this.getTierDetails(score);

      results.push({
        factionId: fid,
        name: entry.name,
        crestIcon: entry.crestIcon,
        standing: score,
        tier: details.tier,
        perkDesc: details.perkDesc,
        discountPercent: details.discountPercent,
        surchargePercent: details.surchargePercent,
        isDockingPermitted: details.isDockingPermitted,
        primaryColor: entry.primaryColor,
      });
    }

    return results;
  }

  /**
   * Authoritatively modifies standing with a primary faction and cascades shifts to rivals.
   */
  public async modifyStanding(
    accountId: string,
    primaryFactionId: FactionId,
    amount: number,
    reason: string
  ): Promise<{ updatedStandings: FactionStanding[]; logMessage: string }> {
    const normalizedPrimary = normalizeFactionId(primaryFactionId);
    let effectiveAmount = amount;
    if (amount > 0) {
      try {
        const roster = await crewService.getRosterSummary(accountId);
        const diplMult = 1 + (roster.bonuses.reputationGainBonus || 0);
        effectiveAmount = Math.max(amount, Math.round(amount * diplMult));
      } catch {
        effectiveAmount = amount;
      }
    }
    // Current primary score
    const curRes = await db.query<any>(
      `SELECT standing FROM faction_standings WHERE account_id = $1 AND faction_id = $2`,
      [accountId, normalizedPrimary]
    );
    const curScore = parseInt(curRes.rows[0]?.standing || '0', 10);
    const newScore = Math.max(-100, Math.min(100, curScore + effectiveAmount));

    await db.query(
      `INSERT INTO faction_standings (account_id, faction_id, standing)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, faction_id) DO UPDATE SET standing = $3, updated_at = NOW()`,
      [accountId, normalizedPrimary, newScore]
    );

    // Cascading cross-faction standing offsets sourced from FactionRegistry
    const cascades = FACTION_REGISTRY[normalizedPrimary].cascades.map((rule) => ({
      fid: rule.targetFactionId,
      delta: Math.round(effectiveAmount * rule.multiplier),
    }));

    for (const casc of cascades) {
      if (casc.delta === 0) continue;
      const cRes = await db.query<any>(
        `SELECT standing FROM faction_standings WHERE account_id = $1 AND faction_id = $2`,
        [accountId, casc.fid]
      );
      const cScore = parseInt(cRes.rows[0]?.standing || '0', 10);
      const cNew = Math.max(-100, Math.min(100, cScore + casc.delta));
      await db.query(
        `INSERT INTO faction_standings (account_id, faction_id, standing)
         VALUES ($1, $2, $3)
         ON CONFLICT (account_id, faction_id) DO UPDATE SET standing = $3, updated_at = NOW()`,
        [accountId, casc.fid, cNew]
      );
    }

    const updatedStandings = await this.getStandings(accountId);
    const sign = amount >= 0 ? `+${amount}` : `${amount}`;
    const logMessage = `Reputation shift with ${FACTION_METADATA[primaryFactionId].name} (${sign}): ${reason}`;

    return { updatedStandings, logMessage };
  }

  /**
   * Directly sets a faction standing (used in debug or milestone setup)
   */
  public async debugSetStanding(
    accountId: string,
    factionId: FactionId,
    targetScore: number
  ): Promise<FactionStanding[]> {
    const clamped = Math.max(-100, Math.min(100, targetScore));
    await db.query(
      `INSERT INTO faction_standings (account_id, faction_id, standing)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, faction_id) DO UPDATE SET standing = $3, updated_at = NOW()`,
      [accountId, factionId, clamped]
    );
    return this.getStandings(accountId);
  }

  /**
   * In-Flight Ceasefire / Bribe Negotiation:
   * Deducts tribute bribe and establishes a 5-minute active diplomatic truce in the sector.
   */
  public async requestCeasefireTruce(
    accountId: string,
    sectorId: number,
    factionId: FactionId,
    tributeType: 'CREDITS' | 'ALLOYS' = 'CREDITS'
  ): Promise<{
    success: boolean;
    truceId: string;
    expiresAt: string;
    remainingCredits: number;
    message: string;
  }> {
    const tributeCostCredits = 400;
    const tributeAlloyUnits = 6;

    // Verify resources
    const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const currentCredits = accRes.rows[0]?.credits || 0;

    if (tributeType === 'CREDITS') {
      if (currentCredits < tributeCostCredits) {
        throw new Error(`Insufficient credits for tribute bribe. Required: ${tributeCostCredits} CR.`);
      }
      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [tributeCostCredits, accountId]);
    } else {
      // Check alloys in cargo
      const shipRes = await db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
      if (shipRes.rows.length === 0) throw new Error('Ship not found');
      const shipId = shipRes.rows[0].id;

      const cargoRes = await db.query<{ quantity: number }>(
        `SELECT quantity FROM ship_cargo WHERE ship_id = $1 AND commodity_id = 'COMM_ALLOY'`,
        [shipId]
      );
      const availableAlloys = cargoRes.rows[0]?.quantity || 0;
      if (availableAlloys < tributeAlloyUnits) {
        throw new Error(`Insufficient plasteel alloys for tribute. Required: ${tributeAlloyUnits}x COMM_ALLOY.`);
      }

      await db.query(
        `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = 'COMM_ALLOY'`,
        [tributeAlloyUnits, shipId]
      );
    }

    // Award +10 diplomatic goodwill for honoring tribute
    await this.modifyStanding(accountId, factionId, 10, 'Remitted diplomatic tribute bribe');

    // Create 5-minute ceasefire truce
    const truceId = `truce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Clear previous truces in this sector
    await db.query(
      `DELETE FROM diplomatic_truces WHERE account_id = $1 AND sector_id = $2 AND faction_id = $3`,
      [accountId, sectorId, factionId]
    );

    await db.query(
      `INSERT INTO diplomatic_truces (id, account_id, sector_id, faction_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [truceId, accountId, sectorId, factionId, expiresAt]
    );

    const updatedAcc = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);

    // Notify registered listeners (e.g. SectorCombatManager)
    for (const listener of this.truceListeners) {
      try {
        listener(accountId, sectorId, factionId, 5 * 60 * 1000);
      } catch (err) {
        // Ignore listener error
      }
    }

    return {
      success: true,
      truceId,
      expiresAt,
      remainingCredits: updatedAcc.rows[0]?.credits || 0,
      message: `Sub-space ceasefire confirmed with ${FACTION_METADATA[factionId].name}. Combat drones disarmed in Sector ${sectorId} for 5 minutes.`,
    };
  }

  private truceListeners: Array<(accountId: string, sectorId: number, factionId: string, durationMs: number) => void> = [];

  public onTruceDeclared(listener: (accountId: string, sectorId: number, factionId: string, durationMs: number) => void): void {
    this.truceListeners.push(listener);
  }


  /**
   * Checks if player has an active unexpired truce with a faction in a sector.
   */
  public async hasActiveTruce(
    accountId: string,
    sectorId: number,
    factionId: string
  ): Promise<boolean> {
    const normalized = normalizeFactionId(factionId);
    const { rows } = await db.query<any>(
      `SELECT id FROM diplomatic_truces 
       WHERE account_id = $1 AND sector_id = $2 AND faction_id = $3 AND expires_at > NOW() 
       LIMIT 1`,
      [accountId, sectorId, normalized]
    );
    return rows.length > 0;
  }

  /**
   * Returns the active truce expiry timestamp for a faction in a sector, or null if none.
   */
  public async getActiveTruceExpiry(
    accountId: string,
    sectorId: number,
    factionId: string
  ): Promise<string | null> {
    const normalized = normalizeFactionId(factionId);
    const { rows } = await db.query<any>(
      `SELECT expires_at FROM diplomatic_truces
       WHERE account_id = $1 AND sector_id = $2 AND faction_id = $3 AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [accountId, sectorId, normalized]
    );
    if (rows.length === 0) return null;
    const exp = rows[0].expires_at;
    return exp instanceof Date ? exp.toISOString() : new Date(exp).toISOString();
  }

  /**
   * Day 21: Evaluates whether the pilot may operate (survey, probe, colonize, decipher) around a planet.
   * Planets controlled by a faction the pilot is hostile toward (standing < 0) require an active
   * ceasefire truce with that faction in the planet's sector. Checked at the START of each action.
   */
  public async getAirspaceClearance(accountId: string, planetId: string): Promise<AirspaceClearance> {
    const { rows } = await db.query<any>(
      'SELECT id, name, sector_id, controlling_faction FROM planets WHERE id = $1',
      [planetId]
    );
    if (rows.length === 0) {
      throw new Error(`Planet with ID ${planetId} not found.`);
    }
    const planet = rows[0];
    const factionId = normalizeFactionId(planet.controlling_faction);
    const sectorId = Number(planet.sector_id);

    const standings = await this.getStandings(accountId);
    const standing = standings.find((s) => s.factionId === factionId)?.standing ?? 0;
    const truceRequired = standing < 0;
    const truceExpiresAt = truceRequired ? await this.getActiveTruceExpiry(accountId, sectorId, factionId) : null;
    const truceActive = truceExpiresAt !== null;

    return {
      cleared: !truceRequired || truceActive,
      planetId: planet.id,
      planetName: planet.name,
      sectorId,
      factionId,
      factionName: FACTION_METADATA[factionId as FactionId]?.name || factionId,
      standing,
      truceRequired,
      truceActive,
      truceExpiresAt,
    };
  }

  /**
   * Day 21: Throws TRUCE_REQUIRED if the pilot lacks airspace clearance around a planet.
   */
  public async assertAirspaceClearance(accountId: string, planetId: string, actionLabel: string): Promise<AirspaceClearance> {
    const clearance = await this.getAirspaceClearance(accountId, planetId);
    if (!clearance.cleared) {
      throw new Error(
        `TRUCE_REQUIRED: ${clearance.factionName} airspace over ${clearance.planetName}. ${actionLabel} denied without an active ceasefire truce (standing ${clearance.standing}). Hail the sector patrol to negotiate.`
      );
    }
    return clearance;
  }

  /**
   * Debug: Force-expire all active truces for an account (optionally scoped to a sector/faction).
   */
  public async debugExpireTruces(accountId: string, sectorId?: number, factionId?: string): Promise<number> {
    const conditions = ['account_id = $1', 'expires_at > NOW()'];
    const params: any[] = [accountId];
    if (sectorId !== undefined) {
      params.push(sectorId);
      conditions.push(`sector_id = $${params.length}`);
    }
    if (factionId) {
      params.push(factionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : factionId);
      conditions.push(`faction_id = $${params.length}`);
    }
    const { rows } = await db.query<{ id: string }>(
      `UPDATE diplomatic_truces SET expires_at = NOW() - INTERVAL '1 second' WHERE ${conditions.join(' AND ')} RETURNING id`,
      params
    );
    return rows.length;
  }

  /**
   * Breaks an active truce immediately (e.g. if player attacks a faction patrol).
   */
  public async breakTruce(
    accountId: string,
    sectorId: number,
    factionId: string
  ): Promise<boolean> {
    const normalized = normalizeFactionId(factionId);
    const res = await db.query(
      `DELETE FROM diplomatic_truces WHERE account_id = $1 AND sector_id = $2 AND faction_id = $3`,
      [accountId, sectorId, normalized]
    );
    return (res as any)?.rowCount > 0;
  }

  /**
   * Verifies if player is permitted to dock at a port controlled by a faction.
   * If NEMESIS (<= -60), docking is locked out with shields active.
   */
  public async canDockAtStation(
    accountId: string,
    controllingFaction: string = 'FACTION_SOL'
  ): Promise<{ permitted: boolean; tier: StandingTier; standing: number; reason?: string }> {
    const normalized = normalizeFactionId(controllingFaction);
    const standings = await this.getStandings(accountId);
    const item = standings.find((s) => s.factionId === normalized);
    const standing = item ? item.standing : 0;
    const tier = item ? item.tier : 'NEUTRAL';

    if (tier === 'NEMESIS') {
      return {
        permitted: false,
        tier,
        standing,
        reason: `STATION LOCKDOWN: Station shields active. Docking clamps denied to designated Nemesis of ${FACTION_METADATA[normalized]?.name || controllingFaction}. Destroy faction rivals to restore clearance.`,
      };
    }

    return {
      permitted: true,
      tier,
      standing,
    };
  }

  /**
   * Computes the trade price multiplier based on faction standing.
   * Honored = 0.85 (-15%), Friendly = 0.95 (-5%), Neutral = 1.0, Hostile = 1.25 (+25%), Nemesis = 1.50 (+50%).
   */
  public async calculateMarketMultiplier(
    accountId: string,
    controllingFaction: string = 'FACTION_SOL'
  ): Promise<number> {
    const normalized = normalizeFactionId(controllingFaction);
    const standings = await this.getStandings(accountId);
    const standing = standings.find((s) => s.factionId === normalized);
    if (!standing) return 1.0;

    if (standing.tier === 'HONORED') return 0.85;
    if (standing.tier === 'FRIENDLY') return 0.95;
    if (standing.tier === 'NEUTRAL') return 1.0;
    if (standing.tier === 'HOSTILE') return 1.25;
    if (standing.tier === 'NEMESIS') return 1.50;
    return 1.0;
  }
}

export const reputationService = new ReputationService();


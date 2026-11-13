import { db } from '../db/Database';
import { tradeService } from './TradeService';
import { reputationService, type FactionId } from './ReputationService';

export interface ConvoyCargoItem {
  commodityId: string;
  name: string;
  quantity: number;
  unitValue: number;
}

export type ConvoyType = 'COMMERCE' | 'TITHE_HAULER' | 'SMUGGLER' | 'ORE_BARGE';
export type ConvoyStatus = 'IN_TRANSIT' | 'DOCKED' | 'INTERDICTED' | 'DESTROYED' | 'SURRENDERED';

export interface Convoy {
  id: string;
  faction_id: string;
  convoy_type: ConvoyType;
  name: string;
  hauler_hull: string;
  escort_count: number;
  cargo_manifest: ConvoyCargoItem[];
  origin_port_id: string | null;
  destination_port_id: string | null;
  current_sector_id: number;
  target_sector_id: number | null;
  route_path: number[];
  departure_time: string;
  arrival_time: string;
  status: ConvoyStatus;
  warp_charge_seconds: number;
  created_at?: string;
  updated_at?: string;
  // Computed runtime fields
  etaSeconds?: number;
  transitProgress?: number; // 0.0 to 1.0
  totalCargoValue?: number;
}

export interface SectorSkirmish {
  id: string;
  sector_id: number;
  initiator_faction_id: string;
  defender_faction_id: string;
  status: 'ACTIVE' | 'RESOLVED_INITIATOR' | 'RESOLVED_DEFENDER' | 'EXPIRED';
  influence_shift: number;
  hazard_level: 'MODERATE' | 'HIGH' | 'EXTREME';
  briefing: string;
  start_time: string;
  expires_at: string;
}

export interface EscortContract {
  id: string;
  convoy_id: string;
  account_id: string;
  reward_credits: number;
  reputation_gain: number;
  status: 'AVAILABLE' | 'ACCEPTED' | 'COMPLETED' | 'FAILED';
  accepted_at?: string;
  completed_at?: string;
  convoy?: Convoy;
}

export class ConvoyService {
  /**
   * Retrieves active convoys, optionally filtered by sector
   */
  public async getActiveConvoys(sectorId?: number): Promise<Convoy[]> {
    let query = `SELECT * FROM convoys WHERE status IN ('IN_TRANSIT', 'INTERDICTED')`;
    const params: any[] = [];

    if (sectorId !== undefined) {
      params.push(sectorId);
      query += ` AND current_sector_id = $1`;
    }
    query += ` ORDER BY departure_time ASC`;

    const { rows } = await db.query<any>(query, params);
    return rows.map((r) => this.formatConvoy(r));
  }

  /**
   * Retrieves a single convoy by ID
   */
  public async getConvoyById(convoyId: string): Promise<Convoy | null> {
    const { rows } = await db.query<any>(`SELECT * FROM convoys WHERE id = $1`, [convoyId]);
    if (rows.length === 0) return null;
    return this.formatConvoy(rows[0]);
  }

  /**
   * Retrieves active contested sector skirmishes
   */
  public async getActiveSkirmishes(sectorId?: number): Promise<SectorSkirmish[]> {
    let query = `SELECT * FROM sector_skirmishes WHERE status = 'ACTIVE' AND expires_at > NOW()`;
    const params: any[] = [];
    if (sectorId !== undefined) {
      params.push(sectorId);
      query += ` AND sector_id = $1`;
    }
    query += ` ORDER BY start_time ASC`;

    const { rows } = await db.query<SectorSkirmish>(query, params);
    return rows;
  }

  /**
   * Retrieves available and accepted escort contracts
   */
  public async getEscortContracts(accountId: string): Promise<EscortContract[]> {
    const activeConvoys = await this.getActiveConvoys();
    const activeConvoyMap = new Map(activeConvoys.map((c) => [c.id, c]));

    // Query existing contracts
    const { rows: contractRows } = await db.query<any>(
      `SELECT * FROM escort_contracts WHERE account_id = $1 ORDER BY accepted_at DESC`,
      [accountId]
    );
    const existingConvoyIds = new Set(contractRows.map((c) => c.convoy_id));

    // For any active in-transit convoy that has no contract yet, generate an AVAILABLE contract offer
    const availableContracts: EscortContract[] = [];
    for (const convoy of activeConvoys) {
      if (!existingConvoyIds.has(convoy.id) && convoy.status === 'IN_TRANSIT') {
        const totalValue = convoy.totalCargoValue || 1000;
        const rewardCredits = Math.round(totalValue * 0.25); // 25% security bounty
        const reputationGain = convoy.convoy_type === 'TITHE_HAULER' ? 25 : 15;
        availableContracts.push({
          id: `escort_${convoy.id}_${Date.now()}`,
          convoy_id: convoy.id,
          account_id: accountId,
          reward_credits: rewardCredits,
          reputation_gain: reputationGain,
          status: 'AVAILABLE',
          convoy,
        });
      }
    }

    const existingContracts: EscortContract[] = contractRows.map((row) => ({
      ...row,
      convoy: activeConvoyMap.get(row.convoy_id),
    }));

    return [...existingContracts, ...availableContracts];
  }

  /**
   * Accepts an escort contract for a specific convoy
   */
  public async acceptEscortContract(accountId: string, convoyId: string): Promise<{ success: boolean; contract?: EscortContract; error?: string }> {
    const convoy = await this.getConvoyById(convoyId);
    if (!convoy) {
      return { success: false, error: 'CONVOY_NOT_FOUND: Specified convoy does not exist.' };
    }
    if (convoy.status !== 'IN_TRANSIT') {
      return { success: false, error: 'CONVOY_NOT_IN_TRANSIT: Convoy is no longer traversing jump lanes.' };
    }

    // Check if player is hostile/nemesis with convoy faction
    const standings = await reputationService.getStandings(accountId);
    const normalizedFaction = (convoy.faction_id === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : convoy.faction_id) as FactionId;
    const factionStanding = standings.find((s) => s.factionId === normalizedFaction)?.standing ?? 0;
    if (factionStanding < -20) {
      return {
        success: false,
        error: `HOSTILE_CLEARANCE_DENIED: Cannot accept security contract for ${convoy.faction_id} with hostile standing (${factionStanding}).`,
      };
    }

    const totalValue = convoy.totalCargoValue || 1000;
    const rewardCredits = Math.round(totalValue * 0.25);
    const reputationGain = convoy.convoy_type === 'TITHE_HAULER' ? 25 : 15;
    const contractId = `escort_${convoy.id}_${Date.now()}`;

    await db.query(
      `INSERT INTO escort_contracts (id, convoy_id, account_id, reward_credits, reputation_gain, status, accepted_at)
       VALUES ($1, $2, $3, $4, $5, 'ACCEPTED', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACCEPTED', accepted_at = NOW()`,
      [contractId, convoyId, accountId, rewardCredits, reputationGain]
    );

    const contract: EscortContract = {
      id: contractId,
      convoy_id: convoyId,
      account_id: accountId,
      reward_credits: rewardCredits,
      reputation_gain: reputationGain,
      status: 'ACCEPTED',
      accepted_at: new Date().toISOString(),
      convoy,
    };

    return { success: true, contract };
  }

  /**
   * Claims reward for successfully escorted convoy
   */
  public async claimEscortContract(accountId: string, convoyId: string): Promise<{ success: boolean; rewardCredits?: number; reputationGain?: number; error?: string }> {
    const { rows } = await db.query<any>(
      `SELECT * FROM escort_contracts WHERE account_id = $1 AND convoy_id = $2 AND status = 'ACCEPTED'`,
      [accountId, convoyId]
    );
    if (rows.length === 0) {
      return { success: false, error: 'NO_ACTIVE_CONTRACT: No active accepted escort contract found for this convoy.' };
    }

    const contract = rows[0];
    const convoy = await this.getConvoyById(convoyId);

    // Contract can be claimed if convoy is DOCKED (reached destination)
    if (!convoy || convoy.status !== 'DOCKED') {
      return { success: false, error: 'CONVOY_NOT_DELIVERED: Convoy has not safely reached its destination port yet.' };
    }

    // Award credits
    await db.query(`UPDATE accounts SET credits = credits + $1 WHERE id = $2`, [contract.reward_credits, accountId]);

    // Award reputation
    const normalizedFaction = (convoy.faction_id === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : convoy.faction_id) as FactionId;
    await reputationService.modifyStanding(
      accountId,
      normalizedFaction,
      contract.reputation_gain,
      `Escort Contract Completion: ${convoy.name}`
    );

    // Mark contract completed
    await db.query(
      `UPDATE escort_contracts SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
      [contract.id]
    );

    return {
      success: true,
      rewardCredits: contract.reward_credits,
      reputationGain: contract.reputation_gain,
    };
  }

  /**
   * Advances convoy transit timelines across the sector graph
   */
  public async advanceConvoySchedules(deltaMinutes: number): Promise<{ updatedCount: number; transitionedConvoys: any[] }> {
    const convoys = await this.getActiveConvoys();
    const transitioned: any[] = [];

    for (const convoy of convoys) {
      const dep = new Date(convoy.departure_time).getTime();
      const arr = new Date(convoy.arrival_time).getTime();
      const totalDuration = Math.max(1000, arr - dep);

      // Fast-forward arrival
      const newArrival = new Date(arr - deltaMinutes * 60 * 1000);
      const now = Date.now();

      if (now >= newArrival.getTime()) {
        // Convoy arrived at destination port!
        await this.updateConvoyStatus(convoy.id, 'DOCKED');
        await this.deliverConvoyCargo(convoy.id);
        transitioned.push({
          id: convoy.id,
          name: convoy.name,
          event: 'ARRIVED_AND_DOCKED',
          port: convoy.destination_port_id,
        });
      } else {
        // Move along route_path sectors if multi-sector jump
        const elapsedRatio = (now - dep) / totalDuration;
        const route = convoy.route_path || [convoy.current_sector_id];
        const stepIndex = Math.min(route.length - 1, Math.floor(elapsedRatio * route.length));
        const newSectorId = route[stepIndex];
        const nextSectorId = stepIndex + 1 < route.length ? route[stepIndex + 1] : newSectorId;

        if (newSectorId !== convoy.current_sector_id) {
          await db.query(
            `UPDATE convoys SET current_sector_id = $1, target_sector_id = $2, updated_at = NOW() WHERE id = $3`,
            [newSectorId, nextSectorId, convoy.id]
          );
          transitioned.push({
            id: convoy.id,
            name: convoy.name,
            event: 'SECTOR_TRANSITION',
            fromSector: convoy.current_sector_id,
            toSector: newSectorId,
          });
        }
      }
    }

    return { updatedCount: transitioned.length, transitionedConvoys: transitioned };
  }

  /**
   * Delivers convoy cargo to destination port, restocking port_inventory and easing prices
   */
  public async deliverConvoyCargo(convoyId: string): Promise<void> {
    const convoy = await this.getConvoyById(convoyId);
    if (!convoy || !convoy.destination_port_id) return;

    for (const item of convoy.cargo_manifest) {
      const { rows } = await db.query<any>(
        `SELECT * FROM port_inventory WHERE port_id = $1 AND commodity_id = $2`,
        [convoy.destination_port_id, item.commodityId]
      );
      if (rows.length > 0) {
        const row = rows[0];
        const newStock = Math.min(row.capacity, row.stock + item.quantity);
        const { buyPrice, sellPrice } = tradeService.calculatePrices(
          item.commodityId,
          newStock,
          row.demand,
          row.capacity
        );
        await db.query(
          `UPDATE port_inventory
           SET stock = $1, buy_price = $2, sell_price = $3
           WHERE port_id = $4 AND commodity_id = $5`,
          [newStock, buyPrice, sellPrice, convoy.destination_port_id, item.commodityId]
        );
      }
    }
  }

  /**
   * Records a convoy raid / interception: marks status as SURRENDERED or DESTROYED
   * and drains destination port stock (supply shortage causing price spike)
   */
  public async recordConvoyRaid(convoyId: string, status: 'SURRENDERED' | 'DESTROYED' = 'SURRENDERED'): Promise<{ success: boolean; shortageSummary: string }> {
    const convoy = await this.getConvoyById(convoyId);
    if (!convoy) {
      return { success: false, shortageSummary: 'Convoy not found.' };
    }

    await this.updateConvoyStatus(convoyId, status);

    // Apply shortage to destination port (drains 30% of existing stock to create immediate scarcity)
    let summaryParts: string[] = [];
    if (convoy.destination_port_id) {
      for (const item of convoy.cargo_manifest) {
        const { rows } = await db.query<any>(
          `SELECT * FROM port_inventory WHERE port_id = $1 AND commodity_id = $2`,
          [convoy.destination_port_id, item.commodityId]
        );
        if (rows.length > 0) {
          const row = rows[0];
          const newStock = Math.max(10, Math.round(row.stock * 0.7));
          const { buyPrice, sellPrice } = tradeService.calculatePrices(
            item.commodityId,
            newStock,
            row.demand,
            row.capacity
          );
          await db.query(
            `UPDATE port_inventory
             SET stock = $1, buy_price = $2, sell_price = $3
             WHERE port_id = $4 AND commodity_id = $5`,
            [newStock, buyPrice, sellPrice, convoy.destination_port_id, item.commodityId]
          );
          summaryParts.push(`${item.name} (-30% Port Stock Shortage)`);
        }
      }
    }

    return {
      success: true,
      shortageSummary: `Supply shortage triggered at ${convoy.destination_port_id || 'destination'}: ${summaryParts.join(', ')}`,
    };
  }

  /**
   * Updates convoy status
   */
  public async updateConvoyStatus(id: string, status: ConvoyStatus): Promise<boolean> {
    const { rows } = await db.query(`UPDATE convoys SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [status, id]);
    return rows.length > 0;
  }

  /**
   * Resolves a contested sector skirmish, shifting sector influence and faction standing
   */
  public async resolveSkirmish(
    skirmishId: string,
    winningFactionId: string,
    accountId?: string
  ): Promise<{ success: boolean; influenceShift: number; message: string }> {
    const { rows } = await db.query<SectorSkirmish>(`SELECT * FROM sector_skirmishes WHERE id = $1`, [skirmishId]);
    if (rows.length === 0) {
      return { success: false, influenceShift: 0, message: 'Skirmish not found.' };
    }
    const skirmish = rows[0];

    await db.query(
      `UPDATE sector_skirmishes SET status = 'RESOLVED_INITIATOR', updated_at = NOW() WHERE id = $1`,
      [skirmishId]
    );

    if (accountId) {
      const normalizedWinningFaction = (winningFactionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : winningFactionId) as FactionId;
      await reputationService.modifyStanding(
        accountId,
        normalizedWinningFaction,
        skirmish.influence_shift,
        `Contested Sector Victory: Sector ${skirmish.sector_id}`
      );
    }

    return {
      success: true,
      influenceShift: skirmish.influence_shift,
      message: `Sector ${skirmish.sector_id} skirmish resolved in favor of ${winningFactionId}.`,
    };
  }

  /**
   * Formats raw SQL row with computed properties
   */
  private formatConvoy(r: any): Convoy {
    const manifest: ConvoyCargoItem[] = typeof r.cargo_manifest === 'string'
      ? JSON.parse(r.cargo_manifest)
      : (r.cargo_manifest || []);

    const now = Date.now();
    const dep = new Date(r.departure_time).getTime();
    const arr = new Date(r.arrival_time).getTime();
    const duration = Math.max(1000, arr - dep);
    const etaSeconds = Math.max(0, Math.round((arr - now) / 1000));
    const transitProgress = Math.min(1.0, Math.max(0.0, (now - dep) / duration));

    const totalCargoValue = manifest.reduce((acc, item) => acc + (item.quantity * item.unitValue), 0);

    return {
      id: r.id,
      faction_id: r.faction_id,
      convoy_type: r.convoy_type,
      name: r.name,
      hauler_hull: r.hauler_hull,
      escort_count: r.escort_count,
      cargo_manifest: manifest,
      origin_port_id: r.origin_port_id,
      destination_port_id: r.destination_port_id,
      current_sector_id: r.current_sector_id,
      target_sector_id: r.target_sector_id,
      route_path: r.route_path || [],
      departure_time: r.departure_time,
      arrival_time: r.arrival_time,
      status: r.status,
      warp_charge_seconds: parseFloat(r.warp_charge_seconds || '30'),
      created_at: r.created_at,
      updated_at: r.updated_at,
      etaSeconds,
      transitProgress,
      totalCargoValue,
    };
  }

  /**
   * Resets convoys and skirmishes to initial baseline state (for testing)
   */
  public async debugReset(): Promise<void> {
    await db.query(`DELETE FROM escort_contracts`);
    await db.query(`DELETE FROM sector_skirmishes`);
    await db.query(`DELETE FROM convoys`);

    // Re-insert baseline seeds
    await db.query(`
      INSERT INTO convoys (
          id, faction_id, convoy_type, name, hauler_hull, escort_count,
          cargo_manifest, origin_port_id, destination_port_id, current_sector_id,
          target_sector_id, route_path, departure_time, arrival_time, status, warp_charge_seconds
      ) VALUES
      (
          'convoy_hegemony_tithe_01',
          'FACTION_VAELIC',
          'TITHE_HAULER',
          'Vaelic Imperial Tithe Carrier IX',
          'HEGEMONY_TITHE_CARRIER',
          2,
          '[{"commodityId": "COMM_ORE", "name": "Silicate Ore", "quantity": 40, "unitValue": 70}, {"commodityId": "COMM_ALLOY", "name": "Plasteel Alloy", "quantity": 25, "unitValue": 150}]'::jsonb,
          'PORT_SMELTER_01',
          'PORT_AEGIS_01',
          2,
          1,
          ARRAY[3, 2, 1],
          NOW() - INTERVAL '2 minutes',
          NOW() + INTERVAL '4 minutes',
          'IN_TRANSIT',
          30.0
      ),
      (
          'convoy_sol_freight_01',
          'FACTION_SOL',
          'COMMERCE',
          'Sol-Perimeter Bulk Freighter Atlas',
          'SOL_HEAVY_FREIGHTER',
          2,
          '[{"commodityId": "COMM_RATIONS", "name": "Bio-Protein Rations", "quantity": 50, "unitValue": 35}, {"commodityId": "COMM_FUEL", "name": "Deuterium Fuel", "quantity": 30, "unitValue": 20}]'::jsonb,
          'PORT_AEGIS_01',
          'PORT_SMELTER_01',
          1,
          2,
          ARRAY[1, 2, 3],
          NOW() - INTERVAL '1 minute',
          NOW() + INTERVAL '5 minutes',
          'IN_TRANSIT',
          30.0
      ),
      (
          'convoy_kryll_smuggler_01',
          'FACTION_KRYLL',
          'SMUGGLER',
          'Cartel Shadow Runner Skrit-Luck',
          'KRYLL_BLOCKADE_RUNNER',
          1,
          '[{"commodityId": "COMM_CONTRABAND", "name": "Neuro-Stimulant Ampoules", "quantity": 15, "unitValue": 280}]'::jsonb,
          'PORT_SMELTER_01',
          'PORT_AEGIS_01',
          2,
          1,
          ARRAY[3, 2, 1],
          NOW(),
          NOW() + INTERVAL '3 minutes',
          'IN_TRANSIT',
          25.0
      )
    `);

    await db.query(`
      INSERT INTO sector_skirmishes (
          id, sector_id, initiator_faction_id, defender_faction_id, status, influence_shift, hazard_level, briefing, start_time, expires_at
      ) VALUES
      (
          'skirmish_sec2_hegemony_kryll',
          2,
          'FACTION_VAELIC',
          'FACTION_KRYLL',
          'ACTIVE',
          20,
          'HIGH',
          'Vaelic interdictor patrols have intercepted a Kryll Free Cartel raiding party near the Charybdis jump corridor. Heavy plasma and flak fire detected.',
          NOW(),
          NOW() + INTERVAL '45 minutes'
      )
    `);
  }
}

export const convoyService = new ConvoyService();

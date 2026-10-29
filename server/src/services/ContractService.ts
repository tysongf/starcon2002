import { db } from '../db/Database';

export interface KillmailRecord {
  id: string;
  victimAccountId: string;
  killerId: string;
  killerName: string;
  sectorId: number;
  lossValuation: number;
  droppedItems: any[];
  destroyedItems: any[];
  createdAt: string;
}

export interface RevengeContract {
  id: string;
  creatorAccountId: string;
  contractType: string;
  targetScavengerId: string | null;
  targetName: string;
  targetEntityId: string | null;
  isPublic: boolean;
  rewardCredits: number;
  status: 'OPEN' | 'COMPLETED' | 'EXPIRED';
  createdAt: string;
}

export class ContractService {
  /**
   * Records a permanent killmail upon player vessel destruction.
   */
  public async createKillmail(
    victimAccountId: string,
    killerId: string,
    killerName: string,
    sectorId: number,
    lossValuation: number,
    droppedItems: any[] = [],
    destroyedItems: any[] = []
  ): Promise<KillmailRecord> {
    const { rows } = await db.query<any>(
      `INSERT INTO killmails (
        victim_account_id, killer_id, killer_name, sector_id, loss_valuation, dropped_items, destroyed_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        victimAccountId,
        killerId,
        killerName,
        sectorId,
        lossValuation,
        JSON.stringify(droppedItems),
        JSON.stringify(destroyedItems),
      ]
    );

    const r = rows[0];
    return {
      id: r.id,
      victimAccountId: r.victim_account_id,
      killerId: r.killer_id,
      killerName: r.killer_name,
      sectorId: r.sector_id,
      lossValuation: parseInt(r.loss_valuation, 10),
      droppedItems: typeof r.dropped_items === 'string' ? JSON.parse(r.dropped_items) : r.dropped_items,
      destroyedItems: typeof r.destroyed_items === 'string' ? JSON.parse(r.destroyed_items) : r.destroyed_items,
      createdAt: r.created_at,
    };
  }

  /**
   * Retrieves killmails for a specific victim or player account.
   */
  public async getKillmails(accountId: string = 'acc_sol_captain'): Promise<KillmailRecord[]> {
    const { rows } = await db.query<any>(
      `SELECT * FROM killmails WHERE victim_account_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [accountId]
    );

    return rows.map((r) => ({
      id: r.id,
      victimAccountId: r.victim_account_id,
      killerId: r.killer_id,
      killerName: r.killer_name,
      sectorId: r.sector_id,
      lossValuation: parseInt(r.loss_valuation, 10),
      droppedItems: typeof r.dropped_items === 'string' ? JSON.parse(r.dropped_items) : r.dropped_items,
      destroyedItems: typeof r.destroyed_items === 'string' ? JSON.parse(r.destroyed_items) : r.destroyed_items,
      createdAt: r.created_at,
    }));
  }

  /**
   * Retrieves active bounty contracts (public or player-owned).
   */
  public async getContracts(onlyPublic: boolean = false, accountId?: string): Promise<RevengeContract[]> {
    let sql = `SELECT * FROM contracts WHERE status = 'OPEN'`;
    const params: any[] = [];

    if (onlyPublic) {
      sql += ` AND is_public = true`;
    } else if (accountId) {
      sql += ` AND (is_public = true OR creator_account_id = $1)`;
      params.push(accountId);
    }
    sql += ` ORDER BY reward_credits DESC, created_at DESC`;

    const { rows } = await db.query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      creatorAccountId: r.creator_account_id,
      contractType: r.contract_type,
      targetScavengerId: r.target_scavenger_id,
      targetName: r.target_name || 'Hostile Vessel',
      targetEntityId: r.target_entity_id,
      isPublic: r.is_public,
      rewardCredits: parseInt(r.reward_credits, 10),
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  /**
   * Fetches a specific revenge contract by ID for shareable web links.
   */
  public async getContractById(contractId: string): Promise<RevengeContract | null> {
    const { rows } = await db.query<any>(
      `SELECT * FROM contracts WHERE id = $1 LIMIT 1`,
      [contractId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      creatorAccountId: r.creator_account_id,
      contractType: r.contract_type,
      targetScavengerId: r.target_scavenger_id,
      targetName: r.target_name || 'Hostile Vessel',
      targetEntityId: r.target_entity_id,
      isPublic: r.is_public,
      rewardCredits: parseInt(r.reward_credits, 10),
      status: r.status,
      createdAt: r.created_at,
    };
  }

  /**
   * Posts a new revenge bounty contract against a target killer or persistent scavenger.
   */
  public async createRevengeContract(
    creatorAccountId: string,
    targetName: string,
    targetEntityId: string | null = null,
    rewardCredits: number = 2500,
    isPublic: boolean = true
  ): Promise<RevengeContract> {
    // Deduct bounty escrow from creator's credits (subsidized by Aegis Insurance if balance is insufficient)
    const accRes = await db.query<{ credits: number }>(
      'SELECT credits FROM accounts WHERE id = $1',
      [creatorAccountId]
    );
    const balance = accRes.rows[0]?.credits ?? 0;
    const deduction = Math.min(balance, rewardCredits);
    if (deduction > 0) {
      await db.query(
        'UPDATE accounts SET credits = credits - $1 WHERE id = $2',
        [deduction, creatorAccountId]
      );
    }

    // Optional foreign key match if target is a persistent scavenger
    let targetScavengerId: string | null = null;
    if (targetEntityId) {
      const scavCheck = await db.query('SELECT id FROM persistent_scavengers WHERE id = $1', [targetEntityId]);
      if (scavCheck.rows.length > 0) {
        targetScavengerId = targetEntityId;
      }
    }

    const { rows } = await db.query<any>(
      `INSERT INTO contracts (
        creator_account_id, contract_type, target_scavenger_id, target_name, target_entity_id, is_public, reward_credits, status
      ) VALUES ($1, 'REVENGE_BOUNTY', $2, $3, $4, $5, $6, 'OPEN')
      RETURNING *`,
      [creatorAccountId, targetScavengerId, targetName, targetEntityId, isPublic, rewardCredits]
    );

    const r = rows[0];
    return {
      id: r.id,
      creatorAccountId: r.creator_account_id,
      contractType: r.contract_type,
      targetScavengerId: r.target_scavenger_id,
      targetName: r.target_name,
      targetEntityId: r.target_entity_id,
      isPublic: r.is_public,
      rewardCredits: parseInt(r.reward_credits, 10),
      status: r.status,
      createdAt: r.created_at,
    };
  }

  /**
   * Reissues basic standard frigate upon docking escape pod at station clinic.
   */
  public async claimReplacementFrigate(accountId: string = 'acc_sol_captain'): Promise<any> {
    // Reset player ship to standard frigate stats
    await db.query(
      `UPDATE ships 
       SET armor = max_armor, shield = max_shield, updated_at = NOW()
       WHERE account_id = $1`,
      [accountId]
    );

    // Ensure baseline starter modules exist in loadout
    const invRes = await db.query(
      `SELECT * FROM player_inventory WHERE account_id = $1 AND is_fitted = true`,
      [accountId]
    );

    // If zero modules fitted (e.g. lost in catastrophic explosion), reissue standard Sol-Standard Pulse Cannon
    if (invRes.rows.length === 0) {
      await db.query(
        `INSERT INTO player_inventory (account_id, blueprint_id, custom_name, rarity, is_fitted, fit_slot)
         VALUES ($1, 'MOD_PULSE_01', 'Sol-Standard Emergency Pulse Cannon', 'COMMON', true, 'H1')`,
        [accountId]
      );
    }

    const updatedShip = await db.query('SELECT * FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    return {
      success: true,
      message: 'Standard Sol Cutter frigate reissued by Aegis Naval Command.',
      ship: updatedShip.rows[0],
    };
  }
}

export const contractService = new ContractService();

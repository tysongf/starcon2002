import { db } from '../db/Database';
import { LootGenerator, DroppedModule } from './LootGenerator';

export interface FittedModule {
  id: string;
  blueprintId: string;
  name: string;
  customName: string;
  slotType: 'HIGH' | 'MID' | 'LOW';
  category: string;
  manufacturer: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  powerGridCost: number;
  cpuCost: number;
  basePrice: number;
  baseStats: Record<string, any>;
  affixes: any[];
  isFitted: boolean;
  fitSlot: string | null;
  description: string;
}

export interface PlayerLoadout {
  accountId: string;
  shipClass: string;
  powerGridMax: number;
  powerGridUsed: number;
  cpuMax: number;
  cpuUsed: number;
  fitted: Record<'H1' | 'H2' | 'M1' | 'M2' | 'L1' | 'L2', FittedModule | null>;
  locker: FittedModule[];
}

export class OutfittingService {
  public async getCatalog(): Promise<any[]> {
    const { rows } = await db.query(
      'SELECT * FROM equipment_blueprints ORDER BY slot_type DESC, base_price ASC'
    );
    return rows;
  }

  public async getPlayerLoadout(accountId: string = 'acc_sol_captain'): Promise<PlayerLoadout> {
    const shipRes = await db.query(
      'SELECT * FROM ships WHERE account_id = $1 LIMIT 1',
      [accountId]
    );
    const ship = shipRes.rows[0] as any;
    const powerGridMax = ship?.power_grid_max || 120.0;
    const cpuMax = ship?.cpu_max || 180.0;

    const query = `
      SELECT 
        pi.id,
        pi.blueprint_id as "blueprintId",
        eb.name,
        pi.custom_name as "customName",
        eb.slot_type as "slotType",
        eb.category,
        eb.manufacturer,
        pi.rarity,
        eb.power_grid_cost as "powerGridCost",
        eb.cpu_cost as "cpuCost",
        eb.base_price as "basePrice",
        eb.base_stats as "baseStats",
        pi.affixes,
        pi.is_fitted as "isFitted",
        pi.fit_slot as "fitSlot",
        eb.description
      FROM player_inventory pi
      JOIN equipment_blueprints eb ON pi.blueprint_id = eb.id
      WHERE pi.account_id = $1
      ORDER BY pi.created_at ASC
    `;

    const { rows } = await db.query(query, [accountId]);

    const fitted: Record<'H1' | 'H2' | 'M1' | 'M2' | 'L1' | 'L2', FittedModule | null> = {
      H1: null,
      H2: null,
      M1: null,
      M2: null,
      L1: null,
      L2: null,
    };
    const locker: FittedModule[] = [];
    let powerGridUsed = 0;
    let cpuUsed = 0;

    for (const raw of rows as any[]) {
      const mod: FittedModule = {
        ...raw,
        powerGridCost: Number(raw.powerGridCost),
        cpuCost: Number(raw.cpuCost),
        basePrice: Number(raw.basePrice),
        baseStats: typeof raw.baseStats === 'string' ? JSON.parse(raw.baseStats) : raw.baseStats,
        affixes: typeof raw.affixes === 'string' ? JSON.parse(raw.affixes) : raw.affixes,
      };

      if (mod.isFitted && mod.fitSlot && (mod.fitSlot in fitted)) {
        fitted[mod.fitSlot as keyof typeof fitted] = mod;
        powerGridUsed += mod.powerGridCost;
        cpuUsed += mod.cpuCost;
      } else {
        locker.push(mod);
      }
    }

    return {
      accountId,
      shipClass: ship?.hull_class || 'CORVETTE',
      powerGridMax,
      powerGridUsed: Math.round(powerGridUsed * 10) / 10,
      cpuMax,
      cpuUsed: Math.round(cpuUsed * 10) / 10,
      fitted,
      locker,
    };
  }

  public async fitModule(
    accountId: string,
    itemId: string,
    targetSlot: 'H1' | 'H2' | 'M1' | 'M2' | 'L1' | 'L2'
  ): Promise<PlayerLoadout> {
    const current = await this.getPlayerLoadout(accountId);

    // Verify item exists in inventory
    const allItems = [...Object.values(current.fitted).filter(Boolean), ...current.locker] as FittedModule[];
    const item = allItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Module item ${itemId} not found in player inventory.`);
    }

    // Verify slot type matches
    const expectedSlotType = targetSlot.startsWith('H') ? 'HIGH' : targetSlot.startsWith('M') ? 'MID' : 'LOW';
    if (item.slotType !== expectedSlotType) {
      throw new Error(`Cannot fit ${item.slotType} module into ${targetSlot} (${expectedSlotType}) slot.`);
    }

    // Calculate budget delta
    const currentInSlot = current.fitted[targetSlot];
    const oldPg = currentInSlot ? currentInSlot.powerGridCost : 0;
    const oldCpu = currentInSlot ? currentInSlot.cpuCost : 0;
    const itemOldSlotPg = item.isFitted ? item.powerGridCost : 0;
    const itemOldSlotCpu = item.isFitted ? item.cpuCost : 0;

    const projectedPg = current.powerGridUsed - oldPg - itemOldSlotPg + item.powerGridCost;
    const projectedCpu = current.cpuUsed - oldCpu - itemOldSlotCpu + item.cpuCost;

    if (projectedPg > current.powerGridMax) {
      throw new Error(
        `OVER_CAPACITY: Power-Grid exceeded! (${projectedPg.toFixed(1)} / ${current.powerGridMax} MW)`
      );
    }
    if (projectedCpu > current.cpuMax) {
      throw new Error(
        `OVER_CAPACITY: CPU limit exceeded! (${projectedCpu.toFixed(1)} / ${current.cpuMax} tf)`
      );
    }

    // Execute slot swap in DB
    if (currentInSlot && currentInSlot.id !== item.id) {
      await db.query(
        'UPDATE player_inventory SET is_fitted = false, fit_slot = NULL WHERE id = $1',
        [currentInSlot.id]
      );
    }

    await db.query(
      'UPDATE player_inventory SET is_fitted = true, fit_slot = $1 WHERE id = $2',
      [targetSlot, item.id]
    );

    return this.getPlayerLoadout(accountId);
  }

  public async unfitModule(accountId: string, itemId?: string, slot?: string): Promise<PlayerLoadout> {
    if (slot) {
      await db.query(
        'UPDATE player_inventory SET is_fitted = false, fit_slot = NULL WHERE fit_slot = $1 AND account_id = $2',
        [slot, accountId]
      );
    } else if (itemId) {
      await db.query(
        'UPDATE player_inventory SET is_fitted = false, fit_slot = NULL WHERE id = $1 AND account_id = $2',
        [itemId, accountId]
      );
    }
    return this.getPlayerLoadout(accountId);
  }

  public async buyModule(accountId: string, blueprintId: string): Promise<{ success: boolean; item: any; remainingCredits: number; credits: number }> {
    const bpRes = await db.query(
      'SELECT * FROM equipment_blueprints WHERE id = $1',
      [blueprintId]
    );
    if (bpRes.rows.length === 0) {
      throw new Error(`Blueprint ${blueprintId} not found.`);
    }
    const bp = bpRes.rows[0] as any;
    const price = Number(bp.base_price || 400);

    const accRes = await db.query('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = Number(accRes.rows[0]?.credits || 0);

    if (credits < price) {
      throw new Error(`Insufficient credits. Required: ${price} Cr, available: ${credits} Cr.`);
    }

    // Deduct credits
    const newCredits = credits - price;
    await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [newCredits, accountId]);

    // Generate rolled item
    const drop = LootGenerator.generateDrop([bp], bp.base_rarity);

    const insertRes = await db.query(
      `INSERT INTO player_inventory (account_id, blueprint_id, custom_name, rarity, affixes, is_fitted, fit_slot)
       VALUES ($1, $2, $3, $4, $5, false, NULL)
       RETURNING *`,
      [accountId, bp.id, drop.customName, drop.rarity, JSON.stringify(drop.affixes)]
    );

    return {
      success: true,
      item: insertRes.rows[0],
      remainingCredits: newCredits,
      credits: newCredits,
    };
  }

  public async addLootToPlayer(accountId: string, dropped: DroppedModule): Promise<any> {
    const res = await db.query(
      `INSERT INTO player_inventory (account_id, blueprint_id, custom_name, rarity, affixes, is_fitted, fit_slot)
       VALUES ($1, $2, $3, $4, $5, false, NULL)
       RETURNING *`,
      [accountId, dropped.blueprintId, dropped.customName, dropped.rarity, JSON.stringify(dropped.affixes)]
    );
    return res.rows[0];
  }
}

export const outfittingService = new OutfittingService();

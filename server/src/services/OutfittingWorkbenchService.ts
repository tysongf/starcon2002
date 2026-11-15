import { db } from '../db/Database';
import {
  getModuleSubtypeDef,
  rollModulePrefixAndAffixes,
} from '../procgen/ProceduralModuleCatalog';
import type { LootAffix } from './LootGenerator';

export type ModuleRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export interface WorkbenchCostEntry {
  salvageComp: number;
  reforge: { credits: number; components: number };
  lockedReforge: { credits: number; components: number } | null;
  upgrade: { nextRarity: ModuleRarity; credits: number; components: number } | null;
}

export const WORKBENCH_COST_TABLE: Record<ModuleRarity, WorkbenchCostEntry> = {
  COMMON: {
    salvageComp: 4,
    reforge: { credits: 120, components: 4 },
    lockedReforge: null,
    upgrade: { nextRarity: 'UNCOMMON', credits: 350, components: 12 },
  },
  UNCOMMON: {
    salvageComp: 10,
    reforge: { credits: 240, components: 8 },
    lockedReforge: { credits: 400, components: 16 },
    upgrade: { nextRarity: 'RARE', credits: 700, components: 26 },
  },
  RARE: {
    salvageComp: 22,
    reforge: { credits: 480, components: 16 },
    lockedReforge: { credits: 780, components: 32 },
    upgrade: { nextRarity: 'EPIC', credits: 1450, components: 55 },
  },
  EPIC: {
    salvageComp: 45,
    reforge: { credits: 900, components: 32 },
    lockedReforge: { credits: 1400, components: 60 },
    upgrade: { nextRarity: 'LEGENDARY', credits: 2800, components: 110 },
  },
  LEGENDARY: {
    salvageComp: 90,
    reforge: { credits: 1600, components: 60 },
    lockedReforge: { credits: 2400, components: 110 },
    upgrade: null,
  },
  MYTHIC: {
    salvageComp: 180,
    reforge: { credits: 2800, components: 120 },
    lockedReforge: { credits: 4200, components: 200 },
    upgrade: null,
  },
};

const MIN_AFFIX_COUNT_BY_RARITY: Record<ModuleRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  MYTHIC: 6,
};

interface InventoryModuleRow {
  id: string;
  account_id: string;
  blueprint_id: string;
  custom_name: string;
  rarity: ModuleRarity;
  affixes: string | LootAffix[];
  main_category: string | null;
  subtype: string | null;
  tech_prefix: string | null;
  tech_suffix: string | null;
  is_fitted: boolean;
  fit_slot: string | null;
  bp_name: string;
  slot_type: 'HIGH' | 'MID' | 'LOW';
  power_grid_cost: number;
  cpu_cost: number;
  base_price: number;
}

export class OutfittingWorkbenchService {
  public getCostTable(): Record<ModuleRarity, WorkbenchCostEntry> {
    return WORKBENCH_COST_TABLE;
  }

  private async fetchItemAndAccount(accountId: string, itemId: string): Promise<{
    row: InventoryModuleRow;
    affixes: LootAffix[];
    credits: number;
    techComponents: number;
    factionId: string;
  }> {
    const [itemRes, accRes] = await Promise.all([
      db.query<InventoryModuleRow>(
        `SELECT
           pi.id, pi.account_id, pi.blueprint_id, pi.custom_name, pi.rarity, pi.affixes,
           pi.main_category, pi.subtype, pi.tech_prefix, pi.tech_suffix, pi.is_fitted, pi.fit_slot,
           eb.name as bp_name, eb.slot_type, eb.power_grid_cost, eb.cpu_cost, eb.base_price
         FROM player_inventory pi
         JOIN equipment_blueprints eb ON pi.blueprint_id = eb.id
         WHERE pi.id = $1 AND pi.account_id = $2`,
        [itemId, accountId]
      ),
      db.query<{ credits: number; tech_components: number; faction_id: string }>(
        `SELECT credits, tech_components, faction_id FROM accounts WHERE id = $1 LIMIT 1`,
        [accountId]
      ),
    ]);

    if (itemRes.rows.length === 0) {
      throw new Error(`ITEM_NOT_FOUND: Module "${itemId}" not found in inventory.`);
    }
    if (accRes.rows.length === 0) {
      throw new Error(`ACCOUNT_NOT_FOUND: Account "${accountId}" does not exist.`);
    }

    const row = itemRes.rows[0];
    const parsedAffixes: LootAffix[] =
      typeof row.affixes === 'string' ? JSON.parse(row.affixes) : (row.affixes || []);

    return {
      row,
      affixes: parsedAffixes,
      credits: Number(accRes.rows[0].credits || 0),
      techComponents: Number(accRes.rows[0].tech_components ?? 0),
      factionId: accRes.rows[0].faction_id || 'FACTION_SOL',
    };
  }

  private normalizeRarity(r?: string): ModuleRarity {
    const upper = (r || 'COMMON').toUpperCase();
    if (upper in WORKBENCH_COST_TABLE) return upper as ModuleRarity;
    return 'COMMON';
  }

  private assertAffordable(
    credits: number,
    techComponents: number,
    cost: { credits: number; components: number }
  ): void {
    if (credits < cost.credits) {
      throw new Error(
        `INSUFFICIENT_CREDITS: Requires ${cost.credits} Cr, available ${credits} Cr.`
      );
    }
    if (techComponents < cost.components) {
      throw new Error(
        `INSUFFICIENT_COMPONENTS: Requires ${cost.components} Tech Components, available ${techComponents}.`
      );
    }
  }

  private rollAttributesForRow(row: InventoryModuleRow, rarity: ModuleRarity, factionId: string) {
    const subtype = row.subtype || row.bp_name;
    const subDef = getModuleSubtypeDef(subtype);
    return rollModulePrefixAndAffixes({
      subtype,
      slotType: row.slot_type || 'HIGH',
      compatibleSuffixes: subDef?.compatibleSuffixes,
      basePowerGridCost: Number(row.power_grid_cost || 15),
      baseCpuCost: Number(row.cpu_cost || 20),
      basePrice: Number(row.base_price || 400),
      rarity,
      factionAffinity: factionId,
    });
  }

  /**
   * Scraps an unfitted Locker module into Tech Components + 20% basePrice Credits.
   */
  public async salvageModule(accountId: string, itemId: string) {
    const { row, credits, techComponents } = await this.fetchItemAndAccount(accountId, itemId);

    if (row.is_fitted) {
      throw new Error(
        'MODULE_CURRENTLY_FITTED: Unfit module from your active hull before salvaging.'
      );
    }

    const rarity = this.normalizeRarity(row.rarity);
    const basePrice = Number(row.base_price || 400);
    const creditsGained = Math.round(basePrice * 0.2);
    const componentsGained = WORKBENCH_COST_TABLE[rarity].salvageComp;

    const newCredits = credits + creditsGained;
    const newComponents = techComponents + componentsGained;

    await db.query('DELETE FROM player_inventory WHERE id = $1 AND account_id = $2', [
      itemId,
      accountId,
    ]);
    await db.query(
      'UPDATE accounts SET credits = $1, tech_components = $2 WHERE id = $3',
      [newCredits, newComponents, accountId]
    );

    return {
      success: true,
      salvagedItemId: itemId,
      salvagedName: row.custom_name || row.bp_name,
      rarity,
      creditsGained,
      componentsGained,
      credits: newCredits,
      techComponents: newComponents,
    };
  }

  /**
   * Rerolls prefix, suffix, custom_name, and affixes on a module.
   * Supports locking 1 existing affix on UNCOMMON+ modules.
   */
  public async reforgeModule(
    accountId: string,
    itemId: string,
    lockedAffixIndex?: number | null
  ) {
    const { row, affixes, credits, techComponents, factionId } = await this.fetchItemAndAccount(
      accountId,
      itemId
    );
    const rarity = this.normalizeRarity(row.rarity);
    const tableEntry = WORKBENCH_COST_TABLE[rarity];

    const hasLock = lockedAffixIndex !== undefined && lockedAffixIndex !== null;
    if (hasLock) {
      if (!tableEntry.lockedReforge) {
        throw new Error(
          'LOCK_NOT_SUPPORTED_ON_COMMON: Affix locking requires UNCOMMON rarity or higher.'
        );
      }
      if (
        !Number.isInteger(lockedAffixIndex) ||
        lockedAffixIndex < 0 ||
        lockedAffixIndex >= affixes.length
      ) {
        throw new Error(
          `INVALID_AFFIX_INDEX: lockedAffixIndex ${lockedAffixIndex} out of bounds (0..${Math.max(0, affixes.length - 1)}).`
        );
      }
    }

    const cost = hasLock ? tableEntry.lockedReforge! : tableEntry.reforge;
    this.assertAffordable(credits, techComponents, cost);

    const lockedAffix = hasLock ? affixes[lockedAffixIndex!] : null;

    let rolled = this.rollAttributesForRow(row, rarity, factionId);
    // Avoid identical prefix collision when reforging without lock
    for (let attempt = 0; attempt < 3; attempt++) {
      if (rolled.prefixDef.prefix !== row.tech_prefix || rolled.customName !== row.custom_name) {
        break;
      }
      rolled = this.rollAttributesForRow(row, rarity, factionId);
    }

    let finalAffixes: LootAffix[] = [...rolled.affixes];
    if (lockedAffix) {
      const targetLen = Math.max(affixes.length, finalAffixes.length, 2);
      const others = finalAffixes.filter(
        (a, idx) => idx !== 0 || a.stat !== lockedAffix.stat || a.multiplier !== lockedAffix.multiplier
      );
      finalAffixes = [lockedAffix, ...others].slice(0, targetLen);
    }

    const newCredits = credits - cost.credits;
    const newComponents = techComponents - cost.components;

    await db.query(
      'UPDATE accounts SET credits = $1, tech_components = $2 WHERE id = $3',
      [newCredits, newComponents, accountId]
    );

    const updateRes = await db.query<any>(
      `UPDATE player_inventory
       SET custom_name = $1, tech_prefix = $2, tech_suffix = $3, affixes = $4
       WHERE id = $5 AND account_id = $6
       RETURNING *`,
      [
        rolled.customName,
        rolled.prefixDef.prefix,
        rolled.techSuffix,
        JSON.stringify(finalAffixes),
        itemId,
        accountId,
      ]
    );

    return {
      success: true,
      item: {
        ...updateRes.rows[0],
        affixes: finalAffixes,
      },
      lockedAffixIndex: hasLock ? lockedAffixIndex : null,
      creditsSpent: cost.credits,
      componentsSpent: cost.components,
      credits: newCredits,
      techComponents: newComponents,
    };
  }

  /**
   * Upgrades module rarity one tier (COMMON -> UNCOMMON -> RARE -> EPIC -> LEGENDARY).
   */
  public async upgradeModule(accountId: string, itemId: string) {
    const { row, affixes, credits, techComponents, factionId } = await this.fetchItemAndAccount(
      accountId,
      itemId
    );
    const previousRarity = this.normalizeRarity(row.rarity);
    const upgradeSpec = WORKBENCH_COST_TABLE[previousRarity].upgrade;

    if (!upgradeSpec) {
      throw new Error('ALREADY_MAX_RARITY: Module is already at maximum LEGENDARY tier.');
    }

    this.assertAffordable(credits, techComponents, {
      credits: upgradeSpec.credits,
      components: upgradeSpec.components,
    });

    const newRarity = upgradeSpec.nextRarity;
    const rolled = this.rollAttributesForRow(row, newRarity, factionId);

    // Keep prior affixes and merge in freshly rolled tier affixes so every upgrade strictly gains power
    const minCount = MIN_AFFIX_COUNT_BY_RARITY[newRarity];
    const merged: LootAffix[] = [...affixes];
    for (const candidate of rolled.affixes) {
      if (merged.length >= minCount) break;
      merged.push(candidate);
    }
    // If still short (e.g. UNCOMMON primary-only roll from COMMON), synthesize a bonus affix from second roll
    if (merged.length < minCount) {
      const extraRoll = this.rollAttributesForRow(row, 'RARE', factionId);
      for (const candidate of extraRoll.affixes) {
        if (merged.length >= minCount) break;
        merged.push(candidate);
      }
    }

    const newCredits = credits - upgradeSpec.credits;
    const newComponents = techComponents - upgradeSpec.components;

    await db.query(
      'UPDATE accounts SET credits = $1, tech_components = $2 WHERE id = $3',
      [newCredits, newComponents, accountId]
    );

    const updateRes = await db.query<any>(
      `UPDATE player_inventory
       SET rarity = $1, custom_name = $2, tech_prefix = $3, tech_suffix = $4, affixes = $5
       WHERE id = $6 AND account_id = $7
       RETURNING *`,
      [
        newRarity,
        rolled.customName,
        rolled.prefixDef.prefix,
        rolled.techSuffix,
        JSON.stringify(merged),
        itemId,
        accountId,
      ]
    );

    return {
      success: true,
      item: {
        ...updateRes.rows[0],
        affixes: merged,
      },
      previousRarity,
      newRarity,
      creditsSpent: upgradeSpec.credits,
      componentsSpent: upgradeSpec.components,
      credits: newCredits,
      techComponents: newComponents,
    };
  }
}

export const outfittingWorkbenchService = new OutfittingWorkbenchService();


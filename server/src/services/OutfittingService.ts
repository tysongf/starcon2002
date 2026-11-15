import { db } from '../db/Database';
import { LootGenerator, DroppedModule } from './LootGenerator';
import {
  MODULE_SUBTYPE_CATALOG,
  TECH_PREFIXES,
  generateStationShopStock,
  type ProceduralDroppedModule,
} from '../procgen/ProceduralModuleCatalog';
import { getHullDef, type HullGeometryProfile } from '../procgen/HullClassCatalog';

export type FitSlotId =
  | 'H1' | 'H2' | 'H3'
  | 'M1' | 'M2' | 'M3'
  | 'L1' | 'L2' | 'L3'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7' | 'B8';

export function buildActiveSlotKeys(highSlots: number, midSlots: number, lowSlots: number, baySlots: number = 0): FitSlotId[] {
  const keys: FitSlotId[] = [];
  for (let i = 1; i <= Math.min(3, Math.max(1, highSlots)); i++) keys.push(`H${i}` as FitSlotId);
  for (let i = 1; i <= Math.min(3, Math.max(1, midSlots)); i++) keys.push(`M${i}` as FitSlotId);
  for (let i = 1; i <= Math.min(3, Math.max(1, lowSlots)); i++) keys.push(`L${i}` as FitSlotId);
  for (let i = 1; i <= Math.min(8, Math.max(0, baySlots)); i++) keys.push(`B${i}` as FitSlotId);
  return keys;
}

export interface FittedModule {
  id: string;
  blueprintId: string;
  name: string;
  customName: string;
  slotType: 'HIGH' | 'MID' | 'LOW' | 'BAY';
  mainCategory: string;
  subtype: string;
  techPrefix?: string;
  techSuffix?: string;
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
  mainHullClass: string;
  hullSubtype: string;
  flagshipName: string;
  factionId: string;
  hullSeed: number;
  slotLayout: { high: number; mid: number; low: number; bay: number };
  techComponents: number;
  hullStats: {
    armor: number;
    maxArmor: number;
    shield: number;
    maxShield: number;
    maxFuel: number;
    cargoCapacity: number;
    baseSpeed: number;
    baseTurnRate: number;
    geometryProfile: HullGeometryProfile;
  };
  powerGridMax: number;
  powerGridUsed: number;
  cpuMax: number;
  cpuUsed: number;
  fitted: Record<string, FittedModule | null>;
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
    const [shipRes, accRes] = await Promise.all([
      db.query('SELECT * FROM ships WHERE account_id = $1 LIMIT 1', [accountId]),
      db.query('SELECT tech_components FROM accounts WHERE id = $1 LIMIT 1', [accountId]),
    ]);
    const ship = shipRes.rows[0] as any;
    const hullDef = getHullDef(ship?.hull_class);

    const highSlots = Number(ship?.high_slots ?? hullDef.highSlots);
    const midSlots = Number(ship?.mid_slots ?? hullDef.midSlots);
    const lowSlots = Number(ship?.low_slots ?? hullDef.lowSlots);
    const baySlots = Number(ship?.bay_slots ?? hullDef.baySlots);
    const powerGridMax = Number(ship?.power_grid_max ?? hullDef.powerGridMax);
    const cpuMax = Number(ship?.cpu_max ?? hullDef.cpuMax);
    const techComponents = Number((accRes.rows[0] as any)?.tech_components ?? 25);

    const query = `
      SELECT 
        pi.id,
        pi.blueprint_id as "blueprintId",
        eb.name,
        pi.custom_name as "customName",
        eb.slot_type as "slotType",
        COALESCE(pi.main_category, eb.main_category, 'OFFENSE') as "mainCategory",
        COALESCE(pi.subtype, eb.subtype, eb.name) as "subtype",
        pi.tech_prefix as "techPrefix",
        pi.tech_suffix as "techSuffix",
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

    const activeKeys = buildActiveSlotKeys(highSlots, midSlots, lowSlots, baySlots);
    const fitted: Record<string, FittedModule | null> = {};
    for (const key of activeKeys) {
      fitted[key] = null;
    }
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
        fitted[mod.fitSlot] = mod;
        powerGridUsed += mod.powerGridCost;
        cpuUsed += mod.cpuCost;
      } else {
        locker.push(mod);
      }
    }

    return {
      accountId,
      shipClass: ship?.hull_class || hullDef.hullClass,
      mainHullClass: ship?.main_hull_class || hullDef.mainClass,
      hullSubtype: ship?.hull_subtype || hullDef.displayName,
      flagshipName: ship?.flagship_name || 'UNS Endeavour',
      factionId: ship?.faction_id || hullDef.factionId,
      hullSeed: Number(ship?.hull_seed ?? hullDef.hullSeedDefault),
      slotLayout: { high: highSlots, mid: midSlots, low: lowSlots, bay: baySlots },
      techComponents,
      hullStats: {
        armor: Number(ship?.armor ?? hullDef.baseArmor),
        maxArmor: Number(ship?.max_armor ?? hullDef.baseArmor),
        shield: Number(ship?.shield ?? hullDef.baseShield),
        maxShield: Number(ship?.max_shield ?? hullDef.baseShield),
        maxFuel: Number(ship?.max_fuel ?? hullDef.maxFuel),
        cargoCapacity: Number(ship?.cargo_capacity ?? hullDef.cargoCapacity),
        baseSpeed: Number(ship?.base_speed ?? hullDef.baseSpeed),
        baseTurnRate: Number(ship?.base_turn_rate ?? hullDef.baseTurnRate),
        geometryProfile: hullDef.geometryProfile,
      },
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
    targetSlot: string
  ): Promise<PlayerLoadout> {
    const current = await this.getPlayerLoadout(accountId);

    if (!(targetSlot in current.fitted)) {
      throw new Error(
        `SLOT_UNAVAILABLE_ON_HULL: Slot ${targetSlot} is not available on your active ${current.hullSubtype} (${current.slotLayout.high}H/${current.slotLayout.mid}M/${current.slotLayout.low}L/${current.slotLayout.bay}B).`
      );
    }

    // Verify item exists in inventory
    const allItems = [...Object.values(current.fitted).filter(Boolean), ...current.locker] as FittedModule[];
    const item = allItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Module item ${itemId} not found in player inventory.`);
    }

    // Verify slot type matches
    const expectedSlotType = targetSlot.startsWith('H')
      ? 'HIGH'
      : targetSlot.startsWith('M')
      ? 'MID'
      : targetSlot.startsWith('B')
      ? 'BAY'
      : 'LOW';
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

  /**
   * Reconciles all currently fitted modules after a Flagship swap so invalid slots
   * or over-budget PG/CPU modules are cleanly returned to the Station Locker.
   */
  public async reconcileLoadoutToHull(
    accountId: string,
    opts: {
      highSlots: number;
      midSlots: number;
      lowSlots: number;
      baySlots?: number;
      powerGridMax: number;
      cpuMax: number;
    }
  ): Promise<{ unfittedModules: FittedModule[]; loadout: PlayerLoadout }> {
    const { rows } = await db.query<any>(
      `SELECT
        pi.id,
        pi.blueprint_id as "blueprintId",
        eb.name,
        pi.custom_name as "customName",
        eb.slot_type as "slotType",
        COALESCE(pi.main_category, eb.main_category, 'OFFENSE') as "mainCategory",
        COALESCE(pi.subtype, eb.subtype, eb.name) as "subtype",
        pi.tech_prefix as "techPrefix",
        pi.tech_suffix as "techSuffix",
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
       WHERE pi.account_id = $1 AND pi.is_fitted = true`,
      [accountId]
    );

    const activeSlotSet = new Set<string>(
      buildActiveSlotKeys(opts.highSlots, opts.midSlots, opts.lowSlots, opts.baySlots ?? 2)
    );

    const fittedMods: FittedModule[] = rows.map((raw: any) => ({
      ...raw,
      powerGridCost: Number(raw.powerGridCost),
      cpuCost: Number(raw.cpuCost),
      basePrice: Number(raw.basePrice),
      baseStats: typeof raw.baseStats === 'string' ? JSON.parse(raw.baseStats) : raw.baseStats,
      affixes: typeof raw.affixes === 'string' ? JSON.parse(raw.affixes) : raw.affixes,
    }));

    const unfittedModules: FittedModule[] = [];
    const surviving: FittedModule[] = [];

    for (const mod of fittedMods) {
      if (!mod.fitSlot || !activeSlotSet.has(mod.fitSlot)) {
        unfittedModules.push(mod);
      } else {
        surviving.push(mod);
      }
    }

    // If remaining modules exceed the new hull's PG/CPU ceiling, shed highest-drain HIGH/MID modules first
    const slotPriority = (slot: string | null): number => {
      if (!slot) return 0;
      const tierRank = slot.startsWith('H') ? 30 : slot.startsWith('M') ? 20 : 10;
      const idx = parseInt(slot.slice(1), 10) || 1;
      return tierRank + idx;
    };
    surviving.sort((a, b) => slotPriority(b.fitSlot) - slotPriority(a.fitSlot));

    let pgUsed = surviving.reduce((sum, m) => sum + m.powerGridCost, 0);
    let cpuUsed = surviving.reduce((sum, m) => sum + m.cpuCost, 0);

    for (const mod of surviving) {
      if (pgUsed <= opts.powerGridMax && cpuUsed <= opts.cpuMax) break;
      unfittedModules.push(mod);
      pgUsed -= mod.powerGridCost;
      cpuUsed -= mod.cpuCost;
    }

    for (const mod of unfittedModules) {
      await db.query(
        'UPDATE player_inventory SET is_fitted = false, fit_slot = NULL WHERE id = $1 AND account_id = $2',
        [mod.id, accountId]
      );
    }

    const loadout = await this.getPlayerLoadout(accountId);
    return { unfittedModules, loadout };
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

    const mainCat = bp.main_category || drop.mainCategory;
    const sub = bp.subtype || drop.subtype;

    const insertRes = await db.query(
      `INSERT INTO player_inventory (account_id, blueprint_id, custom_name, rarity, affixes, main_category, subtype, tech_prefix, tech_suffix, is_fitted, fit_slot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NULL)
       RETURNING *`,
      [accountId, bp.id, drop.customName, drop.rarity, JSON.stringify(drop.affixes), mainCat, sub, drop.techPrefix || null, drop.techSuffix || null]
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
      `INSERT INTO player_inventory (account_id, blueprint_id, custom_name, rarity, affixes, main_category, subtype, tech_prefix, tech_suffix, is_fitted, fit_slot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NULL)
       RETURNING *`,
      [
        accountId,
        dropped.blueprintId,
        dropped.customName,
        dropped.rarity,
        JSON.stringify(dropped.affixes),
        dropped.mainCategory || 'OFFENSE',
        dropped.subtype || dropped.name,
        dropped.techPrefix || null,
        dropped.techSuffix || null,
      ]
    );
    return res.rows[0];
  }

  public getModuleTaxonomy() {
    return {
      mainCategories: ['OFFENSE', 'DEFENSE', 'TRAVEL', 'COMMERCE', 'UTILITY_DRONE'],
      subtypes: MODULE_SUBTYPE_CATALOG,
      prefixes: TECH_PREFIXES,
    };
  }

  public async getStationShopStock(sectorId: number, epochBucket: number = 1): Promise<{
    sectorId: number;
    controllingFaction: string;
    epochBucket: number;
    stock: Array<ProceduralDroppedModule & { slotIndex: number }>;
  }> {
    const { rows } = await db.query<any>(
      `SELECT controlling_faction FROM sectors WHERE id = $1 LIMIT 1`,
      [sectorId]
    );
    const faction = rows[0]?.controlling_faction || 'FACTION_SOL';
    const rawStock = generateStationShopStock(sectorId, faction, epochBucket);
    return {
      sectorId,
      controllingFaction: faction,
      epochBucket,
      stock: rawStock.map((item, slotIndex) => ({ ...item, slotIndex })),
    };
  }

  public async buyShopModule(
    accountId: string,
    sectorId: number,
    slotIndex: number,
    epochBucket: number = 1
  ): Promise<{ success: boolean; item: any; module: ProceduralDroppedModule; remainingCredits: number; credits: number }> {
    const shop = await this.getStationShopStock(sectorId, epochBucket);
    const selected = shop.stock[slotIndex];
    if (!selected) {
      throw new Error(`Shop slotIndex ${slotIndex} out of range (0-${shop.stock.length - 1}).`);
    }

    const accRes = await db.query('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = Number(accRes.rows[0]?.credits || 0);
    if (credits < selected.basePrice) {
      throw new Error(`Insufficient credits. Required: ${selected.basePrice} Cr, available: ${credits} Cr.`);
    }

    const newCredits = credits - selected.basePrice;
    await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [newCredits, accountId]);

    const inserted = await this.addLootToPlayer(accountId, selected);
    return {
      success: true,
      item: inserted,
      module: selected,
      remainingCredits: newCredits,
      credits: newCredits,
    };
  }
}

export const outfittingService = new OutfittingService();

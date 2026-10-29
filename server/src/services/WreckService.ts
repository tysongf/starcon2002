import { db } from '../db/Database';

export interface SectorWreck {
  id: string;
  sectorId: number;
  shipName: string;
  shipClass: string;
  faction: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scrapRemaining: number;
  maxScrap: number;
  hullIntactness: number;
  isTowed: boolean;
  towedByAccountId: string | null;
  createdAt: string;
}

export class WreckService {
  /**
   * Fetches all persistent wrecks in a given sector.
   */
  public async getWrecksBySector(sectorId: number): Promise<SectorWreck[]> {
    const { rows } = await db.query<any>(
      `SELECT * FROM wrecks WHERE sector_id = $1 ORDER BY created_at DESC`,
      [sectorId]
    );

    return rows.map((r) => ({
      id: r.id,
      sectorId: r.sector_id,
      shipName: r.ship_name,
      shipClass: r.ship_class,
      faction: r.faction,
      x: parseFloat(r.x),
      y: parseFloat(r.y),
      z: parseFloat(r.z),
      rotation: parseFloat(r.rotation || 0),
      scrapRemaining: parseInt(r.scrap_remaining, 10),
      maxScrap: parseInt(r.max_scrap, 10),
      hullIntactness: parseFloat(r.hull_intactness),
      isTowed: r.is_towed === true,
      towedByAccountId: r.towed_by_account_id,
      createdAt: r.created_at,
    }));
  }

  /**
   * Fetches a single wreck by its unique ID.
   */
  public async getWreckById(wreckId: string): Promise<SectorWreck | null> {
    const { rows } = await db.query<any>(
      `SELECT * FROM wrecks WHERE id = $1 LIMIT 1`,
      [wreckId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      sectorId: r.sector_id,
      shipName: r.ship_name,
      shipClass: r.ship_class,
      faction: r.faction,
      x: parseFloat(r.x),
      y: parseFloat(r.y),
      z: parseFloat(r.z),
      rotation: parseFloat(r.rotation || 0),
      scrapRemaining: parseInt(r.scrap_remaining, 10),
      maxScrap: parseInt(r.max_scrap, 10),
      hullIntactness: parseFloat(r.hull_intactness),
      isTowed: r.is_towed === true,
      towedByAccountId: r.towed_by_account_id,
      createdAt: r.created_at,
    };
  }

  /**
   * Creates and registers a new persistent ship wreck when a vessel explodes.
   */
  public async createWreck(
    sectorId: number,
    shipName: string,
    shipClass: string,
    faction: string,
    x: number,
    y: number,
    z: number,
    rotation: number = 0,
    maxScrap: number = 100,
    hullIntactness: number = 0.8
  ): Promise<SectorWreck> {
    const wreckId = `wreck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { rows } = await db.query<any>(
      `INSERT INTO wrecks (
        id, sector_id, ship_name, ship_class, faction, x, y, z, rotation, scrap_remaining, max_scrap, hull_intactness
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [wreckId, sectorId, shipName, shipClass, faction, x, y, z, rotation, maxScrap, maxScrap, hullIntactness]
    );

    const r = rows[0];
    return {
      id: r.id,
      sectorId: r.sector_id,
      shipName: r.ship_name,
      shipClass: r.ship_class,
      faction: r.faction,
      x: parseFloat(r.x),
      y: parseFloat(r.y),
      z: parseFloat(r.z),
      rotation: parseFloat(r.rotation || 0),
      scrapRemaining: parseInt(r.scrap_remaining, 10),
      maxScrap: parseInt(r.max_scrap, 10),
      hullIntactness: parseFloat(r.hull_intactness),
      isTowed: false,
      towedByAccountId: null,
      createdAt: r.created_at,
    };
  }

  /**
   * Laser scrap mining extraction on a wreck.
   */
  public async mineScrap(
    wreckId: string,
    accountId: string,
    extractUnits: number = 10
  ): Promise<{
    destroyed: boolean;
    scrapRemaining: number;
    extracted: number;
    alloyUnitsAdded: number;
    wreck: SectorWreck | null;
  }> {
    const wreck = await this.getWreckById(wreckId);
    if (!wreck) {
      throw new Error(`Target wreck ${wreckId} not found in sector.`);
    }

    const actualExtract = Math.min(wreck.scrapRemaining, extractUnits);
    const newScrapRemaining = wreck.scrapRemaining - actualExtract;
    const newIntactness = Math.max(0.0, wreck.hullIntactness - actualExtract / wreck.maxScrap);

    // Convert scrap into Plasteel Alloy for cargo hold (1 alloy unit per 10 scrap)
    const alloyUnits = Math.max(1, Math.floor(actualExtract / 10));

    // Lookup player ship
    const shipRes = await db.query<{ id: string; cargo_capacity: number }>(
      'SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1',
      [accountId]
    );

    if (shipRes.rows.length > 0) {
      const shipId = shipRes.rows[0].id;
      // Check current cargo usage
      const usedRes = await db.query<{ total: string }>(
        'SELECT COALESCE(SUM(quantity), 0) as total FROM ship_cargo WHERE ship_id = $1',
        [shipId]
      );
      const used = parseInt(usedRes.rows[0]?.total || '0', 10);
      const capacity = shipRes.rows[0].cargo_capacity;
      const canAdd = Math.min(alloyUnits, Math.max(0, capacity - used));

      if (canAdd > 0) {
        await db.query(
          `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
           VALUES ($1, 'COMM_ALLOY', $2)
           ON CONFLICT (ship_id, commodity_id)
           DO UPDATE SET quantity = ship_cargo.quantity + $2`,
          [shipId, canAdd]
        );
      }
    }

    if (newScrapRemaining <= 0) {
      // Wreck completely disintegrated
      await db.query('DELETE FROM wrecks WHERE id = $1', [wreckId]);
      return {
        destroyed: true,
        scrapRemaining: 0,
        extracted: actualExtract,
        alloyUnitsAdded: alloyUnits,
        wreck: null,
      };
    } else {
      await db.query(
        'UPDATE wrecks SET scrap_remaining = $1, hull_intactness = $2 WHERE id = $3',
        [newScrapRemaining, newIntactness, wreckId]
      );
      const updatedWreck: SectorWreck = {
        ...wreck,
        scrapRemaining: newScrapRemaining,
        hullIntactness: newIntactness,
      };
      return {
        destroyed: false,
        scrapRemaining: newScrapRemaining,
        extracted: actualExtract,
        alloyUnitsAdded: alloyUnits,
        wreck: updatedWreck,
      };
    }
  }

  /**
   * Sets or releases the magnetic tow cable on a wreck.
   */
  public async setTowed(
    wreckId: string,
    accountId: string | null
  ): Promise<{ success: boolean; wreck: SectorWreck | null }> {
    if (accountId) {
      // Check if player already towing another wreck
      await db.query(
        'UPDATE wrecks SET is_towed = false, towed_by_account_id = NULL WHERE towed_by_account_id = $1',
        [accountId]
      );
      await db.query(
        'UPDATE wrecks SET is_towed = true, towed_by_account_id = $1 WHERE id = $2',
        [accountId, wreckId]
      );
    } else {
      await db.query(
        'UPDATE wrecks SET is_towed = false, towed_by_account_id = NULL WHERE id = $1',
        [wreckId]
      );
    }

    const updated = await this.getWreckById(wreckId);
    return { success: true, wreck: updated };
  }

  /**
   * Fetches the wreck currently tethered to the player, if any.
   */
  public async getTowedWreck(accountId: string): Promise<SectorWreck | null> {
    const { rows } = await db.query<any>(
      `SELECT * FROM wrecks WHERE towed_by_account_id = $1 AND is_towed = true LIMIT 1`,
      [accountId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      sectorId: r.sector_id,
      shipName: r.ship_name,
      shipClass: r.ship_class,
      faction: r.faction,
      x: parseFloat(r.x),
      y: parseFloat(r.y),
      z: parseFloat(r.z),
      rotation: parseFloat(r.rotation || 0),
      scrapRemaining: parseInt(r.scrap_remaining, 10),
      maxScrap: parseInt(r.max_scrap, 10),
      hullIntactness: parseFloat(r.hull_intactness),
      isTowed: true,
      towedByAccountId: r.towed_by_account_id,
      createdAt: r.created_at,
    };
  }

  /**
   * Relocates a wreck to a new sector/coordinates (e.g. when pulled through a Jump Gate).
   */
  public async relocateWreck(
    wreckId: string,
    sectorId: number,
    x: number,
    y: number,
    z: number
  ): Promise<void> {
    await db.query(
      'UPDATE wrecks SET sector_id = $1, x = $2, y = $3, z = $4 WHERE id = $5',
      [sectorId, x, y, z, wreckId]
    );
  }

  /**
   * Station Salvage Bay: Dismantle a towed wreck for credits and raw alloy payout.
   */
  public async dismantleWreck(
    wreckId: string,
    accountId: string
  ): Promise<{
    success: boolean;
    payoutCredits: number;
    alloysAwarded: number;
    message: string;
  }> {
    const wreck = await this.getWreckById(wreckId);
    if (!wreck) {
      throw new Error(`Wreck ${wreckId} not found for salvage dismantling.`);
    }

    // Payout calculation: base 2,000 CR + (scrap * 12) + (intactness * 1,500)
    const payoutCredits = Math.round(2000 + wreck.scrapRemaining * 12 + wreck.hullIntactness * 1500);
    const alloysAwarded = Math.max(5, Math.floor(wreck.scrapRemaining / 8));

    // Award credits to account
    await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [payoutCredits, accountId]);

    // Deposit alloys into player ship hold
    const shipRes = await db.query<{ id: string; cargo_capacity: number }>(
      'SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1',
      [accountId]
    );
    if (shipRes.rows.length > 0) {
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, 'COMM_ALLOY', $2)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $2`,
        [shipRes.rows[0].id, alloysAwarded]
      );
    }

    // Remove wreck from database
    await db.query('DELETE FROM wrecks WHERE id = $1', [wreckId]);

    return {
      success: true,
      payoutCredits,
      alloysAwarded,
      message: `Successfully dismantled ${wreck.shipName} (${wreck.shipClass}). Awarded ${payoutCredits.toLocaleString()} CR and ${alloysAwarded}x Plasteel Alloys.`,
    };
  }

  /**
   * Station Salvage Bay: Refurbish a towed wreck into a high-grade faction hull upgrade.
   */
  public async refurbishWreck(
    wreckId: string,
    accountId: string
  ): Promise<{
    success: boolean;
    feeCredits: number;
    hullName: string;
    message: string;
  }> {
    const wreck = await this.getWreckById(wreckId);
    if (!wreck) {
      throw new Error(`Wreck ${wreckId} not found for refurbishing.`);
    }

    const feeCredits = 2500;
    const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const balance = accRes.rows[0]?.credits || 0;

    // Deduct fee (or subsidized if insufficient)
    const deduction = Math.min(balance, feeCredits);
    if (deduction > 0) {
      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [deduction, accountId]);
    }

    // Upgrade player frigate: reinforce armor and expand cargo hold
    await db.query(
      `UPDATE ships 
       SET max_armor = max_armor + 25, 
           armor = max_armor + 25, 
           cargo_capacity = cargo_capacity + 15 
       WHERE account_id = $1`,
      [accountId]
    );

    // Delete refurbished wreck from world
    await db.query('DELETE FROM wrecks WHERE id = $1', [wreckId]);

    return {
      success: true,
      feeCredits,
      hullName: wreck.shipName,
      message: `Refurbished ${wreck.shipName} into your fleet! Hull reinforced (+25 Max Armor) and Cargo expanded (+15 Capacity).`,
    };
  }
}

export const wreckService = new WreckService();

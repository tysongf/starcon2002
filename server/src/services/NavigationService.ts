import { db } from '../db/Database';
import { apService } from './ActionPointService';

export interface Sector {
  id: number;
  name: string;
  system_seed: number;
  controlling_faction: string;
  connected_sectors: number[];
  coordinates_x?: number;
  coordinates_y?: number;
  spectral_class?: string;
  star_radius?: number;
  hazard_level?: number;
  description?: string;
}

export interface Port {
  id: string;
  name: string;
  sector_id: number;
  port_class: number;
  faction_id: string;
  tariff_rate: number;
}

export interface PlayerShip {
  id: string;
  account_id: string;
  hull_class: string;
  hull_seed: number;
  current_sector_id: number;
  fuel: number;
  max_fuel: number;
  armor: number;
  max_armor: number;
  shield: number;
  max_shield: number;
  cargo_capacity: number;
  nav_target_sector_id?: number | null;
  is_in_hyperspace?: boolean;
  hyperspace_x?: number;
  hyperspace_y?: number;
}

export interface JumpResult {
  success: boolean;
  fromSectorId?: number;
  toSector?: Sector;
  port?: Port | null;
  ship?: PlayerShip;
  currentAP?: number;
  remainingFuel?: number;
  activeEscortsJumping?: number;
  escortFuelCost?: number;
  totalFuelCost?: number;
  error?: string;
}

export class NavigationService {
  public static readonly WARP_AP_COST = 5;
  public static readonly WARP_FUEL_COST = 1;

  /**
   * Retrieves player ship state from database
   */
  public async getPlayerShip(playerId: string): Promise<PlayerShip | null> {
    const res = await db.query<PlayerShip>(
      'SELECT * FROM ships WHERE account_id = $1',
      [playerId]
    );
    if (res.rows.length === 0) {
      // Auto-provision default ship if not found
      await db.query(
        `INSERT INTO accounts (id, username, callsign, credits, faction_id)
         VALUES ($1, 'cmdr_vance', 'Vance', 2500, 'FACTION_SOL')
         ON CONFLICT (id) DO NOTHING`,
        [playerId]
      );

      const created = await db.query<PlayerShip>(
        `INSERT INTO ships (id, account_id, hull_class, hull_seed, current_sector_id, fuel, max_fuel, armor, max_armor, shield, max_shield, cargo_capacity)
         VALUES ($1, $2, 'CORVETTE', 12345, 1, 100, 100, 100, 100, 100, 100, 40)
         ON CONFLICT (id) DO UPDATE SET account_id = EXCLUDED.account_id
         RETURNING *`,
        [`ship_${playerId}`, playerId]
      );
      return created.rows[0];
    }
    return res.rows[0];
  }

  /**
   * Retrieves sector information with connected adjacent sectors
   */
  public async getSector(sectorId: number): Promise<Sector | null> {
    const res = await db.query<Sector>(
      'SELECT * FROM sectors WHERE id = $1',
      [sectorId]
    );
    return res.rows[0] || null;
  }

  /**
   * Retrieves adjacent sectors connected via warp lanes
   */
  public async getAdjacentSectors(sectorId: number): Promise<Sector[]> {
    const current = await this.getSector(sectorId);
    if (!current || !Array.isArray(current.connected_sectors) || current.connected_sectors.length === 0) {
      return [];
    }

    const res = await db.query<Sector>(
      'SELECT * FROM sectors WHERE id = ANY($1::int[]) ORDER BY id ASC',
      [current.connected_sectors]
    );
    return res.rows;
  }

  /**
   * Server-authoritative hyperspace warp jump execution
   */
  public async executeJump(playerId: string, targetSectorId: number): Promise<JumpResult> {
    // 1. Fetch Ship
    const ship = await this.getPlayerShip(playerId);
    if (!ship) {
      return { success: false, error: `Ship for player "${playerId}" not found.` };
    }

    const currentSectorId = ship.current_sector_id;

    if (currentSectorId === targetSectorId) {
      return { success: false, error: `Vessel is already in Sector ${targetSectorId}.` };
    }

    // 2. Fetch Current & Target Sectors
    const currentSector = await this.getSector(currentSectorId);
    const targetSector = await this.getSector(targetSectorId);

    if (!currentSector) {
      return { success: false, error: `Current Sector ${currentSectorId} not found in star registry.` };
    }
    if (!targetSector) {
      return { success: false, error: `Target Sector ${targetSectorId} not found in star registry.` };
    }

    // 3. Adjacency Graph Verification
    const isAdjacent = Array.isArray(currentSector.connected_sectors) &&
      currentSector.connected_sectors.includes(targetSectorId);

    if (!isAdjacent) {
      return {
        success: false,
        error: `INVALID_WARP_VECTOR: Sector ${targetSectorId} (${targetSector.name}) is not adjacent to Sector ${currentSectorId}. Direct warp lane does not exist.`,
      };
    }

    // 4. Calculate Fleet Escort Fuel Overhead
    let activeEscortsCount = 0;
    try {
      const activeEscortsRes = await db.query<any>(
        `SELECT id FROM player_fleet 
         WHERE account_id = $1 AND deployment_slot IS NOT NULL AND status = 'READY'`,
        [playerId]
      );
      activeEscortsCount = activeEscortsRes.rows.length;
    } catch {
      // Table might not exist in early tests or isolation
      activeEscortsCount = 0;
    }

    const baseFuelCost = NavigationService.WARP_FUEL_COST;
    const escortFuelCost = activeEscortsCount * 1;
    const totalFuelCost = baseFuelCost + escortFuelCost;

    if (activeEscortsCount > 0) {
      if (ship.fuel < totalFuelCost) {
        return {
          success: false,
          error: `INSUFFICIENT_FUEL: Warp requires ${totalFuelCost} fuel (${baseFuelCost} base + ${escortFuelCost} fleet escorts), but vessel only has ${ship.fuel}.`,
        };
      }
    } else {
      if (ship.fuel < baseFuelCost) {
        return {
          success: false,
          error: `INSUFFICIENT_FUEL: Requires ${baseFuelCost} unit Deuterium fuel, currently have ${ship.fuel}.`,
        };
      }
    }

    // 5. AP Atomic Verification & Spend
    const apResult = await apService.spendAP(playerId, 'SECTOR_WARP', NavigationService.WARP_AP_COST);
    if (!apResult.success) {
      return {
        success: false,
        error: apResult.error || `INSUFFICIENT_ACTION_POINTS: Warp requires ${NavigationService.WARP_AP_COST} AP.`,
      };
    }

    // 6. Deduct Total Fuel & Update Ship Sector in Database
    const updateRes = await db.query<PlayerShip>(
      `UPDATE ships 
       SET current_sector_id = $1, fuel = fuel - $2, updated_at = NOW() 
       WHERE account_id = $3 
       RETURNING *`,
      [targetSectorId, totalFuelCost, playerId]
    );

    // 6b. Synchronize Active Escorts to New Sector
    if (activeEscortsCount > 0) {
      try {
        await db.query(
          `UPDATE player_fleet 
           SET current_sector_id = $1, updated_at = NOW() 
           WHERE account_id = $2 AND deployment_slot IS NOT NULL AND status = 'READY'`,
          [targetSectorId, playerId]
        );
      } catch {}
    }

    const updatedShip = updateRes.rows[0];

    // 7. Check for Port in Target Sector
    const portRes = await db.query<Port>(
      'SELECT * FROM ports WHERE sector_id = $1',
      [targetSectorId]
    );
    const port = portRes.rows[0] || null;

    return {
      success: true,
      fromSectorId: currentSectorId,
      toSector: targetSector,
      port,
      ship: updatedShip,
      currentAP: apResult.currentAP,
      remainingFuel: updatedShip.fuel,
      activeEscortsJumping: activeEscortsCount,
      escortFuelCost,
      totalFuelCost,
    };
  }

  /**
   * Refuels ship back to full capacity or adds specified fuel units
   */
  public async refuelShip(playerId: string, amount?: number): Promise<PlayerShip> {
    const ship = await this.getPlayerShip(playerId);
    if (!ship) throw new Error(`Ship for player "${playerId}" not found.`);
    const newFuel = amount !== undefined ? Math.min(ship.max_fuel, ship.fuel + amount) : ship.max_fuel;
    const res = await db.query<PlayerShip>(
      'UPDATE ships SET fuel = $1, updated_at = NOW() WHERE account_id = $2 RETURNING *',
      [newFuel, playerId]
    );
    return res.rows[0];
  }
}

export const navigationService = new NavigationService();

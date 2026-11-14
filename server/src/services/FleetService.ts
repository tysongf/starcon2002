import { db } from '../db/Database';

export interface FleetShip {
  id: string;
  accountId: string;
  name: string;
  blueprintId: string;
  hullClass: string;
  factionId: string;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  speed: number;
  turnRate: number;
  firepower: number;
  specialAbility: string;
  fittedModules: any[];
  deploymentSlot: number | null; // 1..4 = Active Wingman; null = Hangar Reserve
  status: 'READY' | 'DEPLOYED' | 'DESTROYED';
  createdAt: string;
  updatedAt: string;
}

export interface FleetRosterResponse {
  success: boolean;
  accountId: string;
  maxWingmen: number;
  bridgeTier: number;
  bridgeModuleName: string;
  upkeepPerCycle: number;
  activeWingmen: FleetShip[];
  reserveShips: FleetShip[];
  fleet: FleetShip[];
  error?: string;
}

export class FleetService {
  /**
   * Retrieves player's complete fleet roster and computes active wingman capacity
   * based on the flagship's fitted Command Bridge module.
   */
  public async getFleetRoster(accountId: string = 'acc_sol_captain'): Promise<FleetRosterResponse> {
    // 1. Detect fitted Command Bridge module from flagship inventory
    const bridgeQuery = `
      SELECT pi.blueprint_id, eb.name, eb.base_stats
      FROM player_inventory pi
      JOIN equipment_blueprints eb ON pi.blueprint_id = eb.id
      WHERE pi.account_id = $1 AND pi.is_fitted = true AND (eb.category = 'COMMAND' OR pi.blueprint_id LIKE 'MOD_BRIDGE_%')
      LIMIT 1
    `;
    const { rows: bridgeRows } = await db.query<any>(bridgeQuery, [accountId]);

    let maxWingmen = 1;
    let bridgeTier = 1;
    let bridgeModuleName = 'Standard Command Cockpit (Baseline)';

    if (bridgeRows.length > 0) {
      const b = bridgeRows[0];
      const stats = typeof b.base_stats === 'string' ? JSON.parse(b.base_stats) : (b.base_stats || {});
      maxWingmen = stats.maxWingmen || 1;
      bridgeTier = stats.bridgeTier || 1;
      bridgeModuleName = b.name;
    }

    // 2. Fetch all fleet ships owned by account
    const { rows: fleetRows } = await db.query<any>(
      `SELECT * FROM player_fleet
       WHERE account_id = $1
       ORDER BY deployment_slot ASC NULLS LAST, created_at ASC`,
      [accountId]
    );

    const fleet: FleetShip[] = fleetRows.map((r) => this.mapRowToShip(r));

    // 3. Separate active wingmen from hangar reserve
    const activeWingmen = fleet.filter((s) => s.deploymentSlot !== null && s.status !== 'DESTROYED');
    const reserveShips = fleet.filter((s) => s.deploymentSlot === null && s.status !== 'DESTROYED');

    const upkeepPerCycle = activeWingmen.length * 15;

    return {
      success: true,
      accountId,
      maxWingmen,
      bridgeTier,
      bridgeModuleName,
      upkeepPerCycle,
      activeWingmen,
      reserveShips,
      fleet,
    };
  }

  /**
   * Assigns or recalls a ship to an active wingman slot (1..maxWingmen).
   * Validates bridge capacity and handles slot collisions.
   */
  public async assignDeploymentSlot(
    accountId: string,
    fleetShipId: string,
    slot: number | null
  ): Promise<FleetRosterResponse> {
    const roster = await this.getFleetRoster(accountId);
    const ship = roster.fleet.find((s) => s.id === fleetShipId);

    if (!ship) {
      return {
        ...roster,
        success: false,
        error: `FLEET_SHIP_NOT_FOUND: Ship with ID "${fleetShipId}" does not exist in your fleet garage.`,
      };
    }

    if (ship.status === 'DESTROYED') {
      return {
        ...roster,
        success: false,
        error: `SHIP_DESTROYED: Hull has suffered catastrophic failure. Decommission or salvage wreck before replacing.`,
      };
    }

    // If slot is specified, validate bounds against Command Bridge capacity
    if (slot !== null) {
      if (!Number.isInteger(slot) || slot < 1) {
        return {
          ...roster,
          success: false,
          error: `INVALID_SLOT: Deployment slot must be an integer between 1 and ${roster.maxWingmen}.`,
        };
      }

      if (slot > roster.maxWingmen) {
        return {
          ...roster,
          success: false,
          error: `COMMAND_BRIDGE_LIMIT_EXCEEDED: Your flagship's ${roster.bridgeModuleName} (Tier ${roster.bridgeTier}) only supports ${roster.maxWingmen} active wingman. Upgrade your Command Bridge in Outfitting to unlock Slot ${slot}.`,
        };
      }

      // Evict any existing ship currently in this slot to reserve
      await db.query(
        `UPDATE player_fleet
         SET deployment_slot = NULL, updated_at = NOW()
         WHERE account_id = $1 AND deployment_slot = $2 AND id != $3`,
        [accountId, slot, fleetShipId]
      );

      // Assign ship to slot
      await db.query(
        `UPDATE player_fleet
         SET deployment_slot = $1, status = 'READY', updated_at = NOW()
         WHERE id = $2 AND account_id = $3`,
        [slot, fleetShipId, accountId]
      );
    } else {
      // Recall to hangar reserve
      await db.query(
        `UPDATE player_fleet
         SET deployment_slot = NULL, updated_at = NOW()
         WHERE id = $1 AND account_id = $2`,
        [fleetShipId, accountId]
      );
    }

    return this.getFleetRoster(accountId);
  }

  /**
   * Renames an escort ship in the player's fleet.
   */
  public async renameFleetShip(
    accountId: string,
    fleetShipId: string,
    newName: string
  ): Promise<{ success: boolean; ship?: FleetShip; error?: string }> {
    const trimmed = (newName || '').trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      return {
        success: false,
        error: 'INVALID_NAME: Escort callsign must be between 2 and 40 characters.',
      };
    }

    const { rows } = await db.query<any>(
      `UPDATE player_fleet
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND account_id = $3
       RETURNING *`,
      [trimmed, fleetShipId, accountId]
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: `FLEET_SHIP_NOT_FOUND: Ship with ID "${fleetShipId}" does not exist in your fleet garage.`,
      };
    }

    return {
      success: true,
      ship: this.mapRowToShip(rows[0]),
    };
  }

  /**
   * Scraps an escort vessel in reserve for residual credits and plasteel alloys.
   */
  public async scrapFleetShip(
    accountId: string,
    fleetShipId: string
  ): Promise<{ success: boolean; scrappedShipId?: string; creditsRecovered: number; alloysRecovered: number; error?: string }> {
    const { rows: shipRows } = await db.query<any>(
      `SELECT * FROM player_fleet WHERE id = $1 AND account_id = $2`,
      [fleetShipId, accountId]
    );

    if (shipRows.length === 0) {
      return {
        success: false,
        creditsRecovered: 0,
        alloysRecovered: 0,
        error: `FLEET_SHIP_NOT_FOUND: Ship with ID "${fleetShipId}" does not exist in your fleet garage.`,
      };
    }

    const ship = shipRows[0];
    const creditsRecovered = 200;
    const alloysRecovered = 5;

    // 1. Credit player account
    await db.query(`UPDATE accounts SET credits = credits + $1 WHERE id = $2`, [creditsRecovered, accountId]);

    // 2. Deposit plasteel alloys into player ship hold
    const { rows: sRows } = await db.query<any>(`SELECT id FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length > 0) {
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, 'COMM_ALLOY', $2)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $2`,
        [sRows[0].id, alloysRecovered]
      );
    }

    // 3. Delete from player_fleet
    await db.query(`DELETE FROM player_fleet WHERE id = $1 AND account_id = $2`, [fleetShipId, accountId]);

    return {
      success: true,
      scrappedShipId: fleetShipId,
      creditsRecovered,
      alloysRecovered,
    };
  }

  /**
   * Deducts operational maintenance upkeep for all active wingmen.
   */
  public async processFleetUpkeep(
    accountId: string = 'acc_sol_captain'
  ): Promise<{ success: boolean; upkeepCost: number; activeWingmenCount: number; remainingCredits?: number; message: string }> {
    const { rows: activeRows } = await db.query<any>(
      `SELECT id FROM player_fleet WHERE account_id = $1 AND deployment_slot IS NOT NULL AND status != 'DESTROYED'`,
      [accountId]
    );

    const activeCount = activeRows.length;
    const upkeepCost = activeCount * 15;

    if (activeCount === 0) {
      return {
        success: true,
        upkeepCost: 0,
        activeWingmenCount: 0,
        message: 'No active wingmen deployed; zero operational upkeep incurred.',
      };
    }

    const accRes = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    const currentCredits = accRes.rows[0]?.credits || 0;
    const deduction = Math.min(currentCredits, upkeepCost);
    const newCredits = Math.max(0, currentCredits - deduction);

    await db.query(`UPDATE accounts SET credits = $1 WHERE id = $2`, [newCredits, accountId]);

    return {
      success: true,
      upkeepCost: deduction,
      activeWingmenCount: activeCount,
      remainingCredits: newCredits,
      message: `Deducted ${deduction} Credits operational fleet upkeep for ${activeCount} active wingman escort(s).`,
    };
  }

  /**
   * Helper to commission a new escort ship into the fleet (e.g. fabricated at shipyard).
   */
  public async commissionShip(
    accountId: string,
    shipData: {
      name: string;
      blueprintId: string;
      hullClass: string;
      factionId: string;
      hull: number;
      shield: number;
      speed: number;
      turnRate: number;
      firepower: number;
      specialAbility: string;
    }
  ): Promise<FleetShip> {
    const id = `fleet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { rows } = await db.query<any>(
      `INSERT INTO player_fleet (
         id, account_id, name, blueprint_id, hull_class, faction_id,
         hull, max_hull, shield, max_shield, speed, turn_rate, firepower,
         special_ability, fitted_modules, deployment_slot, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $7, $8, $8, $9, $10, $11,
         $12, '[]'::jsonb, NULL, 'READY'
       ) RETURNING *`,
      [
        id,
        accountId,
        shipData.name,
        shipData.blueprintId,
        shipData.hullClass,
        shipData.factionId,
        shipData.hull,
        shipData.shield,
        shipData.speed,
        shipData.turnRate,
        shipData.firepower,
        shipData.specialAbility,
      ]
    );

    return this.mapRowToShip(rows[0]);
  }

  /**
   * Debug reset helper to restore player fleet to canonical initial baseline.
   */
  public async debugReset(accountId: string = 'acc_sol_captain'): Promise<void> {
    await db.query(`DELETE FROM player_fleet WHERE account_id = $1`, [accountId]);
    await db.query(
      `INSERT INTO player_fleet (
         id, account_id, name, blueprint_id, hull_class, faction_id,
         hull, max_hull, shield, max_shield, speed, turn_rate, firepower,
         special_ability, fitted_modules, deployment_slot, status
       ) VALUES
       (
         'fleet_escort_sol_01', $1, 'Sol Vanguard Escort Alpha', 'HULL_SOL_CRUISER', 'SOL_CRUISER', 'FACTION_SOL',
         150, 150, 100, 100, 65.0, 2.5, 35,
         'POINT_DEFENSE', '[]'::jsonb, 1, 'READY'
       ),
       (
         'fleet_escort_kryll_01', $1, 'Kryll Skrit Shadow Runner', 'HULL_KRYLL_RUNNER', 'KRYLL_RUNNER', 'FACTION_KRYLL',
         100, 100, 80, 80, 85.0, 3.2, 28,
         'DECOY_HOLO', '[]'::jsonb, NULL, 'READY'
       )`,
      [accountId]
    );
  }

  private mapRowToShip(r: any): FleetShip {
    return {
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      blueprintId: r.blueprint_id,
      hullClass: r.hull_class,
      factionId: r.faction_id,
      hull: r.hull,
      maxHull: r.max_hull,
      shield: r.shield,
      maxShield: r.max_shield,
      speed: Number(r.speed),
      turnRate: Number(r.turn_rate),
      firepower: r.firepower,
      specialAbility: r.special_ability,
      fittedModules: typeof r.fitted_modules === 'string' ? JSON.parse(r.fitted_modules) : (r.fitted_modules || []),
      deploymentSlot: r.deployment_slot !== null && r.deployment_slot !== undefined ? Number(r.deployment_slot) : null,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const fleetService = new FleetService();


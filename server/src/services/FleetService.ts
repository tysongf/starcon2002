import { db } from '../db/Database';
import { getHullDef, type HullGeometryProfile, type MainHullClass } from '../procgen/HullClassCatalog';
import { outfittingService } from './OutfittingService';

export interface FleetShip {
  id: string;
  accountId: string;
  name: string;
  blueprintId: string;
  hullClass: string;
  mainHullClass: MainHullClass;
  hullSubtype: string;
  factionId: string;
  hullSeed: number;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  speed: number;
  turnRate: number;
  firepower: number;
  powerGridMax: number;
  cpuMax: number;
  maxFuel: number;
  cargoCapacity: number;
  slotLayout: { high: number; mid: number; low: number };
  geometryProfile: HullGeometryProfile;
  specialAbility: string;
  fittedModules: any[];
  deploymentSlot: number | null; // 1..4 = Active Wingman; null = Hangar Reserve
  currentSectorId?: number;
  status: 'READY' | 'DEPLOYED' | 'DESTROYED';
  createdAt: string;
  updatedAt: string;
}

export interface ActiveFlagshipSummary {
  id: string;
  accountId: string;
  name: string;
  hullClass: string;
  mainHullClass: MainHullClass;
  hullSubtype: string;
  factionId: string;
  hullSeed: number;
  armor: number;
  maxArmor: number;
  shield: number;
  maxShield: number;
  fuel: number;
  maxFuel: number;
  cargoCapacity: number;
  powerGridMax: number;
  cpuMax: number;
  baseSpeed: number;
  baseTurnRate: number;
  slotLayout: { high: number; mid: number; low: number };
  geometryProfile: HullGeometryProfile;
  currentSectorId: number;
}

export interface FleetRosterResponse {
  success: boolean;
  accountId: string;
  maxWingmen: number;
  bridgeTier: number;
  bridgeModuleName: string;
  upkeepPerCycle: number;
  activeFlagship: ActiveFlagshipSummary | null;
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
      WHERE pi.account_id = $1 AND pi.is_fitted = true AND (eb.subtype = 'Command Bridge' OR pi.blueprint_id LIKE 'MOD_BRIDGE_%')
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

    // 2. Fetch active flagship & all fleet ships owned by account
    const [{ rows: shipRows }, { rows: fleetRows }] = await Promise.all([
      db.query<any>(`SELECT * FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]),
      db.query<any>(
        `SELECT * FROM player_fleet
         WHERE account_id = $1
         ORDER BY deployment_slot ASC NULLS LAST, created_at ASC`,
        [accountId]
      ),
    ]);

    const rawFlagship = shipRows[0];
    let activeFlagship: ActiveFlagshipSummary | null = null;
    if (rawFlagship) {
      const hullDef = getHullDef(rawFlagship.hull_class);
      activeFlagship = {
        id: rawFlagship.id,
        accountId: rawFlagship.account_id,
        name: rawFlagship.flagship_name || hullDef.displayName,
        hullClass: rawFlagship.hull_class || hullDef.hullClass,
        mainHullClass: (rawFlagship.main_hull_class || hullDef.mainClass) as MainHullClass,
        hullSubtype: rawFlagship.hull_subtype || hullDef.displayName,
        factionId: rawFlagship.faction_id || hullDef.factionId,
        hullSeed: Number(rawFlagship.hull_seed ?? hullDef.hullSeedDefault),
        armor: Number(rawFlagship.armor ?? hullDef.baseArmor),
        maxArmor: Number(rawFlagship.max_armor ?? hullDef.baseArmor),
        shield: Number(rawFlagship.shield ?? hullDef.baseShield),
        maxShield: Number(rawFlagship.max_shield ?? hullDef.baseShield),
        fuel: Number(rawFlagship.fuel ?? hullDef.maxFuel),
        maxFuel: Number(rawFlagship.max_fuel ?? hullDef.maxFuel),
        cargoCapacity: Number(rawFlagship.cargo_capacity ?? hullDef.cargoCapacity),
        powerGridMax: Number(rawFlagship.power_grid_max ?? hullDef.powerGridMax),
        cpuMax: Number(rawFlagship.cpu_max ?? hullDef.cpuMax),
        baseSpeed: Number(rawFlagship.base_speed ?? hullDef.baseSpeed),
        baseTurnRate: Number(rawFlagship.base_turn_rate ?? hullDef.baseTurnRate),
        slotLayout: {
          high: Number(rawFlagship.high_slots ?? hullDef.highSlots),
          mid: Number(rawFlagship.mid_slots ?? hullDef.midSlots),
          low: Number(rawFlagship.low_slots ?? hullDef.lowSlots),
        },
        geometryProfile: hullDef.geometryProfile,
        currentSectorId: Number(rawFlagship.current_sector_id ?? 1),
      };
    }

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
      activeFlagship,
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
   * Promotes any ready ship in player_fleet to Active Flagship in one click,
   * cleanly demoting the outgoing Flagship back into Reserve Fleet and reconciling
   * any overflow fitted modules back into the Station Locker.
   */
  public async promoteFlagship(
    accountId: string,
    fleetShipId: string
  ): Promise<{
    success: boolean;
    promotedShipId?: string;
    activeFlagship?: ActiveFlagshipSummary | null;
    demotedShip?: FleetShip;
    unfittedModules?: any[];
    loadout?: any;
    roster?: FleetRosterResponse;
    error?: string;
  }> {
    const [{ rows: fleetRows }, { rows: shipRows }] = await Promise.all([
      db.query<any>(`SELECT * FROM player_fleet WHERE id = $1 AND account_id = $2`, [
        fleetShipId,
        accountId,
      ]),
      db.query<any>(`SELECT * FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]),
    ]);

    if (fleetRows.length === 0) {
      return {
        success: false,
        error: `FLEET_SHIP_NOT_FOUND: Vessel "${fleetShipId}" does not exist in your hangar.`,
      };
    }

    const incoming = fleetRows[0];
    if (incoming.status === 'DESTROYED') {
      return {
        success: false,
        error: 'SHIP_DESTROYED: Damaged wreck cannot be promoted to Active Flagship.',
      };
    }

    if (shipRows.length === 0) {
      return { success: false, error: 'ACTIVE_FLAGSHIP_NOT_FOUND' };
    }

    const outgoing = shipRows[0];
    const incomingDef = getHullDef(incoming.hull_class);
    const outgoingDef = getHullDef(outgoing.hull_class);

    // Ensure existing ship cargo fits in incoming hull hold
    const { rows: cargoSumRows } = await db.query<{ total: string }>(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM ship_cargo WHERE ship_id = $1`,
      [outgoing.id]
    );
    const currentCargo = Number(cargoSumRows[0]?.total || 0);
    if (currentCargo > incomingDef.cargoCapacity) {
      return {
        success: false,
        error: `CARGO_HOLD_EXCEEDS_NEW_HULL: Your active hold carries ${currentCargo} m³, exceeding ${incomingDef.displayName}'s ${incomingDef.cargoCapacity} m³ limit.`,
      };
    }

    // 1. Insert outgoing Flagship into Reserve Fleet
    const demotedId = `fleet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outgoingArmor = Math.max(1, Number(outgoing.armor ?? outgoingDef.baseArmor));
    const outgoingMaxArmor = Math.max(1, Number(outgoing.max_armor ?? outgoingDef.baseArmor));
    const outgoingShield = Math.max(0, Number(outgoing.shield ?? outgoingDef.baseShield));
    const outgoingMaxShield = Math.max(1, Number(outgoing.max_shield ?? outgoingDef.baseShield));

    const { rows: demotedRows } = await db.query<any>(
      `INSERT INTO player_fleet (
         id, account_id, name, blueprint_id, hull_class, main_hull_class, hull_subtype,
         faction_id, hull_seed, hull, max_hull, shield, max_shield, speed, turn_rate,
         firepower, special_ability, fitted_modules, deployment_slot, current_sector_id, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13, $14, $15,
         $16, $17, '[]'::jsonb, NULL, $18, 'READY'
       ) RETURNING *`,
      [
        demotedId,
        accountId,
        outgoing.flagship_name || outgoingDef.displayName,
        `HULL_${outgoingDef.hullClass}`,
        outgoingDef.hullClass,
        outgoing.main_hull_class || outgoingDef.mainClass,
        outgoing.hull_subtype || outgoingDef.displayName,
        outgoing.faction_id || outgoingDef.factionId,
        Number(outgoing.hull_seed ?? outgoingDef.hullSeedDefault),
        outgoingArmor,
        outgoingMaxArmor,
        outgoingShield,
        outgoingMaxShield,
        Number(outgoing.base_speed ?? outgoingDef.baseSpeed),
        Number(outgoing.base_turn_rate ?? outgoingDef.baseTurnRate),
        outgoingDef.baseFirepower,
        outgoingDef.mainClass,
        Number(outgoing.current_sector_id ?? 1),
      ]
    );

    // 2. Promote incoming ship into active Flagship (`ships`)
    const newArmor = Math.min(incomingDef.baseArmor, Math.max(1, Number(incoming.hull ?? incomingDef.baseArmor)));
    const newShield = Math.min(incomingDef.baseShield, Math.max(0, Number(incoming.shield ?? incomingDef.baseShield)));
    const newFuel = Math.min(incomingDef.maxFuel, Math.max(0, Number(outgoing.fuel ?? incomingDef.maxFuel)));
    const newSeed = Number(incoming.hull_seed ?? incomingDef.hullSeedDefault);

    await db.query(
      `UPDATE ships SET
         hull_class = $1,
         main_hull_class = $2,
         hull_subtype = $3,
         flagship_name = $4,
         faction_id = $5,
         hull_seed = $6,
         armor = $7,
         max_armor = $8,
         shield = $9,
         max_shield = $10,
         fuel = $11,
         max_fuel = $12,
         cargo_capacity = $13,
         power_grid_max = $14,
         cpu_max = $15,
         base_speed = $16,
         base_turn_rate = $17,
         high_slots = $18,
         mid_slots = $19,
         low_slots = $20,
         updated_at = NOW()
       WHERE id = $21`,
      [
        incomingDef.hullClass,
        incoming.main_hull_class || incomingDef.mainClass,
        incoming.hull_subtype || incomingDef.displayName,
        incoming.name || incomingDef.displayName,
        incoming.faction_id || incomingDef.factionId,
        newSeed,
        newArmor,
        incomingDef.baseArmor,
        newShield,
        incomingDef.baseShield,
        newFuel,
        incomingDef.maxFuel,
        incomingDef.cargoCapacity,
        incomingDef.powerGridMax,
        incomingDef.cpuMax,
        incomingDef.baseSpeed,
        incomingDef.baseTurnRate,
        incomingDef.highSlots,
        incomingDef.midSlots,
        incomingDef.lowSlots,
        outgoing.id,
      ]
    );

    // 3. Remove promoted vessel row from player_fleet
    await db.query(`DELETE FROM player_fleet WHERE id = $1 AND account_id = $2`, [
      fleetShipId,
      accountId,
    ]);

    // 4. Reconcile fitted modules against new hull slot counts & PG/CPU ceiling
    const { unfittedModules, loadout } = await outfittingService.reconcileLoadoutToHull(accountId, {
      highSlots: incomingDef.highSlots,
      midSlots: incomingDef.midSlots,
      lowSlots: incomingDef.lowSlots,
      powerGridMax: incomingDef.powerGridMax,
      cpuMax: incomingDef.cpuMax,
    });

    const roster = await this.getFleetRoster(accountId);
    return {
      success: true,
      promotedShipId: fleetShipId,
      activeFlagship: roster.activeFlagship,
      demotedShip: this.mapRowToShip(demotedRows[0]),
      unfittedModules,
      loadout,
      roster,
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
      hullSeed?: number;
      mainHullClass?: MainHullClass;
      hullSubtype?: string;
    }
  ): Promise<FleetShip> {
    const hullDef = getHullDef(shipData.hullClass);
    const id = `fleet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hullSeed = shipData.hullSeed ?? (hullDef.hullSeedDefault + Math.floor(Math.random() * 900));
    const { rows } = await db.query<any>(
      `INSERT INTO player_fleet (
         id, account_id, name, blueprint_id, hull_class, main_hull_class, hull_subtype,
         faction_id, hull_seed, hull, max_hull, shield, max_shield, speed, turn_rate,
         firepower, special_ability, fitted_modules, deployment_slot, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $10, $11, $11, $12, $13,
         $14, $15, '[]'::jsonb, NULL, 'READY'
       ) RETURNING *`,
      [
        id,
        accountId,
        shipData.name,
        shipData.blueprintId,
        shipData.hullClass,
        shipData.mainHullClass || hullDef.mainClass,
        shipData.hullSubtype || hullDef.displayName,
        shipData.factionId,
        hullSeed,
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
    await db.query(`DELETE FROM player_inventory WHERE account_id = $1 AND blueprint_id LIKE 'MOD_BRIDGE_%'`, [accountId]);
    await db.query(
      `INSERT INTO player_fleet (
         id, account_id, name, blueprint_id, hull_class, main_hull_class, hull_subtype,
         faction_id, hull_seed, hull, max_hull, shield, max_shield, speed, turn_rate,
         firepower, special_ability, fitted_modules, deployment_slot, status
       ) VALUES
       (
         'fleet_escort_sol_01', $1, 'Sol Vanguard Escort Alpha', 'HULL_SOL_CRUISER', 'SOL_CRUISER', 'CRUISER', 'Sol Vanguard Missile Cruiser',
         'FACTION_SOL', 41001, 150, 150, 100, 100, 65.0, 2.5,
         35, 'POINT_DEFENSE', '[]'::jsonb, 1, 'READY'
       ),
       (
         'fleet_escort_kryll_01', $1, 'Kryll Skrit Shadow Runner', 'HULL_KRYLL_RUNNER', 'KRYLL_RUNNER', 'INTERCEPTOR', 'Kryll Shadow-Runner',
         'FACTION_KRYLL', 41002, 100, 100, 80, 80, 85.0, 3.2,
         28, 'DECOY_HOLO', '[]'::jsonb, NULL, 'READY'
       )`,
      [accountId]
    );
  }

  public mapRowToShip(r: any): FleetShip {
    const hullDef = getHullDef(r.hull_class);
    return {
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      blueprintId: r.blueprint_id,
      hullClass: r.hull_class,
      mainHullClass: (r.main_hull_class || hullDef.mainClass) as MainHullClass,
      hullSubtype: r.hull_subtype || hullDef.displayName,
      factionId: r.faction_id,
      hullSeed: Number(r.hull_seed ?? hullDef.hullSeedDefault),
      hull: r.hull,
      maxHull: r.max_hull,
      shield: r.shield,
      maxShield: r.max_shield,
      speed: Number(r.speed),
      turnRate: Number(r.turn_rate),
      firepower: r.firepower,
      powerGridMax: hullDef.powerGridMax,
      cpuMax: hullDef.cpuMax,
      maxFuel: hullDef.maxFuel,
      cargoCapacity: hullDef.cargoCapacity,
      slotLayout: {
        high: hullDef.highSlots,
        mid: hullDef.midSlots,
        low: hullDef.lowSlots,
      },
      geometryProfile: hullDef.geometryProfile,
      specialAbility: r.special_ability,
      fittedModules: typeof r.fitted_modules === 'string' ? JSON.parse(r.fitted_modules) : (r.fitted_modules || []),
      deploymentSlot: r.deployment_slot !== null && r.deployment_slot !== undefined ? Number(r.deployment_slot) : null,
      currentSectorId: r.current_sector_id !== null && r.current_sector_id !== undefined ? Number(r.current_sector_id) : 1,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const fleetService = new FleetService();


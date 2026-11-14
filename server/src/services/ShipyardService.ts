import { db } from '../db/Database';
import { reputationService, type FactionId } from './ReputationService';
import { apService } from './ActionPointService';
import { fleetService, type FleetShip } from './FleetService';
import { colonyService, type ColonyDetail } from './ColonyService';

export interface ShipyardBlueprint {
  id: string;
  name: string;
  hullClass: string;
  factionId: string;
  tier: number;
  creditCost: number;
  apCost: number;
  alloyCost: number;
  oreCost: number;
  fuelCost: number;
  requiredReputation: number;
  baseHull: number;
  baseShield: number;
  baseSpeed: number;
  baseTurnRate: number;
  baseFirepower: number;
  specialAbility: string;
  description: string;
  canAfford?: boolean;
  hasReputation?: boolean;
  effectiveCreditCost?: number;
  effectiveApCost?: number;
  effectiveAlloyCost?: number;
  effectiveOreCost?: number;
  effectiveFuelCost?: number;
  missingRequirements?: string[];
}

export interface FabricationResult {
  success: boolean;
  ship?: FleetShip;
  blueprint?: ShipyardBlueprint;
  isColonyDiscountApplied?: boolean;
  materialsDeducted?: {
    credits: number;
    ap: number;
    alloy: number;
    ore: number;
    fuel: number;
    source: 'SHIP_HOLD' | 'COLONY_SILO';
  };
  remainingCredits?: number;
  remainingAP?: number;
  error?: string;
}

export class ShipyardService {
  private normalizeFaction(fid: string): FactionId {
    if (fid === 'FACTION_VAELIC') return 'FACTION_HEGEMONY';
    return fid as FactionId;
  }

  /**
   * Retrieves the catalog of naval starship blueprints annotated with player eligibility.
   */
  public async getFleetBlueprints(
    accountId: string = 'acc_sol_captain',
    colonyId?: string
  ): Promise<{
    success: boolean;
    blueprints: ShipyardBlueprint[];
    colonyId?: string;
    isColonyShipyard: boolean;
    discountMultiplier: number;
  }> {
    const { rows: bpRows } = await db.query<any>(
      `SELECT * FROM shipyard_blueprints ORDER BY tier ASC, credit_cost ASC`
    );

    let colony: ColonyDetail | null = null;
    let isColonyShipyard = false;
    let discountMultiplier = 1.0;

    if (colonyId) {
      try {
        colony = await colonyService.getColonyDetail(colonyId, accountId);
        isColonyShipyard = true;
        discountMultiplier = 0.75; // 25% localized manufacturing discount
      } catch (err) {
        console.warn(`[ShipyardService] Colony ${colonyId} not found, proceeding with station pricing`);
      }
    }

    // Query player credits & AP
    const accRes = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    const credits = accRes.rows[0]?.credits || 0;
    const apState = await apService.getAP(accountId);
    const ap = apState.currentAP || 0;

    // Query ship cargo
    const { rows: sRows } = await db.query<any>(`SELECT id FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    const shipId = sRows[0]?.id;
    const cargoMap: Record<string, number> = { COMM_ALLOY: 0, COMM_ORE: 0, COMM_FUEL: 0 };
    if (shipId) {
      const { rows: cRows } = await db.query<any>(
        `SELECT commodity_id, quantity FROM ship_cargo WHERE ship_id = $1`,
        [shipId]
      );
      for (const c of cRows) {
        cargoMap[c.commodity_id] = c.quantity;
      }
    }

    // Add colony silo stockpile if available
    if (colony) {
      cargoMap[colony.commodityId] = (cargoMap[colony.commodityId] || 0) + colony.stockpiledAmount;
    }

    // Fetch standings
    const standings = await reputationService.getStandings(accountId);
    const standingMap: Record<string, number> = {};
    for (const s of standings) {
      standingMap[s.factionId] = s.standing;
      if (s.factionId === 'FACTION_HEGEMONY') {
        standingMap['FACTION_VAELIC'] = s.standing;
      }
    }

    const blueprints: ShipyardBlueprint[] = bpRows.map((r) => {
      const effCredit = Math.round(r.credit_cost * discountMultiplier);
      const effAP = Math.max(1, Math.round(r.ap_cost * discountMultiplier));
      const effAlloy = Math.round(r.alloy_cost * discountMultiplier);
      const effOre = Math.round(r.ore_cost * discountMultiplier);
      const effFuel = Math.round(r.fuel_cost * discountMultiplier);

      const playerStanding = standingMap[r.faction_id] || 0;
      const hasReputation = playerStanding >= r.required_reputation;

      const missing: string[] = [];
      if (!hasReputation) {
        missing.push(`Requires +${r.required_reputation} Standing with ${r.faction_id} (Current: ${playerStanding})`);
      }
      if (credits < effCredit) {
        missing.push(`Requires ${effCredit} Cr (Available: ${credits} Cr)`);
      }
      if (ap < effAP) {
        missing.push(`Requires ${effAP} AP (Available: ${ap} AP)`);
      }
      if ((cargoMap.COMM_ALLOY || 0) < effAlloy) {
        missing.push(`Requires ${effAlloy} Plasteel Alloys (Available: ${cargoMap.COMM_ALLOY || 0})`);
      }
      if ((cargoMap.COMM_ORE || 0) < effOre) {
        missing.push(`Requires ${effOre} Silicate Ore (Available: ${cargoMap.COMM_ORE || 0})`);
      }
      if ((cargoMap.COMM_FUEL || 0) < effFuel) {
        missing.push(`Requires ${effFuel} Deuterium Fuel (Available: ${cargoMap.COMM_FUEL || 0})`);
      }
      if (colony && (colony.shipyardTier || 0) < r.tier) {
        missing.push(`Requires Colony Shipyard Tier ${r.tier} Slipway (Current: Tier ${colony.shipyardTier || 0})`);
      }

      const canAfford = missing.length === 0;

      return {
        id: r.id,
        name: r.name,
        hullClass: r.hull_class,
        factionId: r.faction_id,
        tier: r.tier,
        creditCost: r.credit_cost,
        apCost: r.ap_cost,
        alloyCost: r.alloy_cost,
        oreCost: r.ore_cost,
        fuelCost: r.fuel_cost,
        requiredReputation: r.required_reputation,
        baseHull: r.base_hull,
        baseShield: r.base_shield,
        baseSpeed: Number(r.base_speed),
        baseTurnRate: Number(r.base_turn_rate),
        baseFirepower: r.base_firepower,
        specialAbility: r.special_ability,
        description: r.description,
        effectiveCreditCost: effCredit,
        effectiveApCost: effAP,
        effectiveAlloyCost: effAlloy,
        effectiveOreCost: effOre,
        effectiveFuelCost: effFuel,
        hasReputation,
        canAfford,
        missingRequirements: missing,
      };
    });

    return {
      success: true,
      blueprints,
      colonyId,
      isColonyShipyard,
      discountMultiplier,
    };
  }

  /**
   * Fabricates an escort starship hull and commissions it into the player's fleet reserve.
   */
  public async fabricateFleetHull(
    accountId: string = 'acc_sol_captain',
    blueprintId: string,
    customName?: string,
    colonyId?: string
  ): Promise<FabricationResult> {
    // 1. Fetch Blueprint
    const { rows: bpRows } = await db.query<any>(
      `SELECT * FROM shipyard_blueprints WHERE id = $1`,
      [blueprintId]
    );

    if (bpRows.length === 0) {
      return {
        success: false,
        error: `BLUEPRINT_NOT_FOUND: Unknown starship blueprint "${blueprintId}".`,
      };
    }

    const bp = bpRows[0];

    // 2. Validate Faction Standing
    const normalizedFaction = this.normalizeFaction(bp.faction_id);
    const standings = await reputationService.getStandings(accountId);
    const standing = standings.find((s) => s.factionId === normalizedFaction)?.standing ?? 0;

    if (standing < bp.required_reputation) {
      return {
        success: false,
        error: `INSUFFICIENT_FACTION_STANDING: Requires standing of at least +${bp.required_reputation} with ${bp.faction_id} (Current: ${standing}). Faction command refuses naval ship requisition.`,
      };
    }

    // 3. Compute effective costs (Colony 25% discount vs Station)
    let colony: ColonyDetail | null = null;
    let discountMult = 1.0;
    let isColonyDiscountApplied = false;

    if (colonyId) {
      try {
        colony = await colonyService.getColonyDetail(colonyId, accountId);
        const colTier = colony.shipyardTier || 0;
        if (colTier < bp.tier) {
          return {
            success: false,
            error: `INSUFFICIENT_SHIPYARD_TIER: Colony shipyard is Tier ${colTier}. Requisitioning ${bp.name} requires Tier ${bp.tier} slipway.`,
          };
        }
        discountMult = 0.75;
        isColonyDiscountApplied = true;
      } catch (err: any) {
        return {
          success: false,
          error: `COLONY_NOT_FOUND: ${err.message}`,
        };
      }
    }

    const reqCredits = Math.round(bp.credit_cost * discountMult);
    const reqAP = Math.max(1, Math.round(bp.ap_cost * discountMult));
    const reqAlloy = Math.round(bp.alloy_cost * discountMult);
    const reqOre = Math.round(bp.ore_cost * discountMult);
    const reqFuel = Math.round(bp.fuel_cost * discountMult);

    // 4. Verify Credits
    const accRes = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    const credits = accRes.rows[0]?.credits || 0;
    if (credits < reqCredits) {
      return {
        success: false,
        error: `INSUFFICIENT_CREDITS: Hull fabrication requires ${reqCredits} Credits (Current: ${credits} CR).`,
      };
    }

    // 5. Verify AP
    const apCheck = await apService.getAP(accountId);
    if ((apCheck.currentAP || 0) < reqAP) {
      return {
        success: false,
        error: `INSUFFICIENT_AP: Hull fabrication requires ${reqAP} AP (Available: ${apCheck.currentAP} AP).`,
      };
    }

    // 6. Verify and deduct commodities
    const { rows: sRows } = await db.query<any>(`SELECT id FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    const shipId = sRows[0]?.id;
    if (!shipId) {
      return { success: false, error: 'SHIP_NOT_FOUND' };
    }

    const { rows: cargoRows } = await db.query<any>(
      `SELECT commodity_id, quantity FROM ship_cargo WHERE ship_id = $1`,
      [shipId]
    );
    const cargo: Record<string, number> = {};
    for (const c of cargoRows) {
      cargo[c.commodity_id] = c.quantity;
    }

    // Available combined resources
    let availAlloy = cargo.COMM_ALLOY || 0;
    let availOre = cargo.COMM_ORE || 0;
    let availFuel = cargo.COMM_FUEL || 0;

    let colonySiloDeducted = 0;
    if (colony) {
      if (colony.commodityId === 'COMM_ALLOY') availAlloy += colony.stockpiledAmount;
      if (colony.commodityId === 'COMM_ORE') availOre += colony.stockpiledAmount;
      if (colony.commodityId === 'COMM_FUEL') availFuel += colony.stockpiledAmount;
    }

    if (availAlloy < reqAlloy || availOre < reqOre || availFuel < reqFuel) {
      return {
        success: false,
        error: `INSUFFICIENT_MATERIALS: Hull requires ${reqAlloy} Alloys, ${reqOre} Ore, ${reqFuel} Fuel. Available: ${availAlloy} Alloys, ${availOre} Ore, ${availFuel} Fuel.`,
      };
    }

    // Deduct commodities (from colony silo first if applicable, then ship cargo)
    const deductCommodity = async (commodityId: string, needed: number) => {
      let remaining = needed;
      if (colony && colony.commodityId === commodityId && colony.stockpiledAmount > 0) {
        const fromSilo = Math.min(colony.stockpiledAmount, remaining);
        colony.stockpiledAmount -= fromSilo;
        remaining -= fromSilo;
        colonySiloDeducted += fromSilo;
        await db.query(
          `UPDATE colonies SET stockpiled_amount = stockpiled_amount - $1 WHERE id = $2`,
          [fromSilo, colony.id]
        );
      }
      if (remaining > 0) {
        await db.query(
          `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = $3`,
          [remaining, shipId, commodityId]
        );
      }
    };

    await deductCommodity('COMM_ALLOY', reqAlloy);
    await deductCommodity('COMM_ORE', reqOre);
    await deductCommodity('COMM_FUEL', reqFuel);

    // Clean up empty cargo rows
    await db.query(`DELETE FROM ship_cargo WHERE ship_id = $1 AND quantity <= 0`, [shipId]);

    // Deduct Credits & AP
    const newCredits = credits - reqCredits;
    await db.query(`UPDATE accounts SET credits = $1 WHERE id = $2`, [newCredits, accountId]);
    await apService.deductAP(accountId, reqAP, `Fabricate ${bp.name}`);

    // Commission Ship into Fleet Hangar Reserve
    const finalName = (customName || '').trim() || bp.name;
    const newShip = await fleetService.commissionShip(accountId, {
      name: finalName,
      blueprintId: bp.id,
      hullClass: bp.hull_class,
      factionId: bp.faction_id,
      hull: bp.base_hull,
      shield: bp.base_shield,
      speed: Number(bp.base_speed),
      turnRate: Number(bp.base_turn_rate),
      firepower: bp.base_firepower,
      specialAbility: bp.special_ability,
    });

    const updatedAp = (await apService.getAP(accountId)).currentAP;

    return {
      success: true,
      ship: newShip,
      blueprint: bp,
      isColonyDiscountApplied,
      materialsDeducted: {
        credits: reqCredits,
        ap: reqAP,
        alloy: reqAlloy,
        ore: reqOre,
        fuel: reqFuel,
        source: colonySiloDeducted > 0 ? 'COLONY_SILO' : 'SHIP_HOLD',
      },
      remainingCredits: newCredits,
      remainingAP: updatedAp,
    };
  }

  /**
   * Refurbishes a recovered persistent derelict escort wreck into ready fleet service
   * at a 50% discount across Credits, AP, and commodity materials, with no reputation gate.
   */
  public async refurbishEscortWreck(
    accountId: string = 'acc_sol_captain',
    wreckId: string,
    colonyId?: string
  ): Promise<FabricationResult> {
    // 1. Fetch persistent wreck from database
    const { rows: wreckRows } = await db.query<any>(
      `SELECT * FROM wrecks WHERE id = $1`,
      [wreckId]
    );

    if (wreckRows.length === 0) {
      return {
        success: false,
        error: `WRECK_NOT_FOUND: Derelict wreck "${wreckId}" not found in salvage registry.`,
      };
    }

    const wreck = wreckRows[0];

    // 2. Identify corresponding starship blueprint
    let bp: any = null;
    if (wreck.blueprint_id) {
      const { rows: bpRows } = await db.query<any>(
        `SELECT * FROM shipyard_blueprints WHERE id = $1 OR hull_class = $1 LIMIT 1`,
        [wreck.blueprint_id]
      );
      if (bpRows.length > 0) bp = bpRows[0];
    }

    if (!bp && wreck.ship_class) {
      const { rows: bpRows } = await db.query<any>(
        `SELECT * FROM shipyard_blueprints WHERE hull_class = $1 OR id = $1 OR name ILIKE $2 LIMIT 1`,
        [wreck.ship_class, `%${wreck.ship_class}%`]
      );
      if (bpRows.length > 0) bp = bpRows[0];
    }

    if (!bp) {
      // Fallback Sol Cruiser
      const { rows: bpRows } = await db.query<any>(
        `SELECT * FROM shipyard_blueprints WHERE id = 'HULL_SOL_CRUISER' LIMIT 1`
      );
      bp = bpRows[0];
    }

    if (!bp) {
      return {
        success: false,
        error: `BLUEPRINT_NOT_FOUND: Unable to resolve blueprint for wreck ${wreckId}.`,
      };
    }

    // 3. Compute 50% Refurbishment Discount (and colony tier check if at colony)
    let colony: ColonyDetail | null = null;
    let isColonyDiscountApplied = false;

    if (colonyId) {
      try {
        colony = await colonyService.getColonyDetail(colonyId, accountId);
        const colTier = colony.shipyardTier || 0;
        if (colTier < bp.tier) {
          return {
            success: false,
            error: `INSUFFICIENT_SHIPYARD_TIER: Colony shipyard is Tier ${colTier}. Refurbishing ${bp.name} requires Tier ${bp.tier} slipway.`,
          };
        }
        isColonyDiscountApplied = true;
      } catch (err: any) {
        return {
          success: false,
          error: `COLONY_NOT_FOUND: ${err.message}`,
        };
      }
    }

    // 50% discount applies! (No reputation gate!)
    const discountMultiplier = 0.50;
    const reqCredits = Math.round(bp.credit_cost * discountMultiplier);
    const reqAP = Math.max(1, Math.round(bp.ap_cost * discountMultiplier));
    const reqAlloy = Math.round(bp.alloy_cost * discountMultiplier);
    const reqOre = Math.round(bp.ore_cost * discountMultiplier);
    const reqFuel = Math.round(bp.fuel_cost * discountMultiplier);

    // 4. Verify Credits
    const accRes = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    const credits = accRes.rows[0]?.credits || 0;
    if (credits < reqCredits) {
      return {
        success: false,
        error: `INSUFFICIENT_CREDITS: Escort refurbishment requires ${reqCredits} Credits (Current: ${credits} CR).`,
      };
    }

    // 5. Verify AP
    const apCheck = await apService.getAP(accountId);
    if ((apCheck.currentAP || 0) < reqAP) {
      return {
        success: false,
        error: `INSUFFICIENT_AP: Escort refurbishment requires ${reqAP} AP (Available: ${apCheck.currentAP} AP).`,
      };
    }

    // 6. Verify and deduct commodities
    const { rows: sRows } = await db.query<any>(`SELECT id FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    const shipId = sRows[0]?.id;
    if (!shipId) {
      return { success: false, error: 'SHIP_NOT_FOUND' };
    }

    const { rows: cargoRows } = await db.query<any>(
      `SELECT commodity_id, quantity FROM ship_cargo WHERE ship_id = $1`,
      [shipId]
    );
    const cargo: Record<string, number> = {};
    for (const c of cargoRows) {
      cargo[c.commodity_id] = c.quantity;
    }

    let availAlloy = cargo.COMM_ALLOY || 0;
    let availOre = cargo.COMM_ORE || 0;
    let availFuel = cargo.COMM_FUEL || 0;
    let colonySiloDeducted = 0;

    if (colony) {
      if (colony.commodityId === 'COMM_ALLOY') availAlloy += colony.stockpiledAmount;
      if (colony.commodityId === 'COMM_ORE') availOre += colony.stockpiledAmount;
      if (colony.commodityId === 'COMM_FUEL') availFuel += colony.stockpiledAmount;
    }

    if (availAlloy < reqAlloy || availOre < reqOre || availFuel < reqFuel) {
      return {
        success: false,
        error: `INSUFFICIENT_MATERIALS: Refurbishment requires ${reqAlloy} Alloys, ${reqOre} Ore, ${reqFuel} Fuel. Available: ${availAlloy} Alloys, ${availOre} Ore, ${availFuel} Fuel.`,
      };
    }

    // Deduct commodities (from colony silo first if applicable, then ship cargo)
    const deductCommodity = async (commodityId: string, needed: number) => {
      let remaining = needed;
      if (colony && colony.commodityId === commodityId && colony.stockpiledAmount > 0) {
        const fromSilo = Math.min(colony.stockpiledAmount, remaining);
        colony.stockpiledAmount -= fromSilo;
        remaining -= fromSilo;
        colonySiloDeducted += fromSilo;
        await db.query(
          `UPDATE colonies SET stockpiled_amount = stockpiled_amount - $1 WHERE id = $2`,
          [fromSilo, colony.id]
        );
      }
      if (remaining > 0) {
        await db.query(
          `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = $3`,
          [remaining, shipId, commodityId]
        );
      }
    };

    await deductCommodity('COMM_ALLOY', reqAlloy);
    await deductCommodity('COMM_ORE', reqOre);
    await deductCommodity('COMM_FUEL', reqFuel);

    await db.query(`DELETE FROM ship_cargo WHERE ship_id = $1 AND quantity <= 0`, [shipId]);

    // Deduct Credits & AP
    const newCredits = credits - reqCredits;
    await db.query(`UPDATE accounts SET credits = $1 WHERE id = $2`, [newCredits, accountId]);
    await apService.deductAP(accountId, reqAP, `Refurbish Derelict ${bp.name}`);

    // Remove Wreck from Wrecks table
    await db.query(`DELETE FROM wrecks WHERE id = $1`, [wreckId]);

    // Restore into Player Fleet
    let restoredShip: FleetShip;
    if (wreck.fleet_ship_id) {
      const { rows: fleetRows } = await db.query<any>(
        `UPDATE player_fleet 
         SET status = 'READY', hull = max_hull, shield = max_shield, updated_at = NOW() 
         WHERE id = $1 AND account_id = $2
         RETURNING *`,
        [wreck.fleet_ship_id, accountId]
      );
      if (fleetRows.length > 0) {
        restoredShip = fleetService.mapRowToShip(fleetRows[0]);
      } else {
        const cleanName = (wreck.ship_name || bp.name).replace(' Derelict Wreck', '');
        restoredShip = await fleetService.commissionShip(accountId, {
          name: cleanName,
          blueprintId: bp.id,
          hullClass: bp.hull_class,
          factionId: bp.faction_id,
          hull: bp.base_hull,
          shield: bp.base_shield,
          speed: Number(bp.base_speed),
          turnRate: Number(bp.base_turn_rate),
          firepower: bp.base_firepower,
          specialAbility: bp.special_ability,
        });
      }
    } else {
      const cleanName = (wreck.ship_name || bp.name).replace(' Derelict Wreck', '');
      restoredShip = await fleetService.commissionShip(accountId, {
        name: cleanName,
        blueprintId: bp.id,
        hullClass: bp.hull_class,
        factionId: bp.faction_id,
        hull: bp.base_hull,
        shield: bp.base_shield,
        speed: Number(bp.base_speed),
        turnRate: Number(bp.base_turn_rate),
        firepower: bp.base_firepower,
        specialAbility: bp.special_ability,
      });
    }

    const updatedAp = (await apService.getAP(accountId)).currentAP;

    return {
      success: true,
      ship: restoredShip,
      blueprint: bp,
      isColonyDiscountApplied,
      materialsDeducted: {
        credits: reqCredits,
        ap: reqAP,
        alloy: reqAlloy,
        ore: reqOre,
        fuel: reqFuel,
        source: colonySiloDeducted > 0 ? 'COLONY_SILO' : 'SHIP_HOLD',
      },
      remainingCredits: newCredits,
      remainingAP: updatedAp,
    };
  }
}

export const shipyardService = new ShipyardService();

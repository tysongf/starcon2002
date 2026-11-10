import { db } from '../db/Database';
import { apService } from './ActionPointService';
import { reputationService } from './ReputationService';

export interface ColonyDetail {
  id: string;
  accountId: string;
  planetId: string;
  beaconId: string;
  name: string;
  surfaceLat: number;
  surfaceLng: number;
  commodityId: string;
  commodityName: string;
  population: number;
  maxPopulation: number;
  stockpiledAmount: number;
  siloCapacity: number;
  derrickTier: number;
  habitationTier: number;
  terraformerTier: number;
  siloTier: number;
  terraformingProgress: number;
  productionRatePerMinute: number;
  lastHarvestAt: string;
  createdAt: string;
}

export class ColonyService {
  /**
   * Helper to resolve commodity friendly name.
   */
  public getCommodityName(id: string): string {
    switch (id) {
      case 'COMM_ORE': return 'Silicate Ore';
      case 'COMM_ALLOY': return 'Plasteel Alloy';
      case 'COMM_FUEL': return 'Cryo-Deuterium Fuel';
      case 'COMM_RATIONS': return 'Bio-Protein Organics';
      default: return 'Rare Minerals';
    }
  }

  /**
   * Founds a new colony outpost anchored to a surface sensor beacon.
   * Consumes 500 Credits, 5 AP, and 5x Bio-Protein Rations from cargo.
   */
  public async foundColony(
    accountId: string = 'acc_sol_captain',
    planetId: string,
    beaconId: string,
    name?: string
  ): Promise<ColonyDetail> {
    // 0. Day 21: Hostile airspace requires an active ceasefire truce (checked at action start)
    await reputationService.assertAirspaceClearance(accountId, planetId, 'Colony outpost founding');

    // 1. Verify beacon exists on the planet
    const bRes = await db.query<any>(
      'SELECT * FROM planet_beacons WHERE id = $1 AND planet_id = $2 AND account_id = $3',
      [beaconId, planetId, accountId]
    );
    if (bRes.rows.length === 0) {
      throw new Error(`SURFACE_BEACON_NOT_FOUND: Requires an active sensor beacon planted on ${planetId}.`);
    }
    const beacon = bRes.rows[0];

    // 2. Check if a colony is already anchored at this beacon
    const existing = await db.query('SELECT id FROM colonies WHERE beacon_id = $1', [beaconId]);
    if (existing.rows.length > 0) {
      throw new Error('BEACON_ALREADY_OCCUPIED: A colony outpost is already operating at this beacon coordinate.');
    }

    // 3. Validate and deduct 500 Credits
    const accRes = await db.query<any>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = accRes.rows[0]?.credits || 0;
    if (credits < 500) {
      throw new Error(`INSUFFICIENT_CREDITS: Founding an outpost requires 500 Credits (current: ${credits} CR).`);
    }
    await db.query('UPDATE accounts SET credits = credits - 500 WHERE id = $1', [accountId]);

    // 4. Validate and deduct 5 AP
    const apCheck = await apService.deductAP(accountId, 5, 'Found Planetary Colony Outpost');
    if (!apCheck.success) {
      // Refund credits
      await db.query('UPDATE accounts SET credits = credits + 500 WHERE id = $1', [accountId]);
      throw new Error(apCheck.error || 'INSUFFICIENT_AP: Colony founding requires 5 AP.');
    }

    // 5. Deduct 5 units of COMM_RATIONS from ship cargo (or insert/allow if ship has cargo)
    const shipRes = await db.query<any>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (shipRes.rows.length > 0) {
      const shipId = shipRes.rows[0].id;
      const cargoRes = await db.query<any>(
        'SELECT quantity FROM ship_cargo WHERE ship_id = $1 AND commodity_id = $2',
        [shipId, 'COMM_RATIONS']
      );
      const rations = cargoRes.rows[0]?.quantity || 0;
      if (rations >= 5) {
        await db.query('UPDATE ship_cargo SET quantity = quantity - 5 WHERE ship_id = $1 AND commodity_id = $2', [shipId, 'COMM_RATIONS']);
      }
    }

    // 6. Look up planet archetype to determine primary commodity
    const pRes = await db.query<any>('SELECT name, archetype FROM planets WHERE id = $1', [planetId]);
    const planet = pRes.rows[0];
    let commodityId = 'COMM_ORE';
    if (planet.archetype === 'TERRESTRIAL') commodityId = 'COMM_RATIONS';
    else if (planet.archetype === 'GAS_GIANT') commodityId = 'COMM_FUEL';
    else if (planet.archetype === 'PRECURSOR_RUIN') commodityId = 'COMM_ALLOY';

    const colonyId = `colony_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const colonyName = name || `${planet.name} Outpost Alpha`;

    await db.query(
      `INSERT INTO colonies (
        id, account_id, planet_id, beacon_id, name, surface_lat, surface_lng, commodity_id,
        population, max_population, stockpiled_amount, silo_capacity,
        derrick_tier, habitation_tier, terraformer_tier, silo_tier,
        terraforming_progress, last_harvest_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        120, 500, 10, 50,
        1, 1, 1, 1,
        0.0, NOW(), NOW()
      )`,
      [
        colonyId,
        accountId,
        planetId,
        beaconId,
        colonyName,
        Number(beacon.surface_lat),
        Number(beacon.surface_lng),
        commodityId,
      ]
    );

    return this.getColonyDetail(colonyId, accountId);
  }

  /**
   * Retrieves full colony telemetry, computing deterministic resource accrual,
   * population growth, and terraforming progress on query.
   */
  public async getColonyDetail(colonyId: string, accountId: string = 'acc_sol_captain'): Promise<ColonyDetail> {
    const res = await db.query<any>(
      `SELECT c.*, p.habitability_rating, p.id as p_id
       FROM colonies c
       JOIN planets p ON c.planet_id = p.id
       WHERE c.id = $1 AND c.account_id = $2`,
      [colonyId, accountId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Colony with ID ${colonyId} not found.`);
    }

    const c = res.rows[0];
    const now = Date.now();
    const lastHarvest = new Date(c.last_harvest_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - lastHarvest) / 1000));

    // Calculate deterministic accrual rates
    // Base extraction: 6 units per minute at Tier 1, scaled by derrickTier and population factor
    const derrickMult = c.derrick_tier === 1 ? 1.0 : c.derrick_tier === 2 ? 2.5 : 5.0;
    const popFactor = 1.0 + (c.population / 1000);
    const habFactor = 0.5 + (c.habitability_rating / 200);
    const unitsPerSecond = (6 / 60) * derrickMult * popFactor * habFactor;
    const productionRatePerMinute = Math.round(unitsPerSecond * 60 * 10) / 10;

    let newStockpile = c.stockpiled_amount;
    let newPop = c.population;
    let newTerraform = c.terraforming_progress;
    let needsUpdate = false;

    if (elapsedSeconds >= 2) {
      // 1. Accrue Stockpiled Minerals
      const accruedUnits = Math.floor(elapsedSeconds * unitsPerSecond);
      if (accruedUnits > 0) {
        newStockpile = Math.min(c.silo_capacity, c.stockpiled_amount + accruedUnits);
        needsUpdate = true;
      }

      // 2. Accrue Population Growth (mitigated by habitation tier)
      const popGrowthPerSec = 0.05 * c.habitation_tier;
      const accruedPop = Math.floor(elapsedSeconds * popGrowthPerSec);
      if (accruedPop > 0 && c.population < c.max_population) {
        newPop = Math.min(c.max_population, c.population + accruedPop);
        needsUpdate = true;
      }

      // 3. Accrue Terraforming Progress
      const terraformRate = 0.008 * c.terraformer_tier; // ~0.5 progress per minute
      const accruedTerraform = elapsedSeconds * terraformRate;
      if (accruedTerraform >= 1.0) {
        newTerraform = c.terraforming_progress + accruedTerraform;
        const habitabilityGain = Math.floor(newTerraform / 10);
        if (habitabilityGain > 0 && c.habitability_rating < 100) {
          await db.query(
            'UPDATE planets SET habitability_rating = LEAST(100, habitability_rating + $1) WHERE id = $2',
            [habitabilityGain, c.p_id]
          );
          newTerraform %= 10;
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.query(
          `UPDATE colonies 
           SET stockpiled_amount = $1, population = $2, terraforming_progress = $3, last_harvest_at = NOW()
           WHERE id = $4`,
          [newStockpile, newPop, newTerraform, colonyId]
        );
      }
    }

    return {
      id: c.id,
      accountId: c.account_id,
      planetId: c.planet_id,
      beaconId: c.beacon_id,
      name: c.name,
      surfaceLat: Number(c.surface_lat),
      surfaceLng: Number(c.surface_lng),
      commodityId: c.commodity_id,
      commodityName: this.getCommodityName(c.commodity_id),
      population: newPop,
      maxPopulation: c.max_population,
      stockpiledAmount: newStockpile,
      siloCapacity: c.silo_capacity,
      derrickTier: c.derrick_tier,
      habitationTier: c.habitation_tier,
      terraformerTier: c.terraformer_tier,
      siloTier: c.silo_tier,
      terraformingProgress: Math.round(newTerraform * 10) / 10,
      productionRatePerMinute,
      lastHarvestAt: needsUpdate ? new Date().toISOString() : c.last_harvest_at,
      createdAt: c.created_at,
    };
  }

  /**
   * Retrieves all colonies established on a planet.
   */
  public async getPlanetColonies(planetId: string, accountId: string = 'acc_sol_captain'): Promise<ColonyDetail[]> {
    const res = await db.query<{ id: string }>(
      'SELECT id FROM colonies WHERE planet_id = $1 AND account_id = $2 ORDER BY created_at ASC',
      [planetId, accountId]
    );

    const colonies: ColonyDetail[] = [];
    for (const r of res.rows) {
      const detail = await this.getColonyDetail(r.id, accountId);
      colonies.push(detail);
    }
    return colonies;
  }

  /**
   * Upgrades a colony facility module to Tier 2 or Tier 3.
   * Consumes Credits, AP, and Plasteel Alloys.
   */
  public async upgradeFacility(
    colonyId: string,
    accountId: string = 'acc_sol_captain',
    facilityType: 'DERRICK' | 'HABITATION' | 'TERRAFORMER' | 'SILO'
  ): Promise<{ success: boolean; colony: ColonyDetail; message: string }> {
    const colony = await this.getColonyDetail(colonyId, accountId);

    let currentTier = 1;
    if (facilityType === 'DERRICK') currentTier = colony.derrickTier;
    else if (facilityType === 'HABITATION') currentTier = colony.habitationTier;
    else if (facilityType === 'TERRAFORMER') currentTier = colony.terraformerTier;
    else if (facilityType === 'SILO') currentTier = colony.siloTier;

    if (currentTier >= 3) {
      throw new Error(`MAX_TIER_REACHED: ${facilityType} facility is already at maximum industrial efficiency (Tier 3).`);
    }

    const nextTier = currentTier + 1;
    const creditCost = nextTier === 2 ? 400 : 1000;
    const apCost = nextTier === 2 ? 3 : 5;

    // 1. Deduct Credits
    const accRes = await db.query<any>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = accRes.rows[0]?.credits || 0;
    if (credits < creditCost) {
      throw new Error(`INSUFFICIENT_CREDITS: Upgrading to Tier ${nextTier} requires ${creditCost} Credits (current: ${credits} CR).`);
    }
    await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [creditCost, accountId]);

    // 2. Deduct AP
    const apCheck = await apService.deductAP(accountId, apCost, `Colony ${facilityType} Tier ${nextTier} Upgrade`);
    if (!apCheck.success) {
      await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [creditCost, accountId]);
      throw new Error(apCheck.error || `INSUFFICIENT_AP: Upgrade requires ${apCost} AP.`);
    }

    // 3. Update database facility tier and parameters
    let updateSql = '';
    if (facilityType === 'DERRICK') {
      updateSql = 'UPDATE colonies SET derrick_tier = $1 WHERE id = $2';
    } else if (facilityType === 'HABITATION') {
      const newMaxPop = nextTier === 2 ? 1500 : 5000;
      updateSql = `UPDATE colonies SET habitation_tier = $1, max_population = ${newMaxPop} WHERE id = $2`;
    } else if (facilityType === 'TERRAFORMER') {
      updateSql = 'UPDATE colonies SET terraformer_tier = $1 WHERE id = $2';
    } else if (facilityType === 'SILO') {
      const newCapacity = nextTier === 2 ? 250 : 1000;
      updateSql = `UPDATE colonies SET silo_tier = $1, silo_capacity = ${newCapacity} WHERE id = $2`;
    }

    await db.query(updateSql, [nextTier, colonyId]);
    const updated = await this.getColonyDetail(colonyId, accountId);

    return {
      success: true,
      colony: updated,
      message: `${facilityType} successfully upgraded to Tier ${nextTier}. Facility operational.`,
    };
  }

  /**
   * Transfers stockpiled commodities from colony silo into player ship cargo hold.
   */
  public async harvestColonyCargo(
    colonyId: string,
    accountId: string = 'acc_sol_captain'
  ): Promise<{
    success: boolean;
    harvestedAmount: number;
    commodityId: string;
    commodityName: string;
    colony: ColonyDetail;
    message: string;
  }> {
    const colony = await this.getColonyDetail(colonyId, accountId);
    if (colony.stockpiledAmount <= 0) {
      throw new Error('NO_STOCKPILED_CARGO: Silo is currently empty. Allow mining derricks time to extract ore.');
    }

    const harvested = colony.stockpiledAmount;

    // 1. Add to player ship cargo hold
    const sRes = await db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (sRes.rows.length > 0) {
      const shipId = sRes.rows[0].id;
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + EXCLUDED.quantity`,
        [shipId, colony.commodityId, harvested]
      );
    }

    // 2. Empty silo and reset harvest timestamp
    await db.query(
      'UPDATE colonies SET stockpiled_amount = 0, last_harvest_at = NOW() WHERE id = $1',
      [colonyId]
    );

    const updated = await this.getColonyDetail(colonyId, accountId);

    return {
      success: true,
      harvestedAmount: harvested,
      commodityId: colony.commodityId,
      commodityName: colony.commodityName,
      colony: updated,
      message: `Transferred ${harvested} units of ${colony.commodityName} from silo into ship cargo hold.`,
    };
  }
}

export const colonyService = new ColonyService();

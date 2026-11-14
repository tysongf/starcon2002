import { db } from '../db/Database';
import { generatePlanetEcosystem, type ProceduralLifeform } from '../procgen/XenobiologyEngine';

export interface PlanetFauna {
  id: string;
  planet_id: string;
  species_name: string;
  species_class: 'GRAZER' | 'CARNIVORE';
  color: string;
  base_hp: number;
  movement_speed: number;
  aggro_range: number;
  attack_damage: number;
  bio_unit_value: number;
  stun_duration_seconds: number;
  is_apex?: boolean;
  stun_hits_required?: number;
  current_stun_hits?: number;
  is_enraged?: boolean;
  lair_x?: number;
  lair_y?: number;
  lair_name?: string;
  created_at?: string;
  // Milestone 1.0 Pure Xenobiology descriptors
  scientificName?: string;
  kingdom?: string;
  bodyPlan?: string;
  covering?: string;
  sizeMeters?: number;
  trophicRole?: string;
  adaptationTrait?: string;
  glowColor?: string;
}

export interface PlayerLander {
  id: string;
  account_id: string;
  name: string;
  hull: number;
  max_hull: number;
  fuel: number;
  max_fuel: number;
  cargo_capacity: number;
  fitted_modules: Record<string, any>;
  is_active: boolean;
}

export interface HarvestedMineral {
  name: string;
  quantity: number;
  commodityId?: string;
}

export interface HarvestedBioSample {
  speciesId: string;
  name: string;
  quantity: number;
  bioUnits: number;
  speciesClass?: string;
}

export interface LanderRecoveryPayload {
  accountId: string;
  mineralsHarvested: HarvestedMineral[];
  bioSamplesHarvested: HarvestedBioSample[];
  hullRemaining: number;
  fuelRemaining: number;
}

export class PlanetaryFaunaService {
  /**
   * Retrieves all indigenous fauna species cataloged for a planet
   */
  public async getPlanetFauna(planetId: string, includeApex: boolean = false): Promise<PlanetFauna[]> {
    const query = includeApex
      ? `SELECT * FROM planet_fauna WHERE planet_id = $1 ORDER BY is_apex DESC, species_class ASC, species_name ASC`
      : `SELECT * FROM planet_fauna WHERE planet_id = $1 AND (is_apex = FALSE OR is_apex IS NULL) ORDER BY species_class ASC, species_name ASC`;
    const { rows } = await db.query<any>(query, [planetId]);

    if (rows.length > 0) {
      const { rows: pRows } = await db.query<any>(
        `SELECT id, name, main_class, subtype, texture_seed FROM planets WHERE id = $1`,
        [planetId]
      );
      const p = pRows[0];
      const eco = p
        ? generatePlanetEcosystem({
            id: p.id,
            name: p.name,
            subtype: p.subtype,
            mainClass: p.main_class,
            textureSeed: Number(p.texture_seed || 101),
          })
        : undefined;
      return rows.map((r, idx) => this.formatFauna(r, eco, idx));
    }

    // Procedural generation fallback if planet not seeded yet
    const generated = await this.generateProceduralFauna(planetId);
    return generated;
  }

  /**
   * Retrieves or generates procedural Apex Titans for a planet
   */
  public async getPlanetTitans(planetId: string): Promise<PlanetFauna[]> {
    const { rows: pRows } = await db.query<any>(`SELECT id FROM planets WHERE id = $1`, [planetId]);
    if (pRows.length === 0) {
      return [];
    }

    let { rows } = await db.query<any>(
      `SELECT * FROM planet_fauna WHERE planet_id = $1 AND is_apex = TRUE ORDER BY species_name ASC`,
      [planetId]
    );

    if (rows.length === 0) {
      await this.ensureProceduralTitan(planetId);
      const res = await db.query<any>(
        `SELECT * FROM planet_fauna WHERE planet_id = $1 AND is_apex = TRUE ORDER BY species_name ASC`,
        [planetId]
      );
      rows = res.rows;
    }

    return rows.map((r) => this.formatFauna(r));
  }

  /**
   * Synthesizes and anchors a procedural Apex Titan based on planet main class and hazard levels
   */
  public async ensureProceduralTitan(planetId: string): Promise<PlanetFauna | null> {
    const { rows: existing } = await db.query<any>(
      `SELECT * FROM planet_fauna WHERE planet_id = $1 AND is_apex = TRUE LIMIT 1`,
      [planetId]
    );
    if (existing.length > 0) {
      return this.formatFauna(existing[0]);
    }

    // Fetch planet metadata
    const { rows: pRows } = await db.query<any>(`SELECT * FROM planets WHERE id = $1`, [planetId]);
    if (pRows.length === 0) {
      return null;
    }
    const planet = pRows[0];

    const titanId = `titan_${planetId}`;
    let speciesName = `${planet.name} Ancient Chitin Colossus`;
    let lairName = 'Obsidian Basalt Rift';
    let color = '#f59e0b';
    let baseHp = 280;
    let attackDamage = 28;
    let movementSpeed = 42.0;
    let bioUnitValue = 75;
    let stunHitsRequired = 3;
    let lairX = 310.0;
    let lairY = -240.0;

    if (planet.main_class === 'PYRO_TECTONIC' || (planet.hazard_thermal_level && planet.hazard_thermal_level >= 2)) {
      speciesName = `${planet.name} Magma Behemoth`;
      lairName = 'Molten Caldera Lair';
      color = '#f97316';
      baseHp = 350;
      attackDamage = 35;
      movementSpeed = 48.0;
      bioUnitValue = 85;
      stunHitsRequired = 3;
      lairX = 350.0;
      lairY = 280.0;
    } else if (
      planet.main_class === 'LIVING_BIOSPHERE' ||
      planet.main_class === 'FUNGAL_MYCELIAL' ||
      planet.main_class === 'HYDROSPHERE' ||
      (planet.hazard_caustic_level && planet.hazard_caustic_level >= 2)
    ) {
      speciesName = `${planet.name} Spore Colossus`;
      lairName = 'Primordial Spore Hollow';
      color = '#10b981';
      baseHp = 300;
      attackDamage = 30;
      movementSpeed = 44.0;
      bioUnitValue = 80;
      stunHitsRequired = 3;
      lairX = -280.0;
      lairY = 320.0;
    } else if (
      planet.main_class === 'GAS_ICE_GIANT' ||
      planet.main_class === 'MAGNETOSPHERIC' ||
      (planet.hazard_ion_level && planet.hazard_ion_level >= 2)
    ) {
      speciesName = `${planet.name} Galvanic Leviathan`;
      lairName = 'Sub-Surface Ion Trench';
      color = '#38bdf8';
      baseHp = 380;
      attackDamage = 38;
      movementSpeed = 52.0;
      bioUnitValue = 95;
      stunHitsRequired = 4;
      lairX = 420.0;
      lairY = -180.0;
    }

    await db.query(
      `INSERT INTO planet_fauna (
        id, planet_id, species_name, species_class, color, base_hp, movement_speed,
        aggro_range, attack_damage, bio_unit_value, stun_duration_seconds,
        is_apex, stun_hits_required, current_stun_hits, is_enraged, lair_x, lair_y, lair_name
      ) VALUES (
        $1, $2, $3, 'CARNIVORE', $4, $5, $6,
        180.0, $7, $8, 16.0,
        TRUE, $9, 0, FALSE, $10, $11, $12
      ) ON CONFLICT (id) DO NOTHING`,
      [titanId, planetId, speciesName, color, baseHp, movementSpeed, attackDamage, bioUnitValue, stunHitsRequired, lairX, lairY, lairName]
    );

    const { rows: inserted } = await db.query<any>(`SELECT * FROM planet_fauna WHERE id = $1`, [titanId]);
    return this.formatFauna(inserted[0]);
  }

  /**
   * Records a stun blaster hit on an Apex Titan, managing enrage state and multi-shot tranquilization
   */
  public async recordTitanStunHit(
    planetId: string,
    speciesId: string
  ): Promise<{ success: boolean; hits: number; required: number; isStunned: boolean; isEnraged: boolean; stunDuration: number; error?: string }> {
    const { rows } = await db.query<any>(
      `SELECT * FROM planet_fauna WHERE planet_id = $1 AND id = $2`,
      [planetId, speciesId]
    );
    if (rows.length === 0) {
      return { success: false, hits: 0, required: 1, isStunned: false, isEnraged: false, stunDuration: 0, error: 'Titan species not found.' };
    }
    const titan = rows[0];
    const req = titan.stun_hits_required || (titan.is_apex ? 3 : 1);
    const newHits = (titan.current_stun_hits || 0) + 1;

    let isStunned = false;
    let isEnraged = false;
    let currentHitsToSave = newHits;

    if (newHits >= req) {
      isStunned = true;
      isEnraged = false;
      currentHitsToSave = 0; // reset for next cycle
    } else {
      isStunned = false;
      isEnraged = true;
    }

    await db.query(
      `UPDATE planet_fauna
       SET current_stun_hits = $1, is_enraged = $2
       WHERE planet_id = $3 AND id = $4`,
      [currentHitsToSave, isEnraged, planetId, speciesId]
    );

    return {
      success: true,
      hits: newHits,
      required: req,
      isStunned,
      isEnraged,
      stunDuration: isStunned ? 16.0 : 0,
    };
  }

  /**
   * Validates orbital pre-conditions and deploys surface lander
   */
  public async deployLander(accountId: string, planetId: string): Promise<{ success: boolean; session?: any; error?: string }> {
    // 1. Verify planet exists
    const { rows: pRows } = await db.query<any>(`SELECT * FROM planets WHERE id = $1`, [planetId]);
    if (pRows.length === 0) {
      return { success: false, error: `Planet ${planetId} not found.` };
    }
    const planet = pRows[0];

    // 2. Verify player ship and fuel
    const { rows: sRows } = await db.query<any>(`SELECT * FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length === 0) {
      return { success: false, error: 'No active ship registered for pilot.' };
    }
    const ship = sRows[0];
    if (ship.fuel < 1) {
      return { success: false, error: 'INSUFFICIENT_SHIP_FUEL: Lander deployment requires at least 1 unit of Deuterium Fuel.' };
    }

    // 3. Get or verify player's active lander
    let lander = await this.getActiveLander(accountId);
    if (!lander) {
      const { rows: anyLander } = await db.query<any>(`SELECT id FROM player_landers WHERE account_id = $1 LIMIT 1`, [accountId]);
      if (anyLander.length === 0) {
        lander = await this.getOrCreateActiveLander(accountId);
      }
    }

    if (!lander || lander.hull <= 0 || !lander.is_active) {
      return {
        success: false,
        error: 'NO_ACTIVE_LANDER: Surface lander chassis is destroyed or missing. Purchase a replacement or claim an emergency loaner at a spaceport.',
      };
    }

    const fauna = await this.getPlanetFauna(planetId, false);
    const titans = await this.getPlanetTitans(planetId);

    return {
      success: true,
      session: {
        sessionId: `session_${planetId}_${Date.now()}`,
        planetId,
        planetName: planet.name,
        systemSeed: planet.system_seed || 101,
        lander: {
          id: lander.id,
          name: lander.name,
          hull: lander.hull,
          maxHull: lander.max_hull,
          fuel: lander.fuel,
          maxFuel: lander.max_fuel,
          cargoCapacity: lander.cargo_capacity,
          fittedModules: lander.fitted_modules || {},
        },
        fauna,
        titans,
        deployedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Mid-mission cargo stashing at the rendezvous beacon, refueling lander and keeping session active
   */
  public async stashLanderCargo(
    planetId: string,
    payload: LanderRecoveryPayload
  ): Promise<{
    success: boolean;
    stashedMinerals: number;
    stashedBioUnits: number;
    recoveredCommodities: any[];
    fuelBonus: number;
    lander: any;
    message: string;
    error?: string;
  }> {
    const { accountId, mineralsHarvested, bioSamplesHarvested, hullRemaining, fuelRemaining } = payload;

    // 1. Retrieve ship
    const { rows: sRows } = await db.query<any>(`SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length === 0) {
      return { success: false, stashedMinerals: 0, stashedBioUnits: 0, recoveredCommodities: [], fuelBonus: 0, lander: null, message: '', error: 'Ship not found for account.' };
    }
    const ship = sRows[0];

    // 2. Offload Minerals into ship_cargo
    let totalMinerals = 0;
    const recoveredCommodities: any[] = [];

    for (const mineral of mineralsHarvested) {
      if (mineral.quantity <= 0) continue;
      totalMinerals += mineral.quantity;
      const commodityId = mineral.commodityId || this.mapMineralToCommodity(mineral.name);

      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, mineral.quantity]
      );

      recoveredCommodities.push({
        commodityId,
        name: mineral.name,
        quantity: mineral.quantity,
      });
    }

    // 3. Offload Biological Samples into ship_cargo
    let totalBioUnits = 0;
    for (const bio of bioSamplesHarvested) {
      if (bio.quantity <= 0) continue;
      const units = bio.bioUnits || (bio.quantity * 10);
      totalBioUnits += units;

      const commodityId = 'COMM_BIO_SPECIMENS';
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, bio.quantity]
      );

      recoveredCommodities.push({
        commodityId,
        name: bio.name,
        quantity: bio.quantity,
        bioUnits: units,
      });
    }

    // 4. Update lander: refund +25 fuel and update hull
    await db.query(
      `UPDATE player_landers
       SET fuel = LEAST(max_fuel, $1 + 25.0), hull = $2
       WHERE account_id = $3 AND is_active = TRUE`,
      [Math.max(0, fuelRemaining), Math.max(1, hullRemaining), accountId]
    );

    const updatedLander = await this.getActiveLander(accountId);

    return {
      success: true,
      stashedMinerals: totalMinerals,
      stashedBioUnits: totalBioUnits,
      recoveredCommodities,
      fuelBonus: 25.0,
      lander: updatedLander,
      message: `Offloaded ${recoveredCommodities.length} resource batches to mothership hold. Lander refueled (+25.0 Fuel). Surface expedition active.`,
    };
  }

  /**
   * Atomically commits harvested minerals and bio-specimens into player hold upon lander recovery
   */
  public async recoverLander(
    planetId: string,
    payload: LanderRecoveryPayload
  ): Promise<{ success: boolean; status?: string; totalMinerals: number; totalBioUnits: number; recoveredCommodities: any[]; error?: string }> {
    const { accountId, mineralsHarvested, bioSamplesHarvested, hullRemaining, fuelRemaining } = payload;

    // 1. Retrieve ship
    const { rows: sRows } = await db.query<any>(`SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length === 0) {
      return { success: false, totalMinerals: 0, totalBioUnits: 0, recoveredCommodities: [], error: 'Ship not found for account.' };
    }
    const ship = sRows[0];

    // 2. Check if lander suffered total hull failure on surface
    if (hullRemaining <= 0) {
      await db.query(
        `UPDATE player_landers
         SET hull = 0, is_active = FALSE, status = 'DESTROYED'
         WHERE account_id = $1 AND is_active = TRUE`,
        [accountId]
      );

      return {
        success: true,
        status: 'LANDER_DESTROYED',
        totalMinerals: 0,
        totalBioUnits: 0,
        recoveredCommodities: [],
      };
    }

    // 2. Update lander hull and fuel
    await db.query(
      `UPDATE player_landers
       SET hull = $1, fuel = $2
       WHERE account_id = $3 AND is_active = TRUE`,
      [Math.max(0, Math.min(250, hullRemaining)), Math.max(0, Math.min(250, fuelRemaining)), accountId]
    );

    // 3. Process Minerals into ship_cargo
    let totalMinerals = 0;
    const recoveredCommodities: any[] = [];

    for (const mineral of mineralsHarvested) {
      if (mineral.quantity <= 0) continue;
      totalMinerals += mineral.quantity;

      // Map mineral name to appropriate commodity
      const commodityId = mineral.commodityId || this.mapMineralToCommodity(mineral.name);

      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, mineral.quantity]
      );

      recoveredCommodities.push({
        commodityId,
        name: mineral.name,
        quantity: mineral.quantity,
      });
    }

    // 4. Process Biological Samples into ship_cargo
    let totalBioUnits = 0;
    for (const bio of bioSamplesHarvested) {
      if (bio.quantity <= 0) continue;
      const units = bio.bioUnits || (bio.quantity * 10);
      totalBioUnits += units;

      const commodityId = 'COMM_BIO_SPECIMENS';
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, bio.quantity]
      );

      recoveredCommodities.push({
        commodityId,
        name: bio.name,
        quantity: bio.quantity,
        bioUnits: units,
      });
    }

    return {
      success: true,
      totalMinerals,
      totalBioUnits,
      recoveredCommodities,
    };
  }

  /**
   * Retrieves active lander for an account without auto-creating a new one
   */
  public async getActiveLander(accountId: string): Promise<PlayerLander | null> {
    const { rows } = await db.query<any>(
      `SELECT * FROM player_landers WHERE account_id = $1 AND is_active = TRUE LIMIT 1`,
      [accountId]
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      account_id: r.account_id,
      name: r.name,
      hull: r.hull,
      max_hull: r.max_hull,
      fuel: parseFloat(r.fuel),
      max_fuel: parseFloat(r.max_fuel),
      cargo_capacity: r.cargo_capacity,
      fitted_modules: typeof r.fitted_modules === 'string' ? JSON.parse(r.fitted_modules) : (r.fitted_modules || {}),
      is_active: r.is_active,
    };
  }

  /**
   * Retrieves active lander or initializes default Vanguard Mk.I
   */
  public async getOrCreateActiveLander(accountId: string): Promise<PlayerLander> {
    const { rows } = await db.query<any>(
      `SELECT * FROM player_landers WHERE account_id = $1 AND is_active = TRUE LIMIT 1`,
      [accountId]
    );

    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        account_id: r.account_id,
        name: r.name,
        hull: r.hull,
        max_hull: r.max_hull,
        fuel: parseFloat(r.fuel),
        max_fuel: parseFloat(r.max_fuel),
        cargo_capacity: r.cargo_capacity,
        fitted_modules: typeof r.fitted_modules === 'string' ? JSON.parse(r.fitted_modules) : (r.fitted_modules || {}),
        is_active: r.is_active,
      };
    }

    const newId = `lander_${accountId}_01`;
    await db.query(
      `INSERT INTO player_landers (id, account_id, name, hull, max_hull, fuel, max_fuel, cargo_capacity, fitted_modules, is_active)
       VALUES ($1, $2, 'Vanguard Mk.I Lander', 100, 100, 100.0, 100.0, 25, '{}'::jsonb, TRUE)
       ON CONFLICT (id) DO UPDATE SET hull = 100, fuel = 100.0`,
      [newId, accountId]
    );

    return {
      id: newId,
      account_id: accountId,
      name: 'Vanguard Mk.I Lander',
      hull: 100,
      max_hull: 100,
      fuel: 100.0,
      max_fuel: 100.0,
      cargo_capacity: 25,
      fitted_modules: {},
      is_active: true,
    };
  }

  /**
   * Formats raw SQL row into typed PlanetFauna, attaching deterministic xenobiology visuals
   */
  private formatFauna(r: any, ecoList?: ProceduralLifeform[], indexFallback: number = 0): PlanetFauna {
    const eco = ecoList && ecoList.length > 0
      ? (ecoList.find((e) => e.speciesUid === r.id || e.commonName === r.species_name) || ecoList[indexFallback % ecoList.length])
      : undefined;

    return {
      id: r.id,
      planet_id: r.planet_id,
      species_name: r.species_name,
      species_class: r.species_class,
      color: r.color,
      base_hp: r.base_hp,
      movement_speed: parseFloat(r.movement_speed),
      aggro_range: parseFloat(r.aggro_range),
      attack_damage: r.attack_damage,
      bio_unit_value: r.bio_unit_value,
      stun_duration_seconds: parseFloat(r.stun_duration_seconds),
      is_apex: !!r.is_apex,
      stun_hits_required: r.stun_hits_required != null ? parseInt(r.stun_hits_required, 10) : (r.is_apex ? 3 : 1),
      current_stun_hits: r.current_stun_hits != null ? parseInt(r.current_stun_hits, 10) : 0,
      is_enraged: !!r.is_enraged,
      lair_x: r.lair_x != null ? parseFloat(r.lair_x) : undefined,
      lair_y: r.lair_y != null ? parseFloat(r.lair_y) : undefined,
      lair_name: r.lair_name || undefined,
      created_at: r.created_at,
      scientificName: eco?.scientificName,
      kingdom: eco?.kingdom,
      bodyPlan: eco?.bodyPlan,
      covering: eco?.covering,
      sizeMeters: eco?.sizeMeters,
      trophicRole: eco?.trophicRole,
      adaptationTrait: eco?.adaptationTrait,
      glowColor: eco?.glowColor,
    };
  }

  /**
   * Generates pure xenobiological procedural fauna for uncatalogued planets
   */
  private async generateProceduralFauna(planetId: string): Promise<PlanetFauna[]> {
    const { rows: pRows } = await db.query<any>(
      `SELECT id, name, main_class, subtype, texture_seed FROM planets WHERE id = $1`,
      [planetId]
    );
    if (pRows.length === 0) {
      return [];
    }
    const p = pRows[0];
    const ecosystem = generatePlanetEcosystem({
      id: p.id,
      name: p.name,
      subtype: p.subtype,
      mainClass: p.main_class,
      textureSeed: Number(p.texture_seed || 101),
    });

    for (const sp of ecosystem) {
      await db.query(
        `INSERT INTO planet_fauna (
          id, planet_id, species_name, species_class, color, base_hp, movement_speed,
          aggro_range, attack_damage, bio_unit_value, stun_duration_seconds,
          is_apex, stun_hits_required, current_stun_hits, is_enraged
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, 12.0,
          FALSE, 1, 0, FALSE
        ) ON CONFLICT (id) DO NOTHING`,
        [
          sp.speciesUid,
          planetId,
          sp.commonName,
          sp.speciesClass,
          sp.primaryColor,
          sp.baseHp,
          sp.movementSpeed,
          sp.aggroRange,
          sp.attackDamage,
          sp.bioUnitValue,
        ]
      );
    }

    const { rows } = await db.query<any>(
      `SELECT * FROM planet_fauna WHERE planet_id = $1 AND (is_apex = FALSE OR is_apex IS NULL) ORDER BY species_class ASC, species_name ASC`,
      [planetId]
    );
    return rows.map((r, idx) => this.formatFauna(r, ecosystem, idx));
  }

  /**
   * Maps mineral names to standard commodity IDs
   */
  private mapMineralToCommodity(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('plutonium') || lower.includes('cell') || lower.includes('power')) {
      return 'COMM_FUEL';
    }
    if (lower.includes('spore') || lower.includes('bio')) {
      return 'COMM_RATIONS';
    }
    if (lower.includes('titanium') || lower.includes('alloy') || lower.includes('matrix') || lower.includes('crystalline')) {
      return 'COMM_ALLOY';
    }
    return 'COMM_ORE';
  }

  /**
   * Debug reset helper for automated testing
   */
  public async debugReset(planetId?: string): Promise<void> {
    if (planetId) {
      await db.query(`DELETE FROM planet_fauna WHERE planet_id = $1`, [planetId]);
    } else {
      await db.query(`DELETE FROM planet_fauna`);
      await db.query(`DELETE FROM player_landers`);

      // Re-seed canonical fauna and Apex Titans
      await db.query(`
        INSERT INTO planet_fauna (
          id, planet_id, species_name, species_class, color, base_hp, movement_speed,
          aggro_range, attack_damage, bio_unit_value, stun_duration_seconds,
          is_apex, stun_hits_required, current_stun_hits, is_enraged, lair_x, lair_y, lair_name
        ) VALUES
        ('fauna_aegis_grazer_01', 'planet_sec1_aegis', 'Aegis Bio-Spore Strider', 'GRAZER', '#4ade80', 40, 30.0, 0.0, 0, 12, 12.0, FALSE, 1, 0, FALSE, NULL, NULL, NULL),
        ('fauna_aegis_carnivore_01', 'planet_sec1_aegis', 'Silicon Mantis', 'CARNIVORE', '#f87171', 60, 45.0, 140.0, 15, 25, 12.0, FALSE, 1, 0, FALSE, NULL, NULL, NULL),
        ('titan_planet_sec1_aegis', 'planet_sec1_aegis', 'Aegis Ancient Chitin Colossus', 'CARNIVORE', '#f59e0b', 280, 42.0, 180.0, 28, 75, 16.0, TRUE, 3, 0, FALSE, 310.0, -240.0, 'Obsidian Basalt Rift'),
        ('fauna_charybdis_grazer_01', 'planet_sec2_charybdis', 'Obsidian Crustacean', 'GRAZER', '#38bdf8', 50, 25.0, 0.0, 0, 15, 12.0, FALSE, 1, 0, FALSE, NULL, NULL, NULL),
        ('fauna_charybdis_carnivore_01', 'planet_sec2_charybdis', 'Charybdian Sand Stalker', 'CARNIVORE', '#ef4444', 75, 50.0, 150.0, 20, 35, 12.0, FALSE, 1, 0, FALSE, NULL, NULL, NULL),
        ('titan_planet_sec2_charybdis', 'planet_sec2_charybdis', 'Charybdian Galvanic Leviathan', 'CARNIVORE', '#38bdf8', 380, 52.0, 200.0, 38, 95, 16.0, TRUE, 4, 0, FALSE, 420.0, -180.0, 'Sub-Surface Ion Trench'),
        ('fauna_ignis_grazer_01', 'planet_sec3_ignis', 'Pyrite Chit-Beetle', 'GRAZER', '#fbbf24', 45, 28.0, 0.0, 0, 10, 12.0, FALSE, 1, 0, FALSE, NULL, NULL, NULL),
        ('fauna_ignis_carnivore_01', 'planet_sec3_ignis', 'Magma Serpent', 'CARNIVORE', '#f97316', 80, 48.0, 140.0, 22, 40, 12.0, FALSE, 1, 0, FALSE, NULL, NULL, NULL),
        ('titan_planet_sec3_ignis', 'planet_sec3_ignis', 'Ignis Magma Behemoth', 'CARNIVORE', '#f97316', 350, 48.0, 190.0, 35, 85, 16.0, TRUE, 3, 0, FALSE, 350.0, 280.0, 'Molten Caldera Lair')
      `);
    }
  }
}

export const planetaryFaunaService = new PlanetaryFaunaService();

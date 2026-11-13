import { db } from '../db/Database';

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
  created_at?: string;
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
  public async getPlanetFauna(planetId: string): Promise<PlanetFauna[]> {
    const { rows } = await db.query<any>(
      `SELECT * FROM planet_fauna WHERE planet_id = $1 ORDER BY species_class ASC, species_name ASC`,
      [planetId]
    );

    if (rows.length > 0) {
      return rows.map((r) => this.formatFauna(r));
    }

    // Procedural generation fallback if planet not seeded yet
    const generated = await this.generateProceduralFauna(planetId);
    return generated;
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

    // 3. Get or initialize player's lander
    let lander = await this.getOrCreateActiveLander(accountId);
    if (lander.hull <= 0) {
      return { success: false, error: 'LANDER_DAMAGED: Surface lander chassis is breached. Repairs required at spaceport.' };
    }

    const fauna = await this.getPlanetFauna(planetId);

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
        },
        fauna,
        deployedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Atomically commits harvested minerals and bio-specimens into player hold upon lander recovery
   */
  public async recoverLander(
    planetId: string,
    payload: LanderRecoveryPayload
  ): Promise<{ success: boolean; totalMinerals: number; totalBioUnits: number; recoveredCommodities: any[]; error?: string }> {
    const { accountId, mineralsHarvested, bioSamplesHarvested, hullRemaining, fuelRemaining } = payload;

    // 1. Retrieve ship
    const { rows: sRows } = await db.query<any>(`SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length === 0) {
      return { success: false, totalMinerals: 0, totalBioUnits: 0, recoveredCommodities: [], error: 'Ship not found for account.' };
    }
    const ship = sRows[0];

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
   * Formats raw SQL row into typed PlanetFauna
   */
  private formatFauna(r: any): PlanetFauna {
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
      created_at: r.created_at,
    };
  }

  /**
   * Generates procedural fauna for uncatalogued planets
   */
  private async generateProceduralFauna(planetId: string): Promise<PlanetFauna[]> {
    const grazerId = `fauna_${planetId}_grazer`;
    const carnivoreId = `fauna_${planetId}_carnivore`;

    await db.query(`
      INSERT INTO planet_fauna (id, planet_id, species_name, species_class, color, base_hp, movement_speed, aggro_range, attack_damage, bio_unit_value, stun_duration_seconds)
      VALUES
      ($1, $2, 'Indigenous Spore Grazer', 'GRAZER', '#4ade80', 45, 30.0, 0.0, 0, 12, 12.0),
      ($3, $2, 'Apex Dune Stalker', 'CARNIVORE', '#ef4444', 70, 48.0, 140.0, 18, 30, 12.0)
      ON CONFLICT (id) DO NOTHING
    `, [grazerId, planetId, carnivoreId]);

    const { rows } = await db.query<any>(`SELECT * FROM planet_fauna WHERE planet_id = $1`, [planetId]);
    return rows.map((r) => this.formatFauna(r));
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

      // Re-seed canonical fauna
      await db.query(`
        INSERT INTO planet_fauna (id, planet_id, species_name, species_class, color, base_hp, movement_speed, aggro_range, attack_damage, bio_unit_value, stun_duration_seconds)
        VALUES
        ('fauna_aegis_grazer_01', 'planet_sec1_aegis', 'Aegis Bio-Spore Strider', 'GRAZER', '#4ade80', 40, 30.0, 0.0, 0, 12, 12.0),
        ('fauna_aegis_carnivore_01', 'planet_sec1_aegis', 'Silicon Mantis', 'CARNIVORE', '#f87171', 60, 45.0, 140.0, 15, 25, 12.0),
        ('fauna_charybdis_grazer_01', 'planet_sec2_charybdis', 'Obsidian Crustacean', 'GRAZER', '#38bdf8', 50, 25.0, 0.0, 0, 15, 12.0),
        ('fauna_charybdis_carnivore_01', 'planet_sec2_charybdis', 'Charybdian Sand Stalker', 'CARNIVORE', '#ef4444', 75, 50.0, 150.0, 20, 35, 12.0),
        ('fauna_ignis_grazer_01', 'planet_sec3_ignis', 'Pyrite Chit-Beetle', 'GRAZER', '#fbbf24', 45, 28.0, 0.0, 0, 10, 12.0),
        ('fauna_ignis_carnivore_01', 'planet_sec3_ignis', 'Magma Serpent', 'CARNIVORE', '#f97316', 80, 48.0, 140.0, 22, 40, 12.0)
      `);
    }
  }
}

export const planetaryFaunaService = new PlanetaryFaunaService();

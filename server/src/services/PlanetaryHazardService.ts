import { db } from '../db/Database';

export interface LanderModuleDef {
  id: string;
  name: string;
  slot: 'thermal' | 'electrical' | 'caustic' | 'cargo';
  cost: number;
  description: string;
  mitigationEffect: string;
}

export const LANDER_MODULE_CATALOG: Record<string, LanderModuleDef> = {
  MOD_THERMAL_PLATING: {
    id: 'MOD_THERMAL_PLATING',
    name: 'Thermal Plating & Radiators',
    slot: 'thermal',
    cost: 450,
    description: 'Ceramic heat-dissipation tiles and liquid-nitrogen heat pipes.',
    mitigationEffect: 'Reduces heat accumulation by 75%, doubles idle cooling rate, and grants immunity to geyser blast damage.',
  },
  MOD_ION_DISSIPATOR: {
    id: 'MOD_ION_DISSIPATOR',
    name: 'Ion Grounding Matrix',
    slot: 'electrical',
    cost: 400,
    description: 'Faraday-mesh chassis shielding with heavy-duty lightning arrestor spikes.',
    mitigationEffect: 'Completely grounds ion squalls and lightning strikes (100% damage deflection).',
  },
  MOD_CAUSTIC_SEALANT: {
    id: 'MOD_CAUSTIC_SEALANT',
    name: 'Caustic Polymer Sealant',
    slot: 'caustic',
    cost: 350,
    description: 'Fluoropolymer hydrophobic undercoating resisting chemical and acid erosion.',
    mitigationEffect: 'Provides 80% acid rain damage mitigation and total immunity to corrosive surface pools.',
  },
  MOD_EXPANDED_BIO_BAY: {
    id: 'MOD_EXPANDED_BIO_BAY',
    name: 'Expanded Bio-Containment Bay',
    slot: 'cargo',
    cost: 500,
    description: 'Reinforced pressurized biological specimen holding tanks.',
    mitigationEffect: 'Increases lander cargo capacity from 25 to 40 units.',
  },
};

export class PlanetaryHazardService {
  /**
   * Retrieves environmental atmospheric hazard ratings for a planet
   */
  public async getPlanetHazards(planetId: string): Promise<{
    success: boolean;
    planetId: string;
    planetName: string;
    thermalLevel: number;
    ionLevel: number;
    causticLevel: number;
    hazards: Array<{ type: string; level: number; label: string; description: string }>;
    error?: string;
  }> {
    const { rows } = await db.query<any>(
      `SELECT id, name, hazard_thermal_level, hazard_ion_level, hazard_caustic_level
       FROM planets WHERE id = $1`,
      [planetId]
    );

    if (rows.length === 0) {
      return {
        success: false,
        planetId,
        planetName: '',
        thermalLevel: 0,
        ionLevel: 0,
        causticLevel: 0,
        hazards: [],
        error: `Planet ${planetId} not found.`,
      };
    }

    const p = rows[0];
    const thermal = p.hazard_thermal_level ?? 0;
    const ion = p.hazard_ion_level ?? 0;
    const caustic = p.hazard_caustic_level ?? 0;

    const hazards: Array<{ type: string; level: number; label: string; description: string }> = [];

    if (thermal > 0) {
      hazards.push({
        type: 'THERMAL',
        level: thermal,
        label: thermal >= 3 ? 'EXTREME VOLCANIC INFERNO' : 'HIGH THERMAL ACTIVITY',
        description: 'Ambient volcanic heat causes rapid thermal buildup. Lava geysers erupt along contour fissures.',
      });
    }

    if (ion > 0) {
      hazards.push({
        type: 'ION_STORM',
        level: ion,
        label: ion >= 2 ? 'VIOLENT ION SQUALLS' : 'ATMOSPHERIC STATIC DISCHARGES',
        description: 'Drifting electrical storm clouds emit periodic high-voltage lightning strikes.',
      });
    }

    if (caustic > 0) {
      hazards.push({
        type: 'CAUSTIC',
        level: caustic,
        label: caustic >= 2 ? 'LETHAL ACID RAIN & POOLS' : 'CORROSIVE CHEMICAL MIST',
        description: 'Atmospheric acid rain and toxic chemical slurry pools erode unprotected chassis hulls.',
      });
    }

    return {
      success: true,
      planetId: p.id,
      planetName: p.name,
      thermalLevel: thermal,
      ionLevel: ion,
      causticLevel: caustic,
      hazards,
    };
  }

  /**
   * Purchases a replacement Vanguard Mk.I lander chassis for 1,000 Credits
   */
  public async purchaseReplacementLander(accountId: string): Promise<{
    success: boolean;
    lander?: any;
    creditsRemaining?: number;
    error?: string;
  }> {
    const cost = 1000;

    const { rows: accRows } = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    if (accRows.length === 0) {
      return { success: false, error: 'Account not found.' };
    }

    const credits = parseFloat(accRows[0].credits);
    if (credits < cost) {
      return {
        success: false,
        error: `INSUFFICIENT_CREDITS: Replacement Vanguard Mk.I Lander costs ${cost} CR (Available: ${credits} CR).`,
      };
    }

    // Deduct credits
    const newCredits = credits - cost;
    await db.query(`UPDATE accounts SET credits = $1 WHERE id = $2`, [newCredits, accountId]);

    // Deactivate any existing landers
    await db.query(`UPDATE player_landers SET is_active = FALSE WHERE account_id = $1`, [accountId]);

    // Provision fresh Vanguard Mk.I
    const landerId = `lander_${accountId}_${Date.now()}`;
    await db.query(
      `INSERT INTO player_landers (id, account_id, name, hull, max_hull, fuel, max_fuel, cargo_capacity, fitted_modules, status, is_active)
       VALUES ($1, $2, 'Vanguard Mk.I Lander', 100, 100, 100.0, 100.0, 25, '{}'::jsonb, 'ACTIVE', TRUE)`,
      [landerId, accountId]
    );

    return {
      success: true,
      lander: {
        id: landerId,
        accountId,
        name: 'Vanguard Mk.I Lander',
        hull: 100,
        maxHull: 100,
        fuel: 100,
        maxFuel: 100,
        cargoCapacity: 25,
        fittedModules: {},
        status: 'ACTIVE',
        isActive: true,
      },
      creditsRemaining: newCredits,
    };
  }

  /**
   * Claims an Emergency Loaner Drone for destitute pilots (< 1,000 Credits)
   */
  public async claimLoanerLander(accountId: string): Promise<{
    success: boolean;
    lander?: any;
    isLoaner?: boolean;
    error?: string;
  }> {
    const { rows: accRows } = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    if (accRows.length === 0) {
      return { success: false, error: 'Account not found.' };
    }

    const credits = parseFloat(accRows[0].credits);
    if (credits >= 1000) {
      return {
        success: false,
        error: 'CREDIT_LIMIT_EXCEEDED: Emergency loaner drones are reserved for destitute pilots (< 1,000 CR). Please purchase a Vanguard chassis at the shipyard.',
      };
    }

    // Check if player already has an operational active lander
    const { rows: lRows } = await db.query<any>(
      `SELECT * FROM player_landers WHERE account_id = $1 AND is_active = TRUE AND hull > 0`,
      [accountId]
    );
    if (lRows.length > 0) {
      return {
        success: false,
        error: 'ACTIVE_LANDER_EXISTS: Pilot already possesses an operational lander chassis.',
      };
    }

    // Deactivate previous wrecks
    await db.query(`UPDATE player_landers SET is_active = FALSE WHERE account_id = $1`, [accountId]);

    // Provision emergency loaner drone (fragile hull 50, cargo 12)
    const loanerId = `loaner_${accountId}_${Date.now()}`;
    await db.query(
      `INSERT INTO player_landers (id, account_id, name, hull, max_hull, fuel, max_fuel, cargo_capacity, fitted_modules, status, is_active)
       VALUES ($1, $2, 'Emergency Loaner Drone', 50, 50, 75.0, 75.0, 12, '{}'::jsonb, 'LOANER', TRUE)`,
      [loanerId, accountId]
    );

    return {
      success: true,
      isLoaner: true,
      lander: {
        id: loanerId,
        accountId,
        name: 'Emergency Loaner Drone',
        hull: 50,
        maxHull: 50,
        fuel: 75,
        maxFuel: 75,
        cargoCapacity: 12,
        fittedModules: {},
        status: 'LOANER',
        isActive: true,
      },
    };
  }

  /**
   * Equips an environmental protection module into the lander
   */
  public async equipLanderModule(
    accountId: string,
    slot: 'thermal' | 'electrical' | 'caustic' | 'cargo',
    moduleId: string
  ): Promise<{
    success: boolean;
    lander?: any;
    module?: LanderModuleDef;
    creditsRemaining?: number;
    error?: string;
  }> {
    const modDef = LANDER_MODULE_CATALOG[moduleId];
    if (!modDef) {
      return { success: false, error: `Invalid module ID ${moduleId}.` };
    }
    if (modDef.slot !== slot) {
      return { success: false, error: `Module ${moduleId} belongs to slot ${modDef.slot}, not ${slot}.` };
    }

    // Check active lander
    const { rows: lRows } = await db.query<any>(
      `SELECT * FROM player_landers WHERE account_id = $1 AND is_active = TRUE AND hull > 0 LIMIT 1`,
      [accountId]
    );
    if (lRows.length === 0) {
      return { success: false, error: 'NO_ACTIVE_LANDER: No operational surface lander found to outfit.' };
    }
    const lander = lRows[0];

    // Check account credits
    const { rows: accRows } = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    const credits = parseFloat(accRows[0]?.credits || 0);
    if (credits < modDef.cost) {
      return {
        success: false,
        error: `INSUFFICIENT_CREDITS: Module ${modDef.name} costs ${modDef.cost} CR (Available: ${credits} CR).`,
      };
    }

    // Deduct credits
    const newCredits = credits - modDef.cost;
    await db.query(`UPDATE accounts SET credits = $1 WHERE id = $2`, [newCredits, accountId]);

    // Update fitted modules
    let fitted = typeof lander.fitted_modules === 'string' ? JSON.parse(lander.fitted_modules) : (lander.fitted_modules || {});
    fitted[slot] = moduleId;

    let newCargoCapacity = lander.cargo_capacity;
    if (moduleId === 'MOD_EXPANDED_BIO_BAY') {
      newCargoCapacity = 40;
    }

    await db.query(
      `UPDATE player_landers
       SET fitted_modules = $1, cargo_capacity = $2
       WHERE id = $3`,
      [JSON.stringify(fitted), newCargoCapacity, lander.id]
    );

    return {
      success: true,
      module: modDef,
      creditsRemaining: newCredits,
      lander: {
        id: lander.id,
        name: lander.name,
        hull: lander.hull,
        cargoCapacity: newCargoCapacity,
        fittedModules: fitted,
        status: lander.status || 'ACTIVE',
      },
    };
  }
}

export const planetaryHazardService = new PlanetaryHazardService();


import { db } from '../db/Database';

export interface BiosphereTierDef {
  tier: number;
  name: string;
  costBioData: number;
  moraleBonus: number;
  populationMultiplier: number;
  taxBonus: number;
  description: string;
}

export const BIOSPHERE_TIERS: Record<number, BiosphereTierDef> = {
  1: {
    tier: 1,
    name: 'Standard Biosphere (Baseline)',
    costBioData: 0,
    moraleBonus: 0,
    populationMultiplier: 1.0,
    taxBonus: 0,
    description: 'Standard planetary colony bio-envelope.',
  },
  2: {
    tier: 2,
    name: 'Enriched Soil & Micro-Flora',
    costBioData: 100,
    moraleBonus: 0.10,
    populationMultiplier: 1.25,
    taxBonus: 0.15,
    description: '+10% Morale, 1.25x Population Capacity, +15% Tax Revenue across all player outposts.',
  },
  3: {
    tier: 3,
    name: 'Engineered Biome Synthesis',
    costBioData: 250,
    moraleBonus: 0.20,
    populationMultiplier: 1.50,
    taxBonus: 0.30,
    description: '+20% Morale, 1.50x Population Capacity, +30% Tax Revenue across all player outposts.',
  },
  4: {
    tier: 4,
    name: 'Adaptive Atmospheric Canopy',
    costBioData: 500,
    moraleBonus: 0.30,
    populationMultiplier: 1.80,
    taxBonus: 0.50,
    description: '+30% Morale, 1.80x Population Capacity, +50% Tax Revenue across all player outposts.',
  },
  5: {
    tier: 5,
    name: 'Apex Biosphere Genesis',
    costBioData: 1000,
    moraleBonus: 0.45,
    populationMultiplier: 2.20,
    taxBonus: 0.75,
    description: '+45% Morale, 2.20x Population Capacity, +75% Tax Revenue across all player outposts.',
  },
};

export interface ColonyProjectDef {
  id: string;
  name: string;
  costBioData: number;
  requiredMastery?: { speciesId: string; tier: number };
  description: string;
  benefit: string;
}

export const COLONY_PROJECTS: Record<string, ColonyProjectDef> = {
  BIO_EXTREMOPHILE_DOMES: {
    id: 'BIO_EXTREMOPHILE_DOMES',
    name: 'Adaptive Extremophile Bio-Domes',
    costBioData: 300,
    requiredMastery: { speciesId: 'fauna_aegis_carnivore_01', tier: 1 },
    description: 'Pressurized geo-thermal dome habitats adapted from silicon-based chitin genetics.',
    benefit: 'Permits founding colonies on extreme hazard worlds (Volcanic, Caustic, and Storm worlds) with zero habitability penalty.',
  },
  BIO_SPORE_AGRICULTURE: {
    id: 'BIO_SPORE_AGRICULTURE',
    name: 'Spore-Synthesized Crops',
    costBioData: 200,
    requiredMastery: { speciesId: 'fauna_aegis_grazer_01', tier: 1 },
    description: 'Fast-germinating alien mycorrhizal fungi producing nutrient-dense food cubes.',
    benefit: 'Doubles (+100%) COMM_RATIONS production output from Agricultural Hydroponic Facilities.',
  },
  BIO_CELLULAR_GROWTH: {
    id: 'BIO_CELLULAR_GROWTH',
    name: 'Cellular Growth Accelerator',
    costBioData: 250,
    description: 'Nutrient broth enriched with regenerative enzymes accelerating cellular mitosis.',
    benefit: 'Accelerates colony population growth rate by +50% and boosts industrial workforce output.',
  },
  BIO_ORGANIC_REFINERY: {
    id: 'BIO_ORGANIC_REFINERY',
    name: 'Biomass Fuel Converter',
    costBioData: 350,
    description: 'Anaerobic microbial digesters converting colony organic waste into cryogenic deuterium.',
    benefit: 'Colonies passively synthesize +5 units of COMM_FUEL per cycle into their local storage silos.',
  },
};

export interface SynthesisItemDef {
  id: string;
  name: string;
  category: 'COMBAT_STIM' | 'COATING' | 'FUEL' | 'MODULE';
  specimenCost: number;
  creditsCost: number;
  description: string;
  effect: string;
}

export const SYNTHESIS_CATALOG: Record<string, SynthesisItemDef> = {
  STIM_ADRENAL_SURGE: {
    id: 'STIM_ADRENAL_SURGE',
    name: 'Adrenal Combat Stim',
    category: 'COMBAT_STIM',
    specimenCost: 2,
    creditsCost: 50,
    description: 'Concentrated adrenal extract boosting neural synaptic speed and weapon discharge rates.',
    effect: '+35% Thruster Acceleration and -30% Weapon Cooldown for 30 seconds.',
  },
  COATING_BIO_REGEN: {
    id: 'COATING_BIO_REGEN',
    name: 'Chitinous Bio-Hull Nanites',
    category: 'COATING',
    specimenCost: 4,
    creditsCost: 100,
    description: 'Self-replicating cellular chitin coating that repairs outer structural breaches.',
    effect: 'Passively regenerates +1.5 HP/s ship hull when outside active combat.',
  },
  ENZYME_BIO_FUEL: {
    id: 'ENZYME_BIO_FUEL',
    name: 'Bio-Catalyzed Deuterium Enzymes',
    category: 'FUEL',
    specimenCost: 2,
    creditsCost: 25,
    description: 'Rapid enzymatic digestion converting raw organic tissue into refined sub-light fuel.',
    effect: 'Converts 2 specimens into +25 units of instant Deuterium Warp Fuel.',
  },
  AUG_BIO_OPTIC_ARRAY: {
    id: 'AUG_BIO_OPTIC_ARRAY',
    name: 'Bio-Optic Compound Sensor',
    category: 'MODULE',
    specimenCost: 6,
    creditsCost: 500,
    description: 'Compound sensory apparatus patterned after alien predatory vision.',
    effect: 'Outfitting module increasing radar scanning range by +50% and revealing surface hazard details.',
  },
};

export class XenobiologyService {
  /**
   * Retrieves or initializes player biotech research state
   */
  public async getLabStatus(accountId: string = 'acc_sol_captain'): Promise<any> {
    // Ensure COMM_BIO_SPECIMENS is seeded in port inventories
    await db.query(`
      INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
      VALUES 
        ('PORT_AEGIS_01', 'COMM_BIO_SPECIMENS', 50, 200, 500, 92.0, 95.0),
        ('PORT_SMELTER_01', 'COMM_BIO_SPECIMENS', 20, 150, 400, 89.0, 92.0)
      ON CONFLICT (port_id, commodity_id) DO NOTHING
    `);

    const { rows } = await db.query<any>(
      `SELECT * FROM player_biotech_research WHERE account_id = $1`,
      [accountId]
    );

    let research = rows[0];
    if (!research) {
      await db.query(
        `INSERT INTO player_biotech_research (account_id, bio_data_points, biosphere_tier, unlocked_projects, species_mastery, active_stims)
         VALUES ($1, 0, 1, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)
         ON CONFLICT (account_id) DO NOTHING`,
        [accountId]
      );
      const { rows: newRows } = await db.query<any>(
        `SELECT * FROM player_biotech_research WHERE account_id = $1`,
        [accountId]
      );
      research = newRows[0];
    }

    // Clean up expired stims
    const now = Date.now();
    let stims: any[] = typeof research.active_stims === 'string' ? JSON.parse(research.active_stims) : (research.active_stims || []);
    stims = stims.filter((s: any) => s.expiresAt > now);

    const unlockedProjects: string[] = typeof research.unlocked_projects === 'string'
      ? JSON.parse(research.unlocked_projects)
      : (research.unlocked_projects || []);

    const speciesMastery = typeof research.species_mastery === 'string'
      ? JSON.parse(research.species_mastery)
      : (research.species_mastery || {});

    // Query ship hold for COMM_BIO_SPECIMENS
    const { rows: cargoRows } = await db.query<any>(
      `SELECT quantity FROM ship_cargo sc
       JOIN ships s ON s.id = sc.ship_id
       WHERE s.account_id = $1 AND sc.commodity_id = 'COMM_BIO_SPECIMENS'`,
      [accountId]
    );
    const specimensInHold = cargoRows.length > 0 ? cargoRows[0].quantity : 0;

    const currentTier = research.biosphere_tier || 1;
    const nextTier = currentTier < 5 ? BIOSPHERE_TIERS[currentTier + 1] : null;

    return {
      success: true,
      accountId,
      bioDataPoints: research.bio_data_points || 0,
      biosphereTier: currentTier,
      biosphereTierDetails: BIOSPHERE_TIERS[currentTier],
      nextBiosphereTier: nextTier,
      unlockedProjects,
      speciesMastery,
      activeStims: stims,
      specimensInHold,
      colonyProjectsCatalog: Object.values(COLONY_PROJECTS),
      synthesisCatalog: Object.values(SYNTHESIS_CATALOG),
    };
  }

  /**
   * Submits harvested biological specimens to the lab for Bio-Data points and species gene mastery
   */
  public async submitSpecimens(
    accountId: string,
    quantity: number,
    speciesId?: string
  ): Promise<{ success: boolean; submittedQuantity: number; bioDataAwarded: number; currentBioData: number; speciesMastery: any; error?: string }> {
    // 1. Verify player has enough specimens in ship cargo
    const { rows: cargoRows } = await db.query<any>(
      `SELECT sc.quantity, s.id as ship_id
       FROM ship_cargo sc
       JOIN ships s ON s.id = sc.ship_id
       WHERE s.account_id = $1 AND sc.commodity_id = 'COMM_BIO_SPECIMENS'`,
      [accountId]
    );

    if (cargoRows.length === 0 || cargoRows[0].quantity < quantity) {
      const avail = cargoRows.length > 0 ? cargoRows[0].quantity : 0;
      return {
        success: false,
        submittedQuantity: 0,
        bioDataAwarded: 0,
        currentBioData: 0,
        speciesMastery: {},
        error: `INSUFFICIENT_SPECIMENS: You have ${avail} specimens in hold (Requested: ${quantity}).`,
      };
    }

    const shipId = cargoRows[0].ship_id;
    const currentCargoQty = cargoRows[0].quantity;

    // 2. Deduct specimens from ship_cargo
    if (currentCargoQty === quantity) {
      await db.query(`DELETE FROM ship_cargo WHERE ship_id = $1 AND commodity_id = 'COMM_BIO_SPECIMENS'`, [shipId]);
    } else {
      await db.query(
        `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = 'COMM_BIO_SPECIMENS'`,
        [quantity, shipId]
      );
    }

    // 3. Award Bio-Data points (15 points per specimen)
    const pointsAwarded = quantity * 15;

    // 4. Update species mastery
    const lab = await this.getLabStatus(accountId);
    const mastery = { ...lab.speciesMastery };
    const specKey = speciesId || 'fauna_aegis_carnivore_01';
    const prevCount = mastery[specKey]?.submittedCount || 0;
    const newCount = prevCount + quantity;

    let tier = 1;
    if (newCount >= 8) tier = 3;
    else if (newCount >= 4) tier = 2;

    mastery[specKey] = {
      speciesId: specKey,
      submittedCount: newCount,
      tier,
      tierLabel: tier === 3 ? 'APEX_MASTERY' : tier === 2 ? 'SYNTHESIZED' : 'SEQUENCED',
    };

    // Also advance grazer if multiple submitted
    if (quantity >= 2 && !speciesId) {
      const grazerKey = 'fauna_aegis_grazer_01';
      mastery[grazerKey] = {
        speciesId: grazerKey,
        submittedCount: quantity,
        tier: 1,
        tierLabel: 'SEQUENCED',
      };
    }

    const newBioData = (lab.bioDataPoints || 0) + pointsAwarded;

    await db.query(
      `UPDATE player_biotech_research
       SET bio_data_points = $1, species_mastery = $2, updated_at = NOW()
       WHERE account_id = $3`,
      [newBioData, JSON.stringify(mastery), accountId]
    );

    return {
      success: true,
      submittedQuantity: quantity,
      bioDataAwarded: pointsAwarded,
      currentBioData: newBioData,
      speciesMastery: mastery,
    };
  }

  /**
   * Researches a targeted colony biotechnology breakthrough
   */
  public async researchProject(
    accountId: string,
    projectId: string
  ): Promise<{ success: boolean; project?: ColonyProjectDef; currentBioData: number; unlockedProjects: string[]; error?: string }> {
    const project = COLONY_PROJECTS[projectId];
    if (!project) {
      return { success: false, currentBioData: 0, unlockedProjects: [], error: `Invalid project ID: ${projectId}.` };
    }

    const lab = await this.getLabStatus(accountId);
    if (lab.unlockedProjects.includes(projectId)) {
      return { success: false, currentBioData: lab.bioDataPoints, unlockedProjects: lab.unlockedProjects, error: 'ALREADY_RESEARCHED' };
    }

    // Check Bio-Data points
    if (lab.bioDataPoints < project.costBioData) {
      return {
        success: false,
        currentBioData: lab.bioDataPoints,
        unlockedProjects: lab.unlockedProjects,
        error: `INSUFFICIENT_BIO_DATA: Project requires ${project.costBioData} Bio-Data points (Available: ${lab.bioDataPoints}).`,
      };
    }

    // Check required species mastery if any
    if (project.requiredMastery) {
      const req = project.requiredMastery;
      const mastery = lab.speciesMastery[req.speciesId];
      if (!mastery || mastery.tier < req.tier) {
        return {
          success: false,
          currentBioData: lab.bioDataPoints,
          unlockedProjects: lab.unlockedProjects,
          error: `GENETIC_MASTERY_REQUIRED: Requires Tier ${req.tier} mastery for species ${req.speciesId}. Submit more specimens to sequence genome.`,
        };
      }
    }

    const newBioData = lab.bioDataPoints - project.costBioData;
    const newUnlocked = [...lab.unlockedProjects, projectId];

    await db.query(
      `UPDATE player_biotech_research
       SET bio_data_points = $1, unlocked_projects = $2, updated_at = NOW()
       WHERE account_id = $3`,
      [newBioData, JSON.stringify(newUnlocked), accountId]
    );

    return {
      success: true,
      project,
      currentBioData: newBioData,
      unlockedProjects: newUnlocked,
    };
  }

  /**
   * Upgrades the player's global colony biosphere fertility tier (Tiers 1 to 5)
   */
  public async upgradeBiosphereTier(accountId: string): Promise<{
    success: boolean;
    newTier?: BiosphereTierDef;
    currentBioData: number;
    error?: string;
  }> {
    const lab = await this.getLabStatus(accountId);
    const currentTier = lab.biosphereTier || 1;
    if (currentTier >= 5) {
      return { success: false, currentBioData: lab.bioDataPoints, error: 'MAX_TIER_REACHED: Biosphere already at Apex Genesis (Tier 5).' };
    }

    const nextTier = BIOSPHERE_TIERS[currentTier + 1];
    if (lab.bioDataPoints < nextTier.costBioData) {
      return {
        success: false,
        currentBioData: lab.bioDataPoints,
        error: `INSUFFICIENT_BIO_DATA: Tier ${nextTier.tier} requires ${nextTier.costBioData} Bio-Data points (Available: ${lab.bioDataPoints}).`,
      };
    }

    const newBioData = lab.bioDataPoints - nextTier.costBioData;

    await db.query(
      `UPDATE player_biotech_research
       SET biosphere_tier = $1, bio_data_points = $2, updated_at = NOW()
       WHERE account_id = $3`,
      [nextTier.tier, newBioData, accountId]
    );

    return {
      success: true,
      newTier: nextTier,
      currentBioData: newBioData,
    };
  }

  /**
   * Synthesizes tactical bio-tech consumables, coatings, or fuel
   */
  public async synthesizeItem(
    accountId: string,
    itemId: string
  ): Promise<{ success: boolean; item?: SynthesisItemDef; currentBioData: number; error?: string }> {
    const item = SYNTHESIS_CATALOG[itemId];
    if (!item) {
      return { success: false, currentBioData: 0, error: `Invalid synthesis item ID: ${itemId}.` };
    }

    // 1. Check specimen cost in ship cargo
    const { rows: cargoRows } = await db.query<any>(
      `SELECT sc.quantity, s.id as ship_id, s.fuel, s.cargo_capacity
       FROM ship_cargo sc
       JOIN ships s ON s.id = sc.ship_id
       WHERE s.account_id = $1 AND sc.commodity_id = 'COMM_BIO_SPECIMENS'`,
      [accountId]
    );

    if (cargoRows.length === 0 || cargoRows[0].quantity < item.specimenCost) {
      const avail = cargoRows.length > 0 ? cargoRows[0].quantity : 0;
      return {
        success: false,
        currentBioData: 0,
        error: `INSUFFICIENT_SPECIMENS: Requires ${item.specimenCost} specimens (Available: ${avail}).`,
      };
    }

    const ship = cargoRows[0];

    // 2. Check credits cost
    const { rows: accRows } = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    const credits = parseFloat(accRows[0]?.credits || 0);
    if (credits < item.creditsCost) {
      return {
        success: false,
        currentBioData: 0,
        error: `INSUFFICIENT_CREDITS: Requires ${item.creditsCost} CR (Available: ${credits} CR).`,
      };
    }

    // 3. Deduct ingredients
    await db.query(`UPDATE accounts SET credits = credits - $1 WHERE id = $2`, [item.creditsCost, accountId]);

    if (ship.quantity === item.specimenCost) {
      await db.query(`DELETE FROM ship_cargo WHERE ship_id = $1 AND commodity_id = 'COMM_BIO_SPECIMENS'`, [ship.ship_id]);
    } else {
      await db.query(
        `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = 'COMM_BIO_SPECIMENS'`,
        [item.specimenCost, ship.ship_id]
      );
    }

    // 4. Apply synthesis result
    if (itemId === 'ENZYME_BIO_FUEL') {
      await db.query(`UPDATE ships SET fuel = LEAST(100.0, fuel + 25.0) WHERE id = $1`, [ship.ship_id]);
    } else if (itemId === 'COATING_BIO_REGEN') {
      const lab = await this.getLabStatus(accountId);
      const unlocked = [...new Set([...lab.unlockedProjects, 'COATING_BIO_REGEN'])];
      await db.query(`UPDATE player_biotech_research SET unlocked_projects = $1 WHERE account_id = $2`, [JSON.stringify(unlocked), accountId]);
    }

    const lab = await this.getLabStatus(accountId);

    return {
      success: true,
      item,
      currentBioData: lab.bioDataPoints,
    };
  }

  /**
   * Activates a synthesized combat stimulant
   */
  public async useCombatStim(
    accountId: string,
    stimId: string = 'STIM_ADRENAL_SURGE'
  ): Promise<{ success: boolean; stimId: string; expiresAt: string; buff: any; error?: string }> {
    const expiresAt = new Date(Date.now() + 30000).toISOString();

    const activeStim = {
      stimId,
      name: 'Adrenal Combat Stim',
      activatedAt: new Date().toISOString(),
      expiresAt: Date.now() + 30000,
      buff: {
        speedBoost: 0.35,
        weaponCooldownReduction: 0.30,
      },
    };

    const lab = await this.getLabStatus(accountId);
    const stims = [...lab.activeStims.filter((s: any) => s.stimId !== stimId), activeStim];

    await db.query(
      `UPDATE player_biotech_research SET active_stims = $1, updated_at = NOW() WHERE account_id = $2`,
      [JSON.stringify(stims), accountId]
    );

    return {
      success: true,
      stimId,
      expiresAt,
      buff: activeStim.buff,
    };
  }

  /**
   * Retrieves Galactic Xenodex discovered species catalog for a pilot
   */
  public async getXenodex(accountId: string = 'acc_sol_captain'): Promise<{
    success: boolean;
    discoveredCount: number;
    entries: any[];
  }> {
    const { rows } = await db.query<any>(
      `SELECT ds.*, pl.name as planet_name, pl.subtype as planet_subtype
       FROM discovered_species ds
       LEFT JOIN planets pl ON pl.id = ds.planet_id
       WHERE ds.account_id = $1
       ORDER BY ds.discovered_at DESC`,
      [accountId]
    );
    return {
      success: true,
      discoveredCount: rows.length,
      entries: rows.map((r) => ({
        id: r.id,
        speciesUid: r.species_uid,
        planetId: r.planet_id,
        planetName: r.planet_name || r.planet_id,
        planetSubtype: r.planet_subtype || 'Unknown',
        commonName: r.common_name,
        scientificName: r.scientific_name,
        kingdom: r.kingdom,
        speciesClass: r.species_class,
        covering: r.covering,
        sizeMeters: Number(r.size_meters || 1.5),
        trophicRole: r.trophic_role,
        adaptationTrait: r.adaptation_trait,
        rarityTier: r.rarity_tier,
        genotype: typeof r.genotype_json === 'string' ? JSON.parse(r.genotype_json) : (r.genotype_json || {}),
        discoveredAt: r.discovered_at,
      })),
    };
  }

  /**
   * Debug reset helper for testing
   */
  public async debugReset(accountId: string = 'acc_sol_captain'): Promise<void> {
    await db.query(
      `UPDATE player_biotech_research
       SET bio_data_points = 0, biosphere_tier = 1, unlocked_projects = '[]'::jsonb, species_mastery = '{}'::jsonb, active_stims = '[]'::jsonb, updated_at = NOW()
       WHERE account_id = $1`,
      [accountId]
    );
  }
}

export const xenobiologyService = new XenobiologyService();

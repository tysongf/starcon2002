import { db } from '../db/Database';
import { apService } from './ActionPointService';
import { reputationService, FactionId } from './ReputationService';

export interface PrecursorSite {
  id: string;
  planetId: string;
  name: string;
  siteType: 'MONOLITH' | 'ENERGY_VAULT' | 'CONDUIT_RUIN' | 'STAR_MAP';
  surfaceLat: number;
  surfaceLng: number;
  requiredFreq: number;
  requiredPhase: number;
  requiredDamping: number;
  isDeciphered: boolean;
  codexTitle: string;
  codexText: string;
  relicReward: number;
  createdAt: string;
}

export interface PrecursorPrototypeTech {
  id: string;
  name: string;
  blueprintId: string;
  slotType: 'HIGH' | 'MID' | 'LOW';
  category: string;
  relicCost: number;
  creditCost: number;
  apCost: number;
  description: string;
  stats: Record<string, any>;
  isSynthesized: boolean;
}

export const PROTOTYPE_CATALOG: Omit<PrecursorPrototypeTech, 'isSynthesized'>[] = [
  {
    id: 'TECH_PHASE_LANCE',
    name: 'Precursor Phase Lance',
    blueprintId: 'BP_PRECURSOR_PHASE_LANCE',
    slotType: 'HIGH',
    category: 'WEAPON',
    relicCost: 1,
    creditCost: 1000,
    apCost: 3,
    description: 'Ancient beam projector discharging coherent harmonic phase energy, bypassing 75% of conventional deflector shielding.',
    stats: { damage: 145, fireCooldown: 1.2, energyCost: 28, shieldPierce: 0.75, range: 450 },
  },
  {
    id: 'TECH_TACHYON_DRIVE',
    name: 'Tachyon Warp Accelerator',
    blueprintId: 'BP_PRECURSOR_TACHYON_DRIVE',
    slotType: 'LOW',
    category: 'PROPULSION',
    relicCost: 1,
    creditCost: 800,
    apCost: 3,
    description: 'Subspace tachyon folding engine reducing sector warp AP expenditure by 3 AP and halving fuel burn.',
    stats: { warpApDiscount: 3, topSpeedBonus: 35, fuelEfficiency: 0.5 },
  },
  {
    id: 'TECH_CRYSTAL_SHIELD',
    name: 'Crystalline Matrix Shield',
    blueprintId: 'BP_PRECURSOR_CRYSTAL_SHIELD',
    slotType: 'MID',
    category: 'SHIELD',
    relicCost: 1,
    creditCost: 900,
    apCost: 3,
    description: 'Resonant crystalline shield array rapidly restoring deflector integrity under sustained kinetic or thermal bombardment.',
    stats: { maxShield: 350, rechargeRate: 45, harmonicDamping: 0.4 },
  },
  {
    id: 'TECH_BIOSPHERE',
    name: 'Living Biosphere Matrix',
    blueprintId: 'BP_PRECURSOR_BIOSPHERE_GEN',
    slotType: 'LOW',
    category: 'HULL',
    relicCost: 1,
    creditCost: 750,
    apCost: 3,
    description: 'Compact biome synthesis core providing +25% colony habitability rating and accelerated population growth.',
    stats: { colonyHabitationBonus: 25, populationGrowthMultiplier: 1.5 },
  },
];

export class PrecursorService {
  /**
   * Fetches all Precursor Megastructure sites associated with a planet.
   */
  public async getPlanetPrecursorSites(planetId: string): Promise<PrecursorSite[]> {
    const res = await db.query<any>(
      `SELECT id, planet_id, name, site_type, surface_lat, surface_lng,
              required_freq, required_phase, required_damping, is_deciphered,
              codex_title, codex_text, relic_reward, created_at
       FROM precursor_sites
       WHERE planet_id = $1
       ORDER BY created_at ASC`,
      [planetId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      planetId: r.planet_id,
      name: r.name,
      siteType: r.site_type,
      surfaceLat: Number(r.surface_lat),
      surfaceLng: Number(r.surface_lng),
      requiredFreq: Number(r.required_freq),
      requiredPhase: Number(r.required_phase),
      requiredDamping: Number(r.required_damping),
      isDeciphered: Boolean(r.is_deciphered),
      codexTitle: r.codex_title,
      codexText: r.codex_text,
      relicReward: Number(r.relic_reward),
      createdAt: r.created_at,
    }));
  }

  /**
   * Deciphers a Precursor site by validating harmonic frequency, phase, and damping tolerances.
   * If aligned, marks site as deciphered, unlocks codex, and awards Precursor Relic Cores to ship cargo hold.
   */
  public async decipherPrecursorSite(
    siteId: string,
    accountId: string = 'acc_sol_captain',
    solution: { freq: number; phase: number; damping: number }
  ): Promise<{
    success: boolean;
    site: PrecursorSite;
    codexTitle: string;
    codexText: string;
    relicReward: number;
    message: string;
  }> {
    const siteRes = await db.query<any>('SELECT * FROM precursor_sites WHERE id = $1', [siteId]);
    if (siteRes.rows.length === 0) {
      throw new Error(`PRECURSOR_SITE_NOT_FOUND: Megastructure ${siteId} does not exist.`);
    }

    const row = siteRes.rows[0];
    const site: PrecursorSite = {
      id: row.id,
      planetId: row.planet_id,
      name: row.name,
      siteType: row.site_type,
      surfaceLat: Number(row.surface_lat),
      surfaceLng: Number(row.surface_lng),
      requiredFreq: Number(row.required_freq),
      requiredPhase: Number(row.required_phase),
      requiredDamping: Number(row.required_damping),
      isDeciphered: Boolean(row.is_deciphered),
      codexTitle: row.codex_title,
      codexText: row.codex_text,
      relicReward: Number(row.relic_reward),
      createdAt: row.created_at,
    };

    // If already deciphered, return unlocked codex
    if (site.isDeciphered) {
      return {
        success: true,
        site,
        codexTitle: site.codexTitle,
        codexText: site.codexText,
        relicReward: 0,
        message: 'Precursor frequency sequence already deciphered. Codex unlocked.',
      };
    }

    // Validate tolerances:
    // Frequency: +/- 35 Hz
    // Phase: +/- 35 deg
    // Damping: +/- 25 %
    const freqDiff = Math.abs(solution.freq - site.requiredFreq);
    const phaseDiff = Math.abs(solution.phase - site.requiredPhase);
    const dampDiff = Math.abs(solution.damping - site.requiredDamping);

    if (freqDiff > 35 || phaseDiff > 35 || dampDiff > 25) {
      throw new Error(
        `HARMONIC_DESYNCHRONIZATION: Carrier wave mismatch (Freq Δ: ${freqDiff}Hz, Phase Δ: ${phaseDiff}°, Damping Δ: ${dampDiff}%). Align frequency dials within resonance tolerance.`
      );
    }

    // Mark deciphered in database
    await db.query('UPDATE precursor_sites SET is_deciphered = TRUE WHERE id = $1', [siteId]);
    site.isDeciphered = true;

    // Grant Precursor Relics to ship cargo
    const shipRes = await db.query<any>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (shipRes.rows.length > 0) {
      const shipId = shipRes.rows[0].id;
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [shipId, 'COMM_PRECURSOR_RELIC', site.relicReward]
      );
    }

    // Award +5 AP for major scientific breakthrough
    await apService.addAP(accountId, 5, `Decoded Precursor Codex: ${site.name}`);

    return {
      success: true,
      site,
      codexTitle: site.codexTitle,
      codexText: site.codexText,
      relicReward: site.relicReward,
      message: `Harmonic resonance achieved! Decrypted "${site.codexTitle}" and extracted ${site.relicReward}x Precursor Relic Core! (+5 AP)`,
    };
  }

  /**
   * Retrieves the prototype technology research catalog with player synthesized status.
   */
  public async getResearchCatalog(accountId: string = 'acc_sol_captain'): Promise<PrecursorPrototypeTech[]> {
    const res = await db.query<any>(
      'SELECT tech_id, is_synthesized FROM precursor_research WHERE account_id = $1',
      [accountId]
    );
    const unlockedMap = new Map<string, boolean>();
    res.rows.forEach((r) => unlockedMap.set(r.tech_id, Boolean(r.is_synthesized)));

    return PROTOTYPE_CATALOG.map((tech) => ({
      ...tech,
      isSynthesized: unlockedMap.get(tech.id) || false,
    }));
  }

  /**
   * Synthesizes a prototype ship module from raw Precursor Relic Cores.
   * Consumes Relic, Credits, and AP; fits module into player inventory.
   */
  public async synthesizePrototypeTech(
    accountId: string = 'acc_sol_captain',
    techId: string
  ): Promise<{
    success: boolean;
    tech: PrecursorPrototypeTech;
    inventoryItemId: string;
    message: string;
  }> {
    const techDef = PROTOTYPE_CATALOG.find((t) => t.id === techId);
    if (!techDef) {
      throw new Error(`UNKNOWN_TECH: Prototype technology ${techId} is not in catalog.`);
    }

    // 1. Verify not already synthesized
    const existRes = await db.query<any>(
      'SELECT id FROM precursor_research WHERE account_id = $1 AND tech_id = $2 AND is_synthesized = TRUE',
      [accountId, techId]
    );
    if (existRes.rows.length > 0) {
      throw new Error(`ALREADY_SYNTHESIZED: Prototype ${techDef.name} has already been constructed.`);
    }

    // 2. Validate Relics in ship cargo
    const shipRes = await db.query<any>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (shipRes.rows.length === 0) {
      throw new Error('NO_SHIP_FOUND: Active player vessel not found.');
    }
    const shipId = shipRes.rows[0].id;

    const cargoRes = await db.query<any>(
      'SELECT quantity FROM ship_cargo WHERE ship_id = $1 AND commodity_id = $2',
      [shipId, 'COMM_PRECURSOR_RELIC']
    );
    const relics = cargoRes.rows[0]?.quantity || 0;
    if (relics < techDef.relicCost) {
      throw new Error(
        `INSUFFICIENT_RELICS: Requires ${techDef.relicCost}x Precursor Relic Core (current: ${relics}x). Explore planetary ruins to recover relics.`
      );
    }

    // 3. Validate Credits
    const accRes = await db.query<any>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = accRes.rows[0]?.credits || 0;
    if (credits < techDef.creditCost) {
      throw new Error(
        `INSUFFICIENT_CREDITS: Synthesis requires ${techDef.creditCost} Credits (current: ${credits} CR).`
      );
    }

    // 4. Validate and Deduct AP
    const apCheck = await apService.deductAP(accountId, techDef.apCost, `Synthesize ${techDef.name}`);
    if (!apCheck.success) {
      throw new Error(apCheck.error || `INSUFFICIENT_AP: Synthesis requires ${techDef.apCost} AP.`);
    }

    // 5. Deduct Relics & Credits
    await db.query(
      'UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = $3',
      [techDef.relicCost, shipId, 'COMM_PRECURSOR_RELIC']
    );
    await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [techDef.creditCost, accountId]);

    // 6. Record synthesis in research table
    await db.query(
      `INSERT INTO precursor_research (id, account_id, tech_id, is_synthesized)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (account_id, tech_id) DO UPDATE SET is_synthesized = TRUE`,
      [`res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, accountId, techId]
    );

    // 7. Insert prototype item into player inventory
    const invRes = await db.query<any>(
      `INSERT INTO player_inventory (account_id, blueprint_id, custom_name, rarity, affixes, is_fitted, fit_slot)
       VALUES ($1, $2, $3, 'LEGENDARY', $4, FALSE, NULL)
       RETURNING id`,
      [
        accountId,
        techDef.blueprintId,
        techDef.name,
        JSON.stringify([{ type: 'PRECURSOR_PROTOTYPE', label: 'Harmonic Precursor Engineering' }]),
      ]
    );
    const itemId = invRes.rows[0].id;

    return {
      success: true,
      tech: { ...techDef, isSynthesized: true },
      inventoryItemId: itemId,
      message: `Successfully synthesized prototype "${techDef.name}"! Equipment delivered to ship inventory.`,
    };
  }

  /**
   * Remits a Precursor Relic Core to an alien faction ambassador for massive goodwill and credit bounty.
   */
  public async remitRelic(
    accountId: string = 'acc_sol_captain',
    factionId: FactionId = 'FACTION_SOL'
  ): Promise<{
    success: boolean;
    rewardCredits: number;
    reputationGain: number;
    newStanding: number;
    message: string;
  }> {
    // 1. Check ship cargo for relic
    const shipRes = await db.query<any>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (shipRes.rows.length === 0) throw new Error('NO_SHIP_FOUND: Active vessel not found.');
    const shipId = shipRes.rows[0].id;

    const cargoRes = await db.query<any>(
      'SELECT quantity FROM ship_cargo WHERE ship_id = $1 AND commodity_id = $2',
      [shipId, 'COMM_PRECURSOR_RELIC']
    );
    const relics = cargoRes.rows[0]?.quantity || 0;
    if (relics < 1) {
      throw new Error('NO_RELIC_TO_REMIT: Ship cargo hold contains no Precursor Relic Cores.');
    }

    // 2. Deduct 1 relic
    await db.query(
      'UPDATE ship_cargo SET quantity = quantity - 1 WHERE ship_id = $1 AND commodity_id = $2',
      [shipId, 'COMM_PRECURSOR_RELIC']
    );

    // 3. Grant 2,500 Credits
    const rewardCredits = 2500;
    await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [rewardCredits, accountId]);

    // 4. Grant +50 Reputation with target faction
    const repMod = await reputationService.modifyStanding(
      accountId,
      factionId,
      50,
      'Remitted Ancient Precursor Relic Core'
    );
    const targetStanding = repMod.updatedStandings.find((s) => s.factionId === factionId)?.standing || 50;

    return {
      success: true,
      rewardCredits,
      reputationGain: 50,
      newStanding: targetStanding,
      message: `Precursor Relic Core presented to ambassador! Received +${rewardCredits} Credits and +50 Goodwill with ${factionId}.`,
    };
  }
}

export const precursorService = new PrecursorService();

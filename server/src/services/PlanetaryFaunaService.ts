import { db } from '../db/Database';
import { getPlanetClassProfile } from '../procgen/PlanetTaxonomyCatalog';
import { generatePlanetEcosystem, type ProceduralLifeform } from '../procgen/XenobiologyEngine';
import {
  computeLanderCrewEffects,
  evaluateGritSurvivalRoll,
  getLanderTierDef,
  type EmbarkedCrewSnapshot,
} from '../procgen/LanderCrewCatalog';
import { combatManager } from './SectorCombatManager';

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
  tier: number;
  crew_capacity: number;
  hull: number;
  max_hull: number;
  fuel: number;
  max_fuel: number;
  cargo_capacity: number;
  fitted_modules: Record<string, any>;
  active_expedition_crew?: EmbarkedCrewSnapshot[];
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
    const TITAN_TEMPLATES = {
      MAGMA: { suffix: 'Magma Behemoth', lair: 'Molten Caldera Lair', color: '#f97316', hp: 350, dmg: 35, speed: 48.0, bio: 85, stun: 3, x: 350.0, y: 280.0 },
      SPORE: { suffix: 'Spore Colossus', lair: 'Primordial Spore Hollow', color: '#10b981', hp: 300, dmg: 30, speed: 44.0, bio: 80, stun: 3, x: -280.0, y: 320.0 },
      LEVIATHAN: { suffix: 'Galvanic Leviathan', lair: 'Sub-Surface Ion Trench', color: '#38bdf8', hp: 380, dmg: 38, speed: 52.0, bio: 95, stun: 4, x: 420.0, y: -180.0 },
      CHITIN: { suffix: 'Ancient Chitin Colossus', lair: 'Obsidian Basalt Rift', color: '#f59e0b', hp: 280, dmg: 28, speed: 42.0, bio: 75, stun: 3, x: 310.0, y: -240.0 },
    } as const;

    let theme = getPlanetClassProfile(planet.main_class).titanTheme;
    if (planet.hazard_thermal_level >= 2) theme = 'MAGMA';
    else if (planet.hazard_caustic_level >= 2) theme = 'SPORE';
    else if (planet.hazard_ion_level >= 2) theme = 'LEVIATHAN';

    const t = TITAN_TEMPLATES[theme];
    const speciesName = `${planet.name} ${t.suffix}`;
    const lairName = t.lair;
    const color = t.color;
    const baseHp = t.hp;
    const attackDamage = t.dmg;
    const movementSpeed = t.speed;
    const bioUnitValue = t.bio;
    const stunHitsRequired = t.stun;
    const lairX = t.x;
    const lairY = t.y;

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
   * Validates orbital pre-conditions, embarks selected crew manifest, and deploys surface lander
   */
  public async deployLander(
    accountId: string,
    planetId: string,
    crewIds: string[] = []
  ): Promise<{ success: boolean; session?: any; error?: string }> {
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

    const tierDef = getLanderTierDef(lander.tier);
    const uniqueCrewIds = Array.from(new Set(crewIds.filter(Boolean)));
    if (uniqueCrewIds.length > lander.crew_capacity) {
      return {
        success: false,
        error: `CREW_CAPACITY_EXCEEDED: ${lander.name} seats max ${lander.crew_capacity} Specialist(s), attempted ${uniqueCrewIds.length}.`,
      };
    }

    // Restore any stale LANDER-flagged crew on this lander back to prior state before embarking new manifest
    const prevManifest: EmbarkedCrewSnapshot[] = Array.isArray(lander.active_expedition_crew)
      ? lander.active_expedition_crew
      : [];
    if (prevManifest.length > 0) {
      await this.restoreCrewManifest(accountId, prevManifest);
    }

    const embarkedCrew: EmbarkedCrewSnapshot[] = [];
    if (uniqueCrewIds.length > 0) {
      const { rows: crewRows } = await db.query<any>(
        `SELECT * FROM crew_roster WHERE account_id = $1 AND id = ANY($2::varchar[])`,
        [accountId, uniqueCrewIds]
      );
      if (crewRows.length !== uniqueCrewIds.length) {
        return { success: false, error: 'CREW_NOT_FOUND: One or more selected crew members are not on your roster.' };
      }

      for (const r of crewRows) {
        if (r.assignment_type === 'COLONY') {
          return {
            success: false,
            error: `CREW_ON_COLONY: ${r.name} is stationed on a colony and cannot embark until recalled to Ship Reserve.`,
          };
        }
        const specialties = typeof r.specialties === 'string' ? JSON.parse(r.specialties) : r.specialties || [r.primary_specialty];
        embarkedCrew.push({
          id: r.id,
          seed: Number(r.seed || 1001),
          name: r.name,
          callsign: r.callsign || '',
          factionId: r.faction_id || 'FACTION_SOL',
          species: r.species || 'Sol Terran',
          rarity: r.rarity || 'COMMON',
          primarySpecialty: r.primary_specialty,
          specialties,
          aptitude: Number(r.aptitude || 50),
          grit: Number(r.grit || 50),
          efficiency: Number(r.efficiency || 50),
          traitId: r.trait_id || 'STANDARD',
          traitLabel: r.trait_label || 'Field Qualified',
          traitDesc: r.trait_desc || '',
          morale: Number(r.morale ?? 100),
          previousAssignmentType: r.assignment_type === 'SHIP_BAY' ? 'SHIP_BAY' : 'RESERVE',
          previousBaySlot: r.assigned_bay_slot || null,
        });
      }

      await db.query(
        `UPDATE crew_roster
         SET assignment_type = 'LANDER', assigned_bay_slot = NULL
         WHERE account_id = $1 AND id = ANY($2::varchar[])`,
        [accountId, uniqueCrewIds]
      );
    }

    await db.query(
      `UPDATE player_landers SET active_expedition_crew = $1::jsonb WHERE id = $2`,
      [JSON.stringify(embarkedCrew), lander.id]
    );

    const crewEffects = computeLanderCrewEffects(embarkedCrew, tierDef);
    const effectiveMaxHull = Math.round(lander.max_hull * (1 + crewEffects.extraMaxHullPct));
    const effectiveCargoCapacity = Math.round(lander.cargo_capacity * (1 + crewEffects.cargoCapBonusPct));

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
          tier: lander.tier,
          crewCapacity: lander.crew_capacity,
          hull: Math.min(effectiveMaxHull, lander.hull + (effectiveMaxHull - lander.max_hull)),
          maxHull: effectiveMaxHull,
          fuel: lander.fuel,
          maxFuel: lander.max_fuel,
          cargoCapacity: effectiveCargoCapacity,
          fittedModules: lander.fitted_modules || {},
        },
        embarkedCrew,
        crewEffects,
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

    // 1. Retrieve ship & active lander crew modifiers
    const { rows: sRows } = await db.query<any>(`SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length === 0) {
      return { success: false, stashedMinerals: 0, stashedBioUnits: 0, recoveredCommodities: [], fuelBonus: 0, lander: null, message: '', error: 'Ship not found for account.' };
    }
    const ship = sRows[0];
    const activeLander = await this.getActiveLander(accountId);
    const crewEffects = activeLander
      ? computeLanderCrewEffects(activeLander.active_expedition_crew || [], getLanderTierDef(activeLander.tier))
      : null;
    const minMult = crewEffects?.mineralYieldMult || 1.0;
    const bioMult = crewEffects?.bioYieldMult || 1.0;
    const fuelBonus = 25.0 + (crewEffects?.beaconFuelBonus || 0);

    // 2. Offload Minerals into ship_cargo (authoritative Miner/Geologist yield scaling)
    let totalMinerals = 0;
    const recoveredCommodities: any[] = [];

    for (const mineral of mineralsHarvested) {
      if (mineral.quantity <= 0) continue;
      const effectiveQty = Math.max(1, Math.round(mineral.quantity * minMult));
      totalMinerals += effectiveQty;
      const commodityId = mineral.commodityId || this.mapMineralToCommodity(mineral.name);

      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, effectiveQty]
      );

      recoveredCommodities.push({
        commodityId,
        name: mineral.name,
        quantity: effectiveQty,
      });
    }

    // 3. Offload Biological Samples into ship_cargo (authoritative Biologist/Chemist scaling)
    let totalBioUnits = 0;
    for (const bio of bioSamplesHarvested) {
      if (bio.quantity <= 0) continue;
      const baseUnits = bio.bioUnits || bio.quantity * 10;
      const effectiveUnits = Math.max(1, Math.round(baseUnits * bioMult));
      const effectiveBioQty = Math.max(1, Math.round(bio.quantity * bioMult));
      totalBioUnits += effectiveUnits;

      const commodityId = 'COMM_BIO_SPECIMENS';
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, effectiveBioQty]
      );

      recoveredCommodities.push({
        commodityId,
        name: bio.name,
        quantity: effectiveBioQty,
        bioUnits: effectiveUnits,
      });
    }

    // 4. Update lander: refund +25 fuel (+Settler bonus) and update hull
    const refueledVal = Math.max(0, fuelRemaining) + fuelBonus;
    const clampedHullVal = Math.max(1, hullRemaining);
    await db.query(
      `UPDATE player_landers
       SET fuel = LEAST(max_fuel, $1), hull = LEAST(max_hull, $2)
       WHERE account_id = $3 AND is_active = TRUE`,
      [refueledVal, clampedHullVal, accountId]
    );

    const updatedLander = await this.getActiveLander(accountId);

    return {
      success: true,
      stashedMinerals: totalMinerals,
      stashedBioUnits: totalBioUnits,
      recoveredCommodities,
      fuelBonus,
      lander: updatedLander,
      message: `Offloaded ${recoveredCommodities.length} resource batches to mothership hold. Lander refueled (+${fuelBonus.toFixed(0)} Fuel). Surface expedition active.`,
    };
  }

  private async restoreCrewManifest(accountId: string, manifest: EmbarkedCrewSnapshot[]): Promise<void> {
    for (const member of manifest) {
      let targetAssign = member.previousAssignmentType || 'RESERVE';
      let targetBay = member.previousBaySlot || null;
      if (targetAssign === 'SHIP_BAY' && targetBay) {
        const occRes = await db.query<any>(
          `SELECT id FROM crew_roster WHERE account_id = $1 AND assigned_bay_slot = $2 AND assignment_type = 'SHIP_BAY' AND id <> $3`,
          [accountId, targetBay, member.id]
        );
        if (occRes.rows.length > 0) {
          targetAssign = 'RESERVE';
          targetBay = null;
        }
      } else {
        targetAssign = 'RESERVE';
        targetBay = null;
      }

      await db.query(
        `UPDATE crew_roster
         SET assignment_type = $1, assigned_bay_slot = $2
         WHERE id = $3 AND account_id = $4`,
        [targetAssign, targetBay, member.id, accountId]
      );
    }
  }

  /**
   * Atomically commits harvested minerals and bio-specimens into player hold upon lander recovery,
   * handles Grit-based orbital CASTAWAY ejection vs KIA on hull loss, and grants Veteran progression.
   */
  public async recoverLander(
    planetId: string,
    payload: LanderRecoveryPayload
  ): Promise<{
    success: boolean;
    status?: string;
    totalMinerals: number;
    totalBioUnits: number;
    recoveredCommodities: any[];
    casualties?: any[];
    ejectedCastaways?: any[];
    veteransGained?: any[];
    hazardPayPaid?: number;
    sectorId?: number;
    error?: string;
  }> {
    const { accountId, mineralsHarvested, bioSamplesHarvested, hullRemaining, fuelRemaining } = payload;

    // 1. Retrieve ship
    const { rows: sRows } = await db.query<any>(`SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1`, [accountId]);
    if (sRows.length === 0) {
      return { success: false, totalMinerals: 0, totalBioUnits: 0, recoveredCommodities: [], error: 'Ship not found for account.' };
    }
    const ship = sRows[0];

    const [activeLander, pRes] = await Promise.all([
      this.getActiveLander(accountId),
      db.query<any>(
        `SELECT id, name, sector_id, COALESCE(hazard_thermal_level,0) AS th, COALESCE(hazard_ion_level,0) AS ion, COALESCE(hazard_caustic_level,0) AS cau
         FROM planets WHERE id = $1 LIMIT 1`,
        [planetId]
      ),
    ]);
    const planetRow = pRes.rows[0] || { id: planetId, name: planetId, sector_id: 1, th: 0, ion: 0, cau: 0 };
    const sectorId = Number(planetRow.sector_id || 1);
    const manifest: EmbarkedCrewSnapshot[] = activeLander?.active_expedition_crew || [];

    // 2. Check if lander suffered total hull failure on surface -> Grit survival roll!
    if (hullRemaining <= 0) {
      const casualties: any[] = [];
      const ejectedCastaways: any[] = [];
      const planetSeedFactor = (sectorId * 131 + planetId.length * 17) >>> 0;

      for (const member of manifest) {
        const roll = evaluateGritSurvivalRoll(member, planetSeedFactor);
        const casualtyId = `cas_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const outcome = roll.survived ? 'EJECTED_CASTAWAY' : 'KIA';

        // Remove from active roster (survivors must be scooped from their orbital cryo-pod!)
        await db.query(`DELETE FROM crew_roster WHERE id = $1 AND account_id = $2`, [member.id, accountId]);

        await db.query(
          `INSERT INTO crew_casualties (
             id, account_id, crew_name, callsign, rarity, specialties, aptitude, grit,
             planet_id, planet_name, lander_name, outcome
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)`,
          [
            casualtyId,
            accountId,
            member.name,
            member.callsign || '',
            member.rarity,
            JSON.stringify(member.specialties),
            member.aptitude,
            member.grit,
            planetRow.id,
            planetRow.name,
            activeLander?.name || 'Surface Lander',
            outcome,
          ]
        );

        if (roll.survived) {
          const containerId = combatManager.spawnPreservedCastawayPod(
            sectorId,
            member,
            `Ejected over ${planetRow.name} (${activeLander?.name || 'Lander'})`
          );
          ejectedCastaways.push({
            id: member.id,
            name: member.name,
            specialties: member.specialties,
            grit: member.grit,
            survivalChance: roll.survivalChance,
            containerId,
            sectorId,
          });
        } else {
          casualties.push({
            id: member.id,
            name: member.name,
            specialties: member.specialties,
            grit: member.grit,
            survivalChance: roll.survivalChance,
            outcome: 'KIA',
          });
        }
      }

      await db.query(
        `UPDATE player_landers
         SET hull = 0, is_active = FALSE, status = 'DESTROYED', active_expedition_crew = '[]'::jsonb
         WHERE account_id = $1 AND is_active = TRUE`,
        [accountId]
      );

      return {
        success: true,
        status: 'LANDER_DESTROYED',
        totalMinerals: 0,
        totalBioUnits: 0,
        recoveredCommodities: [],
        casualties,
        ejectedCastaways,
        sectorId,
      };
    }

    // 3. Safe ascent: restore crew prior SHIP_BAY / RESERVE assignments & apply effects
    const crewEffects = activeLander
      ? computeLanderCrewEffects(manifest, getLanderTierDef(activeLander.tier))
      : null;
    const minMult = crewEffects?.mineralYieldMult || 1.0;
    const bioMult = crewEffects?.bioYieldMult || 1.0;

    await db.query(
      `UPDATE player_landers
       SET hull = $1, fuel = $2, active_expedition_crew = '[]'::jsonb
       WHERE account_id = $3 AND is_active = TRUE`,
      [
        Math.max(0, Math.min(Number(activeLander?.max_hull || 250) * 1.5, Math.round(hullRemaining))),
        Math.max(0, Math.min(Number(activeLander?.max_fuel || 250), fuelRemaining)),
        accountId,
      ]
    );

    if (manifest.length > 0) {
      await this.restoreCrewManifest(accountId, manifest);
    }

    // 4. Process Minerals into ship_cargo
    let totalMinerals = 0;
    const recoveredCommodities: any[] = [];

    for (const mineral of mineralsHarvested) {
      if (mineral.quantity <= 0) continue;
      const effectiveQty = Math.max(1, Math.round(mineral.quantity * minMult));
      totalMinerals += effectiveQty;

      const commodityId = mineral.commodityId || this.mapMineralToCommodity(mineral.name);

      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, effectiveQty]
      );

      recoveredCommodities.push({
        commodityId,
        name: mineral.name,
        quantity: effectiveQty,
      });
    }

    // 5. Process Biological Samples into ship_cargo
    let totalBioUnits = 0;
    for (const bio of bioSamplesHarvested) {
      if (bio.quantity <= 0) continue;
      const baseUnits = bio.bioUnits || bio.quantity * 10;
      const effectiveUnits = Math.max(1, Math.round(baseUnits * bioMult));
      const effectiveBioQty = Math.max(1, Math.round(bio.quantity * bioMult));
      totalBioUnits += effectiveUnits;

      const commodityId = 'COMM_BIO_SPECIMENS';
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + $3`,
        [ship.id, commodityId, effectiveBioQty]
      );

      recoveredCommodities.push({
        commodityId,
        name: bio.name,
        quantity: effectiveBioQty,
        bioUnits: effectiveUnits,
      });
    }

    // 6. Veteran Stat Growth & Hazard Pay on safe extraction with embarked crew
    const veteransGained: any[] = [];
    let hazardPayPaid = 0;
    const totalHazardLevel = Number(planetRow.th || 0) + Number(planetRow.ion || 0) + Number(planetRow.cau || 0);

    if (manifest.length > 0) {
      const payPerCrew = (15 + totalHazardLevel * 5) * (1 - (crewEffects?.hazardPayDiscount || 0));
      const rawHazardPay = Math.round(payPerCrew * manifest.length);
      if (rawHazardPay > 0) {
        const accRes = await db.query<any>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
        const curCredits = Number(accRes.rows[0]?.credits || 0);
        hazardPayPaid = Math.min(curCredits, rawHazardPay);
        if (hazardPayPaid > 0) {
          await db.query(`UPDATE accounts SET credits = credits - $1 WHERE id = $2`, [hazardPayPaid, accountId]);
        }
      }

      for (const member of manifest) {
        const moraleGain = totalHazardLevel > 0 ? 5 : 2;
        if (totalHazardLevel >= 2 || totalMinerals + totalBioUnits >= 15) {
          const boostGrit = (Number(member.seed || 0) + totalMinerals) % 2 === 0;
          if (boostGrit) {
            await db.query(
              `UPDATE crew_roster SET grit = LEAST(99, grit + 1), morale = LEAST(100, morale + $1) WHERE id = $2`,
              [moraleGain, member.id]
            );
            veteransGained.push({ id: member.id, name: member.name, stat: 'grit', delta: 1 });
          } else {
            await db.query(
              `UPDATE crew_roster SET aptitude = LEAST(99, aptitude + 1), morale = LEAST(100, morale + $1) WHERE id = $2`,
              [moraleGain, member.id]
            );
            veteransGained.push({ id: member.id, name: member.name, stat: 'aptitude', delta: 1 });
          }
        } else {
          await db.query(
            `UPDATE crew_roster SET morale = LEAST(100, morale + $1) WHERE id = $2`,
            [moraleGain, member.id]
          );
        }
      }
    }

    return {
      success: true,
      totalMinerals,
      totalBioUnits,
      recoveredCommodities,
      veteransGained,
      hazardPayPaid,
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
      tier: Number(r.tier || 1),
      crew_capacity: Number(r.crew_capacity || 1),
      hull: r.hull,
      max_hull: r.max_hull,
      fuel: parseFloat(r.fuel),
      max_fuel: parseFloat(r.max_fuel),
      cargo_capacity: r.cargo_capacity,
      fitted_modules: typeof r.fitted_modules === 'string' ? JSON.parse(r.fitted_modules) : (r.fitted_modules || {}),
      active_expedition_crew:
        typeof r.active_expedition_crew === 'string'
          ? JSON.parse(r.active_expedition_crew || '[]')
          : r.active_expedition_crew || [],
      is_active: r.is_active,
    };
  }

  /**
   * Retrieves active lander or initializes default Vanguard Mk.I
   */
  public async getOrCreateActiveLander(accountId: string): Promise<PlayerLander> {
    const existing = await this.getActiveLander(accountId);
    if (existing) return existing;

    const newId = `lander_${accountId}_01`;
    await db.query(
      `INSERT INTO player_landers (id, account_id, name, tier, crew_capacity, hull, max_hull, fuel, max_fuel, cargo_capacity, fitted_modules, active_expedition_crew, is_active)
       VALUES ($1, $2, 'Vanguard Mk.I Lander', 1, 1, 100, 100, 100.0, 100.0, 25, '{}'::jsonb, '[]'::jsonb, TRUE)
       ON CONFLICT (id) DO UPDATE SET hull = 100, fuel = 100.0, tier = 1, crew_capacity = 1, active_expedition_crew = '[]'::jsonb`,
      [newId, accountId]
    );

    return {
      id: newId,
      account_id: accountId,
      name: 'Vanguard Mk.I Lander',
      tier: 1,
      crew_capacity: 1,
      hull: 100,
      max_hull: 100,
      fuel: 100.0,
      max_fuel: 100.0,
      cargo_capacity: 25,
      fitted_modules: {},
      active_expedition_crew: [],
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

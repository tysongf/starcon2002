import { db } from '../db/Database';
import {
  ALL_SPECIALTY_IDS,
  CREW_RARITY_SPECS,
  CREW_SPECIALTIES,
  COLONY_MODULES,
  SHIP_BAY_BLUEPRINT_MAP,
  SPECIALTY_MAP,
  diminishingStackSum,
  generateProceduralCrewCandidate,
  type ColonyModuleKey,
  type CrewComputedBonuses,
  type CrewRarity,
  type CrewSpecialtyId,
  type ProceduralCrewCandidate,
} from '../procgen/CrewCatalog';
import { getHullDef } from '../procgen/HullClassCatalog';
import { outfittingService, type FittedModule } from './OutfittingService';
import { apService } from './ActionPointService';

export interface CrewMemberRecord {
  id: string;
  accountId: string;
  seed: number;
  name: string;
  callsign: string;
  factionId: string;
  species: string;
  age: number;
  rarity: CrewRarity;
  primarySpecialty: CrewSpecialtyId;
  specialties: CrewSpecialtyId[];
  aptitude: number;
  grit: number;
  efficiency: number;
  traitId: string;
  traitLabel: string;
  traitDesc: string;
  morale: number;
  baseSalary: number;
  hiringFee: number;
  marketValue: number;
  resaleValue: number;
  assignmentType: 'RESERVE' | 'SHIP_BAY' | 'COLONY' | 'LANDER';
  assignedBaySlot: string | null;
  assignedColonyId: string | null;
  assignedModuleKey: string | null;
  originSource: string;
  originLabel: string;
  cyclesServed: number;
  bio: string;
  createdAt: string;
}

export interface ShipStationSlotInfo {
  slotKey: string; // 'BRIDGE#1' or 'B1#1'
  baySlot: string; // 'BRIDGE' or 'B1'..'B8'
  bayName: string;
  department: string;
  acceptedSpecialties: CrewSpecialtyId[] | 'ANY';
  occupantCrewId: string | null;
}

export interface CrewRosterOverview {
  success: boolean;
  accountId: string;
  credits: number;
  arrearsCycles: number;
  crew: CrewMemberRecord[];
  shipStations: ShipStationSlotInfo[];
  reserveBerthLimit: number;
  bonuses: CrewComputedBonuses;
}

const PORT_SPECIALTY_AFFINITY: Record<string, readonly CrewSpecialtyId[]> = {
  PORT_AEGIS_01: ['Pilot', 'Gunner', 'Diplomat', 'Medic', 'Settler', 'Navigator'],
  PORT_SMELTER_01: ['Miner', 'Geologist', 'Engineer', 'Chemist', 'Mechanic'],
  PORT_WARDEN_01: ['Physicist', 'Astronomer', 'Archaeologist', 'Biologist', 'Navigator'],
  PORT_MINERS_01: ['Miner', 'Geologist', 'Mechanic', 'Settler', 'Chemist'],
  PORT_FREEBOOTER_01: ['Gunner', 'Soldier', 'Merchant', 'Mechanic', 'Pilot'],
};

function builtInBridgeSeats(tier: number): number {
  if (tier >= 3) return 3;
  if (tier >= 2) return 2;
  return 1;
}

export class CrewService {
  /**
   * Computes unlocked Ship Station Slots from active flagship hull + fitted BAY modules.
   */
  public async getShipStations(
    accountId: string,
    preloadedLoadout?: Awaited<ReturnType<typeof outfittingService.getPlayerLoadout>>
  ): Promise<{
    stations: ShipStationSlotInfo[];
    reserveBerthLimit: number;
    bayBonuses: CrewComputedBonuses['bayYieldBonuses'];
    portableBonuses: { miningRateBonus: number; rareOreLuckBonus: number; researchYieldBonus: number; moraleBonus: number };
  }> {
    const loadout = preloadedLoadout || (await outfittingService.getPlayerLoadout(accountId));
    const hullDef = getHullDef(loadout.shipClass);
    const bridgeSeats = builtInBridgeSeats(hullDef.tier);

    const stations: ShipStationSlotInfo[] = [];
    for (let i = 1; i <= bridgeSeats; i++) {
      stations.push({
        slotKey: `BRIDGE#${i}`,
        baySlot: 'BRIDGE',
        bayName: `${hullDef.displayName} Command Deck`,
        department: 'OPERATIONS',
        acceptedSpecialties: 'ANY',
        occupantCrewId: null,
      });
    }

    let reserveBerthLimit = 6 + hullDef.baySlots * 2;
    const bayBonuses: CrewComputedBonuses['bayYieldBonuses'] = {
      researchBayBonus: 0,
      miningBayBonus: 0,
      combatBayBonus: 0,
      powerGridBayBonus: 0,
      moraleBayBonus: 0,
      navTradeBayBonus: 0,
    };
    const portableBonuses = {
      miningRateBonus: 0,
      rareOreLuckBonus: 0,
      researchYieldBonus: 0,
      moraleBonus: 0,
    };

    const fittedMods = Object.values(loadout.fitted).filter(Boolean) as FittedModule[];
    for (const mod of fittedMods) {
      const bs = mod.baseStats || {};
      if (mod.slotType === 'BAY' && mod.fitSlot) {
        const bpDef = SHIP_BAY_BLUEPRINT_MAP.get(mod.blueprintId);
        const stationCount = Number(bs.stationCount ?? bpDef?.stationCount ?? 1);
        const dept = String(bs.bayDepartment ?? bpDef?.department ?? 'OPERATIONS');
        const accepted: CrewSpecialtyId[] | 'ANY' = bpDef ? [...bpDef.acceptedSpecialties] : 'ANY';
        for (let sIdx = 1; sIdx <= stationCount; sIdx++) {
          stations.push({
            slotKey: `${mod.fitSlot}#${sIdx}`,
            baySlot: mod.fitSlot,
            bayName: mod.customName || mod.name,
            department: dept,
            acceptedSpecialties: accepted,
            occupantCrewId: null,
          });
        }
        bayBonuses.researchBayBonus += Number(bs.researchYieldBonus || 0);
        bayBonuses.miningBayBonus += Number(bs.miningRateBonus || 0);
        bayBonuses.combatBayBonus += Number(bs.combatDamageBonus || 0);
        bayBonuses.powerGridBayBonus += Number(bs.powerGridBonus || 0);
        bayBonuses.moraleBayBonus += Number(bs.moraleBonus || 0);
        bayBonuses.navTradeBayBonus += Number(bs.navTradeBonus || 0);
      } else {
        reserveBerthLimit += Number(bs.crewCapacityBonus || 0);
        portableBonuses.miningRateBonus += Number(bs.miningRateBonus || 0);
        portableBonuses.rareOreLuckBonus += Number(bs.rareOreLuckBonus || 0);
        portableBonuses.researchYieldBonus += Number(bs.researchYieldBonus || 0);
        portableBonuses.moraleBonus += Number(bs.moraleBonus || 0);
      }
    }

    return { stations, reserveBerthLimit, bayBonuses, portableBonuses };
  }

  /**
   * Computes complete crew roster, active ship stations, and aggregated gameplay bonuses.
   */
  public async getRosterSummary(accountId: string = 'acc_sol_captain'): Promise<CrewRosterOverview> {
    const [accRes, rosterRes, colRes, stationData] = await Promise.all([
      db.query<any>('SELECT credits, crew_arrears_cycles FROM accounts WHERE id = $1', [accountId]),
      db.query<any>('SELECT * FROM crew_roster WHERE account_id = $1 ORDER BY created_at ASC', [accountId]),
      db.query<any>('SELECT id, colony_modules, habitation_tier FROM colonies WHERE account_id = $1', [accountId]),
      this.getShipStations(accountId),
    ]);

    const credits = Number(accRes.rows[0]?.credits ?? 0);
    const arrearsCycles = Number(accRes.rows[0]?.crew_arrears_cycles ?? 0);
    const stationsByKey = new Map<string, ShipStationSlotInfo>(
      stationData.stations.map((s) => [s.slotKey, s])
    );

    const crewList: CrewMemberRecord[] = [];
    for (const r of rosterRes.rows) {
      let assignType = r.assignment_type as 'RESERVE' | 'SHIP_BAY' | 'COLONY';
      let baySlot: string | null = r.assigned_bay_slot || null;

      // Auto-unassign gracefully if player swapped to a smaller hull or unfitted a bay module
      if (assignType === 'SHIP_BAY') {
        const slot = baySlot ? stationsByKey.get(baySlot) : undefined;
        if (!slot || slot.occupantCrewId) {
          assignType = 'RESERVE';
          baySlot = null;
          await db.query(
            `UPDATE crew_roster SET assignment_type = 'RESERVE', assigned_bay_slot = NULL, updated_at = NOW() WHERE id = $1`,
            [r.id]
          );
        } else {
          slot.occupantCrewId = r.id;
        }
      }

      const specialties: CrewSpecialtyId[] = Array.isArray(r.specialties)
        ? r.specialties
        : JSON.parse(r.specialties || '[]');
      const mVal = Number(r.market_value || 150);
      const cyclesBonus = Math.min(0.18, Number(r.cycles_served || 0) * 0.02);
      const resaleValue = Math.round(mVal * (0.65 + cyclesBonus));

      crewList.push({
        id: r.id,
        accountId: r.account_id,
        seed: Number(r.seed),
        name: r.name,
        callsign: r.callsign,
        factionId: r.faction_id,
        species: r.species,
        age: Number(r.age),
        rarity: r.rarity as CrewRarity,
        primarySpecialty: r.primary_specialty as CrewSpecialtyId,
        specialties,
        aptitude: Number(r.aptitude),
        grit: Number(r.grit),
        efficiency: Number(r.efficiency),
        traitId: r.trait_id,
        traitLabel: r.trait_label,
        traitDesc: r.trait_desc,
        morale: Number(r.morale),
        baseSalary: Number(r.base_salary),
        hiringFee: Number(r.hiring_fee),
        marketValue: mVal,
        resaleValue,
        assignmentType: assignType,
        assignedBaySlot: baySlot,
        assignedColonyId: r.assigned_colony_id || null,
        assignedModuleKey: r.assigned_module_key || null,
        originSource: r.origin_source,
        originLabel: r.origin_label,
        cyclesServed: Number(r.cycles_served || 0),
        bio: r.bio,
        createdAt: r.created_at,
      });
    }

    const bonuses = this.computeAggregateBonuses(crewList, colRes.rows, stationData);

    // Merchant resale bonus
    if (bonuses.tradeMarginBonus > 0) {
      const bonusShare = Math.min(0.2, bonuses.tradeMarginBonus * 0.5);
      for (const c of crewList) {
        c.resaleValue = Math.round(c.marketValue * Math.min(0.88, 0.65 + Math.min(0.15, c.cyclesServed * 0.02) + bonusShare));
      }
    }

    return {
      success: true,
      accountId,
      credits,
      arrearsCycles,
      crew: crewList,
      shipStations: stationData.stations,
      reserveBerthLimit: stationData.reserveBerthLimit,
      bonuses,
    };
  }

  private computeAggregateBonuses(
    crewList: CrewMemberRecord[],
    colonyRows: any[],
    stationData: Awaited<ReturnType<CrewService['getShipStations']>>
  ): CrewComputedBonuses {
    const pools: Record<string, number[]> = {
      miningYield: [],
      miningSpeed: [],
      rareOreLuck: [],
      bioData: [],
      precursor: [],
      weaponDmg: [],
      fireCadence: [],
      flightSpeed: [],
      shieldRegen: [],
      powerGridMW: [],
      cpuTF: [],
      salvageYield: [],
      tradeMargin: [],
      warpFuelDiscount: [],
      reputationGain: [],
      colonyOutput: [],
      colonyPopGrowth: [],
      hazardResist: [],
    };

    let stationedShipCount = 0;
    let stationedColonyCount = 0;
    let reserveCount = 0;
    let grossCycleSalary = 0;
    let colonyWageSubsidy = 0;

    for (const c of crewList) {
      grossCycleSalary += c.baseSalary;

      if (c.assignmentType === 'SHIP_BAY') stationedShipCount++;
      else if (c.assignmentType === 'COLONY') stationedColonyCount++;
      else {
        reserveCount++;
        continue; // Reserve officers do not project active station bonuses
      }

      const moraleFactor = c.morale < 20 ? 0 : c.morale < 50 ? 0.5 : 1.0;
      if (moraleFactor <= 0) continue;

      const rSpec = CREW_RARITY_SPECS[c.rarity] || CREW_RARITY_SPECS.COMMON;
      const effMult = 0.88 + (c.efficiency / 100) * 0.24;
      const basePower = (c.aptitude / 100) * rSpec.powerFactor * moraleFactor * effMult;

      for (let idx = 0; idx < c.specialties.length; idx++) {
        const sp = c.specialties[idx];
        const w = (idx === 0 ? 1.0 : 0.72) * basePower;

        if (sp === 'Miner') {
          pools.miningYield.push(0.12 * w);
          pools.miningSpeed.push(0.14 * w);
        } else if (sp === 'Geologist') {
          pools.rareOreLuck.push(0.15 * w);
          pools.miningYield.push(0.08 * w);
          pools.colonyOutput.push(0.1 * w);
        } else if (sp === 'Biologist') {
          pools.bioData.push(0.18 * w);
          pools.colonyPopGrowth.push(0.1 * w);
        } else if (sp === 'Physicist') {
          pools.precursor.push(0.16 * w);
          pools.shieldRegen.push(0.1 * w);
        } else if (sp === 'Archaeologist') {
          pools.precursor.push(0.2 * w);
          pools.salvageYield.push(0.1 * w);
        } else if (sp === 'Astronomer') {
          pools.warpFuelDiscount.push(0.07 * w);
          pools.rareOreLuck.push(0.07 * w);
        } else if (sp === 'Chemist') {
          pools.miningYield.push(0.08 * w);
          pools.hazardResist.push(0.12 * w);
        } else if (sp === 'Gunner') {
          pools.weaponDmg.push(0.11 * w);
          pools.fireCadence.push(0.09 * w);
        } else if (sp === 'Soldier') {
          pools.weaponDmg.push(0.06 * w);
          pools.hazardResist.push(0.08 * w);
        } else if (sp === 'Pilot') {
          pools.flightSpeed.push(0.1 * w);
        } else if (sp === 'Navigator') {
          pools.warpFuelDiscount.push(0.11 * w);
          pools.flightSpeed.push(0.05 * w);
        } else if (sp === 'Medic') {
          pools.hazardResist.push(0.15 * w);
          pools.colonyPopGrowth.push(0.08 * w);
        } else if (sp === 'Engineer') {
          pools.powerGridMW.push(14 * w);
          pools.cpuTF.push(20 * w);
          pools.shieldRegen.push(0.14 * w);
        } else if (sp === 'Mechanic') {
          pools.salvageYield.push(0.18 * w);
          pools.colonyOutput.push(0.07 * w);
        } else if (sp === 'Merchant') {
          pools.tradeMargin.push(0.08 * w);
          if (c.assignmentType === 'COLONY') colonyWageSubsidy += Math.round(28 * w);
        } else if (sp === 'Diplomat') {
          pools.reputationGain.push(0.16 * w);
          pools.tradeMargin.push(0.04 * w);
        } else if (sp === 'Settler') {
          pools.colonyPopGrowth.push(0.18 * w);
          pools.colonyOutput.push(0.08 * w);
          if (c.assignmentType === 'COLONY') colonyWageSubsidy += Math.round(18 * w);
        }
      }

      // Trait secondary edge
      if (c.traitId === 'DEEP_CORE_VETERAN') pools.miningYield.push(0.1 * moraleFactor);
      else if (c.traitId === 'XENO_SAVANT') pools.bioData.push(0.12 * moraleFactor);
      else if (c.traitId === 'SLIPSTREAM_ACE') pools.warpFuelDiscount.push(0.08 * moraleFactor);
      else if (c.traitId === 'RELIC_HUNTER') pools.precursor.push(0.12 * moraleFactor);
      else if (c.traitId === 'BIO_STABILIZER') pools.hazardResist.push(0.08 * moraleFactor);
      else if (c.traitId === 'PLASMA_TUNER') pools.weaponDmg.push(0.08 * moraleFactor);
      else if (c.traitId === 'SILVER_TONGUE') pools.reputationGain.push(0.1 * moraleFactor);
      else if (c.traitId === 'STARPORT_BROKER') {
        pools.tradeMargin.push(0.08 * moraleFactor);
        if (c.assignmentType === 'COLONY') colonyWageSubsidy += 16;
      }
    }

    // Colony module infrastructure wage subsidies + passive bonuses
    for (const col of colonyRows) {
      const mods: Record<string, number> =
        typeof col.colony_modules === 'string'
          ? JSON.parse(col.colony_modules || '{}')
          : col.colony_modules || {};
      const tradeTier = Number(mods.TRADE_EXCHANGE || 0);
      if (tradeTier === 1) colonyWageSubsidy += 45;
      else if (tradeTier === 2) colonyWageSubsidy += 100;
      else if (tradeTier >= 3) colonyWageSubsidy += 180;

      const habTier = Number(col.habitation_tier || 1);
      colonyWageSubsidy += habTier * 12;

      const resTier = Number(mods.RESEARCH_INSTITUTE || 0);
      if (resTier > 0) {
        const resBonus = resTier === 1 ? 0.15 : resTier === 2 ? 0.3 : 0.5;
        pools.bioData.push(resBonus);
        pools.precursor.push(resBonus * 0.8);
      }
      const refTier = Number(mods.ORE_REFINERY || 0);
      if (refTier > 0) {
        pools.colonyOutput.push(refTier === 1 ? 0.2 : refTier === 2 ? 0.4 : 0.65);
      }
    }

    const effectiveSubsidy = Math.min(grossCycleSalary, colonyWageSubsidy);
    const netCycleUpkeep = Math.max(0, grossCycleSalary - effectiveSubsidy);

    const bayYieldBonuses = stationData.bayBonuses;
    const p = stationData.portableBonuses;

    return {
      stationedShipCount,
      stationedColonyCount,
      reserveCount,
      totalShipStationsUnlocked: stationData.stations.length,
      bayYieldBonuses,
      miningYieldBonus: Math.round((diminishingStackSum(pools.miningYield) + bayYieldBonuses.miningBayBonus + p.miningRateBonus) * 1000) / 1000,
      miningSpeedBonus: Math.round((diminishingStackSum(pools.miningSpeed) + bayYieldBonuses.miningBayBonus) * 1000) / 1000,
      rareOreLuckBonus: Math.round((diminishingStackSum(pools.rareOreLuck) + p.rareOreLuckBonus) * 1000) / 1000,
      researchBioDataBonus: Math.round((diminishingStackSum(pools.bioData) + bayYieldBonuses.researchBayBonus + p.researchYieldBonus) * 1000) / 1000,
      researchPrecursorBonus: Math.round((diminishingStackSum(pools.precursor) + bayYieldBonuses.researchBayBonus + p.researchYieldBonus) * 1000) / 1000,
      weaponDamageBonus: Math.round((diminishingStackSum(pools.weaponDmg) + bayYieldBonuses.combatBayBonus) * 1000) / 1000,
      fireCadenceBonus: Math.min(0.45, Math.round(diminishingStackSum(pools.fireCadence) * 1000) / 1000),
      flightSpeedBonus: Math.round(diminishingStackSum(pools.flightSpeed) * 1000) / 1000,
      shieldRegenBonus: Math.round(diminishingStackSum(pools.shieldRegen) * 1000) / 1000,
      powerGridBonusMW: Math.round((diminishingStackSum(pools.powerGridMW) + bayYieldBonuses.powerGridBayBonus) * 10) / 10,
      cpuBonusTF: Math.round(diminishingStackSum(pools.cpuTF) * 10) / 10,
      salvageYieldBonus: Math.round(diminishingStackSum(pools.salvageYield) * 1000) / 1000,
      tradeMarginBonus: Math.min(0.35, Math.round((diminishingStackSum(pools.tradeMargin) + bayYieldBonuses.navTradeBayBonus * 0.5) * 1000) / 1000),
      warpFuelDiscount: Math.min(0.45, Math.round((diminishingStackSum(pools.warpFuelDiscount) + bayYieldBonuses.navTradeBayBonus * 0.5) * 1000) / 1000),
      reputationGainBonus: Math.round(diminishingStackSum(pools.reputationGain) * 1000) / 1000,
      colonyOutputBonus: Math.round(diminishingStackSum(pools.colonyOutput) * 1000) / 1000,
      colonyPopGrowthBonus: Math.round(diminishingStackSum(pools.colonyPopGrowth) * 1000) / 1000,
      hazardResistBonus: Math.min(0.65, Math.round((diminishingStackSum(pools.hazardResist) + bayYieldBonuses.moraleBayBonus * 0.4) * 1000) / 1000),
      grossCycleSalary,
      colonyWageSubsidy,
      netCycleUpkeep,
    };
  }

  /**
   * Lists unclaimed Starport or Colony hiring candidates, deterministically generated.
   */
  public async getHiringMarket(
    accountId: string = 'acc_sol_captain',
    sourceType: 'STARPORT' | 'COLONY' = 'STARPORT',
    sourceId: string = 'PORT_AEGIS_01'
  ): Promise<{ success: boolean; sourceType: string; sourceId: string; refreshNonce: number; candidates: ProceduralCrewCandidate[] }> {
    const [accRes, claimsRes] = await Promise.all([
      db.query<any>('SELECT crew_refresh_nonce FROM accounts WHERE id = $1', [accountId]),
      db.query<any>('SELECT listing_id FROM crew_market_claims WHERE account_id = $1', [accountId]),
    ]);
    const refreshNonce = Number(accRes.rows[0]?.crew_refresh_nonce ?? 0);
    const claimedSet = new Set<string>(claimsRes.rows.map((r) => r.listing_id));
    const candidates: ProceduralCrewCandidate[] = [];

    if (sourceType === 'STARPORT') {
      const portRes = await db.query<any>(
        `SELECT p.id, p.name, p.sector_id, s.controlling_faction
         FROM ports p
         LEFT JOIN sectors s ON p.sector_id = s.id
         WHERE p.id = $1 LIMIT 1`,
        [sourceId]
      );
      const port = portRes.rows[0];
      const factionId = port?.controlling_faction || 'FACTION_SOL';
      const portName = port?.name || sourceId;
      const preferred = PORT_SPECIALTY_AFFINITY[sourceId] || ALL_SPECIALTY_IDS;

      for (let slot = 0; slot < 8; slot++) {
        const listingId = `CREW_MKT_SP_${sourceId}_${refreshNonce}_${slot}`;
        if (claimedSet.has(listingId)) continue;
        const seed = this.hashString(`${accountId}:${listingId}:${port?.sector_id || 1}`);
        candidates.push(
          generateProceduralCrewCandidate({
            listingId,
            seed,
            factionId: slot % 3 === 0 ? undefined : factionId,
            preferredSpecialties: preferred,
            originSource: 'STARPORT',
            originLabel: `${portName} Concourse`,
          })
        );
      }
    } else {
      const colRes = await db.query<any>(
        `SELECT c.id, c.name, c.habitation_tier, c.colony_modules, p.sector_id, p.main_class, p.subtype, s.controlling_faction
         FROM colonies c
         JOIN planets p ON c.planet_id = p.id
         LEFT JOIN sectors s ON p.sector_id = s.id
         WHERE c.id = $1 AND c.account_id = $2 LIMIT 1`,
        [sourceId, accountId]
      );
      const col = colRes.rows[0];
      if (col) {
        const mods = typeof col.colony_modules === 'string' ? JSON.parse(col.colony_modules || '{}') : col.colony_modules || {};
        const modSpecialties: CrewSpecialtyId[] = ['Settler', 'Miner', 'Geologist'];
        for (const mDef of COLONY_MODULES) {
          if (Number(mods[mDef.key] || 0) > 0) {
            modSpecialties.push(...mDef.acceptedSpecialties);
          }
        }
        const applicantCount = Math.min(4, 1 + Number(col.habitation_tier || 1));
        for (let slot = 0; slot < applicantCount; slot++) {
          const listingId = `CREW_MKT_COL_${col.id}_${refreshNonce}_${slot}`;
          if (claimedSet.has(listingId)) continue;
          const seed = this.hashString(`${accountId}:${listingId}`);
          candidates.push(
            generateProceduralCrewCandidate({
              listingId,
              seed,
              factionId: col.controlling_faction || 'FACTION_SOL',
              preferredSpecialties: modSpecialties,
              originSource: 'COLONY',
              originLabel: `${col.name} Settlement Hall`,
              discountMultiplier: 0.85,
            })
          );
        }
      }
    }

    return {
      success: true,
      sourceType,
      sourceId,
      refreshNonce,
      candidates,
    };
  }

  /**
   * Refreshes procedural Starport/Colony hiring applicants (costs 60 Cr + 1 AP).
   */
  public async refreshHiringMarket(accountId: string = 'acc_sol_captain'): Promise<{ success: boolean; refreshNonce: number; credits: number }> {
    const cost = 60;
    const accRes = await db.query<any>('SELECT credits, crew_refresh_nonce FROM accounts WHERE id = $1', [accountId]);
    const credits = Number(accRes.rows[0]?.credits ?? 0);
    if (credits < cost) {
      throw new Error(`INSUFFICIENT_CREDITS: Refreshing applicant rosters costs ${cost} Cr.`);
    }
    const apRes = await apService.deductAP(accountId, 1, 'Crew Concourse Roster Refresh');
    if (!apRes.success) {
      throw new Error(apRes.error || 'INSUFFICIENT_AP');
    }

    const nextNonce = Number(accRes.rows[0]?.crew_refresh_nonce ?? 0) + 1;
    await db.query('UPDATE accounts SET credits = credits - $1, crew_refresh_nonce = $2 WHERE id = $3', [
      cost,
      nextNonce,
      accountId,
    ]);
    return { success: true, refreshNonce: nextNonce, credits: credits - cost };
  }

  /**
   * Hires a procedural applicant from a Starport Concourse or Colony Settlement Hall.
   */
  public async hireFromMarket(
    accountId: string,
    listingId: string,
    sourceType: 'STARPORT' | 'COLONY',
    sourceId: string
  ): Promise<{ success: boolean; crewMember: CrewMemberRecord; remainingCredits: number }> {
    const market = await this.getHiringMarket(accountId, sourceType, sourceId);
    const candidate = market.candidates.find((c) => c.listingId === listingId);
    if (!candidate) {
      throw new Error(`LISTING_UNAVAILABLE: Candidate ${listingId} has already been hired or expired.`);
    }

    const accRes = await db.query<any>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = Number(accRes.rows[0]?.credits ?? 0);
    if (credits < candidate.hiringFee) {
      throw new Error(`INSUFFICIENT_CREDITS: Hiring ${candidate.name} requires ${candidate.hiringFee} Cr.`);
    }

    const remainingCredits = credits - candidate.hiringFee;
    await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [remainingCredits, accountId]);
    await db.query(
      'INSERT INTO crew_market_claims (account_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [accountId, listingId]
    );

    const crewMember = await this.insertCrewMember(accountId, candidate);
    return { success: true, crewMember, remainingCredits };
  }

  /**
   * Directly enrolls an encounter-sourced crew member (Castaway Rescue Pod or Alien Captain Defector/Contractor).
   */
  public async enrollEncounterCrew(accountId: string, candidate: ProceduralCrewCandidate): Promise<CrewMemberRecord> {
    return this.insertCrewMember(accountId, candidate, 100);
  }

  /**
   * Re-enrolls a survivor ejected from a destroyed planetary lander cryo-pod, preserving all veteran stats.
   */
  public async enrollPreservedCrew(accountId: string, snap: any, moraleOverride: number = 55): Promise<CrewMemberRecord> {
    const baseSpec = (Array.isArray(snap.specialties) && snap.specialties.length > 0 ? snap.specialties : ['Pilot']) as CrewSpecialtyId[];
    const primary = (snap.primarySpecialty || baseSpec[0]) as CrewSpecialtyId;
    const candidate: ProceduralCrewCandidate = {
      listingId: `EJECT_${snap.id || Date.now()}`,
      seed: Number(snap.seed || 7777),
      name: String(snap.name || 'Recovered Specialist'),
      callsign: String(snap.callsign || 'POD-1'),
      factionId: (snap.factionId || 'FACTION_SOL') as any,
      factionName: String(snap.factionName || 'Sol Directorate'),
      species: String(snap.species || 'Sol Terran'),
      age: Number(snap.age || 32),
      rarity: (snap.rarity || 'COMMON') as CrewRarity,
      primarySpecialty: primary,
      specialties: baseSpec,
      aptitude: Number(snap.aptitude || 60),
      grit: Number(snap.grit || 65),
      efficiency: Number(snap.efficiency || 60),
      traitId: String(snap.traitId || 'STALWART'),
      traitLabel: String(snap.traitLabel || 'Crash Survivor'),
      traitDesc: String(snap.traitDesc || 'Survived an emergency planetary ejection.'),
      baseSalary: Number(snap.baseSalary || 20),
      hiringFee: Number(snap.hiringFee || 200),
      marketValue: Number(snap.marketValue || 220),
      originSource: 'RESCUE_POD',
      originLabel: String(snap.originLabel || 'Emergency Lander Ejection Pod'),
      bio: String(snap.bio || 'Rescued from orbital cryo-ejection following surface lander loss.'),
    };
    return this.insertCrewMember(accountId, candidate, moraleOverride);
  }

  public async getCrewCasualties(accountId: string = 'acc_sol_captain'): Promise<any[]> {
    const { rows } = await db.query<any>(
      `SELECT id, crew_name, callsign, rarity, specialties, aptitude, grit, planet_id, planet_name, lander_name, outcome, created_at
       FROM crew_casualties
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [accountId]
    );
    return rows.map((r) => ({
      id: r.id,
      crewName: r.crew_name,
      callsign: r.callsign,
      rarity: r.rarity,
      specialties: typeof r.specialties === 'string' ? JSON.parse(r.specialties) : r.specialties || [],
      aptitude: Number(r.aptitude),
      grit: Number(r.grit),
      planetId: r.planet_id,
      planetName: r.planet_name,
      landerName: r.lander_name,
      outcome: r.outcome,
      createdAt: r.created_at,
    }));
  }

  private async insertCrewMember(accountId: string, candidate: ProceduralCrewCandidate, morale: number = 100): Promise<CrewMemberRecord> {
    const id = `crew_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const { rows } = await db.query<any>(
      `INSERT INTO crew_roster (
        id, account_id, seed, name, callsign, faction_id, species, age, rarity,
        primary_specialty, specialties, aptitude, grit, efficiency,
        trait_id, trait_label, trait_desc, morale, base_salary, hiring_fee, market_value,
        assignment_type, origin_source, origin_label, bio
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11::jsonb, $12, $13, $14,
        $15, $16, $17, $24, $18, $19, $20,
        'RESERVE', $21, $22, $23
      ) RETURNING *`,
      [
        id,
        accountId,
        candidate.seed,
        candidate.name,
        candidate.callsign,
        candidate.factionId,
        candidate.species,
        candidate.age,
        candidate.rarity,
        candidate.primarySpecialty,
        JSON.stringify(candidate.specialties),
        candidate.aptitude,
        candidate.grit,
        candidate.efficiency,
        candidate.traitId,
        candidate.traitLabel,
        candidate.traitDesc,
        candidate.baseSalary,
        candidate.hiringFee,
        candidate.marketValue,
        candidate.originSource,
        candidate.originLabel,
        candidate.bio,
        morale,
      ]
    );

    const r = rows[0];
    return {
      id: r.id,
      accountId: r.account_id,
      seed: Number(r.seed),
      name: r.name,
      callsign: r.callsign,
      factionId: r.faction_id,
      species: r.species,
      age: Number(r.age),
      rarity: r.rarity,
      primarySpecialty: r.primary_specialty,
      specialties: candidate.specialties,
      aptitude: Number(r.aptitude),
      grit: Number(r.grit),
      efficiency: Number(r.efficiency),
      traitId: r.trait_id,
      traitLabel: r.trait_label,
      traitDesc: r.trait_desc,
      morale: Number(r.morale),
      baseSalary: Number(r.base_salary),
      hiringFee: Number(r.hiring_fee),
      marketValue: Number(r.market_value),
      resaleValue: Math.round(Number(r.market_value) * 0.65),
      assignmentType: 'RESERVE',
      assignedBaySlot: null,
      assignedColonyId: null,
      assignedModuleKey: null,
      originSource: r.origin_source,
      originLabel: r.origin_label,
      cyclesServed: 0,
      bio: r.bio,
      createdAt: r.created_at,
    };
  }

  /**
   * Assigns a crew member to a Ship Bay Station, a Colony (optionally targeting a module), or returns to Reserve.
   */
  public async assignCrew(
    accountId: string,
    crewId: string,
    assignment: {
      assignmentType: 'RESERVE' | 'SHIP_BAY' | 'COLONY' | 'LANDER';
      baySlotKey?: string;
      colonyId?: string;
      moduleKey?: string;
    }
  ): Promise<CrewRosterOverview> {
    const crewRes = await db.query<any>('SELECT * FROM crew_roster WHERE id = $1 AND account_id = $2', [crewId, accountId]);
    if (crewRes.rows.length === 0) {
      throw new Error(`CREW_NOT_FOUND: Crew member ${crewId} does not belong to ${accountId}.`);
    }
    const member = crewRes.rows[0];
    const specialties: CrewSpecialtyId[] = Array.isArray(member.specialties)
      ? member.specialties
      : JSON.parse(member.specialties || '[]');

    if (assignment.assignmentType === 'RESERVE') {
      await db.query(
        `UPDATE crew_roster
         SET assignment_type = 'RESERVE', assigned_bay_slot = NULL, assigned_colony_id = NULL, assigned_module_key = NULL, updated_at = NOW()
         WHERE id = $1`,
        [crewId]
      );
      return this.getRosterSummary(accountId);
    }

    if (assignment.assignmentType === 'SHIP_BAY') {
      const baySlotKey = assignment.baySlotKey;
      if (!baySlotKey) {
        throw new Error('INVALID_STATION: baySlotKey (e.g. BRIDGE#1 or B1#1) is required for SHIP_BAY assignment.');
      }
      const stationData = await this.getShipStations(accountId);
      const targetStation = stationData.stations.find((s) => s.slotKey === baySlotKey);
      if (!targetStation) {
        throw new Error(`STATION_NOT_UNLOCKED: Ship Station ${baySlotKey} is not active on your current ship/bays.`);
      }

      if (targetStation.acceptedSpecialties !== 'ANY') {
        const matches = specialties.some((sp) => (targetStation.acceptedSpecialties as CrewSpecialtyId[]).includes(sp));
        if (!matches) {
          throw new Error(
            `SPECIALTY_MISMATCH_FOR_BAY: ${targetStation.bayName} requires one of [${(targetStation.acceptedSpecialties as CrewSpecialtyId[]).join(', ')}]. ${member.name} has [${specialties.join(', ')}].`
          );
        }
      }

      // Free the slot if currently occupied
      await db.query(
        `UPDATE crew_roster
         SET assignment_type = 'RESERVE', assigned_bay_slot = NULL, updated_at = NOW()
         WHERE account_id = $1 AND assignment_type = 'SHIP_BAY' AND assigned_bay_slot = $2 AND id <> $3`,
        [accountId, baySlotKey, crewId]
      );

      await db.query(
        `UPDATE crew_roster
         SET assignment_type = 'SHIP_BAY', assigned_bay_slot = $1, assigned_colony_id = NULL, assigned_module_key = NULL, updated_at = NOW()
         WHERE id = $2`,
        [baySlotKey, crewId]
      );
      return this.getRosterSummary(accountId);
    }

    // COLONY assignment
    if (!assignment.colonyId) {
      throw new Error('COLONY_ID_REQUIRED: colonyId is required for COLONY stationing.');
    }
    const colCheck = await db.query('SELECT id FROM colonies WHERE id = $1 AND account_id = $2', [
      assignment.colonyId,
      accountId,
    ]);
    if (colCheck.rows.length === 0) {
      throw new Error(`COLONY_NOT_FOUND: Colony ${assignment.colonyId} not owned by ${accountId}.`);
    }

    await db.query(
      `UPDATE crew_roster
       SET assignment_type = 'COLONY', assigned_bay_slot = NULL, assigned_colony_id = $1, assigned_module_key = $2, updated_at = NOW()
       WHERE id = $3`,
      [assignment.colonyId, assignment.moduleKey || null, crewId]
    );
    return this.getRosterSummary(accountId);
  }

  /**
   * Contract Reselling / Brokerage at a Starport Exchange: releases contract & pays back 65%-88% market value.
   */
  public async brokerCrewContract(
    accountId: string,
    crewId: string
  ): Promise<{ success: boolean; releasedName: string; payoutCredits: number; remainingCredits: number }> {
    const overview = await this.getRosterSummary(accountId);
    const target = overview.crew.find((c) => c.id === crewId);
    if (!target) {
      throw new Error(`CREW_NOT_FOUND: Crew contract ${crewId} not found on roster.`);
    }

    const payoutCredits = target.resaleValue;
    await db.query('DELETE FROM crew_roster WHERE id = $1 AND account_id = $2', [crewId, accountId]);
    await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [payoutCredits, accountId]);

    const accRes = await db.query<any>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    return {
      success: true,
      releasedName: target.name,
      payoutCredits,
      remainingCredits: Number(accRes.rows[0]?.credits ?? overview.credits + payoutCredits),
    };
  }

  /**
   * Settles one salary/subsidy cycle across all hired crew, updating morale & arrears state.
   */
  public async settleSalaryCycle(accountId: string = 'acc_sol_captain'): Promise<{
    success: boolean;
    grossSalary: number;
    colonySubsidy: number;
    netPaid: number;
    paidInFull: boolean;
    arrearsCycles: number;
    remainingCredits: number;
  }> {
    const overview = await this.getRosterSummary(accountId);
    const { grossCycleSalary, colonyWageSubsidy, netCycleUpkeep } = overview.bonuses;

    if (overview.crew.length === 0) {
      return {
        success: true,
        grossSalary: 0,
        colonySubsidy: 0,
        netPaid: 0,
        paidInFull: true,
        arrearsCycles: 0,
        remainingCredits: overview.credits,
      };
    }

    let paidInFull = true;
    let newCredits = overview.credits;
    let nextArrears = overview.arrearsCycles;

    if (netCycleUpkeep > 0) {
      if (overview.credits >= netCycleUpkeep) {
        newCredits = overview.credits - netCycleUpkeep;
        nextArrears = 0;
        await db.query('UPDATE accounts SET credits = $1, crew_arrears_cycles = 0 WHERE id = $2', [
          newCredits,
          accountId,
        ]);
      } else {
        paidInFull = false;
        nextArrears = overview.arrearsCycles + 1;
        await db.query('UPDATE accounts SET crew_arrears_cycles = $1 WHERE id = $2', [nextArrears, accountId]);
      }
    } else {
      nextArrears = 0;
      await db.query('UPDATE accounts SET crew_arrears_cycles = 0 WHERE id = $1', [accountId]);
    }

    for (const c of overview.crew) {
      let nextMorale = c.morale;
      if (paidInFull) {
        nextMorale = Math.min(100, c.morale + 10);
      } else {
        const penalty = c.traitId === 'IRON_DISCIPLINE' ? 9 : 18;
        nextMorale = Math.max(5, c.morale - penalty);
      }
      await db.query(
        'UPDATE crew_roster SET morale = $1, cycles_served = cycles_served + 1, updated_at = NOW() WHERE id = $2',
        [nextMorale, c.id]
      );
    }

    return {
      success: true,
      grossSalary: grossCycleSalary,
      colonySubsidy: colonyWageSubsidy,
      netPaid: paidInFull ? netCycleUpkeep : 0,
      paidInFull,
      arrearsCycles: nextArrears,
      remainingCredits: newCredits,
    };
  }

  /**
   * Returns distinct stationed crew at a colony holding any of the accepted Specialties.
   */
  public async getMatchingColonyCrewCount(
    accountId: string,
    colonyId: string,
    acceptedSpecialties: readonly CrewSpecialtyId[]
  ): Promise<{ count: number; crew: CrewMemberRecord[] }> {
    const overview = await this.getRosterSummary(accountId);
    const matching = overview.crew.filter(
      (c) =>
        c.assignmentType === 'COLONY' &&
        c.assignedColonyId === colonyId &&
        c.morale >= 20 &&
        c.specialties.some((sp) => acceptedSpecialties.includes(sp))
    );
    return { count: matching.length, crew: matching };
  }

  /**
   * Debug helper for deterministic test resets & regression setup.
   */
  public async debugSeedOfficer(
    accountId: string,
    opts: {
      specialties: CrewSpecialtyId[];
      rarity?: CrewRarity;
      aptitude?: number;
      grit?: number;
      assignColonyId?: string;
      assignBaySlot?: string;
      name?: string;
    }
  ): Promise<CrewMemberRecord> {
    const rarity = opts.rarity || (opts.specialties.length >= 3 ? 'RARE' : opts.specialties.length === 2 ? 'UNCOMMON' : 'COMMON');
    const id = `crew_dbg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const aptitude = opts.aptitude ?? 78;
    const grit = opts.grit ?? 74;
    const primary = opts.specialties[0];
    const assignType = opts.assignColonyId ? 'COLONY' : opts.assignBaySlot ? 'SHIP_BAY' : 'RESERVE';

    await db.query(
      `INSERT INTO crew_roster (
        id, account_id, seed, name, callsign, faction_id, species, age, rarity,
        primary_specialty, specialties, aptitude, grit, efficiency,
        trait_id, trait_label, trait_desc, morale, base_salary, hiring_fee, market_value,
        assignment_type, assigned_bay_slot, assigned_colony_id, origin_source, origin_label, bio
      ) VALUES (
        $1, $2, 77777, $3, $4, 'FACTION_SOL', 'Sol Terran', 34, $5,
        $6, $7::jsonb, $8, $12, 76,
        'DEEP_CORE_VETERAN', 'Deep-Core Veteran', '+10% yield.', 100, 18, 220, 220,
        $9, $10, $11, 'STARPORT', 'Sol Commission', 'Commissioned specialist.'
      )`,
      [
        id,
        accountId,
        opts.name || `Specialist ${primary}`,
        `${primary.slice(0, 3).toUpperCase()}-777`,
        rarity,
        primary,
        JSON.stringify(opts.specialties),
        aptitude,
        assignType,
        opts.assignBaySlot || null,
        opts.assignColonyId || null,
        grit,
      ]
    );

    const overview = await this.getRosterSummary(accountId);
    return overview.crew.find((c) => c.id === id)!;
  }

  public async debugClearCrew(accountId: string = 'acc_sol_captain'): Promise<void> {
    await db.query('DELETE FROM crew_roster WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM crew_market_claims WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM crew_casualties WHERE account_id = $1', [accountId]);
    await db.query('UPDATE accounts SET crew_arrears_cycles = 0, crew_refresh_nonce = 0 WHERE id = $1', [accountId]);
  }

  private hashString(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}

export const crewService = new CrewService();

export interface LootAffix {
  stat: 'damage' | 'fireCooldown' | 'muzzleSpeed' | 'shieldCapacity' | 'energyCost' | 'powerGridCost' | 'cpuCost' | 'thrustMultiplier';
  multiplier: number;
  label: string;
}

export interface DroppedModule {
  blueprintId: string;
  name: string;
  customName: string;
  slotType: 'HIGH' | 'MID' | 'LOW';
  mainCategory: string;
  subtype: string;
  techPrefix?: string;
  techSuffix?: string;
  manufacturer: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  powerGridCost: number;
  cpuCost: number;
  basePrice: number;
  baseStats: Record<string, any>;
  affixes: LootAffix[];
  description: string;
}

import {
  TECH_PREFIXES,
  getModuleSubtypeDef,
  mapBlueprintToTaxonomy,
  generateProceduralModule,
} from '../procgen/ProceduralModuleCatalog';

export class LootGenerator {
  private static readonly RARITY_WEIGHTS = [
    { rarity: 'COMMON' as const, weight: 55 },
    { rarity: 'UNCOMMON' as const, weight: 26 },
    { rarity: 'RARE' as const, weight: 12 },
    { rarity: 'EPIC' as const, weight: 5 },
    { rarity: 'LEGENDARY' as const, weight: 2 },
  ];

  public static rollRarity(): 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' {
    const roll = Math.random() * 100;
    let accumulated = 0;
    for (const item of this.RARITY_WEIGHTS) {
      accumulated += item.weight;
      if (roll <= accumulated) {
        return item.rarity;
      }
    }
    return 'COMMON';
  }

  public static generateDrop(blueprints: any[], preferredRarity?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'): DroppedModule {
    if (!blueprints || blueprints.length === 0) {
      throw new Error('No blueprints available to generate loot');
    }

    const bp = blueprints[Math.floor(Math.random() * blueprints.length)];
    const rarity = preferredRarity || this.rollRarity();

    // Map blueprint onto Main Category & Subtype + Semantic Tech Prefix/Suffix
    const mapped = bp.main_category && bp.subtype
      ? { mainCategory: bp.main_category, subtype: bp.subtype }
      : mapBlueprintToTaxonomy(bp.name || '', bp.slot_type || 'HIGH');
    const subDef = getModuleSubtypeDef(mapped.subtype);

    const rarityOrder = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
    const rIdx = rarityOrder.indexOf(rarity);
    const eligiblePrefixes = TECH_PREFIXES.filter((p) => (p.minRarity ? rarityOrder.indexOf(p.minRarity) <= rIdx : true));
    const chosenPrefix = eligiblePrefixes[Math.floor(Math.random() * eligiblePrefixes.length)] || TECH_PREFIXES[0];
    const suffixes = subDef?.compatibleSuffixes || ['Emitter', 'Matrix', 'Processor', 'Generator'];
    const techSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    const customName = `${chosenPrefix.prefix} ${mapped.subtype} ${techSuffix}`.trim();
    const affixes: LootAffix[] = [];

    // Primary prefix-driven mechanical affix + rarity bonus affixes
    let powerGridMultiplier = 1.0;
    let cpuMultiplier = 1.0;
    const scale = rarity === 'COMMON' ? 0.65 : rarity === 'UNCOMMON' ? 1.0 : rarity === 'RARE' ? 1.35 : rarity === 'EPIC' ? 1.75 : 2.25;
    const rawDelta = chosenPrefix.primaryBonusMin + Math.random() * (chosenPrefix.primaryBonusMax - chosenPrefix.primaryBonusMin);
    const pMult = Math.max(0.55, Math.round((1 + rawDelta * scale) * 100) / 100);
    if (pMult !== 1.0) {
      const pct = Math.round((pMult - 1) * 100);
      affixes.push({
        stat: chosenPrefix.primaryStat,
        multiplier: pMult,
        label: `${pct >= 0 ? '+' : ''}${pct}% ${chosenPrefix.primaryStat.toUpperCase()}`,
      });
      if (chosenPrefix.primaryStat === 'powerGridCost') powerGridMultiplier *= pMult;
      if (chosenPrefix.primaryStat === 'cpuCost') cpuMultiplier *= pMult;
    }

    const affixCount = rarity === 'COMMON' ? 0 : rarity === 'UNCOMMON' ? 1 : rarity === 'RARE' ? 2 : rarity === 'EPIC' ? 3 : 4;
    const possibleStats: Array<'damage' | 'muzzleSpeed' | 'shieldCapacity' | 'energyCost' | 'powerGridCost' | 'cpuCost'> = [
      'damage',
      'muzzleSpeed',
      'shieldCapacity',
      'energyCost',
      'powerGridCost',
      'cpuCost',
    ];

    for (let i = 0; i < affixCount; i++) {
      const stat = possibleStats[Math.floor(Math.random() * possibleStats.length)];
      let mult = 1.0;
      let label = '';

      if (stat === 'damage' || stat === 'shieldCapacity' || stat === 'muzzleSpeed') {
        const bonusPct = rarity === 'UNCOMMON' ? 0.08 + Math.random() * 0.07 :
                         rarity === 'RARE' ? 0.15 + Math.random() * 0.13 :
                         rarity === 'EPIC' ? 0.28 + Math.random() * 0.17 :
                         0.45 + Math.random() * 0.25;
        mult = Math.round((1 + bonusPct) * 100) / 100;
        label = `+${Math.round(bonusPct * 100)}% ${stat.toUpperCase()}`;
      } else {
        const redPct = 0.08 + Math.random() * 0.15;
        mult = Math.round((1 - redPct) * 100) / 100;
        label = `-${Math.round(redPct * 100)}% ${stat.toUpperCase()}`;

        if (stat === 'powerGridCost') powerGridMultiplier *= mult;
        if (stat === 'cpuCost') cpuMultiplier *= mult;
      }

      affixes.push({ stat, multiplier: mult, label });
    }

    const pgCost = Math.round(Number(bp.power_grid_cost) * powerGridMultiplier * 10) / 10;
    const cpuCost = Math.round(Number(bp.cpu_cost) * cpuMultiplier * 10) / 10;
    const rarityMultiplier = rarity === 'COMMON' ? 1 : rarity === 'UNCOMMON' ? 1.5 : rarity === 'RARE' ? 2.5 : rarity === 'EPIC' ? 4.5 : 8.0;
    const price = Math.round(Number(bp.base_price || 400) * rarityMultiplier);

    const stats = typeof bp.base_stats === 'string' ? JSON.parse(bp.base_stats) : { ...bp.base_stats };

    return {
      blueprintId: bp.id,
      name: bp.name,
      customName,
      slotType: bp.slot_type,
      manufacturer: bp.manufacturer || 'Independent',
      rarity,
      powerGridCost: pgCost,
      cpuCost,
      basePrice: price,
      baseStats: stats,
      affixes,
      description: `${bp.description || ''} [${chosenPrefix.prefix}: ${chosenPrefix.flavor}]`.trim(),
      mainCategory: mapped.mainCategory,
      subtype: mapped.subtype,
      techPrefix: chosenPrefix.prefix,
      techSuffix,
    };
  }

  public static generateProcedural(opts?: Parameters<typeof generateProceduralModule>[0]) {
    return generateProceduralModule(opts);
  }
}

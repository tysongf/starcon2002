import {
  getModuleSubtypeDef,
  rollModulePrefixAndAffixes,
  generateProceduralModule,
} from '../procgen/ProceduralModuleCatalog';

export interface LootAffix {
  stat: 'damage' | 'fireCooldown' | 'muzzleSpeed' | 'shieldCapacity' | 'energyCost' | 'powerGridCost' | 'cpuCost' | 'thrustMultiplier';
  multiplier: number;
  label: string;
}

export interface DroppedModule {
  blueprintId: string;
  name: string;
  customName: string;
  slotType: 'HIGH' | 'MID' | 'LOW' | 'BAY';
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
      if (roll <= accumulated) return item.rarity;
    }
    return 'COMMON';
  }

  public static generateDrop(
    blueprints: any[],
    preferredRarity?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
  ): DroppedModule {
    if (!blueprints || blueprints.length === 0) {
      throw new Error('No blueprints available to generate loot');
    }

    const bp = blueprints[Math.floor(Math.random() * blueprints.length)];
    const mainCategory = bp.main_category || 'OFFENSE';
    const subtype = bp.subtype || bp.name || 'Laser Turret';
    const subDef = getModuleSubtypeDef(subtype);

    const rolled = rollModulePrefixAndAffixes({
      subtype,
      slotType: bp.slot_type || 'HIGH',
      compatibleSuffixes: subDef?.compatibleSuffixes,
      basePowerGridCost: Number(bp.power_grid_cost || 15),
      baseCpuCost: Number(bp.cpu_cost || 25),
      basePrice: Number(bp.base_price || 400),
      rarity: preferredRarity || this.rollRarity(),
    });

    const stats = typeof bp.base_stats === 'string' ? JSON.parse(bp.base_stats) : { ...bp.base_stats };

    return {
      blueprintId: bp.id,
      name: bp.name,
      customName: rolled.customName,
      slotType: bp.slot_type,
      mainCategory,
      subtype,
      techPrefix: rolled.prefixDef.prefix,
      techSuffix: rolled.techSuffix,
      manufacturer: bp.manufacturer || 'Independent',
      rarity: rolled.rarity,
      powerGridCost: rolled.powerGridCost,
      cpuCost: rolled.cpuCost,
      basePrice: rolled.basePrice,
      baseStats: stats,
      affixes: rolled.affixes,
      description: `${bp.description || ''} [${rolled.prefixDef.prefix}: ${rolled.prefixDef.flavor}]`.trim(),
    };
  }

  public static generateProcedural(opts?: Parameters<typeof generateProceduralModule>[0]) {
    return generateProceduralModule(opts);
  }
}

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
  category: string;
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

  private static readonly PREFIXES: Record<string, string[]> = {
    COMMON: ['Standard', 'Field-Tested', 'Surplus', 'Industrial'],
    UNCOMMON: ['Calibrated', 'Reinforced', 'Overclocked', 'Fine-Tuned'],
    RARE: ['Vanguard', 'Precision', 'High-Output', 'Heavy-Duty'],
    EPIC: ['Void-Forged', 'Prototype', 'Devastating', 'Dark-Matter'],
    LEGENDARY: ['Singularity', 'Axiomatic', 'Annihilator', 'Omega-Class'],
  };

  private static readonly SUFFIXES: string[] = [
    'of Ruin',
    'of the Vanguard',
    'of the Void Expanse',
    'of Hegemony Ordnance',
    'of Overdrive',
    'of the Nexus',
    'of Defiance',
    'of the Eclipse',
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

    const prefixList = this.PREFIXES[rarity] || this.PREFIXES.COMMON;
    const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
    const suffix = rarity === 'COMMON' ? '' : ` ${this.SUFFIXES[Math.floor(Math.random() * this.SUFFIXES.length)]}`;

    const customName = `${prefix} ${bp.name}${suffix}`.trim();
    const affixes: LootAffix[] = [];

    // Affix count based on rarity
    const affixCount = rarity === 'COMMON' ? 0 : rarity === 'UNCOMMON' ? 1 : rarity === 'RARE' ? 2 : rarity === 'EPIC' ? 3 : 4;
    const possibleStats: Array<'damage' | 'muzzleSpeed' | 'shieldCapacity' | 'energyCost' | 'powerGridCost' | 'cpuCost'> = [
      'damage',
      'muzzleSpeed',
      'shieldCapacity',
      'energyCost',
      'powerGridCost',
      'cpuCost',
    ];

    let powerGridMultiplier = 1.0;
    let cpuMultiplier = 1.0;

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
        // Cost reduction
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
      category: bp.category,
      manufacturer: bp.manufacturer || 'Independent',
      rarity,
      powerGridCost: pgCost,
      cpuCost,
      basePrice: price,
      baseStats: stats,
      affixes,
      description: bp.description || '',
    };
  }
}

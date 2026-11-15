/**
 * Milestone 1.7: Outpost Multi-Layer Colony Grid Engine
 * Manages 4x12x12 terrain generation, 3D BFS Tube/Shaft connectivity,
 * real-time construction timers, and deterministic Power/O2/Worker simulation.
 */

import { db } from '../db/Database';
import {
  OUTPOST_BUILDINGS,
  getOutpostBuildingDef,
  type BuildingTypeId,
  type OutpostLayer,
  type TerrainType,
} from '../procgen/OutpostCatalog';
import {
  getColonyModuleUpgradeRequirement,
  type ColonyModuleKey,
} from '../procgen/CrewCatalog';
import { crewService } from './CrewService';

export interface OutpostGridTile {
  id: string;
  colonyId: string;
  layer: OutpostLayer;
  x: number;
  y: number;
  terrainType: TerrainType;
  buildingType: BuildingTypeId | null;
  status: 'CONSTRUCTING' | 'ACTIVE' | 'OFFLINE';
  isConnected: boolean;
  isPowered: boolean;
  buildStartedAt: string | null;
  buildCompleteAt: string | null;
  remainingBuildSec: number;
}

export interface OutpostGridTelemetry {
  powerGeneratedMW: number;
  powerConsumedMW: number;
  gridEfficiency: number;
  o2Generated: number;
  o2Consumed: number;
  workersRequired: number;
  workersAvailable: number;
  workerEfficiency: number;
  morale: number;
  maxPopulation: number;
  siloCapacity: number;
  baseExtractionPerMin: number;
  extractionMultiplier: number;
  terraformRatePerSec: number;
  shipyardTier: number;
  derrickTier: number;
  habitationTier: number;
  terraformerTier: number;
  siloTier: number;
  activeBuildingsCount: number;
  constructingCount: number;
  unlinkedCount: number;
  colonyModules: Record<ColonyModuleKey, number>;
}

const GRID_SIZE = 12;
const ROOT_X = 5;
const ROOT_Y = 5;

function hashCoord(seedStr: string, layer: number, x: number, y: number): number {
  let h = 2166136261 ^ ((layer + 7) * 73856093) ^ (x * 19349663) ^ (y * 83492791);
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rollTerrain(seedStr: string, mainClass: string, layer: OutpostLayer, x: number, y: number): TerrainType {
  // Keep starter footprint & access corridors buildable and clean
  if (layer === 0 && Math.abs(x - ROOT_X) <= 1 && Math.abs(y - ROOT_Y) <= 1) return 'FLAT';
  if (layer === -1 && Math.abs(x - ROOT_X) <= 1 && Math.abs(y - ROOT_Y) <= 1) return 'BEDROCK';

  const r = (hashCoord(seedStr, layer, x, y) % 1000) / 1000;
  const isVolcanic = mainClass === 'VOLCANIC' || mainClass === 'INFERNO';
  const isCryo = mainClass === 'ICE_WORLD' || mainClass === 'FROZEN';
  const isMetallic = mainClass === 'METALLIC_ORE' || mainClass === 'ASTEROID_BELT';

  if (layer === 0) {
    if (r < (isVolcanic ? 0.10 : 0.04)) return 'GEO_VENT';
    if (r < (isVolcanic ? 0.20 : 0.14)) return 'CRATER';
    if (r > (isCryo ? 0.86 : 0.93)) return 'WATER_POCKET';
    return 'FLAT';
  }

  if (layer === -1) {
    if (r < (isMetallic ? 0.24 : 0.16)) return 'ORE_SEAM_L1';
    if (r > 0.92) return 'GEO_VENT';
    return 'BEDROCK';
  }

  if (layer === -2) {
    if (r < 0.18) return 'RARE_SEAM_L2';
    if (r < (isCryo ? 0.34 : 0.26)) return 'WATER_POCKET';
    if (r > 0.93) return 'DEEP_GEO_VENT';
    return 'BEDROCK';
  }

  // Layer -3 (Deep Core)
  if (r < (isMetallic ? 0.26 : 0.18)) return 'DEEP_SEAM_L3';
  if (r > (isVolcanic ? 0.80 : 0.88)) return 'DEEP_GEO_VENT';
  return 'BEDROCK';
}

export class OutpostGridService {
  /**
   * Ensures a 4x12x12 Outpost grid exists for a colony, initializing deterministic terrain & starter core.
   */
  public async ensureGridInitialized(colonyId: string, planetId?: string): Promise<void> {
    const existing = await db.query<{ cnt: string }>(
      'SELECT COUNT(*)::text AS cnt FROM colony_grid_tiles WHERE colony_id = $1',
      [colonyId]
    );
    if (Number(existing.rows[0]?.cnt || 0) > 0) return;

    let mainClass = 'METALLIC_ORE';
    if (planetId) {
      const pRes = await db.query<{ main_class: string }>('SELECT main_class FROM planets WHERE id = $1', [planetId]);
      mainClass = pRes.rows[0]?.main_class || mainClass;
    } else {
      const cRes = await db.query<{ main_class: string }>(
        'SELECT p.main_class FROM colonies c JOIN planets p ON c.planet_id = p.id WHERE c.id = $1',
        [colonyId]
      );
      mainClass = cRes.rows[0]?.main_class || mainClass;
    }

    const seedStr = `${colonyId}_${planetId || 'planet'}`;
    const layers: OutpostLayer[] = [0, -1, -2, -3];

    // Starter buildings: Command Core at (0,5,5), Solar (0,6,5), Agridome (0,5,6), Access Shaft (0,4,5)->(-1,4,5), Ore Mine (-1,5,5)
    const starterMap = new Map<string, BuildingTypeId>([
      ['0:5:5', 'COMMAND_HUB'],
      ['0:6:5', 'SOLAR_ARRAY'],
      ['0:5:6', 'AGRIDOME'],
      ['0:4:5', 'ACCESS_SHAFT'],
      ['-1:4:5', 'ACCESS_SHAFT'],
      ['-1:5:5', 'ORE_MINE_L1'],
    ]);

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const layer of layers) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const key = `${layer}:${x}:${y}`;
          const building = starterMap.get(key) || null;
          const terrain = rollTerrain(seedStr, mainClass, layer, x, y);
          const id = `tile_${colonyId}_${layer}_${x}_${y}`;
          placeholders.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'ACTIVE', TRUE, TRUE)`
          );
          values.push(id, colonyId, layer, x, y, terrain, building);
        }
      }
    }

    await db.query(
      `INSERT INTO colony_grid_tiles (
         id, colony_id, layer, x, y, terrain_type, building_type, status, is_connected, is_powered
       ) VALUES ${placeholders.join(', ')}
       ON CONFLICT (colony_id, layer, x, y) DO NOTHING`,
      values
    );
  }

  /**
   * Evaluates completed timers, 3D BFS tube/shaft connectivity from (0,5,5),
   * and deterministic Power/O2/Worker/Module telemetry directly from grid tiles.
   */
  public async evaluateGridSimulation(
    colonyId: string,
    populationOverride?: number
  ): Promise<{ tiles: OutpostGridTile[]; telemetry: OutpostGridTelemetry }> {
    await this.ensureGridInitialized(colonyId);

    // 1. Transition finished construction jobs -> ACTIVE
    await db.query(
      `UPDATE colony_grid_tiles
       SET status = 'ACTIVE', build_complete_at = NULL, updated_at = NOW()
       WHERE colony_id = $1 AND status = 'CONSTRUCTING' AND build_complete_at <= NOW()`,
      [colonyId]
    );

    const [tileRes, colRes] = await Promise.all([
      db.query<any>(
        `SELECT * FROM colony_grid_tiles WHERE colony_id = $1 ORDER BY layer DESC, y ASC, x ASC`,
        [colonyId]
      ),
      db.query<any>(
        `SELECT population, colony_modules FROM colonies WHERE id = $1`,
        [colonyId]
      ),
    ]);

    const population = populationOverride ?? Number(colRes.rows[0]?.population || 120);
    const tileMap = new Map<string, any>();
    for (const r of tileRes.rows) {
      tileMap.set(`${r.layer}:${r.x}:${r.y}`, r);
    }

    // 2. 3D BFS connectivity starting from Command Hub at (0, 5, 5)
    const connectedKeys = new Set<string>();
    const queue: Array<{ layer: number; x: number; y: number }> = [];
    const rootKey = `0:${ROOT_X}:${ROOT_Y}`;
    const rootRow = tileMap.get(rootKey);
    if (rootRow && rootRow.building_type && rootRow.status === 'ACTIVE') {
      connectedKeys.add(rootKey);
      queue.push({ layer: 0, x: ROOT_X, y: ROOT_Y });
    }

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curRow = tileMap.get(`${cur.layer}:${cur.x}:${cur.y}`);

      // Cardinal horizontal tube/building neighbors
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        const nKey = `${cur.layer}:${nx}:${ny}`;
        if (connectedKeys.has(nKey)) continue;
        const nRow = tileMap.get(nKey);
        if (nRow && nRow.building_type && nRow.status === 'ACTIVE') {
          connectedKeys.add(nKey);
          queue.push({ layer: cur.layer, x: nx, y: ny });
        }
      }

      // Vertical Access Shaft linkage across adjacent depth layers at same (x, y)
      if (curRow?.building_type === 'ACCESS_SHAFT') {
        for (const dl of [-1, 1]) {
          const nl = cur.layer + dl;
          if (nl < -3 || nl > 0) continue;
          const vKey = `${nl}:${cur.x}:${cur.y}`;
          if (connectedKeys.has(vKey)) continue;
          const vRow = tileMap.get(vKey);
          if (vRow && vRow.building_type === 'ACCESS_SHAFT' && vRow.status === 'ACTIVE') {
            connectedKeys.add(vKey);
            queue.push({ layer: nl, x: cur.x, y: cur.y });
          }
        }
      }
    }

    // 3. Persist changed connection flags & accumulate raw telemetry
    const nowMs = Date.now();
    let powerGeneratedMW = 0;
    let powerConsumedMW = 0;
    let o2Generated = 0;
    const o2Consumed = Math.max(1, Math.ceil(population / 12));
    let workersRequired = 0;
    let maxPopulation = 0;
    let siloCapacity = 0;
    let baseExtractionPerMin = 0;
    let extractionMultBonus = 0;
    let terraformRatePerSec = 0;
    let moraleBonusSum = 0;

    let mineCount = 0;
    let residenceCount = 0;
    let warehouseCount = 0;
    let atmosCount = 0;
    let gantryCount = 0;
    let activeBuildingsCount = 0;
    let constructingCount = 0;
    let unlinkedCount = 0;

    const moduleCounts: Record<ColonyModuleKey, number> = {
      RESEARCH_INSTITUTE: 0,
      ORE_REFINERY: 0,
      COLONIAL_MEDBAY: 0,
      TRADE_EXCHANGE: 0,
      FRONTIER_GARRISON: 0,
      DIPLOMATIC_CONSULATE: 0,
      ASTRO_OBSERVATORY: 0,
      ARCH_EXCAVATION: 0,
    };

    // Preserve higher manually upgraded module tiers if any beyond placed count? No: strictly sync from active connected tiles!
    const toUpdateConn: Array<{ id: string; isConnected: boolean }> = [];

    const tiles: OutpostGridTile[] = tileRes.rows.map((r) => {
      const k = `${r.layer}:${r.x}:${r.y}`;
      const isConnected = !!r.building_type && r.status === 'ACTIVE' && connectedKeys.has(k);
      if (Boolean(r.is_connected) !== isConnected) {
        toUpdateConn.push({ id: r.id, isConnected });
      }

      if (r.building_type) {
        if (r.status === 'CONSTRUCTING') constructingCount++;
        else if (r.status === 'ACTIVE') {
          activeBuildingsCount++;
          if (!isConnected) unlinkedCount++;
        }
      }

      const def = getOutpostBuildingDef(r.building_type);
      if (def && r.status === 'ACTIVE' && isConnected) {
        // Terrain multipliers
        let mwDelta = def.powerDeltaMW;
        if (def.id === 'GEOTHERMAL_PLANT' && (r.terrain_type === 'GEO_VENT' || r.terrain_type === 'DEEP_GEO_VENT')) {
          mwDelta = Math.round(mwDelta * 2.0);
        }
        if (mwDelta >= 0) powerGeneratedMW += mwDelta;
        else powerConsumedMW += Math.abs(mwDelta);

        let o2Delta = def.o2Delta;
        if (def.id === 'AGRIDOME' && r.terrain_type === 'WATER_POCKET') {
          o2Delta = Math.round(o2Delta * 1.35);
        }
        if (o2Delta >= 0) o2Generated += o2Delta;

        workersRequired += def.workersRequired;
        maxPopulation += def.popCapacityBonus;
        siloCapacity += def.siloCapacityBonus;
        terraformRatePerSec += def.terraformRateBonus * 0.008;
        moraleBonusSum += def.moraleBonus;

        // Extraction terrain seam multipliers
        let extRate = def.extractionRateBase;
        if (def.id === 'ORE_MINE_L1' && r.terrain_type === 'ORE_SEAM_L1') extRate *= 1.75;
        else if (def.id === 'DEEP_CORE_EXTRACTOR' && (r.terrain_type === 'RARE_SEAM_L2' || r.terrain_type === 'DEEP_SEAM_L3')) {
          extRate *= 1.85;
        } else if (def.id === 'ARCH_EXCAVATION' && r.terrain_type === 'DEEP_SEAM_L3') {
          extRate *= 1.25;
        }
        baseExtractionPerMin += extRate;
        extractionMultBonus += def.extractionMultBonus;

        if (def.id === 'ORE_MINE_L1' || def.id === 'DEEP_CORE_EXTRACTOR') mineCount++;
        if (def.id === 'UNDERGROUND_RESIDENCE') residenceCount++;
        if (def.id === 'STORAGE_WAREHOUSE') warehouseCount++;
        if (def.id === 'ATMOS_PROCESSOR') atmosCount++;
        if (def.id === 'SPACEPORT_GANTRY') gantryCount++;

        if (def.mappedModuleKey) {
          moduleCounts[def.mappedModuleKey] = Math.min(3, (moduleCounts[def.mappedModuleKey] || 0) + 1);
        }
      }

      const completeMs = r.build_complete_at ? new Date(r.build_complete_at).getTime() : 0;
      const remSec = r.status === 'CONSTRUCTING' && completeMs > nowMs ? Math.ceil((completeMs - nowMs) / 1000) : 0;

      return {
        id: r.id,
        colonyId: r.colony_id,
        layer: Number(r.layer) as OutpostLayer,
        x: Number(r.x),
        y: Number(r.y),
        terrainType: r.terrain_type as TerrainType,
        buildingType: (r.building_type || null) as BuildingTypeId | null,
        status: (r.status || 'ACTIVE') as 'CONSTRUCTING' | 'ACTIVE' | 'OFFLINE',
        isConnected,
        isPowered: powerGeneratedMW >= powerConsumedMW,
        buildStartedAt: r.build_started_at ? new Date(r.build_started_at).toISOString() : null,
        buildCompleteAt: r.build_complete_at ? new Date(r.build_complete_at).toISOString() : null,
        remainingBuildSec: remSec,
      };
    });

    if (toUpdateConn.length > 0) {
      for (const u of toUpdateConn) {
        await db.query('UPDATE colony_grid_tiles SET is_connected = $1 WHERE id = $2', [u.isConnected, u.id]);
      }
    }

    const gridEfficiency =
      powerConsumedMW <= 0 || powerGeneratedMW >= powerConsumedMW
        ? 1.0
        : Math.max(0.15, Math.min(1.0, Number((powerGeneratedMW / powerConsumedMW).toFixed(3))));
    const workerEfficiency =
      workersRequired <= 0 || population >= workersRequired
        ? 1.0
        : Math.max(0.25, Math.min(1.0, Number((population / workersRequired).toFixed(3))));

    const brownoutPenalty = powerGeneratedMW < powerConsumedMW ? 18 : 0;
    const o2Penalty = o2Generated < o2Consumed ? 28 : 0;
    const morale = Math.max(5, Math.min(100, 70 + moraleBonusSum - brownoutPenalty - o2Penalty));

    // Mark tile powered state cleanly in memory
    const hasBrownout = powerGeneratedMW < powerConsumedMW;
    if (hasBrownout) {
      for (const t of tiles) {
        t.isPowered = t.isConnected && (t.buildingType === 'COMMAND_HUB' || !hasBrownout);
      }
    }

    const derrickTier = Math.min(3, Math.max(1, mineCount));
    const habitationTier = Math.min(3, 1 + residenceCount);
    const siloTier = Math.min(3, 1 + warehouseCount);
    const terraformerTier = Math.min(3, 1 + atmosCount);
    const shipyardTier = Math.min(3, gantryCount);

    const telemetry: OutpostGridTelemetry = {
      powerGeneratedMW,
      powerConsumedMW,
      gridEfficiency,
      o2Generated,
      o2Consumed,
      workersRequired,
      workersAvailable: population,
      workerEfficiency,
      morale,
      maxPopulation: Math.max(500, maxPopulation),
      siloCapacity: Math.max(50, siloCapacity),
      baseExtractionPerMin: Number(Math.max(1.0, baseExtractionPerMin).toFixed(2)),
      extractionMultiplier: Number((1 + extractionMultBonus).toFixed(3)),
      terraformRatePerSec: Number(Math.max(0.008, terraformRatePerSec).toFixed(4)),
      shipyardTier,
      derrickTier,
      habitationTier,
      terraformerTier,
      siloTier,
      activeBuildingsCount,
      constructingCount,
      unlinkedCount,
      colonyModules: moduleCounts,
    };

    // Keep colonies table synced to single-source-of-truth grid telemetry
    await db.query(
      `UPDATE colonies
       SET max_population = $1,
           silo_capacity = $2,
           derrick_tier = $3,
           habitation_tier = $4,
           terraformer_tier = $5,
           silo_tier = $6,
           shipyard_tier = $7,
           morale = $8,
           power_generated_mw = $9,
           power_consumed_mw = $10,
           o2_generated = $11,
           o2_consumed = $12,
           grid_efficiency = $13,
           colony_modules = $14::jsonb
       WHERE id = $15`,
      [
        telemetry.maxPopulation,
        telemetry.siloCapacity,
        telemetry.derrickTier,
        telemetry.habitationTier,
        telemetry.terraformerTier,
        telemetry.siloTier,
        telemetry.shipyardTier,
        telemetry.morale,
        telemetry.powerGeneratedMW,
        telemetry.powerConsumedMW,
        telemetry.o2Generated,
        telemetry.o2Consumed,
        telemetry.gridEfficiency,
        JSON.stringify(telemetry.colonyModules),
        colonyId,
      ]
    );

    return { tiles, telemetry };
  }

  /**
   * Places a structure or transit tube on an isometric grid tile.
   */
  public async placeBuilding(
    accountId: string,
    colonyId: string,
    layer: OutpostLayer,
    x: number,
    y: number,
    buildingType: BuildingTypeId,
    opts?: { instant?: boolean; skipCost?: boolean }
  ): Promise<{ tile: OutpostGridTile; creditCostPaid: number; alloyCostPaid: number }> {
    const def = getOutpostBuildingDef(buildingType);
    if (!def) throw new Error(`UNKNOWN_BUILDING_TYPE: ${buildingType} is not in Outpost catalog.`);
    if (def.id === 'COMMAND_HUB') throw new Error('CANNOT_PLACE_COMMAND_HUB: Command Hub is unique to founding.');
    if (!def.allowedLayers.includes(layer)) {
      throw new Error(`INVALID_LAYER: ${def.name} cannot be constructed on depth layer ${layer}.`);
    }
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      throw new Error('OUT_OF_BOUNDS: Tile coordinate outside 12x12 perimeter.');
    }

    await this.ensureGridInitialized(colonyId);

    const tileRes = await db.query<any>(
      'SELECT * FROM colony_grid_tiles WHERE colony_id = $1 AND layer = $2 AND x = $3 AND y = $4',
      [colonyId, layer, x, y]
    );
    const targetTile = tileRes.rows[0];
    if (!targetTile) throw new Error('TILE_NOT_FOUND');
    if (targetTile.terrain_type === 'CRATER') {
      throw new Error('UNBUILDABLE_TERRAIN: Impact craters require blasting; choose flat regolith or seam bedrock.');
    }
    if (targetTile.building_type) {
      throw new Error(`TILE_OCCUPIED: Tile (${layer}, ${x}, ${y}) already contains ${targetTile.building_type}.`);
    }

    if (def.maxPerColony) {
      const cntRes = await db.query<{ cnt: string }>(
        'SELECT COUNT(*)::text AS cnt FROM colony_grid_tiles WHERE colony_id = $1 AND building_type = $2',
        [colonyId, buildingType]
      );
      if (Number(cntRes.rows[0]?.cnt || 0) >= def.maxPerColony) {
        throw new Error(`MAX_STRUCTURE_LIMIT: Colony allows at most ${def.maxPerColony}x ${def.name}.`);
      }
    }

    // Enforce Milestone 1.5 N-Specialist Crew requirement when constructing Specialty Modules directly on grid
    if (!opts?.skipCost && def.mappedModuleKey) {
      const modCntRes = await db.query<{ cnt: string }>(
        'SELECT COUNT(*)::text AS cnt FROM colony_grid_tiles WHERE colony_id = $1 AND building_type = $2',
        [colonyId, buildingType]
      );
      const nextCount = Number(modCntRes.rows[0]?.cnt || 0) + 1;
      const req = getColonyModuleUpgradeRequirement(def.mappedModuleKey, nextCount);
      if (req) {
        const { count } = await crewService.getMatchingColonyCrewCount(accountId, colonyId, req.acceptedSpecialties);
        if (count < req.requiredCount) {
          throw new Error(
            `CREW_SPECIALTY_REQUIRED: Constructing ${def.name} (#${nextCount}) requires ${req.label} stationed at colony (Current: ${count}/${req.requiredCount}).`
          );
        }
      }
    }

    let creditCostPaid = 0;
    let alloyCostPaid = 0;

    if (!opts?.skipCost) {
      const [accRes, shipRes] = await Promise.all([
        db.query<{ credits: string }>('SELECT credits FROM accounts WHERE id = $1', [accountId]),
        db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]),
      ]);
      const credits = Number(accRes.rows[0]?.credits || 0);
      const shipId = shipRes.rows[0]?.id;

      let availableAlloys = 0;
      if (shipId && def.alloyCost > 0) {
        const cRes = await db.query<{ quantity: string }>(
          `SELECT quantity FROM ship_cargo WHERE ship_id = $1 AND commodity_id = 'COMM_ALLOY'`,
          [shipId]
        );
        availableAlloys = Number(cRes.rows[0]?.quantity || 0);
      }

      alloyCostPaid = Math.min(def.alloyCost, availableAlloys);
      const missingAlloys = Math.max(0, def.alloyCost - alloyCostPaid);
      creditCostPaid = def.creditCost + missingAlloys * 30;

      if (credits < creditCostPaid) {
        throw new Error(`INSUFFICIENT_CREDITS: Construction requires ${creditCostPaid} Cr (Current: ${credits} Cr).`);
      }

      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [creditCostPaid, accountId]);
      if (shipId && alloyCostPaid > 0) {
        await db.query(
          `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = 'COMM_ALLOY'`,
          [alloyCostPaid, shipId]
        );
      }
    }

    const isInstant = !!opts?.instant || def.buildTimeSec <= 0;
    const status = isInstant ? 'ACTIVE' : 'CONSTRUCTING';

    if (isInstant) {
      await db.query(
        `UPDATE colony_grid_tiles
         SET building_type = $1, status = 'ACTIVE', build_started_at = NOW(), build_complete_at = NULL, updated_at = NOW()
         WHERE id = $2`,
        [buildingType, targetTile.id]
      );
    } else {
      await db.query(
        `UPDATE colony_grid_tiles
         SET building_type = $1, status = 'CONSTRUCTING', build_started_at = NOW(),
             build_complete_at = NOW() + make_interval(secs => $2::double precision), updated_at = NOW()
         WHERE id = $3`,
        [buildingType, def.buildTimeSec, targetTile.id]
      );
    }

    const { tiles } = await this.evaluateGridSimulation(colonyId);
    const updatedTile = tiles.find((t) => t.id === targetTile.id)!;
    return { tile: updatedTile, creditCostPaid, alloyCostPaid };
  }

  /**
   * Toggles an active/offline building (for brownout management).
   */
  public async toggleBuildingPower(
    colonyId: string,
    layer: OutpostLayer,
    x: number,
    y: number
  ): Promise<{ tile: OutpostGridTile; telemetry: OutpostGridTelemetry }> {
    const res = await db.query<any>(
      'SELECT * FROM colony_grid_tiles WHERE colony_id = $1 AND layer = $2 AND x = $3 AND y = $4',
      [colonyId, layer, x, y]
    );
    const row = res.rows[0];
    if (!row || !row.building_type) throw new Error('NO_BUILDING_ON_TILE');
    if (row.building_type === 'COMMAND_HUB') throw new Error('CANNOT_DISABLE_COMMAND_HUB');
    if (row.status === 'CONSTRUCTING') throw new Error('STILL_CONSTRUCTING');

    const nextStatus = row.status === 'ACTIVE' ? 'OFFLINE' : 'ACTIVE';
    await db.query('UPDATE colony_grid_tiles SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, row.id]);

    const { tiles, telemetry } = await this.evaluateGridSimulation(colonyId);
    const tile = tiles.find((t) => t.id === row.id)!;
    return { tile, telemetry };
  }

  /**
   * Demolishes a non-core building and refunds 50% base credit cost.
   */
  public async demolishBuilding(
    accountId: string,
    colonyId: string,
    layer: OutpostLayer,
    x: number,
    y: number
  ): Promise<{ refundCredits: number; telemetry: OutpostGridTelemetry }> {
    const res = await db.query<any>(
      'SELECT * FROM colony_grid_tiles WHERE colony_id = $1 AND layer = $2 AND x = $3 AND y = $4',
      [colonyId, layer, x, y]
    );
    const row = res.rows[0];
    if (!row || !row.building_type) throw new Error('NO_BUILDING_ON_TILE');
    if (row.building_type === 'COMMAND_HUB') throw new Error('CANNOT_DEMOLISH_COMMAND_HUB');

    const def = getOutpostBuildingDef(row.building_type);
    const refundCredits = def ? Math.floor(def.creditCost * 0.5) : 0;

    await db.query(
      `UPDATE colony_grid_tiles
       SET building_type = NULL, status = 'ACTIVE', is_connected = FALSE, build_started_at = NULL, build_complete_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );

    if (refundCredits > 0) {
      await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [refundCredits, accountId]);
    }

    const { telemetry } = await this.evaluateGridSimulation(colonyId);
    return { refundCredits, telemetry };
  }

  /**
   * Completes all active construction jobs in a colony (used by Rush Engineering / automated tests).
   */
  public async completePendingNow(colonyId: string): Promise<number> {
    const res = await db.query<{ id: string }>(
      `UPDATE colony_grid_tiles
       SET status = 'ACTIVE', build_complete_at = NULL, updated_at = NOW()
       WHERE colony_id = $1 AND status = 'CONSTRUCTING'
       RETURNING id`,
      [colonyId]
    );
    await this.evaluateGridSimulation(colonyId);
    return res.rows.length;
  }

  /**
   * Finds nearest open connectable tile on an allowed layer (extending an Access Shaft if needed),
   * and places the structure immediately without touching player wallet (called after API upgrade validation).
   */
  public async autoPlaceUpgradeOnGrid(
    accountId: string,
    colonyId: string,
    buildingType: BuildingTypeId
  ): Promise<OutpostGridTile> {
    const def = getOutpostBuildingDef(buildingType);
    if (!def) throw new Error(`UNKNOWN_BUILDING_TYPE: ${buildingType}`);

    const { tiles } = await this.evaluateGridSimulation(colonyId);
    const tileMap = new Map<string, OutpostGridTile>();
    for (const t of tiles) tileMap.set(`${t.layer}:${t.x}:${t.y}`, t);

    // Ensure at least one ACCESS_SHAFT reaches target layers if needed
    const lowestAllowed = Math.min(...def.allowedLayers) as OutpostLayer;
    if (lowestAllowed < 0) {
      // Check if an active connected shaft already reaches one of allowedLayers
      const hasConnectedTargetLayer = tiles.some(
        (t) => def.allowedLayers.includes(t.layer) && t.isConnected && t.buildingType !== null
      );
      if (!hasConnectedTargetLayer) {
        // Extend starter shaft at (4, 5) down to lowestAllowed
        for (let l = -1; l >= lowestAllowed; l--) {
          const shaftTile = tileMap.get(`${l}:4:5`);
          if (shaftTile && !shaftTile.buildingType && shaftTile.terrainType !== 'CRATER') {
            await this.placeBuilding(accountId, colonyId, l as OutpostLayer, 4, 5, 'ACCESS_SHAFT', {
              instant: true,
              skipCost: true,
            });
          }
        }
      }
    }

    const refreshed = await this.evaluateGridSimulation(colonyId);
    const refreshedMap = new Map<string, OutpostGridTile>();
    for (const t of refreshed.tiles) refreshedMap.set(`${t.layer}:${t.x}:${t.y}`, t);

    // Find open tiles on allowedLayers adjacent to a connected tile
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let bestCandidate: OutpostGridTile | null = null;
    let bestScore = -1;

    for (const t of refreshed.tiles) {
      if (!def.allowedLayers.includes(t.layer)) continue;
      if (t.buildingType !== null || t.terrainType === 'CRATER') continue;

      const hasConnNeighbor = dirs.some(([dx, dy]) => {
        const nb = refreshedMap.get(`${t.layer}:${t.x + dx}:${t.y + dy}`);
        return !!nb && nb.isConnected;
      });
      if (!hasConnNeighbor) continue;

      let score = 10 - (Math.abs(t.x - ROOT_X) + Math.abs(t.y - ROOT_Y)) * 0.1;
      if (def.id === 'ORE_MINE_L1' && t.terrainType === 'ORE_SEAM_L1') score += 50;
      if (def.id === 'GEOTHERMAL_PLANT' && (t.terrainType === 'GEO_VENT' || t.terrainType === 'DEEP_GEO_VENT')) score += 50;
      if (def.id === 'AGRIDOME' && t.terrainType === 'WATER_POCKET') score += 40;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = t;
      }
    }

    // Fallback: pick any non-crater open tile on an allowed layer & bridge with a tube if needed
    if (!bestCandidate) {
      bestCandidate =
        refreshed.tiles.find(
          (t) => def.allowedLayers.includes(t.layer) && t.buildingType === null && t.terrainType !== 'CRATER'
        ) || null;
    }

    if (!bestCandidate) {
      throw new Error(`NO_OPEN_GRID_TILE: No valid empty tile remains for ${def.name}.`);
    }

    const placed = await this.placeBuilding(
      accountId,
      colonyId,
      bestCandidate.layer,
      bestCandidate.x,
      bestCandidate.y,
      buildingType,
      { instant: true, skipCost: true }
    );
    return placed.tile;
  }
}

export const outpostGridService = new OutpostGridService();

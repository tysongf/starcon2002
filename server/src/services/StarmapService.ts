import { db } from '../db/Database';

export interface StarSystem {
  id: number;
  name: string;
  coordinatesX: number;
  coordinatesY: number;
  spectralClass: string;
  starRadius: number;
  hazardLevel: number;
  controllingFaction: string;
  description: string;
  hasPort: boolean;
  hasColony: boolean;
  planetCount: number;
}

export interface StarSystemDetail extends StarSystem {
  planets: Array<{
    id: string;
    name: string;
    type: string;
    gravity: number;
    hazardLevel: number;
    orbitDistance: number;
    hasColony: boolean;
  }>;
  ports: Array<{
    id: string;
    name: string;
    portClass: number;
    tariffRate: number;
  }>;
}

export interface FactionSphere {
  factionId: string;
  name: string;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  description: string;
}

export interface CoursePlotResult {
  success: boolean;
  sourceSectorId: number;
  sourceName: string;
  sourceCoords: [number, number];
  targetSectorId: number;
  targetName: string;
  targetCoords: [number, number];
  distanceLY: number;
  baseFuelCost: number;
  escortFuelCost: number;
  totalFuelCost: number;
  etaSeconds: number;
  hasSufficientFuel: boolean;
  currentFuel: number;
  activeEscortsCount: number;
  locked: boolean;
  error?: string;
}

export class StarmapService {
  public static readonly CANONICAL_SPHERES: FactionSphere[] = [
    {
      factionId: 'FACTION_SOL',
      name: 'Sol Alliance Core',
      centerX: 500.0,
      centerY: 500.0,
      radius: 85.0,
      color: '#38bdf8',
      description: 'Terran sovereign airspace governed by the Sol Planetary Alliance.',
    },
    {
      factionId: 'FACTION_VAELIC',
      name: 'Vaelic Imperial Hegemony',
      centerX: 360.0,
      centerY: 340.0,
      radius: 110.0,
      color: '#ef4444',
      description: 'Hostile Imperial perimeter defended by automated interdictors and heavy gun platforms.',
    },
    {
      factionId: 'FACTION_KRYLL',
      name: 'Kryll Freebooter Space',
      centerX: 680.0,
      centerY: 570.0,
      radius: 95.0,
      color: '#10b981',
      description: 'Freebooter space controlled by the Skrit and Kryll scrap syndicates.',
    },
    {
      factionId: 'FACTION_LITHOS',
      name: 'Lithos Harmonic Expanse',
      centerX: 650.0,
      centerY: 400.0,
      radius: 85.0,
      color: '#a855f7',
      description: 'Harmonic resonance expanse ruled by the Silicon-Lithos crystalline sentinels.',
    },
    {
      factionId: 'FACTION_PHORID',
      name: 'Phorid Swarm Hive Reach',
      centerX: 400.0,
      centerY: 630.0,
      radius: 80.0,
      color: '#f59e0b',
      description: 'Bio-organic aerosol expanse infested with caustic xenobiological spore nests.',
    },
  ];

  /**
   * Retrieves star systems with optional search, faction, or spatial radius filtering.
   */
  public async getStarSystems(filters?: {
    search?: string;
    faction?: string;
    nearX?: number;
    nearY?: number;
    radius?: number;
  }): Promise<StarSystem[]> {
    const query = `
      SELECT 
        s.id,
        s.name,
        s.coordinates_x,
        s.coordinates_y,
        s.spectral_class,
        s.star_radius,
        s.hazard_level,
        s.controlling_faction,
        s.description,
        COUNT(DISTINCT p.id) as port_count,
        COUNT(DISTINCT pl.id) as planet_count,
        COUNT(DISTINCT c.id) as colony_count
      FROM sectors s
      LEFT JOIN ports p ON p.sector_id = s.id
      LEFT JOIN planets pl ON pl.sector_id = s.id
      LEFT JOIN colonies c ON c.planet_id = pl.id
      GROUP BY s.id
      ORDER BY s.id ASC
    `;

    const { rows } = await db.query<any>(query);

    let systems: StarSystem[] = rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      coordinatesX: Number(r.coordinates_x ?? 500.0),
      coordinatesY: Number(r.coordinates_y ?? 500.0),
      spectralClass: r.spectral_class || 'YELLOW_G',
      starRadius: Number(r.star_radius ?? 1.0),
      hazardLevel: Number(r.hazard_level ?? 0),
      controllingFaction: r.controlling_faction,
      description: r.description || '',
      hasPort: Number(r.port_count) > 0,
      hasColony: Number(r.colony_count) > 0,
      planetCount: Number(r.planet_count),
    }));

    if (filters) {
      if (filters.search) {
        const term = filters.search.toLowerCase().trim();
        systems = systems.filter((s) => s.name.toLowerCase().includes(term));
      }
      if (filters.faction) {
        systems = systems.filter((s) => s.controllingFaction === filters.faction);
      }
      if (filters.nearX !== undefined && filters.nearY !== undefined && filters.radius !== undefined) {
        const { nearX, nearY, radius } = filters;
        systems = systems.filter((s) => {
          const dist = Math.hypot(s.coordinatesX - nearX, s.coordinatesY - nearY);
          return dist <= radius;
        });
      }
    }

    return systems;
  }

  /**
   * Retrieves full details for a single star system, including planets, colonies, and ports.
   */
  public async getStarSystemById(sectorId: number): Promise<StarSystemDetail | null> {
    const sysQuery = `
      SELECT 
        s.id, s.name, s.coordinates_x, s.coordinates_y, s.spectral_class,
        s.star_radius, s.hazard_level, s.controlling_faction, s.description
      FROM sectors s
      WHERE s.id = $1
    `;
    const { rows: sysRows } = await db.query<any>(sysQuery, [sectorId]);
    if (sysRows.length === 0) return null;
    const s = sysRows[0];

    const { rows: planetRows } = await db.query<any>(
      `SELECT pl.id, pl.name, pl.archetype, pl.radius, pl.hazard_class, pl.pos_x, pl.pos_z,
              CASE WHEN c.id IS NOT NULL THEN true ELSE false END as has_colony
       FROM planets pl
       LEFT JOIN colonies c ON c.planet_id = pl.id
       WHERE pl.sector_id = $1
       ORDER BY (pl.pos_x * pl.pos_x + pl.pos_z * pl.pos_z) ASC`,
      [sectorId]
    );

    const { rows: portRows } = await db.query<any>(
      `SELECT id, name, port_class, tariff_rate
       FROM ports
       WHERE sector_id = $1`,
      [sectorId]
    );

    return {
      id: Number(s.id),
      name: s.name,
      coordinatesX: Number(s.coordinates_x ?? 500.0),
      coordinatesY: Number(s.coordinates_y ?? 500.0),
      spectralClass: s.spectral_class || 'YELLOW_G',
      starRadius: Number(s.star_radius ?? 1.0),
      hazardLevel: Number(s.hazard_level ?? 0),
      controllingFaction: s.controlling_faction,
      description: s.description || '',
      hasPort: portRows.length > 0,
      hasColony: planetRows.some((p: any) => p.has_colony),
      planetCount: planetRows.length,
      planets: planetRows.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.archetype,
        gravity: Number((p.radius / 20.0).toFixed(2)),
        hazardLevel: p.hazard_class === 'EXTREME' ? 3 : p.hazard_class === 'HIGH' ? 2 : p.hazard_class === 'MODERATE' ? 1 : 0,
        orbitDistance: Number(Math.hypot(p.pos_x, p.pos_z).toFixed(1)),
        hasColony: Boolean(p.has_colony),
      })),
      ports: portRows.map((pr: any) => ({
        id: pr.id,
        name: pr.name,
        portClass: Number(pr.port_class),
        tariffRate: Number(pr.tariff_rate),
      })),
    };
  }

  /**
   * Retrieves faction territorial bubbles.
   */
  public async getFactionSpheres(): Promise<FactionSphere[]> {
    return StarmapService.CANONICAL_SPHERES;
  }

  /**
   * Calculates Euclidean course vector, fuel requirements, and locks navigation course.
   */
  public async plotCourse(
    accountId: string = 'acc_sol_captain',
    targetSectorId: number,
    lockCourse: boolean = true
  ): Promise<CoursePlotResult> {
    // 1. Fetch player ship state
    const { rows: shipRows } = await db.query<any>(
      'SELECT id, current_sector_id, fuel, nav_target_sector_id FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      throw new Error(`SHIP_NOT_FOUND: Account "${accountId}" possesses no registered flagship.`);
    }
    const ship = shipRows[0];
    const sourceSectorId = Number(ship.current_sector_id);

    // 2. Fetch Source and Target sectors
    const { rows: sectorRows } = await db.query<any>(
      'SELECT id, name, coordinates_x, coordinates_y FROM sectors WHERE id IN ($1, $2)',
      [sourceSectorId, targetSectorId]
    );
    const sourceSector = sectorRows.find((s) => Number(s.id) === sourceSectorId);
    const targetSector = sectorRows.find((s) => Number(s.id) === targetSectorId);

    if (!targetSector) {
      return {
        success: false,
        sourceSectorId,
        sourceName: sourceSector?.name || `Sector ${sourceSectorId}`,
        sourceCoords: [Number(sourceSector?.coordinates_x ?? 500), Number(sourceSector?.coordinates_y ?? 500)],
        targetSectorId,
        targetName: `Sector ${targetSectorId}`,
        targetCoords: [0, 0],
        distanceLY: 0,
        baseFuelCost: 0,
        escortFuelCost: 0,
        totalFuelCost: 0,
        etaSeconds: 0,
        hasSufficientFuel: false,
        currentFuel: Number(ship.fuel),
        activeEscortsCount: 0,
        locked: false,
        error: `TARGET_SECTOR_NOT_FOUND: Star system ${targetSectorId} does not exist in the galactic registry.`,
      };
    }

    const x1 = Number(sourceSector?.coordinates_x ?? 500.0);
    const y1 = Number(sourceSector?.coordinates_y ?? 500.0);
    const x2 = Number(targetSector.coordinates_x ?? 500.0);
    const y2 = Number(targetSector.coordinates_y ?? 500.0);

    // 3. Euclidean Distance & Fuel Calculation
    const distanceLY = Number(Math.hypot(x2 - x1, y2 - y1).toFixed(2));

    // Active escorts overhead
    let activeEscortsCount = 0;
    try {
      const { rows: escortRows } = await db.query<any>(
        `SELECT id FROM player_fleet WHERE account_id = $1 AND deployment_slot IS NOT NULL AND status = 'READY'`,
        [accountId]
      );
      activeEscortsCount = escortRows.length;
    } catch {
      activeEscortsCount = 0;
    }

    // Base fuel: 0.20 fuel per Light Year (minimum 1 fuel)
    const baseFuelCost = Math.max(1, Math.round(distanceLY * 0.20));
    // Escort penalty: +25% fuel burn per active escort
    const escortMultiplier = 1.0 + activeEscortsCount * 0.25;
    const totalFuelCost = Math.max(1, Math.round(baseFuelCost * escortMultiplier));
    const escortFuelCost = totalFuelCost - baseFuelCost;

    // ETA at standard warp cruising speed of 25 Light Years/second
    const etaSeconds = Number((distanceLY / 25.0).toFixed(1));

    const currentFuel = Number(ship.fuel);
    const hasSufficientFuel = currentFuel >= totalFuelCost;

    if (!hasSufficientFuel && lockCourse) {
      return {
        success: false,
        sourceSectorId,
        sourceName: sourceSector.name,
        sourceCoords: [x1, y1],
        targetSectorId,
        targetName: targetSector.name,
        targetCoords: [x2, y2],
        distanceLY,
        baseFuelCost,
        escortFuelCost,
        totalFuelCost,
        etaSeconds,
        hasSufficientFuel: false,
        currentFuel,
        activeEscortsCount,
        locked: false,
        error: `INSUFFICIENT_FUEL: Route to ${targetSector.name} (${distanceLY} LY) requires ${totalFuelCost} fuel (${baseFuelCost} base + ${escortFuelCost} escorts), but vessel only has ${currentFuel} fuel.`,
      };
    }

    // 4. Persist active course lock in database
    if (lockCourse) {
      await db.query(
        'UPDATE ships SET nav_target_sector_id = $1 WHERE account_id = $2',
        [targetSectorId, accountId]
      );
    }

    return {
      success: true,
      sourceSectorId,
      sourceName: sourceSector.name,
      sourceCoords: [x1, y1],
      targetSectorId,
      targetName: targetSector.name,
      targetCoords: [x2, y2],
      distanceLY,
      baseFuelCost,
      escortFuelCost,
      totalFuelCost,
      etaSeconds,
      hasSufficientFuel,
      currentFuel,
      activeEscortsCount,
      locked: lockCourse,
    };
  }

  /**
   * Clears any active navigation course lock.
   */
  public async clearCourse(accountId: string = 'acc_sol_captain'): Promise<{ success: boolean; message: string }> {
    await db.query('UPDATE ships SET nav_target_sector_id = NULL WHERE account_id = $1', [accountId]);
    return { success: true, message: 'Active navigation waypoint cleared.' };
  }

  /**
   * Day 38: Initiates continuous Hyperspace flight for the player's flagship and escort task force.
   */
  public async enterHyperspace(accountId: string = 'acc_sol_captain'): Promise<{
    success: boolean;
    isInHyperspace: boolean;
    coordinates: [number, number];
    currentSectorId: number;
    fuel: number;
    activeEscortsCount: number;
    navTargetSectorId: number | null;
    error?: string;
  }> {
    const { rows: shipRows } = await db.query<any>(
      'SELECT current_sector_id, fuel, nav_target_sector_id, hyperspace_x, hyperspace_y FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      return {
        success: false,
        isInHyperspace: false,
        coordinates: [500, 500],
        currentSectorId: 1,
        fuel: 0,
        activeEscortsCount: 0,
        navTargetSectorId: null,
        error: `SHIP_NOT_FOUND: Account "${accountId}" possesses no registered flagship.`,
      };
    }
    const ship = shipRows[0];
    const currentSectorId = Number(ship.current_sector_id);

    // Resolve current sector's canonical coordinates
    const { rows: sectorRows } = await db.query<any>(
      'SELECT coordinates_x, coordinates_y FROM sectors WHERE id = $1',
      [currentSectorId]
    );
    const startX = sectorRows.length > 0 ? Number(sectorRows[0].coordinates_x ?? 500.0) : 500.0;
    const startY = sectorRows.length > 0 ? Number(sectorRows[0].coordinates_y ?? 500.0) : 500.0;

    // Check active escorts count
    let activeEscortsCount = 0;
    try {
      const { rows: escortRows } = await db.query<any>(
        `SELECT id FROM player_fleet WHERE account_id = $1 AND deployment_slot IS NOT NULL AND status = 'READY'`,
        [accountId]
      );
      activeEscortsCount = escortRows.length;
    } catch {
      activeEscortsCount = 0;
    }

    // Update ship state to in-hyperspace
    await db.query(
      'UPDATE ships SET is_in_hyperspace = TRUE, hyperspace_x = $1, hyperspace_y = $2 WHERE account_id = $3',
      [startX, startY, accountId]
    );

    return {
      success: true,
      isInHyperspace: true,
      coordinates: [startX, startY],
      currentSectorId,
      fuel: Number(ship.fuel),
      activeEscortsCount,
      navTargetSectorId: ship.nav_target_sector_id !== null ? Number(ship.nav_target_sector_id) : null,
    };
  }

  /**
   * Day 38: Periodically synchronizes real-time continuous Hyperspace coordinates and distance-based fuel burn.
   */
  public async syncHyperspaceFlight(
    accountId: string = 'acc_sol_captain',
    currentCoords: [number, number],
    fuelBurned: number
  ): Promise<{
    success: boolean;
    coordinates: [number, number];
    remainingFuel: number;
    isFuelDepleted: boolean;
    error?: string;
  }> {
    const { rows: shipRows } = await db.query<any>(
      'SELECT fuel, hyperspace_x, hyperspace_y, is_in_hyperspace FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      return { success: false, coordinates: currentCoords, remainingFuel: 0, isFuelDepleted: true, error: 'SHIP_NOT_FOUND' };
    }
    const ship = shipRows[0];
    const prevX = Number(ship.hyperspace_x ?? currentCoords[0]);
    const prevY = Number(ship.hyperspace_y ?? currentCoords[1]);

    // Validate displacement
    const displacement = Math.hypot(currentCoords[0] - prevX, currentCoords[1] - prevY);
    if (displacement > 150.0) {
      return {
        success: false,
        coordinates: [prevX, prevY],
        remainingFuel: Number(ship.fuel),
        isFuelDepleted: false,
        error: `INVALID_HYPERSPACE_TELEPORT: Displacement of ${displacement.toFixed(1)} LY exceeds maximum continuous flight envelope.`,
      };
    }

    const currentFuel = Number(ship.fuel);
    const validFuelBurn = Math.max(0, Math.round(fuelBurned));
    const newFuel = Math.max(0, currentFuel - validFuelBurn);

    await db.query(
      'UPDATE ships SET hyperspace_x = $1, hyperspace_y = $2, fuel = $3, is_in_hyperspace = TRUE WHERE account_id = $4',
      [currentCoords[0], currentCoords[1], newFuel, accountId]
    );

    return {
      success: true,
      coordinates: currentCoords,
      remainingFuel: newFuel,
      isFuelDepleted: newFuel <= 0,
    };
  }

  /**
   * Day 38: Drops the flagship and active escort task force out of Hyperspace into a local Star System's gravity well.
   */
  public async arriveAtStarSystem(
    accountId: string = 'acc_sol_captain',
    targetSectorId: number,
    finalCoords?: [number, number],
    remainingFuel?: number
  ): Promise<{
    success: boolean;
    arrivedSectorId: number;
    sectorName: string;
    remainingFuel: number;
    coordinates: [number, number];
    system?: any;
    error?: string;
  }> {
    // 1. Fetch target star system
    const { rows: sectorRows } = await db.query<any>(
      'SELECT id, name, coordinates_x, coordinates_y FROM sectors WHERE id = $1',
      [targetSectorId]
    );
    if (sectorRows.length === 0) {
      return {
        success: false,
        arrivedSectorId: targetSectorId,
        sectorName: `Sector ${targetSectorId}`,
        remainingFuel: 0,
        coordinates: [0, 0],
        error: `TARGET_SECTOR_NOT_FOUND: Star system #${targetSectorId} does not exist in the galactic registry.`,
      };
    }
    const star = sectorRows[0];
    const starX = Number(star.coordinates_x ?? 500.0);
    const starY = Number(star.coordinates_y ?? 500.0);

    // 2. Fetch ship state
    const { rows: shipRows } = await db.query<any>(
      'SELECT fuel, hyperspace_x, hyperspace_y FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      return {
        success: false,
        arrivedSectorId: targetSectorId,
        sectorName: star.name,
        remainingFuel: 0,
        coordinates: [starX, starY],
        error: 'SHIP_NOT_FOUND',
      };
    }
    const ship = shipRows[0];

    const shipX = finalCoords ? finalCoords[0] : Number(ship.hyperspace_x ?? starX);
    const shipY = finalCoords ? finalCoords[1] : Number(ship.hyperspace_y ?? starY);

    // 3. Gravity Well Proximity Validation (Within 8.0 Light Years)
    const distanceToStar = Number(Math.hypot(shipX - starX, shipY - starY).toFixed(2));
    if (distanceToStar > 8.0) {
      return {
        success: false,
        arrivedSectorId: targetSectorId,
        sectorName: star.name,
        remainingFuel: Number(ship.fuel),
        coordinates: [shipX, shipY],
        error: `OUTSIDE_GRAVITY_WELL: Vessel is ${distanceToStar} LY away from ${star.name}. Orbital drop-out requires proximity within 8.0 Light Years.`,
      };
    }

    const fuelToCommit = remainingFuel !== undefined ? Math.max(0, Math.round(remainingFuel)) : Number(ship.fuel);

    // 4. Atomic Transition into TrueSpace
    await db.query(
      `UPDATE ships 
       SET is_in_hyperspace = FALSE, 
           current_sector_id = $1, 
           fuel = $2, 
           hyperspace_x = $3, 
           hyperspace_y = $4,
           nav_target_sector_id = CASE WHEN nav_target_sector_id = $1 THEN NULL ELSE nav_target_sector_id END,
           updated_at = NOW()
       WHERE account_id = $5`,
      [targetSectorId, fuelToCommit, starX, starY, accountId]
    );

    // Synchronize active escorts in player_fleet
    await db.query(
      `UPDATE player_fleet 
       SET current_sector_id = $1, updated_at = NOW() 
       WHERE account_id = $2 AND deployment_slot IS NOT NULL AND status != 'DESTROYED'`,
      [targetSectorId, accountId]
    );

    const detailedSystem = await this.getStarSystemById(targetSectorId);

    return {
      success: true,
      arrivedSectorId: targetSectorId,
      sectorName: star.name,
      remainingFuel: fuelToCommit,
      coordinates: [starX, starY],
      system: detailedSystem,
    };
  }
}

export const starmapService = new StarmapService();

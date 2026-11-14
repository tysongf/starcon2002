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

export interface HyperspaceRadarBlip {
  id: string;
  name: string;
  factionId: string;
  factionName: string;
  factionColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'PATROL' | 'ALERT' | 'PURSUING' | 'DISTRACTED';
  speed: number;
  detectionRadius: number;
  shipCount: number;
  shipClass: string;
  isHostile: boolean;
  distanceLY?: number;
}

export interface ActiveDecoy {
  id: string;
  x: number;
  y: number;
  expiresAt: number;
  durationSeconds: number;
}

export interface InterceptionHandshake {
  interceptionId: string;
  blipId: string;
  factionId: string;
  factionName: string;
  alienCommander: string;
  portrait: string;
  title: string;
  hostility: 'FRIENDLY' | 'EXTORTIONIST' | 'HOSTILE' | 'NEUTRAL';
  dialogueText: string;
  audioCue: string;
  bribeCostCredits?: number;
  bribeCostFuel?: number;
  options: Array<{
    id: string;
    label: string;
    action: 'BRIBE_CREDITS' | 'BRIBE_FUEL' | 'BLUFF' | 'ATTACK' | 'PEACEFUL_PASS';
    description: string;
  }>;
}

export interface CommsResolutionResult {
  success: boolean;
  actionTaken: string;
  resolvedPeacefully: boolean;
  message: string;
  immunityGrantedSeconds: number;
  remainingCredits?: number;
  remainingFuel?: number;
  combatDropRequired: boolean;
  combatSetup?: {
    encounterId: string;
    factionId: string;
    enemySquadron: Array<{
      type: string;
      hull: number;
      shield: number;
      weapons: string[];
    }>;
  };
  error?: string;
}

export interface QuasiSpacePortal {
  id: string;
  name: string;
  quasispaceX: number;
  quasispaceY: number;
  targetHyperspaceX: number;
  targetHyperspaceY: number;
  targetSectorId: number | null;
  description: string;
  distanceLY?: number;
}

export interface EmergencySOSEncounter {
  encounterId: string;
  responderType: 'TANKER' | 'BARTER' | 'SCAVENGER';
  responderName: string;
  portrait: string;
  dialogueText: string;
  fuelOffered: number;
  creditCost?: number;
  barterOreCost?: number;
  barterBioCost?: number;
  isHostile: boolean;
  options: Array<{
    id: string;
    label: string;
    action: 'BUY_FUEL' | 'BARTER_ORE' | 'BARTER_BIO' | 'SURRENDER' | 'FIGHT';
    description: string;
  }>;
}

export interface EmergencySOSResolution {
  success: boolean;
  actionTaken: string;
  remainingFuel: number;
  remainingCredits?: number;
  combatDropRequired: boolean;
  combatSetup?: any;
  message: string;
  error?: string;
}

export interface ExpeditionSummary {
  accountId: string;
  totalLightYearsWarped: number;
  systemsVisited: string[];
  portalsTransited: number;
  blipsEvaded: number;
  sosBeaconsBroadcast: number;
  interceptionsSurvived: number;
  currentCoordinates: [number, number];
  currentRealm: 'HYPERSPACE' | 'QUASISPACE' | 'TRUESPACE';
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
      `SELECT pl.id, pl.name, pl.archetype, pl.main_class, pl.subtype, pl.orbit_index,
              pl.abundance_rating, pl.density_rating, pl.radius, pl.hazard_class, pl.pos_x, pl.pos_z,
              CASE WHEN c.id IS NOT NULL THEN true ELSE false END as has_colony
       FROM planets pl
       LEFT JOIN colonies c ON c.planet_id = pl.id
       WHERE pl.sector_id = $1
       ORDER BY COALESCE(pl.orbit_index, 1) ASC, (pl.pos_x * pl.pos_x + pl.pos_z * pl.pos_z) ASC`,
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
        mainClass: p.main_class || undefined,
        subtype: p.subtype || undefined,
        abundanceRating: p.abundance_rating != null ? Number(p.abundance_rating) : undefined,
        densityRating: p.density_rating != null ? Number(p.density_rating) : undefined,
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

    if (displacement > 0) {
      const exp = this.getOrCreateExpedition(accountId);
      exp.totalLightYearsWarped += displacement;
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

    this.recordSystemVisit(accountId, targetSectorId);

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

  // =========================================================================
  // Day 39: Hyperspace Radar Blips, Hunter AI & Tactical Interceptions
  // =========================================================================

  private activeDecoys: Map<string, ActiveDecoy[]> = new Map();
  private activeBlips: Map<string, Map<string, HyperspaceRadarBlip>> = new Map();
  private lastBlipUpdateTime: Map<string, number> = new Map();

  /**
   * Helper to retrieve the governing faction sphere for galactic coordinates.
   */
  public getFactionSphereAtCoords(x: number, y: number): FactionSphere | null {
    for (const sphere of StarmapService.CANONICAL_SPHERES) {
      const dist = Math.hypot(x - sphere.centerX, y - sphere.centerY);
      if (dist <= sphere.radius) {
        return sphere;
      }
    }
    return null;
  }

  /**
   * Periodically updates and returns active radar contacts, pursuers, decoys, and immunity.
   */
  public async getHyperspaceRadarBlips(
    accountId: string = 'acc_sol_captain',
    coords: [number, number],
    isBoosting: boolean = false
  ): Promise<{
    success: boolean;
    blips: HyperspaceRadarBlip[];
    activeDecoys: ActiveDecoy[];
    immunityRemainingSeconds: number;
    decoysRemaining: number;
    threatLevel: 'CLEAR' | 'ALERT' | 'PURSUIT';
    territory: string;
  }> {
    const now = Date.now();
    const lastTime = this.lastBlipUpdateTime.get(accountId) || now;
    const dt = Math.min(2.0, Math.max(0.05, (now - lastTime) / 1000));
    this.lastBlipUpdateTime.set(accountId, now);

    // 1. Fetch ship immunity & decoy inventory
    const { rows: shipRows } = await db.query<any>(
      'SELECT decoys_remaining, hyperspace_immunity_until FROM ships WHERE account_id = $1',
      [accountId]
    );
    const ship = shipRows[0] || { decoys_remaining: 3, hyperspace_immunity_until: null };
    const decoysRemaining = Number(ship.decoys_remaining ?? 3);

    let immunityRemainingSeconds = 0;
    if (ship.hyperspace_immunity_until) {
      const immunityExpires = new Date(ship.hyperspace_immunity_until).getTime();
      if (immunityExpires > now) {
        immunityRemainingSeconds = Number(((immunityExpires - now) / 1000).toFixed(1));
      }
    }

    // 2. Filter active decoys
    const userDecoys = (this.activeDecoys.get(accountId) || []).filter((d) => d.expiresAt > now);
    this.activeDecoys.set(accountId, userDecoys);

    // 3. Retrieve or initialize blips map
    let blipMap = this.activeBlips.get(accountId);
    if (!blipMap) {
      blipMap = new Map();
      this.activeBlips.set(accountId, blipMap);
    }

    // 4. Prune blips out of radar envelope (> 120 LY)
    for (const [id, blip] of blipMap.entries()) {
      const dist = Math.hypot(blip.x - coords[0], blip.y - coords[1]);
      if (dist > 120.0) {
        blipMap.delete(id);
      }
    }

    // 5. Determine local faction territory
    const territorySphere = this.getFactionSphereAtCoords(coords[0], coords[1]);
    const territoryName = territorySphere ? territorySphere.name : 'Unclaimed Deep Void Expanse';
    const factionId = territorySphere ? territorySphere.factionId : 'FACTION_INDEPENDENT';

    // 6. Spawn regional blips if population is sparse (< 3)
    if (blipMap.size < 3) {
      const blipIndex = blipMap.size + 1;
      const angle = (Math.PI * 2 * Math.random());
      const spawnDist = 25.0 + Math.random() * 20.0; // 25 - 45 LY away
      const bx = Number((coords[0] + Math.cos(angle) * spawnDist).toFixed(1));
      const by = Number((coords[1] + Math.sin(angle) * spawnDist).toFixed(1));

      let blipData: Omit<HyperspaceRadarBlip, 'id' | 'x' | 'y' | 'vx' | 'vy' | 'state' | 'distanceLY'>;

      if (factionId === 'FACTION_VAELIC') {
        blipData = {
          name: `Vaelic Interdictor Heavy ${blipIndex}`,
          factionId: 'FACTION_VAELIC',
          factionName: 'Vaelic Imperial Hegemony',
          factionColor: '#ef4444',
          speed: 26.0,
          detectionRadius: 36.0,
          shipCount: 2,
          shipClass: 'War Cruiser',
          isHostile: true,
        };
      } else if (factionId === 'FACTION_KRYLL') {
        blipData = {
          name: `Kryll Corsair Skiff ${blipIndex}`,
          factionId: 'FACTION_KRYLL',
          factionName: 'Kryll Freebooter Syndicate',
          factionColor: '#10b981',
          speed: 28.0,
          detectionRadius: 32.0,
          shipCount: 3,
          shipClass: 'Raider',
          isHostile: true,
        };
      } else if (factionId === 'FACTION_PHORID') {
        blipData = {
          name: `Phorid Hive Drone Pack ${blipIndex}`,
          factionId: 'FACTION_PHORID',
          factionName: 'Phorid Swarm Hive',
          factionColor: '#f59e0b',
          speed: 30.0,
          detectionRadius: 40.0,
          shipCount: 4,
          shipClass: 'Bio-Interceptor',
          isHostile: true,
        };
      } else if (factionId === 'FACTION_LITHOS') {
        blipData = {
          name: `Lithos Monolith Sentinel ${blipIndex}`,
          factionId: 'FACTION_LITHOS',
          factionName: 'Lithos Harmonic Expanse',
          factionColor: '#a855f7',
          speed: 18.0,
          detectionRadius: 25.0,
          shipCount: 1,
          shipClass: 'Prism Sentinel',
          isHostile: false,
        };
      } else if (factionId === 'FACTION_SOL') {
        blipData = {
          name: `Sol Defense Picket Alpha ${blipIndex}`,
          factionId: 'FACTION_SOL',
          factionName: 'Sol Planetary Alliance',
          factionColor: '#38bdf8',
          speed: 22.0,
          detectionRadius: 28.0,
          shipCount: 2,
          shipClass: 'Defender',
          isHostile: false,
        };
      } else {
        blipData = {
          name: `Independent Ore Hauler ${blipIndex}`,
          factionId: 'FACTION_INDEPENDENT',
          factionName: 'Independent Rim Traders',
          factionColor: '#94a3b8',
          speed: 19.0,
          detectionRadius: 20.0,
          shipCount: 1,
          shipClass: 'Freighter',
          isHostile: false,
        };
      }

      const blipId = `blip_${factionId.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      blipMap.set(blipId, {
        id: blipId,
        x: bx,
        y: by,
        vx: (Math.random() - 0.5) * 8.0,
        vy: (Math.random() - 0.5) * 8.0,
        state: 'PATROL',
        ...blipData,
      });
    }

    // 7. Execute Hunter AI state machine & kinematics
    let threatLevel: 'CLEAR' | 'ALERT' | 'PURSUIT' = 'CLEAR';

    for (const blip of blipMap.values()) {
      const distToPlayer = Math.hypot(blip.x - coords[0], blip.y - coords[1]);
      blip.distanceLY = Number(distToPlayer.toFixed(1));

      // Check closest decoy within distraction radius (80 LY)
      let closestDecoy: ActiveDecoy | null = null;
      let minDecoyDist = Infinity;
      for (const d of userDecoys) {
        const dd = Math.hypot(blip.x - d.x, blip.y - d.y);
        if (dd <= 80.0 && dd < minDecoyDist) {
          minDecoyDist = dd;
          closestDecoy = d;
        }
      }

      if (closestDecoy) {
        // Distracted by Thermal Decoy
        blip.state = 'DISTRACTED';
        const ddx = closestDecoy.x - blip.x;
        const ddy = closestDecoy.y - blip.y;
        const len = Math.hypot(ddx, ddy) || 1;
        blip.vx = (ddx / len) * blip.speed;
        blip.vy = (ddy / len) * blip.speed;
        blip.x += blip.vx * dt;
        blip.y += blip.vy * dt;
      } else if (blip.isHostile && immunityRemainingSeconds <= 0) {
        // Hostile Hunter Check
        const effectiveDetection = blip.detectionRadius * (isBoosting ? 1.6 : 1.0);
        if (distToPlayer <= effectiveDetection) {
          blip.state = 'PURSUING';
          threatLevel = 'PURSUIT';
          const pdx = coords[0] - blip.x;
          const pdy = coords[1] - blip.y;
          const len = Math.hypot(pdx, pdy) || 1;
          blip.vx = (pdx / len) * blip.speed;
          blip.vy = (pdy / len) * blip.speed;
          blip.x += blip.vx * dt;
          blip.y += blip.vy * dt;
        } else {
          blip.state = 'PATROL';
          blip.x += blip.vx * dt;
          blip.y += blip.vy * dt;
          if (distToPlayer <= 50.0 && threatLevel !== 'PURSUIT') {
            threatLevel = 'ALERT';
          }
        }
      } else {
        // Friendly / Neutral / Immune Patrol
        blip.state = 'PATROL';
        blip.x += blip.vx * dt;
        blip.y += blip.vy * dt;
      }

      // Clamp coordinates to galactic grid [0, 1000]
      blip.x = Math.max(5, Math.min(995, Number(blip.x.toFixed(2))));
      blip.y = Math.max(5, Math.min(995, Number(blip.y.toFixed(2))));
    }

    return {
      success: true,
      blips: Array.from(blipMap.values()),
      activeDecoys: userDecoys,
      immunityRemainingSeconds,
      decoysRemaining,
      threatLevel,
      territory: territoryName,
    };
  }

  /**
   * Deploys a thermal subspace decoy to draw chasing hostiles.
   */
  public async deployHyperspaceDecoy(
    accountId: string = 'acc_sol_captain',
    coords: [number, number]
  ): Promise<{
    success: boolean;
    decoysRemaining: number;
    decoy?: ActiveDecoy;
    error?: string;
  }> {
    const { rows } = await db.query<any>(
      'SELECT decoys_remaining FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (rows.length === 0) {
      return { success: false, decoysRemaining: 0, error: 'SHIP_NOT_FOUND' };
    }

    const currentDecoys = Number(rows[0].decoys_remaining ?? 0);
    if (currentDecoys <= 0) {
      return {
        success: false,
        decoysRemaining: 0,
        error: 'NO_DECOYS_REMAINING: All thermal decoy canisters have been expended.',
      };
    }

    const updatedDecoys = currentDecoys - 1;
    await db.query(
      'UPDATE ships SET decoys_remaining = $1 WHERE account_id = $2',
      [updatedDecoys, accountId]
    );

    const decoy: ActiveDecoy = {
      id: `decoy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x: Number(coords[0].toFixed(2)),
      y: Number(coords[1].toFixed(2)),
      expiresAt: Date.now() + 6000,
      durationSeconds: 6.0,
    };

    const userDecoys = this.activeDecoys.get(accountId) || [];
    userDecoys.push(decoy);
    this.activeDecoys.set(accountId, userDecoys);

    const exp = this.getOrCreateExpedition(accountId);
    exp.blipsEvaded += 1;

    return {
      success: true,
      decoysRemaining: updatedDecoys,
      decoy,
    };
  }

  /**
   * Handshakes an alien radar interception and builds the Tier 1 Comms payload.
   */
  public async initiateHyperspaceInterception(
    accountId: string = 'acc_sol_captain',
    blipId: string,
    currentCoords?: [number, number]
  ): Promise<{
    success: boolean;
    interception?: InterceptionHandshake;
    error?: string;
  }> {
    // 1. Verify ship status
    const { rows: shipRows } = await db.query<any>(
      'SELECT is_in_hyperspace, hyperspace_immunity_until, hyperspace_x, hyperspace_y FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      return { success: false, error: 'SHIP_NOT_FOUND' };
    }
    const ship = shipRows[0];
    if (!ship.is_in_hyperspace) {
      return { success: false, error: 'NOT_IN_HYPERSPACE: Ship must be traversing Hyperspace to engage in interception.' };
    }

    if (ship.hyperspace_immunity_until) {
      const expires = new Date(ship.hyperspace_immunity_until).getTime();
      if (expires > Date.now()) {
        return {
          success: false,
          error: 'SHIP_UNDER_WARP_IMMUNITY: Vessel is protected by warp-flare stealth resonance and cannot be intercepted.',
        };
      }
    }

    // 2. Find or synthesize blip details
    const userBlips = this.activeBlips.get(accountId);
    let targetBlip = userBlips ? userBlips.get(blipId) : null;

    if (!targetBlip) {
      // Synthesize blip if passed directly or generated from proximity
      const sx = currentCoords ? currentCoords[0] : Number(ship.hyperspace_x ?? 500);
      const sy = currentCoords ? currentCoords[1] : Number(ship.hyperspace_y ?? 500);
      const sphere = this.getFactionSphereAtCoords(sx, sy);
      const fid = sphere ? sphere.factionId : 'FACTION_VAELIC';

      targetBlip = {
        id: blipId,
        name: `${sphere ? sphere.name : 'Vaelic'} Interceptor`,
        factionId: fid,
        factionName: sphere ? sphere.name : 'Vaelic Imperial Hegemony',
        factionColor: sphere ? sphere.color : '#ef4444',
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        state: 'PURSUING',
        speed: 25,
        detectionRadius: 35,
        shipCount: 2,
        shipClass: 'War Cruiser',
        isHostile: fid !== 'FACTION_SOL' && fid !== 'FACTION_LITHOS',
      };
    }

    // 3. Construct Tier 1 Alien Comms Handshake
    let handshake: InterceptionHandshake;

    if (targetBlip.factionId === 'FACTION_VAELIC') {
      handshake = {
        interceptionId: `intercept_${Date.now()}`,
        blipId: targetBlip.id,
        factionId: targetBlip.factionId,
        factionName: 'Vaelic Imperial Hegemony',
        alienCommander: 'Prefect Malakor of the Vaelic Core',
        portrait: 'vaelic_commander',
        title: 'Imperial Vanguard Interdictor',
        hostility: 'HOSTILE',
        audioCue: 'vaelic_hail',
        dialogueText:
          'Unidentified Earth Alliance vessel! You have violated sovereign Imperial airspace without Hegemony clearance. Surrender your vessel or be reduced to atoms in the subspace void.',
        bribeCostCredits: 500,
        bribeCostFuel: 20,
        options: [
          {
            id: 'bribe_credits',
            label: 'Pay Imperial Toll (500 Credits)',
            action: 'BRIBE_CREDITS',
            description: 'Authorize an emergency credit transfer to satisfy the Hegemony interdiction.',
          },
          {
            id: 'bluff',
            label: 'Transmit Diplomatic Clearance Code',
            action: 'BLUFF',
            description: 'Attempt to bluff the Imperial commander with forged Alliance clearance tokens.',
          },
          {
            id: 'attack',
            label: 'Raise Shields and Open Fire!',
            action: 'ATTACK',
            description: 'Refuse all demands and engage the Imperial squadron in tactical combat.',
          },
        ],
      };
    } else if (targetBlip.factionId === 'FACTION_KRYLL') {
      handshake = {
        interceptionId: `intercept_${Date.now()}`,
        blipId: targetBlip.id,
        factionId: targetBlip.factionId,
        factionName: 'Kryll Freebooter Syndicate',
        alienCommander: 'Captain Skrix of the Rust Claws',
        portrait: 'kryll_raider',
        title: 'Syndicate Corsair Captain',
        hostility: 'EXTORTIONIST',
        audioCue: 'kryll_hail',
        dialogueText:
          'Hahaha! Look at the pretty flagship that drifted right into our crosshairs! Pay the Syndicate transit fee—fuel or shiny credits—or my gunners tear through your hull plating!',
        bribeCostCredits: 350,
        bribeCostFuel: 15,
        options: [
          {
            id: 'bribe_fuel',
            label: 'Surrender Fuel (15 Fuel Units)',
            action: 'BRIBE_FUEL',
            description: 'Siphon 15 fuel canisters to the corsairs to buy passage.',
          },
          {
            id: 'bribe_credits',
            label: 'Pay Syndicate Tribute (350 Credits)',
            action: 'BRIBE_CREDITS',
            description: 'Pay off the pirate pack with credits.',
          },
          {
            id: 'attack',
            label: 'Lock Cannons and Fire!',
            action: 'ATTACK',
            description: 'Engage the pirate raiders in ship-to-ship combat.',
          },
        ],
      };
    } else if (targetBlip.factionId === 'FACTION_PHORID') {
      handshake = {
        interceptionId: `intercept_${Date.now()}`,
        blipId: targetBlip.id,
        factionId: targetBlip.factionId,
        factionName: 'Phorid Swarm Hive',
        alienCommander: 'Chitinous Swarm Overmind',
        portrait: 'phorid_swarm',
        title: 'Hive Vanguard Tendril',
        hostility: 'HOSTILE',
        audioCue: 'phorid_hail',
        dialogueText:
          '*Chittering bio-resonance shrieks fill the subspace comms band* ...FLESH... ENERGY CORE DETECTED... HARVEST... SPAWN...',
        options: [
          {
            id: 'attack',
            label: 'Repel Swarm Incursion!',
            action: 'ATTACK',
            description: 'The hive swarm cannot be reasoned with. Battle stations!',
          },
        ],
      };
    } else if (targetBlip.factionId === 'FACTION_LITHOS') {
      handshake = {
        interceptionId: `intercept_${Date.now()}`,
        blipId: targetBlip.id,
        factionId: targetBlip.factionId,
        factionName: 'Lithos Harmonic Expanse',
        alienCommander: 'Axiom Resonator 7-Alpha',
        portrait: 'lithos_resonator',
        title: 'Crystalline Observer',
        hostility: 'NEUTRAL',
        audioCue: 'lithos_hail',
        dialogueText:
          'Harmonic frequency recognized. Vessel of carbon consciousness, maintain your frequency and pass in peace through the crystalline meridian.',
        options: [
          {
            id: 'peaceful',
            label: 'Acknowledge Harmonic Resonance',
            action: 'PEACEFUL_PASS',
            description: 'Transmit peaceful acknowledgement and resume trajectory.',
          },
        ],
      };
    } else if (targetBlip.factionId === 'FACTION_SOL') {
      handshake = {
        interceptionId: `intercept_${Date.now()}`,
        blipId: targetBlip.id,
        factionId: targetBlip.factionId,
        factionName: 'Sol Planetary Alliance',
        alienCommander: 'Cmdr. Andrea Drake',
        portrait: 'sol_officer',
        title: 'Terran Sector Picket Command',
        hostility: 'FRIENDLY',
        audioCue: 'sol_hail',
        dialogueText:
          'Sol Defense Command here. Transponder verified, Flagship. Outer sectors report elevated pirate and Hegemony activity. Watch your fuel reserves.',
        options: [
          {
            id: 'peaceful',
            label: 'Understood, Sol Command. Out.',
            action: 'PEACEFUL_PASS',
            description: 'Affirm message and resume warp journey.',
          },
        ],
      };
    } else {
      handshake = {
        interceptionId: `intercept_${Date.now()}`,
        blipId: targetBlip.id,
        factionId: 'FACTION_INDEPENDENT',
        factionName: 'Independent Rim Traders',
        alienCommander: 'Captain Jax',
        portrait: 'neutral_trader',
        title: 'Free Rim Merchant',
        hostility: 'NEUTRAL',
        audioCue: 'neutral_hail',
        dialogueText:
          'Hail, traveler! Out here in deep subspace you can never be too careful. Safe travels to you and your flotilla.',
        options: [
          {
            id: 'peaceful',
            label: 'Safe travels, Captain.',
            action: 'PEACEFUL_PASS',
            description: 'Part ways peacefully.',
          },
        ],
      };
    }

    const exp = this.getOrCreateExpedition(accountId);
    exp.interceptionsSurvived += 1;

    return {
      success: true,
      interception: handshake,
    };
  }

  /**
   * Resolves a Comms decision during Tier 1 Interception.
   */
  public async resolveInterceptionComms(
    accountId: string = 'acc_sol_captain',
    blipId: string,
    actionId: string
  ): Promise<CommsResolutionResult> {
    const { rows: shipRows } = await db.query<any>(
      'SELECT s.fuel, a.credits FROM ships s JOIN accounts a ON a.id = s.account_id WHERE s.account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      return {
        success: false,
        actionTaken: actionId,
        resolvedPeacefully: false,
        message: 'Account or ship not found.',
        immunityGrantedSeconds: 0,
        combatDropRequired: false,
        error: 'SHIP_NOT_FOUND',
      };
    }

    const ship = shipRows[0];
    const currentCredits = Number(ship.credits ?? 0);
    const currentFuel = Number(ship.fuel ?? 0);

    // Remove blip from active radar after resolution
    const userBlips = this.activeBlips.get(accountId);
    const targetBlip = userBlips ? userBlips.get(blipId) : null;
    if (userBlips && targetBlip) {
      userBlips.delete(blipId);
    }

    const factionId = targetBlip ? targetBlip.factionId : 'FACTION_VAELIC';

    if (actionId === 'BRIBE_CREDITS') {
      const creditCost = factionId === 'FACTION_VAELIC' ? 500 : 350;
      if (currentCredits < creditCost) {
        return {
          success: false,
          actionTaken: actionId,
          resolvedPeacefully: false,
          message: `INSUFFICIENT_CREDITS: Required ${creditCost} Credits, but only ${currentCredits} available.`,
          immunityGrantedSeconds: 0,
          combatDropRequired: false,
          error: 'INSUFFICIENT_CREDITS',
        };
      }

      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [creditCost, accountId]);
      await db.query("UPDATE ships SET hyperspace_immunity_until = NOW() + INTERVAL '5 seconds' WHERE account_id = $1", [
        accountId,
      ]);

      return {
        success: true,
        actionTaken: actionId,
        resolvedPeacefully: true,
        message: `Tribute of ${creditCost} Credits transferred. The patrol acknowledges payment and disengages. 5-second warp immunity active.`,
        immunityGrantedSeconds: 5,
        remainingCredits: currentCredits - creditCost,
        remainingFuel: currentFuel,
        combatDropRequired: false,
      };
    }

    if (actionId === 'BRIBE_FUEL') {
      const fuelCost = factionId === 'FACTION_VAELIC' ? 20 : 15;
      if (currentFuel < fuelCost) {
        return {
          success: false,
          actionTaken: actionId,
          resolvedPeacefully: false,
          message: `INSUFFICIENT_FUEL: Required ${fuelCost} Fuel canisters, but only ${currentFuel} available.`,
          immunityGrantedSeconds: 0,
          combatDropRequired: false,
          error: 'INSUFFICIENT_FUEL',
        };
      }

      await db.query('UPDATE ships SET fuel = fuel - $1 WHERE account_id = $2', [fuelCost, accountId]);
      await db.query("UPDATE ships SET hyperspace_immunity_until = NOW() + INTERVAL '5 seconds' WHERE account_id = $1", [
        accountId,
      ]);

      return {
        success: true,
        actionTaken: actionId,
        resolvedPeacefully: true,
        message: `${fuelCost} Fuel units siphoned. The raiders depart cackling into the void. 5-second warp immunity active.`,
        immunityGrantedSeconds: 5,
        remainingCredits: currentCredits,
        remainingFuel: currentFuel - fuelCost,
        combatDropRequired: false,
      };
    }

    if (actionId === 'PEACEFUL_PASS' || actionId === 'BLUFF') {
      await db.query("UPDATE ships SET hyperspace_immunity_until = NOW() + INTERVAL '5 seconds' WHERE account_id = $1", [
        accountId,
      ]);

      return {
        success: true,
        actionTaken: actionId,
        resolvedPeacefully: true,
        message: 'Passage verified. Patrol vessel resumes patrol vector. 5-second warp immunity granted.',
        immunityGrantedSeconds: 5,
        remainingCredits: currentCredits,
        remainingFuel: currentFuel,
        combatDropRequired: false,
      };
    }

    // Hostile Escalation (ATTACK / Defiance)
    let enemySquadron: Array<{ type: string; hull: number; shield: number; weapons: string[] }> = [];

    if (factionId === 'FACTION_VAELIC') {
      enemySquadron = [
        { type: 'Vaelic Interdictor Cruiser', hull: 120, shield: 80, weapons: ['HEAVY_PLASMA', 'DISRUPTOR'] },
        { type: 'Vaelic Strike Gunship', hull: 75, shield: 45, weapons: ['PULSE_LASER'] },
      ];
    } else if (factionId === 'FACTION_KRYLL') {
      enemySquadron = [
        { type: 'Kryll Raider Skiff', hull: 70, shield: 40, weapons: ['PULSE_LASER', 'SWARM_MISSILE'] },
        { type: 'Kryll Scrap Corsair', hull: 65, shield: 35, weapons: ['PULSE_LASER'] },
        { type: 'Kryll Gunboat', hull: 80, shield: 40, weapons: ['HEAVY_CANNON'] },
      ];
    } else if (factionId === 'FACTION_PHORID') {
      enemySquadron = [
        { type: 'Phorid Spore Drone Alpha', hull: 50, shield: 20, weapons: ['BIO_SPORE'] },
        { type: 'Phorid Spore Drone Beta', hull: 50, shield: 20, weapons: ['BIO_SPORE'] },
        { type: 'Phorid Bio-Striker', hull: 70, shield: 30, weapons: ['CORROSIVE_SPIT'] },
      ];
    } else {
      enemySquadron = [
        { type: 'Mercenary Gunboat', hull: 80, shield: 50, weapons: ['PLASMA_CANNON'] },
        { type: 'Rogue Interceptor', hull: 60, shield: 30, weapons: ['PULSE_LASER'] },
      ];
    }

    return {
      success: true,
      actionTaken: 'ATTACK',
      resolvedPeacefully: false,
      message: 'Hostilities initiated! Dropping fleet out of Hyperspace into 20Hz tactical combat.',
      immunityGrantedSeconds: 0,
      combatDropRequired: true,
      combatSetup: {
        encounterId: `enc_${Date.now()}`,
        factionId,
        enemySquadron,
      },
    };
  }

  /**
   * Resumes Hyperspace flight in-situ following combat victory or FTL escape.
   */
  public async resumeHyperspaceFlight(
    accountId: string = 'acc_sol_captain',
    combatOutcome: 'VICTORY' | 'FLED' = 'VICTORY'
  ): Promise<{
    success: boolean;
    isInHyperspace: boolean;
    coordinates: [number, number];
    fuel: number;
    immunityGrantedSeconds: number;
    message: string;
  }> {
    await db.query(
      `UPDATE ships 
       SET is_in_hyperspace = TRUE, 
           hyperspace_immunity_until = NOW() + INTERVAL '5 seconds',
           updated_at = NOW() 
       WHERE account_id = $1`,
      [accountId]
    );

    const { rows } = await db.query<any>(
      'SELECT fuel, hyperspace_x, hyperspace_y FROM ships WHERE account_id = $1',
      [accountId]
    );
    const ship = rows[0] || { fuel: 100, hyperspace_x: 500, hyperspace_y: 500 };

    return {
      success: true,
      isInHyperspace: true,
      coordinates: [Number(ship.hyperspace_x ?? 500), Number(ship.hyperspace_y ?? 500)],
      fuel: Number(ship.fuel ?? 100),
      immunityGrantedSeconds: 5,
      message:
        combatOutcome === 'VICTORY'
          ? 'Tactical combat resolved: VICTORY. Re-emerging in Hyperspace with 5s warp-flare immunity.'
          : 'Emergency FTL escape successful. Re-emerging in Hyperspace with 5s warp-flare immunity.',
    };
  }

  // =========================================================================
  // Day 40: Precursor Quasi-Space Slipstream & Emergency SOS Transponder
  // =========================================================================

  private activeSOSEncounters: Map<string, EmergencySOSEncounter> = new Map();

  /**
   * Retrieves the 8 canonical Precursor Portals anchored inside Quasi-Space.
   */
  public async getQuasiSpacePortals(): Promise<QuasiSpacePortal[]> {
    const { rows } = await db.query<any>(
      `SELECT id, name, quasispace_x, quasispace_y, target_hyperspace_x, target_hyperspace_y, target_sector_id, description
       FROM quasispace_portals
       ORDER BY id ASC`
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      quasispaceX: Number(r.quasispace_x),
      quasispaceY: Number(r.quasispace_y),
      targetHyperspaceX: Number(r.target_hyperspace_x),
      targetHyperspaceY: Number(r.target_hyperspace_y),
      targetSectorId: r.target_sector_id !== null ? Number(r.target_sector_id) : null,
      description: r.description,
    }));
  }

  /**
   * Enters Precursor Quasi-Space slipstream (gated by Precursor research resonance).
   */
  public async enterQuasiSpace(
    accountId: string = 'acc_sol_captain'
  ): Promise<{
    success: boolean;
    isInQuasiSpace: boolean;
    coordinates: [number, number];
    fuel: number;
    message: string;
    error?: string;
  }> {
    // 1. Verify Precursor Resonance
    const { rows: siteRows } = await db.query<any>(
      'SELECT COUNT(*) as count FROM precursor_sites WHERE is_deciphered = TRUE'
    );
    const { rows: researchRows } = await db.query<any>(
      'SELECT COUNT(*) as count FROM precursor_research WHERE account_id = $1',
      [accountId]
    );

    const decipheredCount = Number(siteRows[0]?.count ?? 0);
    const researchCount = Number(researchRows[0]?.count ?? 0);

    if (decipheredCount === 0 && researchCount === 0) {
      return {
        success: false,
        isInQuasiSpace: false,
        coordinates: [150.0, 150.0],
        fuel: 0,
        message: 'Precursor resonance required.',
        error: 'PRECURSOR_RESONANCE_REQUIRED: Vessel lacks Precursor deciphering matrix to breach Quasi-Space.',
      };
    }

    // 2. Fetch ship state
    const { rows: shipRows } = await db.query<any>(
      'SELECT fuel FROM ships WHERE account_id = $1',
      [accountId]
    );
    const ship = shipRows[0] || { fuel: 100 };

    // 3. Atomically transition into Quasi-Space at central meridian [150.0, 150.0]
    await db.query(
      `UPDATE ships 
       SET is_in_quasispace = TRUE, 
           is_in_hyperspace = FALSE, 
           quasispace_x = 150.0, 
           quasispace_y = 150.0, 
           updated_at = NOW() 
       WHERE account_id = $1`,
      [accountId]
    );

    return {
      success: true,
      isInQuasiSpace: true,
      coordinates: [150.0, 150.0],
      fuel: Number(ship.fuel),
      message: 'Dimensional phase transition complete: Entered Precursor Quasi-Space slipstream.',
    };
  }

  /**
   * Synchronizes coordinates within Quasi-Space with ZERO fuel consumption.
   */
  public async syncQuasiSpaceFlight(
    accountId: string = 'acc_sol_captain',
    currentCoords: [number, number]
  ): Promise<{
    success: boolean;
    coordinates: [number, number];
    remainingFuel: number;
    error?: string;
  }> {
    const { rows } = await db.query<any>(
      'SELECT fuel, quasispace_x, quasispace_y, is_in_quasispace FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (rows.length === 0) {
      return { success: false, coordinates: currentCoords, remainingFuel: 0, error: 'SHIP_NOT_FOUND' };
    }
    const ship = rows[0];

    const prevX = Number(ship.quasispace_x ?? currentCoords[0]);
    const prevY = Number(ship.quasispace_y ?? currentCoords[1]);
    const displacement = Math.hypot(currentCoords[0] - prevX, currentCoords[1] - prevY);

    if (displacement > 250.0) {
      return {
        success: false,
        coordinates: [prevX, prevY],
        remainingFuel: Number(ship.fuel),
        error: `INVALID_DISPLACEMENT: Quasi-Space displacement of ${displacement.toFixed(1)} exceeds continuous flight boundary.`,
      };
    }

    if (displacement > 0) {
      const exp = this.getOrCreateExpedition(accountId);
      exp.totalLightYearsWarped += displacement;
    }

    // Update coordinates; FUEL CONSUMPTION IS STRICTLY ZERO
    await db.query(
      'UPDATE ships SET quasispace_x = $1, quasispace_y = $2, is_in_quasispace = TRUE WHERE account_id = $3',
      [currentCoords[0], currentCoords[1], accountId]
    );

    return {
      success: true,
      coordinates: currentCoords,
      remainingFuel: Number(ship.fuel),
    };
  }

  /**
   * Transits an ancient Precursor Portal, projecting back into real Hyperspace with 5s immunity.
   */
  public async exitQuasiSpaceViaPortal(
    accountId: string = 'acc_sol_captain',
    portalId: string
  ): Promise<{
    success: boolean;
    isInHyperspace: boolean;
    coordinates: [number, number];
    immunityGrantedSeconds: number;
    targetSectorId: number | null;
    portalName: string;
    error?: string;
  }> {
    const { rows: portalRows } = await db.query<any>(
      'SELECT * FROM quasispace_portals WHERE id = $1',
      [portalId]
    );
    if (portalRows.length === 0) {
      return {
        success: false,
        isInHyperspace: false,
        coordinates: [500, 500],
        immunityGrantedSeconds: 0,
        targetSectorId: null,
        portalName: 'Unknown Portal',
        error: `PORTAL_NOT_FOUND: Precursor portal gateway '${portalId}' does not exist.`,
      };
    }
    const portal = portalRows[0];

    const { rows: shipRows } = await db.query<any>(
      'SELECT quasispace_x, quasispace_y FROM ships WHERE account_id = $1',
      [accountId]
    );
    const ship = shipRows[0] || { quasispace_x: portal.quasispace_x, quasispace_y: portal.quasispace_y };

    // Proximity check in Quasi-Space (R <= 8.0)
    const dist = Math.hypot(Number(ship.quasispace_x) - Number(portal.quasispace_x), Number(ship.quasispace_y) - Number(portal.quasispace_y));
    if (dist > 8.0) {
      return {
        success: false,
        isInHyperspace: false,
        coordinates: [Number(ship.quasispace_x), Number(ship.quasispace_y)],
        immunityGrantedSeconds: 0,
        targetSectorId: null,
        portalName: portal.name,
        error: `OUTSIDE_PORTAL_RANGE: Vessel is ${dist.toFixed(1)} LY away from ${portal.name}. Proximity within 8.0 LY required to transit.`,
      };
    }

    const targetX = Number(portal.target_hyperspace_x);
    const targetY = Number(portal.target_hyperspace_y);

    await db.query(
      `UPDATE ships 
       SET is_in_quasispace = FALSE, 
           is_in_hyperspace = TRUE, 
           hyperspace_x = $1, 
           hyperspace_y = $2, 
           hyperspace_immunity_until = NOW() + INTERVAL '5 seconds',
           updated_at = NOW() 
       WHERE account_id = $3`,
      [targetX, targetY, accountId]
    );

    const exp = this.getOrCreateExpedition(accountId);
    exp.portalsTransited += 1;

    return {
      success: true,
      isInHyperspace: true,
      coordinates: [targetX, targetY],
      immunityGrantedSeconds: 5,
      targetSectorId: portal.target_sector_id ? Number(portal.target_sector_id) : null,
      portalName: portal.name,
    };
  }

  /**
   * Broadcasts an automated SOS distress beacon when fuel drops to 0 in Hyperspace.
   */
  public async triggerEmergencySOS(
    accountId: string = 'acc_sol_captain'
  ): Promise<{
    success: boolean;
    encounter?: EmergencySOSEncounter;
    error?: string;
  }> {
    const { rows: shipRows } = await db.query<any>(
      'SELECT fuel, hyperspace_x, hyperspace_y, is_in_hyperspace FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (shipRows.length === 0) {
      return { success: false, error: 'SHIP_NOT_FOUND' };
    }
    const ship = shipRows[0];

    if (Number(ship.fuel) > 0) {
      return {
        success: false,
        error: 'FUEL_RESERVES_REMAINING: Emergency SOS beacon can only be broadcast when fuel reserves are fully exhausted.',
      };
    }

    const sx = Number(ship.hyperspace_x ?? 500);
    const sy = Number(ship.hyperspace_y ?? 500);
    const territory = this.getFactionSphereAtCoords(sx, sy);
    const fid = territory ? territory.factionId : 'FACTION_SOL';

    // Procedural roll biased by territory
    const roll = Math.random();
    let encounter: EmergencySOSEncounter;

    if (fid === 'FACTION_VAELIC' || fid === 'FACTION_KRYLL') {
      if (roll < 0.45) {
        // Scavenger encounter
        encounter = {
          encounterId: `sos_${Date.now()}`,
          responderType: 'SCAVENGER',
          responderName: 'Kryll Scrap Corsair "Gutripper"',
          portrait: 'kryll_raider',
          dialogueText:
            'Kekeke! A dead-in-the-water flagship drifting in the black! Hand over 500 Credits and your cargo hold, or our boarding hooks tear open your airlocks!',
          fuelOffered: 15,
          creditCost: 500,
          isHostile: true,
          options: [
            {
              id: 'surrender',
              label: 'Pay 500 Credits Extortion (15 Fuel)',
              action: 'SURRENDER',
              description: 'Pay off the pirate scavenger pack for minimal fuel to reach a port.',
            },
            {
              id: 'fight',
              label: 'Power Anti-Boarding Cannons!',
              action: 'FIGHT',
              description: 'Refuse pirate demands and defend your flagship in direct tactical combat.',
            },
          ],
        };
      } else {
        // Barter merchant
        encounter = {
          encounterId: `sos_${Date.now()}`,
          responderType: 'BARTER',
          responderName: 'Free Hauler "Rusty Comet"',
          portrait: 'neutral_trader',
          dialogueText:
            'Caught drifting with empty tanks, traveler? We have emergency fuel canisters, but we deal in physical trade goods: 10 units of Ore or 5 Bio Specimens.',
          fuelOffered: 20,
          barterOreCost: 10,
          barterBioCost: 5,
          isHostile: false,
          options: [
            {
              id: 'barter_ore',
              label: 'Trade 10 Mineral Ore (20 Fuel)',
              action: 'BARTER_ORE',
              description: 'Barter 10 units of Mineral Ore from cargo for 20 fuel canisters.',
            },
            {
              id: 'barter_bio',
              label: 'Trade 5 Bio Specimens (20 Fuel)',
              action: 'BARTER_BIO',
              description: 'Trade 5 units of Biological Specimens for 20 fuel canisters.',
            },
            {
              id: 'buy_fuel',
              label: 'Pay Cash Surcharge (500 Credits)',
              action: 'BUY_FUEL',
              description: 'Pay an emergency cash fee to secure 20 fuel units.',
            },
          ],
        };
      }
    } else {
      // Sol Alliance or Independent Tanker
      encounter = {
        encounterId: `sos_${Date.now()}`,
        responderType: 'TANKER',
        responderName: 'Sol-Aegis Mobile Tanker 09',
        portrait: 'sol_officer',
        dialogueText:
          'Emergency distress beacon acknowledged, Flagship. Sol Logistics deployed our tanker to your vector. We can transfer 25 Deuterium fuel units for standard emergency rate (400 Credits).',
        fuelOffered: 25,
        creditCost: 400,
        isHostile: false,
        options: [
          {
            id: 'buy_fuel',
            label: 'Authorize 400 Credits (25 Fuel)',
            action: 'BUY_FUEL',
            description: 'Authorize transfer of 400 Credits for 25 fuel units.',
          },
        ],
      };
    }

    this.activeSOSEncounters.set(accountId, encounter);

    const exp = this.getOrCreateExpedition(accountId);
    exp.sosBeaconsBroadcast += 1;

    return {
      success: true,
      encounter,
    };
  }

  /**
   * Resolves the Emergency SOS transaction (fuel purchase, barter, or combat drop).
   */
  public async resolveEmergencySOSTrade(
    accountId: string = 'acc_sol_captain',
    choice: 'BUY_FUEL' | 'BARTER_ORE' | 'BARTER_BIO' | 'SURRENDER' | 'FIGHT'
  ): Promise<EmergencySOSResolution> {
    const { rows: accountRows } = await db.query<any>(
      'SELECT credits FROM accounts WHERE id = $1',
      [accountId]
    );
    const credits = Number(accountRows[0]?.credits ?? 0);

    if (choice === 'BUY_FUEL') {
      const cost = 400;
      if (credits < cost) {
        return {
          success: false,
          actionTaken: choice,
          remainingFuel: 0,
          remainingCredits: credits,
          combatDropRequired: false,
          message: `INSUFFICIENT_CREDITS: Required ${cost} Credits, but balance is ${credits}.`,
          error: 'INSUFFICIENT_CREDITS',
        };
      }

      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [cost, accountId]);
      await db.query(
        `UPDATE ships 
         SET fuel = 25, 
             is_in_hyperspace = TRUE, 
             hyperspace_immunity_until = NOW() + INTERVAL '5 seconds',
             updated_at = NOW() 
         WHERE account_id = $1`,
        [accountId]
      );

      return {
        success: true,
        actionTaken: choice,
        remainingFuel: 25,
        remainingCredits: credits - cost,
        combatDropRequired: false,
        message: 'Emergency Deuterium fuel transferred (25 units). Main thrusters re-energized!',
      };
    }

    if (choice === 'BARTER_ORE' || choice === 'BARTER_BIO') {
      await db.query(
        `UPDATE ships 
         SET fuel = 20, 
             is_in_hyperspace = TRUE, 
             hyperspace_immunity_until = NOW() + INTERVAL '5 seconds',
             updated_at = NOW() 
         WHERE account_id = $1`,
        [accountId]
      );

      return {
        success: true,
        actionTaken: choice,
        remainingFuel: 20,
        remainingCredits: credits,
        combatDropRequired: false,
        message: 'Barter exchange accepted! 20 Fuel units siphoned into fuel manifold.',
      };
    }

    if (choice === 'SURRENDER') {
      const cost = Math.min(credits, 500);
      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [cost, accountId]);
      await db.query(
        `UPDATE ships 
         SET fuel = 15, 
             is_in_hyperspace = TRUE, 
             hyperspace_immunity_until = NOW() + INTERVAL '5 seconds',
             updated_at = NOW() 
         WHERE account_id = $1`,
        [accountId]
      );

      return {
        success: true,
        actionTaken: choice,
        remainingFuel: 15,
        remainingCredits: credits - cost,
        combatDropRequired: false,
        message: 'Extortion tribute surrendered. 15 Emergency fuel units granted.',
      };
    }

    // FIGHT
    return {
      success: true,
      actionTaken: 'FIGHT',
      remainingFuel: 0,
      remainingCredits: credits,
      combatDropRequired: true,
      combatSetup: {
        encounterId: `sos_combat_${Date.now()}`,
        enemySquadron: [
          { type: 'Kryll Boarding Skiff', hull: 80, shield: 40, weapons: ['PULSE_LASER', 'SWARM_MISSILE'] },
          { type: 'Kryll Scrap Gunboat', hull: 90, shield: 50, weapons: ['HEAVY_CANNON'] },
        ],
      },
      message: 'Anti-boarding alarms blaring! Dropping into 20Hz tactical combat arena.',
    };
  }

  // =========================================================================
  // Day 41: Galactic Expedition Telemetry Engine
  // =========================================================================

  private static expeditionLedgers: Map<string, ExpeditionSummary> = new Map();

  public getOrCreateExpedition(accountId: string = 'acc_sol_captain'): ExpeditionSummary {
    let exp = StarmapService.expeditionLedgers.get(accountId);
    if (!exp) {
      exp = {
        accountId,
        totalLightYearsWarped: 0,
        systemsVisited: ['1'],
        portalsTransited: 0,
        blipsEvaded: 0,
        sosBeaconsBroadcast: 0,
        interceptionsSurvived: 0,
        currentCoordinates: [500.0, 500.0],
        currentRealm: 'TRUESPACE',
      };
      StarmapService.expeditionLedgers.set(accountId, exp);
    }
    return exp;
  }

  public async getExpeditionSummary(accountId: string = 'acc_sol_captain'): Promise<ExpeditionSummary> {
    const exp = this.getOrCreateExpedition(accountId);
    const { rows } = await db.query<any>(
      'SELECT is_in_hyperspace, hyperspace_x, hyperspace_y, is_in_quasispace, quasispace_x, quasispace_y, current_sector_id FROM ships WHERE account_id = $1',
      [accountId]
    );
    if (rows.length > 0) {
      const s = rows[0];
      if (s.is_in_quasispace) {
        exp.currentRealm = 'QUASISPACE';
        exp.currentCoordinates = [Number(s.quasispace_x ?? 150.0), Number(s.quasispace_y ?? 150.0)];
      } else if (s.is_in_hyperspace) {
        exp.currentRealm = 'HYPERSPACE';
        exp.currentCoordinates = [Number(s.hyperspace_x ?? 500.0), Number(s.hyperspace_y ?? 500.0)];
      } else {
        exp.currentRealm = 'TRUESPACE';
        const { rows: secRows } = await db.query<any>('SELECT coordinates_x, coordinates_y FROM sectors WHERE id = $1', [
          s.current_sector_id ?? 1,
        ]);
        if (secRows.length > 0) {
          exp.currentCoordinates = [Number(secRows[0].coordinates_x ?? 500.0), Number(secRows[0].coordinates_y ?? 500.0)];
        }
      }
    }
    return {
      ...exp,
      totalLightYearsWarped: Number(exp.totalLightYearsWarped.toFixed(2)),
      systemsVisited: [...exp.systemsVisited],
    };
  }

  public recordSystemVisit(accountId: string, systemId: string | number): void {
    const exp = this.getOrCreateExpedition(accountId);
    const sid = String(systemId);
    if (!exp.systemsVisited.includes(sid)) {
      exp.systemsVisited.push(sid);
    }
  }

  public recordExpeditionMetric(
    accountId: string,
    metric: 'blipsEvaded' | 'portalsTransited' | 'sosBeaconsBroadcast' | 'interceptionsSurvived',
    delta: number = 1
  ): void {
    const exp = this.getOrCreateExpedition(accountId);
    exp[metric] = (exp[metric] || 0) + delta;
  }

  public resetExpedition(accountId: string = 'acc_sol_captain'): void {
    StarmapService.expeditionLedgers.set(accountId, {
      accountId,
      totalLightYearsWarped: 0,
      systemsVisited: ['1'],
      portalsTransited: 0,
      blipsEvaded: 0,
      sosBeaconsBroadcast: 0,
      interceptionsSurvived: 0,
      currentCoordinates: [500.0, 500.0],
      currentRealm: 'TRUESPACE',
    });
  }
}

export const starmapService = new StarmapService();

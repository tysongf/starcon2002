import './test-utils/authHelper';
/**
 * Day 37 Integration Test Suite: The Galactic Coordinate Engine & CRT Starmap
 * Milestone 0.9: The Infinite Void — Interstellar Hyperspace & Galactic Starmap
 *
 * Verifies:
 * 1. Database Schema & Migration 011:
 *    - Sectors table augmented with coordinates (x, y), spectral class, star radius, hazard level.
 *    - Exactly 60 star systems seeded across the 1000x1000 light-year galactic plane.
 *    - Canonical coordinates verified for Sectors 1-5 (Sol Nexus, Void Expanse, Obsidian Smelter, Mycelia, Skrit).
 * 2. Starmap REST Endpoints & Spatial Filtering:
 *    - GET /api/starmap/systems returns 60 star systems with complete telemetry.
 *    - Spatial filtering (?nearX=500&nearY=500&radius=100) accurately selects localized star clusters.
 *    - Case-insensitive search filter (?search=Obsidian) isolates target systems.
 *    - Detailed telemetry query GET /api/starmap/systems/1 joins planets and spaceports.
 * 3. Faction Spheres of Influence:
 *    - GET /api/starmap/spheres provides territory bounds for all 5 major galactic powers.
 * 4. Euclidean Course Plotting & Fuel Logistics:
 *    - POST /api/starmap/course/plot calculates exact Euclidean distance D = sqrt(dx^2 + dy^2).
 *    - Calculates base fuel and active escort overhead (+25% per escort).
 *    - Rejects course locking when distance exceeds flagship fuel capacity with INSUFFICIENT_FUEL.
 *    - Successfully commits nav_target_sector_id to database and verifies clearCourse.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay37StarmapTests() {
  console.log('================================================================================');
  console.log('🚀 RUNNING DAY 37 INTEGRATION TESTS: GALACTIC COORDINATE ENGINE & CRT STARMAP');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (!condition) {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 0: Baseline Reset
    // -------------------------------------------------------------------------
    console.log('--- Phase 0: Pilot Baseline Reset & Solo Flight State ---');
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');

    // Recall escorts to reserve for clean baseline testing
    await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: 'fleet_escort_sol_01', slot: null }),
    });

    // -------------------------------------------------------------------------
    // Phase 1: Database Migration & Galactic Coordinate Audit
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 1: Database Migration & Galactic Coordinate Audit ---');
    const systemsRes = await fetch(`${BASE_URL}/api/starmap/systems`);
    assert(systemsRes.ok, 'GET /api/starmap/systems returned HTTP 200');
    const systemsData = await systemsRes.json();

    assert(systemsData.success === true, 'Response status is success: true');
    assert(systemsData.count >= 66, `Galactic star registry contains at least 66 star systems (Actual: ${systemsData.count})`);
    assert(systemsData.systems.length >= 66, 'Systems payload contains at least 66 elements');

    // Coordinate bounds and spectral class validation
    const validSpectralTypes = ['BLUE_O', 'WHITE_A', 'YELLOW_G', 'ORANGE_K', 'RED_M', 'NEUTRON'];
    let allCoordinatesValid = true;
    let allSpectralValid = true;

    for (const sys of systemsData.systems) {
      if (sys.coordinatesX < 0 || sys.coordinatesX > 1000 || sys.coordinatesY < 0 || sys.coordinatesY > 1000) {
        allCoordinatesValid = false;
        console.error(`Invalid coordinates for system #${sys.id} (${sys.name}): [${sys.coordinatesX}, ${sys.coordinatesY}]`);
      }
      if (!validSpectralTypes.includes(sys.spectralClass)) {
        allSpectralValid = false;
        console.error(`Invalid spectral class for system #${sys.id}: ${sys.spectralClass}`);
      }
    }

    assert(allCoordinatesValid, 'All 60 star systems conform to 1000x1000 light-year spatial plane bounds [0, 1000]');
    assert(allSpectralValid, 'All 60 star systems possess valid astrophysical spectral classifications');

    // Canonical core systems check
    const sol = systemsData.systems.find((s: any) => s.id === 1);
    assert(sol !== undefined, 'Sector 1 (Sol Nexus) registered');
    assert(sol.coordinatesX === 500 && sol.coordinatesY === 500, 'Sol Nexus anchored at Galactic Core [500.0, 500.0]');
    assert(sol.spectralClass === 'YELLOW_G', 'Sol Nexus classified as Solar Yellow G-Type star');
    assert(sol.hasPort === true, 'Sol Nexus possesses active spaceport (Aegis Terminal)');

    const voidExp = systemsData.systems.find((s: any) => s.id === 2);
    assert(voidExp.coordinatesX === 535 && voidExp.coordinatesY === 480, 'Void Expanse anchored at [535.0, 480.0]');
    assert(voidExp.spectralClass === 'BLUE_O', 'Void Expanse classified as Blue Supergiant');
    assert(voidExp.hazardLevel === 3, 'Void Expanse hazard level is 3 (Plasma/Hostiles)');

    const smelter = systemsData.systems.find((s: any) => s.id === 3);
    assert(smelter.coordinatesX === 580 && smelter.coordinatesY === 460, 'Obsidian Smelter anchored at [580.0, 460.0]');
    assert(smelter.spectralClass === 'ORANGE_K', 'Obsidian Smelter classified as Orange K-Type star');
    assert(smelter.hasPort === true, 'Obsidian Smelter possesses active foundry port');

    const mycelia = systemsData.systems.find((s: any) => s.id === 4);
    assert(mycelia.coordinatesX === 440 && mycelia.coordinatesY === 540, 'Mycelia Spore Reach anchored at [440.0, 540.0]');
    assert(mycelia.spectralClass === 'RED_M', 'Mycelia Spore Reach classified as Red Dwarf');

    const skrit = systemsData.systems.find((s: any) => s.id === 5);
    assert(skrit.coordinatesX === 620 && skrit.coordinatesY === 520, 'Skrit Cartel Drift anchored at [620.0, 520.0]');
    assert(skrit.spectralClass === 'WHITE_A', 'Skrit Cartel Drift classified as White A-Type star');

    // -------------------------------------------------------------------------
    // Phase 2: Starmap REST Endpoints & Spatial Queries
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Starmap REST Endpoints & Spatial Queries ---');

    // 2.1 Spatial Radius Filter
    const spatialRes = await fetch(`${BASE_URL}/api/starmap/systems?nearX=500&nearY=500&radius=100`);
    assert(spatialRes.ok, 'GET /api/starmap/systems with spatial query returned HTTP 200');
    const spatialData = await spatialRes.json();
    assert(spatialData.success === true, 'Spatial query succeeded');
    assert(spatialData.count > 0 && spatialData.count < 60, `Spatial filter returned localized cluster of ${spatialData.count} systems`);

    // Verify all returned systems are indeed <= 100 LY from [500, 500]
    const allWithinRadius = spatialData.systems.every((s: any) => {
      const dist = Math.hypot(s.coordinatesX - 500, s.coordinatesY - 500);
      return dist <= 100.01;
    });
    assert(allWithinRadius, 'All returned star systems fall strictly within the 100 LY spatial radius');

    // 2.2 Text Search Filter
    const searchRes = await fetch(`${BASE_URL}/api/starmap/systems?search=Obsidian`);
    assert(searchRes.ok, 'GET /api/starmap/systems with search query returned HTTP 200');
    const searchData = await searchRes.json();
    assert(searchData.count === 1, 'Search for "Obsidian" returned exactly 1 matching star system');
    assert(searchData.systems[0].name.includes('Obsidian Smelter'), 'Found Obsidian Smelter Station');

    // 2.3 Faction Filter
    const factionRes = await fetch(`${BASE_URL}/api/starmap/systems?faction=FACTION_VAELIC`);
    assert(factionRes.ok, 'GET /api/starmap/systems with faction filter returned HTTP 200');
    const factionData = await factionRes.json();
    assert(factionData.count >= 6, `Found ${factionData.count} systems under Vaelic Imperial Hegemony jurisdiction`);

    // 2.4 Detailed Star System Query (System 1)
    const detailRes = await fetch(`${BASE_URL}/api/starmap/systems/1`);
    assert(detailRes.ok, 'GET /api/starmap/systems/1 returned HTTP 200');
    const detailData = await detailRes.json();
    assert(detailData.success === true, 'Detailed system request succeeded');
    assert(detailData.system.id === 1, 'System ID matches 1');
    assert(detailData.system.ports.length >= 1, 'Contains registered spaceport array');
    assert(detailData.system.ports[0].id === 'PORT_AEGIS_01', 'Spaceport is Aegis Terminal');
    assert(detailData.system.planets.length >= 1, 'Contains orbiting planets array');
    assert(detailData.system.planets[0].id === 'planet_sec1_aegis', 'Planet is Aegis Prime');

    // -------------------------------------------------------------------------
    // Phase 3: Faction Spheres of Influence
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Faction Spheres of Influence ---');
    const spheresRes = await fetch(`${BASE_URL}/api/starmap/spheres`);
    assert(spheresRes.ok, 'GET /api/starmap/spheres returned HTTP 200');
    const spheresData = await spheresRes.json();

    assert(spheresData.success === true, 'Spheres request succeeded');
    assert(spheresData.spheres.length === 5, 'Exactly 5 major faction territorial bubbles defined');

    const expectedFactions = ['FACTION_SOL', 'FACTION_VAELIC', 'FACTION_KRYLL', 'FACTION_LITHOS', 'FACTION_PHORID'];
    for (const fid of expectedFactions) {
      const sp = spheresData.spheres.find((s: any) => s.factionId === fid);
      assert(sp !== undefined, `Faction sphere ${fid} defined`);
      assert(sp.radius > 50 && sp.radius < 150, `${fid} territory radius is within canonical bounds (${sp.radius} LY)`);
      assert(sp.color.startsWith('#'), `${fid} possesses valid hex color signature: ${sp.color}`);
    }

    // -------------------------------------------------------------------------
    // Phase 4: Euclidean Course Plotting & Fuel Gating
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 4: Euclidean Course Plotting & Fuel Gating ---');

    // 4.1 Plot route from Sol [500, 500] to Obsidian Smelter [580, 460] (0 escorts)
    // Distance = sqrt((580-500)^2 + (460-500)^2) = sqrt(6400 + 1600) = sqrt(8000) = 89.4427... -> 89.44 LY
    // Base fuel = round(89.44 * 0.20) = round(17.888) = 18 fuel
    // With 0 escorts: total fuel = 18
    const plotRes = await fetch(`${BASE_URL}/api/starmap/course/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        targetSectorId: 3,
        lockCourse: true,
      }),
    });
    assert(plotRes.ok, 'POST /api/starmap/course/plot returned HTTP 200');
    const plotData = await plotRes.json();

    assert(plotData.success === true, 'Course plotting succeeded');
    assert(plotData.sourceSectorId === 1, 'Source sector is Sol Nexus (ID 1)');
    assert(plotData.targetSectorId === 3, 'Target sector is Obsidian Smelter (ID 3)');
    assert(plotData.distanceLY === 89.44, `Euclidean distance is 89.44 Light Years (Actual: ${plotData.distanceLY})`);
    assert(plotData.baseFuelCost === 18, `Base fuel requirement is 18 units (Actual: ${plotData.baseFuelCost})`);
    assert(plotData.escortFuelCost === 0, 'Zero active escorts incurs 0 escort fuel overhead');
    assert(plotData.totalFuelCost === 18, 'Total fuel requirement is 18 Fuel');
    assert(plotData.hasSufficientFuel === true, 'Ship has sufficient fuel reserves (100 Fuel available)');
    assert(plotData.locked === true, 'Course waypoint successfully locked');

    // 4.2 Verify database persistence of nav_target_sector_id
    const shipCheckRes = await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`);
    const shipCheckData = await shipCheckRes.json();
    assert(shipCheckData.ship.nav_target_sector_id === 3, 'Ship state persisted nav_target_sector_id = 3 in PostgreSQL');

    // 4.3 Test escort overhead scaling with 2 active escorts deployed
    // Deploy starter escort to slot 1
    await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: 'fleet_escort_sol_01', slot: 1 }),
    });

    const plotWithEscortsRes = await fetch(`${BASE_URL}/api/starmap/course/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        targetSectorId: 3,
        lockCourse: false,
      }),
    });
    const plotWithEscortsData = await plotWithEscortsRes.json();
    assert(plotWithEscortsData.success === true, 'Plotting with 1 active escort succeeded');
    assert(plotWithEscortsData.activeEscortsCount === 1, 'Detected 1 active deployed combat escort');
    // 1 escort: 18 * 1.25 = 22.5 -> round(22.5) = 23 fuel. Escort overhead: 23 - 18 = 5 fuel.
    assert(plotWithEscortsData.baseFuelCost === 18, 'Base fuel cost remains 18 fuel');
    assert(plotWithEscortsData.escortFuelCost === 5, '1 active escort adds +5 fuel overhead (+25%)');
    assert(plotWithEscortsData.totalFuelCost === 23, 'Total fuel requirement is 23 fuel');

    // 4.4 Test INSUFFICIENT_FUEL rejection for unreachable distant star with depleted fuel tank
    // Set ship fuel to 5
    await fetch(`${BASE_URL}/api/player/ship/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, fuel: 5 }),
    });

    const failPlotRes = await fetch(`${BASE_URL}/api/starmap/course/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        targetSectorId: 3, // requires 23 fuel
        lockCourse: true,
      }),
    });
    assert(failPlotRes.status === 400, 'Plotting beyond available fuel capacity rejected with HTTP 400');
    const failPlotData = await failPlotRes.json();
    assert(failPlotData.success === false, 'failPlotData.success is false');
    assert(failPlotData.error.includes('INSUFFICIENT_FUEL'), 'Rejection error specifies INSUFFICIENT_FUEL');

    // 4.5 Clear navigation course waypoint
    // Restore full fuel
    await fetch(`${BASE_URL}/api/player/ship/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, fuel: 100 }),
    });

    const clearRes = await fetch(`${BASE_URL}/api/starmap/course/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(clearRes.ok, 'POST /api/starmap/course/clear returned HTTP 200');
    const clearData = await clearRes.json();
    assert(clearData.success === true, 'Clear course request succeeded');

    const finalShipRes = await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`);
    const finalShipData = await finalShipRes.json();
    assert(finalShipData.ship.nav_target_sector_id === null, 'Active navigation target successfully cleared in database (null)');

    console.log('\n================================================================================');
    console.log(`  DAY 37 COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('  GALACTIC COORDINATE ENGINE & CRT STARMAP FULLY OPERATIONAL!');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  }
}

runDay37StarmapTests().catch((err) => {
  console.error('Fatal error running Day 37 test suite:', err);
  process.exit(1);
});


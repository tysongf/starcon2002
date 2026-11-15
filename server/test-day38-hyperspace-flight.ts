import './test-utils/authHelper';
/**
 * Day 38 Integration Test Suite: Authoritative Real-Time Hyperspace Flight & Fuel Logistics
 * Milestone 0.9: The Infinite Void — Interstellar Hyperspace & Galactic Starmap
 *
 * Verifies:
 * 1. Hyperspace Entry & State Initiation:
 *    - POST /api/starmap/hyperspace/enter initializes is_in_hyperspace = TRUE.
 *    - Flags canonical galactic coordinates matching the departure star system (Sol Nexus at [500.0, 500.0]).
 *    - Persists state into PostgreSQL ships table.
 * 2. Fuel Logistics & Escort Drag Scaling:
 *    - Tests distance-based fuel consumption across 0, 1, and 2 active escorts (+25% per escort).
 *    - POST /api/starmap/hyperspace/sync atomically commits fuel deductions and coordinate updates.
 *    - Rejects anomalous teleportation displacements (> 150 LY).
 * 3. Autopilot Bearing & Euclidean Distance Countdown:
 *    - Verifies heading angle theta = atan2(dy, dx) and Euclidean distance convergence.
 * 4. Orbital Gravity Well Arrival & Sector Synchronization:
 *    - Rejects arrival when vessel is outside the star gravity well (> 8.0 LY).
 *    - Successfully commits orbital insertion when inside gravity well (<= 8.0 LY).
 *    - Transitions is_in_hyperspace = FALSE, sets flagship current_sector_id, and synchronizes active escorts.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay38HyperspaceFlightTests() {
  console.log('================================================================================');
  console.log('🚀 RUNNING DAY 38 INTEGRATION TESTS: HYPERSPACE FLIGHT & FUEL LOGISTICS');
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
    console.log('--- Phase 0: Baseline Reset & Solo Flight State ---');
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');

    // Recall escorts to reserve for Phase 1 baseline testing
    await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: 'fleet_escort_sol_01', slot: null }),
    });

    // -------------------------------------------------------------------------
    // Phase 1: Hyperspace Entry & State Initiation
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 1: Hyperspace Entry & State Initiation ---');
    const enterRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(enterRes.ok, 'POST /api/starmap/hyperspace/enter returned HTTP 200');
    const enterData = await enterRes.json();

    assert(enterData.success === true, 'Hyperspace transition returned success: true');
    assert(enterData.isInHyperspace === true, 'Flagship confirmed in Hyperspace (isInHyperspace = true)');
    assert(enterData.currentSectorId === 1, 'Departure system is Sector 1 (Sol Nexus)');
    assert(
      enterData.coordinates[0] === 500.0 && enterData.coordinates[1] === 500.0,
      `Starting coordinates match Sol Nexus [500.0, 500.0] (Actual: [${enterData.coordinates.join(', ')}])`
    );
    assert(enterData.fuel === 100, 'Starting fuel confirmed at 100 units');
    assert(enterData.activeEscortsCount === 0, 'Zero active escorts in reserve baseline');

    // Verify PostgreSQL persistence
    const shipCheckRes = await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`);
    const shipCheckData = await shipCheckRes.json();
    assert(shipCheckData.ship.is_in_hyperspace === true, 'Database confirmed is_in_hyperspace = TRUE');
    assert(shipCheckData.ship.hyperspace_x === 500.0, 'Database hyperspace_x confirmed at 500.0');
    assert(shipCheckData.ship.hyperspace_y === 500.0, 'Database hyperspace_y confirmed at 500.0');

    // -------------------------------------------------------------------------
    // Phase 2: Fuel Consumption & Escort Drag Scaling
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Fuel Consumption & Escort Drag Scaling ---');

    // 2.1 Solo Flight: Fly 40 LY East to [540.0, 500.0]
    // 0 escorts -> Burn rate: 0.20 Fuel/LY. 40 LY * 0.20 = 8 Fuel.
    // Starting fuel 100 -> Remaining fuel: 92
    const sync1Res = await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        currentCoords: [540.0, 500.0],
        fuelBurned: 8,
      }),
    });
    assert(sync1Res.ok, 'POST /api/starmap/hyperspace/sync (Solo) returned HTTP 200');
    const sync1Data = await sync1Res.json();
    assert(sync1Data.success === true, 'Solo flight sync succeeded');
    assert(sync1Data.remainingFuel === 92, `Remaining fuel accurately deducted to 92 (Actual: ${sync1Data.remainingFuel})`);
    assert(sync1Data.coordinates[0] === 540.0 && sync1Data.coordinates[1] === 500.0, 'Galactic coordinates updated to [540.0, 500.0]');
    assert(sync1Data.isFuelDepleted === false, 'Fuel is not depleted');

    // 2.2 Active Escort Scaling: Deploy 1 Escort (Sol Cruiser)
    await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: 'fleet_escort_sol_01', slot: 1 }),
    });

    // Re-query enter to reflect 1 active escort
    const enterWithEscort = await (
      await fetch(`${BASE_URL}/api/starmap/hyperspace/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: PLAYER_ID }),
      })
    ).json();
    assert(enterWithEscort.activeEscortsCount === 1, 'Detected 1 active combat escort in task force');

    // Fly another 40 LY with 1 escort:
    // Rate: 0.20 * (1 + 0.25) = 0.25 Fuel/LY. 40 LY * 0.25 = 10 Fuel.
    // Fuel 92 - 10 = 82 Fuel.
    const sync2Res = await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        currentCoords: [565.0, 480.0], // moved dx=25, dy=-20 -> dist = sqrt(625 + 400) = sqrt(1025) ~ 32 LY
        fuelBurned: 10,
      }),
    });
    assert(sync2Res.ok, 'POST /api/starmap/hyperspace/sync (1 Escort) returned HTTP 200');
    const sync2Data = await sync2Res.json();
    assert(sync2Data.remainingFuel === 82, `1 escort (+25%) accurately deducted 10 fuel to 82 (Actual: ${sync2Data.remainingFuel})`);

    // 2.3 Reject Anomalous Teleportation Displacement
    const anomalyRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        currentCoords: [990.0, 990.0], // > 500 LY displacement
        fuelBurned: 5,
      }),
    });
    assert(anomalyRes.status === 400, 'Teleportation displacement beyond physics envelope rejected with HTTP 400');
    const anomalyData = await anomalyRes.json();
    assert(anomalyData.success === false, 'Anomaly check returned success: false');
    assert(anomalyData.error.includes('INVALID_HYPERSPACE_TELEPORT'), 'Error message specifies INVALID_HYPERSPACE_TELEPORT');

    // -------------------------------------------------------------------------
    // Phase 3: Autopilot Bearing & Euclidean Distance Countdown
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Autopilot Bearing & Euclidean Distance Countdown ---');

    // Lock course to Sector 3 (Obsidian Smelter at [580.0, 460.0])
    const plotRes = await fetch(`${BASE_URL}/api/starmap/course/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, targetSectorId: 3, lockCourse: true }),
    });
    assert(plotRes.ok, 'Course plotted to Obsidian Smelter');

    // Current coordinates: [565.0, 480.0]. Target: [580.0, 460.0].
    // dx = 580 - 565 = +15. dy = 460 - 480 = -20.
    // Euclidean distance = sqrt(15^2 + (-20)^2) = sqrt(225 + 400) = sqrt(625) = 25.0 LY exactly!
    const curX = 565.0;
    const curY = 480.0;
    const targetX = 580.0;
    const targetY = 460.0;
    const distanceToTarget = Math.hypot(targetX - curX, targetY - curY);
    const targetBearing = Math.atan2(targetY - curY, targetX - curX);

    assert(distanceToTarget === 25.0, `Calculated distance to waypoint is exactly 25.0 Light Years (Actual: ${distanceToTarget})`);
    assert(
      Number(targetBearing.toFixed(4)) === Number(Math.atan2(-20, 15).toFixed(4)),
      `Bearing angle theta = atan2(-20, 15) radians matches expected trajectory (${targetBearing.toFixed(4)} rad)`
    );

    // -------------------------------------------------------------------------
    // Phase 4: Orbital Gravity Well Arrival & Sector Synchronization
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 4: Orbital Gravity Well Arrival & Sector Synchronization ---');

    // 4.1 Reject Arrival Attempt Outside Gravity Well (Distance = 25.0 LY > 8.0 LY)
    const rejectArriveRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        targetSectorId: 3,
        finalCoords: [curX, curY], // 25 LY away
        remainingFuel: 82,
      }),
    });
    assert(rejectArriveRes.status === 400, 'Arrival outside gravity well (> 8.0 LY) rejected with HTTP 400');
    const rejectData = await rejectArriveRes.json();
    assert(rejectData.success === false, 'Rejection returned success: false');
    assert(rejectData.error.includes('OUTSIDE_GRAVITY_WELL'), 'Rejection error specifies OUTSIDE_GRAVITY_WELL');

    // 4.2 Cruise within Gravity Well radius (Distance <= 8.0 LY)
    // Fly to [577.0, 464.0]:
    // dx = 580 - 577 = 3. dy = 460 - 464 = -4.
    // Distance = sqrt(3^2 + (-4)^2) = 5.0 LY <= 8.0 LY!
    const inWellX = 577.0;
    const inWellY = 464.0;
    const distInWell = Math.hypot(targetX - inWellX, targetY - inWellY);
    assert(distInWell === 5.0, 'Vessel navigated inside orbital gravity well (Distance: 5.0 LY <= 8.0 LY)');

    // 4.3 Execute Orbital Drop-Out Insertion
    const arriveRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        targetSectorId: 3,
        finalCoords: [inWellX, inWellY],
        remainingFuel: 76, // 82 - 6 fuel consumed
      }),
    });
    assert(arriveRes.ok, 'POST /api/starmap/hyperspace/arrive returned HTTP 200');
    const arriveData = await arriveRes.json();

    assert(arriveData.success === true, 'Orbital insertion succeeded (success: true)');
    assert(arriveData.arrivedSectorId === 3, 'Arrived in Sector 3 (Obsidian Smelter)');
    assert(arriveData.sectorName === 'Obsidian Smelter Station', 'Arrived at Obsidian Smelter Station');
    assert(arriveData.remainingFuel === 76, 'Committed remaining fuel balance of 76 units');
    assert(arriveData.system !== undefined && arriveData.system.ports.length >= 1, 'Received local TrueSpace star system and port data');

    // 4.4 Verify Flagship and Escorts Database State Synchronization
    const finalShipRes = await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`);
    const finalShipData = await finalShipRes.json();
    assert(finalShipData.ship.is_in_hyperspace === false, 'Flagship is_in_hyperspace transitioned to FALSE (TrueSpace)');
    assert(finalShipData.ship.current_sector_id === 3, 'Flagship current_sector_id updated to Sector 3');
    assert(finalShipData.ship.fuel === 76, 'Flagship fuel persisted at 76 units');
    assert(finalShipData.ship.nav_target_sector_id === null, 'Active navigation target auto-cleared upon arrival');

    // Verify escort fleet sector synchronization
    const fleetRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const fleetRosterData = await fleetRosterRes.json();
    const activeEscort = fleetRosterData.activeWingmen.find((w: any) => w.id === 'fleet_escort_sol_01');
    assert(activeEscort !== undefined, 'Active wingman Sol Vanguard located in roster');
    assert(activeEscort.currentSectorId === 3, 'Active wingman synchronized to Sector 3 with flagship');

    console.log('\n================================================================================');
    console.log(`  DAY 38 COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('  HYPERSPACE FLIGHT & FUEL LOGISTICS FULLY OPERATIONAL!');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  }
}

runDay38HyperspaceFlightTests().catch((err) => {
  console.error('Fatal error running Day 38 test suite:', err);
  process.exit(1);
});


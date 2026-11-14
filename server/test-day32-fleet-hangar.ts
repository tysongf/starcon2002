/**
 * Day 32 Integration Test Suite: Fleet Hangar Bay, Command Bridge Scaling & Upkeep Logistics
 * Milestone 0.8: Fleet Command & Task Force Operations
 *
 * Verifies:
 * 1. Initial Fleet Roster: Standard single-escort capacity (Tier 1), 1 active Sol Cruiser, 1 reserve Kryll Runner.
 * 2. Bridge Capacity Gating: Rejecting deployment exceeding active wingman capacity.
 * 3. Outfitting Command Bridge Upgrade: Fitting MOD_BRIDGE_T2 into flagship's MID slot expands capacity to 2 wingmen.
 * 4. Multi-Ship Active Deployment: Successfully deploying second escort into Slot 2.
 * 5. Slot Collision & Eviction: Deploying to an occupied slot cleanly displaces previous occupant to reserve.
 * 6. Callsign Rechristening: Renaming an escort vessel persists across database queries.
 * 7. Operational Fleet Upkeep: Deducting maintenance credits for active deployed wingmen.
 * 8. Vessel Decommission & Scrap: Scrapping a reserve escort yields credits and plasteel alloys.
 * 9. Wingman Recall: Disengaging an active wingman back to hangar reserve.
 * 10. Clean Baseline Reset & Idempotence: Full state restoration upon baseline reset.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay32FleetHangarTests() {
  console.log('================================================================================');
  console.log('🚀 RUNNING DAY 32 INTEGRATION TESTS: FLEET HANGAR & COMMAND BRIDGE SCALING');
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
    console.log('--- Phase 0: Player Baseline & Fleet State Reset ---');
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');
    console.log('  Baseline reset successfully.\n');

    // -------------------------------------------------------------------------
    // Phase 1: Initial Fleet Telemetry & Baseline Capacity
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Initial Fleet Roster & Command Capacity ---');
    const rosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    assert(rosterRes.ok, 'GET /api/fleet/roster returned HTTP 200');
    const rosterData = await rosterRes.json();

    assert(rosterData.success === true, 'Fleet roster request succeeded');
    assert(rosterData.maxWingmen === 1, 'Default Command Bridge grants 1 active wingman (Tier 1)', `Actual: ${rosterData.maxWingmen}`);
    assert(rosterData.bridgeTier === 1, 'Bridge Tier is 1');
    assert(rosterData.activeWingmen.length === 1, 'Exactly 1 active wingman deployed in formation');
    assert(rosterData.reserveShips.length === 1, 'Exactly 1 escort ship in hangar reserve');
    assert(rosterData.fleet.length === 2, 'Total fleet garage holds 2 starships');

    const activeSol = rosterData.activeWingmen[0];
    assert(activeSol.id === 'fleet_escort_sol_01', 'Active wingman is Sol Vanguard Escort Alpha');
    assert(activeSol.deploymentSlot === 1, 'Sol Vanguard assigned to Wingman Slot 1');
    assert(activeSol.hullClass === 'SOL_CRUISER', 'Hull Class is SOL_CRUISER');
    assert(activeSol.specialAbility === 'POINT_DEFENSE', 'Special ability is POINT_DEFENSE');
    assert(activeSol.firepower === 35, 'Firepower is 35 DPS');

    const reserveKryll = rosterData.reserveShips[0];
    assert(reserveKryll.id === 'fleet_escort_kryll_01', 'Reserve escort is Kryll Skrit Shadow Runner');
    assert(reserveKryll.deploymentSlot === null, 'Kryll Shadow Runner in reserve (slot = null)');
    assert(reserveKryll.speed === 85, 'Speed is 85 m/s');
    assert(reserveKryll.specialAbility === 'DECOY_HOLO', 'Special ability is DECOY_HOLO');

    assert(rosterData.upkeepPerCycle === 15, 'Upkeep is 15 Cr/cycle (1 active escort * 15 Cr)');
    console.log('  Starter fleet and capacity verified.\n');

    // -------------------------------------------------------------------------
    // Phase 2: Bridge Capacity Gating
    // -------------------------------------------------------------------------
    console.log('--- Phase 2: Bridge Capacity Enforcement ---');
    const overDeployRes = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_kryll_01',
        slot: 2,
      }),
    });
    assert(overDeployRes.status === 400, 'Assigning to Slot 2 rejected without bridge upgrade (HTTP 400)');
    const overDeployData = await overDeployRes.json();
    assert(
      overDeployData.error.includes('COMMAND_BRIDGE_LIMIT_EXCEEDED'),
      'Error identifies COMMAND_BRIDGE_LIMIT_EXCEEDED',
      `Error: ${overDeployData.error}`
    );
    console.log('  Bridge capacity enforcement verified.\n');

    // -------------------------------------------------------------------------
    // Phase 3: Outfitting Command Bridge Upgrade (Tier 1 -> Tier 2)
    // -------------------------------------------------------------------------
    console.log('--- Phase 3: Outfitting Command Bridge Upgrade (Tier 2) ---');

    // 3.1 Unfit M2 slot
    const unfitRes = await fetch(`${BASE_URL}/api/outfitting/unfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, slot: 'M2' }),
    });
    assert(unfitRes.ok, 'Unfitted module from M2 slot');

    // 3.2 Buy Tactical Operations Bridge Mk.II (MOD_BRIDGE_T2)
    const buyBridgeRes = await fetch(`${BASE_URL}/api/outfitting/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, blueprintId: 'MOD_BRIDGE_T2' }),
    });
    assert(buyBridgeRes.ok, 'Purchased Tactical Operations Bridge Mk.II (MOD_BRIDGE_T2)');

    // 3.3 Find MOD_BRIDGE_T2 in player locker
    const loadoutRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=${PLAYER_ID}`);
    const loadoutData = await loadoutRes.json();
    const bridgeInLocker = loadoutData.locker.find((item: any) => item.blueprintId === 'MOD_BRIDGE_T2');
    assert(!!bridgeInLocker, 'MOD_BRIDGE_T2 located in station locker');

    // 3.4 Fit MOD_BRIDGE_T2 to M2
    const fitRes = await fetch(`${BASE_URL}/api/outfitting/fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, inventoryId: bridgeInLocker.id, slot: 'M2' }),
    });
    assert(fitRes.ok, 'Fitted MOD_BRIDGE_T2 to flagship MID-2 slot');

    // 3.5 Check updated Fleet Roster telemetry
    const upgradedRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const upgradedRoster = await upgradedRosterRes.json();
    assert(upgradedRoster.maxWingmen === 2, 'Command Bridge capacity expanded to 2 active wingmen', `Actual: ${upgradedRoster.maxWingmen}`);
    assert(upgradedRoster.bridgeTier === 2, 'Command Bridge Tier is now 2');
    assert(upgradedRoster.bridgeModuleName === 'Tactical Operations Bridge Mk.II', 'Module name reflects Mk.II Bridge');
    console.log('  Command Bridge upgrade verified.\n');

    // -------------------------------------------------------------------------
    // Phase 4: Multi-Ship Active Wingman Deployment
    // -------------------------------------------------------------------------
    console.log('--- Phase 4: Multi-Ship Active Wingman Deployment ---');
    const deploySlot2Res = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_kryll_01',
        slot: 2,
      }),
    });
    assert(deploySlot2Res.ok, 'POST /api/fleet/assign-slot (Slot 2) returned HTTP 200');
    const deploySlot2Data = await deploySlot2Res.json();
    assert(deploySlot2Data.activeWingmen.length === 2, 'Both wingman slots actively filled');
    assert(deploySlot2Data.reserveShips.length === 0, 'Zero ships remaining in reserve');
    assert(deploySlot2Data.upkeepPerCycle === 30, 'Fleet upkeep scaled to 30 Cr/cycle (2 * 15 Cr)');

    const slot1Ship = deploySlot2Data.activeWingmen.find((s: any) => s.deploymentSlot === 1);
    const slot2Ship = deploySlot2Data.activeWingmen.find((s: any) => s.deploymentSlot === 2);
    assert(slot1Ship.id === 'fleet_escort_sol_01', 'Slot 1 occupied by Sol Cruiser');
    assert(slot2Ship.id === 'fleet_escort_kryll_01', 'Slot 2 occupied by Kryll Runner');
    console.log('  Two-ship wingman deployment verified.\n');

    // -------------------------------------------------------------------------
    // Phase 5: Slot Collision & Eviction Handling
    // -------------------------------------------------------------------------
    console.log('--- Phase 5: Slot Collision & Eviction Handling ---');
    // Assign Kryll Runner into Slot 1 (where Sol Cruiser is currently deployed)
    const swapRes = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_kryll_01',
        slot: 1,
      }),
    });
    assert(swapRes.ok, 'Reassigning Kryll to Slot 1 returned HTTP 200');
    const swapData = await swapRes.json();
    assert(swapData.activeWingmen.length === 1, 'Active wingmen count is now 1');
    assert(swapData.reserveShips.length === 1, 'Evicted ship moved into hangar reserve');

    const newSlot1 = swapData.activeWingmen[0];
    const newReserve = swapData.reserveShips[0];
    assert(newSlot1.id === 'fleet_escort_kryll_01', 'Kryll Runner now holds Slot 1');
    assert(newReserve.id === 'fleet_escort_sol_01', 'Sol Cruiser was cleanly evicted to reserve');
    console.log('  Slot collision and eviction verified.\n');

    // -------------------------------------------------------------------------
    // Phase 6: Escort Callsign Rechristening (Rename)
    // -------------------------------------------------------------------------
    console.log('--- Phase 6: Escort Callsign Rechristening ---');
    const renameRes = await fetch(`${BASE_URL}/api/fleet/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_sol_01',
        name: 'Sol Invictus Heavy Escort',
      }),
    });
    assert(renameRes.ok, 'POST /api/fleet/rename returned HTTP 200');
    const renameData = await renameRes.json();
    assert(renameData.ship.name === 'Sol Invictus Heavy Escort', 'Ship name updated in database');

    const checkRosterRename = await (await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`)).json();
    const renamedShip = checkRosterRename.reserveShips.find((s: any) => s.id === 'fleet_escort_sol_01');
    assert(renamedShip.name === 'Sol Invictus Heavy Escort', 'Updated name persisted in fleet roster');
    console.log('  Callsign rechristening verified.\n');

    // -------------------------------------------------------------------------
    // Phase 7: Operational Fleet Upkeep Processing
    // -------------------------------------------------------------------------
    console.log('--- Phase 7: Operational Fleet Upkeep Processing ---');
    const creditsBefore = (await (await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`)).json()).credits;
    const upkeepRes = await fetch(`${BASE_URL}/api/fleet/upkeep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(upkeepRes.ok, 'POST /api/fleet/upkeep returned HTTP 200');
    const upkeepData = await upkeepRes.json();
    assert(upkeepData.activeWingmenCount === 1, 'Processed upkeep for 1 active wingman');
    assert(upkeepData.upkeepCost === 15, 'Deducted 15 Credits upkeep');
    assert(upkeepData.remainingCredits === creditsBefore - 15, 'Credits deducted from pilot treasury');
    console.log('  Operational fleet upkeep verified.\n');

    // -------------------------------------------------------------------------
    // Phase 8: Vessel Decommission & Scrap Recovery
    // -------------------------------------------------------------------------
    console.log('--- Phase 8: Vessel Decommission & Scrap Recovery ---');
    const scrapRes = await fetch(`${BASE_URL}/api/fleet/scrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_sol_01',
      }),
    });
    assert(scrapRes.ok, 'POST /api/fleet/scrap returned HTTP 200');
    const scrapData = await scrapRes.json();
    assert(scrapData.creditsRecovered === 200, 'Recovered +200 Credits scrap value');
    assert(scrapData.alloysRecovered === 5, 'Recovered +5 units Plasteel Alloys');

    // Verify ship removed from roster
    const postScrapRoster = await (await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`)).json();
    assert(postScrapRoster.fleet.length === 1, 'Total fleet count decreased from 2 -> 1');
    assert(postScrapRoster.reserveShips.length === 0, 'Reserve hangar is now empty');
    console.log('  Vessel decommissioning and scrap recovery verified.\n');

    // -------------------------------------------------------------------------
    // Phase 9: Recall Wingman to Reserve
    // -------------------------------------------------------------------------
    console.log('--- Phase 9: Recall Wingman to Reserve ---');
    const recallRes = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_kryll_01',
        slot: null,
      }),
    });
    assert(recallRes.ok, 'Recalled Kryll Runner to reserve (slot = null)');
    const recallData = await recallRes.json();
    assert(recallData.activeWingmen.length === 0, 'Active wingmen count is now 0');
    assert(recallData.reserveShips.length === 1, 'Kryll Runner safely docked in reserve hangar');
    assert(recallData.upkeepPerCycle === 0, 'Upkeep drops to 0 Cr/cycle when no wingmen are active');
    console.log('  Wingman recall verified.\n');

    // -------------------------------------------------------------------------
    // Phase 10: Clean Baseline Reset & Idempotence
    // -------------------------------------------------------------------------
    console.log('--- Phase 10: Clean Baseline Reset & Idempotence ---');
    const finalResetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(finalResetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');

    const finalRoster = await (await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`)).json();
    assert(finalRoster.fleet.length === 2, 'Fleet restored to canonical 2 starter ships');
    assert(finalRoster.activeWingmen.length === 1, 'Slot 1 restored to Sol Vanguard Escort Alpha');
    assert(finalRoster.reserveShips.length === 1, 'Reserve restored to Kryll Skrit Shadow Runner');
    assert(finalRoster.maxWingmen === 1, 'Command capacity restored to baseline 1');
    console.log('  Fleet baseline reset verified.\n');

    console.log('================================================================================');
    console.log(`  DAY 32 VERIFICATION COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('  FLEET HANGAR, COMMAND BRIDGE SCALING & UPKEEP FULLY OPERATIONAL!');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('Fatal failure in Day 32 Fleet Hangar tests:', err);
    process.exit(1);
  }
}

runDay32FleetHangarTests();


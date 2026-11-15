import './test-utils/authHelper';
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING DAY 19 COLONY INFRASTRUCTURE & MINING TEST SUITE ---');

  // 0. Setup: Ensure player has credits & clean survey/colony state
  const creditRes = await fetch(`${BASE_URL}/api/player/debug-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: 'acc_sol_captain', amount: 5000 }),
  });
  assert.equal(creditRes.status, 200, 'Debug credits setup should succeed');

  const resetRes = await fetch(`${BASE_URL}/api/player/debug-reset-survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', planetId: 'planet_sec1_aegis' }),
  });
  assert.equal(resetRes.status, 200, 'Survey & colony reset should succeed');

  // 1. Plant an initial probe beacon on Aegis Prime
  console.log('[Test 1] Deploy surface probe to establish beacon on Aegis Prime...');
  const probeRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      targetLat: 18.5,
      targetLng: -44.0,
      shieldBoost: true,
    }),
  });
  assert.equal(probeRes.status, 200);
  const probeData = await probeRes.json();
  assert.ok(probeData.beaconId, 'Probe should plant a beacon');
  const beaconId = probeData.beaconId;
  console.log(` -> Planted Beacon: ${beaconId} [Lat: 18.5°, Lng: -44.0°]`);

  // 2. Query planet colonies (initially 0)
  console.log('[Test 2] Query existing colonies on Aegis Prime...');
  const initColRes = await fetch(`${BASE_URL}/api/colonies/planet/planet_sec1_aegis`);
  assert.equal(initColRes.status, 200);
  const initColData = await initColRes.json();
  assert.equal(initColData.colonies.length, 0, 'No colonies should exist initially');

  // 3. Found Colony Outpost anchored at beacon
  console.log('[Test 3] Found Colony Outpost anchored at beacon...');
  const foundRes = await fetch(`${BASE_URL}/api/colonies/found`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      planetId: 'planet_sec1_aegis',
      beaconId: beaconId,
      name: 'Aegis Base Prime',
    }),
  });
  assert.equal(foundRes.status, 200, 'Founding colony should return 200');
  const foundData = await foundRes.json();
  assert.ok(foundData.success);
  const colony = foundData.colony;
  assert.equal(colony.name, 'Aegis Base Prime');
  assert.equal(colony.beaconId, beaconId);
  assert.equal(colony.commodityId, 'COMM_ORE');
  assert.equal(colony.derrickTier, 1);
  assert.equal(colony.habitationTier, 1);
  assert.equal(colony.terraformerTier, 1);
  assert.equal(colony.siloTier, 1);
  assert.equal(colony.siloCapacity, 50);
  assert.equal(colony.population, 120);
  console.log(` -> Colony Founded! ID: ${colony.id}, Pop: ${colony.population}, Silo: ${colony.stockpiledAmount}/${colony.siloCapacity}`);

  // 4. Duplicate colony founding attempt at same beacon is blocked
  console.log('[Test 4] Verify duplicate founding at same beacon is blocked...');
  const dupRes = await fetch(`${BASE_URL}/api/colonies/found`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      planetId: 'planet_sec1_aegis',
      beaconId: beaconId,
      name: 'Duplicate Colony',
    }),
  });
  assert.equal(dupRes.status, 400);
  const dupData = await dupRes.json();
  assert.ok(dupData.error.includes('BEACON_ALREADY_OCCUPIED'), 'Error should state BEACON_ALREADY_OCCUPIED');
  console.log(` -> Correctly Rejected: "${dupData.error}"`);

  // 5. Query Colony Detail with production accrual
  console.log('[Test 5] Query Colony Detail and verify telemetry & production...');
  const detRes = await fetch(`${BASE_URL}/api/colonies/${colony.id}`);
  assert.equal(detRes.status, 200);
  const detData = await detRes.json();
  assert.ok(detData.success);
  assert.ok(detData.colony.productionRatePerMinute > 0, 'Production rate should be positive');
  console.log(` -> Telemetry Verified: Rate = ${detData.colony.productionRatePerMinute} units/min, Stockpile = ${detData.colony.stockpiledAmount}/${detData.colony.siloCapacity}`);

  // 6. Upgrade Extraction Derrick to Tier 2 (station Miner + Merchant specialists per Milestone 1.5 gating)
  console.log('[Test 6] Station Colony Specialists & Upgrade Extraction Derrick to Tier 2...');
  await fetch(`${BASE_URL}/api/crew/debug-seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', specialties: ['Miner'], assignColonyId: colony.id }),
  });
  await fetch(`${BASE_URL}/api/crew/debug-seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', specialties: ['Merchant'], assignColonyId: colony.id }),
  });
  const upDerrickRes = await fetch(`${BASE_URL}/api/colonies/${colony.id}/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      facilityType: 'DERRICK',
    }),
  });
  assert.equal(upDerrickRes.status, 200);
  const upDerrickData = await upDerrickRes.json();
  assert.ok(upDerrickData.success);
  assert.equal(upDerrickData.colony.derrickTier, 2, 'Derrick tier should now be 2');
  assert.ok(upDerrickData.colony.productionRatePerMinute > detData.colony.productionRatePerMinute, 'Tier 2 derrick should have higher production rate');
  console.log(` -> Derrick Upgraded to Tier 2! New Rate = ${upDerrickData.colony.productionRatePerMinute} units/min`);

  // 7. Upgrade Logistics Silo to Tier 2
  console.log('[Test 7] Upgrade Logistics Silo to Tier 2 (capacity 250)...');
  const upSiloRes = await fetch(`${BASE_URL}/api/colonies/${colony.id}/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      facilityType: 'SILO',
    }),
  });
  assert.equal(upSiloRes.status, 200);
  const upSiloData = await upSiloRes.json();
  assert.ok(upSiloData.success);
  assert.equal(upSiloData.colony.siloTier, 2);
  assert.equal(upSiloData.colony.siloCapacity, 250, 'Tier 2 silo should have 250 capacity');
  console.log(` -> Logistics Silo Upgraded to Tier 2! Capacity = ${upSiloData.colony.siloCapacity} units`);

  // 8. Harvest stockpiled commodities into ship cargo
  console.log('[Test 8] Harvest stockpiled commodities into ship cargo hold...');
  const harvestRes = await fetch(`${BASE_URL}/api/colonies/${colony.id}/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain' }),
  });
  assert.equal(harvestRes.status, 200);
  const harvestData = await harvestRes.json();
  assert.ok(harvestData.success);
  assert.ok(harvestData.harvestedAmount > 0, 'Harvested amount should be > 0');
  assert.equal(harvestData.colony.stockpiledAmount, 0, 'Silo should be emptied after harvest');
  console.log(` -> Harvest Successful: Transferred ${harvestData.harvestedAmount}x ${harvestData.commodityName} to ship hold!`);

  // 9. Verify immediate second harvest is rejected (empty silo)
  console.log('[Test 9] Verify immediate second harvest is rejected...');
  const emptyRes = await fetch(`${BASE_URL}/api/colonies/${colony.id}/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain' }),
  });
  assert.equal(emptyRes.status, 400);
  const emptyData = await emptyRes.json();
  assert.ok(emptyData.error.includes('NO_STOCKPILED_CARGO'), 'Error should state NO_STOCKPILED_CARGO');
  console.log(` -> Correctly Rejected: "${emptyData.error}"`);

  console.log('--- ALL DAY 19 BACKEND TESTS PASSED (100%) ---');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

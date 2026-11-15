import './test-utils/authHelper';
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING DAY 18 PLANETARY SURVEY & PROBE TEST SUITE ---');

  // 0. Ensure player has credits & AP for testing
  const creditRes = await fetch(`${BASE_URL}/api/player/debug-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: 'acc_sol_captain', amount: 1000 }),
  });
  assert.equal(creditRes.status, 200, 'Player debug credits endpoint should succeed');

  // Reset survey state for idempotent runs
  const resetRes = await fetch(`${BASE_URL}/api/player/debug-reset-survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', planetId: 'planet_sec1_aegis' }),
  });
  assert.equal(resetRes.status, 200, 'Survey reset endpoint should succeed');

  // 1. Fetch Sector 1 Planets
  console.log('[Test 1] Query Sector 1 Planets...');
  const sec1Res = await fetch(`${BASE_URL}/api/planets/sector/1`);
  assert.equal(sec1Res.status, 200, 'GET /api/planets/sector/1 should return 200');
  const sec1Data = await sec1Res.json();
  assert.ok(sec1Data.success, 'Response should indicate success');
  assert.ok(Array.isArray(sec1Data.planets), 'Planets should be an array');
  assert.ok(sec1Data.planets.length >= 1, 'Sector 1 should contain at least 1 planet');

  const aegis = sec1Data.planets[0];
  console.log(` -> Found Planet: ${aegis.name} (${aegis.id}), Class: ${aegis.mainClass} (${aegis.subtype}), Radius: ${aegis.radius}`);
  assert.equal(aegis.id, 'planet_sec1_aegis', 'Planet ID should be planet_sec1_aegis');
  assert.equal(aegis.mainClass, 'METALLIC_ORE', 'Aegis Prime should be METALLIC_ORE main class');
  assert.equal(aegis.subtype, 'Auric Lode', 'Aegis Prime should be Auric Lode subtype');
  assert.equal(aegis.habitabilityRating, 18, 'Aegis Prime habitability should be 18%');

  // 2. Query Planet Detail
  console.log('[Test 2] Query Planet Detail...');
  const detRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis`);
  assert.equal(detRes.status, 200, 'GET /api/planets/planet_sec1_aegis should return 200');
  const detData = await detRes.json();
  assert.ok(detData.success);
  assert.ok(detData.planet.survey, 'Planet should have a survey state');
  console.log(` -> Initial Survey Completion: ${detData.planet.survey.surveyCompletion}%`);

  // 3. Perform Mineral Scanner Sweep
  console.log('[Test 3] Execute Mineral Scanner Sweep...');
  const scanMinRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', scanBand: 'MINERALS' }),
  });
  assert.equal(scanMinRes.status, 200, 'POST /scan MINERALS should succeed');
  const scanMinData = await scanMinRes.json();
  assert.ok(scanMinData.success);
  assert.equal(scanMinData.scanBand, 'MINERALS');
  assert.ok(scanMinData.newlyDiscovered.length > 0, 'Should discover mineral hotspots');
  assert.ok(scanMinData.totalCompletion >= 33, 'Total completion should be at least 33%');
  console.log(` -> Mineral Hotspots Discovered: ${scanMinData.newlyDiscovered.length}, Completion: ${scanMinData.totalCompletion}%`);

  // 4. Perform Bio & Anomaly Sweeps
  console.log('[Test 4] Execute Bio & Anomaly Scanner Sweeps...');
  const scanBioRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', scanBand: 'BIO' }),
  });
  assert.equal(scanBioRes.status, 200);

  const scanAnoRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', scanBand: 'ANOMALIES' }),
  });
  assert.equal(scanAnoRes.status, 200);
  const scanAnoData = await scanAnoRes.json();
  assert.equal(scanAnoData.totalCompletion, 100, 'All 3 sweeps should bring completion to 100%');
  console.log(` -> Full Survey Completion Reached: ${scanAnoData.totalCompletion}%`);

  // 5. Deploy Atmospheric Probe with Shield Reinforcement
  console.log('[Test 5] Deploy Atmospheric Probe with Heat Shield Boost...');
  const probeRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      targetLat: 14.5,
      targetLng: -42.8,
      shieldBoost: true,
    }),
  });
  assert.equal(probeRes.status, 200, 'POST /probe should return 200');
  const probeData = await probeRes.json();
  assert.ok(probeData.success);
  assert.ok(probeData.probeIntegrity > 80, 'Shielded probe should retain > 80% integrity');
  assert.ok(probeData.beaconId, 'Probe should plant a persistent beacon');
  assert.ok(probeData.sampledCargo.quantity > 0, 'Probe should sample cargo');
  console.log(` -> Probe Touchdown Success! Hull: ${probeData.probeIntegrity}%, Beacon: ${probeData.beaconId}`);
  console.log(` -> Sampled: ${probeData.sampledCargo.quantity}x ${probeData.sampledCargo.name}`);

  // 6. Sell Astrometry Cartography Data
  console.log('[Test 6] Sell Planetary Survey Data at Station Astrometry Bureau...');
  const sellRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/sell-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      portId: 'PORT_AEGIS_01',
    }),
  });
  assert.equal(sellRes.status, 200, 'POST /sell-data should return 200');
  const sellData = await sellRes.json();
  assert.ok(sellData.success);
  assert.ok(sellData.creditsEarned >= 1000, '100% survey data with faction bonus should award >= 1000 Credits');
  assert.equal(sellData.reputationBonus, 15, 'Should grant agreed +15 goodwill');
  console.log(` -> Remittance Accepted: +${sellData.creditsEarned} CR, +${sellData.apEarned} AP, +${sellData.reputationBonus} Goodwill with ${sellData.factionId}`);

  // 7. Verify Duplicate Sale is Blocked
  console.log('[Test 7] Verify Duplicate Survey Sale is Rejected...');
  const dupRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/sell-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      portId: 'PORT_AEGIS_01',
    }),
  });
  assert.equal(dupRes.status, 400, 'Duplicate sale should return 400');
  const dupData = await dupRes.json();
  assert.ok(dupData.error.includes('DATA_ALREADY_SOLD'), 'Error should state DATA_ALREADY_SOLD');
  console.log(` -> Correctly Rejected: "${dupData.error}"`);

  console.log('--- ALL DAY 18 BACKEND TESTS PASSED (100%) ---');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

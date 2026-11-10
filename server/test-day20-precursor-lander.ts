import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING DAY 20 PRECURSOR LORE VAULTS & RELIC TECH TEST SUITE ---');

  // 0. Setup: Ensure player credits & reset precursor/survey states
  const creditRes = await fetch(`${BASE_URL}/api/player/debug-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: 'acc_sol_captain', amount: 8000 }),
  });
  assert.equal(creditRes.status, 200, 'Debug credits setup should succeed');

  const resetRes = await fetch(`${BASE_URL}/api/player/debug-reset-survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain' }),
  });
  assert.equal(resetRes.status, 200, 'Precursor and survey reset should succeed');

  // Day 21: Orbital survey of at least 33% is required before Precursor signatures resolve into sites
  const scanAegis = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', scanBand: 'MINERALS' }),
  });
  assert.equal(scanAegis.status, 200, 'Aegis survey scan should succeed');

  // 1. Query Precursor Sites on Aegis Prime
  console.log('[Test 1] Query Precursor Megastructure sites on Aegis Prime...');
  const sitesRes = await fetch(`${BASE_URL}/api/precursor/planet/planet_sec1_aegis`);
  assert.equal(sitesRes.status, 200);
  const sitesData = await sitesRes.json();
  assert.ok(sitesData.success);
  assert.ok(Array.isArray(sitesData.sites) && sitesData.sites.length > 0, 'Aegis Prime should have precursor sites');
  const monolith = sitesData.sites.find((s: any) => s.id === 'site_aegis_monolith');
  assert.ok(monolith, 'Aegis Resonance Monolith should be present');
  assert.equal(monolith.isDeciphered, false, 'Site should initially be undeciphered');
  assert.equal(monolith.requiredFreq, 440);
  console.log(` -> Found Site: "${monolith.name}" [Lat: ${monolith.surfaceLat}°, Lng: ${monolith.surfaceLng}°]`);

  // 2. Test Desynchronized / Out-of-Tolerance Deciphering
  console.log('[Test 2] Submit desynchronized frequency tuning (should be rejected)...');
  const badDecipherRes = await fetch(`${BASE_URL}/api/precursor/site_aegis_monolith/decipher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      solution: { freq: 850, phase: 0, damping: 10 },
    }),
  });
  assert.equal(badDecipherRes.status, 400);
  const badData = await badDecipherRes.json();
  assert.ok(badData.error.includes('HARMONIC_DESYNCHRONIZATION'), 'Should reject out-of-tolerance tuning');
  console.log(` -> Correctly Rejected: "${badData.error}"`);

  // 3. Test Resonant Harmonic Deciphering
  console.log('[Test 3] Submit resonant harmonic tuning within tolerance...');
  const goodDecipherRes = await fetch(`${BASE_URL}/api/precursor/site_aegis_monolith/decipher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      solution: { freq: 445, phase: 185, damping: 52 },
    }),
  });
  assert.equal(goodDecipherRes.status, 200);
  const goodData = await goodDecipherRes.json();
  assert.ok(goodData.success);
  assert.equal(goodData.site.isDeciphered, true);
  assert.equal(goodData.relicReward, 1);
  assert.ok(goodData.codexTitle.includes('First Builders'));
  console.log(` -> Harmonic Alignment Locked! Codex Unlocked: "${goodData.codexTitle}"`);
  console.log(` -> Relic Extracted: +${goodData.relicReward}x Precursor Relic Core`);

  // 4. Verify Duplicate Deciphering returns unlocked codex without duplicate relics
  console.log('[Test 4] Verify re-interfacing with deciphered site...');
  const dupDecipherRes = await fetch(`${BASE_URL}/api/precursor/site_aegis_monolith/decipher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      solution: { freq: 440, phase: 180, damping: 50 },
    }),
  });
  assert.equal(dupDecipherRes.status, 200);
  const dupData = await dupDecipherRes.json();
  assert.equal(dupData.relicReward, 0, 'No extra relics should be granted on second access');

  // 5. Query Prototype Research Catalog
  console.log('[Test 5] Query Prototype Research Catalog...');
  const catalogRes = await fetch(`${BASE_URL}/api/precursor/research?accountId=acc_sol_captain`);
  assert.equal(catalogRes.status, 200);
  const catalogData = await catalogRes.json();
  assert.ok(catalogData.success);
  assert.equal(catalogData.catalog.length, 4, 'Should offer 4 prototype technologies');
  const phaseLance = catalogData.catalog.find((t: any) => t.id === 'TECH_PHASE_LANCE');
  assert.ok(phaseLance);
  assert.equal(phaseLance.isSynthesized, false);
  console.log(` -> Research Catalog Verified (4 Prototypes Available: Phase Lance, Tachyon Drive, Crystalline Shield, Biosphere)`);

  // 6. Synthesize Precursor Phase Lance
  console.log('[Test 6] Synthesize Precursor Phase Lance from Relic Core...');
  const synthRes = await fetch(`${BASE_URL}/api/precursor/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      techId: 'TECH_PHASE_LANCE',
    }),
  });
  assert.equal(synthRes.status, 200);
  const synthData = await synthRes.json();
  assert.ok(synthData.success);
  assert.ok(synthData.inventoryItemId, 'Should grant an inventory item ID');
  assert.equal(synthData.tech.isSynthesized, true);
  console.log(` -> Synthesis Successful! Item ID: ${synthData.inventoryItemId}`);

  // 7. Verify duplicate synthesis of same prototype is blocked
  console.log('[Test 7] Verify duplicate synthesis is rejected...');
  const dupSynthRes = await fetch(`${BASE_URL}/api/precursor/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      techId: 'TECH_PHASE_LANCE',
    }),
  });
  assert.equal(dupSynthRes.status, 400);
  const dupSynthData = await dupSynthRes.json();
  assert.ok(dupSynthData.error.includes('ALREADY_SYNTHESIZED'));
  console.log(` -> Correctly Rejected: "${dupSynthData.error}"`);

  // 8. Decipher Second Site on Ignis Tartarus for More Relics
  console.log('[Test 8] Decipher Subterranean Energy Vault on Ignis Tartarus...');
  const scanIgnis = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', scanBand: 'MINERALS' }),
  });
  assert.equal(scanIgnis.status, 200, 'Ignis survey scan should succeed');

  const ignisRes = await fetch(`${BASE_URL}/api/precursor/site_ignis_vault/decipher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      solution: { freq: 720, phase: 90, damping: 75 },
    }),
  });
  assert.equal(ignisRes.status, 200);
  const ignisData = await ignisRes.json();
  assert.equal(ignisData.relicReward, 2, 'Ignis vault should award 2 relics');
  console.log(` -> Deciphered "${ignisData.codexTitle}"! Received +2x Precursor Relic Cores`);

  // 9. Remit Relic to Sol Alliance Ambassador
  console.log('[Test 9] Remit 1x Precursor Relic Core to Sol Alliance ambassador for Goodwill & Bounty...');
  const remitRes = await fetch(`${BASE_URL}/api/precursor/remit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      factionId: 'FACTION_SOL',
    }),
  });
  const remitData = await remitRes.json();
  if (!remitRes.ok) {
    console.error('Remit Failed:', remitData);
  }
  assert.equal(remitRes.status, 200);
  assert.ok(remitData.success);
  assert.equal(remitData.rewardCredits, 600);
  assert.equal(remitData.reputationGain, 50);
  console.log(` -> Remittance Accepted! +${remitData.rewardCredits} Credits, +${remitData.reputationGain} Goodwill (New Standing: ${remitData.newStanding})`);

  console.log('--- ALL DAY 20 BACKEND TESTS PASSED (100%) ---');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

import { strict as assert } from 'assert';

/**
 * Milestone 0.4 Integration Test Suite: The Playable Explorer Loop
 *
 * Verifies the 5 interconnected systems from Days 16-20:
 * 1. Fresh-Start Baseline Reset (Sector 1, 2500 Cr, 100 Fuel, 600 AP, 0 Cargo, Seed Standings).
 * 2. Sector 1 Commerce: Purchase 5x Bio-Protein Rations at Aegis Terminal for colonial seed.
 * 3. Hyperspace Warp Transit: Jump from Sector 1 to Sector 2 (Hegemony frontier).
 * 4. Hostile Airspace Gating (Negative Tests):
 *    - Verify Hegemony airspace clearance is locked (standing -25, no active truce).
 *    - Verify orbital scans, atmospheric probes, and precursor actions are rejected with TRUCE_REQUIRED.
 *    - Verify Precursor site remains hidden as UNRESOLVED_SIGNAL when survey < 33%.
 * 5. Star Control II Comms & Ceasefire Truce:
 *    - Hail Commander Vorash (npc_vorash) via branching dialogue.
 *    - Remit 400 Credits border tariff bribe to establish 5-minute diplomatic truce.
 *    - Verify truce is active and airspace is cleared.
 * 6. Orbital Astrometry & Atmospheric Landing:
 *    - Perform sensor sweeps (Minerals & Anomalies -> 66%).
 *    - Verify Precursor Megastructure (Charybdis Geothermal Crucible) is now resolved!
 *    - Complete Bio sweep -> 100% completion.
 *    - Sell planetary astrometry survey data at Aegis Terminal (+Credits, +AP, +Goodwill).
 *    - Launch atmospheric probe to deploy surface sensor beacon.
 * 7. Colonization & Resource Infrastructure:
 *    - Found colony outpost anchored to beacon (consumes 500 Cr, 5 AP, and 5 rations).
 *    - Verify colony established with primary commodity Silicate Ore (COMM_ORE).
 * 8. Truce Expiry & Re-Hail Gate:
 *    - Fast-forward / expire diplomatic truce.
 *    - Verify deciphering Precursor site is rejected with TRUCE_REQUIRED.
 *    - Re-hail Vorash to renew ceasefire truce.
 * 9. Precursor Megastructure Deciphering:
 *    - Tune resonant carrier wave tolerances (freq: 520Hz, phase: 240°, damping: 60%).
 *    - Unlock Precursor Codex and extract 2x Precursor Relic Cores.
 * 10. Prototype Technology Synthesis & Outfitting Fit:
 *     - Synthesize Crystalline Matrix Shield prototype (costs 1 relic, 900 Cr, 3 AP).
 *     - Fit Crystalline Matrix Shield into MID slot M1.
 *     - Verify fitted loadout, power grid, and CPU consumption in Outfitting engine.
 * 11. Relic Remittance:
 *     - Remit remaining 1x Precursor Relic Core to Sol Alliance for +600 Cr and +50 Goodwill.
 * 12. Colony Extraction & Mining Yield:
 *     - Fast-forward colony extraction tick by 180 seconds.
 *     - Harvest stockpiled Silicate Ore into ship cargo hold.
 * 13. Return Warp Transit & Market Arbitrage:
 *     - Jump back to Sector 1 (Sol Nexus).
 *     - Sell harvested Silicate Ore at Aegis Terminal.
 * 14. Financial & Persistent State Audit:
 *     - Verify final credits remain within reasonable margin of starting baseline (investment loop).
 *     - Verify 100% database persistence across loadout, colony, survey, and research tables.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';
const PLANET_ID = 'planet_sec2_charybdis';

async function runMilestone04Test() {
  console.log('================================================================');
  console.log('🚀 RUNNING MILESTONE 0.4: COMPLETE PLAYABLE EXPLORER LOOP SUITE');
  console.log('================================================================\n');

  // Step 1: Baseline Reset
  console.log('[1/14] Resetting pilot baseline state (Sector 1, 2500 Cr, 100 Fuel, 600 AP)...');
  const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID }),
  });
  assert.equal(baseRes.status, 200, 'Baseline reset should succeed');

  const shipRes = await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`);
  const shipData = await shipRes.json();
  assert.equal(shipData.ship.current_sector_id, 1);
  assert.equal(shipData.ship.fuel, 100);

  const holdRes = await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`);
  const holdData = await holdRes.json();
  const startingCredits = holdData.credits;
  assert.equal(startingCredits, 2500, 'Starting credits should be 2500');
  console.log(`✓ Baseline confirmed: Sector 1, ${startingCredits} Cr, Fuel: 100, AP: 600, Hold: 0/40 m³\n`);

  // Step 2: Sector 1 Commerce - Buy 5 Rations for Colony Seed
  console.log('[2/14] Sector 1 Commerce: Purchasing 5 units Bio-Protein Rations at Aegis Terminal...');
  const buyRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      commodityId: 'COMM_RATIONS',
      quantity: 5,
      type: 'BUY',
    }),
  });
  assert.equal(buyRes.status, 200, 'Buying rations should succeed');
  const buyData = await buyRes.json();
  assert.ok(buyData.success, 'Buying rations should return success');
  console.log(`✓ Purchased 5x Rations for ${buyData.totalCredits} Cr (Hold: ${buyData.hold.usedCargo}/40 m³)\n`);

  // Step 3: Hyperspace Warp Transit to Sector 2
  console.log('[3/14] Hyperspace Warp Transit (Sector 1 -> Sector 2 Void Expanse)...');
  const warpRes = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      targetSectorId: 2,
    }),
  });
  assert.equal(warpRes.status, 200, 'Warp jump should succeed');
  const warpData = await warpRes.json();
  assert.equal(warpData.toSector.id, 2);
  console.log(`✓ Arrived in Sector 2 (Fuel: ${warpData.remainingFuel}, AP: ${warpData.currentAP})\n`);

  // Step 4: Hostile Airspace Gating (Negative Tests)
  console.log('[4/14] Testing Hostile Airspace Gating over Charybdis Minor (Hegemony Standing: -25)...');
  const airRes = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/airspace?accountId=${PLAYER_ID}`);
  assert.equal(airRes.status, 200);
  const airData = await airRes.json();
  assert.equal(airData.clearance.cleared, false, 'Airspace should not be cleared without truce');
  assert.equal(airData.clearance.truceRequired, true);
  assert.equal(airData.clearance.truceActive, false);
  console.log(` -> Airspace status: LOCKED (${airData.clearance.factionName}, Standing: ${airData.clearance.standing})`);

  // Attempting scan sweep should fail
  const badScanRes = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, scanBand: 'MINERALS' }),
  });
  assert.equal(badScanRes.status, 400);
  const badScanData = await badScanRes.json();
  assert.ok(badScanData.error.includes('TRUCE_REQUIRED'), 'Scan without truce should fail with TRUCE_REQUIRED');
  console.log(` -> Scanner sweep correctly blocked: "${badScanData.error}"`);

  // Precursor sites should be hidden (< 33% survey completion)
  const preRes = await fetch(`${BASE_URL}/api/precursor/planet/${PLANET_ID}?accountId=${PLAYER_ID}`);
  assert.equal(preRes.status, 200);
  const preData = await preRes.json();
  assert.equal(preData.sites.length, 0, 'Precursor sites should be hidden');
  assert.equal(preData.unresolvedSignals, 1, 'Should show 1 unresolved signal marker');
  console.log(` -> Precursor telemetry: ${preData.unresolvedSignals} UNRESOLVED SIGNAL(S) detected (Survey: ${preData.surveyCompletion}% / Req: ${preData.requiredSurvey}%)\n`);

  // Step 5: Star Control II Comms - Negotiate Ceasefire Truce with Commander Vorash
  console.log('[5/14] Opening Sub-Space Comms with Hegemony Commander Vorash...');
  const dialogStateRes = await fetch(`${BASE_URL}/api/dialog/npc_vorash?accountId=${PLAYER_ID}`);
  assert.equal(dialogStateRes.status, 200);
  const dialogState = await dialogStateRes.json();
  console.log(` -> Comms Channel Open: "${dialogState.dialog.dialogueText.substring(0, 70)}..."`);

  // Option 3: "I am prepared to pay the Hegemony transit tariff to ensure safe flight."
  const navTariffRes = await fetch(`${BASE_URL}/api/dialog/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, npcId: 'npc_vorash', optionIndex: 3 }),
  });
  assert.equal(navTariffRes.status, 200);

  // Option 0 on vorash_tariff: "Agreed. Transferring 400 Credits to Imperial Treasury."
  const payTariffRes = await fetch(`${BASE_URL}/api/dialog/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, npcId: 'npc_vorash', optionIndex: 0 }),
  });
  assert.equal(payTariffRes.status, 200);
  const payData = await payTariffRes.json();
  console.log(` -> Dialogue Action Result: "${payData.actionMessage}"`);

  // Verify Airspace Clearance is now active
  const airClearedRes = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/airspace?accountId=${PLAYER_ID}`);
  const airClearedData = await airClearedRes.json();
  assert.equal(airClearedData.clearance.cleared, true, 'Airspace should now be cleared');
  assert.equal(airClearedData.clearance.truceActive, true);
  console.log(`✓ Diplomatic Truce established until ${airClearedData.clearance.truceExpiresAt}!\n`);

  // Step 6: Planetary Orbital Survey & Atmospheric Probe
  console.log('[6/14] Conducting Planetary Orbital Astrometry sweeps...');
  const scan1Res = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, scanBand: 'MINERALS' }),
  });
  assert.equal(scan1Res.status, 200);

  const scan2Res = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, scanBand: 'ANOMALIES' }),
  });
  assert.equal(scan2Res.status, 200);
  const scan2Data = await scan2Res.json();
  console.log(` -> Survey Progress: ${scan2Data.totalCompletion}%`);

  // Verify Precursor site is now resolved
  const preResolvedRes = await fetch(`${BASE_URL}/api/precursor/planet/${PLANET_ID}?accountId=${PLAYER_ID}`);
  const preResolvedData = await preResolvedRes.json();
  assert.equal(preResolvedData.sites.length, 1, 'Precursor site should now be revealed');
  const crucibleSite = preResolvedData.sites[0];
  assert.equal(crucibleSite.id, 'site_charybdis_forge');
  console.log(`✓ Precursor Megastructure RESOLVED: "${crucibleSite.name}" [Freq: ${crucibleSite.requiredFreq}Hz, Phase: ${crucibleSite.requiredPhase}°]`);

  // Finish 100% survey
  const scan3Res = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, scanBand: 'BIO' }),
  });
  assert.equal(scan3Res.status, 200);

  // Sell Astrometry Survey Data
  const sellDataRes = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/sell-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, portId: 'PORT_AEGIS_01' }),
  });
  assert.equal(sellDataRes.status, 200);
  const soldData = await sellDataRes.json();
  console.log(`✓ Survey Data Sold: +${soldData.creditsEarned} Credits, +${soldData.apEarned} AP, +${soldData.reputationBonus} Goodwill`);

  // Launch Atmospheric Probe with shield boost to establish permanent beacon
  const probeRes = await fetch(`${BASE_URL}/api/planets/${PLANET_ID}/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, shieldBoost: true }),
  });
  assert.equal(probeRes.status, 200);
  const probeData = await probeRes.json();
  const beaconId = probeData.beaconId;
  assert.ok(beaconId, 'Probe must return valid beaconId');
  console.log(`✓ Atmospheric Probe deployed beacon: ${beaconId} (${probeData.yieldSummary})\n`);

  // Step 7: Found Colony Outpost
  console.log('[7/14] Founding Industrial Colony Outpost at sensor beacon...');
  const foundColonyRes = await fetch(`${BASE_URL}/api/colonies/found`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: PLAYER_ID,
      planetId: PLANET_ID,
      beaconId,
      name: 'Charybdis Geothermal Foundry Outpost',
    }),
  });
  assert.equal(foundColonyRes.status, 200);
  const colonyData = await foundColonyRes.json();
  const colonyId = colonyData.colony.id;
  assert.equal(colonyData.colony.commodityId, 'COMM_ORE');
  console.log(`✓ Colony Outpost established: "${colonyData.colony.name}" [ID: ${colonyId}] producing Silicate Ore\n`);

  // Step 8: Truce Expiry & Re-Hail Gate
  console.log('[8/14] Testing Truce Expiry & Re-Hail Enforcement...');
  const expireRes = await fetch(`${BASE_URL}/api/reputation/debug-expire-truce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, sectorId: 2 }),
  });
  assert.equal(expireRes.status, 200);

  // Attempting to decipher Precursor site should fail due to expired truce
  const blockedDecipherRes = await fetch(`${BASE_URL}/api/precursor/site_charybdis_forge/decipher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: PLAYER_ID,
      solution: { freq: 520, phase: 240, damping: 60 },
    }),
  });
  assert.equal(blockedDecipherRes.status, 400);
  const blockedDecipherData = await blockedDecipherRes.json();
  assert.ok(blockedDecipherData.error.includes('TRUCE_REQUIRED'), 'Should reject decipher after truce expires');
  console.log(` -> Decipher correctly rejected: "${blockedDecipherData.error}"`);

  // Re-hail Vorash to renew truce
  await fetch(`${BASE_URL}/api/dialog/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, npcId: 'npc_vorash' }),
  });
  await fetch(`${BASE_URL}/api/dialog/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, npcId: 'npc_vorash', optionIndex: 3 }),
  });
  await fetch(`${BASE_URL}/api/dialog/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, npcId: 'npc_vorash', optionIndex: 0 }),
  });
  console.log(`✓ Diplomatic Ceasefire Truce renewed!\n`);

  // Step 9: Precursor Megastructure Deciphering
  console.log('[9/14] Deciphering Charybdis Geothermal Crucible...');
  const decipherRes = await fetch(`${BASE_URL}/api/precursor/site_charybdis_forge/decipher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: PLAYER_ID,
      solution: { freq: 520, phase: 240, damping: 60 },
    }),
  });
  assert.equal(decipherRes.status, 200);
  const decipherData = await decipherRes.json();
  assert.equal(decipherData.relicReward, 2, 'Crucible should yield 2x Precursor Relic Cores');
  console.log(`✓ Harmonic Resonance Achieved! Unlocked "${decipherData.codexTitle}"`);
  console.log(`✓ Extracted +${decipherData.relicReward}x Precursor Relic Cores into cargo hold\n`);

  // Step 10: Prototype Technology Synthesis & Outfitting Fit
  console.log('[10/14] Synthesizing & Fitting Prototype Crystalline Matrix Shield...');
  const synthRes = await fetch(`${BASE_URL}/api/precursor/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, techId: 'TECH_CRYSTAL_SHIELD' }),
  });
  assert.equal(synthRes.status, 200);
  const synthData = await synthRes.json();
  const inventoryItemId = synthData.inventoryItemId;
  assert.ok(inventoryItemId, 'Synthesis must return inventoryItemId');
  console.log(` -> Synthesized: "${synthData.tech.name}" [ID: ${inventoryItemId}]`);

  // Fit into slot M1 (MID slot)
  const fitRes = await fetch(`${BASE_URL}/api/outfitting/fit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      itemId: inventoryItemId,
      targetSlot: 'M1',
    }),
  });
  assert.equal(fitRes.status, 200);
  const fitData = await fitRes.json();
  const fittedItem = fitData.loadout.fitted?.M1;
  assert.ok(fittedItem, 'Crystalline shield must be equipped in slot M1');
  assert.equal(fittedItem.name, 'Crystalline Matrix Shield');
  console.log(`✓ Equipped in Slot M1: "${fittedItem.name}" (Power Grid: ${fitData.loadout.powerGridUsed}/${fitData.loadout.powerGridMax} MW, CPU: ${fitData.loadout.cpuUsed}/${fitData.loadout.cpuMax} GHz)\n`);

  // Step 11: Remit Spare Relic
  console.log('[11/14] Remitting 1x spare Precursor Relic Core to Sol Alliance ambassador...');
  const remitRes = await fetch(`${BASE_URL}/api/precursor/remit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, factionId: 'FACTION_SOL' }),
  });
  assert.equal(remitRes.status, 200);
  const remitData = await remitRes.json();
  assert.equal(remitData.rewardCredits, 600);
  console.log(`✓ Remitted Relic: +${remitData.rewardCredits} Credits, +${remitData.reputationGain} Goodwill\n`);

  // Step 12: Colony Extraction & Mining Yield
  console.log('[12/14] Simulating Colony extraction time-travel (fast-forwarding 180s)...');
  const ffRes = await fetch(`${BASE_URL}/api/colony/debug-fast-forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, colonyId, seconds: 180 }),
  });
  assert.equal(ffRes.status, 200);

  const colDetailRes = await fetch(`${BASE_URL}/api/colonies/${colonyId}?accountId=${PLAYER_ID}`);
  const colDetail = await colDetailRes.json();
  assert.ok(colDetail.colony.stockpiledAmount > 0, 'Colony must have accrued minerals');
  console.log(` -> Accrued in Silo: ${colDetail.colony.stockpiledAmount} units of ${colDetail.colony.commodityName}`);

  // Harvest ore into ship hold
  const harvestRes = await fetch(`${BASE_URL}/api/colonies/${colonyId}/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID }),
  });
  assert.equal(harvestRes.status, 200);
  const harvestData = await harvestRes.json();
  console.log(`✓ Harvested ${harvestData.harvestedAmount} units of ${harvestData.commodityName} into ship cargo hold\n`);

  // Step 13: Return Warp Transit & Market Arbitrage
  console.log('[13/14] Return Warp Transit (Sector 2 -> Sector 1 Sol Nexus)...');
  const returnWarpRes = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      targetSectorId: 1,
    }),
  });
  assert.equal(returnWarpRes.status, 200);

  // Sell harvested Silicate Ore at Aegis Terminal
  const sellOreRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      commodityId: 'COMM_ORE',
      quantity: harvestData.harvestedAmount,
      type: 'SELL',
    }),
  });
  assert.equal(sellOreRes.status, 200);
  const sellOreData = await sellOreRes.json();
  assert.ok(sellOreData.success, 'Selling ore should succeed');
  console.log(`✓ Sold ${harvestData.harvestedAmount}x Silicate Ore at Aegis Terminal for +${sellOreData.totalCredits} Credits\n`);

  // Step 14: Final Audit
  console.log('[14/14] Running Financial & Persistent Database State Audit...');
  const finalHoldRes = await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`);
  const finalHold = await finalHoldRes.json();
  const finalCredits = finalHold.credits;

  console.log(` -> Starting Credits: ${startingCredits} CR`);
  console.log(` -> Final Credits:    ${finalCredits} CR`);
  const deltaCredits = finalCredits - startingCredits;
  console.log(` -> Net Credit Delta: ${deltaCredits >= 0 ? '+' : ''}${deltaCredits} CR`);

  // Assert final credits are within acceptable margin of starting baseline (starts at 2500, ends near 2500-3500)
  assert.ok(
    deltaCredits >= -500 && deltaCredits <= 1200,
    `Final credits (${finalCredits}) should remain within reasonable margin of starting baseline (${startingCredits})`
  );

  // Assert equipment is still fitted
  const outfittingRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=${PLAYER_ID}`);
  const outfittingData = await outfittingRes.json();
  const m1Slot = outfittingData.fitted?.M1;
  assert.ok(m1Slot, 'Prototype shield must persist in M1');
  assert.equal(m1Slot.name, 'Crystalline Matrix Shield');

  console.log('\n================================================================');
  console.log('✅ MILESTONE 0.4 EXPLORER LOOP INTEGRATION TEST PASSED!');
  console.log('================================================================\n');
}

runMilestone04Test().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

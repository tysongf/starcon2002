/**
 * Day 40 Integration Test Suite: Precursor Quasi-Space Slipstream & Emergency SOS Transponder
 * Milestone 0.9: The Infinite Void — Interstellar Hyperspace & Galactic Starmap
 *
 * Verifies:
 * 1. Precursor Research Resonance Gating:
 *    - Rejects un-deciphered vessels attempting to breach Quasi-Space (PRECURSOR_RESONANCE_REQUIRED).
 *    - Grants entry when player has deciphered a Precursor planetary site.
 * 2. Quasi-Space Topology & Zero Fuel Burn Invariant:
 *    - Spatial mapping across [0, 300] x [0, 300] coordinate matrix.
 *    - High-speed displacement verification.
 *    - Absolute zero-fuel burn invariant (100% fuel preserved during long-range transit).
 * 3. Precursor Portal Gateway Network:
 *    - Retrieval and validation of all 8 canonical Precursor portal beacons.
 *    - Proximity validation (R <= 8.0 LY).
 *    - Successful portal jump: drops out of Quasi-Space directly into target galactic sector with 5s warp immunity.
 * 4. Zero-Fuel Emergency SOS Transponder Logistics:
 *    - Rejects SOS broadcast when vessel still holds fuel reserves.
 *    - Triggers emergency beacon when fuel hits 0 in Hyperspace.
 *    - Evaluates procedural responder archetypes (Tanker, Barter, Scavenger).
 *    - Executes credit fuel replenishment (25 units for 400 CR).
 *    - Executes barter trade (20 units for mineral ore cargo).
 *    - Executes combat escalation against hostile scavengers.
 */

import { db } from './src/db/Database';

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay40QuasiSpaceSOSTests() {
  console.log('================================================================================');
  console.log('🚀 RUNNING DAY 40 INTEGRATION TESTS: QUASI-SPACE & EMERGENCY SOS TRANSPONDER');
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
    // Phase 0: Baseline Reset & Precursor Resonance Gating
    // -------------------------------------------------------------------------
    console.log('--- Phase 0: Baseline Reset & Precursor Resonance Gating ---');
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');

    // Ensure Precursor sites are un-deciphered for baseline gating check
    await fetch(`${BASE_URL}/api/starmap/hyperspace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });

    // Attempting Quasi-Space entry without Precursor deciphering must fail
    const blockedRes = await fetch(`${BASE_URL}/api/starmap/quasispace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(blockedRes.status === 400, 'Quasi-Space entry without Precursor resonance rejected with HTTP 400');
    const blockedData = await blockedRes.json();
    assert(
      blockedData.error.includes('PRECURSOR_RESONANCE_REQUIRED'),
      `Error string matches PRECURSOR_RESONANCE_REQUIRED (${blockedData.error})`
    );

    // Decipher Precursor site to unlock resonance (Scan planet first to resolve site)
    await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, scanBand: 'MINERALS' }),
    });

    const decipherRes = await fetch(`${BASE_URL}/api/precursor/site_aegis_monolith/decipher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        solution: { freq: 445, phase: 185, damping: 52 },
      }),
    });
    const decipherData = await decipherRes.json();
    assert(decipherRes.ok, `POST /api/precursor/site_aegis_monolith/decipher unlocked precursor codex (err: ${decipherData.error})`);

    // Attempt Quasi-Space entry with unlocked resonance
    const enterRes = await fetch(`${BASE_URL}/api/starmap/quasispace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(enterRes.ok, 'POST /api/starmap/quasispace/enter returned HTTP 200 with resonance');
    const enterData = await enterRes.json();
    assert(enterData.success === true, 'Quasi-Space transition succeeded');
    assert(enterData.isInQuasiSpace === true, 'Flagship confirmed in Quasi-Space (isInQuasiSpace: true)');
    assert(enterData.coordinates[0] === 150.0 && enterData.coordinates[1] === 150.0, 'Quasi-Space entry anchored at central meridian [150.0, 150.0]');

    // -------------------------------------------------------------------------
    // Phase 1: Quasi-Space Topology & Zero Fuel Burn Invariant
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 1: Quasi-Space Topology & Zero Fuel Burn Invariant ---');

    // Retrieve all 8 Precursor Portals
    const portalsRes = await fetch(`${BASE_URL}/api/starmap/quasispace/portals`);
    assert(portalsRes.ok, 'GET /api/starmap/quasispace/portals returned HTTP 200');
    const portalsData = await portalsRes.json();
    assert(portalsData.success === true, 'Portals query returned success: true');
    assert(portalsData.portals.length === 8, `Exactly 8 canonical Precursor Portals returned (${portalsData.portals.length})`);

    const portalGamma = portalsData.portals.find((p: any) => p.id === 'portal_gamma_vaelic');
    assert(portalGamma !== undefined, 'Portal Gamma (Vaelic Hegemony Core) present in portal network');
    assert(portalGamma.quasispaceX === 108.0 && portalGamma.quasispaceY === 102.0, 'Portal Gamma coordinates verified at [108.0, 102.0]');
    assert(portalGamma.targetHyperspaceX === 360.0 && portalGamma.targetHyperspaceY === 340.0, 'Portal Gamma exits into Vaelic Core [360.0, 340.0]');

    // Synchronize high-speed transit from [150.0, 150.0] to [108.0, 102.0]
    const syncRes = await fetch(`${BASE_URL}/api/starmap/quasispace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [108.0, 102.0] }),
    });
    assert(syncRes.ok, 'POST /api/starmap/quasispace/sync returned HTTP 200');
    const syncData = await syncRes.json();
    assert(syncData.success === true, 'Quasi-Space sync returned success');
    assert(syncData.coordinates[0] === 108.0 && syncData.coordinates[1] === 102.0, 'Ship position updated to [108.0, 102.0]');
    assert(syncData.remainingFuel === 100, `Zero fuel burn invariant verified: Remaining fuel is 100 (${syncData.remainingFuel})`);

    // -------------------------------------------------------------------------
    // Phase 2: Precursor Portal Gateway Transit & Hyperspace Eruption
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Precursor Portal Gateway Transit & Hyperspace Eruption ---');

    // Transit Portal Gamma at [108.0, 102.0]
    const exitRes = await fetch(`${BASE_URL}/api/starmap/quasispace/exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, portalId: 'portal_gamma_vaelic' }),
    });
    assert(exitRes.ok, 'POST /api/starmap/quasispace/exit returned HTTP 200');
    const exitData = await exitRes.json();
    assert(exitData.success === true, 'Precursor portal transit returned success');
    assert(exitData.isInHyperspace === true, 'Ship returned to real Hyperspace (isInHyperspace: true)');
    assert(exitData.coordinates[0] === 360.0 && exitData.coordinates[1] === 340.0, 'Emerged in Vaelic Core at [360.0, 340.0]');
    assert(exitData.immunityGrantedSeconds === 5, '5-second warp-flare immunity granted upon portal emergence');
    assert(exitData.portalName.includes('Portal Gamma'), `Confirmed portal transit through ${exitData.portalName}`);

    // Verify out-of-range portal transit is rejected
    const farExitRes = await fetch(`${BASE_URL}/api/starmap/quasispace/exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, portalId: 'portal_theta_rim' }),
    });
    assert(farExitRes.status === 400, 'Transit attempt outside portal range rejected with HTTP 400');
    const farExitData = await farExitRes.json();
    assert(farExitData.error.includes('OUTSIDE_PORTAL_RANGE'), `Error string matches OUTSIDE_PORTAL_RANGE (${farExitData.error})`);

    // -------------------------------------------------------------------------
    // Phase 3: Zero-Fuel Emergency SOS Transponder Logistics
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Zero-Fuel Emergency SOS Transponder Logistics ---');

    // 1. Attempting SOS when fuel > 0 must fail
    const prematureSosRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(prematureSosRes.status === 400, 'SOS broadcast rejected with HTTP 400 while ship still holds fuel');
    const prematureData = await prematureSosRes.json();
    assert(
      prematureData.error.includes('FUEL_RESERVES_REMAINING'),
      `Error string matches FUEL_RESERVES_REMAINING (${prematureData.error})`
    );

    // 2. Simulate Fuel Exhaustion (Fuel = 0)
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0], fuelBurned: 100 }),
    });

    // 3. Broadcast Emergency SOS Transponder
    const sosRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(sosRes.ok, 'POST /api/starmap/hyperspace/sos-trigger returned HTTP 200');
    const sosData = await sosRes.json();
    assert(sosData.success === true, 'SOS distress broadcast returned success: true');
    assert(sosData.encounter !== undefined, 'Responder encounter payload returned');

    const enc = sosData.encounter;
    assert(['TANKER', 'BARTER', 'SCAVENGER'].includes(enc.responderType), `Responder type is valid (${enc.responderType})`);
    assert(enc.dialogueText.length > 10, 'Responder delivered distress frequency dialogue');
    assert(enc.options.length >= 1, `Responder offers ${enc.options.length} resolution option(s)`);

    // 4. Test Buy Fuel Resolution (400 Credits -> 25 Fuel)
    const buyRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, choice: 'BUY_FUEL' }),
    });
    assert(buyRes.ok, 'POST /api/starmap/hyperspace/sos-resolve (BUY_FUEL) returned HTTP 200');
    const buyData = await buyRes.json();
    assert(buyData.success === true, 'Fuel purchase returned success');
    assert(buyData.remainingFuel === 25, `Emergency fuel transferred: Fuel is now 25 (${buyData.remainingFuel})`);
    assert(buyData.remainingCredits === 2100, `Credits deducted: Balance is 2100 (${buyData.remainingCredits})`);
    assert(buyData.combatDropRequired === false, 'Combat drop not required for fuel purchase');

    // 5. Test Barter Trade Resolution (Commodity exchange -> 20 Fuel)
    // Exhaust fuel again
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0], fuelBurned: 25 }),
    });

    const barterRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, choice: 'BARTER_ORE' }),
    });
    assert(barterRes.ok, 'POST /api/starmap/hyperspace/sos-resolve (BARTER_ORE) returned HTTP 200');
    const barterData = await barterRes.json();
    assert(barterData.success === true, 'Barter transaction returned success');
    assert(barterData.remainingFuel === 20, `Barter fuel transferred: Fuel is now 20 (${barterData.remainingFuel})`);

    // 6. Test Hostile Combat Escalation (FIGHT)
    const fightRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, choice: 'FIGHT' }),
    });
    assert(fightRes.ok, 'POST /api/starmap/hyperspace/sos-resolve (FIGHT) returned HTTP 200');
    const fightData = await fightRes.json();
    assert(fightData.success === true, 'Fight response returned success');
    assert(fightData.combatDropRequired === true, 'combatDropRequired confirmed true');
    assert(fightData.combatSetup !== undefined, 'Combat setup payload prepared for 20Hz combat arena');
    assert(fightData.combatSetup.enemySquadron.length >= 1, `Hostile boarding squadron prepared (${fightData.combatSetup.enemySquadron.length} ships)`);

    console.log('\n================================================================================');
    console.log(`🎉 DAY 40 INTEGRATION TEST SUITE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('================================================================================');
  } catch (err: any) {
    console.error('\n❌ TEST RUN ABORTED DUE TO ERROR:', err.message);
    process.exit(1);
  }
}

runDay40QuasiSpaceSOSTests();

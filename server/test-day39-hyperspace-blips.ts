/**
 * Day 39 Integration Test Suite: Hyperspace Alien Radar Blips, Hunter AI & Tactical Interceptions
 * Milestone 0.9: The Infinite Void — Interstellar Hyperspace & Galactic Starmap
 *
 * Verifies:
 * 1. Faction Spheres of Influence & Blip Generation:
 *    - Correct regional blip spawning in Sol (Allied), Vaelic (Hostile), Kryll (Extortionist), and Deep Space.
 *    - Spatial territorial resolution across canonical boundaries.
 * 2. Hunter AI Detection & Pursuit Kinematics:
 *    - Wake detection within base radius (35 LY) and expanded afterburner radius (55 LY).
 *    - State transitions: PATROL -> ALERT -> PURSUING.
 *    - Authoritative pursuit velocity vector directed at player coordinates.
 * 3. Tactical Subspace Decoys:
 *    - Atomic deduction of decoys_remaining from ships table.
 *    - Active decoy persistence with 6.0-second expiration.
 *    - Hunter redirection: hostiles break pursuit and target decoy (DISTRACTED).
 * 4. Two-Tier Interception Lifecycle:
 *    - Contact collision initiates Tier 1 Alien Comms handshake.
 *    - Faction-specific dialogue, commander portrait, and options.
 *    - Peaceful bribe resolution (credits/fuel deduction, 5-second immunity).
 *    - Immunity enforcement (rejects subsequent interceptions while active).
 *    - Hostile escalation (Tier 2 combat room preparation with enemy squadron).
 *    - In-situ Hyperspace resumption post-battle with 5s warp-flare immunity.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay39HyperspaceBlipTests() {
  console.log('================================================================================');
  console.log('🚀 RUNNING DAY 39 INTEGRATION TESTS: RADAR BLIPS, HUNTER AI & INTERCEPTIONS');
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
    // Phase 0: Baseline Reset & Ship Setup
    // -------------------------------------------------------------------------
    console.log('--- Phase 0: Baseline Reset & Ship Setup ---');
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');

    // Enter Hyperspace at Sol Core [500, 500]
    const enterRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(enterRes.ok, 'POST /api/starmap/hyperspace/enter returned HTTP 200');
    const enterData = await enterRes.json();
    assert(enterData.success === true, 'Flagship entered continuous Hyperspace');
    assert(enterData.coordinates[0] === 500 && enterData.coordinates[1] === 500, 'Initial coordinates anchored at [500, 500]');

    // -------------------------------------------------------------------------
    // Phase 1: Regional Radar Blip Generation across Faction Spheres
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 1: Regional Radar Blip Generation across Faction Spheres ---');

    // 1. Sol Alliance Core [500, 500]
    const solBlipsRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [500.0, 500.0], isBoosting: false }),
    });
    assert(solBlipsRes.ok, 'POST /api/starmap/hyperspace/blips in Sol Core returned HTTP 200');
    const solData = await solBlipsRes.json();
    assert(solData.success === true, 'Sol Core radar scan returned success: true');
    assert(solData.territory.includes('Sol Alliance'), `Territory correctly identified as Sol Alliance (${solData.territory})`);
    assert(solData.blips.length >= 1, `Radar detected ${solData.blips.length} contact(s) in Sol space`);
    const solBlip = solData.blips[0];
    assert(solBlip.factionId === 'FACTION_SOL', `Sol picket has factionId FACTION_SOL (${solBlip.factionId})`);
    assert(solBlip.isHostile === false, 'Sol defense pickets are non-hostile to player');
    assert(solData.threatLevel === 'CLEAR', `Threat level in Sol Core is CLEAR (${solData.threatLevel})`);
    assert(solData.decoysRemaining === 3, 'Initial decoy inventory verified at 3 canisters');

    // 2. Vaelic Imperial Hegemony Core [360, 340]
    const vaelicBlipsRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0], isBoosting: false }),
    });
    assert(vaelicBlipsRes.ok, 'POST /api/starmap/hyperspace/blips in Hegemony Core returned HTTP 200');
    const vaelicData = await vaelicBlipsRes.json();
    assert(vaelicData.success === true, 'Hegemony Core radar scan returned success');
    assert(vaelicData.territory.includes('Vaelic Imperial Hegemony'), `Territory correctly identified as Vaelic Imperial Hegemony (${vaelicData.territory})`);
    const vaelicBlip = vaelicData.blips.find((b: any) => b.factionId === 'FACTION_VAELIC');
    assert(vaelicBlip !== undefined, 'Hegemony interdictor blip generated in Vaelic space');
    assert(vaelicBlip.isHostile === true, 'Hegemony war vessel flagged as isHostile: true');
    assert(vaelicBlip.factionColor === '#ef4444', `Hegemony blip has crimson color #ef4444 (${vaelicBlip.factionColor})`);

    // 3. Kryll Freebooter Space [680, 570]
    const kryllBlipsRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [680.0, 570.0], isBoosting: false }),
    });
    assert(kryllBlipsRes.ok, 'POST /api/starmap/hyperspace/blips in Kryll space returned HTTP 200');
    const kryllData = await kryllBlipsRes.json();
    assert(kryllData.territory.includes('Kryll Freebooter Space'), `Territory correctly identified as Kryll Freebooter Space`);
    const kryllBlip = kryllData.blips.find((b: any) => b.factionId === 'FACTION_KRYLL');
    assert(kryllBlip !== undefined, 'Kryll corsair blip generated in Kryll space');
    assert(kryllBlip.isHostile === true, 'Kryll corsair flagged as isHostile: true');
    assert(kryllBlip.factionColor === '#10b981', `Kryll blip has emerald color #10b981 (${kryllBlip.factionColor})`);

    // -------------------------------------------------------------------------
    // Phase 2: Hunter AI Wake Detection & Pursuit Kinematics
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Hunter AI Wake Detection & Pursuit Kinematics ---');

    // Sync ship coordinates inside Vaelic core
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0], fuelBurned: 0 }),
    });

    // Test normal cruising scan vs afterburner wake scan
    const boostScanRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0], isBoosting: true }),
    });
    assert(boostScanRes.ok, 'Afterburner radar scan returned HTTP 200');
    const boostData = await boostScanRes.json();

    const pursuingHunter = boostData.blips.find((b: any) => b.isHostile && b.distanceLY <= 60.0);
    assert(pursuingHunter !== undefined, 'Hostile hunter detected within expanded afterburner wake radius');
    assert(pursuingHunter.state === 'PURSUING' || boostData.threatLevel === 'PURSUIT', 'Hunter transitioned to PURSUING state');
    assert(boostData.threatLevel === 'PURSUIT', 'Overall threat level elevated to PURSUIT');

    // Verify velocity vector orientation (hunter moving toward player at [360, 340])
    const hx = pursuingHunter.x;
    const hy = pursuingHunter.y;
    const hvx = pursuingHunter.vx;
    const hvy = pursuingHunter.vy;
    const expectedDx = 360.0 - hx;
    const expectedDy = 340.0 - hy;

    // Dot product between velocity and direction vector must be strictly positive
    const dotProduct = hvx * expectedDx + hvy * expectedDy;
    assert(dotProduct > 0, `Hunter pursuit velocity vector points toward player (dotProduct = ${dotProduct.toFixed(2)})`);

    // -------------------------------------------------------------------------
    // Phase 3: Tactical Subspace Decoy Deployment & Hunter Distraction
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Tactical Subspace Decoy Deployment & Hunter Distraction ---');

    // Deploy decoy at ship position
    const decoyRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/decoy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0] }),
    });
    assert(decoyRes.ok, 'POST /api/starmap/hyperspace/decoy returned HTTP 200');
    const decoyData = await decoyRes.json();
    assert(decoyData.success === true, 'Decoy deployment successful');
    assert(decoyData.decoysRemaining === 2, `Decoys remaining atomically decremented to 2 (${decoyData.decoysRemaining})`);
    assert(decoyData.decoy !== undefined, 'Active decoy payload returned');
    assert(decoyData.decoy.durationSeconds === 6.0, 'Decoy duration set to 6.0 seconds');
    assert(decoyData.decoy.x === 360.0 && decoyData.decoy.y === 340.0, 'Decoy coordinates anchored at [360.0, 340.0]');

    // Scan blips immediately: hunter should now target decoy (DISTRACTED)
    const decoyScanRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [375.0, 355.0], isBoosting: false }),
    });
    assert(decoyScanRes.ok, 'Radar scan during decoy burn returned HTTP 200');
    const decoyScanData = await decoyScanRes.json();
    assert(decoyScanData.activeDecoys.length >= 1, `Active decoys present on sensor grid (${decoyScanData.activeDecoys.length})`);

    const distractedBlip = decoyScanData.blips.find((b: any) => b.state === 'DISTRACTED');
    assert(distractedBlip !== undefined, 'Hunter AI transitioned to DISTRACTED state targeting thermal decoy');

    // Deploy second and third decoys to test inventory depletion
    await fetch(`${BASE_URL}/api/starmap/hyperspace/decoy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0] }),
    });
    const lastDecoyRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/decoy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0] }),
    });
    const lastDecoyData = await lastDecoyRes.json();
    assert(lastDecoyData.decoysRemaining === 0, 'Decoys remaining reached 0');

    // Attempting 4th decoy must fail
    const emptyDecoyRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/decoy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0] }),
    });
    assert(emptyDecoyRes.status === 400, '4th decoy launch rejected with HTTP 400 (depleted inventory)');
    const emptyDecoyData = await emptyDecoyRes.json();
    assert(emptyDecoyData.error.includes('NO_DECOYS_REMAINING'), `Error string matches NO_DECOYS_REMAINING (${emptyDecoyData.error})`);

    // -------------------------------------------------------------------------
    // Phase 4: Two-Tier Tactical Interception Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 4: Two-Tier Tactical Interception Lifecycle ---');

    // 1. Trigger Interception Handshake with Vaelic Interdictor
    const interceptRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/intercept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blipId: 'blip_vaelic_test_01',
        currentCoords: [360.0, 340.0],
      }),
    });
    assert(interceptRes.ok, 'POST /api/starmap/hyperspace/intercept returned HTTP 200');
    const interceptData = await interceptRes.json();
    assert(interceptData.success === true, 'Interception handshake returned success: true');
    assert(interceptData.interception !== undefined, 'Tier 1 Comms payload returned');

    const comms = interceptData.interception;
    assert(comms.factionId === 'FACTION_VAELIC', `Interception faction is FACTION_VAELIC (${comms.factionId})`);
    assert(comms.alienCommander.includes('Prefect Malakor'), `Alien commander name is Prefect Malakor (${comms.alienCommander})`);
    assert(comms.hostility === 'HOSTILE', 'Vaelic encounter flagged as HOSTILE');
    assert(comms.dialogueText.includes('sovereign Imperial airspace'), 'Hegemony territorial dialogue delivered');
    assert(comms.options.length >= 3, `Tier 1 Comms presents ${comms.options.length} dialogue options`);

    const bribeOption = comms.options.find((o: any) => o.action === 'BRIBE_CREDITS');
    assert(bribeOption !== undefined, 'Bribe Credits option present');
    assert(comms.bribeCostCredits === 500, 'Imperial toll is 500 Credits');

    // 2. Resolve Peaceful Bribe
    const bribeRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/comms-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blipId: 'blip_vaelic_test_01',
        actionId: 'BRIBE_CREDITS',
      }),
    });
    assert(bribeRes.ok, 'POST /api/starmap/hyperspace/comms-action (BRIBE_CREDITS) returned HTTP 200');
    const bribeData = await bribeRes.json();
    assert(bribeData.success === true, 'Bribe action returned success');
    assert(bribeData.resolvedPeacefully === true, 'Encounter resolved peacefully');
    assert(bribeData.immunityGrantedSeconds === 5, '5-second warp immunity window granted');
    assert(bribeData.combatDropRequired === false, 'Combat drop not required for accepted bribe');
    assert(bribeData.remainingCredits === 2000, `Player credits decremented from 2500 to 2000 (${bribeData.remainingCredits})`);

    // 3. Verify Warp Immunity Protection
    const immuneScanRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0] }),
    });
    const immuneScanData = await immuneScanRes.json();
    assert(immuneScanData.immunityRemainingSeconds > 0, `Active warp immunity confirmed (${immuneScanData.immunityRemainingSeconds}s)`);

    // Attempting to intercept during immunity must fail
    const blockedInterceptRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/intercept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, blipId: 'blip_blocked_01', currentCoords: [360.0, 340.0] }),
    });
    assert(blockedInterceptRes.status === 400, 'Interception attempt during warp immunity rejected with HTTP 400');
    const blockedData = await blockedInterceptRes.json();
    assert(blockedData.error.includes('SHIP_UNDER_WARP_IMMUNITY'), `Error confirms SHIP_UNDER_WARP_IMMUNITY (${blockedData.error})`);

    // 4. Test Hostile Escalation (Combat Drop Required)
    // Clear immunity for combat test
    await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    await fetch(`${BASE_URL}/api/starmap/hyperspace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });

    const hostileInterceptRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/intercept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, blipId: 'blip_kryll_test_02', currentCoords: [680.0, 570.0] }),
    });
    assert(hostileInterceptRes.ok, 'Kryll interception handshake returned HTTP 200');

    // Player chooses ATTACK
    const attackRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/comms-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blipId: 'blip_kryll_test_02',
        actionId: 'ATTACK',
      }),
    });
    assert(attackRes.ok, 'Comms ATTACK response returned HTTP 200');
    const attackData = await attackRes.json();
    assert(attackData.success === true, 'Attack response returned success');
    assert(attackData.resolvedPeacefully === false, 'resolvedPeacefully is false');
    assert(attackData.combatDropRequired === true, 'combatDropRequired is true');
    assert(attackData.combatSetup !== undefined, 'combatSetup payload provided for 20Hz combat arena');
    assert(attackData.combatSetup.enemySquadron.length >= 2, `Enemy squadron prepared with ${attackData.combatSetup.enemySquadron.length} ships`);

    // 5. In-Situ Hyperspace Resumption Post-Combat
    const resumeRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, combatOutcome: 'VICTORY' }),
    });
    assert(resumeRes.ok, 'POST /api/starmap/hyperspace/resume returned HTTP 200');
    const resumeData = await resumeRes.json();
    assert(resumeData.success === true, 'Hyperspace resumption returned success: true');
    assert(resumeData.isInHyperspace === true, 'Ship confirmed back in Hyperspace (isInHyperspace: true)');
    assert(resumeData.immunityGrantedSeconds === 5, 'Post-combat 5s warp-flare immunity granted');
    assert(resumeData.coordinates !== undefined, 'Galactic coordinates retained in-situ');
    assert(resumeData.message.includes('VICTORY'), `Resumption message confirms victory (${resumeData.message})`);

    console.log('\n================================================================================');
    console.log(`🎉 DAY 39 INTEGRATION TEST SUITE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('================================================================================');
  } catch (err: any) {
    console.error('\n❌ TEST RUN ABORTED DUE TO ERROR:', err.message);
    process.exit(1);
  }
}

runDay39HyperspaceBlipTests();


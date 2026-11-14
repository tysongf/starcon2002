/**
 * server/test-milestone-0.9.ts
 * 
 * GRAND CAPSTONE INTEGRATION SUITE: MILESTONE 0.9
 * "The Infinite Void — Interstellar Hyperspace & Galactic Starmap"
 * 
 * Comprehensive End-to-End Verification of the 8-Phase Galactic Odyssey:
 * Phase 1: Environmental Baseline Reset, Fleet Command Mobilization & Galactic Starmap Waypoint Locking
 * Phase 2: Long-Range Interstellar Hyperspace Warp Transit & Escort Multiplier Fuel Logistics
 * Phase 3: Faction Sphere of Influence Incursion, Radar Blip Tracking & Thermal Decoy Evasion
 * Phase 4: Tactical Interception, Comms Hail & 20Hz Task Force Combat Arena Drop
 * Phase 5: TrueSpace Gravity Well Orbital Insertion & Planetary Survey
 * Phase 6: Precursor Quasi-Space Slipstream Dimensional Breach & 0-Fuel Portal Transit
 * Phase 7: Fuel Starvation Emergency SOS Distress Transponder Logistics
 * Phase 8: Safe Haven Return & Grand Capstone Expedition Telemetry Audit
 */

import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runMilestone09GrandCapstone() {
  console.log('================================================================================');
  console.log('  MILESTONE 0.9 GRAND CAPSTONE: THE INFINITE VOID — HYPERSPACE & STARMAP');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string, extra?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}${extra ? ` (${extra})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}${extra ? ` (${extra})` : ''}`);
      throw new Error(`Capstone assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Baseline Reset, Fleet Command Mobilization & Waypoint Locking
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Baseline Reset, Fleet Mobilization & Starmap Waypoint Locking ---');

    // 1.1 Reset baseline environment
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'Reset pilot and ship to fresh baseline');

    // 1.2 Seed credits and AP
    const credRes = await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, credits: 25000 }),
    });
    assert(credRes.ok, 'Seeded 25,000 Credits for galactic expedition');

    const apRes = await fetch(`${BASE_URL}/api/player/ap/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, amount: 600 }),
    });
    assert(apRes.ok, 'Seeded 600 Action Points (AP)');

    // 1.3 Upgrade Command Bridge to Tier 2 (MOD_BRIDGE_T2) to enable 2 active escorts
    await fetch(`${BASE_URL}/api/outfitting/unfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, slot: 'M2' }),
    });

    const buyBridgeRes = await fetch(`${BASE_URL}/api/outfitting/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, blueprintId: 'MOD_BRIDGE_T2' }),
    });
    assert(buyBridgeRes.ok, 'Purchased Tactical Operations Bridge Mk.II (MOD_BRIDGE_T2)');

    const lockerRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=${PLAYER_ID}`);
    const lockerData = await lockerRes.json();
    const bridgeItem = lockerData.locker.find((i: any) => i.blueprintId === 'MOD_BRIDGE_T2');
    assert(!!bridgeItem, 'Located MOD_BRIDGE_T2 in player station locker');

    const fitBridgeRes = await fetch(`${BASE_URL}/api/outfitting/fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, inventoryId: bridgeItem.id, slot: 'M2' }),
    });
    assert(fitBridgeRes.ok, 'Fitted MOD_BRIDGE_T2 to flagship MID-2 slot');

    // 1.4 Deploy 2 combat escorts to slots 1 & 2
    const rosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const rosterData = await rosterRes.json();
    assert(rosterData.maxWingmen >= 2, `Command Bridge capacity confirmed at ${rosterData.maxWingmen} wingmen`);

    const solShip = rosterData.fleet.find((s: any) => s.hullClass === 'SOL_CRUISER');
    const kryllShip = rosterData.fleet.find((s: any) => s.hullClass === 'KRYLL_RUNNER');
    assert(!!solShip && !!kryllShip, 'Identified Sol Cruiser and Kryll Runner in fleet hangar');

    const assign1 = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: solShip.id, slot: 1 }),
    });
    assert(assign1.ok, 'Assigned Sol Cruiser to Active Wingman Slot 1');

    const assign2 = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: kryllShip.id, slot: 2 }),
    });
    assert(assign2.ok, 'Assigned Kryll Runner to Active Wingman Slot 2');

    // 1.5 Query Starmap Systems
    const sysRes = await fetch(`${BASE_URL}/api/starmap/systems`);
    const sysData = await sysRes.json();
    assert(sysData.success === true, 'GET /api/starmap/systems returned success: true');
    assert(sysData.count >= 60, `Galactic Starmap populated with ${sysData.count} star systems (>= 60)`);

    // 1.6 Fetch Sol-Nexus (Sector 1) details
    const solRes = await fetch(`${BASE_URL}/api/starmap/systems/1`);
    const solData = await solRes.json();
    assert(solData.success === true, 'Fetched Sol Nexus (Sector 1) system telemetry');
    assert(solData.system.coordinatesX === 500.0 && solData.system.coordinatesY === 500.0, 'Sol Nexus anchored at [500.0, 500.0]');

    // 1.7 Plot and lock navigation course to Sector 2 (Void Expanse [535.0, 480.0])
    const plotRes = await fetch(`${BASE_URL}/api/starmap/course/plot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, targetSectorId: 2, lockCourse: true }),
    });
    const plotData = await plotRes.json();
    assert(plotRes.ok && plotData.success === true, 'POST /api/starmap/course/plot returned success: true');
    assert(plotData.activeEscortsCount === 2, 'Course calculation accurately detected 2 active escorts');
    assert(plotData.locked === true, 'Target waypoint locked in navigation computer');
    console.log(`  Target locked: ${plotData.targetName} (${plotData.distanceLY} LY, ${plotData.totalFuelCost} Fuel needed).\n`);

    // -------------------------------------------------------------------------
    // Phase 2: Long-Range Interstellar Hyperspace Warp Transit & Escort Logistics
    // -------------------------------------------------------------------------
    console.log('--- Phase 2: Interstellar Hyperspace Warp Transit & Escort Fuel Logistics ---');

    // 2.1 Enter Hyperspace flight
    const enterHyperRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    const enterHyperData = await enterHyperRes.json();
    assert(enterHyperRes.ok && enterHyperData.success === true, 'POST /api/starmap/hyperspace/enter returned HTTP 200');
    assert(enterHyperData.isInHyperspace === true, 'Flagship confirmed in Hyperspace flight');
    assert(enterHyperData.coordinates[0] === 500.0 && enterHyperData.coordinates[1] === 500.0, 'Subspace entry anchored at [500.0, 500.0]');

    // 2.2 Cruise vector flight from [500, 500] to [420, 440]
    // Displacement: sqrt((500-420)^2 + (500-440)^2) = sqrt(6400 + 3600) = 100.0 LY
    const cruiseCoords: [number, number] = [420.0, 440.0];
    const fuelBurn = 15; // 100 LY * 0.10 base * (1 + 0.25 * 2) = 15 Fuel

    const syncRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: cruiseCoords, fuelBurned: fuelBurn }),
    });
    const syncData = await syncRes.json();
    assert(syncRes.ok && syncData.success === true, 'POST /api/starmap/hyperspace/sync returned HTTP 200');
    assert(syncData.remainingFuel === 85, `Remaining fuel verified at 85 units (100 - 15 burn) [actual: ${syncData.remainingFuel}]`);

    // 2.3 Verify expedition telemetry accumulated displacement
    const expRes1 = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const expData1 = await expRes1.json();
    assert(expData1.success === true, 'GET /api/starmap/expedition/summary returned success');
    assert(expData1.summary.totalLightYearsWarped >= 100.0, `Expedition telemetry recorded ${expData1.summary.totalLightYearsWarped} LY warped (>= 100.0 LY)`);
    assert(expData1.summary.currentRealm === 'HYPERSPACE', 'Current realm verified as HYPERSPACE');
    console.log('  Interstellar warp flight and escort fuel logistics verified.\n');

    // -------------------------------------------------------------------------
    // Phase 3: Faction Sphere of Influence Incursion & Thermal Decoy Evasion
    // -------------------------------------------------------------------------
    console.log('--- Phase 3: Faction Sphere of Influence Incursion & Radar Contact Evasion ---');

    // 3.1 Advance into Vaelic Imperial Hegemony Sphere of Influence ([360, 340], radius 110)
    // Coordinates [390.0, 370.0] are dist sqrt(30^2 + 30^2) = 42.4 LY from core
    const vaelicIncursionCoords: [number, number] = [390.0, 370.0];
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: vaelicIncursionCoords, fuelBurned: 5 }),
    });

    // 3.2 Fetch radar blips
    const blipsRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/blips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: vaelicIncursionCoords, isBoosting: false }),
    });
    const blipsData = await blipsRes.json();
    assert(blipsRes.ok && blipsData.success === true, 'POST /api/starmap/hyperspace/blips returned success');
    assert(blipsData.blips.length > 0, `Radar contacts detected in hostile space (${blipsData.blips.length} blips)`);

    const hostileBlip = blipsData.blips.find((b: any) => b.isHostile === true || b.factionId === 'FACTION_HEGEMONY');
    assert(!!hostileBlip, 'Hostile Imperial Hegemony hunter blip identified');

    // 3.3 Deploy Subspace Thermal Decoy
    const decoyRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/decoy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: vaelicIncursionCoords }),
    });
    const decoyData = await decoyRes.json();
    assert(decoyRes.ok && decoyData.success === true, 'POST /api/starmap/hyperspace/decoy deployed thermal decoy canister');
    assert(decoyData.decoysRemaining === 2, `Decoy canisters remaining: ${decoyData.decoysRemaining} (decremented from 3)`);
    assert(decoyData.decoy.durationSeconds === 6.0, 'Thermal decoy active duration confirmed at 6.0s');

    // 3.4 Verify expedition summary recorded evasion
    const expRes2 = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const expData2 = await expRes2.json();
    assert(expData2.summary.blipsEvaded >= 1, `Expedition telemetry recorded ${expData2.summary.blipsEvaded} blip(s) evaded`);
    console.log('  Hostile territory incursion and tactical decoy evasion verified.\n');

    // -------------------------------------------------------------------------
    // Phase 4: Tactical Interception, Comms Hail & 20Hz Combat Arena Drop
    // -------------------------------------------------------------------------
    console.log('--- Phase 4: Tactical Interception, Comms Hail & 20Hz Combat Arena Drop ---');

    // 4.1 Trigger interception with hostile radar blip
    const targetBlip = hostileBlip || blipsData.blips[0];
    const interceptRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/intercept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, blipId: targetBlip.id, currentCoords: vaelicIncursionCoords }),
    });
    const interceptData = await interceptRes.json();
    assert(interceptRes.ok && interceptData.success === true, 'POST /api/starmap/hyperspace/intercept triggered alien comms hail');
    assert(!!interceptData.interception.dialogueText, 'Alien commander delivered comms dialogue');
    assert(interceptData.interception.options.length > 0, `Alien comms presented ${interceptData.interception.options.length} negotiation options`);

    // 4.2 Resolve Comms with Hostile Escalation (ATTACK)
    const commsRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/comms-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, blipId: targetBlip.id, actionId: 'ATTACK' }),
    });
    const commsData = await commsRes.json();
    assert(commsRes.ok && commsData.success === true, 'POST /api/starmap/hyperspace/comms-action resolved decision');
    assert(commsData.combatDropRequired === true, 'Combat drop required confirmed true');
    assert(!!commsData.combatSetup && commsData.combatSetup.enemySquadron.length > 0, 'Combat setup payload prepared with enemy squadron');

    // 4.3 Connect to 20Hz Authoritative WebSocket Combat Room
    let wsReceivedSnapshot = false;
    let wingmenCountInCombat = 0;
    let ws: WebSocket | null = null;

    await new Promise<void>((resolve, reject) => {
      ws = new WebSocket(`${WS_URL}/ws/combat?playerId=${PLAYER_ID}&sectorId=1`);

      const timeout = setTimeout(() => {
        if (!wsReceivedSnapshot) {
          reject(new Error('WebSocket timeout waiting for 20Hz combat snapshot'));
        }
      }, 5000);

      ws.on('open', () => {
        console.log('  Authoritative 20Hz WebSocket combat arena connected.');
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'TICK_SNAPSHOT') {
            const wingmen = (msg.entities || []).filter((e: any) => e.type === 'WINGMAN');
            if (!wsReceivedSnapshot && wingmen.length >= 2) {
              wsReceivedSnapshot = true;
              clearTimeout(timeout);
              wingmenCountInCombat = wingmen.length;
              resolve();
            }
          }
        } catch {}
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert(wsReceivedSnapshot, 'Received authoritative 20Hz combat snapshot from SectorCombatManager');
    assert(wingmenCountInCombat === 2, `Flagship task force verified with ${wingmenCountInCombat} active wingmen in combat formation`);

    if (ws && (ws as WebSocket).readyState === WebSocket.OPEN) {
      (ws as WebSocket).close();
    }

    // Resume Hyperspace post-combat
    await fetch(`${BASE_URL}/api/starmap/hyperspace/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, combatOutcome: 'VICTORY' }),
    });

    // 4.4 Verify expedition telemetry recorded survived interception
    const expRes3 = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const expData3 = await expRes3.json();
    assert(expData3.summary.interceptionsSurvived >= 1, `Expedition telemetry recorded ${expData3.summary.interceptionsSurvived} survived interception(s)`);
    console.log('  Tactical interception and 20Hz combat drop hand-off verified.\n');

    // -------------------------------------------------------------------------
    // Phase 5: TrueSpace Gravity Well Orbital Insertion & Planetary Survey
    // -------------------------------------------------------------------------
    console.log('--- Phase 5: TrueSpace Gravity Well Orbital Insertion & System Survey ---');

    // 5.1 Navigate to Sector 2 (Void Expanse [535.0, 480.0]) via intermediate waypoint
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [460.0, 425.0], fuelBurned: 5 }),
    });

    const sec2ArrivalCoords: [number, number] = [535.0, 480.0];
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: sec2ArrivalCoords, fuelBurned: 5 }),
    });

    // 5.2 Drop out of Hyperspace into Sector 2
    const arriveRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, targetSectorId: 2, finalCoords: sec2ArrivalCoords }),
    });
    const arriveData = await arriveRes.json();
    assert(arriveRes.ok && arriveData.success === true, 'POST /api/starmap/hyperspace/arrive dropped ship into TrueSpace');
    assert(arriveData.arrivedSectorId === 2, 'Confirmed arrival in Sector 2 (Void Expanse)');
    assert(arriveData.system.planets.length > 0, `Sector 2 system telemetry contains ${arriveData.system.planets.length} celestial bodies`);

    // 5.3 Survey planet in Sector 2 (Establish regional diplomatic clearance first)
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, factionId: 'FACTION_HEGEMONY', standing: 20 }),
    });

    const targetPlanet = arriveData.system.planets[0];
    const scanRes = await fetch(`${BASE_URL}/api/planets/${targetPlanet.id}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, scanBand: 'MINERALS' }),
    });
    assert(scanRes.ok, `Executed orbital planetary survey on ${targetPlanet.name}`);

    // 5.4 Verify expedition telemetry recorded system visit
    const expRes4 = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const expData4 = await expRes4.json();
    assert(expData4.summary.systemsVisited.includes('2'), 'Expedition telemetry recorded visit to Star System #2');
    assert(expData4.summary.currentRealm === 'TRUESPACE', 'Current realm verified as TRUESPACE');
    console.log('  TrueSpace gravity well drop-out and orbital survey verified.\n');

    // -------------------------------------------------------------------------
    // Phase 6: Precursor Quasi-Space Slipstream Breach & 0-Fuel Portal Transit
    // -------------------------------------------------------------------------
    console.log('--- Phase 6: Precursor Quasi-Space Slipstream Breach & Portal Transit ---');

    // 6.1 Unlock Precursor codex (survey Aegis Prime and decipher site)
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
    assert(decipherRes.ok, 'Deciphered Precursor Aegis Monolith to establish resonance codex');

    // 6.2 Enter Quasi-Space dimension
    const enterQuasiRes = await fetch(`${BASE_URL}/api/starmap/quasispace/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    const enterQuasiData = await enterQuasiRes.json();
    assert(enterQuasiRes.ok && enterQuasiData.success === true, 'POST /api/starmap/quasispace/enter breached Quasi-Space');
    assert(enterQuasiData.isInQuasiSpace === true, 'Flagship confirmed inside Precursor Quasi-Space realm');
    assert(enterQuasiData.coordinates[0] === 150.0 && enterQuasiData.coordinates[1] === 150.0, 'Quasi-Space entry anchored at central meridian [150.0, 150.0]');
    const quasiStartFuel = enterQuasiData.fuel;

    // 6.3 Query Precursor Portals
    const portalsRes = await fetch(`${BASE_URL}/api/starmap/quasispace/portals`);
    const portalsData = await portalsRes.json();
    assert(portalsData.success === true && portalsData.portals.length === 8, '8 canonical Precursor Portals discovered in Quasi-Space network');

    const portalGamma = portalsData.portals.find((p: any) => p.id === 'portal_gamma_vaelic');
    assert(!!portalGamma, 'Located Portal Gamma (Vaelic Hegemony Core gateway)');

    // 6.4 Cruise to Portal Gamma coordinates [108.0, 102.0]
    const quasiSyncRes = await fetch(`${BASE_URL}/api/starmap/quasispace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [108.0, 102.0] }),
    });
    const quasiSyncData = await quasiSyncRes.json();
    assert(quasiSyncRes.ok && quasiSyncData.success === true, 'POST /api/starmap/quasispace/sync updated position');
    assert(quasiSyncData.remainingFuel === quasiStartFuel, `STRICT ZERO-FUEL INVARIANT CONFIRMED: Remaining fuel is ${quasiSyncData.remainingFuel} (0 fuel burned)`);

    // 6.5 Exit Quasi-Space through Portal Gamma -> Erupt back into real Hyperspace at [360, 340]
    const exitQuasiRes = await fetch(`${BASE_URL}/api/starmap/quasispace/exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, portalId: 'portal_gamma_vaelic' }),
    });
    const exitQuasiData = await exitQuasiRes.json();
    assert(exitQuasiRes.ok && exitQuasiData.success === true, 'POST /api/starmap/quasispace/exit transited Precursor Portal');
    assert(exitQuasiData.isInHyperspace === true, 'Ship returned to real Hyperspace');
    assert(exitQuasiData.coordinates[0] === 360.0 && exitQuasiData.coordinates[1] === 340.0, 'Ship erupted at Vaelic Hegemony Core coordinates [360.0, 340.0]');
    assert(exitQuasiData.immunityGrantedSeconds === 5, 'Granted 5-second warp-flare stealth immunity');

    // 6.6 Verify expedition summary recorded portal transit
    const expRes5 = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const expData5 = await expRes5.json();
    assert(expData5.summary.portalsTransited >= 1, `Expedition telemetry recorded ${expData5.summary.portalsTransited} Precursor portal transit(s)`);
    console.log('  Precursor Quasi-Space 0-fuel slipstream and portal transit verified.\n');

    // -------------------------------------------------------------------------
    // Phase 7: Fuel Starvation Emergency SOS Distress Transponder Logistics
    // -------------------------------------------------------------------------
    console.log('--- Phase 7: Fuel Starvation Emergency SOS Distress Transponder ---');

    // 7.1 Exhaust all ship fuel to 0 (simulate deep void starvation)
    const drainSyncRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [360.0, 340.0], fuelBurned: 100 }),
    });
    const drainData = await drainSyncRes.json();
    assert(drainData.remainingFuel === 0, 'Ship fuel reserves completely depleted (0 fuel)');
    assert(drainData.isFuelDepleted === true, 'isFuelDepleted confirmed true: main thruster cutoff');

    // 7.2 Broadcast Emergency SOS Transponder Beacon
    const sosRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    const sosData = await sosRes.json();
    assert(sosRes.ok && sosData.success === true, 'POST /api/starmap/hyperspace/sos-trigger broadcast distress beacon');
    assert(!!sosData.encounter, 'Distress channel responder intercepted automated SOS');
    console.log(`  SOS Responder: ${sosData.encounter.responderName} (${sosData.encounter.responderType})`);

    // 7.3 Resolve SOS Transaction (BUY_FUEL: 400 Credits for 25 Fuel)
    const resolveSosRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/sos-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, choice: 'BUY_FUEL' }),
    });
    const resolveSosData = await resolveSosRes.json();
    assert(resolveSosRes.ok && resolveSosData.success === true, 'POST /api/starmap/hyperspace/sos-resolve executed emergency transaction');
    assert(resolveSosData.remainingFuel === 25, 'Emergency Deuterium fuel transferred: Fuel restored to 25 units');
    assert(resolveSosData.combatDropRequired === false, 'Fuel purchase resolved peacefully without combat drop');

    // 7.4 Verify expedition summary recorded SOS broadcast
    const expRes6 = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const expData6 = await expRes6.json();
    assert(expData6.summary.sosBeaconsBroadcast >= 1, `Expedition telemetry recorded ${expData6.summary.sosBeaconsBroadcast} SOS distress beacon(s)`);
    console.log('  Zero-fuel emergency SOS transponder rescue verified.\n');

    // -------------------------------------------------------------------------
    // Phase 8: Safe Haven Return & Grand Capstone Expedition Audit
    // -------------------------------------------------------------------------
    console.log('--- Phase 8: Safe Haven Return & Grand Capstone Expedition Audit ---');

    // 8.1 Return to Sol Nexus [500.0, 500.0] via intermediate waypoint
    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [430.0, 420.0], fuelBurned: 5 }),
    });

    await fetch(`${BASE_URL}/api/starmap/hyperspace/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, currentCoords: [500.0, 500.0], fuelBurned: 5 }),
    });

    // 8.2 Drop out into Sol Nexus (Sector 1)
    const returnSolRes = await fetch(`${BASE_URL}/api/starmap/hyperspace/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, targetSectorId: 1, finalCoords: [500.0, 500.0] }),
    });
    const returnSolData = await returnSolRes.json();
    assert(returnSolRes.ok && returnSolData.success === true, 'Returned safely to Sol Nexus (Sector 1)');

    // 8.3 Final Expedition Summary Telemetry Audit
    const finalExpRes = await fetch(`${BASE_URL}/api/starmap/expedition/summary?accountId=${PLAYER_ID}`);
    const finalExpData = await finalExpRes.json();
    assert(finalExpData.success === true, 'Final expedition summary retrieved');

    const summary = finalExpData.summary;
    console.log('\n  ================ EXPEDITION TELEMETRY LEDGER ================');
    console.log(`  • Total Light-Years Warped: ${summary.totalLightYearsWarped} LY`);
    console.log(`  • Star Systems Visited:     ${summary.systemsVisited.join(', ')}`);
    console.log(`  • Precursor Portals Jumped: ${summary.portalsTransited}`);
    console.log(`  • Radar Blips Evaded:       ${summary.blipsEvaded}`);
    console.log(`  • Interceptions Survived:   ${summary.interceptionsSurvived}`);
    console.log(`  • Emergency SOS Beacons:    ${summary.sosBeaconsBroadcast}`);
    console.log(`  • Final Coordinates:        [${summary.currentCoordinates.join(', ')}]`);
    console.log(`  • Final Realm:              ${summary.currentRealm}`);
    console.log('  =============================================================\n');

    assert(summary.totalLightYearsWarped > 200.0, `Total light-years warped exceeds 200 LY (${summary.totalLightYearsWarped} LY)`);
    assert(summary.systemsVisited.length >= 2, `Visited multiple unique star systems (${summary.systemsVisited.length})`);
    assert(summary.portalsTransited >= 1, `Successfully transited Precursor portals (${summary.portalsTransited})`);
    assert(summary.blipsEvaded >= 1, `Successfully evaded hostile contacts (${summary.blipsEvaded})`);
    assert(summary.interceptionsSurvived >= 1, `Survived hostile tactical interceptions (${summary.interceptionsSurvived})`);
    assert(summary.sosBeaconsBroadcast >= 1, `Successfully resolved emergency SOS rescues (${summary.sosBeaconsBroadcast})`);
    assert(summary.currentRealm === 'TRUESPACE', 'Ship returned to secure TrueSpace home haven');
    assert(summary.currentCoordinates[0] === 500.0 && summary.currentCoordinates[1] === 500.0, 'Anchored at Sol Alliance Nexus [500.0, 500.0]');

    console.log('================================================================================');
    console.log(`🎉 MILESTONE 0.9 GRAND CAPSTONE PASSED: ${passed}/${total} ASSERTIONS (100%)`);
    console.log('================================================================================\n');
  } catch (err: any) {
    console.error('\n❌ Grand Capstone failed with error:', err.message);
    process.exit(1);
  }
}

runMilestone09GrandCapstone();

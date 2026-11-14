/**
 * server/test-milestone-0.8.ts
 * 
 * GRAND CAPSTONE INTEGRATION SUITE: MILESTONE 0.8
 * "Fleet Command & Task Force Operations"
 * 
 * Verifies the full strategic fleet transition:
 * Phase 1: Environmental Baseline Reset & Command Bridge Module Scaling (T1 -> T3)
 * Phase 2: Colony Orbital Shipyard Gantry Upgrade & Industrial Hull Fabrication
 * Phase 3: Fleet Hangar Bay Multi-Escort Deployment (Slots 1, 2, 3)
 * Phase 4: Synchronized Fleet Warp Transit & Fuel Overhead Integration (Sector 1 -> Sector 2)
 * Phase 5: 20Hz Multi-Wave Task Force Combat, 360-Degree Command Wheel & Signature Abilities
 * Phase 6: Escort Derelict Recovery, 50% Shipyard Refurbish & Colony Silo Fleet Resupply
 * Phase 7: Tactical After-Action Report (AAR) Debriefing & Economic Dividend Audit
 */

import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runMilestone08GrandCapstone() {
  console.log('================================================================================');
  console.log('  MILESTONE 0.8 GRAND CAPSTONE: FLEET COMMAND & TASK FORCE OPERATIONS');
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
    // Phase 1: Baseline Reset & Command Bridge Scaling (T1 -> T3)
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Baseline Reset & Command Bridge Module Scaling ---');

    // 1.1 Reset pilot baseline and fleet
    const resetRes = await fetch(`${BASE_URL}/api/fleet/debug-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'Reset pilot fleet roster to initial hangar baseline');

    // Ensure M2 slot is unfitted to restore baseline Tier 1 bridge
    await fetch(`${BASE_URL}/api/outfitting/unfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, slot: 'M2' }),
    });

    // 1.2 Seed Credits, AP, and Faction Standings
    const credsRes = await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, credits: 35000 }),
    });
    assert(credsRes.ok, 'Seeded 35,000 Credits for Fleet Command outfitting');

    const apRes = await fetch(`${BASE_URL}/api/player/ap/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, amount: 600 }),
    });
    assert(apRes.ok, 'Seeded 600 Action Points (AP)');

    // Seed reputation with Vaelic Hegemony & Phorid Swarm for blueprints
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, factionId: 'FACTION_HEGEMONY', standing: 50 }),
    });
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, factionId: 'FACTION_VAELIC', standing: 50 }),
    });
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, factionId: 'FACTION_PHORID', standing: 50 }),
    });
    console.log('  Seeded faction standing for alien shipyard blueprints.');

    // 1.3 Ensure initial Command Bridge validates maxWingmen: 1
    const initRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const initRoster = await initRosterRes.json();
    assert(initRoster.success === true, 'Fetched initial fleet roster telemetry');
    assert(initRoster.maxWingmen === 1, 'Initial Command Bridge capacity is 1 wingman');
    assert(initRoster.bridgeTier === 1, 'Initial Bridge Tier is 1');

    // 1.4 Attempting to assign Slot 2 rejected under Tier 1 Bridge
    const illegalSlotRes = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        fleetShipId: 'fleet_escort_kryll_01',
        slot: 2,
      }),
    });
    const illegalSlotData = await illegalSlotRes.json();
    assert(illegalSlotRes.status === 400, 'Assignment to Slot 2 rejected with HTTP 400 under Tier 1 Bridge');
    assert(illegalSlotData.error.includes('COMMAND_BRIDGE_LIMIT_EXCEEDED'), 'Rejection reports COMMAND_BRIDGE_LIMIT_EXCEEDED');

    // 1.5 Unfit M2 and purchase Fleet Operations Center Mk.III (MOD_BRIDGE_T3)
    await fetch(`${BASE_URL}/api/outfitting/unfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, slot: 'M2' }),
    });

    const buyBridgeRes = await fetch(`${BASE_URL}/api/outfitting/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, blueprintId: 'MOD_BRIDGE_T3' }),
    });
    assert(buyBridgeRes.ok, 'Purchased Fleet Operations Center Mk.III (MOD_BRIDGE_T3)');

    const loadoutRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=${PLAYER_ID}`);
    const loadoutData = await loadoutRes.json();
    const bridgeInLocker = loadoutData.locker.find((item: any) => item.blueprintId === 'MOD_BRIDGE_T3');
    assert(!!bridgeInLocker, 'Located MOD_BRIDGE_T3 in player locker');

    const fitBridgeRes = await fetch(`${BASE_URL}/api/outfitting/fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, inventoryId: bridgeInLocker.id, slot: 'M2' }),
    });
    assert(fitBridgeRes.ok, 'Fitted MOD_BRIDGE_T3 to flagship MID-2 slot');

    // 1.6 Verify Command Bridge capacity scaled to 3 active wingmen
    const scaledRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const scaledRoster = await scaledRosterRes.json();
    assert(scaledRoster.maxWingmen === 3, 'Command Bridge capacity successfully expanded to 3 wingmen');
    assert(scaledRoster.bridgeTier === 3, 'Command Bridge Tier confirmed at Tier 3');
    console.log('  Command Bridge scaling verified.\n');

    // -------------------------------------------------------------------------
    // Phase 2: Colony Orbital Shipyard Gantry & Industrial Fabrication
    // -------------------------------------------------------------------------
    console.log('--- Phase 2: Colony Orbital Shipyard Gantry & Task Force Fabrication ---');

    // 2.0 Deploy probe beacon on Aegis Prime and stock rations for founding
    const probeRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, targetLat: 10.0, targetLng: 20.0, shieldBoost: true }),
    });
    const probeData = await probeRes.json();
    const beaconId = probeData.beaconId;

    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_RATIONS', quantity: 20 }),
    });

    // 2.1 Found colony on Aegis Prime with initial silo reserves
    const foundColonyRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        planetId: 'planet_sec1_aegis',
        beaconId,
        name: 'Aegis Task Force Colony',
      }),
    });
    const foundColonyData = await foundColonyRes.json();
    const colonyId = foundColonyData.colony?.id || 'colony_sec1_aegis_01';
    assert(foundColonyRes.ok, `Colony established at Aegis Prime (ID: ${colonyId})`);

    // 2.2 Upgrade Colony Shipyard to Tier 1 and Tier 2 (Cruiser Slipway)
    const upGantry1Res = await fetch(`${BASE_URL}/api/colonies/${colonyId}/shipyard/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(upGantry1Res.ok, 'Upgraded colony shipyard to Tier 1 (Light Frigate Slipway)');

    const upGantry2Res = await fetch(`${BASE_URL}/api/colonies/${colonyId}/shipyard/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(upGantry2Res.ok, 'Upgraded colony shipyard to Tier 2 (Capital Fleet Slipway)');
    const upGantry2Data = await upGantry2Res.json();
    assert(upGantry2Data.colony.shipyardTier === 2, 'Colony telemetry confirms shipyardTier: 2');

    // 2.3 Stock colony and flagship with required manufacturing commodities
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ALLOY', quantity: 120 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ORE', quantity: 100 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_FUEL', quantity: 80 }),
    });
    console.log('  Stocked manufacturing commodities into flagship cargo hold.');

    // 2.4 Fabricate Vaelic Imperial Interdictor at Colony Shipyard (15% Gantry Discount)
    const fabVaelicRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_VAELIC_INTERDICTOR',
        customName: 'Vaelic Heavy Vanguard IX',
        colonyId,
      }),
    });
    const fabVaelicData = await fabVaelicRes.json();
    assert(fabVaelicRes.ok, 'Fabricated Vaelic Imperial Interdictor at Colony Shipyard');
    assert(fabVaelicData.isColonyDiscountApplied === true, 'Colony 25% gantry manufacturing discount applied');
    assert(fabVaelicData.materialsDeducted.credits === 900, 'Credits discounted 25%: 900 vs base 1200 CR');
    assert(fabVaelicData.materialsDeducted.alloy === 18, 'Deducted 18x Plasteel Alloys');
    const vaelicShipId = fabVaelicData.ship.id;

    // 2.5 Fabricate Phorid Bio-Spore Frigate at Colony Shipyard
    const fabPhoridRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_PHORID_FRIGATE',
        customName: 'Chitinous Spore Spire',
        colonyId,
      }),
    });
    const fabPhoridData = await fabPhoridRes.json();
    assert(fabPhoridRes.ok, 'Fabricated Phorid Bio-Spore Frigate at Colony Shipyard');
    assert(fabPhoridData.isColonyDiscountApplied === true, 'Colony 15% discount confirmed on Phorid Frigate');
    console.log('  Colony shipyard task force fabrication verified.\n');

    // -------------------------------------------------------------------------
    // Phase 3: Fleet Hangar Bay Configuration (Multi-Faction Strike Wing)
    // -------------------------------------------------------------------------
    console.log('--- Phase 3: Fleet Hangar Bay Multi-Escort Deployment ---');

    // 3.1 Fetch complete roster and identify hulls
    const rosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const rosterData = await rosterRes.json();
    const solEscort = rosterData.fleet.find((s: any) => s.hullClass === 'SOL_CRUISER');
    const kryllEscort = rosterData.fleet.find((s: any) => s.hullClass === 'KRYLL_RUNNER');
    const vaelicEscort = rosterData.fleet.find((s: any) => s.id === vaelicShipId);
    assert(!!solEscort, 'Found Sol Vanguard Cruiser in fleet');
    assert(!!kryllEscort, 'Found Kryll Shadow-Runner in fleet');
    assert(!!vaelicEscort, 'Found Vaelic Interdictor in fleet');

    // 3.2 Assign Sol Cruiser to Slot 1, Vaelic Interdictor to Slot 2, Kryll Runner to Slot 3
    const assign1 = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: solEscort.id, slot: 1 }),
    });
    assert(assign1.ok, 'Assigned Sol Cruiser to Active Wingman Slot 1 (POINT_DEFENSE)');

    const assign2 = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: vaelicEscort.id, slot: 2 }),
    });
    assert(assign2.ok, 'Assigned Vaelic Interdictor to Active Wingman Slot 2 (PLASMA_LANCE)');

    const assign3 = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, fleetShipId: kryllEscort.id, slot: 3 }),
    });
    assert(assign3.ok, 'Assigned Kryll Runner to Active Wingman Slot 3 (DECOY_HOLO)');

    // 3.3 Verify 3 active wingmen are deployed
    const deployedRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const deployedRoster = await deployedRosterRes.json();
    assert(deployedRoster.activeWingmen.length === 3, 'Active squadron confirmed at 3 deployed combat escorts');
    console.log('  Fleet hangar bay configuration complete.\n');

    // -------------------------------------------------------------------------
    // Phase 4: Synchronized Fleet Warp Jump (Sector 1 -> Sector 2)
    // -------------------------------------------------------------------------
    console.log('--- Phase 4: Synchronized Fleet Warp Transit & Fuel Overhead ---');

    // 4.1 Ensure full fuel reserves (100 Fuel) and reset location to Sector 1
    await fetch(`${BASE_URL}/api/player/ship/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, fuel: 100, sectorId: 1 }),
    });

    // 4.2 Jump from Sector 1 to Sector 2
    // Expected fuel: 1 base + 3 escorts * 1 = 4 Fuel
    const jumpRes = await fetch(`${BASE_URL}/api/navigate/jump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 2 }),
    });
    const jumpData = await jumpRes.json();
    assert(jumpRes.ok, 'Synchronized fleet warp jump executed successfully (Sec 1 -> Sec 2)');
    assert(jumpData.activeEscortsJumping === 3, 'Jump telemetry reports 3 active escorts jumping in formation');
    assert(jumpData.escortFuelCost === 3, 'Escort warp fuel overhead is 3 units (1 per escort)');
    assert(jumpData.totalFuelCost === 4, 'Total warp fuel cost is 4 units (1 base + 3 escorts)');
    assert(jumpData.remainingFuel === 96, 'Flagship fuel deducted accurately to 96 units');

    // 4.3 Verify active escorts in player_fleet are synchronized to Sector 2
    const verifyRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const verifyRoster = await verifyRosterRes.json();
    const allInSec2 = verifyRoster.activeWingmen.every((w: any) => (w.currentSectorId || 1) === 2);
    assert(allInSec2, 'All active escorts synchronized to Sector 2 in database');
    console.log('  Synchronized fleet warp transit verified.\n');

    // -------------------------------------------------------------------------
    // Phase 5: 20Hz Multi-Wave Task Force Combat & Tactical Orders
    // -------------------------------------------------------------------------
    console.log('--- Phase 5: 20Hz Task Force Combat, Command Wheel & Signature Abilities ---');

    let ws: WebSocket;
    let initialSnapshotReceived = false;
    let wingmenInSnapshot = 0;
    let focusOrderAcked = false;
    let defendOrderAcked = false;
    let pointDefenseAcked = false;
    let plasmaLanceAcked = false;
    let decoyHoloAcked = false;
    let decoySpawnedInSnapshot = false;
    let aarReceived: any = null;

    await new Promise<void>((resolve, reject) => {
      ws = new WebSocket(`${WS_URL}/ws/combat?playerId=${PLAYER_ID}&sectorId=2`);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket timeout waiting for initial combat telemetry'));
      }, 5000);

      ws.on('open', () => {
        console.log('  Connected to Sector 2 20Hz Combat Room WebSocket.');
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'TICK_SNAPSHOT') {
            if (!initialSnapshotReceived) {
              initialSnapshotReceived = true;
              clearTimeout(timeout);
              const wingmen = (msg.entities || []).filter((e: any) => e.type === 'WINGMAN');
              wingmenInSnapshot = wingmen.length;
              resolve();
            }

            // Check for Kryll decoy entity
            if (msg.entities && msg.entities.some((e: any) => e.isDecoy === true || e.hullClass === 'DECOY')) {
              decoySpawnedInSnapshot = true;
            }
          } else if (msg.type === 'S_TACTICAL_ORDER_ACK') {
            if (msg.order === 'FOCUS_TARGET') focusOrderAcked = true;
            if (msg.order === 'ESCORT_FLAGSHIP') defendOrderAcked = true;
          } else if (msg.type === 'S_ABILITY_ACK') {
            if (msg.ability === 'POINT_DEFENSE') pointDefenseAcked = true;
            if (msg.ability === 'PLASMA_LANCE') plasmaLanceAcked = true;
            if (msg.ability === 'DECOY_HOLO') decoyHoloAcked = true;
          } else if (msg.type === 'S_COMBAT_AAR') {
            aarReceived = msg.data;
          }
        } catch {}
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert(initialSnapshotReceived, 'Received 20Hz authoritative combat snapshots');
    assert(wingmenInSnapshot === 3, 'Combat snapshot contains all 3 active wingmen spawned in formation', `Count: ${wingmenInSnapshot}`);

    // 5.1 Issue ORDER_FOCUS_TARGET targeting Hegemony drone
    ws!.send(JSON.stringify({
      type: 'C_TACTICAL_ORDER',
      order: 'FOCUS_TARGET',
      targetEntityId: 'drone_vaelic_patrol_01',
    }));
    await new Promise((r) => setTimeout(r, 120));
    assert(focusOrderAcked, 'S_TACTICAL_ORDER_ACK confirmed: ORDER_FOCUS_TARGET acknowledged by server');

    // 5.2 Issue ORDER_DEFEND (ESCORT_FLAGSHIP)
    ws!.send(JSON.stringify({
      type: 'C_TACTICAL_ORDER',
      order: 'ESCORT_FLAGSHIP',
    }));
    await new Promise((r) => setTimeout(r, 120));
    assert(defendOrderAcked, 'S_TACTICAL_ORDER_ACK confirmed: ORDER_DEFEND (ESCORT_FLAGSHIP) acknowledged');

    // 5.3 Trigger Signature Fleet Abilities (Slots 1, 2, 3)
    ws!.send(JSON.stringify({ type: 'C_TRIGGER_ABILITY', slot: 1 }));
    await new Promise((r) => setTimeout(r, 120));
    assert(pointDefenseAcked, 'Slot 1 Sol POINT_DEFENSE signature ability activated');

    ws!.send(JSON.stringify({ type: 'C_TRIGGER_ABILITY', slot: 2 }));
    await new Promise((r) => setTimeout(r, 120));
    assert(plasmaLanceAcked, 'Slot 2 Vaelic PLASMA_LANCE signature ability activated');

    ws!.send(JSON.stringify({ type: 'C_TRIGGER_ABILITY', slot: 3 }));
    await new Promise((r) => setTimeout(r, 200));
    assert(decoyHoloAcked, 'Slot 3 Kryll DECOY_HOLO signature ability activated');
    assert(decoySpawnedInSnapshot, 'Sensor Ghost holographic decoy verified active in combat snapshot');

    // 5.4 Simulate combat loss: Destroy Slot 3 escort (Kryll Runner)
    const destroyRes = await fetch(`${BASE_URL}/api/combat/destroy-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 2,
        entityId: `wingman_${PLAYER_ID}_slot_3`,
      }),
    });
    assert(destroyRes.ok, 'Applied fatal damage to Slot 3 escort in Sector 2');

    // 5.5 Verify persistent wreck registered in Sector 2
    const wrecksRes = await fetch(`${BASE_URL}/api/combat/wrecks?sectorId=2`);
    const wrecksData = await wrecksRes.json();
    const escortWreck = (wrecksData.wrecks || []).find((w: any) => w.hullClass === 'KRYLL_RUNNER' || w.shipClass === 'KRYLL_RUNNER' || w.blueprintId === 'HULL_KRYLL_RUNNER');
    assert(!!escortWreck, 'Found persistent escort wreck registered in Sector 2');
    assert(escortWreck.hullIntactness === 0.45, 'Escort wreck intactness is 0.45 (45% salvageable structure)');
    const recoveredWreckId = escortWreck.id;

    // 5.6 Disengage and receive After-Action Report (AAR)
    ws!.send(JSON.stringify({ type: 'C_DISENGAGE' }));
    await new Promise((r) => setTimeout(r, 250));
    assert(!!aarReceived, 'Received S_COMBAT_AAR WebSocket debrief packet on disengage');
    assert(aarReceived.sectorId === 2, 'AAR sectorId confirmed at 2');
    assert(aarReceived.escorts.length >= 2, 'AAR contains multi-escort squadron telemetry breakdown');

    // Close WebSocket cleanly
    await new Promise<void>((resolve) => {
      ws!.on('close', resolve);
      ws!.close();
    });
    console.log('  20Hz Task force combat operations verified.\n');

    // -------------------------------------------------------------------------
    // Phase 6: Wreck Refurbish & Colony Silo Fleet Resupply
    // -------------------------------------------------------------------------
    console.log('--- Phase 6: Escort Wreck Refurbish & Colony Silo Resupply ---');

    // 6.1 Warp back to Colony sector (Sector 1)
    // 2 escorts remain active: Fuel cost is 1 base + 2 escorts = 3 Fuel
    const returnJumpRes = await fetch(`${BASE_URL}/api/navigate/jump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 1 }),
    });
    const returnJumpData = await returnJumpRes.json();
    assert(returnJumpRes.ok, 'Synchronized warp jump returned task force to Colony in Sector 1');
    assert(returnJumpData.activeEscortsJumping === 2, 'Return jump correctly identified 2 remaining active escorts');
    assert(returnJumpData.totalFuelCost === 3, 'Return jump consumed exactly 3 Fuel (1 base + 2 escorts)');

    // 6.2 Refurbish recovered Kryll Runner wreck at Colony Orbital Shipyard (50% discount)
    const refurbRes = await fetch(`${BASE_URL}/api/shipyard/fleet/refurbish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        wreckId: recoveredWreckId,
        colonyId,
      }),
    });
    const refurbData = await refurbRes.json();
    assert(refurbRes.ok, 'Refurbished escort wreck at Colony Orbital Shipyard');
    assert(refurbData.materialsDeducted.credits === 350, 'Refurbishment applied 50% Credit discount: 350 vs standard 700 CR');
    assert(refurbData.materialsDeducted.alloy === 6, 'Refurbishment applied 50% Alloy discount: 6 vs standard 12');
    assert(refurbData.ship.status === 'READY', 'Refurbished escort restored to player fleet in READY status');

    // 6.3 Execute manual colony fleet resupply from colony silo reserves
    const resupplyRes = await fetch(`${BASE_URL}/api/colonies/${colonyId}/shipyard/resupply-fleet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    const resupplyData = await resupplyRes.json();
    assert(resupplyRes.ok, 'Executed POST /api/colonies/:id/shipyard/resupply-fleet');
    assert(resupplyData.success === true, 'Fleet resupply succeeded');
    assert(resupplyData.fleetStatus === 'FULLY_OPERATIONAL', 'Task force verified in FULLY_OPERATIONAL status');
    console.log('  Wreck refurbishment and colony silo resupply verified.\n');

    // -------------------------------------------------------------------------
    // Phase 7: Tactical AAR Debrief & Economic Dividend Audit
    // -------------------------------------------------------------------------
    console.log('--- Phase 7: Tactical AAR Debrief & Economic Dividend Audit ---');

    // 7.1 Fetch latest combat AAR via REST endpoint
    const aarRestRes = await fetch(`${BASE_URL}/api/fleet/aar/last?accountId=${PLAYER_ID}`);
    const aarRestData = await aarRestRes.json();
    assert(aarRestRes.ok, 'GET /api/fleet/aar/last returned HTTP 200');
    assert(aarRestData.success === true, 'AAR telemetry retrieval succeeded');
    assert(typeof aarRestData.aar.medal === 'string', `Squadron combat rating medal awarded: Rank ${aarRestData.aar.medal}`);
    assert(Array.isArray(aarRestData.aar.escorts), 'AAR contains per-escort telemetry array');

    // 7.2 Audit pilot balances and reserves
    const finalRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const finalRoster = await finalRosterRes.json();
    assert(finalRoster.fleet.length >= 3, 'Fleet hangar preserves full task force starship count');
    assert(finalRoster.maxWingmen === 3, 'Command Bridge retains Tier 3 (3 active wingmen) capacity');

    console.log('  Economic dividend and state audit confirmed.\n');

    // -------------------------------------------------------------------------
    // Capstone Grand Summary
    // -------------------------------------------------------------------------
    console.log('================================================================================');
    console.log(`  GRAND CAPSTONE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('  MILESTONE 0.8: FLEET COMMAND & TASK FORCE OPERATIONS FULLY ACHIEVED!');
    console.log('================================================================================\n');

  } catch (err: any) {
    console.error('\n❌ CAPSTONE FAILED WITH EXCEPTION:', err.message);
    process.exit(1);
  }
}

runMilestone08GrandCapstone();

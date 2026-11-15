import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';

async function runDay35Tests() {
  console.log('================================================================');
  console.log('  RUNNING DAY 35 INTEGRATION TESTS: ALIEN HULL ASYMMETRY,');
  console.log('  SIGNATURE FLEET ABILITIES & ESCORT WRECK REFURBISHMENT');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  const BASE_URL = 'http://localhost:3000';
  const WS_URL = 'ws://localhost:3000';

  try {
    // ----------------------------------------------------
    // Test Suite 1: Fleet Roster & Command Bridge Setup
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Fleet Roster & Command Bridge Setup ---');

    // 1. Reset fleet roster to baseline starter escorts
    const resetRes = await fetch(`${BASE_URL}/api/fleet/debug-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(resetRes.ok, 'POST /api/fleet/debug-reset responds 200 OK');

    // 2. Buy and fit Command Bridge Tier 2 to unlock Slot 2 capacity
    await fetch(`${BASE_URL}/api/outfitting/unfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'acc_sol_captain', slot: 'M2' }),
    });
    await fetch(`${BASE_URL}/api/outfitting/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'acc_sol_captain', blueprintId: 'MOD_BRIDGE_T2' }),
    });
    const loadoutRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=acc_sol_captain`);
    const loadoutData = await loadoutRes.json();
    const bridgeItem = loadoutData.locker.find((i: any) => i.blueprintId === 'MOD_BRIDGE_T2');
    if (bridgeItem) {
      await fetch(`${BASE_URL}/api/outfitting/fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain', inventoryId: bridgeItem.id, slot: 'M2' }),
      });
    }

    // 3. Assign Sol Vanguard to Slot 1 and Kryll Runner to Slot 2
    const rosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=acc_sol_captain`);
    const roster = await rosterRes.json();
    assert(roster.success === true, 'Roster fetch succeeds');
    assert(roster.maxWingmen >= 2, `Bridge Tier 2 provides >= 2 wingmen capacity (maxWingmen: ${roster.maxWingmen})`);

    const kryllShip = roster.fleet.find((s: any) => s.factionId === 'FACTION_KRYLL');
    assert(!!kryllShip, 'Found Kryll Shadow-Runner in player fleet');

    const assignRes = await fetch(`${BASE_URL}/api/fleet/assign-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        fleetShipId: kryllShip.id,
        slot: 2,
      }),
    });
    const assignData = await assignRes.json();
    assert(assignData.success === true, 'Assigned Kryll Runner to Slot 2');

    // 4. Verify Roster reports distinct signature abilities
    const verifiedRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=acc_sol_captain`);
    const verifiedRoster = await verifiedRosterRes.json();
    const slot1Ship = verifiedRoster.activeWingmen.find((w: any) => w.deploymentSlot === 1);
    const slot2Ship = verifiedRoster.activeWingmen.find((w: any) => w.deploymentSlot === 2);
    assert(!!slot1Ship && slot1Ship.specialAbility === 'POINT_DEFENSE', 'Slot 1 escort has Sol POINT_DEFENSE signature ability');
    assert(!!slot2Ship && slot2Ship.specialAbility === 'DECOY_HOLO', 'Slot 2 escort has Kryll DECOY_HOLO signature ability');

    // ----------------------------------------------------
    // Test Suite 2: WebSocket Combat Connection & Ability Dispatch
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: WebSocket Connection & Manual Ability Triggers ---');

    const ws = new WebSocket(`${WS_URL}/ws/combat?playerId=acc_sol_captain&sectorId=1`);

    let ackReceived: any = null;
    let snapshotWithDecoy: any = null;
    let receivedEvents: any[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on('error', reject);
    });
    assert(ws.readyState === WebSocket.OPEN, 'WebSocket connected to Sector 1 combat room');

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'S_ABILITY_ACK') {
          ackReceived = msg;
        } else if (msg.type === 'TICK_SNAPSHOT') {
          if (msg.events && msg.events.length > 0) {
            receivedEvents.push(...msg.events);
          }
          if (msg.entities && msg.entities.some((e: any) => e.isDecoy)) {
            snapshotWithDecoy = msg;
          }
        }
      } catch (err) {
        // ignore
      }
    });

    // Wait 200ms for initial snapshot and wingman spawn
    await new Promise((r) => setTimeout(r, 200));

    // 1. Manually trigger Slot 1: POINT_DEFENSE
    ws.send(JSON.stringify({ type: 'C_TRIGGER_ABILITY', slot: 1 }));
    await new Promise((r) => setTimeout(r, 100));

    assert(ackReceived !== null, 'Received S_ABILITY_ACK response from server');
    assert(ackReceived.success === true, 'Slot 1 POINT_DEFENSE triggered successfully');
    assert(ackReceived.slot === 1, 'ACK specifies slot 1');
    assert(ackReceived.ability === 'POINT_DEFENSE', 'ACK specifies ability POINT_DEFENSE');
    assert(ackReceived.cooldownRemaining === 25, 'Point-Defense cooldown initialized to 25s');

    // 2. Immediately try to trigger Slot 1 again -> Cooldown rejected
    ackReceived = null;
    ws.send(JSON.stringify({ type: 'C_TRIGGER_ABILITY', slot: 1 }));
    await new Promise((r) => setTimeout(r, 100));

    assert(ackReceived !== null, 'Received S_ABILITY_ACK for duplicate trigger attempt');
    assert(ackReceived.success === false, 'Duplicate trigger rejected while on cooldown');
    assert(ackReceived.error === 'ABILITY_ON_COOLDOWN', 'Error reports ABILITY_ON_COOLDOWN');
    assert(ackReceived.cooldownRemaining > 0, `Cooldown remaining reported (${ackReceived.cooldownRemaining}s)`);

    // 3. Trigger Slot 2: DECOY_HOLO
    ackReceived = null;
    ws.send(JSON.stringify({ type: 'C_TRIGGER_ABILITY', slot: 2 }));
    await new Promise((r) => setTimeout(r, 150));

    assert(ackReceived !== null, 'Received S_ABILITY_ACK for Slot 2 trigger');
    assert(ackReceived.success === true, 'Slot 2 DECOY_HOLO triggered successfully');
    assert(ackReceived.ability === 'DECOY_HOLO', 'ACK specifies ability DECOY_HOLO');
    assert(ackReceived.cooldownRemaining === 30, 'Decoy Holo cooldown initialized to 30s');

    // 4. Verify Holographic Decoy entity exists in sector snapshot
    assert(snapshotWithDecoy !== null, 'Snapshot contains active holographic decoy entity');
    const decoyEntity = snapshotWithDecoy.entities.find((e: any) => e.isDecoy);
    assert(decoyEntity.name.includes('Sensor Ghost'), 'Decoy entity named Sensor Ghost');
    assert(decoyEntity.hullClass === 'DECOY', 'Decoy hullClass is DECOY');

    // ----------------------------------------------------
    // Test Suite 3: REST Mirror for Fleet Ability Trigger
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: REST Mirror Ability Trigger Endpoint ---');

    const restTriggerRes = await fetch(`${BASE_URL}/api/fleet/trigger-ability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 1,
        slot: 99, // Invalid slot
      }),
    });
    const restTriggerData = await restTriggerRes.json();
    assert(restTriggerData.success === false, 'REST trigger for invalid Slot 99 fails cleanly');
    assert(restTriggerData.error === 'WINGMAN_NOT_FOUND', 'Reports WINGMAN_NOT_FOUND');

    await new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
      ws.close();
    });
    await new Promise((r) => setTimeout(r, 60));

    // ----------------------------------------------------
    // Test Suite 4: Signature Abilities Mechanics (Vaelic, Phorid, Lithos)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Combat Abilities Mechanics ---');

    // Test Vaelic Plasma Lance, Phorid Bio-Spore Cloud & Lithos Harmonic Shield via headless test wingmen
    const testWingmen = [
      {
        id: 'ship_vaelic_test',
        name: 'Vaelic Heavy Lancer',
        hullClass: 'VAELIC_INTERDICTOR',
        factionId: 'FACTION_VAELIC',
        deploymentSlot: 1,
        hull: 180,
        maxHull: 180,
        shield: 140,
        maxShield: 140,
        specialAbility: 'PLASMA_LANCE',
      },
      {
        id: 'ship_phorid_test',
        name: 'Phorid Acid Queen',
        hullClass: 'PHORID_FRIGATE',
        factionId: 'FACTION_PHORID',
        deploymentSlot: 2,
        hull: 140,
        maxHull: 140,
        shield: 110,
        maxShield: 110,
        specialAbility: 'BIO_SPORE_CLOUD',
      },
      {
        id: 'ship_lithos_test',
        name: 'Lithos Resonant Monitor',
        hullClass: 'LITHOS_MONITOR',
        factionId: 'FACTION_LITHOS',
        deploymentSlot: 3,
        hull: 220,
        maxHull: 220,
        shield: 120,
        maxShield: 120,
        specialAbility: 'HARMONIC_SHIELD',
      },
    ];

    const spawnTestRes = await fetch(`${BASE_URL}/api/fleet/debug-spawn-combat-wing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 1,
        overrideWingmen: testWingmen,
      }),
    });
    const spawnTestData = await spawnTestRes.json();
    assert(spawnTestData.success === true, 'Spawned 3 test alien wingmen in Sector 1');
    assert(spawnTestData.count === 3, 'All 3 alien wingmen spawned');

    // Test Plasma Lance trigger on Slot 1
    const lanceTriggerRes = await fetch(`${BASE_URL}/api/fleet/trigger-ability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 1,
        slot: 1,
      }),
    });
    const lanceData = await lanceTriggerRes.json();
    assert(lanceData.success === true, 'Vaelic Plasma Lance discharged');
    assert(lanceData.ability === 'PLASMA_LANCE', 'Executed PLASMA_LANCE ability');
    assert(lanceData.cooldownRemaining === 30, 'Plasma Lance cooldown set to 30s');

    // Test Bio-Spore Cloud trigger on Slot 2
    const sporeTriggerRes = await fetch(`${BASE_URL}/api/fleet/trigger-ability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 1,
        slot: 2,
      }),
    });
    const sporeData = await sporeTriggerRes.json();
    assert(sporeData.success === true, 'Phorid Bio-Spore Cloud vented');
    assert(sporeData.ability === 'BIO_SPORE_CLOUD', 'Executed BIO_SPORE_CLOUD ability');
    assert(sporeData.cooldownRemaining === 35, 'Bio-Spore Cloud cooldown set to 35s');

    // Test Harmonic Shield trigger on Slot 3
    const shieldTriggerRes = await fetch(`${BASE_URL}/api/fleet/trigger-ability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 1,
        slot: 3,
      }),
    });
    const shieldData = await shieldTriggerRes.json();
    assert(shieldData.success === true, 'Lithos Harmonic Shield activated');
    assert(shieldData.ability === 'HARMONIC_SHIELD', 'Executed HARMONIC_SHIELD ability');
    assert(shieldData.cooldownRemaining === 30, 'Harmonic Shield cooldown set to 30s');

    // ----------------------------------------------------
    // Test Suite 5: Escort Destruction & Persistent Wreck Spawning
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Escort Destruction & Persistent Wreck Creation ---');

    // Destroy Slot 2 wingman (Phorid)
    const destroyRes = await fetch(`${BASE_URL}/api/combat/destroy-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 1,
        entityId: 'wingman_acc_sol_captain_slot_2',
        killerId: 'raider_hostile_01',
      }),
    });
    assert(destroyRes.ok, 'Destroyed Wingman Slot 2');

    // Check wrecks table via API
    const wrecksRes = await fetch(`${BASE_URL}/api/combat/wrecks?sectorId=1`);
    const wrecksData = await wrecksRes.json();
    assert(wrecksData.success === true, 'Fetched wrecks for Sector 1');

    const destroyedWreck = wrecksData.wrecks.find((w: any) => w.shipClass === 'PHORID_FRIGATE' || w.shipName.includes('Phorid'));
    assert(!!destroyedWreck, 'Found persistent wreck for destroyed Phorid escort');
    assert(destroyedWreck.hullIntactness === 0.45, `Wreck hull intactness is 0.45 (actual: ${destroyedWreck.hullIntactness})`);

    // Verify fleet status updated to DESTROYED
    const rosterAfterDestroyRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=acc_sol_captain`);
    const rosterAfterDestroy = await rosterAfterDestroyRes.json();
    const destroyedFleetEntry = rosterAfterDestroy.fleet.find((s: any) => s.id === 'ship_phorid_test');
    if (destroyedFleetEntry) {
      assert(destroyedFleetEntry.status === 'DESTROYED', 'Escort status marked DESTROYED in player_fleet');
      assert(destroyedFleetEntry.deploymentSlot === null, 'Deployment slot revoked (set to null)');
    }

    // ----------------------------------------------------
    // Test Suite 6: Shipyard 50% Wreck Refurbishment
    // ----------------------------------------------------
    console.log('\n--- Test Suite 6: Shipyard 50% Wreck Refurbishment ---');

    // Check blueprints catalog
    const bpCatalogRes = await fetch(`${BASE_URL}/api/shipyard/fleet/blueprints?accountId=acc_sol_captain`);
    const bpCatalog = await bpCatalogRes.json();
    assert(bpCatalog.success === true, 'Shipyard blueprints catalog retrieved');
    const phoridBp = bpCatalog.blueprints.find((b: any) => b.id === 'HULL_PHORID_FRIGATE');
    assert(!!phoridBp, 'Found HULL_PHORID_FRIGATE blueprint in shipyard');

    const standardCreditCost = phoridBp.creditCost;
    const standardApCost = phoridBp.apCost;
    const standardAlloyCost = phoridBp.alloyCost;

    // Provide player credits and commodities for refurbishment
    await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', credits: 5000 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_ALLOY', quantity: 20 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_ORE', quantity: 20 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_FUEL', quantity: 20 }),
    });

    // Refurbish the wreck via POST /api/shipyard/fleet/refurbish
    const refurbishRes = await fetch(`${BASE_URL}/api/shipyard/fleet/refurbish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        wreckId: destroyedWreck.id,
      }),
    });
    const refurbishData = await refurbishRes.json();
    assert(refurbishData.success === true, 'POST /api/shipyard/fleet/refurbish succeeds');
    assert(refurbishData.ship !== undefined, 'Returned refurbished FleetShip');
    assert(refurbishData.ship.status === 'READY', 'Refurbished ship is in READY status');
    assert(refurbishData.ship.hull === refurbishData.ship.maxHull, 'Hull fully repaired to 100%');
    assert(refurbishData.ship.shield === refurbishData.ship.maxShield, 'Shields fully recharged to 100%');

    // Verify 50% discount on materials deducted
    const deducted = refurbishData.materialsDeducted;
    assert(deducted.credits === Math.round(standardCreditCost * 0.5), `Credits discounted 50%: ${deducted.credits} vs standard ${standardCreditCost}`);
    assert(deducted.ap === Math.max(1, Math.round(standardApCost * 0.5)), `AP discounted 50%: ${deducted.ap} vs standard ${standardApCost}`);
    assert(deducted.alloy === Math.round(standardAlloyCost * 0.5), `Alloy cost discounted 50%: ${deducted.alloy} vs standard ${standardAlloyCost}`);

    // Verify wreck removed from database
    const postRefurbWreckRes = await fetch(`${BASE_URL}/api/combat/wrecks/${destroyedWreck.id}`);
    const postRefurbWreck = await postRefurbWreckRes.json();
    assert(postRefurbWreck.wreck === null || postRefurbWreck.success === false, 'Refurbished wreck consumed and removed from wrecks ledger');

    // ----------------------------------------------------
    // Test Suite 7: REST Mirror /api/fleet/refurbish
    // ----------------------------------------------------
    console.log('\n--- Test Suite 7: REST Mirror /api/fleet/refurbish ---');

    // Calling with non-existent wreck returns 400 with WRECK_NOT_FOUND
    const mirrorRes = await fetch(`${BASE_URL}/api/fleet/refurbish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        wreckId: 'non_existent_wreck_id',
      }),
    });
    const mirrorData = await mirrorRes.json();
    assert(mirrorRes.status === 400, 'Refurbishing invalid wreck returns HTTP 400');
    assert(mirrorData.success === false, 'Refurbishing invalid wreck returns success: false');
    assert(mirrorData.error.includes('WRECK_NOT_FOUND'), 'Error message reports WRECK_NOT_FOUND');

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    console.log('\n================================================================');
    console.log(`  DAY 35 TEST SUMMARY: ${passed} / ${total} ASSERTIONS PASSED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Unhandled error during Day 35 integration tests:', err);
    process.exit(1);
  }
}

runDay35Tests().then(() => {
  console.log('Day 35 integration suite completed successfully.');
  process.exit(0);
});

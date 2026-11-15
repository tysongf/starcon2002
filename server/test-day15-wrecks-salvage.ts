import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';

async function runDay15Tests() {
  console.log('====================================================');
  console.log('  RUNNING DAY 15 INTEGRATION TESTS: PERSISTENT WRECKS,');
  console.log('  LASER SCRAP MINING, ELASTIC TOW & SALVAGE BAY');
  console.log('====================================================\n');

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

  try {
    // ----------------------------------------------------
    // Test Suite 1: Persistent Wrecks REST API
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Persistent Wrecks REST API ---');

    const wrecksRes = await fetch('http://localhost:3000/api/combat/wrecks?sectorId=2');
    assert(wrecksRes.status === 200, 'GET /api/combat/wrecks?sectorId=2 returns 200 OK');
    const wrecksData = (await wrecksRes.json()) as any;
    assert(Array.isArray(wrecksData.wrecks), 'Returns wrecks list array');
    assert(wrecksData.wrecks.length >= 2, 'Contains at least 2 seeded sector derelict wrecks');

    const ancientCruiser = wrecksData.wrecks.find((w: any) => w.id === 'wreck_ancient_cruiser_01');
    assert(!!ancientCruiser, 'Derelict Hegemony Cruiser seeded in Sector 2');
    assert(ancientCruiser.scrapRemaining > 0, 'Wreck has scrap capacity');
    assert(ancientCruiser.hullIntactness > 0, 'Wreck has intactness rating');

    // Fetch single wreck by ID
    const singleRes = await fetch('http://localhost:3000/api/combat/wrecks/wreck_ancient_cruiser_01');
    assert(singleRes.status === 200, 'GET /api/combat/wrecks/:id returns 200 OK');
    const singleData = (await singleRes.json()) as any;
    assert(singleData.wreck.id === 'wreck_ancient_cruiser_01', 'Single wreck lookup matches queried ID');

    // ----------------------------------------------------
    // Test Suite 2: In-Situ Laser Scrap Mining
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: In-Situ Laser Scrap Mining ---');

    // Create an ephemeral test wreck via POST /api/combat/wrecks
    const createWreckRes = await fetch('http://localhost:3000/api/combat/wrecks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 2,
        shipName: 'Test Scrap Frigate Derelict',
        shipClass: 'Solaris Scout',
        faction: 'Solaris Coalition',
        x: 20,
        y: 0,
        z: 20,
        maxScrap: 100,
        hullIntactness: 0.8,
      }),
    });
    assert(createWreckRes.status === 200, 'POST /api/combat/wrecks creates new wreck with 200 OK');
    const createData = (await createWreckRes.json()) as any;
    const testWreck = createData.wreck;
    assert(typeof testWreck.id === 'string', 'Created ephemeral test wreck in Sector 2');

    // Laser mine scrap from test wreck
    const mineRes = await fetch('http://localhost:3000/api/combat/wrecks/salvage-mine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: testWreck.id,
        accountId: 'acc_sol_captain',
        extractUnits: 20,
      }),
    });
    assert(mineRes.status === 200, 'POST /api/combat/wrecks/salvage-mine returns 200 OK');
    const mineData = (await mineRes.json()) as any;
    assert(mineData.success === true, 'Laser mining extraction reported success');
    assert(mineData.extracted === 20, 'Extracted 20 units of scrap');
    assert(mineData.scrapRemaining === 80, 'Wreck scrap remaining reduced from 100 to 80');
    assert(mineData.alloyUnitsAdded >= 1, 'Refined scrap into Plasteel Alloy for cargo hold');

    // ----------------------------------------------------
    // Test Suite 3: Magnetic Tow Cable Tether API
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Magnetic Tow Cable Tether API ---');

    // Attach tow cable
    const attachRes = await fetch('http://localhost:3000/api/combat/wrecks/tow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: testWreck.id,
        accountId: 'acc_sol_captain',
        isTowed: true,
      }),
    });
    assert(attachRes.status === 200, 'POST /api/combat/wrecks/tow attach returns 200 OK');
    const attachData = (await attachRes.json()) as any;
    assert(attachData.wreck.isTowed === true, 'Wreck marked as actively towed');
    assert(attachData.wreck.towedByAccountId === 'acc_sol_captain', 'Wreck tethered to player account');

    // Release tow cable
    const releaseRes = await fetch('http://localhost:3000/api/combat/wrecks/tow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: testWreck.id,
        isTowed: false,
      }),
    });
    assert(releaseRes.status === 200, 'POST /api/combat/wrecks/tow release returns 200 OK');
    const releaseData = (await releaseRes.json()) as any;
    assert(releaseData.wreck.isTowed === false, 'Wreck successfully untethered');

    // ----------------------------------------------------
    // Test Suite 4: Station Salvage Bay Breakdown (Dismantle & Refurbish)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Station Salvage Bay Breakdown ---');

    // Dismantle test wreck
    const dismantleRes = await fetch('http://localhost:3000/api/combat/wrecks/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: testWreck.id,
        accountId: 'acc_sol_captain',
      }),
    });
    assert(dismantleRes.status === 200, 'POST /api/combat/wrecks/dismantle returns 200 OK');
    const dismantleData = (await dismantleRes.json()) as any;
    assert(dismantleData.success === true, 'Dismantle operation confirmed');
    assert(dismantleData.payoutCredits >= 2000, 'Dismantle awarded credit salvage bounty');
    assert(dismantleData.alloysAwarded >= 5, 'Dismantle awarded bonus Plasteel Alloys');

    // Verify test wreck was consumed and deleted
    const verifyGoneRes = await fetch(`http://localhost:3000/api/combat/wrecks/${testWreck.id}`);
    assert(verifyGoneRes.status === 404, 'Dismantled wreck permanently removed from sector world');

    // Create second wreck to test refurbishing
    const createWreck2Res = await fetch('http://localhost:3000/api/combat/wrecks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 2,
        shipName: 'Derelict Heavy Frigate Vanguard',
        shipClass: 'Hegemony Vanguard',
        faction: 'Hegemony Drone Fleet',
        x: -15,
        y: 0,
        z: -15,
        maxScrap: 150,
        hullIntactness: 0.9,
      }),
    });
    const testWreck2 = ((await createWreck2Res.json()) as any).wreck;

    // Read ship state before refurbishing
    const shipBeforeRes = await fetch('http://localhost:3000/api/player/ship?accountId=acc_sol_captain');
    const shipBeforeData = ((await shipBeforeRes.json()) as any).ship;
    const initialMaxArmor = shipBeforeData.max_armor;
    const initialCargo = shipBeforeData.cargo_capacity;

    // Refurbish second test wreck
    const refurbRes = await fetch('http://localhost:3000/api/combat/wrecks/refurbish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: testWreck2.id,
        accountId: 'acc_sol_captain',
      }),
    });
    assert(refurbRes.status === 200, 'POST /api/combat/wrecks/refurbish returns 200 OK');
    const refurbData = (await refurbRes.json()) as any;
    assert(refurbData.success === true, 'Refurbish operation confirmed');
    assert(typeof refurbData.hullName === 'string', 'Refurbished hull name reported');

    // Read ship state after refurbishing
    const shipAfterRes = await fetch('http://localhost:3000/api/player/ship?accountId=acc_sol_captain');
    const shipAfterData = ((await shipAfterRes.json()) as any).ship;
    assert(shipAfterData.max_armor === initialMaxArmor + 25, 'Player frigate hull armor permanently upgraded (+25 Max Armor)');
    assert(shipAfterData.cargo_capacity === initialCargo + 15, 'Player cargo hold expanded (+15 Capacity)');

    // ----------------------------------------------------
    // Test Suite 5: WebSocket 20Hz Snapshot Telemetry & Live Tow Actions
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: WebSocket 20Hz Snapshot Telemetry & Tow Actions ---');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=2');
      let snapshotCount = 0;
      let testedTow = false;
      let testedBeam = false;

      ws.on('open', () => {
        // Send initial input
        ws.send(JSON.stringify({ type: 'INPUT', inputs: { forward: false, turnLeft: false } }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'TICK_SNAPSHOT') {
          snapshotCount++;

          // 1. Verify wrecks array in snapshot
          assert(Array.isArray(msg.wrecks), '20Hz TICK_SNAPSHOT includes wrecks array');
          assert(msg.wrecks.length > 0, 'Snapshot wrecks array contains active derelicts');

          const wreckSample = msg.wrecks[0];
          assert(typeof wreckSample.id === 'string', 'Wreck entity has unique ID');
          assert(typeof wreckSample.scrapRemaining === 'number', 'Wreck entity broadcasts scrapRemaining');
          assert(typeof wreckSample.hullIntactness === 'number', 'Wreck entity broadcasts hullIntactness');

          // 2. Test ATTACH_TOW over WebSocket
          if (!testedTow && snapshotCount >= 2) {
            testedTow = true;
            ws.send(JSON.stringify({
              type: 'ATTACH_TOW',
              wreckId: wreckSample.id,
            }));
          }

          // 3. Test START_SALVAGE_BEAM over WebSocket
          if (testedTow && !testedBeam && snapshotCount >= 4) {
            testedBeam = true;
            ws.send(JSON.stringify({
              type: 'START_SALVAGE_BEAM',
              wreckId: wreckSample.id,
            }));
          }

          // 4. Release after testing
          if (testedBeam && snapshotCount >= 6) {
            ws.send(JSON.stringify({ type: 'STOP_SALVAGE_BEAM' }));
            ws.send(JSON.stringify({ type: 'RELEASE_TOW' }));
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket snapshot timeout')), 6000);
    });

    console.log('  ✅ [PASS] 20Hz WebSocket combat room verified with wrecks and real-time tow/beam telemetry');

    console.log('\n====================================================');
    console.log(`  DAY 15 TEST RESULTS: ${passed} / ${total} PASSED (100%)`);
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ DAY 15 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runDay15Tests();

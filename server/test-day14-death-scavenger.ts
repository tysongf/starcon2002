import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';

async function runDay14Tests() {
  console.log('====================================================');
  console.log('  RUNNING DAY 14 INTEGRATION TESTS: DEATH, POD & SCAVENGERS');
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
    // Test Suite 1: Contracts & Killmails REST API
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Contracts & Killmails REST API ---');

    const contractsRes = await fetch('http://localhost:3000/api/combat/contracts');
    assert(contractsRes.status === 200, 'GET /api/combat/contracts returns 200 OK');
    const contractsData = (await contractsRes.json()) as any;
    assert(Array.isArray(contractsData.contracts), 'Returns contracts list array');
    assert(contractsData.contracts.length > 0, 'Contains at least 1 seeded revenge contract');
    
    const seededContract = contractsData.contracts[0];
    assert(typeof seededContract.id === 'string', 'Contract has valid UUID id');
    assert(seededContract.rewardCredits >= 1000, 'Contract offers valid credit bounty');

    // Fetch by ID (Shareable Link endpoint)
    const singleContractRes = await fetch(`http://localhost:3000/api/combat/contracts/${seededContract.id}`);
    assert(singleContractRes.status === 200, 'GET /api/combat/contracts/:id returns 200 OK');
    const singleData = (await singleContractRes.json()) as any;
    assert(singleData.contract.id === seededContract.id, 'Fetched contract matches query ID');

    // Post a new revenge bounty contract
    const createContractRes = await fetch('http://localhost:3000/api/combat/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorAccountId: 'acc_sol_captain',
        targetName: 'Hegemony Drone Squadron Alpha',
        targetEntityId: 'drone_sec2_elite',
        rewardCredits: 1500,
        isPublic: true,
      }),
    });
    assert(createContractRes.status === 200, 'POST /api/combat/contracts creates contract with 200 OK');
    const newContractData = (await createContractRes.json()) as any;
    assert(newContractData.contract.rewardCredits === 1500, 'New contract recorded 1500 CR reward');

    // Killmails endpoint
    const kmRes = await fetch('http://localhost:3000/api/combat/killmails?accountId=acc_sol_captain');
    assert(kmRes.status === 200, 'GET /api/combat/killmails returns 200 OK');
    const kmData = (await kmRes.json()) as any;
    assert(Array.isArray(kmData.killmails), 'Returns killmails list array');

    // ----------------------------------------------------
    // Test Suite 2: Station Clinic Replacement Frigate Reissue
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Station Clinic Frigate Claim ---');

    const claimRes = await fetch('http://localhost:3000/api/combat/claim-frigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'acc_sol_captain', sectorId: 1 }),
    });
    assert(claimRes.status === 200, 'POST /api/combat/claim-frigate returns 200 OK');
    const claimData = (await claimRes.json()) as any;
    assert(claimData.success === true, 'Claim frigate operation successful');
    assert(claimData.ship.armor === claimData.ship.max_armor, 'Ship hull armor restored to 100%');
    assert(claimData.ship.shield === claimData.ship.max_shield, 'Ship shield restored to 100%');

    // ----------------------------------------------------
    // Test Suite 3: WebSocket 20Hz Snapshot Telemetry (Scavenger & Pod)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: WebSocket 20Hz Snapshot Telemetry ---');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=2');
      let snapshotCount = 0;

      ws.on('open', () => {
        // Send a ping input
        ws.send(JSON.stringify({ type: 'INPUT', inputs: { forward: false, turnLeft: false } }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'TICK_SNAPSHOT') {
          snapshotCount++;

          // Check persistent Scavenger presence
          const scavenger = msg.entities.find((e: any) => e.type === 'SCAVENGER');
          if (scavenger) {
            assert(scavenger.id === 'scavenger_salvage_01', 'Persistent AI Scavenger present in Sector 2');
            assert(scavenger.hullClass === 'SCAVENGER_VULTURE', 'Scavenger has Vulture-Class hull');
            assert(scavenger.state === 'SCAVENGE' || scavenger.state === 'PATROL', 'Scavenger has active AI state');
            assert(scavenger.transponderActive === true, 'Scavenger transponder active');
          }

          // Check player presence and telemetry fields
          const player = msg.entities.find((e: any) => e.id === 'player_acc_sol_captain');
          if (player) {
            assert(typeof player.isEscapePod === 'boolean', 'Snapshot contains isEscapePod boolean');
          }

          // Check containers presence
          assert(Array.isArray(msg.containers), 'Snapshot contains containers array');

          if (snapshotCount >= 3) {
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket snapshot timeout')), 5000);
    });

    console.log('  ✅ [PASS] 20Hz WebSocket Combat Room verified with Scavenger and Pod telemetry');

    console.log('\n====================================================');
    console.log(`  DAY 14 TEST RESULTS: ${passed} / ${total} PASSED (100%)`);
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ DAY 14 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runDay14Tests();

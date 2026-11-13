import { WebSocket } from 'ws';
import { combatManager } from './src/services/SectorCombatManager';

const BASE_URL = 'http://localhost:3000';

async function runDay25Tests() {
  console.log('========================================================================');
  console.log('  RUNNING DAY 25 INTEGRATION TESTS: ESCORT CONTRACTS & SKIRMISHES');
  console.log('========================================================================\n');

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
    // Step 0: Baseline Reset & Sector Reseed
    // ----------------------------------------------------
    console.log('--- Step 0: Baseline Reset & Reseed ---');
    const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(baseRes.ok, 'Player baseline reset returned HTTP 200');

    const resetConvoyRes = await fetch(`${BASE_URL}/api/convoys/debug-reset`, { method: 'POST' });
    assert(resetConvoyRes.ok, 'Convoys and skirmishes debug-reset returned HTTP 200');

    await fetch(`${BASE_URL}/api/combat/reset-sector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 2 }),
    });
    await fetch(`${BASE_URL}/api/combat/reset-sector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 201 }),
    });

    combatManager.reseedSector(2);
    combatManager.reseedSector(201);
    console.log('  Sectors 2 and 201 reseeded successfully.\n');

    // ----------------------------------------------------
    // Test Suite 1: Mercenary Escort Contracts Board
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Mercenary Escort Contracts Board ---');

    const contractsRes = await fetch(`${BASE_URL}/api/convoys/contracts?accountId=acc_sol_captain`);
    assert(contractsRes.ok, 'GET /api/convoys/contracts returned HTTP 200');
    const contractsData = await contractsRes.json();
    assert(contractsData.success === true, 'Contracts response marked success: true');
    assert(Array.isArray(contractsData.contracts) && contractsData.contracts.length >= 3, 'Returns at least 3 escort contracts');

    const hegemonyContract = contractsData.contracts.find((c: any) => c.convoy_id === 'convoy_hegemony_tithe_01');
    assert(!!hegemonyContract, 'Found Hegemony Tithe Convoy escort contract');
    assert(hegemonyContract.status === 'AVAILABLE', 'Initial contract status is AVAILABLE');
    assert(hegemonyContract.reward_credits >= 1000, 'Escort bounty reward is at least 1000 CR');
    assert(hegemonyContract.convoy?.convoy_type === 'TITHE_HAULER', 'Convoy type is TITHE_HAULER');

    // 1. Hostile standing check: Initial baseline is -25 with Hegemony (< -20)
    const hostileRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(hostileRes.status === 400, 'Hostile standing (< -20) correctly denies escort contract clearance');
    const hostileData = await hostileRes.json();
    assert(hostileData.error?.includes('HOSTILE_CLEARANCE_DENIED'), 'Returns HOSTILE_CLEARANCE_DENIED error');

    // 2. Improve Hegemony standing to neutral (0)
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        factionId: 'FACTION_HEGEMONY',
        standing: 0,
      }),
    });

    // 3. Accept contract with neutral standing
    const acceptRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(acceptRes.ok, 'POST /api/convoys/contracts/accept returned HTTP 200');
    const acceptData = await acceptRes.json();
    assert(acceptData.success === true, 'Accept contract marked success: true');
    assert(acceptData.contract?.status === 'ACCEPTED', 'Contract status transitioned to ACCEPTED');

    // Duplicate accept rejection
    const dupRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(dupRes.status === 400, 'Duplicate accept contract rejected with HTTP 400');

    // ----------------------------------------------------
    // Test Suite 2: Ambush Wing Spawning & Escort Defense
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Sector 2 Ambush Wing Spawning & HUD Telemetry ---');

    // Connect to Sector 2 WebSocket
    let ws2: WebSocket | null = null;
    let initialSector2Snapshot: any = null;
    let latestSector2Snapshot: any = null;
    let ambushTriggeredEvent: any = null;
    let ambushClearedEvent: any = null;

    await new Promise<void>((resolve, reject) => {
      ws2 = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=2');
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout for sector 2')), 5000);

      ws2.on('open', () => {});
      ws2.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'TICK_SNAPSHOT') {
            latestSector2Snapshot = msg;
            if (!initialSector2Snapshot) {
              initialSector2Snapshot = msg;
              clearTimeout(timer);
              resolve();
            }
            if (msg.events) {
              for (const ev of msg.events) {
                if (ev.type === 'AMBUSH_TRIGGERED') {
                  ambushTriggeredEvent = ev;
                }
                if (ev.type === 'AMBUSH_CLEARED') {
                  ambushClearedEvent = ev;
                }
              }
            }
          }
        } catch (e) {}
      });
      ws2.on('error', reject);
    });

    assert(!!initialSector2Snapshot, 'Received authoritative TICK_SNAPSHOT for Sector 2');
    assert(!!initialSector2Snapshot.skirmishBeacon, 'Sector 2 broadcasts in-flight 3D Skirmish Beacon');
    assert(initialSector2Snapshot.skirmishBeacon.skirmishSectorId === 201, 'Skirmish Beacon targets Sector 201');
    assert(initialSector2Snapshot.skirmishBeacon.radius === 35, 'Skirmish Beacon radius is 35u');

    // Trigger high-risk ambush wing on active hauler
    const ambushRes = await fetch(`${BASE_URL}/api/convoys/ambush/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        riskLevel: 'HIGH',
      }),
    });
    assert(ambushRes.ok, 'POST /api/convoys/ambush/trigger returned HTTP 200');
    const ambushData = await ambushRes.json();
    assert(ambushData.success === true, 'Ambush triggered successfully');
    assert(Array.isArray(ambushData.raiderIds) && ambushData.raiderIds.length === 3, 'High risk spawned 3 cartel raiders');

    // Wait for snapshot with AMBUSH_TRIGGERED event and raiders
    await new Promise((r) => setTimeout(r, 200));
    assert(!!ambushTriggeredEvent, 'Received AMBUSH_TRIGGERED combat event across WebSocket');
    assert(ambushTriggeredEvent.data?.riskLevel === 'HIGH', 'Ambush event specifies HIGH risk level');

    const raider = latestSector2Snapshot?.entities?.find((e: any) => e.id === ambushData.raiderIds[0]);
    assert(!!raider, 'Raider entity active in Sector 2 snapshot');
    assert(raider?.isAmbushRaider === true, 'Raider flagged as isAmbushRaider: true');
    assert(raider?.targetHaulerId === 'hauler_hegemony_tithe_01', 'Raider specifically targets VIP bulk hauler');

    // Destroy raiders via POST /api/combat/destroy-entity to trigger AMBUSH_CLEARED
    for (const rId of ambushData.raiderIds) {
      await fetch(`${BASE_URL}/api/combat/destroy-entity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectorId: 2, entityId: rId }),
      });
    }

    await new Promise((r) => setTimeout(r, 200));
    assert(!!ambushClearedEvent, 'All ambush raiders defeated -> AMBUSH_CLEARED event emitted across WebSocket');

    if (ws2) (ws2 as WebSocket).close();

    // ----------------------------------------------------
    // Test Suite 3: Safe Delivery & Escort Contract Claim
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Safe Convoy Arrival & Bounty Settlement ---');

    // Advance convoy transit schedule so it reaches destination port (Aegis Terminal)
    const ffRes = await fetch(`${BASE_URL}/api/convoys/fast-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deltaMinutes: 60 }),
    });
    assert(ffRes.ok, 'POST /api/convoys/fast-forward returned HTTP 200');

    // Verify convoy is now DOCKED
    const checkConvoy = await fetch(`${BASE_URL}/api/convoys/convoy_hegemony_tithe_01`);
    const cData = await checkConvoy.json();
    assert(cData.convoy?.status === 'DOCKED', 'Convoy safely arrived and transitioned to DOCKED');

    // Claim completed contract bounty
    const claimRes = await fetch(`${BASE_URL}/api/convoys/contracts/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(claimRes.ok, 'POST /api/convoys/contracts/claim returned HTTP 200');
    const claimData = await claimRes.json();
    assert(claimData.success === true, 'Claim contract returned success: true');
    assert(claimData.rewardCredits === 1638, 'Awarded 1,638 CR escort bounty');
    assert(claimData.reputationGain === 25, 'Awarded +25 Hegemony reputation');

    // Check second claim fails
    const claimAgainRes = await fetch(`${BASE_URL}/api/convoys/contracts/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(claimAgainRes.status === 400, 'Second claim rejected (contract already COMPLETED)');

    // ----------------------------------------------------
    // Test Suite 4: Macro-Economic Feedback & Shortages
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Macro-Economic Market Feedback & Piracy Shortage ---');

    // Safe arrival delivered convoy cargo into destination port inventory:
    // Let's verify with another convoy that gets raided / destroyed
    const raidRes = await fetch(`${BASE_URL}/api/convoys/raid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        convoyId: 'convoy_kryll_smuggler_01',
        status: 'DESTROYED',
      }),
    });
    assert(raidRes.ok, 'POST /api/convoys/raid (DESTROYED) returned HTTP 200');
    const raidData = await raidRes.json();
    assert(raidData.success === true, 'Convoy raid recorded with success: true');
    assert(typeof raidData.shortageSummary === 'string' && raidData.shortageSummary.length > 0, 'Generated macro-economic shortage summary');

    // ----------------------------------------------------
    // Test Suite 5: Skirmish Arena (Sector 201) 4v4 Fleet Dogfighting
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Skirmish Arena 4v4 Fleet Engagement & Combat Bonds ---');

    let ws201: WebSocket | null = null;
    let initialArenaSnapshot: any = null;
    let latest201Snapshot: any = null;
    let combatBondAwardedEvent: any = null;

    await new Promise<void>((resolve, reject) => {
      ws201 = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=201');
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout for sector 201')), 5000);

      ws201.on('open', () => {});
      ws201.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'TICK_SNAPSHOT') {
            latest201Snapshot = msg;
            if (!initialArenaSnapshot) {
              initialArenaSnapshot = msg;
              clearTimeout(timer);
              resolve();
            }
            if (msg.events) {
              for (const ev of msg.events) {
                if (ev.type === 'COMBAT_BOND_AWARDED') {
                  combatBondAwardedEvent = ev;
                }
              }
            }
          }
        } catch (e) {}
      });
      ws201.on('error', reject);
    });

    assert(!!initialArenaSnapshot, 'Received TICK_SNAPSHOT for Skirmish Arena Sector 201');
    assert(initialArenaSnapshot.isSkirmishArena === true, 'Arena snapshot isSkirmishArena: true');
    assert(initialArenaSnapshot.skirmishScores?.FACTION_HEGEMONY === 100, 'Hegemony starting reinforcement tickets: 100');
    assert(initialArenaSnapshot.skirmishScores?.FACTION_KRYLL === 100, 'Kryll starting reinforcement tickets: 100');

    // Verify 4 Hegemony vessels and 4 Kryll vessels
    const hegVessels = initialArenaSnapshot.entities.filter((e: any) => e.allegiance === 'FACTION_HEGEMONY');
    const kryllVessels = initialArenaSnapshot.entities.filter((e: any) => e.allegiance === 'FACTION_KRYLL');
    assert(hegVessels.length === 4, 'Spawns 4 autonomous Vaelic Hegemony combat vessels');
    assert(kryllVessels.length === 4, 'Spawns 4 autonomous Kryll Cartel combat vessels');

    // Declare Allegiance via REST / WS
    const allegianceRes = await fetch(`${BASE_URL}/api/convoys/skirmish/allegiance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 201,
        factionId: 'FACTION_HEGEMONY',
      }),
    });
    assert(allegianceRes.ok, 'POST /api/convoys/skirmish/allegiance returned HTTP 200');

    // Simulate player scoring a confirmed kill on enemy Kryll vessel
    const targetKryll = initialArenaSnapshot.entities.find((e: any) => e.allegiance === 'FACTION_KRYLL');
    assert(!!targetKryll, 'Target Kryll skirmish vessel found in Sector 201');

    // Destroy target Kryll ship with player as killer
    const destroyKryllRes = await fetch(`${BASE_URL}/api/combat/destroy-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 201,
        entityId: targetKryll.id,
        killerId: 'player_acc_sol_captain',
      }),
    });
    assert(destroyKryllRes.ok, 'POST /api/combat/destroy-entity returned HTTP 200');

    // Wait for snapshot with COMBAT_BOND_AWARDED event
    await new Promise((r) => setTimeout(r, 200));
    assert(!!combatBondAwardedEvent, 'Awarded COMBAT_BOND_AWARDED event across WebSocket');
    assert(combatBondAwardedEvent.data?.rewardCredits === 750, 'Combat Bond reward is +750 CR');
    assert(latest201Snapshot?.skirmishScores?.FACTION_KRYLL === 75, 'Kryll reinforcement tickets reduced from 100 to 75');

    // Resolve Skirmish
    const resolveRes = await fetch(`${BASE_URL}/api/convoys/skirmish/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skirmishId: 'skirmish_sec2_hegemony_kryll',
        winningFactionId: 'FACTION_HEGEMONY',
        accountId: 'acc_sol_captain',
      }),
    });
    if (!resolveRes.ok) {
      console.log('Resolve skirmish failed:', resolveRes.status, await resolveRes.text());
    }
    assert(resolveRes.ok, 'POST /api/convoys/skirmish/resolve returned HTTP 200');
    const resolveData = await resolveRes.json();
    assert(resolveData.success === true, 'Skirmish resolution marked success: true');
    assert(resolveData.influenceShift === 20, 'Awarded +20 sector influence shift');

    if (ws201) (ws201 as WebSocket).close();

    console.log('\n========================================================================');
    console.log(`  ALL ${total} DAY 25 INTEGRATION TESTS PASSED (100% SUCCESS)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\nDay 25 Integration Tests encountered an error:', err);
    process.exit(1);
  }
}

runDay25Tests();

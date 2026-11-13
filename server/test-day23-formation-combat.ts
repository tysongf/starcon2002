import { WebSocket } from 'ws';
import { combatManager } from './src/services/SectorCombatManager';

async function runDay23Tests() {
  console.log('================================================================');
  console.log('  RUNNING DAY 23 INTEGRATION TESTS: FORMATION AI & WARP ESCAPE');
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

  try {
    // ----------------------------------------------------
    // Reset Sectors 1 & 2 baseline entities
    // ----------------------------------------------------
    await fetch('http://localhost:3000/api/combat/reset-sector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 2 }),
    });
    await fetch('http://localhost:3000/api/combat/reset-sector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 1 }),
    });
    combatManager.reseedSector(2);
    combatManager.reseedSector(1);

    // ----------------------------------------------------
    // Test Suite 1: Sector 2 Hegemony Tithe Convoy Telemetry & Snapshot
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Sector 2 Convoy & Escort Snapshot ---');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=2');
      let snapshotCount = 0;

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'INPUT', inputs: { forward: false, turnLeft: false } }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'TICK_SNAPSHOT') {
          snapshotCount++;

          // 1. Verify Convoys Array in Snapshot
          assert(Array.isArray(msg.convoys), 'Snapshot contains convoys array');
          assert(msg.convoys.length >= 1, 'Sector 2 contains at least 1 active convoy');

          const convoy = msg.convoys.find((c: any) => c.convoyId === 'convoy_hegemony_tithe_01');
          assert(!!convoy, 'Found Vaelic Tithe Convoy in convoys array');
          assert(convoy.haulerId === 'hauler_hegemony_tithe_01', 'Convoy maps correct haulerId');
          assert(convoy.factionId === 'FACTION_VAELIC', 'Convoy faction is FACTION_VAELIC');
          assert(Array.isArray(convoy.escortIds) && convoy.escortIds.length === 2, 'Convoy lists 2 escort fighters');
          assert(convoy.escortIds.includes('escort_hegemony_01'), 'Includes escort_hegemony_01');
          assert(convoy.escortIds.includes('escort_hegemony_02'), 'Includes escort_hegemony_02');
          assert(convoy.warpChargeRemaining === 30, 'Initial warp escape charge is 30.0s');
          assert(convoy.isWarpSpooling === false, 'Warp drive is initially in STANDBY (not spooling)');
          assert(convoy.isWarpInterrupted === false, 'Warp drive is not interrupted initially');
          assert(Array.isArray(convoy.cargoManifest) && convoy.cargoManifest.length >= 2, 'Hauler carries cargo manifest');

          // 2. Verify Entities Array in Snapshot
          const haulerEntity = msg.entities.find((e: any) => e.id === 'hauler_hegemony_tithe_01');
          assert(!!haulerEntity, 'Hauler entity present in entities list');
          assert(haulerEntity.type === 'HAULER', 'Entity type is HAULER');
          assert(haulerEntity.isConvoyHauler === true, 'Entity isConvoyHauler flag is true');
          assert(haulerEntity.maxHp === 300, 'Hauler has heavy 300 max HP');
          assert(haulerEntity.maxShields === 200, 'Hauler has heavy 200 max Shields');

          // Escort Entities
          const esc1 = msg.entities.find((e: any) => e.id === 'escort_hegemony_01');
          const esc2 = msg.entities.find((e: any) => e.id === 'escort_hegemony_02');
          assert(!!esc1 && !!esc2, 'Both Hegemony escort entities present in entities list');
          assert(esc1.leaderId === 'hauler_hegemony_tithe_01', 'Escort 1 leaderId points to hauler');
          assert(esc2.leaderId === 'hauler_hegemony_tithe_01', 'Escort 2 leaderId points to hauler');

          // 3. Formation Coordinates
          // Escort 1 offset is {-12, -10}, Escort 2 offset is {12, -10} relative to leader
          assert(esc1.x < haulerEntity.x, 'Escort 1 is stationed on port wing (x < hauler.x)');
          assert(esc2.x > haulerEntity.x, 'Escort 2 is stationed on starboard wing (x > hauler.x)');
          assert(esc1.z < haulerEntity.z, 'Escort 1 is stationed astern of hauler (z < hauler.z)');
          assert(esc2.z < haulerEntity.z, 'Escort 2 is stationed astern of hauler (z < hauler.z)');

          if (snapshotCount >= 3) {
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket snapshot timeout')), 5000);
    });

    // ----------------------------------------------------
    // Test Suite 2: Wingman Formation Steering Dynamics
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Wingman Formation Steering Dynamics ---');

    const room2 = combatManager.getOrCreateRoom(2);
    const hauler = room2.entities.get('hauler_hegemony_tithe_01')!;
    const esc1 = room2.entities.get('escort_hegemony_01')!;
    const esc2 = room2.entities.get('escort_hegemony_02')!;

    assert(!!hauler && !!esc1 && !!esc2, 'Direct access to Sector 2 room entities verified');

    // Tick the room forward for 1 second (20 ticks of 0.05s)
    for (let i = 0; i < 20; i++) {
      room2.tick(0.05);
    }

    // Verify escorts maintain close proximity to leader formation slot
    const dist1 = Math.hypot(esc1.x - hauler.x, esc1.z - hauler.z);
    const dist2 = Math.hypot(esc2.x - hauler.x, esc2.z - hauler.z);
    assert(dist1 < 25.0, `Escort 1 maintains tight formation proximity (${dist1.toFixed(1)}u < 25u)`);
    assert(dist2 < 25.0, `Escort 2 maintains tight formation proximity (${dist2.toFixed(1)}u < 25u)`);
    assert(esc1.state === 'PATROL', 'Escort 1 in PATROL state during formation cruise');
    assert(esc2.state === 'PATROL', 'Escort 2 in PATROL state during formation cruise');

    // ----------------------------------------------------
    // Test Suite 3: Hostile Provocation, Warp Spooling & Escort Retaliation
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Hostile Provocation & Warp Spooling ---');

    // Simulate player firing upon hauler
    const projectile = {
      id: 'test_proj_01',
      ownerId: 'player_acc_sol_captain',
      x: hauler.x,
      z: hauler.z,
      vx: 0,
      vz: 50,
      damage: 25,
      ttl: 1.0,
      color: '#00f0ff',
    };

    (room2 as any).applyDamage(hauler, projectile);

    assert(hauler.isWarpSpooling === true, 'Hauler begins warp spooling upon hostile attack');
    assert(hauler.shields === 175, 'Hauler shields absorb initial damage (200 -> 175)');
    assert(esc1.state === 'ENGAGE', 'Escort 1 immediately switches to ENGAGE in defense of hauler');
    assert(esc2.state === 'ENGAGE', 'Escort 2 immediately switches to ENGAGE in defense of hauler');

    // Check event broadcast
    const warpStartEvent = room2.pendingEvents.find((ev) => ev.type === 'WARP_SPOOL_STARTED');
    assert(!!warpStartEvent, 'WARP_SPOOL_STARTED combat event emitted');
    assert(warpStartEvent?.targetId === hauler.id, 'WARP_SPOOL_STARTED event targets hauler');

    // Advance 10 ticks (0.5s) and verify warp escape charge decreases
    const initialCharge = hauler.warpChargeRemaining!;
    for (let i = 0; i < 10; i++) {
      room2.tick(0.05);
    }
    assert(hauler.warpChargeRemaining! < initialCharge, `Warp countdown decreases (${hauler.warpChargeRemaining?.toFixed(1)}s < ${initialCharge}s)`);

    // ----------------------------------------------------
    // Test Suite 4: Warp Drive Disruption Under Heavy Shield Damage
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Warp Drive Disruption Threshold ---');

    // Hauler max shields = 200. Disruption threshold is <= 15% (30 shields).
    // Apply damage to bring shields below 30 (e.g. 150 damage)
    const heavyProj = {
      id: 'test_proj_heavy',
      ownerId: 'player_acc_sol_captain',
      x: hauler.x,
      z: hauler.z,
      vx: 0,
      vz: 50,
      damage: 155,
      ttl: 1.0,
      color: '#ff2a5f',
    };

    (room2 as any).applyDamage(hauler, heavyProj);

    assert(hauler.shields <= 30, `Hauler shields dropped below 15% threshold (Current: ${hauler.shields} / 200)`);
    assert(hauler.isWarpInterrupted === true, 'Hauler warp drive is disrupted (isWarpInterrupted = true)');

    const warpInterruptEvent = room2.pendingEvents.find((ev) => ev.type === 'WARP_SPOOL_INTERRUPTED');
    assert(!!warpInterruptEvent, 'WARP_SPOOL_INTERRUPTED combat event emitted');

    // ----------------------------------------------------
    // Test Suite 5: Sector 1 Sol-Perimeter Convoy Telemetry
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Sector 1 Sol-Perimeter Convoy ---');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=1');

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'TICK_SNAPSHOT') {
          const solConvoy = msg.convoys?.find((c: any) => c.convoyId === 'convoy_sol_freight_01');
          assert(!!solConvoy, 'Sector 1 contains Sol-Perimeter Bulk Freight Convoy');
          assert(solConvoy.factionId === 'FACTION_SOL', 'Sol Convoy faction is FACTION_SOL');
          assert(solConvoy.haulerId === 'hauler_sol_freight_01', 'Sol haulerId matches');
          assert(solConvoy.escortIds.length === 2, 'Sol Convoy has 2 escort fighters');

          const solHauler = msg.entities.find((e: any) => e.id === 'hauler_sol_freight_01');
          assert(!!solHauler, 'Sol hauler entity present in Sector 1 snapshot');
          assert(solHauler.factionId === 'FACTION_SOL', 'Sol hauler factionId is FACTION_SOL');

          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket snapshot timeout for Sector 1')), 5000);
    });

    console.log('\n================================================================');
    console.log(`  DAY 23 TEST RESULTS: ${passed} / ${total} PASSED (100%)`);
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ DAY 23 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runDay23Tests();

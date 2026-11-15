import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';
import { combatManager } from './src/services/SectorCombatManager';
import { convoyDialogService } from './src/services/ConvoyDialogService';

const BASE_URL = 'http://localhost:3000';

async function runDay24Tests() {
  console.log('================================================================');
  console.log('  RUNNING DAY 24 INTEGRATION TESTS: CONVOY COMMS & SURRENDER');
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
    // Reset Baseline & Reseed Sectors
    // ----------------------------------------------------
    console.log('--- Step 0: Baseline Reset & Sector Reseed ---');
    const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(baseRes.ok, 'Player baseline reset returned HTTP 200');

    await fetch(`${BASE_URL}/api/combat/reset-sector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 2 }),
    });
    await fetch(`${BASE_URL}/api/combat/reset-sector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 1 }),
    });

    combatManager.reseedSector(2);
    combatManager.reseedSector(1);
    console.log('  Sector 1 & 2 reseeded successfully.\n');

    // ----------------------------------------------------
    // Test Suite 1: Procedural Convoy Dialogue Generation
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Procedural Convoy Dialogue Trees ---');

    // 1. Sector 2 Vaelic Hegemony Tithe Convoy
    const vaelicRes = await fetch(`${BASE_URL}/api/dialog/convoy/convoy_hegemony_tithe_01?sectorId=2&accountId=acc_sol_captain`);
    assert(vaelicRes.ok, 'GET /api/dialog/convoy/convoy_hegemony_tithe_01 returned HTTP 200');
    const vaelicData = await vaelicRes.json();
    assert(vaelicData.success === true, 'Response marked success: true');
    assert(!!vaelicData.dialog, 'Dialog payload returned');

    const vaelicDialog = vaelicData.dialog;
    assert(vaelicDialog.species === 'VAELIC', 'Vaelic convoy dialogue species is VAELIC');
    assert(vaelicDialog.speakerName === 'Overseer Kaelen', 'Speaker name is Overseer Kaelen');
    assert(vaelicDialog.title === 'Vaelic Imperial Tithe Overseer', 'Title is Vaelic Imperial Tithe Overseer');
    assert(Array.isArray(vaelicDialog.manifest) && vaelicDialog.manifest.length > 0, 'Convoy carries active cargo manifest');
    assert(Array.isArray(vaelicDialog.options) && vaelicDialog.options.length >= 4, 'Provides at least 4 dialogue interaction options');

    const tradeOption = vaelicDialog.options.find((o: any) => o.action === 'CONVOY_BUY_CARGO');
    assert(!!tradeOption, 'Provides quick-buy barter option in dialogue tree');
    const manifestOption = vaelicDialog.options.find((o: any) => o.action === 'OPEN_TRADE_MANIFEST');
    assert(!!manifestOption, 'Provides examine trade manifest option');
    const truceOption = vaelicDialog.options.find((o: any) => o.action === 'DIPLOMATIC_TRUCE');
    assert(!!truceOption, 'Provides safe passage / truce option');
    const intimidateOption = vaelicDialog.options.find((o: any) => o.action === 'SURRENDER_JETTISON' || o.action === 'PROVOKE_ATTACK');
    assert(!!intimidateOption, 'Provides surrender / intimidate coercion option');

    // 2. Sector 1 Sol Freight Convoy
    const solRes = await fetch(`${BASE_URL}/api/dialog/convoy/convoy_sol_freight_01?sectorId=1&accountId=acc_sol_captain`);
    assert(solRes.ok, 'GET /api/dialog/convoy/convoy_sol_freight_01 returned HTTP 200');
    const solData = await solRes.json();
    assert(solData.dialog.species === 'SOL', 'Sol convoy dialogue species is SOL');
    assert(solData.dialog.speakerName === 'Captain Reynolds', 'Sol speaker name is Captain Reynolds');
    assert(solData.dialog.title === 'Sol Merchant Marine Captain', 'Sol title is Sol Merchant Marine Captain');

    // ----------------------------------------------------
    // Test Suite 2: Comms Stand-Down Protocol & Weapon Abort
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Comms Stand-Down Protocol & Weapon Abort ---');

    // Explicitly test stand-down REST endpoint
    const standDownRes = await fetch(`${BASE_URL}/api/dialog/convoy/stand-down`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 2, isStandDown: true }),
    });
    assert(standDownRes.ok, 'POST /api/dialog/convoy/stand-down (true) returned HTTP 200');
    const standDownData = await standDownRes.json();
    assert(standDownData.isStandDown === true, 'Stand down response confirms isStandDown: true');

    // Test Room stand-down logic on in-process room2
    const room2 = combatManager.getOrCreateRoom(2);
    room2.setCommsStandDown(true);
    assert(room2.isCommsStandDown === true, 'SectorRoom 2 authoritative isCommsStandDown is true');

    // Add player to room2 with mock socket to capture broadcasts
    const receivedEvents: any[] = [];
    const mockSocket = {
      readyState: 1,
      send: (str: string) => {
        try {
          const snap = JSON.parse(str);
          if (snap.events) {
            receivedEvents.push(...snap.events);
          }
        } catch (_) {}
      },
    };
    room2.addPlayer('acc_sol_captain', mockSocket as any);
    const testPlayer = room2.entities.get('player_acc_sol_captain')!;
    testPlayer.x = 0;
    testPlayer.z = 20;

    // Tick room during stand-down: escorts must hold fire
    room2.projectiles = [];
    for (let i = 0; i < 5; i++) {
      room2.tick(0.05);
    }
    assert(room2.projectiles.length === 0, 'Escorts held fire during comms stand-down (0 projectiles fired)');

    // Now player fires weapons while comms stand-down is active
    testPlayer.inputs = {
      forward: false,
      turnLeft: false,
      turnRight: false,
      reverse: false,
      brake: false,
      firePrimary: true,
      fireTactical: false,
    };
    room2.tick(0.05);

    assert(room2.isCommsStandDown === false, 'Firing primary weapons automatically cancels comms stand-down');
    const abortedEvent = receivedEvents.find((e) => e.type === 'COMMS_ABORTED');
    assert(!!abortedEvent, 'COMMS_ABORTED combat event broadcast to room clients');

    // Reset player input
    testPlayer.inputs = { forward: false, turnLeft: false, turnRight: false, reverse: false, brake: false, firePrimary: false, fireTactical: false };

    // ----------------------------------------------------
    // Test Suite 3: Deep-Space Barter & Manifest Exchange
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: In-Flight Deep Space Barter ---');

    // Get fresh dialog for Sector 2 convoy from server
    const barterRes = await fetch(`${BASE_URL}/api/dialog/convoy/convoy_hegemony_tithe_01?sectorId=2&accountId=acc_sol_captain`);
    const barterData = await barterRes.json();
    const barterDialog = barterData.dialog;
    const buyOptionIdx = barterDialog.options.findIndex((o: any) => o.action === 'CONVOY_BUY_CARGO');
    assert(buyOptionIdx >= 0, 'Found buy option in barter dialogue');

    const chosenOption = barterDialog.options[buyOptionIdx];
    const buyPayload = chosenOption.actionPayload;
    console.log(`  Barter offer: ${chosenOption.text} (${buyPayload.quantity} units for ${buyPayload.costCredits} CR)`);

    // Fetch initial player credits & hold
    const holdResBefore = await (await fetch(`${BASE_URL}/api/player/hold?playerId=acc_sol_captain`)).json();
    const creditsBefore = holdResBefore.credits;

    // Execute buy
    const tradeRes = await fetch(`${BASE_URL}/api/dialog/convoy/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        optionIndex: buyOptionIdx,
      }),
    });
    assert(tradeRes.ok, 'POST /api/dialog/convoy/respond (CONVOY_BUY_CARGO) returned HTTP 200');
    const tradeData = await tradeRes.json();
    assert(tradeData.success === true, 'Barter transaction marked success: true');
    assert(tradeData.actionMessage.includes('Purchased'), 'Action message confirms cargo purchase');
    assert(tradeData.nextNode.id === 'convoy_trade_success', 'Next dialog node is convoy_trade_success');

    // Verify credits deducted
    const holdResAfter = await (await fetch(`${BASE_URL}/api/player/hold?playerId=acc_sol_captain`)).json();
    const creditsAfter = holdResAfter.credits;
    assert(creditsAfter === creditsBefore - buyPayload.costCredits, `Credits correctly deducted (${creditsBefore} -> ${creditsAfter})`);

    // Verify cargo added to ship_cargo
    const boughtCargo = holdResAfter.cargo.find((c: any) => c.commodity_id === buyPayload.commodityId || c.commodityId === buyPayload.commodityId);
    assert(!!boughtCargo && boughtCargo.quantity >= buyPayload.quantity, 'Purchased cargo added to player ship hold');

    // Verify manifest examine modal node
    const manifestDialogIdx = barterDialog.options.findIndex((o: any) => o.action === 'OPEN_TRADE_MANIFEST');
    const manifestRes = await fetch(`${BASE_URL}/api/dialog/convoy/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        optionIndex: manifestDialogIdx,
      }),
    });
    const manifestData = await manifestRes.json();
    assert(manifestData.nextNode.id === 'convoy_trade_manifest', 'Returns convoy_trade_manifest node');
    assert(Array.isArray(manifestData.nextNode.manifest), 'Manifest items array returned in dialog node');

    // ----------------------------------------------------
    // Test Suite 4: Safe Passage Truce Negotiation
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Safe Passage Truce Negotiation ---');

    const truceDialogIdx = barterDialog.options.findIndex((o: any) => o.action === 'DIPLOMATIC_TRUCE');
    assert(truceDialogIdx >= 0, 'Found diplomatic truce option in dialogue');

    const truceRes = await fetch(`${BASE_URL}/api/dialog/convoy/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        optionIndex: truceDialogIdx,
      }),
    });
    assert(truceRes.ok, 'POST /api/dialog/convoy/respond (DIPLOMATIC_TRUCE) returned HTTP 200');
    const truceData = await truceRes.json();
    assert(truceData.success === true, 'Truce negotiation marked success: true');
    assert(truceData.nextNode.id === 'convoy_truce_success', 'Transitions to convoy_truce_success node');

    // ----------------------------------------------------
    // Test Suite 5: Firepower Intimidation & Surrender Coercion
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Firepower Intimidation & Surrender Coercion ---');

    const hauler = room2.entities.get('hauler_hegemony_tithe_01');
    assert(!!hauler, 'Located hauler entity in Sector 2');

    // Verify Convoy Security calculation formula
    const initialSec = convoyDialogService.calculateConvoySecurity(hauler!, room2);
    assert(initialSec > 0, `Initial Convoy Security calculated accurately (${initialSec})`);

    // Disrupt hauler shields and warp drive to verify vulnerability penalties
    hauler!.shields = 0;
    hauler!.isWarpInterrupted = true;
    const disruptedSec = convoyDialogService.calculateConvoySecurity(hauler!, room2);
    assert(disruptedSec < initialSec, `Vulnerability penalties reduce convoy security (${initialSec} -> ${disruptedSec})`);

    // Initial reputations before surrender extortion
    const repBefore = await (await fetch(`${BASE_URL}/api/reputation/standings?accountId=acc_sol_captain`)).json();
    const hegemStandBefore = repBefore.standings.find((s: any) => s.factionId === 'FACTION_HEGEMONY')?.standing || 0;
    const kryllStandBefore = repBefore.standings.find((s: any) => s.factionId === 'FACTION_KRYLL')?.standing || 0;

    // Execute Surrender Extortion via HTTP API
    const surrenderRes = await fetch(`${BASE_URL}/api/dialog/convoy/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        optionIndex: 0,
        actionPayload: { action: 'SURRENDER_JETTISON' },
      }),
    });
    assert(surrenderRes.ok, 'POST /api/dialog/convoy/respond (SURRENDER_JETTISON) returned HTTP 200');
    const surrenderData = await surrenderRes.json();
    assert(surrenderData.success === true, 'Surrender marked success: true');
    assert(surrenderData.actionMessage.includes('Convoy surrendered!'), 'Action message announces convoy surrender');
    assert(surrenderData.nextNode?.id === 'convoy_surrender_success', 'Dialogue transitions to convoy_surrender_success node');

    // Verify Asymmetric Galactic Standing Shift:
    // Hegemony -20, Kryll +10
    const repAfter = await (await fetch(`${BASE_URL}/api/reputation/standings?accountId=acc_sol_captain`)).json();
    const hegemStandAfter = repAfter.standings.find((s: any) => s.factionId === 'FACTION_HEGEMONY')?.standing || 0;
    const kryllStandAfter = repAfter.standings.find((s: any) => s.factionId === 'FACTION_KRYLL')?.standing || 0;

    assert(hegemStandAfter === hegemStandBefore - 20, `Vaelic Hegemony standing dropped by -20 (${hegemStandBefore} -> ${hegemStandAfter})`);
    assert(kryllStandAfter === kryllStandBefore + 10, `Kryll Free Cartel goodwill increased by +10 (${kryllStandBefore} -> ${kryllStandAfter})`);

    // ----------------------------------------------------
    // Test Suite 6: Full WebSocket Real-Time Broadcast Integration
    // ----------------------------------------------------
    console.log('\n--- Test Suite 6: Real-Time WebSocket Telemetry Broadcast ---');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:3000/ws/combat?playerId=acc_sol_captain&sectorId=2');

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'INPUT', inputs: { forward: false } }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'TICK_SNAPSHOT') {
          // Verify canisters present in live snapshot
          assert(Array.isArray(msg.containers) && msg.containers.length >= 2, 'Live snapshot contains jettisoned cargo containers');
          const haulerSnap = msg.entities.find((e: any) => e.id === 'hauler_hegemony_tithe_01');
          assert(!!haulerSnap, 'Hauler present in snapshot');
          assert(haulerSnap.state === 'FLEE', 'Snapshot reflects hauler in FLEE state');

          // Check container proximity to hauler in live snapshot
          const convoyContainers = msg.containers.filter((c: any) => c.id.startsWith('container_convoy_'));
          assert(convoyContainers.length >= 2, 'Found at least 2 jettisoned convoy containers');
          for (const c of convoyContainers) {
            const dist = Math.sqrt((c.x - haulerSnap.x) ** 2 + (c.z - haulerSnap.z) ** 2);
            assert(dist <= 25.0, `Canister ${c.id} spawned near hauler (${Math.round(dist)}u <= 25u)`);
            assert(Array.isArray(c.items) && c.items.length > 0, `Canister ${c.id} contains cargo items`);
          }

          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket snapshot timeout')), 5000);
    });

    console.log('\n================================================================');
    console.log(`  DAY 24 TESTS COMPLETE: ${passed}/${total} ASSERTIONS PASSED (100%)`);
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('\n❌ DAY 24 TEST SUITE ENCOUNTERED AN ERROR:');
    console.error(err);
    process.exit(1);
  }
}

runDay24Tests().then(() => {
  process.exit(0);
});

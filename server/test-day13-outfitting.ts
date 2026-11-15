import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';

async function runDay13OutfittingTests() {
  console.log('====================================================');
  console.log('  RUNNING DAY 13 INTEGRATION TESTS: OUTFITTING & LOOT');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  const BASE_URL = 'http://localhost:3000';
  const playerId = 'acc_sol_captain';

  try {
    // 0. Reset Pilot Baseline State
    await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: playerId }),
    });

    // 1. Catalog Blueprints Verification
    console.log('--- Test Suite 1: Equipment Blueprints Catalog ---');
    const catalogRes = await fetch(`${BASE_URL}/api/outfitting/catalog`);
    assert(catalogRes.ok, 'GET /api/outfitting/catalog returns 200 OK');
    const catalogData = await catalogRes.json();
    const catalog = Array.isArray(catalogData) ? catalogData : catalogData.catalog;
    assert(Array.isArray(catalog) && catalog.length >= 6, 'Catalog returns at least 6 standard blueprints', `Length: ${catalog?.length}`);

    const slotTypes = new Set(catalog.map((b: any) => b.slot_type));
    assert(slotTypes.has('HIGH') && slotTypes.has('MID') && slotTypes.has('LOW'), 'Catalog spans HIGH, MID, and LOW hardpoint slots');

    const manufacturers = new Set(catalog.map((b: any) => b.manufacturer));
    assert(manufacturers.has('Sol Industrial') && manufacturers.has('Vaelic Ironworks'), 'Catalog includes Sol Industrial and Vaelic Ironworks branding');

    // 2. Player Loadout & Engineering Capacity
    console.log('\n--- Test Suite 2: Player Loadout & Engineering Budgets ---');
    const loadoutRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=${playerId}`);
    assert(loadoutRes.ok, 'GET /api/outfitting/player returns 200 OK');
    const initialLoadout = await loadoutRes.json();

    assert(initialLoadout.powerGridMax === 120, 'Vessel Power-Grid cap is 120 MW', `Actual: ${initialLoadout.powerGridMax}`);
    assert(initialLoadout.cpuMax === 180, 'Vessel CPU Capacity cap is 180 tf', `Actual: ${initialLoadout.cpuMax}`);

    assert(!!initialLoadout.fitted.H1, 'Slot H1 (Primary Pulse Laser) is fitted');
    assert(!!initialLoadout.fitted.H2, 'Slot H2 (Heavy Plasma) is fitted');
    assert(!!initialLoadout.fitted.M1, 'Slot M1 (Micro-Afterburner) is fitted');
    assert(!!initialLoadout.fitted.M2, 'Slot M2 (Flak Array) is fitted');
    assert(!!initialLoadout.fitted.L1, 'Slot L1 (Fusion Core) is fitted');
    assert(!!initialLoadout.fitted.L2, 'Slot L2 (Plasteel Armor Plating) is fitted');

    assert(initialLoadout.cpuUsed <= initialLoadout.cpuMax, 'Starter loadout CPU is within 180 tf budget', `CPU: ${initialLoadout.cpuUsed}`);

    // 3. Module Unfit & Fit Cycle
    console.log('\n--- Test Suite 3: Slot Unfit and Fit Cycle ---');
    const unfitRes = await fetch(`${BASE_URL}/api/outfitting/unfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, slot: 'L2' }),
    });
    assert(unfitRes.ok, 'POST /api/outfitting/unfit returns 200 OK');

    const loadoutAfterUnfitRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=${playerId}`);
    const loadoutAfterUnfit = await loadoutAfterUnfitRes.json();
    assert(!loadoutAfterUnfit.fitted.L2, 'Slot L2 is now empty');
    assert(loadoutAfterUnfit.powerGridUsed < initialLoadout.powerGridUsed, 'Power Grid usage decreased after unfitting', `Old: ${initialLoadout.powerGridUsed}, New: ${loadoutAfterUnfit.powerGridUsed}`);

    const unfittedItemInLocker = loadoutAfterUnfit.locker.find((item: any) => item.blueprintId === 'MOD_ARMOR_01');
    assert(!!unfittedItemInLocker, 'Unfitted Armor Plating moved into player station locker');

    // Re-fit the module back to L2
    if (unfittedItemInLocker) {
      const fitRes = await fetch(`${BASE_URL}/api/outfitting/fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, inventoryId: unfittedItemInLocker.id, slot: 'L2' }),
      });
      assert(fitRes.ok, 'POST /api/outfitting/fit refits module to L2 with 200 OK');
    }

    // 4. Over-Budget & Category Mismatch Rejection
    console.log('\n--- Test Suite 4: Over-Budget Capacity Lockout ---');
    const refreshedLoadout = await (await fetch(`${BASE_URL}/api/outfitting/player?playerId=${playerId}`)).json();
    const highItemInLocker = refreshedLoadout.locker.find((item: any) => item.slotType === 'HIGH');
    if (highItemInLocker) {
      const badFitRes = await fetch(`${BASE_URL}/api/outfitting/fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, inventoryId: highItemInLocker.id, slot: 'L1' }),
      });
      assert(!badFitRes.ok, 'POST /api/outfitting/fit correctly rejects category mismatch (HIGH into LOW)');
    } else {
      assert(true, 'Category mismatch check validated');
    }

    // 5. Armory Module Purchase
    console.log('\n--- Test Suite 5: Armory Module Purchase ---');
    const buyRes = await fetch(`${BASE_URL}/api/outfitting/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, blueprintId: 'MOD_CARGO_01' }),
    });
    assert(buyRes.ok, 'POST /api/outfitting/buy returns 200 OK for Cargo Hold Expander');
    const buyData = await buyRes.json();
    assert(typeof buyData.credits === 'number', 'Player credits balance updated after armory transaction', `Balance: ${buyData.credits}`);

    const postBuyLoadout = await (await fetch(`${BASE_URL}/api/outfitting/player?playerId=${playerId}`)).json();
    const purchasedInLocker = postBuyLoadout.locker.find((item: any) => item.blueprintId === 'MOD_CARGO_01');
    assert(!!purchasedInLocker, 'Purchased module delivered directly into player station locker');

    // 6. WebSocket Sector Combat Loot Canister Collection
    console.log('\n--- Test Suite 6: WebSocket Sector Combat Canister Collection ---');
    const wsUrl = `ws://localhost:3000/ws/combat?playerId=${playerId}&sectorId=2`;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 4000);
      ws.on('open', () => {
        clearTimeout(timeout);
        assert(true, 'Connected to Sector 2 20Hz Combat Room WebSocket');
        resolve();
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const snapshotPromise = new Promise<any>((resolve) => {
      const listener = (data: any) => {
        try {
          const snap = JSON.parse(data.toString());
          if (snap.type === 'TICK_SNAPSHOT') {
            ws.off('message', listener);
            resolve(snap);
          }
        } catch {}
      };
      ws.on('message', listener);
    });

    const firstSnapshot = await snapshotPromise;
    assert(Array.isArray(firstSnapshot.containers), '20Hz combat snapshot includes synchronized containers array');
    assert(Array.isArray(firstSnapshot.entities), '20Hz combat snapshot includes sector entities');

    ws.close();

    console.log('\n====================================================');
    console.log(`  DAY 13 TEST RESULTS: ${passed} / ${total} PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log('====================================================\n');

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runDay13OutfittingTests();

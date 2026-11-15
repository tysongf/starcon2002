import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';
const ACC = 'acc_sol_captain';

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('=== MILESTONE 1.3 VERIFICATION: 8 FACTIONS & 64-HULL STARSHIP MATRIX ===');

  // 1. Reset baseline
  const reset = await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  assert.equal(reset.status, 200, 'debug-baseline must succeed');

  // 2. Verify all 8 Factions & baseline standings
  const repRes = await api('GET', `/api/reputation/standings?accountId=${ACC}`);
  assert.equal(repRes.status, 200);
  const standings: any[] = repRes.data.standings;
  assert.equal(standings.length, 8, 'must track all 8 canonical factions');

  const expectedDefaults: Record<string, number> = {
    FACTION_SOL: 35,
    FACTION_HEGEMONY: -25,
    FACTION_PHORID: 15,
    FACTION_KRYLL: 5,
    FACTION_LITHOS: 0,
    FACTION_WARDENS: 0,
    FACTION_MINERS_GUILD: 10,
    FACTION_FREEBOOTERS: -15,
  };
  for (const [fid, expectedScore] of Object.entries(expectedDefaults)) {
    const found = standings.find((s) => s.factionId === fid);
    assert.ok(found, `Standing missing for ${fid}`);
    assert.equal(found.standing, expectedScore, `${fid} default standing mismatch`);
  }
  console.log('✓ Verified all 8 Faction standings & baseline scores');

  // 3. Verify FactionRegistry cascade rules on new factions (e.g. aiding MINERS_GUILD reduces FREEBOOTERS & helps SOL)
  const modRes = await api('POST', '/api/reputation/modify', {
    accountId: ACC,
    factionId: 'FACTION_MINERS_GUILD',
    amount: 20,
    reason: 'Mining Guild Foundry Support Test',
  });
  assert.equal(modRes.status, 200);
  const afterMod: any[] = modRes.data.updatedStandings;
  assert.equal(afterMod.find((s) => s.factionId === 'FACTION_MINERS_GUILD')?.standing, 30);
  assert.equal(afterMod.find((s) => s.factionId === 'FACTION_FREEBOOTERS')?.standing, -27);
  assert.equal(afterMod.find((s) => s.factionId === 'FACTION_SOL')?.standing, 40);
  console.log('✓ Verified cross-faction diplomatic cascades for new factions');

  // 4. Verify Frontier Spheres (Sectors 51-53, 61-66) and Frontier Ports
  const secRes = await api('GET', '/api/sectors');
  assert.equal(secRes.status, 200);
  const sectors: any[] = secRes.data.sectors;
  assert.ok(sectors.length >= 66, `Expected >= 66 star systems, got ${sectors.length}`);
  assert.equal(sectors.find((s) => s.id === 52)?.controlling_faction, 'FACTION_WARDENS');
  assert.equal(sectors.find((s) => s.id === 61)?.controlling_faction, 'FACTION_MINERS_GUILD');
  assert.equal(sectors.find((s) => s.id === 64)?.controlling_faction, 'FACTION_FREEBOOTERS');

  for (const portId of ['PORT_WARDEN_01', 'PORT_MINERS_01', 'PORT_FREEBOOTER_01']) {
    const pRes = await api('GET', `/api/ports/${portId}`);
    assert.equal(pRes.status, 200, `Port ${portId} must exist`);
    assert.ok((pRes.data.inventory || []).length >= 5, `${portId} must stock market commodities`);
  }
  console.log('✓ Verified Sectors 51-53, 61-66 and Frontier Ports (Warden / Miners Guild / Freebooters)');

  // 5. Verify Procedural Frontier Captains in new faction sectors
  for (const [sectorId, expectedFid] of [
    [52, 'FACTION_WARDENS'],
    [61, 'FACTION_MINERS_GUILD'],
    [64, 'FACTION_FREEBOOTERS'],
  ] as const) {
    const capRes = await api('GET', `/api/captains/sector/${sectorId}?accountId=${ACC}`);
    assert.equal(capRes.status, 200);
    const captains: any[] = capRes.data.captains;
    assert.ok(captains.length >= 1, `Sector ${sectorId} must generate at least 1 captain`);
    assert.equal(captains[0].factionId, expectedFid, `Sector ${sectorId} primary captain must match ${expectedFid}`);
  }
  console.log('✓ Verified Procedural Frontier Captains for all 3 new factions');

  // 6. Verify 8 Main Classes × 8 Factions = 64 Playable Hulls (Full Matrix)
  const hullsRes = await api('GET', `/api/shipyard/hulls?accountId=${ACC}`);
  assert.equal(hullsRes.status, 200);
  assert.equal(hullsRes.data.count, 64, 'Must expose exact 64 hulls');
  assert.equal(hullsRes.data.mainClasses.length, 8, 'Must expose exact 8 Main Classes');
  assert.equal(hullsRes.data.factions.length, 8, 'Must expose exact 8 Factions');

  const expectedClasses = [
    'INTERCEPTOR',
    'CORVETTE',
    'FRIGATE',
    'HAULER',
    'INDUSTRIAL_EXTRACTOR',
    'DESTROYER',
    'CRUISER',
    'DREADNOUGHT',
  ];
  const expectedFactions = Object.keys(expectedDefaults);
  const seenKeys = new Set<string>();

  for (const mc of expectedClasses) {
    for (const fid of expectedFactions) {
      const matches = hullsRes.data.hulls.filter((h: any) => h.mainClass === mc && h.factionId === fid);
      assert.equal(matches.length, 1, `Matrix cell (${mc}, ${fid}) must have exact 1 hull`);
      const hull = matches[0];
      assert.ok(!seenKeys.has(hull.hullClass), `Duplicate hullClass ${hull.hullClass}`);
      seenKeys.add(hull.hullClass);
      assert.ok(hull.highSlots >= 1 && hull.midSlots >= 1 && hull.lowSlots >= 1, 'Valid slot layout');
      assert.ok(hull.powerGridMax > 0 && hull.cpuMax > 0, 'Valid PG/CPU engineering budgets');
    }
  }
  assert.equal(seenKeys.size, 64);

  // Verify backend query param filtering
  const filteredRes = await api(
    'GET',
    `/api/shipyard/hulls?accountId=${ACC}&mainClass=INDUSTRIAL_EXTRACTOR&factionId=FACTION_MINERS_GUILD`
  );
  assert.equal(filteredRes.status, 200);
  assert.equal(filteredRes.data.count, 1);
  assert.equal(filteredRes.data.hulls[0].hullClass, 'MINERS_EXTRACTOR');
  console.log('✓ Verified complete 8 × 8 = 64 Starship Matrix & API Filters');

  // 7. Commission & Promote new MINERS_EXTRACTOR Industrial Extractor (1H/3M/3L)
  await api('POST', '/api/player/debug-credits', { accountId: ACC, credits: 25000 });
  await api('POST', '/api/player/ap/debug-set', { accountId: ACC, amount: 600 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ALLOY', quantity: 100 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ORE', quantity: 100 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_FUEL', quantity: 100 });

  const commExt = await api('POST', '/api/shipyard/hulls/commission', {
    accountId: ACC,
    hullClass: 'MINERS_EXTRACTOR',
    customName: 'Deep-Core Bertha',
    promoteImmediately: false,
  });
  assert.equal(commExt.status, 200, `Commission MINERS_EXTRACTOR failed: ${JSON.stringify(commExt.data)}`);

  // Clear cargo and promote to Flagship
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ALLOY', quantity: 0 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ORE', quantity: 0 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_FUEL', quantity: 0 });

  const promRes = await api('POST', '/api/fleet/promote', {
    accountId: ACC,
    fleetShipId: commExt.data.ship.id,
  });
  assert.equal(promRes.status, 200);
  assert.equal(promRes.data.activeFlagship.hullClass, 'MINERS_EXTRACTOR');
  assert.equal(promRes.data.activeFlagship.mainHullClass, 'INDUSTRIAL_EXTRACTOR');
  assert.deepEqual(promRes.data.activeFlagship.slotLayout, { high: 1, mid: 3, low: 3, bay: 4 });
  assert.ok(promRes.data.activeFlagship.cargoCapacity > 280, 'Miners Extractor must carry high industrial tonnage');
  console.log('✓ Commissioned & Promoted MINERS_EXTRACTOR Flagship (1H/3M/3L)');

  // Restore baseline cleanly
  await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  console.log('\n🎉 ALL MILESTONE 1.3 CHECKS PASSED!');
}

run().catch((err) => {
  console.error('❌ MILESTONE 1.3 TEST FAILED:', err);
  process.exit(1);
});


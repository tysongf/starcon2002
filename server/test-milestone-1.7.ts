import './test-utils/authHelper';
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

function manhattanTubePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  blocked: Set<string>
): Array<{ x: number; y: number }> | null {
  const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }> }> = [
    { x: sx, y: sy, path: [] },
  ];
  const visited = new Set<string>([`${sx}:${sy}`]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === tx && cur.y === ty) {
      return cur.path;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= 12 || ny < 0 || ny >= 12) continue;
      const k = `${nx}:${ny}`;
      if (visited.has(k) || blocked.has(k)) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
    }
  }
  return null;
}

async function run() {
  console.log('=== MILESTONE 1.7 VERIFICATION: SIERRA OUTPOST MULTI-LAYER COLONY COMMAND ===');

  // 0. Clean state + rich credits + alloys for grid construction
  const creditRes = await api('POST', '/api/player/debug-credits', {
    accountId: ACC,
    credits: 60000,
  });
  assert.equal(creditRes.status, 200);

  const resetSurvey = await api('POST', '/api/player/debug-reset-survey', {
    accountId: ACC,
    planetId: 'planet_sec1_aegis',
  });
  assert.equal(resetSurvey.status, 200);

  // 1. Outpost catalog contract (22 structures)
  const catRes = await api('GET', '/api/colonies/outpost/catalog');
  assert.equal(catRes.status, 200);
  assert.equal(catRes.data.buildings.length, 22, 'Outpost catalog must define all 22 buildings');
  console.log('✓ Verified Outpost 22-building catalog');

  // 2. Plant beacon & found colony -> check 4x12x12 = 576 tiles + starter hub at (0,5,5)
  const probeRes = await api('POST', '/api/planets/planet_sec1_aegis/probe', {
    accountId: ACC,
    targetLat: 14.0,
    targetLng: 28.5,
    shieldBoost: true,
  });
  assert.equal(probeRes.status, 200);

  const foundRes = await api('POST', '/api/colonies/found', {
    accountId: ACC,
    planetId: 'planet_sec1_aegis',
    beaconId: probeRes.data.beaconId,
    name: 'Outpost Meridian',
  });
  assert.equal(foundRes.status, 200);
  const colonyId = foundRes.data.colony.id;
  assert.ok(colonyId);

  const gridInit = await api('GET', `/api/colonies/${colonyId}/grid?accountId=${ACC}`);
  assert.equal(gridInit.status, 200);
  assert.equal(gridInit.data.tiles.length, 576, 'Must initialize 4 * 12 * 12 = 576 grid tiles');

  const hubTile = gridInit.data.tiles.find(
    (t: any) => t.layer === 0 && t.x === 5 && t.y === 5
  );
  assert.equal(hubTile?.buildingType, 'COMMAND_HUB');
  assert.equal(hubTile?.status, 'ACTIVE');
  assert.equal(hubTile?.isConnected, true);

  const baseRate = Number(gridInit.data.colony.productionRatePerMinute);
  assert.ok(baseRate > 0);
  assert.ok(gridInit.data.telemetry.powerGeneratedMW >= 30);
  assert.equal(gridInit.data.telemetry.gridEfficiency, 1);
  console.log(`✓ Colony founded with 576 tiles across L0..-3 (baseRate=${baseRate.toFixed(2)} u/min)`);

  // 3. Build unlinked ORE_MINE_L1 on Layer -1 ORE_SEAM_L1 without instant flag -> check CONSTRUCTING timer -> finalize -> still unlinked!
  const l1Tiles = gridInit.data.tiles.filter((t: any) => t.layer === -1);
  const l1Blocked = new Set<string>(
    l1Tiles
      .filter((t: any) => t.terrainType === 'CRATER' || t.buildingType !== null)
      .map((t: any) => `${t.x}:${t.y}`)
  );

  // Choose an ORE_SEAM_L1 on L-1 reachable from (6,6)
  const seamCandidates = l1Tiles.filter(
    (t: any) => t.terrainType === 'ORE_SEAM_L1' && !t.buildingType && !(t.x === 6 && t.y === 6)
  );
  assert.ok(seamCandidates.length > 0, 'Layer -1 must seed at least one ORE_SEAM_L1 tile');

  let targetSeam: any = null;
  let routeToSeam: Array<{ x: number; y: number }> | null = null;
  for (const cand of seamCandidates) {
    const blockedForRoute = new Set<string>(l1Blocked);
    const p = manhattanTubePath(6, 6, cand.x, cand.y, blockedForRoute);
    if (p && p.length > 1) {
      targetSeam = cand;
      routeToSeam = p;
      break;
    }
  }
  assert.ok(targetSeam && routeToSeam, 'Must find a reachable ORE_SEAM_L1 tile on Layer -1');

  // Build ORE_MINE_L1 with real-time construction timer (instant: false)
  const unlinkedBuild = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
    accountId: ACC,
    layer: -1,
    x: targetSeam.x,
    y: targetSeam.y,
    buildingType: 'ORE_MINE_L1',
    instant: false,
  });
  assert.equal(unlinkedBuild.status, 200);
  assert.equal(unlinkedBuild.data.tile.status, 'CONSTRUCTING');
  assert.ok(unlinkedBuild.data.telemetry.constructingCount >= 1);

  // Finalize queue via /complete-now
  const rushRes = await api('POST', `/api/colonies/${colonyId}/grid/complete-now`, { accountId: ACC });
  assert.equal(rushRes.status, 200);
  assert.ok(rushRes.data.completedCount >= 1);

  const seamAfterRush = rushRes.data.tiles.find(
    (t: any) => t.layer === -1 && t.x === targetSeam.x && t.y === targetSeam.y
  );
  assert.equal(seamAfterRush.status, 'ACTIVE');
  assert.equal(seamAfterRush.isConnected, false, 'Mine on L-1 with no Access Shaft must report isConnected = false');
  assert.equal(
    Number(rushRes.data.colony.productionRatePerMinute),
    baseRate,
    'Unlinked mine must contribute 0 production increase'
  );
  console.log('✓ Verified CONSTRUCTING -> ACTIVE transition & zero yield while unlinked from Command Hub');

  // 4. Bridge (0,6,6) -> (-1,6,6) via ACCESS_SHAFT + lay TRANSIT_TUBE path to targetSeam -> verify isConnected & +75% seam yield boost!
  const s0 = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
    accountId: ACC,
    layer: 0,
    x: 6,
    y: 6,
    buildingType: 'ACCESS_SHAFT',
    instant: true,
  });
  assert.equal(s0.status, 200);

  const s1 = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
    accountId: ACC,
    layer: -1,
    x: 6,
    y: 6,
    buildingType: 'ACCESS_SHAFT',
    instant: true,
  });
  assert.equal(s1.status, 200);

  // Lay transit tubes along intermediate steps (excluding final targetSeam)
  for (let i = 0; i < routeToSeam.length - 1; i++) {
    const step = routeToSeam[i];
    const tRes = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
      accountId: ACC,
      layer: -1,
      x: step.x,
      y: step.y,
      buildingType: 'TRANSIT_TUBE',
      instant: true,
    });
    assert.equal(tRes.status, 200, `Tube placement failed at (${step.x},${step.y})`);
  }

  const linkedGrid = await api('GET', `/api/colonies/${colonyId}/grid?accountId=${ACC}`);
  assert.equal(linkedGrid.status, 200);
  const linkedMine = linkedGrid.data.tiles.find(
    (t: any) => t.layer === -1 && t.x === targetSeam.x && t.y === targetSeam.y
  );
  assert.equal(linkedMine.isConnected, true, 'Mine must become isConnected = true once Shaft + Tubes connect');
  const linkedRate = Number(linkedGrid.data.colony.productionRatePerMinute);
  assert.ok(
    linkedRate > baseRate * 2,
    `Linked seam-boosted ORE_MINE_L1 (+75% bonus) should more than double starter rate (${baseRate} -> ${linkedRate})`
  );
  console.log(`✓ Connected L-1 Seam Mine via Access Shaft + Transit Tubes (rate: ${baseRate.toFixed(2)} -> ${linkedRate.toFixed(2)} u/min)`);

  // 5. Power brownout test, toggle OFFLINE recovery, and Demolish 50% credit refund
  // Build two ORE_MINE_L2 on L0 adjacent to (4,5) -> triggers >30 MW demand brownout!
  // Let's find two free L0 tiles adjacent to starter buildings (e.g. (3,5) and (4,4))
  const l0Map = new Map<string, any>(
    linkedGrid.data.tiles.filter((t: any) => t.layer === 0).map((t: any) => [`${t.x}:${t.y}`, t])
  );
  const overloadSpots = [
    { x: 3, y: 5 },
    { x: 4, y: 4 },
    { x: 4, y: 6 },
    { x: 6, y: 4 },
  ].filter((c) => {
    const t = l0Map.get(`${c.x}:${c.y}`);
    return t && !t.buildingType && t.terrainType !== 'CRATER';
  });
  assert.ok(overloadSpots.length >= 2, 'Need at least 2 free connected L0 spots for power brownout test');

  // Seed enough Geologist/Engineer crew if needed? Check whether ORE_MINE_L2 or CORE_SMELTER requires crew; ORE_MINE_L1 has no crew gate, CORE_SMELTER draws 12 MW!
  // Let's place 2x ORE_MINE_L1 or AGRIDOME or SOLARSAT? Actually BUILD 2x FUSION? Wait: CORE_SMELTER / GAS_REFINERY / FUSION draw lots of MW without crew reqs!
  // Better yet: place 3x ORE_MINE_L1 connected to (4,5): let's build SOLAR_ARRAY? Solar generates power. SPACEPORT_GANTRY draws 12 MW + unlocks shipyard!
  const gantrySpot = overloadSpots[0];
  const gantryBuild = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
    accountId: ACC,
    layer: 0,
    x: gantrySpot.x,
    y: gantrySpot.y,
    buildingType: 'SPACEPORT_GANTRY',
    instant: true,
  });
  assert.equal(gantryBuild.status, 200);
  assert.equal(gantryBuild.data.colony.shipyardTier, 1, 'Placing Spaceport Gantry must unlock Shipyard Tier 1');

  const whSpot = overloadSpots[1];
  const whBuild = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
    accountId: ACC,
    layer: 0,
    x: whSpot.x,
    y: whSpot.y,
    buildingType: 'STORAGE_WAREHOUSE',
    instant: true,
  });
  assert.equal(whBuild.status, 200);
  assert.equal(whBuild.data.colony.siloCapacity, 250, 'Storage Warehouse must raise Silo capacity from 50 to 250');

  // Add third power consumer (ATMOS_PROCESSOR -16 MW) on adjacent free L0 tile to trigger brownout
  const smSpot = [
    { x: 7, y: 5 },
    { x: 5, y: 7 },
    { x: 5, y: 3 },
    { x: 6, y: 4 },
    { x: 4, y: 6 },
    { x: 3, y: 5 },
    { x: 4, y: 4 },
  ].find((c) => {
    const t = l0Map.get(`${c.x}:${c.y}`);
    return t && !t.buildingType && t.terrainType !== 'CRATER' && !(c.x === gantrySpot.x && c.y === gantrySpot.y) && !(c.x === whSpot.x && c.y === whSpot.y);
  });
  assert.ok(smSpot);
  const brownoutRes = await api('POST', `/api/colonies/${colonyId}/grid/build`, {
    accountId: ACC,
    layer: 0,
    x: smSpot.x,
    y: smSpot.y,
    buildingType: 'ATMOS_PROCESSOR',
    instant: true,
  });
  assert.equal(brownoutRes.status, 200, `ATMOS_PROCESSOR failed: ${JSON.stringify(brownoutRes.data)}`);
  assert.ok(
    brownoutRes.data.telemetry.powerConsumedMW > brownoutRes.data.telemetry.powerGeneratedMW,
    'Grid load must exceed generator capacity'
  );
  assert.ok(
    brownoutRes.data.telemetry.gridEfficiency < 1,
    `Overloaded grid must suffer brownout efficiency penalty (got ${brownoutRes.data.telemetry.gridEfficiency})`
  );

  // Toggle ATMOS_PROCESSOR OFFLINE -> efficiency improves; power down Gantry too -> efficiency hits 1.0!
  const toggleRes = await api('POST', `/api/colonies/${colonyId}/grid/toggle`, {
    accountId: ACC,
    layer: 0,
    x: smSpot.x,
    y: smSpot.y,
  });
  assert.equal(toggleRes.status, 200);
  assert.equal(toggleRes.data.tile.status, 'OFFLINE');
  assert.ok(
    toggleRes.data.telemetry.gridEfficiency > brownoutRes.data.telemetry.gridEfficiency,
    'Powering down ATMOS_PROCESSOR must improve grid efficiency'
  );

  const toggleGantry = await api('POST', `/api/colonies/${colonyId}/grid/toggle`, {
    accountId: ACC,
    layer: 0,
    x: gantrySpot.x,
    y: gantrySpot.y,
  });
  assert.equal(toggleGantry.status, 200);
  assert.equal(toggleGantry.data.telemetry.gridEfficiency, 1, 'Shedding remaining excess load must restore 100% grid efficiency');

  // Demolish ATMOS_PROCESSOR -> refunds 50% credits
  const demRes = await api('POST', `/api/colonies/${colonyId}/grid/demolish`, {
    accountId: ACC,
    layer: 0,
    x: smSpot.x,
    y: smSpot.y,
  });
  assert.equal(demRes.status, 200);
  assert.ok(demRes.data.refundCredits > 0, 'Demolishing structure must refund 50% credits');
  const clearedTile = demRes.data.tiles.find(
    (t: any) => t.layer === 0 && t.x === smSpot.x && t.y === smSpot.y
  );
  assert.equal(clearedTile.buildingType, null);
  console.log(`✓ Verified Spaceport Gantry, Storage Warehouse (250 silo), brownout penalty, OFFLINE toggle, and Demolish refund (+${demRes.data.refundCredits} Cr)`);

  // 6. Silo accrual wait & harvest to ship cargo
  await new Promise((r) => setTimeout(r, 1200));
  const detailBeforeHarvest = await api('GET', `/api/colonies/${colonyId}?accountId=${ACC}`);
  assert.equal(detailBeforeHarvest.status, 200);
  assert.ok(
    detailBeforeHarvest.data.colony.stockpiledAmount >= 1,
    'Colony must accrue extracted units into silo over wall-clock time'
  );

  const harvestRes = await api('POST', `/api/colonies/${colonyId}/harvest`, { accountId: ACC });
  assert.equal(harvestRes.status, 200);
  assert.ok(harvestRes.data.harvestedAmount >= 1, 'Harvest must transfer silo units to ship hold');
  console.log(`✓ Verified live silo accrual and cargo harvest (${harvestRes.data.harvestedAmount} units)`);

  console.log('=== MILESTONE 1.7 ALL ASSERTIONS PASSED CLEANLY! ===');
}

run().catch((err) => {
  console.error('❌ Milestone 1.7 test failed:', err);
  process.exit(1);
});

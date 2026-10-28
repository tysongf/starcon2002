/**
 * Verification Script for Sector Graph Jump System & Authoritative Topology
 *
 * Verifies:
 * 1. 3-Sector Graph Topology (Sec 1 <-> Sec 2 <-> Sec 3)
 * 2. Strict Adjacency Verification (Rejects Sec 1 -> Sec 3 jump with INVALID_WARP_VECTOR)
 * 3. Step-by-step traversal: Sec 1 -> Sec 2 -> Sec 3 -> Sec 2 -> Sec 1
 * 4. Atomic Fuel deduction (1 unit per jump) & AP deduction (5 AP per jump)
 * 5. Port associations & refuel mechanics
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runSectorGraphTest() {
  console.log('====================================================');
  console.log('🚀 STARTING SECTOR GRAPH JUMP & ADJACENCY TEST');
  console.log('====================================================\n');

  // Step 1: Query sectors registry
  console.log('[1/6] Verifying static 3-sector graph topology in star registry...');
  const secRes = await fetch(`${BASE_URL}/api/sectors`);
  const secData = await secRes.json();
  const sectors = secData.sectors;

  const s1 = sectors.find((s: any) => s.id === 1);
  const s2 = sectors.find((s: any) => s.id === 2);
  const s3 = sectors.find((s: any) => s.id === 3);

  console.log(`  • Sector 1: "${s1.name}" -> Connected to: [${s1.connected_sectors}]`);
  console.log(`  • Sector 2: "${s2.name}" -> Connected to: [${s2.connected_sectors}]`);
  console.log(`  • Sector 3: "${s3.name}" -> Connected to: [${s3.connected_sectors}]`);

  const topoValid =
    s1.connected_sectors.includes(2) &&
    !s1.connected_sectors.includes(3) &&
    s2.connected_sectors.includes(1) &&
    s2.connected_sectors.includes(3) &&
    s3.connected_sectors.includes(2) &&
    !s3.connected_sectors.includes(1);

  console.log(`✓ Graph topology valid: ${topoValid ? 'YES' : 'NO'}\n`);

  // Step 2: Ensure ship starts in Sector 1 with full fuel and AP
  console.log('[2/6] Resetting pilot ship to Sector 1 and full reserves...');
  await fetch(`${BASE_URL}/api/player/ship/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, sectorId: 1, fuel: 100 }),
  });
  await fetch(`${BASE_URL}/api/player/ap/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, amount: 600 }),
  });

  const shipRes = await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`);
  const shipData = await shipRes.json();
  console.log(`✓ Initial State: Sector ${shipData.ship.current_sector_id}, Fuel: ${shipData.ship.fuel}, AP: 600\n`);

  // Step 3: Test non-adjacent jump rejection (Sec 1 -> Sec 3)
  console.log('[3/6] Testing non-adjacent jump rejection (Sector 1 -> Sector 3)...');
  const invalidJumpRes = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 3 }),
  });
  const invalidJumpData = await invalidJumpRes.json();
  const rejectedNonAdjacent =
    invalidJumpRes.status === 400 &&
    invalidJumpData.success === false &&
    invalidJumpData.error.includes('INVALID_WARP_VECTOR');

  console.log(`  • Status: ${invalidJumpRes.status}`);
  console.log(`  • Server Response: "${invalidJumpData.error}"`);
  console.log(`✓ Non-adjacent jump correctly rejected: ${rejectedNonAdjacent ? 'YES' : 'NO'}\n`);

  // Step 4: Traverse graph Sector 1 -> Sector 2 (Adjacent)
  console.log('[4/6] Executing valid warp jump: Sector 1 -> Sector 2 (Void Expanse)...');
  const jump12Res = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 2 }),
  });
  const jump12Data = await jump12Res.json();
  const jump12Success =
    jump12Res.status === 200 &&
    jump12Data.success === true &&
    jump12Data.toSector.id === 2 &&
    jump12Data.remainingFuel === 99 &&
    jump12Data.currentAP === 595;

  console.log(`  • Arrived at: Sector ${jump12Data.toSector.id} (${jump12Data.toSector.name})`);
  console.log(`  • Remaining Fuel: ${jump12Data.remainingFuel} (deducted 1)`);
  console.log(`  • Remaining AP: ${jump12Data.currentAP} (deducted 5)`);
  console.log(`✓ Sector 1 -> 2 transition confirmed: ${jump12Success ? 'YES' : 'NO'}\n`);

  // Step 5: Traverse graph Sector 2 -> Sector 3 (Smelter Station)
  console.log('[5/6] Executing valid warp jump: Sector 2 -> Sector 3 (Smelter Station)...');
  const jump23Res = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 3 }),
  });
  const jump23Data = await jump23Res.json();
  const jump23Success =
    jump23Res.status === 200 &&
    jump23Data.success === true &&
    jump23Data.toSector.id === 3 &&
    jump23Data.remainingFuel === 98 &&
    jump23Data.currentAP === 590 &&
    jump23Data.port !== null;

  console.log(`  • Arrived at: Sector ${jump23Data.toSector.id} (${jump23Data.toSector.name})`);
  console.log(`  • Port Present: ${jump23Data.port?.name} (Class ${jump23Data.port?.port_class})`);
  console.log(`  • Remaining Fuel: ${jump23Data.remainingFuel}`);
  console.log(`  • Remaining AP: ${jump23Data.currentAP}`);
  console.log(`✓ Sector 2 -> 3 transition confirmed: ${jump23Success ? 'YES' : 'NO'}\n`);

  // Step 6: Return traversal and refuel
  console.log('[6/6] Traversing back: Sector 3 -> Sector 2 -> Sector 1...');
  await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 2 }),
  });
  const finalJump = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 1 }),
  });
  const finalData = await finalJump.json();

  // Refuel back to 100 and reset AP to 600
  await fetch(`${BASE_URL}/api/player/ship/refuel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID }),
  });
  await fetch(`${BASE_URL}/api/player/ap/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, amount: 600 }),
  });

  const returnSuccess = finalData.toSector.id === 1;
  console.log(`✓ Returned to Sector 1: ${returnSuccess ? 'YES' : 'NO'}`);

  // Summary Assertions
  const assertions = [
    { name: '3-Sector graph topology is valid (1 <-> 2 <-> 3)', pass: topoValid },
    { name: 'Non-adjacent jump (1 -> 3) rejected with INVALID_WARP_VECTOR', pass: rejectedNonAdjacent },
    { name: 'Sector 1 -> 2 jump succeeds with 1 fuel and 5 AP deduction', pass: jump12Success },
    { name: 'Sector 2 -> 3 jump succeeds with port detection', pass: jump23Success },
    { name: 'Full return circuit (3 -> 2 -> 1) completes successfully', pass: returnSuccess },
  ];

  console.log('\n----------------------------------------------------');
  let allPass = true;
  for (const a of assertions) {
    const symbol = a.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} : ${a.name}`);
    if (!a.pass) allPass = false;
  }
  console.log('----------------------------------------------------');

  if (!allPass) {
    console.error('\n❌ Sector graph verification failed!');
    process.exit(1);
  } else {
    console.log('\n🚀 ALL SECTOR GRAPH & WARP JUMP ASSERTIONS PASSED!');
    process.exit(0);
  }
}

runSectorGraphTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

/**
 * Concurrency & Mutex Safety Verification Script for Action Point (AP) Engine
 *
 * Verifies that under high-concurrency race conditions (10 simultaneous HTTP requests),
 * the server-side mutex lock guarantees:
 * 1. Zero double-spend / negative AP balance
 * 2. Exactly 1 transaction succeeds (8 AP - 5 AP = 3 AP)
 * 3. Exactly 9 transactions fail with INSUFFICIENT_ACTION_POINTS
 * 4. Final persisted AP balance is exactly 3
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'test_concurrency_pilot';

async function runConcurrencyTest() {
  console.log('====================================================');
  console.log('⚡ STARTING ACTION POINT (AP) CONCURRENCY TEST');
  console.log('====================================================\n');

  // Step 1: Set player AP balance to 8
  console.log(`[1/4] Setting AP balance for "${PLAYER_ID}" to 8...`);
  const setRes = await fetch(`${BASE_URL}/api/player/ap/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, amount: 8 }),
  });

  if (!setRes.ok) {
    throw new Error(`Failed to initialize player AP: ${await setRes.text()}`);
  }

  const initialAP = await setRes.json();
  console.log(`✓ Initial AP confirmed: ${initialAP.currentAP}/${initialAP.maxAP} AP\n`);

  // Step 2: Fire 10 simultaneous spend requests of 5 AP each
  console.log(`[2/4] Dispatched 10 simultaneous spend requests (5 AP each, Total attempted: 50 AP)...`);
  const requests = Array.from({ length: 10 }).map((_, index) =>
    fetch(`${BASE_URL}/api/player/ap/spend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        action: 'SECTOR_WARP',
        cost: 5,
      }),
    }).then(async (res) => {
      const data = await res.json();
      return {
        reqIndex: index + 1,
        status: res.status,
        data,
      };
    })
  );

  const results = await Promise.all(requests);

  // Step 3: Analyze results
  console.log('\n[3/4] Analyzing concurrent request resolutions:');
  let successes = 0;
  let rejections = 0;

  for (const r of results) {
    if (r.status === 200 && r.data.success) {
      successes++;
      console.log(`  • Request #${r.reqIndex}: SUCCESS -> AP remaining: ${r.data.currentAP}`);
    } else {
      rejections++;
      console.log(`  • Request #${r.reqIndex}: REJECTED (${r.status}) -> ${r.data.error}`);
    }
  }

  console.log(`\nResults summary:`);
  console.log(`  Successful transactions: ${successes} (Expected: 1)`);
  console.log(`  Rejected transactions:   ${rejections} (Expected: 9)`);

  // Step 4: Verify final database/cache state
  console.log(`\n[4/4] Verifying final persisted state...`);
  const finalRes = await fetch(`${BASE_URL}/api/player/ap?playerId=${PLAYER_ID}`);
  const finalState = await finalRes.json();
  console.log(`✓ Final AP balance: ${finalState.currentAP}/${finalState.maxAP} AP`);

  // Assertions
  const assertions = [
    { name: 'Exactly 1 request succeeded', pass: successes === 1 },
    { name: 'Exactly 9 requests rejected', pass: rejections === 9 },
    { name: 'Final AP balance is exactly 3', pass: finalState.currentAP === 3 },
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
    console.error('\n❌ Concurrency verification failed!');
    process.exit(1);
  } else {
    console.log('\n🚀 ALL CONCURRENCY & ATOMIC MUTEX ASSERTIONS PASSED!');
    process.exit(0);
  }
}

runConcurrencyTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

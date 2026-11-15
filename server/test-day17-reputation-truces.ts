import './test-utils/authHelper';
/**
 * Automated Test Suite for Day 17: Faction Reputation Matrix, Diplomatic Bribes, Truces & Station Tariffs
 * Run: npm exec tsx server/test-day17-reputation-truces.ts
 */

const BASE_URL = 'http://localhost:3000';
let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    totalFailed++;
  }
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('🛸 DAY 17 VERIFICATION: FACTION REPUTATION MATRIX, DIPLOMATIC TRUCES & TARIFFS');
  console.log('========================================================================\n');

  // Test 1: Fetch Faction Standings & Metadata
  console.log('--- TEST 1: Retrieve Faction Standings Matrix ---');
  const res1 = await fetch(`${BASE_URL}/api/reputation/standings?accountId=acc_sol_captain`);
  assert(res1.status === 200, 'GET /api/reputation/standings returns 200 OK');
  const data1 = await res1.json();
  assert(data1.success === true, 'Response contains success: true');
  assert(Array.isArray(data1.standings) && data1.standings.length >= 4, 'Returns at least 4 faction standings');
  
  const sol = data1.standings.find((s: any) => s.factionId === 'FACTION_SOL');
  const heg = data1.standings.find((s: any) => s.factionId === 'FACTION_HEGEMONY');
  const phorid = data1.standings.find((s: any) => s.factionId === 'FACTION_PHORID');
  const kryll = data1.standings.find((s: any) => s.factionId === 'FACTION_KRYLL');

  assert(!!sol && sol.crestIcon === '🚀', 'Sol Alliance initialized with crest 🚀');
  assert(!!heg && heg.crestIcon === '🦅', 'Vaelic Hegemony initialized with crest 🦅');
  assert(!!phorid && phorid.crestIcon === '🍄', 'Phorid Sporeborn initialized with crest 🍄');
  assert(!!kryll && kryll.crestIcon === '🐀', 'Kryll Free Cartel initialized with crest 🐀');

  // Test 2: Debug Set Standing & Cascading Reputation Shifts
  console.log('\n--- TEST 2: Cascading Cross-Faction Standing Offsets ---');
  // Reset clean baseline: Sol 35, Hegemony -25, Phorid 15, Kryll 5
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_SOL', standing: 35 }),
  });
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_HEGEMONY', standing: -25 }),
  });
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_PHORID', standing: 15 }),
  });

  // Now destroy Hegemony Drone -> Hegemony -15 shift
  const modRes = await fetch(`${BASE_URL}/api/reputation/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      factionId: 'FACTION_HEGEMONY',
      amount: -15,
      reason: 'Destroyed Hegemony Interdictor Omega',
    }),
  });
  assert(modRes.status === 200, 'POST /api/reputation/modify returns 200 OK');
  const modData = await modRes.json();
  assert(modData.success === true, 'Reputation modification successful');

  const postHeg = modData.updatedStandings.find((s: any) => s.factionId === 'FACTION_HEGEMONY');
  const postSol = modData.updatedStandings.find((s: any) => s.factionId === 'FACTION_SOL');
  const postPhorid = modData.updatedStandings.find((s: any) => s.factionId === 'FACTION_PHORID');

  assert(postHeg.standing === -40, `Hegemony standing dropped from -25 to -40 (actual: ${postHeg.standing})`);
  assert(postSol.standing === 46, `Sol Alliance cascading gain +11 from 35 to 46 (actual: ${postSol.standing})`);
  assert(postPhorid.standing === 21, `Phorid Sporeborn cascading gain +6 from 15 to 21 (actual: ${postPhorid.standing})`);


  // Test 3: Market Multiplier & Surcharges
  console.log('\n--- TEST 3: Port Dynamic Market Multipliers & Transparent Badges ---');
  const portRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market?playerId=acc_sol_captain`);
  assert(portRes.status === 200, 'GET /api/ports/PORT_AEGIS_01/market returns 200 OK');
  const portData = await portRes.json();

  assert(Array.isArray(portData.items) && portData.items.length > 0, 'Port has marketable items');
  const item = portData.items[0];
  assert(typeof item.rep_multiplier === 'number', 'Item has rep_multiplier field');
  assert(typeof item.base_buy_price === 'number', 'Item has transparent base_buy_price');
  assert(typeof item.buy_price === 'number', 'Item has effective buy_price');
  assert(item.buy_price < item.base_buy_price, 'Effective buy price reflects friendly Sol Alliance discount');
  assert(item.rep_modifier_label.includes('DISCOUNT'), `Item displays discount label: ${item.rep_modifier_label}`);

  // Test 4: Nemesis Station Docking Lockdown
  console.log('\n--- TEST 4: Nemesis Station Lockdown & Shield Denial ---');
  // Set Hegemony to NEMESIS (-80)
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_HEGEMONY', standing: -80 }),
  });

  const dockCheckRes = await fetch(`${BASE_URL}/api/reputation/check-docking?accountId=acc_sol_captain&factionId=FACTION_HEGEMONY`);
  assert(dockCheckRes.status === 200, 'GET /api/reputation/check-docking returns 200 OK');
  const dockCheck = await dockCheckRes.json();
  assert(dockCheck.permitted === false, 'Docking denied at Nemesis tier');
  assert(dockCheck.tier === 'NEMESIS', 'Accurately recognized as NEMESIS tier');
  assert(dockCheck.reason.includes('STATION LOCKDOWN'), `Lockdown reason returned: ${dockCheck.reason}`);

  // Test 5: In-Flight Ceasefire Truce via Tribute Bribe
  console.log('\n--- TEST 5: Sub-Space Ceasefire Truce & Tribute Remittance ---');
  // Ensure test account has credits
  await fetch(`${BASE_URL}/api/player/debug-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', credits: 2500 }),
  });

  const truceRes = await fetch(`${BASE_URL}/api/reputation/truce`, {

    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: 'acc_sol_captain',
      sectorId: 2,
      factionId: 'FACTION_HEGEMONY',
      tributeType: 'CREDITS',
    }),
  });

  assert(truceRes.status === 200, 'POST /api/reputation/truce returns 200 OK');
  const truceData = await truceRes.json();
  assert(truceData.success === true, 'Ceasefire truce successfully brokered');
  assert(typeof truceData.truceId === 'string', `Received active truce token: ${truceData.truceId}`);
  assert(typeof truceData.expiresAt === 'string', `Received 5-minute expiration timestamp: ${truceData.expiresAt}`);
  assert(truceData.message.includes('disarmed in Sector 2 for 5 minutes'), 'Ceasefire confirmation message broadcast');

  // Verify standing gain from paying tribute
  const postTruceRes = await fetch(`${BASE_URL}/api/reputation/standings?accountId=acc_sol_captain`);
  const postTruceData = await postTruceRes.json();
  const truceHeg = postTruceData.standings.find((s: any) => s.factionId === 'FACTION_HEGEMONY');
  assert(truceHeg.standing === -70, `Hegemony standing repaired by +10 goodwill from -80 to -70 (actual: ${truceHeg.standing})`);

  // Reset player standings to standard healthy values
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_SOL', standing: 35 }),
  });
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_HEGEMONY', standing: -25 }),
  });
  await fetch(`${BASE_URL}/api/reputation/debug-set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', factionId: 'FACTION_PHORID', standing: 15 }),
  });

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed (${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%)`);
  console.log('========================================================================\n');

  if (totalFailed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});

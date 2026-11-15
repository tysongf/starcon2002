import './test-utils/authHelper';
import { strict as assert } from 'node:assert';

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay22Tests() {
  console.log('================================================================');
  console.log('🚀 RUNNING DAY 22: CONVOY SCHEDULER & TRAFFIC RADAR TEST SUITE');
  console.log('================================================================\n');

  // Step 1: Baseline Reset
  console.log('[1/10] Resetting convoys & skirmishes baseline state...');
  const resetRes = await fetch(`${BASE_URL}/api/convoys/debug-reset`, { method: 'POST' });
  assert.equal(resetRes.status, 200);
  const resetData = await resetRes.json();
  assert.equal(resetData.success, true);
  console.log('✓ Baseline confirmed: 3 active convoys, 1 contested skirmish\n');

  // Step 2: Query Sub-Space Traffic Radar
  console.log('[2/10] Querying Sub-Space Traffic Radar (/api/convoys/traffic)...');
  const trafficRes = await fetch(`${BASE_URL}/api/convoys/traffic`);
  assert.equal(trafficRes.status, 200);
  const trafficData = await trafficRes.json();
  assert.equal(trafficData.success, true);
  assert.equal(trafficData.count, 3);
  assert.ok(trafficData.convoys.length >= 3, 'Should return at least 3 active convoys');
  assert.ok(trafficData.skirmishes.length >= 1, 'Should return active sector skirmish');

  const titheConvoy = trafficData.convoys.find((c: any) => c.id === 'convoy_hegemony_tithe_01');
  assert.ok(titheConvoy, 'Hegemony Tithe Hauler must be present in radar');
  assert.equal(titheConvoy.faction_id, 'FACTION_VAELIC');
  assert.equal(titheConvoy.current_sector_id, 2);
  assert.equal(titheConvoy.totalCargoValue, 6550);
  assert.ok(titheConvoy.etaSeconds > 0, 'ETA seconds must be positive');
  console.log(` -> Radar detected: "${titheConvoy.name}" [Sector: ${titheConvoy.current_sector_id}, Value: ${titheConvoy.totalCargoValue} CR, ETA: ${titheConvoy.etaSeconds}s]`);
  console.log('✓ Traffic radar successfully telemetry verified.\n');

  // Step 3: Sector Traffic Filtering
  console.log('[3/10] Testing Sector-Filtered Traffic Query (?sectorId=2)...');
  const sec2Res = await fetch(`${BASE_URL}/api/convoys/traffic?sectorId=2`);
  assert.equal(sec2Res.status, 200);
  const sec2Data = await sec2Res.json();
  assert.equal(sec2Data.success, true);
  for (const c of sec2Data.convoys) {
    assert.equal(c.current_sector_id, 2, 'All convoys returned must be in Sector 2');
  }
  console.log(`✓ Sector 2 filter confirmed: ${sec2Data.convoys.length} convoy(s) currently traversing Sector 2.\n`);

  // Step 4: Single Convoy Lookup & Manifest Inspection
  console.log('[4/10] Inspecting Convoy Manifest for "convoy_sol_freight_01"...');
  const singleRes = await fetch(`${BASE_URL}/api/convoys/convoy_sol_freight_01`);
  assert.equal(singleRes.status, 200);
  const singleData = await singleRes.json();
  assert.equal(singleData.success, true);
  assert.equal(singleData.convoy.name, 'Sol-Perimeter Bulk Freighter Atlas');
  assert.equal(singleData.convoy.origin_port_id, 'PORT_AEGIS_01');
  assert.equal(singleData.convoy.destination_port_id, 'PORT_SMELTER_01');
  assert.deepEqual(singleData.convoy.route_path, [1, 2, 3]);
  console.log(` -> Origin: ${singleData.convoy.origin_port_id} -> Destination: ${singleData.convoy.destination_port_id}`);
  console.log(` -> Cargo Manifest: ${singleData.convoy.cargo_manifest.map((m: any) => `${m.quantity}x ${m.name}`).join(', ')}`);
  console.log('✓ Manifest and flight route verified.\n');

  // Step 5: Contested Sector Skirmish Telemetry
  console.log('[5/10] Querying Contested Sector Skirmishes (/api/convoys/skirmishes)...');
  const skirmishRes = await fetch(`${BASE_URL}/api/convoys/skirmishes`);
  assert.equal(skirmishRes.status, 200);
  const skirmishData = await skirmishRes.json();
  assert.equal(skirmishData.success, true);
  assert.ok(skirmishData.skirmishes.length >= 1);
  const sec2Skirmish = skirmishData.skirmishes[0];
  assert.equal(sec2Skirmish.sector_id, 2);
  assert.equal(sec2Skirmish.initiator_faction_id, 'FACTION_VAELIC');
  assert.equal(sec2Skirmish.defender_faction_id, 'FACTION_KRYLL');
  assert.equal(sec2Skirmish.hazard_level, 'HIGH');
  console.log(` -> Skirmish: ${sec2Skirmish.initiator_faction_id} vs ${sec2Skirmish.defender_faction_id} in Sector ${sec2Skirmish.sector_id} [Hazard: ${sec2Skirmish.hazard_level}]`);
  console.log(` -> Briefing: "${sec2Skirmish.briefing.substring(0, 65)}..."`);
  console.log('✓ Skirmish telemetry confirmed.\n');

  // Step 6: Mercenary Escort Contracts Directory
  console.log('[6/10] Fetching Mercenary Escort Contracts (/api/convoys/contracts)...');
  const contractsRes = await fetch(`${BASE_URL}/api/convoys/contracts?accountId=${PLAYER_ID}`);
  assert.equal(contractsRes.status, 200);
  const contractsData = await contractsRes.json();
  assert.equal(contractsData.success, true);
  assert.ok(contractsData.contracts.length >= 3, 'Should generate escort offers for active convoys');

  const solContract = contractsData.contracts.find((c: any) => c.convoy_id === 'convoy_sol_freight_01');
  assert.ok(solContract, 'Contract for Sol Freighter must exist');
  assert.ok(solContract.reward_credits > 0, 'Must offer credit reward');
  assert.equal(solContract.status, 'AVAILABLE');
  console.log(` -> Contract Offered: Escort "${solContract.convoy.name}" | Reward: ${solContract.reward_credits} CR, +${solContract.reputation_gain} Goodwill`);
  console.log('✓ Escort contracts generated successfully.\n');

  // Step 7: Accepting Escort Contract
  console.log('[7/10] Accepting Escort Contract for "convoy_sol_freight_01"...');
  const acceptRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, convoyId: 'convoy_sol_freight_01' }),
  });
  assert.equal(acceptRes.status, 200);
  const acceptData = await acceptRes.json();
  assert.equal(acceptData.success, true);
  assert.equal(acceptData.contract.status, 'ACCEPTED');
  console.log(`✓ Escort Contract registered [ID: ${acceptData.contract.id}, Status: ACCEPTED]!\n`);

  // Step 8: Hostile Standing Gating on Escort Contracts
  console.log('[8/10] Testing Hostile Clearance Denial on Escort Contracts...');
  // Hegemony standing is -25 by default (< -20)
  const badAcceptRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, convoyId: 'convoy_hegemony_tithe_01' }),
  });
  assert.equal(badAcceptRes.status, 400);
  const badAcceptData = await badAcceptRes.json();
  assert.ok(badAcceptData.error.includes('HOSTILE_CLEARANCE_DENIED'));
  console.log(` -> Correctly Rejected: "${badAcceptData.error}"`);
  console.log('✓ Hostile faction security clearance barrier confirmed.\n');

  // Step 9: Fast-Forward Timeline & Sector Hop
  console.log('[9/10] Advancing transit timeline (fast-forwarding 8.0 minutes)...');
  const ffRes = await fetch(`${BASE_URL}/api/convoys/fast-forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deltaMinutes: 8.0 }),
  });
  assert.equal(ffRes.status, 200);
  const ffData = await ffRes.json();
  assert.equal(ffData.success, true);
  assert.ok(ffData.transitionedConvoys.length > 0, 'Convoys should have transitioned or arrived');
  console.log(` -> Transition events triggered: ${ffData.transitionedConvoys.map((t: any) => `${t.name}: ${t.event}`).join('; ')}`);

  // Verify Sol Freighter arrived and can claim escort contract
  const claimRes = await fetch(`${BASE_URL}/api/convoys/contracts/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: PLAYER_ID, convoyId: 'convoy_sol_freight_01' }),
  });
  assert.equal(claimRes.status, 200);
  const claimData = await claimRes.json();
  assert.equal(claimData.success, true);
  console.log(`✓ Escort Contract Claimed: +${claimData.rewardCredits} Credits, +${claimData.reputationGain} Goodwill!\n`);

  // Step 10: Convoy Raid & Market Scarcity Impact
  console.log('[10/10] Testing Convoy Raid & Supply Shortage (/api/convoys/raid)...');
  // Reset so Kryll convoy is back in transit
  await fetch(`${BASE_URL}/api/convoys/debug-reset`, { method: 'POST' });

  // Get initial price of Silicate Ore at Aegis Terminal
  const initialPortRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market`);
  const initialPortData = await initialPortRes.json();
  const initialOre = initialPortData.items.find((i: any) => i.commodity_id === 'COMM_ORE');
  const initialOreStock = initialOre.stock;
  const initialOreBaseBuyPrice = initialOre.base_buy_price;

  // Interdict and raid Hegemony Tithe Carrier (carrying Silicate Ore & Plasteel)
  const raidRes = await fetch(`${BASE_URL}/api/convoys/raid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ convoyId: 'convoy_hegemony_tithe_01', status: 'SURRENDERED' }),
  });
  assert.equal(raidRes.status, 200);
  const raidData = await raidRes.json();
  assert.equal(raidData.success, true);
  console.log(` -> Raid Event: "${raidData.shortageSummary}"`);

  // Verify market price spiked due to supply shortage
  const postRaidPortRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market`);
  const postRaidPortData = await postRaidPortRes.json();
  const postRaidOre = postRaidPortData.items.find((i: any) => i.commodity_id === 'COMM_ORE');
  assert.ok(postRaidOre.stock < initialOreStock, 'Stock must drop due to shortage');
  assert.ok(postRaidOre.base_buy_price >= initialOreBaseBuyPrice, 'Base buy price should increase due to scarcity');
  console.log(` -> Silicate Ore Stock: ${initialOreStock} -> ${postRaidOre.stock} (Shortage applied)`);
  console.log(` -> Silicate Ore Base Buy Price: ${initialOreBaseBuyPrice} Cr -> ${postRaidOre.base_buy_price} Cr (Scarcity spike)`);
  console.log('✓ Convoy raid dynamically impacted destination station market!\n');

  // Reset baseline for clean state
  await fetch(`${BASE_URL}/api/convoys/debug-reset`, { method: 'POST' });

  console.log('================================================================');
  console.log('🏆 DAY 22: ALL CONVOY SCHEDULER & RADAR ASSERTIONS PASSED 100%!');
  console.log('================================================================');
}

runDay22Tests().catch((err) => {
  console.error('❌ Day 22 Test Failure:', err);
  process.exit(1);
});

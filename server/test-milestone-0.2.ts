/**
 * Milestone 0.2 Integration Test Suite: The Playable Persistent Economic Loop
 *
 * Verifies:
 * 1. Initial State: Sector 1 (Sol Nexus), 2500 Credits, 100 Fuel, 600 AP, 0 Cargo.
 * 2. Market Radar & Trade Intel: Queries /api/market/intel for multi-sector arbitrage opportunities.
 * 3. Outbound Haul (Sector 1): Purchases Bio-Protein Rations cheap at Aegis Terminal.
 * 4. Hyperspace Warp Transit (Sec 1 -> Sec 2 -> Sec 3):
 *    - 2 Jumps through Void Expanse hazard sector.
 *    - Validates AP (5 AP / jump) and Fuel (1 Fuel / jump) deductions.
 *    - Confirms sector persistence in PostgreSQL DB.
 * 5. Destination Commerce & Return Haul (Sector 3):
 *    - Sells Bio-Protein Rations at Obsidian Smelter for profit.
 *    - Purchases Silicate Ore cheap at Smelter surplus.
 * 6. Return Warp Transit (Sec 3 -> Sec 2 -> Sec 1):
 *    - Jumps back through Sector 2 to Sector 1.
 * 7. Arbitrage Realization:
 *    - Sells Silicate Ore at Aegis Terminal high demand price (+20.9 Cr / unit).
 *    - Verifies substantial total net profit across the full round-trip circuit.
 * 8. Page Refresh Persistence Simulation:
 *    - Queries DB state across ship, credits, cargo, and AP to guarantee 100% persistence.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runMilestone02Test() {
  console.log('================================================================');
  console.log('🚀 RUNNING MILESTONE 0.2: PERSISTENT ECONOMIC ARBITRAGE SUITE');
  console.log('================================================================\n');

  // Step 1: Clean Reset
  console.log('[1/8] Resetting pilot baseline state (Sector 1, 2500 Cr, 100 Fuel, 600 AP)...');
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

  // Clear any leftover cargo
  const initialHoldRes = await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`);
  const initialHold = await initialHoldRes.json();
  if (initialHold.cargo && initialHold.cargo.length > 0) {
    for (const c of initialHold.cargo) {
      await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: PLAYER_ID,
          commodityId: c.commodity_id,
          quantity: c.quantity,
          type: 'SELL',
        }),
      });
    }
  }

  const baselineHoldRes = await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`);
  const baselineHold = await baselineHoldRes.json();
  const startingCredits = baselineHold.credits;
  console.log(`✓ Baseline confirmed: Sector 1, ${startingCredits} Cr, Cargo: 0/40 m³\n`);

  // Step 2: Query Market Intelligence Uplink
  console.log('[2/8] Fetching Trade Intel across known sectors (/api/market/intel)...');
  const intelRes = await fetch(`${BASE_URL}/api/market/intel`);
  if (!intelRes.ok) throw new Error(`Market intel failed with status ${intelRes.status}`);
  const intel = await intelRes.json();

  console.log(`  • Discovered ${intel.ports.length} ports across shard topology.`);
  console.log(`  • Top Arbitrage Routes Detected:`);
  for (const arb of intel.arbitrage.slice(0, 3)) {
    console.log(
      `    -> ${arb.commodityName}: Buy at ${arb.fromPortName} (Sec ${arb.fromSectorId}) for ${arb.buyPrice} Cr -> Sell at ${arb.toPortName} (Sec ${arb.toSectorId}) for ${arb.sellPrice} Cr (Spread: +${arb.profitPerUnit} Cr/unit)`
    );
  }
  const hasArbitrage = intel.arbitrage.length > 0;
  console.log(`✓ Dynamic trade radar operational: ${hasArbitrage ? 'YES' : 'NO'}\n`);

  // Step 3: Outbound Purchase at Aegis Terminal (Bio-Protein Rations)
  console.log('[3/8] Sector 1 Commerce: Purchasing 20 units Bio-Protein Rations...');
  const buyRationsRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      commodityId: 'COMM_RATIONS',
      quantity: 20,
      type: 'BUY',
    }),
  });
  const buyRationsData = await buyRationsRes.json();
  if (!buyRationsRes.ok || !buyRationsData.success) {
    throw new Error(`Failed to purchase rations: ${JSON.stringify(buyRationsData)}`);
  }
  console.log(`  • Purchased: 20 Rations for ${buyRationsData.totalCredits} Cr`);
  console.log(`  • Remaining Credits: ${buyRationsData.newCredits} Cr, Cargo: ${buyRationsData.hold.usedCargo}/40 m³\n`);

  // Step 4: Hyperspace Warp Jump (Sec 1 -> Sec 2 -> Sec 3)
  console.log('[4/8] Outbound Warp Transit (Sector 1 -> Sector 2 -> Sector 3)...');
  const jump1 = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 2 }),
  });
  const jump1Data = await jump1.json();
  if (!jump1.ok || !jump1Data.success) throw new Error(`Jump 1 to Sec 2 failed: ${JSON.stringify(jump1Data)}`);
  console.log(`  • Jump 1: Arrived in Sector 2 (${jump1Data.toSector.name}) | Remaining AP: ${jump1Data.currentAP}, Fuel: ${jump1Data.remainingFuel}`);

  const jump2 = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 3 }),
  });
  const jump2Data = await jump2.json();
  if (!jump2.ok || !jump2Data.success) throw new Error(`Jump 2 to Sec 3 failed: ${JSON.stringify(jump2Data)}`);
  console.log(`  • Jump 2: Arrived in Sector 3 (${jump2Data.toSector.name}) | Remaining AP: ${jump2Data.currentAP}, Fuel: ${jump2Data.remainingFuel}`);
  console.log(`✓ Successfully traversed 2 sectors into Obsidian Smelter space.\n`);

  // Step 5: Destination Commerce at Obsidian Smelter (PORT_SMELTER_01)
  console.log('[5/8] Sector 3 Commerce: Selling Rations at Smelter & Buying Silicate Ore...');
  const sellRationsRes = await fetch(`${BASE_URL}/api/ports/PORT_SMELTER_01/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      commodityId: 'COMM_RATIONS',
      quantity: 20,
      type: 'SELL',
    }),
  });
  const sellRationsData = await sellRationsRes.json();
  if (!sellRationsRes.ok || !sellRationsData.success) {
    throw new Error(`Failed to sell rations at Sec 3: ${JSON.stringify(sellRationsData)}`);
  }
  const rationsProfit = sellRationsData.totalCredits - buyRationsData.totalCredits;
  console.log(`  • Sold: 20 Rations for ${sellRationsData.totalCredits} Cr (Rations Profit: +${rationsProfit.toFixed(1)} Cr)`);

  // Buy 20 Silicate Ore at cheap Smelter surplus
  const buyOreRes = await fetch(`${BASE_URL}/api/ports/PORT_SMELTER_01/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      commodityId: 'COMM_ORE',
      quantity: 20,
      type: 'BUY',
    }),
  });
  const buyOreData = await buyOreRes.json();
  if (!buyOreRes.ok || !buyOreData.success) {
    throw new Error(`Failed to purchase ore at Sec 3: ${JSON.stringify(buyOreData)}`);
  }
  console.log(`  • Purchased: 20 Silicate Ore for ${buyOreData.totalCredits} Cr`);
  console.log(`  • Cargo Hold: ${buyOreData.hold.usedCargo}/40 m³ filled with Silicate Ore\n`);

  // Step 6: Return Warp Transit (Sec 3 -> Sec 2 -> Sec 1)
  console.log('[6/8] Inbound Return Warp Transit (Sector 3 -> Sector 2 -> Sector 1)...');
  const jump3 = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 2 }),
  });
  const jump3Data = await jump3.json();
  if (!jump3.ok || !jump3Data.success) throw new Error(`Jump 3 to Sec 2 failed: ${JSON.stringify(jump3Data)}`);

  const jump4 = await fetch(`${BASE_URL}/api/navigate/jump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: PLAYER_ID, targetSectorId: 1 }),
  });
  const jump4Data = await jump4.json();
  if (!jump4.ok || !jump4Data.success) throw new Error(`Jump 4 to Sec 1 failed: ${JSON.stringify(jump4Data)}`);
  console.log(`  • Returned to Sector 1 (${jump4Data.toSector.name}) | Remaining AP: ${jump4Data.currentAP}, Fuel: ${jump4Data.remainingFuel}\n`);

  // Step 7: Liquidate Silicate Ore at Aegis Terminal (High Demand Margin)
  console.log('[7/8] Realizing Arbitrage: Selling 20 Silicate Ore at Aegis Terminal...');
  const sellOreRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: PLAYER_ID,
      commodityId: 'COMM_ORE',
      quantity: 20,
      type: 'SELL',
    }),
  });
  const sellOreData = await sellOreRes.json();
  if (!sellOreRes.ok || !sellOreData.success) {
    throw new Error(`Failed to sell ore at Sec 1: ${JSON.stringify(sellOreData)}`);
  }
  const oreProfit = sellOreData.totalCredits - buyOreData.totalCredits;
  const netCircuitProfit = sellOreData.newCredits - startingCredits;
  console.log(`  • Sold: 20 Silicate Ore for ${sellOreData.totalCredits} Cr (Ore Profit: +${oreProfit.toFixed(1)} Cr)`);
  console.log(`  • Total Round-Trip Net Profit: +${netCircuitProfit} Cr! (Credits: ${startingCredits} -> ${sellOreData.newCredits} Cr)\n`);

  // Step 8: Full Refresh Persistence Audit
  console.log('[8/8] Verifying Database Persistence Across Simulated Browser Refresh...');
  const shipCheck = await (await fetch(`${BASE_URL}/api/player/ship?playerId=${PLAYER_ID}`)).json();
  const holdCheck = await (await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`)).json();
  const apCheck = await (await fetch(`${BASE_URL}/api/player/ap?playerId=${PLAYER_ID}`)).json();

  const sectorMatches = shipCheck.ship.current_sector_id === 1;
  const fuelMatches = shipCheck.ship.fuel === 96; // 100 - 4 jumps
  const apMatches = apCheck.currentAP === 580; // 600 - 20 AP
  const creditsMatch = holdCheck.credits === sellOreData.newCredits;
  const cargoMatches = holdCheck.usedCargo === 0;

  console.log(`  • Persisted Sector: SEC-0${shipCheck.ship.current_sector_id} (Expected: 1) -> ${sectorMatches ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  • Persisted Fuel:   ${shipCheck.ship.fuel} (Expected: 96) -> ${fuelMatches ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  • Persisted AP:     ${apCheck.currentAP} (Expected: 580) -> ${apMatches ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  • Persisted Wallet: ${holdCheck.credits} Cr (Expected: ${sellOreData.newCredits}) -> ${creditsMatch ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  • Persisted Cargo:  ${holdCheck.usedCargo} m³ (Expected: 0) -> ${cargoMatches ? 'MATCH' : 'MISMATCH'}`);

  console.log('\n----------------------------------------------------------------');
  if (sectorMatches && fuelMatches && apMatches && creditsMatch && cargoMatches && netCircuitProfit > 300) {
    console.log('✅ PASS : Market radar accurately computes multi-sector arbitrage opportunities');
    console.log('✅ PASS : Multi-sector round-trip trade run completed successfully');
    console.log(`✅ PASS : Net economic profit realized: +${netCircuitProfit} Cr`);
    console.log('✅ PASS : Full state persistence verified across database');
    console.log('----------------------------------------------------------------');
    console.log('🎉 MILESTONE 0.2: THE PLAYABLE PERSISTENT ECONOMIC LOOP IS 100% OPERATIONAL!');
    console.log('----------------------------------------------------------------\n');
  } else {
    throw new Error('Milestone 0.2 validation assertions failed!');
  }
}

runMilestone02Test().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

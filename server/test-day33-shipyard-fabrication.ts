import './test-utils/authHelper';
/**
 * Day 33 Integration Test Suite: Orbital Shipyard Manufacturing & Colony Industrial Gantry
 * Milestone 0.8: Fleet Command & Task Force Operations
 *
 * Verifies:
 * 1. Blueprint Catalog Retrieval: 5 canonical faction hulls with standing and affordability annotations.
 * 2. Reputation Gating: Hostile/insufficient standing factions reject naval fabrication.
 * 3. Material Scarcity Rejection: Insufficient raw commodities rejects fabrication.
 * 4. Station Shipyard Fabrication: Material deduction from ship cargo, credit/AP costs, instant commission.
 * 5. Fleet Hangar Integration: Commissioned vessel appears in hangar reserve ready for wing assignment.
 * 6. Colony Shipyard Construction: Upgrading colony slipway to Tier 1.
 * 7. Colony 25% Discounted Fabrication: Automatic 25% discount and silo material deduction.
 * 8. Capital Slipway Tier Gating: Tier 2 capital hulls rejected on Tier 1 slipway.
 * 9. Capital Slipway Tier 2 Upgrade & Heavy Hull Commission: Fabricating Vaelic Interdictor.
 * 10. Clean Baseline Reset & Idempotence: Full state restoration upon baseline reset.
 */

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runDay33ShipyardTests() {
  console.log('================================================================================');
  console.log('🚀 RUNNING DAY 33 INTEGRATION TESTS: ORBITAL SHIPYARD MANUFACTURING & GANTRY');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (!condition) {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 0: Baseline Reset
    // -------------------------------------------------------------------------
    console.log('--- Phase 0: Player Baseline & Subsystem Reset ---');
    const resetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(resetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');
    console.log('  Baseline reset successfully.\n');

    // -------------------------------------------------------------------------
    // Phase 1: Blueprint Catalog Retrieval
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Starship Blueprint Catalog Retrieval ---');
    const catalogRes = await fetch(`${BASE_URL}/api/shipyard/fleet/blueprints?accountId=${PLAYER_ID}`);
    assert(catalogRes.ok, 'GET /api/shipyard/fleet/blueprints returned HTTP 200');
    const catalogData = await catalogRes.json();

    assert(catalogData.success === true, 'Catalog response marked success: true');
    assert(catalogData.blueprints.length === 5, 'Catalog contains exactly 5 canonical faction blueprints');

    const solBp = catalogData.blueprints.find((b: any) => b.id === 'HULL_SOL_CRUISER');
    const vaelicBp = catalogData.blueprints.find((b: any) => b.id === 'HULL_VAELIC_INTERDICTOR');
    const kryllBp = catalogData.blueprints.find((b: any) => b.id === 'HULL_KRYLL_RUNNER');
    const phoridBp = catalogData.blueprints.find((b: any) => b.id === 'HULL_PHORID_FRIGATE');
    const lithosBp = catalogData.blueprints.find((b: any) => b.id === 'HULL_LITHOS_MONITOR');

    assert(!!solBp, 'Catalog contains Sol Vanguard Missile Cruiser (HULL_SOL_CRUISER)');
    assert(!!vaelicBp, 'Catalog contains Vaelic Imperial Interdictor (HULL_VAELIC_INTERDICTOR)');
    assert(!!kryllBp, 'Catalog contains Kryll Skrit Shadow-Runner (HULL_KRYLL_RUNNER)');
    assert(!!phoridBp, 'Catalog contains Phorid Bio-Spore Frigate (HULL_PHORID_FRIGATE)');
    assert(!!lithosBp, 'Catalog contains Lithos Crystalline Monitor (HULL_LITHOS_MONITOR)');

    // Verify baseline reputation flags
    assert(solBp.hasReputation === true, 'Sol Alliance standing (+35) satisfies Sol Cruiser requirement (+10)');
    assert(vaelicBp.hasReputation === false, 'Hegemony standing (-25) rejects Vaelic Interdictor (+15)');
    assert(kryllBp.hasReputation === true, 'Kryll Cartel standing (+5) satisfies Shadow-Runner requirement (+5)');
    assert(phoridBp.hasReputation === true, 'Phorid standing (+15) satisfies Bio-Spore Frigate requirement (+15)');
    assert(lithosBp.hasReputation === false, 'Lithos standing (0) rejects Crystalline Monitor requirement (+10)');
    console.log('  Blueprint catalog and reputation annotations verified.\n');

    // -------------------------------------------------------------------------
    // Phase 2: Reputation Gating Rejection
    // -------------------------------------------------------------------------
    console.log('--- Phase 2: Reputation Gating Rejection ---');
    const repRejectRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_VAELIC_INTERDICTOR',
      }),
    });
    assert(repRejectRes.status === 400, 'Fabricating Hegemony hull with hostile reputation returns HTTP 400');
    const repRejectData = await repRejectRes.json();
    assert(
      repRejectData.error.includes('INSUFFICIENT_FACTION_STANDING'),
      'Error identifies INSUFFICIENT_FACTION_STANDING',
      `Error: ${repRejectData.error}`
    );
    console.log('  Reputation gating verified.\n');

    // -------------------------------------------------------------------------
    // Phase 3: Material Shortage Rejection
    // -------------------------------------------------------------------------
    console.log('--- Phase 3: Material Scarcity Rejection ---');
    const matRejectRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_SOL_CRUISER',
      }),
    });
    assert(matRejectRes.status === 400, 'Fabricating without raw materials returns HTTP 400');
    const matRejectData = await matRejectRes.json();
    assert(
      matRejectData.error.includes('INSUFFICIENT_MATERIALS'),
      'Error identifies INSUFFICIENT_MATERIALS',
      `Error: ${matRejectData.error}`
    );
    console.log('  Material shortage gating verified.\n');

    // -------------------------------------------------------------------------
    // Phase 4: Station Shipyard Fabrication & Material Deduction
    // -------------------------------------------------------------------------
    console.log('--- Phase 4: Station Shipyard Fabrication & Cargo Deduction ---');
    // Deposit required commodities into player ship hold: 25 Alloys, 20 Ore, 15 Fuel
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ALLOY', quantity: 25 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ORE', quantity: 20 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_FUEL', quantity: 15 }),
    });

    // Execute Fabrication of Sol Vanguard Cruiser (850 Cr, 8 AP, 18 Alloy, 12 Ore, 8 Fuel)
    const fabRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_SOL_CRUISER',
        customName: 'Sol Resolute Vanguard',
      }),
    });
    assert(fabRes.ok, 'POST /api/shipyard/fleet/fabricate returned HTTP 200');
    const fabData = await fabRes.json();
    assert(fabData.success === true, 'Shipyard fabrication marked success: true');
    assert(fabData.ship.name === 'Sol Resolute Vanguard', 'Commissioned ship named Sol Resolute Vanguard');
    assert(fabData.ship.hullClass === 'SOL_CRUISER', 'Hull Class is SOL_CRUISER');
    assert(fabData.ship.specialAbility === 'POINT_DEFENSE', 'Special ability is POINT_DEFENSE');
    assert(fabData.ship.deploymentSlot === null, 'Fabricated ship commissioned directly to Hangar Reserve');
    assert(fabData.materialsDeducted.credits === 850, 'Deducted 850 Credits construction fee');
    assert(fabData.materialsDeducted.ap === 8, 'Deducted 8 Action Points naval requisition fee');
    assert(fabData.materialsDeducted.alloy === 18, 'Deducted 18 Plasteel Alloys');
    assert(fabData.materialsDeducted.ore === 12, 'Deducted 12 Silicate Ore');
    assert(fabData.materialsDeducted.fuel === 8, 'Deducted 8 Deuterium Fuel');
    assert(fabData.materialsDeducted.source === 'SHIP_HOLD', 'Deducted from mothership cargo hold');

    // Check remaining cargo: 25 - 18 = 7 Alloys, 20 - 12 = 8 Ore, 15 - 8 = 7 Fuel
    const holdRes = await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`);
    const hold = await holdRes.json();
    const remainingAlloys = hold.cargo.find((c: any) => c.commodity_id === 'COMM_ALLOY')?.quantity || 0;
    const remainingOre = hold.cargo.find((c: any) => c.commodity_id === 'COMM_ORE')?.quantity || 0;
    const remainingFuel = hold.cargo.find((c: any) => c.commodity_id === 'COMM_FUEL')?.quantity || 0;
    assert(remainingAlloys === 7, 'Remaining Plasteel Alloys in hold: 7', `Actual: ${remainingAlloys}`);
    assert(remainingOre === 8, 'Remaining Silicate Ore in hold: 8', `Actual: ${remainingOre}`);
    assert(remainingFuel === 7, 'Remaining Deuterium Fuel in hold: 7', `Actual: ${remainingFuel}`);
    console.log('  Station shipyard fabrication and cargo deduction verified.\n');

    // -------------------------------------------------------------------------
    // Phase 5: Fleet Hangar Verification
    // -------------------------------------------------------------------------
    console.log('--- Phase 5: Fleet Hangar Telemetry Verification ---');
    const rosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const roster = await rosterRes.json();
    assert(roster.fleet.length === 3, 'Total fleet size expanded from 2 -> 3 starships');
    const newEscort = roster.reserveShips.find((s: any) => s.name === 'Sol Resolute Vanguard');
    assert(!!newEscort, 'Newly fabricated Sol Resolute Vanguard located in Hangar Reserve');
    assert(newEscort.hull === 150, 'Hull Integrity is 150 HP');
    assert(newEscort.shield === 100, 'Shield Capacity is 100 SP');
    console.log('  Fleet Hangar integration verified.\n');

    // -------------------------------------------------------------------------
    // Phase 6: Colony Orbital Shipyard Construction (Tier 1)
    // -------------------------------------------------------------------------
    console.log('--- Phase 6: Colony Orbital Shipyard Gantry Construction ---');
    // Plant survey beacon on Aegis Prime
    const probeRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, targetLat: 10.0, targetLng: 20.0, shieldBoost: true }),
    });
    const beaconId = (await probeRes.json()).beaconId;

    // Ensure credits and rations for founding
    await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, credits: 5000 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_RATIONS', quantity: 20 }),
    });

    const foundRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        planetId: 'planet_sec1_aegis',
        beaconId,
        name: 'Aegis Naval Foundry Outpost',
      }),
    });
    assert(foundRes.ok, 'Colony founded on Aegis Prime');
    const colonyId = (await foundRes.json()).colony.id;

    // Station 1x Mechanic specialist to authorize Tier 1 Orbital Shipyard Gantry
    await fetch(`${BASE_URL}/api/crew/debug-seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, specialties: ['Mechanic'], assignColonyId: colonyId }),
    });
    // Upgrade Shipyard to Tier 1 (Light Frigate Slipway, costs 500 Cr, 4 AP)
    const upShipyard1Res = await fetch(`${BASE_URL}/api/colonies/${colonyId}/shipyard/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(upShipyard1Res.ok, 'POST /api/colonies/:id/shipyard/upgrade returned HTTP 200');
    const upShipyard1Data = await upShipyard1Res.json();
    assert(upShipyard1Data.success === true, 'Upgraded colony shipyard to Tier 1');
    assert(upShipyard1Data.colony.shipyardTier === 1, 'Colony telemetry confirms shipyardTier: 1');
    console.log('  Colony Orbital Shipyard Gantry Tier 1 verified.\n');

    // -------------------------------------------------------------------------
    // Phase 7: Colony Discounted Fabrication & Silo Material Deduction
    // -------------------------------------------------------------------------
    console.log('--- Phase 7: Colony 25% Discounted Fabrication ---');
    const colCatalogRes = await fetch(
      `${BASE_URL}/api/shipyard/fleet/blueprints?accountId=${PLAYER_ID}&colonyId=${colonyId}`
    );
    assert(colCatalogRes.ok, 'GET /api/shipyard/fleet/blueprints with colonyId returned HTTP 200');
    const colCatalog = await colCatalogRes.json();
    assert(colCatalog.isColonyShipyard === true, 'Flagged isColonyShipyard: true');
    assert(colCatalog.discountMultiplier === 0.75, 'Applied 25% localized manufacturing discount (0.75x)');

    // Verify Kryll Runner costs with 25% discount:
    // Base: 700 Cr, 6 AP, 12 Alloy, 10 Ore, 6 Fuel -> Discounted: 525 Cr, 5 AP, 9 Alloy, 8 Ore, 5 Fuel
    const kryllColBp = colCatalog.blueprints.find((b: any) => b.id === 'HULL_KRYLL_RUNNER');
    assert(kryllColBp.effectiveCreditCost === 525, 'Discounted Credit cost is 525 Cr (700 * 0.75)');
    assert(kryllColBp.effectiveApCost === 5, 'Discounted AP cost is 5 AP');
    assert(kryllColBp.effectiveAlloyCost === 9, 'Discounted Alloy cost is 9 units (12 * 0.75)');
    assert(kryllColBp.effectiveOreCost === 8, 'Discounted Ore cost is 8 units (10 * 0.75)');
    assert(kryllColBp.effectiveFuelCost === 5, 'Discounted Fuel cost is 5 units (6 * 0.75)');

    // Deposit materials into player cargo: 15 Alloys, 15 Ore, 10 Fuel
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ALLOY', quantity: 15 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ORE', quantity: 15 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_FUEL', quantity: 10 }),
    });

    // Fabricate Kryll Runner at Colony Shipyard
    const fabColRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_KRYLL_RUNNER',
        customName: 'Kryll Phantom Runner',
        colonyId,
      }),
    });
    assert(fabColRes.ok, 'Fabricated Kryll Runner at Colony Shipyard');
    const fabColData = await fabColRes.json();
    assert(fabColData.isColonyDiscountApplied === true, 'Colony 25% discount confirmed in result');
    assert(fabColData.materialsDeducted.credits === 525, 'Deducted discounted 525 Credits');
    assert(fabColData.materialsDeducted.ap === 5, 'Deducted discounted 5 AP');
    assert(fabColData.materialsDeducted.alloy === 9, 'Deducted discounted 9 Alloys');
    assert(fabColData.ship.name === 'Kryll Phantom Runner', 'Commissioned Kryll Phantom Runner');
    console.log('  Colony discounted manufacturing verified.\n');

    // -------------------------------------------------------------------------
    // Phase 8: Capital Slipway Tier Gating on Colony
    // -------------------------------------------------------------------------
    console.log('--- Phase 8: Capital Slipway Tier Gating ---');
    // Set Hegemony reputation to +20 so reputation requirement for Interdictor (+15) is met
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, factionId: 'FACTION_HEGEMONY', standing: 20 }),
    });

    // Attempt to fabricate Tier 2 hull (HULL_VAELIC_INTERDICTOR) while colony is only Tier 1
    const badTierRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_VAELIC_INTERDICTOR',
        colonyId,
      }),
    });
    assert(badTierRes.status === 400, 'Fabricating Tier 2 hull on Tier 1 slipway rejected (HTTP 400)');
    const badTierData = await badTierRes.json();
    assert(
      badTierData.error.includes('INSUFFICIENT_SHIPYARD_TIER'),
      'Error identifies INSUFFICIENT_SHIPYARD_TIER',
      `Error: ${badTierData.error}`
    );
    console.log('  Slipway tier gating verified.\n');

    // -------------------------------------------------------------------------
    // Phase 9: Capital Slipway Tier 2 Upgrade & Heavy Hull Commission
    // -------------------------------------------------------------------------
    console.log('--- Phase 9: Capital Slipway Tier 2 Upgrade & Interdictor Fabrication ---');
    // Station 2nd specialist (Engineer) to authorize Tier 2 Capital Slipway
    await fetch(`${BASE_URL}/api/crew/debug-seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, specialties: ['Engineer'], assignColonyId: colonyId }),
    });
    // Upgrade Colony Shipyard to Tier 2 (costs 1,200 Cr, 8 AP)
    const upShipyard2Res = await fetch(`${BASE_URL}/api/colonies/${colonyId}/shipyard/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(upShipyard2Res.ok, 'Upgraded colony shipyard to Tier 2 (Capital Fleet Slipway)');
    const upShipyard2Data = await upShipyard2Res.json();
    assert(upShipyard2Data.colony.shipyardTier === 2, 'Colony shipyard is now Tier 2');

    // Provide materials for discounted Vaelic Interdictor:
    // Base: 1200 Cr, 10 AP, 24 Alloy, 18 Ore, 12 Fuel -> Discounted (75%): 900 Cr, 8 AP, 18 Alloy, 14 Ore, 9 Fuel
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ALLOY', quantity: 25 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_ORE', quantity: 20 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID, commodityId: 'COMM_FUEL', quantity: 15 }),
    });

    const fabInterdictorRes = await fetch(`${BASE_URL}/api/shipyard/fleet/fabricate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        blueprintId: 'HULL_VAELIC_INTERDICTOR',
        customName: 'Hegemony Vanguard Interdictor',
        colonyId,
      }),
    });
    assert(fabInterdictorRes.ok, 'Fabricated Vaelic Interdictor at Tier 2 Colony Shipyard');
    const fabInterdictorData = await fabInterdictorRes.json();
    assert(fabInterdictorData.success === true, 'Capital hull fabrication succeeded');
    assert(fabInterdictorData.ship.name === 'Hegemony Vanguard Interdictor', 'Commissioned Hegemony Vanguard Interdictor');
    assert(fabInterdictorData.ship.hullClass === 'VAELIC_INTERDICTOR', 'Hull Class is VAELIC_INTERDICTOR');
    assert(fabInterdictorData.ship.specialAbility === 'PLASMA_BARRAGE', 'Special ability is PLASMA_BARRAGE');
    assert(fabInterdictorData.materialsDeducted.credits === 900, 'Deducted discounted 900 Credits');
    assert(fabInterdictorData.materialsDeducted.alloy === 18, 'Deducted discounted 18 Alloys');

    // Final roster check: should now hold 5 ships!
    const finalRosterRes = await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`);
    const finalRoster = await finalRosterRes.json();
    assert(finalRoster.fleet.length === 5, 'Fleet garage expanded to 5 starships across 3 alien factions');
    console.log('  Capital hull fabrication and multi-faction fleet verified.\n');

    // -------------------------------------------------------------------------
    // Phase 10: Clean Baseline Reset & Idempotence
    // -------------------------------------------------------------------------
    console.log('--- Phase 10: Clean Baseline Reset & Idempotence ---');
    const finalResetRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(finalResetRes.ok, 'POST /api/player/debug-baseline returned HTTP 200');

    const cleanRoster = await (await fetch(`${BASE_URL}/api/fleet/roster?accountId=${PLAYER_ID}`)).json();
    assert(cleanRoster.fleet.length === 2, 'Fleet restored to canonical 2 starter ships');
    console.log('  Fleet baseline reset verified.\n');

    console.log('================================================================================');
    console.log(`  DAY 33 VERIFICATION COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('  ORBITAL SHIPYARD MANUFACTURING & COLONY GANTRY FULLY OPERATIONAL!');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('Fatal failure in Day 33 Shipyard tests:', err);
    process.exit(1);
  }
}

runDay33ShipyardTests();

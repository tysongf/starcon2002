import './test-utils/authHelper';
const BASE_URL = 'http://localhost:3000';

async function runDay30Tests() {
  console.log('========================================================================');
  console.log('  RUNNING DAY 30 INTEGRATION TESTS: APEX TITANS & CONTINUOUS EXPEDITIONS');
  console.log('========================================================================\n');

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
    // Step 0: Baseline Reset
    // ----------------------------------------------------
    console.log('--- Step 0: Baseline Reset ---');
    const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(baseRes.ok, 'Player baseline reset returned HTTP 200');

    const resetFaunaRes = await fetch(`${BASE_URL}/api/planets/debug-reset-fauna`, {
      method: 'POST',
    });
    assert(resetFaunaRes.ok, 'Fauna and landers reset returned HTTP 200');
    console.log('  Baseline reset successfully.\n');

    // ----------------------------------------------------
    // Test Suite 1: Procedural Titan Generation & Lair Anchoring
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Procedural Titan Generation & Lair Anchoring ---');

    // 1.1 Aegis Prime Apex Titan
    const aegisTitanRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/fauna/titans`);
    assert(aegisTitanRes.ok, 'GET /api/planets/planet_sec1_aegis/fauna/titans returned HTTP 200');
    const aegisTitans = await aegisTitanRes.json();
    assert(aegisTitans.success === true, 'Aegis Titan query marked success: true');
    assert(aegisTitans.count === 1, 'Aegis Prime has exactly 1 Apex Titan');
    const aegisTitan = aegisTitans.titans[0];
    assert(aegisTitan.species_name.includes('Ancient Chitin Colossus'), 'Titan species contains Ancient Chitin Colossus');
    assert(aegisTitan.species_class === 'CARNIVORE', 'Titan classified as CARNIVORE');
    assert(aegisTitan.is_apex === true, 'Titan has is_apex = true');
    assert(aegisTitan.base_hp === 280, 'Aegis Titan base HP is 280');
    assert(aegisTitan.bio_unit_value === 75, 'Aegis Titan bio unit value is 75');
    assert(aegisTitan.stun_hits_required === 3, 'Aegis Titan requires 3 stun blaster hits to subdue');
    assert(aegisTitan.stun_duration_seconds === 16, 'Aegis Titan tranquilizer duration is 16 seconds');
    assert(aegisTitan.lair_name === 'Obsidian Basalt Rift', 'Titan anchored to Obsidian Basalt Rift lair');
    assert(aegisTitan.lair_x === 310 && aegisTitan.lair_y === -240, 'Titan lair anchored at coordinates (310, -240)');

    // 1.2 Charybdis Apex Titan
    const charybdisTitanRes = await fetch(`${BASE_URL}/api/planets/planet_sec2_charybdis/fauna/titans`);
    assert(charybdisTitanRes.ok, 'GET /api/planets/planet_sec2_charybdis/fauna/titans returned HTTP 200');
    const charybdisTitans = await charybdisTitanRes.json();
    assert(charybdisTitans.count === 1, 'Charybdis has 1 Apex Titan');
    const charybdisTitan = charybdisTitans.titans[0];
    assert(charybdisTitan.species_name.includes('Galvanic Leviathan'), 'Charybdis Titan is Galvanic Leviathan');
    assert(charybdisTitan.stun_hits_required === 4, 'Galvanic Leviathan requires 4 stun hits');
    assert(charybdisTitan.base_hp === 380, 'Galvanic Leviathan base HP is 380');
    assert(charybdisTitan.bio_unit_value === 95, 'Galvanic Leviathan bio-value is 95 units');
    assert(charybdisTitan.lair_name === 'Sub-Surface Ion Trench', 'Charybdis Titan lair is Sub-Surface Ion Trench');

    // 1.3 Ignis Apex Titan
    const ignisTitanRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/fauna/titans`);
    assert(ignisTitanRes.ok, 'GET /api/planets/planet_sec3_ignis/fauna/titans returned HTTP 200');
    const ignisTitans = await ignisTitanRes.json();
    assert(ignisTitans.count === 1, 'Ignis has 1 Apex Titan');
    const ignisTitan = ignisTitans.titans[0];
    assert(ignisTitan.species_name.includes('Magma Behemoth'), 'Ignis Titan is Magma Behemoth');
    assert(ignisTitan.base_hp === 350, 'Magma Behemoth base HP is 350');
    assert(ignisTitan.bio_unit_value === 85, 'Magma Behemoth bio-value is 85 units');
    assert(ignisTitan.lair_name === 'Molten Caldera Lair', 'Ignis Titan lair is Molten Caldera Lair');

    // 1.4 Procedural Generation on unseeded world (Mycelia IV)
    const myceliaTitanRes = await fetch(`${BASE_URL}/api/planets/planet_sec4_mycelia/fauna/titans`);
    assert(myceliaTitanRes.ok, 'GET /api/planets/planet_sec4_mycelia/fauna/titans returned HTTP 200');
    const myceliaTitans = await myceliaTitanRes.json();
    assert(myceliaTitans.count === 1, 'Mycelia IV procedurally spawned 1 Apex Titan');
    const myceliaTitan = myceliaTitans.titans[0];
    assert(myceliaTitan.species_name.includes('Spore Colossus'), 'Mycelia IV procedural titan archetype is Spore Colossus');
    assert(myceliaTitan.is_apex === true, 'Procedural titan is flagged as is_apex = true');
    assert(myceliaTitan.stun_hits_required === 3, 'Spore Colossus requires 3 stun hits');
    assert(myceliaTitan.bio_unit_value === 80, 'Spore Colossus bio-value is 80 units');
    assert(myceliaTitan.lair_name === 'Primordial Spore Hollow', 'Procedural lair anchored at Primordial Spore Hollow');
    console.log('  Procedural Titan generation and planetary lairs verified.\n');

    // ----------------------------------------------------
    // Test Suite 2: Multi-Hit Tranquilizer Buildup & Enrage Mechanics
    // ----------------------------------------------------
    console.log('--- Test Suite 2: Multi-Hit Tranquilizer Buildup & Enrage Mechanics ---');

    // 2.1 Orbital Deployment includes Titans in telemetry
    const deployRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(deployRes.ok, 'POST /api/planets/planet_sec1_aegis/lander/deploy returned HTTP 200');
    const deployData = await deployRes.json();
    assert(deployData.success === true, 'Lander deployment marked success: true');
    assert(deployData.session.fauna.length === 2, 'Session fauna preserves exactly 2 standard species (backwards compatibility)');
    assert(Array.isArray(deployData.session.titans) && deployData.session.titans.length === 1, 'Session seeded with 1 Apex Titan');
    assert(deployData.session.titans[0].species_name.includes('Ancient Chitin Colossus'), 'Session titan matches Ancient Chitin Colossus');

    // 2.2 First Stun Hit on Titan -> Enraged (+50% speed/aggro)
    const hit1Res = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/titan-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        speciesId: aegisTitan.id,
      }),
    });
    assert(hit1Res.ok, 'POST /api/planets/planet_sec1_aegis/lander/titan-hit (Hit 1) returned HTTP 200');
    const hit1Data = await hit1Res.json();
    assert(hit1Data.success === true, 'Hit 1 registered successfully');
    assert(hit1Data.hits === 1, 'Recorded hits is 1');
    assert(hit1Data.required === 3, 'Required hits is 3');
    assert(hit1Data.isStunned === false, 'Titan is NOT yet stunned after 1 hit');
    assert(hit1Data.isEnraged === true, 'Titan is triggered into ENRAGED state');
    assert(hit1Data.stunDuration === 0, 'Stun duration is 0 while active');

    // 2.3 Second Stun Hit on Titan -> Still Enraged
    const hit2Res = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/titan-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        speciesId: aegisTitan.id,
      }),
    });
    assert(hit2Res.ok, 'Hit 2 returned HTTP 200');
    const hit2Data = await hit2Res.json();
    assert(hit2Data.hits === 2, 'Recorded hits is 2');
    assert(hit2Data.isStunned === false, 'Titan is NOT yet stunned after 2 hits');
    assert(hit2Data.isEnraged === true, 'Titan remains in ENRAGED state');

    // 2.4 Third Stun Hit on Titan -> Subdued & Stunned for 16s!
    const hit3Res = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/titan-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        speciesId: aegisTitan.id,
      }),
    });
    assert(hit3Res.ok, 'Hit 3 returned HTTP 200');
    const hit3Data = await hit3Res.json();
    assert(hit3Data.hits === 3, 'Recorded hits reached 3 (meets requirement)');
    assert(hit3Data.isStunned === true, 'Titan is SUBDUED and transitions to STUNNED');
    assert(hit3Data.isEnraged === false, 'Enrage state cleared upon tranquilization');
    assert(hit3Data.stunDuration === 16.0, 'Titan tranquilized for full 16.0 seconds');
    console.log('  Multi-hit tranquilizer mechanics and enrage states verified.\n');

    // ----------------------------------------------------
    // Test Suite 3: Mid-Mission Cargo Stashing (/stash-cargo)
    // ----------------------------------------------------
    console.log('--- Test Suite 3: Mid-Mission Cargo Stashing (/stash-cargo) ---');

    // 3.1 Attempt invalid stash
    const badStashRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/stash-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_unknown_pilot',
        mineralsHarvested: [],
        bioSamplesHarvested: [],
        hullRemaining: 100,
        fuelRemaining: 50,
      }),
    });
    assert(
      badStashRes.status === 400 || badStashRes.status === 403,
      'Stash for unknown/spoofed pilot rejected with HTTP 400/403'
    );

    // 3.2 Legitimate Mid-Mission Stash at Rendezvous Beacon
    const stashPayload1 = {
      accountId: 'acc_sol_captain',
      mineralsHarvested: [
        { name: 'Plutonium Isotopes', quantity: 10, commodityId: 'COMM_FUEL' },
      ],
      bioSamplesHarvested: [
        {
          speciesId: aegisTitan.id,
          name: aegisTitan.species_name,
          quantity: 1,
          bioUnits: 75,
          speciesClass: 'CARNIVORE',
        },
      ],
      hullRemaining: 85,
      fuelRemaining: 35,
    };

    const stash1Res = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/stash-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stashPayload1),
    });
    assert(stash1Res.ok, 'POST /api/planets/planet_sec1_aegis/lander/stash-cargo returned HTTP 200');
    const stash1Data = await stash1Res.json();
    assert(stash1Data.success === true, 'Stash transaction marked success: true');
    assert(stash1Data.stashedMinerals === 10, 'Stashed exactly 10 minerals to mothership');
    assert(stash1Data.stashedBioUnits === 75, 'Stashed 75 biological units from Titan specimen');
    assert(stash1Data.fuelBonus === 25.0, 'Awarded +25.0 Fuel replenishment bonus');
    assert(stash1Data.lander.fuel === 60, 'Lander fuel refueled from 35 -> 60 units');
    assert(stash1Data.lander.hull === 85, 'Lander hull maintained at 85 HP');
    assert(stash1Data.lander.is_active === true, 'Lander remains ACTIVE on planetary surface');

    // 3.3 Verify Cargo Transfer into Ship Cargo Hold
    const marketCheck1 = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market`);
    assert(marketCheck1.ok, 'GET /api/ports/PORT_AEGIS_01/market returned HTTP 200');
    const market1Data = await marketCheck1.json();
    const bioSpec1 = market1Data.hold.cargo.find((h: any) => h.commodity_id === 'COMM_BIO_SPECIMENS');
    assert(!!bioSpec1, 'COMM_BIO_SPECIMENS present in player ship cargo hold');
    assert(bioSpec1.quantity >= 1, 'Player ship cargo hold contains at least 1 Titan biological specimen');
    console.log('  Mid-mission cargo stashing and refueling validated.\n');

    // ----------------------------------------------------
    // Test Suite 4: Continuous Multi-Cycle Surface Expedition
    // ----------------------------------------------------
    console.log('--- Test Suite 4: Continuous Multi-Cycle Surface Expedition ---');

    // 4.1 Cycle 2: Second sortie in the same surface expedition without returning to orbit
    const stashPayload2 = {
      accountId: 'acc_sol_captain',
      mineralsHarvested: [
        { name: 'Rare Crystalline Matrix', quantity: 8, commodityId: 'COMM_ALLOY' },
      ],
      bioSamplesHarvested: [
        {
          speciesId: 'fauna_aegis_grazer_01',
          name: 'Aegis Bio-Spore Strider',
          quantity: 2,
          bioUnits: 24,
          speciesClass: 'GRAZER',
        },
      ],
      hullRemaining: 80,
      fuelRemaining: 20,
    };

    const stash2Res = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/stash-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stashPayload2),
    });
    assert(stash2Res.ok, 'Cycle 2 stash returned HTTP 200');
    const stash2Data = await stash2Res.json();
    assert(stash2Data.success === true, 'Cycle 2 stash marked success: true');
    assert(stash2Data.stashedMinerals === 8, 'Cycle 2 stashed 8 additional minerals');
    assert(stash2Data.stashedBioUnits === 24, 'Cycle 2 stashed 24 additional bio-units');
    assert(stash2Data.lander.fuel === 45, 'Lander fuel refueled from 20 -> 45 units');
    assert(stash2Data.lander.is_active === true, 'Lander continues sortie on surface');

    // 4.2 Verify Cumulative Commodities in Ship Cargo Hold
    const marketCheck2 = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market`);
    const market2Data = await marketCheck2.json();
    const bioSpec2 = market2Data.hold.cargo.find((h: any) => h.commodity_id === 'COMM_BIO_SPECIMENS');
    assert(bioSpec2.quantity >= 3, 'Cumulative bio-specimens reached 3 (1 Titan + 2 Striders)');

    // 4.3 Final Recovery: End Expedition and Ascend to Orbit
    const finalRecoverRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        mineralsHarvested: [
          { name: 'Superdense Titanium', quantity: 6, commodityId: 'COMM_ALLOY' },
        ],
        bioSamplesHarvested: [],
        hullRemaining: 80,
        fuelRemaining: 30,
      }),
    });
    assert(finalRecoverRes.ok, 'POST /api/planets/planet_sec1_aegis/lander/recover returned HTTP 200');
    const finalRecoverData = await finalRecoverRes.json();
    assert(finalRecoverData.success === true, 'Final recovery marked success: true');
    assert(finalRecoverData.totalMinerals === 6, 'Final cycle deposited remaining 6 minerals');

    // Total expedition yielded: 10 (stash 1) + 8 (stash 2) + 6 (recovery) = 24 minerals
    // Bio: 75 (stash 1) + 24 (stash 2) = 99 bio-units
    const marketCheck3 = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market`);
    const market3Data = await marketCheck3.json();
    const alloyItem = market3Data.hold.cargo.find((h: any) => h.commodity_id === 'COMM_ALLOY');
    assert(!!alloyItem && alloyItem.quantity >= 14, 'Cumulative COMM_ALLOY committed from multiple cycles');
    console.log('  Continuous multi-cycle expedition and final recovery validated.\n');

    // ----------------------------------------------------
    // Test Suite 5: Surface Radar Telemetry & Backward Compatibility
    // ----------------------------------------------------
    console.log('--- Test Suite 5: Surface Radar Telemetry & Backward Compatibility ---');

    // 5.1 Standard Fauna Catalog endpoint preserves strict backwards compatibility
    const stdFaunaRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/fauna`);
    assert(stdFaunaRes.ok, 'GET /api/planets/planet_sec1_aegis/fauna returned HTTP 200');
    const stdFaunaData = await stdFaunaRes.json();
    assert(stdFaunaData.count === 2, 'Standard fauna catalog strictly returns 2 non-apex species');
    assert(!stdFaunaData.fauna.some((f: any) => f.is_apex === true), 'Standard catalog contains NO apex titans');

    // 5.2 Titans endpoint returns apex species
    const titansRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/fauna/titans`);
    assert(titansRes.ok, 'GET /api/planets/planet_sec1_aegis/fauna/titans returned HTTP 200');
    const titansData = await titansRes.json();
    assert(titansData.count === 1, 'Titans catalog returns exactly 1 apex titan');
    assert(titansData.titans[0].is_apex === true, 'Titans entry has is_apex = true');

    // 5.3 Planetary Hazards endpoint
    const hazardsRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/hazards`);
    assert(hazardsRes.ok, 'GET /api/planets/planet_sec1_aegis/hazards returned HTTP 200');
    const hazardsData = await hazardsRes.json();
    assert(hazardsData.success === true, 'Hazards query marked success: true');
    assert(typeof hazardsData.thermalLevel === 'number', 'Hazards returns thermalLevel');
    assert(typeof hazardsData.ionLevel === 'number', 'Hazards returns ionLevel');
    assert(typeof hazardsData.causticLevel === 'number', 'Hazards returns causticLevel');

    // 5.4 Error handling on invalid planet
    const badPlanetTitan = await fetch(`${BASE_URL}/api/planets/planet_nonexistent/fauna/titans`);
    const badPlanetData = await badPlanetTitan.json();
    assert(badPlanetData.count === 0, 'Nonexistent planet returns 0 titans');
    console.log('  Telemetry and backward compatibility verified.\n');

    console.log('========================================================================');
    console.log(`  DAY 30 TEST SUITE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Fatal test failure in Day 30 suite:', err);
    process.exit(1);
  }
}

runDay30Tests();

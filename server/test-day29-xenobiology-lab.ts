const BASE_URL = 'http://localhost:3000';

async function runDay29Tests() {
  console.log('========================================================================');
  console.log('  RUNNING DAY 29 INTEGRATION TESTS: XENOBIOLOGY & COLONY BIOTECH LAB');
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

    const resetSurveyRes = await fetch(`${BASE_URL}/api/player/debug-reset-survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(resetSurveyRes.ok, 'Planetary surveys and colonies reset returned HTTP 200');

    const resetLabRes = await fetch(`${BASE_URL}/api/xenobiology/debug-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(resetLabRes.ok, 'Xenobiology research state reset returned HTTP 200');
    console.log('  Baseline reset successfully.\n');

    // ----------------------------------------------------
    // Test Suite 1: Specimen Turn-In & Bio-Data Accrual
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Specimen Turn-In & Bio-Data Accrual ---');

    // 1.1 Verify initial lab state
    const initLabRes = await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`);
    assert(initLabRes.ok, 'GET /api/xenobiology/lab returned HTTP 200');
    const initLab = await initLabRes.json();
    assert(initLab.success === true, 'Lab status marked success: true');
    assert(initLab.bioDataPoints === 0, 'Initial Bio-Data points is 0 BD');
    assert(initLab.biosphereTier === 1, 'Initial Biosphere Tier is 1 (Standard Biosphere)');
    assert(initLab.unlockedProjects.length === 0, 'Initial unlocked projects array is empty');
    assert(initLab.specimensInHold === 0, 'Initial specimens in hold is 0');
    assert(initLab.colonyProjectsCatalog.length >= 4, 'Colony projects catalog contains 4 breakthroughs');
    assert(initLab.synthesisCatalog.length >= 4, 'Synthesis catalog contains 4 tactical recipes');

    // 1.2 Attempt to submit specimens when hold is empty (should fail)
    const emptySubmitRes = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 2 }),
    });
    assert(emptySubmitRes.status === 400, 'Submitting specimens with empty hold returns HTTP 400');
    const emptySubmitData = await emptySubmitRes.json();
    assert(emptySubmitData.error.includes('INSUFFICIENT_SPECIMENS'), 'Error indicates INSUFFICIENT_SPECIMENS');

    // 1.3 Deposit 12 specimens into ship cargo hold
    const cargoRes = await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 12 }),
    });
    assert(cargoRes.ok, 'Deposited 12 COMM_BIO_SPECIMENS into player ship hold');

    // Verify hold shows 12 specimens
    const labWithCargoRes = await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`);
    const labWithCargo = await labWithCargoRes.json();
    assert(labWithCargo.specimensInHold === 12, 'Lab telemetry detects 12 specimens in ship hold');

    // 1.4 Submit 2 specimens to lab
    const submit2Res = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 2, speciesId: 'fauna_aegis_carnivore_01' }),
    });
    assert(submit2Res.ok, 'POST /api/xenobiology/submit-specimens (qty: 2) returned HTTP 200');
    const submit2Data = await submit2Res.json();
    assert(submit2Data.success === true, 'Turn-in marked success: true');
    assert(submit2Data.bioDataAwarded === 30, 'Awarded exactly 30 Bio-Data points (15 BD * 2)');
    assert(submit2Data.currentBioData === 30, 'Current Bio-Data total is 30 BD');
    assert(submit2Data.speciesMastery['fauna_aegis_carnivore_01'].tier === 1, 'Silicon Mantis genetic mastery is Tier 1 (SEQUENCED)');
    assert(submit2Data.speciesMastery['fauna_aegis_carnivore_01'].submittedCount === 2, 'Submitted count for Silicon Mantis is 2');

    // 1.5 Submit 6 more specimens specifying fauna_aegis_carnivore_01 to reach Tier 3 mastery (total 8)
    const submit6Res = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 6, speciesId: 'fauna_aegis_carnivore_01' }),
    });
    assert(submit6Res.ok, 'POST /api/xenobiology/submit-specimens (qty: 6) returned HTTP 200');
    const submit6Data = await submit6Res.json();
    assert(submit6Data.bioDataAwarded === 90, 'Awarded 90 Bio-Data points (15 BD * 6)');
    assert(submit6Data.currentBioData === 120, 'Current Bio-Data total is 120 BD');
    assert(submit6Data.speciesMastery['fauna_aegis_carnivore_01'].submittedCount === 8, 'Silicon Mantis submitted count is 8');
    assert(submit6Data.speciesMastery['fauna_aegis_carnivore_01'].tier === 3, 'Silicon Mantis advanced to Tier 3 APEX_MASTERY');
    assert(submit6Data.speciesMastery['fauna_aegis_carnivore_01'].tierLabel === 'APEX_MASTERY', 'Tier label is APEX_MASTERY');

    // 1.6 Submit remaining 4 specimens for fauna_aegis_grazer_01
    const submitGrazerRes = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 4, speciesId: 'fauna_aegis_grazer_01' }),
    });
    assert(submitGrazerRes.ok, 'POST /api/xenobiology/submit-specimens for grazer returned HTTP 200');
    const submitGrazerData = await submitGrazerRes.json();
    assert(submitGrazerData.currentBioData === 180, 'Total Bio-Data reached 180 BD');
    assert(submitGrazerData.speciesMastery['fauna_aegis_grazer_01'].tier === 2, 'Grazer advanced to Tier 2 SYNTHESIZED (4 specimens)');

    // Verify ship hold is now 0 specimens
    const labAfterSubmitRes = await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`);
    const labAfterSubmit = await labAfterSubmitRes.json();
    assert(labAfterSubmit.specimensInHold === 0, 'Ship hold completely emptied after turn-ins');
    console.log('  Specimen Turn-in & Bio-Data Accrual verified.\n');

    // ----------------------------------------------------
    // Test Suite 2: Global Biosphere Tiers & Colony Morale
    // ----------------------------------------------------
    console.log('--- Test Suite 2: Global Biosphere Tiers & Colony Morale ---');

    // 2.1 Set up a baseline colony on Aegis Prime
    // Deploy probe to plant beacon on Aegis Prime
    const probeAegisRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', targetLat: 15.0, targetLng: -40.0, shieldBoost: true }),
    });
    assert(probeAegisRes.ok, 'Surface probe planted beacon on Aegis Prime');
    const probeAegisData = await probeAegisRes.json();
    const beaconAegisId = probeAegisData.beaconId;

    // Grant 10 COMM_RATIONS for colony founding requirement
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_RATIONS', quantity: 10 }),
    });

    const foundAegisRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        planetId: 'planet_sec1_aegis',
        beaconId: beaconAegisId,
        name: 'Aegis Biosphere Outpost',
      }),
    });
    assert(foundAegisRes.ok, 'Colony outpost founded on Aegis Prime');
    const foundAegisData = await foundAegisRes.json();
    const colonyAegis = foundAegisData.colony;
    assert(colonyAegis.population === 120, 'Initial colony population is 120');
    assert(colonyAegis.maxPopulation === 500, 'Baseline Tier 1 max population is 500 (1.0x)');
    assert(colonyAegis.biosphereTier === 1, 'Colony reflects global Biosphere Tier 1');
    assert(colonyAegis.biosphereMoraleBonus === 0, 'Colony morale bonus is 0');
    assert(colonyAegis.taxBonus === 0, 'Colony tax bonus is 0');

    // 2.2 Upgrade Biosphere to Tier 2 (costs 100 BD, we have 180 BD)
    const upBio2Res = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(upBio2Res.ok, 'POST /api/xenobiology/upgrade-biosphere (Tier 2) returned HTTP 200');
    const upBio2Data = await upBio2Res.json();
    assert(upBio2Data.success === true, 'Tier 2 upgrade marked success: true');
    assert(upBio2Data.newTier.tier === 2, 'New tier is 2: Enriched Soil & Micro-Flora');
    assert(upBio2Data.newTier.populationMultiplier === 1.25, 'Tier 2 population multiplier is 1.25x');
    assert(upBio2Data.newTier.moraleBonus === 0.10, 'Tier 2 morale bonus is +10%');
    assert(upBio2Data.newTier.taxBonus === 0.15, 'Tier 2 tax bonus is +15%');
    assert(upBio2Data.currentBioData === 80, 'Remaining Bio-Data points is 80 BD (180 - 100)');

    // 2.3 Verify colony telemetry reflects Tier 2 scaling
    const colDetailTier2Res = await fetch(`${BASE_URL}/api/colonies/${colonyAegis.id}`);
    assert(colDetailTier2Res.ok, 'GET /api/colonies/:id returned HTTP 200');
    const colDetailTier2Data = await colDetailTier2Res.json();
    const col2 = colDetailTier2Data.colony;
    assert(col2.biosphereTier === 2, 'Colony telemetry reflects Biosphere Tier 2');
    assert(col2.maxPopulation === 625, 'Colony max population scaled to 625 (500 * 1.25)');
    assert(col2.biosphereMoraleBonus === 0.10, 'Colony telemetry reflects +10% morale bonus');
    assert(col2.taxBonus === 0.15, 'Colony telemetry reflects +15% tax revenue bonus');

    // 2.4 Attempt Tier 3 upgrade with insufficient BD (requires 250 BD, we have 80 BD)
    const failBio3Res = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(failBio3Res.status === 400, 'Tier 3 upgrade with insufficient BD returns HTTP 400');
    const failBio3Data = await failBio3Res.json();
    assert(failBio3Data.error.includes('INSUFFICIENT_BIO_DATA'), 'Error confirms INSUFFICIENT_BIO_DATA');

    // Grant 1,500 Bio-Data points by turning in 100 specimens
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 100 }),
    });
    await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 100 }),
    });

    // 2.5 Upgrade to Tier 3 (costs 250 BD)
    const upBio3Res = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(upBio3Res.ok, 'Upgraded to Biosphere Tier 3 (Engineered Biome Synthesis)');
    const upBio3Data = await upBio3Res.json();
    assert(upBio3Data.newTier.tier === 3, 'Tier 3 confirmed');

    const colDetailTier3Res = await fetch(`${BASE_URL}/api/colonies/${colonyAegis.id}`);
    const col3 = (await colDetailTier3Res.json()).colony;
    assert(col3.maxPopulation === 750, 'Colony max population scaled to 750 (500 * 1.50)');

    // 2.6 Upgrade to Tier 4 (costs 500 BD)
    const upBio4Res = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(upBio4Res.ok, 'Upgraded to Biosphere Tier 4 (Adaptive Atmospheric Canopy)');

    const colDetailTier4Res = await fetch(`${BASE_URL}/api/colonies/${colonyAegis.id}`);
    const col4 = (await colDetailTier4Res.json()).colony;
    assert(col4.maxPopulation === 900, 'Colony max population scaled to 900 (500 * 1.80)');

    // 2.7 Upgrade to Tier 5 (Apex Genesis, costs 1,000 BD)
    // Deposit 50 more specimens to ensure sufficient Bio-Data
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 50 }),
    });
    await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 50 }),
    });

    const upBio5Res = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(upBio5Res.ok, 'Upgraded to Biosphere Tier 5 (Apex Biosphere Genesis)');
    const upBio5Data = await upBio5Res.json();
    assert(upBio5Data.newTier.tier === 5, 'Tier 5 confirmed');
    assert(upBio5Data.newTier.populationMultiplier === 2.20, 'Tier 5 pop multiplier is 2.20x');

    const colDetailTier5Res = await fetch(`${BASE_URL}/api/colonies/${colonyAegis.id}`);
    const col5 = (await colDetailTier5Res.json()).colony;
    assert(col5.maxPopulation === 1100, 'Colony max population scaled to 1,100 (500 * 2.20)');
    assert(col5.biosphereMoraleBonus === 0.45, 'Tier 5 morale bonus is +45%');
    assert(col5.taxBonus === 0.75, 'Tier 5 tax bonus is +75%');

    // 2.8 Upgrade past Tier 5 is blocked
    const overMaxBioRes = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(overMaxBioRes.status === 400, 'Upgrading past Tier 5 returns HTTP 400');
    const overMaxData = await overMaxBioRes.json();
    assert(overMaxData.error.includes('MAX_TIER_REACHED'), 'Error confirms MAX_TIER_REACHED');
    console.log('  Biosphere Tiers & Colony Morale scaling verified.\n');

    // ----------------------------------------------------
    // Test Suite 3: Targeted Colony Genetic Breakthroughs
    // ----------------------------------------------------
    console.log('--- Test Suite 3: Targeted Colony Genetic Breakthroughs ---');

    // 3.1 Gating: Colonizing Extreme Volcanic Hazard World Ignis Tartarus without BIO_EXTREMOPHILE_DOMES fails
    // Plant beacon on Ignis Tartarus (hazard_thermal_level = 3)
    const probeIgnisRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', targetLat: 20.0, targetLng: 30.0, shieldBoost: true }),
    });
    assert(probeIgnisRes.ok, 'Surface probe planted beacon on Ignis Tartarus');
    const probeIgnisData = await probeIgnisRes.json();
    const beaconIgnisId = probeIgnisData.beaconId;

    // Ensure credits and rations
    await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', credits: 5000 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_RATIONS', quantity: 15 }),
    });

    const blockedIgnisColRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        planetId: 'planet_sec3_ignis',
        beaconId: beaconIgnisId,
        name: 'Ignis Volcanic Base',
      }),
    });
    assert(blockedIgnisColRes.status === 400, 'Founding colony on extreme hazard world without Bio-Domes returns HTTP 400');
    const blockedIgnisData = await blockedIgnisColRes.json();
    assert(blockedIgnisData.error.includes('HAZARD_ENVIRONMENT_UNSUITABLE'), 'Error confirms HAZARD_ENVIRONMENT_UNSUITABLE');

    // 3.2 Research Adaptive Extremophile Bio-Domes (BIO_EXTREMOPHILE_DOMES, 300 BD)
    // Silicon Mantis mastery is already Tier 3 from Suite 1
    const resDomesRes = await fetch(`${BASE_URL}/api/xenobiology/research-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', projectId: 'BIO_EXTREMOPHILE_DOMES' }),
    });
    assert(resDomesRes.ok, 'POST /api/xenobiology/research-project (BIO_EXTREMOPHILE_DOMES) returned HTTP 200');
    const resDomesData = await resDomesRes.json();
    assert(resDomesData.success === true, 'Research marked success: true');
    assert(resDomesData.unlockedProjects.includes('BIO_EXTREMOPHILE_DOMES'), 'BIO_EXTREMOPHILE_DOMES in unlocked projects');

    // 3.3 Now found colony on Ignis Tartarus (should succeed!)
    const allowIgnisColRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        planetId: 'planet_sec3_ignis',
        beaconId: beaconIgnisId,
        name: 'Ignis Geo-Thermal Outpost',
      }),
    });
    assert(allowIgnisColRes.ok, 'Founding colony on extreme hazard world succeeds with BIO_EXTREMOPHILE_DOMES');
    const ignisColData = await allowIgnisColRes.json();
    assert(ignisColData.colony.name === 'Ignis Geo-Thermal Outpost', 'Ignis Outpost operational');

    // 3.4 Research Spore-Synthesized Crops (BIO_SPORE_AGRICULTURE, 200 BD)
    // Grazer mastery is already Tier 2 from Suite 1
    const resSporeRes = await fetch(`${BASE_URL}/api/xenobiology/research-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', projectId: 'BIO_SPORE_AGRICULTURE' }),
    });
    assert(resSporeRes.ok, 'Researched BIO_SPORE_AGRICULTURE breakthrough');

    // Plant beacon and found colony on Mycelia IV (TERRESTRIAL world producing COMM_RATIONS)
    const probeMyceliaRes = await fetch(`${BASE_URL}/api/planets/planet_sec4_mycelia/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', targetLat: 25.0, targetLng: 150.0, shieldBoost: true }),
    });
    const probeMyceliaData = await probeMyceliaRes.json();
    const beaconMyceliaId = probeMyceliaData.beaconId;

    // Ensure rations
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_RATIONS', quantity: 15 }),
    });

    const foundMyceliaRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        planetId: 'planet_sec4_mycelia',
        beaconId: beaconMyceliaId,
        name: 'Mycelia Biosphere Enclave',
      }),
    });
    assert(foundMyceliaRes.ok, 'Colony founded on Mycelia IV');
    const myceliaCol = (await foundMyceliaRes.json()).colony;
    assert(myceliaCol.commodityId === 'COMM_RATIONS', 'Mycelia outpost produces COMM_RATIONS');
    assert(myceliaCol.productionRatePerMinute >= 12.0, `Spore Agriculture doubled output rate: ${myceliaCol.productionRatePerMinute} units/min`);

    // Turn in 50 specimens (+750 BD) to fund remaining colony research projects
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 50 }),
    });
    await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 50 }),
    });

    // 3.5 Research Cellular Growth Accelerator (BIO_CELLULAR_GROWTH, 250 BD)
    const resCellRes = await fetch(`${BASE_URL}/api/xenobiology/research-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', projectId: 'BIO_CELLULAR_GROWTH' }),
    });
    assert(resCellRes.ok, 'Researched BIO_CELLULAR_GROWTH breakthrough');
    const resCellData = await resCellRes.json();
    assert(resCellData.unlockedProjects.includes('BIO_CELLULAR_GROWTH'), 'BIO_CELLULAR_GROWTH active');

    // 3.6 Research Biomass Fuel Converter (BIO_ORGANIC_REFINERY, 350 BD)
    const resRefineryRes = await fetch(`${BASE_URL}/api/xenobiology/research-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', projectId: 'BIO_ORGANIC_REFINERY' }),
    });
    assert(resRefineryRes.ok, 'Researched BIO_ORGANIC_REFINERY breakthrough');

    // Harvest colony cargo and assert +5 units of COMM_FUEL byproduct
    const harvestRes = await fetch(`${BASE_URL}/api/colonies/${myceliaCol.id}/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(harvestRes.ok, 'POST /api/colonies/:id/harvest returned HTTP 200');
    const harvestData = await harvestRes.json();
    assert(harvestData.bioFuelBonus === 5, 'Harvest credited +5 units of Cryo-Deuterium Bio-Fuel byproduct');
    assert(harvestData.message.includes('Bio-Fuel'), 'Harvest transaction message mentions Bio-Fuel');

    // Check ship cargo for COMM_FUEL
    const labFuelCheck = await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`);
    assert(labFuelCheck.ok, 'Lab status after harvest verified');
    console.log('  Targeted Colony Genetic Breakthroughs verified.\n');

    // ----------------------------------------------------
    // Test Suite 4: Tactical Bio-Synthesis & Combat Stims
    // ----------------------------------------------------
    console.log('--- Test Suite 4: Tactical Bio-Synthesis & Combat Stims ---');

    // 4.1 Deposit 10 specimens and 1000 credits
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 10 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', credits: 1000 }),
    });

    // 4.2 Synthesize Adrenal Combat Stim (STIM_ADRENAL_SURGE, 2 specimens + 50 CR)
    const synthStimRes = await fetch(`${BASE_URL}/api/xenobiology/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', itemId: 'STIM_ADRENAL_SURGE' }),
    });
    assert(synthStimRes.ok, 'POST /api/xenobiology/synthesize (STIM_ADRENAL_SURGE) returned HTTP 200');
    const synthStimData = await synthStimRes.json();
    assert(synthStimData.success === true, 'Synthesis marked success: true');
    assert(synthStimData.item.id === 'STIM_ADRENAL_SURGE', 'Synthesized STIM_ADRENAL_SURGE');

    // Check specimens remaining (10 - 2 = 8)
    const labAfterStim = await (await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`)).json();
    assert(labAfterStim.specimensInHold === 8, 'Ship hold decremented to 8 specimens');

    // 4.3 Activate Combat Stim buff
    const useStimRes = await fetch(`${BASE_URL}/api/xenobiology/use-stim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', stimId: 'STIM_ADRENAL_SURGE' }),
    });
    assert(useStimRes.ok, 'POST /api/xenobiology/use-stim returned HTTP 200');
    const useStimData = await useStimRes.json();
    assert(useStimData.success === true, 'Stim activation marked success: true');
    assert(useStimData.stimId === 'STIM_ADRENAL_SURGE', 'Active stim is STIM_ADRENAL_SURGE');
    assert(useStimData.buff.speedBoost === 0.35, 'Stim provides +35% speed boost');
    assert(useStimData.buff.weaponCooldownReduction === 0.30, 'Stim provides -30% weapon cooldown');

    // Check lab telemetry reports active stim
    const labActiveStim = await (await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`)).json();
    assert(labActiveStim.activeStims.length >= 1, 'Lab telemetry reports 1 active stim');
    assert(labActiveStim.activeStims[0].stimId === 'STIM_ADRENAL_SURGE', 'Active stim in lab is STIM_ADRENAL_SURGE');

    // 4.4 Synthesize Chitinous Bio-Hull Nanites (COATING_BIO_REGEN, 4 specimens + 100 CR)
    const synthCoatingRes = await fetch(`${BASE_URL}/api/xenobiology/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', itemId: 'COATING_BIO_REGEN' }),
    });
    assert(synthCoatingRes.ok, 'Synthesized COATING_BIO_REGEN');
    const labAfterCoating = await (await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`)).json();
    assert(labAfterCoating.unlockedProjects.includes('COATING_BIO_REGEN'), 'COATING_BIO_REGEN permanently unlocked');
    assert(labAfterCoating.specimensInHold === 4, 'Ship hold decremented to 4 specimens (8 - 4 = 4)');

    // 4.5 Synthesize Bio-Catalyzed Deuterium Enzymes (ENZYME_BIO_FUEL, 2 specimens + 25 CR)
    // Set ship fuel to 50
    await fetch(`${BASE_URL}/api/player/ship/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'acc_sol_captain', fuel: 50.0 }),
    });

    const synthFuelRes = await fetch(`${BASE_URL}/api/xenobiology/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', itemId: 'ENZYME_BIO_FUEL' }),
    });
    assert(synthFuelRes.ok, 'Synthesized ENZYME_BIO_FUEL');

    // Verify ship fuel is now 75.0 (50.0 + 25.0)
    const playerShipRes = await fetch(`${BASE_URL}/api/player/ship?playerId=acc_sol_captain`);
    assert(playerShipRes.ok, 'GET /api/player/ship returned HTTP 200');
    const playerShipData = await playerShipRes.json();
    assert(playerShipData.ship.fuel === 75.0, `Ship fuel increased to 75.0 (was 50.0): actual ${playerShipData.ship.fuel}`);
    console.log('  Tactical Bio-Synthesis & Combat Stims verified.\n');

    // ----------------------------------------------------
    // Test Suite 5: Dual-Utility Biomass Economy
    // ----------------------------------------------------
    console.log('--- Test Suite 5: Dual-Utility Biomass Economy ---');

    // 5.1 Deposit 10 fresh biological specimens into hold
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 10 }),
    });
    await fetch(`${BASE_URL}/api/player/debug-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', credits: 1000 }),
    });

    // 5.2 Branch A: Open Market Commerce
    // Sell 5 specimens at Port Aegis Commodity Exchange (PORT_AEGIS_01)
    const sellMarketRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'acc_sol_captain',
        commodityId: 'COMM_BIO_SPECIMENS',
        quantity: 5,
        type: 'SELL',
      }),
    });
    assert(sellMarketRes.ok, 'POST /api/ports/PORT_AEGIS_01/trade (5x COMM_BIO_SPECIMENS SELL) returned HTTP 200');
    const sellMarketData = await sellMarketRes.json();
    assert(sellMarketData.success === true, 'Market sale marked success: true');
    assert(sellMarketData.totalCredits > 0, `Earned ${sellMarketData.totalCredits} Credits from raw specimen sale`);
    assert(sellMarketData.newCredits > 1000, `Player credits increased to ${sellMarketData.newCredits} CR`);

    // Verify 5 specimens remain in cargo hold
    const labMidEconomy = await (await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`)).json();
    assert(labMidEconomy.specimensInHold === 5, '5 specimens remain in cargo hold for research');

    // 5.3 Branch B: Laboratory Research Remittance
    // Turn in the remaining 5 specimens at the Xenobiology Lab
    const labBioBefore = labMidEconomy.bioDataPoints;
    const submitLabRes = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 5 }),
    });
    assert(submitLabRes.ok, 'POST /api/xenobiology/submit-specimens (5x specimens) returned HTTP 200');
    const submitLabData = await submitLabRes.json();
    assert(submitLabData.bioDataAwarded === 75, 'Awarded exactly 75 Bio-Data points (5 * 15 BD)');
    assert(submitLabData.currentBioData === labBioBefore + 75, 'Bio-Data total updated');

    // Verify cargo hold is now 0
    const labEndEconomy = await (await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`)).json();
    assert(labEndEconomy.specimensInHold === 0, 'Ship hold completely clear (5 sold + 5 researched = 10 total)');
    console.log('  Dual-Utility Biomass Economy (Market vs Lab) verified.\n');

    // ----------------------------------------------------
    // Test Summary
    // ----------------------------------------------------
    console.log('========================================================================');
    console.log(`  ALL DAY 29 TEST SUITES COMPLETED: ${passed} / ${total} ASSERTIONS PASSED`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ Unhandled exception during Day 29 test run:', err);
    process.exit(1);
  }
}

runDay29Tests();

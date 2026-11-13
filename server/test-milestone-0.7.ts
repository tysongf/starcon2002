const BASE_URL = 'http://localhost:3000';

async function runMilestone07GrandCapstone() {
  console.log('================================================================================');
  console.log('  MILESTONE 0.7 GRAND CAPSTONE: THE DEEP FRONTIER SINGLE UNIFIED ODYSSEY');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Capstone assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 0: Complete Environmental Baseline Reset
    // -------------------------------------------------------------------------
    console.log('--- Phase 0: Baseline Reset & Subsystem Initialization ---');
    const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(baseRes.ok, 'Player baseline state reset returned HTTP 200');

    const resetFaunaRes = await fetch(`${BASE_URL}/api/planets/debug-reset-fauna`, { method: 'POST' });
    assert(resetFaunaRes.ok, 'Fauna species catalog and landers reset returned HTTP 200');

    const resetSurveyRes = await fetch(`${BASE_URL}/api/player/debug-reset-survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(resetSurveyRes.ok, 'Planetary survey beacons and colonies reset returned HTTP 200');

    const resetLabRes = await fetch(`${BASE_URL}/api/xenobiology/debug-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(resetLabRes.ok, 'Xenobiology research consoles and gene data reset returned HTTP 200');

    // Provision fresh Vanguard Mk.I lander chassis for outfitting
    const buyLanderRes = await fetch(`${BASE_URL}/api/shipyard/lander/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(buyLanderRes.ok, 'Purchased fresh Vanguard Mk.I exploration lander chassis at shipyard');
    console.log('  Baseline reset cleanly.\n');

    // -------------------------------------------------------------------------
    // Phase 1: Spaceport Shipyard Lander Outfitting & Module Fitting
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Shipyard Lander Outfitting & Module Fitting ---');
    const modCatalogRes = await fetch(`${BASE_URL}/api/shipyard/lander/modules`);
    assert(modCatalogRes.ok, 'GET /api/shipyard/lander/modules returned HTTP 200');
    const modCatalog = await modCatalogRes.json();
    assert(modCatalog.modules.length === 4, 'Catalog contains 4 specialized lander outfitting modules');

    // 1.1 Equip Thermal Plating for Volcanic biomes
    const eqThermal = await fetch(`${BASE_URL}/api/shipyard/lander/equip-module`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        slot: 'thermal',
        moduleId: 'MOD_THERMAL_PLATING',
      }),
    });
    assert(eqThermal.ok, 'Equipped MOD_THERMAL_PLATING into thermal module bay');

    // 1.2 Equip Ion Dissipator for Electrical/Storm biomes
    const eqElectrical = await fetch(`${BASE_URL}/api/shipyard/lander/equip-module`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        slot: 'electrical',
        moduleId: 'MOD_ION_DISSIPATOR',
      }),
    });
    assert(eqElectrical.ok, 'Equipped MOD_ION_DISSIPATOR into electrical grounding bay');

    // 1.3 Equip Expanded Bio Bay for deep expedition cargo capacity
    const eqCargo = await fetch(`${BASE_URL}/api/shipyard/lander/equip-module`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        slot: 'cargo',
        moduleId: 'MOD_EXPANDED_BIO_BAY',
      }),
    });
    assert(eqCargo.ok, 'Equipped MOD_EXPANDED_BIO_BAY into auxiliary cargo bay');

    // 1.4 Validate outfitting telemetry
    const landerStatusRes = await fetch(`${BASE_URL}/api/shipyard/lander/status?accountId=acc_sol_captain`);
    assert(landerStatusRes.ok, 'GET /api/shipyard/lander/status returned HTTP 200');
    const landerStatus = await landerStatusRes.json();
    assert(landerStatus.hasActiveLander === true, 'Pilot possesses active exploration lander chassis');
    assert(landerStatus.lander.cargo_capacity === 40, 'Lander cargo hold expanded from 25 -> 40 units');
    assert(landerStatus.lander.fitted_modules.thermal === 'MOD_THERMAL_PLATING', 'Thermal bay fitted with Ablative Plating');
    assert(landerStatus.lander.fitted_modules.electrical === 'MOD_ION_DISSIPATOR', 'Electrical bay fitted with Ion Dissipator');
    console.log('  Modular lander outfitting verified.\n');

    // -------------------------------------------------------------------------
    // Phase 2: Orbital Descent into Extreme Hazard Biome (Ignis Tartarus)
    // -------------------------------------------------------------------------
    console.log('--- Phase 2: Orbital Descent into Extreme Hazard Biome (Ignis Tartarus) ---');
    const ignisHazardsRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/hazards`);
    assert(ignisHazardsRes.ok, 'GET /api/planets/planet_sec3_ignis/hazards returned HTTP 200');
    const ignisHazards = await ignisHazardsRes.json();
    assert(ignisHazards.thermalLevel === 3, 'Ignis classified as Extreme Thermal Level 3 Volcanic Inferno');

    // Deploy lander from orbit
    const deployRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/lander/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(deployRes.ok, 'POST /api/planets/planet_sec3_ignis/lander/deploy returned HTTP 200');
    const deployData = await deployRes.json();
    assert(deployData.success === true, 'Surface lander deployed successfully');
    assert(deployData.session.planetId === 'planet_sec3_ignis', 'Session synchronized to Ignis Tartarus');
    assert(deployData.session.lander.cargoCapacity === 40, 'Surface simulation initialized with 40-unit cargo hold');
    assert(deployData.session.lander.fittedModules.thermal === 'MOD_THERMAL_PLATING', 'Thermal Plating active in surface session');
    assert(deployData.session.fauna.length === 2, 'Session seeded with 2 standard species (grazer + carnivore)');
    assert(deployData.session.titans.length === 1, 'Session seeded with 1 procedural Apex Titan');
    const ignisTitan = deployData.session.titans[0];
    assert(ignisTitan.species_name.includes('Magma Behemoth'), 'Apex Titan identified as Ignis Magma Behemoth');
    assert(ignisTitan.lair_name === 'Molten Caldera Lair', 'Titan anchored to Molten Caldera Lair');
    assert(ignisTitan.stun_hits_required === 3, 'Titan requires 3 rapid stun blaster hits');
    console.log('  Orbital deployment and hazard telemetry validated.\n');

    // -------------------------------------------------------------------------
    // Phase 3: Indigenous Fauna & Apex Titan Subjugation
    // -------------------------------------------------------------------------
    console.log('--- Phase 3: Indigenous Fauna & Apex Titan Subjugation ---');

    // 3.1 First Stun Hit -> Enrages Titan
    const hit1Res = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/lander/titan-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', speciesId: ignisTitan.id }),
    });
    assert(hit1Res.ok, 'Hit 1 on Titan registered HTTP 200');
    const hit1 = await hit1Res.json();
    assert(hit1.hits === 1, 'Recorded stun hit 1/3');
    assert(hit1.isEnraged === true, 'Titan entered ENRAGED state (+55% speed, +50% attack damage)');
    assert(hit1.isStunned === false, 'Titan resists single-shot tranquilizer');

    // 3.2 Second Stun Hit -> Maintains Enrage
    const hit2Res = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/lander/titan-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', speciesId: ignisTitan.id }),
    });
    assert(hit2Res.ok, 'Hit 2 on Titan registered HTTP 200');
    const hit2 = await hit2Res.json();
    assert(hit2.hits === 2, 'Recorded stun hit 2/3');
    assert(hit2.isEnraged === true, 'Titan remains enraged');

    // 3.3 Third Stun Hit -> Subdues Titan into 16s Stun
    const hit3Res = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/lander/titan-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', speciesId: ignisTitan.id }),
    });
    assert(hit3Res.ok, 'Hit 3 on Titan registered HTTP 200');
    const hit3 = await hit3Res.json();
    assert(hit3.hits === 3, 'Recorded stun hit 3/3 (threshold met)');
    assert(hit3.isStunned === true, 'Titan SUBDUED and immobilized');
    assert(hit3.isEnraged === false, 'Enrage aura dissipated');
    assert(hit3.stunDuration === 16.0, 'Titan tranquilized for full 16.0 seconds');
    console.log('  Apex Titan subjugation and enrage physics verified.\n');

    // -------------------------------------------------------------------------
    // Phase 4: Mid-Mission Cargo Stashing at Orbital Rendezvous Beacon
    // -------------------------------------------------------------------------
    console.log('--- Phase 4: Mid-Mission Cargo Stashing at Orbital Rendezvous Beacon ---');
    const stashPayload1 = {
      accountId: 'acc_sol_captain',
      mineralsHarvested: [
        { name: 'Plutonium Isotopes', quantity: 12, commodityId: 'COMM_FUEL' },
      ],
      bioSamplesHarvested: [
        {
          speciesId: ignisTitan.id,
          name: ignisTitan.species_name,
          quantity: 1,
          bioUnits: 85,
          speciesClass: 'CARNIVORE',
        },
      ],
      hullRemaining: 85,
      fuelRemaining: 30,
    };

    const stashRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/lander/stash-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stashPayload1),
    });
    assert(stashRes.ok, 'POST /api/planets/planet_sec3_ignis/lander/stash-cargo returned HTTP 200');
    const stashData = await stashRes.json();
    assert(stashData.success === true, 'Transporter beam stashed cargo to mothership hold');
    assert(stashData.stashedMinerals === 12, 'Stashed 12 mineral units');
    assert(stashData.stashedBioUnits === 85, 'Stashed 85 biological units from Titan specimen');
    assert(stashData.fuelBonus === 25.0, 'Awarded +25.0 fuel replenishment bonus');
    assert(stashData.lander.fuel === 55, 'Lander fuel refueled from 30 -> 55 units');
    assert(stashData.lander.is_active === true, 'Lander remains ACTIVE on surface for continuous sortie');
    console.log('  Mid-mission stashing and continuous expedition loop verified.\n');

    // -------------------------------------------------------------------------
    // Phase 5 & 6: Continuous Sortie, Final Mineral Recovery & Orbital Return
    // -------------------------------------------------------------------------
    console.log('--- Phase 5 & 6: Continuous Sortie & Final Orbital Recovery ---');
    // Sortie continues: harvest additional titanium and 2 pyrite grazer specimens
    const finalRecoveryPayload = {
      accountId: 'acc_sol_captain',
      mineralsHarvested: [
        { name: 'Superdense Titanium', quantity: 8, commodityId: 'COMM_ALLOY' },
      ],
      bioSamplesHarvested: [
        {
          speciesId: 'fauna_ignis_grazer_01',
          name: 'Pyrite Chit-Beetle',
          quantity: 2,
          bioUnits: 20,
          speciesClass: 'GRAZER',
        },
      ],
      hullRemaining: 80,
      fuelRemaining: 35,
    };

    const recoverRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/lander/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalRecoveryPayload),
    });
    assert(recoverRes.ok, 'POST /api/planets/planet_sec3_ignis/lander/recover returned HTTP 200');
    const recoverData = await recoverRes.json();
    assert(recoverData.success === true, 'Lander docked with ship in synchronous orbit');
    assert(recoverData.totalMinerals === 8, 'Credited final 8 mineral units');
    assert(recoverData.totalBioUnits === 20, 'Credited final 20 bio units');

    // Verify cumulative hold on market console
    const marketCheck = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market`);
    assert(marketCheck.ok, 'GET /api/ports/PORT_AEGIS_01/market returned HTTP 200');
    const marketData = await marketCheck.json();
    const fuelItem = marketData.hold.cargo.find((c: any) => c.commodity_id === 'COMM_FUEL');
    const alloyItem = marketData.hold.cargo.find((c: any) => c.commodity_id === 'COMM_ALLOY');
    const bioItem = marketData.hold.cargo.find((c: any) => c.commodity_id === 'COMM_BIO_SPECIMENS');

    assert(!!fuelItem && fuelItem.quantity >= 12, 'Stashed Plutonium safely stored as COMM_FUEL (12+ units)');
    assert(!!alloyItem && alloyItem.quantity >= 8, 'Recovered Titanium safely stored as COMM_ALLOY (8+ units)');
    assert(!!bioItem && bioItem.quantity >= 3, 'Cumulative specimens securely stored (1 Titan + 2 Grazers = 3)');
    console.log('  Cumulative multi-cycle expedition yield verified in ship hold.\n');

    // -------------------------------------------------------------------------
    // Phase 7: Xenobiology Lab Turn-In, Gene Mastery & Biosphere Tier Upgrades
    // -------------------------------------------------------------------------
    console.log('--- Phase 7: Xenobiology Lab Turn-In & Biosphere Tier Upgrades ---');
    const labInitRes = await fetch(`${BASE_URL}/api/xenobiology/lab?accountId=acc_sol_captain`);
    assert(labInitRes.ok, 'GET /api/xenobiology/lab returned HTTP 200');
    const labInit = await labInitRes.json();
    assert(labInit.specimensInHold >= 3, 'Xenobiology Lab console detects 3 specimens in cargo hold');

    // Turn in 3 specimens for Bio-Data
    const submitRes = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 3 }),
    });
    assert(submitRes.ok, 'POST /api/xenobiology/submit-specimens returned HTTP 200');
    const submitData = await submitRes.json();
    assert(submitData.success === true, 'Turned in specimens to Xenobiology Research Consoles');
    assert(submitData.bioDataAwarded === 45, 'Awarded 45 Bio-Data points (3 specimens * 15 BD)');

    // Submit additional specimens to reach Biosphere Tier 2 (requires 100 BD)
    // Deposit 5 specimens and turn in
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 5 }),
    });
    const submitExtra = await fetch(`${BASE_URL}/api/xenobiology/submit-specimens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', quantity: 5 }),
    });
    const submitExtraData = await submitExtra.json();
    assert(submitExtraData.currentBioData >= 100, 'Bio-Data reserves reached 100+ BD');

    // Upgrade Biosphere to Tier 2
    const upBioRes = await fetch(`${BASE_URL}/api/xenobiology/upgrade-biosphere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(upBioRes.ok, 'POST /api/xenobiology/upgrade-biosphere returned HTTP 200');
    const upBioData = await upBioRes.json();
    assert(upBioData.success === true, 'Upgraded to Biosphere Tier 2 (Enriched Soil & Micro-Flora)');
    assert(upBioData.newTier.tier === 2, 'Biosphere Tier is 2');
    assert(upBioData.newTier.moraleBonus === 0.10, 'Biosphere Tier 2 grants +10% colony morale bonus');
    assert(upBioData.newTier.taxBonus === 0.15, 'Biosphere Tier 2 grants +15% colony tax revenue bonus');
    console.log('  Xenobiology gene sequencing and Biosphere Tier 2 verified.\n');

    // -------------------------------------------------------------------------
    // Phase 8: Extremophile Colony Genetic Breakthroughs
    // -------------------------------------------------------------------------
    console.log('--- Phase 8: Extremophile Colony Genetic Breakthroughs ---');

    // 8.1 Plant probe beacon on Ignis Tartarus
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

    // 8.2 Founding without Extremophile Bio-Domes is rejected
    const badColonyRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        planetId: 'planet_sec3_ignis',
        beaconId: beaconIgnisId,
        name: 'Ignis Prime Outpost',
      }),
    });
    assert(badColonyRes.status === 400, 'Founding colony on extreme volcanic world rejected without Bio-Domes (HTTP 400)');
    const badColonyData = await badColonyRes.json();
    assert(badColonyData.error.includes('HAZARD_ENVIRONMENT_UNSUITABLE'), 'Error specifies hazardous environment unsuitable for human life');

    // Fund breakthroughs by submitting 50 specimens (+750 BD)
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

    // 8.3 Research BIO_EXTREMOPHILE_DOMES
    const resDomes = await fetch(`${BASE_URL}/api/xenobiology/research-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        projectId: 'BIO_EXTREMOPHILE_DOMES',
      }),
    });
    assert(resDomes.ok, 'Researched BIO_EXTREMOPHILE_DOMES breakthrough');

    // 8.4 Re-found colony on Ignis Tartarus -> Now succeeds!
    const goodColonyRes = await fetch(`${BASE_URL}/api/colonies/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        planetId: 'planet_sec3_ignis',
        beaconId: beaconIgnisId,
        name: 'Ignis Prime Outpost',
      }),
    });
    assert(goodColonyRes.ok, 'Founding colony on extreme volcanic world succeeds with Bio-Domes (HTTP 200)');
    const goodColonyData = await goodColonyRes.json();
    assert(goodColonyData.success === true, 'Ignis Prime Outpost established successfully');
    const ignisColonyId = goodColonyData.colony.id;

    // 8.5 Verify colony benefits from Biosphere Tier 2 scaling
    const colStatusRes = await fetch(`${BASE_URL}/api/colonies/${ignisColonyId}`);
    assert(colStatusRes.ok, 'GET /api/colonies/:id returned HTTP 200');
    const colStatus = await colStatusRes.json();
    assert(colStatus.colony.biosphereTier === 2, 'Colony inherits global Biosphere Tier 2');
    assert(colStatus.colony.biosphereMoraleBonus === 0.10, 'Colony reflects +10% morale boost');
    assert(colStatus.colony.maxPopulation === 625, 'Max population scaled by 1.25x (500 -> 625)');

    // 8.6 Research BIO_ORGANIC_REFINERY and Harvest Bio-Fuel
    const resRefinery = await fetch(`${BASE_URL}/api/xenobiology/research-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        projectId: 'BIO_ORGANIC_REFINERY',
      }),
    });
    assert(resRefinery.ok, 'Researched BIO_ORGANIC_REFINERY breakthrough');

    const harvestRes = await fetch(`${BASE_URL}/api/colonies/${ignisColonyId}/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(harvestRes.ok, 'POST /api/colonies/:id/harvest returned HTTP 200');
    const harvestData = await harvestRes.json();
    assert(harvestData.success === true, 'Harvested outpost resources');
    assert(harvestData.bioFuelBonus === 5, 'Bio-Refinery yielded +5 Cryo-Deuterium Bio-Fuel byproduct');
    console.log('  Extremophile colony breakthroughs and bio-refinery harvest verified.\n');

    // -------------------------------------------------------------------------
    // Phase 9: Tactical Combat Stim Synthesis & Port Market Biomass Sale
    // -------------------------------------------------------------------------
    console.log('--- Phase 9: Tactical Combat Stim Synthesis & Port Market Biomass Sale ---');

    // Deposit 6 specimens for synthesis and market
    await fetch(`${BASE_URL}/api/player/debug-cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', commodityId: 'COMM_BIO_SPECIMENS', quantity: 6 }),
    });

    // 9.1 Synthesize STIM_ADRENAL_SURGE
    const synthRes = await fetch(`${BASE_URL}/api/xenobiology/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        itemId: 'STIM_ADRENAL_SURGE',
      }),
    });
    assert(synthRes.ok, 'POST /api/xenobiology/synthesize (STIM_ADRENAL_SURGE) returned HTTP 200');
    const synthData = await synthRes.json();
    assert(synthData.success === true, 'Synthesized Adrenal Surge combat stimulant');

    // 9.2 Activate Stimulant in Shipboard Systems
    const useStimRes = await fetch(`${BASE_URL}/api/xenobiology/use-stim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        stimId: 'STIM_ADRENAL_SURGE',
      }),
    });
    assert(useStimRes.ok, 'POST /api/xenobiology/use-stim returned HTTP 200');
    const useStimData = await useStimRes.json();
    assert(useStimData.success === true, 'Adrenal Surge stimulant engaged');
    assert(useStimData.buff.speedBoost === 0.35, 'Stimulant applies +35% sublight speed boost');
    assert(useStimData.buff.weaponCooldownReduction === 0.30, 'Stimulant applies -30% weapon cooldown reduction');

    // 9.3 Sell surplus biomass on Aegis Terminal Market
    const tradeRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'acc_sol_captain',
        commodityId: 'COMM_BIO_SPECIMENS',
        quantity: 2,
        type: 'SELL',
      }),
    });
    assert(tradeRes.ok, 'POST /api/ports/PORT_AEGIS_01/trade (SELL COMM_BIO_SPECIMENS) returned HTTP 200');
    const tradeData = await tradeRes.json();
    assert(tradeData.success === true, 'Surplus alien biomass sold on spaceport commodity market');
    assert(tradeData.totalCredits > 0, 'Credited bounty into pilot treasury');
    console.log('  Combat stim synthesis and dual-utility biomass economy verified.\n');

    // -------------------------------------------------------------------------
    // Phase 10: Multi-System Zero-Regression Verification
    // -------------------------------------------------------------------------
    console.log('--- Phase 10: Multi-System Integrity Verification ---');
    const finalShipRes = await fetch(`${BASE_URL}/api/player/ship?accountId=acc_sol_captain`);
    assert(finalShipRes.ok, 'GET /api/player/ship returned HTTP 200');
    const finalShip = await finalShipRes.json();
    assert(finalShip.ship.fuel > 0, 'Mothership remains fueled and combat ready');

    const finalFaunaRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/fauna`);
    const finalFauna = await finalFaunaRes.json();
    assert(finalFauna.count === 2, 'Standard fauna catalog strictly preserves canonical species count');

    const finalTitanRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/fauna/titans`);
    const finalTitans = await finalTitanRes.json();
    assert(finalTitans.count === 1, 'Titans catalog preserves 1 Apex Titan');
    assert(finalTitans.titans[0].is_apex === true, 'Titan flagged is_apex = true');
    console.log('  Multi-system integrity and backward compatibility verified.\n');

    console.log('================================================================================');
    console.log(`  GRAND CAPSTONE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('  MILESTONE 0.7: THE DEEP FRONTIER FULLY VERIFIED & ACHIEVED!');
    console.log('================================================================================\n');
  } catch (err) {
    console.error('Fatal failure in Milestone 0.7 Grand Capstone:', err);
    process.exit(1);
  }
}

runMilestone07GrandCapstone();

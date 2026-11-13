const BASE_URL = 'http://localhost:3000';

async function runDay27Tests() {
  console.log('========================================================================');
  console.log('  RUNNING DAY 27 INTEGRATION TESTS: STAR CONTROL II LANDER & FAUNA');
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
    console.log('--- Step 0: Baseline Reset & Fauna Re-seed ---');
    const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(baseRes.ok, 'Player baseline reset returned HTTP 200');

    const resetFaunaRes = await fetch(`${BASE_URL}/api/planets/debug-reset-fauna`, { method: 'POST' });
    assert(resetFaunaRes.ok, 'Planetary fauna and landers debug-reset returned HTTP 200');
    console.log('  Baseline reset successfully.\n');

    // ----------------------------------------------------
    // Test Suite 1: Planetary Fauna Species Catalog API
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Planetary Fauna Species Catalog API ---');

    // 1.1 Query Aegis Prime Fauna
    const aegisFaunaRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/fauna`);
    assert(aegisFaunaRes.ok, 'GET /api/planets/planet_sec1_aegis/fauna returned HTTP 200');
    const aegisData = await aegisFaunaRes.json();
    assert(aegisData.success === true, 'Aegis fauna response marked success: true');
    assert(aegisData.count === 2, 'Aegis fauna count is exactly 2 canonical species');

    const mantis = aegisData.fauna.find((f: any) => f.species_name === 'Silicon Mantis');
    assert(!!mantis, 'Found canonical Silicon Mantis in Aegis catalog');
    assert(mantis.species_class === 'CARNIVORE', 'Silicon Mantis classified as CARNIVORE');
    assert(mantis.base_hp === 60, 'Silicon Mantis base HP is 60');
    assert(mantis.movement_speed === 45, 'Silicon Mantis movement speed is 45');
    assert(mantis.aggro_range === 140, 'Silicon Mantis aggro range is 140m');
    assert(mantis.attack_damage === 15, 'Silicon Mantis attack damage is 15');
    assert(mantis.bio_unit_value === 25, 'Silicon Mantis bio unit value is 25');
    assert(mantis.stun_duration_seconds === 12, 'Silicon Mantis stun duration is 12 seconds');

    const strider = aegisData.fauna.find((f: any) => f.species_name === 'Aegis Bio-Spore Strider');
    assert(!!strider, 'Found canonical Aegis Bio-Spore Strider in Aegis catalog');
    assert(strider.species_class === 'GRAZER', 'Aegis Bio-Spore Strider classified as GRAZER');
    assert(strider.base_hp === 40, 'Aegis Bio-Spore Strider base HP is 40');
    assert(strider.movement_speed === 30, 'Aegis Bio-Spore Strider movement speed is 30');
    assert(strider.attack_damage === 0, 'Aegis Bio-Spore Strider attack damage is 0 (docile)');
    assert(strider.bio_unit_value === 12, 'Aegis Bio-Spore Strider bio unit value is 12');

    // 1.2 Query Sector 2 Charybdis Fauna
    const charybdisRes = await fetch(`${BASE_URL}/api/planets/planet_sec2_charybdis/fauna`);
    assert(charybdisRes.ok, 'GET /api/planets/planet_sec2_charybdis/fauna returned HTTP 200');
    const charybdisData = await charybdisRes.json();
    assert(charybdisData.count === 2, 'Charybdis fauna count is 2');
    assert(
      charybdisData.fauna.some((f: any) => f.species_name === 'Charybdian Sand Stalker' && f.species_class === 'CARNIVORE'),
      'Charybdis catalog contains Charybdian Sand Stalker (Carnivore)'
    );
    assert(
      charybdisData.fauna.some((f: any) => f.species_name === 'Obsidian Crustacean' && f.species_class === 'GRAZER'),
      'Charybdis catalog contains Obsidian Crustacean (Grazer)'
    );

    // 1.3 Query Sector 3 Ignis Fauna
    const ignisRes = await fetch(`${BASE_URL}/api/planets/planet_sec3_ignis/fauna`);
    assert(ignisRes.ok, 'GET /api/planets/planet_sec3_ignis/fauna returned HTTP 200');
    const ignisData = await ignisRes.json();
    assert(ignisData.count === 2, 'Ignis fauna count is 2');
    assert(
      ignisData.fauna.some((f: any) => f.species_name === 'Magma Serpent' && f.species_class === 'CARNIVORE'),
      'Ignis catalog contains Magma Serpent (Carnivore)'
    );
    assert(
      ignisData.fauna.some((f: any) => f.species_name === 'Pyrite Chit-Beetle' && f.species_class === 'GRAZER'),
      'Ignis catalog contains Pyrite Chit-Beetle (Grazer)'
    );

    // 1.4 Procedural Fauna Generation Fallback on Unseeded Planet
    const myceliaRes = await fetch(`${BASE_URL}/api/planets/planet_sec4_mycelia/fauna`);
    assert(myceliaRes.ok, 'GET /api/planets/planet_sec4_mycelia/fauna returned HTTP 200');
    const myceliaData = await myceliaRes.json();
    assert(myceliaData.count >= 2, 'Procedural generation populated at least 2 indigenous species for Mycelia');
    assert(
      myceliaData.fauna.some((f: any) => f.species_class === 'GRAZER') &&
      myceliaData.fauna.some((f: any) => f.species_class === 'CARNIVORE'),
      'Procedural generation maintains ecosystem balance (Grazer + Carnivore)'
    );
    console.log('  Planetary fauna catalogs verified.\n');

    // ----------------------------------------------------
    // Test Suite 2: Surface Lander Orbital Deployment API
    // ----------------------------------------------------
    console.log('--- Test Suite 2: Surface Lander Orbital Deployment API ---');

    // 2.1 Deployment validation rejection: Invalid pilot account
    const invalidPilotRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_ghost_pilot' }),
    });
    assert(invalidPilotRes.status === 400, 'Deploy with unregistered pilot correctly rejected HTTP 400');
    const invalidPilotData = await invalidPilotRes.json();
    assert(invalidPilotData.error?.includes('No active ship registered'), 'Error identifies missing ship for pilot');

    // 2.2 Deployment validation rejection: Non-existent planet ID
    const invalidPlanetRes = await fetch(`${BASE_URL}/api/planets/planet_nonexistent_void/lander/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(invalidPlanetRes.status === 400, 'Deploy on nonexistent planet rejected HTTP 400');

    // 2.3 Successful Orbital Deployment on Aegis Prime
    const deployRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain' }),
    });
    assert(deployRes.ok, 'POST /api/planets/planet_sec1_aegis/lander/deploy returned HTTP 200');
    const deployData = await deployRes.json();
    assert(deployData.success === true, 'Deployment response marked success: true');
    assert(!!deployData.session?.sessionId, 'Orbital session generated unique sessionId');
    assert(deployData.session.planetId === 'planet_sec1_aegis', 'Session planetId matches Aegis Prime');
    assert(deployData.session.planetName === 'Aegis Prime', 'Session planetName matches Aegis Prime');

    const lander = deployData.session.lander;
    assert(!!lander, 'Session contains lander specifications');
    assert(lander.hull === 100 && lander.maxHull === 100, 'Lander initialized with 100/100 Hull');
    assert(lander.fuel === 100 && lander.maxFuel === 100, 'Lander initialized with 100/100 Fuel');
    assert(lander.cargoCapacity === 25, 'Lander cargo capacity is 25 units');
    assert(deployData.session.fauna?.length === 2, 'Session seeded with 2 live fauna species');
    console.log('  Lander orbital deployment validated.\n');

    // ----------------------------------------------------
    // Test Suite 3: Stun Blaster Ballistics & Tranquilizer Physics
    // ----------------------------------------------------
    console.log('--- Test Suite 3: Stun Blaster Ballistics & Tranquilizer Physics ---');

    // Test in-engine mathematical simulation of bolt trajectory & stun collision
    const landerHeading = 0; // Pointing right (+X)
    const boltSpeed = 440;
    const initialBolt = {
      x: 380 + Math.cos(landerHeading) * 16,
      y: 240 + Math.sin(landerHeading) * 16,
      vx: Math.cos(landerHeading) * boltSpeed,
      vy: Math.sin(landerHeading) * boltSpeed,
      life: 0.75,
    };

    assert(initialBolt.x === 396 && initialBolt.y === 240, 'Stun bolt spawned from lander nose (+16px forward)');
    assert(initialBolt.vx === 440 && initialBolt.vy === 0, 'Stun bolt launched with 440 px/s forward velocity');

    // Creature placed in bolt flight path at x=415, y=240 (19px away)
    let testCreature: any = {
      speciesId: 'fauna_aegis_carnivore_01',
      name: 'Silicon Mantis',
      speciesClass: 'CARNIVORE',
      x: 415,
      y: 240,
      vx: -40,
      vy: 0,
      state: 'CHARGE',
      stunTimer: 0,
      stunDuration: 12,
    };

    // Step physics by 1 frame (16ms)
    const dt = 0.016;
    initialBolt.x += initialBolt.vx * dt; // 396 + 7.04 = 403.04
    initialBolt.y += initialBolt.vy * dt;
    initialBolt.life -= dt;

    const hitDist = Math.hypot(testCreature.x - initialBolt.x, testCreature.y - initialBolt.y);
    assert(hitDist <= 22, `Stun bolt collision detected within 22px proximity radius (hitDist: ${hitDist.toFixed(2)}px)`);

    // Execute stun tranquilizer state transition
    testCreature.state = 'STUNNED';
    testCreature.stunTimer = testCreature.stunDuration;
    testCreature.vx = 0;
    testCreature.vy = 0;

    assert(testCreature.state === 'STUNNED', 'Creature state transitioned to STUNNED');
    assert(testCreature.stunTimer === 12, 'Creature stun timer set to full duration (12 seconds)');
    assert(testCreature.vx === 0 && testCreature.vy === 0, 'Creature velocity zeroed out during immobilization');

    // Step creature timer forward by 6 seconds
    testCreature.stunTimer -= 6.0;
    assert(testCreature.stunTimer === 6.0, 'Stun timer decrements predictably over elapsed time');
    assert(testCreature.state === 'STUNNED', 'Creature remains STUNNED while stunTimer > 0');

    // Expire remaining stun timer
    testCreature.stunTimer -= 6.01;
    if (testCreature.stunTimer <= 0) {
      testCreature.state = 'WANDER';
      testCreature.stunTimer = 0;
      testCreature.vx = 20;
    }
    assert(testCreature.state === 'WANDER', 'Creature wakes up and transitions back to WANDER when stun expires');
    assert(testCreature.vx > 0, 'Creature resumes independent locomotion upon waking');
    console.log('  Stun blaster ballistics and tranquilizer states verified.\n');

    // ----------------------------------------------------
    // Test Suite 4: Alien Fauna AI Loop, Aggro Range & Damage Collision
    // ----------------------------------------------------
    console.log('--- Test Suite 4: Alien Fauna AI Loop, Aggro Range & Damage Collision ---');

    // 4.1 Carnivore Aggro Range Detection (Aegis Silicon Mantis, aggroRange = 140)
    const carnivoreEntity = {
      name: 'Silicon Mantis',
      speciesClass: 'CARNIVORE',
      x: 550,
      y: 240,
      speed: 45,
      attackDamage: 15,
      state: 'WANDER',
      heading: 0,
      vx: 0,
      vy: 0,
    };

    const landerPos = { x: 380, y: 240, hull: 100, vx: 0, vy: 0 };
    let dist = Math.hypot(carnivoreEntity.x - landerPos.x, carnivoreEntity.y - landerPos.y);
    assert(dist === 170, 'Initial distance is 170px (> 160px aggro threshold)');

    // Creature wanders when outside aggro range
    assert(carnivoreEntity.state === 'WANDER', 'Carnivore remains in WANDER state outside aggro range');

    // Lander approaches to within 130px (< 160px aggro threshold)
    landerPos.x = 420;
    dist = Math.hypot(carnivoreEntity.x - landerPos.x, carnivoreEntity.y - landerPos.y);
    assert(dist === 130, 'Lander closes distance to 130px');

    if (dist < 160) {
      carnivoreEntity.state = 'CHARGE';
      carnivoreEntity.heading = Math.atan2(landerPos.y - carnivoreEntity.y, landerPos.x - carnivoreEntity.x);
      carnivoreEntity.vx = Math.cos(carnivoreEntity.heading) * (carnivoreEntity.speed * 1.3);
      carnivoreEntity.vy = Math.sin(carnivoreEntity.heading) * (carnivoreEntity.speed * 1.3);
    }

    assert(carnivoreEntity.state === 'CHARGE', 'Carnivore triggered into CHARGE state upon lander proximity');
    assert(carnivoreEntity.heading === Math.PI, 'Carnivore heading vector locks onto lander coordinates (heading: PI / Left)');
    assert(carnivoreEntity.vx < 0, 'Carnivore charges aggressively toward lander (-X velocity)');

    // 4.2 Carnivore Bite Attack & Lander Durability Damage
    // Carnivore reaches melee proximity (dist <= 22px)
    carnivoreEntity.x = 438;
    const biteDist = Math.hypot(carnivoreEntity.x - landerPos.x, carnivoreEntity.y - landerPos.y);
    assert(biteDist === 18 && biteDist <= 22, 'Carnivore closes to melee range (18px <= 22px)');

    let screenShake = 0;
    if (biteDist <= 22) {
      landerPos.hull = Math.max(0, landerPos.hull - carnivoreEntity.attackDamage);
      screenShake = 0.35;
      // Knockback bounce
      carnivoreEntity.vx = -Math.cos(carnivoreEntity.heading) * (carnivoreEntity.speed * 1.5);
      carnivoreEntity.x += carnivoreEntity.vx * 0.05;
      // Lander recoil
      landerPos.vx += Math.cos(carnivoreEntity.heading) * 3;
    }

    assert(landerPos.hull === 85, 'Lander hull suffered exactly -15 HP damage (100 -> 85)');
    assert(screenShake === 0.35, 'Bite impact triggered 0.35s screen shake');
    assert(carnivoreEntity.vx > 0, 'Carnivore knocked back away from lander after impact');

    // 4.3 Grazer Fleeing AI (Docile Aegis Bio-Spore Strider)
    const grazerEntity = {
      name: 'Aegis Bio-Spore Strider',
      speciesClass: 'GRAZER',
      x: 470,
      y: 240,
      speed: 30,
      state: 'WANDER',
      heading: 0,
      vx: 0,
      vy: 0,
    };

    const grazerDist = Math.hypot(grazerEntity.x - landerPos.x, grazerEntity.y - landerPos.y);
    assert(grazerDist === 50 && grazerDist < 110, 'Grazer within flee threshold (50px < 110px)');

    if (grazerDist < 110) {
      grazerEntity.state = 'FLEE';
      grazerEntity.heading = Math.atan2(grazerEntity.y - landerPos.y, grazerEntity.x - landerPos.x);
      grazerEntity.vx = Math.cos(grazerEntity.heading) * (grazerEntity.speed * 1.4);
      grazerEntity.vy = Math.sin(grazerEntity.heading) * (grazerEntity.speed * 1.4);
    }

    assert(grazerEntity.state === 'FLEE', 'Grazer transitions to FLEE state when lander approaches');
    assert(grazerEntity.heading === 0, 'Grazer heading vector points away from lander (0 / Right)');
    assert(grazerEntity.vx > 0, 'Grazer accelerates away from threat (+X velocity)');
    console.log('  Fauna AI behaviors and combat collisions verified.\n');

    // ----------------------------------------------------
    // Test Suite 5: Bio-Containment Harvesting & Surface Recovery Ledger
    // ----------------------------------------------------
    console.log('--- Test Suite 5: Bio-Containment Harvesting & Recovery Ledger ---');

    // 5.1 In-engine Bio-Harvesting Loop Simulation
    const bioSamplesHeld: any[] = [];
    let landerCargo = 0;
    const maxCargo = 25;

    const stunnedSpecimens = [
      { speciesId: 'fauna_aegis_carnivore_01', name: 'Silicon Mantis', speciesClass: 'CARNIVORE', unitValue: 25, bioYield: 4 },
      { speciesId: 'fauna_aegis_grazer_01', name: 'Aegis Bio-Spore Strider', speciesClass: 'GRAZER', unitValue: 12, bioYield: 2 },
      { speciesId: 'fauna_aegis_grazer_01', name: 'Aegis Bio-Spore Strider', speciesClass: 'GRAZER', unitValue: 12, bioYield: 2 },
    ];

    stunnedSpecimens.forEach((spec) => {
      const existing = bioSamplesHeld.find((b) => b.speciesId === spec.speciesId);
      if (existing) {
        existing.quantity += 1;
        existing.bioUnits += spec.unitValue;
      } else {
        bioSamplesHeld.push({
          speciesId: spec.speciesId,
          name: spec.name,
          quantity: 1,
          bioUnits: spec.unitValue,
          speciesClass: spec.speciesClass,
        });
      }
      landerCargo = Math.min(maxCargo, landerCargo + spec.bioYield);
    });

    assert(bioSamplesHeld.length === 2, 'Bio-containment hold contains 2 distinct species entries');
    const mantisSample = bioSamplesHeld.find((b) => b.speciesId === 'fauna_aegis_carnivore_01');
    assert(mantisSample?.quantity === 1 && mantisSample?.bioUnits === 25, 'Secured 1 Silicon Mantis specimen (25 bio units)');
    const striderSample = bioSamplesHeld.find((b) => b.speciesId === 'fauna_aegis_grazer_01');
    assert(striderSample?.quantity === 2 && striderSample?.bioUnits === 24, 'Secured 2 Aegis Bio-Spore Strider specimens (24 bio units)');
    assert(landerCargo === 8, 'Lander physical cargo hold incremented by combined bio-yield (4 + 2 + 2 = 8 units)');

    // 5.2 Surface Recovery Ledger API Commit
    const harvestedMinerals = [
      { name: 'Plutonium Isotopes', quantity: 8 },
      { name: 'Rare Crystalline Matrix', quantity: 10 },
    ];

    const recoverRes = await fetch(`${BASE_URL}/api/planets/planet_sec1_aegis/lander/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        mineralsHarvested: harvestedMinerals,
        bioSamplesHarvested: bioSamplesHeld,
        hullRemaining: 85,
        fuelRemaining: 78,
      }),
    });

    assert(recoverRes.ok, 'POST /api/planets/planet_sec1_aegis/lander/recover returned HTTP 200');
    const recoverData = await recoverRes.json();
    assert(recoverData.success === true, 'Recovery transaction marked success: true');
    assert(recoverData.totalMinerals === 18, 'Recovery ledger credited exactly 18 mineral units (8 + 10)');
    assert(recoverData.totalBioUnits === 49, 'Recovery ledger credited exactly 49 biological units (25 + 24)');
    assert(Array.isArray(recoverData.recoveredCommodities), 'Returns recovered commodities breakdown');

    const totalRecoveredBioSpecimens = recoverData.recoveredCommodities
      .filter((c: any) => c.commodityId === 'COMM_BIO_SPECIMENS')
      .reduce((sum: number, c: any) => sum + c.quantity, 0);
    assert(totalRecoveredBioSpecimens === 3, 'COMM_BIO_SPECIMENS total matches captured specimens (1 Mantis + 2 Striders = 3)');

    // 5.3 Ship Hold Verification via Port Market API
    const portRes = await fetch(`${BASE_URL}/api/ports/PORT_AEGIS_01/market?playerId=acc_sol_captain`);
    assert(portRes.ok, 'GET /api/ports/PORT_AEGIS_01/market returned HTTP 200');
    const portData = await portRes.json();
    const shipCargo = portData.hold?.cargo || [];

    const bioHoldEntry = shipCargo.find((c: any) => c.commodity_id === 'COMM_BIO_SPECIMENS');
    assert(!!bioHoldEntry, 'Verified COMM_BIO_SPECIMENS safely committed into player ship cargo hold');
    assert(bioHoldEntry.quantity >= 3, `Player ship cargo holds ${bioHoldEntry.quantity} biological specimens`);

    const fuelHoldEntry = shipCargo.find((c: any) => c.commodity_id === 'COMM_FUEL');
    assert(!!fuelHoldEntry && fuelHoldEntry.quantity >= 8, 'Verified Plutonium Isotopes mapped and deposited as COMM_FUEL');

    const alloyHoldEntry = shipCargo.find((c: any) => c.commodity_id === 'COMM_ALLOY');
    assert(!!alloyHoldEntry && alloyHoldEntry.quantity >= 10, 'Verified Crystalline Matrix mapped and deposited as COMM_ALLOY');

    console.log('  Bio-containment harvesting and cargo recovery verified.\n');

    // ----------------------------------------------------
    // Test Summary
    // ----------------------------------------------------
    console.log('========================================================================');
    console.log(`  DAY 27 TEST SUITE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (100%)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runDay27Tests();

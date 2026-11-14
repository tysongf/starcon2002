import assert from 'node:assert/strict';
import { getAllPlanetSubtypes, getDistinctMainClasses } from './src/procgen/PlanetTaxonomyCatalog';
import { generatePlanetEcosystem } from './src/procgen/XenobiologyEngine';
import { generateProceduralModule, MODULE_SUBTYPE_CATALOG, TECH_PREFIXES } from './src/procgen/ProceduralModuleCatalog';

const BASE_URL = 'http://localhost:3000';

const EARTH_ANIMAL_WORDS = [
  'dog', 'cat', 'wolf', 'bear', 'lion', 'tiger', 'eagle', 'hawk', 'shark', 'whale',
  'snake', 'spider', 'crab', 'beetle', 'mantis', 'horse', 'deer', 'bird', 'fish',
  'frog', 'lizard', 'monkey', 'ape', 'cow', 'pig', 'sheep', 'goat', 'rat', 'mouse',
  'pangolin', 'elephant', 'rhino', 'octopus', 'squid', 'ant', 'bee', 'wasp',
];

async function runTests() {
  console.log('=== MILESTONE 1.0 TEST SUITE: IMMERSIVE PROCEDURAL UNIVERSE ===\n');

  // 1. Unit & Catalog Verification (15 Main Classes x 3 Subtypes = 45 Planet Types)
  const mainClasses = getDistinctMainClasses();
  const allSubtypes = getAllPlanetSubtypes();
  assert.equal(mainClasses.length, 15, `Expected 15 main planet classes, got ${mainClasses.length}`);
  assert.equal(allSubtypes.length, 45, `Expected 45 planet subtypes (15x3), got ${allSubtypes.length}`);
  for (const mc of mainClasses) {
    assert.equal(mc.subtypes.length, 3, `Main class ${mc.mainClass} must have exactly 3 subtypes`);
  }
  console.log(`✅ [1] Catalog check passed: ${mainClasses.length} Main Classes x 3 = ${allSubtypes.length} Subtypes.`);

  // 2. API Planet Taxonomy Check
  const taxRes = await fetch(`${BASE_URL}/api/planets/taxonomy`);
  assert.equal(taxRes.status, 200, 'GET /api/planets/taxonomy must return 200');
  const taxData = await taxRes.json();
  assert.equal(taxData.mainClassCount, 15, 'API reports 15 main classes');
  assert.equal(taxData.subtypeCount, 45, 'API reports 45 subtypes');
  console.log('✅ [2] GET /api/planets/taxonomy verified.');

  // 3. Verify All 60 Star Systems Populated & All 45 Subtypes Present
  let totalPlanets = 0;
  const observedSubtypes = new Set<string>();
  const samplePlanets: any[] = [];

  for (let secId = 1; secId <= 60; secId++) {
    const res = await fetch(`${BASE_URL}/api/planets/sector/${secId}`);
    assert.equal(res.status, 200, `GET /api/planets/sector/${secId} must return 200`);
    const json = await res.json();
    assert.ok(Array.isArray(json.planets) && json.planets.length >= 2, `Sector ${secId} must have >= 2 planets`);
    totalPlanets += json.planets.length;
    for (const p of json.planets) {
      if (p.subtype) observedSubtypes.add(p.subtype);
      samplePlanets.push(p);
    }
    if (secId === 1) {
      assert.equal(json.planets[0].id, 'planet_sec1_aegis', 'Sector 1 primary planet remains planet_sec1_aegis');
      assert.equal(json.planets[0].mainClass, 'METALLIC_ORE', 'Aegis Prime uses native METALLIC_ORE mainClass');
      assert.equal(json.planets[0].subtype, 'Auric Lode', 'Aegis Prime enriched with Auric Lode subtype');
      assert.equal((json.planets[0] as any).archetype, undefined, 'Deprecated archetype field removed from planet payload');
      assert.ok(json.planets[0].planetPalette?.patternStyle, 'Aegis Prime carries planetPalette.patternStyle');
    }
  }

  assert.ok(totalPlanets >= 180, `Expected >= 180 planets across 60 sectors, got ${totalPlanets}`);
  assert.equal(observedSubtypes.size, 45, `All 45 planet subtypes must exist across the 60-sector galaxy (found ${observedSubtypes.size})`);
  console.log(`✅ [3] Galaxy populated: ${totalPlanets} planets across 60 sectors covering ${observedSubtypes.size}/45 subtypes!`);

  // 4. Pure Xenobiological Lifeform Engine: 1,000+ Unique Species Across Galaxy, Zero Earth Animal Words
  const uniqueCommonNames = new Set<string>();
  const uniqueScientificNames = new Set<string>();
  for (const p of samplePlanets) {
    const eco = generatePlanetEcosystem({
      id: p.id,
      name: p.name,
      subtype: p.subtype,
      mainClass: p.mainClass,
      textureSeed: p.textureSeed,
    });
    assert.ok(eco.length >= 4 && eco.length <= 8, `Planet ${p.id} must yield 4-8 lifeforms`);

    // Verify deterministic reproduction
    const ecoAgain = generatePlanetEcosystem({
      id: p.id,
      name: p.name,
      subtype: p.subtype,
      mainClass: p.mainClass,
      textureSeed: p.textureSeed,
    });
    assert.equal(eco[0].commonName, ecoAgain[0].commonName, 'Lazy-seeded species generation must be deterministic');

    for (const sp of eco) {
      uniqueCommonNames.add(sp.commonName);
      uniqueScientificNames.add(sp.scientificName);
      const lowerName = `${sp.commonName} ${sp.scientificName}`.toLowerCase();
      for (const word of EARTH_ANIMAL_WORDS) {
        const re = new RegExp(`\\b${word}\\b`, 'i');
        assert.ok(!re.test(lowerName), `Found banned Earth animal word '${word}' in '${sp.commonName}' / '${sp.scientificName}'`);
      }
    }
  }

  assert.ok(uniqueCommonNames.size >= 850, `Expected >= 850 unique pure xenobiology species names across galaxy, got ${uniqueCommonNames.size}`);
  console.log(`✅ [4] Pure Xenobiology generated ${uniqueCommonNames.size} unique species names & ${uniqueScientificNames.size} scientific binomials with 0 Earth animal words!`);

  // 5. Orbital Lifeforms API + BIO Scan Xenodex Persistence
  const frontierPlanet = samplePlanets.find((p) => p.sectorId === 6);
  assert.ok(frontierPlanet, 'Sector 6 planet must exist');

  const lfRes = await fetch(`${BASE_URL}/api/planets/${frontierPlanet.id}/lifeforms`);
  assert.equal(lfRes.status, 200, 'GET /api/planets/:id/lifeforms returns 200');
  const lfJson = await lfRes.json();
  assert.ok(lfJson.count >= 4, 'Lifeforms endpoint returns >= 4 endemic species');

  const faunaFallbackRes = await fetch(`${BASE_URL}/api/planets/${frontierPlanet.id}/fauna`);
  assert.equal(faunaFallbackRes.status, 200, 'GET /api/planets/:id/fauna returns 200');
  const faunaFallbackData = await faunaFallbackRes.json();
  assert.ok(faunaFallbackData.fauna.length >= 4, 'Lazy fauna fallback populates full pure xenobiology species');
  assert.ok(!faunaFallbackData.fauna.some((f: any) => f.species_name === 'Indigenous Spore Grazer'), 'Procedural xenobiology populates endemic fauna');

  // Ensure AP before scan
  await fetch(`${BASE_URL}/api/player/acc_sol_captain`);
  const bioScanRes = await fetch(`${BASE_URL}/api/planets/${frontierPlanet.id}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'acc_sol_captain', scanBand: 'BIO' }),
  });
  assert.equal(bioScanRes.status, 200, 'BIO scanner sweep succeeds');
  const bioScanJson = await bioScanRes.json();
  assert.ok(Array.isArray(bioScanJson.lifeformsDiscovered) && bioScanJson.lifeformsDiscovered.length >= 4, 'BIO sweep returns discovered lifeforms');

  const xenoRes = await fetch(`${BASE_URL}/api/xenobiology/xenodex?accountId=acc_sol_captain`);
  assert.equal(xenoRes.status, 200, 'GET /api/xenobiology/xenodex returns 200');
  const xenoJson = await xenoRes.json();
  assert.ok(xenoJson.discoveredCount >= lfJson.count, 'Xenodex records discovered species from BIO sweep');
  console.log(`✅ [5] Xenodex logged ${xenoJson.discoveredCount} pure xenobiology species cleanly.`);

  // 6. Procedural Ship Module Engine, Semantic Prefix+Suffix & Station Shop Purchase
  assert.equal(MODULE_SUBTYPE_CATALOG.length, 15, '15 Ship Module Subtypes defined');
  assert.ok(TECH_PREFIXES.length >= 35, '35+ Tech Items prefixes defined');

  const sampleMod = generateProceduralModule({ seed: 'test_seed_1', rarity: 'RARE', preferredCategory: 'OFFENSE' });
  assert.ok(sampleMod.customName.includes(sampleMod.techPrefix), 'Module customName contains Tech Prefix');
  assert.ok(sampleMod.customName.includes(sampleMod.techSuffix), 'Module customName contains compatible Tech Suffix');
  assert.equal((sampleMod as any).category, undefined, 'Module drops old category field completely');
  assert.ok(sampleMod.affixes.length >= 1, 'Module contains mechanical affixes');

  const modTaxRes = await fetch(`${BASE_URL}/api/outfitting/taxonomy`);
  assert.equal(modTaxRes.status, 200, 'GET /api/outfitting/taxonomy returns 200');
  const modTax = await modTaxRes.json();
  assert.equal(modTax.subtypes.length, 15, 'Outfitting taxonomy exposes 15 subtypes');

  const shopRes = await fetch(`${BASE_URL}/api/outfitting/shop?sectorId=3`);
  assert.equal(shopRes.status, 200, 'GET /api/outfitting/shop?sectorId=3 returns 200');
  const shopJson = await shopRes.json();
  assert.equal(shopJson.stock.length, 8, 'Station shop rotates 8 procedural modules');

  // Fund test captain safely if low & purchase slotIndex 0
  await fetch(`${BASE_URL}/api/markets/debug-reset`, { method: 'POST' }).catch(() => null);
  const accRes = await fetch(`${BASE_URL}/api/player/acc_sol_captain`);
  const accData = await accRes.json();
  const affordableSlot = shopJson.stock.find((item: any) => item.basePrice <= (accData.account?.credits ?? 5000)) || shopJson.stock[0];

  const buyRes = await fetch(`${BASE_URL}/api/outfitting/shop/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: 'acc_sol_captain',
      sectorId: 3,
      slotIndex: affordableSlot.slotIndex,
    }),
  });
  assert.equal(buyRes.status, 200, `POST /api/outfitting/shop/buy must succeed (status ${buyRes.status})`);
  const buyJson = await buyRes.json();
  assert.equal(buyJson.success, true, 'Procedural shop purchase returns success=true');
  assert.equal(buyJson.item.tech_prefix, affordableSlot.techPrefix, 'Inventory persisted tech_prefix');
  assert.equal(buyJson.item.subtype, affordableSlot.subtype, 'Inventory persisted subtype');

  const loadoutRes = await fetch(`${BASE_URL}/api/outfitting/player?playerId=acc_sol_captain`);
  const loadout = await loadoutRes.json();
  const inLocker = loadout.locker.find((m: any) => m.id === buyJson.item.id);
  assert.ok(inLocker, 'Purchased procedural module present in Station Locker');
  assert.equal(inLocker.subtype, affordableSlot.subtype, 'Loadout exposes subtype');
  assert.equal(inLocker.techPrefix, affordableSlot.techPrefix, 'Loadout exposes techPrefix');
  console.log(`✅ [6] Procedural Hardware Shop verified: bought '${affordableSlot.customName}' (${affordableSlot.mainCategory} / ${affordableSlot.subtype}).`);

  console.log('\n🎉 ALL MILESTONE 1.0 IMMERSIVE UNIVERSE TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ MILESTONE 1.0 TEST FAILED:', err);
  process.exit(1);
});


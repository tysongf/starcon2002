import assert from 'node:assert/strict';
import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';
import {
  LANDER_CHASSIS_TIERS,
  computeLanderCrewEffects,
  evaluateGritSurvivalRoll,
} from './src/procgen/LanderCrewCatalog';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const ACC = 'acc_sol_captain';

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('=== MILESTONE 1.6 VERIFICATION: CREWED PLANETARY LANDERS, TIERS & SURVIVAL EJECTION ===');

  // 1. Clean baseline + 4-tier chassis catalog check
  const resetRes = await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  assert.equal(resetRes.status, 200);
  const clearFauna = await api('POST', '/api/planets/debug-reset-fauna', { accountId: ACC });
  assert.equal(clearFauna.status, 200);
  await api('POST', '/api/player/debug-credits', { accountId: ACC, credits: 50000 });

  assert.equal(Object.keys(LANDER_CHASSIS_TIERS).length, 4, 'Must define 4 Lander Chassis Tiers');
  const tiersRes = await api('GET', '/api/shipyard/lander/tiers');
  assert.equal(tiersRes.status, 200);
  assert.equal(tiersRes.data.tiers.length, 4);
  console.log('✓ Clean baseline reset & verified 4-tier lander catalog');

  // 2. Progressive Tier Purchase (Tier 1 -> Tier 2 -> Tier 4 + MOD_EXPANDED_BIO_BAY Scaling)
  const resetStatus = await api('GET', `/api/shipyard/lander/status?accountId=${ACC}`);
  assert.equal(resetStatus.status, 200);
  assert.equal(resetStatus.data.hasActiveLander, false, 'Post debug-reset-fauna should clear active lander');

  const buyT1 = await api('POST', '/api/shipyard/lander/purchase', { accountId: ACC, tier: 1 });
  assert.equal(buyT1.status, 200);
  assert.equal(buyT1.data.lander.tier, 1);
  assert.equal(buyT1.data.lander.crewCapacity, 1);

  const initialStatus = await api('GET', `/api/shipyard/lander/status?accountId=${ACC}`);
  assert.equal(initialStatus.status, 200);
  assert.equal(initialStatus.data.lander.tier, 1);
  assert.equal(initialStatus.data.lander.crew_capacity, 1);

  const buyT2 = await api('POST', '/api/shipyard/lander/purchase', { accountId: ACC, tier: 2 });
  assert.equal(buyT2.status, 200, `Tier 2 purchase failed: ${JSON.stringify(buyT2.data)}`);
  assert.equal(buyT2.data.lander.tier, 2);
  assert.equal(buyT2.data.lander.crewCapacity, 2);
  assert.equal(buyT2.data.lander.maxHull, 140);

  // Fit MOD_EXPANDED_BIO_BAY and verify upgrade to Tier 4 scales cargoCapacity cleanly (72 + 15 = 87)
  const fitBio = await api('POST', '/api/shipyard/lander/equip-module', {
    accountId: ACC,
    slot: 'cargo',
    moduleId: 'MOD_EXPANDED_BIO_BAY',
  });
  assert.equal(fitBio.status, 200);
  assert.equal(fitBio.data.lander.cargoCapacity, 53, 'Tier 2 base cargo 38 + 15 Bio Bay = 53');

  const buyT4 = await api('POST', '/api/shipyard/lander/purchase', { accountId: ACC, tier: 4 });
  assert.equal(buyT4.status, 200);
  assert.equal(buyT4.data.lander.tier, 4);
  assert.equal(buyT4.data.lander.crewCapacity, 4);
  assert.equal(buyT4.data.lander.maxHull, 245);
  assert.equal(buyT4.data.lander.cargoCapacity, 87, 'Tier 4 base cargo 72 + carried-forward Bio Bay 15 = 87');
  console.log('✓ Verified Tier 1->4 purchases, crewCapacity 1->4, and carried-forward cargo module scaling');

  // 3. Seed 4 crew: Geologist (in SHIP_BAY), Biologist, Medic, Diplomat, plus Colony-bound Guard
  const minerSeed = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Geologist'],
    rarity: 'RARE',
    aptitude: 80,
    grit: 72,
    name: 'Dr. Petra Vance',
  });
  const bioSeed = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Biologist'],
    rarity: 'UNCOMMON',
    aptitude: 76,
    grit: 68,
    name: 'Dr. Kael Solis',
  });
  const medicSeed = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Medic'],
    rarity: 'UNCOMMON',
    aptitude: 75,
    grit: 80,
    name: 'Surgeon Mira Orin',
  });
  const dipSeed = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Diplomat'],
    rarity: 'COMMON',
    aptitude: 70,
    grit: 65,
    name: 'Envoy Jonas Wren',
  });
  const colSeed = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Engineer'],
    rarity: 'COMMON',
    aptitude: 60,
    grit: 50,
    name: 'Warden Garrick',
  });

  const minerId = minerSeed.data.crewMember.id;
  const bioId = bioSeed.data.crewMember.id;
  const medicId = medicSeed.data.crewMember.id;
  const dipId = dipSeed.data.crewMember.id;
  const colCrewId = colSeed.data.crewMember.id;

  // Fit Mining Operations Bay Mk.I into B1 and assign Geologist to B1#1 so we test pause/restore behavior
  for (const s of ['H2', 'M2']) {
    await api('POST', '/api/outfitting/unfit', { playerId: ACC, slot: s });
  }
  const buyMineBay = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_BAY_MINING_T1' });
  assert.equal(buyMineBay.status, 200, `Buy mining bay failed: ${JSON.stringify(buyMineBay.data)}`);
  const fitMineBay = await api('POST', '/api/outfitting/fit', { playerId: ACC, itemId: buyMineBay.data.item.id, slot: 'B1' });
  assert.equal(fitMineBay.status, 200, `Fit mining bay failed: ${JSON.stringify(fitMineBay.data)}`);

  const assignBay = await api('POST', '/api/crew/assign', {
    accountId: ACC,
    crewId: minerId,
    assignmentType: 'SHIP_BAY',
    baySlotKey: 'B1#1',
  });
  assert.equal(assignBay.status, 200);
  const rosterBefore = await api('GET', `/api/crew/roster?accountId=${ACC}`);
  const beforeMiningBonus = rosterBefore.data.bonuses?.miningYieldBonus || 0;
  assert.ok(beforeMiningBonus > 0.2, `Ship bay miningYieldBonus + Geologist must exceed hardware base 0.2 (got ${beforeMiningBonus})`);

  // Found colony and assign Warden Garrick to COLONY -> must be blocked from Lander embarkation
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_RATIONS', quantity: 10 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ALLOY', quantity: 60 });
  const beaconRes = await api('POST', '/api/planets/planet_sec1_aegis/probe', {
    accountId: ACC,
    targetLat: 15.0,
    targetLng: -20.0,
    shieldBoost: true,
  });
  assert.equal(beaconRes.status, 200);
  const foundRes = await api('POST', '/api/colonies/found', {
    accountId: ACC,
    planetId: 'planet_sec1_aegis',
    beaconId: beaconRes.data.beaconId,
    name: 'Test Outpost 16',
  });
  assert.equal(foundRes.status, 200);
  const colonyId = foundRes.data.colony.id;
  const assignCol = await api('POST', '/api/crew/assign', {
    accountId: ACC,
    crewId: colCrewId,
    assignmentType: 'COLONY',
    colonyId,
  });
  assert.equal(assignCol.status, 200);

  const blockedDeploy = await api('POST', '/api/planets/planet_sec3_ignis/lander/deploy', {
    accountId: ACC,
    crewIds: [colCrewId],
  });
  assert.equal(blockedDeploy.status, 400, 'Colony-assigned crew must be blocked from embarking on lander');

  const overCapDeploy = await api('POST', '/api/planets/planet_sec3_ignis/lander/deploy', {
    accountId: ACC,
    crewIds: [minerId, bioId, medicId, dipId, colCrewId],
  });
  assert.equal(overCapDeploy.status, 400, 'Manifest exceeding Tier 4 crewCapacity=4 must be rejected');

  // 4. Valid 4-crew Drop on hazardous planet_sec3_ignis
  const deployRes = await api('POST', '/api/planets/planet_sec3_ignis/lander/deploy', {
    accountId: ACC,
    crewIds: [minerId, bioId, medicId, dipId],
  });
  assert.equal(deployRes.status, 200, `Deploy failed: ${JSON.stringify(deployRes.data)}`);
  const session = deployRes.data.session;
  assert.equal(session.embarkedCrew.length, 4);
  assert.ok(session.crewEffects.mineralYieldMult > 1.05, 'Geologist must boost mineralYieldMult');
  assert.ok(session.crewEffects.bioYieldMult > 1.05, 'Biologist must boost bioYieldMult');
  assert.ok(session.crewEffects.passiveHullRegenPerSec > 0, 'Medic must enable passiveHullRegenPerSec');
  assert.ok(session.crewEffects.hazardPayDiscount > 0, 'Diplomat must grant hazardPayDiscount');
  assert.ok(session.crewEffects.activeAbilities.length >= 2, 'Embarked crew must populate [1]-[4] active abilities');

  // Verify Ship Bay Geologist is paused while assignmentType === 'LANDER'
  const rosterDuring = await api('GET', `/api/crew/roster?accountId=${ACC}`);
  const deployedMiner = rosterDuring.data.crew.find((c: any) => c.id === minerId);
  assert.equal(deployedMiner.assignmentType, 'LANDER');
  assert.ok(
    (rosterDuring.data.bonuses?.miningYieldBonus || 0) < beforeMiningBonus,
    `SHIP_BAY Geologist bonus must pause while crew is LANDER deployed (during=${rosterDuring.data.bonuses?.miningYieldBonus}, before=${beforeMiningBonus})`
  );

  // Verify stash-cargo applies mineralYieldMult & bioYieldMult and fuel bonus
  const stashRes = await api('POST', '/api/planets/planet_sec3_ignis/lander/stash-cargo', {
    accountId: ACC,
    mineralsHarvested: [{ name: 'Superdense Titanium', quantity: 10 }],
    bioSamplesHarvested: [{ speciesId: 'sp_test', name: 'Test Fauna', quantity: 1, bioUnits: 20 }],
    hullRemaining: 190,
    fuelRemaining: 120,
  });
  assert.equal(stashRes.status, 200);
  assert.ok(stashRes.data.stashedMinerals > 10, `Geologist multiplier should raise 10 minerals -> ${stashRes.data.stashedMinerals}`);
  assert.ok(stashRes.data.stashedBioUnits > 20, `Biologist multiplier should raise 20 bio units -> ${stashRes.data.stashedBioUnits}`);

  // 5. Safe Return -> Restore B1#1, Grant Veteran Stat Growth (+1) & Deduct Discounted Hazard Pay
  const recoverSafe = await api('POST', '/api/planets/planet_sec3_ignis/lander/recover', {
    accountId: ACC,
    mineralsHarvested: [{ name: 'Plutonium Isotopes', quantity: 8 }],
    bioSamplesHarvested: [],
    hullRemaining: 180,
    fuelRemaining: 95,
  });
  assert.equal(recoverSafe.status, 200);
  assert.ok(recoverSafe.data.totalMinerals > 8, 'Mineral recovery must apply mineralYieldMult');
  assert.equal(recoverSafe.data.veteransGained?.length, 4, 'All 4 survivors on hazardous Ignis must gain +1 Veteran stat');
  assert.ok((recoverSafe.data.hazardPayPaid || 0) > 0, 'Must pay surface hazard pay on safe recovery');

  const rosterAfterSafe = await api('GET', `/api/crew/roster?accountId=${ACC}`);
  const restoredMiner = rosterAfterSafe.data.crew.find((c: any) => c.id === minerId);
  assert.equal(restoredMiner.assignmentType, 'SHIP_BAY', 'Returned crew must restore previous SHIP_BAY assignment');
  assert.equal(restoredMiner.assignedBaySlot, 'B1#1', 'Returned crew must restore B1#1 slot');
  assert.ok((rosterAfterSafe.data.bonuses?.miningYieldBonus || 0) >= beforeMiningBonus, 'Restored bay officer must resume flagship bay bonus');
  console.log('✓ Verified COLONY block, BAY pause/restore, yield multipliers, Veteran growth & Hazard Pay');

  // 6. Fatal Lander Destruction (hullRemaining: 0) -> Grit Survival Roll (KIA vs Ejected Castaway + WS Rescue)
  // Pick deterministic Grit/Seed expectations from evaluateGritSurvivalRoll on planet_sec3_ignis (sectorId=3 -> planetSeedFactor = (3*131 + 17*17)=682)
  const testPlanetId = 'planet_sec3_ignis';
  const planetSeedFactor = (3 * 131 + testPlanetId.length * 17) >>> 0;

  // Low-grit expendable vs High-grit hero
  const kiaCandidate = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Miner'],
    rarity: 'COMMON',
    aptitude: 45,
    grit: 10,
    name: 'Doomed Cadet Rook',
  });
  const heroCandidate = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Pilot'],
    rarity: 'RARE',
    aptitude: 88,
    grit: 99,
    name: 'Capt. Elena Cruz',
  });
  const kiaId = kiaCandidate.data.crewMember.id;
  const heroId = heroCandidate.data.crewMember.id;

  const kiaRoll = evaluateGritSurvivalRoll(
    {
      id: kiaId,
      name: 'Doomed Cadet Rook',
      callsign: 'ROOK',
      seed: kiaCandidate.data.crewMember.seed,
      primarySpecialty: 'Miner',
      specialties: ['Miner'],
      aptitude: 45,
      grit: 10,
      efficiency: 45,
      morale: 100,
      traitId: kiaCandidate.data.crewMember.traitId,
    },
    planetSeedFactor
  );
  const heroRoll = evaluateGritSurvivalRoll(
    {
      id: heroId,
      name: 'Capt. Elena Cruz',
      callsign: 'CRUZ',
      seed: heroCandidate.data.crewMember.seed,
      primarySpecialty: 'Pilot',
      specialties: ['Pilot'],
      aptitude: 88,
      grit: 99,
      efficiency: 86,
      morale: 100,
      traitId: heroCandidate.data.crewMember.traitId,
    },
    planetSeedFactor
  );

  // Deploy both on fatal sortie
  const fatalDeploy = await api('POST', `/api/planets/${testPlanetId}/lander/deploy`, {
    accountId: ACC,
    crewIds: [kiaId, heroId],
  });
  assert.equal(fatalDeploy.status, 200);

  const crashRes = await api('POST', `/api/planets/${testPlanetId}/lander/recover`, {
    accountId: ACC,
    mineralsHarvested: [{ name: 'Plutonium Isotopes', quantity: 5 }],
    bioSamplesHarvested: [],
    hullRemaining: 0,
    fuelRemaining: 0,
  });
  assert.equal(crashRes.status, 200);
  assert.equal(crashRes.data.status, 'LANDER_DESTROYED');
  assert.equal(crashRes.data.totalMinerals, 0, 'Destroyed lander loses uncommitted cargo');

  const expectedCasCount = (kiaRoll.survived ? 0 : 1) + (heroRoll.survived ? 0 : 1);
  const expectedEjectCount = (kiaRoll.survived ? 1 : 0) + (heroRoll.survived ? 1 : 0);
  assert.equal(crashRes.data.casualties.length, expectedCasCount);
  assert.equal(crashRes.data.ejectedCastaways.length, expectedEjectCount);

  const ledgerRes = await api('GET', `/api/crew/casualties?accountId=${ACC}`);
  assert.equal(ledgerRes.status, 200);
  assert.equal(ledgerRes.data.casualties.length, 2, 'Memorial ledger must record both KIA and EJECTED_CASTAWAY outcomes');

  // If any survivor ejected (Grit=99 has ~80%+ survival rate), verify WebSocket LOOT_CONTAINER rescue restores exact veteran
  if (crashRes.data.ejectedCastaways.length > 0) {
    const survivor = crashRes.data.ejectedCastaways[0];
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}/ws/combat?sectorId=${crashRes.data.sectorId}&playerId=${ACC}`);
      let sent = false;
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('WS timeout waiting for CASTAWAY_RESCUED on ejected lander pod'));
      }, 10000);

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (!sent && (msg.type === 'SECTOR_ASTEROIDS' || msg.type === 'STATE' || msg.type === 'SNAPSHOT')) {
          sent = true;
          ws.send(JSON.stringify({ type: 'LOOT_CONTAINER', containerId: survivor.containerId }));
        }
        if (Array.isArray(msg.events)) {
          const ev = msg.events.find((e: any) => e.type === 'CASTAWAY_RESCUED');
          if (ev) {
            assert.equal(ev.data?.crewMember?.name, survivor.name, 'Rescued castaway must preserve exact crew name');
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const rosterRescued = await api('GET', `/api/crew/roster?accountId=${ACC}`);
    const restoredHero = rosterRescued.data.crew.find((c: any) => c.name === survivor.name);
    assert.ok(restoredHero, 'Ejected crew rescued from cryo-pod must return to active crew_roster');
    assert.equal(restoredHero.morale, 55, 'Ejected survivor re-enrolls at 55% shaken morale');
    console.log(`✓ Verified Grit survival roll, Ship Memorial ledger & orbital cryo-pod WS rescue (${survivor.name})`);
  } else {
    console.log('✓ Verified Grit survival roll & Ship Memorial ledger (0 survivors this roll)');
  }

  // Verify pure computation helper covers all 4 slots max
  const fourAbilities = computeLanderCrewEffects(
    [
      { id: '1', name: 'A', callsign: 'A', seed: 1, primarySpecialty: 'Soldier', specialties: ['Soldier'], aptitude: 70, grit: 70, efficiency: 70, morale: 100, traitId: 'T1' },
      { id: '2', name: 'B', callsign: 'B', seed: 2, primarySpecialty: 'Geologist', specialties: ['Geologist'], aptitude: 70, grit: 70, efficiency: 70, morale: 100, traitId: 'T2' },
      { id: '3', name: 'C', callsign: 'C', seed: 3, primarySpecialty: 'Medic', specialties: ['Medic'], aptitude: 70, grit: 70, efficiency: 70, morale: 100, traitId: 'T3' },
      { id: '4', name: 'D', callsign: 'D', seed: 4, primarySpecialty: 'Pilot', specialties: ['Pilot'], aptitude: 70, grit: 70, efficiency: 70, morale: 100, traitId: 'T4' },
    ],
    LANDER_CHASSIS_TIERS[4]
  );
  assert.equal(fourAbilities.activeAbilities.length, 4, '4 distinct crew on Tier 4 must unlock all [1]-[4] active ability slots');
  console.log('✓ Verified [1]-[4] active ability deduplication & slot allocation');

  console.log('\n🎉 ALL MILESTONE 1.6 TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ MILESTONE 1.6 TEST FAILED:', err);
  process.exit(1);
});

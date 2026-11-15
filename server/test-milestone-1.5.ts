import assert from 'node:assert/strict';
import { AuthedWebSocket as WebSocket } from './test-utils/authHelper';
import {
  ALL_SPECIALTY_IDS,
  COLONY_MODULES,
  CREW_RARITY_SPECS,
  SHIP_BAY_BLUEPRINTS,
  generateProceduralCrewCandidate,
} from './src/procgen/CrewCatalog';
import { getHullsByMainClass } from './src/procgen/HullClassCatalog';

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
  console.log('=== MILESTONE 1.5 VERIFICATION: PROCEDURAL CREW, STATION BAYS & COLONY WORKFORCE ===');

  // 1. Catalog & Deterministic Multi-Specialty Rarity Scaling
  assert.equal(ALL_SPECIALTY_IDS.length, 17, 'Must expose all 17 exact Specialties');
  assert.equal(COLONY_MODULES.length, 8, 'Must expose all 8 Specialty Colony Modules');
  assert.equal(SHIP_BAY_BLUEPRINTS.length, 17, 'Must expose 17 tiered Ship Bay blueprints');

  const rarityCounts: Array<[keyof typeof CREW_RARITY_SPECS, number]> = [
    ['COMMON', 1],
    ['UNCOMMON', 2],
    ['RARE', 3],
    ['EPIC', 4],
    ['LEGENDARY', 5],
  ];
  for (const [rarity, expectedCount] of rarityCounts) {
    const c = generateProceduralCrewCandidate({
      listingId: `TEST_${rarity}`,
      seed: 1337 + expectedCount,
      factionId: 'FACTION_SOL',
      forcedRarity: rarity,
      originSource: 'STARPORT',
      originLabel: 'Unit Catalog Check',
    });
    assert.equal(c.specialties.length, expectedCount, `${rarity} must roll ${expectedCount} specialties`);
    assert.equal(new Set(c.specialties).size, expectedCount, `${rarity} specialties must be unique`);
  }

  // Verify Bay slots scale properly across all 8 MainHullClasses
  assert.equal(getHullsByMainClass('INTERCEPTOR')[0].baySlots, 1);
  assert.equal(getHullsByMainClass('CORVETTE')[0].baySlots, 2);
  assert.equal(getHullsByMainClass('FRIGATE')[0].baySlots, 3);
  assert.equal(getHullsByMainClass('HAULER')[0].baySlots, 4);
  assert.equal(getHullsByMainClass('INDUSTRIAL_EXTRACTOR')[0].baySlots, 4);
  assert.equal(getHullsByMainClass('DESTROYER')[0].baySlots, 5);
  assert.equal(getHullsByMainClass('CRUISER')[0].baySlots, 6);
  assert.equal(getHullsByMainClass('DREADNOUGHT')[0].baySlots, 8);
  console.log('✓ Verified 17 Specialties, 1->5 Rarity scaling, 8 Colony Modules & 8-Hull Bay capacity');

  // 2. Clean Baseline Reset & API Catalog Check
  const reset = await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  assert.equal(reset.status, 200, 'debug-baseline must succeed');
  await api('POST', '/api/player/debug-reset-survey', { accountId: ACC });
  await api('POST', '/api/player/debug-credits', { accountId: ACC, credits: 50000 });
  await api('POST', '/api/player/ap/debug-set', { playerId: ACC, amount: 600 });

  const catRes = await api('GET', '/api/crew/catalog');
  assert.equal(catRes.status, 200);
  assert.equal(catRes.data.specialties.length, 17);
  assert.equal(catRes.data.colonyModules.length, 8);

  // 3. Starport Concourse Hiring, Market Refresh & Contract Brokerage
  const marketRes = await api('GET', `/api/crew/market?accountId=${ACC}&sourceType=STARPORT&sourceId=PORT_AEGIS_01`);
  assert.equal(marketRes.status, 200);
  assert.ok(marketRes.data.candidates.length >= 4, 'Starport concourse must offer candidates');

  const cand1 = marketRes.data.candidates[0];
  const cand2 = marketRes.data.candidates[1];

  const hire1 = await api('POST', '/api/crew/hire', {
    accountId: ACC,
    listingId: cand1.listingId,
    sourceType: 'STARPORT',
    sourceId: 'PORT_AEGIS_01',
  });
  assert.equal(hire1.status, 200);
  assert.equal(hire1.data.crewMember.name, cand1.name);

  const hire2 = await api('POST', '/api/crew/hire', {
    accountId: ACC,
    listingId: cand2.listingId,
    sourceType: 'STARPORT',
    sourceId: 'PORT_AEGIS_01',
  });
  assert.equal(hire2.status, 200);

  // Market refresh spends 75 Cr and changes nonce
  const refreshRes = await api('POST', '/api/crew/market/refresh', { accountId: ACC });
  assert.equal(refreshRes.status, 200);
  assert.ok(refreshRes.data.refreshNonce >= 1, 'Refresh must increment crew_refresh_nonce');

  // Broker cand2 contract for resale payout
  const creditsBeforeBroker = Number((await api('GET', `/api/crew/roster?accountId=${ACC}`)).data.credits);
  const brokerRes = await api('POST', '/api/crew/broker', { accountId: ACC, crewId: hire2.data.crewMember.id });
  assert.equal(brokerRes.status, 200);
  assert.ok(brokerRes.data.payoutCredits > 0, 'Contract brokerage must award positive credits');
  assert.ok(brokerRes.data.remainingCredits > creditsBeforeBroker, 'Brokerage must increase player credits');

  // Settle payroll cycle
  const payRes = await api('POST', '/api/crew/settle-cycle', { accountId: ACC });
  assert.equal(payRes.status, 200);
  assert.equal(payRes.data.paidInFull, true, 'Payroll cycle should settle in full');
  assert.equal(payRes.data.arrearsCycles, 0);
  console.log('✓ Verified Starport Hiring, Slate Refresh, Brokerage Resale & Payroll Settlement');

  // 4. Ship Tiered BAY Slots (B1/B2), Fitting Research Bay Mk.IV, Assignment & Bonus Stacking
  const outfitting0 = await api('GET', `/api/outfitting/player?playerId=${ACC}`);
  assert.equal(outfitting0.status, 200);
  assert.equal(outfitting0.data.slotLayout.bay, 2, 'Starter Corvette must expose bay: 2 slots');

  // Unfit secondary starter combat/propulsion gear so the Corvette can power a heavy T4 Science Bay
  for (const s of ['H1', 'H2', 'M2', 'L2']) {
    await api('POST', '/api/outfitting/unfit', { playerId: ACC, slot: s });
  }

  // Buy Research Bay Mk.IV (4 stations) & Astrogation Suite Mk.I (1 station)
  const buyResBay = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_BAY_RESEARCH_T4' });
  assert.equal(buyResBay.status, 200, `Purchase Research Bay Mk.IV: ${JSON.stringify(buyResBay.data)}`);
  const fitResBay = await api('POST', '/api/outfitting/fit', {
    playerId: ACC,
    itemId: buyResBay.data.item.id,
    slot: 'B1',
  });
  assert.equal(fitResBay.status, 200, `Fit Research Bay Mk.IV into B1: ${JSON.stringify(fitResBay.data)}`);

  const buyAstroBay = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_BAY_ASTROGATION_T1' });
  assert.equal(buyAstroBay.status, 200, `Purchase Astrogation & Trade Suite Mk.I: ${JSON.stringify(buyAstroBay.data)}`);
  const fitAstroBay = await api('POST', '/api/outfitting/fit', {
    playerId: ACC,
    itemId: buyAstroBay.data.item.id,
    slot: 'B2',
  });
  assert.equal(fitAstroBay.status, 200, `Fit Astrogation & Trade Suite Mk.I into B2: ${JSON.stringify(fitAstroBay.data)}`);

  const rosterWithBays = await api('GET', `/api/crew/roster?accountId=${ACC}`);
  assert.equal(rosterWithBays.status, 200);
  assert.equal(rosterWithBays.data.shipStations.length, 6, 'BRIDGE#1 (1) + B1 (T4=4) + B2 (T1=1) must open 6 Ship Stations');

  // Seed Soldier -> verify assigning Soldier into Research Bay B1#1 fails (specialty mismatch)
  const seedSoldier = await api('POST', '/api/crew/debug-seed', {
    accountId: ACC,
    specialties: ['Soldier'],
    rarity: 'COMMON',
  });
  assert.equal(seedSoldier.status, 200);
  const badAssign = await api('POST', '/api/crew/assign', {
    accountId: ACC,
    crewId: seedSoldier.data.crewMember.id,
    assignmentType: 'SHIP_BAY',
    baySlotKey: 'B1#1',
  });
  assert.equal(badAssign.status, 400, 'Soldier must not fit into Research Bay');

  // Seed Biologist x2 + Physicist -> fit B1#1, B1#2, B1#3 and verify diminishing bonus stacking
  const bio1 = await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Biologist'], rarity: 'RARE', aptitude: 85 });
  const bio2 = await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Biologist'], rarity: 'RARE', aptitude: 85 });
  const phys1 = await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Physicist'], rarity: 'RARE', aptitude: 85 });

  await api('POST', '/api/crew/assign', { accountId: ACC, crewId: bio1.data.crewMember.id, assignmentType: 'SHIP_BAY', baySlotKey: 'B1#1' });
  const afterBio1 = (await api('GET', `/api/crew/roster?accountId=${ACC}`)).data.bonuses.researchBioDataBonus;
  assert.ok(afterBio1 > 0.1, `First Biologist must boost researchBioDataBonus (got ${afterBio1})`);

  await api('POST', '/api/crew/assign', { accountId: ACC, crewId: bio2.data.crewMember.id, assignmentType: 'SHIP_BAY', baySlotKey: 'B1#2' });
  const afterBio2 = (await api('GET', `/api/crew/roster?accountId=${ACC}`)).data.bonuses.researchBioDataBonus;
  const marginalSecond = afterBio2 - afterBio1;
  assert.ok(afterBio2 > afterBio1 && marginalSecond < afterBio1, 'Second Biologist must stack with diminishing returns');

  await api('POST', '/api/crew/assign', { accountId: ACC, crewId: phys1.data.crewMember.id, assignmentType: 'SHIP_BAY', baySlotKey: 'B1#3' });

  // Measure Trade Market price difference with Merchant in Astrogation Bay B2#1
  const mktBeforeMerchant = await api('GET', `/api/ports/PORT_AEGIS_01/market?playerId=${ACC}`);
  const oreBefore = mktBeforeMerchant.data.items.find((i: any) => i.commodity_id === 'COMM_ORE');

  const merch1 = await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Merchant'], rarity: 'EPIC', aptitude: 92 });
  const assignMerch = await api('POST', '/api/crew/assign', {
    accountId: ACC,
    crewId: merch1.data.crewMember.id,
    assignmentType: 'SHIP_BAY',
    baySlotKey: 'B2#1',
  });
  assert.equal(assignMerch.status, 200);
  assert.ok(assignMerch.data.bonuses.tradeMarginBonus > 0, 'Stationed Merchant must provide positive tradeMarginBonus');

  const mktAfterMerchant = await api('GET', `/api/ports/PORT_AEGIS_01/market?playerId=${ACC}`);
  const oreAfter = mktAfterMerchant.data.items.find((i: any) => i.commodity_id === 'COMM_ORE');
  assert.ok(
    Number(oreAfter.buy_price) >= Number(oreBefore.buy_price) && Number(oreAfter.sell_price) <= Number(oreBefore.sell_price),
    'Merchant tradeMarginBonus must improve port spread for player'
  );
  console.log('✓ Verified Tiered Ship BAY Fitting, Specialty Gating, Diminishing Returns & Live Trade Multiplier');

  // 5. Colony Modules (8 Tracks), N-Specialist Hard Gating & Wage Subsidy Settlement
  // Prepare probe beacon + rations/alloy on Sector 1 planet_sec1_aegis
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_RATIONS', quantity: 10 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ALLOY', quantity: 60 });
  const beaconRes = await api('POST', '/api/planets/planet_sec1_aegis/probe', {
    accountId: ACC,
    targetLat: 12.4,
    targetLng: -32.1,
    shieldBoost: true,
  });
  assert.equal(beaconRes.status, 200, `Probe beacon failed: ${JSON.stringify(beaconRes.data)}`);
  const foundRes = await api('POST', '/api/colonies/found', {
    accountId: ACC,
    planetId: 'planet_sec1_aegis',
    beaconId: beaconRes.data.beaconId,
    name: 'Specialist Workforce Outpost',
  });
  assert.equal(foundRes.status, 200, `Found colony failed: ${JSON.stringify(foundRes.data)}`);
  const colonyId = foundRes.data.colony.id;

  // Must BLOCK Derrick T2 upgrade & RESEARCH_INSTITUTE T1 without matching Colony Specialists
  const blockedDerrick = await api('POST', `/api/colonies/${colonyId}/upgrade`, {
    accountId: ACC,
    facilityType: 'DERRICK',
  });
  assert.equal(blockedDerrick.status, 400, 'Derrick T2 must be blocked without stationed Miner/Geologist');
  assert.ok(
    String(blockedDerrick.data.error || '').includes('CREW_SPECIALTY_REQUIRED'),
    `Expected CREW_SPECIALTY_REQUIRED error, got ${JSON.stringify(blockedDerrick.data)}`
  );

  const blockedMod = await api('POST', `/api/colonies/${colonyId}/modules/upgrade`, {
    accountId: ACC,
    moduleKey: 'RESEARCH_INSTITUTE',
  });
  assert.equal(blockedMod.status, 400, 'RESEARCH_INSTITUTE T1 must be blocked without stationed science officer');
  assert.ok(
    String(blockedMod.data.error || '').includes('CREW_SPECIALTY_REQUIRED'),
    `Expected CREW_SPECIALTY_REQUIRED error, got ${JSON.stringify(blockedMod.data)}`
  );

  // Hire directly from Colony Settlement Hall
  const colMarket = await api('GET', `/api/crew/market?accountId=${ACC}&sourceType=COLONY&sourceId=${colonyId}`);
  assert.equal(colMarket.status, 200);
  assert.ok(colMarket.data.candidates.length >= 1, 'Colony market must offer candidates');
  const colHire = await api('POST', '/api/crew/hire', {
    accountId: ACC,
    listingId: colMarket.data.candidates[0].listingId,
    sourceType: 'COLONY',
    sourceId: colonyId,
  });
  assert.equal(colHire.status, 200);

  // Station Miner + Biologist + Merchant at Colony -> unlock Derrick T2 + Research Institute T1 + Trade Exchange T1
  await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Miner'], assignColonyId: colonyId });
  await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Biologist'], assignColonyId: colonyId });
  await api('POST', '/api/crew/debug-seed', { accountId: ACC, specialties: ['Merchant'], assignColonyId: colonyId });

  const upDerrick = await api('POST', `/api/colonies/${colonyId}/upgrade`, { accountId: ACC, facilityType: 'DERRICK' });
  assert.equal(upDerrick.status, 200, 'Derrick T2 must succeed once Miner is stationed');

  const upInst = await api('POST', `/api/colonies/${colonyId}/modules/upgrade`, {
    accountId: ACC,
    moduleKey: 'RESEARCH_INSTITUTE',
  });
  assert.equal(upInst.status, 200);
  assert.equal(upInst.data.newTier, 1);

  const upExch = await api('POST', `/api/colonies/${colonyId}/modules/upgrade`, {
    accountId: ACC,
    moduleKey: 'TRADE_EXCHANGE',
  });
  assert.equal(upExch.status, 200);
  assert.equal(upExch.data.newTier, 1);
  assert.ok(
    Number(upExch.data.colony.localWageSubsidy ?? 0) >= 45,
    `TRADE_EXCHANGE T1 must add >= 45 Cr/cycle local wage subsidy (got ${upExch.data.colony.localWageSubsidy})`
  );

  const subsidizedPay = await api('POST', '/api/crew/settle-cycle', { accountId: ACC });
  assert.equal(subsidizedPay.status, 200);
  assert.ok(subsidizedPay.data.colonySubsidy >= 45, 'Payroll settle-cycle must deduct Colony Wage Subsidy from gross wages');
  console.log('✓ Verified Hard N-Specialist Colony Gating, Colony Modules, Recruitment & Wage Subsidy');

  // 6. Ship-to-Ship Encounters: Alien Captain Hail Recruitment + Castaway Cryo-Pod Rescue via WS
  const capList = await api('GET', `/api/captains/sector/1?accountId=${ACC}`);
  assert.equal(capList.status, 200);
  assert.ok(capList.data.captains.length >= 1, 'Sector 1 must have frontier captains');
  const capKey = capList.data.captains[0].captainKey;

  const hailRes = await api('GET', `/api/captains/${encodeURIComponent(capKey)}?accountId=${ACC}&sectorId=1`);
  assert.equal(hailRes.status, 200);
  const barterRes = await api('POST', '/api/captains/respond', {
    accountId: ACC,
    captainKey: capKey,
    sectorId: 1,
    optionId: 'OPT_ASK_BARTER',
  });
  assert.equal(barterRes.status, 200, `OPT_ASK_BARTER failed: ${JSON.stringify(barterRes.data)}`);
  const recruitRes = await api('POST', '/api/captains/respond', {
    accountId: ACC,
    captainKey: capKey,
    sectorId: 1,
    optionId: 'OPT_RECRUIT_CREW',
  });
  assert.equal(recruitRes.status, 200);
  assert.ok(recruitRes.data.crewRecruited, 'FrontierCaptain BARTER OPT_RECRUIT_CREW must enroll a procedural crew officer');

  // Castaway Cryo-Pod Rescue in Sector 2 via live WS
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/combat?sectorId=2&playerId=${ACC}`);
    let containerId: string | null = null;
    let setupSent = false;

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('WS timeout waiting for CASTAWAY_RESCUED event'));
    }, 10000);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!setupSent && (msg.type === 'SECTOR_ASTEROIDS' || msg.type === 'STATE' || msg.type === 'SNAPSHOT')) {
          setupSent = true;
          const setupRes = await api('POST', '/api/combat/debug/castaway-setup', {
            playerId: ACC,
            sectorId: 2,
            factionId: 'FACTION_MINERS_GUILD',
          });
          assert.equal(setupRes.status, 200);
          containerId = setupRes.data.containerId;
          ws.send(JSON.stringify({ type: 'LOOT_CONTAINER', containerId }));
        }
        if (Array.isArray(msg.events)) {
          const rescued = msg.events.find((e: any) => e.type === 'CASTAWAY_RESCUED');
          if (rescued) {
            assert.ok(rescued.data?.crewMember?.name, 'CASTAWAY_RESCUED must deliver enrolled crewMember payload');
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        }
        if (msg.type === 'CASTAWAY_RESCUED' && msg.crew?.name) {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch (err) {
        clearTimeout(timer);
        ws.close();
        reject(err);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const finalRoster = await api('GET', `/api/crew/roster?accountId=${ACC}`);
  assert.equal(finalRoster.status, 200);
  const sources = new Set(finalRoster.data.crew.map((c: any) => c.originSource));
  assert.ok(sources.has('STARPORT'), 'Roster should verify STARPORT origin');
  assert.ok(sources.has('COLONY'), 'Roster should verify COLONY origin');
  assert.ok(sources.has('CAPTAIN_HAIL'), 'Roster should verify CAPTAIN_HAIL origin');
  assert.ok(sources.has('RESCUE_POD'), 'Roster should verify RESCUE_POD origin');
  console.log('✓ Verified Ship-to-Ship Captain Hail Recruitment & Combat Castaway Cryo-Pod Rescue');
  console.log('=== MILESTONE 1.5 VERIFICATION COMPLETE (ALL CHECKS PASSED) ===');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

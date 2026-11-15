import './test-utils/authHelper';
import assert from 'node:assert/strict';
import {
  generateSectorCaptains,
  normalizeCanonicalFaction,
} from './src/procgen/FrontierCaptainGenerator';
import {
  generateNextStoryStage,
  generateStationBoardMissions,
  getStoryBranchMeta,
} from './src/procgen/GalacticMissionGenerator';

const BASE_URL = 'http://localhost:3000';
const ACCOUNT_ID = 'acc_sol_captain';

async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== MILESTONE 1.1 TEST SUITE: GALACTIC MISSIONS & FRONTIER CAPTAINS ===\n');

  // 1. Baseline & Clean Setup
  await apiJson('/api/player/debug-baseline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  await apiJson('/api/player/ap/debug-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, ap: 60 }),
  });
  await apiJson('/api/player/debug-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, credits: 8000 }),
  });
  // Ensure friendly standing across factions for unconstrained planet surveys in tests
  for (const factionId of ['FACTION_SOL', 'FACTION_HEGEMONY', 'FACTION_PHORID', 'FACTION_KRYLL', 'FACTION_LITHOS']) {
    await apiJson('/api/reputation/debug-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: ACCOUNT_ID, factionId, standing: 25 }),
    });
  }
  console.log('✅ [1] Baseline telemetry, AP, credits & faction standings initialized.');

  // 2. Unit Determinism: Procedural Frontier Captains & Galactic Missions
  const lithosCapsA = generateSectorCaptains(
    {
      sectorId: 27,
      sectorName: 'Prism Threshold',
      controllingFaction: 'FACTION_LITHOS',
      spectralClass: 'BLUE_O',
      hazardLevel: 2,
      planets: [{ id: 'p_27_1', name: 'Facet-IX', mainClass: 'CRYSTALLINE_GEM', subtype: 'Quartz Prism' }],
    },
    () => 30
  );
  const lithosCapsB = generateSectorCaptains(
    {
      sectorId: 27,
      sectorName: 'Prism Threshold',
      controllingFaction: 'FACTION_LITHOS',
      spectralClass: 'BLUE_O',
      hazardLevel: 2,
      planets: [{ id: 'p_27_1', name: 'Facet-IX', mainClass: 'CRYSTALLINE_GEM', subtype: 'Quartz Prism' }],
    },
    () => 30
  );
  assert.equal(lithosCapsA[0].name, lithosCapsB[0].name, 'Captain generation must be deterministic');
  assert.equal(lithosCapsA[0].species, 'LITHOS', 'Lithos sector captain uses LITHOS species');
  assert.ok(lithosCapsA[0].nodes.GREETING.text.includes('Facet-IX'), 'Greeting anchors real planet name');
  assert.ok(lithosCapsA[0].nodes.GREETING.text.includes('Quartz Prism'), 'Greeting anchors real planet subtype');
  assert.equal(normalizeCanonicalFaction('FACTION_VAELIC'), 'FACTION_HEGEMONY', 'Vaelic normalizes cleanly');

  const sampleBoard = generateStationBoardMissions({
    seedKey: 'UNIT_SEED_14',
    boardSectorId: 14,
    boardFaction: 'FACTION_PHORID',
    candidateSectors: [
      { id: 15, name: 'Spore Belt', controllingFaction: 'FACTION_PHORID', hazardLevel: 2, spectralClass: 'RED_M' },
      { id: 18, name: 'Cinder Edge', controllingFaction: 'FACTION_KRYLL', hazardLevel: 3, spectralClass: 'ORANGE_K' },
    ],
    candidatePlanets: [
      { id: 'p_15_1', sectorId: 15, sectorName: 'Spore Belt', controllingFaction: 'FACTION_PHORID', name: 'Hyphae IV', mainClass: 'FUNGAL_MYCELIAL', subtype: 'Mycelial Canopy', habitabilityRating: 6 },
    ],
    count: 5,
  });
  assert.equal(sampleBoard.length, 5, 'Board generates 5 varied missions');
  assert.ok(sampleBoard.some((m) => m.chainTotalStages > 1), 'Board includes multi-step story chain');
  assert.ok(sampleBoard.some((m) => m.isUrgent), 'Board includes urgent dispatch');

  const stage2 = generateNextStoryStage({
    seedKey: 'CHAIN_TEST_2',
    boardSectorId: 14,
    issuerFactionId: 'FACTION_PHORID',
    giverName: 'Myceliarch Syla',
    nextStage: 2,
    totalStages: 3,
    themeCode: 'SPORE_RESONANCE',
    candidateSectors: [{ id: 15, name: 'Spore Belt', controllingFaction: 'FACTION_PHORID', hazardLevel: 2, spectralClass: 'RED_M' }],
    candidatePlanets: [],
  });
  assert.equal(stage2.chainStage, 2);
  assert.ok(getStoryBranchMeta('SPORE_RESONANCE', 'FACTION_PHORID').rivalFactionId === 'FACTION_KRYLL');
  console.log('✅ [2] Deterministic Procgen (Captains, Story Chains, Urgent Dispatches) verified.');

  // 3. Frontier Alien Captains API across Sectors 6-60
  const cap14 = await apiJson(`/api/captains/sector/14?accountId=${ACCOUNT_ID}`);
  assert.equal(cap14.status, 200);
  assert.ok(cap14.data.captains.length >= 1, 'Frontier Sector 14 returns orbital captains');
  const firstCap = cap14.data.captains[0];

  const openCap = await apiJson(`/api/captains/${encodeURIComponent(firstCap.captainKey)}?accountId=${ACCOUNT_ID}&sectorId=14`);
  assert.equal(openCap.status, 200);
  assert.equal(openCap.data.dialog.speakerName, firstCap.name);

  // Navigate to Barter & execute salvage telemetry trade
  const toBarter = await apiJson('/api/captains/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, captainKey: firstCap.captainKey, sectorId: 14, optionId: 'OPT_ASK_BARTER' }),
  });
  assert.equal(toBarter.status, 200);
  assert.equal(toBarter.data.dialog.currentNodeId, 'BARTER');

  const doSalvageTrade = await apiJson('/api/captains/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, captainKey: firstCap.captainKey, sectorId: 14, optionId: 'OPT_DO_BARTER_SALVAGE' }),
  });
  assert.equal(doSalvageTrade.status, 200);
  assert.ok(doSalvageTrade.data.remainingCredits > 0, 'Barter updates player credits');

  // Unlock & Accept Secret Rumor Contract via dialogue
  const askRumor = await apiJson('/api/captains/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, captainKey: firstCap.captainKey, sectorId: 14, optionId: 'OPT_ASK_RUMOR' }),
  });
  assert.equal(askRumor.status, 200);
  assert.ok(askRumor.data.rumorMission?.id, 'Captain grants Secret Rumor mission preview');

  const acceptRumor = await apiJson('/api/captains/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, captainKey: firstCap.captainKey, sectorId: 14, optionId: 'OPT_ACCEPT_RUMOR' }),
  });
  assert.equal(acceptRumor.status, 200);
  assert.equal(acceptRumor.data.acceptedMission?.status, 'ACTIVE', 'Secret Rumor transitions directly to ACTIVE');
  console.log(`✅ [3] Frontier Captain Multi-Turn Comms, Barter, & Secret Rumor verified (${firstCap.name}).`);

  // Clean up rumor mission so we have full 5 slots for board testing
  await apiJson(`/api/missions/${acceptRumor.data.acceptedMission.id}/abandon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });

  // 4. Station Galactic Mission Board: Refresh, Accept, All 4 Archetypes + Story Chain + Procedural Module Reward
  const refreshRes = await apiJson('/api/missions/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, sectorId: 14 }),
  });
  assert.equal(refreshRes.status, 200);
  assert.equal(refreshRes.data.boardOffers.length, 5, 'Refreshed board offers 5 contracts');

  const boardRes = await apiJson(`/api/missions?accountId=${ACCOUNT_ID}&sectorId=14`);
  assert.equal(boardRes.status, 200);
  const offers = boardRes.data.boardOffers as any[];

  // 4a. WRECK_RECOVERY end-to-end
  const wreckOffer = offers.find((m) => m.missionType === 'WRECK_RECOVERY');
  assert.ok(wreckOffer, 'Board includes WRECK_RECOVERY offer');
  const acceptWreck = await apiJson(`/api/missions/${wreckOffer.id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  assert.equal(acceptWreck.status, 200);
  const wreckId = acceptWreck.data.mission.targetMetadata.wreckId;
  assert.ok(wreckId, 'WRECK_RECOVERY materializes real wreck in target sector');

  const dismantleRes = await apiJson('/api/combat/wrecks/dismantle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wreckId, accountId: ACCOUNT_ID }),
  });
  assert.equal(dismantleRes.status, 200);

  const claimWreck = await apiJson(`/api/missions/${wreckOffer.id}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  assert.equal(claimWreck.status, 200, 'Completed WRECK_RECOVERY claims successfully');
  assert.ok(claimWreck.data.awardedModule?.custom_name, 'Claim awards procedural ship module into player_inventory');
  assert.ok(claimWreck.data.awardedModule?.subtype, 'Procedural reward uses clean subtype field');
  console.log(`✅ [4a] WRECK_RECOVERY verified -> Forged [${claimWreck.data.awardedModule.rarity}] ${claimWreck.data.awardedModule.custom_name}.`);

  // 4b. SYNDICATE_BOUNTY end-to-end
  const bountyOffer = offers.find((m) => m.missionType === 'SYNDICATE_BOUNTY');
  assert.ok(bountyOffer, 'Board includes SYNDICATE_BOUNTY offer');
  const acceptBounty = await apiJson(`/api/missions/${bountyOffer.id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  assert.equal(acceptBounty.status, 200);

  const killRes = await apiJson('/api/combat/destroy-entity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sectorId: bountyOffer.targetSectorId,
      entityId: `bounty_${bountyOffer.id}`,
      killerId: `player_${ACCOUNT_ID}`,
    }),
  });
  assert.equal(killRes.status, 200, 'Spawned bounty target destroyed in target sector');

  const claimBounty = await apiJson(`/api/missions/${bountyOffer.id}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  assert.equal(claimBounty.status, 200);
  assert.ok(claimBounty.data.creditsAwarded >= bountyOffer.rewardCredits);
  console.log(`✅ [4b] SYNDICATE_BOUNTY verified (+${claimBounty.data.creditsAwarded} CR${claimBounty.data.urgentBonusApplied ? ' w/ Urgent Bonus' : ''}).`);

  // 4c. XENOBIOLOGY_SURVEY & PLANET_RECON + Story Chain advancement
  const scanOffer = offers.find((m) => m.missionType === 'XENOBIOLOGY_SURVEY' || m.missionType === 'PLANET_RECON');
  assert.ok(scanOffer && scanOffer.targetPlanetId, 'Board includes planet-anchored survey/recon contract');
  await apiJson(`/api/missions/${scanOffer.id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });

  // Perform all 3 scan bands + launch probe so both Xenodex species and 100% recon/beacon pass
  for (const scanBand of ['MINERALS', 'BIO', 'ANOMALIES']) {
    await apiJson(`/api/planets/${scanOffer.targetPlanetId}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: ACCOUNT_ID, scanBand }),
    });
  }
  await apiJson(`/api/planets/${scanOffer.targetPlanetId}/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, shieldBoost: true }),
  });

  const claimScan = await apiJson(`/api/missions/${scanOffer.id}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  assert.equal(claimScan.status, 200, 'Planet/Xenobiology mission claims cleanly after scans/probe');
  if (scanOffer.chainTotalStages > 1) {
    assert.ok(claimScan.data.nextStageMission?.chainStage === 2, 'Claiming Stage 1 unlocks Stage 2 Story Chain');
    await apiJson(`/api/missions/${claimScan.data.nextStageMission.id}/abandon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: ACCOUNT_ID }),
    });
  }
  console.log(`✅ [4c] Planet Recon / Xenodex Survey (+ Story Chain) verified on ${scanOffer.targetPlanetId}.`);

  // 5. Upgraded Hyperspace Interception carrying Frontier Captain multi-turn tree
  await apiJson('/api/starmap/hyperspace/enter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });
  const interceptRes = await apiJson('/api/starmap/hyperspace/intercept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, blipId: 'blip_m11_test', currentCoords: [620, 460] }),
  });
  assert.equal(interceptRes.status, 200);
  assert.ok(interceptRes.data.interception?.captainKey, 'Interception carries procedural captainKey');
  assert.ok(interceptRes.data.interception?.captainDialog?.options?.length >= 2, 'Interception carries branching captain options');

  await apiJson('/api/starmap/hyperspace/comms-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, blipId: 'blip_m11_test', actionId: 'PEACEFUL_PASS' }),
  });
  await apiJson('/api/starmap/hyperspace/arrive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID, sectorId: 1 }),
  });
  console.log('✅ [5] Hyperspace Interception multi-turn Captain handshake verified.');

  // Reset clean baseline after test
  await apiJson('/api/player/debug-baseline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: ACCOUNT_ID }),
  });

  console.log('\n🎉 ALL MILESTONE 1.1 GALACTIC MISSIONS & FRONTIER CAPTAIN TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ MILESTONE 1.1 TEST FAILED:', err);
  process.exit(1);
});


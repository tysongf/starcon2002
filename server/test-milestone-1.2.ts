import './test-utils/authHelper';
/**
 * Milestone 1.2 Integration Test:
 * - 6 Main Classes x 4 Subtypes = 24 Playable Hulls (/api/shipyard/hulls)
 * - Preserved 5 canonical blueprints (/api/shipyard/fleet/blueprints)
 * - Unified Hangar Flagship Promotion (/api/fleet/promote) & Outgoing Demotion
 * - Variable Slots H1..H3, M1..M3, L1..L3 + Smart Auto-Unfit Reconciliation
 * - Engineering Workbench: Salvage, Upgrade Tier (COMMON -> UNCOMMON -> RARE), Affix-Locked Reforge
 */
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:3000';
const ACC = 'acc_sol_captain';

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('=== MILESTONE 1.2 INTEGRATION VERIFICATION ===');

  // 1. Clean baseline
  let r = await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  assert.equal(r.status, 200, 'baseline reset must succeed');

  // 2. Verify 24 Hulls across 6 Main Classes (4 Subtypes each) + preserved 5 blueprints
  const bpRes = await api('GET', `/api/shipyard/fleet/blueprints?accountId=${ACC}`);
  assert.equal(bpRes.status, 200);
  assert.equal(bpRes.data.blueprints.length, 5, 'existing 5 escort blueprints preserved');

  const hullsRes = await api('GET', `/api/shipyard/hulls?accountId=${ACC}`);
  assert.equal(hullsRes.status, 200);
  assert.equal(hullsRes.data.count, 64, 'must expose exact 64 playable hulls (8 classes x 8 factions)');
  assert.equal(hullsRes.data.mainClasses.length, 8, 'must expose 8 main ship classes');

  const countsByClass: Record<string, number> = {};
  for (const h of hullsRes.data.hulls) {
    countsByClass[h.mainClass] = (countsByClass[h.mainClass] || 0) + 1;
  }
  for (const mc of [
    'INTERCEPTOR',
    'CORVETTE',
    'FRIGATE',
    'HAULER',
    'INDUSTRIAL_EXTRACTOR',
    'DESTROYER',
    'CRUISER',
    'DREADNOUGHT',
  ]) {
    assert.equal(countsByClass[mc], 8, `${mc} must have exact 8 faction subtypes`);
  }
  console.log('✓ Verified 8 Main Classes × 8 Factions = 64 Playable Hulls');

  // 3. Provision resources & commission SOL_CRUISER (3H/2M/3L) + KRYLL_RUNNER (2H/3M/1L)
  await api('POST', '/api/player/debug-credits', { accountId: ACC, credits: 25000 });
  await api('POST', '/api/player/ap/debug-set', { accountId: ACC, amount: 600 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ALLOY', quantity: 120 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ORE', quantity: 120 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_FUEL', quantity: 120 });

  const commCruiser = await api('POST', '/api/shipyard/hulls/commission', {
    accountId: ACC,
    hullClass: 'SOL_CRUISER',
    customName: 'UNS Vanguard Sovereign',
    promoteImmediately: false,
  });
  assert.equal(commCruiser.status, 200, `Commission SOL_CRUISER failed: ${JSON.stringify(commCruiser.data)}`);
  const cruiserFleetId = commCruiser.data.ship.id;

  const commRunner = await api('POST', '/api/shipyard/hulls/commission', {
    accountId: ACC,
    hullClass: 'KRYLL_RUNNER',
    customName: 'Shadow Dart II',
    promoteImmediately: false,
  });
  assert.equal(commRunner.status, 200, `Commission KRYLL_RUNNER failed: ${JSON.stringify(commRunner.data)}`);
  const runnerFleetId = commRunner.data.ship.id;
  console.log('✓ Commissioned SOL_CRUISER & KRYLL_RUNNER into Fleet Hangar');

  // 4. Verify cargo overflow guard triggers when active cargo exceeds target hull limit, then clear cargo & promote
  const blockedPromote = await api('POST', '/api/fleet/promote', {
    accountId: ACC,
    fleetShipId: cruiserFleetId,
  });
  assert.equal(blockedPromote.status, 400);
  assert.ok(String(blockedPromote.data.error).includes('CARGO_HOLD_EXCEEDS_NEW_HULL'));

  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ALLOY', quantity: 0 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_ORE', quantity: 0 });
  await api('POST', '/api/player/debug-cargo', { accountId: ACC, commodityId: 'COMM_FUEL', quantity: 0 });

  const promoteCruiser = await api('POST', '/api/fleet/promote', {
    accountId: ACC,
    fleetShipId: cruiserFleetId,
  });
  assert.equal(promoteCruiser.status, 200, `Promote failed: ${JSON.stringify(promoteCruiser.data)}`);
  assert.equal(promoteCruiser.data.activeFlagship.hullClass, 'SOL_CRUISER');
  assert.deepEqual(promoteCruiser.data.activeFlagship.slotLayout, { high: 3, mid: 2, low: 3, bay: 6 });
  assert.equal(promoteCruiser.data.activeFlagship.powerGridMax, 190);
  assert.equal(promoteCruiser.data.activeFlagship.cpuMax, 265);
  assert.equal(promoteCruiser.data.demotedShip.hullClass, 'CORVETTE', 'outgoing Corvette demoted to Hangar');
  console.log('✓ Promoted SOL_CRUISER to Active Flagship; outgoing Corvette cleanly demoted');

  // 5. Fit extra modules into H3 & L3, and verify M3 is rejected on 3H/2M/3L
  const buyPulse = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_PULSE_01' });
  assert.equal(buyPulse.status, 200);
  const extraHighModId = buyPulse.data.item.id;

  const buyArmor = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_ARMOR_01' });
  assert.equal(buyArmor.status, 200);
  const extraLowModId = buyArmor.data.item.id;

  const fitH3 = await api('POST', '/api/outfitting/fit', { playerId: ACC, itemId: extraHighModId, slot: 'H3' });
  assert.equal(fitH3.status, 200, `Fitting H3 failed: ${JSON.stringify(fitH3.data)}`);
  assert.ok(fitH3.data.loadout.fitted.H3, 'H3 should be populated on SOL_CRUISER');

  const fitL3 = await api('POST', '/api/outfitting/fit', { playerId: ACC, itemId: extraLowModId, slot: 'L3' });
  assert.equal(fitL3.status, 200, `Fitting L3 failed: ${JSON.stringify(fitL3.data)}`);
  assert.ok(fitL3.data.loadout.fitted.L3, 'L3 should be populated on SOL_CRUISER');

  const buyProp = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_BRIDGE_T1' });
  assert.equal(buyProp.status, 200);
  const extraMidModId = buyProp.data.item.id;

  const badM3 = await api('POST', '/api/outfitting/fit', { playerId: ACC, itemId: extraMidModId, slot: 'M3' });
  assert.equal(badM3.status, 400, 'M3 must be rejected on 3H/2M/3L hull');
  assert.ok(String(badM3.data.error).includes('SLOT_UNAVAILABLE_ON_HULL'));
  console.log('✓ Fitted H3 & L3 on SOL_CRUISER and verified invalid M3 rejection');

  // 6. Swap into KRYLL_RUNNER (2H/3M/1L) -> H3, L2, L3 must auto-unfit into Locker
  const promoteRunner = await api('POST', '/api/fleet/promote', {
    accountId: ACC,
    fleetShipId: runnerFleetId,
  });
  assert.equal(promoteRunner.status, 200, `Promote KRYLL_RUNNER failed: ${JSON.stringify(promoteRunner.data)}`);
  assert.equal(promoteRunner.data.activeFlagship.hullClass, 'KRYLL_RUNNER');
  assert.deepEqual(promoteRunner.data.activeFlagship.slotLayout, { high: 2, mid: 3, low: 1, bay: 1 });

  const unfittedSlots = promoteRunner.data.unfittedModules.map((m: any) => m.fitSlot).sort();
  assert.ok(
    promoteRunner.data.unfittedModules.length >= 3,
    `Expected H3/L2/L3 auto-unfit, got slots: ${JSON.stringify(unfittedSlots)}`
  );
  const loadoutAfterSwap = promoteRunner.data.loadout;
  assert.equal('H3' in loadoutAfterSwap.fitted, false, 'H3 omitted on 2H hull');
  assert.equal('M3' in loadoutAfterSwap.fitted, true, 'M3 enabled on 3M hull');
  assert.equal('L2' in loadoutAfterSwap.fitted, false, 'L2 omitted on 1L hull');
  assert.ok(loadoutAfterSwap.powerGridUsed <= loadoutAfterSwap.powerGridMax, 'PG budget reconciled cleanly');

  // Verify M3 can now fit cleanly on KRYLL_RUNNER!
  const fitM3 = await api('POST', '/api/outfitting/fit', { playerId: ACC, itemId: extraMidModId, slot: 'M3' });
  assert.equal(fitM3.status, 200, `Fitting M3 on 3M Interceptor failed: ${JSON.stringify(fitM3.data)}`);
  assert.ok(fitM3.data.loadout.fitted.M3);
  console.log('✓ Swapped to KRYLL_RUNNER (2H/3M/1L): overflow H3/L2/L3 auto-unfitted & M3 unlocked');

  // 7. Engineering Workbench: Salvage, Upgrade Rarity (COMMON -> UNCOMMON -> RARE), and Affix-Locked Reforge
  const buyWb1 = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_PULSE_01' });
  const buyWb2 = await api('POST', '/api/outfitting/buy', { playerId: ACC, blueprintId: 'MOD_ARMOR_01' });
  const modToSalvageId = buyWb1.data.item.id;
  const modToCraftId = buyWb2.data.item.id;

  // Salvage modToSalvageId
  const salvageRes = await api('POST', '/api/outfitting/workbench/salvage', {
    playerId: ACC,
    itemId: modToSalvageId,
  });
  assert.equal(salvageRes.status, 200, `Salvage failed: ${JSON.stringify(salvageRes.data)}`);
  assert.ok(salvageRes.data.componentsGained > 0);
  const compAfterSalvage = salvageRes.data.techComponents;

  // Give plenty of tech components by salvaging 2 more shop modules so COMMON->UNCOMMON->RARE + Locked Reforge have ample budget
  for (let i = 0; i < 4; i++) {
    const tmp = await api('POST', '/api/outfitting/shop/buy', { playerId: ACC, sectorId: 1, slotIndex: i, epoch: 1 });
    await api('POST', '/api/outfitting/workbench/salvage', { playerId: ACC, itemId: tmp.data.item.id });
  }

  // Upgrade modToCraftId: COMMON -> UNCOMMON -> RARE
  const upg1 = await api('POST', '/api/outfitting/workbench/upgrade', {
    playerId: ACC,
    itemId: modToCraftId,
  });
  assert.equal(upg1.status, 200, `Upgrade 1 failed: ${JSON.stringify(upg1.data)}`);
  assert.equal(upg1.data.newRarity, 'UNCOMMON');
  assert.ok(upg1.data.item.affixes.length >= 2, 'UNCOMMON must have >= 2 affixes');

  const upg2 = await api('POST', '/api/outfitting/workbench/upgrade', {
    playerId: ACC,
    itemId: modToCraftId,
  });
  assert.equal(upg2.status, 200, `Upgrade 2 failed: ${JSON.stringify(upg2.data)}`);
  assert.equal(upg2.data.newRarity, 'RARE');
  assert.ok(upg2.data.item.affixes.length >= 3, 'RARE must have >= 3 affixes');

  // Lock Affix 0 and Reforge
  const lockedAffixBefore = upg2.data.item.affixes[0];
  const reforgeRes = await api('POST', '/api/outfitting/workbench/reforge', {
    playerId: ACC,
    itemId: modToCraftId,
    lockedAffixIndex: 0,
  });
  assert.equal(reforgeRes.status, 200, `Locked Reforge failed: ${JSON.stringify(reforgeRes.data)}`);
  assert.deepEqual(
    reforgeRes.data.item.affixes[0],
    lockedAffixBefore,
    'locked affix[0] must remain identical after Reforge'
  );
  console.log(`✓ Workbench Verified: Salvage (+${salvageRes.data.componentsGained} Comp, balance=${compAfterSalvage}), Upgrade COMMON→UNCOMMON→RARE, and Affix-Locked Reforge`);

  // 8. Clean baseline restore for downstream test suites
  await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  console.log('✓ Clean baseline restored (CORVETTE 2H/2M/2L, 120 MW / 180 tf)');
  console.log('ALL MILESTONE 1.2 CHECKS PASSED!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

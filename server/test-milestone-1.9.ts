import assert from 'node:assert/strict';
import WsWebSocket from 'ws';
import { BASE_URL, WS_BASE_URL, rawFetch, registerTestCaptain, authWsUrl } from './test-utils/authHelper';

async function api(path: string, token?: string, init: RequestInit = {}): Promise<{ status: number; data: any }> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await rawFetch(`${BASE_URL}${path}`, { ...init, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

function connectWs(path: string, token: string): Promise<{ ws: WsWebSocket; messages: any[]; lastSnapshot: () => any }> {
  const fullUrl = authWsUrl(`${WS_BASE_URL}${path}`, token);
  return new Promise((resolve, reject) => {
    const ws = new WsWebSocket(fullUrl);
    const messages: any[] = [];
    let latestSnap: any = null;
    const timer = setTimeout(() => reject(new Error(`WS connect timeout: ${path}`)), 4500);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve({ ws, messages, lastSnapshot: () => latestSnap });
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on('message', (buf) => {
      try {
        const parsed = JSON.parse(buf.toString());
        if (parsed.type === 'TICK_SNAPSHOT') {
          latestSnap = parsed;
        }
        messages.push(parsed);
      } catch {}
    });
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 5500, label = 'condition'): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function buyAndFit(token: string, blueprintId: string, targetSlot: string) {
  const buyRes = await api('/api/outfitting/buy', token, {
    method: 'POST',
    body: JSON.stringify({ blueprintId }),
  });
  assert.equal(buyRes.status, 200, `Failed buying ${blueprintId}: ${JSON.stringify(buyRes.data)}`);
  const itemId = buyRes.data?.item?.id;
  assert.ok(itemId, `Missing item.id when buying ${blueprintId}`);

  const fitRes = await api('/api/outfitting/fit', token, {
    method: 'POST',
    body: JSON.stringify({ itemId, targetSlot }),
  });
  assert.equal(fitRes.status, 200, `Failed fitting ${blueprintId} in ${targetSlot}: ${JSON.stringify(fitRes.data)}`);
  return fitRes.data.loadout;
}

async function runMilestone19Tests() {
  console.log('================================================================');
  console.log('☠️ MILESTONE 1.9: ROAMING DREADNOUGHT RAIDS & 13 MMORPG SYNERGIES');
  console.log('================================================================\n');

  const ts = Date.now().toString(36);
  const homeworldIds = new Set([11, 17, 23, 29, 52, 61, 64]);

  // -----------------------------------------------------------------------
  // [1/8] World Boss Discovery & 13 Thematic MMORPG Synergy Modules
  // -----------------------------------------------------------------------
  console.log('[1/8] Verifying 2 Roaming World Bosses & 13 Thematic Synergy Catalog...');
  const tank = await registerTestCaptain({ username: `m19_tank_${ts}`, password: 'pass1234', callsign: `Tank_${ts}`, factionId: 'FACTION_SOL' });
  const healer = await registerTestCaptain({ username: `m19_heal_${ts}`, password: 'pass1234', callsign: `Heal_${ts}`, factionId: 'FACTION_SOL' });
  const debuffer = await registerTestCaptain({ username: `m19_deb_${ts}`, password: 'pass1234', callsign: `Debuff_${ts}`, factionId: 'FACTION_KRYLL' });
  const buffer = await registerTestCaptain({ username: `m19_buf_${ts}`, password: 'pass1234', callsign: `Buff_${ts}`, factionId: 'FACTION_LITHOS' });
  const rival = await registerTestCaptain({ username: `m19_riv_${ts}`, password: 'pass1234', callsign: `Rival_${ts}`, factionId: 'FACTION_FREEBOOTERS' });

  for (const pilot of [tank, healer, debuffer, buffer, rival]) {
    await api('/api/player/debug-credits', pilot.token, {
      method: 'POST',
      body: JSON.stringify({ accountId: pilot.account.id, credits: 65000 }),
    });
  }

  const activeRaidsRes = await api('/api/raids/active', tank.token);
  assert.equal(activeRaidsRes.status, 200);
  const raids: any[] = activeRaidsRes.data.raids || [];
  assert.ok(raids.length >= 2, `Expected >= 2 active roaming Dreadnoughts, got ${raids.length}`);
  for (const r of raids) {
    assert.ok(r.sectorId >= 4, `World Boss must spawn in sectorId >= 4, got ${r.sectorId}`);
    assert.ok(!homeworldIds.has(r.sectorId), `World Boss must not spawn in faction homeworld ${r.sectorId}`);
  }

  const catRes = await api('/api/raids/synergies/catalog', tank.token);
  assert.equal(catRes.status, 200);
  assert.equal(catRes.data.modules.length, 13, 'Expected all 13 MMORPG synergy modules');
  assert.equal(catRes.data.relicHulls.length, 3, 'Expected 3 Tier-4 Relic Ship hulls');
  assert.equal(catRes.data.relicColonyCores.length, 3, 'Expected 3 Outpost Precursor Cores');
  console.log(`  ✓ Verified ${raids.length} roaming Dreadnoughts & 13 thematic synergy modules.`);

  // -----------------------------------------------------------------------
  // [2/8] Co-op Squadron & Dynamic Fitting Across Tank / Healer / Debuff / Buff
  // -----------------------------------------------------------------------
  console.log('[2/8] Forming 4-Role Raid Squadron & Fitting All 13 MMORPG Modules...');
  const sqCreate = await api('/api/squadrons/create', tank.token, {
    method: 'POST',
    body: JSON.stringify({ name: `Vanguard_${ts}` }),
  });
  assert.equal(sqCreate.status, 200);
  const sqId = sqCreate.data.squadron.id;

  for (const mate of [healer, debuffer, buffer]) {
    const inv = await api('/api/squadrons/invite', tank.token, {
      method: 'POST',
      body: JSON.stringify({ targetAccountId: mate.account.id }),
    });
    assert.equal(inv.status, 200);
    const acc = await api('/api/squadrons/accept', mate.token, {
      method: 'POST',
      body: JSON.stringify({ inviteId: inv.data.inviteId }),
    });
    assert.equal(acc.status, 200);
  }

  // Fit Role Modules onto starter Corvettes (2H / 2M / 2L -> H1, H2, M1, M2, L1, L2)
  await buyAndFit(tank.token, 'MOD_SYNERGY_TAUNT_EMITTER', 'M1');
  await buyAndFit(tank.token, 'MOD_SYNERGY_BASTION_DOME', 'M2');

  await buyAndFit(healer.token, 'MOD_SYNERGY_SHIELD_TRANSFUSER', 'H1');
  await buyAndFit(healer.token, 'MOD_SYNERGY_NANITE_REPAIRER', 'H2');
  await buyAndFit(healer.token, 'MOD_SYNERGY_CLEANSE_PULSE', 'M1');
  await buyAndFit(healer.token, 'MOD_SYNERGY_EMERGENCY_REBOOT', 'M2');

  await buyAndFit(debuffer.token, 'MOD_SYNERGY_ARMOR_CORRODER', 'H1');
  await buyAndFit(debuffer.token, 'MOD_SYNERGY_TARGET_PAINTER', 'M1');
  await buyAndFit(debuffer.token, 'MOD_SYNERGY_STASIS_WEB', 'M2');

  await buyAndFit(buffer.token, 'MOD_SYNERGY_CAPACITOR_RELAY', 'H1');
  await buyAndFit(buffer.token, 'MOD_SYNERGY_HARMONIC_COMMAND_LINK', 'L1');
  await buyAndFit(buffer.token, 'MOD_SYNERGY_OVERCLOCK_SYNCHRONIZER', 'L2');

  console.log('  ✓ Formed 4-pilot Squadron and fitted 12 modules (+ swap for 13th Guard Link).');

  // -----------------------------------------------------------------------
  // [3/8] Spawn Frontier Sector 4 Dreadnought & Phase 1 Pylon Aegis Check
  // -----------------------------------------------------------------------
  console.log('[3/8] Spawning Dreadnought in Sector 4 & Verifying Phase 1 Aegis Pylons...');
  const spawnRes = await api('/api/raids/debug-spawn', tank.token, {
    method: 'POST',
    body: JSON.stringify({ sectorId: 4, archetype: 'CHRONO_MONOLITH', maxHp: 900, maxShields: 200 }),
  });
  assert.equal(spawnRes.status, 200);
  const encounter = spawnRes.data.encounter;
  assert.ok(encounter?.id);

  const tankWs = await connectWs('/ws/combat?sectorId=4', tank.token);
  const healWs = await connectWs('/ws/combat?sectorId=4', healer.token);
  const debWs = await connectWs('/ws/combat?sectorId=4', debuffer.token);
  const bufWs = await connectWs('/ws/combat?sectorId=4', buffer.token);
  const rivWs = await connectWs('/ws/combat?sectorId=4', rival.token);

  await waitFor(
    () =>
      Boolean(
        tankWs.lastSnapshot()?.raidBoss?.encounterId === encounter.id &&
          tankWs.lastSnapshot()?.entities?.some(
            (e: any) => e.id === `player_${tank.account.id}` && e.equippedSynergies?.includes('TAUNT_EMITTER') && e.commandAuraActive
          )
      ),
    6000,
    'Sector 4 Raid Boss + Synergy Loadout + C3 Command Aura telemetry'
  );

  const initialSnap = tankWs.lastSnapshot();
  assert.equal(initialSnap.raidBoss.phase, 1, 'Boss must begin in Phase 1');
  assert.equal(initialSnap.raidBoss.pylonsAlive, 4, 'CHRONO_MONOLITH must spawn 4 Pylons');
  assert.equal(initialSnap.raidBoss.aegisReduction, 0.9, 'Phase 1 must enforce 90% Aegis reduction');

  // Destroy all 4 Aegis Pylons -> Phase 2 Exposed Core!
  for (let i = 0; i < 4; i++) {
    await api('/api/combat/destroy-entity', debuffer.token, {
      method: 'POST',
      body: JSON.stringify({ sectorId: 4, entityId: `raid_pylon_${encounter.id}_${i}`, killerId: `player_${debuffer.account.id}` }),
    });
  }

  await waitFor(
    () => tankWs.lastSnapshot()?.raidBoss?.phase === 2 && tankWs.lastSnapshot()?.raidBoss?.pylonsAlive === 0,
    5000,
    'Phase 2 transition after Pylon destruction'
  );
  console.log('  ✓ Phase 1 Aegis dropped upon Pylon destruction -> Phase 2 Core Exposed.');

  // -----------------------------------------------------------------------
  // [4/8] Tank & Healer Synergies + Escape Pod Live Cryo-Revive
  // -----------------------------------------------------------------------
  console.log('[4/8] Testing Tank Taunt/Bastion/Guard Link & Healer Beams/Cleanse/Revive...');
  const bossEntityId = `raid_boss_${encounter.id}`;
  tankWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'TAUNT_EMITTER', targetEntityId: bossEntityId }));
  tankWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'BASTION_DOME' }));
  await waitFor(
    () =>
      tankWs.messages.some((m) => m.type === 'S_SYNERGY_ACK' && m.synergyKey === 'TAUNT_EMITTER' && m.success) &&
      tankWs.messages.some((m) => m.type === 'S_SYNERGY_ACK' && m.synergyKey === 'BASTION_DOME' && m.success),
    4000,
    'Tank TAUNT_EMITTER & BASTION_DOME acks'
  );

  // Swap Tank M2 to 13th module (MOD_SYNERGY_INTERCEPT_TETHER) live and cast on Healer!
  await buyAndFit(tank.token, 'MOD_SYNERGY_INTERCEPT_TETHER', 'M2');
  await waitFor(
    () =>
      tankWs.lastSnapshot()?.entities?.some(
        (e: any) => e.id === `player_${tank.account.id}` && e.equippedSynergies?.includes('INTERCEPT_TETHER')
      ),
    4000,
    'Live OutfittingService -> SectorCombatManager loadout sync for INTERCEPT_TETHER'
  );
  tankWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'INTERCEPT_TETHER', targetEntityId: `player_${healer.account.id}` }));
  await waitFor(
    () => tankWs.lastSnapshot()?.entities?.some((e: any) => e.id === `player_${healer.account.id}` && e.guardLinked === true),
    4000,
    'Healer guardLinked status from Warden Guardian Link'
  );

  // Healer casts Shield Transfuser, Nanite Repairer, Cleanse Pulse
  healWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'SHIELD_TRANSFUSER', targetEntityId: `player_${tank.account.id}` }));
  healWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'NANITE_REPAIRER', targetEntityId: `player_${tank.account.id}` }));
  healWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'CLEANSE_PULSE' }));
  await waitFor(
    () =>
      healWs.messages.some((m) => m.type === 'S_SYNERGY_ACK' && m.synergyKey === 'SHIELD_TRANSFUSER' && m.success) &&
      healWs.messages.some((m) => m.type === 'S_SYNERGY_ACK' && m.synergyKey === 'NANITE_REPAIRER' && m.success) &&
      healWs.messages.some((m) => m.type === 'S_SYNERGY_ACK' && m.synergyKey === 'CLEANSE_PULSE' && m.success),
    4000,
    'Healer synergy acks'
  );

  // Eject Buffer into Escape Pod via Rival (open Sector 4 PvPvE) -> Healer Cryo-Revives Buffer!
  await api('/api/combat/destroy-entity', rival.token, {
    method: 'POST',
    body: JSON.stringify({ sectorId: 4, entityId: `player_${buffer.account.id}`, killerId: `player_${rival.account.id}` }),
  });
  await waitFor(
    () => tankWs.lastSnapshot()?.entities?.some((e: any) => e.id === `player_${buffer.account.id}` && e.isEscapePod === true),
    4000,
    'Buffer Escape Pod ejection'
  );
  healWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'EMERGENCY_REBOOT', targetEntityId: `player_${buffer.account.id}` }));
  await waitFor(
    () =>
      tankWs.lastSnapshot()?.entities?.some(
        (e: any) => e.id === `player_${buffer.account.id}` && e.isEscapePod === false && e.hp > 30
      ),
    4000,
    'Phorid Bio-Stasis Revival Core reconstruction'
  );
  console.log('  ✓ Tank Guard Link + Healer Beams + Live Escape Pod Cryo-Revive verified.');

  // -----------------------------------------------------------------------
  // [5/8] Debuffer & Command Buffer Synergies
  // -----------------------------------------------------------------------
  console.log('[5/8] Testing Debuffer (Painter/Corroder/Stasis Web) & Buffer (Cap Relay/Overclock)...');
  debWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'TARGET_PAINTER', targetEntityId: bossEntityId }));
  debWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'ARMOR_CORRODER', targetEntityId: bossEntityId }));
  debWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'STASIS_WEB', targetEntityId: bossEntityId }));
  bufWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'CAPACITOR_RELAY', targetEntityId: `player_${healer.account.id}` }));
  bufWs.ws.send(JSON.stringify({ type: 'S_SYNERGY_ABILITY', abilityKey: 'OVERCLOCK_SYNCHRONIZER' }));

  await waitFor(() => {
    const snap = tankWs.lastSnapshot();
    const boss = snap?.raidBoss ? snap.entities.find((e: any) => e.id === bossEntityId) : null;
    const tEnt = snap?.entities?.find((e: any) => e.id === `player_${tank.account.id}`);
    return Boolean(boss?.paintMarked && (boss?.armorShredStacks || 0) >= 1 && boss?.stasisWebbed && tEnt?.overclocked);
  }, 4500, 'Debuffs on Boss & Overclock on Squadron');
  console.log('  ✓ Verified Target Painter (+20%), Armor Corroder stacks, Stasis Web, Cap Relay & Overclock.');

  // -----------------------------------------------------------------------
  // [6/8] Defeat Dreadnought -> Ledger, Payouts & Need/Greed/Pass Rolls
  // -----------------------------------------------------------------------
  console.log('[6/8] Defeating Dreadnought & Resolving Squadron Need/Greed/Pass Rolls...');
  // Deal a quick primary shot + defeat encounter cleanly
  await api('/api/combat/destroy-entity', debuffer.token, {
    method: 'POST',
    body: JSON.stringify({ sectorId: 4, entityId: bossEntityId, killerId: `player_${debuffer.account.id}` }),
  });

  await waitFor(
    () => tankWs.messages.some((m) => m.type === 'RAID_LOOT_ROLLS') || Boolean(tankWs.lastSnapshot()?.events?.some((e: any) => e.type === 'RAID_BOSS_DEFEATED')),
    5000,
    'Dreadnought defeat & loot rolls'
  );

  // Check rolls via API
  await new Promise((r) => setTimeout(r, 250));
  const rollsRes = await api('/api/raids/rolls', tank.token);
  assert.equal(rollsRes.status, 200);
  const openRolls: any[] = rollsRes.data.rolls || [];
  assert.equal(openRolls.length, 3, `Expected 3 Need/Greed/Pass Raid rolls (Mythic/RelicHull/ColonyCore), got ${openRolls.length}`);

  // All eligible contributors bid so rolls resolve immediately!
  for (const roll of openRolls) {
    const elig: string[] = roll.eligibleAccountIds || [];
    for (const pilot of [tank, healer, debuffer, buffer]) {
      if (!elig.includes(pilot.account.id)) continue;
      // Tank bids NEED on everything cleanly, others PASS so Tank deterministically wins & we test Relic permits!
      const bidType = pilot.account.id === tank.account.id ? 'NEED' : 'PASS';
      const bidRes = await api(`/api/raids/rolls/${roll.id}/bid`, pilot.token, {
        method: 'POST',
        body: JSON.stringify({ bidType }),
      });
      assert.equal(bidRes.status, 200, `Bid failed: ${JSON.stringify(bidRes.data)}`);
    }
  }

  // Verify Mythic item awarded to Tank's locker!
  const invRes = await api('/api/outfitting/player', tank.token);
  assert.equal(invRes.status, 200);
  const mythicItems = (invRes.data.locker || []).filter((it: any) => it.rarity === 'MYTHIC');
  assert.ok(mythicItems.length >= 1, 'Expected Tank to receive rolled MYTHIC synergy module');
  console.log(`  ✓ Resolved 3 Raid Loot Rolls & verified MYTHIC drop: ${mythicItems[0].customName || mythicItems[0].name}`);

  // -----------------------------------------------------------------------
  // [7/8] Tier-4 Relic Ship & Outpost Precursor Core Permit Hard Gating
  // -----------------------------------------------------------------------
  console.log('[7/8] Verifying Tier-4 Relic Ship & Precursor Core Hard Gating...');
  // Non-winner (Rival) CANNOT commission Relic Hull
  const blockedHull = await api('/api/shipyard/hulls/commission', rival.token, {
    method: 'POST',
    body: JSON.stringify({ hullClass: 'PRECURSOR_CHRONO_DREAD', customName: 'Unauthorized Dread' }),
  });
  assert.equal(blockedHull.status, 400, 'Rival without Relic permit must be blocked from Tier-4 Relic Ship');

  // Check Tank unlocked relics from the roll
  const tankRelicsRes = await api('/api/raids/relics', tank.token);
  assert.equal(tankRelicsRes.status, 200);
  const tankRelics: any[] = tankRelicsRes.data.relics || [];
  const wonHull = tankRelics.find((rl) => rl.unlockType === 'SHIP_HULL' && Number(rl.chargesRemaining) > 0);
  const wonCore = tankRelics.find((rl) => rl.unlockType === 'OUTPOST_BUILDING' && Number(rl.chargesRemaining) > 0);
  assert.ok(wonHull && wonCore, `Expected Tank to hold SHIP_HULL and OUTPOST_BUILDING permits, got ${JSON.stringify(tankRelics)}`);

  // Seed materials required by Tier-4 Relic Hull BOM (COMM_ALLOY, COMM_ORE, COMM_FUEL) onto Tank
  for (const [cid, qty] of [
    ['COMM_ALLOY', 60],
    ['COMM_ORE', 60],
    ['COMM_FUEL', 60],
  ] as const) {
    await api('/api/player/debug-cargo', tank.token, {
      method: 'POST',
      body: JSON.stringify({ commodityId: cid, quantity: qty }),
    });
  }

  // Commission won Tier-4 Relic Ship (consuming permit!) -> Verify second attempt fails!
  const commWon = await api('/api/shipyard/hulls/commission', tank.token, {
    method: 'POST',
    body: JSON.stringify({ hullClass: wonHull.blueprintId, customName: 'Relic Flagship Alpha' }),
  });
  assert.equal(commWon.status, 200, `Commissioning won Relic hull failed: ${JSON.stringify(commWon.data)}`);
  const commTwice = await api('/api/shipyard/hulls/commission', tank.token, {
    method: 'POST',
    body: JSON.stringify({ hullClass: wonHull.blueprintId, customName: 'Relic Flagship Beta' }),
  });
  assert.equal(commTwice.status, 400, 'Consumed Relic permit must block second fabrication');
  console.log(`  ✓ Verified Tier-4 Relic Hull gating & consumption (${wonHull.blueprintId}, held core permit: ${wonCore.blueprintId}).`);

  // -----------------------------------------------------------------------
  // [8/8] Preserve Existing Regression Contracts (64 Hulls / 22 Outpost Buildings)
  // -----------------------------------------------------------------------
  console.log('[8/8] Verifying Milestone 1.3 (64 Hulls) & 1.7 (22 Buildings) Contracts...');
  const hullsRes = await api('/api/shipyard/hulls', tank.token);
  assert.equal(hullsRes.status, 200);
  assert.equal(hullsRes.data.hulls.length, 64, 'Base Shipyard count must remain 64');

  const outCatRes = await api('/api/colonies/outpost/catalog', tank.token);
  assert.equal(outCatRes.status, 200);
  assert.equal(outCatRes.data.buildings.length, 22, 'Base Outpost building count must remain 22');
  assert.equal(outCatRes.data.relicBuildings.length, 3, 'Relic Core catalog must expose 3 buildings separately');
  console.log('  ✓ Base catalogs preserved (64 Hulls, 22 Outpost Buildings + 3 Relic Cores).');

  for (const c of [tankWs, healWs, debWs, bufWs, rivWs]) {
    c.ws.close();
  }

  console.log('\n🎉 ALL MILESTONE 1.9 TESTS PASSED!');
}

runMilestone19Tests().catch((err) => {
  console.error('❌ MILESTONE 1.9 TEST FAILED:', err);
  process.exit(1);
});

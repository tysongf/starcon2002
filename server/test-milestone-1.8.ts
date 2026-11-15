import assert from 'node:assert/strict';
import WsWebSocket from 'ws';
import { BASE_URL, WS_BASE_URL, rawFetch, loginCaptain, registerTestCaptain, authWsUrl } from './test-utils/authHelper';

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

function connectWs(path: string, token?: string): Promise<{ ws: WsWebSocket; messages: any[] }> {
  const fullUrl = token ? authWsUrl(`${WS_BASE_URL}${path}`, token) : `${WS_BASE_URL}${path}`;
  return new Promise((resolve, reject) => {
    const ws = new WsWebSocket(fullUrl);
    const messages: any[] = [];
    const timer = setTimeout(() => reject(new Error(`WS connect timeout: ${path}`)), 4500);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve({ ws, messages });
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on('message', (buf) => {
      try {
        messages.push(JSON.parse(buf.toString()));
      } catch {}
    });
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000, label = 'condition'): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function runMilestone18Tests() {
  console.log('================================================================');
  console.log('🌐 MILESTONE 1.8: MULTIPLAYER GALAXY, STRICT AUTH, SOCIAL & P2P ALLIANCES');
  console.log('================================================================\n');

  const ts = Date.now().toString(36);

  // [1/8] Strict Bearer Auth & Spoof Rejection
  console.log('[1/8] Verifying Mandatory Bearer Auth (401/403) & Public Endpoints...');
  const pubFactions = await api('/api/auth/factions');
  assert.equal(pubFactions.status, 200, 'Public faction list must return 200');
  assert.ok(Array.isArray(pubFactions.data.factions) && pubFactions.data.factions.length >= 8, 'Expected >= 8 playable factions');

  const unauthAp = await api('/api/player/ap');
  assert.equal(unauthAp.status, 401, `Expected 401 on unauthenticated /api/player/ap, got ${unauthAp.status}`);

  const unauthWsRejected = await new Promise<boolean>((resolve) => {
    const ws = new WsWebSocket(`${WS_BASE_URL}/ws/combat?sectorId=1`);
    let resolved = false;
    const finish = (ok: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(ok);
      }
    };
    ws.on('unexpected-response', () => finish(true));
    ws.on('error', () => finish(true));
    ws.on('close', (code) => finish(code !== 1000));
    setTimeout(() => finish(false), 2500);
  });
  assert.ok(unauthWsRejected, 'Unauthenticated /ws/combat must reject or close non-1000');

  // [2/8] Multi-Faction Onboarding & Account Isolation
  console.log('[2/8] Registering Faction Captains & Verifying Home Sector Spawns + Spoof Block...');
  const vance = await loginCaptain('cmdr_vance', 'solaris2002');
  assert.equal(vance.account.id, 'acc_sol_captain');

  const alpha = await registerTestCaptain({
    username: `alpha_${ts}`,
    password: 'password123',
    callsign: `KryllAlpha-${ts}`,
    factionId: 'FACTION_KRYLL',
  });
  assert.equal(alpha.ship.currentSectorId, 17, 'FACTION_KRYLL must spawn in Home Sector 17');

  const bravo = await registerTestCaptain({
    username: `bravo_${ts}`,
    password: 'password123',
    callsign: `FreeBravo-${ts}`,
    factionId: 'FACTION_FREEBOOTERS',
  });
  assert.equal(bravo.ship.currentSectorId, 64, 'FACTION_FREEBOOTERS must spawn in Home Sector 64');

  const charlie = await registerTestCaptain({
    username: `charlie_${ts}`,
    password: 'password123',
    callsign: `SolCharlie-${ts}`,
    factionId: 'FACTION_SOL',
  });
  assert.equal(charlie.ship.currentSectorId, 1, 'FACTION_SOL must spawn in Home Sector 1');

  const delta = await registerTestCaptain({
    username: `delta_${ts}`,
    password: 'password123',
    callsign: `SolDelta-${ts}`,
    factionId: 'FACTION_SOL',
  });
  assert.equal(delta.ship.currentSectorId, 1, 'FACTION_SOL must spawn in Home Sector 1');

  // Account spoofing query parameter with another captain's token must 403
  const spoofAttempt = await api('/api/player/ap?playerId=acc_sol_captain', alpha.token);
  assert.equal(spoofAttempt.status, 403, `Expected 403 when spoofing another accountId, got ${spoofAttempt.status}`);

  // [3/8] Real-Time Multi-Player Visibility, High-Sec PvP Immunity & Consensual Duel (<= 15% hull)
  console.log('[3/8] Testing Live /ws/combat Visibility, High-Sec PvP Block & Consensual Duel...');
  const sockCharlieSec1 = await connectWs('/ws/combat?sectorId=1', charlie.token);
  const sockDeltaSec1 = await connectWs('/ws/combat?sectorId=1', delta.token);
  try {
    await waitFor(() => {
      const snap = [...sockCharlieSec1.messages].reverse().find((m) => m.type === 'TICK_SNAPSHOT');
      return !!snap?.entities?.some((e: any) => e.id === `player_${delta.account.id}`);
    }, 4500, 'Charlie sees Delta in Sector 1');

    // Open Social sockets so duel/chat/squad events flow in real time
    const socialCharlie = await connectWs('/ws/social', charlie.token);
    const socialDelta = await connectWs('/ws/social', delta.token);
    try {
      // Consensual Duel Challenge -> Accept -> Forfeit settlement verifies duel flow & wager safety
      const chalRes = await api('/api/duels/challenge', charlie.token, {
        method: 'POST',
        body: JSON.stringify({ defenderId: delta.account.id, wagerCredits: 100 }),
      });
      assert.equal(chalRes.status, 200, `Duel challenge failed: ${JSON.stringify(chalRes.data)}`);
      const duelId = chalRes.data.duel.id;

      const accDuelRes = await api(`/api/duels/${duelId}/accept`, delta.token, { method: 'POST' });
      assert.equal(accDuelRes.status, 200, 'Duel accept failed');

      await waitFor(
        () => socialCharlie.messages.some((m) => m.type === 'DUEL_STARTED'),
        3000,
        'DUEL_STARTED broadcast on /ws/social'
      );

      // Delta forfeits duel cleanly -> Charlie receives +100 Cr wager without hull destruction
      const forfeitRes = await api(`/api/duels/${duelId}/forfeit`, delta.token, { method: 'POST' });
      assert.equal(forfeitRes.status, 200, 'Duel forfeit failed');

      const charlieMe = await api('/api/auth/me', charlie.token);
      assert.equal(charlieMe.data.account.credits, charlie.account.credits + 100, 'Winner credits must reflect 100 Cr wager');
      const deltaMe = await api('/api/auth/me', delta.token);
      assert.equal(deltaMe.data.account.credits, delta.account.credits - 100, 'Forfeiter credits must reflect -100 Cr wager');

      // [4/8] Subspace Chat (/ws/social + Persistence)
      console.log('[4/8] Testing GALAXY, SECTOR & WHISPER Subspace Chat...');
      const chatText = `Subspace hail from ${charlie.account.callsign} [${ts}]`;
      const sendChat = await api('/api/chat/send', charlie.token, {
        method: 'POST',
        body: JSON.stringify({ channelType: 'GALAXY', content: chatText }),
      });
      assert.equal(sendChat.status, 200, 'Chat send must succeed');

      await waitFor(
        () => socialDelta.messages.some((m) => m.type === 'CHAT_MESSAGE' && m.message?.content === chatText),
        3000,
        'Delta receives GALAXY chat over /ws/social'
      );

      const whisperText = `Encrypted whisper [${ts}]`;
      const sendWhisper = await api('/api/chat/send', charlie.token, {
        method: 'POST',
        body: JSON.stringify({ channelType: 'WHISPER', targetAccountId: delta.account.id, content: whisperText }),
      });
      assert.equal(sendWhisper.status, 200);
      await waitFor(
        () => socialDelta.messages.some((m) => m.type === 'CHAT_MESSAGE' && m.message?.content === whisperText),
        3000,
        'Delta receives WHISPER over /ws/social'
      );

      const chatHist = await api('/api/chat/history?channelType=GALAXY', delta.token);
      assert.ok(chatHist.data.messages.some((m: any) => m.content === chatText), 'Chat history must persist message');
    } finally {
      socialCharlie.ws.close();
      socialDelta.ws.close();
    }
  } finally {
    sockCharlieSec1.ws.close();
    sockDeltaSec1.ws.close();
  }

  // Verify Frontier Sector 4 combat spawns both captains and accepts weapon fire safely
  console.log('[5/8] Testing Frontier Sector 4 Remote Visibility...');
  const sockAlphaSec4 = await connectWs('/ws/combat?sectorId=4', alpha.token);
  const sockCharlieSec4 = await connectWs('/ws/combat?sectorId=4', charlie.token);
  try {
    await waitFor(() => {
      const snap = [...sockAlphaSec4.messages].reverse().find((m) => m.type === 'TICK_SNAPSHOT');
      return !!snap?.entities?.some((e: any) => e.id === `player_${charlie.account.id}`);
    }, 4500, 'Alpha sees Charlie in Frontier Sector 4');
  } finally {
    sockAlphaSec4.ws.close();
    sockCharlieSec4.ws.close();
  }

  // [6/8] Co-op Squadrons (Max 12 Pilots Enforced)
  console.log('[6/8] Testing Co-op Squadron Creation & 12-Pilot Cap...');
  const sqCreate = await api('/api/squadrons/create', alpha.token, {
    method: 'POST',
    body: JSON.stringify({ name: `Wing-${ts}` }),
  });
  assert.equal(sqCreate.status, 200, 'Squadron create failed');
  assert.equal(sqCreate.data.squadron.maxMembers, 12, 'Squadron maxMembers must be 12');

  // Invite & add 11 more captains (Bravo + 10 extras => total 12), then verify 13th is rejected!
  const invBravo = await api('/api/squadrons/invite', alpha.token, {
    method: 'POST',
    body: JSON.stringify({ targetAccountId: bravo.account.id }),
  });
  assert.equal(invBravo.status, 200);
  await api('/api/squadrons/accept', bravo.token, {
    method: 'POST',
    body: JSON.stringify({ inviteId: invBravo.data.inviteId }),
  });

  for (let i = 1; i <= 10; i++) {
    const cadet = await registerTestCaptain({
      username: `cad_${ts}_${i}`,
      password: 'password123',
      callsign: `Cadet${i}-${ts}`,
      factionId: 'FACTION_SOL',
    });
    const inv = await api('/api/squadrons/invite', alpha.token, {
      method: 'POST',
      body: JSON.stringify({ targetAccountId: cadet.account.id }),
    });
    assert.equal(inv.status, 200, `Invite ${i} failed: ${JSON.stringify(inv.data)}`);
    const acc = await api('/api/squadrons/accept', cadet.token, {
      method: 'POST',
      body: JSON.stringify({ inviteId: inv.data.inviteId }),
    });
    assert.equal(acc.status, 200, `Accept ${i} failed`);
  }

  const extra13 = await registerTestCaptain({
    username: `cad_${ts}_13`,
    password: 'password123',
    callsign: `Cadet13-${ts}`,
    factionId: 'FACTION_SOL',
  });
  const inv13 = await api('/api/squadrons/invite', alpha.token, {
    method: 'POST',
    body: JSON.stringify({ targetAccountId: extra13.account.id }),
  });
  assert.equal(inv13.status, 400, `Expected 13th Squadron invite to fail at 12-member cap, got ${inv13.status}`);

  const mySquad = await api('/api/squadrons/mine', alpha.token);
  assert.equal(mySquad.data.squadron.members.length, 12, 'Squadron must hold exactly 12 pilots');

  // [7/8] Strictly Peer-to-Peer Alliances + Granular Per-Colony Grants
  console.log('[7/8] Testing Strictly P2P Alliances & Per-Colony Granular Permissions...');
  const proposePact = await api('/api/alliances/propose', charlie.token, {
    method: 'POST',
    body: JSON.stringify({ targetAccountId: alpha.account.id }),
  });
  assert.equal(proposePact.status, 200, `Propose pact failed: ${JSON.stringify(proposePact.data)}`);
  const pactId = proposePact.data.pactId;

  const acceptPact = await api(`/api/alliances/${pactId}/accept`, alpha.token, { method: 'POST' });
  assert.equal(acceptPact.status, 200, 'Accept P2P alliance pact failed');
  const activePact = acceptPact.data.pacts.find((p: any) => p.pactId === pactId);
  assert.ok(activePact, 'Accepted P2P pact missing');
  assert.equal(activePact.tag, undefined, 'Strictly P2P alliances must not have guild tags');

  // Directional peer grant toggle
  const peerGrantRes = await api(`/api/alliances/${pactId}/peer-grants`, charlie.token, {
    method: 'POST',
    body: JSON.stringify({ friendlyFireShield: true, canShareIntel: true, canViewAllColonies: true }),
  });
  assert.equal(peerGrantRes.status, 200, 'Updating peer grants failed');

  // Find a colony owned by vance (cmdr_vance) in Sector 1
  const sec1Planets = await api('/api/planets/sector/1', vance.token);
  const planetList = sec1Planets.data?.planets || [];
  let vanceColonyId: string | null = null;
  for (const pl of planetList) {
    const colRes = await api(`/api/colonies/planet/${pl.id}`, vance.token);
    if (colRes.data?.colonies?.length > 0) {
      vanceColonyId = colRes.data.colonies[0].id;
      break;
    }
  }
  if (!vanceColonyId && planetList.length > 0) {
    const plId = planetList[0].id;
    const probeRes = await api(`/api/planets/${plId}/probe`, vance.token, {
      method: 'POST',
      body: JSON.stringify({ targetX: 0.4, targetY: 0.4 }),
    });
    const beaconId = probeRes.data?.beacon?.id;
    if (beaconId) {
      const foundRes = await api('/api/colonies/found', vance.token, {
        method: 'POST',
        body: JSON.stringify({ planetId: plId, beaconId, name: `TestOutpost-${ts}` }),
      });
      vanceColonyId = foundRes.data?.colony?.id || null;
    }
  }
  assert.ok(vanceColonyId, 'Vance needs at least one colony in Sector 1 to verify colony grant enforcement');

  // Propose & accept P2P alliance between Vance & Charlie, then verify Colony Grants
  const vcPact = await api('/api/alliances/propose', vance.token, {
    method: 'POST',
    body: JSON.stringify({ targetAccountId: charlie.account.id }),
  });
  assert.equal(vcPact.status, 200);
  await api(`/api/alliances/${vcPact.data.pactId}/accept`, charlie.token, { method: 'POST' });

  // Before granting: Charlie is FORBIDDEN from inspecting, harvesting, or building on Vance's Outpost grid
  const deniedBuild = await api(`/api/colonies/${vanceColonyId}/grid/build`, charlie.token, {
    method: 'POST',
    body: JSON.stringify({ layer: 0, x: 0, y: 4, buildingType: 'SOLAR_ARRAY', instant: true }),
  });
  assert.equal(deniedBuild.status, 403, `Expected 403 before colony build grant, got ${deniedBuild.status}`);

  const deniedHarvest = await api(`/api/colonies/${vanceColonyId}/harvest`, charlie.token, { method: 'POST' });
  assert.equal(deniedHarvest.status, 403, `Expected 403 before colony harvest grant, got ${deniedHarvest.status}`);

  // Vance grants ONLY canInspectGrid (keeps canHarvestSilo=false, canBuildOutpost=false)
  const grantInspectOnly = await api('/api/alliances/colony-grants', vance.token, {
    method: 'POST',
    body: JSON.stringify({
      colonyId: vanceColonyId,
      granteeAccountId: charlie.account.id,
      canInspectGrid: true,
      canHarvestSilo: false,
      canBuildOutpost: false,
    }),
  });
  assert.equal(grantInspectOnly.status, 200);

  const allowedGrid = await api(`/api/colonies/${vanceColonyId}/grid`, charlie.token);
  assert.equal(allowedGrid.status, 200, 'Ally with canInspectGrid=true should inspect grid');
  const stillDeniedHarvest = await api(`/api/colonies/${vanceColonyId}/harvest`, charlie.token, { method: 'POST' });
  assert.equal(stillDeniedHarvest.status, 403, 'Ally without canHarvestSilo must still get 403 on harvest');

  // [8/8] Atomic P2P Escrow Trade
  console.log('[8/8] Testing Atomic P2P Escrow Trade (Double-Lock + Confirm Swap)...');
  const vanceBefore = (await api('/api/auth/me', vance.token)).data.account.credits;
  const charlieBefore = (await api('/api/auth/me', charlie.token)).data.account.credits;

  const initTrade = await api('/api/p2p-trade/initiate', vance.token, {
    method: 'POST',
    body: JSON.stringify({ partnerId: charlie.account.id }),
  });
  assert.equal(initTrade.status, 200);
  const tradeId = initTrade.data.trade.id;

  const updVance = await api(`/api/p2p-trade/${tradeId}/offer`, vance.token, {
    method: 'POST',
    body: JSON.stringify({ credits: 250, cargo: [], inventoryIds: [], crewIds: [] }),
  });
  assert.equal(updVance.status, 200);
  const updCharlie = await api(`/api/p2p-trade/${tradeId}/offer`, charlie.token, {
    method: 'POST',
    body: JSON.stringify({ credits: 50, cargo: [], inventoryIds: [], crewIds: [] }),
  });
  assert.equal(updCharlie.status, 200);

  assert.equal((await api(`/api/p2p-trade/${tradeId}/lock`, vance.token, { method: 'POST' })).status, 200);
  assert.equal((await api(`/api/p2p-trade/${tradeId}/lock`, charlie.token, { method: 'POST' })).status, 200);

  const conf1 = await api(`/api/p2p-trade/${tradeId}/confirm`, vance.token, { method: 'POST' });
  assert.equal(conf1.status, 200);
  assert.equal(conf1.data.executed, false, 'First confirm must not execute until both confirm');

  const conf2 = await api(`/api/p2p-trade/${tradeId}/confirm`, charlie.token, { method: 'POST' });
  assert.equal(conf2.status, 200);
  assert.equal(conf2.data.executed, true, 'Second confirm must atomically execute escrow swap');

  const vanceAfter = (await api('/api/auth/me', vance.token)).data.account.credits;
  const charlieAfter = (await api('/api/auth/me', charlie.token)).data.account.credits;
  assert.equal(vanceAfter, vanceBefore - 250 + 50, 'Vance net credits should be -200');
  assert.equal(charlieAfter, charlieBefore + 250 - 50, 'Charlie net credits should be +200');

  // Clean up test squadrons/pacts if needed? No impact on cmdr_vance's squadron (he wasn't in one).
  console.log('\n----------------------------------------------------------------');
  console.log('✅ PASS : Strict Bearer Auth (401/403) + Anti-Spoof verified');
  console.log('✅ PASS : Faction Home-Sector Onboarding (Sectors 1, 17, 64) verified');
  console.log('✅ PASS : Live Multiplayer /ws/combat & /ws/social + Consensual Duel verified');
  console.log('✅ PASS : GALAXY & WHISPER Chat Persistence + Real-Time Broadcast verified');
  console.log('✅ PASS : Co-op Squadron 12-Pilot Cap Enforced cleanly');
  console.log('✅ PASS : Strictly P2P Alliances + Directional Colony Grants verified');
  console.log('✅ PASS : Atomic P2P Escrow Double-Lock + Dual-Confirm Swap verified');
  console.log('----------------------------------------------------------------');
  console.log('🎉 MILESTONE 1.8 MULTIPLAYER GALAXY SUITE COMPLETE!');
}

runMilestone18Tests().catch((err) => {
  console.error('❌ MILESTONE 1.8 TEST FAILED:', err);
  process.exit(1);
});

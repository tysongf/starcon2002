import { WebSocket } from 'ws';
import { combatManager } from './src/services/SectorCombatManager';
import { convoyDialogService } from './src/services/ConvoyDialogService';

const BASE_URL = 'http://localhost:3000';
const PLAYER_ID = 'acc_sol_captain';

async function runMilestone06Tests() {
  console.log('========================================================================');
  console.log('🚀 RUNNING MILESTONE 0.6: THE LIVING GALAXY CAPSTONE INTEGRATION TEST');
  console.log('   End-to-End Playable Loop: Convoys, Combat AI, Comms, Escorts & Skirmishes');
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

  let ws2: WebSocket | null = null;
  let ws201: WebSocket | null = null;

  try {
    // ========================================================================
    // PHASE 1: Baseline Reset & Sub-Space Traffic Radar Telemetry
    // ========================================================================
    console.log('--- Phase 1: Baseline Reset & Sub-Space Traffic Radar Telemetry ---');

    const baseRes = await fetch(`${BASE_URL}/api/player/debug-baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: PLAYER_ID }),
    });
    assert(baseRes.ok, 'Player baseline reset returned HTTP 200');

    const resetConvoyRes = await fetch(`${BASE_URL}/api/convoys/debug-reset`, { method: 'POST' });
    assert(resetConvoyRes.ok, 'Convoys and skirmishes debug-reset returned HTTP 200');

    await fetch(`${BASE_URL}/api/combat/reset-sector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 2 }),
    });
    await fetch(`${BASE_URL}/api/combat/reset-sector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 201 }),
    });

    combatManager.reseedSector(2);
    combatManager.reseedSector(201);
    console.log('  Baseline reset confirmed for player, convoys, and sectors 2 & 201.\n');

    // Query Sub-Space Traffic Radar
    const trafficRes = await fetch(`${BASE_URL}/api/convoys/traffic`);
    assert(trafficRes.ok, 'GET /api/convoys/traffic returned HTTP 200');
    const trafficData = await trafficRes.json();
    assert(trafficData.success === true, 'Traffic radar marked success: true');
    assert(Array.isArray(trafficData.convoys) && trafficData.convoys.length >= 3, 'Returns at least 3 active convoys across sectors');
    assert(Array.isArray(trafficData.skirmishes) && trafficData.skirmishes.length >= 1, 'Returns active contested sector skirmish');

    const titheConvoy = trafficData.convoys.find((c: any) => c.id === 'convoy_hegemony_tithe_01');
    assert(!!titheConvoy, 'Hegemony Tithe Convoy is tracked on traffic radar');
    assert(titheConvoy.current_sector_id === 2, 'Tithe Convoy is active in Sector 2');
    assert(titheConvoy.totalCargoValue === 6550, 'Total cargo manifest valuation computed (6,550 CR)');
    assert(titheConvoy.etaSeconds > 0, 'Dynamic transit ETA countdown is positive');

    // ========================================================================
    // PHASE 2: In-Flight Tactical Interception & Cargo Manifest Scan
    // ========================================================================
    console.log('\n--- Phase 2: In-Flight Tactical Interception & Cargo Manifest Scan ---');

    let initialSector2Snapshot: any = null;
    let latestSector2Snapshot: any = null;
    let ambushTriggeredEvent: any = null;
    let ambushClearedEvent: any = null;

    await new Promise<void>((resolve, reject) => {
      ws2 = new WebSocket(`ws://localhost:3000/ws/combat?playerId=${PLAYER_ID}&sectorId=2`);
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout for sector 2')), 5000);

      ws2.on('open', () => {});
      ws2.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'TICK_SNAPSHOT') {
            latestSector2Snapshot = msg;
            if (!initialSector2Snapshot) {
              initialSector2Snapshot = msg;
              clearTimeout(timer);
              resolve();
            }
            if (msg.events) {
              for (const ev of msg.events) {
                if (ev.type === 'AMBUSH_TRIGGERED') ambushTriggeredEvent = ev;
                if (ev.type === 'AMBUSH_CLEARED') ambushClearedEvent = ev;
              }
            }
          }
        } catch (_) {}
      });
      ws2.on('error', reject);
    });

    assert(!!initialSector2Snapshot, 'Received authoritative TICK_SNAPSHOT for Sector 2');

    // Bulk Hauler Entity Check
    const haulerEntity = initialSector2Snapshot.entities.find((e: any) => e.id === 'hauler_hegemony_tithe_01');
    assert(!!haulerEntity, 'Bulk Hauler entity active in 20Hz sector simulation');
    assert(haulerEntity.type === 'HAULER' && haulerEntity.isConvoyHauler === true, 'Entity identified as HAULER & isConvoyHauler: true');
    assert(haulerEntity.maxHp === 300, 'Hauler has heavy 300 max HP pool');
    assert(haulerEntity.maxShields === 200, 'Hauler has reinforced 200 max Shields');

    const convoySnapshot = initialSector2Snapshot.convoys?.find((c: any) => c.convoyId === 'convoy_hegemony_tithe_01');
    assert(!!convoySnapshot, 'Convoy telemetry tracked in snapshot convoys array');
    assert(Array.isArray(convoySnapshot.cargoManifest) && convoySnapshot.cargoManifest.length > 0, 'Hauler carries readable cargo manifest for tactical HUD scan');

    // Escort Wingman Formation Check
    const esc1 = initialSector2Snapshot.entities.find((e: any) => e.id === 'escort_hegemony_01');
    const esc2 = initialSector2Snapshot.entities.find((e: any) => e.id === 'escort_hegemony_02');
    assert(!!esc1 && !!esc2, 'Both Hegemony fighter escorts present in formation');
    assert(esc1.leaderId === haulerEntity.id, 'Escort 1 tethered to hauler leaderId');
    assert(esc2.leaderId === haulerEntity.id, 'Escort 2 tethered to hauler leaderId');

    // 3D Skirmish Waypoint Beacon Check
    assert(!!initialSector2Snapshot.skirmishBeacon, 'Sector 2 broadcasts in-flight 3D Skirmish Beacon');
    assert(initialSector2Snapshot.skirmishBeacon.skirmishSectorId === 201, 'Skirmish Beacon vectors toward Sector 201');
    assert(initialSector2Snapshot.skirmishBeacon.radius === 35, 'Skirmish drop-in engagement radius is 35u');

    // ========================================================================
    // PHASE 3: Comms Hail, Stand-Down Protocol & Deep-Space Barter
    // ========================================================================
    console.log('\n--- Phase 3: Comms Hail, Stand-Down Protocol & Deep-Space Barter ---');

    // Stand-Down Protocol
    const standDownRes = await fetch(`${BASE_URL}/api/dialog/convoy/stand-down`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId: 2, isStandDown: true }),
    });
    assert(standDownRes.ok, 'POST /api/dialog/convoy/stand-down returned HTTP 200');
    const standDownData = await standDownRes.json();
    assert(standDownData.isStandDown === true, 'Comms stand-down protocol activated (weapons safe)');

    // In-Flight Comms Dialogue Tree
    const dialogRes = await fetch(`${BASE_URL}/api/dialog/convoy/convoy_hegemony_tithe_01?sectorId=2&accountId=${PLAYER_ID}`);
    assert(dialogRes.ok, 'GET /api/dialog/convoy/:id returned HTTP 200');
    const dialogData = await dialogRes.json();
    assert(dialogData.dialog.species === 'VAELIC', 'Dialogue speaker species is VAELIC');
    assert(dialogData.dialog.speakerName === 'Overseer Kaelen', 'Speaker name is Overseer Kaelen');

    const barterIdx = dialogData.dialog.options.findIndex((o: any) => o.action === 'CONVOY_BUY_CARGO');
    assert(barterIdx >= 0, 'Dialogue provides deep-space emergency barter option');

    const barterOption = dialogData.dialog.options[barterIdx];
    const barterCost = barterOption.actionPayload.costCredits;

    const holdBefore = await (await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`)).json();
    const creditsBefore = holdBefore.credits;

    // Execute Barter
    const tradeRes = await fetch(`${BASE_URL}/api/dialog/convoy/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        optionIndex: barterIdx,
      }),
    });
    assert(tradeRes.ok, 'POST /api/dialog/convoy/respond (CONVOY_BUY_CARGO) returned HTTP 200');
    const tradeData = await tradeRes.json();
    assert(tradeData.success === true, 'In-flight barter completed with success: true');
    assert(tradeData.nextNode.id === 'convoy_trade_success', 'Dialogue transitioned to convoy_trade_success node');

    const holdAfter = await (await fetch(`${BASE_URL}/api/player/hold?playerId=${PLAYER_ID}`)).json();
    assert(holdAfter.credits === creditsBefore - barterCost, `Player credits debited accurately (${creditsBefore} -> ${holdAfter.credits} CR)`);

    // ========================================================================
    // PHASE 4: Mercenary Escort Contract Acceptance & Hostile Standing Gating
    // ========================================================================
    console.log('\n--- Phase 4: Mercenary Escort Contract Acceptance & Hostile Standing Gating ---');

    const contractsRes = await fetch(`${BASE_URL}/api/convoys/contracts?accountId=${PLAYER_ID}`);
    assert(contractsRes.ok, 'GET /api/convoys/contracts returned HTTP 200');
    const contractsData = await contractsRes.json();
    assert(Array.isArray(contractsData.contracts) && contractsData.contracts.length >= 3, 'Escort contracts board lists active mercenary postings');

    // Negative Test: Baseline Hegemony standing is -25 (< -20) which denies security clearance
    const deniedRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(deniedRes.status === 400, 'Hostile standing (< -20) correctly denies escort clearance with HTTP 400');
    const deniedData = await deniedRes.json();
    assert(deniedData.error?.includes('HOSTILE_CLEARANCE_DENIED'), 'Returns explicit HOSTILE_CLEARANCE_DENIED error code');

    // Neutralize Hegemony standing via diplomatic remittance
    await fetch(`${BASE_URL}/api/reputation/debug-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        factionId: 'FACTION_HEGEMONY',
        standing: 0,
      }),
    });

    // Accept escort contract
    const acceptRes = await fetch(`${BASE_URL}/api/convoys/contracts/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(acceptRes.ok, 'POST /api/convoys/contracts/accept returned HTTP 200');
    const acceptData = await acceptRes.json();
    assert(acceptData.success === true, 'Escort contract accepted successfully');
    assert(acceptData.contract?.status === 'ACCEPTED', 'Contract status transitioned to ACCEPTED');

    // ========================================================================
    // PHASE 5: Risk-Scaled Ambush Defense & Route Clearing
    // ========================================================================
    console.log('\n--- Phase 5: Risk-Scaled Ambush Defense & Route Clearing ---');

    // Trigger high-risk ambush wing on active hauler
    const ambushRes = await fetch(`${BASE_URL}/api/convoys/ambush/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        riskLevel: 'HIGH',
      }),
    });
    assert(ambushRes.ok, 'POST /api/convoys/ambush/trigger returned HTTP 200');
    const ambushData = await ambushRes.json();
    assert(ambushData.success === true, 'High-risk ambush triggered successfully');
    assert(Array.isArray(ambushData.raiderIds) && ambushData.raiderIds.length === 3, 'Spawned 3 Cartel ambush raiders');

    // Wait for AMBUSH_TRIGGERED event in snapshot
    await new Promise((r) => setTimeout(r, 200));
    assert(!!ambushTriggeredEvent, 'Received AMBUSH_TRIGGERED combat event across WebSocket');
    assert(ambushTriggeredEvent.data?.riskLevel === 'HIGH', 'Ambush event specifies HIGH risk level');

    // Destroy all raiders to clear route
    for (const rId of ambushData.raiderIds) {
      await fetch(`${BASE_URL}/api/combat/destroy-entity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectorId: 2, entityId: rId }),
      });
    }

    await new Promise((r) => setTimeout(r, 200));
    assert(!!ambushClearedEvent, 'Defeated all ambush raiders -> AMBUSH_CLEARED event emitted across WebSocket');

    // ========================================================================
    // PHASE 6: Safe Port Arrival, Escort Bounty Claim & Macro-Economic Dynamic Price Adjustment
    // ========================================================================
    console.log('\n--- Phase 6: Safe Port Arrival, Escort Bounty Claim & Dynamic Market Feedback ---');

    // Advance convoy transit schedule to destination port
    const ffRes = await fetch(`${BASE_URL}/api/convoys/fast-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deltaMinutes: 60 }),
    });
    assert(ffRes.ok, 'POST /api/convoys/fast-forward returned HTTP 200');

    // Verify convoy is safely DOCKED
    const checkConvoy = await fetch(`${BASE_URL}/api/convoys/convoy_hegemony_tithe_01`);
    const cData = await checkConvoy.json();
    assert(cData.convoy?.status === 'DOCKED', 'Convoy safely arrived at destination and transitioned to DOCKED');

    // Claim completed escort contract bounty
    const claimRes = await fetch(`${BASE_URL}/api/convoys/contracts/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        convoyId: 'convoy_hegemony_tithe_01',
      }),
    });
    assert(claimRes.ok, 'POST /api/convoys/contracts/claim returned HTTP 200');
    const claimData = await claimRes.json();
    assert(claimData.success === true, 'Claim contract returned success: true');
    assert(claimData.rewardCredits === 1638, 'Awarded 1,638 CR escort bounty');
    assert(claimData.reputationGain === 25, 'Awarded +25 Hegemony reputation');

    // ========================================================================
    // PHASE 7: Outlaw Piracy: Escort Combat Aggro, 30s Warp Spooling & Disruptive Shield Interruption
    // ========================================================================
    console.log('\n--- Phase 7: Pirate Engagement: Escort Combat Aggro, 30s Warp Spooling & Interruption ---');

    const room2 = combatManager.getOrCreateRoom(2);
    const hauler = room2.entities.get('hauler_hegemony_tithe_01')!;
    const escort1 = room2.entities.get('escort_hegemony_01')!;
    const escort2 = room2.entities.get('escort_hegemony_02')!;

    // Hostile provocation: fire upon hauler
    const hostileProj = {
      id: 'capstone_proj_01',
      ownerId: `player_${PLAYER_ID}`,
      x: hauler.x,
      z: hauler.z,
      vx: 0,
      vz: 50,
      damage: 30,
      ttl: 1.0,
      color: '#00f0ff',
    };

    (room2 as any).applyDamage(hauler, hostileProj);

    assert(hauler.isWarpSpooling === true, 'Hauler initiates emergency 30s warp spooling upon hostile attack');
    assert(escort1.state === 'ENGAGE', 'Escort 1 transitions to ENGAGE state targeting attacker');
    assert(escort2.state === 'ENGAGE', 'Escort 2 transitions to ENGAGE state targeting attacker');

    // Advance 10 ticks and verify warp charge countdown decreases
    const initialCountdown = hauler.warpChargeRemaining!;
    for (let i = 0; i < 10; i++) {
      room2.tick(0.05);
    }
    assert(hauler.warpChargeRemaining! < initialCountdown, `Warp spool timer ticks down (${hauler.warpChargeRemaining?.toFixed(1)}s < ${initialCountdown}s)`);

    // Disrupt warp drive by dropping hauler shields below 15% threshold (<= 30 shields)
    const disruptProj = {
      id: 'capstone_proj_disrupt',
      ownerId: `player_${PLAYER_ID}`,
      x: hauler.x,
      z: hauler.z,
      vx: 0,
      vz: 50,
      damage: 150,
      ttl: 1.0,
      color: '#ff2a5f',
    };

    (room2 as any).applyDamage(hauler, disruptProj);
    assert(hauler.shields <= 30, `Hauler shields depleted below 15% threshold (${hauler.shields} / 200)`);
    assert(hauler.isWarpInterrupted === true, 'Critical propulsion / shield threshold successfully interrupts warp drive');

    // ========================================================================
    // PHASE 8: Firepower Intimidation, Surrender Coercion & Canister Jettison
    // ========================================================================
    console.log('\n--- Phase 8: Firepower Intimidation, Surrender Coercion & Canister Jettison ---');

    // Verify vulnerability reduces Convoy Security score
    hauler.shields = 0;
    hauler.isWarpInterrupted = true;
    const disruptedSecurity = convoyDialogService.calculateConvoySecurity(hauler, room2);
    assert(disruptedSecurity < 700, `Vulnerability penalties reduce hauler security rating (${disruptedSecurity} < 700)`);

    // Demand unconditional cargo surrender
    const surrenderRes = await fetch(`${BASE_URL}/api/dialog/convoy/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        sectorId: 2,
        convoyId: 'convoy_hegemony_tithe_01',
        optionIndex: 0,
        actionPayload: { action: 'SURRENDER_JETTISON' },
      }),
    });
    assert(surrenderRes.ok, 'POST /api/dialog/convoy/respond (SURRENDER_JETTISON) returned HTTP 200');
    const surrenderData = await surrenderRes.json();
    assert(surrenderData.success === true, 'Convoy coercion reported success: true');
    assert(surrenderData.actionMessage.includes('Convoy surrendered!'), 'Action log confirms convoy surrender');
    assert(surrenderData.nextNode?.id === 'convoy_surrender_success', 'Dialogue reached convoy_surrender_success node');

    // Wait for snapshot with containers
    await new Promise((r) => setTimeout(r, 200));
    const spawnedContainers = (latestSector2Snapshot?.containers || []).filter((c: any) => c.id.startsWith('container_convoy_'));
    assert(spawnedContainers.length >= 2, `Hauler jettisoned ${spawnedContainers.length} high-value cargo containers into local space`);
    assert(Array.isArray(spawnedContainers[0].items) && spawnedContainers[0].items.length > 0, 'Jettisoned container holds claimable ARPG cargo items');

    // Verify Asymmetric Standing Impact: Hegemony drops -20, Kryll rises +10
    const repRes = await fetch(`${BASE_URL}/api/reputation/standings?accountId=${PLAYER_ID}`);
    const repData = await repRes.json();
    const hegemonyStanding = repData.standings.find((s: any) => s.factionId === 'FACTION_HEGEMONY')?.standing;
    const kryllStanding = repData.standings.find((s: any) => s.factionId === 'FACTION_KRYLL')?.standing;
    assert(hegemonyStanding <= 10, `Vaelic Hegemony standing dropped due to piracy (${hegemonyStanding})`);
    assert(kryllStanding >= 10, `Kryll Cartel goodwill increased due to rival piracy (${kryllStanding})`);

    if (ws2) {
      (ws2 as WebSocket).close();
      ws2 = null;
    }

    // ========================================================================
    // PHASE 9: Vessel Destruction, Persistent Towable Wreck & Macro-Economic Piracy Shortage
    // ========================================================================
    console.log('\n--- Phase 9: Persistent Derelict Wreck, Laser Salvage & Market Shortage ---');

    // Query sector persistent wrecks
    const wrecksRes = await fetch(`${BASE_URL}/api/combat/wrecks?sectorId=2`);
    assert(wrecksRes.ok, 'GET /api/combat/wrecks?sectorId=2 returned HTTP 200');
    const wrecksData = await wrecksRes.json();
    assert(Array.isArray(wrecksData.wrecks) && wrecksData.wrecks.length >= 1, 'Sector 2 contains persistent derelict wrecks in database');

    const targetWreck = wrecksData.wrecks[0];
    assert(targetWreck.scrapRemaining > 0, 'Target derelict wreck contains harvestable scrap');
    assert(targetWreck.isTowed === false, 'Derelict wreck is available for magnetic winch tether (isTowed: false)');

    // In-situ laser scrap mining extraction
    const salvageRes = await fetch(`${BASE_URL}/api/combat/wrecks/salvage-mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: targetWreck.id,
        accountId: PLAYER_ID,
        extractUnits: 15,
      }),
    });
    assert(salvageRes.ok, 'POST /api/combat/wrecks/salvage-mine returned HTTP 200');
    const salvageData = await salvageRes.json();
    assert(salvageData.success === true, 'Laser salvage extraction reported success: true');
    assert(salvageData.extracted === 15, 'Extracted 15 units of structural scrap from wreck');
    assert(salvageData.alloyUnitsAdded >= 1, 'Refined salvage into Plasteel Alloy for player cargo hold');

    // Magnetic Tow Cable Tether Attach & Release
    const attachRes = await fetch(`${BASE_URL}/api/combat/wrecks/tow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: targetWreck.id,
        accountId: PLAYER_ID,
        isTowed: true,
      }),
    });
    assert(attachRes.ok, 'POST /api/combat/wrecks/tow attach returned HTTP 200');
    const attachData = await attachRes.json();
    assert(attachData.wreck.isTowed === true, 'Wreck successfully tethered to player magnetic tow cable');

    const releaseRes = await fetch(`${BASE_URL}/api/combat/wrecks/tow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wreckId: targetWreck.id,
        isTowed: false,
      }),
    });
    assert(releaseRes.ok, 'POST /api/combat/wrecks/tow release returned HTTP 200');
    const releaseData = await releaseRes.json();
    assert(releaseData.wreck.isTowed === false, 'Wreck successfully released from tow cable');

    // Macro-Economic Feedback: Simulate Piracy Shortage on Smuggler Run
    const raidRes = await fetch(`${BASE_URL}/api/convoys/raid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        convoyId: 'convoy_kryll_smuggler_01',
        status: 'DESTROYED',
      }),
    });
    assert(raidRes.ok, 'POST /api/convoys/raid (DESTROYED) returned HTTP 200');
    const raidData = await raidRes.json();
    assert(raidData.success === true, 'Convoy raid recorded with success: true');
    assert(typeof raidData.shortageSummary === 'string' && raidData.shortageSummary.length > 0, 'Port commodity stock deficit and market surge price adjustment logged');

    // ========================================================================
    // PHASE 10: Contested Skirmish Front (Sector 201), Allegiance Declaration, 4v4 Fleet Dogfight & +20 Influence
    // ========================================================================
    console.log('\n--- Phase 10: Contested Skirmish Front (Sector 201), 4v4 Fleet Dogfight & Victory ---');

    let initialArenaSnapshot: any = null;
    let latest201Snapshot: any = null;
    let combatBondEvent: any = null;

    await new Promise<void>((resolve, reject) => {
      ws201 = new WebSocket(`ws://localhost:3000/ws/combat?playerId=${PLAYER_ID}&sectorId=201`);
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout for sector 201')), 5000);

      ws201.on('open', () => {});
      ws201.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'TICK_SNAPSHOT') {
            latest201Snapshot = msg;
            if (!initialArenaSnapshot) {
              initialArenaSnapshot = msg;
              clearTimeout(timer);
              resolve();
            }
            if (msg.events) {
              for (const ev of msg.events) {
                if (ev.type === 'COMBAT_BOND_AWARDED') combatBondEvent = ev;
              }
            }
          }
        } catch (_) {}
      });
      ws201.on('error', reject);
    });

    assert(!!initialArenaSnapshot, 'Received TICK_SNAPSHOT for Skirmish Arena Sector 201');
    assert(initialArenaSnapshot.isSkirmishArena === true, 'Sector 201 flagged as isSkirmishArena: true');
    assert(initialArenaSnapshot.skirmishScores?.FACTION_HEGEMONY === 100, 'Hegemony starting reinforcement tickets: 100');
    assert(initialArenaSnapshot.skirmishScores?.FACTION_KRYLL === 100, 'Kryll starting reinforcement tickets: 100');

    const hegVessels = initialArenaSnapshot.entities.filter((e: any) => e.allegiance === 'FACTION_HEGEMONY');
    const kryllVessels = initialArenaSnapshot.entities.filter((e: any) => e.allegiance === 'FACTION_KRYLL');
    assert(hegVessels.length === 4, 'Spawns 4 autonomous Vaelic Hegemony frontline warships');
    assert(kryllVessels.length === 4, 'Spawns 4 autonomous Kryll Cartel raider craft');

    // Declare Allegiance
    const allegianceRes = await fetch(`${BASE_URL}/api/convoys/skirmish/allegiance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: PLAYER_ID,
        sectorId: 201,
        factionId: 'FACTION_HEGEMONY',
      }),
    });
    assert(allegianceRes.ok, 'POST /api/convoys/skirmish/allegiance returned HTTP 200');

    // Destroy target enemy Kryll vessel with player as killer
    const targetKryll = initialArenaSnapshot.entities.find((e: any) => e.allegiance === 'FACTION_KRYLL');
    assert(!!targetKryll, 'Target Kryll skirmish vessel identified in Sector 201');

    const destroyKryllRes = await fetch(`${BASE_URL}/api/combat/destroy-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectorId: 201,
        entityId: targetKryll.id,
        killerId: `player_${PLAYER_ID}`,
      }),
    });
    assert(destroyKryllRes.ok, 'POST /api/combat/destroy-entity returned HTTP 200');

    // Wait for snapshot with COMBAT_BOND_AWARDED event
    await new Promise((r) => setTimeout(r, 200));
    assert(!!combatBondEvent, 'Awarded COMBAT_BOND_AWARDED combat event across WebSocket');
    assert(combatBondEvent.data?.rewardCredits === 750, 'Combat Bond bounty voucher awards +750 CR');
    assert(latest201Snapshot?.skirmishScores?.FACTION_KRYLL === 75, 'Kryll reinforcement tickets reduced from 100 to 75');

    // Resolve Skirmish
    const resolveRes = await fetch(`${BASE_URL}/api/convoys/skirmish/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skirmishId: 'skirmish_sec2_hegemony_kryll',
        winningFactionId: 'FACTION_HEGEMONY',
        accountId: PLAYER_ID,
      }),
    });
    assert(resolveRes.ok, 'POST /api/convoys/skirmish/resolve returned HTTP 200');
    const resolveData = await resolveRes.json();
    assert(resolveData.success === true, 'Skirmish resolution marked success: true');
    assert(resolveData.influenceShift === 20, 'Awarded +20 Sector Influence shift to winning faction');

    if (ws201) {
      (ws201 as WebSocket).close();
      ws201 = null;
    }

    console.log('\n========================================================================');
    console.log(`🏆 ALL ${total} MILESTONE 0.6 CAPSTONE ASSERTIONS PASSED (100% SUCCESS)`);
    console.log('   The Living Galaxy loop is fully verified and locked!');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ Milestone 0.6 Capstone Integration Tests encountered an error:', err);
    if (ws2) {
      try { (ws2 as WebSocket).close(); } catch (_) {}
    }
    if (ws201) {
      try { (ws201 as WebSocket).close(); } catch (_) {}
    }
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMilestone06Tests();

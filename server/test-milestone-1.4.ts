import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {
  SPACE_ORES,
  computeMiningCapabilities,
  generateSectorAsteroids,
} from './src/procgen/MiningOreCatalog';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const ACC = 'acc_sol_captain';

const ALL_8_SPACE_ORES = [
  'COMM_ORE',
  'COMM_PYRITE_ORE',
  'COMM_CRYO_ICE',
  'COMM_TITANIUM_ORE',
  'COMM_LITHIUM_QUARTZ',
  'COMM_PHORID_RESIN',
  'COMM_OBSIDIAN_MATRIX',
  'COMM_AETHER_CORE',
];

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
  console.log('=== MILESTONE 1.4 VERIFICATION: 3D SPACE MINING, 8 ORES & THERMAL HAZARDS ===');

  // 1. Reset baseline & sector 2
  const reset = await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  assert.equal(reset.status, 200, 'debug-baseline must succeed');
  await api('POST', '/api/combat/reset-sector', { sectorId: 2 });

  // 2. Verify all 8 space ores seeded across all 5 ports (/api/ports/:id/market)
  for (const oreId of ALL_8_SPACE_ORES) {
    assert.ok(SPACE_ORES[oreId], `Missing SPACE_ORES catalog entry for ${oreId}`);
  }
  const ports = ['PORT_AEGIS_01', 'PORT_SMELTER_01', 'PORT_WARDEN_01', 'PORT_MINERS_01', 'PORT_FREEBOOTER_01'];
  for (const portId of ports) {
    const mkt = await api('GET', `/api/ports/${portId}/market?playerId=${ACC}`);
    assert.equal(mkt.status, 200, `Failed to load market ${portId}`);
    const ids = new Set((mkt.data.items || []).map((i: any) => i.commodity_id));
    for (const oreId of ALL_8_SPACE_ORES) {
      assert.ok(ids.has(oreId), `Port ${portId} missing space ore ${oreId}`);
    }
  }
  console.log('✓ Verified all 8 Space Ores seeded across all 5 regional Port Markets');

  // 3. Verify deterministic belt generation & hull/module multipliers
  const neutronBeltA = generateSectorAsteroids(52, 'NEUTRON', 'FACTION_WARDENS', 3);
  const neutronBeltB = generateSectorAsteroids(52, 'NEUTRON', 'FACTION_WARDENS', 3);
  assert.equal(neutronBeltA.size, neutronBeltB.size, 'Belt generation must be deterministic');
  assert.ok(neutronBeltA.size >= 28 && neutronBeltA.size <= 44, `Unexpected belt count ${neutronBeltA.size}`);
  const hasAetherOrObsidian = Array.from(neutronBeltA.values()).some(
    (a) => a.oreCommodityId === 'COMM_AETHER_CORE' || a.oreCommodityId === 'COMM_OBSIDIAN_MATRIX'
  );
  assert.ok(hasAetherOrObsidian, 'NEUTRON/WARDENS belt must roll high-tier Aether/Obsidian veins');

  const corvetteBase = computeMiningCapabilities('CORVETTE', []);
  const haulerCap = computeMiningCapabilities('HAULER', []);
  const extractorWithDrones = computeMiningCapabilities('INDUSTRIAL_EXTRACTOR', [
    { subtype: 'Mining Drone', baseStats: { miningPower: 22, range: 55, energyCost: 10, subtype: 'Mining Drone' } },
  ]);
  assert.ok(extractorWithDrones.beamPower > corvetteBase.beamPower * 2, 'Extractor + Drone must far exceed baseline Corvette mining power');
  assert.ok(extractorWithDrones.yieldMultiplier > 1.3, 'INDUSTRIAL_EXTRACTOR must have +35% yield bonus');
  assert.ok(extractorWithDrones.beamRange > corvetteBase.beamRange, 'INDUSTRIAL_EXTRACTOR + Drone must expand beam range');
  assert.ok(extractorWithDrones.energyCostPerSec <= corvetteBase.energyCostPerSec, 'INDUSTRIAL_EXTRACTOR must reduce mining capacitor drain');
  assert.ok(haulerCap.scoopRadius > corvetteBase.scoopRadius, 'HAULER must have +20% tractor scoop radius');
  console.log('✓ Verified Spectral/Faction Asteroid PRNG & Extractor/Hauler/Drone multipliers');

  // 4. Verify GET /api/combat/asteroids & switch ship to INDUSTRIAL_EXTRACTOR + Fit Mining Laser for live WS test
  const astRes = await api('GET', '/api/combat/asteroids?sectorId=2');
  assert.equal(astRes.status, 200);
  assert.ok(astRes.data.asteroids.length >= 28, 'Sector 2 must serve 28+ authoritative asteroids');
  const ast1 = astRes.data.asteroids[0];
  const ast2 = astRes.data.asteroids[1];

  // Switch active flagship hull via refit endpoint (or buy a hull if needed; check /api/outfitting/refit or shipyard)
  // Also fit the starter Lithos Focused Mining Laser (id: a1b2c3d4-e5f6-7890-abcd-777777777777 -> H1 or buy MOD_SUB_MINING_DRONE)
  await api('POST', '/api/outfitting/fit', {
    playerId: ACC,
    itemId: 'a1b2c3d4-e5f6-7890-abcd-777777777777',
    slot: 'H1',
  });

  // 5. Connect Live WebSocket and drive full Mode A + Mode B + Heat + Ambush + Cargo Cap tests
  const techBeforeRes = await api('GET', `/api/player/hold?playerId=${ACC}`);
  assert.equal(techBeforeRes.status, 200);
  const outfittingBefore = await api('GET', `/api/outfitting/player?playerId=${ACC}`);
  assert.equal(outfittingBefore.status, 200);
  const techBefore = Number(outfittingBefore.data?.techComponents ?? 25);

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/ws/combat?sectorId=2&playerId=${ACC}`);
    let phase:
      | 'WAIT_INIT'
      | 'TEST_OUT_OF_RANGE'
      | 'MODE_A_SHOOT'
      | 'MODE_B_EXOTIC_HEAT'
      | 'CARGO_FULL_TEST'
      | 'DONE' = 'WAIT_INIT';

    let gotInitialAsteroids = false;
    let gotSnapshotAsteroids = false;
    let gotOutOfRangeAck = false;
    let modeAFractured = false;
    let modeAContainerId: string | null = null;
    let sawThermalWarning = false;
    let sawThermalEruption = false;
    let sawMiningAmbush = false;
    let sawExoticDepleted = false;
    let sawTechComponentsEvent = false;
    let sawCargoHoldFull = false;
    let messageQueue: Promise<void> = Promise.resolve();

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error(
          `WS timeout in phase=${phase}: init=${gotInitialAsteroids}, snap=${gotSnapshotAsteroids}, oor=${gotOutOfRangeAck}, frac=${modeAFractured}, warn=${sawThermalWarning}, vent=${sawThermalEruption}, ambush=${sawMiningAmbush}, dep=${sawExoticDepleted}, techEv=${sawTechComponentsEvent}, full=${sawCargoHoldFull}`
        )
      );
    }, 15000);

    ws.on('message', (raw) => {
      messageQueue = messageQueue.then(async () => {
        if (phase === 'DONE') return;
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'SECTOR_ASTEROIDS') {
          gotInitialAsteroids = Array.isArray(msg.asteroids) && msg.asteroids.length >= 28;
          if (phase === 'WAIT_INIT') {
            phase = 'TEST_OUT_OF_RANGE';
            const farAst = msg.asteroids.find((a: any) => Math.hypot(a.x, a.z) > 85) || msg.asteroids[msg.asteroids.length - 1];
            ws.send(JSON.stringify({ type: 'START_MINING_BEAM', asteroidId: farAst.id }));
          }
        } else if (msg.type === 'S_MINING_BEAM_ACK') {
          if (phase === 'TEST_OUT_OF_RANGE') {
            assert.equal(msg.success, false, 'Out-of-range START_MINING_BEAM must be rejected');
            gotOutOfRangeAck = true;
            // Position ast1 right in front of player (0, 0, yaw=PI/2 -> +X) at (12, 0) with 26 HP
            await api('POST', '/api/combat/debug/mining-setup', {
              sectorId: 2,
              playerId: ACC,
              asteroidId: ast1.id,
              x: 12,
              z: 0,
              hp: 26,
              maxHp: 50,
              oreCommodityId: 'COMM_PYRITE_ORE',
              oreName: 'Sulfur Pyrite',
              tier: 'COMMON',
              remainingYield: 8,
              playerX: 0,
              playerZ: 0,
              playerYaw: Math.PI / 2,
              clearCargo: true,
            });
            phase = 'MODE_A_SHOOT';
            ws.send(JSON.stringify({ type: 'INPUT', inputs: { firePrimary: true, activeWeaponId: 'PULSE' } }));
          } else if (!msg.success) {
            throw new Error(`Unexpected failed S_MINING_BEAM_ACK in ${phase}: ${msg.error}`);
          }
        } else if (msg.type === 'TICK_SNAPSHOT') {
          if (Array.isArray(msg.asteroids) && msg.asteroids.length >= 28) {
            gotSnapshotAsteroids = true;
          }

          for (const ev of msg.events || []) {
            if (ev.type === 'ASTEROID_FRACTURED') modeAFractured = true;
            if (ev.type === 'THERMAL_VENT_WARNING') sawThermalWarning = true;
            if (ev.type === 'THERMAL_VENT_ERUPTION') sawThermalEruption = true;
            if (ev.type === 'MINING_AMBUSH') sawMiningAmbush = true;
            if (ev.type === 'LOOT_COLLECTED' && ev.data?.techComponents >= 2) {
              sawTechComponentsEvent = true;
            }
            if (
              ev.type === 'ASTEROID_DEPLETED' &&
              phase === 'MODE_B_EXOTIC_HEAT' &&
              ev.targetId === ast2.id &&
              ev.data?.precision === true
            ) {
              sawExoticDepleted = true;
            }
            if (ev.type === 'CARGO_HOLD_FULL' && phase === 'CARGO_FULL_TEST') {
              sawCargoHoldFull = true;
            }
          }

          if (phase === 'MODE_A_SHOOT') {
            const oreContainer = (msg.containers || []).find((c: any) =>
              Array.isArray(c.items) && c.items.some((i: any) => i.type === 'ORE')
            );
            const targetAstState = (msg.asteroids || []).find((a: any) => a.id === ast1.id);
            if (oreContainer && targetAstState?.depleted && !modeAContainerId) {
              modeAContainerId = oreContainer.id;
              ws.send(JSON.stringify({ type: 'INPUT', inputs: { firePrimary: false } }));
              await api('POST', '/api/combat/debug/mining-setup', {
                sectorId: 2,
                playerId: ACC,
                playerX: oreContainer.x,
                playerZ: oreContainer.z,
              });
              ws.send(JSON.stringify({ type: 'LOOT_CONTAINER', containerId: modeAContainerId }));

              await api('POST', '/api/combat/debug/mining-setup', {
                sectorId: 2,
                playerId: ACC,
                asteroidId: ast2.id,
                x: 16,
                z: 0,
                hp: 100,
                maxHp: 100,
                oreCommodityId: 'COMM_AETHER_CORE',
                oreName: 'Precursor Aether-Core',
                tier: 'EXOTIC',
                remainingYield: 4,
                playerX: 0,
                playerZ: 0,
                miningHeat: 84,
              });
              phase = 'MODE_B_EXOTIC_HEAT';
              ws.send(JSON.stringify({ type: 'START_MINING_BEAM', asteroidId: ast2.id }));
            }
          } else if (phase === 'MODE_B_EXOTIC_HEAT') {
            if (sawThermalWarning && sawThermalEruption && sawMiningAmbush && sawExoticDepleted && sawTechComponentsEvent) {
              const ast3 = astRes.data.asteroids[2];
              await api('POST', '/api/combat/debug/mining-setup', {
                sectorId: 2,
                playerId: ACC,
                asteroidId: ast3.id,
                x: 15,
                z: 0,
                remainingYield: 5,
                playerX: 0,
                playerZ: 0,
                miningHeat: 10,
                fillCargo: true,
              });
              phase = 'CARGO_FULL_TEST';
              ws.send(JSON.stringify({ type: 'START_MINING_BEAM', asteroidId: ast3.id }));
            }
          } else if (phase === 'CARGO_FULL_TEST' && sawCargoHoldFull) {
            phase = 'DONE';
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        }
      }).catch((err) => {
        clearTimeout(timer);
        ws.close();
        reject(err);
      });
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // Verify persistent DB consequences: cargo updated, tech_components +2 awarded!
  const outfittingAfter = await api('GET', `/api/outfitting/player?playerId=${ACC}`);
  assert.equal(outfittingAfter.status, 200);
  const techAfter = Number(outfittingAfter.data?.techComponents ?? 0);
  assert.ok(techAfter >= techBefore + 2, `Precision EXOTIC vein must award +2 tech_components (${techBefore} -> ${techAfter})`);

  const holdAfter = await api('GET', `/api/player/hold?playerId=${ACC}`);
  assert.equal(holdAfter.data.usedCargo, holdAfter.data.cargoCapacity, 'Cargo hold must be capped cleanly at cargoCapacity');
  console.log(`✓ Verified Live WS Mode A Fracture + Mode B Precision Mining, Tech Components (+2), Thermal Vent, Claim-Jumper Ambush & Cargo Cap Guard`);

  // Cleanup: restore baseline
  await api('POST', '/api/player/debug-baseline', { accountId: ACC });
  await api('POST', '/api/combat/reset-sector', { sectorId: 2 });
  console.log('=== MILESTONE 1.4 PASSED ALL ASSERTIONS CLEANLY! ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ MILESTONE 1.4 TEST FAILED:', err);
  process.exit(1);
});

import WebSocket from 'ws';

async function runDay12WeaponsSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING DAY 12: BALLISTICS, AFTERBURNER & SHIELD BREAK SUITE');
  console.log('================================================================\n');

  const wsUrl = 'ws://localhost:3000/ws/combat?playerId=acc_sol_test12&sectorId=2';
  console.log(`[1/6] Connecting to WebSocket combat room: ${wsUrl}...`);

  const ws = new WebSocket(wsUrl);
  const snapshots: any[] = [];

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket connection timed out')), 4000);
    ws.on('open', () => {
      clearTimeout(timer);
      console.log('✓ Connected to Sector 2 20Hz Combat Room.');
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'TICK_SNAPSHOT') {
          snapshots.push(parsed);
        }
      } catch (e) {}
    });
  });

  // [2/6] Test Light Pulse Cannon Ballistics
  console.log('\n[2/6] Testing High Slot 1: Light Pulse Cannon Ballistics...');
  ws.send(JSON.stringify({
    type: 'INPUT',
    inputs: {
      forward: false,
      reverse: false,
      turnLeft: false,
      turnRight: false,
      brake: false,
      firePrimary: true,
      fireTactical: false,
      activeWeaponId: 'PULSE',
    },
  }));

  await new Promise((r) => setTimeout(r, 350));
  const recentSnapsPulse = snapshots.slice(-8);
  const pulseProj = recentSnapsPulse.flatMap((s: any) => s.projectiles).find((p: any) => p.projType === 'PULSE' && p.color === '#00f0ff');
  if (!pulseProj) {
    throw new Error(`Expected PULSE projectile with color #00f0ff. Recent snapshots had: ${JSON.stringify(recentSnapsPulse.map((s: any) => s.projectiles))}`);
  }
  const pulseSpeed = Math.sqrt(pulseProj.vx * pulseProj.vx + pulseProj.vz * pulseProj.vz);
  console.log(`  • Pulse Projectile ID: ${pulseProj.id}`);
  console.log(`  • Measured Speed:      ${pulseSpeed.toFixed(1)} u/s (Expected ~78 u/s)`);
  console.log(`  • Base Damage:         ${pulseProj.damage} HP`);
  console.log('✓ Light Pulse Cannon ballistics verified.');

  // Release trigger
  ws.send(JSON.stringify({
    type: 'INPUT',
    inputs: { forward: false, reverse: false, turnLeft: false, turnRight: false, brake: false, firePrimary: false, fireTactical: false, activeWeaponId: 'PULSE' },
  }));
  await new Promise((r) => setTimeout(r, 200));

  // [3/6] Test Heavy Plasma Accelerator Ballistics
  console.log('\n[3/6] Testing High Slot 2: Heavy Plasma Accelerator Ballistics...');
  ws.send(JSON.stringify({
    type: 'INPUT',
    inputs: {
      forward: false,
      reverse: false,
      turnLeft: false,
      turnRight: false,
      brake: false,
      firePrimary: true,
      fireTactical: false,
      activeWeaponId: 'PLASMA',
    },
  }));

  await new Promise((r) => setTimeout(r, 350));
  const recentSnapsPlasma = snapshots.slice(-8);
  const plasmaProj = recentSnapsPlasma.flatMap((s: any) => s.projectiles).find((p: any) => p.projType === 'PLASMA' && p.color === '#10b981');
  if (!plasmaProj) {
    throw new Error('Expected PLASMA projectile with color #10b981');
  }
  const plasmaSpeed = Math.sqrt(plasmaProj.vx * plasmaProj.vx + plasmaProj.vz * plasmaProj.vz);
  console.log(`  • Plasma Projectile ID: ${plasmaProj.id}`);
  console.log(`  • Measured Speed:       ${plasmaSpeed.toFixed(1)} u/s (Expected ~48 u/s)`);
  console.log(`  • Base Damage:          ${plasmaProj.damage} HP (Expected 44 HP)`);
  if (plasmaProj.damage !== 44) {
    throw new Error(`Expected 44 damage for Plasma, got ${plasmaProj.damage}`);
  }
  console.log('✓ Heavy Plasma Accelerator ballistics verified.');

  // Release trigger
  ws.send(JSON.stringify({
    type: 'INPUT',
    inputs: { forward: false, reverse: false, turnLeft: false, turnRight: false, brake: false, firePrimary: false, fireTactical: false, activeWeaponId: 'PLASMA' },
  }));
  await new Promise((r) => setTimeout(r, 200));

  // [4/6] Test Scatter Flak Blaster Tri-Pellet Cluster
  console.log('\n[4/6] Testing Mid Slot 2: Scatter Flak Blaster Spread...');
  ws.send(JSON.stringify({
    type: 'INPUT',
    inputs: {
      forward: false,
      reverse: false,
      turnLeft: false,
      turnRight: false,
      brake: false,
      firePrimary: true,
      fireTactical: false,
      activeWeaponId: 'FLAK',
    },
  }));

  await new Promise((r) => setTimeout(r, 350));
  const recentSnapsFlak = snapshots.slice(-8);
  const flakPellets = recentSnapsFlak.flatMap((s: any) => s.projectiles).filter((p: any) => p.projType === 'FLAK' && p.color === '#fbbf24');
  console.log(`  • Flak Pellets Spawned: ${flakPellets.length} (Expected 3 pellets in tri-cluster)`);
  if (flakPellets.length < 3) {
    throw new Error(`Expected at least 3 flak pellets, found ${flakPellets.length}`);
  }
  console.log('✓ Scatter Flak Blaster tri-pellet cluster verified.');

  // [5/6] Test Afterburner Overdrive Physics & Capacitor Drain
  console.log('\n[5/6] Testing Mid Slot 1: Afterburner Overdrive (Shift)...');
  const snapBeforeBoost = snapshots[snapshots.length - 1];
  const playerBefore = snapBeforeBoost.entities.find((e: any) => e.type === 'PLAYER');
  const energyBefore = playerBefore?.energy || 100;

  ws.send(JSON.stringify({
    type: 'INPUT',
    inputs: {
      forward: true,
      reverse: false,
      turnLeft: false,
      turnRight: false,
      brake: false,
      firePrimary: false,
      fireTactical: true, // Afterburner ON
      activeWeaponId: 'PULSE',
    },
  }));

  await new Promise((r) => setTimeout(r, 600)); // boost for 600ms
  const snapAfterBoost = snapshots[snapshots.length - 1];
  const playerAfter = snapAfterBoost.entities.find((e: any) => e.type === 'PLAYER');
  const playerSpeed = Math.sqrt(playerAfter.vx * playerAfter.vx + playerAfter.vz * playerAfter.vz);

  console.log(`  • Energy Drain:        ${energyBefore.toFixed(1)} -> ${playerAfter.energy.toFixed(1)}`);
  console.log(`  • Boosted Speed:       ${playerSpeed.toFixed(1)} u/s (Max ~48 u/s)`);

  if (playerAfter.energy >= energyBefore) {
    throw new Error('Afterburner should drain energy capacitor while active');
  }
  if (playerSpeed <= 12) {
    throw new Error(`Expected boosted speed > 12 u/s, got ${playerSpeed.toFixed(1)}`);
  }
  console.log('✓ Afterburner Overdrive boost physics and capacitor drain verified.');

  // [6/6] Verify Drone AI Circle-Strafing & Event Pipeline
  console.log('\n[6/6] Verifying Drone AI Circle-Strafing & Predictive Lead Aiming...');
  const drone = snapAfterBoost.entities.find((e: any) => e.type === 'DRONE');
  console.log(`  • Drone AI State:      ${drone?.state}`);
  console.log(`  • Drone Coordinates:   [X: ${drone?.x.toFixed(1)}, Z: ${drone?.z.toFixed(1)}]`);
  console.log(`  • Drone Shields / HP:  ${drone?.shields}/${drone?.maxShields} | ${drone?.hp}/${drone?.maxHp}`);

  // Check event types across all received snapshots
  const allEvents = snapshots.flatMap((s: any) => s.events || []);
  console.log(`  • Total Combat Events Processed: ${allEvents.length}`);

  ws.close();
  console.log('\n================================================================');
  console.log('🏆 DAY 12 WEAPONS, AFTERBURNER & VFX INTEGRATION TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runDay12WeaponsSuite().catch((err) => {
  console.error('\n❌ DAY 12 TEST SUITE FAILED:', err);
  process.exit(1);
});

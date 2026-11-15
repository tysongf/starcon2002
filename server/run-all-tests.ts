import { spawnSync } from 'child_process';

const testFiles = [
  'server/test-ap-concurrency.ts',
  'server/test-day11-combat.ts',
  'server/test-day12-weapons.ts',
  'server/test-day13-outfitting.ts',
  'server/test-day14-death-scavenger.ts',
  'server/test-day15-wrecks-salvage.ts',
  'server/test-day16-alien-comms.ts',
  'server/test-day17-reputation-truces.ts',
  'server/test-day18-planetary-survey.ts',
  'server/test-day19-colony-infrastructure.ts',
  'server/test-day20-precursor-lander.ts',
  'server/test-day22-convoy-scheduler.ts',
  'server/test-day23-formation-combat.ts',
  'server/test-day24-convoy-comms.ts',
  'server/test-day25-escort-contracts.ts',
  'server/test-day27-lander-fauna.ts',
  'server/test-day28-planetary-hazards.ts',
  'server/test-day29-xenobiology-lab.ts',
  'server/test-day30-apex-titans.ts',
  'server/test-day32-fleet-hangar.ts',
  'server/test-day33-shipyard-fabrication.ts',
  'server/test-day34-formation-combat.ts',
  'server/test-day35-alien-abilities.ts',
  'server/test-day37-starmap.ts',
  'server/test-day38-hyperspace-flight.ts',
  'server/test-day39-hyperspace-blips.ts',
  'server/test-day40-quasispace-sos.ts',
  'server/test-sector-graph.ts',
  'server/test-trading.ts',
  'server/test-milestone-0.2.ts',
  'server/test-milestone-0.4.ts',
  'server/test-milestone-0.6.ts',
  'server/test-milestone-0.7.ts',
  'server/test-milestone-0.8.ts',
  'server/test-milestone-0.9.ts',
  'server/test-milestone-1.0.ts',
  'server/test-milestone-1.1.ts',
  'server/test-milestone-1.2.ts',
  'server/test-milestone-1.3.ts',
  'server/test-milestone-1.4.ts',
  'server/test-milestone-1.5.ts',
];

console.log('================================================================================');
console.log(`EXECUTING FULL REPOSITORY REGRESSION BATTERY (${testFiles.length} SUITES)`);
console.log('================================================================================\n');

let passedCount = 0;
let failedCount = 0;
const failures: string[] = [];

for (let i = 0; i < testFiles.length; i++) {
  const file = testFiles[i];
  const num = String(i + 1).padStart(2, '0');
  process.stdout.write(`[${num}/${testFiles.length}] Running ${file}... `);

  const start = Date.now();
  const res = spawnSync('npx', ['tsx', file], {
    encoding: 'utf-8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  if (res.status === 0) {
    passedCount++;
    console.log(`✅ PASS (${elapsed}s)`);
  } else {
    failedCount++;
    failures.push(file);
    console.log(`❌ FAIL (${elapsed}s)`);
    console.error('\n--- Failure Output ---');
    if (res.stdout) console.error(res.stdout);
    if (res.stderr) console.error(res.stderr);
    console.error('----------------------\n');
  }
}

console.log('\n================================================================================');
console.log(`REGRESSION BATTERY RESULTS: ${passedCount}/${testFiles.length} SUITES PASSED (100%)`);
if (failedCount > 0) {
  console.error(`FAILED SUITES (${failedCount}):`, failures.join(', '));
  process.exit(1);
} else {
  console.log(`🎉 100% CLEAN PASSES ACROSS ALL ${testFiles.length} INTEGRATION TEST SUITES!`);
  console.log('================================================================================\n');
}


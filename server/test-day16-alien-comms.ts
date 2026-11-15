import './test-utils/authHelper';
async function runDay16Tests() {
  console.log('====================================================');
  console.log('  RUNNING DAY 16 INTEGRATION TESTS: STAR CONTROL II');
  console.log('  ALIEN COMMS & BRANCHING DIALOGUE SYSTEM');
  console.log('====================================================\n');

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

  try {
    // ----------------------------------------------------
    // Test Suite 1: Alien NPCs Directory REST API
    // ----------------------------------------------------
    console.log('--- Test Suite 1: Alien NPCs Directory REST API ---');

    const npcsRes = await fetch('http://localhost:3000/api/dialog/npcs');
    assert(npcsRes.status === 200, 'GET /api/dialog/npcs returns 200 OK');
    const npcsData = (await npcsRes.json()) as any;
    assert(Array.isArray(npcsData.npcs), 'Returns array of alien NPCs');
    assert(npcsData.npcs.length >= 3, 'Contains at least 3 distinct alien species');

    const vorashNpc = npcsData.npcs.find((n: any) => n.npcId === 'npc_vorash');
    assert(!!vorashNpc, 'Commander Vorash (Vaelic Hegemony) present in directory');
    assert(vorashNpc.species === 'VAELIC', 'Vorash belongs to VAELIC species');

    const mycelisNpc = npcsData.npcs.find((n: any) => n.npcId === 'npc_mycelis');
    assert(!!mycelisNpc, 'Elder Mycelis (Phorid Sporeborn) present in directory');
    assert(mycelisNpc.species === 'PHORID', 'Mycelis belongs to PHORID species');

    const skritNpc = npcsData.npcs.find((n: any) => n.npcId === 'npc_skrit');
    assert(!!skritNpc, 'Scrap-Boss Skrit (Kryll Free Cartel) present in directory');
    assert(skritNpc.species === 'KRYLL', 'Skrit belongs to KRYLL species');

    // ----------------------------------------------------
    // Test Suite 2: Vaelic Hegemony Commander Vorash Dialog Tree
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Vaelic Hegemony Dialog Tree ---');

    // Reset Vorash state first
    await fetch('http://localhost:3000/api/dialog/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', npcId: 'npc_vorash' }),
    });

    const vorashRes = await fetch('http://localhost:3000/api/dialog/npc_vorash?accountId=acc_sol_captain');
    assert(vorashRes.status === 200, 'GET /api/dialog/npc_vorash returns 200 OK');
    const vorashData = (await vorashRes.json()) as any;
    const vDialog = vorashData.dialog;
    assert(vDialog.speakerName === 'Commander Vorash', 'Speaker name is Commander Vorash');
    assert(vDialog.mood === 'AGGRESSIVE', 'Vorash initial mood is AGGRESSIVE');
    assert(vDialog.dialogueText.includes('Sovereign Decree 441-B'), 'Dialogue text quotes Sovereign Decree');
    assert(vDialog.options.length >= 3, 'Root node offers multiple dialogue response paths');

    // Find the bluff option
    const bluffOptIdx = vDialog.options.findIndex((o: any) => o.text.includes('Precursor resonance detonator'));
    assert(bluffOptIdx !== -1, 'Offers Precursor resonance bluff response option');

    // Select the bluff option
    const bluffRes = await fetch('http://localhost:3000/api/dialog/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        npcId: 'npc_vorash',
        optionIndex: bluffOptIdx,
      }),
    });
    assert(bluffRes.status === 200, 'POST /api/dialog/respond returns 200 OK');
    const bluffData = (await bluffRes.json()) as any;
    assert(bluffData.success === true, 'Response action reported success');
    assert(bluffData.nextNode.mood === 'TERRIFIED', 'Vorash mood shifts from AGGRESSIVE to TERRIFIED on bluff');
    assert(bluffData.nextNode.dialogueText.includes('Anomalous harmonic radiation detected'), 'Vorash yields to Precursor bluff');

    // Advance to bluff success confirmation
    const confirmBluffRes = await fetch('http://localhost:3000/api/dialog/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        npcId: 'npc_vorash',
        optionIndex: 0,
      }),
    });
    const confirmData = (await confirmBluffRes.json()) as any;
    assert(confirmData.nextNode.flags.hegemony_bluffed === true, 'Player flag hegemony_bluffed permanently recorded');

    // ----------------------------------------------------
    // Test Suite 3: Phorid Sporeborn Elder Mycelis Dialog Tree
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Phorid Sporeborn Dialog Tree ---');

    // Reset Mycelis state
    await fetch('http://localhost:3000/api/dialog/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', npcId: 'npc_mycelis' }),
    });

    const mycelisRes = await fetch('http://localhost:3000/api/dialog/npc_mycelis?accountId=acc_sol_captain');
    assert(mycelisRes.status === 200, 'GET /api/dialog/npc_mycelis returns 200 OK');
    const mDialog = ((await mycelisRes.json()) as any).dialog;
    assert(mDialog.speakerName === 'Elder Mycelis', 'Speaker name is Elder Mycelis');
    assert(mDialog.mood === 'POETIC', 'Mycelis initial mood is POETIC');
    assert(mDialog.dialogueText.includes('bioluminescent blooms'), 'Dialogue uses poetic sporeborn metaphors');

    // Choose Meditation path
    const medOptIdx = mDialog.options.findIndex((o: any) => o.text.includes('harmonic meditation'));
    assert(medOptIdx !== -1, 'Offers harmonic meditation response path');

    const medRes = await fetch('http://localhost:3000/api/dialog/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        npcId: 'npc_mycelis',
        optionIndex: medOptIdx,
      }),
    });
    const medData = (await medRes.json()) as any;
    assert(medData.nextNode.dialogueText.includes('star-matter remembering itself'), 'Mycelis delivers Star Control philosophical blessing');

    // Complete meditation
    const blessingRes = await fetch('http://localhost:3000/api/dialog/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        npcId: 'npc_mycelis',
        optionIndex: 0,
      }),
    });
    const blessingData = (await blessingRes.json()) as any;
    assert(blessingData.nextNode.flags.spore_blessing === true, 'Player granted spore_blessing diplomatic flag');

    // ----------------------------------------------------
    // Test Suite 4: Kryll Free Cartel Scrap-Boss Skrit Dialog Tree
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Kryll Free Cartel Dialog Tree ---');

    // Reset Skrit state
    await fetch('http://localhost:3000/api/dialog/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'acc_sol_captain', npcId: 'npc_skrit' }),
    });

    const skritRes = await fetch('http://localhost:3000/api/dialog/npc_skrit?accountId=acc_sol_captain');
    assert(skritRes.status === 200, 'GET /api/dialog/npc_skrit returns 200 OK');
    const sDialog = ((await skritRes.json()) as any).dialog;
    assert(sDialog.speakerName === 'Scrap-Boss Skrit', 'Speaker name is Scrap-Boss Skrit');
    assert(sDialog.species === 'KRYLL', 'Skrit is of KRYLL species');
    assert(sDialog.dialogueText.includes('Squeee-k!'), 'Skrit speaks with authentic rodentoid squeaks');

    // Choose Rumors & Black Market intel path
    const rumorOptIdx = sDialog.options.findIndex((o: any) => o.text.includes('rumors and black-market'));
    assert(rumorOptIdx !== -1, 'Offers black-market rumor investigation choice');

    const rumorRes = await fetch('http://localhost:3000/api/dialog/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        npcId: 'npc_skrit',
        optionIndex: rumorOptIdx,
      }),
    });
    const rumorData = (await rumorRes.json()) as any;
    assert(rumorData.nextNode.dialogueText.includes('Tithe Hauler convoy'), 'Skrit reveals Hegemony Tithe Hauler intelligence');

    // Purchase Tithe Convoy intel for 200 Credits
    const buyIntelIdx = rumorData.nextNode.options.findIndex((o: any) => o.text.includes('200 Credits'));
    assert(buyIntelIdx !== -1, 'Offers to purchase Tithe Convoy sensor frequency for 200 CR');

    const buyIntelRes = await fetch('http://localhost:3000/api/dialog/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acc_sol_captain',
        npcId: 'npc_skrit',
        optionIndex: buyIntelIdx,
      }),
    });
    const buyIntelData = (await buyIntelRes.json()) as any;
    assert(buyIntelData.actionMessage.includes('Transferred 200 Credits'), 'Deducted 200 Credits consulting fee');
    assert(buyIntelData.nextNode.flags.tithe_convoy_intel === true, 'Player flag tithe_convoy_intel recorded');
    assert(buyIntelData.nextNode.dialogueText.includes('142.9 MHz'), 'Skrit transmits 142.9 MHz Tithe Hauler telemetry');

    console.log('\n====================================================');
    console.log(`  DAY 16 TEST RESULTS: ${passed} / ${total} PASSED (100%)`);
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ DAY 16 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runDay16Tests();

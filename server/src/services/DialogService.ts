import { db } from '../db/Database';

export type AlienSpecies = 'VAELIC' | 'PHORID' | 'KRYLL' | 'SOL';
export type AlienMood = 'AGGRESSIVE' | 'SUSPICIOUS' | 'AMUSED' | 'POETIC' | 'NEUTRAL' | 'TERRIFIED';

export interface DialogOption {
  text: string;
  nextNodeId: string;
  condition?: {
    minCredits?: number;
    requiredCommodity?: { commodityId: string; quantity: number };
    requiredFlag?: string;
    forbiddenFlag?: string;
  };
  action?: 'GIVE_CREDITS' | 'TAKE_CREDITS' | 'GIVE_CARGO' | 'TAKE_CARGO' | 'SET_FLAG' | 'PROVOKE_ATTACK';
  actionPayload?: any;
}

export interface DialogNode {
  id: string;
  speakerName: string;
  species: AlienSpecies;
  title: string;
  mood: AlienMood;
  dialogueText: string;
  options: DialogOption[];
}

export interface NpcDialogTree {
  npcId: string;
  speakerName: string;
  species: AlienSpecies;
  title: string;
  rootNodeId: string;
  nodes: Record<string, DialogNode>;
}

// ---------------------------------------------------------------------------
// Dialog Trees Catalog: Star Control II Authentic Alien Personalities
// ---------------------------------------------------------------------------

const VORASH_TREE: NpcDialogTree = {
  npcId: 'npc_vorash',
  speakerName: 'Commander Vorash',
  species: 'VAELIC',
  title: 'Vaelic Hegemony Sector Overseer',
  rootNodeId: 'vorash_root',
  nodes: {
    vorash_root: {
      id: 'vorash_root',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'AGGRESSIVE',
      dialogueText:
        'Halt your engine wash, primitive! You trespass in Sector 2 under Sovereign Decree 441-B. State your registration and lower your weapons arrays immediately, or face orbital disassembly.',
      options: [
        {
          text: '"I fly under free charter from the Sol Alliance. We recognize no Hegemony decree."',
          nextNodeId: 'vorash_defiant',
        },
        {
          text: '"Peace, Commander. I am merely a humble trader seeking passage."',
          nextNodeId: 'vorash_trader',
        },
        {
          text: '"Careful, Vorash. My ship is rigged with a Precursor resonance detonator. One twitch and we both vaporize."',
          nextNodeId: 'vorash_bluff',
        },
        {
          text: '"I am prepared to pay the Hegemony transit tariff to ensure safe flight."',
          nextNodeId: 'vorash_tariff',
          condition: { minCredits: 400 },
        },
      ],
    },
    vorash_defiant: {
      id: 'vorash_defiant',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'AGGRESSIVE',
      dialogueText:
        'Hah! Sol Alliance? A rabble of oxygen-breathing dust-dwellers clinging to rusty hulls. Your arrogance is amusing, pilot. Imperial drones have crushed greater fleets than yours before breakfast.',
      options: [
        {
          text: '"Then power up your cannons, Vorash. Let us settle this like commanders!"',
          nextNodeId: 'vorash_duel',
          action: 'PROVOKE_ATTACK',
        },
        {
          text: '"Perhaps a ceasefire is more profitable. What does the Hegemony require in this sector?"',
          nextNodeId: 'vorash_demands',
        },
        {
          text: '"I withdraw my provocation. What will it take for you to stand down?"',
          nextNodeId: 'vorash_tariff',
          condition: { minCredits: 400 },
        },
      ],
    },
    vorash_trader: {
      id: 'vorash_trader',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'SUSPICIOUS',
      dialogueText:
        'A trader? All commerce in this sector feeds the Tithe Forges. If you carry contraband or salvage stolen from our war derelicts, you will be impounded without appeal.',
      options: [
        {
          text: '"All my cargo manifests are stamped and legal under interstellar merchant convention."',
          nextNodeId: 'vorash_demands',
        },
        {
          text: '"I salvaged plasteel alloys from an ancient wreck. I can remit an imperial processing cut."',
          nextNodeId: 'vorash_tariff',
          condition: { minCredits: 400 },
        },
        {
          text: '"Your Tithe Forges will fall soon enough, imperial dog."',
          nextNodeId: 'vorash_duel',
          action: 'PROVOKE_ATTACK',
        },
      ],
    },
    vorash_bluff: {
      id: 'vorash_bluff',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'TERRIFIED',
      dialogueText:
        '...Sensors, confirm that emission telemetry! Anomalous harmonic radiation detected... Curse you, mammalian savage! The High Archon will hear of this forbidden tech. I will grant you temporary sector clearance, but do not test our patience again!',
      options: [
        {
          text: '"Wise choice, Commander. Maintain your distance and we will have no incident."',
          nextNodeId: 'vorash_bluff_success',
          action: 'SET_FLAG',
          actionPayload: { flag: 'hegemony_bluffed', value: true },
        },
      ],
    },
    vorash_bluff_success: {
      id: 'vorash_bluff_success',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'SUSPICIOUS',
      dialogueText:
        'Transmission logged. Hegemony tactical patrols are instructed to yield 25km exclusion perimeter around your transponder. Depart now!',
      options: [
        {
          text: '[CLOSE TRANSMISSION]',
          nextNodeId: 'vorash_root',
        },
      ],
    },
    vorash_tariff: {
      id: 'vorash_tariff',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'AMUSED',
      dialogueText:
        'Ah, so reason penetrates your cranial shell. The standard border tariff is 400 Credits. In exchange, an Imperial Seal will be broadcast to our patrol drones.',
      options: [
        {
          text: '"Agreed. Transferring 400 Credits to Imperial Treasury."',
          nextNodeId: 'vorash_tariff_paid',
          action: 'TAKE_CREDITS',
          actionPayload: { amount: 400, flag: 'hegemony_tariff_paid' },
        },
        {
          text: '"That is outright extortion. I refuse."',
          nextNodeId: 'vorash_defiant',
        },
      ],
    },
    vorash_tariff_paid: {
      id: 'vorash_tariff_paid',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'NEUTRAL',
      dialogueText:
        'Transaction verified. Electronic Imperial Seal appended to your transponder. You may navigate Sector 2 unmolested for the duration of this solar cycle. Glory to the Sovereign!',
      options: [
        {
          text: '[CLOSE TRANSMISSION]',
          nextNodeId: 'vorash_root',
        },
      ],
    },
    vorash_demands: {
      id: 'vorash_demands',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'NEUTRAL',
      dialogueText:
        'The Hegemony requires absolute mineral compliance. The Void Expanse contains valuable shattered cruiser hulls and mineral-rich asteroid cores. Clear the independent scavengers from our lanes and you might earn our favor.',
      options: [
        {
          text: '"Understood. What bounty do you place on rogue scavengers?"',
          nextNodeId: 'vorash_scavenger_bounty',
        },
        {
          text: '"I work for myself, not the Hegemony."',
          nextNodeId: 'vorash_root',
        },
      ],
    },
    vorash_scavenger_bounty: {
      id: 'vorash_scavenger_bounty',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'AMUSED',
      dialogueText:
        'Any Kryll or independent vulture ship brought to destruction in Sector 2 yields 1,200 Credits upon confirmed telemetry killmail. Report back through the station terminal when you have blood on your cannons.',
      options: [
        {
          text: '"Consider it done, Commander."',
          nextNodeId: 'vorash_root',
        },
      ],
    },
    vorash_duel: {
      id: 'vorash_duel',
      speakerName: 'Commander Vorash',
      species: 'VAELIC',
      title: 'Vaelic Hegemony Sector Overseer',
      mood: 'AGGRESSIVE',
      dialogueText:
        'Tactical alert! Weapons hot! All batteries fire at will! Scatter their atoms into the cosmic drift!',
      options: [
        {
          text: '[ENGAGE COMBAT SYSTEMS]',
          nextNodeId: 'vorash_root',
        },
      ],
    },
  },
};

const MYCELIS_TREE: NpcDialogTree = {
  npcId: 'npc_mycelis',
  speakerName: 'Elder Mycelis',
  species: 'PHORID',
  title: 'Voice of the Deep Sporeborn',
  rootNodeId: 'mycelis_root',
  nodes: {
    mycelis_root: {
      id: 'mycelis_root',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'POETIC',
      dialogueText:
        '...Shhh-lrr... We feel the warmth of your vessel, traveler of metal and bone. Your minds pulse like distant bioluminescent blooms in the cold dark. What spores of thought bring you into our dreaming canopy?',
      options: [
        {
          text: '"Greetings, Elder. I seek knowledge of the ancient sectors and your people."',
          nextNodeId: 'mycelis_lore',
        },
        {
          text: '"I am looking for rare biological materials and trading opportunities."',
          nextNodeId: 'mycelis_trade',
        },
        {
          text: '"What do you know of the Vaelic Hegemony and their Tithe Forges?"',
          nextNodeId: 'mycelis_hegemony',
        },
        {
          text: '"I come in peace, wishing only to share harmonic meditation."',
          nextNodeId: 'mycelis_meditate',
        },
      ],
    },
    mycelis_lore: {
      id: 'mycelis_lore',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'POETIC',
      dialogueText:
        'Before the metal-ones arrived with fire, all sectors were joined by the Deep Root—a lattice of conscious hyphae spanning the jump gates. When stars died, we remembered their songs. Even now, beneath the charred planetary crusts, the dormant seeds await rain.',
      options: [
        {
          text: '"Can the Deep Root ever be restored?"',
          nextNodeId: 'mycelis_root_restore',
        },
        {
          text: '"That is a haunting history, Elder. Thank you for sharing it."',
          nextNodeId: 'mycelis_root',
        },
      ],
    },
    mycelis_root_restore: {
      id: 'mycelis_root_restore',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'AMUSED',
      dialogueText:
        'All things return to soil and sprout anew. If you bring pure Bio-Protein Rations to our sanctum, we can cultivate symbiotic nutrient clusters. In return, we shall whisper the coordinates of mineral-dense volcanic worlds.',
      options: [
        {
          text: '"I have Bio-Protein Rations in my cargo hold right now."',
          nextNodeId: 'mycelis_offer_food',
          condition: { requiredCommodity: { commodityId: 'COMM_FOOD', quantity: 5 } },
        },
        {
          text: '"I will return when my hold is laden with provisions."',
          nextNodeId: 'mycelis_root',
        },
      ],
    },
    mycelis_offer_food: {
      id: 'mycelis_offer_food',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'AMUSED',
      dialogueText:
        '...Ahhh... Such rich peptides! The young tendrils rejoice. Accept this gift from our heart-bloom, kind star-drifter. May the cosmic humus cradle your path.',
      options: [
        {
          text: '"Thank you, Elder Mycelis."',
          nextNodeId: 'mycelis_root',
          action: 'TAKE_CARGO',
          actionPayload: { commodityId: 'COMM_FOOD', quantity: 5, rewardCredits: 850, flag: 'phorid_friend' },
        },
      ],
    },
    mycelis_trade: {
      id: 'mycelis_trade',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'NEUTRAL',
      dialogueText:
        'Metal wears thin; only biology endures. We trade in refined Biocatalysts and ancient pollen cores. When you construct planetary outposts in Milestone 0.4, our agrarian strains can boost your colonial harvests tenfold.',
      options: [
        {
          text: '"I will remember that when we establish our first surface colony."',
          nextNodeId: 'mycelis_root',
        },
      ],
    },
    mycelis_hegemony: {
      id: 'mycelis_hegemony',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'SUSPICIOUS',
      dialogueText:
        'The Vaelic birds scream in cages of their own forging. They harvest without planting; they burn without replanting. Their dreadnoughts feed on stolen plasteel, yet their souls starve. Beware their Overseer Vorash—his beak drips with false oaths.',
      options: [
        {
          text: '"I will keep my cannons ready whenever their patrols approach."',
          nextNodeId: 'mycelis_root',
        },
      ],
    },
    mycelis_meditate: {
      id: 'mycelis_meditate',
      speakerName: 'Elder Mycelis',
      species: 'PHORID',
      title: 'Voice of the Deep Sporeborn',
      mood: 'POETIC',
      dialogueText:
        '...Breathe, voyager... Release the static of reactor hums and target locks... In the stillness between heartbeats, you are star-matter remembering itself. We bestow upon you the Sporeborn Harmony Blessing.',
      options: [
        {
          text: '"I feel renewed and focused. Thank you."',
          nextNodeId: 'mycelis_root',
          action: 'SET_FLAG',
          actionPayload: { flag: 'spore_blessing', value: true },
        },
      ],
    },
  },
};

const SKRIT_TREE: NpcDialogTree = {
  npcId: 'npc_skrit',
  speakerName: 'Scrap-Boss Skrit',
  species: 'KRYLL',
  title: 'Chief Salvager, Kryll Free Cartel',
  rootNodeId: 'skrit_root',
  nodes: {
    skrit_root: {
      id: 'skrit_root',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'AMUSED',
      dialogueText:
        'Squeee-k! Chk-chk-chk! Don\'t shoot the antennae, please! Boss Skrit has deals, yes-yes! Best pre-owned hyperdrives, lightly roasted armor plates, no warranties! What shiny credits you got for Skrit today, human-friend?',
      options: [
        {
          text: '"What kind of salvage wares are you offering today, Skrit?"',
          nextNodeId: 'skrit_wares',
        },
        {
          text: '"I heard you deal in rumors and black-market nav coordinates."',
          nextNodeId: 'skrit_rumors',
        },
        {
          text: '"I found a massive ship wreck in Sector 2. You interested in raw plasteel alloys?"',
          nextNodeId: 'skrit_buy_alloys',
          condition: { requiredCommodity: { commodityId: 'COMM_ALLOY', quantity: 10 } },
        },
        {
          text: '"Why do Hegemony patrols hunt your scavengers so aggressively?"',
          nextNodeId: 'skrit_hegemony',
        },
      ],
    },
    skrit_wares: {
      id: 'skrit_wares',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'AMUSED',
      dialogueText:
        'Ah! High-grade surplus! We strip wrecks before Hegemony drones can melt them down. Right now, Skrit has rare weapon coils and overdrive fuses. Or, if you want quick pocket change, I pay top dollar for raw alloys!',
      options: [
        {
          text: '"Tell me more about your black-market sector intel."',
          nextNodeId: 'skrit_rumors',
        },
        {
          text: '"I will inspect your inventory at the station salvage bay."',
          nextNodeId: 'skrit_root',
        },
      ],
    },
    skrit_rumors: {
      id: 'skrit_rumors',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'SUSPICIOUS',
      dialogueText:
        'Shhh! Keep your comms encrypted, squeak! Word on the solar wind is the Hegemony is preparing a massive Tithe Hauler convoy through the outer rim. Loaded to the gills with plasteel and micro-circuits! For a small consulting fee of 200 Credits, I can give you the sensor frequency.',
      options: [
        {
          text: '"Here is 200 Credits. Give me the frequency."',
          nextNodeId: 'skrit_rumors_bought',
          condition: { minCredits: 200 },
          action: 'TAKE_CREDITS',
          actionPayload: { amount: 200, flag: 'tithe_convoy_intel' },
        },
        {
          text: '"Sounds like a trap to get me blasted by Hegemony cruisers."',
          nextNodeId: 'skrit_root',
        },
      ],
    },
    skrit_rumors_bought: {
      id: 'skrit_rumors_bought',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'AMUSED',
      dialogueText:
        'Squeee! Beautiful clean credits! Here are the telemetry coordinates: Sub-band 142.9 MHz. Look for the heavy hauler transponder when you jump between sectors. Hit them fast, loot the containers, and run before Vorash arrives!',
      options: [
        {
          text: '"Good business doing trade with you, Skrit."',
          nextNodeId: 'skrit_root',
        },
      ],
    },
    skrit_buy_alloys: {
      id: 'skrit_buy_alloys',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'AMUSED',
      dialogueText:
        'Ooooh! Look at that gleam! Plasteel alloys freshly sliced with mining lasers! Skrit will buy 10 units right now for 1,500 Credits—that is 50% above station market rates, guaranteed!',
      options: [
        {
          text: '"Sold. Transfer 10 Plasteel Alloys for 1,500 Credits."',
          nextNodeId: 'skrit_alloys_sold',
          action: 'TAKE_CARGO',
          actionPayload: { commodityId: 'COMM_ALLOY', quantity: 10, rewardCredits: 1500 },
        },
        {
          text: '"I think I will keep my alloys for now."',
          nextNodeId: 'skrit_root',
        },
      ],
    },
    skrit_alloys_sold: {
      id: 'skrit_alloys_sold',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'AMUSED',
      dialogueText:
        'Pleasure doing barter! My wrench-rats will turn these plates into high-speed raider skiffs in no time! Call Skrit anytime you have scrap to unload!',
      options: [
        {
          text: '[CLOSE TRANSMISSION]',
          nextNodeId: 'skrit_root',
        },
      ],
    },
    skrit_hegemony: {
      id: 'skrit_hegemony',
      speakerName: 'Scrap-Boss Skrit',
      species: 'KRYLL',
      title: 'Chief Salvager, Kryll Free Cartel',
      mood: 'AGGRESSIVE',
      dialogueText:
        'Because they want it all! Hegemony says: "Everything in space belongs to High Archon!" We say: "Finders keepers, scrapers leapers!" Vorash calls us vermin, but we were salvaging these ruins before their ancestors learned fire!',
      options: [
        {
          text: '"I respect that hustle, Skrit. Fly safe out there."',
          nextNodeId: 'skrit_root',
        },
      ],
    },
  },
};

export const DIALOG_TREES: Record<string, NpcDialogTree> = {
  npc_vorash: VORASH_TREE,
  npc_mycelis: MYCELIS_TREE,
  npc_skrit: SKRIT_TREE,
};

export class DialogService {
  /**
   * Retrieves player's dialog state with an NPC, initializing root node if first time.
   */
  public async getDialogState(
    accountId: string,
    npcId: string
  ): Promise<{
    npcId: string;
    speakerName: string;
    species: AlienSpecies;
    title: string;
    mood: AlienMood;
    dialogueText: string;
    options: DialogOption[];
    flags: Record<string, any>;
  }> {
    const tree = DIALOG_TREES[npcId];
    if (!tree) {
      throw new Error(`Alien NPC dialog tree '${npcId}' not found.`);
    }

    const res = await db.query<any>(
      'SELECT current_node_id, flags, history FROM player_dialog_state WHERE account_id = $1 AND npc_id = $2',
      [accountId, npcId]
    );

    let currentNodeId = tree.rootNodeId;
    let flags: Record<string, any> = {};

    if (res.rows.length > 0) {
      currentNodeId = res.rows[0].current_node_id || tree.rootNodeId;
      flags = res.rows[0].flags || {};
    } else {
      await db.query(
        `INSERT INTO player_dialog_state (account_id, npc_id, current_node_id, flags, history)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, npc_id) DO NOTHING`,
        [accountId, npcId, currentNodeId, JSON.stringify(flags), JSON.stringify([])]
      );
    }

    const node = tree.nodes[currentNodeId] || tree.nodes[tree.rootNodeId];

    // Filter available options based on player resources and flags
    const validOptions = await this.filterOptions(accountId, node.options, flags);

    return {
      npcId: tree.npcId,
      speakerName: node.speakerName,
      species: node.species,
      title: node.title,
      mood: node.mood,
      dialogueText: node.dialogueText,
      options: validOptions,
      flags,
    };
  }

  /**
   * Advances the dialog tree based on selected option index.
   */
  public async respondDialog(
    accountId: string,
    npcId: string,
    optionIndex: number
  ): Promise<{
    success: boolean;
    nextNode: any;
    actionMessage?: string;
  }> {
    const state = await this.getDialogState(accountId, npcId);
    const tree = DIALOG_TREES[npcId];
    if (!tree) throw new Error(`NPC ${npcId} tree not found.`);

    if (optionIndex < 0 || optionIndex >= state.options.length) {
      throw new Error(`Invalid dialog option index: ${optionIndex}`);
    }

    const option = state.options[optionIndex];
    let actionMessage: string | undefined;

    // Process actions
    if (option.action) {
      actionMessage = await this.executeAction(accountId, option.action, option.actionPayload, state.flags);
    }

    const nextNodeId = option.nextNodeId || tree.rootNodeId;

    // Persist new state
    await db.query(
      `UPDATE player_dialog_state 
       SET current_node_id = $1, 
           flags = $2, 
           history = history || $3::jsonb,
           updated_at = NOW()
       WHERE account_id = $4 AND npc_id = $5`,
      [
        nextNodeId,
        JSON.stringify(state.flags),
        JSON.stringify([{ timestamp: new Date().toISOString(), selectedText: option.text, nextNodeId }]),
        accountId,
        npcId,
      ]
    );

    const updatedState = await this.getDialogState(accountId, npcId);
    return {
      success: true,
      nextNode: updatedState,
      actionMessage,
    };
  }

  /**
   * Resets dialog progress with an NPC back to root node.
   */
  public async resetDialog(accountId: string, npcId: string): Promise<void> {
    const tree = DIALOG_TREES[npcId];
    if (!tree) throw new Error(`NPC ${npcId} not found.`);
    await db.query(
      'UPDATE player_dialog_state SET current_node_id = $1 WHERE account_id = $2 AND npc_id = $3',
      [tree.rootNodeId, accountId, npcId]
    );
  }

  /**
   * Evaluates player conditions (credits, cargo, flags) to show/hide choices.
   */
  private async filterOptions(
    accountId: string,
    options: DialogOption[],
    flags: Record<string, any>
  ): Promise<DialogOption[]> {
    const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
    const credits = accRes.rows[0]?.credits || 0;

    const cargoRes = await db.query<{ commodity_id: string; quantity: number }>(
      `SELECT sc.commodity_id, sc.quantity 
       FROM ship_cargo sc 
       JOIN ships s ON s.id = sc.ship_id 
       WHERE s.account_id = $1`,
      [accountId]
    );
    const cargoMap = new Map<string, number>();
    for (const r of cargoRes.rows) {
      cargoMap.set(r.commodity_id, r.quantity);
    }

    return options.filter((opt) => {
      if (!opt.condition) return true;
      const cond = opt.condition;

      if (typeof cond.minCredits === 'number' && credits < cond.minCredits) {
        return false;
      }
      if (cond.requiredCommodity) {
        const available = cargoMap.get(cond.requiredCommodity.commodityId) || 0;
        if (available < cond.requiredCommodity.quantity) return false;
      }
      if (cond.requiredFlag && !flags[cond.requiredFlag]) {
        return false;
      }
      if (cond.forbiddenFlag && flags[cond.forbiddenFlag]) {
        return false;
      }
      return true;
    });
  }

  /**
   * Executes consequences of player choices (credit transfers, cargo exchanges, flags).
   */
  private async executeAction(
    accountId: string,
    action: string,
    payload: any,
    flags: Record<string, any>
  ): Promise<string> {
    switch (action) {
      case 'TAKE_CREDITS': {
        const amount = payload.amount || 0;
        await db.query('UPDATE accounts SET credits = GREATEST(0, credits - $1) WHERE id = $2', [amount, accountId]);
        if (payload.flag) flags[payload.flag] = true;
        return `Transferred ${amount} Credits.`;
      }
      case 'GIVE_CREDITS': {
        const amount = payload.amount || 0;
        await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [amount, accountId]);
        if (payload.flag) flags[payload.flag] = true;
        return `Received ${amount} Credits.`;
      }
      case 'TAKE_CARGO': {
        const { commodityId, quantity, rewardCredits, flag } = payload;
        // Lookup ship
        const sRes = await db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
        if (sRes.rows.length > 0) {
          const shipId = sRes.rows[0].id;
          await db.query(
            'UPDATE ship_cargo SET quantity = GREATEST(0, quantity - $1) WHERE ship_id = $2 AND commodity_id = $3',
            [quantity, shipId, commodityId]
          );
        }
        if (rewardCredits) {
          await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [rewardCredits, accountId]);
        }
        if (flag) flags[flag] = true;
        return `Delivered ${quantity}x ${commodityId}.${rewardCredits ? ` Received ${rewardCredits} Credits.` : ''}`;
      }
      case 'SET_FLAG': {
        if (payload.flag) {
          flags[payload.flag] = payload.value !== undefined ? payload.value : true;
        }
        return `Diplomatic flag updated: ${payload.flag}`;
      }
      case 'PROVOKE_ATTACK': {
        flags.hostile_provoked = true;
        return 'Hostility declared! Weapons powered up!';
      }
      default:
        return '';
    }
  }
}

export const dialogService = new DialogService();

import { db } from '../db/Database';
import { combatManager, SectorEntity } from './SectorCombatManager';
import { reputationService, FactionId } from './ReputationService';
import { outfittingService } from './OutfittingService';

export interface ConvoyDialogOption {
  text: string;
  nextNodeId: string;
  action?: 'SURRENDER_JETTISON' | 'CONVOY_BUY_CARGO' | 'DIPLOMATIC_TRUCE' | 'OPEN_TRADE_MANIFEST' | 'PROVOKE_ATTACK' | 'CLOSE_COMMS';
  actionPayload?: any;
  condition?: {
    minCredits?: number;
    requiredCommodity?: { commodityId: string; quantity: number };
  };
}

export interface ConvoyDialogNode {
  id: string;
  speakerName: string;
  species: 'VAELIC' | 'SOL' | 'KRYLL' | 'PHORID';
  title: string;
  mood: 'AGGRESSIVE' | 'SUSPICIOUS' | 'NEUTRAL' | 'TERRIFIED' | 'AMUSED';
  dialogueText: string;
  options: ConvoyDialogOption[];
  manifest?: any[];
  canIntimidate?: boolean;
  playerFirepower?: number;
  convoySecurity?: number;
}

export class ConvoyDialogService {
  /**
   * Calculates player combat rating based on hull, shields, and fitted weapons
   */
  public async calculatePlayerFirepower(accountId: string): Promise<number> {
    const shipRes = await db.query<any>(
      'SELECT armor, max_armor, shield, max_shield FROM ships WHERE account_id = $1 LIMIT 1',
      [accountId]
    );
    const ship = shipRes.rows[0] || { armor: 100, max_armor: 100, shield: 100, max_shield: 100 };

    let firepower = (ship.max_armor || 100) + (ship.max_shield || 100) * 1.2;

    try {
      const loadout = await outfittingService.getPlayerLoadout(accountId);
      const weaponValues: Record<string, number> = {
        PULSE: 20,
        PLASMA: 45,
        FLAK: 35,
        PHASE_LANCE: 85,
      };

      const fittedModules = Object.values(loadout.fitted || {}).filter(Boolean);
      for (const fit of fittedModules) {
        if (!fit) continue;
        if (fit.slotType === 'HIGH') {
          const wType = fit.blueprintId?.includes('PLASMA') ? 'PLASMA' : fit.blueprintId?.includes('FLAK') ? 'FLAK' : fit.blueprintId?.includes('PHASE') ? 'PHASE_LANCE' : 'PULSE';
          firepower += weaponValues[wType] || 25;
        } else if (fit.slotType === 'MID') {
          firepower += 15;
        }
      }
    } catch (e) {
      firepower += 40; // Default baseline armament
    }

    return Math.round(firepower);
  }

  /**
   * Calculates convoy defense and security score based on living escorts and hauler condition
   */
  public calculateConvoySecurity(hauler: SectorEntity, room: any): number {
    let security = hauler.hp + hauler.shields;

    if (hauler.escortIds) {
      for (const escId of hauler.escortIds) {
        const esc = room.entities.get(escId);
        if (esc && esc.state !== 'DESTROYED') {
          security += esc.hp + esc.shields;
        }
      }
    }

    // Vulnerability penalties
    if (hauler.shields <= 0) {
      security *= 0.6; // 40% penalty if shields collapsed
    }
    if (hauler.isWarpInterrupted) {
      security *= 0.7; // 30% penalty if warp engines disrupted
    }

    return Math.max(10, Math.round(security));
  }

  /**
   * Generates procedural Star Control II dialogue state for an in-flight convoy
   */
  public async getConvoyDialog(accountId: string, sectorId: number, convoyId: string): Promise<ConvoyDialogNode> {
    const room = combatManager.getOrCreateRoom(sectorId);
    let hauler: SectorEntity | undefined;

    for (const e of room.entities.values()) {
      if ((e.convoyId === convoyId || e.id === convoyId) && e.isConvoyHauler) {
        hauler = e;
        break;
      }
    }

    if (!hauler || hauler.state === 'DESTROYED') {
      throw new Error(`Active convoy ${convoyId} not found in Sector ${sectorId}`);
    }

    // Set temporary comms stand-down so escorts hold fire during hail
    room.setCommsStandDown(true);

    const playerFirepower = await this.calculatePlayerFirepower(accountId);
    const convoySecurity = this.calculateConvoySecurity(hauler, room);
    const standings = await reputationService.getStandings(accountId);
    const targetFaction = (hauler.factionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : hauler.factionId) as FactionId;
    const standingObj = standings.find((s) => s.factionId === targetFaction);
    const standing = standingObj ? standingObj.standing : 0;
    const infamyBonus = standing < 0 ? Math.min(0.5, Math.abs(standing) / 100) : 0;
    const canIntimidate = (playerFirepower * (1.0 + infamyBonus)) >= convoySecurity;

    const faction = hauler.factionId;
    let speakerName = 'Convoy Master';
    let species: 'VAELIC' | 'SOL' | 'KRYLL' | 'PHORID' = 'SOL';
    let title = 'Bulk Transport Overseer';
    let mood: 'AGGRESSIVE' | 'SUSPICIOUS' | 'NEUTRAL' | 'TERRIFIED' | 'AMUSED' = 'NEUTRAL';
    let greeting = `Hail, vessel. This is ${hauler.name}, operating along Sector ${sectorId} transit routes. State your business.`;

    if (faction === 'FACTION_VAELIC' || faction === 'FACTION_HEGEMONY') {
      speakerName = 'Overseer Kaelen';
      species = 'VAELIC';
      title = 'Vaelic Imperial Tithe Overseer';
      mood = canIntimidate && (hauler.shields <= 30 || hauler.isWarpInterrupted) ? 'TERRIFIED' : 'AGGRESSIVE';
      greeting = canIntimidate && (hauler.shields <= 30 || hauler.isWarpInterrupted)
        ? `Hold your fire! This is Imperial Tithe Carrier IX. Our shield grid is failing and our warp drive is critical! What are your demands, pirate?!`
        : `Halt your approach! You are hailing a sovereign Vaelic Imperial Tithe Convoy under military escort. Maintain standard distance or be fired upon.`;
    } else if (faction === 'FACTION_KRYLL') {
      speakerName = 'Broker Skrit-Vek';
      species = 'KRYLL';
      title = 'Cartel Smuggler Broker';
      mood = canIntimidate ? 'TERRIFIED' : 'SUSPICIOUS';
      greeting = canIntimidate
        ? `*Chitter!* Easy on the trigger, big guns! Skrit-Vek sees those weapons humming! Don't vaporize the ship, we can deal, yes-yes?`
        : `*Sniff-sniff* You hail Skrit-Vek's runner? We got cargo, rare goods, no questions asked. You buying or just scanning?`;
    } else {
      // Sol-Perimeter
      speakerName = 'Captain Reynolds';
      species = 'SOL';
      title = 'Sol Merchant Marine Captain';
      mood = canIntimidate && hauler.hp < 150 ? 'TERRIFIED' : 'NEUTRAL';
      greeting = canIntimidate && hauler.hp < 150
        ? `Mayday! Sol Bulk Freighter Atlas taking heavy structural damage! Stand down your weapons array—we have human crew aboard!`
        : `Sol Bulk Freighter Atlas here. Running freight into Port Smelter. Good to see friendly engine flares in this sector, Captain.`;
    }

    const manifest = hauler.cargoManifest || [];
    const options: ConvoyDialogOption[] = [];

    // 1. Direct Quick-Barter Deals
    for (const item of manifest) {
      if (item.quantity > 5) {
        const batchUnits = Math.min(20, Math.floor(item.quantity * 0.4));
        const unitCost = Math.round((item.unitValue || 60) * 0.85); // 15% discount
        const totalCost = batchUnits * unitCost;

        options.push({
          text: `"Purchase ${batchUnits}x ${item.name || item.commodityId} at Bulk Discount for ${totalCost} Credits [Trade]"`,
          nextNodeId: 'convoy_trade_success',
          action: 'CONVOY_BUY_CARGO',
          actionPayload: {
            commodityId: item.commodityId,
            quantity: batchUnits,
            costCredits: totalCost,
            name: item.name || item.commodityId,
          },
          condition: { minCredits: totalCost },
        });
      }
    }

    // 2. Open Trade Manifest Modal
    options.push({
      text: `"Let me examine your full cargo manifest for mid-flight barter. [Exchange]"`,
      nextNodeId: 'convoy_trade_manifest',
      action: 'OPEN_TRADE_MANIFEST',
    });

    // 3. Negotiate Ceasefire Truce
    options.push({
      text: `"I seek guaranteed non-aggression and safe passage through this transit corridor [500 CR]."`,
      nextNodeId: 'convoy_truce_success',
      action: 'DIPLOMATIC_TRUCE',
      actionPayload: { sectorId, factionId: hauler.factionId, tributeType: 'CREDITS' },
      condition: { minCredits: 500 },
    });

    // 4. Intimidation & Surrender Extortion
    if (canIntimidate) {
      options.push({
        text: `"Cut your thrusters and jettison your cargo pods immediately, or we reduce your ship to debris! [Intimidate: SUCCESS]"`,
        nextNodeId: 'convoy_surrender_success',
        action: 'SURRENDER_JETTISON',
        actionPayload: { sectorId, convoyId: hauler.convoyId || hauler.id, factionId: hauler.factionId },
      });
    } else {
      options.push({
        text: `"Surrender your cargo manifest to me right now! [Intimidate: RISK (${playerFirepower} vs ${convoySecurity})]"`,
        nextNodeId: 'convoy_surrender_refusal',
        action: 'PROVOKE_ATTACK',
        actionPayload: { sectorId, convoyId: hauler.convoyId || hauler.id },
      });
    }

    // 5. Close Comms
    options.push({
      text: `"Carry on your transit, Commander. Safe flying. [Close Comms]"`,
      nextNodeId: 'convoy_close',
      action: 'CLOSE_COMMS',
    });

    return {
      id: 'convoy_root',
      speakerName,
      species,
      title,
      mood,
      dialogueText: greeting,
      options,
      manifest,
      canIntimidate,
      playerFirepower,
      convoySecurity,
    };
  }

  /**
   * Executes response option and returns resolution message and resulting dialogue node
   */
  public async respondConvoyDialog(
    accountId: string,
    sectorId: number,
    convoyId: string,
    optionIndex: number,
    customPayload?: any
  ): Promise<{ success: boolean; actionMessage: string; nextNode: ConvoyDialogNode | null }> {
    const dialog = await this.getConvoyDialog(accountId, sectorId, convoyId);
    const room = combatManager.getOrCreateRoom(sectorId);

    let hauler: SectorEntity | undefined;
    for (const e of room.entities.values()) {
      if ((e.convoyId === convoyId || e.id === convoyId) && e.isConvoyHauler) {
        hauler = e;
        break;
      }
    }

    if (!hauler || hauler.state === 'DESTROYED') {
      room.setCommsStandDown(false);
      throw new Error(`Convoy ${convoyId} is no longer active.`);
    }

    const selectedOption = dialog.options[optionIndex];
    const action = customPayload?.action || selectedOption?.action;
    const payload = customPayload || selectedOption?.actionPayload || {};

    let actionMessage = '';

    if (action === 'SURRENDER_JETTISON') {
      // 1. Eject 50%-75% of cargo manifest into 20Hz sector space as physical canisters
      const dropResult = room.surrenderConvoy(hauler.convoyId || hauler.id, accountId);

      // 2. Asymmetric Galaxy Repercussions
      const victimFaction = hauler.factionId as FactionId;
      const victimNormalized: FactionId = (victimFaction as string) === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : victimFaction;

      // -20 Standing with victim faction
      await reputationService.modifyStanding(accountId, victimNormalized, -20, 'Piracy and extortion of convoy');

      // +10 Goodwill with rival faction
      const rivalFaction: FactionId = victimNormalized === 'FACTION_HEGEMONY' ? 'FACTION_KRYLL' : 'FACTION_HEGEMONY';
      await reputationService.modifyStanding(accountId, rivalFaction, 10, `Applauded piracy against ${victimNormalized}`);

      actionMessage = `Convoy surrendered! ${dropResult.droppedContainers} cargo canisters (${dropResult.totalUnits} units) jettisoned into sector space. (-20 ${victimNormalized}, +10 ${rivalFaction})`;
      room.setCommsStandDown(false);

      return {
        success: true,
        actionMessage,
        nextNode: {
          id: 'convoy_surrender_success',
          speakerName: dialog.speakerName,
          species: dialog.species,
          title: dialog.title,
          mood: 'TERRIFIED',
          dialogueText: `Pods away! The clamps are blown and the cargo is free-floating in your sector coordinates. Take what you want and leave us in peace!`,
          options: [
            { text: '"Understood. Stand down your escorts and proceed on sublight impulse." [Close Comms]', nextNodeId: 'convoy_close', action: 'CLOSE_COMMS' },
          ],
        },
      };
    } else if (action === 'PROVOKE_ATTACK') {
      room.setCommsStandDown(false);
      // Alert escorts to engage
      if (hauler.escortIds) {
        for (const escId of hauler.escortIds) {
          const esc = room.entities.get(escId);
          if (esc && esc.state !== 'DESTROYED') {
            esc.state = 'ENGAGE';
          }
        }
      }
      actionMessage = 'Intimidation failed! Convoy escorts powered weapons and engaged!';
      return {
        success: true,
        actionMessage,
        nextNode: {
          id: 'convoy_surrender_refusal',
          speakerName: dialog.speakerName,
          species: dialog.species,
          title: dialog.title,
          mood: 'AGGRESSIVE',
          dialogueText: `You think a lone raider can intimidate this convoy? All escorts, fire at will! Break their hull!`,
          options: [
            { text: '[Evasive maneuvers — Comms terminated]', nextNodeId: 'convoy_close', action: 'CLOSE_COMMS' },
          ],
        },
      };
    } else if (action === 'CONVOY_BUY_CARGO') {
      const { commodityId, quantity, costCredits, name } = payload;

      // 1. Check and deduct credits
      const accRes = await db.query<{ credits: number }>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
      const credits = accRes.rows[0]?.credits || 0;
      if (credits < costCredits) {
        throw new Error(`Insufficient credits: Requires ${costCredits} CR, currently have ${credits} CR.`);
      }

      await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [costCredits, accountId]);

      // 2. Add cargo to ship hold
      const shipRes = await db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
      if (shipRes.rows.length > 0) {
        const shipId = shipRes.rows[0].id;
        await db.query(
          `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (ship_id, commodity_id) DO UPDATE SET quantity = ship_cargo.quantity + $3`,
          [shipId, commodityId, quantity]
        );
      }

      // 3. Deduct from hauler manifest
      if (hauler.cargoManifest) {
        const item = hauler.cargoManifest.find((m: any) => m.commodityId === commodityId);
        if (item) {
          item.quantity = Math.max(0, (item.quantity || quantity) - quantity);
        }
      }

      actionMessage = `Purchased ${quantity}x ${name || commodityId} for ${costCredits} Credits. Cargo secured in ship hold.`;

      return {
        success: true,
        actionMessage,
        nextNode: {
          id: 'convoy_trade_success',
          speakerName: dialog.speakerName,
          species: dialog.species,
          title: dialog.title,
          mood: 'AMUSED',
          dialogueText: `Pleasure doing business with you, Captain. Transferred ${quantity}x ${name || commodityId} across pneumatic cargo couplers.`,
          options: [
            { text: '"Let us discuss further trade or safe passage."', nextNodeId: 'convoy_root' },
            { text: '"Thank you. Safe travels." [Close Comms]', nextNodeId: 'convoy_close', action: 'CLOSE_COMMS' },
          ],
        },
      };
    } else if (action === 'DIPLOMATIC_TRUCE') {
      const targetFaction: FactionId = (hauler.factionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : hauler.factionId) as FactionId;
      const truceRes = await reputationService.requestCeasefireTruce(accountId, sectorId, targetFaction, 'CREDITS');
      room.notifyTruce(accountId, targetFaction, 300000);
      room.notifyTruce(accountId, hauler.factionId, 300000);
      actionMessage = truceRes.message;

      return {
        success: true,
        actionMessage,
        nextNode: {
          id: 'convoy_truce_success',
          speakerName: dialog.speakerName,
          species: dialog.species,
          title: dialog.title,
          mood: 'NEUTRAL',
          dialogueText: `Ceasefire agreement registered with fleet command. Safe transit granted across Sector ${sectorId} for 5 minutes.`,
          options: [
            { text: '"Acknowledged. Farewell." [Close Comms]', nextNodeId: 'convoy_close', action: 'CLOSE_COMMS' },
          ],
        },
      };
    } else if (action === 'OPEN_TRADE_MANIFEST') {
      return {
        success: true,
        actionMessage: 'Opening in-flight cargo manifest exchange...',
        nextNode: {
          id: 'convoy_trade_manifest',
          speakerName: dialog.speakerName,
          species: dialog.species,
          title: dialog.title,
          mood: 'NEUTRAL',
          dialogueText: `Transmitting real-time inventory manifest telemetry across comm frequency...`,
          options: [
            { text: '"Back to communication channel."', nextNodeId: 'convoy_root' },
            { text: '"Close comms." [Exit]', nextNodeId: 'convoy_close', action: 'CLOSE_COMMS' },
          ],
          manifest: hauler.cargoManifest || [],
        },
      };
    } else {
      // CLOSE_COMMS
      room.setCommsStandDown(false);
      return {
        success: true,
        actionMessage: 'Sub-space communication link terminated.',
        nextNode: null,
      };
    }
  }
}

export const convoyDialogService = new ConvoyDialogService();

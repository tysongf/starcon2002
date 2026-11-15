import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { db } from '../db/Database';
import { squadronService } from './SquadronService';
import { allianceService } from './AllianceService';
import { outfittingService } from './OutfittingService';

export type ChatChannelType = 'GALAXY' | 'SECTOR' | 'SQUAD' | 'ALLIES' | 'WHISPER';

interface ConnectedPeer {
  socket: WebSocket;
  accountId: string;
  callsign: string;
}

export class SocialHubService {
  private socketsByAccount: Map<string, Set<ConnectedPeer>> = new Map();

  public handleConnection(socket: WebSocket, accountId: string, callsign: string): void {
    const peer: ConnectedPeer = { socket, accountId, callsign };
    let set = this.socketsByAccount.get(accountId);
    if (!set) {
      set = new Set();
      this.socketsByAccount.set(accountId, set);
    }
    set.add(peer);

    void db.query(`UPDATE accounts SET online_status = 'ONLINE', last_seen_at = NOW() WHERE id = $1`, [
      accountId,
    ]);

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'CHAT_SEND') {
          await this.sendChatMessage(accountId, {
            channelType: msg.channelType || 'GALAXY',
            channelId: msg.channelId,
            targetAccountId: msg.targetAccountId,
            content: msg.content,
          });
        } else if (msg.type === 'HYPERSPACE_PING') {
          await this.broadcastHyperspaceUpdate(accountId);
        }
      } catch (err: any) {
        try {
          socket.send(JSON.stringify({ type: 'SOCIAL_ERROR', error: err.message }));
        } catch {}
      }
    });

    socket.on('close', () => {
      const s = this.socketsByAccount.get(accountId);
      if (s) {
        s.delete(peer);
        if (s.size === 0) {
          this.socketsByAccount.delete(accountId);
          void db.query(`UPDATE accounts SET online_status = 'OFFLINE', last_seen_at = NOW() WHERE id = $1`, [
            accountId,
          ]);
        }
      }
    });

    socket.send(
      JSON.stringify({
        type: 'SOCIAL_CONNECTED',
        accountId,
        callsign,
      })
    );
  }

  public pushToAccount(accountId: string, type: string, payload: any): void {
    const peers = this.socketsByAccount.get(accountId);
    if (!peers) return;
    const frame = JSON.stringify({ type, ...payload });
    for (const p of peers) {
      if (p.socket.readyState === 1) {
        p.socket.send(frame);
      }
    }
  }

  public broadcastAll(type: string, payload: any): void {
    const frame = JSON.stringify({ type, ...payload });
    for (const peers of this.socketsByAccount.values()) {
      for (const p of peers) {
        if (p.socket.readyState === 1) {
          p.socket.send(frame);
        }
      }
    }
  }

  public async broadcastHyperspaceUpdate(accountId: string): Promise<void> {
    const shipRes = await db.query<any>(
      `SELECT a.callsign, a.faction_id, s.is_in_hyperspace, s.hyperspace_x, s.hyperspace_y, s.hull_class
       FROM accounts a JOIN ships s ON s.account_id = a.id WHERE a.id = $1`,
      [accountId]
    );
    if (shipRes.rows.length === 0) return;
    const r = shipRes.rows[0];
    this.broadcastAll('REMOTE_HYPERSPACE_POS', {
      accountId,
      callsign: r.callsign,
      factionId: r.faction_id,
      hullClass: r.hull_class,
      isInHyperspace: Boolean(r.is_in_hyperspace),
      hyperspaceX: Number(r.hyperspace_x ?? 500),
      hyperspaceY: Number(r.hyperspace_y ?? 500),
    });
  }

  public async sendChatMessage(
    senderId: string,
    input: {
      channelType: ChatChannelType;
      channelId?: string | null;
      targetAccountId?: string | null;
      content: string;
    }
  ) {
    const cleanContent = String(input.content || '').trim().slice(0, 400);
    if (!cleanContent) {
      throw new Error('Chat message cannot be empty.');
    }

    const accRes = await db.query<{ callsign: string }>(
      `SELECT callsign FROM accounts WHERE id = $1`,
      [senderId]
    );
    const senderCallsign = accRes.rows[0]?.callsign || 'Unknown';
    const shipRes = await db.query<{ current_sector_id: number }>(
      `SELECT current_sector_id FROM ships WHERE account_id = $1 LIMIT 1`,
      [senderId]
    );
    const senderSectorId = String(shipRes.rows[0]?.current_sector_id || 1);

    let channelId: string | null = input.channelId ? String(input.channelId) : null;
    const channelType = input.channelType;

    if (channelType === 'SECTOR') {
      channelId = senderSectorId;
    } else if (channelType === 'SQUAD') {
      const sqId = await squadronService.getAccountSquadronId(senderId);
      if (!sqId) throw new Error('You must be in a Squadron to use [SQUAD] chat.');
      channelId = sqId;
    } else if (channelType === 'WHISPER') {
      if (!input.targetAccountId) throw new Error('Whisper requires targetAccountId.');
    }

    const id = `msg_${crypto.randomBytes(6).toString('hex')}`;
    await db.query(
      `INSERT INTO chat_messages (id, channel_type, channel_id, sender_id, sender_callsign, target_account_id, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, channelType, channelId, senderId, senderCallsign, input.targetAccountId || null, cleanContent]
    );

    const messageObj = {
      id,
      channelType,
      channelId,
      senderId,
      senderCallsign,
      targetAccountId: input.targetAccountId || null,
      content: cleanContent,
      createdAt: new Date().toISOString(),
    };

    if (channelType === 'GALAXY') {
      this.broadcastAll('CHAT_MESSAGE', { message: messageObj });
    } else if (channelType === 'SECTOR') {
      const secRows = await db.query<{ account_id: string }>(
        `SELECT account_id FROM ships WHERE current_sector_id = $1`,
        [Number(channelId)]
      );
      for (const r of secRows.rows) {
        this.pushToAccount(r.account_id, 'CHAT_MESSAGE', { message: messageObj });
      }
    } else if (channelType === 'SQUAD') {
      const sqIds = await squadronService.getSquadronMemberIds(senderId);
      for (const mid of sqIds) {
        this.pushToAccount(mid, 'CHAT_MESSAGE', { message: messageObj });
      }
    } else if (channelType === 'ALLIES') {
      const allyIds = await allianceService.getActiveAllyIds(senderId);
      this.pushToAccount(senderId, 'CHAT_MESSAGE', { message: messageObj });
      for (const aid of allyIds) {
        this.pushToAccount(aid, 'CHAT_MESSAGE', { message: messageObj });
      }
    } else if (channelType === 'WHISPER' && input.targetAccountId) {
      this.pushToAccount(senderId, 'CHAT_MESSAGE', { message: messageObj });
      if (input.targetAccountId !== senderId) {
        this.pushToAccount(input.targetAccountId, 'CHAT_MESSAGE', { message: messageObj });
      }
    }

    return messageObj;
  }

  public async getChatHistory(accountId: string, channelType: ChatChannelType, channelId?: string | null) {
    if (channelType === 'GALAXY') {
      const res = await db.query<any>(
        `SELECT * FROM chat_messages WHERE channel_type = 'GALAXY' ORDER BY created_at DESC LIMIT 40`
      );
      return res.rows.reverse();
    }
    if (channelType === 'SECTOR') {
      const shipRes = await db.query<{ current_sector_id: number }>(
        `SELECT current_sector_id FROM ships WHERE account_id = $1 LIMIT 1`,
        [accountId]
      );
      const secId = channelId || String(shipRes.rows[0]?.current_sector_id || 1);
      const res = await db.query<any>(
        `SELECT * FROM chat_messages WHERE channel_type = 'SECTOR' AND channel_id = $1 ORDER BY created_at DESC LIMIT 40`,
        [secId]
      );
      return res.rows.reverse();
    }
    if (channelType === 'SQUAD') {
      const sqId = await squadronService.getAccountSquadronId(accountId);
      if (!sqId) return [];
      const res = await db.query<any>(
        `SELECT * FROM chat_messages WHERE channel_type = 'SQUAD' AND channel_id = $1 ORDER BY created_at DESC LIMIT 40`,
        [sqId]
      );
      return res.rows.reverse();
    }
    if (channelType === 'ALLIES') {
      const allyIds = Array.from(await allianceService.getActiveAllyIds(accountId));
      const allowed = [accountId, ...allyIds];
      const res = await db.query<any>(
        `SELECT * FROM chat_messages WHERE channel_type = 'ALLIES' AND sender_id = ANY($1) ORDER BY created_at DESC LIMIT 40`,
        [allowed]
      );
      return res.rows.reverse();
    }
    if (channelType === 'WHISPER') {
      const res = await db.query<any>(
        `SELECT * FROM chat_messages
         WHERE channel_type = 'WHISPER' AND (sender_id = $1 OR target_account_id = $1)
         ORDER BY created_at DESC LIMIT 40`,
        [accountId]
      );
      return res.rows.reverse();
    }
    return [];
  }

  public async getOnlineCaptains(viewerId: string) {
    const [sqIds, allyIds, rowsRes] = await Promise.all([
      squadronService.getSquadronMemberIds(viewerId),
      allianceService.getActiveAllyIds(viewerId),
      db.query<any>(
        `SELECT a.id, a.callsign, a.faction_id, a.online_status, a.last_seen_at,
                s.current_sector_id, s.hull_class, s.flagship_name,
                s.is_in_hyperspace, s.hyperspace_x, s.hyperspace_y
         FROM accounts a
         LEFT JOIN ships s ON s.account_id = a.id
         ORDER BY (CASE WHEN a.online_status = 'ONLINE' THEN 0 ELSE 1 END), a.last_seen_at DESC
         LIMIT 50`
      ),
    ]);

    return rowsRes.rows.map((r) => ({
      accountId: r.id,
      callsign: r.callsign,
      factionId: r.faction_id,
      onlineStatus: this.socketsByAccount.has(r.id) ? 'ONLINE' : r.online_status,
      isSocketConnected: this.socketsByAccount.has(r.id),
      currentSectorId: Number(r.current_sector_id || 1),
      hullClass: r.hull_class || 'CORVETTE',
      flagshipName: r.flagship_name || 'Vessel',
      isInHyperspace: Boolean(r.is_in_hyperspace),
      hyperspaceX: Number(r.hyperspace_x ?? 500),
      hyperspaceY: Number(r.hyperspace_y ?? 500),
      isMe: r.id === viewerId,
      isSquadMate: sqIds.has(r.id),
      isPeerAlly: allyIds.has(r.id),
    }));
  }

  public async inspectCaptain(viewerId: string, targetAccountId: string) {
    const accRes = await db.query<any>(
      `SELECT id, callsign, faction_id, online_status, last_seen_at FROM accounts WHERE id = $1`,
      [targetAccountId]
    );
    if (accRes.rows.length === 0) throw new Error('Captain not found.');
    const a = accRes.rows[0];

    const shipRes = await db.query<any>(`SELECT * FROM ships WHERE account_id = $1 LIMIT 1`, [targetAccountId]);
    const s = shipRes.rows[0];

    const loadout = await outfittingService.getPlayerLoadout(targetAccountId);
    const crewRes = await db.query<{ cnt: string }>(`SELECT COUNT(*)::text AS cnt FROM crew_roster WHERE account_id = $1`, [
      targetAccountId,
    ]);
    const colRes = await db.query<{ id: string; name: string; planet_id: string }>(
      `SELECT id, name, planet_id FROM colonies WHERE account_id = $1`,
      [targetAccountId]
    );

    const [sqIds, isAlly] = await Promise.all([
      squadronService.getSquadronMemberIds(viewerId),
      allianceService.hasActivePact(viewerId, targetAccountId),
    ]);

    return {
      accountId: a.id,
      callsign: a.callsign,
      factionId: a.faction_id,
      onlineStatus: this.socketsByAccount.has(a.id) ? 'ONLINE' : a.online_status,
      ship: s
        ? {
            flagshipName: s.flagship_name,
            hullClass: s.hull_class,
            hullSubtype: s.hull_subtype,
            currentSectorId: Number(s.current_sector_id),
            armor: Number(s.armor),
            maxArmor: Number(s.max_armor),
            shield: Number(s.shield),
            maxShield: Number(s.max_shield),
          }
        : null,
      fittedModules: (loadout?.fitted ? Object.values(loadout.fitted).filter(Boolean) : []).map((m: any) => ({
        name: m.customName || m.name,
        rarity: m.rarity,
        slot: m.fitSlot,
        subtype: m.subtype,
      })),
      crewCount: Number(crewRes.rows[0]?.cnt || 0),
      colonies: colRes.rows.map((c) => ({ id: c.id, name: c.name, planetId: c.planet_id })),
      inMySquadron: sqIds.has(targetAccountId),
      isPeerAlly: isAlly,
    };
  }
}

export const socialHubService = new SocialHubService();

import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { socialHubService, type ChatChannelType } from '../services/SocialHubService';

export const socialRoutes: FastifyPluginAsync = async (server) => {
  // Real-time authenticated Social / Galaxy Comms / Presence WebSocket
  server.get('/ws/social', { websocket: true }, async (socket, req) => {
    const accountId = req.authAccountId;
    if (!accountId) {
      socket.close(1008, 'UNAUTHORIZED');
      return;
    }

    const res = await db.query<{ callsign: string }>(`SELECT callsign FROM accounts WHERE id = $1`, [accountId]);
    const callsign = res.rows[0]?.callsign || accountId;
    socialHubService.handleConnection(socket, accountId, callsign);
  });

  // Online & recent captains roster
  server.get('/api/social/online', async (req, reply) => {
    const accountId = req.authAccountId!;
    const captains = await socialHubService.getOnlineCaptains(accountId);
    reply.send({ success: true, captains });
  });

  // Public inspection dossier of another captain
  server.get('/api/social/player/:targetId', async (req, reply) => {
    const { targetId } = req.params as { targetId: string };
    const accountId = req.authAccountId!;
    try {
      const dossier = await socialHubService.inspectCaptain(accountId, targetId);
      reply.send({ success: true, dossier });
    } catch (err: any) {
      reply.status(404).send({ success: false, error: err.message });
    }
  });

  // Chat history for a channel
  server.get('/api/chat/history', async (req, reply) => {
    const accountId = req.authAccountId!;
    const query = (req.query || {}) as { channelType?: ChatChannelType; channelId?: string };
    const channelType: ChatChannelType = query.channelType || 'GALAXY';
    try {
      const messages = await socialHubService.getChatHistory(accountId, channelType, query.channelId);
      reply.send({ success: true, messages });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // REST send chat fallback/trigger
  server.post('/api/chat/send', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as {
      channelType?: ChatChannelType;
      channelId?: string;
      targetAccountId?: string;
      content: string;
    };
    try {
      const message = await socialHubService.sendChatMessage(accountId, {
        channelType: body.channelType || 'GALAXY',
        channelId: body.channelId,
        targetAccountId: body.targetAccountId,
        content: body.content,
      });
      reply.send({ success: true, message });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};


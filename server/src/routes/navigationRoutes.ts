import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { navigationService } from '../services/NavigationService';

export const navigationRoutes: FastifyPluginAsync = async (server) => {
  // Sector Registry
  server.get('/api/sectors', async (_req, reply) => {
    const { rows } = await db.query('SELECT * FROM sectors ORDER BY id ASC');
    reply.send({ sectors: rows });
  });

  server.get('/api/sectors/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sectorId = parseInt(id, 10);
    const sector = await navigationService.getSector(sectorId);
    if (!sector) {
      return reply.status(404).send({ error: 'Sector not found' });
    }
    const adjacent = await navigationService.getAdjacentSectors(sectorId);
    const portRes = await db.query('SELECT * FROM ports WHERE sector_id = $1', [sectorId]);
    reply.send({
      sector,
      adjacent,
      port: portRes.rows[0] || null,
    });
  });

  // Hyperspace Jump Handler
  const handleJump = async (req: any, reply: any) => {
    const body = (req.body || {}) as {
      playerId?: string;
      targetSectorId: number;
    };

    const playerId = req.authAccountId!;
    const targetSectorId = typeof body.targetSectorId === 'number'
      ? body.targetSectorId
      : parseInt(body.targetSectorId, 10);

    if (isNaN(targetSectorId)) {
      return reply.status(400).send({
        success: false,
        error: 'targetSectorId must be a valid integer.',
      });
    }

    const result = await navigationService.executeJump(playerId, targetSectorId);
    if (!result.success) {
      return reply.status(400).send(result);
    }

    reply.send(result);
  };

  // Hyperspace Jump
  server.post('/api/navigate/jump', handleJump);
  server.post('/api/player/warp', handleJump);
  server.post('/api/sector/jump', handleJump);
};

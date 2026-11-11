import dotenv from 'dotenv';
import { buildApp } from './app';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    const server = await buildApp();
    await server.listen({ port: PORT, host: HOST });
    console.log(`[Wayward Void API] Server listening on http://${HOST}:${PORT}`);

    // Graceful Shutdown
    const closeServer = async () => {
      console.log('\n[Wayward Void API] Gracefully shutting down...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', closeServer);
    process.on('SIGTERM', closeServer);
  } catch (err) {
    console.error('[Wayward Void API] Fatal error during startup:', err);
    process.exit(1);
  }
}

startServer();

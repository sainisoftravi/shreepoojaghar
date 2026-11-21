import 'dotenv/config';
import app from './app.js';
import { logger } from './config/logger.js';
import { PrismaClient } from '@prisma/client';
import './jobs/whatsapp.worker.js'; // Start worker process

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL via Prisma.');

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      startKeepAlivePing();
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

function startKeepAlivePing() {
  const pingUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
  if (!pingUrl) return;

  const PING_INTERVAL = 10 * 60 * 1000; // Ping every 10 minutes to prevent Render 15-minute sleep
  setInterval(async () => {
    try {
      const res = await fetch(`${pingUrl}/api/v1/health`);
      if (res.ok) {
        logger.info({ pingUrl }, 'Keep-alive self-ping successful');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Keep-alive ping failed');
    }
  }, PING_INTERVAL);
  logger.info({ pingUrl }, 'Keep-alive pinger started (every 10 minutes)');
}

startServer();

// Handle unexpected closures
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

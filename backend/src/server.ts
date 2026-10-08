import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/database';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB Atlas
    await connectDB();

    // Start Express listener
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`[WetalaMLM] Server running on port ${PORT}`);
      console.log(`[WetalaMLM] Health endpoint: http://127.0.0.1:${PORT}/api/health`);
    });

    // Graceful shutdown
    const handleShutdown = (signal: string) => {
      console.log(`[WetalaMLM] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[WetalaMLM] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error('[WetalaMLM] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

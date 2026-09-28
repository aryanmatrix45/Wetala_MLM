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
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`[WetalaMLM] Server running on http://127.0.0.1:${PORT}`);
      console.log(`[WetalaMLM] Health endpoint: http://127.0.0.1:${PORT}/api/health`);
      console.log(`[WetalaMLM] Auth endpoints: http://127.0.0.1:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('[WetalaMLM] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

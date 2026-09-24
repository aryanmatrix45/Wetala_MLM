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
    app.listen(PORT, () => {
      console.log(`[WetalaMLM] Server running on http://localhost:${PORT}`);
      console.log(`[WetalaMLM] Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(`[WetalaMLM] Auth endpoints: http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('[WetalaMLM] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

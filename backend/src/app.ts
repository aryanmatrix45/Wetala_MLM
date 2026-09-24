import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Disable ETag for fresh responses
app.set('etag', false);

// CORS configuration
app.use(cors({ origin: true, credentials: true }));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// No-cache headers for dynamic API responses
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    project: 'WetalaMLM Backend API',
    timestamp: new Date().toISOString(),
  });
});

// Master API Routes mounted at /api
app.use('/api', routes);

// Central Error Handler
app.use(errorHandler);

export default app;

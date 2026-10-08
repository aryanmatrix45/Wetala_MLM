import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

import path from 'path';

// Trust reverse proxy (Nginx, Cloudflare, AWS ALB)
app.set('trust proxy', 1);

// Disable ETag for fresh responses
app.set('etag', false);

// CORS configuration for local and production domains
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'https://panchvedawellness.com',
      'https://www.panchvedawellness.com',
      'http://panchvedawellness.com',
      'http://www.panchvedawellness.com',
      'https://api.panchvedawellness.com',
      'https://api.consultivewellness.com',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.panchvedawellness.com') ||
        origin.endsWith('.consultivewellness.com') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive fallback to prevent breaking client transitions
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads directory for product images and media
const uploadsPath = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath, { maxAge: '30d' }));

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

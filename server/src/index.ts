import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { initializeDatabase } from './config/database';
import './config/env'; // Validates required environment variables at startup
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import userRoutes from './routes/users';
import uploadRoutes from './routes/uploads';
import { setupSocket } from './services/socket';

const app = express();
const server = http.createServer(app);

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
const parsedAllowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
const hasExplicitOrigins = rawAllowedOrigins !== undefined && rawAllowedOrigins !== '';
if (hasExplicitOrigins && parsedAllowedOrigins.length === 0) {
  console.warn(
    'ALLOWED_ORIGINS is set but empty after parsing; no cross-origin browser requests will be allowed.',
  );
}
const allowedOrigins = hasExplicitOrigins
  ? parsedAllowedOrigins
  : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000'];

// Accept requests from private-network IPs so LAN clients (mobile devices,
// other PCs) work out of the box without configuring ALLOWED_ORIGINS.
// Only used when ALLOWED_ORIGINS is not explicitly set, so production
// deployments can fully lock down CORS.
function isPrivateOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    // Only match actual IPv4 addresses, not domain names containing these prefixes
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
    return (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || (!hasExplicitOrigins && isPrivateOrigin(origin))) {
      callback(null, true);
    } else {
      callback(new Error(`Origin '${origin}' not allowed by CORS`));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const io = new Server(server, {
  cors: corsOptions,
});

setupSocket(io);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/conversations', apiLimiter, conversationRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/upload', apiLimiter, uploadRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

initializeDatabase()
  .then(() => {
    const PORT = parseInt(process.env.PORT ?? '') || 3001;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Chatters server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export { app, server };

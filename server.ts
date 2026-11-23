// latest
import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';

import { connectDB } from './src/config/database';

import './src/models/user';
import './src/models/tasks';
import './src/models/resetPassword';
import './src/models/refreshToken';
import './src/models/notification';
import './src/models/chat';
import './src/models/taskTimeLog';
import { initAssociations } from './src/models/associations';
import { deleteExpiredTokens } from './src/service/tokenService';
import taskSubmissionRoutes from './src/routes/taskSubmissionRoutes';
import taskBlockerRoutes from './src/routes/taskBlockerRoute';


// Routes
import userRoutes from './src/routes/userRoute';
import taskRoutes from './src/routes/taskRoutes';
import passwordResetRoutes from './src/routes/passwordResetRoutes';
import notificationRoutes from './src/routes/notificationRoutes';
import { authenticate } from './src/middleware/authMiddleware';

// Realtime + jobs
import { initSocket } from './src/socket';
import { startDueDateJob } from './src/jobs/dueDateJob';
import chatRoutes from './src/routes/chatRoutes';
import { startStaleTimerJob } from './src/jobs/closeStaleTimers';

initAssociations();

const app = express();

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins: string[] = Array.from(
  new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.31.242:5173', 'http://192.168.1.32:5173', 'https://fe-strive-it.onrender.com','https://fe-strive-it-2.vercel.app/', ...envOrigins])
);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

let isDbConnected = false;
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  if (!isDbConnected) {
    try {
      await connectDB();
      isDbConnected = true;
    } catch (error) {
      console.error('Database connection failed:', error);
    }
  }
  next();
});

// Register routes
// Register routes (notifications first, so '/api' mounts can't intercept it)
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', passwordResetRoutes);
app.use('/api/chat', chatRoutes);

app.use('/api', taskSubmissionRoutes);
app.use('/api/blockers', taskBlockerRoutes);

// Health / root route
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Intern Management System API is running!' });
});

// 404 handler for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const errObj = err as { statusCode?: number; status?: number; message?: string };
  const statusCode =
    typeof errObj?.statusCode === 'number'
      ? errObj.statusCode
      : typeof errObj?.status === 'number'
      ? errObj.status
      : errObj?.message === 'Not allowed by CORS'
      ? 403
      : 500;

  if (statusCode >= 500) {
    console.error('Unhandled server error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Internal server error' : errObj?.message || 'Request failed',
  });
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT: number = Number(process.env.PORT) || 3000;
const TOKEN_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function startServer(): Promise<Server | undefined> {
  try {
    // Connect to PostgreSQL
    await connectDB();
    startStaleTimerJob();

    // Clean up expired refresh tokens on startup
    void deleteExpiredTokens().catch((err) => {
      console.error('Failed to clean expired refresh tokens:', err);
    });

    // Schedule cleanup every 24 hours
    const cleanupTimer = setInterval(() => {
      void deleteExpiredTokens().catch((err) => {
        console.error('Failed to clean expired refresh tokens:', err);
      });
    }, TOKEN_CLEANUP_INTERVAL_MS);

    cleanupTimer.unref();

    // Create one HTTP server using Express
    const server = http.createServer(app);

    // Attach Socket.IO to the same HTTP server
    initSocket(server, allowedOrigins);

    // Start the HTTP server
    server.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
      console.log('Waiting for incoming requests...');

      // Start daily due-date reminders
      startDueDateJob();
    });

    server.on('error', (error: Error) => {
      console.error('HTTP server error:', error);
    });

    server.on('close', () => {
      clearInterval(cleanupTimer);
      console.log('HTTP server has closed.');
    });

    return server;

  } catch (error) {
    console.error('Unable to start server:', error);
    process.exitCode = 1;
    return undefined;
  }
}

if (!process.env.VERCEL) {
  void startServer();
}

export default app;

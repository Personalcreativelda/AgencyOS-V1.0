import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Routes
import authRoutes from './modules/auth/auth.routes';
import agencyRoutes from './modules/agencies/agencies.routes';
import clientRoutes from './modules/clients/clients.routes';
import brandRoutes from './modules/brand/brand.routes';
import contentRoutes from './modules/content/content.routes';
import calendarRoutes from './modules/calendars/calendars.routes';
import approvalRoutes from './modules/approvals/approvals.routes';
import aiRoutes from './modules/ai/ai.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import assetRoutes from './modules/assets/assets.routes';
import reportRoutes from './modules/reports/reports.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import socialRoutes from './modules/social/social.routes';
import emailRoutes from './modules/email/email.routes';
import adsRoutes from './modules/ads/ads.routes';

// Middleware
import { errorHandler } from './common/middleware/errorHandler';
import { notFound } from './common/middleware/notFound';

const app = express();

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static files (local storage for dev)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health checks
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
const api = '/api/v1';
app.use(`${api}/auth`, authRoutes);
app.use(`${api}/agencies`, agencyRoutes);
app.use(`${api}/clients`, clientRoutes);
app.use(`${api}/brand`, brandRoutes);
app.use(`${api}/contents`, contentRoutes);
app.use(`${api}/calendars`, calendarRoutes);
app.use(`${api}/approvals`, approvalRoutes);
app.use(`${api}/ai`, aiRoutes);
app.use(`${api}/dashboard`, dashboardRoutes);
app.use(`${api}/assets`, assetRoutes);
app.use(`${api}/reports`, reportRoutes);
app.use(`${api}/notifications`, notificationRoutes);
app.use(`${api}/social`, socialRoutes);
app.use(`${api}/email`, emailRoutes);
app.use(`${api}/ads`, adsRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;

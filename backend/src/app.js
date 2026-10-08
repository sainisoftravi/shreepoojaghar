import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { requestId } from './middleware/requestId.middleware.js';
import { apiLimiter, authLimiter, posLimiter } from './middleware/rateLimit.middleware.js';
import healthRoutes from './routes/health.route.js';
import authRoutes from './routes/auth.route.js';
import categoryRoutes from './routes/category.route.js';
import productRoutes from './routes/product.route.js';
import batchRoutes from './routes/batch.route.js';
import posRoutes from './routes/pos.route.js';
import invoiceRoutes from './routes/invoice.route.js';
import reportsRoutes from './routes/reports.route.js';
import exportsRoutes from './routes/exports.route.js';
import customerRoutes from './routes/customer.route.js';
import userRoutes from './routes/user.route.js';
import upiRoutes from './routes/upi.route.js';
import whatsappRoutes from './routes/whatsapp.route.js';
import dbsyncRoutes from './routes/dbsync.route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & utility middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(pinoHttp({ logger }));

// Serve uploaded product images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global rate limiter
app.use('/api/', apiLimiter);

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/batches', batchRoutes);
app.use('/api/v1/pos', posLimiter, posRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/exports', exportsRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/upi', upiRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/dbsync', dbsyncRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Centralized Error Handling
app.use(errorHandler);

export default app;

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyAccessToken, createLogger, bootstrapService, useServiceErrorHandler } from '@banking/shared';

const log = createLogger('api-gateway');
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

bootstrapService({ app, serviceName: 'api-gateway' });

const PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/health',
];

const ADMIN_PATHS_PREFIX = '/api/admin';

function isPublicPath(req: Request): boolean {
  const fullPath = req.originalUrl.split('?')[0];
  return PUBLIC_PATHS.some((p) => fullPath === p);
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isPublicPath(req)) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token, JWT_SECRET);
    req.headers['x-user-id'] = payload.sub;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-user-role'] = payload.role;
    if (req.originalUrl.split('?')[0].startsWith(ADMIN_PATHS_PREFIX) && payload.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = new Set([
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.WORKSHOP_URL || 'http://localhost:8090',
        'http://127.0.0.1:8090',
      ]);
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, origin);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['Server-Timing', 'X-Correlation-Id'],
  })
);
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

const services: Record<string, string> = {
  '/api/auth': process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  '/api/users': process.env.USER_SERVICE_URL || 'http://localhost:3002',
  '/api/accounts': process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3003',
  '/api/transactions': process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3004',
  '/api/cards': process.env.CREDIT_CARD_SERVICE_URL || 'http://localhost:3005',
  '/api/loans': process.env.LOAN_SERVICE_URL || 'http://localhost:3006',
  '/api/documents': process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3007',
  '/api/notifications': process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008',
  '/api/admin': process.env.ADMIN_SERVICE_URL || 'http://localhost:3009',
};

const pathRewrites: Record<string, string> = {
  '/api/auth': '/',
  '/api/users': '/',
  '/api/accounts': '/',
  '/api/transactions': '/',
  '/api/cards': '/',
  '/api/loans': '/',
  '/api/documents': '/',
  '/api/notifications': '/',
  '/api/admin': '/',
};

for (const [path, target] of Object.entries(services)) {
  app.use(
    path,
    authMiddleware,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (p) => {
        const stripped = p.replace(path, '') || '/';
        return stripped.startsWith('/') ? stripped : `/${stripped}`;
      },
      on: {
        proxyReq: (proxyReq, req) => {
          const userId = req.headers['x-user-id'];
          const email = req.headers['x-user-email'];
          const role = req.headers['x-user-role'];
          if (userId) proxyReq.setHeader('X-User-Id', userId as string);
          if (email) proxyReq.setHeader('X-User-Email', email as string);
          if (role) proxyReq.setHeader('X-User-Role', role as string);
          if (req.headers['x-correlation-id']) {
            proxyReq.setHeader('X-Correlation-Id', req.headers['x-correlation-id'] as string);
          }
        },
        error: (err, _req, res) => {
          log.error('Proxy error', { error: err.message });
          if ('writeHead' in res && typeof res.writeHead === 'function') {
            (res as Response).status(502).json({ error: 'Service unavailable' });
          }
        },
      },
    })
  );
}

useServiceErrorHandler(app, 'api-gateway');

app.listen(PORT, () => {
  log.info('API Gateway listening', { port: PORT });
});

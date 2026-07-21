import express from 'express';
import cors from 'cors';
import { PrismaClient } from './generated/client/index.js';
import {
  createServiceClient,
  createLogger,
  asyncHandler,
  getUserId,
  bootstrapService,
  useServiceErrorHandler,
  requireInternalSecret,
  FEATURE_FLAGS,
} from '@banking/shared';

const prisma = new PrismaClient();
const log = createLogger('admin-service');
const app = express();
const PORT = process.env.PORT || 3009;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'admin-service' });

const creditCardClient = createServiceClient({
  baseURL: process.env.CREDIT_CARD_SERVICE_URL || 'http://localhost:3005',
  internalSecret: INTERNAL_SECRET,
});
const loanClient = createServiceClient({
  baseURL: process.env.LOAN_SERVICE_URL || 'http://localhost:3006',
  internalSecret: INTERNAL_SECRET,
});
const userClient = createServiceClient({
  baseURL: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  internalSecret: INTERNAL_SECRET,
});

app.use(cors());
app.use(express.json());

const DEFAULT_FLAGS = [
  { key: FEATURE_FLAGS.FAIL_ACCOUNT_INSERT, description: 'Block account creation inserts (account-service)' },
  { key: FEATURE_FLAGS.FAIL_TRANSACTION_INSERT, description: 'Block transfer/bill-pay transaction inserts' },
  { key: FEATURE_FLAGS.FAIL_NOTIFICATION_INSERT, description: 'Block notification inserts' },
  { key: FEATURE_FLAGS.FAIL_CARD_APPLICATION_INSERT, description: 'Block credit card application inserts' },
  { key: FEATURE_FLAGS.FAIL_LOAN_APPLICATION_INSERT, description: 'Block loan application inserts' },
  { key: FEATURE_FLAGS.FAIL_USER_PROFILE_UPSERT, description: 'Block user profile upserts' },
];

async function seedFeatureFlags(): Promise<void> {
  for (const flag of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: { key: flag.key, description: flag.description, enabled: false },
      update: {},
    });
  }
  log.info('Feature flags initialized', { count: DEFAULT_FLAGS.length });
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const role = req.headers['x-user-role'] as string;
  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

async function audit(adminId: string, action: string, targetType: string, targetId: string, details?: string) {
  await prisma.auditLog.create({ data: { adminId, action, targetType, targetId, details } });
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'admin-service' }));

app.get(
  '/internal/feature-flags',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (_req, res) => {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    res.json({ data: flags });
  })
);

app.use(requireAdmin);

app.get(
  '/feature-flags',
  asyncHandler(async (_req, res) => {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    res.json({ data: flags });
  })
);

app.patch(
  '/feature-flags/:key',
  asyncHandler(async (req, res) => {
    const adminId = getUserId(req);
    const { enabled } = req.body as { enabled: boolean };
    const flag = await prisma.featureFlag.update({
      where: { key: String(req.params.key) },
      data: { enabled: Boolean(enabled), updatedBy: adminId },
    });
    await audit(adminId, enabled ? 'FLAG_ENABLED' : 'FLAG_DISABLED', 'FeatureFlag', flag.key);
    log.warn('Feature flag toggled', { flagKey: flag.key, enabled: flag.enabled, adminId });
    res.json(flag);
  })
);

app.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [cardApps, loanApps, flags] = await Promise.all([
      creditCardClient.get('/internal/applications/pending'),
      loanClient.get('/internal/applications/pending'),
      prisma.featureFlag.findMany({ where: { enabled: true } }),
    ]);
    res.json({
      pendingCardApplications: cardApps.data.data.length,
      pendingLoanApplications: loanApps.data.data.length,
      activeFeatureFlags: flags.map((f) => f.key),
    });
  })
);

app.get(
  '/applications/cards',
  asyncHandler(async (_req, res) => {
    const { data } = await creditCardClient.get('/internal/applications/pending');
    res.json(data);
  })
);

app.get(
  '/applications/loans',
  asyncHandler(async (_req, res) => {
    const { data } = await loanClient.get('/internal/applications/pending');
    res.json(data);
  })
);

app.post(
  '/applications/cards/:id/decide',
  asyncHandler(async (req, res) => {
    const adminId = getUserId(req);
    const { decision, reason } = req.body as { decision: 'APPROVED' | 'DENIED'; reason?: string };
    const { data } = await creditCardClient.post(`/internal/applications/${String(req.params.id)}/decide`, {
      decision,
      reason,
      adminId,
    });
    await audit(adminId, `CARD_${decision}`, 'CardApplication', String(req.params.id), reason);
    res.json(data);
  })
);

app.post(
  '/applications/loans/:id/decide',
  asyncHandler(async (req, res) => {
    const adminId = getUserId(req);
    const { decision, reason, disbursementAccountId } = req.body as {
      decision: 'APPROVED' | 'DENIED';
      reason?: string;
      disbursementAccountId?: string;
    };
    const { data } = await loanClient.post(`/internal/applications/${String(req.params.id)}/decide`, {
      decision,
      reason,
      adminId,
      disbursementAccountId,
    });
    await audit(adminId, `LOAN_${decision}`, 'LoanApplication', String(req.params.id), reason);
    res.json(data);
  })
);

app.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const { data } = await userClient.get('/internal/users');
    res.json(data);
  })
);

app.get(
  '/audit-log',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data: logs });
  })
);

useServiceErrorHandler(app, 'admin-service');

seedFeatureFlags()
  .then(() => {
    app.listen(PORT, () => log.info('Admin service listening', { port: PORT }));
  })
  .catch((err) => {
    log.fatal('Failed to start admin service', { error: { message: String(err), type: 'StartupError' } });
    process.exit(1);
  });

process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

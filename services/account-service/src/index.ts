import express from 'express';
import cors from 'cors';
import { PrismaClient } from './generated/client/index.js';
import {
  createLogger,
  asyncHandler,
  requireInternalSecret,
  getUserId,
  bootstrapService,
  useServiceErrorHandler,
  assertInsertAllowed,
  FEATURE_FLAGS,
} from '@banking/shared';

const prisma = new PrismaClient();
const log = createLogger('account-service');
const app = express();
const PORT = process.env.PORT || 3003;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'account-service' });

app.use(cors());
app.use(express.json());

function generateAccountNumber(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'account-service' }));

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const accounts = await prisma.account.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: accounts });
  })
);

app.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const account = await prisma.account.findFirst({
      where: { id: String(req.params.id), userId },
    });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json(account);
  })
);

app.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { type, name, initialBalance } = req.body as {
      type?: string;
      name?: string;
      initialBalance?: number;
    };
    if (!type || !name) {
      res.status(400).json({ error: 'Type and name required' });
      return;
    }
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_ACCOUNT_INSERT);
    const account = await prisma.account.create({
      data: {
        userId,
        accountNumber: generateAccountNumber(),
        type,
        name,
        balance: initialBalance || 0,
      },
    });
    res.status(201).json(account);
  })
);

app.post(
  '/internal/debit',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { accountId, amount } = req.body as { accountId: string; amount: number };
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.status !== 'ACTIVE') {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (account.balance < amount) {
      res.status(400).json({ error: 'Insufficient funds' });
      return;
    }
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: { balance: { decrement: amount } },
    });
    res.json(updated);
  })
);

app.post(
  '/internal/credit',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { accountId, amount } = req.body as { accountId: string; amount: number };
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: amount } },
    });
    res.json(updated);
  })
);

app.post(
  '/internal/create',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { userId, type, name, initialBalance } = req.body as {
      userId: string;
      type: string;
      name: string;
      initialBalance?: number;
    };
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_ACCOUNT_INSERT);
    const account = await prisma.account.create({
      data: {
        userId,
        accountNumber: generateAccountNumber(),
        type,
        name,
        balance: initialBalance || 0,
      },
    });
    res.status(201).json(account);
  })
);

app.get(
  '/internal/user/:userId',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { userId: String(req.params.userId), status: 'ACTIVE' },
    });
    res.json({ data: accounts });
  })
);

useServiceErrorHandler(app, 'account-service');

app.listen(PORT, () => log.info('Account service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

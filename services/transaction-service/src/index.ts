import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { PrismaClient } from './generated/client/index.js';
import {
  createServiceClient,
  withUserContext,
  createLogger,
  asyncHandler,
  getUserId,
  bootstrapService,
  useServiceErrorHandler,
  assertInsertAllowed,
  FEATURE_FLAGS,
} from '@banking/shared';

const prisma = new PrismaClient();
const log = createLogger('transaction-service');
const app = express();
const PORT = process.env.PORT || 3004;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';
const STEP_UP_THRESHOLD = 1000;

bootstrapService({ app, serviceName: 'transaction-service' });

const accountClient = createServiceClient({
  baseURL: process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3003',
  internalSecret: INTERNAL_SECRET,
});
const notificationClient = createServiceClient({
  baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008',
  internalSecret: INTERNAL_SECRET,
});

app.use(cors());
app.use(express.json());

async function executeTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  description?: string
): Promise<{ transaction: unknown; success: boolean; error?: string }> {
  await assertInsertAllowed(FEATURE_FLAGS.FAIL_TRANSACTION_INSERT);
  const txn = await prisma.transaction.create({
    data: {
      userId,
      type: 'TRANSFER',
      status: 'PENDING',
      amount,
      fromAccountId,
      toAccountId,
      description,
    },
  });
  try {
    await accountClient.post('/internal/debit', { accountId: fromAccountId, amount });
    try {
      await accountClient.post('/internal/credit', { accountId: toAccountId, amount });
    } catch (creditErr) {
      await accountClient.post('/internal/credit', { accountId: fromAccountId, amount });
      throw creditErr;
    }
    const completed = await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: 'COMPLETED' },
    });
    await notificationClient.post(
      '/internal/notify',
      {
        userId,
        title: 'Transfer Completed',
        message: `$${amount.toFixed(2)} transferred successfully.`,
        sendEmail: true,
        emailSubject: 'Transfer Receipt - SecureBank',
        emailBody: `<p>Your transfer of <strong>$${amount.toFixed(2)}</strong> has been completed.</p>`,
      },
      withUserContext({}, userId)
    );
    return { transaction: completed, success: true };
  } catch (err) {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: 'FAILED' },
    });
    return { transaction: txn, success: false, error: String(err) };
  }
}

function addFrequency(date: Date, frequency: string): Date {
  const next = new Date(date);
  if (frequency === 'DAILY') next.setDate(next.getDate() + 1);
  else if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  return next;
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'transaction-service' }));

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data: transactions });
  })
);

app.post(
  '/transfer',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromAccountId, toAccountId, amount, description, mfaVerified } = req.body as {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      description?: string;
      mfaVerified?: boolean;
    };
    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid transfer parameters' });
      return;
    }
    if (amount > STEP_UP_THRESHOLD && !mfaVerified) {
      res.status(403).json({ error: 'MFA step-up required for transfers over $1,000', code: 'MFA_REQUIRED' });
      return;
    }
    const result = await executeTransfer(userId, fromAccountId, toAccountId, amount, description);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Transfer failed' });
      return;
    }
    res.status(201).json(result.transaction);
  })
);

app.post(
  '/bill-pay',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromAccountId, payeeName, amount, payeeId } = req.body as {
      fromAccountId: string;
      payeeName: string;
      amount: number;
      payeeId?: string;
    };
    if (!fromAccountId || !payeeName || !amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid bill pay parameters' });
      return;
    }
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_TRANSACTION_INSERT);
    const txn = await prisma.transaction.create({
      data: {
        userId,
        type: 'BILL_PAY',
        status: 'PENDING',
        amount,
        fromAccountId,
        payeeName,
        description: `Bill payment to ${payeeName}`,
      },
    });
    try {
      await accountClient.post('/internal/debit', { accountId: fromAccountId, amount });
      const completed = await prisma.transaction.update({
        where: { id: txn.id },
        data: { status: 'COMPLETED' },
      });
      await notificationClient.post(
        '/internal/notify',
        {
          userId,
          title: 'Bill Payment Completed',
          message: `$${amount.toFixed(2)} paid to ${payeeName}.`,
          sendEmail: true,
          emailSubject: 'Bill Payment Receipt - SecureBank',
          emailBody: `<p>Your bill payment of <strong>$${amount.toFixed(2)}</strong> to ${payeeName} has been processed.</p>`,
        },
        withUserContext({}, userId)
      );
      res.status(201).json(completed);
    } catch (err) {
      await prisma.transaction.update({ where: { id: txn.id }, data: { status: 'FAILED' } });
      res.status(400).json({ error: String(err) });
    }
  })
);

app.get(
  '/payees',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const payees = await prisma.payee.findMany({ where: { userId } });
    res.json({ data: payees });
  })
);

app.post(
  '/payees',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { name, accountNumber } = req.body as { name: string; accountNumber?: string };
    const payee = await prisma.payee.create({ data: { userId, name, accountNumber } });
    res.status(201).json(payee);
  })
);

app.get(
  '/scheduled',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const schedules = await prisma.scheduledTransfer.findMany({ where: { userId } });
    res.json({ data: schedules });
  })
);

app.post(
  '/scheduled',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromAccountId, toAccountId, amount, frequency } = req.body as {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      frequency: string;
    };
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      res.status(400).json({ error: 'Invalid frequency' });
      return;
    }
    const schedule = await prisma.scheduledTransfer.create({
      data: {
        userId,
        fromAccountId,
        toAccountId,
        amount,
        frequency,
        nextRunAt: addFrequency(new Date(), frequency),
      },
    });
    res.status(201).json(schedule);
  })
);

app.delete(
  '/scheduled/:id',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    await prisma.scheduledTransfer.updateMany({
      where: { id: String(req.params.id), userId },
      data: { active: false },
    });
    res.json({ success: true });
  })
);

cron.schedule('* * * * *', async () => {
  const due = await prisma.scheduledTransfer.findMany({
    where: { active: true, nextRunAt: { lte: new Date() } },
  });
  for (const schedule of due) {
    const result = await executeTransfer(
      schedule.userId,
      schedule.fromAccountId,
      schedule.toAccountId,
      schedule.amount,
      `Scheduled ${schedule.frequency} transfer`
    );
    if (result.success) {
      await prisma.scheduledTransfer.update({
        where: { id: schedule.id },
        data: { nextRunAt: addFrequency(schedule.nextRunAt, schedule.frequency) },
      });
    }
    log.info('Scheduled transfer executed', { id: schedule.id, success: result.success });
  }
});

useServiceErrorHandler(app, 'transaction-service');

app.listen(PORT, () => log.info('Transaction service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

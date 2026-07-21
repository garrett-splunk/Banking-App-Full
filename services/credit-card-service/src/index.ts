import express from 'express';
import cors from 'cors';
import { PrismaClient } from './generated/client/index.js';
import {
  createServiceClient,
  withUserContext,
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
const log = createLogger('credit-card-service');
const app = express();
const PORT = process.env.PORT || 3005;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'credit-card-service' });

const userClient = createServiceClient({
  baseURL: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  internalSecret: INTERNAL_SECRET,
});
const documentClient = createServiceClient({
  baseURL: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3007',
  internalSecret: INTERNAL_SECRET,
});
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

async function validatePrerequisites(userId: string): Promise<string | null> {
  const { data: profileCheck } = await userClient.get(`/internal/${userId}/completeness`);
  if (!profileCheck.profileComplete) return 'Profile must be complete before applying';
  const { data: docCheck } = await documentClient.get(`/internal/${userId}/verification`);
  if (!docCheck.verified) return 'Required documents must be verified before applying';
  return null;
}

function generateMaskedPan(): string {
  const last4 = Math.floor(1000 + Math.random() * 9000);
  return `**** **** **** ${last4}`;
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'credit-card-service' }));

app.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const apps = await prisma.cardApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: apps });
  })
);

app.post(
  '/applications',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { requestedLimit, cardType } = req.body as { requestedLimit: number; cardType: string };
    const error = await validatePrerequisites(userId);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_CARD_APPLICATION_INSERT);
    const app_record = await prisma.cardApplication.create({
      data: {
        userId,
        requestedLimit,
        cardType: cardType || 'STANDARD',
        status: 'SUBMITTED',
      },
    });
    await prisma.cardApplication.update({
      where: { id: app_record.id },
      data: { status: 'UNDER_REVIEW' },
    });
    await notificationClient.post(
      '/internal/notify',
      {
        userId,
        title: 'Credit Card Application Submitted',
        message: 'Your credit card application is under review.',
        sendEmail: true,
        emailSubject: 'Credit Card Application Received',
        emailBody: '<p>We have received your credit card application and will review it shortly.</p>',
      },
      withUserContext({}, userId)
    );
    const updated = await prisma.cardApplication.findUnique({ where: { id: app_record.id } });
    res.status(201).json(updated);
  })
);

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const cards = await prisma.creditCard.findMany({ where: { userId } });
    res.json({ data: cards });
  })
);

app.get(
  '/internal/applications/pending',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (_req, res) => {
    const apps = await prisma.cardApplication.findMany({
      where: { status: 'UNDER_REVIEW' },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: apps });
  })
);

app.post(
  '/internal/applications/:id/decide',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { decision, reason, adminId } = req.body as {
      decision: 'APPROVED' | 'DENIED';
      reason?: string;
      adminId?: string;
    };
    const application = await prisma.cardApplication.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!application || application.status !== 'UNDER_REVIEW') {
      res.status(404).json({ error: 'Application not found or not reviewable' });
      return;
    }
    if (decision === 'DENIED') {
      const updated = await prisma.cardApplication.update({
        where: { id: application.id },
        data: { status: 'DENIED', decisionReason: reason || 'Application denied' },
      });
      await notificationClient.post(
        '/internal/notify',
        {
          userId: application.userId,
          title: 'Credit Card Application Denied',
          message: reason || 'Your credit card application was not approved.',
          sendEmail: true,
          emailSubject: 'Credit Card Application Decision',
          emailBody: `<p>We regret to inform you that your credit card application was not approved.${reason ? ` Reason: ${reason}` : ''}</p>`,
        },
        withUserContext({}, application.userId)
      );
      res.json(updated);
      return;
    }
    const { data: account } = await accountClient.post('/internal/create', {
      userId: application.userId,
      type: 'CREDIT_CARD',
      name: `${application.cardType} Credit Card`,
      initialBalance: 0,
    });
    const limit = application.requestedLimit;
    const card = await prisma.creditCard.create({
      data: {
        userId: application.userId,
        applicationId: application.id,
        accountId: account.id,
        maskedPan: generateMaskedPan(),
        creditLimit: limit,
        availableCredit: limit,
        expiryDate: `${new Date().getMonth() + 1}/${(new Date().getFullYear() + 3) % 100}`,
      },
    });
    const updated = await prisma.cardApplication.update({
      where: { id: application.id },
      data: { status: 'APPROVED', decisionReason: reason || 'Approved' },
    });
    await notificationClient.post(
      '/internal/notify',
      {
        userId: application.userId,
        title: 'Credit Card Approved!',
        message: `Your ${application.cardType} card ending in ${card.maskedPan.slice(-4)} has been approved.`,
        sendEmail: true,
        emailSubject: 'Your Credit Card Has Been Approved',
        emailBody: `<p>Congratulations! Your credit card has been approved with a limit of $${limit.toFixed(2)}. Your card will arrive in 7-10 business days.</p>`,
      },
      withUserContext({}, application.userId)
    );
    log.info('Card application approved', { applicationId: application.id, adminId });
    res.json({ application: updated, card });
  })
);

useServiceErrorHandler(app, 'credit-card-service');

app.listen(PORT, () => log.info('Credit card service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

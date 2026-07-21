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
const log = createLogger('loan-service');
const app = express();
const PORT = process.env.PORT || 3006;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'loan-service' });

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

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function calculateUnderwritingScore(annualIncome: number, requestedAmount: number): number {
  const ratio = requestedAmount / (annualIncome || 1);
  return Math.max(300, Math.min(850, 850 - ratio * 200));
}

async function validatePrerequisites(userId: string): Promise<string | null> {
  const { data: profileCheck } = await userClient.get(`/internal/${userId}/completeness`);
  if (!profileCheck.profileComplete) return 'Profile must be complete before applying';
  const { data: docCheck } = await documentClient.get(`/internal/${userId}/verification`);
  if (!docCheck.verified) return 'Required documents must be verified before applying';
  return null;
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'loan-service' }));

app.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const apps = await prisma.loanApplication.findMany({
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
    const { loanType, requestedAmount, termMonths, purpose } = req.body as {
      loanType: string;
      requestedAmount: number;
      termMonths: number;
      purpose: string;
    };
    const error = await validatePrerequisites(userId);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const { data: profileCheck } = await userClient.get(`/internal/${userId}/completeness`);
    const score = calculateUnderwritingScore(
      profileCheck.profile?.annualIncome || 50000,
      requestedAmount
    );
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_LOAN_APPLICATION_INSERT);
    const app_record = await prisma.loanApplication.create({
      data: {
        userId,
        loanType: loanType || 'PERSONAL',
        requestedAmount,
        termMonths,
        purpose,
        underwritingScore: score,
        status: 'SUBMITTED',
      },
    });
    await prisma.loanApplication.update({
      where: { id: app_record.id },
      data: { status: 'UNDER_REVIEW' },
    });
    await notificationClient.post(
      '/internal/notify',
      {
        userId,
        title: 'Loan Application Submitted',
        message: 'Your loan application is under review.',
        sendEmail: true,
        emailSubject: 'Loan Application Received',
        emailBody: '<p>We have received your loan application and will review it shortly.</p>',
      },
      withUserContext({}, userId)
    );
    const updated = await prisma.loanApplication.findUnique({ where: { id: app_record.id } });
    res.status(201).json(updated);
  })
);

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const loans = await prisma.loan.findMany({ where: { userId } });
    res.json({ data: loans });
  })
);

app.get(
  '/internal/applications/pending',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (_req, res) => {
    const apps = await prisma.loanApplication.findMany({
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
    const { decision, reason, adminId, disbursementAccountId } = req.body as {
      decision: 'APPROVED' | 'DENIED';
      reason?: string;
      adminId?: string;
      disbursementAccountId?: string;
    };
    const application = await prisma.loanApplication.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!application || application.status !== 'UNDER_REVIEW') {
      res.status(404).json({ error: 'Application not found or not reviewable' });
      return;
    }
    if (decision === 'DENIED') {
      const updated = await prisma.loanApplication.update({
        where: { id: application.id },
        data: { status: 'DENIED', decisionReason: reason || 'Application denied' },
      });
      await notificationClient.post(
        '/internal/notify',
        {
          userId: application.userId,
          title: 'Loan Application Denied',
          message: reason || 'Your loan application was not approved.',
          sendEmail: true,
          emailSubject: 'Loan Application Decision',
          emailBody: `<p>We regret to inform you that your loan application was not approved.${reason ? ` Reason: ${reason}` : ''}</p>`,
        },
        withUserContext({}, application.userId)
      );
      res.json(updated);
      return;
    }
    const interestRate = 7.5;
    const monthlyPayment = calculateMonthlyPayment(
      application.requestedAmount,
      interestRate,
      application.termMonths
    );
    const { data: loanAccount } = await accountClient.post('/internal/create', {
      userId: application.userId,
      type: 'LOAN',
      name: `${application.loanType} Loan`,
      initialBalance: 0,
    });
    const loan = await prisma.loan.create({
      data: {
        userId: application.userId,
        applicationId: application.id,
        accountId: loanAccount.id,
        principal: application.requestedAmount,
        interestRate,
        termMonths: application.termMonths,
        monthlyPayment,
        remainingBalance: application.requestedAmount,
      },
    });
    if (disbursementAccountId) {
      await accountClient.post('/internal/credit', {
        accountId: disbursementAccountId,
        amount: application.requestedAmount,
      });
    }
    const updated = await prisma.loanApplication.update({
      where: { id: application.id },
      data: { status: 'APPROVED', decisionReason: reason || 'Approved' },
    });
    await notificationClient.post(
      '/internal/notify',
      {
        userId: application.userId,
        title: 'Loan Approved!',
        message: `Your ${application.loanType} loan of $${application.requestedAmount.toFixed(2)} has been approved.`,
        sendEmail: true,
        emailSubject: 'Your Loan Has Been Approved',
        emailBody: `<p>Congratulations! Your loan of <strong>$${application.requestedAmount.toFixed(2)}</strong> has been approved. Monthly payment: $${monthlyPayment.toFixed(2)}.</p>`,
      },
      withUserContext({}, application.userId)
    );
    log.info('Loan application approved', { applicationId: application.id, adminId });
    res.json({ application: updated, loan });
  })
);

useServiceErrorHandler(app, 'loan-service');

app.listen(PORT, () => log.info('Loan service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

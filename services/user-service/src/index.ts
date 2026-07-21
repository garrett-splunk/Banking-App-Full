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
const log = createLogger('user-service');
const app = express();
const PORT = process.env.PORT || 3002;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'user-service' });

app.use(cors());
app.use(express.json());

function checkProfileComplete(profile: {
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  employmentStatus: string | null;
  annualIncome: number | null;
}): boolean {
  return !!(
    profile.firstName &&
    profile.lastName &&
    profile.phone &&
    profile.dateOfBirth &&
    profile.addressLine1 &&
    profile.city &&
    profile.state &&
    profile.zipCode &&
    profile.employmentStatus &&
    profile.annualIncome
  );
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

app.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    let profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      const email = (req.headers['x-user-email'] as string) || '';
      profile = await prisma.userProfile.create({
        data: { userId, email, firstName: '', lastName: '' },
      });
    }
    res.json(profile);
  })
);

app.put(
  '/profile',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const email = (req.headers['x-user-email'] as string) || '';
    const data = req.body as Record<string, unknown>;
    const fields = {
      firstName: String(data.firstName || ''),
      lastName: String(data.lastName || ''),
      phone: data.phone ? String(data.phone) : null,
      dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : null,
      addressLine1: data.addressLine1 ? String(data.addressLine1) : null,
      addressLine2: data.addressLine2 ? String(data.addressLine2) : null,
      city: data.city ? String(data.city) : null,
      state: data.state ? String(data.state) : null,
      zipCode: data.zipCode ? String(data.zipCode) : null,
      employmentStatus: data.employmentStatus ? String(data.employmentStatus) : null,
      annualIncome: data.annualIncome ? Number(data.annualIncome) : null,
    };
    const profileComplete = checkProfileComplete(fields);
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_USER_PROFILE_UPSERT);
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, email, ...fields, profileComplete },
      update: { ...fields, profileComplete },
    });
    res.json(profile);
  })
);

app.get(
  '/internal/:userId/completeness',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: String(req.params.userId) },
    });
    res.json({
      userId: String(req.params.userId),
      profileComplete: profile?.profileComplete ?? false,
      profile: profile || null,
    });
  })
);

app.get(
  '/internal/users',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (_req, res) => {
    const users = await prisma.userProfile.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ data: users });
  })
);

app.post(
  '/internal/ensure',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { userId, email } = req.body as { userId: string; email: string };
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, email, firstName: '', lastName: '' },
      update: {},
    });
    res.json(profile);
  })
);

useServiceErrorHandler(app, 'user-service');

app.listen(PORT, () => log.info('User service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

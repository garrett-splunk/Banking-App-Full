import bcrypt from 'bcrypt';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient } from './generated/client/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  createJwtPayload,
  createServiceClient,
  withUserContext,
  createLogger,
  asyncHandler,
  bootstrapService,
  useServiceErrorHandler,
} from '@banking/shared';

const prisma = new PrismaClient();
const log = createLogger('auth-service');
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'auth-service' });
const notificationClient = createServiceClient({
  baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008',
  internalSecret: INTERNAL_SECRET,
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function sendWelcomeEmail(userId: string, email: string): Promise<void> {
  try {
    await notificationClient.post(
      '/internal/notify',
      {
        userId,
        title: 'Welcome to SecureBank',
        message: `Welcome ${email}! Your account has been created successfully.`,
        sendEmail: true,
        emailSubject: 'Welcome to SecureBank',
        emailBody: `<p>Welcome to SecureBank! We're glad to have you.</p>`,
      },
      withUserContext({}, userId)
    );
  } catch (err) {
    log.warn('Failed to send welcome email', { error: String(err) });
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

app.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, role } = req.body as { email?: string; password?: string; role?: string };
    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'Email and password (min 8 chars) required' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(400).json({ error: 'Invalid registration request' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: role === 'admin' ? 'admin' : 'customer',
      },
    });
    await sendWelcomeEmail(user.id, user.email);
    res.status(201).json({ userId: user.id, email: user.email, role: user.role });
  })
);

app.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, mfaCode } = req.body as {
      email?: string;
      password?: string;
      mfaCode?: string;
    };
    if (!email || !password) {
      res.status(400).json({ error: 'Invalid username or password' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    if (user.mfaEnabled) {
      if (!mfaCode) {
        res.status(200).json({ mfaRequired: true, userId: user.id });
        return;
      }
      const valid = speakeasy.totp.verify({
        secret: user.mfaSecret!,
        encoding: 'base32',
        token: mfaCode,
        window: 1,
      });
      if (!valid) {
        res.status(401).json({ error: 'Invalid MFA code' });
        return;
      }
    }
    const payload = createJwtPayload(user.id, user.email, user.role as 'customer' | 'admin', user.mfaEnabled);
    const accessToken = signAccessToken(payload, JWT_SECRET);
    const refreshToken = signRefreshToken(user.id, JWT_REFRESH_SECRET);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled },
    });
  })
);

app.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }
    const { sub: userId } = verifyRefreshToken(token, JWT_REFRESH_SECRET);
    const tokenHash = hashToken(token);
    const stored = await prisma.refreshToken.findFirst({
      where: { userId, tokenHash, expiresAt: { gt: new Date() } },
    });
    if (!stored) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    const payload = createJwtPayload(
      user.id,
      user.email,
      user.role as 'customer' | 'admin',
      user.mfaEnabled
    );
    const accessToken = signAccessToken(payload, JWT_SECRET);
    res.json({ accessToken });
  })
);

app.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    res.clearCookie('refreshToken');
    res.json({ success: true });
  })
);

app.post(
  '/mfa/enroll',
  asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const secret = speakeasy.generateSecret({ name: `SecureBank (${user.email})` });
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    res.json({ secret: secret.base32, qrCode });
  })
);

app.post(
  '/mfa/verify',
  asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { code } = req.body as { code?: string };
    if (!userId || !code) {
      res.status(400).json({ error: 'User and code required' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      res.status(400).json({ error: 'MFA not enrolled' });
      return;
    }
    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) {
      res.status(400).json({ error: 'Invalid MFA code' });
      return;
    }
    await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    res.json({ success: true, mfaEnabled: true });
  })
);

app.post(
  '/mfa/disable',
  asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { code, password } = req.body as { code?: string; password?: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (user.mfaEnabled) {
      const valid = speakeasy.totp.verify({
        secret: user.mfaSecret!,
        encoding: 'base32',
        token: code || '',
        window: 1,
      });
      if (!valid) {
        res.status(401).json({ error: 'Invalid MFA code' });
        return;
      }
    }
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    res.json({ success: true, mfaEnabled: false });
  })
);

app.get(
  '/me',
  asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, mfaEnabled: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  })
);

useServiceErrorHandler(app, 'auth-service');

app.listen(PORT, () => {
  log.info('Auth service listening', { port: PORT });
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

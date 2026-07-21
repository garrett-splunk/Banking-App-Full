import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
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
const log = createLogger('notification-service');
const app = express();
const PORT = process.env.PORT || 3008;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';

bootstrapService({ app, serviceName: 'notification-service' });

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'localhost',
  port: Number(process.env.MAIL_PORT || 1025),
  secure: false,
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data: notifications });
  })
);

app.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId },
      data: { read: true },
    });
    res.json({ success: true });
  })
);

app.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    await prisma.notification.updateMany({ where: { userId }, data: { read: true } });
    res.json({ success: true });
  })
);

app.post(
  '/internal/notify',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { userId, title, message, sendEmail, emailSubject, emailBody, email } = req.body as {
      userId: string;
      title: string;
      message: string;
      sendEmail?: boolean;
      emailSubject?: string;
      emailBody?: string;
      email?: string;
    };
    await assertInsertAllowed(FEATURE_FLAGS.FAIL_NOTIFICATION_INSERT);
    const notification = await prisma.notification.create({
      data: { userId, title, message },
    });
    if (sendEmail) {
      let toEmail = email;
      if (!toEmail) {
        const userEmail = await prisma.userEmail.findUnique({ where: { userId } });
        toEmail = userEmail?.email;
      }
      if (toEmail) {
        try {
          await transporter.sendMail({
            from: 'SecureBank <noreply@securebank.demo>',
            to: toEmail,
            subject: emailSubject || title,
            html: emailBody || `<p>${message}</p>`,
          });
          log.info('Email sent', { userId, to: toEmail });
        } catch (err) {
          log.warn('Email send failed', { error: String(err) });
        }
      }
    }
    res.status(201).json(notification);
  })
);

app.post(
  '/internal/register-email',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const { userId, email } = req.body as { userId: string; email: string };
    await prisma.userEmail.upsert({
      where: { userId },
      create: { userId, email },
      update: { email },
    });
    res.json({ success: true });
  })
);

useServiceErrorHandler(app, 'notification-service');

app.listen(PORT, () => log.info('Notification service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

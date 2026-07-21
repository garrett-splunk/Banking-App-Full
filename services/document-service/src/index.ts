import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from './generated/client/index.js';
import {
  createLogger,
  asyncHandler,
  requireInternalSecret,
  getUserId,
  bootstrapService,
  useServiceErrorHandler,
} from '@banking/shared';

const prisma = new PrismaClient();
const log = createLogger('document-service');
const app = express();
const PORT = process.env.PORT || 3007;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'internal-secret';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

bootstrapService({ app, serviceName: 'document-service' });

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const REQUIRED_TYPES = ['GOVERNMENT_ID', 'PROOF_OF_INCOME'];

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'document-service' }));

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const docs = await prisma.document.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, userId: true, type: true, fileName: true, status: true, uploadedAt: true },
    });
    res.json({ data: docs });
  })
);

app.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const type = req.body.type as string;
    if (!req.file || !type) {
      res.status(400).json({ error: 'File and type required' });
      return;
    }
    const validTypes = ['GOVERNMENT_ID', 'PROOF_OF_INCOME', 'PROOF_OF_ADDRESS'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid document type' });
      return;
    }
    const doc = await prisma.document.create({
      data: {
        userId,
        type,
        fileName: req.file.originalname,
        filePath: req.file.path,
        status: 'PENDING',
      },
    });
    setTimeout(async () => {
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'VERIFIED' } });
    }, 3000);
    res.status(201).json({
      id: doc.id,
      userId: doc.userId,
      type: doc.type,
      fileName: doc.fileName,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
    });
  })
);

app.get(
  '/internal/:userId/verification',
  requireInternalSecret(INTERNAL_SECRET),
  asyncHandler(async (req, res) => {
    const docs = await prisma.document.findMany({ where: { userId: String(req.params.userId) } });
    const verified = REQUIRED_TYPES.every((t) =>
      docs.some((d) => d.type === t && d.status === 'VERIFIED')
    );
    res.json({ userId: String(req.params.userId), verified, documents: docs });
  })
);

useServiceErrorHandler(app, 'document-service');

app.listen(PORT, () => log.info('Document service listening', { port: PORT }));
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

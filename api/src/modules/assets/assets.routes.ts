import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middleware/auth';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';
import { getStorageProvider } from '../../common/storage';
import { Response, NextFunction } from 'express';

// Files are buffered in memory, then handed to the configured storage provider
// (local disk or S3/MinIO — see common/storage.ts). Keeps this route provider-agnostic.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { clientId, type } = req.query;
    const where: any = { agencyId: req.user!.agencyId, deletedAt: null };
    if (clientId) where.clientId = clientId;
    if (type) where.type = type;

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(assets);
  } catch (err) { next(err); }
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { clientId, contentId, type = 'IMAGE', name } = req.body;
    const { storageKey, publicUrl } = await getStorageProvider().upload(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const asset = await prisma.asset.create({
      data: {
        agencyId: req.user!.agencyId,
        clientId: clientId || null,
        uploadedBy: req.user!.id,
        type,
        name: name || req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageKey,
        publicUrl,
      },
    });

    // Attach directly to a content piece, when the upload came from the content workspace.
    if (contentId) {
      const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: req.user!.agencyId } });
      if (content) {
        const sortOrder = await prisma.contentAsset.count({ where: { contentId } });
        await prisma.contentAsset.create({
          data: { agencyId: req.user!.agencyId, contentId, assetId: asset.id, role: 'PRIMARY', sortOrder },
        });
      }
    }

    res.status(201).json(asset);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const asset = await prisma.asset.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId },
    });
    if (!asset) throw new NotFoundError('Asset not found');

    await prisma.asset.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    await getStorageProvider().remove(asset.storageKey).catch(() => {}); // Non-blocking
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;

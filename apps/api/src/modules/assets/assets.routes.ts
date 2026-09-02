import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middleware/auth';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { getStorageProvider } from '../../common/storage';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  // video/quicktime (.mov) matters a lot in practice — it's the default export format on
  // iPhone, so rejecting it silently sent every iPhone-recorded video down the same broken
  // path: fileFilter errors out, but the browser keeps pushing the (often large) file over the
  // wire regardless, so the request just looked hung until the upload finished and only then
  // surfaced the error.
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
];

// Files are buffered in memory, then handed to the configured storage provider
// (local disk or S3/MinIO — see common/storage.ts). Keeps this route provider-agnostic.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB — short marketing videos (Reels/Stories) need more room than images
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError(`Tipo de arquivo não suportado (${file.mimetype}). Use JPG, PNG, WEBP, GIF, MP4, MOV, WEBM ou PDF.`));
  },
});

// Multer (and the fileFilter rejection above) reports failures by calling `next(err)` from
// inside `upload.single('file')` — without this handler right after it in the chain, that error
// still reached the generic app-level errorHandler eventually, but only after the response had
// already stalled from the frontend's point of view. Catching it here, right where it's thrown,
// keeps the failure fast and its message specific (file too large vs wrong type) instead of a
// generic "Internal server error".
function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande — o limite é 100MB.', statusCode: 400 });
    }
    return res.status(400).json({ error: `Erro no upload: ${err.message}`, statusCode: 400 });
  }
  next(err);
}

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

router.post('/upload', upload.single('file'), handleUploadError, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { clientId, contentId, name } = req.body;
    // Derived from the actual file, not trusted from the client — this is what
    // publishToMeta/sendWhatsAppMedia branch on to pick image vs video Graph API calls.
    const type = req.file.mimetype.startsWith('video/') ? 'VIDEO' : req.file.mimetype === 'application/pdf' ? 'DOCUMENT' : 'IMAGE';
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

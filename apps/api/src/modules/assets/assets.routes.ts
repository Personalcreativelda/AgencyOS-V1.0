import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middleware/auth';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { getStorageProvider } from '../../common/storage';
import { setContentPrimaryAssets } from './contentAssets';
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
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const sizeMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace('.', ',');
/** Images over 5 MB are refused with a message that names the file (videos keep the 100 MB limit). */
function oversizedImage(files: Express.Multer.File[]) {
  const big = files.find(f => f.mimetype.startsWith('image/') && f.size > MAX_IMAGE_BYTES);
  return big ? `"${big.originalname}" tem ${sizeMb(big.size)} MB e o limite para imagens é 5 MB. Exporte em JPG ou comprima a imagem e tente novamente.` : null;
}

function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Ficheiro demasiado grande: imagens até 5 MB e vídeos até 100 MB.', statusCode: 400 });
    }
    return res.status(400).json({ error: 'Não foi possível receber o ficheiro. Tente novamente.', statusCode: 400 });
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
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro foi enviado.' });
    const tooBig = oversizedImage([req.file]);
    if (tooBig) return res.status(400).json({ error: tooBig });

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
    // Replaces whatever was attached before (see setContentPrimaryAssets) rather than adding
    // to it — a single-file upload always means "this is now THE creative", even for content
    // that previously had a multi-image set from /assets/upload-batch.
    if (contentId) {
      const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: req.user!.agencyId } });
      if (content) {
        await setContentPrimaryAssets(req.user!.agencyId, contentId, [asset.id]);
      }
    }

    res.status(201).json(asset);
  } catch (err) { next(err); }
});

const MAX_CAROUSEL_IMAGES = 10; // matches Instagram's carousel cap, the most restrictive of the networks that support multi-image posts

const uploadBatch = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new ValidationError(`Carrossel aceita apenas imagens (recebido: ${file.mimetype}).`));
  },
});

// Sets a content's ENTIRE creative set in one shot (2+ images — a carousel). Requires
// contentId; unlike /upload, there's no standalone use for this (logos etc. always go through
// the single-file endpoint above).
router.post('/upload-batch', uploadBatch.array('files', MAX_CAROUSEL_IMAGES), handleUploadError, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const tooBigBatch = oversizedImage(files || []);
    if (tooBigBatch) return res.status(400).json({ error: tooBigBatch });
    if (!files || files.length === 0) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const { contentId } = req.body;
    if (!contentId) return res.status(400).json({ error: 'contentId is required' });
    const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: req.user!.agencyId } });
    if (!content) throw new NotFoundError('Content not found');

    const assetIds: string[] = [];
    for (const file of files) {
      const { storageKey, publicUrl } = await getStorageProvider().upload(file.buffer, file.originalname, file.mimetype);
      const asset = await prisma.asset.create({
        data: {
          agencyId: req.user!.agencyId,
          clientId: content.clientId,
          uploadedBy: req.user!.id,
          type: 'IMAGE',
          name: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storageKey,
          publicUrl,
        },
      });
      assetIds.push(asset.id);
    }

    await setContentPrimaryAssets(req.user!.agencyId, contentId, assetIds);
    res.status(201).json({ count: assetIds.length });
  } catch (err) { next(err); }
});

// Re-sets a content's PRIMARY asset set from already-uploaded assets, without re-uploading
// anything — used by the thumbnail strip's remove button (send the remaining ids) and would
// also support reordering if the UI grows drag-to-reorder later.
router.put('/content/:contentId/set', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.params;
    const { assetIds } = req.body as { assetIds?: string[] };
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'assetIds must be a non-empty array' });
    }
    const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: req.user!.agencyId } });
    if (!content) throw new NotFoundError('Content not found');

    const uniqueIds = Array.from(new Set(assetIds));
    const owned = await prisma.asset.count({ where: { id: { in: uniqueIds }, agencyId: req.user!.agencyId } });
    if (owned !== uniqueIds.length) throw new ValidationError('One or more assets were not found');

    await setContentPrimaryAssets(req.user!.agencyId, contentId, uniqueIds);
    res.status(204).send();
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

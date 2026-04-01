import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/mpeg',
];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
];

const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOC_TYPES,
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const JPEG_QUALITY = 85;
const MAX_IMAGE_DIMENSION = 2048;

// Map MIME types to safe file extensions
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.jpg',
  'image/heif': '.jpg',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/mpeg': '.mpeg',
  'application/pdf': '.pdf',
};

const upload = multer({
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALL_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported`));
    }
  },
});

function getFileType(mimetype: string): 'image' | 'video' | 'file' {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimetype)) return 'video';
  return 'file';
}

const MAX_FILE_NAME_LENGTH = 255;

function sanitizeFileName(name: string | undefined): string {
  if (!name || typeof name !== 'string') return 'file';
  // Use only the basename (strip path segments) and limit length
  const base = path.basename(name);
  return base.length > MAX_FILE_NAME_LENGTH ? base.slice(0, MAX_FILE_NAME_LENGTH) : base;
}

router.use(authenticateToken);

router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const multerErr = err as { code?: string; message?: string };
        if (multerErr.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
          return;
        }
        if (err instanceof multer.MulterError) {
          res.status(400).json({ error: multerErr.message || 'Upload failed' });
          return;
        }
        res.status(400).json({ error: multerErr.message || 'Upload failed' });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { mimetype, buffer, originalname } = req.file;
      const fileType = getFileType(mimetype);
      const fileId = uuidv4();
      let outputFileName: string;
      let finalBuffer = buffer;

      // Derive extension from verified MIME type (not from client-provided filename)
      const safeExt = MIME_TO_EXT[mimetype] || '.bin';

      // Convert HEIC/HEIF to JPEG
      if (mimetype === 'image/heic' || mimetype === 'image/heif') {
        finalBuffer = await sharp(buffer).jpeg({ quality: JPEG_QUALITY }).toBuffer();
        outputFileName = `${fileId}.jpg`;
      } else if (fileType === 'image' && mimetype !== 'image/gif') {
        // Optimize other images (except GIFs to preserve animation)
        finalBuffer = await sharp(buffer)
          .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        outputFileName = `${fileId}${safeExt}`;
      } else {
        outputFileName = `${fileId}${safeExt}`;
      }

      const outputPath = path.join(UPLOADS_DIR, outputFileName);
      await fs.promises.writeFile(outputPath, finalBuffer);

      const fileUrl = `/uploads/${outputFileName}`;

      res.json({
        url: fileUrl,
        fileType,
        fileName: sanitizeFileName(originalname),
        size: finalBuffer.length,
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

export default router;

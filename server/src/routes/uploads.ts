import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { detectMimeType } from '../utils/fileSignature';

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

// Ceiling on the pixels sharp will decode. A heavily compressed image can be a
// few hundred kilobytes on the wire and still expand to gigabytes in memory, so
// the 20MB request cap alone does not bound the work. 100 megapixels sits well
// above anything a phone camera produces and well below sharp's ~268 megapixel
// default.
const MAX_INPUT_PIXELS = 100_000_000;

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

// The declared MIME type is only a cheap pre-filter so obviously unsupported
// uploads are rejected before 20MB is buffered. The bytes are what actually
// decide the file's type, once the buffer is in hand.
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

      const { buffer, originalname } = req.file;

      // Identify the file from its contents. The type the client declared got
      // it past the pre-filter but is not trusted beyond that: without this,
      // any bytes at all could be stored and served back under an extension of
      // the uploader's choosing.
      const mimetype = detectMimeType(buffer);
      if (!mimetype || !ALL_ALLOWED_TYPES.includes(mimetype)) {
        res.status(415).json({ error: 'File contents do not match a supported file type' });
        return;
      }

      const fileType = getFileType(mimetype);
      const fileId = uuidv4();
      let outputFileName: string;
      let finalBuffer = buffer;

      // Derive extension from the detected MIME type (not from the
      // client-provided filename or its declared type)
      const safeExt = MIME_TO_EXT[mimetype] || '.bin';

      try {
        // Convert HEIC/HEIF to JPEG
        if (mimetype === 'image/heic' || mimetype === 'image/heif') {
          finalBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer();
          outputFileName = `${fileId}.jpg`;
        } else if (fileType === 'image' && mimetype !== 'image/gif') {
          // Optimize other images (except GIFs to preserve animation)
          finalBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          outputFileName = `${fileId}${safeExt}`;
        } else {
          outputFileName = `${fileId}${safeExt}`;
        }
      } catch (imageErr) {
        // A decode failure here means an unreadable or over-sized image, which
        // is the uploader's problem rather than a server fault.
        console.warn('Image processing rejected upload:', imageErr);
        res.status(422).json({ error: 'Image could not be processed' });
        return;
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

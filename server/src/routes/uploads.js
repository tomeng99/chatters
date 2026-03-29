const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

function getFileType(mimetype) {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimetype)) return 'video';
  if (ALLOWED_DOC_TYPES.includes(mimetype)) return 'file';
  return 'file';
}

router.use(authenticateToken);

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { mimetype, buffer, originalname } = req.file;
    const fileType = getFileType(mimetype);
    const fileId = uuidv4();
    let outputFileName;
    let finalBuffer = buffer;

    // Convert HEIC/HEIF to JPEG
    if (mimetype === 'image/heic' || mimetype === 'image/heif') {
      finalBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
      outputFileName = `${fileId}.jpg`;
    } else if (fileType === 'image' && mimetype !== 'image/gif') {
      // Optimize other images (except GIFs to preserve animation)
      finalBuffer = await sharp(buffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      outputFileName = `${fileId}${path.extname(originalname).toLowerCase() || '.jpg'}`;
    } else {
      outputFileName = `${fileId}${path.extname(originalname).toLowerCase()}`;
    }

    const outputPath = path.join(UPLOADS_DIR, outputFileName);
    await fs.promises.writeFile(outputPath, finalBuffer);

    const fileUrl = `/uploads/${outputFileName}`;

    res.json({
      url: fileUrl,
      fileType,
      fileName: originalname,
      size: finalBuffer.length,
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (err.message && err.message.includes('not supported')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;

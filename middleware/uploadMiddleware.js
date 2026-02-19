// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';

/**
 * Best practice for image optimization pipelines:
 * - Use memoryStorage so we can validate/process the actual bytes (file-type, sharp)
 * - Persist only the optimized derivative (e.g. WebP) to disk
 */

const imageFilter = (_req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, jpeg, png, webp)'), false);
  }
};

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: {
    // "gängiges" Limit: groß genug für Handyfotos, klein genug gegen DoS
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1,
  },
});
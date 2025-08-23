// middleware/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { sanitizeFilename } from '../utils/utils.js';

const ensureUploadDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

const imageFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp, svg)'), false);
  }
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads/images/';
    await ensureUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    cb(null, `${timestamp}-${randomString}-${safeName}`);
  }
});

export const imageUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 // Nur eine Datei pro Upload
  }
});
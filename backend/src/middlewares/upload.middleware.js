import multer from 'multer';
import ApiError from '../libs/ApiError.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();

export const uploadPatientDocument = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'image/gif',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only images and PDF files are allowed'));
    }
    return cb(null, true);
  },
}).single('file');

export default { uploadPatientDocument };

import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

/** 最大文件大小：100 MB */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** 允许的素材格式 */
export const ALLOWED_MIMES: string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'application/octet-stream',
];

/**
 * 通用 multer 配置：内存存储 + 文件类型/大小校验。
 * 图片/视频均走内存暂存（避免磁盘碎片），由 FileStorageService 统一落盘。
 */
export const multerConfig: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_MIMES.includes(file.mimetype) ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
    }
  },
};

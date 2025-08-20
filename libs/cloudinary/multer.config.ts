import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'jpg|jpeg|png|gif').split('|');
const imageRegex = new RegExp(`^image/(${allowedTypes.join('|')})$`, 'i');
const maxSizeMB = Number(process.env.UPLOAD_IMAGE_MAX_SIZE_MB || 2);
export const multerConfig: MulterOptions = {
  limits: {
    fileSize: maxSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (!imageRegex.test(file.mimetype)) {
      return callback(new BadRequestException('common.errors.invalidTypeImage'), false);
    }
    callback(null, true);
  },
};

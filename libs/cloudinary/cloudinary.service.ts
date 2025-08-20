import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  constructor(private readonly loggerService: CustomLogger) {}
  private readonly DEFAULT_FOLDER = process.env.DEFAULT_FOLDER || 'foods_and_drinks';
  async uploadImage(
    file: Express.Multer.File,
    folder: string = this.DEFAULT_FOLDER,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
        if (error || !result) {
          return reject(
            new TypedRpcException({
              code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
              message: 'common.errors.internalServerError',
            }),
          );
        }
        resolve(result);
      });
      streamifier.createReadStream(file.buffer).pipe(upload);
    });
  }
  async deleteImage(publicId: string): Promise<UploadApiResponse> {
    try {
      const result = (await cloudinary.uploader.destroy(publicId)) as UploadApiResponse;
      if (!result || result.result !== 'ok') {
        return this.logAndThrowErrorDeleteImage(`Failed to delete image: ${publicId}`, result);
      }
      return result;
    } catch (error) {
      return this.logAndThrowErrorDeleteImage(
        `Error deleting image: ${publicId}`,
        (error as Error).stack,
      );
    }
  }
  private logAndThrowErrorDeleteImage(context: string, error: unknown): never {
    this.loggerService.error(context, `Details:: ${JSON.stringify(error)}`);
    throw new TypedRpcException({
      code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
      message: 'common.errors.internalServerError',
    });
  }
}

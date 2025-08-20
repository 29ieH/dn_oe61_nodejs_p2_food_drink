import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { UNKNOWN_ERROR_CODE } from '../constant/error-code.constant';
import { HTTP_EXCEPTION_CODE, UNKNOWN_MESSAGE } from '../constant/error-message.constant';
import { HTTP_ERROR_NAME } from '../enums/errors/http-error-name';
import { ValidationErrorResponse } from '../interfaces/validation-error';
import { CustomLogger } from '../logger/custom-logger.service';
import { formatValidationErrors, isRpcError } from '../utils/error.util';
import { httpErrorCodeToHttpStatus } from '../utils/parse-http-error-status';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly i18nService: I18nService,
    private readonly loggerService: CustomLogger,
    private readonly configService: ConfigService,
  ) {}
  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail: object | string | undefined;
    let code: string | number = UNKNOWN_ERROR_CODE;
    let message: string | object = UNKNOWN_MESSAGE;
    this.loggerService.debug('Error catch by filter', JSON.stringify(exception));
    this.loggerService.debug('Instanceof Error:: ', typeof exception);
    if (exception instanceof HttpException) {
      code = HTTP_EXCEPTION_CODE;
      status = exception.getStatus();
      message = exception.message;
      const errorResponse = exception.getResponse();
      this.loggerService.debug('Response error validation:: ', JSON.stringify(errorResponse));
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        status = HttpStatus.BAD_REQUEST;
        code = HTTP_ERROR_NAME.BAD_REQUEST;
        message = this.i18nService.translate('common.errors.invalidSizeImage', {
          args: {
            maxImageSizeMB: this.configService.get<number>('uploadImage.maxSizeMB'),
          },
        });
        return response.status(status).json({
          code,
          message,
          timestamp: new Date().toISOString(),
          details: detail,
        });
      }
      if (typeof errorResponse === 'string') {
        message = this.i18nService.translate(errorResponse);
        code = HttpStatus[status];
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        const {
          message: msg,
          error: err,
          statusCode,
          ...rest
        } = errorResponse as Record<string, unknown>;
        message = (msg as string) ?? HTTP_EXCEPTION_CODE;
        detail = Object.keys(rest).length > 0 ? rest : undefined;
        code = (typeof err === 'string' ? err : HttpStatus[status]) ?? HTTP_EXCEPTION_CODE;
        status = typeof statusCode === 'number' ? statusCode : status;
      }
      const validationErrorResponse = exception.getResponse() as ValidationErrorResponse;
      const validationMessage = validationErrorResponse.message;
      if (Array.isArray(validationMessage)) {
        status = HttpStatus.BAD_REQUEST;
        message = this.i18nService.translate('common.validation.error');
        detail =
          validationMessage.length > 0
            ? await formatValidationErrors(validationMessage, this.i18nService)
            : [];
      }
    } else if (isRpcError(exception)) {
      code = exception.code;
      status = httpErrorCodeToHttpStatus(exception.code);
      message = this.i18nService.translate(exception.message, {
        args: exception.args || {},
      });
      detail = exception.details;
    } else if (exception instanceof Error) {
      this.loggerService.error('[Internal Server Error]', `Details:: ${exception.stack}`);
      code = HTTP_ERROR_NAME.INTERNAL_SERVER_ERROR;
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = this.i18nService.translate('common.errors.internalServerError');
    }
    response.status(status).json({
      code,
      message,
      timestamp: new Date().toISOString(),
      details: detail,
    });
  }
}

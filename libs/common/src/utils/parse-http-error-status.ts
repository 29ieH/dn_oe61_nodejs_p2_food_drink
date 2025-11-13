import { HttpStatus } from '@nestjs/common';
import { HTTP_ERROR_CODE } from '../enums/errors/http-error-code';

export const httpErrorCodeToHttpStatus = (code: HTTP_ERROR_CODE): HttpStatus => {
  switch (code) {
    case HTTP_ERROR_CODE.BAD_REQUEST:
      return HttpStatus.BAD_REQUEST;
    case HTTP_ERROR_CODE.UNAUTHORIZED:
      return HttpStatus.UNAUTHORIZED;
    case HTTP_ERROR_CODE.FORBIDDEN:
      return HttpStatus.FORBIDDEN;
    case HTTP_ERROR_CODE.NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case HTTP_ERROR_CODE.CONFLICT:
      return HttpStatus.CONFLICT;
    case HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR:
      return HttpStatus.INTERNAL_SERVER_ERROR;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
};

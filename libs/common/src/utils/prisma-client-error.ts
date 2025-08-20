import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { logAndThrowPrismaClientError } from '../helpers/prisma-client';
import { CustomLogger } from '../logger/custom-logger.service';

export function mapPrismaErrorToHttp(error: PrismaClientKnownRequestError): TypedRpcException {
  switch (error.code) {
    case 'P2002':
      return new TypedRpcException({
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.uniqueConstraint',
      });
    case 'P2003':
      return new TypedRpcException({
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.foreignKeyConstraint',
      });
    case 'P2025':
      return new TypedRpcException({
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.errors.recordNotFound',
      });
    case 'P2000':
    case 'P2011':
    case 'P2014':
    case 'P2016':
    case 'P2019':
    case 'P2033':
      return new TypedRpcException({
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.invalidInput',
      });
    case 'P2021':
    case 'P2022':
      return new TypedRpcException({
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.dbSchema',
      });
    default:
      return new TypedRpcException({
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      });
  }
}

export function handlePrismaError(
  error: unknown,
  resource: string,
  methodName: string,
  loggerService: CustomLogger,
): never {
  loggerService.error(`[Error ${resource}.${methodName}]`, `Details:: ${(error as Error).stack}`);
  if (error instanceof PrismaClientKnownRequestError) {
    return logAndThrowPrismaClientError(error, loggerService, resource, methodName);
  }
  throw new TypedRpcException({
    code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
    message: 'common.errors.internalServerError',
  });
}

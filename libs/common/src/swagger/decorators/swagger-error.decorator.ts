import { HTTP_ERROR_NAME } from '@app/common/enums/errors/http-error-name';
import { ApiResponse } from '@nestjs/swagger';

function createApiErrorResponse(
  status: number,
  code: string,
  message: string,
  description: string,
  extra: Record<string, unknown> | Record<string, unknown>[] = {},
) {
  return ApiResponse({
    status,
    description: description,
    schema: {
      example: {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...extra,
      },
    },
  });
}
export function ApiErrorBadRequestValidation(
  description: string,
  details?: Record<string, unknown>[],
) {
  return createApiErrorResponse(
    400,
    HTTP_ERROR_NAME.BAD_REQUEST,
    HTTP_ERROR_NAME.VALIDATION_ERROR,
    description,
    {
      details: details,
    },
  );
}

export function ApiErrorBadRequest(
  description: string,
  message: string,
  details?: Record<string, unknown>[] | object,
) {
  return createApiErrorResponse(400, HTTP_ERROR_NAME.BAD_REQUEST, message, description, {
    details: details,
  });
}

export function ApiErrorNotFound(description: string, message: string) {
  return createApiErrorResponse(404, HTTP_ERROR_NAME.NOT_FOUND, message, description);
}

export function ApiErrorConflict(description: string, message = 'Conflict Error') {
  return createApiErrorResponse(409, HTTP_ERROR_NAME.CONFLICT, message, description);
}

export function ApiErrorInternal() {
  return createApiErrorResponse(
    500,
    HTTP_ERROR_NAME.INTERNAL_SERVER_ERROR,
    'An unexpected error occurred',
    HTTP_ERROR_NAME.INTERNAL_SERVER_ERROR,
  );
}
export function ApiErrorUnauthorized(description: string, message = 'Unauthorized') {
  return createApiErrorResponse(401, HTTP_ERROR_NAME.UNAUTHORIZED, message, description);
}

export function ApiErrorForbidden(description: string, message = 'Forbidden') {
  return createApiErrorResponse(403, HTTP_ERROR_NAME.FORBIDDEN, message, description);
}

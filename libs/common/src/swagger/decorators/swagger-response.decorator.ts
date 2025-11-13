import { BaseResponseApi } from '@app/common/constant/base-response-api';
import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export function SwaggerGetResponse<T extends Type<unknown>>(
  model: T,
  description = '',
  message = '',
  example?: Record<string, unknown>,
) {
  return applyDecorators(
    ApiExtraModels(BaseResponseApi, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: { $ref: getSchemaPath(model) },
            },
            ...(example && { example }),
          },
        ],
      },
    }),
  );
}
export function SwaggerCreatedResponse<T extends Type<unknown>>(
  model: T,
  description = '',
  message = '',
  example?: Record<string, unknown>,
) {
  return applyDecorators(
    ApiExtraModels(BaseResponseApi, model),
    ApiCreatedResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: { $ref: getSchemaPath(model) },
            },
            ...(example && { example }),
          },
        ],
      },
    }),
  );
}
export function SwaggerNoContentResponse(description = '') {
  return applyDecorators(
    ApiNoContentResponse({
      description,
    }),
  );
}
export function SwaggerGetPaginatedResponse<T extends Type<unknown>>(
  model: T,
  description = '',
  message = '',
  example?: Record<string, unknown>,
) {
  return applyDecorators(
    ApiExtraModels(BaseResponseApi, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                  meta: {
                    type: 'object',
                    properties: {
                      totalItems: { type: 'number', example: 1 },
                      itemCount: { type: 'number', example: 1 },
                      currentPage: { type: 'number', example: 1 },
                      itemsPerPage: { type: 'number', example: 10 },
                      totalPages: { type: 'number', example: 1 },
                    },
                  },
                },
              },
            },
            ...(example && { example }),
          },
        ],
      },
    }),
  );
}
export function SwaggerUpdatedResponse<T extends Type<unknown>>(
  model: T,
  description = '',
  message = '',
  example?: Record<string, unknown>,
) {
  return applyDecorators(
    ApiExtraModels(BaseResponseApi, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: { $ref: getSchemaPath(model) },
            },
            ...(example && { example }),
          },
        ],
      },
    }),
  );
}
export function SwaggerUpdatedArrayResponse<T extends Type<unknown>>(
  model: T,
  description = '',
  message = '',
  example?: Record<string, unknown>,
) {
  return applyDecorators(
    ApiExtraModels(BaseResponseApi, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
            ...(example && { example }),
          },
        ],
      },
    }),
  );
}
export function SwaggerBaseResponsePrimitive(
  type: 'number' | 'string' | 'boolean',
  description = '',
  message = '',
  example?: number | string | boolean,
) {
  return applyDecorators(
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: {
                type,
                ...(example !== undefined && { example }),
              },
            },
          },
        ],
      },
    }),
  );
}
export function SwaggerBaseResponseNull(description = '', message = '') {
  return applyDecorators(
    ApiCreatedResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(BaseResponseApi) },
          {
            properties: {
              message: { type: 'string', example: message },
              payload: { type: 'null', example: null },
            },
          },
        ],
      },
    }),
  );
}

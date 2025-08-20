import { HTTP_ERROR_CODE } from '../enums/errors/http-error-code';

export interface RpcError {
  code: HTTP_ERROR_CODE;
  message: string;
  details?:
    | string
    | Record<string, unknown>
    | Record<string, unknown>[]
    | Record<string, unknown[]>
    | unknown[];
  args?: Record<string, unknown>;
}

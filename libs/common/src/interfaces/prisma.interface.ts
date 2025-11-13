import { PrismaClientOptions } from '../types/prisma.type';

export interface PrismaModuleOptions<T> {
  isGlobal?: boolean;
  client: new (opts?: PrismaClientOptions) => T;
}

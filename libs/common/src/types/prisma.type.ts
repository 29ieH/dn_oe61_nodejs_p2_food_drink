import { PrismaClient } from '@prisma/client';

export type PrismaClientWithLifecycle = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};

export type PrismaClientOptions = Parameters<typeof PrismaClient>[0];

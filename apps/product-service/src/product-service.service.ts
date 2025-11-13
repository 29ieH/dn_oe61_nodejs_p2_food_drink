import { PrismaService } from '@app/prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

@Injectable()
export class ProductServiceService {
  constructor(private readonly prisma: PrismaService<PrismaClient>) {}
  async findAllProducts() {
    return this.prisma.client.product.findMany();
  }
}

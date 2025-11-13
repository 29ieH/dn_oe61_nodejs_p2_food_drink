import { Controller, Get } from '@nestjs/common';
import { ProductServiceService } from './product-service.service';

@Controller()
export class ProductServiceController {
  constructor(private readonly productServiceService: ProductServiceService) {}

  @Get()
  findAllProducts() {
    return this.productServiceService.findAllProducts();
  }
}

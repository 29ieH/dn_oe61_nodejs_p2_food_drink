import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseApi<T> {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the request was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 200,
    description: 'HTTP status code of the response',
  })
  statusCode: number;

  @ApiProperty({
    example: 'Request completed successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    required: false,
    description: 'Response payload containing actual data',
  })
  payload?: T;
}

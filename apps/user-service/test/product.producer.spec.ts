import { DeleteSoftCartRequest } from '@app/common/dto/product/requests/delete-soft-cart.request';
import { ProductEvent } from '@app/common/enums/queue/product-event.enum';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
import { addJobWithRetry } from '@app/common/helpers/queue.helper';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bull';
import { ProductProducer } from '../src/producer/product.producer';

jest.mock('@app/common/helpers/queue.helper', () => ({
  addJobWithRetry: jest.fn(),
}));

describe('ProductProducer', () => {
  let producer: ProductProducer;
  let queueMock: jest.Mocked<Queue>;
  let loggerMock: jest.Mocked<CustomLogger>;
  let loggerSpy: jest.SpyInstance;
  beforeEach(async () => {
    queueMock = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Queue>;
    loggerMock = {
      error: jest.fn(),
    } as unknown as jest.Mocked<CustomLogger>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProductProducer,
        { provide: getQueueToken(QueueName.PRODUCT), useValue: queueMock },
        { provide: CustomLogger, useValue: loggerMock },
      ],
    }).compile();
    loggerSpy = jest.spyOn(loggerMock, 'error');
    producer = moduleRef.get<ProductProducer>(ProductProducer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should add job soft delete cart successfully', async () => {
    (addJobWithRetry as jest.Mock).mockResolvedValue(undefined);
    const payload: DeleteSoftCartRequest = { userId: 1 } as DeleteSoftCartRequest;
    await producer.addJobSoftDeleteCart(payload);
    expect(addJobWithRetry).toHaveBeenCalledWith(queueMock, ProductEvent.SOFT_DELETE_CART, payload);
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('should log error and rethrow when addJobWithRetry fails', async () => {
    const payload: DeleteSoftCartRequest = { userId: 2 } as DeleteSoftCartRequest;
    const error = new Error('queue fail');
    (addJobWithRetry as jest.Mock).mockRejectedValueOnce(error);
    await expect(producer.addJobSoftDeleteCart(payload)).rejects.toBe(error);
    expect(loggerSpy).toHaveBeenCalledWith(
      '[Add job soft delete cart failed]',
      expect.stringContaining('queue fail'),
    );
  });
});

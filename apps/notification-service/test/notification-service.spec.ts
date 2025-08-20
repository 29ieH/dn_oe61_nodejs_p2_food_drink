import { PayLoadJWTComplete } from '@app/common/dto/user/sign-token.dto';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../src/notification-service.service';
import { MailQueueService } from '../src/mail/mail-queue.service';
import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

describe('NotificationService', () => {
  let service: NotificationService;
  let mailQueueService: MailQueueService;
  let configService: ConfigService;

  const mockMailQueueService = {
    enqueueMailJob: jest.fn(),
  };

  const mockLogger = {
    error: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: MailQueueService,
          useValue: mockMailQueueService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    mailQueueService = module.get<MailQueueService>(MailQueueService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmailComplete', () => {
    const mockPayload: PayLoadJWTComplete = {
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        userName: 'testuser',
        status: 'ACTIVE',
        role: 'USER',
        deletedAt: null,
      },
      token: 'some-jwt-token',
    };

    it('should throw TypedRpcException if data is not provided', async () => {
      await expect(
        service.sendEmailComplete(null as unknown as PayLoadJWTComplete),
      ).rejects.toThrow(TypedRpcException);
    });

    it('should call sendEmail and return a success message', async () => {
      const frontendUrl = 'http://localhost:3000';
      (configService.get as jest.Mock).mockReturnValue(frontendUrl);
      (mailQueueService.enqueueMailJob as jest.Mock).mockResolvedValue(undefined);

      const result = await service.sendEmailComplete(mockPayload);

      expect(mockConfigService.get).toHaveBeenCalledWith('app.frontendUrl');
      expect(mockMailQueueService.enqueueMailJob).toHaveBeenCalled();
      expect(result).toBe('common.auth.action.sendEmailComplete.complete');
    });

    it('should throw RpcException if mailQueueService fails', async () => {
      const frontendUrl = 'http://localhost:3000';
      (configService.get as jest.Mock).mockReturnValue(frontendUrl);
      (mailQueueService.enqueueMailJob as jest.Mock).mockRejectedValue(new Error('Queue Error'));

      await expect(service.sendEmailComplete(mockPayload)).rejects.toThrow(RpcException);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

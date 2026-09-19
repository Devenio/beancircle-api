import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';

describe('AuthService.requestOtp', () => {
  let service: AuthService;
  let redis: { setOtp: jest.Mock };
  let sms: { sendVerifyCode: jest.Mock };
  let configGet: jest.Mock;

  beforeEach(async () => {
    redis = { setOtp: jest.fn().mockResolvedValue(undefined) };
    sms = { sendVerifyCode: jest.fn().mockResolvedValue(undefined) };
    configGet = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: SmsService, useValue: sms },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns the stored OTP code when SMS_PROVIDER is mock', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'SMS_PROVIDER' ? 'mock' : undefined,
    );

    const result = await service.requestOtp('+989121234567');

    expect(redis.setOtp).toHaveBeenCalledWith('+989121234567', '123456');
    expect(sms.sendVerifyCode).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'OTP sent (mock)', code: '123456' });
  });

  it('does not return code when SMS_PROVIDER is not mock', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'SMS_PROVIDER') return 'smsir';
      if (key === 'SMSIR_OTP_TEMPLATE_ID') return '42';
      return undefined;
    });

    const result = await service.requestOtp('+989121234567');

    expect(redis.setOtp).toHaveBeenCalledTimes(1);
    const storedCode = redis.setOtp.mock.calls[0][1] as string;
    expect(storedCode).toMatch(/^\d{6}$/);
    expect(sms.sendVerifyCode).toHaveBeenCalledWith('+989121234567', 42, [
      { name: 'Code', value: storedCode },
    ]);
    expect(result).toEqual({ message: 'OTP sent' });
    expect(result).not.toHaveProperty('code');
  });
});

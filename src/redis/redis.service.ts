import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async setOtp(phone: string, code: string, ttlSeconds = 300) {
    await this.client.setex(`otp:${phone}`, ttlSeconds, code);
  }

  async getOtp(phone: string) {
    return this.client.get(`otp:${phone}`);
  }

  async delOtp(phone: string) {
    await this.client.del(`otp:${phone}`);
  }

  async setOnline(userId: string) {
    await this.client.setex(`online:${userId}`, 60, '1');
  }

  async isOnline(userId: string) {
    return !!(await this.client.get(`online:${userId}`));
  }

  async setOffline(userId: string) {
    await this.client.del(`online:${userId}`);
  }

  async setAuthCode(code: string, payload: object, ttlSeconds = 60) {
    await this.client.setex(`authcode:${code}`, ttlSeconds, JSON.stringify(payload));
  }

  async getAuthCode<T>(code: string): Promise<T | null> {
    const raw = await this.client.get(`authcode:${code}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async delAuthCode(code: string) {
    await this.client.del(`authcode:${code}`);
  }
}

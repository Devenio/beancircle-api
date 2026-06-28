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

  async setOtp(phone: string, code: string, ttlSeconds = 120) {
    await this.client.setex(`otp:${phone}`, ttlSeconds, code);
  }

  async getOtp(phone: string) {
    return this.client.get(`otp:${phone}`);
  }

  async delOtp(phone: string) {
    await this.client.del(`otp:${phone}`);
  }

  async incrOtpAttempts(phone: string): Promise<number> {
    const key = `otp_attempts:${phone}`;
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, 120);
    return n;
  }

  async delOtpAttempts(phone: string) {
    await this.client.del(`otp_attempts:${phone}`);
  }

  async incrSocketConnection(userId: string): Promise<number> {
    const key = `ws:conn:${userId}`;
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, 300);
    return n;
  }

  async decrSocketConnection(userId: string) {
    const key = `ws:conn:${userId}`;
    const n = await this.client.decr(key);
    if (n <= 0) await this.client.del(key);
  }

  async setOnline(userId: string) {
    await this.client.setex(`online:${userId}`, 90, '1');
  }

  async refreshOnline(userId: string) {
    await this.client.expire(`online:${userId}`, 90);
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

  async tryLocationPing(userId: string, ttlSeconds: number): Promise<boolean> {
    const key = `loc:ping:${userId}`;
    const set = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return set === 'OK';
  }

  async geoAddLocation(userId: string, lng: number, lat: number) {
    await this.client.geoadd('active:locations', lng, lat, userId);
  }

  async geoRadius(lng: number, lat: number, radiusKm: number, count = 200) {
    const raw = await this.client.georadius(
      'active:locations',
      lng,
      lat,
      radiusKm,
      'km',
      'WITHDIST',
      'COUNT',
      count,
      'ASC',
    );
    return raw as [string, string][];
  }

  async incrFriendRequestDaily(userId: string): Promise<number> {
    const key = `friend:req:daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, 86400);
    return n;
  }

  async friendResendCooldown(senderId: string, receiverId: string): Promise<boolean> {
    const key = `friend:resend:${senderId}:${receiverId}`;
    const set = await this.client.set(key, '1', 'EX', 604800, 'NX');
    return set === 'OK';
  }

  async getDiscoverCache<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(`discover:cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setDiscoverCache(key: string, value: unknown, ttlSeconds = 120) {
    await this.client.setex(`discover:cache:${key}`, ttlSeconds, JSON.stringify(value));
  }
}

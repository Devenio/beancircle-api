import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleDestroy {
    readonly client: Redis;
    constructor(config: ConfigService);
    onModuleDestroy(): Promise<void>;
    setOtp(phone: string, code: string, ttlSeconds?: number): Promise<void>;
    getOtp(phone: string): Promise<string | null>;
    delOtp(phone: string): Promise<void>;
    setOnline(userId: string): Promise<void>;
    isOnline(userId: string): Promise<boolean>;
    setOffline(userId: string): Promise<void>;
}

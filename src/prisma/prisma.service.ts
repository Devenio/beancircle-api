import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Configure the pool via DATABASE_URL params:
//   ?connection_limit=10&pool_timeout=20
// See https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-management
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit() {
    (this.$on as (event: 'warn' | 'error', cb: (e: { message: string }) => void) => void)(
      'warn',
      (e) => this.logger.warn(e.message),
    );
    (this.$on as (event: 'warn' | 'error', cb: (e: { message: string }) => void) => void)(
      'error',
      (e) => this.logger.error(e.message),
    );
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

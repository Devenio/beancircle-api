import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private async assertDailyLimit(reporterId: string) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `reports:${reporterId}:${day}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, 86_400);
    }
    if (count > 10) {
      throw new HttpException(
        'Daily report limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertTargetExists(
    targetType: ReportTargetType,
    targetId: string,
  ) {
    switch (targetType) {
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({ where: { id: targetId } });
        if (!user) throw new NotFoundException('Target not found');
        break;
      }
      case ReportTargetType.POST: {
        const post = await this.prisma.post.findUnique({ where: { id: targetId } });
        if (!post) throw new NotFoundException('Target not found');
        break;
      }
      case ReportTargetType.REVIEW: {
        const review = await this.prisma.review.findUnique({ where: { id: targetId } });
        if (!review) throw new NotFoundException('Target not found');
        break;
      }
      case ReportTargetType.CAFE: {
        const cafe = await this.prisma.cafe.findUnique({ where: { id: targetId } });
        if (!cafe) throw new NotFoundException('Target not found');
        break;
      }
      case ReportTargetType.MESSAGE: {
        const message = await this.prisma.message.findUnique({ where: { id: targetId } });
        if (!message) throw new NotFoundException('Target not found');
        break;
      }
      default:
        throw new BadRequestException('Invalid target type');
    }
  }

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.targetType === ReportTargetType.USER && dto.targetId === reporterId) {
      throw new BadRequestException('Cannot report yourself');
    }
    await this.assertDailyLimit(reporterId);
    await this.assertTargetExists(dto.targetType, dto.targetId);
    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason.trim(),
      },
      select: { id: true, status: true, createdAt: true },
    });
  }
}

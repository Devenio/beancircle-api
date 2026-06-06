import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { LocationVisibility } from '@prisma/client';
import { encodeGeohash } from '../common/geo/geo.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const LOCATION_TTL_SECONDS = 30;

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async updateLocation(userId: string, lat: number, lng: number) {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('Invalid coordinates');
    }
    const allowed = await this.redis.tryLocationPing(userId, LOCATION_TTL_SECONDS);
    if (!allowed) {
      throw new HttpException('Location updates are rate limited', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cityId: true, settings: { select: { locationVisibility: true } } },
    });
    const visibility = user.settings?.locationVisibility ?? LocationVisibility.APPROXIMATE;
    if (visibility === LocationVisibility.HIDDEN) {
      return { ok: true, distanceVisibility: visibility };
    }

    const geohash = encodeGeohash(lat, lng, 7);
    await this.prisma.userLocation.upsert({
      where: { userId },
      create: { userId, latitude: lat, longitude: lng, geohash, cityId: user.cityId },
      update: { latitude: lat, longitude: lng, geohash, cityId: user.cityId },
    });
    await this.redis.geoAddLocation(userId, lng, lat);
    return { ok: true, distanceVisibility: visibility };
  }

  async getMyLocation(userId: string) {
    const [user, location] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          cityId: true,
          city: { select: { name: true } },
          settings: { select: { locationVisibility: true } },
        },
      }),
      this.prisma.userLocation.findUnique({ where: { userId } }),
    ]);
    return {
      visibility: user.settings?.locationVisibility ?? LocationVisibility.APPROXIMATE,
      hasLocation: !!location,
      cityName: user.city?.name ?? null,
    };
  }

  async requireViewerLocation(userId: string) {
    const location = await this.prisma.userLocation.findUnique({ where: { userId } });
    if (!location) {
      throw new ForbiddenException('Location required for discovery');
    }
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { locationVisibility: true, discoveryVisibility: true },
    });
    if (settings?.locationVisibility === LocationVisibility.HIDDEN) {
      throw new ForbiddenException('Enable location sharing to discover nearby people');
    }
    return { location, settings };
  }
}

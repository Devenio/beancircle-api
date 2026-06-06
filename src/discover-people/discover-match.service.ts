import { Injectable } from '@nestjs/common';
import { DiscoveryVisibility, InterestSlug, LocationVisibility } from '@prisma/client';
import {
  computeAge,
  formatDistance,
  fuzzCoordinates,
  geohashPrefixesForRadius,
  haversineMeters,
} from '../common/geo/geo.util';
import { RedisService } from '../redis/redis.service';

export type DiscoverCandidate = {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  dateOfBirth: Date | null;
  lastSeenAt: Date | null;
  latitude: number;
  longitude: number;
  interests: InterestSlug[];
  locationVisibility: LocationVisibility;
  discoveryVisibility: DiscoveryVisibility;
  distanceM: number;
  mutualFriendsCount: number;
  sharedGroupsCount: number;
  relationship: 'none' | 'pending_out' | 'pending_in' | 'friends';
  lastActive: 'online' | 'today' | 'week' | 'offline';
};

@Injectable()
export class DiscoverMatchService {
  constructor(private redis: RedisService) {}

  score(candidate: DiscoverCandidate, radiusKm: number): number {
    const distanceScore = Math.max(0, 1 - candidate.distanceM / (radiusKm * 1000));
    const maxInterests = Math.max(candidate.interests.length, 1);
    const interestScore = candidate.interests.length > 0 ? maxInterests / 8 : 0;
    const mutualScore = Math.min(candidate.mutualFriendsCount / 5, 1);
    const activityScore =
      candidate.lastActive === 'online'
        ? 1
        : candidate.lastActive === 'today'
          ? 0.7
          : candidate.lastActive === 'week'
            ? 0.4
            : 0.1;
    return 0.4 * distanceScore + 0.3 * interestScore + 0.2 * mutualScore + 0.1 * activityScore;
  }

  resolveLastActive(lastSeenAt: Date | null, isOnline: boolean): DiscoverCandidate['lastActive'] {
    if (isOnline) return 'online';
    if (!lastSeenAt) return 'offline';
    const diff = Date.now() - lastSeenAt.getTime();
    if (diff < 86400000) return 'today';
    if (diff < 7 * 86400000) return 'week';
    return 'offline';
  }

  toPublicPerson(c: DiscoverCandidate) {
    const age = computeAge(c.dateOfBirth);
    return {
      id: c.id,
      name: c.name,
      username: c.username,
      avatarUrl: c.avatarUrl,
      ...(age !== undefined ? { age } : {}),
      distanceLabel:
        c.locationVisibility === LocationVisibility.CITY
          ? 'Same city'
          : c.locationVisibility === LocationVisibility.HIDDEN
            ? ''
            : formatDistance(c.distanceM, c.locationVisibility),
      mutualFriendsCount: c.mutualFriendsCount,
      sharedInterests: c.interests.slice(0, 5),
      sharedGroupsCount: c.sharedGroupsCount,
      lastActive: c.lastActive,
      relationship: c.relationship,
    };
  }

  toMapPin(c: DiscoverCandidate) {
    const fuzzed = fuzzCoordinates(c.latitude, c.longitude, c.locationVisibility);
    return {
      lat: fuzzed.lat,
      lng: fuzzed.lng,
      ...this.toPublicPerson(c),
    };
  }
}

export { geohashPrefixesForRadius, haversineMeters, fuzzCoordinates };

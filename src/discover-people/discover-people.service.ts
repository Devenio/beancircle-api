import { Injectable } from '@nestjs/common';
import {
  DiscoveryVisibility,
  FriendRequestStatus,
  InterestSlug,
  LocationVisibility,
} from '@prisma/client';
import { geohashPrefixesForRadius, haversineMeters } from '../common/geo/geo.util';
import { ConnectionBadgesService } from '../gamification/connection-badges.service';
import { FriendsService } from '../friends/friends.service';
import { LocationService } from '../location/location.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DiscoverMatchService } from './discover-match.service';

export type NearbyQuery = {
  radiusKm?: number;
  interests?: InterestSlug[];
  activity?: 'online' | 'today' | 'week';
  relationship?: 'friends_only' | 'not_friends' | 'suggested';
  cursor?: string;
  limit?: number;
};

export type DiscoverPersonPublic = ReturnType<DiscoverMatchService['toPublicPerson']>;

const STALE_LOCATION_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DiscoverPeopleService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
    private matchService: DiscoverMatchService,
    private friendsService: FriendsService,
    private redis: RedisService,
    private connectionBadges: ConnectionBadgesService,
  ) {}

  async nearby(viewerId: string, query: NearbyQuery) {
    const radiusKm = query.radiusKm ?? 5;
    const limit = Math.min(query.limit ?? 20, 50);
    const { location } = await this.locationService.requireViewerLocation(viewerId);

    const cacheKey = `${viewerId}:${radiusKm}:${query.interests?.join(',') ?? ''}:${query.activity ?? ''}:${query.relationship ?? ''}:${query.cursor ?? ''}`;
    const cached = await this.redis.getDiscoverCache<{
      items: DiscoverPersonPublic[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) return cached;

    const blockedIds = await this.getBlockedIds(viewerId);
    const friendIds = await this.getFriendIds(viewerId);
    const prefixes = geohashPrefixesForRadius(location.latitude, location.longitude, radiusKm);

    const locations = await this.prisma.userLocation.findMany({
      where: {
        userId: { not: viewerId, notIn: [...blockedIds] },
        OR: prefixes.map((p) => ({ geohash: { startsWith: p } })),
        updatedAt: { gte: new Date(Date.now() - STALE_LOCATION_MS) },
      },
      include: {
        user: {
          include: {
            interests: true,
            settings: true,
            friendshipsAsA: true,
            friendshipsAsB: true,
            squadMemberships: { select: { squadId: true } },
          },
        },
      },
      take: 300,
    });

    const viewerSquads = await this.prisma.squadMember.findMany({
      where: { userId: viewerId },
      select: { squadId: true },
    });
    const viewerSquadSet = new Set(viewerSquads.map((s) => s.squadId));

    const pendingRequests = await this.prisma.friendRequest.findMany({
      where: {
        status: FriendRequestStatus.PENDING,
        OR: [{ senderId: viewerId }, { receiverId: viewerId }],
      },
    });

    const candidates = [];
    for (const loc of locations) {
      if (!this.isDiscoverable(viewerId, loc.user, friendIds)) continue;
      const dist = haversineMeters(
        location.latitude,
        location.longitude,
        loc.latitude,
        loc.longitude,
      );
      if (dist > radiusKm * 1000) continue;

      const u = loc.user;
      const uFriendIds = new Set([
        ...u.friendshipsAsA.map((f) => f.userBId),
        ...u.friendshipsAsB.map((f) => f.userAId),
      ]);
      let mutualFriendsCount = 0;
      for (const fid of friendIds) if (uFriendIds.has(fid)) mutualFriendsCount++;

      const sharedGroupsCount = u.squadMemberships.filter((s) =>
        viewerSquadSet.has(s.squadId),
      ).length;

      let relationship: 'none' | 'pending_out' | 'pending_in' | 'friends' = 'none';
      if (friendIds.has(u.id)) relationship = 'friends';
      else {
        const pr = pendingRequests.find(
          (r) =>
            (r.senderId === viewerId && r.receiverId === u.id) ||
            (r.senderId === u.id && r.receiverId === viewerId),
        );
        if (pr) relationship = pr.senderId === viewerId ? 'pending_out' : 'pending_in';
      }

      if (query.relationship === 'friends_only' && relationship !== 'friends') continue;
      if (query.relationship === 'not_friends' && relationship !== 'none') continue;

      const interests = u.interests.map((i) => i.interest);
      if (query.interests?.length && !query.interests.some((i) => interests.includes(i))) {
        continue;
      }

      const isOnline = await this.redis.isOnline(u.id);
      const lastActive = this.matchService.resolveLastActive(u.lastSeenAt, isOnline);
      if (query.activity === 'online' && lastActive !== 'online') continue;
      if (query.activity === 'today' && lastActive !== 'online' && lastActive !== 'today') {
        continue;
      }
      if (
        query.activity === 'week' &&
        lastActive !== 'online' &&
        lastActive !== 'today' &&
        lastActive !== 'week'
      ) {
        continue;
      }

      candidates.push({
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl,
        dateOfBirth: u.dateOfBirth,
        lastSeenAt: u.lastSeenAt,
        latitude: loc.latitude,
        longitude: loc.longitude,
        interests,
        locationVisibility: u.settings?.locationVisibility ?? LocationVisibility.APPROXIMATE,
        discoveryVisibility: u.settings?.discoveryVisibility ?? DiscoveryVisibility.EVERYONE,
        distanceM: dist,
        mutualFriendsCount,
        sharedGroupsCount,
        relationship,
        lastActive,
      });
    }

    candidates.sort(
      (a, b) => this.matchService.score(b, radiusKm) - this.matchService.score(a, radiusKm),
    );

    let start = 0;
    if (query.cursor) {
      const idx = candidates.findIndex((c) => c.id === query.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = candidates.slice(start, start + limit);
    const hasMore = start + limit < candidates.length;
    const items = page.map((c) => this.matchService.toPublicPerson(c, radiusKm));

    for (const item of page) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await this.prisma.dailyDiscovery.upsert({
        where: {
          userId_discoveredId_day: {
            userId: viewerId,
            discoveredId: item.id,
            day: today,
          },
        },
        create: { userId: viewerId, discoveredId: item.id, day: today },
        update: {},
      });
    }
    await this.connectionBadges.onDailyDiscovery(viewerId);
    await this.connectionBadges.touchConnectionStreak(viewerId);

    const result: {
      items: DiscoverPersonPublic[];
      nextCursor: string | null;
      hasMore: boolean;
    } = {
      items,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
    await this.redis.setDiscoverCache(cacheKey, result, 60);
    return result;
  }

  async suggestions(viewerId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 50);
    const blockedIds = await this.getBlockedIds(viewerId);
    const rows = await this.prisma.suggestedConnection.findMany({
      where: {
        userId: viewerId,
        dismissedAt: null,
        expiresAt: { gt: new Date() },
        suggestedId: { notIn: blockedIds },
      },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { score: 'desc' },
      include: {
        suggested: {
          include: { interests: true, settings: true },
        },
      },
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const items = await Promise.all(
      page.map(async (row) => {
        const relationship = await this.friendsService.getRelationship(viewerId, row.suggestedId);
        const isOnline = await this.redis.isOnline(row.suggestedId);
        return {
          id: row.suggested.id,
          name: row.suggested.name,
          username: row.suggested.username,
          avatarUrl: row.suggested.avatarUrl,
          sharedInterests: row.suggested.interests.map((i) => i.interest).slice(0, 5),
          reason: row.reason,
          score: row.score,
          lastActive: this.matchService.resolveLastActive(
            row.suggested.lastSeenAt,
            isOnline,
          ),
          relationship,
        };
      }),
    );
    return { items, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null, hasMore };
  }

  async map(viewerId: string, centerLat: number, centerLng: number, radiusKm: number) {
    const result = await this.nearby(viewerId, {
      radiusKm,
      limit: 100,
      relationship: 'not_friends',
    });
    const locations = await this.prisma.userLocation.findMany({
      where: { userId: { in: result.items.map((i) => i.id) } },
    });
    const locByUser = new Map(locations.map((l) => [l.userId, l]));
    const pins = result.items.map((item) => {
      const loc = locByUser.get(item.id);
      if (!loc) return null;
      const fuzzed = this.matchService.toMapPin({
        id: item.id,
        name: item.name,
        username: item.username,
        avatarUrl: item.avatarUrl,
        dateOfBirth: null,
        lastSeenAt: null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        interests: item.sharedInterests as InterestSlug[],
        locationVisibility: LocationVisibility.APPROXIMATE,
        discoveryVisibility: DiscoveryVisibility.EVERYONE,
        distanceM: 0,
        mutualFriendsCount: item.mutualFriendsCount,
        sharedGroupsCount: item.sharedGroupsCount,
        relationship: item.relationship as 'none',
        lastActive: item.lastActive as 'offline',
      });
      return { ...fuzzed, distanceLabel: item.distanceLabel };
    });
    return { pins: pins.filter(Boolean), center: { lat: centerLat, lng: centerLng } };
  }

  private async getBlockedIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
  }

  private async getFriendIds(viewerId: string): Promise<Set<string>> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    });
    return new Set(
      friendships.map((f) => (f.userAId === viewerId ? f.userBId : f.userAId)),
    );
  }

  private isDiscoverable(
    viewerId: string,
    user: {
      id: string;
      settings: { discoveryVisibility: DiscoveryVisibility } | null;
      friendshipsAsA: { userBId: string }[];
      friendshipsAsB: { userAId: string }[];
    },
    friendIds: Set<string>,
  ): boolean {
    const vis = user.settings?.discoveryVisibility ?? DiscoveryVisibility.EVERYONE;
    if (vis === DiscoveryVisibility.HIDDEN) return false;
    if (vis === DiscoveryVisibility.FRIENDS_OF_FRIENDS) {
      const theirFriends = new Set([
        ...user.friendshipsAsA.map((f) => f.userBId),
        ...user.friendshipsAsB.map((f) => f.userAId),
      ]);
      for (const fid of friendIds) {
        if (theirFriends.has(fid)) return true;
      }
      return friendIds.has(user.id);
    }
    return true;
  }
}

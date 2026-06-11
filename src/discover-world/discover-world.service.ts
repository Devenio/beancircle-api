import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  geohashPrefixesForRadius,
  haversineMeters,
} from '../common/geo/geo.util';
import {
  DiscoverPeopleService,
  DiscoverPersonPublic,
} from '../discover-people/discover-people.service';
import { LocationService } from '../location/location.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CafeHeat, CafeHeatService } from './cafe-heat.service';

export type WorldVibe =
  | 'remote_work_hub'
  | 'quiet_study'
  | 'best_coffee'
  | 'date_night'
  | 'outdoor'
  | 'pet_friendly'
  | null;

export type WorldPerson = DiscoverPersonPublic & {
  context: { cafeId: string; cafeName: string } | null;
};

export type WorldCafe = {
  id: string;
  name: string;
  logoUrl: string | null;
  photoUrl: string | null;
  address: string;
  distanceM: number;
  distanceLabel: string;
  avgRating: number;
  followerCount: number;
  vibe: WorldVibe;
  isOpen: boolean | null;
  heat: CafeHeat;
  presentCount: number;
  friendsPresent: number;
  communityCount: number;
  isPartner: boolean;
  /** Reserved for future paid placement; always false/null in Phase 1. */
  promoted: boolean;
  featuredRank: number | null;
};

export type WorldEvent = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  coverUrl: string | null;
  locationLabel: string | null;
  capacity: number | null;
  rsvpCount: number;
  distanceM: number | null;
  cafe: { id: string; name: string } | null;
};

export type WorldCommunity = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  category: string;
  coverUrl: string | null;
  memberCount: number;
  activeNow: number;
  nearbyMembers: number;
  upcomingEvents: number;
  isMember: boolean;
  cafe: { id: string; name: string } | null;
};

export type WorldPayload = {
  counts: {
    people: number;
    cafes: number;
    events: number;
    communities: number;
  };
  radiusKm: number;
  people: WorldPerson[];
  cafes: WorldCafe[];
  events: WorldEvent[];
  communities: WorldCommunity[];
  generatedAt: string;
};

const WORLD_CACHE_TTL_SECONDS = 45;
const PEOPLE_CONTEXT_WINDOW_MS = 2 * 60 * 60 * 1000;
const EVENT_CITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CAFES = 40;
const MAX_EVENTS = 20;
const MAX_COMMUNITIES = 20;

type OpeningHoursDay = { open?: string; close?: string; closed?: boolean };

@Injectable()
export class DiscoverWorldService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
    private discoverPeople: DiscoverPeopleService,
    private cafeHeat: CafeHeatService,
    private redis: RedisService,
  ) {}

  async getWorld(viewerId: string, radiusKm = 5): Promise<WorldPayload> {
    const { location } =
      await this.locationService.requireViewerLocation(viewerId);

    const cacheKey = `world:${viewerId}:${radiusKm}`;
    const cached = await this.redis.getDiscoverCache<WorldPayload>(cacheKey);
    if (cached) return cached;

    const [nearby, friendIds] = await Promise.all([
      this.discoverPeople.nearby(viewerId, { radiusKm, limit: 40 }),
      this.getFriendIds(viewerId),
    ]);

    const cafes = await this.findNearbyCafes(
      location.latitude,
      location.longitude,
      radiusKm,
    );
    const cafeIds = cafes.map((c) => c.id);

    const [presence, people, events, communities] = await Promise.all([
      this.cafeHeat.getPresence(cafeIds, friendIds),
      this.enrichPeopleContext(nearby.items),
      this.findEvents(cafeIds, location.cityId),
      this.findCommunities(viewerId, cafeIds, location.cityId, nearby.items),
    ]);
    const heat = await this.cafeHeat.getHeat(cafes, presence);

    const worldCafes: WorldCafe[] = cafes.map((cafe) => {
      const p = presence.get(cafe.id) ?? { presentCount: 0, friendsPresent: 0 };
      return {
        id: cafe.id,
        name: cafe.name,
        logoUrl: cafe.logoUrl,
        photoUrl: cafe.photos[0]?.url ?? null,
        address: cafe.address,
        distanceM: Math.round(cafe.distanceM),
        distanceLabel: formatWorldDistance(cafe.distanceM),
        avgRating: cafe.avgRating,
        followerCount: cafe.followerCount,
        vibe: deriveVibe(cafe),
        isOpen: isOpenNow(cafe.openingHours),
        heat: heat.get(cafe.id) ?? null,
        presentCount: p.presentCount,
        friendsPresent: p.friendsPresent,
        communityCount: cafe._count.squads,
        isPartner: cafe.isPartner,
        promoted: false,
        featuredRank: null,
      };
    });

    const payload: WorldPayload = {
      counts: {
        people: people.length,
        cafes: worldCafes.length,
        events: events.length,
        communities: communities.length,
      },
      radiusKm,
      people,
      cafes: worldCafes,
      events: events.map(({ cafeLat, cafeLng, ...e }) => ({
        ...e,
        distanceM:
          cafeLat != null && cafeLng != null
            ? Math.round(
                haversineMeters(
                  location.latitude,
                  location.longitude,
                  cafeLat,
                  cafeLng,
                ),
              )
            : null,
      })),
      communities,
      generatedAt: new Date().toISOString(),
    };

    await this.redis.setDiscoverCache(
      cacheKey,
      payload,
      WORLD_CACHE_TTL_SECONDS,
    );
    return payload;
  }

  private async findNearbyCafes(lat: number, lng: number, radiusKm: number) {
    const prefixes = geohashPrefixesForRadius(lat, lng, radiusKm);
    const rows = await this.prisma.cafe.findMany({
      where: { OR: prefixes.map((p) => ({ geohash: { startsWith: p } })) },
      include: {
        photos: { take: 1, orderBy: { order: 'asc' } },
        _count: { select: { squads: true } },
      },
      take: 150,
    });
    return rows
      .map((cafe) => ({
        ...cafe,
        distanceM: haversineMeters(lat, lng, cafe.lat, cafe.lng),
      }))
      .filter((cafe) => cafe.distanceM <= radiusKm * 1000)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, MAX_CAFES);
  }

  private async enrichPeopleContext(
    items: DiscoverPersonPublic[],
  ): Promise<WorldPerson[]> {
    if (items.length === 0) return [];
    const checkins = await this.prisma.checkin.findMany({
      where: {
        userId: { in: items.map((i) => i.id) },
        createdAt: { gte: new Date(Date.now() - PEOPLE_CONTEXT_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, cafe: { select: { id: true, name: true } } },
    });
    const contextByUser = new Map<
      string,
      { cafeId: string; cafeName: string }
    >();
    for (const c of checkins) {
      if (!contextByUser.has(c.userId)) {
        contextByUser.set(c.userId, {
          cafeId: c.cafe.id,
          cafeName: c.cafe.name,
        });
      }
    }
    return items.map((item) => ({
      ...item,
      context: contextByUser.get(item.id) ?? null,
    }));
  }

  private async findEvents(cafeIds: string[], cityId: string | null) {
    const now = new Date();
    const or: Prisma.CommunityEventWhereInput[] = [];
    if (cafeIds.length > 0) or.push({ cafeId: { in: cafeIds } });
    if (cityId) {
      or.push({
        cityId,
        startsAt: { lte: new Date(now.getTime() + EVENT_CITY_WINDOW_MS) },
      });
    }
    if (or.length === 0) return [];

    const rows = await this.prisma.communityEvent.findMany({
      where: { endsAt: { gte: now }, OR: or },
      include: {
        cafe: { select: { id: true, name: true, lat: true, lng: true } },
        _count: { select: { rsvps: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: MAX_EVENTS,
    });
    return rows.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      coverUrl: e.coverUrl,
      locationLabel: e.locationLabel,
      capacity: e.capacity,
      rsvpCount: e._count.rsvps,
      cafe: e.cafe ? { id: e.cafe.id, name: e.cafe.name } : null,
      cafeLat: e.cafe?.lat ?? null,
      cafeLng: e.cafe?.lng ?? null,
    }));
  }

  private async findCommunities(
    viewerId: string,
    cafeIds: string[],
    cityId: string | null,
    nearbyPeople: DiscoverPersonPublic[],
  ): Promise<WorldCommunity[]> {
    const or: Prisma.SquadWhereInput[] = [];
    if (cafeIds.length > 0) or.push({ cafeId: { in: cafeIds } });
    if (cityId) or.push({ cityId });
    if (or.length === 0) return [];

    const squads = await this.prisma.squad.findMany({
      where: { isPublic: true, OR: or },
      include: { cafe: { select: { id: true, name: true } } },
      orderBy: { memberCount: 'desc' },
      take: MAX_COMMUNITIES,
    });
    if (squads.length === 0) return [];
    const squadIds = squads.map((s) => s.id);

    const [members, myMemberships, upcomingByCafe] = await Promise.all([
      this.prisma.squadMember.findMany({
        where: { squadId: { in: squadIds } },
        select: { squadId: true, userId: true },
        orderBy: { points: 'desc' },
        take: 600,
      }),
      this.prisma.squadMember.findMany({
        where: { squadId: { in: squadIds }, userId: viewerId },
        select: { squadId: true },
      }),
      this.prisma.communityEvent.groupBy({
        by: ['cafeId'],
        where: {
          cafeId: {
            in: squads.map((s) => s.cafeId).filter((id): id is string => !!id),
          },
          startsAt: { gte: new Date() },
        },
        _count: { _all: true },
      }),
    ]);

    const onlineFlags = await Promise.all(
      members.map((m) => this.redis.isOnline(m.userId)),
    );
    const nearbyIds = new Set(nearbyPeople.map((p) => p.id));
    const activeBySquad = new Map<string, number>();
    const nearbyBySquad = new Map<string, number>();
    members.forEach((m, i) => {
      if (onlineFlags[i]) {
        activeBySquad.set(m.squadId, (activeBySquad.get(m.squadId) ?? 0) + 1);
      }
      if (nearbyIds.has(m.userId)) {
        nearbyBySquad.set(m.squadId, (nearbyBySquad.get(m.squadId) ?? 0) + 1);
      }
    });
    const mySquadIds = new Set(myMemberships.map((m) => m.squadId));
    const eventsByCafe = new Map(
      upcomingByCafe.map((g) => [g.cafeId, g._count._all]),
    );

    return squads.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      emoji: s.emoji,
      category: s.category,
      coverUrl: s.coverUrl,
      memberCount: s.memberCount,
      activeNow: activeBySquad.get(s.id) ?? 0,
      nearbyMembers: nearbyBySquad.get(s.id) ?? 0,
      upcomingEvents: s.cafeId ? (eventsByCafe.get(s.cafeId) ?? 0) : 0,
      isMember: mySquadIds.has(s.id),
      cafe: s.cafe ? { id: s.cafe.id, name: s.cafe.name } : null,
    }));
  }

  private async getFriendIds(viewerId: string): Promise<Set<string>> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    });
    return new Set(
      friendships.map((f) => (f.userAId === viewerId ? f.userBId : f.userAId)),
    );
  }
}

function deriveVibe(cafe: {
  bestWorkspace: boolean;
  fastWifi: boolean;
  quiet: boolean;
  studyFriendly: boolean;
  bestCoffee: boolean;
  dateFriendly: boolean;
  outdoorSeating: boolean;
  petFriendly: boolean;
}): WorldVibe {
  if (cafe.bestWorkspace || cafe.fastWifi) return 'remote_work_hub';
  if (cafe.quiet || cafe.studyFriendly) return 'quiet_study';
  if (cafe.bestCoffee) return 'best_coffee';
  if (cafe.dateFriendly) return 'date_night';
  if (cafe.outdoorSeating) return 'outdoor';
  if (cafe.petFriendly) return 'pet_friendly';
  return null;
}

function formatWorldDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Tolerant opening-hours parser; returns null when the shape is unknown. */
function isOpenNow(openingHours: unknown): boolean | null {
  if (!openingHours || typeof openingHours !== 'object') return null;
  const hours = openingHours as Record<string, OpeningHoursDay | undefined>;
  const now = new Date();
  const dayIndex = now.getDay();
  const day =
    hours[DAY_KEYS[dayIndex]] ??
    hours[DAY_KEYS[dayIndex].slice(0, 3)] ??
    hours[String(dayIndex)];
  if (!day || typeof day !== 'object') return null;
  if (day.closed) return false;
  if (!day.open || !day.close) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = parseHm(day.open);
  const close = parseHm(day.close);
  if (open == null || close == null) return null;
  if (close < open) return minutes >= open || minutes < close; // crosses midnight
  return minutes >= open && minutes < close;
}

function parseHm(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

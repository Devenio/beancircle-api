import ngeohash from 'ngeohash';
import { LocationVisibility } from '@prisma/client';

const EARTH_RADIUS_M = 6371000;

export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  return ngeohash.encode(lat, lng, precision);
}

export function geohashPrefixesForRadius(lat: number, lng: number, radiusKm: number): string[] {
  const precision =
    radiusKm <= 1 ? 6 : radiusKm <= 5 ? 5 : radiusKm <= 25 ? 4 : 3;
  const center = encodeGeohash(lat, lng, precision);
  const neighbors = ngeohash.neighbors(center);
  return [center, ...Object.values(neighbors) as string[]];
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters: number, visibility: LocationVisibility): string {
  if (visibility === LocationVisibility.CITY) return '';
  if (visibility === LocationVisibility.HIDDEN) return '';
  let m = meters;
  if (visibility === LocationVisibility.APPROXIMATE) {
    m = Math.round(m / 500) * 500;
  }
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)}m away`;
  return `${(m / 1000).toFixed(1)}km away`;
}

export function fuzzCoordinates(
  lat: number,
  lng: number,
  visibility: LocationVisibility,
): { lat: number; lng: number } {
  if (visibility === LocationVisibility.HIDDEN) {
    return { lat: 0, lng: 0 };
  }
  if (visibility === LocationVisibility.CITY) {
    return { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
  }
  const jitterM =
    visibility === LocationVisibility.EXACT ? 0 : 200 + Math.random() * 600;
  const jitterDeg = jitterM / 111320;
  const angle = Math.random() * Math.PI * 2;
  return {
    lat: lat + Math.cos(angle) * jitterDeg,
    lng: lng + Math.sin(angle) * jitterDeg,
  };
}

export function friendshipPair(userId1: string, userId2: string): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

export function computeAge(dateOfBirth: Date | null | undefined): number | undefined {
  if (!dateOfBirth) return undefined;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--;
  return age >= 0 && age < 120 ? age : undefined;
}

/**
 * Backfills Cafe.geohash from lat/lng for radius-based world discovery.
 * Run: npx ts-node --files scripts/backfill-cafe-geohash.ts
 */
import { PrismaClient } from '@prisma/client';
import ngeohash from 'ngeohash';

const prisma = new PrismaClient();

async function main() {
  const cafes = await prisma.cafe.findMany({
    where: { geohash: null },
    select: { id: true, lat: true, lng: true },
  });
  let updated = 0;
  for (const cafe of cafes) {
    await prisma.cafe.update({
      where: { id: cafe.id },
      data: { geohash: ngeohash.encode(cafe.lat, cafe.lng, 7) },
    });
    updated++;
  }
  console.log(`Backfilled geohash for ${updated} cafes`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

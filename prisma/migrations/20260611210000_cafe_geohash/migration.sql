-- Add geohash to Cafe for radius-based world discovery
ALTER TABLE "Cafe" ADD COLUMN "geohash" VARCHAR(12);

CREATE INDEX "Cafe_geohash_idx" ON "Cafe"("geohash");

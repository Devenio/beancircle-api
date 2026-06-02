-- CreateEnum
CREATE TYPE "BadgeCode" AS ENUM ('FIRST_CHECKIN', 'FIVE_CAFES', 'TEN_CAFES', 'TWENTY_CAFES', 'WEEKLY_EXPLORER');
CREATE TYPE "RewardType" AS ENUM ('FREE_DRINK', 'DISCOUNT_10', 'DISCOUNT_20', 'PARTNER_PERK');
CREATE TYPE "CheckinSource" AS ENUM ('APP', 'QR');

-- AlterTable Cafe
ALTER TABLE "Cafe" ADD COLUMN "checkinCode" TEXT,
ADD COLUMN "bestCoffee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bestWorkspace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "quiet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "studyFriendly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fastWifi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "outdoorSeating" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dateFriendly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "petFriendly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "workspaceScore" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Cafe_checkinCode_key" ON "Cafe"("checkinCode");
CREATE INDEX "Cafe_createdAt_idx" ON "Cafe"("createdAt");
CREATE INDEX "Cafe_followerCount_idx" ON "Cafe"("followerCount");

-- AlterTable Checkin
ALTER TABLE "Checkin" ADD COLUMN "source" "CheckinSource" NOT NULL DEFAULT 'APP';
CREATE INDEX "Checkin_userId_cafeId_createdAt_idx" ON "Checkin"("userId", "cafeId", "createdAt");

-- CreateTable Passport
CREATE TABLE "Passport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalStamps" INTEGER NOT NULL DEFAULT 0,
    "totalCheckins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Passport_userId_key" ON "Passport"("userId");

-- CreateTable Stamp
CREATE TABLE "Stamp" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "checkinId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stamp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stamp_checkinId_key" ON "Stamp"("checkinId");
CREATE UNIQUE INDEX "Stamp_passportId_cafeId_key" ON "Stamp"("passportId", "cafeId");
CREATE INDEX "Stamp_passportId_earnedAt_idx" ON "Stamp"("passportId", "earnedAt");

-- CreateTable BadgeDefinition
CREATE TABLE "BadgeDefinition" (
    "code" "BadgeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "thresholdType" TEXT NOT NULL,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("code")
);

-- CreateTable UserBadge
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeCode" "BadgeCode" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBadge_userId_badgeCode_key" ON "UserBadge"("userId", "badgeCode");
CREATE INDEX "UserBadge_userId_earnedAt_idx" ON "UserBadge"("userId", "earnedAt");

-- CreateTable RewardDefinition
CREATE TABLE "RewardDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredStamps" INTEGER NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RewardDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardDefinition_slug_key" ON "RewardDefinition"("slug");

-- CreateTable UserReward
CREATE TABLE "UserReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "UserReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserReward_userId_rewardId_key" ON "UserReward"("userId", "rewardId");
CREATE INDEX "UserReward_userId_unlockedAt_idx" ON "UserReward"("userId", "unlockedAt");

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stamp" ADD CONSTRAINT "Stamp_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "Passport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stamp" ADD CONSTRAINT "Stamp_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stamp" ADD CONSTRAINT "Stamp_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "Checkin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeCode_fkey" FOREIGN KEY ("badgeCode") REFERENCES "BadgeDefinition"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserReward" ADD CONSTRAINT "UserReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserReward" ADD CONSTRAINT "UserReward_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed badge definitions
INSERT INTO "BadgeDefinition" ("code", "name", "description", "iconKey", "threshold", "thresholdType") VALUES
('FIRST_CHECKIN', 'First Sip', 'Completed your first cafe check-in', 'coffee', 1, 'checkins'),
('FIVE_CAFES', 'Explorer', 'Visited 5 different cafes', 'compass', 5, 'stamps'),
('TEN_CAFES', 'Regular', 'Collected 10 cafe stamps', 'star', 10, 'stamps'),
('TWENTY_CAFES', 'City Roamer', 'Collected 20 cafe stamps', 'map', 20, 'stamps'),
('WEEKLY_EXPLORER', 'Weekly Explorer', '3 check-ins in 7 days', 'calendar', 3, 'weekly_checkins');

-- Seed rewards
INSERT INTO "RewardDefinition" ("id", "slug", "title", "description", "requiredStamps", "rewardType", "active") VALUES
('reward-3-stamps', 'warm-up', 'Warm-up perk', '10% off your next visit at partner cafes', 3, 'DISCOUNT_10', true),
('reward-5-stamps', 'regular', 'Regular reward', 'Free drink upgrade at partner cafes', 5, 'FREE_DRINK', true),
('reward-10-stamps', 'insider', 'Insider reward', '20% off at partner cafes', 10, 'DISCOUNT_20', true),
('reward-20-stamps', 'legend', 'Legend status', 'Exclusive partner perk', 20, 'PARTNER_PERK', true);

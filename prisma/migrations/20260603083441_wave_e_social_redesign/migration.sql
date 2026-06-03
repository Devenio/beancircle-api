-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('FRIEND_CHECKIN', 'FRIEND_JOINED_EVENT', 'FRIEND_EARNED_BADGE', 'FRIEND_COMPLETED_CHALLENGE', 'FRIEND_JOINED_SQUAD', 'FRIEND_STREAK_MILESTONE', 'FRIEND_COLLECTED_CARD', 'CAFE_TRENDING', 'EVENT_ANNOUNCED', 'SQUAD_ACTIVITY');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('OPEN_MIC', 'GAME_NIGHT', 'STUDY_GROUP', 'STARTUP_MEETUP', 'MUSIC_NIGHT', 'COFFEE_WORKSHOP', 'BOOK_CLUB', 'OTHER');

-- CreateEnum
CREATE TYPE "SquadCategory" AS ENUM ('GAMERS', 'COFFEE_LOVERS', 'ARTISTS', 'STUDENTS', 'DEVELOPERS', 'BOOK_CLUB', 'OTHER');

-- CreateEnum
CREATE TYPE "SquadRole" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "CardRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "StreakType" AS ENUM ('DAILY_VISIT', 'WEEKLY_CAFE', 'CONSECUTIVE_CHECKIN', 'EVENT_PARTICIPATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_CHECKIN';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_JOINED_EVENT';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'SQUAD_INVITATION';
ALTER TYPE "NotificationType" ADD VALUE 'SQUAD_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE 'STREAK_MILESTONE';

-- AlterTable
ALTER TABLE "Checkin" ADD COLUMN     "mood" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "withUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "CommunityEvent" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "hostId" TEXT,
ADD COLUMN     "type" "EventType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "FriendActivity" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "cafeId" TEXT,
    "eventId" TEXT,
    "squadId" TEXT,
    "badgeCode" "BadgeCode",
    "checkinId" TEXT,
    "cityId" TEXT,
    "cheerCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FriendActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" "SquadCategory" NOT NULL DEFAULT 'OTHER',
    "cafeId" TEXT,
    "cityId" TEXT,
    "countryId" TEXT,
    "coverUrl" TEXT,
    "emoji" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SquadRole" NOT NULL DEFAULT 'MEMBER',
    "points" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMessage" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectibleCard" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artworkUrl" TEXT,
    "rarity" "CardRarity" NOT NULL DEFAULT 'COMMON',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectibleCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCollectible" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "checkinId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCollectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StreakType" NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "lastEventOn" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendActivity_actorId_createdAt_idx" ON "FriendActivity"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "FriendActivity_type_createdAt_idx" ON "FriendActivity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "FriendActivity_cityId_createdAt_idx" ON "FriendActivity"("cityId", "createdAt");

-- CreateIndex
CREATE INDEX "FriendActivity_createdAt_idx" ON "FriendActivity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_slug_key" ON "Squad"("slug");

-- CreateIndex
CREATE INDEX "Squad_cafeId_idx" ON "Squad"("cafeId");

-- CreateIndex
CREATE INDEX "Squad_cityId_memberCount_idx" ON "Squad"("cityId", "memberCount");

-- CreateIndex
CREATE INDEX "Squad_category_idx" ON "Squad"("category");

-- CreateIndex
CREATE INDEX "SquadMember_userId_idx" ON "SquadMember"("userId");

-- CreateIndex
CREATE INDEX "SquadMember_squadId_points_idx" ON "SquadMember"("squadId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_squadId_userId_key" ON "SquadMember"("squadId", "userId");

-- CreateIndex
CREATE INDEX "SquadMessage_squadId_createdAt_idx" ON "SquadMessage"("squadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectibleCard_cafeId_key" ON "CollectibleCard"("cafeId");

-- CreateIndex
CREATE INDEX "CollectibleCard_rarity_idx" ON "CollectibleCard"("rarity");

-- CreateIndex
CREATE INDEX "UserCollectible_userId_collectedAt_idx" ON "UserCollectible"("userId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollectible_userId_cardId_key" ON "UserCollectible"("userId", "cardId");

-- CreateIndex
CREATE INDEX "UserStreak_userId_idx" ON "UserStreak"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStreak_userId_type_key" ON "UserStreak"("userId", "type");

-- CreateIndex
CREATE INDEX "EventReminder_remindAt_sentAt_idx" ON "EventReminder"("remindAt", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventReminder_userId_eventId_key" ON "EventReminder"("userId", "eventId");

-- CreateIndex
CREATE INDEX "CommunityEvent_type_startsAt_idx" ON "CommunityEvent"("type", "startsAt");

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendActivity" ADD CONSTRAINT "FriendActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendActivity" ADD CONSTRAINT "FriendActivity_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendActivity" ADD CONSTRAINT "FriendActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendActivity" ADD CONSTRAINT "FriendActivity_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendActivity" ADD CONSTRAINT "FriendActivity_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMessage" ADD CONSTRAINT "SquadMessage_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMessage" ADD CONSTRAINT "SquadMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectibleCard" ADD CONSTRAINT "CollectibleCard_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectible" ADD CONSTRAINT "UserCollectible_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectible" ADD CONSTRAINT "UserCollectible_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CollectibleCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationVisibility" AS ENUM ('EXACT', 'APPROXIMATE', 'CITY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "DiscoveryVisibility" AS ENUM ('EVERYONE', 'FRIENDS_OF_FRIENDS', 'HIDDEN');

-- CreateEnum
CREATE TYPE "InterestSlug" AS ENUM ('COFFEE', 'BUSINESS', 'STARTUPS', 'AI', 'FITNESS', 'MUSIC', 'GAMING', 'TECH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BadgeCode" ADD VALUE 'FIRST_FRIEND';
ALTER TYPE "BadgeCode" ADD VALUE 'EXPLORER';
ALTER TYPE "BadgeCode" ADD VALUE 'SOCIAL_BUTTERFLY';
ALTER TYPE "BadgeCode" ADD VALUE 'NETWORK_BUILDER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "discoveryVisibility" "DiscoveryVisibility" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "locationVisibility" "LocationVisibility" NOT NULL DEFAULT 'APPROXIMATE',
ADD COLUMN     "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserLocation" (
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "geohash" VARCHAR(12) NOT NULL,
    "cityId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserInterest" (
    "userId" TEXT NOT NULL,
    "interest" "InterestSlug" NOT NULL,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("userId","interest")
);

-- CreateTable
CREATE TABLE "FriendRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suggestedId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestedConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionStreak" (
    "userId" TEXT NOT NULL,
    "currentDays" INTEGER NOT NULL DEFAULT 0,
    "longestDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),

    CONSTRAINT "ConnectionStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DailyDiscovery" (
    "userId" TEXT NOT NULL,
    "discoveredId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "DailyDiscovery_pkey" PRIMARY KEY ("userId","discoveredId","day")
);

-- CreateIndex
CREATE INDEX "UserLocation_geohash_idx" ON "UserLocation"("geohash");

-- CreateIndex
CREATE INDEX "UserLocation_cityId_updatedAt_idx" ON "UserLocation"("cityId", "updatedAt");

-- CreateIndex
CREATE INDEX "FriendRequest_receiverId_status_createdAt_idx" ON "FriendRequest"("receiverId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "Friendship_userAId_idx" ON "Friendship"("userAId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "SuggestedConnection_userId_score_idx" ON "SuggestedConnection"("userId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestedConnection_userId_suggestedId_key" ON "SuggestedConnection"("userId", "suggestedId");

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedConnection" ADD CONSTRAINT "SuggestedConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedConnection" ADD CONSTRAINT "SuggestedConnection_suggestedId_fkey" FOREIGN KEY ("suggestedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionStreak" ADD CONSTRAINT "ConnectionStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDiscovery" ADD CONSTRAINT "DailyDiscovery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDiscovery" ADD CONSTRAINT "DailyDiscovery_discoveredId_fkey" FOREIGN KEY ("discoveredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

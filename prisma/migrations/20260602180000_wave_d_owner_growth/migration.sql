-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('CHECKIN_COUNT', 'NEW_STAMPS', 'VISIT_UNIQUE_CAFES');
CREATE TYPE "EventRsvpStatus" AS ENUM ('GOING', 'INTERESTED');

-- AlterEnum
ALTER TYPE "BeanScoreAction" ADD VALUE 'REFERRAL';
ALTER TYPE "BeanScoreAction" ADD VALUE 'CHALLENGE_COMPLETE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT;

ALTER TABLE "Cafe" ADD COLUMN "claimCode" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CafeOwner" (
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeOwner_pkey" PRIMARY KEY ("userId","cafeId")
);

CREATE TABLE "CommunityChallenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "goal" INTEGER NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 100,
    "cityId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChallengeParticipation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cafeId" TEXT,
    "cityId" TEXT,
    "locationLabel" TEXT,
    "coverUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");
CREATE UNIQUE INDEX "Cafe_claimCode_key" ON "Cafe"("claimCode");
CREATE INDEX "CafeOwner_cafeId_idx" ON "CafeOwner"("cafeId");
CREATE INDEX "CommunityChallenge_active_endsAt_idx" ON "CommunityChallenge"("active", "endsAt");
CREATE INDEX "CommunityChallenge_cityId_startsAt_idx" ON "CommunityChallenge"("cityId", "startsAt");
CREATE UNIQUE INDEX "ChallengeParticipation_userId_challengeId_key" ON "ChallengeParticipation"("userId", "challengeId");
CREATE INDEX "ChallengeParticipation_challengeId_progress_idx" ON "ChallengeParticipation"("challengeId", "progress");
CREATE INDEX "CommunityEvent_startsAt_idx" ON "CommunityEvent"("startsAt");
CREATE INDEX "CommunityEvent_cityId_startsAt_idx" ON "CommunityEvent"("cityId", "startsAt");
CREATE UNIQUE INDEX "EventRsvp_userId_eventId_key" ON "EventRsvp"("userId", "eventId");
CREATE INDEX "EventRsvp_eventId_idx" ON "EventRsvp"("eventId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CafeOwner" ADD CONSTRAINT "CafeOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CafeOwner" ADD CONSTRAINT "CafeOwner_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityChallenge" ADD CONSTRAINT "CommunityChallenge_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeParticipation" ADD CONSTRAINT "ChallengeParticipation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CommunityChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

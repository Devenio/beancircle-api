-- CreateEnum
CREATE TYPE "BeanScoreAction" AS ENUM ('CHECKIN', 'NEW_STAMP', 'POST', 'POST_PHOTO', 'REVIEW', 'LIKE_RECEIVED', 'DAILY_ACTIVE');
CREATE TYPE "ReactionEmoji" AS ENUM ('LIKE', 'HEART', 'FIRE', 'CLAP');

-- AlterTable
ALTER TABLE "Cafe" ADD COLUMN "liveWifiScore" DOUBLE PRECISION,
ADD COLUMN "liveNoiseLevel" DOUBLE PRECISION,
ADD COLUMN "liveOutletScore" DOUBLE PRECISION,
ADD COLUMN "workReportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BeanScoreProfile" (
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastDailyBonusAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeanScoreProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "BeanScoreEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "BeanScoreAction" NOT NULL,
    "points" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeanScoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "emoji" "ReactionEmoji" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" "ReactionEmoji" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "wifiScore" INTEGER NOT NULL,
    "noiseLevel" INTEGER NOT NULL,
    "outletScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BeanScoreProfile_totalPoints_idx" ON "BeanScoreProfile"("totalPoints");
CREATE UNIQUE INDEX "BeanScoreEvent_userId_action_referenceId_key" ON "BeanScoreEvent"("userId", "action", "referenceId");
CREATE INDEX "BeanScoreEvent_userId_createdAt_idx" ON "BeanScoreEvent"("userId", "createdAt");
CREATE UNIQUE INDEX "PostReaction_userId_postId_key" ON "PostReaction"("userId", "postId");
CREATE INDEX "PostReaction_postId_idx" ON "PostReaction"("postId");
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
CREATE INDEX "WorkReport_cafeId_createdAt_idx" ON "WorkReport"("cafeId", "createdAt");
CREATE INDEX "WorkReport_userId_createdAt_idx" ON "WorkReport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BeanScoreProfile" ADD CONSTRAINT "BeanScoreProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BeanScoreEvent" ADD CONSTRAINT "BeanScoreEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

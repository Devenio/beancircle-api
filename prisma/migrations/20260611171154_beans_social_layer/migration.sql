-- CreateEnum
CREATE TYPE "BeanType" AS ENUM ('QUICK', 'PHOTO', 'VIDEO', 'LOCAL', 'CAFE', 'EVENT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "BeanMediaType" AS ENUM ('IMAGE', 'VIDEO', 'GIF');

-- CreateEnum
CREATE TYPE "BeanReactionType" AS ENUM ('LOVE', 'BREWED', 'HOT', 'NICE', 'INSIGHTFUL', 'FUNNY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BeanScoreAction" ADD VALUE 'BEAN';
ALTER TYPE "BeanScoreAction" ADD VALUE 'BEAN_MEDIA';
ALTER TYPE "BeanScoreAction" ADD VALUE 'BEAN_REPLY';
ALTER TYPE "BeanScoreAction" ADD VALUE 'BEAN_REACTION_RECEIVED';
ALTER TYPE "BeanScoreAction" ADD VALUE 'BEAN_REBEAN_RECEIVED';
ALTER TYPE "BeanScoreAction" ADD VALUE 'BEAN_POPULAR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BEAN_REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'BEAN_REACTION';
ALTER TYPE "NotificationType" ADD VALUE 'BEAN_MENTION';
ALTER TYPE "NotificationType" ADD VALUE 'BEAN_REBEAN';
ALTER TYPE "NotificationType" ADD VALUE 'BEAN_QUOTE';

-- CreateTable
CREATE TABLE "Bean" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "BeanType" NOT NULL DEFAULT 'QUICK',
    "body" TEXT,
    "cafeId" TEXT,
    "eventId" TEXT,
    "squadId" TEXT,
    "cityId" TEXT,
    "countryId" TEXT,
    "locationLabel" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "linkUrl" TEXT,
    "parentId" TEXT,
    "rootId" TEXT,
    "quotedBeanId" TEXT,
    "rebeanOfId" TEXT,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "rebeanCount" INTEGER NOT NULL DEFAULT 0,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bean_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeanMedia" (
    "id" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "type" "BeanMediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BeanMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeanPoll" (
    "id" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "BeanPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeanPollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BeanPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeanPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeanPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeanReaction" (
    "id" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "BeanReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeanReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "beanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeanHashtag" (
    "beanId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,

    CONSTRAINT "BeanHashtag_pkey" PRIMARY KEY ("beanId","hashtagId")
);

-- CreateTable
CREATE TABLE "BeanMention" (
    "id" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BeanMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bean_authorId_createdAt_idx" ON "Bean"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_cafeId_createdAt_idx" ON "Bean"("cafeId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_squadId_createdAt_idx" ON "Bean"("squadId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_eventId_createdAt_idx" ON "Bean"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_cityId_createdAt_idx" ON "Bean"("cityId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_parentId_createdAt_idx" ON "Bean"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_rootId_createdAt_idx" ON "Bean"("rootId", "createdAt");

-- CreateIndex
CREATE INDEX "Bean_createdAt_idx" ON "Bean"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bean_authorId_rebeanOfId_key" ON "Bean"("authorId", "rebeanOfId");

-- CreateIndex
CREATE INDEX "BeanMedia_beanId_idx" ON "BeanMedia"("beanId");

-- CreateIndex
CREATE UNIQUE INDEX "BeanPoll_beanId_key" ON "BeanPoll"("beanId");

-- CreateIndex
CREATE INDEX "BeanPollOption_pollId_idx" ON "BeanPollOption"("pollId");

-- CreateIndex
CREATE INDEX "BeanPollVote_optionId_idx" ON "BeanPollVote"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "BeanPollVote_pollId_userId_key" ON "BeanPollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "BeanReaction_beanId_idx" ON "BeanReaction"("beanId");

-- CreateIndex
CREATE INDEX "BeanReaction_createdAt_idx" ON "BeanReaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BeanReaction_beanId_userId_key" ON "BeanReaction"("beanId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_tag_key" ON "Hashtag"("tag");

-- CreateIndex
CREATE INDEX "Hashtag_beanCount_idx" ON "Hashtag"("beanCount");

-- CreateIndex
CREATE INDEX "BeanHashtag_hashtagId_idx" ON "BeanHashtag"("hashtagId");

-- CreateIndex
CREATE INDEX "BeanMention_userId_idx" ON "BeanMention"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BeanMention_beanId_userId_key" ON "BeanMention"("beanId", "userId");

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_quotedBeanId_fkey" FOREIGN KEY ("quotedBeanId") REFERENCES "Bean"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bean" ADD CONSTRAINT "Bean_rebeanOfId_fkey" FOREIGN KEY ("rebeanOfId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanMedia" ADD CONSTRAINT "BeanMedia_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanPoll" ADD CONSTRAINT "BeanPoll_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanPollOption" ADD CONSTRAINT "BeanPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "BeanPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanPollVote" ADD CONSTRAINT "BeanPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "BeanPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanPollVote" ADD CONSTRAINT "BeanPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "BeanPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanPollVote" ADD CONSTRAINT "BeanPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanReaction" ADD CONSTRAINT "BeanReaction_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanReaction" ADD CONSTRAINT "BeanReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanHashtag" ADD CONSTRAINT "BeanHashtag_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanHashtag" ADD CONSTRAINT "BeanHashtag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanMention" ADD CONSTRAINT "BeanMention_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanMention" ADD CONSTRAINT "BeanMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

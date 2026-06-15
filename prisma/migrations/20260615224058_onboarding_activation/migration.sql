-- AlterEnum
ALTER TYPE "BadgeCode" ADD VALUE 'FIRST_SIP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InterestSlug" ADD VALUE 'PROGRAMMING';
ALTER TYPE "InterestSlug" ADD VALUE 'DESIGN';
ALTER TYPE "InterestSlug" ADD VALUE 'BOOKS';
ALTER TYPE "InterestSlug" ADD VALUE 'CRYPTO';
ALTER TYPE "InterestSlug" ADD VALUE 'TRADING';
ALTER TYPE "InterestSlug" ADD VALUE 'PHOTOGRAPHY';
ALTER TYPE "InterestSlug" ADD VALUE 'TRAVEL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "favoriteCoffee" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "userId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL DEFAULT 'welcome',
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skippedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stepTimings" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BeanAvatar" (
    "userId" TEXT NOT NULL,
    "bg" TEXT NOT NULL DEFAULT 'crema',
    "skin" TEXT NOT NULL DEFAULT 'roast',
    "hair" TEXT NOT NULL DEFAULT 'none',
    "glasses" TEXT NOT NULL DEFAULT 'none',
    "beard" TEXT NOT NULL DEFAULT 'none',
    "outfit" TEXT NOT NULL DEFAULT 'apron',
    "accessory" TEXT NOT NULL DEFAULT 'none',
    "coffeeCup" TEXT NOT NULL DEFAULT 'latte',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeanAvatar_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OnboardingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timeSpentMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingEvent_userId_step_idx" ON "OnboardingEvent"("userId", "step");

-- CreateIndex
CREATE INDEX "OnboardingEvent_step_type_idx" ON "OnboardingEvent"("step", "type");

-- CreateIndex
CREATE INDEX "OnboardingEvent_createdAt_idx" ON "OnboardingEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeanAvatar" ADD CONSTRAINT "BeanAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingEvent" ADD CONSTRAINT "OnboardingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

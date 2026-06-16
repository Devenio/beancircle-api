-- CreateEnum
CREATE TYPE "CafeOwnershipClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CafeOwnershipClaimKind" AS ENUM ('CLAIM_EXISTING', 'NEW_CAFE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CAFE_OWNERSHIP_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CAFE_OWNERSHIP_REJECTED';

-- AlterTable
ALTER TABLE "Cafe" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: all existing curated cafes are treated as verified.
UPDATE "Cafe" SET "isVerified" = true;

-- CreateTable
CREATE TABLE "CafeOwnershipClaim" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CafeOwnershipClaimKind" NOT NULL DEFAULT 'CLAIM_EXISTING',
    "status" "CafeOwnershipClaimStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "phone" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeOwnershipClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CafeOwnershipClaim_status_idx" ON "CafeOwnershipClaim"("status");

-- CreateIndex
CREATE INDEX "CafeOwnershipClaim_cafeId_idx" ON "CafeOwnershipClaim"("cafeId");

-- CreateIndex
CREATE INDEX "CafeOwnershipClaim_userId_idx" ON "CafeOwnershipClaim"("userId");

-- AddForeignKey
ALTER TABLE "CafeOwnershipClaim" ADD CONSTRAINT "CafeOwnershipClaim_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOwnershipClaim" ADD CONSTRAINT "CafeOwnershipClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

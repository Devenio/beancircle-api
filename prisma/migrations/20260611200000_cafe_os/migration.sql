-- CreateEnum
CREATE TYPE "CafeRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'MODERATOR');

-- CreateEnum
CREATE TYPE "CafeStaffInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MenuTheme" AS ENUM ('MINIMAL', 'MODERN', 'LUXURY', 'DARK', 'VINTAGE', 'NEON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QrCodeKind" AS ENUM ('MENU', 'TABLE', 'ENTRANCE', 'EVENT');

-- CreateEnum
CREATE TYPE "LoyaltyProgramKind" AS ENUM ('STAMP_CARD', 'VISIT_COUNT', 'BIRTHDAY', 'VIP');

-- CreateEnum
CREATE TYPE "AnnouncementKind" AS ENUM ('ANNOUNCEMENT', 'PROMOTION', 'DISCOUNT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CAFE_ANNOUNCEMENT';
ALTER TYPE "NotificationType" ADD VALUE 'CAFE_STAFF_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'LOYALTY_REWARD';

-- DropForeignKey
ALTER TABLE "CafeOwner" DROP CONSTRAINT "CafeOwner_cafeId_fkey";

-- DropForeignKey
ALTER TABLE "CafeOwner" DROP CONSTRAINT "CafeOwner_userId_fkey";

-- AlterTable
ALTER TABLE "Cafe" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "openingHours" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "wifiName" TEXT,
ADD COLUMN     "wifiPassword" TEXT;

-- AlterTable
ALTER TABLE "CafeMenu" ADD COLUMN     "theme" "MenuTheme" NOT NULL DEFAULT 'MINIMAL',
ADD COLUMN     "themeConfig" JSONB;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "calories" INTEGER,
ADD COLUMN     "discountPrice" INTEGER,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prepTimeMin" INTEGER,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "CafeStaff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "role" "CafeRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeStaff_pkey" PRIMARY KEY ("id")
);

-- DataMigration: every existing cafe owner becomes OWNER staff
INSERT INTO "CafeStaff" ("id", "userId", "cafeId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", "cafeId", 'OWNER'::"CafeRole", "createdAt", CURRENT_TIMESTAMP
FROM "CafeOwner";

-- DropTable
DROP TABLE "CafeOwner";

-- DataMigration: backfill cafe slugs from published menu slugs
UPDATE "Cafe" c
SET "slug" = m."slug"
FROM "CafeMenu" m
WHERE m."cafeId" = c."id" AND c."slug" IS NULL;

-- CreateTable
CREATE TABLE "CafeStaffInvite" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "role" "CafeRole" NOT NULL DEFAULT 'STAFF',
    "status" "CafeStaffInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CafeStaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeTable" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "kind" "QrCodeKind" NOT NULL DEFAULT 'MENU',
    "tableId" TEXT,
    "eventId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrScan" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "qrCodeId" TEXT,
    "userId" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeCustomer" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "kind" "LoyaltyProgramKind" NOT NULL DEFAULT 'STAMP_CARD',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal" INTEGER NOT NULL DEFAULT 5,
    "rewardLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyCardProgress" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCardProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "kind" "AnnouncementKind" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeDailyStat" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "qrScans" INTEGER NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "returningCustomers" INTEGER NOT NULL DEFAULT 0,
    "newFollowers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CafeDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CafeStaff_cafeId_idx" ON "CafeStaff"("cafeId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeStaff_userId_cafeId_key" ON "CafeStaff"("userId", "cafeId");

-- CreateIndex
CREATE INDEX "CafeStaffInvite_inviteeId_status_idx" ON "CafeStaffInvite"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "CafeStaffInvite_cafeId_status_idx" ON "CafeStaffInvite"("cafeId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_cafeId_createdAt_idx" ON "AuditLog"("cafeId", "createdAt");

-- CreateIndex
CREATE INDEX "CafeTable_cafeId_order_idx" ON "CafeTable"("cafeId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_tableId_key" ON "QrCode"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_code_key" ON "QrCode"("code");

-- CreateIndex
CREATE INDEX "QrCode_cafeId_kind_idx" ON "QrCode"("cafeId", "kind");

-- CreateIndex
CREATE INDEX "QrScan_cafeId_scannedAt_idx" ON "QrScan"("cafeId", "scannedAt");

-- CreateIndex
CREATE INDEX "QrScan_qrCodeId_scannedAt_idx" ON "QrScan"("qrCodeId", "scannedAt");

-- CreateIndex
CREATE INDEX "CafeCustomer_cafeId_lastVisitAt_idx" ON "CafeCustomer"("cafeId", "lastVisitAt");

-- CreateIndex
CREATE INDEX "CafeCustomer_cafeId_visitCount_idx" ON "CafeCustomer"("cafeId", "visitCount");

-- CreateIndex
CREATE UNIQUE INDEX "CafeCustomer_cafeId_userId_key" ON "CafeCustomer"("cafeId", "userId");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_cafeId_isActive_idx" ON "LoyaltyProgram"("cafeId", "isActive");

-- CreateIndex
CREATE INDEX "LoyaltyCardProgress_userId_idx" ON "LoyaltyCardProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCardProgress_programId_userId_key" ON "LoyaltyCardProgress"("programId", "userId");

-- CreateIndex
CREATE INDEX "Announcement_cafeId_createdAt_idx" ON "Announcement"("cafeId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_scheduledAt_publishedAt_idx" ON "Announcement"("scheduledAt", "publishedAt");

-- CreateIndex
CREATE INDEX "CafeDailyStat_cafeId_date_idx" ON "CafeDailyStat"("cafeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CafeDailyStat_cafeId_date_key" ON "CafeDailyStat"("cafeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Cafe_slug_key" ON "Cafe"("slug");

-- AddForeignKey
ALTER TABLE "Cafe" ADD CONSTRAINT "Cafe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeStaff" ADD CONSTRAINT "CafeStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeStaff" ADD CONSTRAINT "CafeStaff_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeStaffInvite" ADD CONSTRAINT "CafeStaffInvite_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeStaffInvite" ADD CONSTRAINT "CafeStaffInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeStaffInvite" ADD CONSTRAINT "CafeStaffInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeTable" ADD CONSTRAINT "CafeTable_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrScan" ADD CONSTRAINT "QrScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeCustomer" ADD CONSTRAINT "CafeCustomer_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeCustomer" ADD CONSTRAINT "CafeCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCardProgress" ADD CONSTRAINT "LoyaltyCardProgress_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCardProgress" ADD CONSTRAINT "LoyaltyCardProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeDailyStat" ADD CONSTRAINT "CafeDailyStat_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

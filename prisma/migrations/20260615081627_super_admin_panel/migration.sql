-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "enabledGlobal" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CafeFeatureFlag" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "flagKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#2C1810',
    "theme" "MenuTheme" NOT NULL DEFAULT 'MINIMAL',
    "themeConfig" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTemplateCategory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuTemplateCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTemplateItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "discountPrice" INTEGER,
    "calories" INTEGER,
    "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prepTimeMin" INTEGER,
    "imageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CafeFeatureFlag_flagKey_idx" ON "CafeFeatureFlag"("flagKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeFeatureFlag_cafeId_flagKey_key" ON "CafeFeatureFlag"("cafeId", "flagKey");

-- CreateIndex
CREATE INDEX "MenuTemplateCategory_templateId_order_idx" ON "MenuTemplateCategory"("templateId", "order");

-- CreateIndex
CREATE INDEX "MenuTemplateItem_categoryId_order_idx" ON "MenuTemplateItem"("categoryId", "order");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "CafeFeatureFlag" ADD CONSTRAINT "CafeFeatureFlag_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeFeatureFlag" ADD CONSTRAINT "CafeFeatureFlag_flagKey_fkey" FOREIGN KEY ("flagKey") REFERENCES "FeatureFlag"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTemplateCategory" ADD CONSTRAINT "MenuTemplateCategory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MenuTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTemplateItem" ADD CONSTRAINT "MenuTemplateItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuTemplateCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

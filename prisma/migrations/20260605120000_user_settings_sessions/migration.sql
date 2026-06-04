-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('EVERYONE', 'CONTACTS', 'NOBODY');

-- CreateEnum
CREATE TYPE "AutoDownloadMode" AS ENUM ('WIFI', 'ALWAYS', 'NEVER');

-- CreateEnum
CREATE TYPE "MediaQualityLevel" AS ENUM ('STANDARD', 'HIGH');

-- CreateEnum
CREATE TYPE "FontSizeLevel" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "MessageDensityLevel" AS ENUM ('COMPACT', 'COMFORTABLE', 'SPACIOUS');

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "lastSeenVisibility" "VisibilityLevel" NOT NULL DEFAULT 'EVERYONE',
    "onlineStatusVisibility" "VisibilityLevel" NOT NULL DEFAULT 'EVERYONE',
    "readReceipts" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibility" "VisibilityLevel" NOT NULL DEFAULT 'EVERYONE',
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "messageNotifications" BOOLEAN NOT NULL DEFAULT true,
    "mentionNotifications" BOOLEAN NOT NULL DEFAULT true,
    "groupNotifications" BOOLEAN NOT NULL DEFAULT true,
    "marketingNotifications" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationSound" BOOLEAN NOT NULL DEFAULT true,
    "notificationVibration" BOOLEAN NOT NULL DEFAULT true,
    "accentColor" TEXT NOT NULL DEFAULT 'oklch(0.55 0.2 145)',
    "fontSize" "FontSizeLevel" NOT NULL DEFAULT 'MEDIUM',
    "messageDensity" "MessageDensityLevel" NOT NULL DEFAULT 'COMFORTABLE',
    "chatWallpaper" TEXT NOT NULL DEFAULT 'default',
    "autoDownloadMedia" "AutoDownloadMode" NOT NULL DEFAULT 'WIFI',
    "mediaQuality" "MediaQualityLevel" NOT NULL DEFAULT 'HIGH',
    "saveDrafts" BOOLEAN NOT NULL DEFAULT true,
    "linkPreviews" BOOLEAN NOT NULL DEFAULT true,
    "typingIndicators" BOOLEAN NOT NULL DEFAULT true,
    "autoCleanupDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "browser" TEXT,
ADD COLUMN     "os" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

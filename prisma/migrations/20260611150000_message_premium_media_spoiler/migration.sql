-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mediaHeight" INTEGER,
ADD COLUMN     "mediaWidth" INTEGER,
ADD COLUMN     "spoiler" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "viewOnce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewOnceOpenedBy" TEXT[] DEFAULT ARRAY[]::TEXT[];

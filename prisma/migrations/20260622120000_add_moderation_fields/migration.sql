-- AlterTable
ALTER TABLE "Report" ADD COLUMN "adminNote" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "warningCount" INTEGER NOT NULL DEFAULT 0;

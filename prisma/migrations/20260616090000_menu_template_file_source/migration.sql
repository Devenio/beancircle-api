-- AlterTable
ALTER TABLE "MenuTemplate" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'custom',
ADD COLUMN     "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MenuTemplate_sourceKey_key" ON "MenuTemplate"("sourceKey");

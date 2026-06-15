-- AlterTable
ALTER TABLE "CafeMenu" ADD COLUMN     "activeTemplateId" TEXT;

-- AlterTable
ALTER TABLE "MenuTemplate" ADD COLUMN     "previewImageUrl" TEXT,
ADD COLUMN     "welcomeMessage" TEXT,
ADD COLUMN     "welcomeTitle" TEXT;

-- CreateTable
CREATE TABLE "MenuTemplateAssignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuTemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuTemplateAssignment_cafeId_idx" ON "MenuTemplateAssignment"("cafeId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuTemplateAssignment_templateId_cafeId_key" ON "MenuTemplateAssignment"("templateId", "cafeId");

-- AddForeignKey
ALTER TABLE "CafeMenu" ADD CONSTRAINT "CafeMenu_activeTemplateId_fkey" FOREIGN KEY ("activeTemplateId") REFERENCES "MenuTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTemplateAssignment" ADD CONSTRAINT "MenuTemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MenuTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuTemplateAssignment" ADD CONSTRAINT "MenuTemplateAssignment_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CafeSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CafeSuggestion" (
    "id" TEXT NOT NULL,
    "suggestedBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "CafeSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CafeSuggestion_status_idx" ON "CafeSuggestion"("status");

-- CreateIndex
CREATE INDEX "CafeSuggestion_suggestedBy_idx" ON "CafeSuggestion"("suggestedBy");

-- AddForeignKey
ALTER TABLE "CafeSuggestion" ADD CONSTRAINT "CafeSuggestion_suggestedBy_fkey" FOREIGN KEY ("suggestedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

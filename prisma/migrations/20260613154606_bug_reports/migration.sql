-- CreateEnum
CREATE TYPE "BugCategory" AS ENUM ('BUG', 'PERFORMANCE', 'UI_UX', 'CHAT', 'NOTIFICATIONS', 'PAYMENTS', 'ACCOUNT', 'FEATURE_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'FIXED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BugAttachmentKind" AS ENUM ('SCREENSHOT', 'ANNOTATION', 'REPLAY', 'LOG', 'VIDEO', 'OTHER');

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BugCategory" NOT NULL DEFAULT 'BUG',
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "route" TEXT,
    "deviceInfo" JSONB,
    "appInfo" JSONB,
    "metadata" JSONB,
    "logs" JSONB,
    "screenshotUrl" TEXT,
    "replayUrl" TEXT,
    "aiSummary" TEXT,
    "aiProbableCause" TEXT,
    "aiSeverity" "BugSeverity",
    "aiReproSteps" JSONB,
    "triagedAt" TIMESTAMP(3),
    "fingerprint" TEXT,
    "duplicateOfId" TEXT,
    "assigneeId" TEXT,
    "fixVersion" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportComment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReportComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "BugAttachmentKind" NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BugReport_ticketNumber_key" ON "BugReport"("ticketNumber");

-- CreateIndex
CREATE INDEX "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_category_createdAt_idx" ON "BugReport"("category", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_severity_createdAt_idx" ON "BugReport"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_assigneeId_status_idx" ON "BugReport"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "BugReport_fingerprint_idx" ON "BugReport"("fingerprint");

-- CreateIndex
CREATE INDEX "BugReport_userId_createdAt_idx" ON "BugReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BugReportComment_reportId_createdAt_idx" ON "BugReportComment"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "BugReportAttachment_reportId_idx" ON "BugReportAttachment"("reportId");

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "BugReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportComment" ADD CONSTRAINT "BugReportComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportComment" ADD CONSTRAINT "BugReportComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportAttachment" ADD CONSTRAINT "BugReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

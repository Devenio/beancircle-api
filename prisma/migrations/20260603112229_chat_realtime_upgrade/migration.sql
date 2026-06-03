-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "lastReadMessageId" TEXT,
ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "forwardedFromId" TEXT,
ADD COLUMN     "forwardedFromName" TEXT;

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

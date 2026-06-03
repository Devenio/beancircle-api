/*
  Warnings:

  - Changed the type of `emoji` on the `MessageReaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "MessageReaction" DROP COLUMN "emoji",
ADD COLUMN     "emoji" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

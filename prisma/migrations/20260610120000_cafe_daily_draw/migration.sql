-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CAFE_DAILY_WIN';

-- CreateTable
CREATE TABLE "CafeDailyDraw" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 0,
    "maxWinners" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeDailyDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeDailyDrawWinner" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkinId" TEXT NOT NULL,
    "voucherCode" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeDailyDrawWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CafeDailyDraw_cafeId_day_key" ON "CafeDailyDraw"("cafeId", "day");

-- CreateIndex
CREATE INDEX "CafeDailyDraw_day_idx" ON "CafeDailyDraw"("day");

-- CreateIndex
CREATE UNIQUE INDEX "CafeDailyDrawWinner_checkinId_key" ON "CafeDailyDrawWinner"("checkinId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeDailyDrawWinner_voucherCode_key" ON "CafeDailyDrawWinner"("voucherCode");

-- CreateIndex
CREATE UNIQUE INDEX "CafeDailyDrawWinner_drawId_userId_key" ON "CafeDailyDrawWinner"("drawId", "userId");

-- CreateIndex
CREATE INDEX "CafeDailyDrawWinner_userId_idx" ON "CafeDailyDrawWinner"("userId");

-- CreateIndex
CREATE INDEX "CafeDailyDrawWinner_voucherCode_idx" ON "CafeDailyDrawWinner"("voucherCode");

-- AddForeignKey
ALTER TABLE "CafeDailyDraw" ADD CONSTRAINT "CafeDailyDraw_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeDailyDrawWinner" ADD CONSTRAINT "CafeDailyDrawWinner_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "CafeDailyDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeDailyDrawWinner" ADD CONSTRAINT "CafeDailyDrawWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeDailyDrawWinner" ADD CONSTRAINT "CafeDailyDrawWinner_checkinId_fkey" FOREIGN KEY ("checkinId") REFERENCES "Checkin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

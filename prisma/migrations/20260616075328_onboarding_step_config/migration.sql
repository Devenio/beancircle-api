-- CreateTable
CREATE TABLE "OnboardingStepConfig" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingStepConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "OnboardingStepConfig_order_idx" ON "OnboardingStepConfig"("order");

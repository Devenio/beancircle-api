-- Coded-design system: per-cafe selection + admin access whitelist.

-- Cafe owner's chosen coded designs (reference registry keys in code; no FK).
ALTER TABLE "CafeMenu" ADD COLUMN "selectedMenuDesignKey" TEXT;
ALTER TABLE "CafeMenu" ADD COLUMN "selectedWelcomeDesignKey" TEXT;

-- Admin whitelist: which cafes may use which coded design.
CREATE TABLE "DesignCafeAccess" (
    "id" TEXT NOT NULL,
    "designKey" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignCafeAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignCafeAccess_designKey_cafeId_key" ON "DesignCafeAccess"("designKey", "cafeId");
CREATE INDEX "DesignCafeAccess_cafeId_idx" ON "DesignCafeAccess"("cafeId");
CREATE INDEX "DesignCafeAccess_designKey_idx" ON "DesignCafeAccess"("designKey");

ALTER TABLE "DesignCafeAccess" ADD CONSTRAINT "DesignCafeAccess_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

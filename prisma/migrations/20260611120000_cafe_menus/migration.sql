-- CreateTable
CREATE TABLE "CafeMenu" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "welcomeTitle" TEXT,
    "welcomeMessage" TEXT,
    "welcomeImageUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#2C1810',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CafeMenu_cafeId_key" ON "CafeMenu"("cafeId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeMenu_slug_key" ON "CafeMenu"("slug");

-- CreateIndex
CREATE INDEX "CafeMenu_slug_idx" ON "CafeMenu"("slug");

-- CreateIndex
CREATE INDEX "MenuCategory_menuId_order_idx" ON "MenuCategory"("menuId", "order");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_order_idx" ON "MenuItem"("categoryId", "order");

-- AddForeignKey
ALTER TABLE "CafeMenu" ADD CONSTRAINT "CafeMenu_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "CafeMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

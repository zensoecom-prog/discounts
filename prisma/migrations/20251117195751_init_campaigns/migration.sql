-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "instock" BOOLEAN NOT NULL DEFAULT false,
    "tracking" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignCollection_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LockedPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "basePrice" REAL NOT NULL,
    "lockedPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LockedPrice_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "campaignId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "metadata" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "JobLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Campaign_shop_active_idx" ON "Campaign"("shop", "active");

-- CreateIndex
CREATE INDEX "Campaign_shop_startDate_endDate_idx" ON "Campaign"("shop", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "CampaignProduct_campaignId_idx" ON "CampaignProduct"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignProduct_productId_idx" ON "CampaignProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignProduct_campaignId_productId_variantId_key" ON "CampaignProduct"("campaignId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "CampaignCollection_campaignId_idx" ON "CampaignCollection"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignCollection_collectionId_idx" ON "CampaignCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCollection_campaignId_collectionId_key" ON "CampaignCollection"("campaignId", "collectionId");

-- CreateIndex
CREATE INDEX "LockedPrice_shop_productId_idx" ON "LockedPrice"("shop", "productId");

-- CreateIndex
CREATE INDEX "LockedPrice_campaignId_idx" ON "LockedPrice"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "LockedPrice_campaignId_productId_variantId_key" ON "LockedPrice"("campaignId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "JobLog_shop_jobType_idx" ON "JobLog"("shop", "jobType");

-- CreateIndex
CREATE INDEX "JobLog_status_idx" ON "JobLog"("status");

-- CreateIndex
CREATE INDEX "JobLog_startedAt_idx" ON "JobLog"("startedAt");

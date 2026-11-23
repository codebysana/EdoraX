-- CreateEnum
CREATE TYPE "AudiobookStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Audiobook" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorName" TEXT NOT NULL,
    "category" "CourseCategory" NOT NULL DEFAULT 'TECH',
    "status" "AudiobookStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audiobook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudiobookTrack" (
    "id" TEXT NOT NULL,
    "audiobookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudiobookTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Audiobook_slug_key" ON "Audiobook"("slug");

-- CreateIndex
CREATE INDEX "Audiobook_ownerId_idx" ON "Audiobook"("ownerId");

-- CreateIndex
CREATE INDEX "Audiobook_status_publishedAt_idx" ON "Audiobook"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "AudiobookTrack_audiobookId_idx" ON "AudiobookTrack"("audiobookId");

-- CreateIndex
CREATE UNIQUE INDEX "AudiobookTrack_audiobookId_position_key" ON "AudiobookTrack"("audiobookId", "position");

-- AddForeignKey
ALTER TABLE "Audiobook" ADD CONSTRAINT "Audiobook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudiobookTrack" ADD CONSTRAINT "AudiobookTrack_audiobookId_fkey" FOREIGN KEY ("audiobookId") REFERENCES "Audiobook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

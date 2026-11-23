-- One highlight per learner, chapter, quote and occurrence. Parallel requests used to create duplicates,
-- so remove exact duplicates first (keep the oldest, ties broken by id) before the index is built.
DELETE FROM "ChapterHighlight" a
USING "ChapterHighlight" b
WHERE a."userId" = b."userId"
  AND a."chapterId" = b."chapterId"
  AND a."quote" = b."quote"
  AND a."occurrence" = b."occurrence"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- CreateIndex
CREATE UNIQUE INDEX "ChapterHighlight_userId_chapterId_quote_occurrence_key" ON "ChapterHighlight"("userId", "chapterId", "quote", "occurrence");

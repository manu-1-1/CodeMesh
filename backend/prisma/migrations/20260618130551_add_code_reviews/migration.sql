-- CreateTable
CREATE TABLE "code_reviews" (
    "id" TEXT NOT NULL,
    "snippet_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reviewer_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_reviews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_snippet_id_fkey" FOREIGN KEY ("snippet_id") REFERENCES "snippets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

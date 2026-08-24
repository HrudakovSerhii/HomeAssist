-- AlterTable
ALTER TABLE "processed_emails" ADD COLUMN     "embeddingCategory" "EmailCategory",
ADD COLUMN     "embeddingConfidence" DOUBLE PRECISION;

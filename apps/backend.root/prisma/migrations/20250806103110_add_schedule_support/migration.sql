/*
  Warnings:

  - You are about to drop the column `extractedDataId` on the `action_items` table. All the data in the column will be lost.
  - You are about to drop the column `extractedDataId` on the `entity_extractions` table. All the data in the column will be lost.
  - You are about to drop the `dynamic_entity_types` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `email_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `emails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `extracted_email_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `llm_responses` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `processedEmailId` to the `action_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processedEmailId` to the `entity_extractions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProcessingType" AS ENUM ('DATE_RANGE', 'RECURRING', 'SPECIFIC_DATES');

-- CreateEnum
CREATE TYPE "LlmFocus" AS ENUM ('general', 'sentiment', 'urgency');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'VIEW_LINK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'TECHNOLOGY';
ALTER TYPE "EntityType" ADD VALUE 'DATE_RANGE';

-- DropForeignKey
ALTER TABLE "action_items" DROP CONSTRAINT "action_items_extractedDataId_fkey";

-- DropForeignKey
ALTER TABLE "email_attachments" DROP CONSTRAINT "email_attachments_emailId_fkey";

-- DropForeignKey
ALTER TABLE "emails" DROP CONSTRAINT "emails_emailAccountId_fkey";

-- DropForeignKey
ALTER TABLE "entity_extractions" DROP CONSTRAINT "entity_extractions_extractedDataId_fkey";

-- DropForeignKey
ALTER TABLE "extracted_email_data" DROP CONSTRAINT "extracted_email_data_emailId_fkey";

-- DropForeignKey
ALTER TABLE "extracted_email_data" DROP CONSTRAINT "extracted_email_data_llmResponseId_fkey";

-- DropForeignKey
ALTER TABLE "llm_responses" DROP CONSTRAINT "llm_responses_emailId_fkey";

-- DropIndex
DROP INDEX "action_items_extractedDataId_idx";

-- DropIndex
DROP INDEX "entity_extractions_extractedDataId_idx";

-- AlterTable
ALTER TABLE "action_items" DROP COLUMN "extractedDataId",
ADD COLUMN     "processedEmailId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "email_accounts" ADD COLUMN     "hasInitialSchedule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "entity_extractions" DROP COLUMN "extractedDataId",
ADD COLUMN     "processedEmailId" TEXT NOT NULL;

-- DropTable
DROP TABLE "dynamic_entity_types";

-- DropTable
DROP TABLE "email_attachments";

-- DropTable
DROP TABLE "emails";

-- DropTable
DROP TABLE "extracted_email_data";

-- DropTable
DROP TABLE "llm_responses";

-- CreateTable
CREATE TABLE "processed_emails" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "category" "EmailCategory" NOT NULL,
    "priority" "Priority" NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "importanceScore" INTEGER NOT NULL DEFAULT 50,
    "priorityReasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduleExecutionId" TEXT,

    CONSTRAINT "processed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "processingType" "ProcessingType" NOT NULL,
    "dateRangeFrom" TIMESTAMP(3),
    "dateRangeTo" TIMESTAMP(3),
    "cronExpression" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "specificDates" JSONB,
    "batchSize" INTEGER NOT NULL DEFAULT 5,
    "emailTypePriorities" JSONB NOT NULL DEFAULT '{}',
    "senderPriorities" JSONB NOT NULL DEFAULT '{}',
    "llmFocus" "LlmFocus" NOT NULL DEFAULT 'general',
    "lastExecutedAt" TIMESTAMP(3),
    "nextExecutionAt" TIMESTAMP(3),
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "successfulExecutions" INTEGER NOT NULL DEFAULT 0,
    "failedExecutions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_executions" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalBatchesCount" INTEGER NOT NULL DEFAULT 0,
    "completedBatchesCount" INTEGER NOT NULL DEFAULT 0,
    "totalEmailsCount" INTEGER NOT NULL DEFAULT 0,
    "processedEmailsCount" INTEGER NOT NULL DEFAULT 0,
    "failedEmailsCount" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedUid" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "processingDurationMs" INTEGER,
    "averageEmailProcessingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_job_registry" (
    "id" TEXT NOT NULL,
    "executionTime" TIMESTAMP(3) NOT NULL,
    "scheduleIds" TEXT[],
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_job_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_emails_messageId_key" ON "processed_emails"("messageId");

-- CreateIndex
CREATE INDEX "processed_emails_messageId_idx" ON "processed_emails"("messageId");

-- CreateIndex
CREATE INDEX "processed_emails_emailAccountId_idx" ON "processed_emails"("emailAccountId");

-- CreateIndex
CREATE INDEX "processed_emails_processingStatus_idx" ON "processed_emails"("processingStatus");

-- CreateIndex
CREATE INDEX "processed_emails_category_idx" ON "processed_emails"("category");

-- CreateIndex
CREATE INDEX "processed_emails_priority_idx" ON "processed_emails"("priority");

-- CreateIndex
CREATE INDEX "idx_processed_emails_importance_score" ON "processed_emails"("importanceScore");

-- CreateIndex
CREATE INDEX "idx_processed_emails_received_at" ON "processed_emails"("receivedAt");

-- CreateIndex
CREATE INDEX "processing_schedules_nextExecutionAt_isEnabled_idx" ON "processing_schedules"("nextExecutionAt", "isEnabled");

-- CreateIndex
CREATE INDEX "processing_schedules_userId_emailAccountId_idx" ON "processing_schedules"("userId", "emailAccountId");

-- CreateIndex
CREATE INDEX "processing_schedules_processingType_isEnabled_idx" ON "processing_schedules"("processingType", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "processing_schedules_userId_name_key" ON "processing_schedules"("userId", "name");

-- CreateIndex
CREATE INDEX "schedule_executions_scheduleId_status_idx" ON "schedule_executions"("scheduleId", "status");

-- CreateIndex
CREATE INDEX "schedule_executions_startedAt_idx" ON "schedule_executions"("startedAt");

-- CreateIndex
CREATE INDEX "schedule_executions_status_idx" ON "schedule_executions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cron_job_registry_executionTime_key" ON "cron_job_registry"("executionTime");

-- CreateIndex
CREATE INDEX "cron_job_registry_executionTime_idx" ON "cron_job_registry"("executionTime");

-- CreateIndex
CREATE INDEX "action_items_processedEmailId_idx" ON "action_items"("processedEmailId");

-- CreateIndex
CREATE INDEX "entity_extractions_processedEmailId_idx" ON "entity_extractions"("processedEmailId");

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_scheduleExecutionId_fkey" FOREIGN KEY ("scheduleExecutionId") REFERENCES "schedule_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_extractions" ADD CONSTRAINT "entity_extractions_processedEmailId_fkey" FOREIGN KEY ("processedEmailId") REFERENCES "processed_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_processedEmailId_fkey" FOREIGN KEY ("processedEmailId") REFERENCES "processed_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_schedules" ADD CONSTRAINT "processing_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_schedules" ADD CONSTRAINT "processing_schedules_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_executions" ADD CONSTRAINT "schedule_executions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "processing_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

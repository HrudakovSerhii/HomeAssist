-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('PERSONAL', 'WORK', 'MARKETING', 'NEWSLETTER', 'SUPPORT', 'NOTIFICATION', 'INVOICE', 'RECEIPT', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'ORGANIZATION', 'DATE', 'TIME', 'LOCATION', 'EMAIL_ADDRESS', 'PHONE_NUMBER', 'URL', 'AMOUNT', 'CURRENCY', 'INVOICE_NUMBER', 'ACCOUNT_NUMBER', 'PRODUCT');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('SAVE_INVOICE', 'SCHEDULE_MEETING', 'REPLY_REQUIRED', 'FOLLOW_UP', 'ARCHIVE', 'FORWARD', 'CALL', 'REVIEW_DOCUMENT', 'PAYMENT_DUE');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'YAHOO', 'IMAP_GENERIC');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
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
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_responses" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "processingTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_email_data" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "llmResponseId" TEXT NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "priority" "Priority" NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_email_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_extractions" (
    "id" TEXT NOT NULL,
    "extractedDataId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "startPosition" INTEGER,
    "endPosition" INTEGER,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "extractedDataId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "expectedOutputSchema" JSONB NOT NULL,
    "categories" "EmailCategory"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountType" "EmailProvider" NOT NULL DEFAULT 'GMAIL',
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "appPassword" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL DEFAULT 'imap.gmail.com',
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "useSSL" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastProcessedEmailId" TEXT,
    "lastProcessedAt" TIMESTAMP(3),
    "processingDateFrom" TIMESTAMP(3),
    "processingDateTo" TIMESTAMP(3),
    "isCurrentlyProcessing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "emails_messageId_idx" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "emails_emailAccountId_idx" ON "emails"("emailAccountId");

-- CreateIndex
CREATE INDEX "emails_isProcessed_idx" ON "emails"("isProcessed");

-- CreateIndex
CREATE INDEX "emails_processingStatus_idx" ON "emails"("processingStatus");

-- CreateIndex
CREATE INDEX "emails_receivedAt_idx" ON "emails"("receivedAt");

-- CreateIndex
CREATE INDEX "email_attachments_emailId_idx" ON "email_attachments"("emailId");

-- CreateIndex
CREATE INDEX "llm_responses_emailId_idx" ON "llm_responses"("emailId");

-- CreateIndex
CREATE INDEX "extracted_email_data_emailId_idx" ON "extracted_email_data"("emailId");

-- CreateIndex
CREATE INDEX "extracted_email_data_category_idx" ON "extracted_email_data"("category");

-- CreateIndex
CREATE INDEX "extracted_email_data_priority_idx" ON "extracted_email_data"("priority");

-- CreateIndex
CREATE INDEX "entity_extractions_extractedDataId_idx" ON "entity_extractions"("extractedDataId");

-- CreateIndex
CREATE INDEX "entity_extractions_entityType_idx" ON "entity_extractions"("entityType");

-- CreateIndex
CREATE INDEX "action_items_extractedDataId_idx" ON "action_items"("extractedDataId");

-- CreateIndex
CREATE INDEX "action_items_isCompleted_idx" ON "action_items"("isCompleted");

-- CreateIndex
CREATE INDEX "action_items_actionType_idx" ON "action_items"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_name_key" ON "prompt_templates"("name");

-- CreateIndex
CREATE INDEX "prompt_templates_isActive_idx" ON "prompt_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "processing_rules_name_key" ON "processing_rules"("name");

-- CreateIndex
CREATE INDEX "processing_rules_isActive_idx" ON "processing_rules"("isActive");

-- CreateIndex
CREATE INDEX "processing_rules_priority_idx" ON "processing_rules"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_email_key" ON "email_accounts"("email");

-- CreateIndex
CREATE INDEX "email_accounts_userId_idx" ON "email_accounts"("userId");

-- CreateIndex
CREATE INDEX "email_accounts_email_idx" ON "email_accounts"("email");

-- CreateIndex
CREATE INDEX "email_accounts_isActive_idx" ON "email_accounts"("isActive");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_responses" ADD CONSTRAINT "llm_responses_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_email_data" ADD CONSTRAINT "extracted_email_data_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_email_data" ADD CONSTRAINT "extracted_email_data_llmResponseId_fkey" FOREIGN KEY ("llmResponseId") REFERENCES "llm_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_extractions" ADD CONSTRAINT "entity_extractions_extractedDataId_fkey" FOREIGN KEY ("extractedDataId") REFERENCES "extracted_email_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_extractedDataId_fkey" FOREIGN KEY ("extractedDataId") REFERENCES "extracted_email_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "dynamic_entity_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "mapped_to_standard" TEXT,
    "examples" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_entity_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_entity_types_name_key" ON "dynamic_entity_types"("name");

-- CreateIndex
CREATE INDEX "dynamic_entity_types_is_approved_idx" ON "dynamic_entity_types"("is_approved");

-- CreateIndex
CREATE INDEX "dynamic_entity_types_usage_count_idx" ON "dynamic_entity_types"("usage_count");

-- CreateIndex
CREATE INDEX "dynamic_entity_types_confidence_idx" ON "dynamic_entity_types"("confidence"); 
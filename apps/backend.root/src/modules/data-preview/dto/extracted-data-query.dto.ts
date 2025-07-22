import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EmailCategory, Priority, Sentiment, EntityType, ActionType } from '@prisma/client';

enum SortByField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  CONFIDENCE = 'confidence',
  RECEIVED_AT = 'receivedAt'
}

enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export class ProcessedEmailsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  // Search functionality
  @IsOptional()
  @IsString()
  search?: string;

  // Filtering by category
  @IsOptional()
  @IsEnum(EmailCategory)
  category?: EmailCategory;

  // Filtering by priority
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  // Filtering by sentiment
  @IsOptional()
  @IsEnum(Sentiment)
  sentiment?: Sentiment;

  // Filtering by entity type
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  // Filtering by action type
  @IsOptional()
  @IsEnum(ActionType)
  actionType?: ActionType;

  // Date range filtering
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Confidence filtering
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;

  // Sorting
  @IsOptional()
  @IsEnum(SortByField)
  sortBy?: SortByField = SortByField.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
} 
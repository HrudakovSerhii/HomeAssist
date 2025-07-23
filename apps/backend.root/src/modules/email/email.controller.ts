import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsISO8601,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EmailService } from './email.service';
import { EmailIngestionService } from './email-ingestion.service';

import type {
  IngestEmailsDto as ApiIngestEmailsDto,
  IngestUserEmailsDto as ApiIngestUserEmailsDto,
  ProcessEmailDto as ApiProcessEmailDto,
  ProcessBatchDto as ApiProcessBatchDto,
  ProcessingStatusResponse as ApiProcessingStatusResponse,
  EmailIngestionResponse,
} from '@home-assist/api-types';

// DTOs aligned with OpenAPI schema
export class IngestEmailsDto implements ApiIngestEmailsDto {
  @IsString()
  userId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit: number = 5;

  @IsString()
  folder: string = 'INBOX';

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  since?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  before?: string;

  @IsOptional()
  @IsString()
  templateName?: string;
}

export class IngestUserEmailsDto implements ApiIngestUserEmailsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit: number = 5;

  @IsString()
  folder: string = 'INBOX';

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  since?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  before?: string;
}

export class ProcessEmailDto implements ApiProcessEmailDto {
  @IsOptional()
  @IsString()
  templateName?: string;
}

export class ProcessBatchDto implements ApiProcessBatchDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit: number = 5;
}

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailIngestionService: EmailIngestionService
  ) {}

  /**
   * Manually trigger email ingestion
   * OpenAPI: POST /email/ingest
   */
  @Post('ingest')
  async ingestEmails(@Body() dto: IngestEmailsDto): Promise<EmailIngestionResponse> {
    try {
      const results = await this.emailService.ingestEmails(dto.userId, {
        limit: dto.limit,
        folder: dto.folder,
        since: dto.since ? new Date(dto.since) : undefined,
        before: dto.before ? new Date(dto.before) : undefined,
        templateName: dto.templateName,
      });

      // Transform results to match OpenAPI schema
      return {
        success: true,
        message: 'Email ingestion completed',
        fetched: results?.reduce((total, result) => total + (result.fetched || 0), 0) || 0,
        stored: results?.reduce((total, result) => total + (result.stored || 0), 0) || 0,
        processed: results?.reduce((total, result) => total + (result.processed || 0), 0) || 0,
        failed: results?.reduce((total, result) => total + (result.failed || 0), 0) || 0,
        emails: results?.flatMap(result => result.emails || []) || [],
      };
    } catch (error) {
      throw new HttpException(
        `Email ingestion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Ingest and process emails for a specific user
   * OpenAPI: POST /email/ingest/{userId}
   */
  @Post('ingest/:userId')
  async ingestUserEmails(
    @Param('userId') userId: string,
    @Body() dto: IngestUserEmailsDto
  ): Promise<EmailIngestionResponse> {
    try {
      // Add overall timeout for the entire ingestion process (5 minutes)
      const results = await Promise.race([
        this.emailService.ingestEmails(userId, {
          limit: dto.limit,
          folder: dto.folder,
          since: dto.since ? new Date(dto.since) : undefined,
          before: dto.before ? new Date(dto.before) : undefined,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email ingestion timeout - process took longer than 5 minutes')), 300000)
        )
      ]) as any;

      // Transform results to match OpenAPI schema
      return {
        success: true,
        message: 'Email ingestion completed',
        fetched: results?.reduce((total, result) => total + (result.fetched || 0), 0) || 0,
        stored: results?.reduce((total, result) => total + (result.stored || 0), 0) || 0,
        processed: results?.reduce((total, result) => total + (result.processed || 0), 0) || 0,
        failed: results?.reduce((total, result) => total + (result.failed || 0), 0) || 0,
        emails: results?.flatMap(result => result.emails || []) || [],
      };
    } catch (error) {
      throw new HttpException(
        `Email ingestion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get processing status for a user
   * OpenAPI: GET /email/status/{userId}
   */
  @Get('status/:userId')
  async getProcessingStatus(
    @Param('userId') userId: string
  ): Promise<ApiProcessingStatusResponse> {
    try {
      return await this.emailIngestionService.getProcessingStatus(userId);
    } catch (error) {
      throw new HttpException(
        `Failed to get processing status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Manually process a specific email
   * OpenAPI: POST /email/{id}/process
   * Note: This endpoint processes a stored processed email by ID
   */
  @Post(':id/process')
  async processEmail(@Param('id') id: string, @Body() dto: ProcessEmailDto) {
    try {
      // Get the processed email by ID to get the account information
      const processedEmail = await this.emailService.getProcessedEmailById(id);
      
      // For now, return success without re-processing since the current service
      // architecture doesn't support re-processing from stored email data
      // TODO: Implement proper re-processing logic
      return {
        emailId: id,
        success: true,
        message: 'Email processing endpoint - re-processing logic not yet implemented',
      };
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        `Email processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process batch of pending emails
   * OpenAPI: POST /email/process/batch
   * Note: This endpoint processes pending emails in batch
   */
  @Post('process/batch')
  async processBatchEmails(@Body() dto: ProcessBatchDto) {
    try {
      // For now, return success without processing since the current service
      // architecture requires account ID and email messages
      // TODO: Implement proper batch processing of pending emails
      return {
        success: true,
        message: 'Batch processing endpoint - batch processing logic not yet implemented',
        processed: 0,
        failed: 0,
      };
    } catch (error) {
      throw new HttpException(
        `Batch processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

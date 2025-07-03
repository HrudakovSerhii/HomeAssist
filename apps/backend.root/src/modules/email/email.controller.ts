import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsDate,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';

import { EmailIngestionService } from './email-ingestion.service';
import { TemplateService } from '../process-template/template.service';

// DTOs
export class IngestEmailsDto {
  @IsString()
  userId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @IsOptional()
  @IsString()
  folder?: string = 'INBOX';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  since?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  before?: Date;

  @IsOptional()
  @IsString()
  templateName?: string;
}

export class GetEmailsDto {
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

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  processed?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class ProcessEmailDto {
  @IsOptional()
  @IsString()
  templateName?: string;
}

export class ProcessBatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

export class IngestUserEmailsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @IsOptional()
  @IsString()
  folder?: string = 'INBOX';

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  since?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  before?: Date;
}

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailProcessorService: EmailProcessorService,
    private readonly templateService: TemplateService,
    private readonly emailIngestionService: EmailIngestionService
  ) {}

  /**
   * Manually trigger email ingestion from Gmail
   */
  @Post('ingest')
  async ingestEmails(@Body() dto: IngestEmailsDto) {
    try {
      const result = await this.emailService.ingestEmails(dto.userId, {
        limit: dto.limit,
        folder: dto.folder,
        since: dto.since,
        before: dto.before,
        templateName: dto.templateName,
      });
      return {
        success: true,
        message: `Email ingestion completed`,
        ...result,
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
   */
  @Post('ingest/:userId')
  async ingestUserEmails(
    @Param('userId') userId: string,
    @Body() dto: IngestUserEmailsDto = {}
  ) {
    try {
      const result = await this.emailIngestionService.ingestAndProcessEmails(
        userId,
        dto.limit || 5,
        {
          folder: dto.folder,
          since: dto.since,
          before: dto.before,
        }
      );
      return {
        success: true,
        message: `Email ingestion and processing completed for user ${userId}`,
        ...result,
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
   */
  @Get('status/:userId')
  async getProcessingStatus(@Param('userId') userId: string) {
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
   * Get emails with filtering and pagination
   */
  @Get()
  async getEmails(@Query() query: GetEmailsDto) {
    try {
      return await this.emailService.getEmails(query);
    } catch (error) {
      throw new HttpException(
        `Failed to fetch emails: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get processing statistics
   */
  @Get('stats/processing')
  async getProcessingStats() {
    try {
      // This would be implemented with proper aggregation queries
      return {
        message: 'Processing statistics endpoint - to be implemented',
        // TODO: Implement actual statistics
        totalEmails: 0,
        pendingEmails: 0,
        processedEmails: 0,
        failedEmails: 0,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch processing stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Template Management Endpoints

  /**
   * Get all active templates
   */
  @Get('templates')
  async getTemplates() {
    try {
      return await this.templateService.getActiveTemplates();
    } catch (error) {
      throw new HttpException(
        `Failed to fetch templates: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get template by ID
   */
  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    try {
      return await this.templateService.getTemplateById(id);
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        `Failed to fetch template: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Test template with sample email
   */
  @Post('templates/:id/test')
  async testTemplate(
    @Param('id') id: string,
    @Body()
    sampleEmail: {
      subject: string;
      fromAddress: string;
      bodyText?: string;
      bodyHtml?: string;
    }
  ) {
    try {
      return await this.templateService.testTemplate(id, sampleEmail);
    } catch (error) {
      throw new HttpException(
        `Template test failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Seed default templates (development/setup endpoint)
   */
  @Post('templates/seed')
  async seedTemplates() {
    try {
      const result = await this.templateService.seedDefaultTemplates();
      return {
        success: true,
        message: 'Template seeding completed',
        details: result,
      };
    } catch (error) {
      throw new HttpException(
        `Template seeding failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get email by ID with all processed data
   */
  @Get(':id')
  async getEmailById(@Param('id') id: string) {
    try {
      return await this.emailService.getEmailById(id);
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        `Failed to fetch email: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Manually process a specific email
   */
  @Post(':id/process')
  async processEmail(@Param('id') id: string, @Body() dto: ProcessEmailDto) {
    try {
      const { emailId, ...result } =
        await this.emailProcessorService.processEmail(id, dto.templateName);
      return {
        emailId: id,
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        `Email processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process batch of pending emails
   */
  @Post('process/batch')
  async processBatchEmails(@Body() dto: ProcessBatchDto) {
    try {
      const result = await this.emailProcessorService.processEmailBatch(
        dto.limit
      );
      return {
        success: true,
        message: `Processed ${result.processed} emails, ${result.failed} failed`,
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        `Batch processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Retry failed email processing
   * TODO: Verify if we can use number of retry to improve bugfix process
   */
  @Post('process/retry')
  async retryFailedEmails(@Body() dto: ProcessBatchDto) {
    try {
      const result = await this.emailProcessorService.retryFailedEmails(
        dto.limit
      );
      return {
        success: true,
        message: `Failed ${result.failed} emails, Processed ${result.processed} emails`,
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        `Retry processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete email and all related data
   */
  @Delete(':id')
  async deleteEmail(@Param('id') id: string) {
    try {
      await this.emailService.deleteEmail(id);
      return {
        success: true,
        message: 'Email deleted successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to delete email: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

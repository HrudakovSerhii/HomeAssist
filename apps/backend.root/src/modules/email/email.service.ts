import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProcessingStatus, EmailCategory, Priority } from '.prisma/client';
import { EmailIngestionService } from './email-ingestion.service';
import { 
  ProcessedEmailWithRelations,
  ProcessedEmailsPaginatedResult 
} from '../../types/processed-email.types';

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailIngestionService: EmailIngestionService
  ) {}

  /**
   * Trigger email ingestion process
   */
  async ingestEmails(
    userId: string,
    options: {
      limit?: number;
      folder?: string;
      since?: Date;
      before?: Date;
      templateName?: string;
    }
  ) {
    try {
      return await this.emailIngestionService.ingestUserEmails(userId, options);
    } catch (error) {
      throw new HttpException(
        `Email ingestion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get processed emails with filtering and pagination
   */
  async getProcessedEmails(params: {
    page?: number;
    limit?: number;
    processingStatus?: ProcessingStatus;
    category?: EmailCategory;
    priority?: Priority;
  }): Promise<ProcessedEmailsPaginatedResult> {
    const { page = 1, limit = 10, processingStatus, category, priority } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (processingStatus !== undefined) {
      where.processingStatus = processingStatus;
    }

    if (category !== undefined) {
      where.category = category;
    }

    if (priority !== undefined) {
      where.priority = priority;
    }

    const processedEmails = await this.prisma.processedEmails.findMany({
      where,
      include: {
        entities: true,
        actionItems: true,
      },
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.processedEmails.count({ where });

    return {
      processedEmails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get processed email by ID with all related data
   */
  async getProcessedEmailById(id: string): Promise<ProcessedEmailWithRelations> {
    const processedEmail = await this.prisma.processedEmails.findUnique({
      where: { id },
      include: {
        entities: true,
        actionItems: true,
      },
    });

    if (!processedEmail) {
      throw new HttpException('Processed email not found', HttpStatus.NOT_FOUND);
    }

    return processedEmail;
  }

  /**
   * Get processed email by message ID with all related data
   */
  async getProcessedEmailByMessageId(messageId: string): Promise<ProcessedEmailWithRelations> {
    const processedEmail = await this.prisma.processedEmails.findUnique({
      where: { messageId },
      include: {
        entities: true,
        actionItems: true,
      },
    });

    if (!processedEmail) {
      throw new HttpException('Processed email not found', HttpStatus.NOT_FOUND);
    }

    return processedEmail;
  }

  /**
   * Update processed email status
   */
  async updateProcessedEmailStatus(id: string, status: ProcessingStatus) {
    return this.prisma.processedEmails.update({
      where: { id },
      data: {
        processingStatus: status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * @deprecated Get pending processed emails for processing (failed ones that need retry)
   * Retry logic has been removed. Failed emails should be reprocessed manually if needed.
   */
  async getPendingProcessedEmails(limit = 10) {
    console.warn('getPendingProcessedEmails is deprecated. Retry logic has been removed.');
    return this.prisma.processedEmails.findMany({
      where: {
        processingStatus: ProcessingStatus.FAILED,
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Delete processed email and all related data
   */
  async deleteProcessedEmail(id: string) {
    return this.prisma.processedEmails.delete({
      where: { id },
    });
  }
}

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProcessingStatus } from '.prisma/client';
import { EmailIngestionService } from './email-ingestion.service';

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
      return await this.emailIngestionService.ingestAndProcessEmails(
        userId,
        options.limit,
        {
          folder: options.folder,
          since: options.since,
          before: options.before,
        }
      );
    } catch (error) {
      throw new HttpException(
        `Email ingestion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get emails with filtering and pagination
   */
  async getEmails(params: {
    page?: number;
    limit?: number;
    processed?: boolean;
    category?: string;
    priority?: string;
  }) {
    const { page = 1, limit = 10, processed } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (processed !== undefined) {
      where.isProcessed = processed;
    }

    const emails = await this.prisma.email.findMany({
      where,
      include: {
        attachments: true,
        extractedData: {
          include: {
            entities: true,
            actionItems: true,
          },
        },
        llmResponses: true,
      },
      orderBy: { receivedAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.email.count({ where });

    return {
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get email by ID with all related data
   */
  async getEmailById(id: string) {
    const email = await this.prisma.email.findUnique({
      where: { id },
      include: {
        attachments: true,
        extractedData: {
          include: {
            entities: true,
            actionItems: true,
          },
        },
        llmResponses: true,
      },
    });

    if (!email) {
      throw new HttpException('Email not found', HttpStatus.NOT_FOUND);
    }

    return email;
  }

  /**
   * Update email processing status
   */
  async updateEmailStatus(id: string, status: ProcessingStatus) {
    return this.prisma.email.update({
      where: { id },
      data: {
        processingStatus: status,
        isProcessed: status === ProcessingStatus.COMPLETED,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get pending emails for processing
   */
  async getPendingEmails(limit: number = 10) {
    return this.prisma.email.findMany({
      where: {
        processingStatus: ProcessingStatus.PENDING,
        isProcessed: false,
      },
      orderBy: { receivedAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Delete email and all related data
   */
  async deleteEmail(id: string) {
    return this.prisma.email.delete({
      where: { id },
    });
  }
}

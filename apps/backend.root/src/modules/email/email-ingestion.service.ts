import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EmailProcessorService } from './email-processor.service';

@Injectable()
export class EmailIngestionService {
  private readonly logger = new Logger(EmailIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imapService: ImapService,
    private readonly emailProcessor: EmailProcessorService
  ) {}

  /**
   * Fetch emails from user's account, store them, and process with LLM
   */
  async ingestAndProcessEmails(
    userId: string,
    limit: number = 5,
    options: {
      folder?: string;
      since?: Date;
      before?: Date;
      templateName?: string;
    } = {}
  ) {
    try {
      // Get user's first active email account
      const emailAccount = await this.prisma.emailAccount.findFirst({
        where: {
          userId,
          isActive: true,
        },
      });

      if (!emailAccount) {
        throw new Error('No active email account found for user');
      }

      this.logger.log(`Starting email ingestion for ${emailAccount.email}`);

      // Fetch, parse, and process emails in one streamlined operation
      this.logger.log(`Fetching and processing emails (limit: ${limit})`);
      const messages = await this.imapService.fetchAndProcessEmails(
        emailAccount.id,
        {
          limit,
          folder: options.folder || 'INBOX',
          since: options.since,
          before: options.before,
        }
      );

      this.logger.log(
        `Successfully fetched ${messages.length} emails from IMAP`
      );

      const results = {
        fetched: messages.length,
        stored: 0,
        processed: 0,
        failed: 0,
        emails: [] as Array<{
          id: string;
          subject: string;
          processed: boolean;
          error?: string;
        }>,
      };

      // Store and process each email
      for (const message of messages) {
        try {
          this.logger.log(
            `Processing email: "${message.subject}" (UID: ${message.uid})`
          );

          // Check if email already exists
          const existingEmail = await this.prisma.email.findUnique({
            where: { messageId: message.messageId },
          });

          if (existingEmail) {
            this.logger.log(
              `Email ${message.messageId} already exists, skipping`
            );
            continue;
          }

          // Store email in database
          const storedEmail = await this.prisma.email.create({
            data: {
              messageId: message.messageId,
              emailAccountId: emailAccount.id,
              subject: message.subject,
              fromAddress: message.from,
              toAddresses: message.to,
              ccAddresses: message.cc,
              bccAddresses: message.bcc,
              receivedAt: message.date,
              bodyText: message.bodyText,
              bodyHtml: message.bodyHtml,
            },
          });

          results.stored++;
          this.logger.log(
            `Email stored successfully: "${storedEmail.subject}" (ID: ${storedEmail.id})`
          );

          // Process email with LLM
          const processingResult = await this.emailProcessor.processEmail(
            storedEmail.id,
            options.templateName
          );

          if (processingResult.success) {
            results.processed++;
            this.logger.log(
              `LLM processing completed for: "${storedEmail.subject}"`
            );
          } else {
            results.failed++;
            this.logger.error(
              `LLM processing failed for: "${storedEmail.subject}"`,
              processingResult.error
            );
          }

          results.emails.push({
            id: storedEmail.id,
            subject: storedEmail.subject,
            processed: processingResult.success,
            error: processingResult.error,
          });
        } catch (error) {
          this.logger.error(
            `Error processing message ${message.messageId}:`,
            error
          );
          results.failed++;
        }
      }

      this.logger.log(
        `Ingestion completed. Stored: ${results.stored}, Processed: ${results.processed}, Failed: ${results.failed}`
      );

      return results;
    } catch (error) {
      this.logger.error('Email ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Get processing status for user's emails
   */
  async getProcessingStatus(userId: string) {
    const emailAccount = await this.prisma.emailAccount.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (!emailAccount) {
      return { total: 0, processed: 0, pending: 0, failed: 0 };
    }

    const [total, processed, pending, failed] = await Promise.all([
      this.prisma.email.count({
        where: { emailAccountId: emailAccount.id },
      }),
      this.prisma.email.count({
        where: {
          emailAccountId: emailAccount.id,
          processingStatus: 'COMPLETED',
        },
      }),
      this.prisma.email.count({
        where: {
          emailAccountId: emailAccount.id,
          processingStatus: 'PENDING',
        },
      }),
      this.prisma.email.count({
        where: {
          emailAccountId: emailAccount.id,
          processingStatus: 'FAILED',
        },
      }),
    ]);

    return { total, processed, pending, failed };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { EmailGateway, EmailIngestionProgress } from './email.gateway';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EmailProcessorService } from './email-processor.service';
import { EmailIngestionResults } from '../../types/processed-email.types';

@Injectable()
export class EmailIngestionService {
  private readonly logger = new Logger(EmailIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imapService: ImapService,
    private readonly emailProcessor: EmailProcessorService
  ) // private readonly emailGateway: EmailGateway
  {}

  // private sendProgressUpdate(userId: string, progress: EmailIngestionProgress) {
  //   try {
  //     this.emailGateway.sendProgressUpdate(userId, progress);
  //   } catch (error) {
  //     this.logger.error('Failed to send progress update', error);
  //   }
  // }

  async ingestUserEmails(
    userId: string,
    options: {
      limit?: number;
      folder?: string;
      since?: Date; // TODO: use to to search emails if parameter provided
      before?: Date; // TODO: use to to search emails if parameter provided
      templateName?: string;
    } = {}
  ): Promise<EmailIngestionResults> {
    const { limit = 5, folder = 'INBOX', templateName } = options;

    try {
      // Get user's email accounts
      const emailAccounts = await this.prisma.emailAccount.findMany({
        where: { userId, isActive: true },
      });

      if (!emailAccounts.length) {
        throw new Error('No active email accounts found');
      }

      const results: EmailIngestionResults = [];

      for (const account of emailAccounts) {
        try {
          // Initial progress
          // this.sendProgressUpdate(userId, {
          //   stage: 'CONNECTING',
          //   emailAccountId: account.id,
          //   completedSteps: {
          //     fetched: false,
          //     stored: false,
          //     processed: false,
          //   },
          //   progress: 0,
          // });

          // Test connection with timeout
          const connectionTest = await this.imapService.testConnection(
            account.id
          );

          if (!connectionTest.success) {
            throw new Error(`Failed to connect: ${connectionTest.message}`);
          }

          // Fetch emails with timeout
          // this.sendProgressUpdate(userId, {
          //   stage: 'FETCHING',
          //   emailAccountId: account.id,
          //   completedSteps: {
          //     fetched: false,
          //     stored: false,
          //     processed: false,
          //   },
          //   progress: 20,
          // });

          const emailMessages = (await Promise.race([
            this.imapService.fetchAndProcessEmails(account.id, {
              folder,
              limit,
            }),
            new Promise(
              (_, reject) =>
                setTimeout(
                  () => reject(new Error('Email fetch timeout')),
                  120000
                ) // 2 minutes
            ),
          ])) as any[];

          // Store emails
          // this.sendProgressUpdate(userId, {
          //   stage: 'STORING',
          //   emailAccountId: account.id,
          //   completedSteps: {
          //     fetched: true,
          //     stored: false,
          //     processed: false,
          //   },
          //   progress: 50,
          //   totalEmails: emails.length,
          // });

          // const storedEmails = await Promise.all(
          //   emails.map(async (email) => {
          //     const stored = await this.prisma.email.create({
          //       data: {
          //         messageId: email.messageId,
          //         emailAccountId: account.id,
          //         subject: email.subject,
          //         fromAddress: email.from,
          //         toAddresses: email.to,
          //         ccAddresses: email.cc,
          //         bccAddresses: email.bcc,
          //         receivedAt: email.date,
          //         bodyText: email.bodyText,
          //         bodyHtml: email.bodyHtml,
          //       },
          //     });
          //     return stored;
          //   })
          // );

          // Process emails
          // this.sendProgressUpdate(userId, {
          //   stage: 'PROCESSING',
          //   emailAccountId: account.id,
          //   completedSteps: {
          //     fetched: true,
          //     stored: true,
          //     processed: false,
          //   },
          //   progress: 75,
          //   totalEmails: emails.length,
          //   processedEmails: 0,
          // });

          const processedEmails = [];

          for (let index = 0; index < emailMessages.length; index++) {
            const email = emailMessages[index];

            try {
              // Add timeout for email processing (includes LLM calls)
              const processed = (await Promise.race([
                this.emailProcessor.processEmail(
                  account.id,
                  email,
                  templateName
                ),
                new Promise(
                  (_, reject) =>
                    setTimeout(
                      () =>
                        reject(
                          new Error(
                            `Processing timeout for email: ${email.subject}`
                          )
                        ),
                      60000
                    ) // 1 minute per email
                ),
              ])) as any;

              processedEmails.push(processed);
            } catch (processingError) {
              this.logger.warn(
                `Failed to process email "${email.subject}": ${processingError.message}`
              );

              // Add failed email to results
              processedEmails.push({
                messageId: email.messageId,
                subject: email.subject,
                success: false,
                error: processingError.message,
                processedEmail: null,
              });
            }

            // this.sendProgressUpdate(userId, {
            //   stage: 'PROCESSING',
            //   emailAccountId: account.id,
            //   completedSteps: {
            //     fetched: true,
            //     stored: true,
            //     processed: false,
            //   },
            //   progress: 75 + (25 * (index + 1)) / storedEmails.length,
            //   totalEmails: emails.length,
            //   processedEmails: index + 1,
            //   currentEmail: {
            //     subject: email.subject,
            //     from: email.fromAddress,
            //   },
            // });
          }

          // Complete
          // this.sendProgressUpdate(userId, {
          //   stage: 'COMPLETED',
          //   emailAccountId: account.id,
          //   completedSteps: {
          //     fetched: true,
          //     stored: true,
          //     processed: true,
          //   },
          //   progress: 100,
          //   totalEmails: emails.length,
          //   processedEmails: emails.length,
          // });

          // Calculate success/failure counts
          const successful = processedEmails.filter((e) => e.success);
          const failed = processedEmails.filter((e) => !e.success);

          results.push({
            accountId: account.id,
            fetched: emailMessages.length,
            stored: emailMessages.length, // We're no longer storing separately
            processed: successful.length,
            failed: failed.length,
            emails: processedEmails.map((e: any) => ({
              id: e.processedEmail?.id || e.messageId,
              subject: e.subject,
              processed: e.success,
            })),
          });

          // Close IMAP connection
          await this.imapService.closeConnection(account.id);
        } catch (error) {
          this.logger.error(
            `Failed to process account ${account.email}:`,
            error
          );

          // this.sendProgressUpdate(userId, {
          //   stage: 'FAILED',
          //   emailAccountId: account.id,
          //   error: error.message,
          //   completedSteps: {
          //     fetched: false,
          //     stored: false,
          //     processed: false,
          //   },
          //   progress: 0,
          // });

          results.push({
            accountId: account.id,
            fetched: 0,
            stored: 0,
            processed: 0,
            failed: 1,
            error: error.message,
            emails: [],
          });

          // Ensure connection is closed even on error
          try {
            await this.imapService.closeConnection(account.id);
          } catch (closeError) {
            this.logger.warn(`Failed to close IMAP connection:`, closeError);
          }
        }
      }

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
      this.prisma.processedEmails.count({
        where: { emailAccountId: emailAccount.id },
      }),
      this.prisma.processedEmails.count({
        where: {
          emailAccountId: emailAccount.id,
          processingStatus: 'COMPLETED',
        },
      }),
      this.prisma.processedEmails.count({
        where: {
          emailAccountId: emailAccount.id,
          processingStatus: 'PENDING',
        },
      }),
      this.prisma.processedEmails.count({
        where: {
          emailAccountId: emailAccount.id,
          processingStatus: 'FAILED',
        },
      }),
    ]);

    return { total, processed, pending, failed };
  }
}

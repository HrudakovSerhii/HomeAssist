import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import * as mailParser from 'mailparser';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../encrypt/encryption.service';

import { EmailMessage } from '../../types/email.types';

export interface EmailConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);
  private connections = new Map<string, ImapFlow>(); // Cache connections per account

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService
  ) {}

  /**
   * Get connection configuration for different email providers
   */
  private getProviderConfig(
    accountType: string
  ): Partial<EmailConnectionConfig> {
    const configs: Record<string, Partial<EmailConnectionConfig>> = {
      GMAIL: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
      },
      OUTLOOK: {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
      },
      YAHOO: {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true,
      },
    };

    return configs[accountType] || configs.GMAIL;
  }

  /**
   * Create IMAP connection for email account
   */
  private async createConnection(accountId: string): Promise<ImapFlow> {
    const account = await this.prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new HttpException('Email account not found', HttpStatus.NOT_FOUND);
    }

    if (!account.isActive) {
      throw new HttpException(
        'Email account is disabled',
        HttpStatus.FORBIDDEN
      );
    }

    // Decrypt app password
    const decryptedPassword = await this.encryptionService.decryptPassword(
      account.appPassword
    );
    const providerConfig = this.getProviderConfig(account.accountType);

    const config: EmailConnectionConfig = {
      host: account.imapHost || providerConfig.host || 'imap.gmail.com',
      port: account.imapPort || providerConfig.port || 993,
      secure: account.useSSL ?? providerConfig.secure ?? true,
      auth: {
        user: account.email,
        pass: decryptedPassword,
      },
    };

    this.logger.log(
      `Connecting to IMAP server: ${config.host}:${config.port} for ${account.email}`
    );

    const client = new ImapFlow({
      ...config,
      // Optimized timeouts for better reliability
      connectionTimeout: 20000, // 20 seconds to establish connection (reduced)
      greetingTimeout: 8000, // 8 seconds for server greeting (reduced)
      socketTimeout: 60000, // 1 minute of inactivity before timeout (reduced)
    });

    // Connect and authenticate
    await client.connect();

    this.logger.log(`Successfully connected to IMAP for ${account.email}`);

    return client;
  }

  /**
   * Get or create cached connection for account
   */
  private async getConnection(accountId: string): Promise<ImapFlow> {
    if (this.connections.has(accountId)) {
      const connection = this.connections.get(accountId)!;

      // Better connection validation
      try {
        if (connection.usable && connection.authenticated) {
          // Test the connection with a quick operation
          await connection.status('INBOX', { messages: true });
          return connection;
        }
      } catch (error) {
        this.logger.warn(`Cached connection for ${accountId} is stale:`, error);
      }
      
      // Remove stale connection
      this.connections.delete(accountId);
      try {
        await connection.logout();
      } catch (error) {
        // Ignore logout errors for stale connections
      }
    }

    // Create new connection
    const connection = await this.createConnection(accountId);

    // Cache connection
    this.connections.set(accountId, connection);

    // Clean up connection when it closes
    connection.on('close', () => {
      this.connections.delete(accountId);
    });

    return connection;
  }

  /**
   * Test connection to email account
   */
  async testConnection(
    accountId: string
  ): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      const client = await this.getConnection(accountId);

      // Try to select INBOX to test functionality
      const mailbox = await client.getMailboxLock('INBOX');
      const stats = {
        exists: (mailbox as any).exists || 0,
        recent: (mailbox as any).recent || 0,
        uidNext: (mailbox as any).uidNext || 0,
        uidValidity: (mailbox as any).uidValidity || 0,
      };
      mailbox.release();

      return {
        success: true,
        message: 'IMAP connection successful',
        stats,
      };
    } catch (error) {
      this.logger.error(
        `IMAP connection test failed for account ${accountId}:`,
        error
      );
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Test IMAP connection with direct credentials (without storing account)
   */
  async testConnectionWithCredentials(
    email: string,
    appPassword: string,
    accountType: string = 'GMAIL'
  ): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      const providerConfig = this.getProviderConfig(accountType);

      const config: EmailConnectionConfig = {
        host: providerConfig.host || 'imap.gmail.com',
        port: providerConfig.port || 993,
        secure: providerConfig.secure ?? true,
        auth: {
          user: email,
          pass: appPassword.trim(), // Remove any whitespace
        },
      };

      this.logger.log(
        `Testing IMAP connection: ${config.host}:${config.port} for ${email}`
      );

      const client = new ImapFlow({
        ...config,
        connectionTimeout: 10000,
        greetingTimeout: 3000,
        socketTimeout: 120000,
      });
      await client.connect();

      // Try to select INBOX to test functionality
      const mailbox = await client.getMailboxLock('INBOX');
      const stats = {
        exists: (mailbox as any).exists || 0,
        recent: (mailbox as any).recent || 0,
        uidNext: (mailbox as any).uidNext || 0,
        uidValidity: (mailbox as any).uidValidity || 0,
      };
      mailbox.release();

      // Clean up connection
      await client.logout();

      this.logger.log(`IMAP connection test successful for ${email}`);

      return {
        success: true,
        message: 'IMAP connection successful',
        stats,
      };
    } catch (error) {
      this.logger.error(`IMAP connection test failed for ${email}:`, error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Fetch and process emails in one streamlined operation
   * This uses the proven approach: fetchOne() with source + mailparser
   */
  async fetchAndProcessEmails(
    accountId: string,
    options: {
      since?: Date;
      before?: Date;
      limit?: number;
      folder?: string;
    } = {}
  ): Promise<EmailMessage[]> {
    const startTime = Date.now();
    this.logger.log(`Starting fetchAndProcessEmails for account ${accountId}`);
    this.logger.log(`Options: ${JSON.stringify(options)}`);

    try {
      this.logger.log(`Getting IMAP connection for account ${accountId}...`);
      const client = await this.getConnection(accountId);
      this.logger.log(`IMAP connection established (${Date.now() - startTime}ms)`);
      
      const folder = options.folder || 'INBOX';
      this.logger.log(`Acquiring mailbox lock for folder: ${folder}...`);
      const mailbox = await client.getMailboxLock(folder);
      this.logger.log(`Mailbox lock acquired (${Date.now() - startTime}ms)`);

      try {
        const processedEmails: EmailMessage[] = [];
        const limit = options.limit || 5;

        // Get mailbox status to determine how many emails exist
        const status = await client.status(folder, { messages: true });
        const totalEmails = status.messages || 0;
        this.logger.log(`Total emails in ${folder}: ${totalEmails}`);

        if (totalEmails === 0) {
          this.logger.log(`No emails found in ${folder}`);
          return processedEmails;
        }

        // Fetch latest emails directly using sequence numbers
        const startSeq = Math.max(1, totalEmails - limit + 1);
        const endSeq = totalEmails;

        this.logger.log(
          `Fetching emails from sequence ${startSeq}:${endSeq} (latest ${limit} emails)`
        );

        for (
          let seq = endSeq;
          seq >= startSeq && processedEmails.length < limit;
          seq--
        ) {
          try {
            this.logger.log(`Processing email sequence ${seq}`);

            // Fetch complete email using fetchOne with source (proven approach)
            const message = await client.fetchOne(seq.toString(), {
              uid: true,
              source: true,
            });

            if (!message || !message.source) {
              this.logger.warn(`No source found for email sequence ${seq}`);
              continue;
            }

            // Parse email using mail-parser (proven reliable)
            const mail = await mailParser.simpleParser(message.source as any);

            this.logger.log(
              `Email parsed successfully - Subject: "${
                mail.subject || '(No Subject)'
              }"`
            );

            // Extract addresses safely
            const extractAddresses = (field: any): string[] => {
              if (!field) return [];
              if (Array.isArray(field)) {
                return field
                  .map((addr: any) => addr.address || '')
                  .filter(Boolean);
              }
              return field.address ? [field.address] : [];
            };

            const fromAddress = extractAddresses(mail.from)[0] || '';

            // Convert mail-parser result to our EmailMessage format
            const emailMessage: EmailMessage = {
              uid: message.uid,
              messageId: mail.messageId || `${message.uid}-${Date.now()}`,
              subject: mail.subject || '(No Subject)',
              from: fromAddress,
              to: extractAddresses(mail.to),
              cc: extractAddresses(mail.cc),
              bcc: extractAddresses(mail.bcc),
              date: mail.date || new Date(),
              bodyText: mail.text ? String(mail.text) : undefined,
              bodyHtml: mail.html ? String(mail.html) : undefined,
              flags: [],
            };

            processedEmails.push(emailMessage);

            this.logger.log(
              `Successfully processed email UID ${message.uid}: "${emailMessage.subject}"`
            );
          } catch (emailError) {
            this.logger.error(
              `Failed to process email sequence ${seq}:`,
              emailError
            );
            // Continue with other emails even if one fails
          }
        }

        this.logger.log(
          `Successfully processed ${processedEmails.length}/${limit} emails in ${Date.now() - startTime}ms`
        );

        return processedEmails;
      } finally {
        mailbox.release();
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch and process emails for account ${accountId}:`,
        error
      );
      throw new HttpException(
        `Failed to fetch and process emails: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get list of folders/mailboxes
   */
  async getFolders(
    accountId: string
  ): Promise<{ name: string; path: string; specialUse?: string }[]> {
    try {
      const client = await this.getConnection(accountId);

      const mailboxes = await client.list();

      return mailboxes.map((mailbox) => ({
        name: mailbox.name,
        path: mailbox.path,
        specialUse: mailbox.specialUse,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get folders for account ${accountId}:`,
        error
      );
      throw new HttpException(
        `Failed to get folders: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Close connection for account
   */
  async closeConnection(accountId: string): Promise<void> {
    const connection = this.connections.get(accountId);
    if (connection) {
      await connection.logout();
      this.connections.delete(accountId);
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const promises = Array.from(this.connections.entries()).map(
      async ([accountId, connection]) => {
        try {
          await connection.logout();
        } catch (error) {
          this.logger.warn(
            `Error closing connection for account ${accountId}:`,
            error
          );
        }
      }
    );

    await Promise.all(promises);
    this.connections.clear();
  }
}

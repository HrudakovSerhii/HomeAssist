import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ProcessingStatus,
  ParsedGmailMessage,
  EmailIngestResult,
  EmailAttachmentCreateInput,
} from '../../types/email.types';

@Injectable()
export class GmailService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly authService: GoogleAuthService, // TODO: Implement Google OAuth service
  ) {}

  /**
   * Get recent emails from Gmail API
   */
  async getRecentEmails(maxResults: number = 10) {
    // TODO: Implement Gmail OAuth and API integration
    throw new Error('Gmail API integration not implemented');
    
    /* Preserved Gmail API logic for future implementation
    try {
      const gmail = google.gmail({
        version: 'v1',
        auth: await this.getAuthenticatedClient(),
      });

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxResults,
      });

      return response.data;
    } catch (error) {
      throw new HttpException(
        `Failed to fetch Gmail messages: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    */
  }

  /**
   * Parse Gmail message format to our email format
   */
  private parseGmailMessage(message: any): ParsedGmailMessage {
    const headers = message.payload.headers;
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
        ?.value || '';

    const subject = getHeader('Subject');
    const fromAddress = getHeader('From');
    const toAddresses = this.parseAddresses(getHeader('To'));
    const ccAddresses = this.parseAddresses(getHeader('Cc'));
    const bccAddresses = this.parseAddresses(getHeader('Bcc'));

    let receivedAt: Date;
    if (message.internalDate) {
      receivedAt = new Date(parseInt(message.internalDate));
      if (isNaN(receivedAt.getTime())) {
        receivedAt = new Date();
      }
    } else {
      receivedAt = new Date();
    }

    const { bodyText, bodyHtml } = this.extractEmailBody(message.payload);
    const attachments = this.extractAttachments(message.payload);

    return {
      subject,
      fromAddress,
      toAddresses,
      ccAddresses,
      bccAddresses,
      receivedAt,
      bodyText,
      bodyHtml,
      attachments,
    };
  }

  /**
   * Parse email addresses from header string
   */
  private parseAddresses(addressString: string): string[] {
    if (!addressString) return [];

    return addressString
      .split(',')
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);
  }

  /**
   * Extract email body from Gmail payload
   */
  private extractEmailBody(payload: any): {
    bodyText?: string;
    bodyHtml?: string;
  } {
    let bodyText: string | undefined;
    let bodyHtml: string | undefined;

    const extractFromPart = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload.body && payload.body.data) {
      if (payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
    } else if (payload.parts) {
      payload.parts.forEach(extractFromPart);
    }

    return { bodyText, bodyHtml };
  }

  /**
   * Extract attachments from Gmail payload
   */
  private extractAttachments(payload: any): Array<EmailAttachmentCreateInput> {
    const attachments: Array<EmailAttachmentCreateInput> = [];

    const extractFromPart = (part: any) => {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          contentType: part.mimeType,
          size: part.body.size || 0,
          filePath: null,
        });
      }

      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload.parts) {
      payload.parts.forEach(extractFromPart);
    }

    return attachments;
  }
} 
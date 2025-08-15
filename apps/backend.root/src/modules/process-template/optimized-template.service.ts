import { Injectable, Logger } from '@nestjs/common';
import { EmailCategory } from '@prisma/client';
import { EmailMessage } from '../../types/email.types';
import { 
  getOptimizedTemplate, 
  estimateTokenCount, 
  OPTIMIZED_GENERAL_TEMPLATE,
  OptimizedTemplate 
} from './templates/optimized-local-llm.template';

@Injectable()
export class OptimizedTemplateService {
  private readonly logger = new Logger(OptimizedTemplateService.name);

  /**
   * Generate optimized prompt for local LLM processing
   * Focuses on minimal token usage while maintaining quality
   */
  generateOptimizedPrompt(
    email: EmailMessage, 
    category: EmailCategory,
    maxContentTokens = 250
  ): {
    prompt: string;
    estimatedTokens: number;
    template: OptimizedTemplate;
  } {
    // Get category-specific optimized template
    const template = getOptimizedTemplate(category);
    
    // Parse and clean email content
    const cleanContent = this.parseEmailContent(email, maxContentTokens);
    
    // Extract metadata for additional context
    const metadata = this.extractEmailMetadata(email);
    
    // Build minimal prompt with placeholders replaced
    let prompt = template.template
      .replace('{{subject}}', this.truncateText(email.subject, 100))
      .replace('{{fromAddress}}', this.extractSenderInfo(email.from, metadata.senderDomain))
      .replace('{{content}}', cleanContent);
    
    // Add urgency context if detected
    if (metadata.urgencyKeywords.length > 0) {
      prompt = prompt.replace(
        'Content: ' + cleanContent,
        `Content: ${cleanContent}\nUrgency indicators: ${metadata.urgencyKeywords.join(', ')}`
      );
    }
    
    const estimatedTokens = estimateTokenCount(template, cleanContent.length);
    
    this.logger.log(
      `Generated optimized prompt for ${category} (${estimatedTokens} tokens estimated)`
    );
    
    return {
      prompt,
      estimatedTokens,
      template
    };
  }

  /**
   * Generate fallback prompt when category is uncertain
   */
  generateFallbackPrompt(email: EmailMessage): {
    prompt: string;
    estimatedTokens: number;
    template: OptimizedTemplate;
  } {
    const cleanContent = this.parseEmailContent(email, 200);
    const template = OPTIMIZED_GENERAL_TEMPLATE;
    
    const prompt = template.template
      .replace('{{subject}}', this.truncateText(email.subject, 80))
      .replace('{{fromAddress}}', this.extractSenderInfo(email.from))
      .replace('{{content}}', cleanContent);
    
    const estimatedTokens = estimateTokenCount(template, cleanContent.length);
    
    this.logger.log(`Generated fallback prompt (${estimatedTokens} tokens estimated)`);
    
    return {
      prompt,
      estimatedTokens,
      template
    };
  }

  /**
   * Get recommended LLM settings for optimized processing
   */
  getOptimizedLLMSettings(): {
    temperature: number;
    maxTokens: number;
    stopSequences: string[];
    repeatPenalty: number;
  } {
    return {
      temperature: 0.1, // Low temperature for consistent structured output
      maxTokens: 150,   // Limit response length
      stopSequences: ['\n\n', '```'], // Stop at natural breaks
      repeatPenalty: 1.1 // Slight penalty to avoid repetition
    };
  }

  /**
   * Parse and clean email content for LLM processing
   */
  private parseEmailContent(email: EmailMessage, maxTokens = 300): string {
    let content = '';
    
    // Prefer plain text over HTML
    if (email.bodyText?.trim()) {
      content = email.bodyText;
    } else if (email.bodyHtml?.trim()) {
      content = this.cleanHtmlContent(email.bodyHtml);
    }
    
    if (!content.trim()) {
      return email.subject || '';
    }
    
    // Clean and optimize content
    content = this.cleanContent(content);
    
    // Truncate to token limit (rough estimation: 1 token ≈ 4 characters)
    const maxChars = maxTokens * 4;
    if (content.length > maxChars) {
      content = this.intelligentTruncate(content, maxChars);
    }
    
    return content;
  }

  /**
   * Clean HTML content and extract meaningful text
   */
  private cleanHtmlContent(html: string): string {
    return html
      // Remove script and style tags completely
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML tags but keep content
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean and normalize text content
   */
  private cleanContent(content: string): string {
    return content
      // Remove excessive whitespace and line breaks
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      // Remove common email signatures and footers
      .replace(/^.*?unsubscribe.*$/gim, '')
      .replace(/^.*?privacy policy.*$/gim, '')
      // Remove tracking URLs (keep domain for context)
      .replace(/https?:\/\/[^\s]+/g, (match) => {
        try {
          const url = new URL(match);
          return url.hostname;
        } catch {
          return '[link]';
        }
      })
      // Clean up whitespace again
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Intelligently truncate content preserving important parts
   */
  private intelligentTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }
    
    // Try to preserve the beginning and important keywords
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 1) {
      // Single sentence, just truncate
      return content.substring(0, maxChars - 3) + '...';
    }
    
    // Keep first sentences that fit within limit
    let result = '';
    for (const sentence of sentences) {
      const potential = result + sentence + '. ';
      if (potential.length <= maxChars - 3) {
        result = potential;
      } else {
        break;
      }
    }
    
    if (result.length === 0) {
      // First sentence too long, truncate it
      result = sentences[0].substring(0, maxChars - 3) + '...';
    } else {
      result = result.trim() + '...';
    }
    
    return result;
  }

  /**
   * Extract key metadata for context
   */
  private extractEmailMetadata(email: EmailMessage): {
    senderDomain: string;
    urgencyKeywords: string[];
  } {
    const senderDomain = email.from.split('@')[1]?.toLowerCase() || '';
    const subject = email.subject.toLowerCase();
    
    const urgencyKeywords = [
      'urgent', 'asap', 'immediately', 'deadline', 'due today',
      'time sensitive', 'action required', 'please confirm'
    ].filter(keyword => 
      subject.includes(keyword) || 
      this.parseEmailContent(email, 100).toLowerCase().includes(keyword)
    );
    
    return {
      senderDomain,
      urgencyKeywords
    };
  }

  /**
   * Extract concise sender information
   */
  private extractSenderInfo(fromAddress: string, domain?: string): string {
    if (domain) {
      return domain;
    }
    
    const parts = fromAddress.split('@');
    if (parts.length === 2) {
      return parts[1]; // Just the domain
    }
    
    return fromAddress.length > 30 ? fromAddress.substring(0, 27) + '...' : fromAddress;
  }

  /**
   * Intelligent text truncation preserving meaning
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to cut at word boundaries
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
} 
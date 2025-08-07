import { Injectable, Logger } from '@nestjs/common';
import { EmailCategory, Priority, ProcessingSchedule } from '@prisma/client';
import { EmailMessage, Email } from '../../types/email.types';
import { EmailProcessingResult, ScoringBreakdown } from '../../types/email-processing.types';

@Injectable()
export class EmailPriorityService {
  private readonly logger = new Logger(EmailPriorityService.name);

  /**
   * Apply user-defined priority rules before LLM processing
   */
  applyUserPriorityPreprocessing(
    email: EmailMessage,
    schedule: ProcessingSchedule
  ): Email {
    const emailWithPriority: Email = { ...email, priorityHints: null };
    
    // Check sender priorities
    const senderPriorities = schedule.senderPriorities as Record<string, Priority>;
    const senderDomain = email.from.split('@')[1];

    if (senderPriorities[email.from] || senderPriorities[senderDomain]) {
      // Add priority hints to email for LLM processing
      emailWithPriority.priorityHints = {
        senderPriority: senderPriorities[email.from] || senderPriorities[senderDomain],
        userConfiguredSender: true,
      };
    }

    // Check email type priorities based on subject/content
    const emailTypePriorities = schedule.emailTypePriorities as Record<EmailCategory, Priority>;
    const detectedType = this.detectEmailType(email);

    if (emailTypePriorities[detectedType]) {
      emailWithPriority.priorityHints = {
        ...emailWithPriority.priorityHints,
        typePriority: emailTypePriorities[detectedType],
        userConfiguredType: true,
      };
    }

    return emailWithPriority;
  }

  /**
   * Apply post-processing priority adjustments based on user configuration
   */
  applyUserPriorityPostprocessing(result: EmailProcessingResult): EmailProcessingResult {
    if (!result.success || !result.data) return result;

    const data = result.data;
    let importanceScore = data.importanceScore || 50;
    let priorityReasoning = data.priorityReasoning || '';

    // Apply user priority overrides
    if (result.originalEmail?.priorityHints?.senderPriority) {
      const overridePriority = result.originalEmail.priorityHints.senderPriority;
      const priorityBoost = this.calculatePriorityBoost(overridePriority);

      importanceScore = Math.min(100, importanceScore + priorityBoost);
      priorityReasoning += ` [User override: +${priorityBoost} for sender priority]`;
    }

    if (result.originalEmail?.priorityHints?.typePriority) {
      const overridePriority = result.originalEmail.priorityHints.typePriority;
      const priorityBoost = this.calculatePriorityBoost(overridePriority);

      importanceScore = Math.min(100, importanceScore + priorityBoost);
      priorityReasoning += ` [User override: +${priorityBoost} for email type]`;
    }

    return {
      ...result,
      data: {
        ...data,
        importanceScore,
        priorityReasoning: priorityReasoning.trim(),
      },
    };
  }

  /**
   * Calculate comprehensive priority score with breakdown
   */
  calculateEnhancedPriorityScore(
    email: EmailMessage,
    schedule: ProcessingSchedule,
    baseAnalysis: any
  ): {
    importance_score: number;
    scoring_breakdown: ScoringBreakdown;
    priority_reasoning: string;
  } {
    let score = 50; // Base score
    const breakdown: ScoringBreakdown = {
      base_score: 50,
      time_sensitivity: 0,
      content_type: 0,
      sender_importance: 0,
      urgency_language: 0,
      user_overrides: 0,
      penalties: 0,
      final_score: 0,
    };

    // Time sensitivity analysis
    const timeBoost = this.calculateTimeSensitivityBoost(email, baseAnalysis);
    score += timeBoost;
    breakdown.time_sensitivity = timeBoost;

    // Content type analysis
    const contentBoost = this.calculateContentTypeBoost(email, baseAnalysis);
    score += contentBoost;
    breakdown.content_type = contentBoost;

    // Sender importance
    const senderBoost = this.calculateSenderImportanceBoost(email, schedule);
    score += senderBoost;
    breakdown.sender_importance = senderBoost;

    // Urgency language detection
    const urgencyBoost = this.calculateUrgencyLanguageBoost(email);
    score += urgencyBoost;
    breakdown.urgency_language = urgencyBoost;

    // User-defined overrides
    const userBoost = this.applyEnhancedUserOverrides(email, schedule, baseAnalysis);
    score += userBoost;
    breakdown.user_overrides = userBoost;

    // Apply penalties
    const penalties = this.calculateEnhancedPenalties(email, baseAnalysis);
    score -= penalties;
    breakdown.penalties = -penalties;

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    breakdown.final_score = score;

    return {
      importance_score: Math.round(score),
      scoring_breakdown: breakdown,
      priority_reasoning: this.generateEnhancedReasoningText(breakdown, email),
    };
  }

  /**
   * Calculate priority boost based on user priority setting
   */
  private calculatePriorityBoost(priority: Priority): number {
    const boosts = {
      URGENT: 30,
      HIGH: 20,
      MEDIUM: 10,
      LOW: 0,
    };

    return boosts[priority] || 0;
  }

  /**
   * Detect email type from content
   */
  private detectEmailType(email: EmailMessage): EmailCategory {
    const subject = email.subject.toLowerCase();
    const content = (email.bodyText || '').toLowerCase();

    if (
      subject.includes('meeting') ||
      subject.includes('appointment') ||
      content.includes('calendar')
    ) {
      return 'APPOINTMENT';
    }

    if (
      subject.includes('invoice') ||
      subject.includes('bill') ||
      subject.includes('payment')
    ) {
      return 'INVOICE';
    }

    // Add more detection logic
    return 'PERSONAL';
  }

  /**
   * Calculate time sensitivity boost
   */
  private calculateTimeSensitivityBoost(email: EmailMessage, analysis: any): number {
    const now = new Date();
    const received = email.date;
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();

    let boost = 0;

    // Check for same-day indicators
    if (content.includes('today') || content.includes('due today')) {
      boost += 40;
    }

    // Check for this week indicators
    if (content.includes('this week') || content.includes('by friday')) {
      boost += 25;
    }

    // Check for next week indicators
    if (content.includes('next week') || content.includes('by next')) {
      boost += 15;
    }

    // Check for overdue indicators
    if (content.includes('overdue') || content.includes('past due')) {
      boost += 45;
    }

    return boost;
  }

  /**
   * Calculate content type importance boost
   */
  private calculateContentTypeBoost(email: EmailMessage, analysis: any): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let boost = 0;

    // Meeting/appointment indicators
    if (
      content.includes('meeting') ||
      content.includes('appointment') ||
      content.includes('calendar') ||
      content.includes('schedule')
    ) {
      boost += 20;
    }

    // Invoice/payment indicators
    if (
      content.includes('invoice') ||
      content.includes('payment') ||
      content.includes('bill') ||
      content.includes('due')
    ) {
      boost += 20;
    }

    // Action required indicators
    if (
      content.includes('action required') ||
      content.includes('please confirm') ||
      content.includes('approval needed')
    ) {
      boost += 15;
    }

    // Reply requested indicators
    if (content.includes('reply') || content.includes('response required')) {
      boost += 10;
    }

    return boost;
  }

  /**
   * Calculate sender importance boost
   */
  private calculateSenderImportanceBoost(
    email: EmailMessage,
    schedule: ProcessingSchedule
  ): number {
    let boost = 0;
    const senderDomain = email.from?.split('@')[1] || '';

    // Check user-defined sender priorities
    const senderPriorities = schedule.senderPriorities || {};
    if (email.from && senderPriorities[email.from]) {
      boost += this.getEnhancedPriorityBoost(senderPriorities[email.from]);
    } else if (senderPriorities[senderDomain]) {
      boost += this.getEnhancedPriorityBoost(senderPriorities[senderDomain]);
    }

    // Work domain detection
    const workDomains = ['.com', '.org', '.edu', '.gov'];
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];

    if (
      workDomains.some((domain) => senderDomain.endsWith(domain)) &&
      !personalDomains.includes(senderDomain)
    ) {
      boost += 15;
    }

    return boost;
  }

  /**
   * Calculate urgency language boost
   */
  private calculateUrgencyLanguageBoost(email: EmailMessage): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let boost = 0;

    // High urgency keywords
    const highUrgencyWords = ['urgent', 'asap', 'immediately', 'emergency'];
    if (highUrgencyWords.some((word) => content.includes(word))) {
      boost += 15;
    }

    // Medium urgency keywords
    const mediumUrgencyWords = ['deadline', 'due today', 'time sensitive'];
    if (mediumUrgencyWords.some((word) => content.includes(word))) {
      boost += 10;
    }

    // Low urgency keywords
    const lowUrgencyWords = ['please confirm', 'response required'];
    if (lowUrgencyWords.some((word) => content.includes(word))) {
      boost += 8;
    }

    return boost;
  }

  /**
   * Apply user-defined priority overrides
   */
  private applyEnhancedUserOverrides(
    email: EmailMessage,
    schedule: ProcessingSchedule,
    analysis: any
  ): number {
    let boost = 0;

    // Check email type priorities
    const emailTypePriorities = schedule.emailTypePriorities || {};
    const detectedCategory = analysis.category;

    if (emailTypePriorities[detectedCategory]) {
      boost += this.getEnhancedPriorityBoost(emailTypePriorities[detectedCategory]);
    }

    return boost;
  }

  /**
   * Calculate penalties for low-priority content
   */
  private calculateEnhancedPenalties(email: EmailMessage, analysis: any): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let penalty = 0;

    // Marketing/promotional penalties
    const marketingKeywords = ['unsubscribe', 'promotional', 'offer', 'deal', 'sale'];
    if (marketingKeywords.some((word) => content.includes(word))) {
      penalty += 25;
    }

    // Automated sender penalties
    if (email.from?.includes('no-reply') || email.from?.includes('noreply')) {
      penalty += 20;
    }

    // Newsletter penalties
    if (content.includes('newsletter') || content.includes('subscription')) {
      penalty += 15;
    }

    // Social media penalties
    const socialKeywords = ['facebook', 'twitter', 'linkedin', 'instagram'];
    if (socialKeywords.some((word) => content.includes(word))) {
      penalty += 10;
    }

    return penalty;
  }

  /**
   * Convert Priority enum to numerical boost
   */
  private getEnhancedPriorityBoost(priority: string): number {
    const boosts = {
      URGENT: 30,
      HIGH: 20,
      MEDIUM: 10,
      LOW: 0,
    };

    return boosts[priority] || 0;
  }

  /**
   * Generate human-readable priority reasoning
   */
  private generateEnhancedReasoningText(
    breakdown: ScoringBreakdown,
    email: EmailMessage
  ): string {
    const parts = [];

    if (breakdown.time_sensitivity > 0) {
      parts.push(`+${breakdown.time_sensitivity} time sensitivity`);
    }

    if (breakdown.content_type > 0) {
      parts.push(`+${breakdown.content_type} content type`);
    }

    if (breakdown.sender_importance > 0) {
      parts.push(`+${breakdown.sender_importance} sender importance`);
    }

    if (breakdown.urgency_language > 0) {
      parts.push(`+${breakdown.urgency_language} urgency language`);
    }

    if (breakdown.user_overrides > 0) {
      parts.push(`+${breakdown.user_overrides} user overrides`);
    }

    if (breakdown.penalties > 0) {
      parts.push(`${breakdown.penalties} penalties`);
    }

    const reasoning =
      parts.length > 0
        ? `Base score ${breakdown.base_score} (${parts.join(', ')}) = ${breakdown.final_score}/100`
        : `Base score ${breakdown.final_score}/100`;

    return reasoning;
  }
} 
# Enhanced Email Processing - LLM Enhancement

## Overview
Enhanced priority scoring and importance assessment using specialized LLM templates with user-configurable preferences.

## Enhanced Priority Analysis Interface

```typescript
// Enhanced priority analysis result
interface EnhancedEmailAnalysis {
  category: EmailCategory;
  priority: Priority;
  importance_score: number; // 0-100
  priority_reasoning: string;
  scoring_breakdown: {
    base_score: number;
    time_sensitivity: number;
    content_type: number;
    sender_importance: number;
    urgency_language: number;
    user_overrides: number;
    penalties: number;
    final_score: number;
  };
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  entities: EntityExtraction[];
  actionItems: ActionItem[];
}
```

## Priority-Focused LLM Template

```typescript
const ENHANCED_PRIORITY_TEMPLATE = `
Analyze this email with comprehensive priority scoring and importance assessment:

IMPORTANCE SCORING RULES (0-100):
- CRITICAL (90-100): Same-day deadlines, overdue payments, emergency situations, urgent meetings
- HIGH (70-89): This week meetings, pending invoices, work deadlines, important decisions needed
- MEDIUM (40-69): General work communications, future appointments, routine business matters
- LOW (0-39): Newsletters, marketing, automated notifications, informational content

PRIORITY CALCULATION FACTORS:
Base Score: 50 (default)

TIME SENSITIVITY BOOSTERS:
- Same day events/deadlines: +40 points
- This week events/deadlines: +25 points  
- Next week events/deadlines: +15 points
- Overdue items: +45 points

CONTENT TYPE BOOSTERS:
- Meeting/appointment invitations: +20 points
- Invoice/payment requests: +20 points
- Action required emails: +15 points
- Reply requested: +10 points

SENDER IMPORTANCE BOOSTERS:
- Work/business domain: +15 points
- Previous high-importance sender: +10 points
- Manager/supervisor: +20 points
- Client/customer: +15 points

URGENCY LANGUAGE BOOSTERS:
- "urgent", "asap", "immediately": +15 points
- "deadline", "due today", "time sensitive": +10 points
- "please confirm", "response required": +8 points

PRIORITY REDUCERS:
- Marketing/promotional: -25 points
- Automated/no-reply senders: -20 points
- Newsletter/subscription: -15 points
- Social media notifications: -10 points

USER PREFERENCES APPLICATION:
{{#if senderPriorities}}
Sender Priority Overrides: {{senderPriorities}}
{{/if}}
{{#if emailTypePriorities}}  
Email Type Priority Overrides: {{emailTypePriorities}}
{{/if}}
{{#if llmFocus}}
Analysis Focus: {{llmFocus}} (adjust scoring emphasis accordingly)
{{/if}}

Email Details:
Subject: {{subject}}
From: {{fromAddress}}
Received: {{receivedAt}}
Content: {{bodyText}}

Return detailed JSON analysis:
{
  "category": "APPOINTMENT",
  "priority": "HIGH",
  "importance_score": 78,
  "priority_reasoning": "Meeting invitation from work colleague for this week (+25 time sensitivity, +20 meeting type, +15 work domain) = 78/100",
  "scoring_breakdown": {
    "base_score": 50,
    "time_sensitivity": 25,
    "content_type": 20,
    "sender_importance": 15,
    "urgency_language": 0,
    "user_overrides": 0,
    "penalties": 0,
    "final_score": 78
  },
  "sentiment": "NEUTRAL",
  "summary": "Team standup meeting scheduled for Thursday 2 PM in Conference Room A - requires calendar booking",
  "tags": ["meeting", "work", "weekly-standup", "high-priority"],
  "confidence": 0.92,
  "actionItems": [
    {
      "actionType": "SCHEDULE_MEETING",
      "description": "Add team standup to calendar for Thursday 2 PM",
      "priority": "HIGH",
      "dueDate": "2024-01-25"
    }
  ]
}
`;
```

## Specialized Focus Templates

### Sentiment-Focused Template

```typescript
const SENTIMENT_FOCUSED_TEMPLATE = `
Analyze this email with enhanced sentiment detection and emotional intelligence:

SENTIMENT ANALYSIS FOCUS:
- Detect emotional undertones and urgency based on language patterns
- Identify frustration, satisfaction, concern, or excitement indicators
- Assess relationship impact and communication tone

SENTIMENT SCORING MODIFIERS:
- Positive sentiment with urgency: Higher priority
- Negative sentiment (complaints): Immediate attention needed  
- Neutral professional: Standard business priority
- Excited/enthusiastic: May indicate opportunities

LANGUAGE PATTERN ANALYSIS:
- Frustration indicators: "disappointed", "unacceptable", "frustrated"
- Urgency indicators: "need immediately", "critical", "emergency"
- Satisfaction indicators: "pleased", "excellent", "satisfied"
- Concern indicators: "worried", "concerned", "issue", "problem"

Email: {{subject}} from {{fromAddress}}
Content: {{bodyText}}

Focus on sentiment-driven priority assessment:
{
  "sentiment": "NEGATIVE",
  "sentiment_details": {
    "primary_emotion": "frustration",
    "intensity": 0.8,
    "indicators": ["disappointed", "unacceptable"],
    "tone": "formal_complaint"
  },
  "importance_score": 85,
  "priority_reasoning": "Negative sentiment (frustration) from client requires immediate attention to prevent relationship damage",
  "priority": "HIGH"
}
`;
```

### Urgency-Focused Template

```typescript
const URGENCY_FOCUSED_TEMPLATE = `
Analyze this email with enhanced urgency detection and time-critical assessment:

URGENCY DETECTION FOCUS:
- Identify time-sensitive keywords and phrases
- Detect deadline proximity and overdue situations
- Assess immediate action requirements

TIME-CRITICAL INDICATORS:
- Explicit deadlines: "due by", "deadline", "expires"
- Immediate action: "urgent", "asap", "immediately", "right away"
- Overdue situations: "overdue", "past due", "missed deadline"
- Same-day events: meetings/calls today, payment due today

URGENCY SCORING ALGORITHM:
- Today's deadlines: 95+ points
- This week deadlines: 80+ points
- Emergency language: +20 points
- Overdue items: +30 points

Email: {{subject}} from {{fromAddress}}
Received: {{receivedAt}}
Content: {{bodyText}}

Focus on time-critical urgency assessment:
{
  "urgency_analysis": {
    "time_criticality": "HIGH",
    "deadline_proximity": "today",
    "urgency_keywords": ["urgent", "deadline today"],
    "action_required": true
  },
  "importance_score": 95,
  "priority_reasoning": "Same-day deadline with urgent language requires immediate action",
  "priority": "URGENT"
}
`;
```

## Template Selection Logic

```typescript
@Injectable()
export class EnhancedTemplateService {
  
  /**
   * Select appropriate template based on user focus preference
   */
  selectTemplateByFocus(focus: string): TemplateConfig {
    const templates = {
      'general': {
        name: 'enhanced-priority',
        template: ENHANCED_PRIORITY_TEMPLATE,
        description: 'Comprehensive priority analysis with scoring breakdown'
      },
      'sentiment': {
        name: 'sentiment-focused',
        template: SENTIMENT_FOCUSED_TEMPLATE,
        description: 'Sentiment-driven priority assessment'
      },
      'urgency': {
        name: 'urgency-focused', 
        template: URGENCY_FOCUSED_TEMPLATE,
        description: 'Time-critical urgency detection'
      }
    };
    
    return templates[focus] || templates['general'];
  }

  /**
   * Generate enhanced prompt with user configuration
   */
  generateEnhancedPrompt(
    email: EmailMessage,
    schedule: ProcessingSchedule,
    templateConfig: TemplateConfig
  ): string {
    let prompt = templateConfig.template;
    
    // Replace email variables
    prompt = prompt.replace(/\{\{subject\}\}/g, email.subject || '');
    prompt = prompt.replace(/\{\{fromAddress\}\}/g, email.from || '');
    prompt = prompt.replace(/\{\{receivedAt\}\}/g, email.date?.toISOString() || '');
    prompt = prompt.replace(/\{\{bodyText\}\}/g, email.bodyText || email.bodyHtml || '');
    
    // Replace user preference variables
    if (schedule.senderPriorities && Object.keys(schedule.senderPriorities).length > 0) {
      const senderConfig = JSON.stringify(schedule.senderPriorities);
      prompt = prompt.replace(/\{\{senderPriorities\}\}/g, senderConfig);
    }
    
    if (schedule.emailTypePriorities && Object.keys(schedule.emailTypePriorities).length > 0) {
      const typeConfig = JSON.stringify(schedule.emailTypePriorities);
      prompt = prompt.replace(/\{\{emailTypePriorities\}\}/g, typeConfig);
    }
    
    if (schedule.llmFocus) {
      prompt = prompt.replace(/\{\{llmFocus\}\}/g, schedule.llmFocus);
    }
    
    return prompt;
  }
}
```

## Priority Scoring Engine

```typescript
@Injectable()
export class PriorityScoreCalculator {
  
  /**
   * Calculate comprehensive priority score with breakdown
   */
  calculatePriorityScore(
    email: EmailMessage,
    schedule: ProcessingSchedule,
    baseAnalysis: any
  ): ScoringBreakdown {
    let score = 50; // Base score
    const breakdown = {
      base_score: 50,
      time_sensitivity: 0,
      content_type: 0,
      sender_importance: 0,
      urgency_language: 0,
      user_overrides: 0,
      penalties: 0,
      final_score: 0
    };
    
    // Time sensitivity analysis
    const timeBoost = this.calculateTimeSensitivity(email, baseAnalysis);
    score += timeBoost;
    breakdown.time_sensitivity = timeBoost;
    
    // Content type analysis
    const contentBoost = this.calculateContentTypeBoost(email, baseAnalysis);
    score += contentBoost;
    breakdown.content_type = contentBoost;
    
    // Sender importance
    const senderBoost = this.calculateSenderImportance(email, schedule);
    score += senderBoost;
    breakdown.sender_importance = senderBoost;
    
    // Urgency language detection
    const urgencyBoost = this.calculateUrgencyLanguage(email);
    score += urgencyBoost;
    breakdown.urgency_language = urgencyBoost;
    
    // User-defined overrides
    const userBoost = this.applyUserOverrides(email, schedule, baseAnalysis);
    score += userBoost;
    breakdown.user_overrides = userBoost;
    
    // Apply penalties
    const penalties = this.calculatePenalties(email, baseAnalysis);
    score -= penalties;
    breakdown.penalties = -penalties;
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    breakdown.final_score = score;
    
    return {
      importance_score: Math.round(score),
      scoring_breakdown: breakdown,
      priority_reasoning: this.generateReasoningText(breakdown, email)
    };
  }

  /**
   * Calculate time sensitivity boost
   */
  private calculateTimeSensitivity(email: EmailMessage, analysis: any): number {
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
    if (content.includes('meeting') || content.includes('appointment') || 
        content.includes('calendar') || content.includes('schedule')) {
      boost += 20;
    }
    
    // Invoice/payment indicators
    if (content.includes('invoice') || content.includes('payment') || 
        content.includes('bill') || content.includes('due')) {
      boost += 20;
    }
    
    // Action required indicators
    if (content.includes('action required') || content.includes('please confirm') ||
        content.includes('approval needed')) {
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
  private calculateSenderImportance(email: EmailMessage, schedule: ProcessingSchedule): number {
    let boost = 0;
    const senderDomain = email.from.split('@')[1] || '';
    
    // Check user-defined sender priorities
    const senderPriorities = schedule.senderPriorities || {};
    if (senderPriorities[email.from]) {
      boost += this.getPriorityBoost(senderPriorities[email.from]);
    } else if (senderPriorities[senderDomain]) {
      boost += this.getPriorityBoost(senderPriorities[senderDomain]);
    }
    
    // Work domain detection
    const workDomains = ['.com', '.org', '.edu', '.gov'];
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
    
    if (workDomains.some(domain => senderDomain.endsWith(domain)) && 
        !personalDomains.includes(senderDomain)) {
      boost += 15;
    }
    
    return boost;
  }

  /**
   * Calculate urgency language boost
   */
  private calculateUrgencyLanguage(email: EmailMessage): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let boost = 0;
    
    // High urgency keywords
    const highUrgencyWords = ['urgent', 'asap', 'immediately', 'emergency'];
    if (highUrgencyWords.some(word => content.includes(word))) {
      boost += 15;
    }
    
    // Medium urgency keywords  
    const mediumUrgencyWords = ['deadline', 'due today', 'time sensitive'];
    if (mediumUrgencyWords.some(word => content.includes(word))) {
      boost += 10;
    }
    
    // Low urgency keywords
    const lowUrgencyWords = ['please confirm', 'response required'];
    if (lowUrgencyWords.some(word => content.includes(word))) {
      boost += 8;
    }
    
    return boost;
  }

  /**
   * Apply user-defined priority overrides
   */
  private applyUserOverrides(
    email: EmailMessage, 
    schedule: ProcessingSchedule, 
    analysis: any
  ): number {
    let boost = 0;
    
    // Check email type priorities
    const emailTypePriorities = schedule.emailTypePriorities || {};
    const detectedCategory = analysis.category;
    
    if (emailTypePriorities[detectedCategory]) {
      boost += this.getPriorityBoost(emailTypePriorities[detectedCategory]);
    }
    
    return boost;
  }

  /**
   * Calculate penalties for low-priority content
   */
  private calculatePenalties(email: EmailMessage, analysis: any): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let penalty = 0;
    
    // Marketing/promotional penalties
    const marketingKeywords = ['unsubscribe', 'promotional', 'offer', 'deal', 'sale'];
    if (marketingKeywords.some(word => content.includes(word))) {
      penalty += 25;
    }
    
    // Automated sender penalties
    if (email.from.includes('no-reply') || email.from.includes('noreply')) {
      penalty += 20;
    }
    
    // Newsletter penalties
    if (content.includes('newsletter') || content.includes('subscription')) {
      penalty += 15;
    }
    
    // Social media penalties
    const socialKeywords = ['facebook', 'twitter', 'linkedin', 'instagram'];
    if (socialKeywords.some(word => content.includes(word))) {
      penalty += 10;
    }
    
    return penalty;
  }

  /**
   * Convert Priority enum to numerical boost
   */
  private getPriorityBoost(priority: string): number {
    const boosts = {
      'URGENT': 30,
      'HIGH': 20,
      'MEDIUM': 10,
      'LOW': 0
    };
    
    return boosts[priority] || 0;
  }

  /**
   * Generate human-readable priority reasoning
   */
  private generateReasoningText(breakdown: ScoringBreakdown, email: EmailMessage): string {
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
    
    const reasoning = parts.length > 0 
      ? `Base score ${breakdown.base_score} (${parts.join(', ')}) = ${breakdown.final_score}/100`
      : `Base score ${breakdown.final_score}/100`;
    
    return reasoning;
  }
}
```

## LLM Response Parser

```typescript
@Injectable()
export class EnhancedLLMResponseParser {
  
  /**
   * Parse enhanced LLM response with comprehensive validation
   */
  async parseEnhancedLLMResponse(
    response: string,
    schedule: ProcessingSchedule
  ): Promise<EnhancedEmailAnalysis> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the response
      return {
        category: this.validateEmailCategory(parsedData.category),
        priority: this.validatePriority(parsedData.priority),
        importance_score: this.validateImportanceScore(parsedData.importance_score),
        priority_reasoning: parsedData.priority_reasoning || 'No reasoning provided',
        scoring_breakdown: this.validateScoringBreakdown(parsedData.scoring_breakdown),
        sentiment: this.validateSentiment(parsedData.sentiment),
        summary: parsedData.summary || 'No summary provided',
        tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
        confidence: Math.max(0, Math.min(1, parsedData.confidence || 0.8)),
        entities: parsedData.entities || [],
        actionItems: parsedData.actionItems || []
      };
      
    } catch (error) {
      console.error('Failed to parse enhanced LLM response:', error);
      
      // Return fallback analysis
      return this.createFallbackAnalysis(response);
    }
  }

  /**
   * Validate importance score is within bounds
   */
  private validateImportanceScore(score: any): number {
    const numScore = Number(score);
    if (isNaN(numScore)) return 50;
    return Math.max(0, Math.min(100, Math.round(numScore)));
  }

  /**
   * Validate scoring breakdown structure
   */
  private validateScoringBreakdown(breakdown: any): ScoringBreakdown {
    if (!breakdown || typeof breakdown !== 'object') {
      return {
        base_score: 50,
        time_sensitivity: 0,
        content_type: 0,
        sender_importance: 0,
        urgency_language: 0,
        user_overrides: 0,
        penalties: 0,
        final_score: 50
      };
    }
    
    return {
      base_score: Number(breakdown.base_score) || 50,
      time_sensitivity: Number(breakdown.time_sensitivity) || 0,
      content_type: Number(breakdown.content_type) || 0,
      sender_importance: Number(breakdown.sender_importance) || 0,
      urgency_language: Number(breakdown.urgency_language) || 0,
      user_overrides: Number(breakdown.user_overrides) || 0,
      penalties: Number(breakdown.penalties) || 0,
      final_score: Number(breakdown.final_score) || 50
    };
  }

  /**
   * Create fallback analysis when parsing fails
   */
  private createFallbackAnalysis(response: string): EnhancedEmailAnalysis {
    return {
      category: EmailCategory.PERSONAL,
      priority: Priority.MEDIUM,
      importance_score: 50,
      priority_reasoning: 'Failed to parse LLM response, using default scoring',
      scoring_breakdown: {
        base_score: 50,
        time_sensitivity: 0,
        content_type: 0,
        sender_importance: 0,
        urgency_language: 0,
        user_overrides: 0,
        penalties: 0,
        final_score: 50
      },
      sentiment: Sentiment.NEUTRAL,
      summary: response.substring(0, 200),
      tags: ['parsing-error'],
      confidence: 0.3,
      entities: [],
      actionItems: []
    };
  }
}
```

---

**Result**: Comprehensive LLM enhancement system with sophisticated priority scoring, user-configurable templates, and detailed reasoning for email importance assessment.

## Implementation Status

### ✅ Stage 1: Database Schema & Core Services (Completed)
- Enhanced database schema with processing schedules, execution tracking, and LLM focus types
- Core processing schedule service with validation and conflict detection
- Execution scheduling service with cron job management
- Template service with enhanced LLM templates and prompt generation

### ✅ Stage 2: Enhanced LLM Services (Completed)
- Integrated enhanced template service methods into main TemplateService with clear ENHANCED comments
- Combined enhanced LLM response parser methods into EmailProcessorService for centralized parsing
- Merged priority score calculator methods into EmailProcessingService for unified priority logic
- Consolidated enhanced template interfaces and definitions into unified email-analysis.template.ts
- Extended base EmailAnalysisTemplate interface with enhanced capabilities for priority, sentiment, and urgency analysis
- Added comprehensive priority scoring with detailed breakdown, time sensitivity, content analysis, and user preferences
- Implemented advanced sentiment analysis with emotional intelligence and relationship impact assessment
- Created time-critical urgency detection with deadline proximity and emergency language processing

### ✅ Stage 3: API Endpoints (Completed)
- Enhanced ProcessingSchedulesController with comprehensive validation using class-validator decorators and ValidationPipe
- Implemented advanced validation for cron expressions, date ranges, and priority configurations with custom Transform decorators
- Added bulk operations (bulk-enable, bulk-disable) with detailed error reporting and Promise.allSettled handling
- Created schedule details endpoint with execution statistics and performance metrics calculation
- Implemented EmailAccountsController for email account management with automatic default schedule creation
- Added account processing statistics endpoint with comprehensive metrics (success rates, execution counts, timing data)
- Extended ScheduleExecutionStatus interface with PENDING status and estimated completion time
- Added CronJobCalendarEntry and EnhancedProcessingAnalytics interfaces for advanced reporting and monitoring
- Included comprehensive error handling, logging, and validation throughout all controller methods

### 🔄 Next Stages:
- **Stage 4**: Error Handling & Resilience (from 5-error-handling.md)
- **Stage 5**: Implementation Timeline & Deployment (from 6-implementation-timeline.md)

**Current System Capabilities**:
- Advanced LLM-powered email analysis with multiple focus templates (general, sentiment, urgency)
- Sophisticated priority scoring with 7-factor breakdown and user customization
- Comprehensive API endpoints with validation, bulk operations, and detailed analytics
- Robust template management with Handlebars-style prompt generation
- Enhanced error handling and fallback mechanisms for LLM parsing failures
- Performance monitoring and execution tracking with detailed statistics 
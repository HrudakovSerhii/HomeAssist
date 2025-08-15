import {
  EmailCategory,
  EntityType,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Base template interface
export interface EmailAnalysisTemplate {
  name: string;
  description: string;
  categories: EmailCategory[];
  template: string;
  expectedOutputSchema: {
    type: 'object';
    required: string[];
    properties: Record<string, any>;
  };
  // Type-safe example response structure
  exampleResponse: {
    category: EmailCategory;
    priority: Priority;
    sentiment: Sentiment;
    summary: string;
    actionItems: Array<{
      actionType: ActionType;
      description: string;
      priority: Priority;
      dueDate?: string;
    }>;
    tags: string[];
    confidence: number;
  };
}

// ============================================================================
// ENHANCED TEMPLATE INTERFACES (from separate enhanced template files)
// ============================================================================

// Enhanced priority analysis template interface
export interface EnhancedPriorityTemplate extends EmailAnalysisTemplate {
  exampleResponse: EmailAnalysisTemplate['exampleResponse'] & {
    importance_score: number;
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
    entities: Array<{
      entityType: EntityType;
      entityValue: string;
      confidence: number;
    }>;
  };
}

// Sentiment-focused template interface
export interface SentimentFocusedTemplate extends EmailAnalysisTemplate {
  exampleResponse: EmailAnalysisTemplate['exampleResponse'] & {
    sentiment_details: {
      primary_emotion: string;
      intensity: number;
      indicators: string[];
      tone: string;
    };
    importance_score: number;
    priority_reasoning: string;
  };
}

// Urgency-focused template interface
export interface UrgencyFocusedTemplate extends EmailAnalysisTemplate {
  exampleResponse: EmailAnalysisTemplate['exampleResponse'] & {
    urgency_analysis: {
      time_criticality: string;
      deadline_proximity: string;
      urgency_keywords: string[];
      action_required: boolean;
    };
    importance_score: number;
    priority_reasoning: string;
  };
}

// Type-safe template definition
export const GENERAL_EMAIL_ANALYSIS_TEMPLATE: EmailAnalysisTemplate = {
  name: 'general-email-analysis',
  description:
    'Streamlined email analysis focusing on category, priority, sentiment, and contextual actions',
  categories: [
    EmailCategory.PERSONAL,
    EmailCategory.WORK,
    EmailCategory.MARKETING,
    EmailCategory.NEWSLETTER,
    EmailCategory.SUPPORT,
    EmailCategory.NOTIFICATION,
    EmailCategory.INVOICE,
    EmailCategory.RECEIPT,
    EmailCategory.APPOINTMENT,
  ],
  template: `Analyze this email and determine:

1. **Category**: Choose exactly one from: ${Object.values(EmailCategory).join(', ')}
2. **Priority**: Choose exactly one from: ${Object.values(Priority).join(', ')}
3. **Sentiment**: Choose exactly one from: ${Object.values(Sentiment).join(', ')}
4. **Summary**: Brief context (max 100 words)
5. **Smart Actions**: Based on category + priority, determine contextual actions

**Smart Action Logic:**
- APPOINTMENT/MEETING + HIGH priority + future date → "add_reminder_to_calendar"
- INVOICE + LOW priority (paid) → "no_action_needed"  
- INVOICE + MEDIUM priority (future payment) → "add_reminder_to_calendar"
- INVOICE + HIGH priority (payment failed/overdue) → "review_required"
- SUPPORT + HIGH priority → "reply_required"
- WORK + HIGH priority → "reply_required" or "review_required"
- MARKETING/NEWSLETTER → "no_action_needed" (unless HIGH priority)

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Respond in JSON format only:
{
  "category": "WORK",
  "priority": "HIGH",
  "sentiment": "NEUTRAL",
  "summary": "Meeting request for project review scheduled for next week",
  "actionItems": [
    {
      "actionType": "REPLY_REQUIRED",
      "description": "Respond to meeting invitation",
      "priority": "HIGH"
    }
  ],
  "tags": ["meeting", "project-review"],
  "confidence": 0.9
}`,

  // Type-safe example response
  exampleResponse: {
    category: EmailCategory.WORK,
    priority: Priority.HIGH,
    sentiment: Sentiment.NEUTRAL,
    summary: 'Meeting request for project review scheduled for next week',
    actionItems: [
      {
        actionType: ActionType.REPLY_REQUIRED,
        description: 'Respond to meeting invitation',
        priority: Priority.HIGH,
      },
    ],
    tags: ['meeting', 'project-review'],
    confidence: 0.9,
  },

  expectedOutputSchema: {
    type: 'object',
    required: ['category', 'priority', 'sentiment', 'summary'],
    properties: {
      category: {
        type: 'string',
        enum: Object.values(EmailCategory),
      },
      priority: {
        type: 'string',
        enum: Object.values(Priority),
      },
      sentiment: {
        type: 'string',
        enum: Object.values(Sentiment),
      },
      summary: { type: 'string', maxLength: 200 },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            actionType: {
              type: 'string',
              enum: Object.values(ActionType),
            },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: Object.values(Priority),
            },
            dueDate: { type: 'string' },
          },
        },
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
};

// ============================================================================
// ENHANCED TEMPLATE DEFINITIONS (from separate enhanced template files)
// ============================================================================

export const ENHANCED_PRIORITY_TEMPLATE: EnhancedPriorityTemplate = {
  name: 'enhanced-priority',
  description: 'Comprehensive priority analysis with scoring breakdown and importance assessment',
  categories: [
    EmailCategory.PERSONAL,
    EmailCategory.WORK,
    EmailCategory.MARKETING,
    EmailCategory.NEWSLETTER,
    EmailCategory.SUPPORT,
    EmailCategory.NOTIFICATION,
    EmailCategory.INVOICE,
    EmailCategory.RECEIPT,
    EmailCategory.APPOINTMENT,
  ],
  template: `Analyze this email with comprehensive priority scoring and importance assessment:

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
  "entities": [
    {
      "entityType": "DATE",
      "entityValue": "Thursday 2 PM",
      "confidence": 0.95
    },
    {
      "entityType": "LOCATION",
      "entityValue": "Conference Room A",
      "confidence": 0.90
    }
  ],
  "actionItems": [
    {
      "actionType": "SCHEDULE_MEETING",
      "description": "Add team standup to calendar for Thursday 2 PM",
      "priority": "HIGH",
      "dueDate": "2024-01-25"
    }
  ]
}`,

  exampleResponse: {
    category: EmailCategory.APPOINTMENT,
    priority: Priority.HIGH,
    sentiment: Sentiment.NEUTRAL,
    summary: "Team standup meeting scheduled for Thursday 2 PM in Conference Room A - requires calendar booking",
    actionItems: [
      {
        actionType: ActionType.SCHEDULE_MEETING,
        description: "Add team standup to calendar for Thursday 2 PM",
        priority: Priority.HIGH,
        dueDate: "2024-01-25"
      }
    ],
    tags: ["meeting", "work", "weekly-standup", "high-priority"],
    confidence: 0.92,
    importance_score: 78,
    priority_reasoning: "Meeting invitation from work colleague for this week (+25 time sensitivity, +20 meeting type, +15 work domain) = 78/100",
    scoring_breakdown: {
      base_score: 50,
      time_sensitivity: 25,
      content_type: 20,
      sender_importance: 15,
      urgency_language: 0,
      user_overrides: 0,
      penalties: 0,
      final_score: 78
    },
    entities: [
      {
        entityType: EntityType.DATE,
        entityValue: "Thursday 2 PM",
        confidence: 0.95
      },
      {
        entityType: EntityType.LOCATION,
        entityValue: "Conference Room A",
        confidence: 0.90
      }
    ]
  },

  expectedOutputSchema: {
    type: 'object',
    required: ['category', 'priority', 'importance_score', 'priority_reasoning', 'scoring_breakdown', 'sentiment', 'summary'],
    properties: {
      category: {
        type: 'string',
        enum: Object.values(EmailCategory),
      },
      priority: {
        type: 'string',
        enum: Object.values(Priority),
      },
      importance_score: {
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
      priority_reasoning: { type: 'string' },
      scoring_breakdown: {
        type: 'object',
        required: ['base_score', 'time_sensitivity', 'content_type', 'sender_importance', 'urgency_language', 'user_overrides', 'penalties', 'final_score'],
        properties: {
          base_score: { type: 'number' },
          time_sensitivity: { type: 'number' },
          content_type: { type: 'number' },
          sender_importance: { type: 'number' },
          urgency_language: { type: 'number' },
          user_overrides: { type: 'number' },
          penalties: { type: 'number' },
          final_score: { type: 'number' },
        },
      },
      sentiment: {
        type: 'string',
        enum: Object.values(Sentiment),
      },
      summary: { type: 'string', maxLength: 200 },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: Object.values(EntityType),
            },
            entityValue: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            actionType: {
              type: 'string',
              enum: Object.values(ActionType),
            },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: Object.values(Priority),
            },
            dueDate: { type: 'string' },
          },
        },
      },
    },
  },
};

export const SENTIMENT_FOCUSED_TEMPLATE: SentimentFocusedTemplate = {
  name: 'sentiment-focused',
  description: 'Sentiment-driven priority assessment with enhanced emotional intelligence',
  categories: [
    EmailCategory.PERSONAL,
    EmailCategory.WORK,
    EmailCategory.MARKETING,
    EmailCategory.NEWSLETTER,
    EmailCategory.SUPPORT,
    EmailCategory.NOTIFICATION,
    EmailCategory.INVOICE,
    EmailCategory.RECEIPT,
    EmailCategory.APPOINTMENT,
  ],
  template: `Analyze this email with enhanced sentiment detection and emotional intelligence:

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

USER PREFERENCES APPLICATION:
{{#if senderPriorities}}
Sender Priority Overrides: {{senderPriorities}}
{{/if}}
{{#if emailTypePriorities}}  
Email Type Priority Overrides: {{emailTypePriorities}}
{{/if}}

Email: {{subject}} from {{fromAddress}}
Content: {{bodyText}}

Focus on sentiment-driven priority assessment:
{
  "category": "SUPPORT",
  "priority": "HIGH",
  "sentiment": "NEGATIVE",
  "sentiment_details": {
    "primary_emotion": "frustration",
    "intensity": 0.8,
    "indicators": ["disappointed", "unacceptable"],
    "tone": "formal_complaint"
  },
  "importance_score": 85,
  "priority_reasoning": "Negative sentiment (frustration) from client requires immediate attention to prevent relationship damage",
  "summary": "Client expressing frustration with service quality and requesting immediate resolution",
  "tags": ["complaint", "client-relationship", "urgent-response"],
  "confidence": 0.9,
  "actionItems": [
    {
      "actionType": "REPLY_REQUIRED",
      "description": "Respond immediately to address client concerns",
      "priority": "HIGH"
    }
  ]
}`,

  exampleResponse: {
    category: EmailCategory.SUPPORT,
    priority: Priority.HIGH,
    sentiment: Sentiment.NEGATIVE,
    summary: "Client expressing frustration with service quality and requesting immediate resolution",
    actionItems: [
      {
        actionType: ActionType.REPLY_REQUIRED,
        description: "Respond immediately to address client concerns",
        priority: Priority.HIGH
      }
    ],
    tags: ["complaint", "client-relationship", "urgent-response"],
    confidence: 0.9,
    sentiment_details: {
      primary_emotion: "frustration",
      intensity: 0.8,
      indicators: ["disappointed", "unacceptable"],
      tone: "formal_complaint"
    },
    importance_score: 85,
    priority_reasoning: "Negative sentiment (frustration) from client requires immediate attention to prevent relationship damage"
  },

  expectedOutputSchema: {
    type: 'object',
    required: ['category', 'priority', 'sentiment', 'sentiment_details', 'importance_score', 'priority_reasoning'],
    properties: {
      category: {
        type: 'string',
        enum: Object.values(EmailCategory),
      },
      priority: {
        type: 'string',
        enum: Object.values(Priority),
      },
      sentiment: {
        type: 'string',
        enum: Object.values(Sentiment),
      },
      sentiment_details: {
        type: 'object',
        required: ['primary_emotion', 'intensity', 'indicators', 'tone'],
        properties: {
          primary_emotion: { type: 'string' },
          intensity: { type: 'number', minimum: 0, maximum: 1 },
          indicators: {
            type: 'array',
            items: { type: 'string' },
          },
          tone: { type: 'string' },
        },
      },
      importance_score: {
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
      priority_reasoning: { type: 'string' },
      summary: { type: 'string', maxLength: 200 },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            actionType: {
              type: 'string',
              enum: Object.values(ActionType),
            },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: Object.values(Priority),
            },
          },
        },
      },
    },
  },
};

export const URGENCY_FOCUSED_TEMPLATE: UrgencyFocusedTemplate = {
  name: 'urgency-focused',
  description: 'Time-critical urgency detection with enhanced deadline proximity assessment',
  categories: [
    EmailCategory.PERSONAL,
    EmailCategory.WORK,
    EmailCategory.MARKETING,
    EmailCategory.NEWSLETTER,
    EmailCategory.SUPPORT,
    EmailCategory.NOTIFICATION,
    EmailCategory.INVOICE,
    EmailCategory.RECEIPT,
    EmailCategory.APPOINTMENT,
  ],
  template: `Analyze this email with enhanced urgency detection and time-critical assessment:

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

USER PREFERENCES APPLICATION:
{{#if senderPriorities}}
Sender Priority Overrides: {{senderPriorities}}
{{/if}}
{{#if emailTypePriorities}}  
Email Type Priority Overrides: {{emailTypePriorities}}
{{/if}}

Email: {{subject}} from {{fromAddress}}
Received: {{receivedAt}}
Content: {{bodyText}}

Focus on time-critical urgency assessment:
{
  "category": "INVOICE",
  "priority": "URGENT",
  "urgency_analysis": {
    "time_criticality": "HIGH",
    "deadline_proximity": "today",
    "urgency_keywords": ["urgent", "deadline today"],
    "action_required": true
  },
  "importance_score": 95,
  "priority_reasoning": "Same-day deadline with urgent language requires immediate action",
  "summary": "Payment deadline today with urgent reminder - immediate action required",
  "tags": ["urgent", "deadline-today", "payment-due"],
  "confidence": 0.95,
  "actionItems": [
    {
      "actionType": "PAYMENT_DUE",
      "description": "Process payment immediately to avoid late fees",
      "priority": "URGENT"
    }
  ]
}`,

  exampleResponse: {
    category: EmailCategory.INVOICE,
    priority: Priority.URGENT,
    sentiment: Sentiment.NEUTRAL,
    summary: "Payment deadline today with urgent reminder - immediate action required",
    actionItems: [
      {
        actionType: ActionType.PAYMENT_DUE,
        description: "Process payment immediately to avoid late fees",
        priority: Priority.URGENT
      }
    ],
    tags: ["urgent", "deadline-today", "payment-due"],
    confidence: 0.95,
    urgency_analysis: {
      time_criticality: "HIGH",
      deadline_proximity: "today",
      urgency_keywords: ["urgent", "deadline today"],
      action_required: true
    },
    importance_score: 95,
    priority_reasoning: "Same-day deadline with urgent language requires immediate action"
  },

  expectedOutputSchema: {
    type: 'object',
    required: ['category', 'priority', 'urgency_analysis', 'importance_score', 'priority_reasoning'],
    properties: {
      category: {
        type: 'string',
        enum: Object.values(EmailCategory),
      },
      priority: {
        type: 'string',
        enum: Object.values(Priority),
      },
      urgency_analysis: {
        type: 'object',
        required: ['time_criticality', 'deadline_proximity', 'urgency_keywords', 'action_required'],
        properties: {
          time_criticality: { type: 'string' },
          deadline_proximity: { type: 'string' },
          urgency_keywords: {
            type: 'array',
            items: { type: 'string' },
          },
          action_required: { type: 'boolean' },
        },
      },
      importance_score: {
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
      priority_reasoning: { type: 'string' },
      summary: { type: 'string', maxLength: 200 },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            actionType: {
              type: 'string',
              enum: Object.values(ActionType),
            },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: Object.values(Priority),
            },
          },
        },
      },
    },
  },
};

import {
  EmailCategory,
  EntityType,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Enhanced priority analysis template interface
export interface EnhancedPriorityTemplate {
  name: string;
  description: string;
  categories: EmailCategory[];
  template: string;
  expectedOutputSchema: {
    type: 'object';
    required: string[];
    properties: Record<string, any>;
  };
  exampleResponse: {
    category: EmailCategory;
    priority: Priority;
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
    sentiment: Sentiment;
    summary: string;
    tags: string[];
    confidence: number;
    entities: Array<{
      entityType: EntityType;
      entityValue: string;
      confidence: number;
    }>;
    actionItems: Array<{
      actionType: ActionType;
      description: string;
      priority: Priority;
      dueDate?: string;
    }>;
  };
}

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
    sentiment: Sentiment.NEUTRAL,
    summary: "Team standup meeting scheduled for Thursday 2 PM in Conference Room A - requires calendar booking",
    tags: ["meeting", "work", "weekly-standup", "high-priority"],
    confidence: 0.92,
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
    ],
    actionItems: [
      {
        actionType: ActionType.SCHEDULE_MEETING,
        description: "Add team standup to calendar for Thursday 2 PM",
        priority: Priority.HIGH,
        dueDate: "2024-01-25"
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
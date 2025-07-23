import {
  EmailCategory,
  EntityType,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Type-safe template interface
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

import {
  EmailCategory,
  EntityType,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Urgency-focused template interface
export interface UrgencyFocusedTemplate {
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
    urgency_analysis: {
      time_criticality: string;
      deadline_proximity: string;
      urgency_keywords: string[];
      action_required: boolean;
    };
    importance_score: number;
    priority_reasoning: string;
    summary: string;
    tags: string[];
    confidence: number;
    actionItems: Array<{
      actionType: ActionType;
      description: string;
      priority: Priority;
    }>;
  };
}

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
    urgency_analysis: {
      time_criticality: "HIGH",
      deadline_proximity: "today",
      urgency_keywords: ["urgent", "deadline today"],
      action_required: true
    },
    importance_score: 95,
    priority_reasoning: "Same-day deadline with urgent language requires immediate action",
    summary: "Payment deadline today with urgent reminder - immediate action required",
    tags: ["urgent", "deadline-today", "payment-due"],
    confidence: 0.95,
    actionItems: [
      {
        actionType: ActionType.PAYMENT_DUE,
        description: "Process payment immediately to avoid late fees",
        priority: Priority.URGENT
      }
    ]
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
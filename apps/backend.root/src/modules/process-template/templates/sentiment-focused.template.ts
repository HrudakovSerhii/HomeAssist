import {
  EmailCategory,
  EntityType,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Sentiment-focused template interface
export interface SentimentFocusedTemplate {
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
    sentiment: Sentiment;
    sentiment_details: {
      primary_emotion: string;
      intensity: number;
      indicators: string[];
      tone: string;
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
    sentiment_details: {
      primary_emotion: "frustration",
      intensity: 0.8,
      indicators: ["disappointed", "unacceptable"],
      tone: "formal_complaint"
    },
    importance_score: 85,
    priority_reasoning: "Negative sentiment (frustration) from client requires immediate attention to prevent relationship damage",
    summary: "Client expressing frustration with service quality and requesting immediate resolution",
    tags: ["complaint", "client-relationship", "urgent-response"],
    confidence: 0.9,
    actionItems: [
      {
        actionType: ActionType.REPLY_REQUIRED,
        description: "Respond immediately to address client concerns",
        priority: Priority.HIGH
      }
    ]
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
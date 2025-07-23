import {
  EmailCategory,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Type-safe template interface
export interface MarketingProcessorTemplate {
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

export const MARKETING_PROCESSOR_TEMPLATE: MarketingProcessorTemplate = {
  name: 'marketing-processor',
  description: 'Specialized processor for promotional emails, marketing campaigns, and commercial communications',
  categories: [EmailCategory.MARKETING, EmailCategory.NEWSLETTER],
  template: `Analyze this marketing/promotional email focusing on offer value and unsubscribe decisions:

1. **Category**: Must be ${EmailCategory.MARKETING} or ${EmailCategory.NEWSLETTER}
2. **Priority**: Based on offer relevance, value, and time sensitivity
3. **Sentiment**: Usually ${Sentiment.POSITIVE} for offers, ${Sentiment.NEUTRAL} for newsletters
4. **Summary**: Include offer details, brand, value proposition (max 100 words)
5. **Smart Marketing Actions**:

**Marketing Action Logic:**
- IRRELEVANT/SPAM emails → "archive" (LOW priority)
- FREQUENT unwanted emails → "archive" but consider unsubscribing (LOW priority)
- VALUABLE limited-time offers → "view_link" (HIGH priority)
- INTERESTING promotions → "view_link" or "follow_up" (MEDIUM priority)
- REGULAR newsletters from trusted brands → "archive" (LOW priority)

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Respond in JSON format only:
{
  "category": "MARKETING",
  "priority": "MEDIUM",
  "sentiment": "POSITIVE",
  "summary": "Adobe Creative Suite 40% off flash sale ending tonight, includes Photoshop, Illustrator, and Premier Pro",
  "actionItems": [
    {
      "actionType": "VIEW_LINK",
      "description": "Review Adobe discount offer - expires tonight",
      "priority": "MEDIUM"
    }
  ],
  "tags": ["software-deal", "adobe", "flash-sale", "expires-today"],
  "confidence": 0.9
}`,

  exampleResponse: {
    category: EmailCategory.MARKETING,
    priority: Priority.MEDIUM,
    sentiment: Sentiment.POSITIVE,
    summary: 'Adobe Creative Suite 40% off flash sale ending tonight, includes Photoshop, Illustrator, and Premier Pro',
    actionItems: [
      {
        actionType: ActionType.VIEW_LINK,
        description: 'Review Adobe discount offer - expires tonight',
        priority: Priority.MEDIUM,
      },
    ],
    tags: ['software-deal', 'adobe', 'flash-sale', 'expires-today'],
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
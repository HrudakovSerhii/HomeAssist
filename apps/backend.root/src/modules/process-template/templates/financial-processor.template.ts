import {
  EmailCategory,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Type-safe template interface
export interface FinancialProcessorTemplate {
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

export const FINANCIAL_PROCESSOR_TEMPLATE: FinancialProcessorTemplate = {
  name: 'financial-processor',
  description: 'Specialized processor for financial news, market updates, and investment-related emails',
  categories: [EmailCategory.NEWSLETTER, EmailCategory.NOTIFICATION, EmailCategory.WORK],
  template: `Analyze this financial/investment email focusing on market relevance and action needs:

1. **Category**: Choose from ${EmailCategory.NEWSLETTER}, ${EmailCategory.NOTIFICATION}, or ${EmailCategory.WORK}
2. **Priority**: Based on market impact, urgency, and portfolio relevance
3. **Sentiment**: Reflect market tone - ${Object.values(Sentiment).join(', ')}
4. **Summary**: Include key financial data, market movements, investment implications (max 100 words)
5. **Smart Financial Actions**:

**Financial Action Logic:**
- URGENT market alerts/crashes → "call" or "review_document" (URGENT priority)
- IMPORTANT earnings/news → "review_document" (HIGH priority)
- REGULAR market updates → "archive" or "follow_up" (MEDIUM priority)
- PROMOTIONAL investment offers → "archive" (LOW priority)
- ACCOUNT statements/notifications → "save_invoice" (MEDIUM priority)

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Respond in JSON format only:
{
  "category": "NEWSLETTER",
  "priority": "HIGH",
  "sentiment": "NEGATIVE",
  "summary": "Market alert: Tech stocks down 5% after earnings miss, AAPL and GOOGL leading decline",
  "actionItems": [
    {
      "actionType": "REVIEW_DOCUMENT",
      "description": "Review market impact on tech portfolio holdings",
      "priority": "HIGH"
    }
  ],
  "tags": ["market-alert", "tech-stocks", "earnings"],
  "confidence": 0.9
}`,

  exampleResponse: {
    category: EmailCategory.NEWSLETTER,
    priority: Priority.HIGH,
    sentiment: Sentiment.NEGATIVE,
    summary: 'Market alert: Tech stocks down 5% after earnings miss, AAPL and GOOGL leading decline',
    actionItems: [
      {
        actionType: ActionType.REVIEW_DOCUMENT,
        description: 'Review market impact on tech portfolio holdings',
        priority: Priority.HIGH,
      },
    ],
    tags: ['market-alert', 'tech-stocks', 'earnings'],
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
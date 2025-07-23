import {
  EmailCategory,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Type-safe template interface
export interface NewsProcessorTemplate {
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

export const NEWS_PROCESSOR_TEMPLATE: NewsProcessorTemplate = {
  name: 'news-processor',
  description: 'Specialized processor for news articles, industry updates, and informational newsletters',
  categories: [EmailCategory.NEWSLETTER, EmailCategory.NOTIFICATION, EmailCategory.WORK],
  template: `Analyze this news/newsletter email focusing on information value and sharing potential:

1. **Category**: Choose from ${EmailCategory.NEWSLETTER}, ${EmailCategory.NOTIFICATION}, or ${EmailCategory.WORK}
2. **Priority**: Based on news relevance, timeliness, and professional impact
3. **Sentiment**: Reflect news tone - ${Object.values(Sentiment).join(', ')}
4. **Summary**: Include key topics, implications, and relevance to work/interests (max 100 words)
5. **Smart News Actions**:

**News Action Logic:**
- BREAKING news/urgent industry updates → "forward" or "view_link" (URGENT priority)
- IMPORTANT industry insights → "view_link" or "forward" (HIGH priority)
- REGULAR newsletters/updates → "view_link" or "archive" (MEDIUM priority)
- OUTDATED or irrelevant news → "archive" (LOW priority)
- VALUABLE resources/articles → "follow_up" for later reading (MEDIUM priority)

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Respond in JSON format only:
{
  "category": "NEWSLETTER",
  "priority": "HIGH",
  "sentiment": "NEUTRAL",
  "summary": "TechCrunch newsletter covering AI breakthrough in healthcare diagnostics and major funding rounds in fintech",
  "actionItems": [
    {
      "actionType": "VIEW_LINK",
      "description": "Read AI healthcare article - relevant to current projects",
      "priority": "HIGH"
    },
    {
      "actionType": "FORWARD",
      "description": "Share fintech funding insights with strategy team",
      "priority": "MEDIUM"
    }
  ],
  "tags": ["tech-news", "ai", "healthcare", "fintech"],
  "confidence": 0.9
}`,

  exampleResponse: {
    category: EmailCategory.NEWSLETTER,
    priority: Priority.HIGH,
    sentiment: Sentiment.NEUTRAL,
    summary: 'TechCrunch newsletter covering AI breakthrough in healthcare diagnostics and major funding rounds in fintech',
    actionItems: [
      {
        actionType: ActionType.VIEW_LINK,
        description: 'Read AI healthcare article - relevant to current projects',
        priority: Priority.HIGH,
      },
      {
        actionType: ActionType.FORWARD,
        description: 'Share fintech funding insights with strategy team',
        priority: Priority.MEDIUM,
      },
    ],
    tags: ['tech-news', 'ai', 'healthcare', 'fintech'],
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
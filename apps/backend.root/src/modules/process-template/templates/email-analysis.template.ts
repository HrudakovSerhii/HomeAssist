import { 
  EmailCategory, 
  EntityType, 
  ActionType, 
  Priority, 
  Sentiment 
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
    entities: Array<{
      type: EntityType;
      value: string | string[];
      confidence: number;
      context?: string;
    }>;
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
    'General purpose email analysis for categorization, priority, sentiment, and entity extraction',
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
  template: `Analyze the following email and extract:
1. Category (${Object.values(EmailCategory).join(', ')})
2. Priority level (${Object.values(Priority).join(', ')})
3. Sentiment (${Object.values(Sentiment).join(', ')})
4. Key entities (${Object.values(EntityType).join(', ')})
5. Action items or tasks mentioned (${Object.values(ActionType).join(', ')})
6. Brief summary

Email Subject: {{subject}}
From: {{fromAddress}}
Email Content: {{bodyText}}

ENTITY VALUE RULES:
- DATE_RANGE: Provide as array of 2 dates: ["start_date", "end_date"]
- URL: Provide as array if multiple URLs: ["url1", "url2"] or single string if one URL
- TECHNOLOGY: Provide as array if multiple technologies: ["React", "Node.js"] or single string if one
- PRODUCT: Provide as array if multiple products: ["Product A", "Product B"] or single string if one
- PHONE_NUMBER: Provide as array if multiple numbers: ["+1234567890", "+0987654321"] or single string if one
- EMAIL_ADDRESS: Provide as array if multiple emails: ["email1@example.com", "email2@example.com"] or single string if one
- All other entity types: Provide as single string value

Respond in JSON format only:
{
  "category": "WORK",
  "priority": "MEDIUM", 
  "sentiment": "NEUTRAL",
  "summary": "Brief summary of email content and purpose",
  "entities": [
    {"type": "PERSON", "value": "John Doe", "confidence": 0.9},
    {"type": "ORGANIZATION", "value": "Company Name", "confidence": 0.8},
    {"type": "DATE", "value": "2024-01-15", "confidence": 0.9},
    {"type": "DATE_RANGE", "value": ["2024-01-15", "2024-01-30"], "confidence": 0.9},
    {"type": "URL", "value": ["https://example.com", "https://docs.example.com"], "confidence": 0.85},
    {"type": "TECHNOLOGY", "value": ["React", "Node.js", "TypeScript"], "confidence": 0.9},
    {"type": "AMOUNT", "value": "$99.99", "confidence": 0.95}
  ],
  "actionItems": [
    {
      "actionType": "REPLY_REQUIRED",
      "description": "Respond to meeting invitation",
      "priority": "HIGH"
    },
    {
      "actionType": "VIEW_LINK",
      "description": "Review the attached documentation",
      "priority": "MEDIUM"
    }
  ],
  "tags": ["meeting", "urgent", "response-needed"],
  "confidence": 0.85
}`,
  
  // Type-safe example response
  exampleResponse: {
    category: EmailCategory.WORK,
    priority: Priority.MEDIUM,
    sentiment: Sentiment.NEUTRAL,
    summary: "Brief summary of email content and purpose",
    entities: [
      { type: EntityType.PERSON, value: "John Doe", confidence: 0.9 },
      { type: EntityType.ORGANIZATION, value: "Company Name", confidence: 0.8 },
      { type: EntityType.DATE, value: "2024-01-15", confidence: 0.9 },
      { type: EntityType.DATE_RANGE, value: ["2024-01-15", "2024-01-30"], confidence: 0.9 },
      { type: EntityType.URL, value: ["https://example.com", "https://docs.example.com"], confidence: 0.85 },
      { type: EntityType.TECHNOLOGY, value: ["React", "Node.js", "TypeScript"], confidence: 0.9 },
      { type: EntityType.AMOUNT, value: "$99.99", confidence: 0.95 }
    ],
    actionItems: [
      {
        actionType: ActionType.REPLY_REQUIRED,
        description: "Respond to meeting invitation",
        priority: Priority.HIGH
      }
    ],
    tags: ["meeting", "urgent", "response-needed"],
    confidence: 0.85
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
      summary: { type: 'string', maxLength: 500 },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { 
              type: 'string',
              enum: Object.values(EntityType)
            },
            value: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            context: { type: 'string' },
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
              enum: Object.values(ActionType)
            },
            description: { type: 'string' },
            priority: { 
              type: 'string',
              enum: Object.values(Priority)
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

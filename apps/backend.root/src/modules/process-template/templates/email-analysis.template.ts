import { EmailCategory } from '.prisma/client';

export const GENERAL_EMAIL_ANALYSIS_TEMPLATE = {
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
1. Category (PERSONAL, WORK, MARKETING, NEWSLETTER, SUPPORT, NOTIFICATION, INVOICE, RECEIPT, APPOINTMENT)
2. Priority level (LOW, MEDIUM, HIGH, URGENT)
3. Sentiment (POSITIVE, NEGATIVE, NEUTRAL, MIXED)
4. Key entities (people, organizations, dates, amounts, products)
5. Action items or tasks mentioned
6. Brief summary

Email Subject: {{subject}}
From: {{fromAddress}}
Email Content: {{bodyText}}

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
    {"type": "AMOUNT", "value": "$99.99", "confidence": 0.95}
  ],
  "actionItems": [
    {
      "actionType": "REPLY_REQUIRED",
      "description": "Respond to meeting invitation",
      "priority": "HIGH"
    }
  ],
  "tags": ["meeting", "urgent", "response-needed"],
  "confidence": 0.85
}

Use rules when:
If 'entities' array item value is multiple strings - combine them together.
`,

  expectedOutputSchema: {
    type: 'object',
    required: ['category', 'priority', 'sentiment', 'summary'],
    properties: {
      category: {
        type: 'string',
        enum: [
          'PERSONAL',
          'WORK',
          'MARKETING',
          'NEWSLETTER',
          'SUPPORT',
          'NOTIFICATION',
          'INVOICE',
          'RECEIPT',
          'APPOINTMENT',
        ],
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      },
      sentiment: {
        type: 'string',
        enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'],
      },
      summary: { type: 'string', maxLength: 500 },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
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
            actionType: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string' },
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

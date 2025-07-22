import { EmailCategory } from '../../../types/email.types';

export const INVOICE_PROCESSOR_TEMPLATE = {
  name: 'invoice-processor',
  description: 'Specialized processor for invoice and receipt emails',
  categories: [EmailCategory.INVOICE, EmailCategory.RECEIPT],
  template: `Analyze this invoice/receipt email and extract financial information:

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Extract the following information in JSON format:
{
  "category": "INVOICE",
  "priority": "MEDIUM",
  "sentiment": "NEUTRAL",
  "summary": "Brief description of the invoice/receipt with key details",
  "entities": [
    {"type": "AMOUNT", "value": "$99.99", "confidence": 0.9},
    {"type": "ORGANIZATION", "value": "Apple Inc.", "confidence": 0.9},
    {"type": "PRODUCT", "value": "Apple Music Subscription", "confidence": 0.8},
    {"type": "DATE", "value": "2024-01-15", "confidence": 0.9}
  ],
  "actionItems": [
    {
      "actionType": "SAVE_INVOICE",
      "description": "Save invoice to accounting system",
      "priority": "MEDIUM"
    }
  ],
  "tags": ["finance", "invoice", "billing"],
  "confidence": 0.9
}`,
  expectedOutputSchema: {
    type: 'object',
    required: ['category', 'priority', 'sentiment', 'summary'],
    properties: {
      category: { 
        type: 'string',
        enum: ['PERSONAL', 'WORK', 'MARKETING', 'NEWSLETTER', 'SUPPORT', 'NOTIFICATION', 'INVOICE', 'RECEIPT', 'APPOINTMENT']
      },
      priority: { 
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
      },
      sentiment: { 
        type: 'string',
        enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED']
      },
      summary: { type: 'string', maxLength: 500 },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            value: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            actionType: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string' }
          }
        }
      },
      tags: {
        type: 'array',
        items: { type: 'string' }
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 }
    }
  }
}; 
import { EmailCategory } from '../../../types/email.types';

export const MEETING_PROCESSOR_TEMPLATE = {
  name: 'meeting-processor',
  description: 'Specialized processor for meeting and appointment emails',
  categories: [EmailCategory.APPOINTMENT, EmailCategory.WORK],
  template: `Analyze this meeting/appointment email and extract scheduling information:

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Extract the following information in JSON format:
{
  "category": "APPOINTMENT",
  "priority": "HIGH",
  "sentiment": "NEUTRAL",
  "summary": "Meeting summary with key details and participants",
  "entities": [
    {"type": "DATE", "value": "2024-01-20", "confidence": 0.9},
    {"type": "TIME", "value": "2:00 PM", "confidence": 0.9},
    {"type": "PERSON", "value": "John Smith", "confidence": 0.8},
    {"type": "LOCATION", "value": "Conference Room A", "confidence": 0.7}
  ],
  "actionItems": [
    {
      "actionType": "SCHEDULE_MEETING",
      "description": "Add meeting to calendar",
      "priority": "HIGH"
    }
  ],
  "tags": ["meeting", "calendar", "appointment"],
  "confidence": 0.85
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
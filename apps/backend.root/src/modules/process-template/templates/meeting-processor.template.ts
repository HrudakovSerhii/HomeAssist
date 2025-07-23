import {
  EmailCategory,
  ActionType,
  Priority,
  Sentiment,
} from '@prisma/client';

// Type-safe template interface
export interface MeetingProcessorTemplate {
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

export const MEETING_PROCESSOR_TEMPLATE: MeetingProcessorTemplate = {
  name: 'meeting-processor',
  description: 'Specialized processor for meeting and appointment emails with scheduling-focused analysis',
  categories: [EmailCategory.APPOINTMENT, EmailCategory.WORK],
  template: `Analyze this meeting/appointment email focusing on scheduling and preparation needs:

1. **Category**: Must be ${EmailCategory.APPOINTMENT} or ${EmailCategory.WORK}
2. **Priority**: Based on meeting urgency, attendees, and timeline
3. **Sentiment**: Usually ${Sentiment.NEUTRAL} or ${Sentiment.POSITIVE} for meetings
4. **Summary**: Include date, time, attendees, topic, location (max 100 words)
5. **Smart Scheduling Actions**:

**Meeting Action Logic:**
- CONFIRMED meetings → "schedule_meeting" (MEDIUM priority)
- URGENT meetings (same day/tomorrow) → "schedule_meeting" + "reply_required" (HIGH/URGENT priority)
- TENTATIVE invitations → "reply_required" (HIGH priority)
- CANCELLED meetings → "archive" (LOW priority)
- RESCHEDULING requests → "reply_required" (HIGH priority)

Email Subject: {{subject}}
From: {{fromAddress}}
Content: {{bodyText}}

Respond in JSON format only:
{
  "category": "APPOINTMENT",
  "priority": "HIGH",
  "sentiment": "POSITIVE",
  "summary": "Project kickoff meeting scheduled for January 25th at 2:00 PM with development team in Conference Room A",
  "actionItems": [
    {
      "actionType": "SCHEDULE_MEETING",
      "description": "Add team meeting to calendar",
      "priority": "HIGH",
      "dueDate": "2024-01-25"
    },
    {
      "actionType": "REPLY_REQUIRED",
      "description": "Confirm attendance for project kickoff",
      "priority": "HIGH"
    }
  ],
  "tags": ["meeting", "project-kickoff", "team"],
  "confidence": 0.9
}`,

  exampleResponse: {
    category: EmailCategory.APPOINTMENT,
    priority: Priority.HIGH,
    sentiment: Sentiment.POSITIVE,
    summary: 'Project kickoff meeting scheduled for January 25th at 2:00 PM with development team in Conference Room A',
    actionItems: [
      {
        actionType: ActionType.SCHEDULE_MEETING,
        description: 'Add team meeting to calendar',
        priority: Priority.HIGH,
        dueDate: '2024-01-25',
      },
      {
        actionType: ActionType.REPLY_REQUIRED,
        description: 'Confirm attendance for project kickoff',
        priority: Priority.HIGH,
      },
    ],
    tags: ['meeting', 'project-kickoff', 'team'],
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
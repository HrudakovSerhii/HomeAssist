import { EmailCategory } from '@prisma/client';

// Category descriptions with multiple variations for better matching
export const CATEGORY_DESCRIPTIONS = {
  [EmailCategory.NEWSLETTER]: [
    'newsletter subscription weekly monthly updates',
    'mailing list communication regular updates',
    'subscribe unsubscribe newsletter content',
    'weekly digest monthly summary newsletter',
    'publication newsletter subscription content'
  ],
  [EmailCategory.INVOICE]: [
    'invoice payment due bill receipt',
    'payment request billing statement',
    'overdue payment failed transaction',
    'invoice due payment required',
    'billing invoice payment reminder'
  ],
  [EmailCategory.SUPPORT]: [
    'help support assistance troubleshooting',
    'customer service technical support',
    'solution fix resolve problem',
    'help desk support request',
    'technical assistance customer help'
  ],
  [EmailCategory.WORK]: [
    'work business meeting project',
    'office colleague team collaboration',
    'business communication work related',
    'professional work office business',
    'company work team project'
  ],
  [EmailCategory.PERSONAL]: [
    'personal private family friends',
    'personal communication family matters',
    'private personal individual message',
    'family friends personal life',
    'personal private correspondence'
  ],
  [EmailCategory.MARKETING]: [
    'marketing promotion sale discount',
    'promotional offer marketing campaign',
    'advertisement marketing promotion',
    'sale promotion marketing offer',
    'commercial marketing advertising'
  ],
  [EmailCategory.NOTIFICATION]: [
    'notification alert system message',
    'automated notification system alert',
    'system notification automated message',
    'alert notification system update',
    'automatic notification system message'
  ],
  [EmailCategory.RECEIPT]: [
    'receipt purchase confirmation order',
    'order confirmation receipt purchase',
    'transaction receipt purchase confirmation',
    'purchase receipt order confirmation',
    'payment receipt transaction confirmation'
  ],
  [EmailCategory.APPOINTMENT]: [
    'appointment meeting schedule calendar',
    'meeting appointment calendar event',
    'schedule appointment meeting time',
    'calendar appointment meeting schedule',
    'appointment booking meeting schedule'
  ]
};

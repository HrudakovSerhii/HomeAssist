import { EmailCategory, Priority, Sentiment, ActionType } from '@prisma/client';

// Base interface for optimized templates
export interface OptimizedTemplate {
  name: string;
  description: string;
  category: EmailCategory;
  template: string;
  maxTokens: number; // Estimated token count for the template
}

// ============================================================================
// OPTIMIZED TEMPLATES FOR LOCAL LLM (8B and smaller)
// ============================================================================

export const OPTIMIZED_INVOICE_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-invoice',
  description: 'Minimal invoice/billing analysis for local LLM',
  category: EmailCategory.INVOICE,
  maxTokens: 80,
  template: `Analyze invoice email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "INVOICE",
  "priority": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE", 
  "summary": "Brief summary (max 50 words)",
  "actionItems": [{"actionType": "REVIEW_REQUIRED|SCHEDULE_PAYMENT|NO_ACTION", "description": "Action needed", "priority": "HIGH|MEDIUM|LOW"}],
  "tags": ["payment", "invoice"],
  "confidence": 0.9
}`
};

export const OPTIMIZED_MEETING_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-meeting',
  description: 'Minimal meeting/appointment analysis for local LLM',
  category: EmailCategory.APPOINTMENT,
  maxTokens: 85,
  template: `Analyze meeting email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "APPOINTMENT",
  "priority": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Meeting details (max 50 words)",
  "actionItems": [{"actionType": "ACCEPT_MEETING|REPLY_REQUIRED|ADD_TO_CALENDAR", "description": "Action needed", "priority": "HIGH|MEDIUM|LOW"}],
  "tags": ["meeting", "appointment"],
  "confidence": 0.9
}`
};

export const OPTIMIZED_MARKETING_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-marketing',
  description: 'Minimal marketing/promotional analysis for local LLM',
  category: EmailCategory.MARKETING,
  maxTokens: 75,
  template: `Analyze marketing email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "MARKETING",
  "priority": "LOW|MEDIUM",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Offer summary (max 40 words)",
  "actionItems": [{"actionType": "ARCHIVE|VIEW_OFFER|UNSUBSCRIBE", "description": "Action needed", "priority": "LOW|MEDIUM"}],
  "tags": ["marketing", "promotion"],
  "confidence": 0.8
}`
};

export const OPTIMIZED_NEWSLETTER_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-newsletter',
  description: 'Minimal newsletter analysis for local LLM',
  category: EmailCategory.NEWSLETTER,
  maxTokens: 80,
  template: `Analyze newsletter:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "NEWSLETTER",
  "priority": "MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Key topics (max 50 words)",
  "actionItems": [{"actionType": "READ_LATER|ARCHIVE|SHARE", "description": "Action needed", "priority": "LOW|MEDIUM"}],
  "tags": ["newsletter", "news"],
  "confidence": 0.8
}`
};

export const OPTIMIZED_SUPPORT_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-support',
  description: 'Minimal support/help request analysis for local LLM',
  category: EmailCategory.SUPPORT,
  maxTokens: 85,
  template: `Analyze support email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "SUPPORT",
  "priority": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Issue summary (max 50 words)",
  "actionItems": [{"actionType": "REPLY_REQUIRED|ESCALATE|RESOLVE", "description": "Action needed", "priority": "HIGH|MEDIUM|LOW"}],
  "tags": ["support", "help"],
  "confidence": 0.9
}`
};

export const OPTIMIZED_WORK_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-work',
  description: 'Minimal work/business communication analysis for local LLM',
  category: EmailCategory.WORK,
  maxTokens: 80,
  template: `Analyze work email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "WORK",
  "priority": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Work context (max 50 words)",
  "actionItems": [{"actionType": "REPLY_REQUIRED|REVIEW_DOCUMENT|FOLLOW_UP", "description": "Action needed", "priority": "HIGH|MEDIUM|LOW"}],
  "tags": ["work", "business"],
  "confidence": 0.9
}`
};

export const OPTIMIZED_PERSONAL_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-personal',
  description: 'Minimal personal communication analysis for local LLM',
  category: EmailCategory.PERSONAL,
  maxTokens: 75,
  template: `Analyze personal email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "PERSONAL",
  "priority": "MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Personal message (max 40 words)",
  "actionItems": [{"actionType": "REPLY_REQUIRED|NO_ACTION", "description": "Action needed", "priority": "MEDIUM|LOW"}],
  "tags": ["personal", "family"],
  "confidence": 0.8
}`
};

export const OPTIMIZED_RECEIPT_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-receipt',
  description: 'Minimal receipt/transaction analysis for local LLM',
  category: EmailCategory.RECEIPT,
  maxTokens: 75,
  template: `Analyze receipt email:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "RECEIPT",
  "priority": "LOW|MEDIUM",
  "sentiment": "POSITIVE|NEUTRAL",
  "summary": "Purchase details (max 40 words)",
  "actionItems": [{"actionType": "SAVE_RECEIPT|ARCHIVE", "description": "Action needed", "priority": "LOW|MEDIUM"}],
  "tags": ["receipt", "purchase"],
  "confidence": 0.9
}`
};

export const OPTIMIZED_NOTIFICATION_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-notification',
  description: 'Minimal system notification analysis for local LLM',
  category: EmailCategory.NOTIFICATION,
  maxTokens: 70,
  template: `Analyze notification:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

Return JSON:
{
  "category": "NOTIFICATION",
  "priority": "MEDIUM|LOW",
  "sentiment": "NEUTRAL",
  "summary": "Notification type (max 30 words)",
  "actionItems": [{"actionType": "ACKNOWLEDGE|ARCHIVE", "description": "Action needed", "priority": "LOW|MEDIUM"}],
  "tags": ["notification", "system"],
  "confidence": 0.8
}`
};

// ============================================================================
// FALLBACK GENERAL TEMPLATE (ULTRA-MINIMAL)
// ============================================================================

export const OPTIMIZED_GENERAL_TEMPLATE: OptimizedTemplate = {
  name: 'optimized-general',
  description: 'Ultra-minimal general email analysis for any local LLM',
  category: EmailCategory.WORK, // Default category
  maxTokens: 60,
  template: `Analyze email and respond with ONLY valid JSON:

Subject: {{subject}}
From: {{fromAddress}}
Content: {{content}}

{
  "category": "WORK",
  "priority": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "summary": "Brief summary (max 30 words)",
  "actionItems": [{"actionType": "REPLY_REQUIRED|REVIEW_REQUIRED|NO_ACTION", "description": "Action", "priority": "HIGH|MEDIUM|LOW"}],
  "tags": ["email"],
  "confidence": 0.7
}`
};

// ============================================================================
// TEMPLATE MAPPING
// ============================================================================

export const OPTIMIZED_TEMPLATE_MAP: Record<EmailCategory, OptimizedTemplate> = {
  [EmailCategory.INVOICE]: OPTIMIZED_INVOICE_TEMPLATE,
  [EmailCategory.APPOINTMENT]: OPTIMIZED_MEETING_TEMPLATE,
  [EmailCategory.MARKETING]: OPTIMIZED_MARKETING_TEMPLATE,
  [EmailCategory.NEWSLETTER]: OPTIMIZED_NEWSLETTER_TEMPLATE,
  [EmailCategory.SUPPORT]: OPTIMIZED_SUPPORT_TEMPLATE,
  [EmailCategory.WORK]: OPTIMIZED_WORK_TEMPLATE,
  [EmailCategory.PERSONAL]: OPTIMIZED_PERSONAL_TEMPLATE,
  [EmailCategory.RECEIPT]: OPTIMIZED_RECEIPT_TEMPLATE,
  [EmailCategory.NOTIFICATION]: OPTIMIZED_NOTIFICATION_TEMPLATE,
};

// ============================================================================
// TEMPLATE UTILITIES
// ============================================================================

export function getOptimizedTemplate(category: EmailCategory): OptimizedTemplate {
  return OPTIMIZED_TEMPLATE_MAP[category] || OPTIMIZED_GENERAL_TEMPLATE;
}

export function estimateTokenCount(template: OptimizedTemplate, contentLength: number): number {
  // Rough estimation: template tokens + content tokens
  return template.maxTokens + Math.ceil(contentLength / 4);
} 
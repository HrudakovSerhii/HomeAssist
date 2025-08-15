# Embedding Service

The EmbeddingService provides intelligent email categorization using machine learning embeddings to automatically select the most appropriate processing template for each email.

## Overview

This service uses the `@xenova/transformers` library with the `Xenova/all-MiniLM-L6-v2` model to:

1. **Precompute category embeddings** - Generate embeddings for predefined category descriptions during service initialization
2. **Classify email subjects** - Analyze incoming email subjects and match them to the most appropriate category
3. **Select optimal templates** - Map classified categories to specialized processing templates

## Features

### Category Descriptions

The service uses multiple description variations for each email category to improve classification accuracy:

- **NEWSLETTER**: Newsletter subscriptions, mailing lists, weekly/monthly updates
- **INVOICE**: Payment requests, billing statements, overdue notices
- **SUPPORT**: Help requests, troubleshooting, customer service
- **WORK**: Business communications, meetings, projects
- **PERSONAL**: Family, friends, private correspondence
- **MARKETING**: Promotions, sales, advertisements
- **NOTIFICATION**: System alerts, automated messages
- **RECEIPT**: Purchase confirmations, transaction receipts
- **APPOINTMENT**: Meeting invitations, calendar events

### Template Mapping

Categories are automatically mapped to specialized processing templates:

| Category | Template |
|----------|----------|
| INVOICE | invoice-processor |
| APPOINTMENT | meeting-processor |
| MARKETING | marketing-processor |
| NEWSLETTER | news-processor |
| RECEIPT | financial-processor |
| SUPPORT | general-email-analysis |
| WORK | general-email-analysis |
| PERSONAL | sentiment-focused |
| NOTIFICATION | general-email-analysis |

## Usage

### Integration with Email Processing

The service is automatically integrated into the email processing pipeline through the `processEmailWithEmbeddingClassification` method in `EmailProcessorService`.

```typescript
// Automatic usage in email schedule processing
const result = await this.processorService.processEmailWithEmbeddingClassification(
  schedule.emailAccountId,
  email,
  { llmFocus: schedule.llmFocus }
);
```

### Fallback Behavior

- **Low Confidence**: If classification confidence is below 70% and `llmFocus` is specified, the service falls back to the focus-based template
- **Service Not Ready**: If the embedding model isn't loaded, falls back to standard schedule focus processing
- **Error Handling**: Any classification errors automatically fall back to the default processing method

### Classification API

```typescript
const classification = await embeddingService.classifyEmailSubject("Invoice #12345 - Payment Due");
// Returns:
// {
//   category: EmailCategory.INVOICE,
//   confidence: 0.92,
//   scores: { INVOICE: 0.92, WORK: 0.45, ... }
// }
```

## Technical Details

### Model Information

- **Model**: `Xenova/all-MiniLM-L6-v2`
- **Type**: Sentence transformer for semantic similarity
- **Quantized**: Yes (for faster loading and smaller memory footprint)
- **Embedding Size**: 384 dimensions

### Similarity Calculation

The service uses cosine similarity with a weighted approach:
- **60%** weight on average category embedding
- **40%** weight on maximum individual description similarity

### Performance

- **Initialization**: ~10-30 seconds (model download + embedding precomputation)
- **Classification**: ~50-200ms per email subject
- **Memory**: ~100-200MB for model and precomputed embeddings

## Configuration

### Environment Requirements

- Node.js with sufficient memory allocation
- Internet connection for initial model download
- Disk space for model caching (~50MB)

### Logging

The service provides detailed logging:
- 🚀 Initialization progress
- 📥 Model download progress
- ✅ Successful operations
- 📧 Classification results
- ⚠️ Warnings and fallbacks
- ❌ Error conditions

## Benefits

1. **Improved Accuracy**: Semantic understanding vs. keyword matching
2. **Specialized Processing**: Category-specific templates for better analysis
3. **Automatic Template Selection**: Reduces manual configuration
4. **Fallback Safety**: Graceful degradation when embedding service unavailable
5. **Performance**: Fast classification after initial model loading

## Future Enhancements

- Custom category training data
- Dynamic template selection based on content analysis
- Multi-language support
- Real-time model updates
- Performance optimizations for high-volume processing 
# Local LLM Optimization for Email Processing

This document outlines the optimizations implemented for efficient email processing using local LLMs (8B parameters or smaller) via Ollama.

## Recommended Local LLMs

### Primary Recommendations (Ordered by Performance)

1. **Llama 3.2 3B** ⭐ **BEST CHOICE**
   - Excellent quality-to-speed ratio
   - Strong structured output capabilities
   - ~2-3 seconds per email on average hardware
   ```bash
   ollama pull llama3.2:3b
   ```

2. **Gemma 2 2B** ⚡ **FASTEST**
   - Very fast processing (~1-2 seconds per email)
   - Good for high-volume processing
   - Reliable JSON output
   ```bash
   ollama pull gemma2:2b
   ```

3. **Qwen2.5 7B** 🧠 **BEST REASONING**
   - Superior reasoning capabilities
   - Excellent for complex email analysis
   - ~3-4 seconds per email
   ```bash
   ollama pull qwen2.5:7b
   ```

4. **Phi-3.5 Mini (3.8B)** 🔧 **RELIABLE**
   - Microsoft's efficient model
   - Consistent structured output
   - Good balance of speed and quality
   ```bash
   ollama pull phi3.5
   ```

### Fallback Option
5. **Mistral 7B** 
   - Reliable general-purpose model
   - Good fallback if others don't work
   ```bash
   ollama pull mistral:7b
   ```

## Token Optimization Features

### 1. **Optimized Templates**
- **Before**: 200-400 tokens per template
- **After**: 60-85 tokens per template
- **Reduction**: ~70% token savings

### 2. **Content Cleaning Pipeline**
- HTML tag removal and entity decoding
- Email signature and footer removal  
- URL simplification (keep domain only)
- Whitespace normalization
- Intelligent content truncation

### 3. **Category-Specific Templates**
Each email category has a focused template:

| Category | Template Tokens | Focus Areas |
|----------|----------------|-------------|
| Invoice | 80 | Payment status, due dates, amounts |
| Meeting | 85 | Date, time, location, attendees |
| Marketing | 75 | Offers, discounts, expiry dates |
| Newsletter | 80 | Key topics, relevance |
| Support | 85 | Issue type, urgency, resolution |
| Work | 80 | Business context, actions needed |
| Personal | 75 | Message context, reply needs |
| Receipt | 75 | Purchase details, amounts |
| Notification | 70 | Alert type, importance |

### 4. **Email Content Processing**

#### Content Prioritization
1. **Plain text** preferred over HTML
2. **Subject line** as fallback if no body
3. **HTML cleaning** when text unavailable

#### Intelligent Truncation
- Preserves sentence boundaries
- Keeps important keywords
- Maintains context flow
- Estimates: 1 token ≈ 4 characters

#### Metadata Extraction
- Sender domain identification
- Urgency keyword detection
- Reply/forward indicators

## Performance Characteristics

### Token Usage Comparison

| Template Type | Old Tokens | New Tokens | Savings |
|---------------|------------|------------|---------|
| General Analysis | 300-400 | 60-80 | 75% |
| Invoice Processing | 250-350 | 80 | 70% |
| Meeting Analysis | 280-380 | 85 | 72% |
| Marketing Analysis | 200-300 | 75 | 68% |

### Processing Speed Estimates

| Model Size | Tokens/Second | Email Processing Time |
|------------|---------------|----------------------|
| 2B | ~50-100 | 1-2 seconds |
| 3B | ~30-60 | 2-3 seconds |
| 7B | ~15-30 | 3-4 seconds |
| 8B | ~12-25 | 4-5 seconds |

*Times include prompt processing + response generation*

## Usage Examples

### Basic Usage
```typescript
const optimizedService = new OptimizedTemplateService();

// Generate optimized prompt
const result = optimizedService.generateOptimizedPrompt(
  emailMessage,
  EmailCategory.INVOICE,
  250 // max content tokens
);

console.log(`Prompt: ${result.prompt}`);
console.log(`Estimated tokens: ${result.estimatedTokens}`);
```

### LLM Settings
```typescript
const settings = optimizedService.getOptimizedLLMSettings();
// Returns:
// {
//   temperature: 0.1,
//   maxTokens: 150,
//   stopSequences: ['\n\n', '```'],
//   repeatPenalty: 1.1
// }
```

## Integration Points

### 1. **Embedding Service Integration**
- Uses embedding classification to select optimal template
- Falls back to general template when confidence is low
- Combines semantic understanding with optimized prompts

### 2. **Template Service Enhancement**
- Replaces verbose templates with optimized versions
- Maintains backward compatibility
- Provides detailed logging and monitoring

### 3. **Email Processing Pipeline**
- Automatic content cleaning and optimization
- Token counting and validation
- Performance monitoring and logging

## Configuration Recommendations

### Ollama Configuration
```bash
# Set appropriate context length
export OLLAMA_NUM_CTX=2048

# Optimize for speed
export OLLAMA_NUM_THREAD=8

# Memory management
export OLLAMA_NUM_GPU_LAYERS=0  # CPU-only processing
```

### Environment Variables
```env
# LLM Configuration
LLM_MODEL=llama3.2:3b
LLM_MAX_TOKENS=400
LLM_TEMPERATURE=0.1

# Performance Tuning
EMAIL_CONTENT_MAX_TOKENS=250
PROMPT_VALIDATION_ENABLED=true
```

## Monitoring and Logging

### Key Metrics
- **Token Usage**: Track actual vs. estimated tokens
- **Processing Time**: Monitor per-email processing duration
- **Quality Metrics**: JSON parsing success rate
- **Error Rates**: Failed processing attempts

### Log Examples
```
🎯 Generated optimized prompt for INVOICE (127 tokens estimated)
📧 Processing email with llama3.2:3b (estimated 2.1s)
✅ Email processed successfully in 1.8s (actual: 134 tokens)
```

## Best Practices

### 1. **Model Selection**
- Start with **Llama 3.2 3B** for best balance
- Use **Gemma 2 2B** for high-volume processing
- Choose **Qwen2.5 7B** for complex analysis needs

### 2. **Content Optimization**
- Enable HTML cleaning for all emails
- Set appropriate token limits per category
- Monitor and adjust truncation thresholds

### 3. **Performance Tuning**
- Batch process emails when possible
- Use category-specific templates
- Monitor token usage and adjust limits

### 4. **Error Handling**
- Implement fallback to general template
- Retry with simplified prompts on failure
- Log performance metrics for optimization

## Future Enhancements

1. **Dynamic Token Allocation**: Adjust token limits based on email complexity
2. **Model-Specific Optimization**: Fine-tune prompts for specific LLM models
3. **Batch Processing**: Process multiple emails in single LLM call
4. **Caching**: Cache common template patterns and responses
5. **A/B Testing**: Compare template variations for optimal performance 
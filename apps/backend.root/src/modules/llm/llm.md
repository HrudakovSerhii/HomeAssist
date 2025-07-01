# LLM Module

The LLM Module provides endpoints for processing prompts using Large Language Models (LLMs) through Ollama integration.

## API Endpoints

### POST /api/llm/execute

Executes a prompt using the specified LLM model and returns the generated response.

#### Request Body

```json
{
  "prompt": "Hello, how are you?",
  "llmModel": "llama3.2:latest",
  "target": "local",
  "options": {
    "temperature": 0.7,
    "seed": 42
  },
  "history": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant", 
      "content": "Previous response"
    }
  ]
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | The text prompt to send to the LLM |
| llmModel | string | Yes | The LLM model to use (e.g., "llama3.2:latest") |
| target | string | Yes | Target LLM instance: "local" or "remote" |
| options | object | No | Optional parameters for the LLM (temperature, seed, etc.) |
| history | array | No | Chat history for context-aware conversations |

#### Response

```json
{
  "model": "llama3.2:latest",
  "createdAt": "2025-06-19T12:17:35.3926Z",
  "response": "Hello! I'm doing well, thank you for asking. How can I assist you today?",
  "raw": {
    "model": "llama3.2:latest",
    "created_at": "2025-06-19T12:17:35.3926Z",
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing well, thank you for asking. How can I assist you today?"
    },
    "done_reason": "stop",
    "done": true,
    "total_duration": 1301161959,
    "load_duration": 32950667,
    "prompt_eval_count": 27,
    "prompt_eval_duration": 877690000,
    "eval_count": 24,
    "eval_duration": 389125750
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| model | string | The LLM model that processed the request |
| createdAt | string | ISO 8601 timestamp when the response was generated |
| response | string | The generated text response from the LLM |
| raw | object | Complete raw response from the Ollama API |

#### OpenAPI Schema

```yaml
paths:
  /llm/execute:
    post:
      summary: Execute LLM prompt
      description: Processes a text prompt using the specified LLM model and returns the generated response
      operationId: executeLLM
      tags:
        - LLM
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - prompt
                - llmModel
                - target
              properties:
                prompt:
                  type: string
                  description: The text prompt to send to the LLM
                  example: "Hello, how are you?"
                llmModel:
                  type: string
                  description: The LLM model to use
                  example: "llama3.2:latest"
                target:
                  type: string
                  enum: [local, remote]
                  description: Target LLM instance
                  example: "local"
                options:
                  type: object
                  description: Optional parameters for the LLM
                  properties:
                    temperature:
                      type: number
                      description: Controls randomness (0.0 to 1.0)
                      example: 0.7
                    seed:
                      type: integer
                      description: Random seed for reproducible outputs
                      example: 42
                history:
                  type: array
                  description: Chat history for context
                  items:
                    type: object
                    properties:
                      role:
                        type: string
                        enum: [user, assistant]
                      content:
                        type: string
      responses:
        '201':
          description: Successful LLM response
          content:
            application/json:
              schema:
                type: object
                required:
                  - model
                  - createdAt
                  - response
                  - raw
                properties:
                  model:
                    type: string
                    description: The LLM model used
                  createdAt:
                    type: string
                    format: date-time
                    description: Response generation timestamp
                  response:
                    type: string
                    description: Generated text response
                  raw:
                    type: object
                    description: Complete Ollama API response
        '400':
          description: Invalid request parameters
        '500':
          description: LLM processing error
        '502':
          description: Ollama service unavailable
```

## Configuration

The module requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| LLM_OLLAMA_URL | Local Ollama instance URL | `http://localhost:11434` |
| LLM_OLLAMA_REMOTE_URL | Remote Ollama instance URL | `http://192.168.1.100:11434` |

## Security

For local network deployment, the module implements validation-based protection rather than authentication:

### Input Validation
- **Prompt length**: 1-2000 characters maximum
- **Content validation**: Must contain at least one alphanumeric character
- **Model name**: 1-50 characters, prevents injection attacks
- **Request structure**: Validates all required fields and types

### Protection Strategy
- No authentication required for local Ollama instances
- Focus on input sanitization and validation
- Prevents malicious or malformed prompts
- Resource protection through request validation

## Testing

The module includes service integration tests that verify:
1. Local LLM connection and response generation
2. Remote LLM connection (when configured)
3. Response structure validation
4. Error handling for invalid models or connection failures

To run the tests:
```bash
# Run all service tests
npm run test:e2e:services

# Run only LLM service tests
npm run test:e2e:services:llm
```

## Error Handling

Common error scenarios:

- **400**: Invalid request parameters
  - Missing required fields (prompt, llmModel, target)
  - Prompt length validation (1-2000 characters)
  - Prompt content validation (must contain alphanumeric characters)
  - Model name validation (1-50 characters)
- **404**: Model not found (model needs to be pulled first)
- **500**: Ollama URL not configured
- **502**: Cannot connect to Ollama service 
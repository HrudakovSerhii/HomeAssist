# Health Module

The Health Module provides endpoints to check the status and configuration of the API.

## API Endpoints

### GET /api/health

Returns the current health status and configuration of the API.

#### Response

```json
{
  "status": "ok",
  "timestamp": "2024-03-14T12:34:56.789Z",
  "environment": "development",
  "version": "1.0.0",
  "apiPrefix": "api"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| status | string | Current status of the API. Always "ok" if the API is running. |
| timestamp | string | ISO 8601 formatted timestamp of when the request was processed. |
| environment | string | Current environment ("development" or "production"). |
| version | string | Current version of the API. |
| apiPrefix | string | Configured API prefix for all routes. |

#### OpenAPI Schema

```yaml
paths:
  /health:
    get:
      summary: Get API health status
      description: Returns the current health status and configuration of the API
      operationId: getHealth
      tags:
        - Health
      responses:
        '200':
          description: Successful operation
          content:
            application/json:
              schema:
                type: object
                required:
                  - status
                  - timestamp
                  - environment
                  - version
                  - apiPrefix
                properties:
                  status:
                    type: string
                    enum: [ok]
                    description: Current status of the API
                  timestamp:
                    type: string
                    format: date-time
                    description: ISO 8601 formatted timestamp
                  environment:
                    type: string
                    enum: [development, production]
                    description: Current environment
                  version:
                    type: string
                    description: Current API version
                  apiPrefix:
                    type: string
                    description: Configured API prefix
```

## Testing

The module includes end-to-end tests that verify:
1. Response structure and all required fields
2. Correct status value ("ok")
3. Valid timestamp format
4. Environment value is either "development" or "production"
5. Correct API prefix value

To run the tests:
```bash
# Run all e2e tests
npm run test:e2e

# Run only health module e2e tests
npm run test:e2e -- health/health.spec.ts
``` 
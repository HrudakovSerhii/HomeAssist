# @home-assist/api-types

**Shared TypeScript types for HomeAssist API** - Generated from OpenAPI schema as the source of truth.

## 🎯 Purpose

This library provides TypeScript types for the HomeAssist API, ensuring type safety between frontend and backend code. The types are automatically generated from the OpenAPI schema, preventing API contract mismatches.

## 📦 Installation

The library is automatically available in the NX workspace:

```bash
# Import in your code
import { EmailData, User, AuthResponse } from '@home-assist/api-types';
```

## 🔧 Usage

### Common Types

```typescript
import { 
  User, 
  EmailData, 
  AuthResponse,
  ExtractedDataResponse,
  FilterOptions,
  EmailCategory,
  Priority,
  Sentiment 
} from '@home-assist/api-types';

// Use in your components/services
function processEmailData(data: EmailData): void {
  console.log(data.subject, data.priority);
}

// API response types
const response: ExtractedDataResponse = await api.get('/data/extracted');
```

### Request/Response Types

```typescript
import { 
  LoginRequest, 
  LoginResponse,
  GetExtractedDataParams,
  GetExtractedDataResponse 
} from '@home-assist/api-types';

// Login functionality
const loginData: LoginRequest = {
  username: 'user',
  password: 'pass'
};

const authResponse: LoginResponse = await api.post('/auth/login', loginData);

// Data fetching with filters
const params: GetExtractedDataParams = {
  page: 1,
  limit: 10,
  category: 'WORK',
  priority: 'HIGH'
};
```

### Enum Types

```typescript
import { EmailCategory, Priority, Sentiment } from '@home-assist/api-types';

// Use for dropdowns, filters, etc.
const categories: EmailCategory[] = ['WORK', 'PERSONAL', 'FINANCE'];
const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const sentiments: Sentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
```

### Advanced Usage

```typescript
import { paths, components } from '@home-assist/api-types';

// Extract specific endpoint types
type GetHealthResponse = paths['/health']['get']['responses']['200']['content']['application/json'];

// Access component schemas directly
type EmailSchema = components['schemas']['Email'];
```

## 🛠️ Development

### Regenerating Types

When the OpenAPI schema changes, regenerate the types:

```bash
# From project root
npm run generate-types

# Or from the library directory
cd libs/api-types
npm run generate-types
```

### API Schema Location

The OpenAPI schema is stored in `libs/api-types/schema/openapi.json` and serves as the **source of truth** for API contracts.

### Type Generation Flow

1. **OpenAPI Schema** (`schema/openapi.json`) → Defines API structure
2. **Type Generation** (`openapi-typescript`) → Converts schema to TypeScript
3. **Custom Utilities** (`src/lib/api-types.ts`) → Provides convenient exports
4. **Main Export** (`src/index.ts`) → Exposes all types

## 📁 Project Structure

```
libs/api-types/
├── schema/
│   └── openapi.json           # OpenAPI schema (source of truth)
├── scripts/
│   └── generate-types.js      # Type generation script
├── src/
│   ├── lib/
│   │   ├── api-types.ts       # Custom utilities & re-exports
│   │   └── generated-types.ts # Auto-generated types
│   └── index.ts               # Main export
├── package.json
└── README.md
```

## 🔄 Integration

### Backend Integration

```typescript
// In NestJS controllers
import { ExtractedDataQueryDto, ExtractedDataResponse } from '@home-assist/api-types';

@Controller('data')
export class DataController {
  @Get('extracted')
  async getExtractedData(
    @Query() query: ExtractedDataQueryDto
  ): Promise<ExtractedDataResponse> {
    // Implementation
  }
}
```

### Frontend Integration

```typescript
// In React components
import { EmailData, FilterOptions } from '@home-assist/api-types';

interface DashboardProps {
  emails: EmailData[];
  filters: FilterOptions;
}

export function Dashboard({ emails, filters }: DashboardProps) {
  // Component implementation
}
```

## 🎨 Available Types

### Core Entities
- `User` - User account information
- `Email` - Raw email data
- `EmailData` - Processed email with extracted data
- `ActionItem` - Action items extracted from emails
- `EntityExtraction` - Named entities found in emails

### API DTOs
- `ExtractedDataQueryDto` - Query parameters for data endpoint
- `ExtractedDataResponse` - Response from data endpoint
- `FilterOptions` - Available filter options
- `Pagination` - Pagination metadata

### Authentication
- `LoginRequest` / `LoginResponse` - Login functionality
- `RegisterRequest` / `RegisterResponse` - User registration
- `AuthResponse` - Authentication response with token

### Enums
- `EmailCategory` - Email categories (WORK, PERSONAL, etc.)
- `Priority` - Priority levels (LOW, MEDIUM, HIGH, URGENT)
- `Sentiment` - Sentiment analysis (POSITIVE, NEUTRAL, NEGATIVE)
- `EntityType` - Types of entities (DATE, PERSON, ORGANIZATION, etc.)
- `ActionType` - Action item types (MEETING, TASK, FOLLOW_UP, etc.)

## 🔍 Type Safety Benefits

1. **Compile-time validation** - Catch API contract mismatches early
2. **IDE autocomplete** - Better developer experience
3. **Refactoring safety** - Changes propagate across codebase
4. **Documentation** - Types serve as living documentation
5. **Consistency** - Single source of truth for API contracts

## 🚀 Best Practices

1. **Always regenerate types** when updating the OpenAPI schema
2. **Use specific imports** rather than importing everything
3. **Leverage utility types** for common use cases
4. **Keep schema up-to-date** with actual API implementation
5. **Use type guards** for runtime validation when needed

## 📝 Version

Current version: **1.0.0**

This library version tracks the API schema version and is updated when breaking changes are made to the API structure.

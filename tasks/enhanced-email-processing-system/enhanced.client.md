# Enhanced Email Processing - Client Admin Features

## User Onboarding Flow

### 1. New User Account Creation
- User creates account in system
- BE checks for associated email accounts
- If no email accounts exist → redirect to email account setup

### 2. Email Account Setup
- **Add Email Account Form**
  - Email address input
  - IMAP credentials (auto-detected or manual)
  - Account name/label (optional)
  - Connection validation before saving
- **Success Flow**: Email account saved → redirect to dashboard
- **Default Schedule Creation**: BE automatically creates "Initial" processing schedule for new account

### 3. Dashboard Initial State
- No processed emails displayed (empty state)
- **Processing Configuration Card** visible with:
  - Text: "Configure email processing to analyze your emails"  
  - **"View Processing Schedules"** button

## Processing Schedule Management

### 4. Processing Schedules List View
- **Route**: `/dashboard/processing-schedules` (or modal/sidebar)
- **Default Schedule Display**:
  - Schedule name: "Initial" (auto-created)
  - Type: "Date Range Processing" 
  - Date range: 1 month before current date
  - Email account: First added account
  - Status: "Not Started" / "Pending"
- **Actions**:
  - **Edit Schedule** button
  - **Submit Job Schedule** button (primary action)
  - **+ Add New Schedule** button

### 5. Edit/Create Schedule Form
- **Route**: `/dashboard/processing-schedules/edit/:id` or `/dashboard/processing-schedules/create`

#### Form Fields:
```typescript
interface ScheduleFormData {
  // Basic Info
  scheduleName: string; // Default: "Initial" for first schedule
  description?: string;
  
  // Email Accounts
  selectedAccounts: string[]; // Default: first added account
  
  // Processing Type (Radio Selection)
  processingType: 'DATE_RANGE' | 'RECURRING' | 'SPECIFIC_DATES';
  
  // Date Range Options (when processingType = 'DATE_RANGE')
  dateRangeFrom: Date; // Default: 1 month ago
  dateRangeTo?: Date; // Default: current date
  
  // Recurring Options (when processingType = 'RECURRING') 
  cronExpression: string; // e.g., "0 6 * * *"
  timezone: string; // Default: user's detected timezone
  
  // Specific Dates (when processingType = 'SPECIFIC_DATES')
  specificDates: Date[];
  
  // Processing Preferences
  batchSize: number; // Default: 5
  emailTypePriorities: Record<EmailCategory, Priority>;
  senderPriorities: Record<string, Priority>; // VIP senders
  llmFocus: 'general' | 'sentiment' | 'urgency'; // Default: 'general'
}
```

#### Form Sections:
1. **Schedule Details**
   - Name input (required)
   - Description textarea (optional)

2. **Email Accounts Selection**  
   - Multi-select dropdown of user's email accounts
   - Default: first added account selected

3. **Processing Type & Timing**
   - Radio buttons: "Date Range" | "Recurring Schedule" | "Specific Dates"
   - **Date Range**: From/To date pickers (default: 1 month ago to now)
   - **Recurring**: Cron expression builder + timezone selector
   - **Specific Dates**: Multi-date picker

4. **Processing Preferences** (Collapsible/Advanced Section)
   - Batch size slider (default: 5)
   - Email type priority matrix (APPOINTMENT=HIGH, INVOICE=HIGH, etc.)
   - VIP senders list with priority assignment
   - LLM focus selection (general/sentiment/urgency)

5. **Form Actions**
   - **Save Draft** (saves without scheduling)
   - **Save & Schedule** (saves and creates cron job)
   - **Cancel** (returns to schedules list)

### 6. Schedule Execution & Monitoring
- **Submit Job Schedule** from schedules list:
  - Validates schedule configuration
  - Creates cron job in BE
  - Shows success message: "Processing scheduled successfully"
  - Updates schedule status to "Scheduled" 
  - Redirects to dashboard

- **Dashboard Updates**:
  - Processing status card shows active schedules
  - Progress indicators for running jobs
  - Filter for "Unprocessed Emails" in email table

## Navigation & UX

### Route Structure
- `/dashboard` - Main dashboard with processed emails
- `/dashboard/processing-schedules` - List of all schedules  
- `/dashboard/processing-schedules/create` - Create new schedule
- `/dashboard/processing-schedules/edit/:id` - Edit existing schedule
- `/dashboard/email-accounts` - Manage email accounts

### Key UX Principles
- **Progressive Disclosure**: Advanced options collapsed by default
- **Smart Defaults**: Pre-populate forms with sensible defaults
- **Validation**: Real-time validation for cron expressions, date ranges
- **Conflict Prevention**: Warning if schedule conflicts with existing jobs
- **Status Clarity**: Clear visual indicators for schedule status (Pending/Running/Completed/Failed)

## Integration Points

### Backend API Calls

#### Processing Schedule Management
- `GET /api/processing-schedules` - List user's schedules ✅ **IMPLEMENTED**
- `POST /api/processing-schedules` - Create new schedule ✅ **IMPLEMENTED**
- `PUT /api/processing-schedules/:id` - Update schedule ✅ **IMPLEMENTED**
- `DELETE /api/processing-schedules/:id` - Delete schedule ✅ **IMPLEMENTED**
- `POST /api/processing-schedules/:id/execute` - Manually trigger schedule ✅ **IMPLEMENTED**
- `GET /api/processing-schedules/:id/status` - Get execution status ✅ **IMPLEMENTED**
- `POST /api/processing-schedules/validate` - Validate schedule configuration ✅ **IMPLEMENTED**
- `POST /api/processing-schedules/check-conflicts` - Check schedule conflicts ✅ **IMPLEMENTED**
- `GET /api/processing-schedules/cron-calendar` - Get cron job calendar ✅ **IMPLEMENTED**
- `GET /api/processing-schedules/analytics/:userId` - Get processing analytics ✅ **IMPLEMENTED**
- `POST /api/processing-schedules/bulk-enable` - Bulk enable schedules ✅ **IMPLEMENTED**
- `POST /api/processing-schedules/bulk-disable` - Bulk disable schedules ✅ **IMPLEMENTED**
- `GET /api/processing-schedules/:id/details` - Get detailed schedule info ✅ **IMPLEMENTED**

#### Email Processing
- `POST /api/email/ingest` - Manual email ingestion ✅ **IMPLEMENTED**
- `POST /api/email/ingest/:userId` - User-specific email ingestion ✅ **IMPLEMENTED**
- `GET /api/email/status/:userId` - Get processing status ✅ **IMPLEMENTED**
- `POST /api/email/:id/process` - Process specific email ⚠️ **PARTIAL** (needs re-processing logic)
- `POST /api/email/process/batch` - Process batch of emails ⚠️ **PARTIAL** (needs batch logic)
- `GET /api/email/accounts/:accountId/schedules` - Get account schedules ✅ **IMPLEMENTED**
- `GET /api/email/accounts/:accountId/stats` - Get account stats ✅ **IMPLEMENTED**

### Missing API Endpoints & OpenAPI Schema Updates

#### 1. Processing Schedule Types Missing from OpenAPI
The following TypeScript interfaces need to be added to `libs/api-types/schema/openapi.json`:

```json
{
  "ProcessingType": {
    "type": "string",
    "enum": ["DATE_RANGE", "RECURRING", "SPECIFIC_DATES"]
  },
  "LlmFocus": {
    "type": "string", 
    "enum": ["general", "sentiment", "urgency"]
  },
  "CreateProcessingScheduleDto": {
    "type": "object",
    "properties": {
      "userId": {"type": "string", "format": "uuid"},
      "emailAccountId": {"type": "string", "format": "uuid"},
      "name": {"type": "string"},
      "description": {"type": "string", "nullable": true},
      "processingType": {"$ref": "#/components/schemas/ProcessingType"},
      "dateRangeFrom": {"type": "string", "format": "date-time", "nullable": true},
      "dateRangeTo": {"type": "string", "format": "date-time", "nullable": true},
      "cronExpression": {"type": "string", "nullable": true},
      "timezone": {"type": "string", "nullable": true},
      "specificDates": {"type": "array", "items": {"type": "string", "format": "date-time"}, "nullable": true},
      "batchSize": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
      "emailTypePriorities": {"type": "object", "additionalProperties": {"$ref": "#/components/schemas/Priority"}},
      "senderPriorities": {"type": "object", "additionalProperties": {"$ref": "#/components/schemas/Priority"}},
      "llmFocus": {"$ref": "#/components/schemas/LlmFocus", "default": "general"},
      "isEnabled": {"type": "boolean", "default": true},
      "isDefault": {"type": "boolean", "default": false}
    },
    "required": ["userId", "emailAccountId", "name", "processingType"]
  },
  "UpdateProcessingScheduleDto": {
    "type": "object",
    "properties": {
      // Same as CreateProcessingScheduleDto but all fields optional
    }
  },
  "ProcessingSchedule": {
    "type": "object",
    "properties": {
      "id": {"type": "string", "format": "uuid"},
      "userId": {"type": "string", "format": "uuid"},
      "emailAccountId": {"type": "string", "format": "uuid"},
      "name": {"type": "string"},
      "description": {"type": "string", "nullable": true},
      "processingType": {"$ref": "#/components/schemas/ProcessingType"},
      "dateRangeFrom": {"type": "string", "format": "date-time", "nullable": true},
      "dateRangeTo": {"type": "string", "format": "date-time", "nullable": true},
      "cronExpression": {"type": "string", "nullable": true},
      "timezone": {"type": "string", "nullable": true},
      "specificDates": {"type": "object", "nullable": true},
      "batchSize": {"type": "integer", "default": 5},
      "emailTypePriorities": {"type": "object", "nullable": true},
      "senderPriorities": {"type": "object", "nullable": true},
      "llmFocus": {"$ref": "#/components/schemas/LlmFocus"},
      "isEnabled": {"type": "boolean"},
      "isDefault": {"type": "boolean"},
      "totalExecutions": {"type": "integer", "default": 0},
      "successfulExecutions": {"type": "integer", "default": 0},
      "failedExecutions": {"type": "integer", "default": 0},
      "lastExecutedAt": {"type": "string", "format": "date-time", "nullable": true},
      "createdAt": {"type": "string", "format": "date-time"},
      "updatedAt": {"type": "string", "format": "date-time"}
    },
    "required": ["id", "userId", "emailAccountId", "name", "processingType", "isEnabled", "isDefault", "createdAt", "updatedAt"]
  },
  "ProcessingScheduleWithAccount": {
    "allOf": [
      {"$ref": "#/components/schemas/ProcessingSchedule"},
      {
        "type": "object",
        "properties": {
          "emailAccount": {
            "type": "object",
            "properties": {
              "email": {"type": "string", "format": "email"},
              "displayName": {"type": "string"}
            },
            "required": ["email", "displayName"]
          }
        },
        "required": ["emailAccount"]
      }
    ]
  },
  "ScheduleExecutionStatus": {
    "type": "object",
    "properties": {
      "id": {"type": "string", "format": "uuid"},
      "scheduleId": {"type": "string", "format": "uuid"},
      "scheduleName": {"type": "string"},
      "status": {"type": "string", "enum": ["RUNNING", "COMPLETED", "FAILED", "CANCELLED", "PENDING"]},
      "progress": {
        "type": "object",
        "properties": {
          "totalBatches": {"type": "integer"},
          "completedBatches": {"type": "integer"},
          "totalEmails": {"type": "integer"},
          "processedEmails": {"type": "integer"},
          "failedEmails": {"type": "integer"},
          "completionPercentage": {"type": "number", "minimum": 0, "maximum": 100}
        },
        "required": ["totalBatches", "completedBatches", "totalEmails", "processedEmails", "failedEmails", "completionPercentage"]
      },
      "timing": {
        "type": "object",
        "properties": {
          "startedAt": {"type": "string", "format": "date-time"},
          "completedAt": {"type": "string", "format": "date-time", "nullable": true},
          "estimatedCompletion": {"type": "string", "format": "date-time", "nullable": true},
          "processingDuration": {"type": "number", "nullable": true}
        },
        "required": ["startedAt"]
      },
      "error": {
        "type": "object",
        "properties": {
          "message": {"type": "string"},
          "details": {"type": "object", "nullable": true}
        },
        "required": ["message"],
        "nullable": true
      }
    },
    "required": ["id", "scheduleId", "scheduleName", "status", "progress", "timing"]
  },
  "ValidationResult": {
    "type": "object",
    "properties": {
      "valid": {"type": "boolean"},
      "errors": {"type": "array", "items": {"type": "string"}},
      "warnings": {"type": "array", "items": {"type": "string"}},
      "cronConflicts": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "conflictTime": {"type": "string", "format": "date-time"},
            "conflictingSchedules": {"type": "array", "items": {"type": "string"}},
            "suggestedAlternatives": {"type": "array", "items": {"type": "string", "format": "date-time"}}
          },
          "required": ["conflictTime", "conflictingSchedules", "suggestedAlternatives"]
        },
        "nullable": true
      }
    },
    "required": ["valid", "errors", "warnings"]
  },
  "CronJobCalendarEntry": {
    "type": "object",
    "properties": {
      "configId": {"type": "string", "format": "uuid"},
      "configName": {"type": "string"},
      "userId": {"type": "string", "format": "uuid"},
      "accountEmail": {"type": "string", "format": "email"},
      "cronExpression": {"type": "string"},
      "nextExecutions": {"type": "array", "items": {"type": "string", "format": "date-time"}},
      "timezone": {"type": "string"},
      "isEnabled": {"type": "boolean"},
      "lastExecution": {
        "type": "object",
        "properties": {
          "startedAt": {"type": "string", "format": "date-time"},
          "status": {"type": "string"},
          "processingDuration": {"type": "number", "nullable": true}
        },
        "required": ["startedAt", "status"],
        "nullable": true
      }
    },
    "required": ["configId", "configName", "userId", "accountEmail", "cronExpression", "nextExecutions", "timezone", "isEnabled"]
  },
  "ProcessingAnalytics": {
    "type": "object",
    "properties": {
      "userId": {"type": "string", "format": "uuid"},
      "totalSchedules": {"type": "integer"},
      "activeSchedules": {"type": "integer"},
      "totalExecutions": {"type": "integer"},
      "successfulExecutions": {"type": "integer"},
      "failedExecutions": {"type": "integer"},
      "successRate": {"type": "number", "minimum": 0, "maximum": 100},
      "averageProcessingTime": {"type": "number"},
      "emailsProcessedToday": {"type": "integer"},
      "emailsProcessedThisWeek": {"type": "integer"},
      "emailsProcessedThisMonth": {"type": "integer"},
      "recentExecutions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string", "format": "uuid"},
            "scheduleName": {"type": "string"},
            "status": {"type": "string"},
            "startedAt": {"type": "string", "format": "date-time"},
            "completedAt": {"type": "string", "format": "date-time", "nullable": true},
            "processedEmails": {"type": "integer"},
            "failedEmails": {"type": "integer"}
          },
          "required": ["id", "scheduleName", "status", "startedAt", "processedEmails", "failedEmails"]
        }
      },
      "upcomingExecutions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "scheduleId": {"type": "string", "format": "uuid"},
            "scheduleName": {"type": "string"},
            "nextExecutionAt": {"type": "string", "format": "date-time"},
            "accountEmail": {"type": "string", "format": "email"}
          },
          "required": ["scheduleId", "scheduleName", "nextExecutionAt", "accountEmail"]
        }
      }
    },
    "required": ["userId", "totalSchedules", "activeSchedules", "totalExecutions", "successfulExecutions", "failedExecutions", "successRate", "averageProcessingTime", "emailsProcessedToday", "emailsProcessedThisWeek", "emailsProcessedThisMonth", "recentExecutions", "upcomingExecutions"]
  }
}
```

#### 2. Missing API Paths for Processing Schedules
The following paths need to be added to the OpenAPI paths section:

```json
{
  "/api/processing-schedules": {
    "get": {
      "tags": ["Processing Schedules"],
      "summary": "Get user processing schedules",
      "parameters": [
        {
          "name": "userId",
          "in": "query",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "List of processing schedules",
          "content": {
            "application/json": {
              "schema": {
                "type": "array",
                "items": {"$ref": "#/components/schemas/ProcessingScheduleWithAccount"}
              }
            }
          }
        }
      }
    },
    "post": {
      "tags": ["Processing Schedules"],
      "summary": "Create processing schedule",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {"$ref": "#/components/schemas/CreateProcessingScheduleDto"}
          }
        }
      },
      "responses": {
        "201": {
          "description": "Schedule created successfully",
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/ProcessingSchedule"}
            }
          }
        },
        "400": {
          "description": "Validation failed",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "message": {"type": "string"},
                  "errors": {"type": "array", "items": {"type": "string"}},
                  "warnings": {"type": "array", "items": {"type": "string"}},
                  "cronConflicts": {"type": "array", "items": {"type": "object"}}
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/{id}": {
    "put": {
      "tags": ["Processing Schedules"],
      "summary": "Update processing schedule",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {"$ref": "#/components/schemas/UpdateProcessingScheduleDto"}
          }
        }
      },
      "responses": {
        "200": {
          "description": "Schedule updated successfully",
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/ProcessingSchedule"}
            }
          }
        }
      }
    },
    "delete": {
      "tags": ["Processing Schedules"],
      "summary": "Delete processing schedule",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "Schedule deleted successfully",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "success": {"type": "boolean"}
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/{id}/execute": {
    "post": {
      "tags": ["Processing Schedules"],
      "summary": "Execute schedule manually",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "Schedule execution started",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "success": {"type": "boolean"},
                  "executionId": {"type": "string", "format": "uuid"}
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/{id}/status": {
    "get": {
      "tags": ["Processing Schedules"],
      "summary": "Get schedule execution status",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "Schedule execution status",
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/ScheduleExecutionStatus"}
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/{id}/details": {
    "get": {
      "tags": ["Processing Schedules"],
      "summary": "Get detailed schedule information",
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "Detailed schedule information",
          "content": {
            "application/json": {
              "schema": {
                "allOf": [
                  {"$ref": "#/components/schemas/ProcessingScheduleWithAccount"},
                  {
                    "type": "object",
                    "properties": {
                      "executionStats": {
                        "type": "object",
                        "properties": {
                          "totalExecutions": {"type": "integer"},
                          "successfulExecutions": {"type": "integer"},
                          "failedExecutions": {"type": "integer"},
                          "averageProcessingTime": {"type": "number", "nullable": true},
                          "lastExecutionAt": {"type": "string", "format": "date-time", "nullable": true}
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/validate": {
    "post": {
      "tags": ["Processing Schedules"],
      "summary": "Validate schedule configuration",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {"$ref": "#/components/schemas/CreateProcessingScheduleDto"}
          }
        }
      },
      "parameters": [
        {
          "name": "excludeId",
          "in": "query",
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "Validation result",
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/ValidationResult"}
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/check-conflicts": {
    "post": {
      "tags": ["Processing Schedules"],
      "summary": "Check schedule conflicts",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "cronExpression": {"type": "string"},
                "timezone": {"type": "string"},
                "specificDates": {"type": "array", "items": {"type": "string", "format": "date-time"}},
                "excludeId": {"type": "string", "format": "uuid"}
              },
              "required": ["cronExpression", "timezone"]
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": "Conflict check result",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "hasConflicts": {"type": "boolean"},
                  "conflicts": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "conflictTime": {"type": "string", "format": "date-time"},
                        "conflictingSchedules": {"type": "array", "items": {"type": "string"}},
                        "suggestedAlternatives": {"type": "array", "items": {"type": "string", "format": "date-time"}}
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/cron-calendar": {
    "get": {
      "tags": ["Processing Schedules"],
      "summary": "Get cron job calendar",
      "responses": {
        "200": {
          "description": "Cron job calendar entries",
          "content": {
            "application/json": {
              "schema": {
                "type": "array",
                "items": {"$ref": "#/components/schemas/CronJobCalendarEntry"}
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/analytics/{userId}": {
    "get": {
      "tags": ["Processing Schedules"],
      "summary": "Get processing analytics",
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {"type": "string", "format": "uuid"}
        }
      ],
      "responses": {
        "200": {
          "description": "Processing analytics",
          "content": {
            "application/json": {
              "schema": {"$ref": "#/components/schemas/ProcessingAnalytics"}
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/bulk-enable": {
    "post": {
      "tags": ["Processing Schedules"],
      "summary": "Bulk enable schedules",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "scheduleIds": {"type": "array", "items": {"type": "string", "format": "uuid"}}
              },
              "required": ["scheduleIds"]
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": "Bulk operation result",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "success": {"type": "boolean"},
                  "updatedCount": {"type": "integer"},
                  "errors": {"type": "array", "items": {"type": "string"}, "nullable": true}
                }
              }
            }
          }
        }
      }
    }
  },
  "/api/processing-schedules/bulk-disable": {
    "post": {
      "tags": ["Processing Schedules"],
      "summary": "Bulk disable schedules",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "scheduleIds": {"type": "array", "items": {"type": "string", "format": "uuid"}}
              },
              "required": ["scheduleIds"]
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": "Bulk operation result",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "success": {"type": "boolean"},
                  "updatedCount": {"type": "integer"},
                  "errors": {"type": "array", "items": {"type": "string"}, "nullable": true}
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### 3. Implementation Tasks Required

**High Priority:**
1. **Update OpenAPI Schema** - Add all processing schedule types and paths to `libs/api-types/schema/openapi.json`
2. **Fix Email Processing Endpoints** - Complete implementation of:
   - `POST /api/email/:id/process` - Add re-processing logic for stored emails
   - `POST /api/email/process/batch` - Add batch processing logic for pending emails
3. **Generate TypeScript Types** - Run type generation script after OpenAPI updates

**Medium Priority:**
4. **Add Processing Schedule Tag** - Add "Processing Schedules" tag to OpenAPI tags section
5. **Update API Prefix** - Ensure all processing schedule paths use `/api/` prefix consistently
6. **Add Error Response Schemas** - Ensure all endpoints have proper error response schemas

### State Management
- Store active schedules in global state
- Real-time updates via WebSocket for job progress
- Cache schedule configurations for quick editing

---

**Result**: Unified admin experience where users manage all email processing through one intuitive scheduling interface, with smart defaults for new users and comprehensive configuration options for power users.

## Implementation Tasks Summary

### 1. OpenAPI Schema Updates (High Priority)
**File:** `libs/api-types/schema/openapi.json`

- [ ] Add processing schedule component schemas:
  - `ProcessingType`, `LlmFocus` enums
  - `CreateProcessingScheduleDto`, `UpdateProcessingScheduleDto`
  - `ProcessingSchedule`, `ProcessingScheduleWithAccount`
  - `ScheduleExecutionStatus`, `ValidationResult`
  - `CronJobCalendarEntry`, `ProcessingAnalytics`

- [ ] Add processing schedule API paths:
  - All `/api/processing-schedules/*` endpoints (13 total)
  - Include proper request/response schemas
  - Add validation error responses

- [ ] Add "Processing Schedules" to tags section

- [ ] Update existing email endpoints to use `/api/` prefix consistently

### 2. Backend API Implementation (High Priority)
**Files:** 
- `apps/backend.root/src/modules/email/email.controller.ts`
- `apps/backend.root/src/modules/processing-schedule/processing-schedule.controller.ts`

- [ ] **Fix Email Re-processing Logic**
  - Implement `POST /api/email/:id/process` to re-process stored emails
  - Add service method to extract email content from ProcessedEmails table
  - Support template selection for re-processing

- [ ] **Fix Batch Processing Logic**
  - Implement `POST /api/email/process/batch` for pending emails
  - Add service method to find and process unprocessed emails
  - Support batch size limits and error handling

- [ ] **Update API Prefixes**
  - Ensure processing schedule controller uses `/api/processing-schedules` 
  - Ensure email controller uses `/api/email`

### 3. Type Generation (Medium Priority)
**File:** `libs/api-types/scripts/generate-types.js`

- [ ] Run type generation script after OpenAPI updates
- [ ] Verify generated types match backend DTOs
- [ ] Update client imports to use new types

### 4. Client Integration (Medium Priority)
**Files:** `apps/admin.client/src/app/services/*`

- [ ] Create `processingScheduleService.ts` with all API methods
- [ ] Update `dataService.ts` to use new email processing endpoints
- [ ] Add TypeScript interfaces for form data and responses
- [ ] Implement error handling for validation failures

### 5. Testing & Validation (Low Priority)

- [ ] Add unit tests for new API endpoints
- [ ] Test schedule validation logic
- [ ] Test conflict detection
- [ ] Verify WebSocket integration for progress updates

---

**Next Steps:** 
1. Start with OpenAPI schema updates to establish the contract
2. Fix the email processing endpoint implementations
3. Generate and verify TypeScript types
4. Build the client-side processing schedule management UI
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
- `GET /api/processing-schedules` - List user's schedules
- `POST /api/processing-schedules` - Create new schedule  
- `PUT /api/processing-schedules/:id` - Update schedule
- `DELETE /api/processing-schedules/:id` - Delete schedule
- `POST /api/processing-schedules/:id/execute` - Manually trigger schedule
- `GET /api/processing-schedules/:id/status` - Get execution status

### State Management
- Store active schedules in global state
- Real-time updates via WebSocket for job progress
- Cache schedule configurations for quick editing

---

**Result**: Unified admin experience where users manage all email processing through one intuitive scheduling interface, with smart defaults for new users and comprehensive configuration options for power users.

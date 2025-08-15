## Manual Date-Range Email Processing and Execution Limits

### Goal
Enable ad‑hoc processing of large historical email ranges for testing UI/LLM while keeping regular schedule execution lean and cost‑controlled.

### Current Capabilities
- Existing endpoints accept an optional date range:
  - POST `email/ingest` (body with `userId`, `limit`, `folder`, `since`, `before`, `templateName`)
  - POST `email/ingest/{userId}` (body with `limit`, `folder`, `since`, `before`)
- Gap: date range is not yet honored end‑to‑end in ingestion; the service currently fetches “latest N” and ignores `since`/`before`.

### Decision
- Use the existing `email/ingest` endpoints for manual backfill by honoring `since`/`before` through to IMAP fetching.
- Keep the schedule module focused on automated recurring/one‑time execution. Do not overload the schedule form with manual bulk backfill.
- Provide a separate “Manual Backfill” UI tool; optionally add an “Initial backfill (advanced)” toggle in the schedule creation form, which triggers a one‑time backfill call to the ingestion endpoint.

### API Design (confirm and implement)
- Honor `since`/`before` in ingestion path:
  - Controller already passes them → Ensure `EmailIngestionService.ingestUserEmails(...)` forwards to IMAP with the date window.
  - Use `ImapService.fetchEmailsWithDateFilter(accountId, since, before, limit)` for date‑bounded pulls.

- Optional: Add per‑account endpoint for precision backfill
  - POST `email/ingest/account/{accountId}`
  - Body: `{ limit?: number; folder?: string; since?: string(ISO); before?: string(ISO); templateName?: string }`
  - Response: same shape as existing ingestion response for a single account.

#### Example requests
```bash
# User-wide (all active accounts), bounded by date
curl -X POST \
  http://localhost:4000/api/email/ingest/{USER_ID} \
  -H 'Content-Type: application/json' \
  -d '{
    "limit": 50,
    "folder": "INBOX",
    "since": "2024-12-01T00:00:00.000Z",
    "before": "2025-01-01T00:00:00.000Z"
  }'
```
```bash
# Single account (proposed)
curl -X POST \
  http://localhost:4000/api/email/ingest/account/{ACCOUNT_ID} \
  -H 'Content-Type: application/json' \
  -d '{
    "limit": 100,
    "since": "2024-06-01T00:00:00.000Z",
    "before": "2024-09-01T00:00:00.000Z",
    "templateName": "email-analysis"
  }'
```

### UI Guidance
- Add a “Manual Backfill” page in admin:
  - Inputs: account (optional → all accounts), folder, since, before, limit, template (optional)
  - Action: calls the ingestion endpoint(s). Show progress and a compact summary.
- Schedule creation UI:
  - Keep core schedule options as-is for automation.
  - Optional advanced toggle: “Perform initial backfill now” → immediately calls the ingestion endpoint once with a small, safe limit.

### Focused Execution Improvements (for schedules)
- Configurable per‑execution limit
  - Add env: `PROCESSING_MAX_EMAILS_PER_EXECUTION` (default 5 in development). Effective limit = `min(schedule.batchSize, env || Infinity)`.
- Incremental window for RECURRING
  - Compute window as: `since = last COMPLETED processed email.receivedAt for the account` (fallback: schedule.createdAt or short lookback), `before = now`.
- Initial run fallback
  - If no prior processed email exists, avoid scanning huge ranges; either short lookback (e.g., 7 days via `INITIAL_LOOKBACK_DAYS`) or fetch latest N.
- Future-window guard
  - If computed window is entirely in the future (common in testing), fallback to fetching latest N so the flow exercises fully.
- Deduplicate by `messageId`
  - Filter fetched emails against existing `processed_emails.messageId` before LLM processing.
- Progress markers
  - Update `EmailAccount.lastProcessedAt` (and optionally `lastProcessedEmailId`) after successful runs.
- Metrics/visibility
  - Log chosen window, limit, fetched count, deduped count; update `ScheduleExecution.totalEmailsCount` and other counters accordingly.

### Env Parameters (proposal)
- `PROCESSING_MAX_EMAILS_PER_EXECUTION`: hard cap per schedule execution (dev default: 5).
- `INITIAL_LOOKBACK_DAYS`: initial run date lookback when no prior processed email exists (dev default: 7).

### Implementation Notes
- Email Controller already surfaces `since`/`before` → implement pass‑through in `EmailIngestionService.ingestUserEmails(...)` and use `ImapService.fetchEmailsWithDateFilter(...)` instead of the “latest N” path when date bounds are present.
- Keep the “latest N” method (`fetchAndProcessEmails`) as the fallback when no dates are provided.
- Add the proposed per‑account endpoint only if needed; the user‑wide endpoint may suffice for initial backfills.

### Why this approach
- Keeps responsibilities clean: schedules = automation; ingestion endpoint = ad‑hoc/manual backfill.
- Enables large historical processing with bounded cost and predictable controls.
- Minimal changes to existing API surface; leverages current DTOs and services. 
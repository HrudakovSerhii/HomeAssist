# HomeAssist

NX monorepo for a self-hosted email assistant: it fetches email over IMAP, classifies each
message into a category with a local embedding model, analyses it with a local LLM (Ollama)
using category-optimized prompts, and shows the results in a web dashboard.

- `apps/backend.root` — NestJS API: IMAP ingestion, embedding classification, LLM analysis,
  processing schedules (cron), Prisma/PostgreSQL persistence.
- `apps/admin.client` — React + Vite dashboard: accounts, schedules, processed-email table
  with category filters.
- `libs/api-types` — shared API types.

## Local setup

Prerequisites: Node.js 20+, Docker, [Ollama](https://ollama.com).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.development
# Edit .env.development — at minimum set APP_PASSWORD_ENCRYPTION_KEY:
#   openssl rand -hex 32

# 3. Start PostgreSQL
npm run db:docker:up          # postgres-dev on :5432, postgres-test on :5433

# 4. Apply database migrations
npm run db:migrate

# 5. Pull a local model (see LLM_DEFAULT_MODEL in .env.development)
ollama pull llama3.2:3b

# 6. Run backend and frontend (separate terminals)
npm run backend:dev           # http://localhost:4000/api
npm run frontend:dev          # http://localhost:4200
```

Then open the dashboard, register a user, add an email account (for Gmail use an
[app password](https://support.google.com/accounts/answer/185833) with IMAP enabled), and
enable a processing schedule for the account.

Model recommendations and prompt-size details:
`apps/backend.root/src/modules/process-template/LOCAL-LLM-OPTIMIZATION.md`.
Release status and remaining work: `tasks/v1.0-release-plan.md`.

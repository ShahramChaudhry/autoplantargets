# AutoPlan Targets (MVP)

Full-stack monthly target planning and allocation workflow for automotive sales teams.

## Tech Stack

- **Next.js 15** (App Router)
- **React** + **JavaScript** (no TypeScript)
- **Tailwind CSS** + shadcn-style UI components
- **Supabase** (Postgres + Auth)

## Roles & Workflow

| Role | Responsibilities |
|------|------------------|
| Demand & Supply Team | Create targets, model/article allocation, submit for review, finalize |
| B2B Director | Approve or request changes |
| Managing Director | Final approval |
| National Performance Manager | Allocate retail targets to Sales Offices |
| Branch Manager | Allocate to Sales Executives, run reconciliation |

## Quick Start (Local)

### 1. Clone and install

```bash
cd autoplan-targets
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run:
   - `supabase/schema.sql` (creates tables, RLS, triggers)
   - `supabase/seed.sql` (creates users, sample data, in-progress cycle)
   - If login fails with "Database error querying schema", also run `supabase/fix-auth-users.sql`
3. Enable **Email** auth provider in Authentication → Providers
4. Copy your project URL and anon key from Settings → API

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Project URL only — do NOT append /rest/v1/
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEV_MODE=true
```

Set `NEXT_PUBLIC_DEV_MODE=true` to enable the **Switch User** dropdown in the header for instant role switching during demos.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Users

| Role | Email | Password |
|------|-------|----------|
| Demand & Supply Team | demand@autoplan.com | password123 |
| B2B Director | b2bdirector@autoplan.com | password123 |
| Managing Director | md@autoplan.com | password123 |
| National Performance Manager | npm@autoplan.com | password123 |
| Branch Manager | branchmanager@autoplan.com | password123 |

## Dev Mode: Switch User

When `NEXT_PUBLIC_DEV_MODE=true`, a yellow **Switch User** dropdown appears in the page header. Select any demo user and click **Switch** to instantly sign in as that role without logging out — ideal for walking through the full workflow in presentations.

## Sample Data

The seed script creates a **June 2026** planning cycle at `reconciliation_failed` status with:

- **Brands:** Toyota, Lexus, Honda
- **Sales Groups:** Retail, Fleet, Corporate Fleet
- **Models:** Corolla, Camry, Prado, Civic, Accord
- **Sales Offices:** Dubai, Abu Dhabi, Sharjah
- **Sales Executives:** Ahmed Hassan, Sarah Khan, John Mathew, Ali Raza, Fatima Noor
- Intentional 5-unit reconciliation mismatch for demo

## Reconciliation Rule

```
SUM(Model Targets for Retail) = SUM(Sales Office Targets) = SUM(Executive Allocations)
```

On failure: notification sent to Branch Manager, allocations can be updated, reconciliation re-run.
On success: planning period marked **Completed**.

## Deployment (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_DEV_MODE=false` (disable switch user in production)
4. Deploy

### Supabase for production

- Run `schema.sql` and `seed.sql` on your production Supabase project
- Add your Vercel deployment URL to Supabase **Authentication → URL Configuration** (Site URL + Redirect URLs)

## Project Structure

```
app/
  (dashboard)/          # Protected routes with sidebar
    dashboard/          # Role-based home
    targets/            # Brand & sales group targets
    model-allocations/
    article-allocations/
    approvals/b2b/
    approvals/md/
    finalize/
    retail-allocations/
    executive-allocations/
    reconciliation/
    notifications/
    audit/
  api/                  # Workflow, allocations, reconciliation
  login/
components/
  ui/                   # shadcn-style components
  layout/               # Sidebar, header, dev switch user
lib/
  supabase/             # Client, server, middleware
  auth.js               # Role-based nav & access
  workflow.js           # Status transitions & reconciliation
supabase/
  schema.sql
  seed.sql
```

## License

MIT

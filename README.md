# AutoPlan Targets (MVP)

Monthly target planning and allocation workflow for automotive sales teams.

## Tech Stack

- **Next.js 15** (App Router)
- **React** + **JavaScript**
- **Tailwind CSS**
- **Local JSON storage** (no cloud database required for the MVP)

Master data (divisions, sales groups, sales offices, models) lives in `src/data/` and is ready to swap for SQL/API later.

## Quick Start

```bash
cd autoplan-targets
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

On first run the app creates `data/local-db.json` with demo users and draft plans.

## Demo Users

| Role | Email | Password |
|------|-------|----------|
| Demand & Supply Team | demand@autoplan.com | password123 |
| B2B Director | b2bdirector@autoplan.com | password123 |
| Managing Director | md@autoplan.com | password123 |
| National Performance Manager | npm@autoplan.com | password123 |
| Branch Manager | branchmanager@autoplan.com | password123 |

Set `NEXT_PUBLIC_DEV_MODE=true` to enable the **Switch User** dropdown.

## Target Entry Workflow

1. Select **Division** (Toyota / Honda)
2. Select **Month**
3. Select **Sales Group** (full sales-group master list)
4. **Generate Grid**
   - Toyota → Model × Sales Office
   - Honda → Model only (configurable via `src/data/gridConfig.js`)

## Local Data

| Path | Purpose |
|------|---------|
| `src/data/` | Master data (divisions, sales groups, offices, executives, models) |
| `data/local-db.json` | Local runtime store (auto-created; gitignored) |
| `lib/local-db/` | Local database + session auth |

**Vercel:** Master data from `src/data/` ships with the deploy. Runtime plans/targets use in-memory storage (+ `/tmp`). Cold starts reset transactional data to the seeded demo state — fine for MVP demos. Reset local demo data by deleting `data/local-db.json` and restarting.

## Deployment (Vercel)

```bash
npx vercel@latest --prod --yes
```

Environment variables (optional):

- `NEXT_PUBLIC_DEV_MODE=true` — enable Switch User

No Supabase keys required.

## Roles & Workflow

| Role | Responsibilities |
|------|------------------|
| Demand & Supply Team | Create plans/targets, submit, finalize |
| B2B Director | Approve or request changes |
| Managing Director | Final approval |
| National Performance Manager | Allocate retail targets to sales offices |
| Branch Manager | Allocate to sales executives, reconciliation |

## License

MIT

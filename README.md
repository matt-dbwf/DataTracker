# DataTracker

Svelte 5 + Vite frontend for the DataTracker Supabase project.

## Current UI

- Supabase email/password authentication
- Employee profile lookup using `Employees.id_User = auth.uid()`
- Jobs list
- Create and delete Jobs
- Job detail page
- Create and delete Pours
- `stageNum` is assigned automatically by PostgreSQL
- Creator IDs are assigned automatically by PostgreSQL
- Creator names can be displayed from the Employees relationship

## Supabase environment

Copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put a Supabase `service_role` or secret key in this frontend.

## Install

```bash
npm install
npm run dev
```

## Expected database schema

### Employees
- `id` uuid
- `nameFirst` text
- `nameLast` text
- `email` text
- `id_User` uuid -> `auth.users.id`
- `created_at` timestamptz

### Jobs
- `id` uuid
- `seq` sequential number
- `id_Employee` uuid -> `Employees.id`
- `created_at` timestamptz

Expected foreign-key name for the employee relationship: `jobs_employee_fk`.

### Pours
- `id` uuid
- `id_Job` uuid -> `Jobs.id`
- `stageNum` integer, assigned automatically per Job
- `id_Employee` uuid -> `Employees.id`
- `created_at` timestamptz

Expected foreign-key name for the employee relationship: `pours_employee_fk`.

## Authentication workflow

DataTracker follows the same principle as PSM:

1. User signs in with Supabase Auth.
2. `auth.uid()` identifies the Supabase user.
3. `Employees.id_User` links that user to an Employee row.
4. Database triggers translate that user into `Employees.id` when creating Jobs and Pours.
5. The frontend does not send `id_Employee` when creating records.

## Important

The frontend assumes your Supabase RLS policies allow authenticated employees to perform the intended Jobs and Pours operations. If RLS is enabled without policies for those tables, reads/inserts/deletes will be rejected by Supabase.

## Phases and Dates UI

This version adds a Phases navigation section with list/detail/create views. Pour detail pages can create related Dates records by selecting a Phase plus start/finish dates. It expects the existing `public."Phases"` and `public."Dates"` tables and appropriate authenticated-user Supabase permissions/RLS policies.

## Dates completion workflow

The Pour detail Dates list uses `Dates.flag_Complete`.

- Only incomplete Dates are displayed.
- Only the earliest incomplete Date per Phase is shown.
- Display order is Phase `sort` ascending, then `dateStart` ascending.
- Checking Complete updates `flag_Complete` to `true`; the next incomplete Date for that Phase then becomes visible automatically.

Required database migration (run once if not already applied):

```sql
begin;
alter table public."Dates"
add column if not exists "flag_Complete" boolean not null default false;
commit;
```

## Pour detail Date history

The Dates table on Pour detail shows the first incomplete Date per Phase by default. Use **Show All** on a Date row to expand every Date for the same Pour + Phase combination, including completed records. Expanded history is ordered by `dateStart`.


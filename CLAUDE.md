# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build (outputs to dist/)
npm run lint      # ESLint (flat config, React + Hooks rules)
npm run preview   # Preview production build locally
```

No test runner is configured.

## Architecture

React 18 + Vite frontend with Supabase (PostgreSQL, Auth, Storage) as the backend. No custom API server — all data access goes directly from the browser to Supabase via `@supabase/supabase-js`.

### Auth Flow

`AuthContext` wraps the entire app. Supports **Google OAuth** via Supabase Auth and uses `prompt: "select_account"` to force account picker on every login (prevents auto-reuse of previous credentials).

On login:
1. `tryAutoMatch()` checks if user's email prefix (netid) matches an unclaimed `student_roster` row.
2. If matched: claims roster row, backfills profile (name, netid, student_id), auto-joins team.
3. If no match: shows **NetID prompt modal** asking the user to enter their netid manually.
4. Admins skip the netid prompt entirely (`profile.role === 'admin'`).
5. Manual `claimNetid(netid)` tries matching again with the entered value.
6. Users can skip the prompt and join a team manually from the sidebar.

Admin detection: `profile.role === 'admin'` in the `profiles` table. Admin must set this manually in Supabase after first login.

### Data Model

The app tracks weekly cycles per team (13 teams, ~73 students). Core tables:

- `teams` → `team_weeks` (one row per week per team) → `weekly_reports` (one per week, stores comments + team_leader_week)
- `teams.documents` — JSONB array of team-level documents: `[{label, file_path, type, uploaded_at}]`
- `teams` → `team_memberships` (FK: `user_id` references `profiles.id`) → `profiles` (auth users)
- `student_roster` (CSV-imported, matched to profiles via netid, has `team_index` 1-13)
- `attendance_records` (per-student per-week status: P/A/Excused)
- `team_ratings` (Excellent/Good/Ok/Bad per team per week)
- `student_effort_points` (hours + contribution_points per student per team per week)
- `semester_config` (single row: start_date, holiday_weeks array, total_weeks)

All table IDs are `bigint GENERATED ALWAYS AS IDENTITY` (not UUID) — critical for foreign keys and upserts.

Documents are stored in Supabase Storage bucket `weekly-reports` at path `teams/{teamCode}/docs/{timestamp}-{filename}`, accessed via signed URLs (10-minute expiry). Metadata is in `teams.documents` JSONB column.

### Database Schema — Key Column References

| Table | Column | References | Notes |
|-------|--------|-----------|-------|
| `team_memberships` | `user_id` | `profiles.id` | **NOT `profile_id`** — use `user_id` in all queries |
| `team_memberships` | `team_id` | `teams.id` | |
| `weekly_reports` | `submitted_by` | `profiles.id` | Auth user who submitted |
| `weekly_reports` | `week_id` | `team_weeks.id` | |
| `student_roster` | `matched_profile_id` | `profiles.id` | Set when student claims roster row |
| `student_effort_points` | `recorded_by` | `profiles.id` | |
| `team_ratings` | `rated_by` | `profiles.id` | |
| `profiles` | `role` | — | Enum: `'student'` (default), `'admin'` |

### Row-Level Security (RLS)

All tables have RLS enabled in Supabase. Policies are managed in the Supabase dashboard (not in code). Key policies needed:

- **`weekly_reports` INSERT**: `submitted_by = auth.uid()` AND (user is team member via `team_memberships.user_id` OR user is admin)
- **`weekly_reports` UPDATE**: Same as INSERT — team member or admin
- **`weekly_reports` SELECT**: Authenticated users can read reports for their team; admins can read all
- Other tables follow similar patterns: team members can read/write their own data, admins can access everything

### State Management

Custom hooks encapsulate all Supabase queries:

- **`useAuth`** — consumes `AuthContext` (user, profile, isAdmin, sessionChecked, loading, needsNetid, login/logout, claimNetid, skipNetid, updateProfile)
- **`useTeams`** — teams list, active team (myTeam), team members + roster members, join team, loadTeamMembers, loadRosterMembers
- **`useWeeks`** — week timeline, selected week, editingReport (comments + team_leader_week), save week, per-week PDF download
- **`useWeekPanel`** — per-week attendance (P/A/Excused), effort points (hours), contribution points (1-10), team rating, roster students for WeekDetailPanel. Debounces effort/contribution writes (300ms).
- **`useMetrics`** — aggregated analytics for Metrics page: per-student stats, weekly averages, effort distribution, attendance summaries, rating counts, contribution averages
- **`useSemesterConfig`** — semester start date, holiday weeks, total weeks, auto-computed week date ranges, add/remove weeks, toggle holidays
- **`weekPdf` util** — shared PDF renderer for per-team weekly PDFs + stitched exports (`src/utils/weekPdf.js`)

### Page Structure

| Route | Page | Access |
|-------|------|--------|
| `/` and `/:teamCode` | Home — team dashboard, weekly timeline, week detail editor (team can be deep-linked by code, e.g. `/t4`) | All authenticated |
| `/weekly` | Weekly Export — select a week and download **one stitched PDF** for all teams | Admin only |
| `/admin` | Admin — team CRUD, member management, CSV import, semester config | Admin only |
| `/grades` | Grades — auto-generated weighted grades for all students | Admin only |
| `/metrics` | Metrics — recharts charts, effort tables, satisfaction ratings | Admin only |

Non-Home pages are wrapped in `PageLayout` (provides persistent TopNav + Sidebar). Home uses `AppShell` directly.

### Permissions

- **Students** can: view project details and team documents (read-only), edit team leader and comments per week, view uploaded documents.
- **Admins** can: everything students can plus edit project details, upload/delete team documents, mark attendance, enter effort/contribution points, set team satisfaction rating, manage teams, import CSV, configure semester, view grades and metrics.
- The `isAdmin` flag gates all admin-only UI. In Home.jsx, admin-only callbacks (attendance, effort, contribution, rating, doc upload/delete) are passed as `null` to students, which hides those sections.

### Component Tree

```
App (AuthProvider + BrowserRouter)
└── AppRoutes
    ├── Home (AppShell)
    │   ├── TopNav
    │   ├── Sidebar (team selector, join team)
    │   ├── ProjectCard (project details + team documents)
    │   ├── TeamMembersList
    │   ├── WeekTimeline (date-based coloring: past/current/future)
    │   └── WeekDetailPanel (team leader + comments + admin sections)
    ├── Admin (PageLayout) — tabs: Teams, CSV Import, Semester Config
    │   └── CsvImportPanel
    ├── Grades (PageLayout) — sortable table, weight sliders, team filter
    ├── Metrics (PageLayout) — LineChart, PieChart, BarChart, effort table
    └── Weekly (PageLayout) — week selector, stitched PDF export (all teams)
```

Additional components: `Modal`, `Toast`, `LoadingSpinner`, `EmptyState`, `ProfileCard`, `ProfileEditModal`, `AttendanceCell`, `AttendanceTable`.

### CSS Organization

Eight feature-scoped CSS files imported in `main.jsx` (no CSS modules or preprocessor):

- `variables.css` — design tokens (colors, spacing, radii, font sizes)
- `layout.css` — app shell, topnav, sidebar, login page (Google + Microsoft icons)
- `components.css` — buttons (.btn--*), form fields (.field-*), cards, modals, toast, member cards
- `timeline.css` — week timeline nodes (date-based: past/current/future/holiday), week detail panel (attendance grid, effort inputs, rating buttons)
- `project.css` — project card, links editor, team documents list
- `attendance.css` — grades page table/stats/weights, CSV import panel
- `admin.css` — admin page layout, team rows, member panels, semester config grid
- `metrics.css` — metrics dashboard, chart containers, effort table, rating chips

All styles use BEM-inspired class naming. Design tokens are CSS custom properties on `:root`.

### Key Patterns

- `weekly_reports` uses `team_leader_week` (not `team_leader`) and `comments` — only these two fields are actively used
- `weekly_reports` upsert uses `onConflict: "team_id,week_id"` — **never include `id` in upsert payload** (causes PK conflict)
- `student_roster.team_index` is integer 1-13; teams have `code` like "T1" — lookup via `teams.code.match(/T(\d+)/i)`
- The `links` column on `teams` is JSONB: `[{label, url, hasAccess}]` — `hasAccess` (boolean) tracks whether admin has access to each link
- The `documents` column on `teams` is JSONB: `[{label, file_path, type, uploaded_at}]` — team-level document storage
- Documents stored in Storage at `teams/{teamCode}/docs/{timestamp}-{filename}`, opened inline via signed URLs
- Week timeline uses date-based coloring: green (past), blue (current week), gray (future), yellow (holiday) — no status concept
- Download All ZIPs all team documents from `teams.documents`
- Weekly export (`/weekly`) generates **one PDF for a selected week** containing all teams (page breaks between teams, placeholder page when a team has no submission)
- Effort/contribution inputs debounce writes (300ms via useRef timers); attendance and ratings save on click
- `recharts` is used for data visualization (LineChart, PieChart, BarChart) on the Metrics page
- WeekDetailPanel includes: team leader dropdown (from roster), comments, satisfaction rating buttons, inline attendance grid (P/A/E), effort + contribution inputs per student — admin sections gated behind `isAdmin`
- Grades page auto-calculates letter grades via weighted formula: (Attendance% x W1 + Hours% x W2 + Contribution% x W3) / totalWeight. Weights and the Grade Scale percentage thresholds are both admin-adjustable via the UI. Excused marks are counted as Present for attendance rate calculations.
- `student_effort_points` stores both `effort_points` (hours) and `contribution_points` (1-10 scale) — upserted together via `onConflict: 'student_netid,team_id,week_number'`
- CSV import uses check-then-insert: queries existing netids first, only inserts new students (never overwrites existing). Auto-creates teams T1-T13 if missing.
- Semester config: `computeWeekDates(startDate, holidays)` in constants.js generates date ranges for timeline labels
- Auth uses `prompt: "select_account"` for Google login to force a fresh account picker on each login
- `logout()` uses `scope: "local"` to clear only the browser session

## Environment

Requires `.env` with:
```
VITE_SUPABASE_URL=<supabase project url>
VITE_SUPABASE_ANON_KEY=<supabase anon key>
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client (DB, Auth, Storage) |
| `react` / `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `recharts` | Data visualization (charts) |
| `jspdf` | PDF generation for downloads |
| `jszip` | ZIP archive generation |

# CS 4485 — Weekly Progress Tracker

A TA management tool for tracking weekly progress of senior design project teams at UT Dallas. Built for Prof. Alagar's CS 4485 course — manages 13 teams (~73 students) across a configurable semester cycle.

## Features

### Weekly Tracker (Student View)
- **Horizontal week timeline** — date-based coloring: green (past), blue (current), gray (future), yellow (holiday)
- **Weekly report fields** — team leader dropdown, comments
- **Per-week download** — download individual week reports as PDF
- **Team documents** — view uploaded team documents in a new browser tab
- **Read-only project details** — students see project info but cannot edit

### Weekly Tracker (Admin/TA Tools)
- **Attendance marking** — mark each student P (Present), A (Absent), or E (Excused) directly in the week panel
- **Effort tracking** — log hours worked per student per week
- **Contribution scoring** — rate each student's contribution on a 1-10 scale
- **Team satisfaction rating** — rate team performance as Excellent, Good, Ok, or Bad
- **Team leader dropdown** — select the week's team leader from the student roster
- **Editable project details** — title, overview, meeting link/time, project links with open button
- **Team document management** — upload, view, and delete team-level documents (stored in Supabase Storage under `teams/{code}/docs/`)
- **Download all documents** — export all team documents as a ZIP archive
- **Weekly Export (all teams)** — pick a week and download **one stitched PDF** containing that week’s report for every team (placeholder page for missing submissions)
- **Link access tracking** — toggle button per link to mark whether you have access (green) or not (gray), persisted in the database
- **Roster management** — add, move, or remove students from team rosters directly in the admin panel

### Grades Page (Admin)
- **Auto-generated letter grades** — calculated from attendance rate, avg hours, and contribution scores
- **Configurable weights** — admin-adjustable sliders for how much each metric counts (default: 30% attendance, 30% hours, 40% contribution)
- **Sortable table** — sort all students by name, team, or grade
- **Team filtering** — filter the grades view by team
- **Grade formula** — (Attendance% x W1 + Hours% x W2 + Contribution% x W3) / total weight, mapped to A+ through F. Excused marks are counted as Present.

### Metrics Page (Admin)
- **Weekly trends line chart** — avg hours + attendance rate over weeks (recharts)
- **Effort distribution pie chart** — hours per student visualization
- **Attendance overview bar chart** — stacked Present/Absent/Excused per week
- **Satisfaction timeline** — week-by-week team rating chips with inline editing
- **Effort points table** — editable spreadsheet-style hours + contribution per student
- **Student analytics table** — name, total hours, avg hours, attendance rate, weeks active

### Admin Dashboard
- **Team management** — create/edit/delete teams, manage team members
- **CSV import** — bulk import student roster from CSV; existing students are preserved (never overwritten); auto-creates teams T1-T13 from roster data
- **Member management** — view team members, roster students, linked profiles
- **Semester configuration** — set semester start date, mark holiday weeks (e.g. Spring Break), configure total weeks, auto-calculated week date ranges

### Authentication
- **Google OAuth** — sign in with Google accounts via Supabase Auth
- **Account picker** — always prompts for account selection on login (no auto-reuse of previous credentials)
- **Auto-matching** — students auto-join their team on first login (NetID matched from email prefix to `student_roster`)
- **NetID prompt** — if auto-match fails, prompts user to manually enter their NetID (used for roster matching only; NetIDs are not shown in the main UI)
- **Admin bypass** — admins skip the NetID prompt (set role in Supabase directly)
- **Role-based access** — admin pages (Grades, Metrics, Admin) restricted to `profile.role === 'admin'`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6 |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Charts | recharts |
| PDF Generation | jsPDF |
| ZIP Archives | JSZip |
| Styling | Vanilla CSS with BEM naming + CSS custom properties |

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <repo-url>
cd "CS-4485 - Weekly Tracker"
npm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project dashboard under **Settings > API**.

### 3. Set up Supabase

#### Authentication

1. In Supabase dashboard, go to **Authentication > Providers**
2. Enable the **Google** provider — add your Google OAuth client ID and secret
3. Set the redirect URL to your app's URL (e.g., `http://localhost:5173`)

#### Database Tables

Run these SQL statements in the Supabase SQL editor:

```sql
-- Enum types
CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE team_role AS ENUM ('member', 'leader');
CREATE TYPE report_status AS ENUM ('pending', 'submitted', 'reviewed', 'late');

-- Profiles (auto-created on auth signup via trigger)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  first_name text,
  last_name text,
  netid text,
  student_id text,
  role user_role DEFAULT 'student',
  created_at timestamptz DEFAULT now()
);

-- Teams
CREATE TABLE teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  code text UNIQUE,
  project_title text,
  project_overview text,
  links jsonb DEFAULT '[]',
  documents jsonb DEFAULT '[]',
  meeting_link text,
  meeting_time text,
  total_weeks integer NOT NULL DEFAULT 11,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Team memberships
CREATE TABLE team_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role team_role DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Team weeks (one per week per team)
CREATE TABLE team_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  start_date date,
  end_date date,
  goal text,
  request text,
  UNIQUE(team_id, week_number)
);

-- Weekly reports
CREATE TABLE weekly_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  week_id bigint REFERENCES team_weeks(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES profiles(id),
  file_path text,
  status report_status DEFAULT 'submitted',
  comments text,
  team_leader_week text,
  mom_meeting text,
  work_done text,
  links jsonb DEFAULT '[]',
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(team_id, week_id)
);

-- Student roster (CSV imported)
CREATE TABLE student_roster (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  netid text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  team_index integer NOT NULL,
  section_number integer,
  matched_profile_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Attendance records
CREATE TABLE attendance_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_netid text NOT NULL,
  team_index integer NOT NULL,
  week_number integer NOT NULL,
  status text NOT NULL DEFAULT '',
  recorded_at timestamptz DEFAULT now(),
  UNIQUE(student_netid, week_number)
);

-- Student effort points
CREATE TABLE student_effort_points (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_netid text NOT NULL,
  team_id bigint NOT NULL REFERENCES teams(id),
  week_number integer NOT NULL,
  effort_points numeric NOT NULL DEFAULT 0,
  contribution_points numeric NOT NULL DEFAULT 0,
  recorded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_netid, team_id, week_number)
);

-- Team ratings
CREATE TABLE team_ratings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id bigint NOT NULL REFERENCES teams(id),
  week_number integer NOT NULL,
  rating text NOT NULL CHECK (rating IN ('Excellent', 'Good', 'Ok', 'Bad')),
  rated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, week_number)
);

-- Semester configuration (single row)
CREATE TABLE semester_config (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_key text UNIQUE NOT NULL DEFAULT 'current',
  start_date date NOT NULL DEFAULT '2025-03-01',
  holiday_weeks jsonb DEFAULT '[]',
  total_weeks integer DEFAULT 11,
  created_at timestamptz DEFAULT now()
);
```

#### Row-Level Security (RLS)

Enable RLS on all tables, then add policies. Example for `weekly_reports`:

```sql
-- Enable RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Allow team members and admins to insert reports
CREATE POLICY "Allow insert weekly_reports"
ON weekly_reports FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND (
    team_id IN (SELECT team_id FROM team_memberships WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- Allow team members and admins to update reports
CREATE POLICY "Allow update weekly_reports"
ON weekly_reports FOR UPDATE TO authenticated
USING (
  team_id IN (SELECT team_id FROM team_memberships WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow authenticated users to read reports
CREATE POLICY "Allow select weekly_reports"
ON weekly_reports FOR SELECT TO authenticated
USING (true);
```

Apply similar RLS policies to all other tables as needed.

#### Storage

1. Create a storage bucket named `weekly-reports`
2. Set it to **private** (signed URLs are used for access)
3. Add a storage policy allowing authenticated users to upload/read/delete

### 4. Run the app

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### 5. Set up admin access

After your first Google/Microsoft login, update your profile role in Supabase:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@utdallas.edu';
```

No NetID is required for admin accounts — the NetID prompt is automatically skipped.

### 6. Configure semester dates

1. Navigate to `/admin`
2. Click the **Semester Config** tab
3. Set the start date for Week 1 (e.g., `2025-03-01`)
4. Click any week card to toggle it as a **Holiday** (e.g., Spring Break)
5. Click **Save Config** — all week dates auto-calculate from the start date

### 7. Import student roster

1. Navigate to `/admin`
2. Click the **Import Students** tab
3. Upload a CSV file with the student roster
4. CSV format: `Team Index, Last Name, First Name, NetID, Section Number, Pitch Deck, Week1, Week2, ...`
5. Teams T1-T13 are auto-created from the CSV data
6. Existing students (by NetID) are preserved — only new students are added

## How Students Log In

1. Student visits the app and clicks **Sign in with Google**
2. If their email prefix (netid) matches a `student_roster` entry, they're auto-joined to their team
3. If no match, they're prompted to enter their NetID manually (used only for matching to the roster)
4. If their NetID is in the roster, they're matched and auto-joined
5. If not in the roster, they can skip and join a team manually from the sidebar

## Development

```bash
npm run dev       # Start dev server with HMR (port 5173)
npm run build     # Production build to dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## Project Structure

```
src/
  App.jsx           Main app wrapper (AuthProvider + Router)
  main.jsx          Vite entry point (CSS imports + React root)
  contexts/         AuthContext (Google OAuth, netid prompt, auto-match)
  hooks/            useAuth, useTeams, useWeeks, useWeekPanel, useMetrics, useSemesterConfig
  pages/            Home, Admin, Grades, Metrics, Weekly (admin stitched PDF export)
  components/
    layout/         AppShell, TopNav, Sidebar, PageLayout
    dashboard/      WeekTimeline, WeekDetailPanel
    project/        ProjectCard, TeamMembersList
    profile/        ProfileCard, ProfileEditModal
    admin/          CsvImportPanel
    attendance/     AttendanceCell, AttendanceTable
    common/         Modal, Toast, LoadingSpinner, EmptyState
  routes/           AppRoutes (legacy; main routing is in `App.jsx`)
  styles/           8 feature-scoped CSS files (BEM naming + CSS custom properties)
  utils/            supabaseClient, constants (computeWeekDates), csvParser, weekPdf
```

## Migration Notes

If upgrading from an earlier version:

```sql
-- Add contribution points column if not exists
ALTER TABLE student_effort_points
ADD COLUMN IF NOT EXISTS contribution_points numeric NOT NULL DEFAULT 0;

-- Add team-level documents column
ALTER TABLE teams ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]';

-- Create semester config table
CREATE TABLE IF NOT EXISTS semester_config (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_key text UNIQUE NOT NULL DEFAULT 'current',
  start_date date NOT NULL DEFAULT '2025-03-01',
  holiday_weeks jsonb DEFAULT '[]',
  total_weeks integer DEFAULT 11,
  created_at timestamptz DEFAULT now()
);
```

## License

Private project for UT Dallas CS 4485 Senior Design.

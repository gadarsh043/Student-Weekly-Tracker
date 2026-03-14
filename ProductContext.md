# Product Context: CS-4485 Weekly Tracker

## Overview
The **CS-4485 Weekly Tracker** is a React-based web application designed to help university students and course instructors (admins) manage team projects, track weekly progress, and handle assignment submissions. It serves as a centralized dashboard where teams can document their weekly milestones and instructors can effortlessly review or bulk-download their work.

## Core Features

### 1. Authentication & User Roles
- **Google OAuth Login**: Users sign in seamlessly using their Google accounts via Supabase Auth.
- **Roles**:
  - **Student**: Can join a single team, view their team's dashboard, update project details, and submit weekly reports.
  - **Admin (Instructors/TAs)**: Has a dedicated admin portal to manage all teams, view any team's progress without joining, create new teams, manage memberships, and download bulk data. Users are designated as admins via the database.
- **Profile Management**: Users can update their personal information, such as First Name, Last Name, NetID, and Student ID.

### 2. Team Management
- **Student Flow**: Upon logging in, students can view a list of active teams and choose one to join. Once in a team, they see their specific team dashboard.
- **Admin Flow**: Admins can create new teams (which automatically provisions 11 week slots), generate join codes, edit team names, toggle team visibility (active/inactive), and manually add or remove students from teams. 
- **Project Details**: Each team has configurable fields for Project Title, Overview, Meeting Link, and Meeting Time (meeting logistics are restricted to admin editing).

### 3. Weekly Tracking & Reporting
The core functionality revolves around a structured, semester-based week timeline for each team.
- **Week Timeline**: Horizontal, date-aware timeline (typically 11 weeks) with colors driven by semester config:
  - Past weeks — green
  - Current week — blue
  - Future weeks — gray
  - Holiday weeks — yellow
- **Weekly Editing (Students)**:
  - **Team Leader (this week)** — dropdown populated from the team roster.
  - **Comments** — freeform notes for that week.
- **Weekly Admin View**:
  - **Attendance** — P/A/Excused per student for the selected week (Excused counts as Present for grading).
  - **Effort Points** — hours worked per student for that week.
  - **Contribution Score** — 1–10 per student.
  - **Team Satisfaction Rating** — Excellent / Good / Ok / Bad.
- **Per-Week PDF**:
  - Admins can download a **single-page PDF** for any team + week that includes:
    - Course link for that team (e.g. `.../t4`) as a clickable “Link”.
    - Team code and project title.
    - Project overview, meeting link (as “Link”), and meeting time.
    - Team links rendered as `(Label) [Link]`.
    - Weekly comments.
    - **Grades Page (Admin)**: Computed final grades using weighted formula (Attendance, Hours, Contribution); weights and Grade Letter thresholds are manually editable in the UI. Hours are scored against a 10-hour target.
    - Per-student snapshot for that week (hours, attendance, contribution).
    - Student analytics **through that week** (cumulative total/avg hours, attendance rate) plus a compact metrics footer.

### 4. Admin Data Export
- **Team Documents ZIP** — from the team dashboard, admins can download all team-level documents as a ZIP (files stored under `teams/{teamCode}/docs/...` in Supabase Storage).
- **Per-Week PDF Export** — as described above, per-team, per-week PDFs are designed to be easy to archive or share with stakeholders.
- **Weekly Export (All Teams)** — admins can select a week and download **one stitched PDF** containing that week’s report for every team (with placeholder pages for missing submissions).

## Technical Architecture

- **Frontend Framework**: React 18 using Vite.
- **Routing**: `react-router-dom` with distinct views for `/` (Student/Team Dashboard), `/admin` (Admin Dashboard), and `/weekly` (Admin Weekly Export).
- **Backend/BaaS**: **Supabase**
  - **Database (PostgreSQL)**: Handles tables for `profiles`, `teams`, `team_memberships`, `team_weeks`, and `weekly_reports`.
  - **Auth**: Manages user sessions and OAuth providers.
  - **Storage**: Provides secure bucket (`weekly-reports`) for handling PDF uploads, generating signed URLs for viewing, and deleting files.
- **Utilities**: 
  - `jsPDF`: Client-side PDF generation for exporting weekly textual data.
  - `jszip`: Creating `.zip` archives client-side for the "Download All" feature.

## Conclusion
The CS-4485 Weekly Tracker provides a streamlined, full-stack solution for academic project management. By offloading auth and data storage to Supabase, the frontend can focus on delivering a comprehensive dashboard experience, facilitating clear communication and structured reporting between student teams and course instructors.

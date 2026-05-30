# SmartClass — Integrated Academic Platform

SmartClass is an elegant, premium, and highly responsive role-based academic platform built from the ground up to streamline school and university administration. Empowering students, teachers, representatives, and administrators alike, the platform features a sleek dashboard experience, a dynamic visual timetable, real-time alert systems, and an integrated AI Student Assistant.

---

## 🌟 Key Features

### 🔐 Multi-Role Authentication & Row-Level Security (RLS)
Securely configured role-based dashboards utilizing **Supabase Auth & PostgreSQL** schema design with strict row-level security.
* **Super Admin**: System-wide operations, global user directory, department scaling, and high-level platform insights.
* **Department Admin**: User approval flows, programmatic timetable alignments, and course assignations.
* **Teacher**: Sleek interactive attendance journals, grading interfaces, syllabus uploads, and class overview boards.
* **Student**: Consolidated performance metrics, visual timetables, custom study planners, and alerts.
* **Class Representative (CR)**: Special tools to manage group schedules, raise announcements, and sync agendas.

### 🧠 Student AI Assistant
An AI study buddy embedded directly into the Student dashboard. Designed to provide instant contextual help, academic planning tips, schedule analysis, and study notes summarization.

### 📅 Dynamic Visual Timetable
Beautifully laid out, color-coded interactive timetable grids. Updates are propagated immediately to students based on schedule changes made by Department Admins or authorized Class Representatives.

### 🔔 Real-Time Alerts & Notification Center
Integrated real-time listeners subscribing to Postgres Changes via Supabase. Important announcements, schedule adjustments, or attendance flags trigger smooth, non-intrusive toast notifications.

---

## 🛠️ Tech Stack

* **Frontend Framework**: [React (v18)](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build System**: [Vite](https://vitejs.dev/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Iconography**: [Lucide React](https://lucide.dev/)
* **Database & Auth**: [Supabase](https://supabase.com/) (Postgres, Real-time Subscriptions, Row-Level Security)

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18.x or above is recommended).

### 2. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and add your Supabase project credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup (Migrations)
Apply the database migrations to your Supabase instance to create the necessary tables, triggers, and seed demo data:
1. Run the migration scripts found in `supabase/migrations/` sequentially inside your Supabase SQL Editor.
2. The schema seeds mock credentials automatically for quick testing of every role:
   * **Super Admin**: `superadmin@smartclass.com` / `password`
   * **Teacher**: `teacher@smartclass.com` / `password`
   * **Student**: `student@smartclass.com` / `password`

### 5. Running the Application
Launch the local development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 📁 Project Structure

```text
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── supabase/
│   └── migrations/           # Database schemas, RLS policies, & seed files
└── src/
    ├── main.tsx              # Application entry point
    ├── App.tsx               # Main routing & state layout
    ├── index.css             # Base styles & global Tailwind utilities
    ├── components/
    │   └── ui/               # Reusable base components (Modal, Avatar, Badge, etc.)
    ├── config/
    │   └── supabase.ts       # Supabase client instantiation
    ├── features/             # Feature-based folder architecture
    │   ├── auth/             # Login, Registration & Approval logic
    │   ├── class-rep/        # Representative schedules & notifications
    │   ├── dept-admin/       # Administrative management & user directories
    │   ├── shared/           # Timetables, Alerts, & global components
    │   ├── student/          # AI Study Assistant & personal dashboards
    │   ├── super-admin/      # Global settings & platform analytics
    │   └── teacher/          # Attendance, Grading & Class logs
    ├── hooks/                # Custom React hooks (useAuth, useRealtime)
    └── types/                # Strict TypeScript interfaces & definitions
```
# smart-class-project

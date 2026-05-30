-- New SmartClass schema migration created on 2026-05-30
-- This migration defines the core database schema for the app.

create extension if not exists "uuid-ossp";

create table departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique not null,
  created_at timestamptz not null default now()
);

create table levels (
  id uuid primary key default uuid_generate_v4(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  year int not null,
  created_at timestamptz not null default now()
);
create unique index levels_department_year_unique on levels(department_id, year);

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  role text not null check(role in ('student', 'class_rep', 'teacher', 'dept_admin', 'super_admin')),
  department_id uuid references departments(id) on delete set null,
  level_id uuid references levels(id) on delete set null,
  approval_status text not null default 'pending' check(approval_status in ('pending', 'approved', 'rejected')),
  device_fingerprint text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_department_idx on profiles(department_id);
create index profiles_level_idx on profiles(level_id);

create table courses (
  id uuid primary key default uuid_generate_v4(),
  level_id uuid not null references levels(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  code text not null,
  name text not null,
  teacher_id uuid references profiles(id) on delete set null,
  credit_units int not null default 3,
  created_at timestamptz not null default now()
);
create unique index courses_department_code_unique on courses(department_id, code);
create index courses_teacher_idx on courses(teacher_id);

create table classes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  capacity int not null default 30,
  rep_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index classes_course_idx on classes(course_id);

create table timetable (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  day_of_week int not null check(day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  venue text not null,
  recurrence text,
  created_at timestamptz not null default now()
);
create index timetable_class_day_idx on timetable(class_id, day_of_week);

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  timetable_id uuid references timetable(id) on delete set null,
  class_id uuid not null references classes(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  venue text not null,
  qr_token text unique not null,
  qr_expires_at timestamptz,
  is_active boolean not null default true,
  is_makeup boolean not null default false,
  created_at timestamptz not null default now()
);
create index sessions_course_date_idx on sessions(course_id, session_date);

create table class_enrollments (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);
create index class_enrollments_student_idx on class_enrollments(student_id);

create table attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  status text not null check(status in ('early', 'present', 'late', 'absent')),
  scanned_at timestamptz not null default now(),
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  device_fingerprint text,
  unique (session_id, student_id)
);
create index attendance_student_idx on attendance(student_id);
create index attendance_session_idx on attendance(session_id);

create table alerts (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'medium' check(priority in ('low', 'medium', 'high', 'critical')),
  type text not null default 'general',
  course_id uuid references courses(id) on delete set null,
  is_read boolean not null default false,
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index alerts_recipient_idx on alerts(recipient_id);

create table materials (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_size int not null,
  processing_status text not null default 'pending' check(processing_status in ('pending', 'processing', 'processed', 'failed')),
  uploaded_at timestamptz not null default now()
);
create index materials_teacher_idx on materials(teacher_id);

create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  question text not null,
  answer text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_conversations_student_idx on ai_conversations(student_id);

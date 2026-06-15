-- SmartClass Full Production Schema
-- Comprehensive unified schema with core tables, RLS, RAG/Vector support, triggers, and mock seeds

-- ===== Cleanup Existing Definitions to Ensure a Fresh Start =====
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_role(text) CASCADE;
DROP FUNCTION IF EXISTS public.bootstrap_first_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, int, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_phone_exists(text) CASCADE;
DROP FUNCTION IF EXISTS public.check_device_association(text, uuid) CASCADE;

DROP TABLE IF EXISTS public.ai_messages CASCADE;
DROP TABLE IF EXISTS public.ai_conversations CASCADE;
DROP TABLE IF EXISTS public.document_chunks CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.class_enrollments CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.timetable CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.levels CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

DROP TYPE IF EXISTS public.session_status CASCADE;
DROP TYPE IF EXISTS public.attendance_status CASCADE;
DROP TYPE IF EXISTS public.announcement_priority CASCADE;
DROP TYPE IF EXISTS public.announcement_scope CASCADE;

-- ===== Enable Extensions =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Helper Functions =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Check if phone number is already registered
CREATE OR REPLACE FUNCTION public.check_phone_exists(phone_val text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF phone_val IS NULL OR phone_val = '' THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE phone = phone_val
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_exists(text) TO anon, authenticated;

-- Check if a device fingerprint is already linked to another account
CREATE OR REPLACE FUNCTION public.check_device_association(fingerprint_val text, user_id_val uuid DEFAULT null)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _linked_user_id uuid;
  _linked_email text;
BEGIN
  IF fingerprint_val IS NULL OR fingerprint_val = '' THEN
    RETURN json_build_object('associated', false);
  END IF;

  -- Find if another user is linked to this fingerprint
  SELECT p.id, u.email INTO _linked_user_id, _linked_email
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.device_fingerprint = fingerprint_val;

  IF _linked_user_id IS NOT NULL THEN
    IF user_id_val IS NOT NULL AND _linked_user_id = user_id_val THEN
      RETURN json_build_object('associated', true, 'is_self', true);
    ELSE
      -- Mask email for privacy
      RETURN json_build_object(
        'associated', true,
        'is_self', false,
        'linked_email', regexp_replace(_linked_email, '(?<=.{2}).(?=[^@]*?.@)', '*', 'g')
      );
    END IF;
  END IF;

  RETURN json_build_object('associated', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_device_association(text, uuid) TO anon, authenticated;


-- ===== Core Tables =====

-- 1. Departments
CREATE TABLE public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  created_at timestamptz not null default now()
);
alter table public.departments enable row level security;

-- 2. Levels
CREATE TABLE public.levels (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  year int not null,
  advisor_id uuid, -- Foreign key resolved later after profiles table is created
  created_at timestamptz not null default now(),
  unique (department_id, year)
);
alter table public.levels enable row level security;

-- 3. Profiles
CREATE TABLE public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check(role in ('student', 'class_rep', 'teacher', 'dept_admin', 'super_admin')),
  department_id uuid references public.departments(id) on delete set null,
  level_id uuid references public.levels(id) on delete set null,
  approval_status text not null default 'pending' check(approval_status in ('pending', 'approved', 'rejected')),
  device_fingerprint text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Add Advisor constraint to levels table now that profiles is created
ALTER TABLE public.levels
  ADD CONSTRAINT levels_advisor_id_fkey
  FOREIGN KEY (advisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_department_idx on public.profiles(department_id);
CREATE INDEX IF NOT EXISTS profiles_level_idx on public.profiles(level_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx ON public.profiles(phone) WHERE (phone IS NOT NULL AND phone != '');


-- 4. Courses
CREATE TABLE public.courses (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  code text not null,
  name text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  credit_units int not null default 3,
  created_at timestamptz not null default now(),
  unique (department_id, code)
);
alter table public.courses enable row level security;

CREATE INDEX IF NOT EXISTS courses_level_idx on public.courses(level_id);
CREATE INDEX IF NOT EXISTS courses_department_idx on public.courses(department_id);
CREATE INDEX IF NOT EXISTS courses_teacher_idx on public.courses(teacher_id);

-- 5. Classes
CREATE TABLE public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  capacity int not null default 30,
  rep_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.classes enable row level security;

CREATE INDEX IF NOT EXISTS classes_course_idx on public.classes(course_id);
CREATE INDEX IF NOT EXISTS classes_rep_idx on public.classes(rep_id);

-- 6. Timetable
CREATE TABLE public.timetable (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  day_of_week int not null check(day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  venue text not null,
  recurrence text,
  created_at timestamptz not null default now()
);
alter table public.timetable enable row level security;

CREATE INDEX IF NOT EXISTS timetable_class_idx on public.timetable(class_id);
CREATE INDEX IF NOT EXISTS timetable_course_idx on public.timetable(course_id);
CREATE INDEX IF NOT EXISTS timetable_class_day_idx on public.timetable(class_id, day_of_week);

-- 7. Sessions
CREATE TYPE public.session_status as enum ('scheduled','active','ended','cancelled');

CREATE TABLE public.sessions (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid references public.timetable(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text,
  venue text,
  session_date date not null default current_date,
  start_time time not null,
  end_time time not null,
  qr_token text unique not null,
  qr_expires_at timestamptz,
  qr_rotated_at timestamptz not null default now(),
  geo_lat double precision,
  geo_lng double precision,
  geo_radius_m int not null default 50,
  is_active boolean not null default true,
  is_makeup boolean not null default false,
  status public.session_status not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

CREATE INDEX IF NOT EXISTS sessions_timetable_idx on public.sessions(timetable_id);
CREATE INDEX IF NOT EXISTS sessions_class_idx on public.sessions(class_id);
CREATE INDEX IF NOT EXISTS sessions_course_idx on public.sessions(course_id);
CREATE INDEX IF NOT EXISTS sessions_created_by_idx on public.sessions(created_by);
CREATE INDEX IF NOT EXISTS sessions_course_date_idx on public.sessions(course_id, session_date);

-- 8. Class Enrollments
CREATE TABLE public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);
alter table public.class_enrollments enable row level security;

CREATE INDEX IF NOT EXISTS class_enrollments_class_idx on public.class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS class_enrollments_student_idx on public.class_enrollments(student_id);

-- 9. Attendance
CREATE TYPE public.attendance_status as enum ('early', 'present', 'late', 'absent', 'rejected');

CREATE TABLE public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null default 'present',
  scanned_at timestamptz not null default now(),
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  geo_lat double precision,
  geo_lng double precision,
  distance_m double precision,
  device_fingerprint text,
  notes text,
  unique (session_id, student_id)
);
alter table public.attendance enable row level security;

CREATE INDEX IF NOT EXISTS attendance_session_idx on public.attendance(session_id);
CREATE INDEX IF NOT EXISTS attendance_class_idx on public.attendance(class_id);
CREATE INDEX IF NOT EXISTS attendance_course_idx on public.attendance(course_id);
CREATE INDEX IF NOT EXISTS attendance_student_idx on public.attendance(student_id);

-- 10. Alerts (DND-Breaking & Instant notifications)
CREATE TABLE public.alerts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'medium' check(priority in ('low', 'medium', 'high', 'critical')),
  type text not null default 'general',
  course_id uuid references public.courses(id) on delete set null,
  is_read boolean not null default false,
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.alerts enable row level security;

CREATE INDEX IF NOT EXISTS alerts_sender_idx on public.alerts(sender_id);
CREATE INDEX IF NOT EXISTS alerts_recipient_idx on public.alerts(recipient_id);
CREATE INDEX IF NOT EXISTS alerts_course_idx on public.alerts(course_id);

-- 11. Announcements (Class/Department/Global announcements)
CREATE TYPE public.announcement_priority as enum ('info','important','urgent');
CREATE TYPE public.announcement_scope as enum ('class','department','global');

CREATE TABLE public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  scope public.announcement_scope not null default 'class',
  class_id uuid references public.classes(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  title text not null,
  body text not null,
  priority public.announcement_priority not null default 'info',
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;

CREATE INDEX IF NOT EXISTS announcements_author_idx on public.announcements(author_id);
CREATE INDEX IF NOT EXISTS announcements_class_idx on public.announcements(class_id);
CREATE INDEX IF NOT EXISTS announcements_department_idx on public.announcements(department_id);

-- 12. Materials (Syllabi, Lecture Notes, PDFs)
CREATE TABLE public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_size int not null,
  mime_type text,
  processing_status text not null default 'pending' check(processing_status in ('pending', 'processing', 'processed', 'failed')),
  uploaded_at timestamptz not null default now()
);
alter table public.materials enable row level security;

CREATE INDEX IF NOT EXISTS materials_course_idx on public.materials(course_id);
CREATE INDEX IF NOT EXISTS materials_teacher_idx on public.materials(teacher_id);

-- 13. Document Chunks (For PDF Vector RAG)
CREATE TABLE public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.materials(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
alter table public.document_chunks enable row level security;

CREATE INDEX IF NOT EXISTS document_chunks_document_idx on public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_course_idx on public.document_chunks(course_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 14. AI Conversations & Messages (Revision Assistant)
CREATE TABLE public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null default 'New chat',
  question text, -- Backwards compatibility for single-turn format
  answer text,   -- Backwards compatibility for single-turn format
  sources jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;

CREATE INDEX IF NOT EXISTS ai_conversations_student_idx on public.ai_conversations(student_id);
CREATE INDEX IF NOT EXISTS ai_conversations_user_idx on public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_course_idx on public.ai_conversations(course_id);

CREATE TABLE public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  sources jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_messages enable row level security;

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx on public.ai_messages(conversation_id);

-- 15. System Settings
CREATE TABLE public.system_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);
alter table public.system_settings enable row level security;
CREATE INDEX IF NOT EXISTS system_settings_key_idx on public.system_settings(key);

-- ===== Role Checking Helpers & triggers (Defined AFTER tables exist) =====

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_role(_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role = _role AND approval_status = 'approved' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exists BOOLEAN;
  _is_pending_super BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role = 'super_admin' AND approval_status = 'approved'
  ) INTO _exists;

  IF _exists THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) INTO _is_pending_super;

  IF NOT _is_pending_super THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles SET approval_status = 'approved' WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin() TO authenticated;

-- Vector Similarity RPC Search Function
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  course_filter uuid default null
) returns table (
  id uuid,
  document_id uuid,
  course_id uuid,
  content text,
  similarity float
) language sql stable security definer set search_path = public as $$
  select dc.id, dc.document_id, dc.course_id, dc.content,
         1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.embedding is not null
    and (course_filter is null or dc.course_id = course_filter)
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, int, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, int, uuid) TO authenticated;

-- ===== Row Level Security Policies =====

-- Departments
CREATE POLICY "departments readable by authenticated" on public.departments
  for select to authenticated using (true);

CREATE POLICY "departments writeable by super_admin" on public.departments
  for all to authenticated using (public.is_role('super_admin'));

-- System Settings
CREATE POLICY "system_settings readable by authenticated" on public.system_settings
  for select to authenticated using (true);

CREATE POLICY "system_settings writeable by super_admin" on public.system_settings
  for all to authenticated using (public.is_role('super_admin'));


-- Levels
CREATE POLICY "levels readable by authenticated" on public.levels
  for select to authenticated using (true);

CREATE POLICY "levels writeable by admins" on public.levels
  for all to authenticated using (public.is_role('super_admin') or public.is_role('dept_admin'));

-- Profiles
CREATE POLICY "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

CREATE POLICY "profiles insertable by self during signup" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

CREATE POLICY "profiles writeable by self or admins" on public.profiles
  for update to authenticated using (
    auth.uid() = id or public.is_role('super_admin') or public.is_role('dept_admin')
  );

-- Courses
CREATE POLICY "courses readable by authenticated" on public.courses
  for select to authenticated using (true);

CREATE POLICY "courses writeable by admins" on public.courses
  for all to authenticated using (public.is_role('super_admin') or public.is_role('dept_admin'));

-- Classes
CREATE POLICY "classes readable by authenticated" on public.classes
  for select to authenticated using (true);

CREATE POLICY "classes writeable by admins" on public.classes
  for all to authenticated using (public.is_role('super_admin') or public.is_role('dept_admin'));

-- Timetable
CREATE POLICY "timetable readable by authenticated" on public.timetable
  for select to authenticated using (true);

CREATE POLICY "timetable writeable by admins or class reps" on public.timetable
  for all to authenticated using (
    public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('class_rep')
  );

-- Sessions
CREATE POLICY "sessions readable by authenticated" on public.sessions
  for select to authenticated using (true);

CREATE POLICY "sessions writeable by teachers or admins" on public.sessions
  for all to authenticated using (
    public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('teacher')
  );

-- Class Enrollments
CREATE POLICY "class_enrollments readable by authenticated" on public.class_enrollments
  for select to authenticated using (true);

CREATE POLICY "class_enrollments writeable by admins or class reps" on public.class_enrollments
  for all to authenticated using (
    public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('class_rep')
  );

-- Attendance
CREATE POLICY "attendance readable by authenticated" on public.attendance
  for select to authenticated using (true);

CREATE POLICY "attendance insertable by student self or teachers/admins" on public.attendance
  for insert to authenticated with check (
    auth.uid() = student_id or public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('teacher')
  );

CREATE POLICY "attendance updateable by student self or teachers/admins" on public.attendance
  for update to authenticated using (
    auth.uid() = student_id or public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('teacher')
  );

-- Alerts
CREATE POLICY "alerts readable by sender or recipient" on public.alerts
  for select to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid() or public.is_role('super_admin'));

CREATE POLICY "alerts insertable by sender" on public.alerts
  for insert to authenticated with check (sender_id = auth.uid() or public.is_role('super_admin') or public.is_role('dept_admin'));

CREATE POLICY "alerts updateable by recipient or sender" on public.alerts
  for update to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid());

-- Announcements
CREATE POLICY "announcements readable by authenticated" on public.announcements
  for select to authenticated using (true);

CREATE POLICY "announcements writeable by author or admins" on public.announcements
  for all to authenticated using (
    author_id = auth.uid() or public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('class_rep')
  );

-- Materials
CREATE POLICY "materials readable by authenticated" on public.materials
  for select to authenticated using (true);

CREATE POLICY "materials insertable by teachers or admins" on public.materials
  for insert to authenticated with check (
    teacher_id = auth.uid() or public.is_role('super_admin') or public.is_role('dept_admin')
  );

CREATE POLICY "materials writeable by owning teacher or admins" on public.materials
  for update to authenticated using (
    teacher_id = auth.uid() or public.is_role('super_admin') or public.is_role('dept_admin')
  );

CREATE POLICY "materials deleteable by owning teacher or admins" on public.materials
  for delete to authenticated using (
    teacher_id = auth.uid() or public.is_role('super_admin') or public.is_role('dept_admin')
  );

-- Document Chunks
CREATE POLICY "document_chunks readable by authenticated" on public.document_chunks
  for select to authenticated using (true);

CREATE POLICY "document_chunks writeable by teachers or admins" on public.document_chunks
  for all to authenticated using (
    public.is_role('super_admin') or public.is_role('dept_admin') or public.is_role('teacher')
  );

-- AI Conversations
CREATE POLICY "ai_conversations readable and writeable by owner" on public.ai_conversations
  for all to authenticated using (
    student_id = auth.uid() or user_id = auth.uid()
  ) with check (
    student_id = auth.uid() or user_id = auth.uid()
  );

-- AI Messages
CREATE POLICY "ai_messages readable and writeable by owner" on public.ai_messages
  for all to authenticated using (
    exists (
      select 1 from public.ai_conversations c 
      where c.id = conversation_id and (c.user_id = auth.uid() or c.student_id = auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.ai_conversations c 
      where c.id = conversation_id and (c.user_id = auth.uid() or c.student_id = auth.uid())
    )
  );

-- ===== Auth Sign-up Trigger Function & Trigger =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _role text;
  _full_name text;
  _approval_status text;
BEGIN
  _role := coalesce(new.raw_user_meta_data->>'role', 'student');
  _full_name := coalesce(new.raw_user_meta_data->>'full_name', 'New User');
  
  -- Only super_admin is auto-approved. All other roles (student, class_rep,
  -- teacher, dept_admin) start as pending and require super admin approval.
  IF _role = 'super_admin' THEN
    _approval_status := 'approved';
  ELSE
    _approval_status := 'pending';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    approval_status,
    phone,
    department_id,
    level_id,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    _full_name,
    _role,
    _approval_status,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    (new.raw_user_meta_data->>'department_id')::uuid,
    (new.raw_user_meta_data->>'level_id')::uuid,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
    department_id = COALESCE(EXCLUDED.department_id, profiles.department_id),
    level_id = COALESCE(EXCLUDED.level_id, profiles.level_id),
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Real-time Publications =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END;
$$;

-- ===== Storage Buckets =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can read materials storage" ON storage.objects;
CREATE POLICY "Authenticated users can read materials storage" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Teachers and admins can upload materials" ON storage.objects;
CREATE POLICY "Teachers and admins can upload materials" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'materials' AND (
      public.is_role('teacher') OR public.is_role('super_admin') OR public.is_role('dept_admin')
    )
  );

-- ===== SEED MOCK DATA =====

-- Seed Departments
INSERT INTO public.departments (id, name, code) VALUES
  ('c0a80101-0000-0000-0000-000000000001', 'Computer Science & Engineering', 'CSE'),
  ('c0a80101-0000-0000-0000-000000000002', 'Electrical & Electronics Engineering', 'EEE')
ON CONFLICT (code) DO NOTHING;

-- Seed Levels
INSERT INTO public.levels (id, department_id, name, year) VALUES
  ('c0a80102-0000-0000-0000-000000000001', 'c0a80101-0000-0000-0000-000000000001', 'CSE Year 1', 1),
  ('c0a80102-0000-0000-0000-000000000002', 'c0a80101-0000-0000-0000-000000000001', 'CSE Year 2', 2),
  ('c0a80102-0000-0000-0000-000000000003', 'c0a80101-0000-0000-0000-000000000002', 'EEE Year 1', 1)
ON CONFLICT (department_id, year) DO NOTHING;

-- Seed Auth Users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES
  (
    'a0a80103-0000-0000-0000-000000000001',
    'superadmin@smartclass.com',
    extensions.crypt('password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"super_admin","full_name":"System Admin"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'a0a80103-0000-0000-0000-000000000002',
    'teacher@smartclass.com',
    extensions.crypt('password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"teacher","full_name":"Dr. Alice Smith"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    'a0a80103-0000-0000-0000-000000000003',
    'student@smartclass.com',
    extensions.crypt('password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Bob Jones"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- Explicitly seed profiles for the seeded auth users.
-- This is idempotent (ON CONFLICT DO UPDATE) and guarantees profiles exist
-- even on re-runs where the auth trigger doesn't fire (auth.users already exist).
INSERT INTO public.profiles (id, full_name, role, approval_status, department_id, level_id, phone, created_at, updated_at) VALUES
  (
    'a0a80103-0000-0000-0000-000000000001',
    'System Admin',
    'super_admin',
    'approved',
    NULL,
    NULL,
    '+2348000000001',
    now(),
    now()
  ),
  (
    'a0a80103-0000-0000-0000-000000000002',
    'Dr. Alice Smith',
    'teacher',
    'approved',
    'c0a80101-0000-0000-0000-000000000001',
    NULL,
    '+2348000000002',
    now(),
    now()
  ),
  (
    'a0a80103-0000-0000-0000-000000000003',
    'Bob Jones',
    'student',
    'approved',
    'c0a80101-0000-0000-0000-000000000001',
    'c0a80102-0000-0000-0000-000000000001',
    '+2348000000003',
    now(),
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  full_name      = EXCLUDED.full_name,
  role           = EXCLUDED.role,
  approval_status = EXCLUDED.approval_status,
  department_id  = EXCLUDED.department_id,
  level_id       = EXCLUDED.level_id,
  phone          = EXCLUDED.phone,
  updated_at     = now();

-- Seed System Settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('qr_token_expiry', '60', 'QR Token Expiry in seconds'),
  ('gps_geofence_radius', '100', 'GPS Geofence Radius in meters'),
  ('ai_chat_limit', '30', 'AI Chat Limit in requests per hour'),
  ('late_grace_period', '10', 'Late Grace Period in minutes'),
  ('sms_alert_delay', '30', 'SMS Alert Delay in seconds'),
  ('attendance_threshold', '70', 'Attendance Threshold in percentage')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();


-- Seed Courses
INSERT INTO public.courses (id, level_id, department_id, code, name, teacher_id, credit_units) VALUES
  (
    'b0a80104-0000-0000-0000-000000000001',
    'c0a80102-0000-0000-0000-000000000001', -- CSE Year 1
    'c0a80101-0000-0000-0000-000000000001', -- CSE Department
    'CSE101',
    'Introduction to Computer Science',
    'a0a80103-0000-0000-0000-000000000002', -- Dr. Alice Smith
    3
  ),
  (
    'b0a80104-0000-0000-0000-000000000002',
    'c0a80102-0000-0000-0000-000000000002', -- CSE Year 2
    'c0a80101-0000-0000-0000-000000000001', -- CSE Department
    'CSE201',
    'Data Structures & Algorithms',
    'a0a80103-0000-0000-0000-000000000002', -- Dr. Alice Smith
    4
  )
ON CONFLICT (department_id, code) DO NOTHING;

-- Seed Classes
INSERT INTO public.classes (id, course_id, name, capacity, rep_id) VALUES
  (
    '90a80105-0000-0000-0000-000000000001',
    'b0a80104-0000-0000-0000-000000000001', -- CSE101
    'CSE-1A',
    30,
    NULL
  ),
  (
    '90a80105-0000-0000-0000-000000000002',
    'b0a80104-0000-0000-0000-000000000002', -- CSE201
    'CSE-2A',
    35,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Enroll Student into Class CSE-1A
INSERT INTO public.class_enrollments (class_id, student_id) VALUES
  (
    '90a80105-0000-0000-0000-000000000001',
    'a0a80103-0000-0000-0000-000000000003' -- Bob Jones (student)
  )
ON CONFLICT (class_id, student_id) DO NOTHING;

-- Seed Timetable Entries
INSERT INTO public.timetable (class_id, course_id, day_of_week, start_time, end_time, venue, recurrence) VALUES
  (
    '90a80105-0000-0000-0000-000000000001',
    'b0a80104-0000-0000-0000-000000000001',
    1, -- Monday
    '09:00:00',
    '11:00:00',
    'Block B, Room 102',
    'weekly'
  ),
  (
    '90a80105-0000-0000-0000-000000000001',
    'b0a80104-0000-0000-0000-000000000001',
    3, -- Wednesday
    '14:00:00',
    '16:00:00',
    'Block B, Room 102',
    'weekly'
  )
ON CONFLICT (id) DO NOTHING;

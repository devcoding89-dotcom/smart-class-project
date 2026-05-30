-- SmartClass Full Production Schema
-- Comprehensive schema with auth, RLS, RAG, and AI features

create extension if not exists "uuid-ossp";
create extension if not exists vector;

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
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'super_admin' AND p.approval_status = 'approved'
  ) INTO _exists;

  IF _exists THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) INTO _is_pending_super;

  IF NOT _is_pending_super THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles SET approval_status = 'approved' WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin() FROM PUBLIC, anon;

-- ===== Courses =====
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  level_id uuid references public.levels(id) on delete set null,
  code text not null,
  title text not null,
  credits int not null default 3,
  created_at timestamptz not null default now(),
  unique (department_id, code)
);
alter table public.courses enable row level security;

CREATE POLICY IF NOT EXISTS "courses readable by authenticated"
  on public.courses for select to authenticated using (true);

-- ===== Classes =====
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  name text not null,
  class_rep_id uuid references public.profiles(id) on delete set null,
  academic_year text not null,
  created_at timestamptz not null default now()
);
alter table public.classes enable row level security;

CREATE POLICY IF NOT EXISTS "classes readable by authenticated"
  on public.classes for select to authenticated using (true);

-- ===== Class members =====
CREATE TABLE IF NOT EXISTS public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);
alter table public.class_members enable row level security;

-- ===== Teacher assignments =====
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, course_id, class_id)
);
alter table public.teacher_assignments enable row level security;

CREATE POLICY IF NOT EXISTS "teacher_assignments readable" on public.teacher_assignments
  for select to authenticated using (true);

-- ===== Sessions =====
CREATE TYPE IF NOT EXISTS public.session_status as enum ('scheduled','active','ended','cancelled');

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  room text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  qr_token text not null default encode(gen_random_bytes(16),'hex'),
  qr_rotated_at timestamptz not null default now(),
  geo_lat double precision,
  geo_lng double precision,
  geo_radius_m int not null default 50,
  status public.session_status not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

-- ===== Attendance =====
CREATE TYPE IF NOT EXISTS public.attendance_status as enum ('present','late','absent','rejected');

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  status public.attendance_status not null default 'present',
  geo_lat double precision,
  geo_lng double precision,
  distance_m double precision,
  notes text,
  unique (session_id, student_id)
);
alter table public.attendance enable row level security;

-- ===== Announcements =====
CREATE TYPE IF NOT EXISTS public.announcement_priority as enum ('info','important','urgent');
CREATE TYPE IF NOT EXISTS public.announcement_scope as enum ('class','department','global');

CREATE TABLE IF NOT EXISTS public.announcements (
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

-- ===== Documents + RAG =====
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  storage_path text not null,
  mime_type text,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
alter table public.document_chunks enable row level security;

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Vector search RPC
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

-- ===== AI conversations =====
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;

CREATE POLICY IF NOT EXISTS "own conversations" on public.ai_conversations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_messages enable row level security;

CREATE POLICY IF NOT EXISTS "own messages" on public.ai_messages
  for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- ===== Realtime =====
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.ai_messages;

-- ===== Storage =====
insert into storage.buckets (id, name, public) values ('documents','documents', false)
on conflict (id) do nothing;

-- ===== Level Advisor =====
ALTER TABLE public.levels ADD COLUMN IF NOT EXISTS advisor_id uuid;

CREATE OR REPLACE FUNCTION public.advises_user(_advisor uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.levels l ON l.id = p.level_id
    WHERE p.id = _target AND l.advisor_id = _advisor
  )
$$;
REVOKE EXECUTE ON FUNCTION public.advises_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advises_user(uuid, uuid) TO authenticated;

ALTER TABLE public.levels
ADD CONSTRAINT IF NOT EXISTS levels_advisor_id_fkey
FOREIGN KEY (advisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ===== Auth Trigger =====
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

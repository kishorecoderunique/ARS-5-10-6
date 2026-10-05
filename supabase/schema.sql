create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null unique check (phone ~ '^[0-9]{10}$'),
  "passwordHash" text not null,
  role text not null check (role in ('rescuer', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  duty text not null default 'off' check (duty in ('on', 'off')),
  "createdAt" timestamptz not null default now()
);

create table if not exists public.sos (
  id uuid primary key default gen_random_uuid(),
  "victimName" text not null check (char_length("victimName") between 2 and 100),
  "victimPhone" text not null check ("victimPhone" ~ '^[0-9]{10}$'),
  "locationName" text not null default 'Unknown location',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  severity text not null check (severity in ('High', 'Medium', 'Low')),
  description text not null check (char_length(description) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'en_route', 'reached', 'resolved', 'cancelled')),
  "acceptedBy" uuid references public.users(id) on delete set null,
  "triggeredAt" timestamptz not null default now(),
  "acceptedAt" timestamptz,
  "resolvedAt" timestamptz,
  history jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists sos_status_severity_triggered_idx
  on public.sos (status, severity, "triggeredAt" desc);
create index if not exists sos_accepted_by_status_idx
  on public.sos ("acceptedBy", status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references public.users(id) on delete cascade,
  role text check (role in ('rescuer', 'admin')),
  type text not null check (type in ('new_sos', 'accepted', 'resolved', 'approval')),
  message text not null check (char_length(message) <= 500),
  "sosId" uuid references public.sos(id) on delete set null,
  read boolean not null default false,
  "createdAt" timestamptz not null default now(),
  check (("userId" is not null and role is null) or ("userId" is null and role is not null))
);

create index if not exists notifications_user_created_idx
  on public.notifications ("userId", "createdAt" desc);
create index if not exists notifications_role_created_idx
  on public.notifications (role, "createdAt" desc);

create table if not exists public.otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  "otpHash" text not null,
  purpose text not null check (purpose in ('signup', 'reset')),
  "expiresAt" timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  "lastSentAt" timestamptz not null,
  "verifiedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (phone, purpose)
);

alter table public.users enable row level security;
alter table public.sos enable row level security;
alter table public.notifications enable row level security;
alter table public.otps enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.users, public.sos, public.notifications, public.otps to service_role;

create or replace function public.reserve_otp(
  p_phone text,
  p_purpose text,
  p_otp_hash text,
  p_now timestamptz
)
returns setof public.otps
language sql
security invoker
as $$
  insert into public.otps as current_otp (phone, purpose, "otpHash", "expiresAt", attempts, "lastSentAt", "verifiedAt", "updatedAt")
  values (p_phone, p_purpose, p_otp_hash, p_now + interval '5 minutes', 0, p_now, null, p_now)
  on conflict (phone, purpose) do update
    set "otpHash" = excluded."otpHash",
        "expiresAt" = excluded."expiresAt",
        attempts = 0,
        "lastSentAt" = excluded."lastSentAt",
        "verifiedAt" = null,
        "updatedAt" = excluded."updatedAt"
    where current_otp."lastSentAt" <= p_now - interval '30 seconds'
  returning *;
$$;

create or replace function public.increment_otp_attempts(
  p_phone text,
  p_purpose text,
  p_now timestamptz,
  p_require_verified boolean
)
returns setof public.otps
language sql
security invoker
as $$
  update public.otps
  set attempts = attempts + 1
  where phone = p_phone
    and purpose = p_purpose
    and "expiresAt" > p_now
    and attempts < 5
    and (not p_require_verified or "verifiedAt" > p_now - interval '5 minutes')
  returning *;
$$;

revoke all on function public.reserve_otp(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.increment_otp_attempts(text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.reserve_otp(text, text, text, timestamptz) to service_role;
grant execute on function public.increment_otp_attempts(text, text, timestamptz, boolean) to service_role;

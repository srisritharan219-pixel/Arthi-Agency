-- Supabase schema for the Netlify live site.
-- Run this in Supabase SQL Editor once, then set Netlify env vars:
-- SUPABASE_URL=https://your-project.supabase.co
-- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

create table if not exists public.attendflow_state (
    id integer primary key,
    state jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.attendflow_state enable row level security;

-- The Netlify function uses the service-role key, which bypasses RLS.
-- Do not add public read/write policies for this table.

insert into public.attendflow_state (id, state, updated_at)
values (
    1,
    '{
      "admin": {
        "password": "",
        "loginEnabled": false,
        "companyName": "ABIRAMI INDUSTRIES",
        "companyAddress": "Tamil Nadu, India",
        "companyPhone": "+91 98765 43210",
        "companyLogo": "",
        "theme": "light",
        "colorTheme": "indigo",
        "dayRange": 6
      },
      "adminUsers": [
        {
          "username": "admin",
          "name": "Primary Administrator",
          "password": "",
          "role": "Super Admin",
          "created_at": "2026-05-20T00:00:00.000Z"
        }
      ],
      "employees": [],
      "attendance": {},
      "payrollLedger": {},
      "holidays": {},
      "announcements": [],
      "auditLogs": []
    }'::jsonb,
    now()
)
on conflict (id) do nothing;

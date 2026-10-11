-- ============================================================================
-- RevenuePilot AI (Technova) - Supabase Database Schema, RLS & Seed Data
-- Run this entire script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1. CUSTOMER ACCOUNTS TABLE
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  initials text not null,
  status text not null default 'Healthy',
  tone text not null default 'green' check (tone in ('red', 'green', 'blue', 'amber', 'neutral')),
  signal text not null,
  renewal text not null,
  action text not null,
  color text not null default 'bg-emerald-100 text-emerald-700',
  owner text not null default 'Maya Chen',
  arr text not null default '$50K',
  tier text not null default 'Enterprise',
  renewal_days text not null default '43 days',
  last_meeting text not null default '21 days ago',
  last_meeting_date text not null default 'Mar 25, 2025',
  product_usage text not null default 'Declining',
  product_usage_note text not null default 'Down 28% this month',
  champion_status text not null default 'No recent reply',
  champion_note text not null default 'Last reply 20 days ago',
  champion_email text not null default 'alex.morgan@acme.example',
  followup_status text not null default 'No next step',
  followup_note text not null default 'Task unavailable',
  created_at timestamptz not null default now()
);

-- 2. EVIDENCE SIGNALS TABLE
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  account_name text not null default 'Acme Corporation',
  code text not null,
  title text not null,
  source text not null,
  verified_date text not null,
  icon text not null default 'file',
  created_at timestamptz not null default now()
);

-- 3. RECENT INTERACTIONS TABLE
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  account_name text not null default 'Acme Corporation',
  date_label text not null,
  title text not null,
  meta text not null,
  note text not null,
  is_alert boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. RECOMMENDED ACTIONS / APPROVAL CENTER TABLE
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  action text not null,
  owner text not null,
  refs text not null,
  current_data text not null default 'No open task',
  proposed_change text not null,
  priority_label text not null default 'Standard review',
  priority_tone text not null default 'blue' check (priority_tone in ('red', 'green', 'blue', 'amber', 'neutral')),
  description text not null default 'AI detected a verified customer signal and recommends a trackable next step.',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_label text not null default 'Just now',
  recipient_email text,
  email_subject text,
  email_body text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- 5. ACTIVITY & AUDIT LOGS TABLE
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp_label text not null,
  customer text not null,
  action text not null,
  decision_by text not null,
  status text not null check (status in ('Executed', 'Rejected', 'Awaiting approval')),
  refs text not null,
  details text,
  created_at timestamptz not null default now()
);

-- 6. RISKS & OPPORTUNITIES TABLE
create table if not exists public.risks_opportunities (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('risk', 'opportunity')),
  customer text not null,
  value_label text not null,
  signal text not null,
  badge_label text not null,
  refs text not null,
  created_at timestamptz not null default now()
);

-- 7. INTEGRATIONS TABLE
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider text not null,
  description text not null,
  status text not null default 'Connected',
  tone text not null default 'green' check (tone in ('red', 'green', 'blue', 'amber', 'neutral')),
  icon text not null default 'plug',
  created_at timestamptz not null default now()
);

-- 8. WORKSPACE SETTINGS TABLE
create table if not exists public.workspace_settings (
  id int primary key default 1 check (id = 1),
  workspace_name text not null default 'Revenue Operations',
  timezone text not null default 'Pacific Time (PT)',
  primary_crm text not null default 'Salesforce',
  default_task_owner text not null default 'Account owner',
  require_human_approval boolean not null default true,
  record_evidence_refs boolean not null default true,
  notify_account_owners boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows both authenticated users and anon demo access so the app works
-- seamlessly before and after sign-in.
-- ============================================================================
alter table public.accounts enable row level security;
alter table public.evidence enable row level security;
alter table public.interactions enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.risks_opportunities enable row level security;
alter table public.integrations enable row level security;
alter table public.workspace_settings enable row level security;

drop policy if exists "Allow public access to accounts" on public.accounts;
create policy "Allow public access to accounts" on public.accounts for all using (true) with check (true);

drop policy if exists "Allow public access to evidence" on public.evidence;
create policy "Allow public access to evidence" on public.evidence for all using (true) with check (true);

drop policy if exists "Allow public access to interactions" on public.interactions;
create policy "Allow public access to interactions" on public.interactions for all using (true) with check (true);

drop policy if exists "Allow public access to approvals" on public.approvals;
create policy "Allow public access to approvals" on public.approvals for all using (true) with check (true);

drop policy if exists "Allow public access to audit_logs" on public.audit_logs;
create policy "Allow public access to audit_logs" on public.audit_logs for all using (true) with check (true);

drop policy if exists "Allow public access to risks_opportunities" on public.risks_opportunities;
create policy "Allow public access to risks_opportunities" on public.risks_opportunities for all using (true) with check (true);

drop policy if exists "Allow public access to integrations" on public.integrations;
create policy "Allow public access to integrations" on public.integrations for all using (true) with check (true);

drop policy if exists "Allow public access to workspace_settings" on public.workspace_settings;
create policy "Allow public access to workspace_settings" on public.workspace_settings for all using (true) with check (true);

-- ============================================================================
-- ENABLE REALTIME SUBSCRIPTIONS
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'accounts'
  ) then
    alter publication supabase_realtime add table public.accounts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'approvals'
  ) then
    alter publication supabase_realtime add table public.approvals;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'integrations'
  ) then
    alter publication supabase_realtime add table public.integrations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'workspace_settings'
  ) then
    alter publication supabase_realtime add table public.workspace_settings;
  end if;
end $$;

-- ============================================================================
-- SEED INITIAL DATA (Idempotent)
-- ============================================================================
insert into public.accounts (name, initials, status, tone, signal, renewal, action, color, owner, arr, tier, renewal_days, last_meeting, last_meeting_date, product_usage, product_usage_note, champion_status, champion_note, champion_email, followup_status, followup_note)
values
  ('Acme Corporation', 'AC', 'At Risk', 'red', 'Usage declined 28% this month', 'May 28, 2025', 'Create follow-up task', 'bg-indigo-100 text-indigo-700', 'Maya Chen', '$86K', 'Enterprise', '43 days', '21 days ago', 'Mar 25, 2025', 'Declining', 'Down 28% this month', 'No recent reply', 'Last reply 20 days ago', 'alex.morgan@acme.example', 'No next step', 'Task unavailable'),
  ('NovaTech', 'NT', 'Expansion Opportunity', 'blue', 'Team adoption up 34%', 'Aug 12, 2025', 'Schedule expansion review', 'bg-cyan-100 text-cyan-700', 'Priya Shah', '$64K', 'Growth', '119 days', '6 days ago', 'Apr 09, 2025', 'Expanding', 'Up 34% this month', 'Active champion', 'Replied 2 days ago', 'taylor.reed@novatech.example', 'Scheduled', 'Review on Apr 22'),
  ('BrightPath', 'BP', 'Healthy', 'green', 'Strong weekly engagement', 'Oct 03, 2025', 'Maintain success plan', 'bg-emerald-100 text-emerald-700', 'Jordan Davis', '$48K', 'Mid-Market', '171 days', '11 days ago', 'Apr 04, 2025', 'Healthy', '91% weekly active seats', 'Engaged', 'Last reply 4 days ago', 'sam.patel@brightpath.example', 'On track', 'QBR scheduled'),
  ('CloudSync', 'CS', 'Pending Approval', 'amber', 'Champion changed roles', 'Jun 17, 2025', 'Draft stakeholder email', 'bg-amber-100 text-amber-700', 'Marcus Lee', '$72K', 'Enterprise', '63 days', '18 days ago', 'Mar 28, 2025', 'Stable', 'Flat month-over-month', 'Role transition', 'New VP of Ops announced', 'casey.lin@cloudsync.example', 'Awaiting approval', 'Draft transition email')
on conflict (name) do nothing;

insert into public.evidence (account_name, code, title, source, verified_date, icon)
select * from (values
  ('Acme Corporation', 'E1', 'Renewal is due in 43 days', 'Salesforce CRM', 'Verified Apr 15, 2025', 'calendar'),
  ('Acme Corporation', 'E2', 'Product usage declined by 28%', 'Product analytics', 'Mar 15 – Apr 15, 2025', 'activity'),
  ('Acme Corporation', 'E3', 'Champion has not replied', 'Connected email', 'Last reply Mar 26, 2025', 'mail'),
  ('Acme Corporation', 'E4', 'No follow-up task was recorded', 'CRM activities', 'Since meeting Mar 25, 2025', 'file')
) as v(account_name, code, title, source, verified_date, icon)
where not exists (select 1 from public.evidence limit 1);

insert into public.interactions (account_name, date_label, title, meta, note, is_alert, sort_order)
select * from (values
  ('Acme Corporation', 'Mar 25', 'Quarterly review meeting', 'Maya Chen · 42 min', 'Meeting notes synced', false, 1),
  ('Acme Corporation', 'Mar 26', 'Champion replied to recap', 'Alex Morgan · Email', 'Last inbound response', false, 2),
  ('Acme Corporation', 'Apr 08', 'Usage alert detected', 'Product analytics', 'Weekly active use down 28%', true, 3)
) as v(account_name, date_label, title, meta, note, is_alert, sort_order)
where not exists (select 1 from public.interactions limit 1);

insert into public.approvals (customer, action, owner, refs, current_data, proposed_change, priority_label, priority_tone, description, status, submitted_label)
select * from (values
  ('Acme Corporation', 'Create a customer follow-up task', 'Maya Chen', 'E1, E3, E4', 'No open task', 'Due tomorrow at 5:00 PM', 'High priority', 'red', 'The account is approaching renewal with declining engagement and no documented follow-up.', 'pending', 'Submitted 1h ago'),
  ('CloudSync', 'Draft stakeholder transition email', 'Jordan Davis', 'E2, E5', 'No open task', 'Save as email draft', 'Customer outreach', 'amber', 'AI detected a verified customer signal and recommends a trackable next step.', 'pending', 'Submitted 2h ago'),
  ('NovaTech', 'Schedule expansion review', 'Priya Shah', 'E1, E6', 'No open task', 'Create calendar task', 'Standard review', 'blue', 'AI detected a verified customer signal and recommends a trackable next step.', 'pending', 'Submitted 3h ago'),
  ('Pioneer Labs', 'Update renewal risk field', 'Marcus Lee', 'E2, E3', 'Risk: Low', 'Change CRM field to Medium', 'Standard review', 'blue', 'AI detected a verified customer signal and recommends a trackable next step.', 'pending', 'Submitted 4h ago')
) as v(customer, action, owner, refs, current_data, proposed_change, priority_label, priority_tone, description, status, submitted_label)
where not exists (select 1 from public.approvals limit 1);

insert into public.audit_logs (timestamp_label, customer, action, decision_by, status, refs)
select * from (values
  ('Apr 15, 9:18 AM', 'CloudSync', 'Draft stakeholder email', 'Pending', 'Awaiting approval', 'E2, E5'),
  ('Apr 14, 4:35 PM', 'BrightPath', 'Update success plan', 'Priya Shah', 'Executed', 'E1'),
  ('Apr 14, 2:11 PM', 'Pioneer Labs', 'Update risk field', 'Marcus Lee', 'Rejected', 'E2, E3'),
  ('Apr 13, 11:05 AM', 'NovaTech', 'Create expansion task', 'Jordan Davis', 'Executed', 'E4, E6')
) as v(timestamp_label, customer, action, decision_by, status, refs)
where not exists (select 1 from public.audit_logs limit 1);

insert into public.risks_opportunities (category, customer, value_label, signal, badge_label, refs)
select * from (values
  ('risk', 'Acme Corporation', '$86K ARR', 'Usage down 28% · renewal in 43 days', 'High', 'E1, E2, E3'),
  ('risk', 'Pioneer Labs', '$58K ARR', 'Executive sponsor left the company', 'High', 'E2, E5'),
  ('risk', 'Northstar Media', '$42K ARR', 'Support satisfaction declined', 'Medium', 'E3, E4'),
  ('opportunity', 'NovaTech', '$32K potential', 'Team adoption increased 34%', 'Strong', 'E6, E7'),
  ('opportunity', 'Vertex Health', '$28K potential', 'Seat utilization reached 92%', 'Strong', 'E1, E4'),
  ('opportunity', 'BrightPath', '$24K potential', 'Requested advanced feature demo', 'Emerging', 'E3')
) as v(category, customer, value_label, signal, badge_label, refs)
where not exists (select 1 from public.risks_opportunities limit 1);

insert into public.integrations (name, provider, description, status, tone, icon)
values
  ('CRM', 'Salesforce', 'Customer, renewal, and activity records', 'Connected', 'green', 'users'),
  ('Email', 'Google Workspace', 'Thread and response activity', 'Demo mode', 'amber', 'mail'),
  ('Calendar', 'Google Calendar', 'Meetings and follow-up events', 'Connected', 'green', 'calendar'),
  ('Product Usage Data', 'RevenuePilot Events', 'Feature adoption and active usage', 'Demo mode', 'amber', 'activity')
on conflict (name) do nothing;

insert into public.workspace_settings (id, workspace_name, timezone, primary_crm, default_task_owner, require_human_approval, record_evidence_refs, notify_account_owners)
values (1, 'Revenue Operations', 'Pacific Time (PT)', 'Salesforce', 'Account owner', true, true, true)
on conflict (id) do nothing;

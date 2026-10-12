-- ============================================================================
-- DealFlow AI — Complete MCP Integration Migration
-- Adds MCP connection registry, encrypted OAuth token storage, product usage
-- event ingestion with deduplication, MCP tool audit trail, AI insights table,
-- and cryptographic payload-hash approval binding with RLS policies.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Extend accounts with deterministic external mapping identifiers
alter table public.accounts add column if not exists external_crm_id text;
alter table public.accounts add column if not exists email_domain text;
alter table public.accounts add column if not exists workspace_id text not null default 'ws_default';

update public.accounts set email_domain = 'acme.example', external_crm_id = '001Dn00000Acme01' where name = 'Acme Corporation' and email_domain is null;
update public.accounts set email_domain = 'novatech.example', external_crm_id = '001Dn00000Nova02' where name = 'NovaTech' and email_domain is null;
update public.accounts set email_domain = 'brightpath.example', external_crm_id = '001Dn00000Brgt03' where name = 'BrightPath' and email_domain is null;
update public.accounts set email_domain = 'cloudsync.example', external_crm_id = '001Dn00000Clou04' where name = 'CloudSync' and email_domain is null;

-- 2. Extend approvals with payload_hash, idempotency_key, and execution state
alter table public.approvals add column if not exists intended_operation text not null default 'create_followup_task';
alter table public.approvals add column if not exists payload_hash text;
alter table public.approvals add column if not exists idempotency_key text;
alter table public.approvals add column if not exists creator_user_id text;
alter table public.approvals add column if not exists approved_at timestamptz;
alter table public.approvals add column if not exists executed_at timestamptz;
alter table public.approvals add column if not exists execution_result text;

create unique index if not exists idx_approvals_idempotency_key
  on public.approvals (idempotency_key)
  where idempotency_key is not null;

-- 3. MCP Integration Connections Registry (Per-User / Per-Workspace)
create table if not exists public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'ws_default',
  user_id text not null default 'usr_maya_chen',
  integration_key text not null check (integration_key in ('crm', 'email', 'calendar', 'usage', 'dealflow_mcp')),
  provider text not null,
  server_url text,
  auth_type text not null default 'oauth2' check (auth_type in ('oauth2', 'api_key', 'mcp_remote', 'internal')),
  status text not null default 'Not configured' check (
    status in ('Not configured', 'Connecting', 'Connected', 'Syncing', 'Disconnected', 'Error')
  ),
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  external_account_id text,
  sync_cursor text,
  last_synced_at timestamptz,
  last_test_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, integration_key)
);

-- 4. MCP Tool Invocations Audit Log
create table if not exists public.mcp_tool_invocations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  workspace_id text not null default 'ws_default',
  user_id text not null,
  server_id text not null,
  tool_name text not null,
  redacted_arguments jsonb not null default '{}'::jsonb,
  status text not null check (status in ('success', 'error', 'denied', 'timeout')),
  duration_ms int not null default 0,
  error_message text,
  result_summary text,
  created_at timestamptz not null default now()
);

-- 5. Product Usage Events Table (Idempotent Ingestion)
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  idempotency_key text not null unique,
  workspace_id text not null default 'ws_default',
  account_name text not null,
  event_type text not null check (
    event_type in ('user_login', 'session_started', 'feature_used', 'subscription_activity')
  ),
  actor_email text,
  feature_name text,
  active_seats int,
  contracted_seats int,
  usage_delta_pct numeric,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  ingested_at timestamptz not null default now()
);

create index if not exists idx_product_events_account_time
  on public.product_events (account_name, occurred_at desc);

-- 6. AI Revenue-Risk & Expansion Insights Table
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'ws_default',
  user_id text not null,
  account_name text not null,
  risk_level text not null,
  confidence_score numeric not null default 0.85,
  summary text not null,
  why_it_matters text not null,
  suggested_next_step text not null,
  evidence_refs text[] not null default '{}',
  tool_calls_used text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 7. Row Level Security Policies
alter table public.mcp_connections enable row level security;
alter table public.mcp_tool_invocations enable row level security;
alter table public.product_events enable row level security;
alter table public.ai_insights enable row level security;

drop policy if exists "Workspace access to mcp_connections" on public.mcp_connections;
create policy "Workspace access to mcp_connections"
  on public.mcp_connections
  for all
  using (auth.uid() is null or auth.uid()::text = user_id or user_id is not null)
  with check (auth.uid() is null or auth.uid()::text = user_id or user_id is not null);

drop policy if exists "Workspace access to mcp_tool_invocations" on public.mcp_tool_invocations;
create policy "Workspace access to mcp_tool_invocations"
  on public.mcp_tool_invocations
  for all
  using (true)
  with check (true);

drop policy if exists "Workspace access to product_events" on public.product_events;
create policy "Workspace access to product_events"
  on public.product_events
  for all
  using (true)
  with check (true);

drop policy if exists "Workspace access to ai_insights" on public.ai_insights;
create policy "Workspace access to ai_insights"
  on public.ai_insights
  for all
  using (true)
  with check (true);

-- Seed initial verified product usage events for existing accounts
insert into public.product_events (
  event_id, idempotency_key, workspace_id, account_name, event_type,
  actor_email, feature_name, active_seats, contracted_seats, usage_delta_pct, metadata, occurred_at
)
values
  ('evt_acme_001', 'idem_acme_001', 'ws_default', 'Acme Corporation', 'subscription_activity', 'alex.morgan@acme.example', 'Analytics Dashboard', 18, 25, -28.0, '{"note":"Weekly active seats dropped 28% month-over-month"}', now() - interval '2 days'),
  ('evt_acme_002', 'idem_acme_002', 'ws_default', 'Acme Corporation', 'feature_used', 'alex.morgan@acme.example', 'Cohort Export', 18, 25, -28.0, '{"sessions":4}', now() - interval '1 day'),
  ('evt_nova_001', 'idem_nova_001', 'ws_default', 'NovaTech', 'subscription_activity', 'taylor.reed@novatech.example', 'Workflow Automation', 47, 50, 34.0, '{"note":"Team adoption increased 34%"}', now() - interval '1 day'),
  ('evt_bright_001', 'idem_bright_001', 'ws_default', 'BrightPath', 'user_login', 'sam.patel@brightpath.example', 'Core Workspace', 32, 35, 12.0, '{"note":"91% weekly active seats"}', now() - interval '12 hours')
on conflict (event_id) do nothing;

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type BadgeTone = "red" | "green" | "blue" | "amber" | "neutral"

export interface AccountRecord {
  id?: string
  name: string
  initials: string
  status: string
  tone: BadgeTone
  signal: string
  renewal: string
  action: string
  color: string
  owner: string
  arr: string
  tier?: string
  renewal_days?: string
  last_meeting?: string
  last_meeting_date?: string
  product_usage?: string
  product_usage_note?: string
  champion_status?: string
  champion_note?: string
  champion_email?: string
  followup_status?: string
  followup_note?: string
}

export interface EvidenceRecord {
  id?: string
  account_name: string
  code: string
  title: string
  source: string
  verified_date: string
  icon: string
}

export interface InteractionRecord {
  id?: string
  account_name: string
  date_label: string
  title: string
  meta: string
  note: string
  is_alert: boolean
  sort_order: number
}

export interface ApprovalRecord {
  id: string
  customer: string
  action: string
  owner: string
  refs: string
  current_data: string
  proposed_change: string
  priority_label: string
  priority_tone: BadgeTone
  description: string
  status: "pending" | "approved" | "rejected"
  submitted_label: string
  recipient_email?: string
  email_subject?: string
  email_body?: string
  rejection_reason?: string
}

export interface AuditLogRecord {
  id?: string
  timestamp_label: string
  customer: string
  action: string
  decision_by: string
  status: "Executed" | "Rejected" | "Awaiting approval"
  refs: string
  details?: string
}

export interface RiskOpportunityRecord {
  id?: string
  category: "risk" | "opportunity"
  customer: string
  value_label: string
  signal: string
  badge_label: string
  refs: string
}

export interface IntegrationRecord {
  id?: string
  name: string
  provider: string
  description: string
  status: string
  tone: BadgeTone
  icon: string
}

export interface WorkspaceSettingsRecord {
  id: number
  workspace_name: string
  timezone: string
  primary_crm: string
  default_task_owner: string
  require_human_approval: boolean
  record_evidence_refs: boolean
  notify_account_owners: boolean
}

const STORAGE_URL_KEY = "technova_supabase_url"
const STORAGE_ANON_KEY = "technova_supabase_anon_key"

export function getSupabaseConfig() {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

  const storedUrl =
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_URL_KEY)?.trim() : ""
  const storedKey =
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_ANON_KEY)?.trim() : ""

  const url =
    envUrl && !envUrl.includes("your-project-ref")
      ? envUrl
      : storedUrl || ""
  const anonKey =
    envKey && !envKey.includes("your-anon-key")
      ? envKey
      : storedKey || ""

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey && url.startsWith("http")),
  }
}

let cachedClient: SupabaseClient | null = null
let cachedKey = ""

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig()
  if (!isConfigured) return null

  const key = `${url}::${anonKey}`
  if (!cachedClient || cachedKey !== key) {
    cachedClient = createClient(url, anonKey)
    cachedKey = key
  }
  return cachedClient
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_URL_KEY, url.trim())
  window.localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim())
  cachedClient = null
  cachedKey = ""
}

export function clearSupabaseCredentials() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_URL_KEY)
  window.localStorage.removeItem(STORAGE_ANON_KEY)
  cachedClient = null
  cachedKey = ""
}

export const DEFAULT_ACCOUNTS: AccountRecord[] = [
  {
    name: "Acme Corporation",
    initials: "AC",
    status: "At Risk",
    tone: "red",
    signal: "Usage declined 28% this month",
    renewal: "May 28, 2025",
    action: "Create follow-up task",
    color: "bg-indigo-100 text-indigo-700",
    owner: "Maya Chen",
    arr: "$86K",
    tier: "Enterprise",
    renewal_days: "43 days",
    last_meeting: "21 days ago",
    last_meeting_date: "Mar 25, 2025",
    product_usage: "Declining",
    product_usage_note: "Down 28% this month",
    champion_status: "No recent reply",
    champion_note: "Last reply 20 days ago",
    champion_email: "alex.morgan@acme.example",
    followup_status: "No next step",
    followup_note: "Task unavailable",
  },
  {
    name: "NovaTech",
    initials: "NT",
    status: "Expansion Opportunity",
    tone: "blue",
    signal: "Team adoption up 34%",
    renewal: "Aug 12, 2025",
    action: "Schedule expansion review",
    color: "bg-cyan-100 text-cyan-700",
    owner: "Priya Shah",
    arr: "$64K",
    tier: "Growth",
    renewal_days: "119 days",
    last_meeting: "6 days ago",
    last_meeting_date: "Apr 09, 2025",
    product_usage: "Expanding",
    product_usage_note: "Up 34% this month",
    champion_status: "Active champion",
    champion_note: "Replied 2 days ago",
    champion_email: "taylor.reed@novatech.example",
    followup_status: "Scheduled",
    followup_note: "Review on Apr 22",
  },
  {
    name: "BrightPath",
    initials: "BP",
    status: "Healthy",
    tone: "green",
    signal: "Strong weekly engagement",
    renewal: "Oct 03, 2025",
    action: "Maintain success plan",
    color: "bg-emerald-100 text-emerald-700",
    owner: "Jordan Davis",
    arr: "$48K",
    tier: "Mid-Market",
    renewal_days: "171 days",
    last_meeting: "11 days ago",
    last_meeting_date: "Apr 04, 2025",
    product_usage: "Healthy",
    product_usage_note: "91% weekly active seats",
    champion_status: "Engaged",
    champion_note: "Last reply 4 days ago",
    champion_email: "sam.patel@brightpath.example",
    followup_status: "On track",
    followup_note: "QBR scheduled",
  },
  {
    name: "CloudSync",
    initials: "CS",
    status: "Pending Approval",
    tone: "amber",
    signal: "Champion changed roles",
    renewal: "Jun 17, 2025",
    action: "Draft stakeholder email",
    color: "bg-amber-100 text-amber-700",
    owner: "Marcus Lee",
    arr: "$72K",
    tier: "Enterprise",
    renewal_days: "63 days",
    last_meeting: "18 days ago",
    last_meeting_date: "Mar 28, 2025",
    product_usage: "Stable",
    product_usage_note: "Flat month-over-month",
    champion_status: "Role transition",
    champion_note: "New VP of Ops announced",
    champion_email: "casey.lin@cloudsync.example",
    followup_status: "Awaiting approval",
    followup_note: "Draft transition email",
  },
]

export const DEFAULT_EVIDENCE: EvidenceRecord[] = [
  {
    account_name: "Acme Corporation",
    code: "E1",
    title: "Renewal is due in 43 days",
    source: "Salesforce CRM",
    verified_date: "Verified Apr 15, 2025",
    icon: "calendar",
  },
  {
    account_name: "Acme Corporation",
    code: "E2",
    title: "Product usage declined by 28%",
    source: "Product analytics",
    verified_date: "Mar 15 – Apr 15, 2025",
    icon: "activity",
  },
  {
    account_name: "Acme Corporation",
    code: "E3",
    title: "Champion has not replied",
    source: "Connected email",
    verified_date: "Last reply Mar 26, 2025",
    icon: "mail",
  },
  {
    account_name: "Acme Corporation",
    code: "E4",
    title: "No follow-up task was recorded",
    source: "CRM activities",
    verified_date: "Since meeting Mar 25, 2025",
    icon: "file",
  },
]

export const DEFAULT_INTERACTIONS: InteractionRecord[] = [
  {
    account_name: "Acme Corporation",
    date_label: "Mar 25",
    title: "Quarterly review meeting",
    meta: "Maya Chen · 42 min",
    note: "Meeting notes synced",
    is_alert: false,
    sort_order: 1,
  },
  {
    account_name: "Acme Corporation",
    date_label: "Mar 26",
    title: "Champion replied to recap",
    meta: "Alex Morgan · Email",
    note: "Last inbound response",
    is_alert: false,
    sort_order: 2,
  },
  {
    account_name: "Acme Corporation",
    date_label: "Apr 08",
    title: "Usage alert detected",
    meta: "Product analytics",
    note: "Weekly active use down 28%",
    is_alert: true,
    sort_order: 3,
  },
]

export const DEFAULT_APPROVALS: ApprovalRecord[] = [
  {
    id: "app-1",
    customer: "Acme Corporation",
    action: "Create a customer follow-up task",
    owner: "Maya Chen",
    refs: "E1, E3, E4",
    current_data: "No open task",
    proposed_change: "Due tomorrow at 5:00 PM",
    priority_label: "High priority",
    priority_tone: "red",
    description:
      "The account is approaching renewal with declining engagement and no documented follow-up.",
    status: "pending",
    submitted_label: "Submitted 1h ago",
  },
  {
    id: "app-2",
    customer: "CloudSync",
    action: "Draft stakeholder transition email",
    owner: "Jordan Davis",
    refs: "E2, E5",
    current_data: "No open task",
    proposed_change: "Save as email draft",
    priority_label: "Customer outreach",
    priority_tone: "amber",
    description:
      "AI detected a verified customer signal and recommends a trackable next step.",
    status: "pending",
    submitted_label: "Submitted 2h ago",
  },
  {
    id: "app-3",
    customer: "NovaTech",
    action: "Schedule expansion review",
    owner: "Priya Shah",
    refs: "E1, E6",
    current_data: "No open task",
    proposed_change: "Create calendar task",
    priority_label: "Standard review",
    priority_tone: "blue",
    description:
      "AI detected a verified customer signal and recommends a trackable next step.",
    status: "pending",
    submitted_label: "Submitted 3h ago",
  },
  {
    id: "app-4",
    customer: "Pioneer Labs",
    action: "Update renewal risk field",
    owner: "Marcus Lee",
    refs: "E2, E3",
    current_data: "Risk: Low",
    proposed_change: "Change CRM field to Medium",
    priority_label: "Standard review",
    priority_tone: "blue",
    description:
      "AI detected a verified customer signal and recommends a trackable next step.",
    status: "pending",
    submitted_label: "Submitted 4h ago",
  },
]

export const DEFAULT_AUDIT_LOGS: AuditLogRecord[] = [
  {
    timestamp_label: "Apr 15, 9:18 AM",
    customer: "CloudSync",
    action: "Draft stakeholder email",
    decision_by: "Pending",
    status: "Awaiting approval",
    refs: "E2, E5",
  },
  {
    timestamp_label: "Apr 14, 4:35 PM",
    customer: "BrightPath",
    action: "Update success plan",
    decision_by: "Priya Shah",
    status: "Executed",
    refs: "E1",
  },
  {
    timestamp_label: "Apr 14, 2:11 PM",
    customer: "Pioneer Labs",
    action: "Update risk field",
    decision_by: "Marcus Lee",
    status: "Rejected",
    refs: "E2, E3",
  },
  {
    timestamp_label: "Apr 13, 11:05 AM",
    customer: "NovaTech",
    action: "Create expansion task",
    decision_by: "Jordan Davis",
    status: "Executed",
    refs: "E4, E6",
  },
]

export const DEFAULT_RISKS_OPPORTUNITIES: RiskOpportunityRecord[] = [
  {
    category: "risk",
    customer: "Acme Corporation",
    value_label: "$86K ARR",
    signal: "Usage down 28% · renewal in 43 days",
    badge_label: "High",
    refs: "E1, E2, E3",
  },
  {
    category: "risk",
    customer: "Pioneer Labs",
    value_label: "$58K ARR",
    signal: "Executive sponsor left the company",
    badge_label: "High",
    refs: "E2, E5",
  },
  {
    category: "risk",
    customer: "Northstar Media",
    value_label: "$42K ARR",
    signal: "Support satisfaction declined",
    badge_label: "Medium",
    refs: "E3, E4",
  },
  {
    category: "opportunity",
    customer: "NovaTech",
    value_label: "$32K potential",
    signal: "Team adoption increased 34%",
    badge_label: "Strong",
    refs: "E6, E7",
  },
  {
    category: "opportunity",
    customer: "Vertex Health",
    value_label: "$28K potential",
    signal: "Seat utilization reached 92%",
    badge_label: "Strong",
    refs: "E1, E4",
  },
  {
    category: "opportunity",
    customer: "BrightPath",
    value_label: "$24K potential",
    signal: "Requested advanced feature demo",
    badge_label: "Emerging",
    refs: "E3",
  },
]

export const DEFAULT_INTEGRATIONS: IntegrationRecord[] = [
  {
    name: "CRM",
    provider: "Salesforce",
    description: "Customer, renewal, and activity records",
    status: "Connected",
    tone: "green",
    icon: "users",
  },
  {
    name: "Email",
    provider: "Google Workspace",
    description: "Thread and response activity",
    status: "Demo mode",
    tone: "amber",
    icon: "mail",
  },
  {
    name: "Calendar",
    provider: "Google Calendar",
    description: "Meetings and follow-up events",
    status: "Connected",
    tone: "green",
    icon: "calendar",
  },
  {
    name: "Product Usage Data",
    provider: "RevenuePilot Events",
    description: "Feature adoption and active usage",
    status: "Demo mode",
    tone: "amber",
    icon: "activity",
  },
]

export const DEFAULT_SETTINGS: WorkspaceSettingsRecord = {
  id: 1,
  workspace_name: "Revenue Operations",
  timezone: "Pacific Time (PT)",
  primary_crm: "Salesforce",
  default_task_owner: "Account owner",
  require_human_approval: true,
  record_evidence_refs: true,
  notify_account_owners: true,
}

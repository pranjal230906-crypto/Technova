import type { User } from "@supabase/supabase-js"
import type {
  AccountRecord,
  ApprovalRecord,
  AuditLogRecord,
  EvidenceRecord,
  IntegrationRecord,
  InteractionRecord,
  RiskOpportunityRecord,
  WorkspaceSettingsRecord,
} from "./supabase"
import { DEFAULT_INTEGRATIONS } from "./supabase"

export interface AppSessionUser {
  id: string
  email: string
  fullName: string
  role: string
  department: string
  avatarInitials: string
  authSource: "supabase" | "operator_credentials"
  portfolioLabel: string
}

export interface TerritoryPodOption {
  department: string
  portfolioLabel: string
  description: string
  sampleAccounts: string
}

export const TERRITORY_PODS: TerritoryPodOption[] = [
  {
    department: "Enterprise Renewals",
    portfolioLabel: "Enterprise Renewal & Retention Pod",
    description:
      "High-ARR enterprise accounts approaching renewal within 90 days.",
    sampleAccounts:
      "Acme Corporation ($86K), Apex FinTech ($118K), CloudSync ($72K), Vanguard Retail ($94K)",
  },
  {
    department: "Commercial Expansion",
    portfolioLabel: "Growth & Upsell Velocity Pod",
    description:
      "High-adoption growth accounts exceeding seat capacity and ready for expansion.",
    sampleAccounts:
      "NovaTech ($64K), Vertex Health ($112K), Pulse Genomics ($78K), BrightPath ($48K)",
  },
  {
    department: "Global RevOps Command",
    portfolioLabel: "Executive Strategic Portfolio",
    description:
      "Cross-segment strategic escalations, sponsor transitions, and governance oversight.",
    sampleAccounts:
      "Pioneer Labs ($58K), Acme Corporation ($86K), NovaTech ($64K), BrightPath ($48K)",
  },
]

export interface UserWorkspaceBundle {
  accounts: AccountRecord[]
  evidence: EvidenceRecord[]
  interactions: InteractionRecord[]
  approvals: ApprovalRecord[]
  auditLogs: AuditLogRecord[]
  risksOpportunities: RiskOpportunityRecord[]
  integrations: IntegrationRecord[]
  settings: WorkspaceSettingsRecord
}

const STORAGE_ACTIVE_SESSION = "dealflow_active_session_v1"
const STORAGE_REGISTERED_USERS = "dealflow_registered_users_v1"
const STORAGE_USER_DATA_PREFIX = "dealflow_workspace_data_v1_"

export interface StoredOperatorAccount extends AppSessionUser {
  passwordHash: string
}

export const PRESET_OPERATORS: StoredOperatorAccount[] = [
  {
    id: "usr-maya-chen-101",
    email: "maya@dealflow.ai",
    fullName: "Maya Chen",
    role: "Senior Enterprise AE",
    department: "Enterprise Renewals",
    avatarInitials: "MC",
    authSource: "operator_credentials",
    portfolioLabel: "Enterprise Renewal & Retention Pod",
    passwordHash: "dealflow123",
  },
  {
    id: "usr-priya-shah-202",
    email: "priya@dealflow.ai",
    fullName: "Priya Shah",
    role: "Growth & Expansion Lead",
    department: "Commercial Expansion",
    avatarInitials: "PS",
    authSource: "operator_credentials",
    portfolioLabel: "Growth & Upsell Velocity Pod",
    passwordHash: "dealflow123",
  },
  {
    id: "usr-jordan-davis-303",
    email: "jordan@dealflow.ai",
    fullName: "Jordan Davis",
    role: "VP of Revenue Operations",
    department: "Global RevOps Command",
    avatarInitials: "JD",
    authSource: "operator_credentials",
    portfolioLabel: "Executive Strategic Portfolio",
    passwordHash: "dealflow123",
  },
]

export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "DF"
  )
}

function hashUserIdToPodIndex(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return hash % TERRITORY_PODS.length
}

export function resolvePodForUser(
  userId: string,
  department?: string,
  portfolioLabel?: string,
): TerritoryPodOption {
  const combined = `${department || ""} ${portfolioLabel || ""}`.toLowerCase()
  if (combined.includes("growth") || combined.includes("expansion") || combined.includes("commercial")) {
    return TERRITORY_PODS[1]
  }
  if (combined.includes("executive") || combined.includes("global") || combined.includes("strategic")) {
    return TERRITORY_PODS[2]
  }
  if (combined.includes("enterprise") || combined.includes("renewal")) {
    return TERRITORY_PODS[0]
  }
  return TERRITORY_PODS[hashUserIdToPodIndex(userId)]
}

export function mapSupabaseUserToSession(
  sbUser: User,
  profile?: {
    full_name?: string | null
    role?: string | null
    department?: string | null
    portfolio_label?: string | null
  } | null,
): AppSessionUser {
  const meta = sbUser.user_metadata || {}
  const fullName =
    profile?.full_name ||
    meta.full_name ||
    sbUser.email?.split("@")[0] ||
    "RevOps Operator"
  const role = profile?.role || meta.role || "Enterprise Account Executive"
  const rawDept = profile?.department || meta.department || ""
  const rawPortfolio = profile?.portfolio_label || meta.portfolio_label || ""
  const resolvedPod = resolvePodForUser(sbUser.id, rawDept, rawPortfolio)

  return {
    id: sbUser.id,
    email: sbUser.email || "",
    fullName,
    role,
    department: rawDept || resolvedPod.department,
    avatarInitials: getInitials(fullName),
    authSource: "supabase",
    portfolioLabel: rawPortfolio || resolvedPod.portfolioLabel,
  }
}

export function generateDeterministicUserId(email: string): string {
  const clean = email.trim().toLowerCase()
  const preset = PRESET_OPERATORS.find((p) => p.email.toLowerCase() === clean)
  if (preset) return preset.id

  let hash = 2166136261
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const hex = (hash >>> 0).toString(16).padStart(6, "0").slice(0, 6)
  const slug = clean
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12)
  return `usr-${slug || "operator"}-${hex}`
}

export function getRegisteredUsers(): StoredOperatorAccount[] {
  if (typeof window === "undefined") return PRESET_OPERATORS
  try {
    const raw = window.localStorage.getItem(STORAGE_REGISTERED_USERS)
    if (!raw) return PRESET_OPERATORS
    const custom = JSON.parse(raw) as StoredOperatorAccount[]
    if (!Array.isArray(custom)) return PRESET_OPERATORS
    const merged = [...PRESET_OPERATORS]
    for (const u of custom) {
      if (!merged.some((m) => m.email.toLowerCase() === u.email.toLowerCase())) {
        merged.push(u)
      }
    }
    return merged
  } catch {
    return PRESET_OPERATORS
  }
}

export function registerOperatorUser(input: {
  fullName: string
  email: string
  password: string
  role?: string
  department?: string
  customUserId?: string
}): AppSessionUser {
  const cleanEmail = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim() || cleanEmail.split("@")[0]
  const id =
    input.customUserId?.trim() || generateDeterministicUserId(cleanEmail)
  const resolvedPod = resolvePodForUser(id, input.department)
  const newUser: StoredOperatorAccount = {
    id,
    email: cleanEmail,
    fullName,
    role: input.role?.trim() || "Enterprise Account Executive",
    department: input.department?.trim() || resolvedPod.department,
    avatarInitials: getInitials(fullName),
    authSource: "operator_credentials",
    portfolioLabel: resolvedPod.portfolioLabel,
    passwordHash: input.password,
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_REGISTERED_USERS)
      const list: StoredOperatorAccount[] = raw ? JSON.parse(raw) : []
      const filtered = list.filter(
        (u) => u.email.toLowerCase() !== cleanEmail && u.id !== id,
      )
      filtered.push(newUser)
      window.localStorage.setItem(
        STORAGE_REGISTERED_USERS,
        JSON.stringify(filtered),
      )
    } catch {
      // ignore storage errors
    }
  }

  saveActiveSession(newUser)
  return newUser
}

export function authenticateOperatorUser(
  emailOrId: string,
  password: string,
): { ok: boolean; user?: AppSessionUser; error?: string } {
  const query = emailOrId.trim().toLowerCase()
  const users = getRegisteredUsers()
  const matched = users.find(
    (u) => u.email.toLowerCase() === query || u.id.toLowerCase() === query,
  )

  if (!matched) {
    return {
      ok: false,
      error:
        "Invalid login credentials. Please check your email and password or create a new account.",
    }
  }

  if (matched.passwordHash && matched.passwordHash !== password) {
    return {
      ok: false,
      error: "Invalid login credentials. Please check your password.",
    }
  }

  saveActiveSession(matched)
  return { ok: true, user: matched }
}

export function getActiveSession(): AppSessionUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_ACTIVE_SESSION)
    if (!raw) return null
    return JSON.parse(raw) as AppSessionUser
  } catch {
    return null
  }
}

export function saveActiveSession(user: AppSessionUser) {
  if (typeof window === "undefined") return
  const clean: AppSessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    avatarInitials: user.avatarInitials || getInitials(user.fullName),
    authSource: user.authSource,
    portfolioLabel: user.portfolioLabel,
  }
  window.localStorage.setItem(STORAGE_ACTIVE_SESSION, JSON.stringify(clean))
}

export function clearActiveSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_ACTIVE_SESSION)
}

/**
 * Builds the default workspace data specifically tailored to a given User ID.
 */
function buildDefaultBundleForUser(user: AppSessionUser): UserWorkspaceBundle {
  const ownerDisplay = user.fullName || "RevOps Operator"
  const pod = resolvePodForUser(user.id, user.department, user.portfolioLabel)

  // POD 1: Enterprise Renewal & Retention Pod
  if (pod.department === "Enterprise Renewals") {
    return {
      accounts: [
        {
          name: "Acme Corporation",
          initials: "AC",
          status: "At Risk",
          tone: "red",
          signal: "Usage declined 28% this month",
          renewal: "May 28, 2025",
          action: "Create follow-up task",
          color: "bg-indigo-100 text-indigo-700",
          owner: ownerDisplay,
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
          name: "Apex FinTech",
          initials: "AF",
          status: "At Risk",
          tone: "red",
          signal: "Security compliance questionnaire pending",
          renewal: "Jun 04, 2025",
          action: "Send SOC2 renewal packet",
          color: "bg-rose-100 text-rose-700",
          owner: ownerDisplay,
          arr: "$118K",
          tier: "Enterprise",
          renewal_days: "50 days",
          last_meeting: "14 days ago",
          last_meeting_date: "Apr 01, 2025",
          product_usage: "Declining",
          product_usage_note: "Admin logins down 19%",
          champion_status: "Awaiting security sign-off",
          champion_note: "CISO team reviewing",
          champion_email: "elena.rostova@apexfintech.example",
          followup_status: "Blocked",
          followup_note: "Pending security packet",
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
          owner: ownerDisplay,
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
        {
          name: "Vanguard Retail",
          initials: "VR",
          status: "Healthy",
          tone: "green",
          signal: "96% seat utilization across 4 regions",
          renewal: "Sep 19, 2025",
          action: "Prepare Q3 executive review",
          color: "bg-emerald-100 text-emerald-700",
          owner: ownerDisplay,
          arr: "$94K",
          tier: "Enterprise",
          renewal_days: "157 days",
          last_meeting: "5 days ago",
          last_meeting_date: "Apr 10, 2025",
          product_usage: "Healthy",
          product_usage_note: "96% weekly active seats",
          champion_status: "Engaged",
          champion_note: "Replied yesterday",
          champion_email: "marcus.vance@vanguardretail.example",
          followup_status: "On track",
          followup_note: "Executive QBR booked",
        },
      ],
      evidence: [
        {
          account_name: "Acme Corporation",
          code: "E1",
          title: "Renewal is due in 43 days ($86K ARR)",
          source: "Salesforce CRM",
          verified_date: "Verified Apr 15, 2025",
          icon: "calendar",
        },
        {
          account_name: "Acme Corporation",
          code: "E2",
          title: "Product usage declined by 28%",
          source: "DealFlow Events",
          verified_date: "Mar 15 – Apr 15, 2025",
          icon: "activity",
        },
        {
          account_name: "Acme Corporation",
          code: "E3",
          title: "Champion Alex Morgan has not replied",
          source: "Connected email",
          verified_date: "Last reply Mar 26, 2025",
          icon: "mail",
        },
        {
          account_name: "Acme Corporation",
          code: "E4",
          title: `No follow-up task recorded for ${ownerDisplay}`,
          source: "CRM activities",
          verified_date: "Since meeting Mar 25, 2025",
          icon: "file",
        },
      ],
      interactions: [
        {
          account_name: "Acme Corporation",
          date_label: "Mar 25",
          title: "Quarterly review meeting",
          meta: `${ownerDisplay} · 42 min`,
          note: "Analytics team restructuring discussed",
          is_alert: false,
          sort_order: 1,
        },
        {
          account_name: "Acme Corporation",
          date_label: "Mar 26",
          title: "Champion replied to recap",
          meta: "Alex Morgan · Email",
          note: "Requested onboarding workflow template",
          is_alert: false,
          sort_order: 2,
        },
        {
          account_name: "Acme Corporation",
          date_label: "Apr 08",
          title: "Usage alert detected",
          meta: "DealFlow Telemetry",
          note: "Weekly active use down 28%",
          is_alert: true,
          sort_order: 3,
        },
      ],
      approvals: [
        {
          id: `app-${user.id}-1`,
          customer: "Acme Corporation",
          action: "Create a customer follow-up task",
          owner: ownerDisplay,
          refs: "E1, E3, E4",
          current_data: "No open task",
          proposed_change: "Due tomorrow at 5:00 PM",
          priority_label: "High priority",
          priority_tone: "red",
          description:
            "Acme Corporation is 43 days from renewal with a 28% usage drop and no documented follow-up task.",
          status: "pending",
          submitted_label: "Submitted 35m ago",
        },
        {
          id: `app-${user.id}-2`,
          customer: "Apex FinTech",
          action: "Send SOC2 & security renewal packet",
          owner: ownerDisplay,
          refs: "E1, E2",
          current_data: "Security review pending",
          proposed_change: "Email CISO security bundle",
          priority_label: "High priority",
          priority_tone: "red",
          description:
            "Apex FinTech ($118K ARR) requires SOC2 Type II documentation to unblock their June 4 renewal.",
          status: "pending",
          submitted_label: "Submitted 2h ago",
        },
        {
          id: `app-${user.id}-3`,
          customer: "CloudSync",
          action: "Draft stakeholder transition email",
          owner: ownerDisplay,
          refs: "E2, E3",
          current_data: "Champion transitioned",
          proposed_change: "Intro email to new VP of Ops",
          priority_label: "Customer outreach",
          priority_tone: "amber",
          description: `Introduce ${ownerDisplay} and share Q1 ROI summary with incoming VP of Operations Casey Lin.`,
          status: "pending",
          submitted_label: "Submitted 4h ago",
        },
      ],
      auditLogs: [
        {
          timestamp_label: "Apr 15, 10:12 AM",
          customer: "Vanguard Retail",
          action: "Schedule Q3 Executive QBR",
          decision_by: ownerDisplay,
          status: "Executed",
          refs: "E1, E4",
          details: "Confirmed with Marcus Vance",
        },
        {
          timestamp_label: "Apr 14, 3:40 PM",
          customer: "Acme Corporation",
          action: "Flagged renewal risk alert",
          decision_by: ownerDisplay,
          status: "Awaiting approval",
          refs: "E1, E2, E3",
          details: "Assigned to Enterprise Pod",
        },
      ],
      risksOpportunities: [
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
          customer: "Apex FinTech",
          value_label: "$118K ARR",
          signal: "Security compliance sign-off pending · 50 days to renewal",
          badge_label: "High",
          refs: "E1, E2",
        },
        {
          category: "opportunity",
          customer: "Vanguard Retail",
          value_label: "$38K potential",
          signal: "96% seat utilization · 4 regional teams active",
          badge_label: "Strong",
          refs: "E1, E4",
        },
      ],
      integrations: DEFAULT_INTEGRATIONS,
      settings: {
        id: 1,
        workspace_name: `${ownerDisplay} · Enterprise Renewal Pod`,
        timezone: "Pacific Time (PT)",
        primary_crm: "Salesforce",
        default_task_owner: "Account owner",
        require_human_approval: true,
        record_evidence_refs: true,
        notify_account_owners: true,
      },
    }
  }

  // POD 2: Growth & Upsell Velocity Pod
  if (pod.department === "Commercial Expansion") {
    return {
      accounts: [
        {
          name: "NovaTech",
          initials: "NT",
          status: "Expansion Opportunity",
          tone: "blue",
          signal: "Team adoption up 34% across engineering",
          renewal: "Aug 12, 2025",
          action: "Schedule expansion review",
          color: "bg-cyan-100 text-cyan-700",
          owner: ownerDisplay,
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
          name: "Vertex Health",
          initials: "VH",
          status: "Expansion Opportunity",
          tone: "blue",
          signal: "Clinical seat utilization reached 94%",
          renewal: "Jul 22, 2025",
          action: "Send Enterprise Plus tier quote",
          color: "bg-sky-100 text-sky-700",
          owner: ownerDisplay,
          arr: "$112K",
          tier: "Enterprise",
          renewal_days: "98 days",
          last_meeting: "4 days ago",
          last_meeting_date: "Apr 11, 2025",
          product_usage: "Expanding",
          product_usage_note: "94% of licensed seats active",
          champion_status: "Requested quote",
          champion_note: "25 new clinical coordinators onboarding",
          champion_email: "dr.chen@vertexhealth.example",
          followup_status: "Action required",
          followup_note: "Prepare 25-seat expansion order",
        },
        {
          name: "Pulse Genomics",
          initials: "PG",
          status: "At Risk",
          tone: "red",
          signal: "API pipeline volume dropped 31%",
          renewal: "May 30, 2025",
          action: "Book technical solution check-in",
          color: "bg-rose-100 text-rose-700",
          owner: ownerDisplay,
          arr: "$78K",
          tier: "Growth",
          renewal_days: "45 days",
          last_meeting: "19 days ago",
          last_meeting_date: "Mar 27, 2025",
          product_usage: "Declining",
          product_usage_note: "API calls down 31%",
          champion_status: "Delayed response",
          champion_note: "Last reply 16 days ago",
          champion_email: "devon.brooks@pulsegenomics.example",
          followup_status: "No next step",
          followup_note: "Needs solutions architect",
        },
        {
          name: "BrightPath",
          initials: "BP",
          status: "Healthy",
          tone: "green",
          signal: "Strong weekly engagement (91% active)",
          renewal: "Oct 03, 2025",
          action: "Share advanced analytics demo",
          color: "bg-emerald-100 text-emerald-700",
          owner: ownerDisplay,
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
          followup_note: "Feature demo requested",
        },
      ],
      evidence: [
        {
          account_name: "NovaTech",
          code: "E1",
          title: "Weekly active engineering seats increased +34%",
          source: "DealFlow Events",
          verified_date: "Verified Apr 15, 2025",
          icon: "activity",
        },
        {
          account_name: "NovaTech",
          code: "E2",
          title: "License capacity at 92% (46 of 50 seats used)",
          source: "Billing & Entitlements",
          verified_date: "Verified Apr 14, 2025",
          icon: "users",
        },
        {
          account_name: "NovaTech",
          code: "E3",
          title: "Champion Taylor Reed requested Enterprise API limits",
          source: "Connected email",
          verified_date: "Apr 13, 2025",
          icon: "mail",
        },
        {
          account_name: "NovaTech",
          code: "E4",
          title: "Expansion review meeting tentative for Apr 22",
          source: "Google Calendar",
          verified_date: "Synced Apr 14, 2025",
          icon: "calendar",
        },
      ],
      interactions: [
        {
          account_name: "NovaTech",
          date_label: "Apr 09",
          title: "Growth & adoption review",
          meta: `${ownerDisplay} · 30 min`,
          note: "Customer onboarded 2 new product squads",
          is_alert: false,
          sort_order: 1,
        },
        {
          account_name: "NovaTech",
          date_label: "Apr 13",
          title: "Champion requested tier pricing",
          meta: "Taylor Reed · Email",
          note: "Asked for 25 additional seat bundle",
          is_alert: false,
          sort_order: 2,
        },
        {
          account_name: "NovaTech",
          date_label: "Apr 15",
          title: "Expansion trigger threshold passed",
          meta: "DealFlow Telemetry",
          note: "Seat utilization crossed 90% threshold",
          is_alert: false,
          sort_order: 3,
        },
      ],
      approvals: [
        {
          id: `app-${user.id}-1`,
          customer: "NovaTech",
          action: "Send 25-seat expansion proposal ($32K ARR)",
          owner: ownerDisplay,
          refs: "E1, E2, E3",
          current_data: "50 seats ($64K ARR)",
          proposed_change: "Upgrade to 75 seats ($96K ARR)",
          priority_label: "Expansion ready",
          priority_tone: "blue",
          description:
            "NovaTech is at 92% seat capacity with +34% adoption growth. Champion requested expansion pricing.",
          status: "pending",
          submitted_label: "Submitted 25m ago",
        },
        {
          id: `app-${user.id}-2`,
          customer: "Vertex Health",
          action: "Approve Enterprise Plus upgrade deck",
          owner: ownerDisplay,
          refs: "E1, E2",
          current_data: "Standard Enterprise ($112K)",
          proposed_change: "Enterprise Plus ($140K ARR)",
          priority_label: "Expansion ready",
          priority_tone: "blue",
          description:
            "Vertex Health is onboarding 25 clinical coordinators next month and needs HIPAA-plus telemetry.",
          status: "pending",
          submitted_label: "Submitted 1h ago",
        },
        {
          id: `app-${user.id}-3`,
          customer: "Pulse Genomics",
          action: "Schedule urgent solutions architect intervention",
          owner: ownerDisplay,
          refs: "E1, E3",
          current_data: "API volume -31%",
          proposed_change: "Book technical diagnostic call tomorrow",
          priority_label: "High priority",
          priority_tone: "red",
          description:
            "Pulse Genomics shows a 31% drop in API pipeline events 45 days before renewal.",
          status: "pending",
          submitted_label: "Submitted 3h ago",
        },
      ],
      auditLogs: [
        {
          timestamp_label: "Apr 15, 11:20 AM",
          customer: "Vertex Health",
          action: "Generated capacity ROI report",
          decision_by: ownerDisplay,
          status: "Executed",
          refs: "E1, E2",
          details: "94% seat utilization verified",
        },
        {
          timestamp_label: "Apr 14, 4:35 PM",
          customer: "BrightPath",
          action: "Update expansion success plan",
          decision_by: ownerDisplay,
          status: "Executed",
          refs: "E1",
          details: "Advanced analytics demo scheduled",
        },
      ],
      risksOpportunities: [
        {
          category: "opportunity",
          customer: "NovaTech",
          value_label: "$32K potential",
          signal: "Team adoption increased 34% · 92% seat utilization",
          badge_label: "Strong",
          refs: "E1, E2, E3",
        },
        {
          category: "opportunity",
          customer: "Vertex Health",
          value_label: "$28K potential",
          signal: "Clinical seat utilization reached 94%",
          badge_label: "Strong",
          refs: "E1, E2",
        },
        {
          category: "risk",
          customer: "Pulse Genomics",
          value_label: "$78K ARR",
          signal: "API pipeline volume dropped 31% · 45 days to renewal",
          badge_label: "High",
          refs: "E1, E3",
        },
      ],
      integrations: DEFAULT_INTEGRATIONS,
      settings: {
        id: 1,
        workspace_name: `${ownerDisplay} · Growth & Expansion Pod`,
        timezone: "Eastern Time (ET)",
        primary_crm: "HubSpot",
        default_task_owner: "Account owner",
        require_human_approval: true,
        record_evidence_refs: true,
        notify_account_owners: true,
      },
    }
  }

  // POD 3: Executive Strategic Portfolio (Global RevOps Command)
  const isJordan =
    user.id.toLowerCase().includes("jordan") ||
    user.email.toLowerCase().startsWith("jordan@")

  return {
    accounts: [
      {
        name: "Pioneer Labs",
        initials: "PL",
        status: "At Risk",
        tone: "red",
        signal: "Executive sponsor left the company",
        renewal: "Jun 11, 2025",
        action: "Align with interim VP of Engineering",
        color: "bg-rose-100 text-rose-700",
        owner: ownerDisplay,
        arr: "$58K",
        tier: "Enterprise",
        renewal_days: "57 days",
        last_meeting: "24 days ago",
        last_meeting_date: "Mar 22, 2025",
        product_usage: "Declining",
        product_usage_note: "Down 22% after sponsor departure",
        champion_status: "Sponsor departed",
        champion_note: "LinkedIn & CRM role change alert",
        champion_email: "vp.eng@pioneerlabs.example",
        followup_status: "Urgent",
        followup_note: "Executive multi-threading needed",
      },
      {
        name: "Acme Corporation",
        initials: "AC",
        status: "At Risk",
        tone: "red",
        signal: "Usage declined 28% this month",
        renewal: "May 28, 2025",
        action: "Create follow-up task",
        color: "bg-indigo-100 text-indigo-700",
        owner: isJordan ? "Maya Chen" : ownerDisplay,
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
        owner: isJordan ? "Priya Shah" : ownerDisplay,
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
        owner: ownerDisplay,
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
    ],
    evidence: [
      {
        account_name: "Pioneer Labs",
        code: "E1",
        title: "Renewal is due in 57 days ($58K ARR)",
        source: "Salesforce CRM",
        verified_date: "Verified Apr 15, 2025",
        icon: "calendar",
      },
      {
        account_name: "Pioneer Labs",
        code: "E2",
        title: "Executive sponsor departed company on Apr 02",
        source: "CRM Contact Intelligence",
        verified_date: "Verified Apr 03, 2025",
        icon: "users",
      },
      {
        account_name: "Pioneer Labs",
        code: "E3",
        title: "Weekly workspace usage declined 22%",
        source: "DealFlow Events",
        verified_date: "Mar 15 – Apr 15, 2025",
        icon: "activity",
      },
      {
        account_name: "Pioneer Labs",
        code: "E4",
        title: "No executive alignment call booked yet",
        source: "Google Calendar",
        verified_date: "Since Mar 22, 2025",
        icon: "file",
      },
    ],
    interactions: [
      {
        account_name: "Pioneer Labs",
        date_label: "Mar 22",
        title: "Executive steering sync",
        meta: `${ownerDisplay} · 35 min`,
        note: "Reviewed Q2 roadmap milestones",
        is_alert: false,
        sort_order: 1,
      },
      {
        account_name: "Pioneer Labs",
        date_label: "Apr 03",
        title: "Sponsor departure detected",
        meta: "CRM Alert",
        note: "VP of Engineering changed organization",
        is_alert: true,
        sort_order: 2,
      },
      {
        account_name: "Pioneer Labs",
        date_label: "Apr 10",
        title: "Usage drop alert (-22%)",
        meta: "DealFlow Telemetry",
        note: "Core workflow runs decreased",
        is_alert: true,
        sort_order: 3,
      },
    ],
    approvals: [
      {
        id: `app-${user.id}-1`,
        customer: "Pioneer Labs",
        action: "Send executive sponsor transition outreach",
        owner: ownerDisplay,
        refs: "E1, E2, E3",
        current_data: "Sponsor departed",
        proposed_change: "Executive intro email + QBR invite",
        priority_label: "High priority",
        priority_tone: "red",
        description:
          "Pioneer Labs lost their executive sponsor 57 days before renewal. Immediate multi-threading required.",
        status: "pending",
        submitted_label: "Submitted 1h ago",
      },
      {
        id: `app-${user.id}-2`,
        customer: "Acme Corporation",
        action: "Create a customer follow-up task",
        owner: isJordan ? "Maya Chen" : ownerDisplay,
        refs: "E1, E3, E4",
        current_data: "No open task",
        proposed_change: "Due tomorrow at 5:00 PM",
        priority_label: "High priority",
        priority_tone: "red",
        description:
          "The account is approaching renewal with declining engagement and no documented follow-up.",
        status: "pending",
        submitted_label: "Submitted 2h ago",
      },
    ],
    auditLogs: [
      {
        timestamp_label: "Apr 15, 9:18 AM",
        customer: "Pioneer Labs",
        action: "Detected sponsor departure risk",
        decision_by: ownerDisplay,
        status: "Awaiting approval",
        refs: "E1, E2",
        details: `Scoped to User ID ${user.id}`,
      },
      {
        timestamp_label: "Apr 13, 11:05 AM",
        customer: "NovaTech",
        action: "Create expansion task",
        decision_by: ownerDisplay,
        status: "Executed",
        refs: "E4, E6",
        details: "Approved in Governance Center",
      },
    ],
    risksOpportunities: [
      {
        category: "risk",
        customer: "Pioneer Labs",
        value_label: "$58K ARR",
        signal: "Executive sponsor left the company · usage down 22%",
        badge_label: "High",
        refs: "E1, E2, E3",
      },
      {
        category: "risk",
        customer: "Acme Corporation",
        value_label: "$86K ARR",
        signal: "Usage down 28% · renewal in 43 days",
        badge_label: "High",
        refs: "E1, E2, E3",
      },
      {
        category: "opportunity",
        customer: "NovaTech",
        value_label: "$32K potential",
        signal: "Team adoption increased 34%",
        badge_label: "Strong",
        refs: "E6, E7",
      },
    ],
    integrations: DEFAULT_INTEGRATIONS,
    settings: {
      id: 1,
      workspace_name: `${ownerDisplay} · RevOps Workspace (${user.id})`,
      timezone: "Pacific Time (PT)",
      primary_crm: "Salesforce",
      default_task_owner: "Account owner",
      require_human_approval: true,
      record_evidence_refs: true,
      notify_account_owners: true,
    },
  }
}

export function loadUserWorkspaceBundle(user: AppSessionUser): UserWorkspaceBundle {
  const defaultBundle = buildDefaultBundleForUser(user)
  if (typeof window === "undefined") return defaultBundle
  try {
    const raw = window.localStorage.getItem(
      `${STORAGE_USER_DATA_PREFIX}${user.id}`,
    )
    if (!raw) {
      window.localStorage.setItem(
        `${STORAGE_USER_DATA_PREFIX}${user.id}`,
        JSON.stringify(defaultBundle),
      )
      return defaultBundle
    }
    const parsed = JSON.parse(raw) as Partial<UserWorkspaceBundle>
    return {
      accounts:
        Array.isArray(parsed.accounts) && parsed.accounts.length > 0
          ? parsed.accounts
          : defaultBundle.accounts,
      evidence:
        Array.isArray(parsed.evidence) && parsed.evidence.length > 0
          ? parsed.evidence
          : defaultBundle.evidence,
      interactions:
        Array.isArray(parsed.interactions) && parsed.interactions.length > 0
          ? parsed.interactions
          : defaultBundle.interactions,
      approvals:
        Array.isArray(parsed.approvals) && parsed.approvals.length > 0
          ? parsed.approvals
          : defaultBundle.approvals,
      auditLogs:
        Array.isArray(parsed.auditLogs) && parsed.auditLogs.length > 0
          ? parsed.auditLogs
          : defaultBundle.auditLogs,
      risksOpportunities:
        Array.isArray(parsed.risksOpportunities) &&
        parsed.risksOpportunities.length > 0
          ? parsed.risksOpportunities
          : defaultBundle.risksOpportunities,
      integrations:
        Array.isArray(parsed.integrations) && parsed.integrations.length > 0
          ? parsed.integrations
          : defaultBundle.integrations,
      settings: parsed.settings || defaultBundle.settings,
    }
  } catch {
    return defaultBundle
  }
}

export function saveUserWorkspaceBundle(
  userId: string,
  bundle: UserWorkspaceBundle,
) {
  if (typeof window === "undefined" || !userId) return
  try {
    window.localStorage.setItem(
      `${STORAGE_USER_DATA_PREFIX}${userId}`,
      JSON.stringify(bundle),
    )
  } catch {
    // ignore storage quota errors
  }
}

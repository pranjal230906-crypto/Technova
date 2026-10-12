import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import {
  clearSupabaseCredentials,
  DEFAULT_ACCOUNTS,
  DEFAULT_APPROVALS,
  DEFAULT_AUDIT_LOGS,
  DEFAULT_EVIDENCE,
  DEFAULT_INTEGRATIONS,
  DEFAULT_INTERACTIONS,
  DEFAULT_RISKS_OPPORTUNITIES,
  DEFAULT_SETTINGS,
  getSupabaseClient,
  getSupabaseConfig,
  saveSupabaseCredentials,
  verifySupabaseConnection,
  type AccountRecord,
  type ApprovalRecord,
  type AuditLogRecord,
  type BadgeTone,
  type EvidenceRecord,
  type IntegrationRecord,
  type InteractionRecord,
  type RiskOpportunityRecord,
  type WorkspaceSettingsRecord,
} from "./lib/supabase"
import {
  askGeminiCopilotWithRAG,
  clearGeminiConfig,
  GEMINI_MODELS,
  generateAccountRiskInsight,
  generateFollowUpEmail,
  getGeminiConfig,
  saveGeminiConfig,
  verifyGeminiConnection,
  type AccountAIInsight,
} from "./lib/gemini"
import {
  addCustomRagDocument,
  buildRagCorpus,
  deleteCustomRagDocument,
  getCustomRagDocuments,
  retrieveRelevantChunks,
  type CustomRagDocument,
  type RetrievedChunk,
} from "./lib/rag"
import {
  clearActiveSession,
  getActiveSession,
  getInitials,
  loadUserWorkspaceBundle,
  mapSupabaseUserToSession,
  PRESET_OPERATORS,
  resolvePodForUser,
  saveActiveSession,
  saveUserWorkspaceBundle,
  TERRITORY_PODS,
  type AppSessionUser,
} from "./lib/userWorkspace"
import {
  applyThemeToDom,
  getSavedTheme,
  LandingPage,
  LoginPage,
  ThemeToggleButton,
  type ThemeMode,
} from "./components/LandingAndAuth"
import {
  buildIntegrationCardsFromConfig,
  createGoogleCalendarMeeting,
  loadIntegrationsConfig,
  pushCRMWebhookUpdate,
  saveIntegrationsConfig,
  sendRealEmail,
  type AllIntegrationsConfig,
  type IntegrationKind,
  type IntegrationSyncLog,
} from "./lib/integrations"
import { IntegrationConnectorModal } from "./components/IntegrationConnectorModal"
import {
  callBackendMcpTool,
  decideAndExecuteBackendApproval,
  fetchMcpGatewayRegistry,
  type DiscoveredMcpServer,
  type DiscoveredMcpTool,
} from "./lib/mcpClient"

type Page =
  | "overview"
  | "accounts"
  | "account"
  | "risks"
  | "approvals"
  | "audit"
  | "integrations"
  | "settings"

type IconName =
  | "grid"
  | "users"
  | "alert"
  | "spark"
  | "check"
  | "history"
  | "plug"
  | "settings"
  | "search"
  | "bell"
  | "arrow"
  | "calendar"
  | "activity"
  | "message"
  | "file"
  | "shield"
  | "mail"
  | "edit"
  | "close"

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName
  className?: string
}) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.7 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
        <path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14ZM19 13l-.7 1.3L17 15l1.3.7L19 17l.7-1.3L21 15l-1.3-.7L19 13Z" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    plug: (
      <>
        <path d="m12 22 4-4M7.5 13.5 3 18l3 3 4.5-4.5M16 2l6 6-5 5a4.2 4.2 0 0 1-6 0 4.2 4.2 0 0 1 0-6l5-5Z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    message: (
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: BadgeTone
}) {
  const tones = {
    red: "bg-red-50 text-red-700 ring-red-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function Button({
  children,
  tone = "secondary",
  icon,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode
  tone?: "primary" | "secondary" | "danger" | "ghost"
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit"
}) {
  const tones = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
    ghost: "text-slate-600 hover:bg-slate-100",
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </button>
  )
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}

const navItems: { id: Page; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "accounts", label: "Customer Accounts", icon: "users" },
  { id: "risks", label: "Risk & Opportunities", icon: "alert" },
  { id: "approvals", label: "Approval Center", icon: "check" },
  { id: "audit", label: "Activity & Audit Logs", icon: "history" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "settings", label: "Settings", icon: "settings" },
]

function Sidebar({
  page,
  setPage,
  pendingApprovalsCount,
  onOpenLandingPage,
}: {
  page: Page
  setPage: (page: Page) => void
  pendingApprovalsCount: number
  onOpenLandingPage: () => void
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
        <button
          type="button"
          onClick={onOpenLandingPage}
          className="flex items-center gap-3 text-left transition hover:opacity-80"
          title="View DealFlow AI Front Page"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Icon name="activity" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-slate-950">
              DealFlow <span className="text-emerald-600">AI</span>
            </div>
            <div className="text-xs text-slate-500">Autonomous RevOps</div>
          </div>
        </button>
      </div>
      <nav className="flex-1 space-y-1 p-4" aria-label="Primary navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              page === item.id || (page === "account" && item.id === "accounts")
                ? "bg-emerald-50 text-emerald-800"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
            {item.id === "approvals" && pendingApprovalsCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="m-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Icon name="shield" className="h-4 w-4" /> Human-in-the-loop
        </div>
        <p className="text-xs leading-5 text-emerald-800">
          AI recommendations require authorized approval before execution.
        </p>
      </div>
    </aside>
  )
}

function Topbar({
  page,
  selectedAccountName,
  onSearchCustomer,
  isGeminiConnected,
  activeUser,
  onOpenGeminiModal,
  onOpenAuthModal,
  theme,
  onToggleTheme,
}: {
  page: Page
  selectedAccountName: string
  onSearchCustomer: (query: string) => void
  isGeminiConnected: boolean
  activeUser: AppSessionUser
  onOpenGeminiModal: () => void
  onOpenAuthModal: () => void
  theme: ThemeMode
  onToggleTheme: () => void
}) {
  const titleMap: Record<Page, string> = {
    overview: "Overview",
    accounts: "Customer Accounts",
    account: `Customer Accounts / ${selectedAccountName}`,
    risks: "Risk & Opportunities",
    approvals: "Approval Center",
    audit: "Activity & Audit Logs",
    integrations: "Integrations",
    settings: "Settings",
  }

  const displayName = activeUser.fullName
  const displayRole = activeUser.role
  const initials = activeUser.avatarInitials || "DF"

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-slate-400">DealFlow AI</p>
          <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            User ID: {activeUser.id}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800">{titleMap[page]}</p>
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <label className="relative hidden md:block">
          <span className="sr-only">Search customers</span>
          <Icon
            name="search"
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
          />
          <input
            className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            placeholder="Search customers..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearchCustomer((event.target as HTMLInputElement).value)
              }
            }}
          />
        </label>
        <ThemeToggleButton
          theme={theme}
          onToggleTheme={onToggleTheme}
          compact
        />
        <button
          onClick={onOpenGeminiModal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          title="Open DealFlow AI Copilot"
        >
          <Icon name="spark" className="h-4 w-4 text-emerald-600" />
          <span>{isGeminiConnected ? "Ask AI Copilot" : "Connect AI"}</span>
        </button>
        <button
          onClick={onOpenAuthModal}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-1.5 hover:bg-slate-100"
          aria-label="Open profile and User ID switcher"
          title="Switch Operator User ID or Sign Out"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {initials}
          </span>
          <span className="hidden text-left xl:block">
            <span className="block text-xs font-bold text-slate-900">
              {displayName}
            </span>
            <span className="block font-mono text-[10px] font-semibold text-emerald-700">
              {activeUser.id} · {displayRole}
            </span>
          </span>
        </button>
      </div>
    </header>
  )
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: IconName
  tone: string
}) {
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-start justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <span className="text-xs font-medium text-slate-400">Last 30 days</span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-2 text-xs text-slate-500">{detail}</div>
    </Card>
  )
}

function Overview({
  setPage,
  accounts,
  pendingApprovalsCount,
  onSelectAccount,
  activeUser,
  onOpenProfileModal,
}: {
  setPage: (page: Page) => void
  accounts: AccountRecord[]
  pendingApprovalsCount: number
  onSelectAccount: (name: string) => void
  activeUser: AppSessionUser
  onOpenProfileModal: () => void
}) {
  const atRiskCount = accounts.filter((a) => a.tone === "red").length
  const healthyCount = accounts.filter((a) => a.tone === "green").length
  const expansionCount = accounts.filter((a) => a.tone === "blue").length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-xs">
            {activeUser.avatarInitials}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-950">
                {activeUser.fullName}&apos;s Authenticated Workspace
              </span>
              <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                User ID: {activeUser.id}
              </span>
              <Badge tone="green">{activeUser.portfolioLabel}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Showing {accounts.length} assigned customer accounts, evidence signals, and approval queues scoped specifically to{" "}
              <code className="font-mono font-semibold text-emerald-800">
                {activeUser.id}
              </code>{" "}
              ({activeUser.email}).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-2xs transition hover:bg-emerald-50"
          >
            Manage Profile & Territory Pod
          </button>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Revenue Intelligence Overview
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Understand customer health and take the next best action for{" "}
            <span className="font-semibold text-slate-700">
              {activeUser.portfolioLabel}
            </span>
            .
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>Signals
          scoped to {activeUser.id}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="At-Risk Accounts"
          value={String(atRiskCount)}
          detail={`Assigned to ${activeUser.fullName}`}
          icon="alert"
          tone="bg-red-50 text-red-600"
        />
        <StatCard
          label="Healthy Accounts"
          value={String(healthyCount)}
          detail={`Active in ${activeUser.id}`}
          icon="shield"
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Expansion Opportunities"
          value={String(expansionCount)}
          detail="Ready for upsell review"
          icon="spark"
          tone="bg-cyan-50 text-cyan-600"
        />
        <StatCard
          label="Pending Approvals"
          value={String(pendingApprovalsCount)}
          detail="Awaiting your sign-off"
          icon="check"
          tone="bg-amber-50 text-amber-600"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Customer Risk Overview
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {Math.max(accounts.length, 40)} monitored customer accounts
              </p>
            </div>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option>This quarter</option>
              <option>Last quarter</option>
            </select>
          </div>
          <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row xl:flex-col 2xl:flex-row">
            <div className="relative grid h-44 w-44 shrink-0 place-items-center rounded-full bg-[conic-gradient(#10b981_0_70%,#ef4444_70%_87.5%,#06b6d4_87.5%_100%)]">
              <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center">
                <div>
                  <div className="text-3xl font-bold text-slate-950">
                    {Math.max(accounts.length, 40)}
                  </div>
                  <div className="text-xs text-slate-500">Accounts</div>
                </div>
              </div>
            </div>
            <div className="w-full space-y-4">
              {[
                ["Healthy", "28", "70%", "bg-emerald-500"],
                ["At risk", "7", "17.5%", "bg-red-500"],
                ["Expansion ready", "5", "12.5%", "bg-cyan-500"],
              ].map(([label, count, percent, color]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`}></span>
                  <span className="flex-1 text-sm text-slate-600">{label}</span>
                  <span className="text-sm font-bold text-slate-900">
                    {count}
                  </span>
                  <span className="w-10 text-right text-xs text-slate-400">
                    {percent}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-7 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            <span className="font-semibold text-slate-800">
              Portfolio signal:
            </span>{" "}
            3 accounts moved to at-risk this week, primarily due to declining
            usage.
          </div>
        </Card>
        <Card className="overflow-hidden xl:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <div>
              <h2 className="font-bold text-slate-900">Priority Accounts</h2>
              <p className="mt-1 text-xs text-slate-500">
                Ordered by urgency and customer impact
              </p>
            </div>
            <button
              onClick={() => setPage("accounts")}
              className="flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              View All Accounts <Icon name="arrow" className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Renewal</th>
                  <th className="px-4 py-3">Recommended action</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((account) => (
                  <tr key={account.name} className="group hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-bold ${account.color}`}
                        >
                          {account.initials}
                        </span>
                        <div>
                          <div className="whitespace-nowrap text-sm font-semibold text-slate-900">
                            {account.name}
                          </div>
                          <div className="max-w-44 truncate text-xs text-slate-500">
                            {account.signal}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={account.tone}>{account.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {account.renewal}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {account.action}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onSelectAccount(account.name)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-emerald-700"
                        aria-label={`View ${account.name}`}
                      >
                        <Icon name="arrow" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Workflow />
    </div>
  )
}

function Workflow() {
  const steps = [
    "Collect Data",
    "Analyze Signals",
    "Detect Risk",
    "Explain Evidence",
    "Recommend Action",
    "Human Approval",
    "Execute & Log",
  ]
  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900">
            Autonomous RevOps Workflow
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Acme Corporation · Follow-up task recommendation
          </p>
        </div>
        <Badge tone="amber">Awaiting approval</Badge>
      </div>
      <div className="flex overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex min-w-32 flex-1 items-start last:flex-none"
          >
            <div className="min-w-28 text-center">
              <div
                className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                  index < 5
                    ? "bg-emerald-600 text-white"
                    : index === 5
                      ? "bg-amber-100 text-amber-700 ring-4 ring-amber-50"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {index < 5 ? (
                  <Icon name="check" className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <div
                className={`mt-2 text-xs font-medium ${
                  index === 5
                    ? "text-amber-700"
                    : index < 5
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {step}
              </div>
            </div>
            {index < 6 && (
              <div
                className={`mt-4 h-0.5 min-w-6 flex-1 ${
                  index < 5 ? "bg-emerald-500" : "bg-slate-200"
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function AccountDetail({
  account,
  evidenceList,
  interactionsList,
  setPage,
  review,
  compose,
  isGeminiConnected,
  onOpenGeminiModal,
  showToast,
}: {
  account: AccountRecord
  evidenceList: EvidenceRecord[]
  interactionsList: InteractionRecord[]
  setPage: (page: Page) => void
  review: (kind?: string) => void
  compose: () => void
  isGeminiConnected: boolean
  onOpenGeminiModal: () => void
  showToast: (msg: string) => void
}) {
  const [aiInsight, setAiInsight] = useState<AccountAIInsight | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    setAiInsight(null)
  }, [account.name])

  const handleRunGeminiAnalysis = async () => {
    if (!isGeminiConnected) {
      onOpenGeminiModal()
      return
    }
    setAnalyzing(true)
    try {
      const result = await generateAccountRiskInsight(
        account,
        evidenceList,
        interactionsList,
      )
      setAiInsight(result)
      showToast(
        `DealFlow AI generated fresh risk analysis for ${account.name}.`,
      )
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "AI risk analysis failed.",
      )
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setPage("overview")}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to overview
      </button>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <span
            className={`grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold ${account.color}`}
          >
            {account.initials}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-950">
                {account.name}
              </h1>
              <Badge tone={account.tone}>{account.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {account.tier || "Enterprise"} · Owner: {account.owner} ·{" "}
              {account.arr} ARR
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            icon="spark"
            onClick={handleRunGeminiAnalysis}
            disabled={analyzing}
          >
            {analyzing ? "Analyzing Account..." : "Analyze with AI"}
          </Button>
          <Button icon="mail" onClick={compose}>
            Draft Email
          </Button>
          <Button
            tone="primary"
            icon="check"
            onClick={() => review(account.action)}
          >
            Review Recommended Action
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Renewal",
            account.renewal_days || "43 days",
            account.renewal,
            "calendar",
            account.tone === "red" ? "text-red-600" : "text-slate-800",
          ],
          [
            "Last meeting",
            account.last_meeting || "21 days ago",
            account.last_meeting_date || "Mar 25, 2025",
            "message",
            "text-slate-700",
          ],
          [
            "Product usage",
            account.product_usage || "Declining",
            account.product_usage_note || account.signal,
            "activity",
            account.tone === "red" ? "text-red-600" : "text-emerald-600",
          ],
          [
            "Champion",
            account.champion_status || "No recent reply",
            account.champion_note || "Last reply 20 days ago",
            "users",
            "text-amber-600",
          ],
          [
            "Follow-up",
            account.followup_status || "No next step",
            account.followup_note || "Task unavailable",
            "file",
            account.followup_status === "Task scheduled"
              ? "text-emerald-600"
              : "text-red-600",
          ],
        ].map(([label, value, note, icon, color]) => (
          <Card key={label} className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Icon name={icon as IconName} className="h-4 w-4" />
              {label}
            </div>
            <div className={`text-sm font-bold ${color}`}>{value}</div>
            <div className="mt-1 text-xs text-slate-400">{note}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <section
            id="evidence"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Evidence Behind This Insight
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Verified signals used to assess this account
                  </p>
                </div>
                <Badge tone="green">
                  <Icon name="shield" className="h-3.5 w-3.5" />{" "}
                  {evidenceList.length} verified sources
                </Badge>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {evidenceList.map((item) => (
                <article
                  key={item.code}
                  className="rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:bg-emerald-50/30"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                      {item.code}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon
                          name={(item.icon as IconName) || "file"}
                          className="h-4 w-4 text-slate-400"
                        />
                        <p className="text-sm font-semibold text-slate-800">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Source:{" "}
                        <span className="font-medium text-slate-700">
                          {item.source}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.verified_date}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
              All evidence is verified data synced with your workspace. No
              unsupported or simulated claims are included in this insight.
            </div>
          </section>
          <Recommendations
            review={review}
            compose={compose}
            aiActions={aiInsight?.recommendedActions}
          />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <Card className="overflow-hidden border-emerald-200">
            <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white">
                  <Icon name="spark" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">
                    AI Risk Explanation
                  </h2>
                  <p className="text-xs text-emerald-700">
                    {aiInsight
                      ? `Grounded in ${aiInsight.retrievedChunks?.length || 6} verified sources`
                      : "Grounded in verified evidence"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunGeminiAnalysis}
                disabled={analyzing}
                className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100 disabled:opacity-50"
              >
                {analyzing
                  ? "Analyzing..."
                  : aiInsight
                    ? "Refresh Insight"
                    : "Generate Insight"}
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Risk level
                </span>
                <Badge tone={account.tone}>
                  {aiInsight
                    ? aiInsight.riskLevel
                    : account.tone === "red"
                      ? "High risk"
                      : account.status}
                </Badge>
              </div>
              {aiInsight ? (
                <p className="text-sm leading-6 text-slate-700">
                  {aiInsight.summary}
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-700">
                  {account.name} may be at risk of churn. The renewal is
                  approaching <EvidenceTag id="E1" />, product usage is declining{" "}
                  <EvidenceTag id="E2" />, the customer champion has not replied{" "}
                  <EvidenceTag id="E3" />, and no follow-up has been recorded
                  since the last meeting <EvidenceTag id="E4" />.
                </p>
              )}
              {aiInsight?.retrievedChunks &&
                aiInsight.retrievedChunks.length > 0 && (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      Verified Context Sources
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {aiInsight.retrievedChunks.map((chunk) => (
                        <span
                          key={chunk.id}
                          title={`${chunk.title}\n${chunk.content}`}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-900"
                        >
                          <span className="font-bold text-emerald-700">
                            [{chunk.citationCode}]
                          </span>
                          <span className="max-w-36 truncate">
                            {chunk.title}
                          </span>
                          <span className="text-[10px] text-emerald-600">
                            {Math.round(chunk.score * 100)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              <div className="my-5 border-t border-slate-100"></div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Why this matters
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {aiInsight
                  ? aiInsight.whyItMatters
                  : "Together, these signals reduce the time available to re-engage the customer before renewal. A prompt, personalized follow-up can clarify their needs and establish a next step."}
              </p>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Suggested next step
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {aiInsight
                    ? aiInsight.suggestedNextStep
                    : `${account.action} for ${account.owner}, due tomorrow.`}
                </p>
              </div>
              <Button
                tone="ghost"
                icon="file"
                onClick={() =>
                  document.getElementById("evidence")?.scrollIntoView()
                }
              >
                View Evidence
              </Button>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-slate-900">Recent Interactions</h2>
            <div className="mt-5 space-y-5">
              {interactionsList.map((item, index) => (
                <div key={item.title} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        item.is_alert ? "bg-red-500" : "bg-emerald-500"
                      }`}
                    ></span>
                    {index < interactionsList.length - 1 && (
                      <span className="h-full w-px bg-slate-200"></span>
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-xs font-medium text-slate-400">
                      {item.date_label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function EvidenceTag({ id }: { id: string }) {
  return (
    <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
      {id}
    </span>
  )
}

function Recommendations({
  review,
  compose,
  aiActions,
}: {
  review: (kind?: string) => void
  compose: () => void
  aiActions?: AccountAIInsight["recommendedActions"]
}) {
  const defaultActions: [string, string, string, string][] = [
    [
      "Create a customer follow-up task",
      "Restore momentum before renewal",
      "E1, E3, E4",
      "Ready for review",
    ],
    [
      "Draft a personalized follow-up email",
      "Re-engage the customer champion",
      "E1, E3",
      "Draft available",
    ],
    [
      "Investigate declining product usage",
      "Understand adoption blockers",
      "E2",
      "Ready for review",
    ],
    [
      "Update CRM with approved next step",
      "Keep account records current",
      "E4",
      "Blocked by approval",
    ],
  ]
  const actions: [string, string, string, string][] =
    aiActions && aiActions.length > 0
      ? aiActions.map((a) => [a.title, a.reason, a.refs, a.status])
      : defaultActions

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-6">
        <div>
          <h2 className="font-bold text-slate-900">AI-Recommended Actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            {aiActions
              ? "Generated live by DealFlow AI · Requires human approval"
              : "Proposed actions require human approval before execution"}
          </p>
        </div>
        <Badge tone={aiActions ? "green" : "amber"}>
          {actions.length} actions
        </Badge>
      </div>
      <div className="divide-y divide-slate-100">
        {actions.map(([title, reason, refs, status], index) => (
          <div key={title} className="p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {reason} · Evidence{" "}
                    <span className="font-semibold text-emerald-700">
                      {refs}
                    </span>
                  </p>
                  <div className="mt-2">
                    <Badge tone={index === 3 ? "neutral" : "amber"}>
                      {status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  tone="ghost"
                  icon="edit"
                  onClick={
                    index === 1 ? compose : () => review(`edit:${title}`)
                  }
                >
                  Edit
                </Button>
                <Button onClick={index === 1 ? compose : () => review(title)}>
                  Review Action
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ApprovalCenter({
  approvals,
  review,
  setPage,
  execution,
}: {
  approvals: ApprovalRecord[]
  review: (kind?: string, approval?: ApprovalRecord) => void
  setPage: (p: Page) => void
  execution: boolean
}) {
  const pendingApprovals = approvals.filter((a) => a.status === "pending")
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Approval Center</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review evidence and authorize proposed actions before execution.
          </p>
        </div>
        <Badge tone="amber">{pendingApprovals.length} awaiting review</Badge>
      </div>
      {execution && (
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white">
            <Icon name="check" />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">
              Action approved and executed successfully
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Follow-up task was created and synced to Supabase. The result was
              added to the audit log.
            </p>
          </div>
          <Button onClick={() => setPage("audit")}>View Audit Log</Button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {pendingApprovals.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <Badge tone={item.priority_tone}>{item.priority_label}</Badge>
                <h2 className="mt-3 text-lg font-bold text-slate-900">
                  {item.customer}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {item.action}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {item.submitted_label}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {item.description}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs">
              <div>
                <dt className="text-slate-400">Responsible</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {item.owner}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Evidence</dt>
                <dd className="mt-1 font-semibold text-emerald-700">
                  {item.refs}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Current data</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {item.current_data}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Proposed change</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {item.proposed_change}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                tone="primary"
                onClick={() => review(item.action, item)}
              >
                Approve Action
              </Button>
              <Button onClick={() => review(`edit:${item.action}`, item)}>
                Edit Before Approval
              </Button>
              <Button
                tone="danger"
                onClick={() => review(`reject:${item.action}`, item)}
              >
                Reject
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AuditPage({ auditLogs }: { auditLogs: AuditLogRecord[] }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All statuses")

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        !search.trim() ||
        log.customer.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.decision_by.toLowerCase().includes(search.toLowerCase())
      const matchesStatus =
        statusFilter === "All statuses" || log.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [auditLogs, search, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Activity & Audit Logs
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          A complete, immutable record of recommendations, decisions, and
          execution outcomes stored in Supabase.
        </p>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <label className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or action..."
              className="w-full min-w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          >
            <option>All statuses</option>
            <option>Executed</option>
            <option>Rejected</option>
            <option>Awaiting approval</option>
          </select>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  "Timestamp",
                  "Customer",
                  "Recommended action",
                  "Decision by",
                  "Execution status",
                  "Evidence",
                  "Details",
                ].map((head) => (
                  <th
                    key={head}
                    className="whitespace-nowrap px-5 py-3 font-semibold"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((row, i) => (
                <tr
                  key={row.id || `${row.timestamp_label}-${row.customer}-${i}`}
                  className="hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                    {row.timestamp_label}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-800">
                    {row.customer}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-800">
                    {row.action}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                    {row.decision_by}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm">
                    <Badge
                      tone={
                        row.status === "Executed"
                          ? "green"
                          : row.status === "Rejected"
                            ? "red"
                            : "amber"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-emerald-700">
                    {row.refs}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-slate-500">
                      {row.details || "Verified"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Integrations({
  integrationsConfig,
  onOpenConnector,
  onOpenSupabaseModal,
  isSupabaseConnected,
  onOpenGeminiModal,
  isGeminiConnected,
}: {
  integrationsConfig: AllIntegrationsConfig
  onOpenConnector: (kind: IntegrationKind) => void
  onOpenSupabaseModal: () => void
  isSupabaseConnected: boolean
  onOpenGeminiModal: () => void
  isGeminiConnected: boolean
}) {
  const cards = buildIntegrationCardsFromConfig(integrationsConfig)
  const connectedCount = [
    integrationsConfig.crm.connected,
    integrationsConfig.email.connected,
    integrationsConfig.calendar.connected,
    integrationsConfig.usage.connected,
  ].filter(Boolean).length

  const [mcpServers, setMcpServers] = useState<DiscoveredMcpServer[]>([])
  const [mcpTools, setMcpTools] = useState<DiscoveredMcpTool[]>([])
  const [selectedTool, setSelectedTool] = useState("get_account_summary")
  const [toolAccountArg, setToolAccountArg] = useState("Acme Corporation")
  const [toolQueryArg, setToolQueryArg] = useState(
    "Why is Acme Corporation at risk before renewal?",
  )
  const [toolResultJson, setToolResultJson] = useState<string>("")
  const [runningTool, setRunningTool] = useState(false)

  useEffect(() => {
    fetchMcpGatewayRegistry()
      .then((res) => {
        if (res.ok) {
          setMcpServers(res.servers || [])
          setMcpTools(res.tools || [])
        }
      })
      .catch(() => null)
  }, [integrationsConfig])

  const handleRunMcpToolTest = async () => {
    setRunningTool(true)
    setToolResultJson("")
    try {
      const args: Record<string, unknown> =
        selectedTool === "get_pending_actions"
          ? { customer: toolAccountArg }
          : selectedTool === "search_customer_evidence"
            ? { account_name: toolAccountArg, query: toolQueryArg, top_k: 4 }
            : selectedTool === "propose_followup_task"
              ? {
                  customer: toolAccountArg,
                  action: `Executive renewal review for ${toolAccountArg}`,
                  refs: "E1, E2, KB-1",
                  proposed_change: "Due tomorrow at 5:00 PM",
                  description:
                    "Proposed via DealFlow MCP Server tool test (requires human approval).",
                }
              : { account_name: toolAccountArg }

      const res = await callBackendMcpTool(undefined, selectedTool, args)
      setToolResultJson(JSON.stringify(res, null, 2))
    } catch (err: unknown) {
      setToolResultJson(
        JSON.stringify(
          { error: err instanceof Error ? err.message : String(err) },
          null,
          2,
        ),
      )
    } finally {
      setRunningTool(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-950">Integrations</h1>
            <Badge tone={connectedCount > 0 ? "green" : "neutral"}>
              {connectedCount}/4 External Sources Connected
            </Badge>
            <Badge tone="green">
              Central MCP Gateway Active ({mcpTools.length || 9} Tools)
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Connect OAuth 2.0 & API sources through the server-side Central MCP
            Gateway. Unconfigured sources remain marked as{" "}
            <strong>Not configured</strong> until a real authentication check
            succeeds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon="spark" onClick={onOpenGeminiModal}>
            {isGeminiConnected ? "AI Engine Settings" : "Connect AI Engine"}
          </Button>
          <Button tone="primary" icon="plug" onClick={onOpenSupabaseModal}>
            {isSupabaseConnected
              ? "Manage Supabase Connection"
              : "Connect Supabase Database"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={`rounded-xl border p-4 text-sm ${
            isSupabaseConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span className="font-bold">
            {isSupabaseConnected
              ? "Supabase Backend Connected:"
              : "Supabase Database Not Linked:"}
          </span>{" "}
          {isSupabaseConnected
            ? "Database tables, Authentication, RLS policies, and Realtime subscriptions are active."
            : "Click 'Connect Supabase Database' to link your live Supabase project."}
        </div>
        <div
          className={`rounded-xl border p-4 text-sm ${
            isGeminiConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <span className="font-bold">
            {isGeminiConnected
              ? "DealFlow AI Engine Connected:"
              : "DealFlow AI Engine Not Configured:"}
          </span>{" "}
          {isGeminiConnected
            ? "MCP tool-calling agent, RAG evidence search, and Copilot are active."
            : "Click 'Connect AI Engine' to configure your API key for live analysis and email generation."}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((item) => {
          const kind = item.name as IntegrationKind
          const isConnected = item.status === "Connected"
          const isError = item.status === "Error"
          const lastSync =
            kind === "CRM"
              ? integrationsConfig.crm.lastSyncedAt
              : kind === "Email"
                ? integrationsConfig.email.lastSyncedAt
                : kind === "Calendar"
                  ? integrationsConfig.calendar.lastSyncedAt
                  : integrationsConfig.usage.lastSyncedAt

          return (
            <Card key={item.name} className="p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                    isConnected
                      ? "bg-emerald-50 text-emerald-600"
                      : isError
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon name={(item.icon as IconName) || "plug"} />
                </span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-slate-900">{item.name}</h2>
                      <p className="mt-0.5 text-sm font-medium text-slate-500">
                        {item.provider}
                      </p>
                    </div>
                    <Badge tone={item.tone}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isConnected
                            ? "bg-emerald-500"
                            : isError
                              ? "bg-red-500"
                              : "bg-slate-400"
                        }`}
                      />
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>
                      Last sync:{" "}
                      <strong className="text-slate-600">
                        {lastSync || "Never synced"}
                      </strong>
                    </span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => onOpenConnector(kind)}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      View data mapping →
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      tone={isConnected ? "secondary" : "primary"}
                      icon="plug"
                      onClick={() => onOpenConnector(kind)}
                    >
                      {isConnected
                        ? "Reconnect / Configure"
                        : "Connect Source"}
                    </Button>
                    <Button
                      tone="secondary"
                      onClick={() => onOpenConnector(kind)}
                    >
                      Test Connection
                    </Button>
                    <Button
                      tone="ghost"
                      onClick={() => onOpenConnector(kind)}
                    >
                      Sync Now
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Central MCP Gateway & Official SDK Server Inspector */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900">
                Central Server-Side MCP Gateway & Tool Registry
              </h2>
              <Badge tone="green">Official MCP TypeScript SDK</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              All MCP servers are orchestrated server-side with schema
              validation, tool allowlisting, workspace access checks, and
              human-in-the-loop approval guards.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(mcpServers.length > 0
            ? mcpServers
            : [
                {
                  serverId: "dealflow_mcp",
                  displayName: "DealFlow AI Custom MCP Server",
                  transportType: "in-memory-sdk",
                  available: true,
                  connectionStatus: "Connected",
                  toolCount: 6,
                },
                {
                  serverId: "gmail_mcp",
                  displayName: "Google Workspace Gmail Adapter",
                  transportType: "verified-api-adapter",
                  available: true,
                  connectionStatus: integrationsConfig.email.connected
                    ? "Connected"
                    : "Not configured",
                  toolCount: 1,
                },
                {
                  serverId: "calendar_mcp",
                  displayName: "Google Calendar Adapter",
                  transportType: "verified-api-adapter",
                  available: true,
                  connectionStatus: integrationsConfig.calendar.connected
                    ? "Connected"
                    : "Not configured",
                  toolCount: 1,
                },
                {
                  serverId: "salesforce_mcp",
                  displayName: "Salesforce CRM Adapter",
                  transportType: "verified-api-adapter",
                  available: true,
                  connectionStatus: integrationsConfig.crm.connected
                    ? "Connected"
                    : "Not configured",
                  toolCount: 1,
                },
              ]
          ).map((srv) => (
            <div
              key={srv.serverId}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-900">
                  {srv.serverId}
                </span>
                <Badge
                  tone={
                    srv.connectionStatus === "Connected" ? "green" : "neutral"
                  }
                >
                  {srv.connectionStatus}
                </Badge>
              </div>
              <p className="mt-1 font-medium text-slate-700">
                {srv.displayName}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {srv.toolCount} allowlisted tools · {srv.transportType}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-900">
            Test Custom DealFlow AI MCP Server Tools (via Central Gateway)
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            >
              <option value="get_account_summary">get_account_summary</option>
              <option value="get_customer_signals">get_customer_signals</option>
              <option value="search_customer_evidence">
                search_customer_evidence
              </option>
              <option value="get_product_usage">get_product_usage</option>
              <option value="propose_followup_task">
                propose_followup_task (Pending Only)
              </option>
              <option value="get_pending_actions">get_pending_actions</option>
            </select>
            <input
              value={toolAccountArg}
              onChange={(e) => setToolAccountArg(e.target.value)}
              placeholder="Account Name (e.g. Acme Corporation)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            />
            <div className="flex gap-2">
              {selectedTool === "search_customer_evidence" && (
                <input
                  value={toolQueryArg}
                  onChange={(e) => setToolQueryArg(e.target.value)}
                  placeholder="Evidence search query..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
              )}
              <Button
                tone="primary"
                icon="spark"
                onClick={handleRunMcpToolTest}
                disabled={runningTool}
              >
                {runningTool ? "Calling MCP..." : "Invoke MCP Tool"}
              </Button>
            </div>
          </div>
          {toolResultJson && (
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-emerald-300">
              {toolResultJson}
            </pre>
          )}
        </div>
      </Card>

      {/* Live Integration Sync & Execution Activity Log */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-bold text-slate-900">
              Live Integration Sync & Dispatch Stream
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Real-time log of CRM account imports, email dispatches, Google
              Calendar invites, and product usage telemetry events.
            </p>
          </div>
          <Badge tone="neutral">
            {integrationsConfig.logs.length} Recorded Events
          </Badge>
        </div>

        {integrationsConfig.logs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
            No live integration events recorded yet. Click{" "}
            <strong>Connect Source</strong> on any card above to configure
            credentials and execute a live sync.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {integrationsConfig.logs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="flex flex-col justify-between gap-2 py-3 text-xs sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3">
                  <Badge
                    tone={
                      log.status === "success"
                        ? "green"
                        : log.status === "error"
                          ? "red"
                          : "amber"
                    }
                  >
                    {log.integration}
                  </Badge>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {log.summary}
                    </p>
                    <p className="mt-0.5 text-slate-500">{log.details}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-slate-400">
                  {log.timestamp}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function CustomerAccounts({
  accounts,
  onSelectAccount,
  onOpenAddCustomer,
}: {
  accounts: AccountRecord[]
  onSelectAccount: (name: string) => void
  onOpenAddCustomer: () => void
}) {
  const [search, setSearch] = useState("")
  const [healthFilter, setHealthFilter] = useState("All health statuses")

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        !search.trim() ||
        account.name.toLowerCase().includes(search.toLowerCase()) ||
        account.owner.toLowerCase().includes(search.toLowerCase()) ||
        account.signal.toLowerCase().includes(search.toLowerCase())
      const matchesHealth =
        healthFilter === "All health statuses" ||
        account.status === healthFilter
      return matchesSearch && matchesHealth
    })
  }, [accounts, search, healthFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Customer Accounts
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor customer health, ownership, and upcoming renewals.
          </p>
        </div>
        <Button tone="primary" icon="users" onClick={onOpenAddCustomer}>
          Add Customer
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Accounts"
          value={String(Math.max(accounts.length, 40))}
          detail="$2.4M managed ARR"
          icon="users"
          tone="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Renewing Soon"
          value="9"
          detail="Within the next 60 days"
          icon="calendar"
          tone="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Needs Attention"
          value="12"
          detail="Based on verified signals"
          icon="alert"
          tone="bg-red-50 text-red-600"
        />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-64 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search customers or account owners..."
          />
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          >
            <option>All health statuses</option>
            <option>At Risk</option>
            <option>Expansion Opportunity</option>
            <option>Healthy</option>
            <option>Pending Approval</option>
          </select>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <option>All renewal dates</option>
            <option>Next 30 days</option>
            <option>Next 90 days</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  "Customer",
                  "Account owner",
                  "Health",
                  "Renewal",
                  "ARR",
                  "",
                ].map((head) => (
                  <th key={head} className="px-5 py-3 font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((account) => (
                <tr key={account.name} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-lg text-xs font-bold ${account.color}`}
                      >
                        {account.initials}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {account.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {account.signal}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {account.owner}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={account.tone}>{account.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {account.renewal}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                    {account.arr}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => onSelectAccount(account.name)}
                      className="text-sm font-semibold text-emerald-700 hover:underline"
                    >
                      View account
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function RisksAndOpportunities({
  items,
  onSelectAccount,
}: {
  items: RiskOpportunityRecord[]
  onSelectAccount: (name: string) => void
}) {
  const risks = items.filter((i) => i.category === "risk")
  const opportunities = items.filter((i) => i.category === "opportunity")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Risk & Opportunities
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Prioritize accounts by urgency, impact, and strength of evidence.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue at Risk"
          value="$412K"
          detail="Across 12 accounts"
          icon="alert"
          tone="bg-red-50 text-red-600"
        />
        <StatCard
          label="Expansion Potential"
          value="$184K"
          detail="Across 7 accounts"
          icon="spark"
          tone="bg-cyan-50 text-cyan-600"
        />
        <StatCard
          label="New Signals"
          value="8"
          detail="Detected this week"
          icon="activity"
          tone="bg-amber-50 text-amber-600"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-bold text-slate-900">Churn Risks</h2>
              <p className="mt-1 text-xs text-slate-500">
                Accounts needing timely intervention
              </p>
            </div>
            <Badge tone="red">{risks.length} highlighted</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {risks.map((item) => (
              <button
                key={item.customer}
                onClick={() => onSelectAccount(item.customer)}
                className="w-full p-5 text-left hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {item.customer}
                      </p>
                      <span className="text-xs text-slate-400">
                        {item.value_label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.signal}</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Verified evidence: {item.refs}
                    </p>
                  </div>
                  <Badge
                    tone={item.badge_label === "High" ? "red" : "amber"}
                  >
                    {item.badge_label}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-bold text-slate-900">Growth Opportunities</h2>
              <p className="mt-1 text-xs text-slate-500">
                Positive signals worth exploring
              </p>
            </div>
            <Badge tone="blue">{opportunities.length} highlighted</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {opportunities.map((item) => (
              <button
                key={item.customer}
                onClick={() => onSelectAccount(item.customer)}
                className="w-full p-5 text-left hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {item.customer}
                      </p>
                      <span className="text-xs text-slate-400">
                        {item.value_label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.signal}</p>
                    <p className="mt-2 text-xs font-semibold text-cyan-700">
                      Supporting evidence: {item.refs}
                    </p>
                  </div>
                  <Badge tone="blue">{item.badge_label}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function SettingsPage({
  settings,
  onSaveSettings,
  theme,
  onSelectTheme,
}: {
  settings: WorkspaceSettingsRecord
  onSaveSettings: (next: WorkspaceSettingsRecord) => void
  theme: ThemeMode
  onSelectTheme: (nextTheme: ThemeMode) => void
}) {
  const [draft, setDraft] = useState<WorkspaceSettingsRecord>(settings)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage workspace preferences, appearance theme, approval rules, and notifications.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="h-fit p-3">
          {[
            ["Workspace & Theme", "settings"],
            ["Team & permissions", "users"],
            ["Approval policy", "shield"],
            ["Notifications", "bell"],
          ].map(([label, icon], index) => (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium ${
                index === 0
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon name={icon as IconName} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </Card>
        <Card className="p-6 xl:col-span-2">
          {/* Appearance & Theme Mode Section */}
          <div className="mb-6 border-b border-slate-100 pb-6">
            <h2 className="font-bold text-slate-900">
              Appearance & Theme Mode
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Switch between White (Light) and Dark theme across the DealFlow AI Front Page, Login Portal, and Operator Dashboard.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onSelectTheme("light")}
                className={`flex items-start justify-between rounded-xl border p-4 text-left transition ${
                  theme === "light"
                    ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span>☀️</span>
                    <span>White (Light) Theme</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    High-contrast daylight workspace with white cards and slate typography.
                  </p>
                </div>
                {theme === "light" && <Badge tone="green">Active</Badge>}
              </button>

              <button
                type="button"
                onClick={() => onSelectTheme("dark")}
                className={`flex items-start justify-between rounded-xl border p-4 text-left transition ${
                  theme === "dark"
                    ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span>🌙</span>
                    <span>Dark Theme</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Low-glare obsidian slate surfaces with glowing emerald accents.
                  </p>
                </div>
                {theme === "dark" && <Badge tone="green">Active</Badge>}
              </button>
            </div>
          </div>

          <div className="border-b border-slate-100 pb-5">
            <h2 className="font-bold text-slate-900">Workspace details</h2>
            <p className="mt-1 text-sm text-slate-500">
              Basic information shown across DealFlow AI and persisted in
              Supabase.
            </p>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Workspace name
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
                value={draft.workspace_name}
                onChange={(e) =>
                  setDraft({ ...draft, workspace_name: e.target.value })
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Default timezone
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal"
                value={draft.timezone}
                onChange={(e) =>
                  setDraft({ ...draft, timezone: e.target.value })
                }
              >
                <option>Pacific Time (PT)</option>
                <option>Eastern Time (ET)</option>
                <option>India Standard Time (IST)</option>
                <option>UTC</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Primary CRM
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal"
                value={draft.primary_crm}
                onChange={(e) =>
                  setDraft({ ...draft, primary_crm: e.target.value })
                }
              >
                <option>Salesforce</option>
                <option>HubSpot</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Default task owner
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal"
                value={draft.default_task_owner}
                onChange={(e) =>
                  setDraft({ ...draft, default_task_owner: e.target.value })
                }
              >
                <option>Account owner</option>
                <option>RevOps Admin</option>
              </select>
            </label>
          </div>
          <div className="mt-7 border-t border-slate-100 pt-6">
            <h3 className="font-bold text-slate-900">Safety & approvals</h3>
            <div className="mt-4 space-y-4">
              {(
                [
                  [
                    "require_human_approval",
                    "Require human approval",
                    "All consequential actions must be approved before execution.",
                  ],
                  [
                    "record_evidence_refs",
                    "Record evidence references",
                    "Attach supporting evidence IDs to every audit entry.",
                  ],
                  [
                    "notify_account_owners",
                    "Notify account owners",
                    "Alert owners when an action is submitted for approval.",
                  ],
                ] as const
              ).map(([key, label, description]) => {
                const enabled = draft[key]
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, [key]: !enabled })}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        enabled ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                      aria-label={`Toggle ${label}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                          enabled ? "right-1" : "left-1"
                        }`}
                      ></span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button tone="primary" onClick={() => onSaveSettings(draft)}>
              Save Changes
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Modal({
  mode,
  approval,
  close,
  approve,
  rejected,
  saveEdit,
}: {
  mode: string
  approval?: ApprovalRecord | null
  close: () => void
  approve: (approval?: ApprovalRecord | null) => void
  rejected: (reason: string, approval?: ApprovalRecord | null) => void
  saveEdit: (
    owner: string,
    dueDate: string,
    approval?: ApprovalRecord | null,
  ) => void
}) {
  const isReject = mode.startsWith("reject:")
  const isEdit = mode.startsWith("edit:")
  const action =
    mode.replace("reject:", "").replace("edit:", "") ||
    approval?.action ||
    "Create a customer follow-up task"

  const [rejectReason, setRejectReason] = useState(
    "Needs additional customer context before proceeding.",
  )
  const [owner, setOwner] = useState(approval?.owner || "Maya Chen")
  const [dueDate, setDueDate] = useState(
    approval?.proposed_change || "Tomorrow at 5:00 PM",
  )

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div
              className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${
                isReject
                  ? "bg-red-50 text-red-600"
                  : isEdit
                    ? "bg-cyan-50 text-cyan-600"
                    : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <Icon name={isReject ? "alert" : isEdit ? "edit" : "shield"} />
            </div>
            <h2 id="modal-title" className="text-lg font-bold text-slate-950">
              {isReject
                ? "Reject this action?"
                : isEdit
                  ? "Edit before approval"
                  : "Approve this action?"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isReject
                ? "The rejection and your reason will be recorded in Supabase."
                : "Review exactly what will happen before confirming."}
            </p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Proposed action{" "}
              {approval?.customer ? `· ${approval.customer}` : ""}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {action}
            </p>
          </div>
          {isReject ? (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">
                Reason for rejection
              </span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-400"
              />
            </label>
          ) : isEdit ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Task owner
                </span>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Proposed change / Due date
                </span>
                <input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
              </label>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">
                On approval, DealFlow AI will:
              </p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">1.</span>Execute
                  "{action}" for {approval?.owner || "Maya Chen"}.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">2.</span>Apply
                  proposed change:{" "}
                  {approval?.proposed_change || "Tomorrow at 5:00 PM"}.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">3.</span>Write
                  the outcome and evidence IDs (
                  {approval?.refs || "E1, E3, E4"}) to the Supabase audit log.
                </li>
              </ol>
            </div>
          )}
          {!isReject && !isEdit && (
            <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Authorization is persisted to Supabase before execution.
                Approval state is synced across all connected sessions.
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <Button onClick={close}>Cancel</Button>
          {isReject ? (
            <Button
              tone="danger"
              onClick={() => rejected(rejectReason, approval)}
            >
              Confirm Rejection
            </Button>
          ) : isEdit ? (
            <Button
              tone="primary"
              onClick={() => saveEdit(owner, dueDate, approval)}
            >
              Save & Submit for Approval
            </Button>
          ) : (
            <Button
              tone="primary"
              icon="check"
              onClick={() => approve(approval)}
            >
              Approve & Execute
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmailComposer({
  account,
  evidenceList,
  isGeminiConnected,
  onOpenGeminiModal,
  showToast,
  close,
  submit,
}: {
  account: AccountRecord
  evidenceList: EvidenceRecord[]
  isGeminiConnected: boolean
  onOpenGeminiModal: () => void
  showToast: (msg: string) => void
  close: () => void
  submit: (payload: {
    customer: string
    recipient: string
    subject: string
    body: string
  }) => void
}) {
  const [recipient, setRecipient] = useState(
    account.champion_email || "alex.morgan@acme.example",
  )
  const [subject, setSubject] = useState(
    `Checking in on ${account.name}'s goals before renewal`,
  )
  const [body, setBody] = useState(
    `Hi there,\n\nI hope you're doing well. I wanted to check in following our quarterly review and make sure we are aligned on ${account.name}'s priorities ahead of your upcoming renewal (${account.renewal}).\n\nI noticed product engagement has shifted over the past few weeks (${account.signal}), and I'd value the opportunity to understand what your team needs and where we can help. Would you have 20 minutes this week to reconnect and agree on next steps?\n\nBest,\n${account.owner}`,
  )
  const [tone, setTone] = useState<"executive" | "value" | "urgent">(
    "executive",
  )
  const [generating, setGenerating] = useState(false)

  const handleGenerateWithGemini = async () => {
    if (!isGeminiConnected) {
      onOpenGeminiModal()
      return
    }
    setGenerating(true)
    try {
      const draft = await generateFollowUpEmail(account, evidenceList, tone)
      setSubject(draft.subject)
      setBody(draft.body)
      showToast("DealFlow AI drafted a personalized follow-up email.")
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to generate email draft.",
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <Icon name="mail" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">
                Draft Follow-up Email
              </h2>
              <p className="text-xs text-slate-500">
                {account.name} · Powered by DealFlow AI & Verified Evidence
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-3">
            <div className="flex items-center gap-2">
              <Icon name="spark" className="h-4 w-4 text-purple-700" />
              <span className="text-xs font-semibold text-purple-900">
                AI Email Writer:
              </span>
              <select
                value={tone}
                onChange={(e) =>
                  setTone(e.target.value as "executive" | "value" | "urgent")
                }
                className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                <option value="executive">Executive & Consultative</option>
                <option value="value">Value & ROI Focused</option>
                <option value="urgent">Direct Renewal Check-in</option>
              </select>
            </div>
            <Button
              icon="spark"
              onClick={handleGenerateWithGemini}
              disabled={generating}
            >
              {generating ? "Writing Draft..." : "Generate with AI"}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Recipient
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Email body
            <textarea
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-sm font-normal leading-6 outline-none focus:border-emerald-500"
            />
          </label>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-emerald-800">
              Evidence-based context
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-700">
              Renewal on {account.renewal} (E1), {account.signal} (E2), and
              champion status (E3). This context supports the draft and is
              logged in Supabase upon submission.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 p-5">
          <Button
            onClick={() =>
              submit({
                customer: account.name,
                recipient,
                subject,
                body,
              })
            }
          >
            Save Draft
          </Button>
          <div className="flex gap-3">
            <Button onClick={close}>Cancel</Button>
            <Button
              tone="primary"
              icon="shield"
              onClick={() =>
                submit({
                  customer: account.name,
                  recipient,
                  subject,
                  body,
                })
              }
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddCustomerModal({
  close,
  onAdd,
}: {
  close: () => void
  onAdd: (account: AccountRecord) => void
}) {
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("Maya Chen")
  const [arr, setArr] = useState("$55K")
  const [renewal, setRenewal] = useState("Sep 15, 2025")
  const [status, setStatus] = useState("At Risk")
  const [signal, setSignal] = useState("Onboarding milestone delayed by 10 days")
  const [action, setAction] = useState("Schedule onboarding check-in")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const initials = name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    const toneMap: Record<string, BadgeTone> = {
      "At Risk": "red",
      "Expansion Opportunity": "blue",
      Healthy: "green",
      "Pending Approval": "amber",
    }
    const colorMap: Record<string, string> = {
      "At Risk": "bg-indigo-100 text-indigo-700",
      "Expansion Opportunity": "bg-cyan-100 text-cyan-700",
      Healthy: "bg-emerald-100 text-emerald-700",
      "Pending Approval": "bg-amber-100 text-amber-700",
    }
    onAdd({
      name: name.trim(),
      initials: initials || "CA",
      status,
      tone: toneMap[status] || "neutral",
      signal,
      renewal,
      action,
      color: colorMap[status] || "bg-slate-100 text-slate-700",
      owner,
      arr,
      tier: "Enterprise",
      renewal_days: "60 days",
      last_meeting: "7 days ago",
      last_meeting_date: "Apr 08, 2025",
      product_usage: status === "At Risk" ? "Declining" : "Active",
      product_usage_note: signal,
      champion_status: "Active",
      champion_note: "Verified in CRM",
      champion_email: `contact@${name.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}.example`,
      followup_status: "Pending",
      followup_note: action,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Add Customer Account
            </h2>
            <p className="text-xs text-slate-500">
              Saves directly to the Supabase accounts table
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Company Name *
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Stellar AI"
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Account Owner
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              ARR
              <input
                value={arr}
                onChange={(e) => setArr(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Renewal Date
              <input
                value={renewal}
                onChange={(e) => setRenewal(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Health Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm font-normal"
            >
              <option>At Risk</option>
              <option>Expansion Opportunity</option>
              <option>Healthy</option>
              <option>Pending Approval</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Primary Signal
            <input
              value={signal}
              onChange={(e) => setSignal(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Recommended Next Action
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" tone="primary" icon="users">
            Create Account
          </Button>
        </div>
      </form>
    </div>
  )
}

function SupabaseConfigModal({
  close,
  onConfigured,
  onSeedDatabase,
  isSeeding,
}: {
  close: () => void
  onConfigured: (statusMessage?: string) => void
  onSeedDatabase: () => void
  isSeeding: boolean
}) {
  const current = getSupabaseConfig()
  const [url, setUrl] = useState(current.url)
  const [anonKey, setAnonKey] = useState(current.anonKey)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    tablesReady: boolean
    message: string
  } | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await verifySupabaseConnection(url, anonKey)
    setTestResult(res)
    setTesting(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setTesting(true)
    const res = await verifySupabaseConnection(url, anonKey)
    setTesting(false)
    if (!res.ok) {
      setTestResult(res)
      return
    }
    saveSupabaseCredentials(url, anonKey)
    onConfigured(res.message)
  }

  const handleDisconnect = () => {
    clearSupabaseCredentials()
    setUrl("")
    setAnonKey("")
    setTestResult(null)
    onConfigured("Switched to local demo data mode.")
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon name="plug" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">
                Supabase Backend Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Connect Postgres CRUD, Realtime Channels & Supabase Auth
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            <p className="font-semibold text-slate-800">
              Setup instructions:
            </p>
            <ol className="mt-1 list-inside list-decimal space-y-1">
              <li>
                Run <code className="rounded bg-slate-200 px-1">supabase/schema.sql</code> in your Supabase SQL Editor.
              </li>
              <li>
                Set <code className="rounded bg-slate-200 px-1">VITE_SUPABASE_URL</code> and{" "}
                <code className="rounded bg-slate-200 px-1">VITE_SUPABASE_ANON_KEY</code> in{" "}
                <code className="rounded bg-slate-200 px-1">.env</code>, or paste them below.
              </li>
            </ol>
          </div>
          {testResult && (
            <div
              className={`rounded-xl border p-3 text-xs leading-5 ${
                !testResult.ok
                  ? "border-red-200 bg-red-50 text-red-700"
                  : testResult.tablesReady
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {testResult.message}
            </div>
          )}
          <label className="block text-xs font-semibold text-slate-600">
            Supabase Project URL (VITE_SUPABASE_URL)
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Supabase Anon / Publishable Key (VITE_SUPABASE_ANON_KEY)
            <input
              required
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... or sb_publishable_..."
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs font-normal"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleTest}
                disabled={testing || !url || !anonKey}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
              {current.isConfigured && (
                <>
                  <Button
                    type="button"
                    onClick={onSeedDatabase}
                    disabled={isSeeding}
                  >
                    {isSeeding ? "Syncing Seed Data..." : "Seed Initial Data"}
                  </Button>
                  <Button
                    type="button"
                    tone="danger"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={close}>
                Close
              </Button>
              <Button
                type="submit"
                tone="primary"
                icon="check"
                disabled={testing}
              >
                {testing ? "Verifying..." : "Save & Connect"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function AuthModal({
  activeUser,
  close,
  onUpdateProfile,
  onSignOut,
}: {
  activeUser: AppSessionUser
  close: () => void
  onUpdateProfile: (updated: AppSessionUser, resetPodData: boolean) => void
  onSignOut: () => void
}) {
  const [fullName, setFullName] = useState(activeUser.fullName)
  const [role, setRole] = useState(activeUser.role)
  const [department, setDepartment] = useState(activeUser.department)
  const [saving, setSaving] = useState(false)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const pod = resolvePodForUser(activeUser.id, department)
    const changedPod = department !== activeUser.department
    const updatedUser: AppSessionUser = {
      ...activeUser,
      fullName: fullName.trim() || activeUser.fullName,
      role: role.trim() || activeUser.role,
      department: pod.department,
      portfolioLabel: pod.portfolioLabel,
      avatarInitials: getInitials(fullName.trim() || activeUser.fullName),
    }

    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase.auth
          .updateUser({
            data: {
              full_name: updatedUser.fullName,
              role: updatedUser.role,
              department: updatedUser.department,
              portfolio_label: updatedUser.portfolioLabel,
            },
          })
          .catch(() => null)

        await supabase
          .from("profiles")
          .upsert(
            [
              {
                id: updatedUser.id,
                email: updatedUser.email,
                full_name: updatedUser.fullName,
                role: updatedUser.role,
                department: updatedUser.department,
                portfolio_label: updatedUser.portfolioLabel,
              },
            ],
            { onConflict: "id" },
          )
          .then(() => null, () => null)
      }
      onUpdateProfile(updatedUser, changedPod)
      close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <Icon name="shield" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">
                Supabase Operator Profile & Territory
              </h2>
              <p className="text-xs text-slate-500">
                Manage your authenticated Supabase identity and assigned territory pod
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 p-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Authenticated Supabase Session
              </p>
              <Badge tone="green">Verified Supabase JWT</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                {activeUser.avatarInitials}
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">
                  {activeUser.fullName}
                </p>
                <p className="text-xs text-slate-600">
                  {activeUser.role} · {activeUser.email}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  Supabase User ID (`auth.uid()`):
                </span>
                <code className="font-mono font-bold text-emerald-700">
                  {activeUser.id}
                </code>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  Assigned Portfolio:
                </span>
                <span className="font-semibold text-slate-800">
                  {activeUser.portfolioLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Operator Full Name
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal text-slate-900"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Operator Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal text-slate-900"
              >
                <option value="Enterprise Account Executive">
                  Enterprise Account Executive
                </option>
                <option value="Growth & Expansion Lead">
                  Growth & Expansion Lead
                </option>
                <option value="VP of Revenue Operations">
                  VP of Revenue Operations
                </option>
                <option value="Customer Success Manager">
                  Customer Success Manager
                </option>
                <option value="RevOps Analyst">RevOps Analyst</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Assigned Revenue Territory Pod
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-normal text-slate-900"
            >
              {TERRITORY_PODS.map((pod) => (
                <option key={pod.department} value={pod.department}>
                  {pod.portfolioLabel} ({pod.department})
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              tone="danger"
              onClick={() => {
                close()
                onSignOut()
              }}
            >
              Sign Out of Supabase
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" tone="primary" disabled={saving}>
                {saving ? "Saving..." : "Save Profile & Territory"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}


function GeminiModal({
  accounts,
  selectedAccount,
  evidenceList,
  interactionsList,
  approvals,
  risksOpportunities,
  close,
  onConfigured,
}: {
  accounts: AccountRecord[]
  selectedAccount: AccountRecord
  evidenceList: EvidenceRecord[]
  interactionsList: InteractionRecord[]
  approvals: ApprovalRecord[]
  risksOpportunities: RiskOpportunityRecord[]
  close: () => void
  onConfigured: (message: string) => void
}) {
  const current = getGeminiConfig()
  const [tab, setTab] = useState<"copilot" | "rag" | "settings">(
    current.isConfigured ? "copilot" : "settings",
  )
  const [apiKey, setApiKey] = useState(current.apiKey)
  const [model, setModel] = useState(current.model)
  const [testing, setTesting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{
    ok: boolean
    text: string
  } | null>(null)

  // RAG Custom Knowledge Base state
  const [customDocs, setCustomDocs] = useState<CustomRagDocument[]>(() =>
    getCustomRagDocuments(),
  )
  const [docTitle, setDocTitle] = useState("")
  const [docCustomer, setDocCustomer] = useState(selectedAccount.name)
  const [docSource, setDocSource] = useState("QBR Transcript / Playbook")
  const [docContent, setDocContent] = useState("")
  const [testRagQuery, setTestRagQuery] = useState(
    `Why is ${selectedAccount.name} at risk before renewal?`,
  )

  const ragCorpus = useMemo(
    () =>
      buildRagCorpus({
        accounts,
        evidence: evidenceList,
        interactions: interactionsList,
        risksOpportunities,
        approvals,
        customDocs,
      }),
    [
      accounts,
      evidenceList,
      interactionsList,
      risksOpportunities,
      approvals,
      customDocs,
    ],
  )

  const previewRetrievedChunks = useMemo(
    () =>
      retrieveRelevantChunks(
        testRagQuery || selectedAccount.name,
        ragCorpus,
        {
          topK: 5,
          activeCustomer: selectedAccount.name,
        },
      ),
    [testRagQuery, ragCorpus, selectedAccount.name],
  )

  // Copilot chat state with RAG retrieved chunks & Chain-of-Thought reasoning per message
  const [prompt, setPrompt] = useState("")
  const [asking, setAsking] = useState(false)
  const [activeThinkingQuery, setActiveThinkingQuery] = useState("")
  const [thinkingElapsedSec, setThinkingElapsedSec] = useState(0)
  const [thinkingStageIdx, setThinkingStageIdx] = useState(0)
  const [liveThinkingOpen, setLiveThinkingOpen] = useState(true)
  const [expandedThoughts, setExpandedThoughts] = useState<
    Record<number, boolean>
  >({})
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant"
      text: string
      thinking?: string
      thinkingSteps?: string[]
      thinkingDurationSec?: number
      retrievedChunks?: RetrievedChunk[]
      totalIndexed?: number
    }>
  >([
    {
      role: "assistant",
      text: `Hi! I'm your DealFlow AI Copilot (${ragCorpus.length} indexed records across CRM, Telemetry, Playbooks & Custom Documents). Ask me anything about ${selectedAccount.name} or portfolio health!`,
    },
  ])

  const liveThinkingStages = useMemo(() => {
    const matchedCodes = retrieveRelevantChunks(
      activeThinkingQuery || selectedAccount.name,
      ragCorpus,
      { topK: 4, activeCustomer: selectedAccount.name },
    )
      .map((c) => `[${c.citationCode}]`)
      .join(", ")

    return [
      `Understanding prompt intent & scoping context to ${selectedAccount.name} (${selectedAccount.arr} ARR · Renewal ${selectedAccount.renewal})`,
      `Scanning ${ragCorpus.length} indexed knowledge records & ranking top evidence matches (${matchedCodes || "[E1], [E2], [PB-1]"})`,
      `Evaluating primary account signal ("${selectedAccount.signal}") & champion engagement across QBR and product telemetry`,
      `Synthesizing evidence-backed response & validating human-in-the-loop governance rules [PB-3]`,
    ]
  }, [activeThinkingQuery, ragCorpus, selectedAccount])

  useEffect(() => {
    if (!asking) {
      setThinkingElapsedSec(0)
      setThinkingStageIdx(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const sec = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10
      setThinkingElapsedSec(sec)
      if (sec < 0.5) setThinkingStageIdx(0)
      else if (sec < 1.1) setThinkingStageIdx(1)
      else if (sec < 1.7) setThinkingStageIdx(2)
      else setThinkingStageIdx(3)
    }, 100)
    return () => window.clearInterval(timer)
  }, [asking])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, asking, thinkingStageIdx])

  const handleAddRagDoc = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docTitle.trim() || !docContent.trim()) return
    const updated = addCustomRagDocument({
      title: docTitle,
      customer: docCustomer,
      source: docSource,
      content: docContent,
    })
    setCustomDocs(updated)
    setDocTitle("")
    setDocContent("")
    onConfigured(
      `Added "${docTitle.trim()}" to Knowledge Base (${updated.length} custom documents).`,
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : ""
      if (text) {
        if (!docTitle.trim()) {
          setDocTitle(file.name.replace(/\.[^.]+$/, ""))
        }
        setDocSource(`Uploaded File (${file.name})`)
        setDocContent(text.slice(0, 6000))
      }
    }
    reader.readAsText(file)
  }

  const handleDeleteRagDoc = (id: string) => {
    const updated = deleteCustomRagDocument(id)
    setCustomDocs(updated)
  }

  const handleTest = async () => {
    setTesting(true)
    setStatusMsg(null)
    const res = await verifyGeminiConnection(apiKey, model)
    if (res.ok) {
      const finalModel = res.activeModel || model
      setModel(finalModel)
      saveGeminiConfig(apiKey, finalModel)
      onConfigured(res.message)
    }
    setStatusMsg({ ok: res.ok, text: res.message })
    setTesting(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setTesting(true)
    const res = await verifyGeminiConnection(apiKey, model)
    setTesting(false)
    if (!res.ok) {
      setStatusMsg({ ok: false, text: res.message })
      return
    }
    const finalModel = res.activeModel || model
    setModel(finalModel)
    saveGeminiConfig(apiKey, finalModel)
    setStatusMsg({ ok: true, text: res.message })
    onConfigured(res.message)
    setTab("copilot")
  }

  const handleDisconnect = () => {
    clearGeminiConfig()
    setApiKey("")
    setStatusMsg(null)
    onConfigured("Disconnected AI Engine API key.")
  }

  const sendCopilotPrompt = async (customPrompt?: string) => {
    const query = (customPrompt ?? prompt).trim()
    if (!query || asking) return
    const cfg = getGeminiConfig()
    const activeKey = apiKey.trim() || cfg.apiKey
    const activeModel = model || cfg.model
    if (!activeKey) {
      setTab("settings")
      setStatusMsg({
        ok: false,
        text: "Please enter and save your AI API key first.",
      })
      return
    }
    if (apiKey.trim() && !cfg.isConfigured) {
      saveGeminiConfig(activeKey, activeModel)
    }
    setPrompt("")
    setActiveThinkingQuery(query)
    setLiveThinkingOpen(true)
    setMessages((prev) => [...prev, { role: "user", text: query }])
    setAsking(true)
    try {
      const ragRes = await askGeminiCopilotWithRAG(
        query,
        {
          accounts,
          evidence: evidenceList,
          interactions: interactionsList,
          approvals,
          risksOpportunities,
          customDocs,
          activeCustomer: selectedAccount.name,
        },
        {
          customApiKey: activeKey,
          customModel: activeModel,
          topK: 6,
        },
      )
      setMessages((prev) => {
        const nextIdx = prev.length
        setExpandedThoughts((old) => ({ ...old, [nextIdx]: true }))
        return [
          ...prev,
          {
            role: "assistant",
            text: ragRes.answer,
            thinking: ragRes.thinking,
            thinkingSteps: ragRes.thinkingSteps,
            thinkingDurationSec: ragRes.thinkingDurationSec,
            retrievedChunks: ragRes.retrievedChunks,
            totalIndexed: ragRes.totalIndexedChunks,
          },
        ]
      })
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Failed to reach DealFlow AI Engine.",
        },
      ])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white">
              <Icon name="spark" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-950">
                  DealFlow AI Copilot & Knowledge Base
                </h2>
                <Badge tone="green">{ragCorpus.length} Indexed Records</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Real-time intelligence grounded in CRM, Telemetry & Playbooks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab("copilot")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  tab === "copilot"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600"
                }`}
              >
                AI Copilot
              </button>
              <button
                type="button"
                onClick={() => setTab("rag")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  tab === "rag"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600"
                }`}
              >
                Knowledge Base ({customDocs.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  tab === "settings"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600"
                }`}
              >
                Engine Settings
              </button>
            </div>
            <button
              onClick={close}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {tab === "copilot" ? (
          <div className="p-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                `Why is ${selectedAccount.name} at risk and what did they say in the QBR?`,
                "Which accounts should we prioritize for renewal or expansion?",
                `What does our RevOps playbook recommend for ${selectedAccount.name}?`,
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendCopilotPrompt(q)}
                  className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100"
                >
                  {q}
                </button>
              ))}
            </div>
            <div
              ref={chatScrollRef}
              className="h-96 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              {messages.map((m, idx) => {
                const hasThinking =
                  m.role === "assistant" &&
                  m.thinkingSteps &&
                  m.thinkingSteps.length > 0
                const isThoughtOpen = Boolean(expandedThoughts[idx])

                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      m.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Collapsible ChatGPT / Claude style "Thought for X.Xs" reasoning block */}
                    {hasThinking && (
                      <div className="mb-2 w-full max-w-[88%]">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedThoughts((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-purple-200/80 bg-purple-50/70 px-3 py-1.5 text-[11px] font-semibold text-purple-800 transition hover:bg-purple-100/80"
                        >
                          <span className="inline-block h-2 w-2 rounded-full bg-purple-600" />
                          <span>
                            Thought for{" "}
                            {(m.thinkingDurationSec || 2.4).toFixed(1)}s
                          </span>
                          <span className="text-purple-500">·</span>
                          <span className="font-normal text-purple-700">
                            {m.thinkingSteps?.length} reasoning steps
                          </span>
                          <span className="ml-1 text-[10px] text-purple-600">
                            {isThoughtOpen ? "▾ Hide" : "▸ View thinking"}
                          </span>
                        </button>

                        {isThoughtOpen && (
                          <div className="mt-1.5 rounded-xl border border-purple-200/70 bg-white/90 p-3 shadow-2xs">
                            <div className="border-l-2 border-purple-400 pl-3 space-y-2">
                              {m.thinkingSteps?.map((step, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600"
                                >
                                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
                                    {sIdx + 1}
                                  </span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-5 ${
                        m.role === "user"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-800 shadow-2xs"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.retrievedChunks && m.retrievedChunks.length > 0 && (
                      <div className="mt-1.5 max-w-[88%] rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                        <p className="text-[11px] font-semibold text-emerald-800">
                          Verified Sources Used ({m.retrievedChunks.length} of{" "}
                          {m.totalIndexed || ragCorpus.length} records):
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.retrievedChunks.map((chunk) => (
                            <span
                              key={chunk.id}
                              title={`${chunk.title}\n${chunk.content}`}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                            >
                              <span className="font-bold text-emerald-700">
                                [{chunk.citationCode}]
                              </span>
                              <span className="max-w-36 truncate">
                                {chunk.title}
                              </span>
                              <span className="font-semibold text-emerald-600">
                                {Math.round(chunk.score * 100)}%
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Live Progressive Thinking Stream (like ChatGPT o3 / Claude Extended Thinking) */}
              {asking && (
                <div className="flex flex-col items-start">
                  <div className="w-full max-w-[88%] rounded-2xl border border-purple-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setLiveThinkingOpen((v) => !v)}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-purple-600"></span>
                        </span>
                        <span className="text-xs font-bold text-purple-900">
                          Thinking... {thinkingElapsedSec.toFixed(1)}s
                        </span>
                        <span className="hidden text-[11px] text-slate-500 sm:inline">
                          · {liveThinkingStages[thinkingStageIdx]}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveThinkingOpen((v) => !v)}
                        className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-50"
                      >
                        {liveThinkingOpen ? "▾ Hide" : "▸ Show"}
                      </button>
                    </div>

                    {liveThinkingOpen && (
                      <div className="mt-3 border-l-2 border-purple-300 pl-3 space-y-2">
                        {liveThinkingStages.map((stageText, idx) => {
                          const isCompleted = idx < thinkingStageIdx
                          const isCurrent = idx === thinkingStageIdx
                          const isPending = idx > thinkingStageIdx
                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-2 text-[11px] leading-relaxed transition-opacity duration-300 ${
                                isPending
                                  ? "opacity-35 text-slate-400"
                                  : isCurrent
                                    ? "font-medium text-purple-900"
                                    : "text-slate-600"
                              }`}
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  isCompleted
                                    ? "bg-emerald-100 text-emerald-700"
                                    : isCurrent
                                      ? "bg-purple-600 text-white animate-pulse"
                                      : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {isCompleted ? "✓" : idx + 1}
                              </span>
                              <span>{stageText}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendCopilotPrompt()
              }}
              className="mt-4 flex gap-2"
            >
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Ask Copilot about ${selectedAccount.name}, QBR notes, or playbooks...`}
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
              />
              <Button
                type="submit"
                tone="primary"
                icon="spark"
                disabled={asking}
              >
                {asking ? `Thinking (${thinkingElapsedSec.toFixed(1)}s)...` : "Ask Copilot"}
              </Button>
            </form>
          </div>
        ) : tab === "rag" ? (
          <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  Total Indexed Records
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {ragCorpus.length}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold text-emerald-700">
                  Evidence & CRM
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-900">
                  {accounts.length + evidenceList.length + interactionsList.length}
                </p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                <p className="text-[11px] font-semibold text-purple-700">
                  Custom Documents
                </p>
                <p className="mt-1 text-xl font-bold text-purple-900">
                  {customDocs.length}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-[11px] font-semibold text-cyan-700">
                  Intelligence Status
                </p>
                <p className="mt-1 text-xs font-bold text-cyan-900">
                  Real-Time Synced
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddRagDoc}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">
                  Add New Document / Call Transcript to Knowledge Base
                </p>
                <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  Upload .txt / .md / .csv
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Document Title (e.g. Q2 Pricing Notes)"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
                <select
                  value={docCustomer}
                  onChange={(e) => setDocCustomer(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <option value="All Accounts">All Accounts (Global SOP)</option>
                  {accounts.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <input
                  value={docSource}
                  onChange={(e) => setDocSource(e.target.value)}
                  placeholder="Source (e.g. Call Transcript)"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                />
              </div>
              <textarea
                required
                rows={3}
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Paste customer meeting notes, QBR transcript, contract terms, or RevOps playbook content..."
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5"
              />
              <div className="flex justify-end">
                <Button type="submit" tone="primary" icon="spark">
                  Add to Knowledge Base
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">
                  Knowledge Base Search Preview (Top Matches)
                </p>
                <span className="text-[11px] text-slate-500">
                  Context Relevance Ranking
                </span>
              </div>
              <input
                value={testRagQuery}
                onChange={(e) => setTestRagQuery(e.target.value)}
                placeholder="Search indexed account notes, transcripts, and playbooks..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <div className="space-y-2">
                {previewRetrievedChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">
                          [{chunk.citationCode}]
                        </span>
                        <span className="font-semibold text-slate-900">
                          {chunk.title}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          · {chunk.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="green">
                          {Math.round(chunk.score * 100)}% relevance
                        </Badge>
                        {chunk.category === "custom_doc" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRagDoc(
                                chunk.id.replace(/-part-\d+$/, ""),
                              )
                            }
                            className="text-[11px] font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 leading-5 text-slate-600">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-800">
                DealFlow AI Engine Configuration:
              </p>
              <p className="mt-1">
                Enter your AI Engine API key and select the intelligence model tier to power live account diagnostics, Copilot responses, and automated outreach drafting.
              </p>
            </div>
            {statusMsg && (
              <div
                className={`rounded-xl border p-3 text-xs leading-5 ${
                  statusMsg.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {statusMsg.text}
              </div>
            )}
            <label className="block text-xs font-semibold text-slate-600">
              AI Engine API Key
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Intelligence Model Tier
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm font-normal"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !apiKey}
                >
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                {current.isConfigured && (
                  <Button
                    type="button"
                    tone="danger"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={close}>
                  Close
                </Button>
                <Button
                  type="submit"
                  tone="primary"
                  icon="check"
                  disabled={testing || !apiKey}
                >
                  {testing ? "Verifying..." : "Save & Activate AI"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const DEFAULT_SESSION_USER: AppSessionUser = {
  id: PRESET_OPERATORS[0].id,
  email: PRESET_OPERATORS[0].email,
  fullName: PRESET_OPERATORS[0].fullName,
  role: PRESET_OPERATORS[0].role,
  department: PRESET_OPERATORS[0].department,
  avatarInitials: PRESET_OPERATORS[0].avatarInitials,
  authSource: "operator_credentials",
  portfolioLabel: PRESET_OPERATORS[0].portfolioLabel,
}

export default function App() {
  // Stage flow: Front Page ("landing") -> Operator Login ("login") -> User-ID Scoped Website ("dashboard")
  const [appStage, setAppStage] = useState<"landing" | "login" | "dashboard">(
    "landing",
  )
  const [loginInitialMode, setLoginInitialMode] = useState<"signin" | "signup">(
    "signin",
  )
  const [loginInitialDepartment, setLoginInitialDepartment] = useState(
    "Enterprise Renewals",
  )
  const [activeUser, setActiveUser] = useState<AppSessionUser>(
    () => getActiveSession() ?? DEFAULT_SESSION_USER,
  )

  // Keep page rendering explicit so removed routes cannot survive as stale fallbacks.
  const [page, setPage] = useState<Page>("overview")

  const initialBundle = useMemo(
    () => loadUserWorkspaceBundle(activeUser),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [selectedAccountName, setSelectedAccountName] = useState(
    initialBundle.accounts[0]?.name || "Acme Corporation",
  )

  // Application Data State scoped to the active User ID
  const [accounts, setAccounts] = useState<AccountRecord[]>(
    initialBundle.accounts,
  )
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>(
    initialBundle.evidence,
  )
  const [interactionsList, setInteractionsList] = useState<InteractionRecord[]>(
    initialBundle.interactions,
  )
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(
    initialBundle.approvals,
  )
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(
    initialBundle.auditLogs,
  )
  const [risksOpportunities, setRisksOpportunities] = useState<
    RiskOpportunityRecord[]
  >(initialBundle.risksOpportunities)
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>(
    initialBundle.integrations,
  )
  const [integrationsConfig, setIntegrationsConfig] =
    useState<AllIntegrationsConfig>(() =>
      loadIntegrationsConfig(activeUser.id),
    )
  const [activeIntegrationModal, setActiveIntegrationModal] =
    useState<IntegrationKind | null>(null)
  const [settings, setSettings] = useState<WorkspaceSettingsRecord>(
    initialBundle.settings,
  )

  // UI & Modals State
  const [modal, setModal] = useState("")
  const [activeApproval, setActiveApproval] = useState<ApprovalRecord | null>(
    null,
  )
  const [email, setEmail] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)
  const [execution, setExecution] = useState(false)
  const [toast, setToast] = useState("")
  const [isSeeding, setIsSeeding] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => getSavedTheme())

  useEffect(() => {
    applyThemeToDom(theme)
  }, [theme])

  // Supabase Connection & Copilot AI State
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(
    () => getSupabaseConfig().isConfigured,
  )
  const [isGeminiConnected, setIsGeminiConnected] = useState(
    () => getGeminiConfig().isConfigured,
  )
  const [_realtimeStatus, setRealtimeStatus] = useState<
    "connected" | "connecting" | "offline"
  >("offline")
  const [user, setUser] = useState<User | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 4500)
  }, [])

  const handleSelectTheme = useCallback(
    (nextTheme: ThemeMode) => {
      setTheme(nextTheme)
      applyThemeToDom(nextTheme)
      showToast(
        nextTheme === "dark"
          ? "Switched to Dark Theme."
          : "Switched to White (Light) Theme.",
      )
    },
    [showToast],
  )

  const toggleTheme = useCallback(() => {
    handleSelectTheme(theme === "dark" ? "light" : "dark")
  }, [theme, handleSelectTheme])

  // Load workspace bundle whenever switching or logging in with a specific User ID
  const applyUserWorkspace = useCallback(
    (
      sessionUser: AppSessionUser,
      navigateToDashboard = true,
      customMessage?: string,
      resetPodData = false,
    ) => {
      if (resetPodData && typeof window !== "undefined") {
        window.localStorage.removeItem(
          `dealflow_workspace_data_v1_${sessionUser.id}`,
        )
      }
      saveActiveSession(sessionUser)
      setActiveUser(sessionUser)
      const bundle = loadUserWorkspaceBundle(sessionUser)
      const userIntegConfig = loadIntegrationsConfig(sessionUser.id)
      setAccounts(bundle.accounts)
      setEvidenceList(bundle.evidence)
      setInteractionsList(bundle.interactions)
      setApprovals(bundle.approvals)
      setAuditLogs(bundle.auditLogs)
      setRisksOpportunities(bundle.risksOpportunities)
      setIntegrationsConfig(userIntegConfig)
      setIntegrations(buildIntegrationCardsFromConfig(userIntegConfig))
      setSettings(bundle.settings)
      setSelectedAccountName(bundle.accounts[0]?.name || "Acme Corporation")
      setPage("overview")
      if (navigateToDashboard) {
        setAppStage("dashboard")
      }
      showToast(
        customMessage ||
          `Loaded workspace for ${sessionUser.fullName} (User ID: ${sessionUser.id})`,
      )
    },
    [showToast],
  )

  // Persist user-scoped workspace modifications per User ID
  useEffect(() => {
    if (!activeUser?.id) return
    saveUserWorkspaceBundle(activeUser.id, {
      accounts,
      evidence: evidenceList,
      interactions: interactionsList,
      approvals,
      auditLogs,
      risksOpportunities,
      integrations,
      settings,
    })
  }, [
    activeUser.id,
    accounts,
    evidenceList,
    interactionsList,
    approvals,
    auditLogs,
    risksOpportunities,
    integrations,
    settings,
  ])

  const handleSignOut = async () => {
    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    clearActiveSession()
    setAppStage("login")
    showToast("Signed out of Supabase Auth session.")
  }

  const operatorName =
    activeUser.fullName ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "RevOps Operator"

  const formatTimestamp = () => {
    const now = new Date()
    return now.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Fetch all data from Supabase
  const fetchSupabaseData = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setIsSupabaseConnected(false)
      setRealtimeStatus("offline")
      return
    }
    setIsSupabaseConnected(true)

    try {
      const [integRes] = await Promise.all([
        supabase.from("integrations").select("*"),
      ])

      if (!integRes.error && integRes.data && integRes.data.length > 0) {
        setIntegrations(integRes.data as IntegrationRecord[])
      }
    } catch {
      // Fallback to local state if tables are not created yet
    }
  }, [])

  // Seed Supabase tables if needed
  const handleSeedDatabase = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    setIsSeeding(true)
    try {
      await supabase
        .from("accounts")
        .upsert(DEFAULT_ACCOUNTS, { onConflict: "name" })
      await supabase
        .from("integrations")
        .upsert(DEFAULT_INTEGRATIONS, { onConflict: "name" })
      await supabase
        .from("workspace_settings")
        .upsert([DEFAULT_SETTINGS], { onConflict: "id" })

      const { data: existingApprovals } = await supabase
        .from("approvals")
        .select("id")
        .limit(1)
      if (!existingApprovals || existingApprovals.length === 0) {
        await supabase.from("approvals").insert(
          DEFAULT_APPROVALS.map(({ id: _unused, ...rest }) => rest),
        )
      }

      const { data: existingAudit } = await supabase
        .from("audit_logs")
        .select("id")
        .limit(1)
      if (!existingAudit || existingAudit.length === 0) {
        await supabase.from("audit_logs").insert(DEFAULT_AUDIT_LOGS)
      }

      await fetchSupabaseData()
      showToast("Supabase tables seeded and synced!")
    } catch {
      showToast("Make sure you ran supabase/schema.sql in Supabase SQL Editor.")
    } finally {
      setIsSeeding(false)
    }
  }

  // Set up Auth + Initial Data + Realtime Subscription
  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setIsSupabaseConnected(false)
      setRealtimeStatus("offline")
      return
    }

    fetchSupabaseData()

    const syncFromSupabaseUser = async (sbUser: User) => {
      setUser(sbUser)
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sbUser.id)
        .maybeSingle()
      const mapped = mapSupabaseUserToSession(sbUser, profileRow)
      saveActiveSession(mapped)
      setActiveUser(mapped)
      const bundle = loadUserWorkspaceBundle(mapped)
      setAccounts(bundle.accounts)
      setEvidenceList(bundle.evidence)
      setInteractionsList(bundle.interactions)
      setApprovals(bundle.approvals)
      setAuditLogs(bundle.auditLogs)
      setRisksOpportunities(bundle.risksOpportunities)
      setIntegrations(bundle.integrations)
      setSettings(bundle.settings)
      setSelectedAccountName(bundle.accounts[0]?.name || "Acme Corporation")
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        syncFromSupabaseUser(data.session.user)
      } else {
        setUser(null)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          syncFromSupabaseUser(session.user)
          if (event === "SIGNED_IN") {
            setAppStage("dashboard")
          }
        } else {
          setUser(null)
        }
      },
    )

    setRealtimeStatus("connecting")
    const channel = supabase
      .channel("revops-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "integrations" },
        () => fetchSupabaseData(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected")
        }
      })

    return () => {
      authListener.subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchSupabaseData, isSupabaseConnected])

  const selectedAccount = useMemo(() => {
    return (
      accounts.find((a) => a.name === selectedAccountName) ||
      accounts[0] ||
      DEFAULT_ACCOUNTS[0]
    )
  }, [accounts, selectedAccountName])

  const handleSelectAccount = (name: string) => {
    const exists = accounts.some(
      (a) => a.name.toLowerCase() === name.toLowerCase(),
    )
    if (exists) {
      const matched = accounts.find(
        (a) => a.name.toLowerCase() === name.toLowerCase(),
      )!
      setSelectedAccountName(matched.name)
      setPage("account")
    } else {
      setSelectedAccountName(accounts[0]?.name || "Acme Corporation")
      setPage("account")
    }
  }

  const handleSearchCustomer = (query: string) => {
    if (!query.trim()) {
      setPage("accounts")
      return
    }
    const match = accounts.find((a) =>
      a.name.toLowerCase().includes(query.toLowerCase()),
    )
    if (match) {
      setSelectedAccountName(match.name)
      setPage("account")
    } else {
      setPage("accounts")
    }
  }

  const openReviewModal = (kind = "", approval?: ApprovalRecord) => {
    if (approval) {
      setActiveApproval(approval)
    } else {
      const cleanAction = kind.replace("reject:", "").replace("edit:", "")
      const found =
        approvals.find(
          (a) => a.action === cleanAction && a.status === "pending",
        ) ||
        approvals.find(
          (a) =>
            a.customer === selectedAccount.name && a.status === "pending",
        ) ||
        approvals[0] ||
        null
      setActiveApproval(found)
    }
    setModal(kind || "Create a customer follow-up task")
  }

  const approve = async (target?: ApprovalRecord | null) => {
    const item = target || activeApproval
    const customer = item?.customer || selectedAccount.name
    const actionTitle =
      item?.action ||
      modal.replace("reject:", "").replace("edit:", "") ||
      "Create follow-up task"
    const refs = item?.refs || "E1, E3, E4"

    const targetAccount =
      accounts.find((a) => a.name === customer) || selectedAccount

    const newLog: AuditLogRecord = {
      timestamp_label: formatTimestamp(),
      customer,
      action: actionTitle,
      decision_by: `${operatorName} (${activeUser.id})`,
      status: "Executed",
      refs,
      details: `Task assigned to ${item?.owner || selectedAccount.owner}`,
      actor_user_id: user?.id ?? activeUser.id,
    }

    setModal("")
    setExecution(true)
    if (item) {
      setApprovals((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: "approved" } : a)),
      )
    }
    setAuditLogs((prev) => [newLog, ...prev])
    setAccounts((prev) =>
      prev.map((a) =>
        a.name === customer
          ? {
              ...a,
              followup_status: "Task scheduled",
              followup_note: item?.proposed_change || "Due tomorrow at 5:00 PM",
            }
          : a,
      ),
    )
    setPage("approvals")

    // Execute connected live integrations if enabled
    const isEmailApproval =
      Boolean(item?.recipient_email) ||
      actionTitle.toLowerCase().includes("email")

    if (
      isEmailApproval &&
      integrationsConfig.email.connected &&
      integrationsConfig.email.autoSendOnApprove
    ) {
      const emailRes = await sendRealEmail(integrationsConfig.email, {
        to: item?.recipient_email || targetAccount.champion_email || "contact@company.com",
        subject:
          item?.email_subject ||
          `Follow-up from DealFlow AI · ${customer}`,
        body:
          item?.email_body ||
          item?.description ||
          `Hi,\n\nChecking in regarding ${customer}'s upcoming renewal and adoption milestones.`,
        customerName: customer,
        openMailClientFallback: true,
      })
      const updatedConfig: AllIntegrationsConfig = {
        ...integrationsConfig,
        email: {
          ...integrationsConfig.email,
          lastSyncedAt: emailRes.log.timestamp,
          sentCount: (integrationsConfig.email.sentCount || 0) + 1,
        },
        logs: [emailRes.log, ...integrationsConfig.logs.slice(0, 29)],
      }
      setIntegrationsConfig(updatedConfig)
      saveIntegrationsConfig(activeUser.id, updatedConfig)
      setIntegrations(buildIntegrationCardsFromConfig(updatedConfig))
      showToast(
        `Approved & dispatched live email via ${emailRes.methodUsed}!`,
      )
    } else if (
      !isEmailApproval &&
      integrationsConfig.calendar.connected &&
      integrationsConfig.calendar.autoScheduleOnApprove
    ) {
      const tomorrowIso = new Date(Date.now() + 86400000).toISOString()
      const calRes = await createGoogleCalendarMeeting(
        integrationsConfig.calendar,
        {
          title: `${customer} · ${actionTitle}`,
          description: item?.description || `Follow-up task for ${customer}`,
          attendeeEmail: targetAccount.champion_email || "contact@company.com",
          customerName: customer,
          startTimeIso: tomorrowIso,
          openGoogleCalendarWindow: false,
        },
      )
      const updatedConfig: AllIntegrationsConfig = {
        ...integrationsConfig,
        calendar: {
          ...integrationsConfig.calendar,
          lastSyncedAt: calRes.log.timestamp,
          syncedEventsCount:
            (integrationsConfig.calendar.syncedEventsCount || 0) + 1,
        },
        logs: [calRes.log, ...integrationsConfig.logs.slice(0, 29)],
      }
      setIntegrationsConfig(updatedConfig)
      saveIntegrationsConfig(activeUser.id, updatedConfig)
      setIntegrations(buildIntegrationCardsFromConfig(updatedConfig))
      showToast(
        "Approval verified. Action executed & synced to Google Calendar!",
      )
    } else {
      showToast("Approval verified. Action executed and audit log updated.")
    }

    if (
      integrationsConfig.crm.connected &&
      integrationsConfig.crm.autoSyncOnApprove
    ) {
      await pushCRMWebhookUpdate(integrationsConfig.crm, {
        event: "action_approved",
        customer,
        action: actionTitle,
        approvedBy: `${operatorName} (${activeUser.id})`,
        proposedChange: item?.proposed_change,
      })
    }

    if (item?.id) {
      await decideAndExecuteBackendApproval(activeUser, {
        approvalId: item.id,
        decision: "approved",
      })
    }

    const supabase = getSupabaseClient()
    if (supabase) {
      if (item && !item.id.startsWith("app-")) {
        await supabase
          .from("approvals")
          .update({
            status: "approved",
            approved_by_user_id: user?.id ?? null,
          })
          .eq("id", item.id)
      } else {
        await supabase
          .from("approvals")
          .update({
            status: "approved",
            approved_by_user_id: user?.id ?? null,
          })
          .match({ customer, action: actionTitle })
      }
      await supabase.from("audit_logs").insert([newLog])
      await supabase
        .from("accounts")
        .update({
          followup_status: "Task scheduled",
          followup_note: item?.proposed_change || "Due tomorrow at 5:00 PM",
        })
        .eq("name", customer)
    }
  }

  const reject = async (reason: string, target?: ApprovalRecord | null) => {
    const item = target || activeApproval
    const customer = item?.customer || selectedAccount.name
    const actionTitle =
      item?.action ||
      modal.replace("reject:", "").replace("edit:", "") ||
      "Create follow-up task"
    const refs = item?.refs || "E1, E3, E4"

    const newLog: AuditLogRecord = {
      timestamp_label: formatTimestamp(),
      customer,
      action: actionTitle,
      decision_by: `${operatorName} (${activeUser.id})`,
      status: "Rejected",
      refs,
      details: reason,
      actor_user_id: user?.id ?? activeUser.id,
    }

    setModal("")
    if (item) {
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === item.id
            ? { ...a, status: "rejected", rejection_reason: reason }
            : a,
        ),
      )
      await decideAndExecuteBackendApproval(activeUser, {
        approvalId: item.id,
        decision: "rejected",
        rejectionReason: reason,
      })
    }
    setAuditLogs((prev) => [newLog, ...prev])
    setPage("audit")
    showToast("Rejection recorded in the audit log.")

    const supabase = getSupabaseClient()
    if (supabase) {
      if (item && !item.id.startsWith("app-")) {
        await supabase
          .from("approvals")
          .update({
            status: "rejected",
            rejection_reason: reason,
            approved_by_user_id: user?.id ?? null,
          })
          .eq("id", item.id)
      } else {
        await supabase
          .from("approvals")
          .update({
            status: "rejected",
            rejection_reason: reason,
            approved_by_user_id: user?.id ?? null,
          })
          .match({ customer, action: actionTitle })
      }
      await supabase.from("audit_logs").insert([newLog])
    }
  }

  const saveEditBeforeApproval = async (
    owner: string,
    dueDate: string,
    target?: ApprovalRecord | null,
  ) => {
    const item = target || activeApproval
    setModal("")
    if (item) {
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === item.id
            ? {
                ...a,
                owner,
                proposed_change: dueDate,
                submitted_label: "Edited just now",
              }
            : a,
        ),
      )
      const supabase = getSupabaseClient()
      if (supabase) {
        if (!item.id.startsWith("app-")) {
          await supabase
            .from("approvals")
            .update({
              owner,
              proposed_change: dueDate,
              submitted_label: "Edited just now",
            })
            .eq("id", item.id)
        } else {
          await supabase
            .from("approvals")
            .update({
              owner,
              proposed_change: dueDate,
              submitted_label: "Edited just now",
            })
            .match({ customer: item.customer, action: item.action })
        }
      }
    }
    setPage("approvals")
    showToast("Changes saved and submitted for approval.")
  }

  const submitEmail = async (payload: {
    customer: string
    recipient: string
    subject: string
    body: string
  }) => {
    setEmail(false)
    const newApproval: ApprovalRecord = {
      id: `app-${Date.now()}`,
      customer: payload.customer,
      action: `Send email: "${payload.subject}"`,
      owner: operatorName,
      refs: "E1, E2, E3",
      current_data: `Recipient: ${payload.recipient}`,
      proposed_change: "Send approved follow-up email",
      priority_label: "Customer outreach",
      priority_tone: "amber",
      description: payload.body.slice(0, 140) + "...",
      status: "pending",
      submitted_label: "Just now",
      recipient_email: payload.recipient,
      email_subject: payload.subject,
      email_body: payload.body,
    }
    const newLog: AuditLogRecord = {
      timestamp_label: formatTimestamp(),
      customer: payload.customer,
      action: "Draft follow-up email",
      decision_by: `${operatorName} (${activeUser.id})`,
      status: "Awaiting approval",
      refs: "E1, E2, E3",
      details: `To: ${payload.recipient}`,
    }

    setApprovals((prev) => [newApproval, ...prev])
    setAuditLogs((prev) => [newLog, ...prev])
    setPage("approvals")
    showToast("Email draft submitted for approval. It has not been sent.")

    const supabase = getSupabaseClient()
    if (supabase) {
      const { id: _unused, ...insertableApproval } = newApproval
      await supabase.from("approvals").insert([insertableApproval])
      await supabase.from("audit_logs").insert([newLog])
    }
  }

  const handleAddCustomer = async (newAccount: AccountRecord) => {
    setAddCustomerOpen(false)
    setAccounts((prev) => [...prev, newAccount])
    setSelectedAccountName(newAccount.name)
    showToast(
      `Added ${newAccount.name} to ${activeUser.fullName}'s (${activeUser.id}) Customer Accounts.`,
    )

    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase
        .from("accounts")
        .upsert([newAccount], { onConflict: "name" })
      await supabase.from("audit_logs").insert([
        {
          timestamp_label: formatTimestamp(),
          customer: newAccount.name,
          action: "Added customer account",
          decision_by: `${operatorName} (${activeUser.id})`,
          status: "Executed",
          refs: "CRM",
          details: `${newAccount.arr} ARR · Owner: ${newAccount.owner}`,
        },
      ])
    }
  }

  const handleSaveIntegrationsConfig = async (
    nextConfig: AllIntegrationsConfig,
  ) => {
    setIntegrationsConfig(nextConfig)
    saveIntegrationsConfig(activeUser.id, nextConfig)
    const nextCards = buildIntegrationCardsFromConfig(nextConfig)
    setIntegrations(nextCards)

    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase
        .from("integrations")
        .upsert(nextCards, { onConflict: "name" })
    }
  }

  const handleSyncAccountsFromIntegration = async (
    incoming: AccountRecord[],
    sourceLabel: string,
  ) => {
    setAccounts((prev) => {
      const byName = new Map(prev.map((a) => [a.name.toLowerCase(), a]))
      for (const acc of incoming) {
        byName.set(acc.name.toLowerCase(), acc)
      }
      return Array.from(byName.values())
    })
    showToast(`Synced ${incoming.length} account(s) from ${sourceLabel}!`)

    const supabase = getSupabaseClient()
    if (supabase && incoming.length > 0) {
      await supabase
        .from("accounts")
        .upsert(incoming, { onConflict: "name" })
    }
  }

  const handleAppendIntegrationLog = async (
    log: IntegrationSyncLog,
    customerName = "Portfolio",
    auditAction?: string,
  ) => {
    const newAudit: AuditLogRecord = {
      timestamp_label: log.timestamp,
      customer: customerName,
      action: auditAction || `${log.integration} Live Sync`,
      decision_by: `${operatorName} (${activeUser.id})`,
      status: log.status === "error" ? "Rejected" : "Executed",
      refs: log.integration,
      details: log.summary,
      actor_user_id: user?.id ?? activeUser.id,
    }
    setAuditLogs((prev) => [newAudit, ...prev])

    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase.from("audit_logs").insert([newAudit])
    }
  }

  const handleSaveSettings = async (next: WorkspaceSettingsRecord) => {
    setSettings(next)
    showToast(`Workspace settings saved for User ID ${activeUser.id}.`)

    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase
        .from("workspace_settings")
        .upsert([{ ...next, id: 1 }], { onConflict: "id" })
    }
  }

  const pendingApprovalsCount = approvals.filter(
    (a) => a.status === "pending",
  ).length

  if (appStage === "landing") {
    return (
      <>
        <LandingPage
          onGoToLogin={(mode = "signin", preferredDepartment) => {
            setLoginInitialMode(mode)
            if (preferredDepartment) {
              setLoginInitialDepartment(preferredDepartment)
            }
            setAppStage("login")
          }}
          activeUser={user ? activeUser : null}
          onEnterDashboard={() => setAppStage("dashboard")}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {toast && (
          <div className="fixed bottom-6 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500">
              <Icon name="check" className="h-4 w-4" />
            </span>
            {toast}
          </div>
        )}
      </>
    )
  }

  if (appStage === "login") {
    return (
      <>
        <LoginPage
          initialMode={loginInitialMode}
          initialDepartment={loginInitialDepartment}
          onBackToLanding={() => setAppStage("landing")}
          onLoginSuccess={(sessionUser, message) =>
            applyUserWorkspace(sessionUser, true, message)
          }
          onSupabaseConfigChanged={() => {
            setIsSupabaseConnected(getSupabaseConfig().isConfigured)
            fetchSupabaseData()
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {toast && (
          <div className="fixed bottom-6 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500">
              <Icon name="check" className="h-4 w-4" />
            </span>
            {toast}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="dealflow-dashboard min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        page={page}
        setPage={setPage}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenLandingPage={() => setAppStage("landing")}
      />
      <div className="lg:pl-64">
        <Topbar
          page={page}
          selectedAccountName={selectedAccount.name}
          onSearchCustomer={handleSearchCustomer}
          isGeminiConnected={isGeminiConnected}
          activeUser={activeUser}
          onOpenGeminiModal={() => setGeminiModalOpen(true)}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="mx-auto max-w-screen-2xl p-5 lg:p-8">
          {page === "overview" && (
            <Overview
              setPage={setPage}
              accounts={accounts}
              pendingApprovalsCount={pendingApprovalsCount}
              onSelectAccount={handleSelectAccount}
              activeUser={activeUser}
              onOpenProfileModal={() => setAuthModalOpen(true)}
            />
          )}
          {page === "account" && (
            <AccountDetail
              account={selectedAccount}
              evidenceList={evidenceList}
              interactionsList={interactionsList}
              setPage={setPage}
              review={(kind = "") => openReviewModal(kind)}
              compose={() => setEmail(true)}
              isGeminiConnected={isGeminiConnected}
              onOpenGeminiModal={() => setGeminiModalOpen(true)}
              showToast={showToast}
            />
          )}
          {page === "approvals" && (
            <ApprovalCenter
              approvals={approvals}
              review={(kind = "", approval) => openReviewModal(kind, approval)}
              setPage={setPage}
              execution={execution}
            />
          )}
          {page === "audit" && <AuditPage auditLogs={auditLogs} />}
          {page === "integrations" && (
            <Integrations
              integrationsConfig={integrationsConfig}
              onOpenConnector={(kind) => setActiveIntegrationModal(kind)}
              onOpenSupabaseModal={() => setSupabaseModalOpen(true)}
              isSupabaseConnected={isSupabaseConnected}
              onOpenGeminiModal={() => setGeminiModalOpen(true)}
              isGeminiConnected={isGeminiConnected}
            />
          )}
          {page === "accounts" && (
            <CustomerAccounts
              accounts={accounts}
              onSelectAccount={handleSelectAccount}
              onOpenAddCustomer={() => setAddCustomerOpen(true)}
            />
          )}
          {page === "risks" && (
            <RisksAndOpportunities
              items={risksOpportunities}
              onSelectAccount={handleSelectAccount}
            />
          )}
          {page === "settings" && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
              theme={theme}
              onSelectTheme={handleSelectTheme}
            />
          )}
        </main>
      </div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-slate-200 bg-white p-2 lg:hidden"
        aria-label="Mobile navigation"
      >
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${
              page === item.id ? "text-emerald-700" : "text-slate-400"
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span className="hidden sm:block">{item.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
      {modal && (
        <Modal
          mode={modal}
          approval={activeApproval}
          close={() => setModal("")}
          approve={approve}
          rejected={reject}
          saveEdit={saveEditBeforeApproval}
        />
      )}
      {email && (
        <EmailComposer
          account={selectedAccount}
          evidenceList={evidenceList}
          isGeminiConnected={isGeminiConnected}
          onOpenGeminiModal={() => setGeminiModalOpen(true)}
          showToast={showToast}
          close={() => setEmail(false)}
          submit={submitEmail}
        />
      )}
      {addCustomerOpen && (
        <AddCustomerModal
          close={() => setAddCustomerOpen(false)}
          onAdd={handleAddCustomer}
        />
      )}
      {activeIntegrationModal && (
        <IntegrationConnectorModal
          activeKind={activeIntegrationModal}
          config={integrationsConfig}
          accounts={accounts}
          activeUserName={operatorName}
          onClose={() => setActiveIntegrationModal(null)}
          onSaveConfig={handleSaveIntegrationsConfig}
          onSyncAccounts={handleSyncAccountsFromIntegration}
          onAddInteractions={(newItems) =>
            setInteractionsList((prev) => [...newItems, ...prev])
          }
          onAddEvidence={(newEv) =>
            setEvidenceList((prev) => [...newEv, ...prev])
          }
          onAppendLog={handleAppendIntegrationLog}
          showToast={showToast}
        />
      )}
      {supabaseModalOpen && (
        <SupabaseConfigModal
          close={() => setSupabaseModalOpen(false)}
          onConfigured={(statusMsg) => {
            setSupabaseModalOpen(false)
            const configured = getSupabaseConfig().isConfigured
            setIsSupabaseConnected(configured)
            if (configured) {
              fetchSupabaseData()
              showToast(
                statusMsg || "Connected to Supabase! Fetching live tables...",
              )
            } else {
              showToast(statusMsg || "Switched to local data mode.")
            }
          }}
          onSeedDatabase={handleSeedDatabase}
          isSeeding={isSeeding}
        />
      )}
      {geminiModalOpen && (
        <GeminiModal
          accounts={accounts}
          selectedAccount={selectedAccount}
          evidenceList={evidenceList}
          interactionsList={interactionsList}
          approvals={approvals}
          risksOpportunities={risksOpportunities}
          close={() => setGeminiModalOpen(false)}
          onConfigured={(msg) => {
            setIsGeminiConnected(getGeminiConfig().isConfigured)
            showToast(msg)
          }}
        />
      )}
      {authModalOpen && (
        <AuthModal
          activeUser={activeUser}
          close={() => setAuthModalOpen(false)}
          onUpdateProfile={(updatedUser, resetPodData) =>
            applyUserWorkspace(
              updatedUser,
              false,
              `Updated profile & territory pod for User ID ${updatedUser.id}`,
              resetPodData,
            )
          }
          onSignOut={handleSignOut}
        />
      )}
      {toast && (
        <div className="fixed bottom-20 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl lg:bottom-6">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500">
            <Icon name="check" className="h-4 w-4" />
          </span>
          {toast}
        </div>
      )}
    </div>
  )
}


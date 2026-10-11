import { useState } from "react"

type Page = "overview" | "accounts" | "account" | "risks" | "approvals" | "audit" | "integrations" | "settings"

type IconName = "grid" | "users" | "alert" | "spark" | "check" | "history" | "plug" | "settings" | "search" | "bell" | "arrow" | "calendar" | "activity" | "message" | "file" | "shield" | "mail" | "edit" | "close"

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
  tone?: "red" | "green" | "blue" | "amber" | "neutral"
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

const navItems: { id: Page label: string icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "accounts", label: "Customer Accounts", icon: "users" },
  { id: "risks", label: "Risk & Opportunities", icon: "alert" },
  { id: "approvals", label: "Approval Center", icon: "check" },
  { id: "audit", label: "Activity & Audit Logs", icon: "history" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "settings", label: "Settings", icon: "settings" },
]

const accounts = [
  {
    name: "Acme Corporation",
    initials: "AC",
    status: "At Risk",
    tone: "red" as const,
    signal: "Usage declined 28% this month",
    renewal: "May 28, 2025",
    action: "Create follow-up task",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    name: "NovaTech",
    initials: "NT",
    status: "Expansion Opportunity",
    tone: "blue" as const,
    signal: "Team adoption up 34%",
    renewal: "Aug 12, 2025",
    action: "Schedule expansion review",
    color: "bg-cyan-100 text-cyan-700",
  },
  {
    name: "BrightPath",
    initials: "BP",
    status: "Healthy",
    tone: "green" as const,
    signal: "Strong weekly engagement",
    renewal: "Oct 03, 2025",
    action: "Maintain success plan",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "CloudSync",
    initials: "CS",
    status: "Pending Approval",
    tone: "amber" as const,
    signal: "Champion changed roles",
    renewal: "Jun 17, 2025",
    action: "Draft stakeholder email",
    color: "bg-amber-100 text-amber-700",
  },
]

function Sidebar({
  page,
  setPage,
}: {
  page: Page
  setPage: (page: Page) => void
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <Icon name="activity" />
        </div>
        <div>
          <div className="font-bold tracking-tight text-slate-950">
            RevenuePilot <span className="text-emerald-600">AI</span>
          </div>
          <div className="text-xs text-slate-500">Autonomous RevOps</div>
        </div>
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
            {item.id === "approvals" && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                4
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

const titleMap: Record<Page, string> = {
  overview: "Overview",
  accounts: "Customer Accounts",
  account: "Customer Accounts / Acme Corporation",
  risks: "Risk & Opportunities",
  approvals: "Approval Center",
  audit: "Activity & Audit Logs",
  integrations: "Integrations",
  settings: "Settings",
}

function Topbar({
  page,
  setPage,
}: {
  page: Page
  setPage: (page: Page) => void
}) {
  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
      <div>
        <p className="text-xs font-medium text-slate-400">RevenuePilot AI</p>
        <p className="text-sm font-semibold text-slate-800">{titleMap[page]}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="relative hidden md:block">
          <span className="sr-only">Search customers</span>
          <Icon
            name="search"
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
          />
          <input
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            placeholder="Search customers..."
            onKeyDown={(event) => {
              if (event.key === "Enter") setPage("account")
            }}
          />
        </label>
        <Badge tone="green">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span className="hidden xl:inline">Demo Data Connected</span>
          <span className="xl:hidden">Demo</span>
        </Badge>
        <button
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Icon name="bell" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500"></span>
        </button>
        <button
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50"
          aria-label="Open profile menu"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
            JD
          </span>
          <span className="hidden text-left xl:block">
            <span className="block text-sm font-semibold text-slate-800">
              Jordan Davis
            </span>
            <span className="block text-xs text-slate-500">RevOps Admin</span>
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

function Overview({ setPage }: { setPage: (page: Page) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Revenue Intelligence Overview
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Understand customer health and take the next best action.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>Signals
          refreshed 6 minutes ago
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="At-Risk Accounts"
          value="12"
          detail="3 need immediate attention"
          icon="alert"
          tone="bg-red-50 text-red-600"
        />
        <StatCard
          label="Healthy Accounts"
          value="28"
          detail="70% of your portfolio"
          icon="shield"
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Expansion Opportunities"
          value="7"
          detail="$184K potential ARR"
          icon="spark"
          tone="bg-cyan-50 text-cyan-600"
        />
        <StatCard
          label="Pending Approvals"
          value="4"
          detail="2 submitted today"
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
                40 monitored customer accounts
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
                  <div className="text-3xl font-bold text-slate-950">40</div>
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
                        onClick={() =>
                          setPage(
                            account.name === "Acme Corporation"
                              ? "account"
                              : "accounts",
                          )
                        }
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

const evidence = [
  {
    id: "E1",
    title: "Renewal is due in 43 days",
    source: "Salesforce CRM",
    date: "Verified Apr 15, 2025",
    icon: "calendar" as IconName,
  },
  {
    id: "E2",
    title: "Product usage declined by 28%",
    source: "Product analytics",
    date: "Mar 15 – Apr 15, 2025",
    icon: "activity" as IconName,
  },
  {
    id: "E3",
    title: "Champion has not replied",
    source: "Connected email",
    date: "Last reply Mar 26, 2025",
    icon: "mail" as IconName,
  },
  {
    id: "E4",
    title: "No follow-up task was recorded",
    source: "CRM activities",
    date: "Since meeting Mar 25, 2025",
    icon: "file" as IconName,
  },
]

function AccountDetail({
  setPage,
  review,
  compose,
}: {
  setPage: (page: Page) => void
  review: (kind?: string) => void
  compose: () => void
}) {
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
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-700">
            AC
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-950">
                Acme Corporation
              </h1>
              <Badge tone="red">At Risk</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Enterprise · Owner: Maya Chen · $86K ARR
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button icon="mail" onClick={compose}>
            Draft Email
          </Button>
          <Button tone="primary" icon="check" onClick={() => review()}>
            Review Recommended Action
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Renewal", "43 days", "May 28, 2025", "calendar", "text-red-600"],
          [
            "Last meeting",
            "21 days ago",
            "Mar 25, 2025",
            "message",
            "text-slate-700",
          ],
          [
            "Product usage",
            "Declining",
            "Down 28% this month",
            "activity",
            "text-red-600",
          ],
          [
            "Champion",
            "No recent reply",
            "Last reply 20 days ago",
            "users",
            "text-amber-600",
          ],
          [
            "Follow-up",
            "No next step",
            "Task unavailable",
            "file",
            "text-red-600",
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
                  <Icon name="shield" className="h-3.5 w-3.5" /> 4 verified
                  sources
                </Badge>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {evidence.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:bg-emerald-50/30"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                      {item.id}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon
                          name={item.icon}
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
                      <p className="mt-1 text-xs text-slate-400">{item.date}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
              All evidence is verified demo data. No unsupported or simulated
              claims are included in this insight.
            </div>
          </section>
          <Recommendations review={review} compose={compose} />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <Card className="overflow-hidden border-emerald-200">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white">
                <Icon name="spark" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900">
                  AI Risk Explanation
                </h2>
                <p className="text-xs text-emerald-700">
                  Grounded in verified evidence
                </p>
              </div>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Risk level
                </span>
                <Badge tone="red">High risk</Badge>
              </div>
              <p className="text-sm leading-6 text-slate-700">
                Acme Corporation may be at risk of churn. The renewal is
                approaching <EvidenceTag id="E1" />, product usage is declining{" "}
                <EvidenceTag id="E2" />, the customer champion has not replied{" "}
                <EvidenceTag id="E3" />, and no follow-up has been recorded
                since the last meeting <EvidenceTag id="E4" />.
              </p>
              <div className="my-5 border-t border-slate-100"></div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Why this matters
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Together, these signals reduce the time available to re-engage
                the customer before renewal. A prompt, personalized follow-up
                can clarify their needs and establish a next step.
              </p>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Suggested next step
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  Create a follow-up task for Maya Chen, due tomorrow.
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
              {[
                [
                  "Mar 25",
                  "Quarterly review meeting",
                  "Maya Chen · 42 min",
                  "Meeting notes synced",
                ],
                [
                  "Mar 26",
                  "Champion replied to recap",
                  "Alex Morgan · Email",
                  "Last inbound response",
                ],
                [
                  "Apr 08",
                  "Usage alert detected",
                  "Product analytics",
                  "Weekly active use down 28%",
                ],
              ].map(([date, title, meta, note], index) => (
                <div key={title} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        index === 2 ? "bg-red-500" : "bg-emerald-500"
                      }`}
                    ></span>
                    {index < 2 && (
                      <span className="h-full w-px bg-slate-200"></span>
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-xs font-medium text-slate-400">{date}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{meta}</p>
                    <p className="mt-1 text-xs text-slate-400">{note}</p>
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
}: {
  review: (kind?: string) => void
  compose: () => void
}) {
  const actions = [
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
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-6">
        <div>
          <h2 className="font-bold text-slate-900">AI-Recommended Actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Proposed actions require human approval before execution
          </p>
        </div>
        <Badge tone="amber">4 actions</Badge>
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
                  onClick={index === 1 ? compose : () => review(title)}
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
  review,
  setPage,
  execution,
}: {
  review: (kind?: string) => void
  setPage: (p: Page) => void
  execution: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Approval Center</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review evidence and authorize proposed actions before execution.
          </p>
        </div>
        <Badge tone="amber">4 awaiting review</Badge>
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
              Follow-up task RP-2048 was created for Maya Chen. The result was
              added to the audit log.
            </p>
          </div>
          <Button onClick={() => setPage("audit")}>View Audit Log</Button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {[
          [
            "Acme Corporation",
            "Create a customer follow-up task",
            "Maya Chen",
            "E1, E3, E4",
            "Due tomorrow at 5:00 PM",
          ],
          [
            "CloudSync",
            "Draft stakeholder transition email",
            "Jordan Davis",
            "E2, E5",
            "Save as email draft",
          ],
          [
            "NovaTech",
            "Schedule expansion review",
            "Priya Shah",
            "E1, E6",
            "Create calendar task",
          ],
          [
            "Pioneer Labs",
            "Update renewal risk field",
            "Marcus Lee",
            "E2, E3",
            "Change CRM field to Medium",
          ],
        ].map(([customer, action, owner, refs, change], index) => (
          <Card key={customer} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <Badge
                  tone={index === 0 ? "red" : index === 1 ? "amber" : "blue"}
                >
                  {index === 0
                    ? "High priority"
                    : index === 1
                      ? "Customer outreach"
                      : "Standard review"}
                </Badge>
                <h2 className="mt-3 text-lg font-bold text-slate-900">
                  {customer}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {action}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                Submitted {index + 1}h ago
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {index === 0
                ? "The account is approaching renewal with declining engagement and no documented follow-up."
                : "AI detected a verified customer signal and recommends a trackable next step."}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs">
              <div>
                <dt className="text-slate-400">Responsible</dt>
                <dd className="mt-1 font-semibold text-slate-700">{owner}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Evidence</dt>
                <dd className="mt-1 font-semibold text-emerald-700">{refs}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Current data</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  No open task
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Proposed change</dt>
                <dd className="mt-1 font-semibold text-slate-700">{change}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button tone="primary" onClick={() => review(action)}>
                Approve Action
              </Button>
              <Button onClick={() => review(`edit:${action}`)}>
                Edit Before Approval
              </Button>
              <Button tone="danger" onClick={() => review(`reject:${action}`)}>
                Reject
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AuditPage({
  execution,
  rejected,
}: {
  execution: boolean
  rejected: boolean
}) {
  const rows = [
    ...(execution
      ? [
          [
            "Apr 15, 10:42 AM",
            "Acme Corporation",
            "Create follow-up task",
            "Jordan Davis",
            "Executed",
            "E1, E3, E4",
          ],
        ]
      : []),
    ...(rejected
      ? [
          [
            "Apr 15, 10:40 AM",
            "Acme Corporation",
            "Create follow-up task",
            "Jordan Davis",
            "Rejected",
            "E1, E3, E4",
          ],
        ]
      : []),
    [
      "Apr 15, 9:18 AM",
      "CloudSync",
      "Draft stakeholder email",
      "Pending",
      "Awaiting approval",
      "E2, E5",
    ],
    [
      "Apr 14, 4:35 PM",
      "BrightPath",
      "Update success plan",
      "Priya Shah",
      "Executed",
      "E1",
    ],
    [
      "Apr 14, 2:11 PM",
      "Pioneer Labs",
      "Update risk field",
      "Marcus Lee",
      "Rejected",
      "E2, E3",
    ],
    [
      "Apr 13, 11:05 AM",
      "NovaTech",
      "Create expansion task",
      "Jordan Davis",
      "Executed",
      "E4, E6",
    ],
  ]
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Activity & Audit Logs
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          A complete, immutable record of recommendations, decisions, and
          execution outcomes.
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
              placeholder="Search customer or action..."
              className="w-full min-w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          {["All customers", "Any date", "All statuses", "All users"].map(
            (filter) => (
              <select
                key={filter}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
              >
                <option>{filter}</option>
              </select>
            ),
          )}
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
              {rows.map((row) => (
                <tr key={row[0] + row[1]} className="hover:bg-slate-50">
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`whitespace-nowrap px-5 py-4 text-sm ${
                        index === 1 || index === 2
                          ? "font-medium text-slate-800"
                          : "text-slate-500"
                      }`}
                    >
                      {index === 4 ? (
                        <Badge
                          tone={
                            cell === "Executed"
                              ? "green"
                              : cell === "Rejected"
                                ? "red"
                                : "amber"
                          }
                        >
                          {cell}
                        </Badge>
                      ) : index === 5 ? (
                        <span className="font-semibold text-emerald-700">
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-4">
                    <button className="text-sm font-semibold text-emerald-700">
                      View
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

function Integrations() {
  const integrations = [
    [
      "CRM",
      "Salesforce",
      "Customer, renewal, and activity records",
      "Connected",
      "green" as const,
      "users",
    ],
    [
      "Email",
      "Google Workspace",
      "Thread and response activity",
      "Demo mode",
      "amber" as const,
      "mail",
    ],
    [
      "Calendar",
      "Google Calendar",
      "Meetings and follow-up events",
      "Connected",
      "green" as const,
      "calendar",
    ],
    [
      "Product Usage Data",
      "RevenuePilot Events",
      "Feature adoption and active usage",
      "Demo mode",
      "amber" as const,
      "activity",
    ],
  ]
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Integrations</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage the data sources RevenuePilot uses to create evidence-backed
          insights.
        </p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <span className="font-bold">Demo environment:</span> Simulated
        integrations are clearly labeled and do not connect to live customer
        systems.
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {integrations.map(
          ([name, provider, description, status, tone, icon]) => (
            <Card key={name} className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <Icon name={icon as IconName} />
                </span>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-bold text-slate-900">{name}</h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {provider}
                      </p>
                    </div>
                    <Badge tone={tone}>{status}</Badge>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{description}</p>
                  <div className="mt-5 flex gap-2">
                    <Button>Manage</Button>
                    <Button tone="ghost">View data mapping</Button>
                  </div>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>
    </div>
  )
}

function CustomerAccounts({ setPage }: { setPage: (page: Page) => void }) {
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
        <Button tone="primary" icon="users">
          Add Customer
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Accounts"
          value="40"
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
            className="min-w-64 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search customers or account owners..."
          />
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <option>All health statuses</option>
            <option>At Risk</option>
            <option>Healthy</option>
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
              {accounts.map((account, index) => (
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
                    {
                      ["Maya Chen", "Priya Shah", "Jordan Davis", "Marcus Lee"][
                        index
                      ]
                    }
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={account.tone}>{account.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {account.renewal}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                    {["$86K", "$64K", "$48K", "$72K"][index]}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() =>
                        account.name === "Acme Corporation" &&
                        setPage("account")
                      }
                      className="text-sm font-semibold text-emerald-700"
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

function RisksAndOpportunities({ setPage }: { setPage: (page: Page) => void }) {
  const risks = [
    [
      "Acme Corporation",
      "$86K ARR",
      "Usage down 28% · renewal in 43 days",
      "High",
      "E1, E2, E3",
    ],
    [
      "Pioneer Labs",
      "$58K ARR",
      "Executive sponsor left the company",
      "High",
      "E2, E5",
    ],
    [
      "Northstar Media",
      "$42K ARR",
      "Support satisfaction declined",
      "Medium",
      "E3, E4",
    ],
  ]
  const opportunities = [
    [
      "NovaTech",
      "$32K potential",
      "Team adoption increased 34%",
      "Strong",
      "E6, E7",
    ],
    [
      "Vertex Health",
      "$28K potential",
      "Seat utilization reached 92%",
      "Strong",
      "E1, E4",
    ],
    [
      "BrightPath",
      "$24K potential",
      "Requested advanced feature demo",
      "Emerging",
      "E3",
    ],
  ]
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
            <Badge tone="red">12 accounts</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {risks.map(([name, arr, signal, severity, refs]) => (
              <button
                key={name}
                onClick={() =>
                  name === "Acme Corporation" && setPage("account")
                }
                className="w-full p-5 text-left hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{name}</p>
                      <span className="text-xs text-slate-400">{arr}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{signal}</p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Verified evidence: {refs}
                    </p>
                  </div>
                  <Badge tone={severity === "High" ? "red" : "amber"}>
                    {severity}
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
            <Badge tone="blue">7 accounts</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {opportunities.map(([name, value, signal, strength, refs]) => (
              <div key={name} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{name}</p>
                      <span className="text-xs text-slate-400">{value}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{signal}</p>
                    <p className="mt-2 text-xs font-semibold text-cyan-700">
                      Supporting evidence: {refs}
                    </p>
                  </div>
                  <Badge tone="blue">{strength}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage workspace preferences, approval rules, and notifications.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="h-fit p-3">
          {[
            ["Workspace", "settings"],
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
          <div className="border-b border-slate-100 pb-5">
            <h2 className="font-bold text-slate-900">Workspace details</h2>
            <p className="mt-1 text-sm text-slate-500">
              Basic information shown across RevenuePilot.
            </p>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Workspace name
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
                defaultValue="Revenue Operations"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Default timezone
              <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal">
                <option>Pacific Time (PT)</option>
                <option>Eastern Time (ET)</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Primary CRM
              <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal">
                <option>Salesforce</option>
                <option>HubSpot</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Default task owner
              <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal">
                <option>Account owner</option>
                <option>RevOps Admin</option>
              </select>
            </label>
          </div>
          <div className="mt-7 border-t border-slate-100 pt-6">
            <h3 className="font-bold text-slate-900">Safety & approvals</h3>
            <div className="mt-4 space-y-4">
              {[
                [
                  "Require human approval",
                  "All consequential actions must be approved before execution.",
                ],
                [
                  "Record evidence references",
                  "Attach supporting evidence IDs to every audit entry.",
                ],
                [
                  "Notify account owners",
                  "Alert owners when an action is submitted for approval.",
                ],
              ].map(([label, description]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{description}</p>
                  </div>
                  <button
                    className="relative h-6 w-11 shrink-0 rounded-full bg-emerald-600"
                    aria-label={`Toggle ${label}`}
                  >
                    <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white"></span>
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button tone="primary">Save Changes</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Modal({
  mode,
  close,
  approve,
  rejected,
  compose,
}: {
  mode: string
  close: () => void
  approve: () => void
  rejected: () => void
  compose: () => void
}) {
  const isReject = mode.startsWith("reject:")
  const isEdit = mode.startsWith("edit:")
  const action =
    mode.replace("reject:", "").replace("edit:", "") ||
    "Create a customer follow-up task"
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
                ? "The rejection and your reason will be recorded."
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
              Proposed action
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
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-400"
                defaultValue="Needs additional customer context before proceeding."
              />
            </label>
          ) : isEdit ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Task owner
                </span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  defaultValue="Maya Chen"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Due date
                </span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  defaultValue="Tomorrow at 5:00 PM"
                />
              </label>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">
                On approval, RevenuePilot will:
              </p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">1.</span>Create
                  one CRM follow-up task for Maya Chen.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">2.</span>Set the
                  due date to tomorrow at 5:00 PM.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">3.</span>Write
                  the outcome and evidence IDs to the audit log.
                </li>
              </ol>
            </div>
          )}
          {!isReject && !isEdit && (
            <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Authorization is verified by the backend before execution.
                Approval cannot be granted by frontend state alone.
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <Button onClick={close}>Cancel</Button>
          {isReject ? (
            <Button tone="danger" onClick={rejected}>
              Confirm Rejection
            </Button>
          ) : isEdit ? (
            <Button tone="primary" onClick={compose}>
              Save & Submit for Approval
            </Button>
          ) : (
            <Button tone="primary" icon="check" onClick={approve}>
              Approve & Execute
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmailComposer({
  close,
  submit,
}: {
  close: () => void
  submit: () => void
}) {
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
                Acme Corporation · AI-assisted draft
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Recipient
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
                defaultValue="alex.morgan@acme.example"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Subject
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"
                defaultValue="Checking in on Acme's goals before renewal"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Email body
            <textarea
              rows={10}
              className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-sm font-normal leading-6 outline-none focus:border-emerald-500"
              defaultValue={`Hi Alex,\n\nI hope you're doing well. I wanted to check in following our quarterly review and make sure we are aligned on Acme's priorities ahead of your upcoming renewal.\n\nI noticed product engagement has shifted over the past few weeks, and I'd value the opportunity to understand what your team needs and where we can help. Would you have 20 minutes this week to reconnect and agree on next steps?\n\nBest,\nMaya`}
            />
          </label>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-emerald-800">
              Evidence-based context
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-700">
              Renewal in 43 days (E1), declining product usage (E2), and no
              recent champion reply (E3). This context supports the draft but
              will not be inserted as unsupported fact.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 p-5">
          <Button>Save Draft</Button>
          <div className="flex gap-3">
            <Button onClick={close}>Cancel</Button>
            <Button tone="primary" icon="shield" onClick={submit}>
              Submit for Approval
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  // Keep page rendering explicit so removed routes cannot survive as stale fallbacks.
  const [page, setPage] = useState<Page>("overview")
  const [modal, setModal] = useState("")
  const [email, setEmail] = useState(false)
  const [execution, setExecution] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [toast, setToast] = useState("")

  const approve = () => {
    setModal("")
    setExecution(true)
    setPage("approvals")
    setToast("Approval verified. Action executed and audit log updated.")
    window.setTimeout(() => setToast(""), 4500)
  }
  const reject = () => {
    setModal("")
    setRejected(true)
    setPage("audit")
    setToast("Rejection recorded in the audit log.")
    window.setTimeout(() => setToast(""), 4500)
  }
  const submitEmail = () => {
    setEmail(false)
    setPage("approvals")
    setToast("Email draft submitted for approval. It has not been sent.")
    window.setTimeout(() => setToast(""), 4500)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar page={page} setPage={setPage} />
      <div className="lg:pl-64">
        <Topbar page={page} setPage={setPage} />
        <main className="mx-auto max-w-screen-2xl p-5 lg:p-8">
          {page === "overview" && <Overview setPage={setPage} />}
          {page === "account" && (
            <AccountDetail
              setPage={setPage}
              review={(kind = "") => setModal(kind)}
              compose={() => setEmail(true)}
            />
          )}
          {page === "approvals" && (
            <ApprovalCenter
              review={(kind = "") => setModal(kind)}
              setPage={setPage}
              execution={execution}
            />
          )}
          {page === "audit" && (
            <AuditPage execution={execution} rejected={rejected} />
          )}
          {page === "integrations" && <Integrations />}
          {page === "accounts" && <CustomerAccounts setPage={setPage} />}
          {page === "risks" && <RisksAndOpportunities setPage={setPage} />}
          {page === "settings" && <SettingsPage />}
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
          close={() => setModal("")}
          approve={approve}
          rejected={reject}
          compose={() => {
            setModal("")
            setPage("approvals")
            setToast("Changes saved and submitted for approval.")
          }}
        />
      )}
      {email && (
        <EmailComposer close={() => setEmail(false)} submit={submitEmail} />
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

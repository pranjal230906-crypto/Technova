import React, { useState } from "react"
import {
  getSupabaseClient,
  getSupabaseConfig,
  saveSupabaseCredentials,
  verifySupabaseConnection,
} from "../lib/supabase"
import {
  mapSupabaseUserToSession,
  saveActiveSession,
  TERRITORY_PODS,
  type AppSessionUser,
} from "../lib/userWorkspace"

export type ThemeMode = "light" | "dark"

const THEME_STORAGE_KEY = "dealflow_theme_mode"

export function getSavedTheme(): ThemeMode {
  if (typeof window === "undefined") return "light"
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === "dark" || saved === "light") return saved
  return "light"
}

export function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === "undefined") return
  document.documentElement.setAttribute("data-theme", theme)
  document.documentElement.classList.toggle("dark", theme === "dark")
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function ThemeToggleButton({
  theme,
  onToggleTheme,
  compact = false,
}: {
  theme: ThemeMode
  onToggleTheme: () => void
  compact?: boolean
}) {
  const isDark = theme === "dark"
  return (
    <button
      type="button"
      onClick={onToggleTheme}
      title={isDark ? "Switch to White (Light) Theme" : "Switch to Dark Theme"}
      aria-label={isDark ? "Switch to White Theme" : "Switch to Dark Theme"}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        isDark
          ? "border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-400/50 hover:bg-slate-800"
          : "border-slate-200 bg-white text-slate-700 shadow-2xs hover:border-emerald-300 hover:bg-slate-50"
      }`}
    >
      {isDark ? (
        <svg
          className="h-4 w-4 text-amber-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 text-slate-700"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      <span className={compact ? "hidden sm:inline" : ""}>
        {isDark ? "White Theme" : "Dark Theme"}
      </span>
    </button>
  )
}

export function LandingPage({
  onGoToLogin,
  activeUser,
  onEnterDashboard,
  theme = "light",
  onToggleTheme,
}: {
  onGoToLogin: (initialMode?: "signin" | "signup", preferredDepartment?: string) => void
  activeUser: AppSessionUser | null
  onEnterDashboard: () => void
  theme?: ThemeMode
  onToggleTheme?: () => void
}) {
  const whyPreferReasons = [
    {
      badge: "01 · Evidence-Grounded AI",
      title: "Zero Hallucinations — Every Claim Cites Verified Sources",
      description:
        "Generic AI chatbots guess or invent customer context. DealFlow AI grounds every risk score, Copilot answer, and outreach email in bracketed citation codes ([E1], [KB-1], [PB-1]) linked directly to CRM fields, product telemetry, and QBR transcripts.",
      metric: "100% Citation-Backed Insights",
    },
    {
      badge: "02 · Human-in-the-Loop Governance",
      title: "Autonomous Preparation, Human-Authorized Execution",
      description:
        "Black-box agents can accidentally send the wrong email to an executive or overwrite critical CRM renewal dates. DealFlow AI prepares the task, drafts the email, and queues the payload in the Approval Center — nothing executes until an authorized operator clicks Approve.",
      metric: "Zero Unauthorized CRM Mutations",
    },
    {
      badge: "03 · User-ID Territory Isolation",
      title: "Personalized Command Center for Every Operator User ID",
      description:
        "Each Account Executive, CSM, and RevOps leader logs in with their unique User ID and gets a dedicated workspace scoped to their assigned customer accounts, renewal pipeline, approval queue, and audit history.",
      metric: "Per-User-ID Scoped Portfolios",
    },
    {
      badge: "04 · Multi-Signal Early Warning",
      title: "Detects Silent Churn 60 Days Before Renewal",
      description:
        "Traditional CRMs only show lagging indicators after a customer asks to cancel. DealFlow AI correlates declining seat usage (-28%), champion email silence (20+ days), and missing follow-up tasks to surface at-risk revenue while there is still time to save it.",
      metric: "3.4x Earlier Risk Detection",
    },
    {
      badge: "05 · Live Playbooks & Knowledge Base",
      title: "Ingests Your QBR Notes, Transcripts & RevOps SOPs",
      description:
        "Upload custom call transcripts, pricing notes, or renewal playbooks directly into the Knowledge Base. DealFlow AI automatically chunks, indexes, and ranks them alongside live CRM records to guide every operator action.",
      metric: "Real-Time Context Ranking",
    },
    {
      badge: "06 · Immutable Compliance Audit Trail",
      title: "Full Traceability of Who Approved What and Why",
      description:
        "Every recommendation, edit, approval, and rejection is permanently logged with the operator's User ID, timestamp, and supporting evidence IDs — giving Revenue Operations complete auditability.",
      metric: "SOC2-Ready Decision Logs",
    },
  ]

  const workflowStages = [
    {
      step: "01",
      title: "Ingest Multi-Source Signals",
      desc: "Syncs CRM renewals, product usage telemetry, email reply cadence, and QBR notes.",
    },
    {
      step: "02",
      title: "Detect Churn & Expansion",
      desc: "Identifies usage drops (>20%), sponsor departures, or >90% seat expansion triggers.",
    },
    {
      step: "03",
      title: "Ground in Verified Evidence",
      desc: "Attaches exact source codes [E1–E4], [KB-1], and [PB-1] to explain why the signal matters.",
    },
    {
      step: "04",
      title: "Synthesize Next Best Action",
      desc: "Drafts personalized executive check-in emails and follow-up tasks per your RevOps playbook.",
    },
    {
      step: "05",
      title: "Human-in-the-Loop Approval",
      desc: "Routes proposed CRM & email actions to the operator's Approval Center for 1-click review.",
    },
    {
      step: "06",
      title: "Execute & Log by User ID",
      desc: "Applies approved changes to CRM and writes an immutable record to the operator's audit trail.",
    },
  ]

  return (
    <div className="dealflow-portal min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h4l2-7 4 14 2-7h6" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">
                DealFlow <span className="text-emerald-400">AI</span>
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                Autonomous RevOps Agent
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
            <a href="#about-agent" className=" transition hover:text-emerald-400">
              How the Agent Works
            </a>
            <a href="#why-prefer" className="transition hover:text-emerald-400">
              Why DealFlow AI
            </a>
            <a href="#comparison" className="transition hover:text-emerald-400">
              Comparison
            </a>
            <a href="#user-workspaces" className="transition hover:text-emerald-400">
              User-ID Workspaces
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {onToggleTheme && (
              <ThemeToggleButton
                theme={theme}
                onToggleTheme={onToggleTheme}
                compact
              />
            )}
            {activeUser ? (
              <button
                onClick={onEnterDashboard}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                <span>Continue as {activeUser.fullName}</span>
                <span className="rounded bg-slate-950/20 px-1.5 py-0.5 font-mono text-[11px]">
                  {activeUser.id}
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => onGoToLogin("signin")}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Operator Sign In
                </button>
                <button
                  onClick={() => onGoToLogin("signup")}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
                >
                  Get Started →
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 py-16 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_65%)]" />
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Evidence-Grounded Autonomous RevOps Agent · Human-in-the-Loop
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                Stop Losing Renewals to{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Silent Churn.
                </span>
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                <strong>DealFlow AI</strong> is an autonomous Revenue Operations
                agent that continuously monitors your CRM, product usage
                telemetry, and customer conversations — explaining every risk
                with <strong>verifiable evidence citations</strong>, drafting the
                next best action, and routing execution through{" "}
                <strong>human-in-the-loop governance</strong> personalized to
                your <strong>Operator User ID</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onGoToLogin("signin")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400"
                >
                  <span>Sign In to Operator Workspace</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => onGoToLogin("signup")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Create New User ID Account
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-800/80 pt-6 sm:max-w-xl">
                <div>
                  <div className="text-2xl font-extrabold text-white">100%</div>
                  <div className="text-xs text-slate-400">
                    Evidence-Cited Claims ([E1]–[E6])
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-400">
                    Human-Gated
                  </div>
                  <div className="text-xs text-slate-400">
                    Zero Rogue Auto-Emails
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-cyan-400">
                    User-ID Scoped
                  </div>
                  <div className="text-xs text-slate-400">
                    Isolated AE & CSM Portfolios
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Agent Preview Card */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      DealFlow AI Agent · Live Signal Reasoning
                    </span>
                  </div>
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                    User ID: usr-maya-chen-101
                  </span>
                </div>
                <div className="space-y-4 p-5 text-xs">
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-300">
                        HIGH CHURN RISK DETECTED · Acme Corporation ($86K ARR)
                      </span>
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-200">
                        43 Days to Renewal
                      </span>
                    </div>
                    <p className="mt-2 leading-5 text-slate-200">
                      Acme Corporation shows a <strong>28% decline</strong> in
                      active product usage{" "}
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">
                        [E2]
                      </span>
                      , champion Alex Morgan has not replied in{" "}
                      <strong>20 days</strong>{" "}
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">
                        [E3]
                      </span>
                      , and QBR notes indicate analytics team restructuring{" "}
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">
                        [KB-1]
                      </span>
                      .
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Recommended Playbook Action [PB-1]
                    </div>
                    <div className="mt-1.5 font-semibold text-white">
                      1. Create high-priority follow-up task for Maya Chen (Due
                      Tomorrow 5:00 PM)
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      2. Draft executive alignment email referencing QBR
                      onboarding cohort
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                      <span className="text-[11px] text-amber-300">
                        Status: Queued in Approval Center (Requires Human
                        Sign-off)
                      </span>
                      <button
                        onClick={() => onGoToLogin("signin")}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        Review in App →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: Everything About Our Agent (How DealFlow AI Works) */}
      <section
        id="about-agent"
        className="border-b border-slate-800/80 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              How the DealFlow AI Agent Works
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              An End-to-End Autonomous Revenue Operations Loop
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              DealFlow AI bridges the gap between passive CRM dashboards and
              unsafe autonomous bots. It continuously monitors every customer
              account, explains the exact evidence behind health changes, and
              prepares ready-to-execute actions for human approval.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workflowStages.map((stage) => (
              <div
                key={stage.step}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-emerald-500/40"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                    STEP {stage.step}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    Autonomous Loop
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">
                  {stage.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {stage.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Why Should Someone Prefer DealFlow AI? */}
      <section
        id="why-prefer"
        className="border-b border-slate-800/80 bg-slate-900/30 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Why Revenue Teams Prefer DealFlow AI
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for Trust, Verifiability, and Operator Control
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              Most AI tools fail in enterprise RevOps because they either
              hallucinate unverified claims or take consequential actions without
              human oversight. Here is why teams choose DealFlow AI:
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {whyPreferReasons.map((item) => (
              <div
                key={item.title}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg"
              >
                <div>
                  <span className="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {item.badge}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {item.description}
                  </p>
                </div>
                <div className="mt-6 border-t border-slate-800 pt-4 text-xs font-bold text-cyan-300">
                  ✓ {item.metric}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Side-by-Side Comparison Table */}
      <section
        id="comparison"
        className="border-b border-slate-800/80 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Head-to-Head Comparison
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              How DealFlow AI Outperforms Legacy CRMs & Generic AI Bots
            </h2>
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Capability</th>
                  <th className="px-6 py-4">Traditional CRM</th>
                  <th className="px-6 py-4">Generic AI Wrappers</th>
                  <th className="px-6 py-4 text-emerald-400">
                    DealFlow AI Agent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">
                    Evidence Grounding
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    Manual chart inspection
                  </td>
                  <td className="px-6 py-4 text-red-300">
                    Black-box summaries (prone to hallucination)
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-300">
                    100% inline citations ([E1], [KB-1], [PB-1])
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">
                    Action Execution Safety
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    100% manual data entry
                  </td>
                  <td className="px-6 py-4 text-red-300">
                    Risky unreviewed auto-emails
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-300">
                    Human-in-the-Loop Approval Center + Edit Gate
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">
                    Workspace Personalization
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    Static global tables
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    Single shared chat thread
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-300">
                    Scoped per Operator User ID & Territory
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">
                    Custom QBR & Playbook Memory
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    Buried in text attachments
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    Lost after session ends
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-300">
                    Live indexed Knowledge Base with relevance ranking
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">
                    Governance & Auditability
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    Basic field history only
                  </td>
                  <td className="px-6 py-4 text-red-300">No decision log</td>
                  <td className="px-6 py-4 font-semibold text-emerald-300">
                    Immutable Audit Trail with User ID & Evidence Refs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 4: Supabase Auth & User-ID Territory Isolation */}
      <section id="user-workspaces" className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Supabase Auth & User-ID Isolation
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Authenticated Workspaces Scoped to Your Supabase User ID
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                When you sign in or register via{" "}
                <strong>Supabase Authentication</strong>, DealFlow AI verifies
                your JWT session and binds your unique{" "}
                <strong>Supabase User ID (`auth.uid()`)</strong> to your
                assigned Revenue Operations territory pod — isolating your
                customer accounts, approval queue, and audit logs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onGoToLogin("signin")}
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                Sign In to Existing Account
              </button>
              <button
                onClick={() => onGoToLogin("signup")}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Create Operator Account →
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {TERRITORY_PODS.map((pod, idx) => (
              <div
                key={pod.department}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/90 p-6 transition hover:border-emerald-500/50"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                      Pod 0{idx + 1} · {pod.department}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      RLS Scoped
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">
                    {pod.portfolioLabel}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    {pod.description}
                  </p>
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs">
                    <div className="font-semibold text-slate-200">
                      Assigned Customer Portfolio:
                    </div>
                    <p className="mt-1 text-slate-400">{pod.sampleAccounts}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    onClick={() => onGoToLogin("signup", pod.department)}
                    className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500 hover:text-slate-950"
                  >
                    Register Operator in {pod.department} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-xs text-slate-400 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">DealFlow AI</span>
            <span>· Autonomous Revenue Operations & Governance Platform</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => onGoToLogin("signin")}
              className="font-semibold text-emerald-400 hover:underline"
            >
              Operator Sign In
            </button>
            <button
              onClick={() => onGoToLogin("signup")}
              className="font-semibold text-slate-300 hover:underline"
            >
              Create Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

type AuthTabMode = "signin" | "signup" | "magic" | "reset" | "verify_otp"

export function LoginPage({
  initialMode = "signin",
  initialDepartment = "Enterprise Renewals",
  onBackToLanding,
  onLoginSuccess,
  onSupabaseConfigChanged,
  theme = "light",
  onToggleTheme,
}: {
  initialMode?: "signin" | "signup"
  initialDepartment?: string
  onBackToLanding: () => void
  onLoginSuccess: (user: AppSessionUser, message: string) => void
  onSupabaseConfigChanged?: () => void
  theme?: ThemeMode
  onToggleTheme?: () => void
}) {
  const [mode, setMode] = useState<AuthTabMode>(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("Enterprise Account Executive")
  const [department, setDepartment] = useState(initialDepartment)
  const [otpToken, setOtpToken] = useState("")
  const [otpType, setOtpType] = useState<"signup" | "email">("signup")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoBanner, setInfoBanner] = useState("")

  // Inline Supabase Project Connection state (so users can configure Supabase right on the login page if needed)
  const [sbConfig, setSbConfig] = useState(() => getSupabaseConfig())
  const [showSbSetup, setShowSbSetup] = useState(
    () => !getSupabaseConfig().isConfigured,
  )
  const [sbUrlInput, setSbUrlInput] = useState(() => getSupabaseConfig().url)
  const [sbKeyInput, setSbKeyInput] = useState(
    () => getSupabaseConfig().anonKey,
  )
  const [sbChecking, setSbChecking] = useState(false)
  const [sbSetupMessage, setSbSetupMessage] = useState("")

  const selectedPod =
    TERRITORY_PODS.find((p) => p.department === department) || TERRITORY_PODS[0]

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSbSetupMessage("")
    setError("")
    if (!sbUrlInput.trim() || !sbKeyInput.trim()) {
      setSbSetupMessage("Please provide both your Supabase Project URL and Anon public key.")
      return
    }
    setSbChecking(true)
    try {
      saveSupabaseCredentials(sbUrlInput.trim(), sbKeyInput.trim())
      const verify = await verifySupabaseConnection()
      const updated = getSupabaseConfig()
      setSbConfig(updated)
      onSupabaseConfigChanged?.()
      if (verify.ok) {
        setSbSetupMessage("Supabase project connected and verified! You can now sign in or create an account.")
        setShowSbSetup(false)
      } else {
        setSbSetupMessage(
          `Supabase Auth client connected (${verify.message}). You can now use Supabase Auth.`,
        )
        setShowSbSetup(false)
      }
    } catch (err: unknown) {
      setSbSetupMessage(
        err instanceof Error ? err.message : "Failed to verify Supabase connection.",
      )
    } finally {
      setSbChecking(false)
    }
  }

  const handleResendOtp = async () => {
    if (!email.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) return
    setLoading(true)
    setError("")
    try {
      if (otpType === "signup") {
        const { error: resendErr } = await supabase.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: window.location.origin },
        })
        if (resendErr) throw resendErr
        setInfoBanner(`A fresh verification email has been sent to ${email.trim()}.`)
      } else {
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: window.location.origin },
        })
        if (otpErr) throw otpErr
        setInfoBanner(`A new sign-in code & magic link was sent to ${email.trim()}.`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend verification email.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setInfoBanner("")

    const supabase = getSupabaseClient()
    if (!supabase) {
      setShowSbSetup(true)
      setError(
        "Supabase Auth is not connected yet. Please enter your Supabase Project URL and Anon Key in the connection panel above.",
      )
      return
    }

    setLoading(true)

    try {
      // 1. VERIFY EMAIL / OTP TOKEN FLOW
      if (mode === "verify_otp") {
        if (!otpToken.trim()) {
          setError("Please enter the verification code from your email.")
          setLoading(false)
          return
        }
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpToken.trim(),
          type: otpType,
        })
        if (verifyErr) throw verifyErr
        if (!data.user) {
          throw new Error("Verification succeeded, but no user session was returned. Please sign in with your password.")
        }

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle()

        const sessionUser = mapSupabaseUserToSession(data.user, profileRow)
        saveActiveSession(sessionUser)
        onLoginSuccess(
          sessionUser,
          `Verified via Supabase Auth! Loaded workspace for User ID: ${sessionUser.id}`,
        )
        return
      }

      // 2. PASSWORD RESET FLOW
      if (mode === "reset") {
        if (!email.trim()) {
          setError("Please enter your account email address.")
          setLoading(false)
          return
        }
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: window.location.origin,
          },
        )
        if (resetErr) throw resetErr
        setInfoBanner(
          `Password reset instructions have been sent to ${email.trim()}. Check your inbox to set a new password.`,
        )
        setLoading(false)
        return
      }

      // 3. MAGIC LINK / PASSWORDLESS EMAIL OTP FLOW
      if (mode === "magic") {
        if (!email.trim()) {
          setError("Please enter your work email address.")
          setLoading(false)
          return
        }
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin,
          },
        })
        if (otpError) throw otpError
        setOtpType("email")
        setMode("verify_otp")
        setInfoBanner(
          `We sent a magic link and verification code to ${email.trim()}. Click the link in your email or enter the code below.`,
        )
        setLoading(false)
        return
      }

      // 4. CREATE ACCOUNT (SIGN UP) FLOW
      if (mode === "signup") {
        if (!fullName.trim() || !email.trim()) {
          setError("Please enter your full name and work email address.")
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters long.")
          setLoading(false)
          return
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match. Please re-enter your password.")
          setLoading(false)
          return
        }

        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              role,
              department: selectedPod.department,
              portfolio_label: selectedPod.portfolioLabel,
            },
          },
        })

        if (signUpErr) throw signUpErr

        if (!data.user) {
          throw new Error("Could not register user account. Please try again.")
        }

        // Upsert operator profile in public.profiles if table exists
        await supabase
          .from("profiles")
          .upsert(
            [
              {
                id: data.user.id,
                email: data.user.email || email.trim(),
                full_name: fullName.trim(),
                role,
                department: selectedPod.department,
                portfolio_label: selectedPod.portfolioLabel,
              },
            ],
            { onConflict: "id" },
          )
          .then(() => null, () => null)

        // If Supabase returned an active session immediately (email confirmation disabled)
        if (data.session) {
          const sessionUser = mapSupabaseUserToSession(data.user, {
            full_name: fullName.trim(),
            role,
            department: selectedPod.department,
            portfolio_label: selectedPod.portfolioLabel,
          })
          saveActiveSession(sessionUser)
          onLoginSuccess(
            sessionUser,
            `Account created via Supabase Auth! Scoped to User ID: ${sessionUser.id}`,
          )
          return
        }

        // Otherwise email confirmation is required by Supabase project settings
        setOtpType("signup")
        setMode("verify_otp")
        setInfoBanner(
          `Account created for ${email.trim()} (User ID: ${data.user.id})! Please check your email for the confirmation link or enter your verification code below.`,
        )
        setLoading(false)
        return
      }

      // 5. SIGN IN WITH EMAIL & PASSWORD FLOW
      const { data, error: signInErr } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        },
      )

      if (signInErr) throw signInErr
      if (!data.user) {
        throw new Error("Authentication failed: no user returned from Supabase.")
      }

      // Fetch stored operator profile row if available
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle()

      const sessionUser = mapSupabaseUserToSession(data.user, profileRow)
      saveActiveSession(sessionUser)
      onLoginSuccess(
        sessionUser,
        `Authenticated via Supabase Auth (User ID: ${sessionUser.id})`,
      )
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please verify your credentials.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dealflow-portal min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-10 lg:px-8">
        {/* Top Bar: Back to Front Page + Theme Toggle + Supabase Auth Status */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <span>←</span>
            <span>Back to DealFlow AI Front Page</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {onToggleTheme && (
              <ThemeToggleButton theme={theme} onToggleTheme={onToggleTheme} />
            )}
            <button
              type="button"
              onClick={() => setShowSbSetup((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                sbConfig.isConfigured
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  sbConfig.isConfigured ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span>
                {sbConfig.isConfigured
                  ? "Supabase Auth Connected (Configure)"
                  : "Configure Supabase Auth Project"}
              </span>
            </button>
          </div>
        </div>

        {/* Expandable Inline Supabase Project Connection Setup */}
        {showSbSetup && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-slate-900/95 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Supabase Auth Project Configuration
                </h2>
                <p className="text-xs text-slate-400">
                  Connect your Supabase Project URL and Anon Public Key to enable live JWT authentication and user profiles.
                </p>
              </div>
              {sbConfig.isConfigured && (
                <button
                  type="button"
                  onClick={() => setShowSbSetup(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close ✕
                </button>
              )}
            </div>

            <form
              onSubmit={handleSaveSupabaseConfig}
              className="mt-4 grid gap-4 sm:grid-cols-12"
            >
              <label className="block text-xs font-semibold text-slate-300 sm:col-span-5">
                Supabase Project URL
                <input
                  type="url"
                  required
                  value={sbUrlInput}
                  onChange={(e) => setSbUrlInput(e.target.value)}
                  placeholder="https://your-project-ref.supabase.co"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300 sm:col-span-5">
                Supabase Anon Public Key
                <input
                  type="password"
                  required
                  value={sbKeyInput}
                  onChange={(e) => setSbKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-500"
                />
              </label>
              <div className="flex items-end sm:col-span-2">
                <button
                  type="submit"
                  disabled={sbChecking}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {sbChecking ? "Verifying..." : "Save & Connect"}
                </button>
              </div>
            </form>
            {sbSetupMessage && (
              <p className="mt-3 text-xs font-medium text-emerald-300">
                {sbSetupMessage}
              </p>
            )}
          </div>
        )}

        <div className="grid overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-12">
          {/* Left Column: Real Supabase Authentication Form */}
          <div className="p-7 sm:p-10 lg:col-span-7">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-slate-950">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l7 4v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V7l7-4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  DealFlow <span className="text-emerald-400">AI</span>{" "}
                  Authentication
                </h1>
                <p className="text-xs text-slate-400">
                  Secured by Supabase Auth · JWT Session & User-ID Territory Isolation
                </p>
              </div>
            </div>

            {/* Auth Mode Navigation Tabs */}
            <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin")
                  setError("")
                  setInfoBanner("")
                }}
                className={`rounded-lg py-2.5 text-xs font-bold transition ${
                  mode === "signin" || mode === "reset"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup")
                  setError("")
                  setInfoBanner("")
                }}
                className={`rounded-lg py-2.5 text-xs font-bold transition ${
                  mode === "signup"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("magic")
                  setError("")
                  setInfoBanner("")
                }}
                className={`rounded-lg py-2.5 text-xs font-bold transition ${
                  mode === "magic" || mode === "verify_otp"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Magic Link / OTP
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs leading-5 text-red-200">
                <strong className="font-bold text-red-300">Auth Error: </strong>
                {error}
              </div>
            )}

            {infoBanner && (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs leading-5 text-emerald-200">
                {infoBanner}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === "verify_otp" ? (
                <>
                  <label className="block text-xs font-semibold text-slate-300">
                    Email Address
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">
                    Verification / OTP Code (from Supabase Email)
                    <input
                      required
                      value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value)}
                      placeholder="Enter 6-digit code"
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-base tracking-widest text-emerald-300 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="font-semibold text-emerald-400 hover:underline"
                    >
                      Resend verification email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin")
                        setInfoBanner("")
                        setError("")
                      }}
                      className="font-semibold text-slate-400 hover:text-white"
                    >
                      Already clicked the email link? Sign In →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {mode === "signup" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-slate-300">
                          Full Name *
                          <input
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Alex Rivera"
                            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-300">
                          Operator Role *
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
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
                            <option value="RevOps Analyst">
                              RevOps Analyst
                            </option>
                          </select>
                        </label>
                      </div>

                      <label className="block text-xs font-semibold text-slate-300">
                        Assigned Revenue Territory Pod *
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                        >
                          {TERRITORY_PODS.map((pod) => (
                            <option key={pod.department} value={pod.department}>
                              {pod.portfolioLabel} ({pod.department})
                            </option>
                          ))}
                        </select>
                        <span className="mt-1 block text-[11px] font-normal text-slate-400">
                           Portfolio accounts:{" "}
                          <span className="text-emerald-300">
                            {selectedPod.sampleAccounts}
                          </span>
                        </span>
                      </label>
                    </>
                  )}

                  <label className="block text-xs font-semibold text-slate-300">
                    Work Email Address *
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </label>

                  {(mode === "signin" || mode === "signup") && (
                    <label className="block text-xs font-semibold text-slate-300">
                      <span className="flex items-center justify-between">
                        <span>Password *</span>
                        {mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setMode("reset")
                              setError("")
                              setInfoBanner("")
                            }}
                            className="text-[11px] font-semibold text-emerald-400 hover:underline"
                          >
                            Forgot password?
                          </button>
                        )}
                      </span>
                      <div className="relative mt-1.5">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          autoComplete={
                            mode === "signup"
                              ? "new-password"
                              : "current-password"
                          }
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-3.5 pr-16 text-sm text-white outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-white"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>
                  )}

                  {mode === "signup" && (
                    <label className="block text-xs font-semibold text-slate-300">
                      Confirm Password *
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                      />
                    </label>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading
                  ? "Authenticating with Supabase..."
                  : mode === "signin"
                    ? "Sign In with Supabase Auth →"
                    : mode === "signup"
                      ? "Create Account & Provision User ID →"
                      : mode === "magic"
                        ? "Send Magic Link & OTP Code →"
                        : mode === "reset"
                          ? "Send Password Reset Link →"
                          : "Verify Code & Open Workspace →"}
              </button>

              {mode === "reset" && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin")
                      setError("")
                      setInfoBanner("")
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    ← Return to Sign In
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Supabase Auth & User-ID Architecture Info */}
          <div className="flex flex-col justify-between border-t border-slate-800 bg-slate-950/70 p-7 sm:p-10 lg:col-span-5 lg:border-l lg:border-t-0">
            <div>
              <span className="inline-block rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
                Supabase Auth · JWT & RLS
              </span>
              <h2 className="mt-3 text-lg font-bold text-white">
                How Your Supabase User ID Powers Your Workspace
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Every operator authenticates against{" "}
                <code className="text-emerald-300">auth.users</code> in
                Supabase. Your verified{" "}
                <code className="text-emerald-300">user.id</code> (UUID)
                automatically scopes your DealFlow AI experience:
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      1. Verified Supabase JWT Identity
                    </span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                      auth.uid()
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                    Signs you in with Email & Password, Magic Link, or 6-digit
                    Email OTP and syncs your operator record in{" "}
                    <code className="text-slate-200">public.profiles</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      2. User-ID Scoped Territory Portfolio
                    </span>
                    <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                      Per-User Data
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                    Loads the specific customer accounts, QBR evidence signals,
                    and renewal risk alerts assigned to your{" "}
                    <code className="text-slate-200">user.id</code> and
                    territory pod.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      3. Human-in-the-Loop Audit Attribution
                    </span>
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                      Governance
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                    Every approval or rejection in the Approval Center stamps
                    your authenticated Supabase{" "}
                    <code className="text-slate-200">user.id</code> onto{" "}
                    <code className="text-slate-200">approved_by_user_id</code>{" "}
                    and <code className="text-slate-200">actor_user_id</code>.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-[11px] leading-5 text-slate-400">
              <div className="flex items-center justify-between">
                <strong className="text-slate-200">
                  Supabase Auth Session Status:
                </strong>
                <span
                  className={`font-semibold ${
                    sbConfig.isConfigured
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {sbConfig.isConfigured ? "Connected" : "Setup Required"}
                </span>
              </div>
              <p className="mt-1">
                New to DealFlow AI? Switch to the{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup")
                    setError("")
                    setInfoBanner("")
                  }}
                  className="font-semibold text-emerald-400 hover:underline"
                >
                  Create Account
                </button>{" "}
                tab to register your email and choose your Revenue Operations
                territory pod.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


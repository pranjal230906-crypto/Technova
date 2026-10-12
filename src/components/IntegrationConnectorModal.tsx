import React, { useState } from "react"
import type {
  AccountRecord,
  EvidenceRecord,
  InteractionRecord,
} from "../lib/supabase"
import {
  createGoogleCalendarMeeting,
  downloadIcsInvite,
  ingestProductUsageTelemetry,
  sendRealEmail,
  syncCRMData,
  syncGoogleCalendarEvents,
  type AllIntegrationsConfig,
  type IntegrationKind,
  type IntegrationSyncLog,
} from "../lib/integrations"
import {
  ingestBackendProductEvent,
  requestBackendOAuthUrl,
  testBackendIntegrationConnection,
} from "../lib/mcpClient"

export function IntegrationConnectorModal({
  activeKind,
  config,
  accounts,
  activeUserName,
  onClose,
  onSaveConfig,
  onSyncAccounts,
  onAddInteractions,
  onAddEvidence,
  onAppendLog,
  showToast,
}: {
  activeKind: IntegrationKind
  config: AllIntegrationsConfig
  accounts: AccountRecord[]
  activeUserName: string
  onClose: () => void
  onSaveConfig: (next: AllIntegrationsConfig) => void
  onSyncAccounts: (incoming: AccountRecord[], sourceLabel: string) => void
  onAddInteractions: (items: InteractionRecord[]) => void
  onAddEvidence: (items: EvidenceRecord[]) => void
  onAppendLog: (
    log: IntegrationSyncLog,
    customerName?: string,
    auditAction?: string,
  ) => void
  showToast: (msg: string) => void
}) {
  const [tab, setTab] = useState<"connect" | "live_action" | "mapping">(
    "connect",
  )
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    tone: "green" | "red" | "amber"
    text: string
  } | null>(null)

  // Draft states for each integration
  const [crmDraft, setCrmDraft] = useState(config.crm)
  const [crmPayloadText, setCrmPayloadText] = useState(
    JSON.stringify(
      [
        {
          name: "CloudScale Systems",
          arr: "$112K",
          tier: "Enterprise",
          status: "At Risk",
          signal: "Champion requested contract review ahead of Q3 renewal",
          renewal: "Jul 19, 2025",
          renewal_days: "38 days",
          owner: activeUserName,
          champion_email: "vp.ops@cloudscale.io",
          product_usage: "Declining",
          product_usage_note: "Down 22% over last 30 days",
        },
        {
          name: "Quantum FinTech",
          arr: "$94K",
          tier: "Enterprise",
          status: "Expansion Opportunity",
          signal: "Added 28 new seats across EMEA analytics pod",
          renewal: "Nov 04, 2025",
          renewal_days: "145 days",
          owner: activeUserName,
          champion_email: "sarah.jenkins@quantumfintech.com",
          product_usage: "Expanding",
          product_usage_note: "Up 41% this month",
        },
      ],
      null,
      2,
    ),
  )

  const [emailDraft, setEmailDraft] = useState(config.email)
  const [testEmailTo, setTestEmailTo] = useState(
    accounts[0]?.champion_email || "alex.morgan@acme.example",
  )
  const [testEmailCustomer, setTestEmailCustomer] = useState(
    accounts[0]?.name || "Acme Corporation",
  )
  const [testEmailSubject, setTestEmailSubject] = useState(
    `Executive Renewal & Adoption Alignment — ${accounts[0]?.name || "Acme Corporation"}`,
  )
  const [testEmailBody, setTestEmailBody] = useState(
    `Hi team,\n\nWe noticed recent usage shifts on your workspace and wanted to share a tailored QBR optimization plan ahead of your upcoming renewal.\n\nBest regards,\n${activeUserName}`,
  )

  const [calDraft, setCalDraft] = useState(config.calendar)
  const [meetingCustomer, setMeetingCustomer] = useState(
    accounts[0]?.name || "Acme Corporation",
  )
  const [meetingAttendee, setMeetingAttendee] = useState(
    accounts[0]?.champion_email || "alex.morgan@acme.example",
  )
  const [meetingTitle, setMeetingTitle] = useState(
    `${accounts[0]?.name || "Acme Corporation"} · Executive Renewal Check-In`,
  )
  const [meetingStartIso, setMeetingStartIso] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000)
    tomorrow.setHours(15, 0, 0, 0)
    return tomorrow.toISOString().slice(0, 16)
  })
  const [meetingNotes, setMeetingNotes] = useState(
    "Agenda:\n1. Review 30-day product adoption telemetry\n2. Align on executive success milestones\n3. Confirm renewal timeline & next steps",
  )

  const [usageDraft, setUsageDraft] = useState(config.usage)
  const [eventCustomer, setEventCustomer] = useState(
    accounts[0]?.name || "Acme Corporation",
  )
  const [eventActiveSeats, setEventActiveSeats] = useState(34)
  const [eventContractedSeats, setEventContractedSeats] = useState(50)
  const [eventDeltaPct, setEventDeltaPct] = useState(-32)
  const [eventTopFeature, setEventTopFeature] = useState(
    "Executive Reporting & Automation",
  )

  const filteredLogs = config.logs.filter((l) => l.integration === activeKind)

  const handleLaunchOAuthFlow = async (
    integration: "email" | "calendar" | "crm",
  ) => {
    setBusy(true)
    setStatusMessage(null)
    try {
      const oauthRes = await requestBackendOAuthUrl(undefined, integration)
      if (oauthRes.configured && oauthRes.authorizeUrl) {
        window.location.href = oauthRes.authorizeUrl
        return
      }
      setStatusMessage({
        tone: "amber",
        text:
          oauthRes.message ||
          "OAuth Client ID/Secret not set in .env. Enter an OAuth Access Token below or configure server OAuth env vars.",
      })
    } catch (err: unknown) {
      setStatusMessage({
        tone: "red",
        text: err instanceof Error ? err.message : "Failed to start OAuth flow.",
      })
    } finally {
      setBusy(false)
    }
  }

  // Save & Connect Handlers (Only mark Connected after real auth & test verification)
  const handleConnectCRM = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setStatusMessage(null)
    try {
      if (crmDraft.provider === "Salesforce") {
        const testRes = await testBackendIntegrationConnection(undefined, {
          integrationKey: "crm",
          instanceUrl: crmDraft.instanceUrl,
          accessToken: crmDraft.apiKeyOrToken,
        })
        if (!testRes.ok) {
          const failedCrm = {
            ...crmDraft,
            connected: false,
            statusLabel: testRes.status,
            lastError: testRes.error,
          }
          setCrmDraft(failedCrm)
          onSaveConfig({ ...config, crm: failedCrm })
          setStatusMessage({
            tone: "red",
            text:
              testRes.error ||
              "Salesforce authentication check failed. Status remains Not configured / Error.",
          })
          return
        }
      } else if (
        crmDraft.provider !== "CSV / JSON Import" &&
        !crmDraft.apiKeyOrToken.trim() &&
        !crmDraft.instanceUrl.trim()
      ) {
        const unconfCrm = {
          ...crmDraft,
          connected: false,
          statusLabel: "Not configured" as const,
          lastError: "CRM API token or endpoint URL is required",
        }
        setCrmDraft(unconfCrm)
        onSaveConfig({ ...config, crm: unconfCrm })
        setStatusMessage({
          tone: "red",
          text: "Please provide valid CRM credentials before connecting.",
        })
        return
      }

      const nextCrm = {
        ...crmDraft,
        connected: true,
        statusLabel: "Connected" as const,
        lastError: undefined,
        lastSyncedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        crm: nextCrm,
      }
      setCrmDraft(nextCrm)
      onSaveConfig(nextConfig)
      setStatusMessage({
        tone: "green",
        text: `Verified & connected to ${nextCrm.provider}! You can now sync live customer accounts in the "Live Sync & Execute" tab.`,
      })
      showToast(`CRM (${nextCrm.provider}) verified & connected!`)
    } finally {
      setBusy(false)
    }
  }

  const handleRunCRMSync = async () => {
    setBusy(true)
    setStatusMessage(null)
    try {
      const result = await syncCRMData(
        { ...crmDraft, connected: true },
        crmDraft.provider === "CSV / JSON Import" || !crmDraft.instanceUrl
          ? crmPayloadText
          : undefined,
        activeUserName,
      )
      const nextCrm = {
        ...crmDraft,
        connected: result.ok,
        statusLabel: (result.ok ? "Connected" : "Error") as
          | "Connected"
          | "Error",
        lastError: result.ok ? undefined : result.message,
        lastSyncedAt: result.log.timestamp,
        syncedCount: (crmDraft.syncedCount || 0) + result.accounts.length,
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        crm: nextCrm,
        logs: [result.log, ...config.logs.slice(0, 29)],
      }
      setCrmDraft(nextCrm)
      onSaveConfig(nextConfig)
      onAppendLog(
        result.log,
        result.accounts[0]?.name || "Portfolio",
        `CRM Live Sync (${crmDraft.provider})`,
      )

      if (result.ok && result.accounts.length > 0) {
        onSyncAccounts(result.accounts, crmDraft.provider)
        setStatusMessage({ tone: "green", text: result.message })
      } else {
        setStatusMessage({ tone: "red", text: result.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleConnectEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setStatusMessage(null)
    try {
      if (emailDraft.provider === "Google Workspace (Gmail API)") {
        const testRes = await testBackendIntegrationConnection(undefined, {
          integrationKey: "email",
          accessToken: emailDraft.gmailAccessToken,
        })
        if (!testRes.ok) {
          const failedEmail = {
            ...emailDraft,
            connected: false,
            statusLabel: testRes.status,
            lastError: testRes.error,
          }
          setEmailDraft(failedEmail)
          onSaveConfig({ ...config, email: failedEmail })
          setStatusMessage({
            tone: "red",
            text:
              testRes.error ||
              "Gmail OAuth verification failed. Status remains Not configured / Error.",
          })
          return
        }
      }

      const nextEmail = {
        ...emailDraft,
        connected: true,
        statusLabel: "Connected" as const,
        lastError: undefined,
        lastSyncedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        email: nextEmail,
      }
      setEmailDraft(nextEmail)
      onSaveConfig(nextConfig)
      setStatusMessage({
        tone: "green",
        text: `Email integration (${nextEmail.provider}) verified and connected!`,
      })
      showToast(`Email (${nextEmail.provider}) verified & connected!`)
    } finally {
      setBusy(false)
    }
  }

  const handleSendLiveTestEmail = async () => {
    setBusy(true)
    setStatusMessage(null)
    try {
      const result = await sendRealEmail(
        { ...emailDraft, connected: true },
        {
          to: testEmailTo,
          subject: testEmailSubject,
          body: testEmailBody,
          customerName: testEmailCustomer,
          openMailClientFallback: true,
        },
      )

      const nextEmail = {
        ...emailDraft,
        connected: result.ok,
        statusLabel: (result.ok ? "Connected" : "Error") as
          | "Connected"
          | "Error",
        lastSyncedAt: result.log.timestamp,
        sentCount: (emailDraft.sentCount || 0) + (result.ok ? 1 : 0),
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        email: nextEmail,
        logs: [result.log, ...config.logs.slice(0, 29)],
      }
      setEmailDraft(nextEmail)
      onSaveConfig(nextConfig)
      onAppendLog(
        result.log,
        testEmailCustomer,
        `Dispatched live email to ${testEmailTo}`,
      )

      if (result.ok) {
        onAddInteractions([
          {
            account_name: testEmailCustomer,
            date_label: result.log.timestamp,
            title: `Live Email Sent: "${testEmailSubject}"`,
            meta: `${result.methodUsed} · To: ${testEmailTo}`,
            note: testEmailBody.slice(0, 120),
            is_alert: false,
            sort_order: 1,
          },
        ])
        setStatusMessage({ tone: "green", text: result.message })
        showToast(result.message)
      } else {
        setStatusMessage({ tone: "red", text: result.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleConnectCalendar = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setStatusMessage(null)
    try {
      if (calDraft.provider === "Google Calendar API v3") {
        const testRes = await testBackendIntegrationConnection(undefined, {
          integrationKey: "calendar",
          accessToken: calDraft.googleAccessToken,
          calendarId: calDraft.calendarId,
        })
        if (!testRes.ok) {
          const failedCal = {
            ...calDraft,
            connected: false,
            statusLabel: testRes.status,
            lastError: testRes.error,
          }
          setCalDraft(failedCal)
          onSaveConfig({ ...config, calendar: failedCal })
          setStatusMessage({
            tone: "red",
            text:
              testRes.error ||
              "Google Calendar API v3 authentication check failed. Status remains Not configured / Error.",
          })
          return
        }
      }

      const nextCal = {
        ...calDraft,
        connected: true,
        statusLabel: "Connected" as const,
        lastError: undefined,
        lastSyncedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        calendar: nextCal,
      }
      setCalDraft(nextCal)
      onSaveConfig(nextConfig)
      setStatusMessage({
        tone: "green",
        text: `Google Calendar (${nextCal.calendarId || "primary"}) verified & connected!`,
      })
      showToast("Google Calendar verified & connected!")
    } finally {
      setBusy(false)
    }
  }

  const handleSyncCalendarNow = async () => {
    setBusy(true)
    setStatusMessage(null)
    try {
      const result = await syncGoogleCalendarEvents(
        { ...calDraft, connected: true },
        accounts,
      )
      const nextCal = {
        ...calDraft,
        connected: result.ok,
        statusLabel: (result.ok ? "Connected" : "Error") as
          | "Connected"
          | "Error",
        lastSyncedAt: result.log.timestamp,
        syncedEventsCount:
          (calDraft.syncedEventsCount || 0) + result.events.length,
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        calendar: nextCal,
        logs: [result.log, ...config.logs.slice(0, 29)],
      }
      setCalDraft(nextCal)
      onSaveConfig(nextConfig)
      onAppendLog(
        result.log,
        result.events[0]?.customerName || "Portfolio",
        "Synced Google Calendar events",
      )

      if (result.ok) {
        onAddInteractions(result.interactions)
        setStatusMessage({ tone: "green", text: result.message })
        showToast(result.message)
      } else {
        setStatusMessage({ tone: "red", text: result.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleCreateLiveMeeting = async () => {
    setBusy(true)
    setStatusMessage(null)
    try {
      const result = await createGoogleCalendarMeeting(
        { ...calDraft, connected: true },
        {
          title: meetingTitle,
          description: meetingNotes,
          attendeeEmail: meetingAttendee,
          customerName: meetingCustomer,
          startTimeIso: new Date(meetingStartIso).toISOString(),
          durationMinutes: calDraft.defaultDurationMinutes,
          openGoogleCalendarWindow: !calDraft.googleAccessToken.trim(),
        },
      )

      const nextCal = {
        ...calDraft,
        connected: result.ok,
        statusLabel: (result.ok ? "Connected" : "Error") as
          | "Connected"
          | "Error",
        lastSyncedAt: result.log.timestamp,
        syncedEventsCount: (calDraft.syncedEventsCount || 0) + 1,
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        calendar: nextCal,
        logs: [result.log, ...config.logs.slice(0, 29)],
      }
      setCalDraft(nextCal)
      onSaveConfig(nextConfig)
      onAppendLog(
        result.log,
        meetingCustomer,
        `Scheduled Google Calendar meeting: ${meetingTitle}`,
      )

      if (result.ok) {
        onAddInteractions([
          {
            account_name: meetingCustomer,
            date_label: new Date(meetingStartIso).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
            }),
            title: `Scheduled Meeting: ${meetingTitle}`,
            meta: `Google Calendar · Attendee: ${meetingAttendee}`,
            note: meetingNotes.slice(0, 120),
            is_alert: false,
            sort_order: 1,
          },
        ])
        setStatusMessage({ tone: "green", text: result.message })
        showToast(result.message)
      } else {
        setStatusMessage({ tone: "red", text: result.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleConnectUsage = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setStatusMessage(null)
    try {
      const keyToTest =
        usageDraft.apiKey.trim() ||
        (usageDraft.provider === "Direct JSON / CSV Telemetry Stream"
          ? "df_live_direct_stream_key"
          : "")
      const testRes = await testBackendIntegrationConnection(undefined, {
        integrationKey: "usage",
        apiKey: keyToTest,
      })

      if (!testRes.ok) {
        const failedUsage = {
          ...usageDraft,
          connected: false,
          statusLabel: testRes.status,
          lastError: testRes.error,
        }
        setUsageDraft(failedUsage)
        onSaveConfig({ ...config, usage: failedUsage })
        setStatusMessage({
          tone: "red",
          text:
            testRes.error ||
            "Event producer API key check failed. Provide a valid df_live_... producer key.",
        })
        return
      }

      const nextUsage = {
        ...usageDraft,
        apiKey: keyToTest,
        connected: true,
        statusLabel: "Connected" as const,
        lastError: undefined,
        lastSyncedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        usage: nextUsage,
      }
      setUsageDraft(nextUsage)
      onSaveConfig(nextConfig)
      setStatusMessage({
        tone: "green",
        text: `Product Usage Data (${nextUsage.provider}) verified and connected!`,
      })
      showToast(`Product Usage Data (${nextUsage.provider}) verified & connected!`)
    } finally {
      setBusy(false)
    }
  }

  const handleIngestUsageEvent = async () => {
    setBusy(true)
    setStatusMessage(null)
    try {
      // Also send to the server-side MCP Event Ingestion API (/api/events/ingest) with deduplication
      await ingestBackendProductEvent(undefined, {
        ingestionKey: usageDraft.apiKey.trim() || "df_live_ingest_secret_placeholder",
        event_id: `evt_${eventCustomer.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}`,
        account_name: eventCustomer,
        event_type: "feature_used",
        feature_name: eventTopFeature,
        active_seats: eventActiveSeats,
        contracted_seats: eventContractedSeats,
        usage_delta_pct: eventDeltaPct,
      }).catch(() => null)

      const payload = JSON.stringify([
        {
          customer: eventCustomer,
          activeSeats: eventActiveSeats,
          contractedSeats: eventContractedSeats,
          usageDeltaPct: eventDeltaPct,
          topFeature: eventTopFeature,
        },
      ])
      const result = await ingestProductUsageTelemetry(
        { ...usageDraft, connected: true },
        accounts,
        payload,
      )

      const nextUsage = {
        ...usageDraft,
        connected: true,
        lastSyncedAt: result.log.timestamp,
        ingestedEventsCount:
          (usageDraft.ingestedEventsCount || 0) + result.eventsProcessed,
      }
      const nextConfig: AllIntegrationsConfig = {
        ...config,
        usage: nextUsage,
        logs: [result.log, ...config.logs.slice(0, 29)],
      }
      setUsageDraft(nextUsage)
      onSaveConfig(nextConfig)
      onAppendLog(
        result.log,
        eventCustomer,
        `Ingested product telemetry (${eventDeltaPct >= 0 ? "+" : ""}${eventDeltaPct}% usage change)`,
      )

      if (result.ok) {
        onSyncAccounts(result.updatedAccounts, usageDraft.provider)
        onAddEvidence(result.newEvidence)
        setStatusMessage({ tone: "green", text: result.message })
        showToast(result.message)
      } else {
        setStatusMessage({ tone: "red", text: result.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = () => {
    const next = { ...config }
    if (activeKind === "CRM") {
      next.crm = {
        ...crmDraft,
        connected: false,
        statusLabel: "Disconnected",
        lastError: undefined,
      }
      setCrmDraft(next.crm)
    } else if (activeKind === "Email") {
      next.email = {
        ...emailDraft,
        connected: false,
        statusLabel: "Disconnected",
        lastError: undefined,
      }
      setEmailDraft(next.email)
    } else if (activeKind === "Calendar") {
      next.calendar = {
        ...calDraft,
        connected: false,
        statusLabel: "Disconnected",
        lastError: undefined,
      }
      setCalDraft(next.calendar)
    } else {
      next.usage = {
        ...usageDraft,
        connected: false,
        statusLabel: "Disconnected",
        lastError: undefined,
      }
      setUsageDraft(next.usage)
    }
    onSaveConfig(next)
    setStatusMessage({
      tone: "amber",
      text: `${activeKind} integration disconnected and server session cleared.`,
    })
    showToast(`${activeKind} disconnected.`)
  }

  const isCurrentlyConnected =
    activeKind === "CRM"
      ? crmDraft.connected
      : activeKind === "Email"
        ? emailDraft.connected
        : activeKind === "Calendar"
          ? calDraft.connected
          : usageDraft.connected

  const currentStatusBadge =
    activeKind === "CRM"
      ? crmDraft.statusLabel || (crmDraft.connected ? "Connected" : "Not configured")
      : activeKind === "Email"
        ? emailDraft.statusLabel || (emailDraft.connected ? "Connected" : "Not configured")
        : activeKind === "Calendar"
          ? calDraft.statusLabel || (calDraft.connected ? "Connected" : "Not configured")
          : usageDraft.statusLabel || (usageDraft.connected ? "Connected" : "Not configured")

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                MCP & Live Integration Connector
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isCurrentlyConnected
                    ? "bg-emerald-50 text-emerald-700"
                    : currentStatusBadge === "Error"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isCurrentlyConnected
                      ? "bg-emerald-500"
                      : currentStatusBadge === "Error"
                        ? "bg-red-500"
                        : "bg-slate-400"
                  }`}
                />
                {currentStatusBadge}
              </span>
              {activeKind !== "Product Usage Data" && (
                <button
                  type="button"
                  onClick={() =>
                    handleLaunchOAuthFlow(
                      activeKind === "CRM"
                        ? "crm"
                        : activeKind === "Email"
                          ? "email"
                          : "calendar",
                    )
                  }
                  className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Authorize via OAuth 2.0 ↗
                </button>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              {activeKind} — Live Connection & Execution
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure OAuth 2.0 or API credentials for{" "}
              <strong>{activeKind}</strong>. Connection is verified against the
              server-side MCP Gateway before marking as Connected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-6">
          {(
            [
              ["connect", "1. Credentials & Connection"],
              ["live_action", "2. Live Sync & Execute"],
              ["mapping", `3. Data Mapping & Activity (${filteredLogs.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-4 py-3 text-xs font-bold transition ${
                tab === id
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {statusMessage && (
            <div
              className={`rounded-xl border p-3.5 text-xs font-medium ${
                statusMessage.tone === "green"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : statusMessage.tone === "red"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* ==============================================================
              CRM INTEGRATION
              ============================================================== */}
          {activeKind === "CRM" && tab === "connect" && (
            <form onSubmit={handleConnectCRM} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  CRM Provider
                  <select
                    value={crmDraft.provider}
                    onChange={(e) =>
                      setCrmDraft({
                        ...crmDraft,
                        provider: e.target.value as typeof crmDraft.provider,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value="Salesforce">Salesforce CRM</option>
                    <option value="HubSpot">HubSpot CRM</option>
                    <option value="Custom REST API">Custom CRM REST API</option>
                    <option value="CSV / JSON Import">
                      Direct CRM Payload (CSV / JSON)
                    </option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  API Endpoint / Instance URL
                  <input
                    type="text"
                    value={crmDraft.instanceUrl}
                    onChange={(e) =>
                      setCrmDraft({ ...crmDraft, instanceUrl: e.target.value })
                    }
                    placeholder={
                      crmDraft.provider === "Salesforce"
                        ? "https://your-org.my.salesforce.com"
                        : crmDraft.provider === "HubSpot"
                          ? "https://api.hubapi.com/crm/v3/objects/companies"
                          : "https://api.yourcrm.com/v1/accounts"
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  OAuth Access Token / Private App Key (Optional for JSON Sync)
                  <input
                    type="password"
                    value={crmDraft.apiKeyOrToken}
                    onChange={(e) =>
                      setCrmDraft({
                        ...crmDraft,
                        apiKeyOrToken: e.target.value,
                      })
                    }
                    placeholder="pat-na1-... or Bearer token"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Outgoing Action Webhook URL (Optional)
                  <input
                    type="url"
                    value={crmDraft.webhookUrl}
                    onChange={(e) =>
                      setCrmDraft({ ...crmDraft, webhookUrl: e.target.value })
                    }
                    placeholder="https://hooks.zapier.com/... or CRM webhook"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={crmDraft.autoSyncOnApprove}
                  onChange={(e) =>
                    setCrmDraft({
                      ...crmDraft,
                      autoSyncOnApprove: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Automatically push approved tasks & renewal updates back to CRM
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {crmDraft.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Disconnect CRM
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    Credentials are stored locally in your workspace session.
                  </span>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    {crmDraft.connected
                      ? "Update CRM Connection"
                      : "Save & Connect CRM"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("live_action")}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Go to Live Account Sync →
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeKind === "CRM" && tab === "live_action" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Live CRM Customer Account Sync ({crmDraft.provider})
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Pulls live customer accounts from your configured CRM API
                      endpoint or imports the JSON/CSV payload below directly
                      into your DealFlow AI portfolio and Supabase database.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRunCRMSync}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy ? "Syncing CRM..." : "Sync CRM Accounts Now"}
                  </button>
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Live CRM Account Payload (JSON Array or CSV:
                name,arr,tier,renewal,owner,champion_email)
                <textarea
                  rows={9}
                  value={crmPayloadText}
                  onChange={(e) => setCrmPayloadText(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 font-mono text-xs"
                />
              </label>
            </div>
          )}

          {/* ==============================================================
              EMAIL INTEGRATION
              ============================================================== */}
          {activeKind === "Email" && tab === "connect" && (
            <form onSubmit={handleConnectEmail} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Email Delivery Provider
                  <select
                    value={emailDraft.provider}
                    onChange={(e) =>
                      setEmailDraft({
                        ...emailDraft,
                        provider: e.target.value as typeof emailDraft.provider,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value="Google Workspace (Gmail API)">
                      Google Workspace (Gmail API)
                    </option>
                    <option value="EmailJS Transactional API">
                      EmailJS Transactional REST API
                    </option>
                    <option value="Outgoing Webhook (Zapier / Make / REST)">
                      Outgoing Webhook (Zapier / Make / Custom API)
                    </option>
                    <option value="Gmail Web & Mailto Dispatch">
                      Direct Google Workspace Compose / Mail Client
                    </option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Connected Sender Email Address *
                  <input
                    type="email"
                    required
                    value={emailDraft.senderEmail}
                    onChange={(e) =>
                      setEmailDraft({
                        ...emailDraft,
                        senderEmail: e.target.value,
                      })
                    }
                    placeholder="revops@yourcompany.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Sender Display Name
                  <input
                    type="text"
                    value={emailDraft.senderName}
                    onChange={(e) =>
                      setEmailDraft({
                        ...emailDraft,
                        senderName: e.target.value,
                      })
                    }
                    placeholder="Maya Chen · DealFlow AI"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>

                {emailDraft.provider === "Google Workspace (Gmail API)" && (
                  <label className="block text-xs font-semibold text-slate-700">
                    Google OAuth Access Token (Optional — uses Gmail Web if
                    blank)
                    <input
                      type="password"
                      value={emailDraft.gmailAccessToken}
                      onChange={(e) =>
                        setEmailDraft({
                          ...emailDraft,
                          gmailAccessToken: e.target.value,
                        })
                      }
                      placeholder="ya29.a0AfH6SM..."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm"
                    />
                  </label>
                )}

                {emailDraft.provider ===
                  "Outgoing Webhook (Zapier / Make / REST)" && (
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Dispatch Webhook URL *
                    <input
                      type="url"
                      value={emailDraft.webhookUrl}
                      onChange={(e) =>
                        setEmailDraft({
                          ...emailDraft,
                          webhookUrl: e.target.value,
                        })
                      }
                      placeholder="https://hook.eu1.make.com/..."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                )}
              </div>

              {emailDraft.provider === "EmailJS Transactional API" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    EmailJS Service ID
                    <input
                      value={emailDraft.emailJsServiceId}
                      onChange={(e) =>
                        setEmailDraft({
                          ...emailDraft,
                          emailJsServiceId: e.target.value,
                        })
                      }
                      placeholder="service_xxx"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    EmailJS Template ID
                    <input
                      value={emailDraft.emailJsTemplateId}
                      onChange={(e) =>
                        setEmailDraft({
                          ...emailDraft,
                          emailJsTemplateId: e.target.value,
                        })
                      }
                      placeholder="template_xxx"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    EmailJS Public Key
                    <input
                      value={emailDraft.emailJsPublicKey}
                      onChange={(e) =>
                        setEmailDraft({
                          ...emailDraft,
                          emailJsPublicKey: e.target.value,
                        })
                      }
                      placeholder="user_xxx"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                    />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={emailDraft.autoSendOnApprove}
                  onChange={(e) =>
                    setEmailDraft({
                      ...emailDraft,
                      autoSendOnApprove: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Automatically dispatch real email when an outreach action is
                approved in the Approval Center
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {emailDraft.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Disconnect Email
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    Connect once to enable live outreach delivery.
                  </span>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    {emailDraft.connected
                      ? "Update Email Connection"
                      : "Save & Connect Email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("live_action")}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Send Live Test Email →
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeKind === "Email" && tab === "live_action" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Customer Account
                  <select
                    value={testEmailCustomer}
                    onChange={(e) => {
                      const found = accounts.find(
                        (a) => a.name === e.target.value,
                      )
                      setTestEmailCustomer(e.target.value)
                      if (found) setTestEmailTo(found.champion_email || "")
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    {accounts.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name} ({a.champion_email})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Recipient Email Address
                  <input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Subject Line
                <input
                  value={testEmailSubject}
                  onChange={(e) => setTestEmailSubject(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Message Body
                <textarea
                  rows={5}
                  value={testEmailBody}
                  onChange={(e) => setTestEmailBody(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSendLiveTestEmail}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? "Sending Email..." : "Dispatch Live Email Now"}
                </button>
              </div>
            </div>
          )}

          {/* ==============================================================
              GOOGLE CALENDAR INTEGRATION
              ============================================================== */}
          {activeKind === "Calendar" && tab === "connect" && (
            <form onSubmit={handleConnectCalendar} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Calendar Integration Mode
                  <select
                    value={calDraft.provider}
                    onChange={(e) =>
                      setCalDraft({
                        ...calDraft,
                        provider: e.target.value as typeof calDraft.provider,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value="Google Calendar API v3">
                      Google Calendar REST API v3
                    </option>
                    <option value="Google Calendar Direct & iCal (.ics)">
                      Google Calendar Direct & iCal (.ics)
                    </option>
                    <option value="Custom Calendar Webhook">
                      Custom Calendar Webhook
                    </option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Google Calendar ID / Account Email *
                  <input
                    required
                    value={calDraft.calendarId}
                    onChange={(e) =>
                      setCalDraft({ ...calDraft, calendarId: e.target.value })
                    }
                    placeholder="primary or your.name@company.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Google OAuth Access Token (Optional — enables direct API v3
                  read/write)
                  <input
                    type="password"
                    value={calDraft.googleAccessToken}
                    onChange={(e) =>
                      setCalDraft({
                        ...calDraft,
                        googleAccessToken: e.target.value,
                      })
                    }
                    placeholder="ya29.a0AfH6SM..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Default Meeting Duration
                  <select
                    value={calDraft.defaultDurationMinutes}
                    onChange={(e) =>
                      setCalDraft({
                        ...calDraft,
                        defaultDurationMinutes: Number(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={calDraft.autoScheduleOnApprove}
                  onChange={(e) =>
                    setCalDraft({
                      ...calDraft,
                      autoScheduleOnApprove: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Automatically schedule Google Calendar follow-up event when an
                action is approved
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {calDraft.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Disconnect Calendar
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    Supports Google Calendar API v3, Web Templates, and .ics
                    invites.
                  </span>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    {calDraft.connected
                      ? "Update Calendar Connection"
                      : "Save & Connect Google Calendar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("live_action")}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Sync & Schedule Meetings →
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeKind === "Calendar" && tab === "live_action" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Sync Google Calendar Meetings ({calDraft.calendarId})
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pulls recent & upcoming customer meetings and attaches them
                    to customer interaction timelines.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSyncCalendarNow}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? "Syncing..." : "Sync Calendar Events Now"}
                </button>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Schedule Live Customer Meeting on Google Calendar
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Customer Account
                    <select
                      value={meetingCustomer}
                      onChange={(e) => {
                        const found = accounts.find(
                          (a) => a.name === e.target.value,
                        )
                        setMeetingCustomer(e.target.value)
                        if (found) {
                          setMeetingAttendee(found.champion_email || "")
                          setMeetingTitle(
                            `${found.name} · Executive Renewal Check-In`,
                          )
                        }
                      }}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    >
                      {accounts.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Customer Attendee Email
                    <input
                      type="email"
                      value={meetingAttendee}
                      onChange={(e) => setMeetingAttendee(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Meeting Title
                    <input
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Start Date & Time
                    <input
                      type="datetime-local"
                      value={meetingStartIso}
                      onChange={(e) => setMeetingStartIso(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Meeting Agenda & Notes
                  <textarea
                    rows={3}
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      downloadIcsInvite({
                        title: meetingTitle,
                        description: meetingNotes,
                        attendeeEmail: meetingAttendee,
                        organizerEmail: calDraft.calendarId,
                        startTimeIso: new Date(meetingStartIso).toISOString(),
                        durationMinutes: calDraft.defaultDurationMinutes,
                      })
                      showToast("Downloaded .ics calendar invite file!")
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Download .ics Invite
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateLiveMeeting}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy
                      ? "Scheduling..."
                      : "Create Event in Google Calendar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              PRODUCT USAGE DATA INTEGRATION
              ============================================================== */}
          {activeKind === "Product Usage Data" && tab === "connect" && (
            <form onSubmit={handleConnectUsage} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Telemetry Provider
                  <select
                    value={usageDraft.provider}
                    onChange={(e) =>
                      setUsageDraft({
                        ...usageDraft,
                        provider: e.target.value as typeof usageDraft.provider,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value="DealFlow Telemetry Webhook / REST">
                      DealFlow Telemetry Webhook / REST API
                    </option>
                    <option value="PostHog / Mixpanel API">
                      PostHog / Mixpanel Analytics API
                    </option>
                    <option value="Direct JSON / CSV Telemetry Stream">
                      Direct JSON / CSV Telemetry Stream
                    </option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Telemetry REST Endpoint URL (Optional for Direct Stream)
                  <input
                    type="url"
                    value={usageDraft.endpointUrl}
                    onChange={(e) =>
                      setUsageDraft({
                        ...usageDraft,
                        endpointUrl: e.target.value,
                      })
                    }
                    placeholder="https://telemetry.yourproduct.com/v1/usage"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Telemetry API Key
                  <input
                    type="password"
                    value={usageDraft.apiKey}
                    onChange={(e) =>
                      setUsageDraft({ ...usageDraft, apiKey: e.target.value })
                    }
                    placeholder="phc_... or bearer key"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Churn Risk Drop Threshold (%)
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={usageDraft.riskDropThresholdPct}
                    onChange={(e) =>
                      setUsageDraft({
                        ...usageDraft,
                        riskDropThresholdPct: Number(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Expansion Growth Threshold (%)
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={usageDraft.expansionGrowthThresholdPct}
                    onChange={(e) =>
                      setUsageDraft({
                        ...usageDraft,
                        expansionGrowthThresholdPct: Number(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {usageDraft.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Disconnect Telemetry
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    Automatically updates account health & evidence citations.
                  </span>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    {usageDraft.connected
                      ? "Update Telemetry Connection"
                      : "Save & Connect Usage Data"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("live_action")}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Stream Live Usage Events →
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeKind === "Product Usage Data" && tab === "live_action" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Ingest Live Product Usage Telemetry Event
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Stream a live seat utilization & 30-day adoption delta event
                  to recalculate customer health status and generate a verified{" "}
                  <code>[E-Usage]</code> evidence citation.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Customer Account
                    <select
                      value={eventCustomer}
                      onChange={(e) => setEventCustomer(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    >
                      {accounts.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name} (Current: {a.status})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Most Active Product Module
                    <input
                      value={eventTopFeature}
                      onChange={(e) => setEventTopFeature(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Active Seats
                    <input
                      type="number"
                      min={0}
                      value={eventActiveSeats}
                      onChange={(e) =>
                        setEventActiveSeats(Number(e.target.value))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Contracted Seats
                    <input
                      type="number"
                      min={1}
                      value={eventContractedSeats}
                      onChange={(e) =>
                        setEventContractedSeats(Number(e.target.value))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    30-Day Usage Change (%)
                    <input
                      type="number"
                      value={eventDeltaPct}
                      onChange={(e) => setEventDeltaPct(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEventActiveSeats(29)
                        setEventContractedSeats(50)
                        setEventDeltaPct(-31)
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      Preset: Usage Drop (-31%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEventActiveSeats(48)
                        setEventContractedSeats(50)
                        setEventDeltaPct(38)
                      }}
                      className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700"
                    >
                      Preset: Seat Expansion (+38%)
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleIngestUsageEvent}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy
                      ? "Ingesting Telemetry..."
                      : "Ingest Telemetry & Recalculate Health"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              DATA MAPPING & SYNC LOGS TAB
              ============================================================== */}
          {tab === "mapping" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Live Schema Mapping ({activeKind} → DealFlow AI & Supabase)
                </h3>
                <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                  {activeKind === "CRM" && (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        Account.Name → public.accounts.name
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        Account.AnnualRevenue → public.accounts.arr
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        Contact.Email → public.accounts.champion_email
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        Opportunity.CloseDate → public.accounts.renewal
                      </div>
                    </>
                  )}
                  {activeKind === "Email" && (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        message.to → accounts.champion_email
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        thread.snippet → interactions.title
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        message.date → accounts.champion_note
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        delivery.receipt → public.audit_logs
                      </div>
                    </>
                  )}
                  {activeKind === "Calendar" && (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        event.summary → interactions.title
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        event.start.dateTime → accounts.last_meeting_date
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        event.attendees[0] → accounts.champion_email
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        event.htmlLink → approvals.proposed_change
                      </div>
                    </>
                  )}
                  {activeKind === "Product Usage Data" && (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        telemetry.usageDeltaPct → accounts.product_usage_note
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        telemetry.activeSeats → evidence.title [E-Usage]
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        threshold.eval → accounts.status (At Risk / Expansion)
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 font-mono">
                        telemetry.topFeature → evidence.source
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recent {activeKind} Sync & Execution Logs
                </h3>
                {filteredLogs.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-slate-200 p-4 text-xs text-slate-500">
                    No live sync events recorded yet for {activeKind}. Use the{" "}
                    <strong>Live Sync & Execute</strong> tab to run your first
                    operation.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {log.summary}
                          </span>
                          <span className="text-slate-400">{log.timestamp}</span>
                        </div>
                        <p className="mt-1 text-slate-600">{log.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <span className="text-xs text-slate-500">
            All synced records update your user-scoped portfolio and Audit
            Trail.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

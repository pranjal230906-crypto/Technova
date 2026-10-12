import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_APPROVALS,
  DEFAULT_AUDIT_LOGS,
  DEFAULT_EVIDENCE,
  DEFAULT_INTERACTIONS,
  DEFAULT_RISKS_OPPORTUNITIES,
  type AccountRecord,
  type ApprovalRecord,
  type AuditLogRecord,
  type EvidenceRecord,
  type InteractionRecord,
  type RiskOpportunityRecord,
} from "../../src/lib/supabase.ts"
import {
  computeApprovalPayloadHash,
  decryptSecret,
  encryptSecret,
  redactForLogs,
} from "../security/security.ts"

export interface AuthContext {
  userId: string
  userEmail?: string
  userName?: string
  workspaceId: string
  role?: string
  allowedAccounts?: string[] // If specified, restricts user to these accounts only
}

export type IntegrationConnectionStatus =
  | "Not configured"
  | "Connecting"
  | "Connected"
  | "Syncing"
  | "Disconnected"
  | "Error"

export type IntegrationKey = "crm" | "email" | "calendar" | "usage" | "dealflow_mcp"

export interface StoredMcpConnection {
  id: string
  workspaceId: string
  userId: string
  integrationKey: IntegrationKey
  provider: string
  serverUrl?: string
  authType: "oauth2" | "api_key" | "mcp_remote" | "internal"
  status: IntegrationConnectionStatus
  encryptedAccessToken?: string
  encryptedRefreshToken?: string
  tokenExpiresAt?: string
  scopes: string[]
  externalAccountId?: string
  syncCursor?: string
  lastSyncedAt?: string
  lastTestAt?: string
  lastError?: string
  metadata: Record<string, unknown>
  updatedAt: string
}

export interface ProductUsageEventRecord {
  id: string
  event_id: string
  idempotency_key: string
  workspace_id: string
  account_name: string
  event_type:
    | "user_login"
    | "session_started"
    | "feature_used"
    | "subscription_activity"
  actor_email?: string
  feature_name?: string
  active_seats?: number
  contracted_seats?: number
  usage_delta_pct?: number
  metadata: Record<string, unknown>
  occurred_at: string
  ingested_at: string
}

export interface ExtendedApprovalRecord extends ApprovalRecord {
  intended_operation: string
  payload_hash: string
  idempotency_key: string
  creator_user_id: string
  workspace_id: string
  approved_at?: string
  executed_at?: string
  execution_result?: string
}

export interface McpToolInvocationLog {
  id: string
  request_id: string
  workspace_id: string
  user_id: string
  server_id: string
  tool_name: string
  redacted_arguments: unknown
  status: "success" | "error" | "denied" | "timeout"
  duration_ms: number
  error_message?: string
  result_summary?: string
  created_at: string
}

export interface SavedAIInsightRecord {
  id: string
  workspace_id: string
  user_id: string
  account_name: string
  risk_level: string
  confidence_score: number
  summary: string
  why_it_matters: string
  suggested_next_step: string
  evidence_refs: string[]
  tool_calls_used: string[]
  created_at: string
}

function getServerSupabaseClient(): SupabaseClient | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim()

  if (!url || !key || url.includes("your-project-ref") || !url.startsWith("http")) {
    return null
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

class BackendDataStore {
  private accounts: (AccountRecord & {
    workspace_id: string
    external_crm_id?: string
    email_domain?: string
  })[] = DEFAULT_ACCOUNTS.map((a, idx) => ({
    ...a,
    workspace_id: "ws_default",
    external_crm_id: `001Dn00000Acct0${idx + 1}`,
    email_domain:
      a.champion_email?.split("@")[1] ||
      `${a.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.example`,
  }))

  private evidence: EvidenceRecord[] = [...DEFAULT_EVIDENCE]
  private interactions: InteractionRecord[] = [...DEFAULT_INTERACTIONS]
  private risksOpportunities: RiskOpportunityRecord[] = [
    ...DEFAULT_RISKS_OPPORTUNITIES,
  ]
  private approvals: ExtendedApprovalRecord[] = DEFAULT_APPROVALS.map((ap) => {
    const op = ap.action.toLowerCase().includes("email")
      ? "send_customer_email"
      : ap.action.toLowerCase().includes("schedule")
        ? "create_calendar_meeting"
        : ap.action.toLowerCase().includes("field")
          ? "update_crm_field"
          : "create_followup_task"
    return {
      ...ap,
      intended_operation: op,
      workspace_id: "ws_default",
      creator_user_id: "usr_system_seed",
      idempotency_key: `seed_${ap.id}`,
      payload_hash: computeApprovalPayloadHash({
        customer: ap.customer,
        action: ap.action,
        intendedOperation: op,
        proposedChange: ap.proposed_change,
        recipientEmail: ap.recipient_email,
        emailSubject: ap.email_subject,
        emailBody: ap.email_body,
      }),
    }
  })

  private auditLogs: AuditLogRecord[] = [...DEFAULT_AUDIT_LOGS]
  private toolInvocations: McpToolInvocationLog[] = []
  private aiInsights: SavedAIInsightRecord[] = []
  private connections = new Map<string, StoredMcpConnection>()
  private productEvents: ProductUsageEventRecord[] = [
    {
      id: "pe_1",
      event_id: "evt_acme_001",
      idempotency_key: "idem_acme_001",
      workspace_id: "ws_default",
      account_name: "Acme Corporation",
      event_type: "subscription_activity",
      actor_email: "alex.morgan@acme.example",
      feature_name: "Analytics Dashboard",
      active_seats: 18,
      contracted_seats: 25,
      usage_delta_pct: -28,
      metadata: { note: "Weekly active seats declined 28% this month" },
      occurred_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      ingested_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "pe_2",
      event_id: "evt_acme_002",
      idempotency_key: "idem_acme_002",
      workspace_id: "ws_default",
      account_name: "Acme Corporation",
      event_type: "feature_used",
      actor_email: "alex.morgan@acme.example",
      feature_name: "Cohort Export",
      active_seats: 18,
      contracted_seats: 25,
      usage_delta_pct: -28,
      metadata: { sessions: 4 },
      occurred_at: new Date(Date.now() - 86400000).toISOString(),
      ingested_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "pe_3",
      event_id: "evt_nova_001",
      idempotency_key: "idem_nova_001",
      workspace_id: "ws_default",
      account_name: "NovaTech",
      event_type: "subscription_activity",
      actor_email: "taylor.reed@novatech.example",
      feature_name: "Workflow Automation",
      active_seats: 47,
      contracted_seats: 50,
      usage_delta_pct: 34,
      metadata: { note: "Team adoption up 34% QoQ" },
      occurred_at: new Date(Date.now() - 43200000).toISOString(),
      ingested_at: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: "pe_4",
      event_id: "evt_bright_001",
      idempotency_key: "idem_bright_001",
      workspace_id: "ws_default",
      account_name: "BrightPath",
      event_type: "user_login",
      actor_email: "sam.patel@brightpath.example",
      feature_name: "Core Workspace",
      active_seats: 32,
      contracted_seats: 35,
      usage_delta_pct: 12,
      metadata: { note: "91% weekly active seats" },
      occurred_at: new Date(Date.now() - 21600000).toISOString(),
      ingested_at: new Date(Date.now() - 21600000).toISOString(),
    },
  ]

  constructor() {
    this.initializeDefaultConnections("ws_default", "usr_maya_chen")
  }

  public initializeDefaultConnections(workspaceId: string, userId: string) {
    const defaults: Array<{
      key: IntegrationKey
      provider: string
      authType: "oauth2" | "api_key" | "mcp_remote" | "internal"
      status: IntegrationConnectionStatus
    }> = [
      {
        key: "dealflow_mcp",
        provider: "DealFlow AI Custom MCP Server",
        authType: "internal",
        status: "Connected",
      },
      {
        key: "crm",
        provider: "Salesforce",
        authType: "oauth2",
        status: "Not configured",
      },
      {
        key: "email",
        provider: "Google Workspace (Gmail)",
        authType: "oauth2",
        status: "Not configured",
      },
      {
        key: "calendar",
        provider: "Google Calendar",
        authType: "oauth2",
        status: "Not configured",
      },
      {
        key: "usage",
        provider: "DealFlow Events Ingestion API",
        authType: "api_key",
        status: "Not configured",
      },
    ]

    for (const item of defaults) {
      const mapKey = `${workspaceId}::${userId}::${item.key}`
      if (!this.connections.has(mapKey)) {
        this.connections.set(mapKey, {
          id: `conn_${item.key}_${userId}`,
          workspaceId,
          userId,
          integrationKey: item.key,
          provider: item.provider,
          authType: item.authType,
          status: item.status,
          scopes: [],
          metadata: {},
          updatedAt: new Date().toISOString(),
        })
      }
    }
  }

  /**
   * Validates that the caller is authenticated and authorized to access the workspace & target account.
   */
  public assertAuthenticated(auth?: Partial<AuthContext> | null): AuthContext {
    if (!auth || !auth.userId || !auth.userId.trim()) {
      throw new Error("Unauthorized (401): Missing authenticated user session")
    }
    const workspaceId = (auth.workspaceId || "ws_default").trim()
    if (workspaceId !== "ws_default") {
      throw new Error(
        `Access Denied (403): User "${auth.userId}" is not authorized for workspace "${workspaceId}"`,
      )
    }
    return {
      userId: auth.userId.trim(),
      userEmail: auth.userEmail,
      userName: auth.userName || "Authorized Operator",
      workspaceId,
      role: auth.role || "RevOps Operator",
      allowedAccounts: auth.allowedAccounts,
    }
  }

  public assertAccountAccess(
    auth: Partial<AuthContext> | null | undefined,
    accountName: string,
  ): AccountRecord & {
    workspace_id: string
    external_crm_id?: string
    email_domain?: string
  } {
    const verifiedAuth = this.assertAuthenticated(auth)
    const normalized = (accountName || "").trim()
    if (!normalized) {
      throw new Error("Validation Error: account_name is required")
    }

    if (
      Array.isArray(verifiedAuth.allowedAccounts) &&
      verifiedAuth.allowedAccounts.length > 0 &&
      !verifiedAuth.allowedAccounts.some(
        (a) => a.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      throw new Error(
        `Access Denied (403): User "${verifiedAuth.userId}" is not permitted to access customer account "${normalized}"`,
      )
    }

    const account = this.accounts.find(
      (a) =>
        a.name.toLowerCase() === normalized.toLowerCase() &&
        a.workspace_id === verifiedAuth.workspaceId,
    )
    if (!account) {
      throw new Error(
        `Not Found / Access Denied (404): Account "${normalized}" does not exist in workspace "${verifiedAuth.workspaceId}"`,
      )
    }
    return account
  }

  public getAccounts(auth: Partial<AuthContext>) {
    const verified = this.assertAuthenticated(auth)
    return this.accounts.filter((a) => {
      if (a.workspace_id !== verified.workspaceId) return false
      if (
        verified.allowedAccounts &&
        verified.allowedAccounts.length > 0 &&
        !verified.allowedAccounts.some(
          (allowed) => allowed.toLowerCase() === a.name.toLowerCase(),
        )
      ) {
        return false
      }
      return true
    })
  }

  public upsertAccount(
    auth: Partial<AuthContext>,
    account: AccountRecord & { external_crm_id?: string; email_domain?: string },
  ) {
    const verified = this.assertAuthenticated(auth)
    const idx = this.accounts.findIndex(
      (a) => a.name.toLowerCase() === account.name.toLowerCase(),
    )
    const record = {
      ...account,
      workspace_id: verified.workspaceId,
      external_crm_id:
        account.external_crm_id ||
        (idx >= 0 ? this.accounts[idx].external_crm_id : `001Dn00000${Date.now().toString().slice(-6)}`),
      email_domain:
        account.email_domain ||
        account.champion_email?.split("@")[1] ||
        `${account.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.example`,
    }
    if (idx >= 0) {
      this.accounts[idx] = record
    } else {
      this.accounts.unshift(record)
    }

    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("accounts")
        .upsert([account], { onConflict: "name" })
        .then(() => null, () => null)
    }
    return record
  }

  public getEvidenceForAccount(auth: Partial<AuthContext>, accountName: string) {
    const account = this.assertAccountAccess(auth, accountName)
    return this.evidence.filter(
      (e) =>
        !e.account_name ||
        e.account_name.toLowerCase() === account.name.toLowerCase(),
    )
  }

  public getAllEvidence(auth: Partial<AuthContext>) {
    this.assertAuthenticated(auth)
    return [...this.evidence]
  }

  public addEvidence(auth: Partial<AuthContext>, item: EvidenceRecord) {
    this.assertAccountAccess(auth, item.account_name)
    const existsIdx = this.evidence.findIndex(
      (e) =>
        e.code === item.code &&
        e.account_name.toLowerCase() === item.account_name.toLowerCase(),
    )
    if (existsIdx >= 0) {
      this.evidence[existsIdx] = item
    } else {
      this.evidence.unshift(item)
    }
    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("evidence")
        .insert([item])
        .then(() => null, () => null)
    }
    return item
  }

  public getInteractionsForAccount(
    auth: Partial<AuthContext>,
    accountName: string,
  ) {
    const account = this.assertAccountAccess(auth, accountName)
    return this.interactions.filter(
      (i) =>
        !i.account_name ||
        i.account_name.toLowerCase() === account.name.toLowerCase(),
    )
  }

  public addInteraction(auth: Partial<AuthContext>, item: InteractionRecord) {
    this.assertAccountAccess(auth, item.account_name)
    this.interactions.unshift(item)
    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("interactions")
        .insert([item])
        .then(() => null, () => null)
    }
    return item
  }

  public getRisksOpportunities(auth: Partial<AuthContext>) {
    this.assertAuthenticated(auth)
    return [...this.risksOpportunities]
  }

  /**
   * Matches an external email address or domain to a verified internal DealFlow AI account.
   */
  public matchAccountByEmailOrDomain(
    emailOrText: string,
  ): (AccountRecord & { external_crm_id?: string; email_domain?: string }) | null {
    const lower = (emailOrText || "").toLowerCase()
    for (const acc of this.accounts) {
      if (acc.champion_email && lower.includes(acc.champion_email.toLowerCase())) {
        return acc
      }
      if (acc.email_domain && lower.includes(acc.email_domain.toLowerCase())) {
        return acc
      }
      if (lower.includes(acc.name.toLowerCase())) {
        return acc
      }
    }
    return null
  }

  /**
   * Ingests a product usage event with schema validation & duplicate prevention.
   */
  public ingestProductUsageEvent(
    auth: Partial<AuthContext>,
    input: {
      event_id: string
      idempotency_key?: string
      account_name: string
      event_type:
        | "user_login"
        | "session_started"
        | "feature_used"
        | "subscription_activity"
      actor_email?: string
      feature_name?: string
      active_seats?: number
      contracted_seats?: number
      usage_delta_pct?: number
      metadata?: Record<string, unknown>
      occurred_at?: string
    },
  ): {
    created: boolean
    duplicate: boolean
    event: ProductUsageEventRecord
    updatedAccount: AccountRecord
  } {
    const verified = this.assertAuthenticated(auth)
    const account = this.assertAccountAccess(verified, input.account_name)

    const validTypes = new Set([
      "user_login",
      "session_started",
      "feature_used",
      "subscription_activity",
    ])
    if (!validTypes.has(input.event_type)) {
      throw new Error(
        `Validation Error: Invalid event_type "${input.event_type}". Allowed: user_login, session_started, feature_used, subscription_activity`,
      )
    }

    const eventId = (input.event_id || "").trim()
    if (!eventId) {
      throw new Error("Validation Error: event_id is required")
    }
    const idemKey = (input.idempotency_key || `idem_${eventId}`).trim()

    // Check duplicate by event_id or idempotency_key
    const existing = this.productEvents.find(
      (e) => e.event_id === eventId || e.idempotency_key === idemKey,
    )
    if (existing) {
      return {
        created: false,
        duplicate: true,
        event: existing,
        updatedAccount: account,
      }
    }

    const nowIso = new Date().toISOString()
    const newEvent: ProductUsageEventRecord = {
      id: `pe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: eventId,
      idempotency_key: idemKey,
      workspace_id: verified.workspaceId,
      account_name: account.name,
      event_type: input.event_type,
      actor_email: input.actor_email,
      feature_name: input.feature_name || "Core Platform",
      active_seats: input.active_seats,
      contracted_seats: input.contracted_seats,
      usage_delta_pct: input.usage_delta_pct,
      metadata: input.metadata || {},
      occurred_at: input.occurred_at || nowIso,
      ingested_at: nowIso,
    }

    this.productEvents.unshift(newEvent)

    // Update account usage signal if active_seats/contracted_seats or usage_delta_pct provided
    if (
      typeof input.usage_delta_pct === "number" ||
      (typeof input.active_seats === "number" &&
        typeof input.contracted_seats === "number" &&
        input.contracted_seats > 0)
    ) {
      const utilizationPct =
        typeof input.active_seats === "number" &&
        typeof input.contracted_seats === "number" &&
        input.contracted_seats > 0
          ? Math.round((input.active_seats / input.contracted_seats) * 100)
          : undefined
      const delta = input.usage_delta_pct ?? 0

      if (delta <= -20 || (utilizationPct !== undefined && utilizationPct < 50)) {
        account.status = "At Risk"
        account.tone = "red"
        account.product_usage = "Declining"
        account.product_usage_note =
          delta < 0
            ? `Down ${Math.abs(delta)}% (${utilizationPct ?? 60}% seat utilization)`
            : `${utilizationPct}% seat utilization`
        account.signal = `Usage declined ${Math.abs(delta || 25)}% · ${input.feature_name || "Core"}`
      } else if (
        delta >= 20 ||
        (utilizationPct !== undefined && utilizationPct >= 85)
      ) {
        account.status = "Expansion Opportunity"
        account.tone = "blue"
        account.product_usage = "Expanding"
        account.product_usage_note = `${utilizationPct ?? 90}% seat utilization (+${Math.max(delta, 15)}%)`
        account.signal = `Seat utilization at ${utilizationPct ?? 90}% · expansion trigger`
      }
    }

    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("product_events")
        .insert([
          {
            event_id: newEvent.event_id,
            idempotency_key: newEvent.idempotency_key,
            workspace_id: newEvent.workspace_id,
            account_name: newEvent.account_name,
            event_type: newEvent.event_type,
            actor_email: newEvent.actor_email,
            feature_name: newEvent.feature_name,
            active_seats: newEvent.active_seats,
            contracted_seats: newEvent.contracted_seats,
            usage_delta_pct: newEvent.usage_delta_pct,
            metadata: newEvent.metadata,
            occurred_at: newEvent.occurred_at,
          },
        ])
        .then(() => null, () => null)
    }

    return {
      created: true,
      duplicate: false,
      event: newEvent,
      updatedAccount: account,
    }
  }

  public getProductUsageForAccount(
    auth: Partial<AuthContext>,
    accountName: string,
    limit = 20,
  ) {
    const account = this.assertAccountAccess(auth, accountName)
    const events = this.productEvents
      .filter((e) => e.account_name.toLowerCase() === account.name.toLowerCase())
      .slice(0, Math.min(Math.max(1, limit), 100))

    const latestWithSeats = events.find(
      (e) =>
        typeof e.active_seats === "number" &&
        typeof e.contracted_seats === "number",
    )
    const seatUtilizationPct =
      latestWithSeats &&
      latestWithSeats.contracted_seats &&
      latestWithSeats.contracted_seats > 0
        ? Math.round(
            ((latestWithSeats.active_seats || 0) /
              latestWithSeats.contracted_seats) *
              100,
          )
        : undefined

    return {
      account_name: account.name,
      product_usage_status: account.product_usage || "Monitored",
      product_usage_note: account.product_usage_note || account.signal,
      seat_utilization_pct: seatUtilizationPct,
      total_events: events.length,
      events,
    }
  }

  /**
   * Creates a PENDING proposal only. Never executes external actions directly.
   */
  public proposeFollowupTask(
    auth: Partial<AuthContext>,
    input: {
      customer: string
      action: string
      owner?: string
      refs: string
      proposed_change: string
      description: string
      intended_operation?:
        | "create_followup_task"
        | "send_customer_email"
        | "create_calendar_meeting"
        | "update_crm_field"
      priority_label?: string
      priority_tone?: "red" | "green" | "blue" | "amber" | "neutral"
      recipient_email?: string
      email_subject?: string
      email_body?: string
      idempotency_key?: string
    },
  ): { created: boolean; duplicate: boolean; proposal: ExtendedApprovalRecord } {
    const verified = this.assertAuthenticated(auth)
    const account = this.assertAccountAccess(verified, input.customer)

    if (!input.action || !input.action.trim()) {
      throw new Error("Validation Error: action title is required")
    }
    if (!input.refs || !input.refs.trim()) {
      throw new Error(
        "Validation Error: evidence references (refs) are required for every proposed action",
      )
    }

    const intendedOp = input.intended_operation || "create_followup_task"
    const payloadHash = computeApprovalPayloadHash({
      customer: account.name,
      action: input.action,
      intendedOperation: intendedOp,
      proposedChange: input.proposed_change,
      recipientEmail: input.recipient_email,
      emailSubject: input.email_subject,
      emailBody: input.email_body,
    })

    const idemKey = (
      input.idempotency_key || `prop_${account.name}_${payloadHash.slice(0, 16)}`
    ).trim()

    const existing = this.approvals.find(
      (a) =>
        a.idempotency_key === idemKey ||
        (a.payload_hash === payloadHash && a.status === "pending"),
    )
    if (existing) {
      return { created: false, duplicate: true, proposal: existing }
    }

    const proposal: ExtendedApprovalRecord = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      customer: account.name,
      action: input.action.trim(),
      owner: (input.owner || account.owner || "Maya Chen").trim(),
      refs: input.refs.trim(),
      current_data: account.followup_note || "No open task",
      proposed_change: input.proposed_change.trim(),
      priority_label: input.priority_label || "High priority",
      priority_tone: input.priority_tone || "amber",
      description: input.description.trim(),
      status: "pending", // STRICT: Always created as pending, never auto-approved
      submitted_label: "Just now",
      recipient_email: input.recipient_email,
      email_subject: input.email_subject,
      email_body: input.email_body,
      intended_operation: intendedOp,
      payload_hash: payloadHash,
      idempotency_key: idemKey,
      creator_user_id: verified.userId,
      workspace_id: verified.workspaceId,
    }

    this.approvals.unshift(proposal)

    this.appendAuditLog(verified, {
      customer: account.name,
      action: proposal.action,
      decision_by: "Pending human review",
      status: "Awaiting approval",
      refs: proposal.refs,
      details: `Proposed via DealFlow MCP (${intendedOp}) · Payload Hash ${payloadHash.slice(0, 12)}`,
    })

    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("approvals")
        .insert([
          {
            customer: proposal.customer,
            action: proposal.action,
            owner: proposal.owner,
            refs: proposal.refs,
            current_data: proposal.current_data,
            proposed_change: proposal.proposed_change,
            priority_label: proposal.priority_label,
            priority_tone: proposal.priority_tone,
            description: proposal.description,
            status: "pending",
            submitted_label: proposal.submitted_label,
            recipient_email: proposal.recipient_email,
            email_subject: proposal.email_subject,
            email_body: proposal.email_body,
            intended_operation: proposal.intended_operation,
            payload_hash: proposal.payload_hash,
            idempotency_key: proposal.idempotency_key,
            creator_user_id: proposal.creator_user_id,
          },
        ])
        .then(() => null, () => null)
    }

    return { created: true, duplicate: false, proposal }
  }

  public getPendingActions(
    auth: Partial<AuthContext>,
    customerFilter?: string,
  ): ExtendedApprovalRecord[] {
    const verified = this.assertAuthenticated(auth)
    if (customerFilter && customerFilter.trim()) {
      this.assertAccountAccess(verified, customerFilter)
    }
    return this.approvals.filter((a) => {
      if (a.workspace_id !== verified.workspaceId) return false
      if (a.status !== "pending") return false
      if (
        customerFilter &&
        customerFilter.trim() &&
        a.customer.toLowerCase() !== customerFilter.trim().toLowerCase()
      ) {
        return false
      }
      return true
    })
  }

  public getAllApprovals(auth: Partial<AuthContext>): ExtendedApprovalRecord[] {
    const verified = this.assertAuthenticated(auth)
    return this.approvals.filter((a) => a.workspace_id === verified.workspaceId)
  }

  /**
   * Records an authenticated human reviewer's approval or rejection decision.
   * Binds the approval to the exact payload_hash.
   */
  public decideApproval(
    auth: Partial<AuthContext>,
    params: {
      approvalId: string
      decision: "approved" | "rejected"
      expectedPayloadHash?: string
      rejectionReason?: string
    },
  ): ExtendedApprovalRecord {
    const verified = this.assertAuthenticated(auth)
    const item = this.approvals.find(
      (a) => a.id === params.approvalId && a.workspace_id === verified.workspaceId,
    )
    if (!item) {
      throw new Error(`Approval record "${params.approvalId}" not found`)
    }
    this.assertAccountAccess(verified, item.customer)

    if (item.executed_at) {
      throw new Error(
        `Idempotency Error: Approval "${params.approvalId}" has already been executed at ${item.executed_at}`,
      )
    }

    // Verify payload hash integrity if provided
    const currentHash = computeApprovalPayloadHash({
      customer: item.customer,
      action: item.action,
      intendedOperation: item.intended_operation,
      proposedChange: item.proposed_change,
      recipientEmail: item.recipient_email,
      emailSubject: item.email_subject,
      emailBody: item.email_body,
    })

    if (
      params.expectedPayloadHash &&
      params.expectedPayloadHash !== item.payload_hash &&
      params.expectedPayloadHash !== currentHash
    ) {
      throw new Error(
        "Security Error (409): Approval payload hash mismatch. The action payload was modified after proposal.",
      )
    }

    item.status = params.decision
    item.approved_by_user_id = verified.userId
    if (params.decision === "approved") {
      item.approved_at = new Date().toISOString()
    } else {
      item.rejection_reason =
        params.rejectionReason || "Rejected by human reviewer"
      this.appendAuditLog(verified, {
        customer: item.customer,
        action: item.action,
        decision_by: `${verified.userName} (${verified.userId})`,
        status: "Rejected",
        refs: item.refs,
        details: `Rejected: ${item.rejection_reason} · Payload Hash ${item.payload_hash.slice(0, 12)}`,
      })
    }

    return item
  }

  /**
   * Server-side execution gate:
   * - Never trusts a frontend-provided approved flag or LLM claim.
   * - Verifies server-side status === "approved", reviewer identity, and payload_hash match.
   * - Enforces idempotency so an approved action can never be executed twice.
   */
  public async executeApprovedAction(
    auth: Partial<AuthContext>,
    params: {
      approvalId: string
      payloadHash?: string
      executorFn?: (approval: ExtendedApprovalRecord) => Promise<{
        outcomeSummary: string
      }>
    },
  ): Promise<{
    executed: boolean
    approval: ExtendedApprovalRecord
    auditLog: AuditLogRecord
  }> {
    const verified = this.assertAuthenticated(auth)
    const item = this.approvals.find(
      (a) => a.id === params.approvalId && a.workspace_id === verified.workspaceId,
    )
    if (!item) {
      throw new Error(`Approval record "${params.approvalId}" not found`)
    }
    this.assertAccountAccess(verified, item.customer)

    if (item.executed_at) {
      throw new Error(
        `Duplicate Execution Prevented (409): Approval "${params.approvalId}" was already executed at ${item.executed_at}`,
      )
    }

    if (item.status === "rejected") {
      this.appendAuditLog(verified, {
        customer: item.customer,
        action: item.action,
        decision_by: `${verified.userName} (${verified.userId})`,
        status: "Rejected",
        refs: item.refs,
        details: `Blocked execution attempt on rejected action "${item.id}"`,
      })
      throw new Error(
        `Execution Denied (403): Action "${params.approvalId}" was rejected and cannot be executed`,
      )
    }

    if (item.status !== "approved" || !item.approved_by_user_id) {
      this.appendAuditLog(verified, {
        customer: item.customer,
        action: item.action,
        decision_by: "Blocked (Unapproved)",
        status: "Awaiting approval",
        refs: item.refs,
        details: `Blocked unapproved execution attempt by ${verified.userId}`,
      })
      throw new Error(
        `Execution Denied (403): Action "${params.approvalId}" has not been approved by an authorized reviewer in the Approval Center`,
      )
    }

    // Recompute payload hash and verify binding
    const recomputedHash = computeApprovalPayloadHash({
      customer: item.customer,
      action: item.action,
      intendedOperation: item.intended_operation,
      proposedChange: item.proposed_change,
      recipientEmail: item.recipient_email,
      emailSubject: item.email_subject,
      emailBody: item.email_body,
    })

    if (
      recomputedHash !== item.payload_hash ||
      (params.payloadHash && params.payloadHash !== item.payload_hash)
    ) {
      throw new Error(
        "Execution Denied (409): Action payload hash does not match the approved payload hash",
      )
    }

    try {
      let outcomeSummary = `Executed ${item.intended_operation}: ${item.proposed_change}`
      if (params.executorFn) {
        const res = await params.executorFn(item)
        outcomeSummary = res.outcomeSummary
      }

      item.executed_at = new Date().toISOString()
      item.execution_result = outcomeSummary

      // Update account follow-up state
      const account = this.accounts.find(
        (a) => a.name.toLowerCase() === item.customer.toLowerCase(),
      )
      if (account) {
        account.followup_status = "Scheduled"
        account.followup_note = item.proposed_change
        if (account.status === "Pending Approval") {
          account.status = "Healthy"
          account.tone = "green"
        }
      }

      const auditLog = this.appendAuditLog(verified, {
        customer: item.customer,
        action: item.action,
        decision_by: `${verified.userName} (${verified.userId})`,
        status: "Executed",
        refs: item.refs,
        details: `${outcomeSummary} · Verified Hash ${item.payload_hash.slice(0, 12)}`,
      })

      return { executed: true, approval: item, auditLog }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.appendAuditLog(verified, {
        customer: item.customer,
        action: item.action,
        decision_by: `${verified.userName} (${verified.userId})`,
        status: "Awaiting approval",
        refs: item.refs,
        details: `Execution failed: ${errMsg}`,
      })
      throw err
    }
  }

  public appendAuditLog(
    auth: Partial<AuthContext>,
    entry: {
      customer: string
      action: string
      decision_by: string
      status: "Executed" | "Rejected" | "Awaiting approval"
      refs: string
      details?: string
    },
  ): AuditLogRecord {
    const timestamp_label = new Date().toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    })
    const record: AuditLogRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp_label,
      customer: entry.customer,
      action: entry.action,
      decision_by: entry.decision_by,
      status: entry.status,
      refs: entry.refs,
      details: entry.details,
      actor_user_id: auth?.userId || null,
    }
    this.auditLogs.unshift(record)

    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("audit_logs")
        .insert([record])
        .then(() => null, () => null)
    }
    return record
  }

  public getAuditLogs(auth: Partial<AuthContext>): AuditLogRecord[] {
    this.assertAuthenticated(auth)
    return [...this.auditLogs]
  }

  public recordMcpToolInvocation(entry: Omit<McpToolInvocationLog, "id" | "created_at">) {
    const record: McpToolInvocationLog = {
      ...entry,
      redacted_arguments: redactForLogs(entry.redacted_arguments),
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
    }
    this.toolInvocations.unshift(record)

    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("mcp_tool_invocations")
        .insert([
          {
            request_id: record.request_id,
            workspace_id: record.workspace_id,
            user_id: record.user_id,
            server_id: record.server_id,
            tool_name: record.tool_name,
            redacted_arguments: record.redacted_arguments,
            status: record.status,
            duration_ms: record.duration_ms,
            error_message: record.error_message,
            result_summary: record.result_summary,
          },
        ])
        .then(() => null, () => null)
    }
    return record
  }

  public getMcpToolInvocations(auth: Partial<AuthContext>): McpToolInvocationLog[] {
    const verified = this.assertAuthenticated(auth)
    return this.toolInvocations.filter(
      (inv) => inv.workspace_id === verified.workspaceId,
    )
  }

  public saveAIInsight(
    auth: Partial<AuthContext>,
    insight: Omit<SavedAIInsightRecord, "id" | "created_at" | "workspace_id" | "user_id">,
  ): SavedAIInsightRecord {
    const verified = this.assertAuthenticated(auth)
    const record: SavedAIInsightRecord = {
      ...insight,
      id: `ins_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspace_id: verified.workspaceId,
      user_id: verified.userId,
      created_at: new Date().toISOString(),
    }
    this.aiInsights.unshift(record)

    const sb = getServerSupabaseClient()
    if (sb) {
      sb.from("ai_insights")
        .insert([
          {
            workspace_id: record.workspace_id,
            user_id: record.user_id,
            account_name: record.account_name,
            risk_level: record.risk_level,
            confidence_score: record.confidence_score,
            summary: record.summary,
            why_it_matters: record.why_it_matters,
            suggested_next_step: record.suggested_next_step,
            evidence_refs: record.evidence_refs,
            tool_calls_used: record.tool_calls_used,
          },
        ])
        .then(() => null, () => null)
    }
    return record
  }

  public getAIInsights(auth: Partial<AuthContext>, accountName?: string) {
    const verified = this.assertAuthenticated(auth)
    return this.aiInsights.filter(
      (i) =>
        i.workspace_id === verified.workspaceId &&
        (!accountName ||
          i.account_name.toLowerCase() === accountName.toLowerCase()),
    )
  }

  /**
   * Integration Connection Registry (stores encrypted tokens on server only;
   * returns sanitized status metadata to frontend).
   */
  public upsertMcpConnection(
    auth: Partial<AuthContext>,
    input: {
      integrationKey: IntegrationKey
      provider: string
      serverUrl?: string
      authType: "oauth2" | "api_key" | "mcp_remote" | "internal"
      status: IntegrationConnectionStatus
      accessToken?: string
      refreshToken?: string
      tokenExpiresAt?: string
      scopes?: string[]
      externalAccountId?: string
      syncCursor?: string
      lastSyncedAt?: string
      lastTestAt?: string
      lastError?: string
      metadata?: Record<string, unknown>
    },
  ): StoredMcpConnection {
    const verified = this.assertAuthenticated(auth)
    this.initializeDefaultConnections(verified.workspaceId, verified.userId)
    const mapKey = `${verified.workspaceId}::${verified.userId}::${input.integrationKey}`
    const existing = this.connections.get(mapKey)

    const updated: StoredMcpConnection = {
      id: existing?.id || `conn_${input.integrationKey}_${verified.userId}`,
      workspaceId: verified.workspaceId,
      userId: verified.userId,
      integrationKey: input.integrationKey,
      provider: input.provider || existing?.provider || input.integrationKey,
      serverUrl: input.serverUrl ?? existing?.serverUrl,
      authType: input.authType || existing?.authType || "oauth2",
      status: input.status,
      encryptedAccessToken:
        input.accessToken !== undefined
          ? input.accessToken
            ? encryptSecret(input.accessToken)
            : undefined
          : existing?.encryptedAccessToken,
      encryptedRefreshToken:
        input.refreshToken !== undefined
          ? input.refreshToken
            ? encryptSecret(input.refreshToken)
            : undefined
          : existing?.encryptedRefreshToken,
      tokenExpiresAt: input.tokenExpiresAt ?? existing?.tokenExpiresAt,
      scopes: input.scopes ?? existing?.scopes ?? [],
      externalAccountId: input.externalAccountId ?? existing?.externalAccountId,
      syncCursor: input.syncCursor ?? existing?.syncCursor,
      lastSyncedAt: input.lastSyncedAt ?? existing?.lastSyncedAt,
      lastTestAt: input.lastTestAt ?? existing?.lastTestAt,
      lastError: input.lastError,
      metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}) },
      updatedAt: new Date().toISOString(),
    }

    this.connections.set(mapKey, updated)
    return updated
  }

  public getMcpConnections(auth: Partial<AuthContext>): Array<
    Omit<
      StoredMcpConnection,
      "encryptedAccessToken" | "encryptedRefreshToken"
    > & { hasAccessToken: boolean; hasRefreshToken: boolean }
  > {
    const verified = this.assertAuthenticated(auth)
    this.initializeDefaultConnections(verified.workspaceId, verified.userId)

    const result: Array<
      Omit<
        StoredMcpConnection,
        "encryptedAccessToken" | "encryptedRefreshToken"
      > & { hasAccessToken: boolean; hasRefreshToken: boolean }
    > = []

    for (const conn of this.connections.values()) {
      if (
        conn.workspaceId === verified.workspaceId &&
        conn.userId === verified.userId
      ) {
        const {
          encryptedAccessToken,
          encryptedRefreshToken,
          ...publicMetadata
        } = conn
        result.push({
          ...publicMetadata,
          hasAccessToken: Boolean(encryptedAccessToken),
          hasRefreshToken: Boolean(encryptedRefreshToken),
        })
      }
    }
    return result
  }

  public getDecryptedConnectionCredentials(
    auth: Partial<AuthContext>,
    integrationKey: IntegrationKey,
  ): {
    connection: StoredMcpConnection
    accessToken: string
    refreshToken: string
  } | null {
    const verified = this.assertAuthenticated(auth)
    this.initializeDefaultConnections(verified.workspaceId, verified.userId)
    const mapKey = `${verified.workspaceId}::${verified.userId}::${integrationKey}`
    const conn = this.connections.get(mapKey)
    if (!conn) return null
    return {
      connection: conn,
      accessToken: conn.encryptedAccessToken
        ? decryptSecret(conn.encryptedAccessToken)
        : "",
      refreshToken: conn.encryptedRefreshToken
        ? decryptSecret(conn.encryptedRefreshToken)
        : "",
    }
  }
}

export const backendStore = new BackendDataStore()

export interface McpUserHeaderContext {
  id: string
  fullName?: string
  email?: string
  workspaceId?: string
}

export interface DiscoveredMcpServer {
  serverId: string
  displayName: string
  transportType: string
  available: boolean
  connectionStatus: string
  toolCount: number
}

export interface DiscoveredMcpTool {
  name: string
  description?: string
  serverId: string
  inputSchema: Record<string, unknown>
}

export interface BackendMcpConnection {
  id: string
  workspaceId: string
  userId: string
  integrationKey: "crm" | "email" | "calendar" | "usage" | "dealflow_mcp"
  provider: string
  serverUrl?: string
  authType: "oauth2" | "api_key" | "mcp_remote" | "internal"
  status:
    | "Not configured"
    | "Connecting"
    | "Connected"
    | "Syncing"
    | "Disconnected"
    | "Error"
  scopes: string[]
  externalAccountId?: string
  syncCursor?: string
  lastSyncedAt?: string
  lastTestAt?: string
  lastError?: string
  hasAccessToken: boolean
  hasRefreshToken: boolean
  metadata: Record<string, unknown>
  updatedAt: string
}

export interface BackendMcpToolInvocation {
  id: string
  request_id: string
  workspace_id: string
  user_id: string
  server_id: string
  tool_name: string
  redacted_arguments: Record<string, unknown>
  status: "success" | "error" | "denied" | "timeout"
  duration_ms: number
  error_message?: string
  result_summary?: string
  created_at: string
}

function buildAuthHeaders(user?: McpUserHeaderContext): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-dealflow-user-id": user?.id || "usr_maya_chen",
    "x-dealflow-workspace-id": user?.workspaceId || "ws_default",
    "x-dealflow-user-name": user?.fullName || "Maya Chen",
    "x-dealflow-user-email": user?.email || "maya.chen@dealflow.ai",
  }
}

export async function fetchMcpGatewayRegistry(
  user?: McpUserHeaderContext,
): Promise<{
  ok: boolean
  servers: DiscoveredMcpServer[]
  tools: DiscoveredMcpTool[]
  connections: BackendMcpConnection[]
  invocations: BackendMcpToolInvocation[]
}> {
  const res = await fetch("/api/mcp/registry", {
    headers: buildAuthHeaders(user),
  })
  if (!res.ok) {
    throw new Error(`Failed to load MCP Gateway registry (HTTP ${res.status})`)
  }
  return res.json()
}

export async function callBackendMcpTool(
  user: McpUserHeaderContext | undefined,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{
  ok: boolean
  requestId: string
  serverId: string
  toolName: string
  durationMs: number
  data?: Record<string, unknown>
  error?: string
}> {
  const res = await fetch("/api/mcp/call", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify({ toolName, args }),
  })
  return res.json()
}

export async function requestBackendOAuthUrl(
  user: McpUserHeaderContext | undefined,
  integration: "email" | "calendar" | "crm",
): Promise<{
  ok: boolean
  configured: boolean
  authorizeUrl?: string
  state: string
  scopes: string[]
  message?: string
}> {
  const res = await fetch(
    `/api/oauth/authorize?integration=${encodeURIComponent(integration)}`,
    {
      headers: buildAuthHeaders(user),
    },
  )
  return res.json()
}

export async function testBackendIntegrationConnection(
  user: McpUserHeaderContext | undefined,
  payload: {
    integrationKey: "crm" | "email" | "calendar" | "usage"
    instanceUrl?: string
    accessToken?: string
    refreshToken?: string
    calendarId?: string
    apiKey?: string
  },
): Promise<{
  ok: boolean
  status: "Connected" | "Not configured" | "Error"
  error?: string
  message?: string
  emailAddress?: string
  calendarSummary?: string
  instanceUrl?: string
  connections?: BackendMcpConnection[]
}> {
  const res = await fetch("/api/integrations/test", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function syncBackendIntegrationNow(
  user: McpUserHeaderContext | undefined,
  payload: {
    integrationKey: "crm" | "email" | "calendar"
    accountName?: string
    incremental?: boolean
  },
): Promise<{
  ok: boolean
  error?: string
  syncedThreads?: unknown[]
  events?: unknown[]
  syncedAccounts?: unknown[]
  connections?: BackendMcpConnection[]
}> {
  const res = await fetch("/api/integrations/sync", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function disconnectBackendIntegration(
  user: McpUserHeaderContext | undefined,
  integrationKey: "crm" | "email" | "calendar" | "usage",
  provider?: string,
): Promise<{
  ok: boolean
  status: string
  connections?: BackendMcpConnection[]
}> {
  const res = await fetch("/api/integrations/disconnect", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify({ integrationKey, provider }),
  })
  return res.json()
}

export async function ingestBackendProductEvent(
  user: McpUserHeaderContext | undefined,
  payload: {
    ingestionKey: string
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
  },
): Promise<{
  ok: boolean
  created?: boolean
  duplicate?: boolean
  error?: string
  event?: Record<string, unknown>
}> {
  const res = await fetch("/api/events/ingest", {
    method: "POST",
    headers: {
      ...buildAuthHeaders(user),
      "x-ingestion-key": payload.ingestionKey,
    },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function decideAndExecuteBackendApproval(
  user: McpUserHeaderContext | undefined,
  payload: {
    approvalId: string
    decision: "approved" | "rejected"
    payloadHash?: string
    rejectionReason?: string
  },
): Promise<{
  ok: boolean
  executed?: boolean
  error?: string
  approval?: Record<string, unknown>
  auditLog?: Record<string, unknown>
}> {
  const decideRes = await fetch("/api/approvals/decide", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify(payload),
  })
  const decideData = await decideRes.json()
  if (!decideRes.ok || payload.decision === "rejected") {
    return decideData
  }

  const execRes = await fetch("/api/approvals/execute", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify({
      approvalId: payload.approvalId,
      payloadHash: payload.payloadHash,
    }),
  })
  return execRes.json()
}

export async function runBackendMcpAgentAnalysis(
  user: McpUserHeaderContext | undefined,
  payload: {
    accountName: string
    prompt?: string
    autoProposeFollowup?: boolean
    apiKey?: string
    model?: string
  },
): Promise<{
  ok: boolean
  accountName: string
  riskLevel: string
  confidenceScore: number
  summary: string
  whyItMatters: string
  suggestedNextStep: string
  evidenceRefs: string[]
  toolCallsUsed: string[]
  thinkingSteps: string[]
  recommendedActions: Array<{
    title: string
    reason: string
    refs: string
    status: string
  }>
}> {
  const res = await fetch("/api/agent/analyze", {
    method: "POST",
    headers: buildAuthHeaders(user),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `MCP Agent analysis failed (${res.status})`)
  }
  return res.json()
}

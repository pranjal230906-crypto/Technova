import type { IncomingMessage, ServerResponse } from "node:http"
import { centralMcpGateway } from "./mcp/centralGateway.ts"
import { backendStore, type AuthContext, type IntegrationKey } from "./store/backendStore.ts"
import {
  buildGoogleOAuthAuthorizeUrl,
  handleGoogleOAuthCallback,
  syncGmailThreads,
  testGmailConnection,
} from "./adapters/gmailAdapter.ts"
import {
  syncCalendarEventsIncremental,
  testGoogleCalendarConnection,
} from "./adapters/calendarAdapter.ts"
import {
  buildSalesforceOAuthAuthorizeUrl,
  handleSalesforceOAuthCallback,
  syncSalesforceAccounts,
  testSalesforceConnection,
} from "./adapters/salesforceAdapter.ts"
import { runMcpRevenueAgent } from "./agent/mcpAgent.ts"
import { checkRateLimit } from "./security/security.ts"

function extractAuthFromHeaders(
  req: IncomingMessage,
  body?: Record<string, unknown>,
): AuthContext {
  const userId =
    (req.headers["x-dealflow-user-id"] as string) ||
    (body?.userId as string) ||
    "usr_maya_chen"
  const workspaceId =
    (req.headers["x-dealflow-workspace-id"] as string) ||
    (body?.workspaceId as string) ||
    "ws_default"
  const userName =
    (req.headers["x-dealflow-user-name"] as string) ||
    (body?.userName as string) ||
    "Maya Chen"
  const userEmail =
    (req.headers["x-dealflow-user-email"] as string) ||
    (body?.userEmail as string) ||
    "maya.chen@dealflow.ai"

  return {
    userId,
    workspaceId,
    userName,
    userEmail,
  }
}

async function readJsonBody(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ""
    req.on("data", (chunk) => {
      raw += chunk.toString()
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"))
      }
    })
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>)
      } catch {
        reject(new Error("Invalid JSON body"))
      }
    })
    req.on("error", reject)
  })
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.statusCode = statusCode
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.end(JSON.stringify(payload))
}

export async function handleMcpApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const rawUrl = req.url || ""
  if (!rawUrl.startsWith("/api/")) {
    return false
  }

  const parsedUrl = new URL(rawUrl, "http://localhost:8443")
  const pathname = parsedUrl.pathname
  const method = (req.method || "GET").toUpperCase()

  // Apply server-side rate limiting
  const clientIp =
    (req.headers["x-forwarded-for"] as string) ||
    req.socket?.remoteAddress ||
    "local"
  const rateCheck = checkRateLimit(`${clientIp}:${pathname}`, 120, 60_000)
  if (!rateCheck.allowed) {
    sendJson(res, 429, {
      ok: false,
      error: `Rate limit exceeded. Retry after ${rateCheck.retryAfterMs}ms.`,
    })
    return true
  }

  try {
    // 1. GET /api/mcp/registry -> Discover MCP servers, tools, connection status & invocation logs
    if (pathname === "/api/mcp/registry" && method === "GET") {
      const auth = extractAuthFromHeaders(req)
      const discovery = await centralMcpGateway.discoverTools(auth)
      const connections = backendStore.getMcpConnections(auth)
      const invocations = backendStore.getMcpToolInvocations(auth).slice(0, 25)
      sendJson(res, 200, {
        ok: true,
        servers: discovery.servers,
        tools: discovery.tools,
        connections,
        invocations,
      })
      return true
    }

    // 2. POST /api/mcp/call -> Route validated tool call through Central MCP Gateway
    if (pathname === "/api/mcp/call" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const toolName = String(body.toolName || "")
      const args = (body.args || {}) as Record<string, unknown>
      const result = await centralMcpGateway.callTool({
        auth,
        toolName,
        args,
      })
      sendJson(res, result.ok ? 200 : 400, { ...result })
      return true
    }

    // 3. GET /api/oauth/authorize -> Generate CSRF-protected OAuth 2.0 URL
    if (pathname === "/api/oauth/authorize" && method === "GET") {
      const auth = extractAuthFromHeaders(req)
      const integration = (parsedUrl.searchParams.get("integration") ||
        "email") as "email" | "calendar" | "crm"

      if (integration === "crm") {
        const sf = buildSalesforceOAuthAuthorizeUrl(auth)
        sendJson(res, 200, { ok: true, ...sf })
        return true
      }
      const google = buildGoogleOAuthAuthorizeUrl({
        auth,
        integration: integration === "calendar" ? "calendar" : "email",
      })
      sendJson(res, 200, { ok: true, ...google })
      return true
    }

    // 4. GET /api/oauth/google/callback -> OAuth 2.0 callback for Gmail & Google Calendar
    if (pathname === "/api/oauth/google/callback" && method === "GET") {
      const code = parsedUrl.searchParams.get("code") || ""
      const state = parsedUrl.searchParams.get("state") || ""
      const result = await handleGoogleOAuthCallback({ code, state })
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error })
        return true
      }
      res.statusCode = 302
      res.setHeader(
        "Location",
        `/?oauth_connected=${encodeURIComponent(result.integration || "email")}`,
      )
      res.end()
      return true
    }

    // 5. GET /api/oauth/salesforce/callback -> OAuth 2.0 callback for Salesforce CRM
    if (pathname === "/api/oauth/salesforce/callback" && method === "GET") {
      const code = parsedUrl.searchParams.get("code") || ""
      const state = parsedUrl.searchParams.get("state") || ""
      const result = await handleSalesforceOAuthCallback({ code, state })
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error })
        return true
      }
      res.statusCode = 302
      res.setHeader("Location", "/?oauth_connected=crm")
      res.end()
      return true
    }

    // 6. POST /api/integrations/test -> Real authentication & connection verification
    if (pathname === "/api/integrations/test" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const integrationKey = String(
        body.integrationKey || "",
      ).toLowerCase() as IntegrationKey

      if (integrationKey === "email") {
        const resEmail = await testGmailConnection(auth, {
          accessToken: body.accessToken ? String(body.accessToken) : undefined,
          refreshToken: body.refreshToken
            ? String(body.refreshToken)
            : undefined,
        })
        sendJson(res, resEmail.ok ? 200 : 400, {
          ...resEmail,
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      if (integrationKey === "calendar") {
        const resCal = await testGoogleCalendarConnection(auth, {
          accessToken: body.accessToken ? String(body.accessToken) : undefined,
          refreshToken: body.refreshToken
            ? String(body.refreshToken)
            : undefined,
          calendarId: body.calendarId ? String(body.calendarId) : undefined,
        })
        sendJson(res, resCal.ok ? 200 : 400, {
          ...resCal,
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      if (integrationKey === "crm") {
        const resSf = await testSalesforceConnection(auth, {
          instanceUrl: body.instanceUrl ? String(body.instanceUrl) : undefined,
          accessToken: body.accessToken ? String(body.accessToken) : undefined,
          refreshToken: body.refreshToken
            ? String(body.refreshToken)
            : undefined,
        })
        sendJson(res, resSf.ok ? 200 : 400, {
          ...resSf,
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      if (integrationKey === "usage") {
        const providedKey = String(body.apiKey || "").trim()
        const expectedServerKey = (
          process.env.USAGE_INGESTION_API_KEY || "df_live_ingest_secret_placeholder"
        ).trim()

        if (!providedKey || providedKey.length < 8) {
          backendStore.upsertMcpConnection(auth, {
            integrationKey: "usage",
            provider: "DealFlow Events Ingestion API",
            authType: "api_key",
            status: "Not configured",
            lastError: "Valid Event Ingestion API Key is required",
          })
          sendJson(res, 400, {
            ok: false,
            status: "Not configured",
            error:
              "Ingestion API key is missing or invalid. Provide your event producer key to enable telemetry ingestion.",
            connections: backendStore.getMcpConnections(auth),
          })
          return true
        }

        if (
          providedKey !== expectedServerKey &&
          !providedKey.startsWith("df_live_")
        ) {
          backendStore.upsertMcpConnection(auth, {
            integrationKey: "usage",
            provider: "DealFlow Events Ingestion API",
            authType: "api_key",
            status: "Error",
            lastError: "Event producer API key authentication failed",
          })
          sendJson(res, 401, {
            ok: false,
            status: "Error",
            error:
              "Producer authentication failed: Invalid ingestion API key (must match USAGE_INGESTION_API_KEY or valid df_live_ producer key).",
            connections: backendStore.getMcpConnections(auth),
          })
          return true
        }

        backendStore.upsertMcpConnection(auth, {
          integrationKey: "usage",
          provider: "DealFlow Events Ingestion API",
          authType: "api_key",
          status: "Connected",
          accessToken: providedKey,
          lastTestAt: new Date().toISOString(),
          lastError: undefined,
        })
        sendJson(res, 200, {
          ok: true,
          status: "Connected",
          message: "Product Usage Event Ingestion API key verified and active.",
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      sendJson(res, 400, {
        ok: false,
        error: `Unknown integrationKey: ${integrationKey}`,
      })
      return true
    }

    // 7. POST /api/integrations/sync -> Trigger live synchronization
    if (pathname === "/api/integrations/sync" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const integrationKey = String(
        body.integrationKey || "",
      ).toLowerCase() as IntegrationKey

      if (integrationKey === "email") {
        const syncRes = await syncGmailThreads(auth, {
          accountName: body.accountName ? String(body.accountName) : undefined,
        })
        sendJson(res, syncRes.ok ? 200 : 400, {
          ...syncRes,
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      if (integrationKey === "calendar") {
        const syncRes = await syncCalendarEventsIncremental(auth, {
          accountName: body.accountName ? String(body.accountName) : undefined,
          useIncrementalSyncToken: Boolean(body.incremental),
        })
        sendJson(res, syncRes.ok ? 200 : 400, {
          ...syncRes,
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      if (integrationKey === "crm") {
        const syncRes = await syncSalesforceAccounts(auth, {
          accountNameFilter: body.accountName
            ? String(body.accountName)
            : undefined,
          incremental: Boolean(body.incremental),
        })
        sendJson(res, syncRes.ok ? 200 : 400, {
          ...syncRes,
          connections: backendStore.getMcpConnections(auth),
        })
        return true
      }

      sendJson(res, 400, {
        ok: false,
        error: `Sync not supported or unknown integration: ${integrationKey}`,
      })
      return true
    }

    // 8. POST /api/integrations/disconnect -> Disconnect & clear encrypted tokens
    if (pathname === "/api/integrations/disconnect" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const integrationKey = String(
        body.integrationKey || "",
      ).toLowerCase() as IntegrationKey

      backendStore.upsertMcpConnection(auth, {
        integrationKey,
        provider: String(body.provider || integrationKey),
        authType: "oauth2",
        status: "Disconnected",
        accessToken: "",
        refreshToken: "",
        lastError: undefined,
      })

      sendJson(res, 200, {
        ok: true,
        status: "Disconnected",
        connections: backendStore.getMcpConnections(auth),
      })
      return true
    }

    // 9. POST /api/events/ingest -> Secure Product Usage Event Ingestion API
    if (pathname === "/api/events/ingest" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)

      // Authenticate event producer
      const producerKey =
        (req.headers["x-ingestion-key"] as string) ||
        (body.ingestionKey as string) ||
        ""
      const expectedKey = (
        process.env.USAGE_INGESTION_API_KEY || "df_live_ingest_secret_placeholder"
      ).trim()
      const storedUsageConn = backendStore.getDecryptedConnectionCredentials(
        auth,
        "usage",
      )

      const isProducerAuthorized =
        producerKey === expectedKey ||
        producerKey.startsWith("df_live_") ||
        (storedUsageConn?.accessToken &&
          producerKey === storedUsageConn.accessToken)

      if (!isProducerAuthorized) {
        sendJson(res, 401, {
          ok: false,
          error:
            "Unauthorized Event Producer (401): Missing or invalid x-ingestion-key",
        })
        return true
      }

      const result = backendStore.ingestProductUsageEvent(auth, {
        event_id: String(body.event_id || ""),
        idempotency_key: body.idempotency_key
          ? String(body.idempotency_key)
          : undefined,
        account_name: String(body.account_name || ""),
        event_type: body.event_type as
          | "user_login"
          | "session_started"
          | "feature_used"
          | "subscription_activity",
        actor_email: body.actor_email ? String(body.actor_email) : undefined,
        feature_name: body.feature_name ? String(body.feature_name) : undefined,
        active_seats:
          typeof body.active_seats === "number" ? body.active_seats : undefined,
        contracted_seats:
          typeof body.contracted_seats === "number"
            ? body.contracted_seats
            : undefined,
        usage_delta_pct:
          typeof body.usage_delta_pct === "number"
            ? body.usage_delta_pct
            : undefined,
        metadata: (body.metadata as Record<string, unknown>) || {},
        occurred_at: body.occurred_at ? String(body.occurred_at) : undefined,
      })

      backendStore.upsertMcpConnection(auth, {
        integrationKey: "usage",
        provider: "DealFlow Events Ingestion API",
        authType: "api_key",
        status: "Connected",
        lastSyncedAt: new Date().toISOString(),
      })

      sendJson(res, 200, {
        ok: true,
        ...result,
      })
      return true
    }

    // 10. POST /api/approvals/propose -> Create pending action with payload_hash
    if (pathname === "/api/approvals/propose" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const resProp = backendStore.proposeFollowupTask(auth, {
        customer: String(body.customer || ""),
        action: String(body.action || ""),
        owner: body.owner ? String(body.owner) : undefined,
        refs: String(body.refs || ""),
        proposed_change: String(body.proposed_change || ""),
        description: String(body.description || ""),
        intended_operation: body.intended_operation as
          | "create_followup_task"
          | "send_customer_email"
          | "create_calendar_meeting"
          | "update_crm_field"
          | undefined,
        recipient_email: body.recipient_email
          ? String(body.recipient_email)
          : undefined,
        email_subject: body.email_subject
          ? String(body.email_subject)
          : undefined,
        email_body: body.email_body ? String(body.email_body) : undefined,
        idempotency_key: body.idempotency_key
          ? String(body.idempotency_key)
          : undefined,
      })
      sendJson(res, 200, { ok: true, ...resProp })
      return true
    }

    // 11. POST /api/approvals/decide -> Human reviewer approves or rejects
    if (pathname === "/api/approvals/decide" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const updated = backendStore.decideApproval(auth, {
        approvalId: String(body.approvalId || ""),
        decision: body.decision === "rejected" ? "rejected" : "approved",
        expectedPayloadHash: body.payloadHash
          ? String(body.payloadHash)
          : undefined,
        rejectionReason: body.rejectionReason
          ? String(body.rejectionReason)
          : undefined,
      })
      sendJson(res, 200, { ok: true, approval: updated })
      return true
    }

    // 12. POST /api/approvals/execute -> Server-side verified execution with idempotency
    if (pathname === "/api/approvals/execute" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const execResult = await backendStore.executeApprovedAction(auth, {
        approvalId: String(body.approvalId || ""),
        payloadHash: body.payloadHash ? String(body.payloadHash) : undefined,
      })
      sendJson(res, 200, { ok: true, ...execResult })
      return true
    }

    // 13. POST /api/agent/analyze -> 10-step MCP + LLM + RAG workflow
    if (pathname === "/api/agent/analyze" && method === "POST") {
      const body = await readJsonBody(req)
      const auth = extractAuthFromHeaders(req, body)
      const workflowRes = await runMcpRevenueAgent({
        auth,
        accountName: String(body.accountName || "Acme Corporation"),
        prompt: body.prompt ? String(body.prompt) : undefined,
        autoProposeFollowup: Boolean(body.autoProposeFollowup),
        apiKey: body.apiKey ? String(body.apiKey) : undefined,
        model: body.model ? String(body.model) : undefined,
      })
      sendJson(res, 200, { ...workflowRes })
      return true
    }

    sendJson(res, 404, {
      ok: false,
      error: `MCP API route not found: ${method} ${pathname}`,
    })
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = /unauthorized|401/i.test(msg)
      ? 401
      : /access denied|forbidden|403/i.test(msg)
        ? 403
        : /duplicate|mismatch|409/i.test(msg)
          ? 409
          : 400
    sendJson(res, status, { ok: false, error: msg })
    return true
  }
}

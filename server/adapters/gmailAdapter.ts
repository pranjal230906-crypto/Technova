import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import {
  backendStore,
  type AuthContext,
} from "../store/backendStore.ts"
import {
  createOAuthState,
  sanitizeUntrustedExternalText,
  verifyOAuthState,
  withTimeout,
} from "../security/security.ts"

export const GMAIL_MCP_SERVER_ID = "gmail_mcp"

export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly"
export const GMAIL_SEND_SCOPE =
  "https://www.googleapis.com/auth/gmail.send"

export const GMAIL_MCP_TOOLS: Tool[] = [
  {
    name: "gmail_list_customer_threads",
    description:
      "Retrieve customer email threads, timestamps, sender metadata, and reply activity mapped to a DealFlow AI customer account (Read-Only).",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Customer account name to retrieve mapped email threads for",
        },
        max_results: {
          type: "number",
          description: "Maximum threads to fetch per page (1-25)",
        },
        page_token: {
          type: "string",
          description: "Optional pagination token for next page of threads",
        },
      },
      required: ["account_name"],
      additionalProperties: false,
    },
  },
]

export function getGoogleOAuthClientConfig() {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim()
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim()
  const callbackUrl = (
    process.env.GOOGLE_OAUTH_CALLBACK_URL ||
    "http://localhost:8443/api/oauth/google/callback"
  ).trim()
  const isConfigured = Boolean(
    clientId &&
      clientSecret &&
      !clientId.includes("your-google-client-id"),
  )
  return { clientId, clientSecret, callbackUrl, isConfigured }
}

/**
 * Generates a least-privilege Google OAuth 2.0 authorization URL with CSRF state protection.
 */
export function buildGoogleOAuthAuthorizeUrl(params: {
  auth: AuthContext
  integration: "email" | "calendar"
  includeWriteScopeForApprovedActions?: boolean
}): {
  configured: boolean
  authorizeUrl?: string
  state: string
  scopes: string[]
  message?: string
} {
  const verified = backendStore.assertAuthenticated(params.auth)
  const cfg = getGoogleOAuthClientConfig()
  const state = createOAuthState({
    userId: verified.userId,
    workspaceId: verified.workspaceId,
    integration: params.integration,
  })

  const scopes =
    params.integration === "email"
      ? params.includeWriteScopeForApprovedActions
        ? [GMAIL_READONLY_SCOPE, GMAIL_SEND_SCOPE]
        : [GMAIL_READONLY_SCOPE]
      : ["https://www.googleapis.com/auth/calendar.readonly"]

  if (!cfg.isConfigured) {
    return {
      configured: false,
      state,
      scopes,
      message:
        "Google OAuth Client ID / Secret not configured in server environment (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET). Provide a valid OAuth Access Token or configure Google OAuth credentials.",
    }
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", cfg.clientId)
  url.searchParams.set("redirect_uri", cfg.callbackUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", scopes.join(" "))
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("state", state)

  return {
    configured: true,
    authorizeUrl: url.toString(),
    state,
    scopes,
  }
}

/**
 * Handles the OAuth 2.0 callback for Google (Gmail or Calendar), validating CSRF state
 * and exchanging the authorization code for access and refresh tokens.
 */
export async function handleGoogleOAuthCallback(params: {
  code: string
  state: string
  customFetch?: typeof fetch
}): Promise<{
  ok: boolean
  integration?: "email" | "calendar"
  userId?: string
  error?: string
}> {
  const stateCheck = verifyOAuthState(params.state)
  if (!stateCheck.valid || !stateCheck.payload) {
    return { ok: false, error: stateCheck.error || "Invalid OAuth state" }
  }

  const { userId, workspaceId } = stateCheck.payload
  const integration: "email" | "calendar" =
    stateCheck.payload.integration === "calendar" ? "calendar" : "email"
  const auth: AuthContext = { userId, workspaceId }
  const cfg = getGoogleOAuthClientConfig()
  const fetchFn = params.customFetch || fetch

  if (!cfg.isConfigured) {
    backendStore.upsertMcpConnection(auth, {
      integrationKey: integration,
      provider:
        integration === "email"
          ? "Google Workspace (Gmail)"
          : "Google Calendar",
      authType: "oauth2",
      status: "Error",
      lastError: "GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET missing on server",
    })
    return {
      ok: false,
      integration,
      userId,
      error: "Google OAuth server credentials are not configured",
    }
  }

  try {
    const tokenRes = await withTimeout(
      fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: params.code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.callbackUrl,
          grant_type: "authorization_code",
        }).toString(),
      }),
      8000,
      "Google OAuth token exchange",
    )

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      backendStore.upsertMcpConnection(auth, {
        integrationKey: integration,
        provider:
          integration === "email"
            ? "Google Workspace (Gmail)"
            : "Google Calendar",
        authType: "oauth2",
        status: "Error",
        lastError: `OAuth token exchange failed (HTTP ${tokenRes.status})`,
      })
      return {
        ok: false,
        integration,
        userId,
        error: `OAuth token exchange failed: ${errBody.slice(0, 120)}`,
      }
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }

    const expiresAt = new Date(
      Date.now() + (tokenJson.expires_in || 3600) * 1000,
    ).toISOString()

    backendStore.upsertMcpConnection(auth, {
      integrationKey: integration,
      provider:
        integration === "email"
          ? "Google Workspace (Gmail)"
          : "Google Calendar",
      authType: "oauth2",
      status: "Connected",
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      tokenExpiresAt: expiresAt,
      scopes: tokenJson.scope ? tokenJson.scope.split(" ") : [],
      lastTestAt: new Date().toISOString(),
      lastError: undefined,
    })

    return { ok: true, integration, userId }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, integration, userId, error: msg }
  }
}

/**
 * Refreshes an expired Google OAuth access token using the stored encrypted refresh token.
 */
export async function refreshGoogleAccessToken(
  auth: AuthContext,
  integration: "email" | "calendar",
  customFetch?: typeof fetch,
): Promise<{ ok: boolean; accessToken?: string; error?: string }> {
  const creds = backendStore.getDecryptedConnectionCredentials(
    auth,
    integration,
  )
  if (!creds || !creds.refreshToken) {
    backendStore.upsertMcpConnection(auth, {
      integrationKey: integration,
      provider:
        integration === "email"
          ? "Google Workspace (Gmail)"
          : "Google Calendar",
      authType: "oauth2",
      status: "Error",
      lastError: "Access token expired and no refresh token is available. Please reconnect.",
    })
    return {
      ok: false,
      error: "Access token expired and no refresh token is available",
    }
  }

  const cfg = getGoogleOAuthClientConfig()
  const fetchFn = customFetch || fetch

  try {
    const res = await withTimeout(
      fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cfg.clientId || "google_client_id",
          client_secret: cfg.clientSecret || "google_client_secret",
          refresh_token: creds.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      }),
      8000,
      "Google OAuth token refresh",
    )

    if (!res.ok) {
      const isRevoked = res.status === 400 || res.status === 401
      backendStore.upsertMcpConnection(auth, {
        integrationKey: integration,
        provider: creds.connection.provider,
        authType: "oauth2",
        status: "Error",
        accessToken: "",
        lastError: isRevoked
          ? "OAuth access was revoked or refresh token expired. Re-authentication required."
          : `Token refresh failed (HTTP ${res.status})`,
      })
      return {
        ok: false,
        error: isRevoked
          ? "OAuth refresh token revoked or expired"
          : `Token refresh failed (${res.status})`,
      }
    }

    const data = (await res.json()) as {
      access_token: string
      expires_in?: number
    }
    const expiresAt = new Date(
      Date.now() + (data.expires_in || 3600) * 1000,
    ).toISOString()

    backendStore.upsertMcpConnection(auth, {
      integrationKey: integration,
      provider: creds.connection.provider,
      authType: "oauth2",
      status: "Connected",
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
      lastError: undefined,
    })

    return { ok: true, accessToken: data.access_token }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

/**
 * Tests the Gmail connection against the real Gmail API (or configured remote Gmail MCP server).
 * Only marks Connected after a real successful authentication response.
 */
export async function testGmailConnection(
  auth: AuthContext,
  options?: {
    accessToken?: string
    refreshToken?: string
    mcpServerUrl?: string
    customFetch?: typeof fetch
  },
): Promise<{
  ok: boolean
  status: "Connected" | "Not configured" | "Error"
  emailAddress?: string
  messagesTotal?: number
  error?: string
}> {
  const verified = backendStore.assertAuthenticated(auth)
  const fetchFn = options?.customFetch || fetch
  const stored = backendStore.getDecryptedConnectionCredentials(
    verified,
    "email",
  )

  const token = (options?.accessToken ?? stored?.accessToken ?? "").trim()
  const refreshToken = (
    options?.refreshToken ??
    stored?.refreshToken ??
    ""
  ).trim()

  if (!token) {
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "email",
      provider: "Google Workspace (Gmail)",
      authType: "oauth2",
      status: "Not configured",
      lastError: "No OAuth access token configured",
    })
    return {
      ok: false,
      status: "Not configured",
      error: "Gmail OAuth access token is not configured. Connect Google Workspace OAuth or provide a valid token.",
    }
  }

  try {
    let res = await withTimeout(
      fetchFn("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      8000,
      "Gmail profile verification",
    )

    if (res.status === 401 && refreshToken) {
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "email",
        provider: "Google Workspace (Gmail)",
        authType: "oauth2",
        status: "Connecting",
        accessToken: token,
        refreshToken,
      })
      const refreshed = await refreshGoogleAccessToken(
        verified,
        "email",
        fetchFn,
      )
      if (refreshed.ok && refreshed.accessToken) {
        res = await withTimeout(
          fetchFn("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
            headers: { Authorization: `Bearer ${refreshed.accessToken}` },
          }),
          8000,
          "Gmail profile verification after token refresh",
        )
      } else {
        return {
          ok: false,
          status: "Error",
          error: refreshed.error || "Expired OAuth token could not be refreshed",
        }
      }
    }

    if (!res.ok) {
      const errMsg = `Gmail API authentication check failed (HTTP ${res.status})`
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "email",
        provider: "Google Workspace (Gmail)",
        authType: "oauth2",
        status: "Error",
        lastError: errMsg,
      })
      return { ok: false, status: "Error", error: errMsg }
    }

    const profile = (await res.json()) as {
      emailAddress?: string
      messagesTotal?: number
      threadsTotal?: number
    }

    backendStore.upsertMcpConnection(verified, {
      integrationKey: "email",
      provider: "Google Workspace (Gmail)",
      authType: "oauth2",
      status: "Connected",
      accessToken: token,
      refreshToken: refreshToken || undefined,
      externalAccountId: profile.emailAddress || "authenticated@gmail.com",
      scopes: [GMAIL_READONLY_SCOPE],
      lastTestAt: new Date().toISOString(),
      lastError: undefined,
      metadata: {
        emailAddress: profile.emailAddress,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
      },
    })

    return {
      ok: true,
      status: "Connected",
      emailAddress: profile.emailAddress,
      messagesTotal: profile.messagesTotal,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "email",
      provider: "Google Workspace (Gmail)",
      authType: "oauth2",
      status: "Error",
      lastError: msg,
    })
    return { ok: false, status: "Error", error: msg }
  }
}

/**
 * Synchronizes customer email threads from Gmail, supporting pagination, token refresh,
 * and deterministic customer account mapping.
 */
export async function syncGmailThreads(
  auth: AuthContext,
  options?: {
    accountName?: string
    maxResults?: number
    pageToken?: string
    customFetch?: typeof fetch
  },
): Promise<{
  ok: boolean
  syncedThreads: Array<{
    threadId: string
    matchedAccount: string
    subject: string
    sender: string
    timestamp: string
    snippet: string
    replyDetected: boolean
  }>
  nextPageToken?: string
  error?: string
}> {
  const verified = backendStore.assertAuthenticated(auth)
  const fetchFn = options?.customFetch || fetch
  const creds = backendStore.getDecryptedConnectionCredentials(
    verified,
    "email",
  )

  if (!creds || !creds.accessToken || creds.connection.status !== "Connected") {
    return {
      ok: false,
      syncedThreads: [],
      error: "Gmail integration is not connected. Authenticate first before syncing.",
    }
  }

  let activeToken = creds.accessToken
  // Check if token is expired by timestamp
  if (
    creds.connection.tokenExpiresAt &&
    new Date(creds.connection.tokenExpiresAt).getTime() <= Date.now()
  ) {
    const refreshed = await refreshGoogleAccessToken(verified, "email", fetchFn)
    if (!refreshed.ok || !refreshed.accessToken) {
      return {
        ok: false,
        syncedThreads: [],
        error: refreshed.error || "Gmail OAuth token expired and refresh failed",
      }
    }
    activeToken = refreshed.accessToken
  }

  let queryFilter = ""
  if (options?.accountName) {
    const targetAcc = backendStore.assertAccountAccess(
      verified,
      options.accountName,
    )
    queryFilter = targetAcc.champion_email || targetAcc.email_domain || targetAcc.name
  }

  const listUrl = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/threads",
  )
  listUrl.searchParams.set(
    "maxResults",
    String(Math.min(Math.max(1, options?.maxResults || 10), 25)),
  )
  if (queryFilter) listUrl.searchParams.set("q", queryFilter)
  if (options?.pageToken) listUrl.searchParams.set("pageToken", options.pageToken)

  try {
    let listRes = await withTimeout(
      fetchFn(listUrl.toString(), {
        headers: { Authorization: `Bearer ${activeToken}` },
      }),
      8000,
      "Gmail threads.list",
    )

    if (listRes.status === 401 && creds.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(
        verified,
        "email",
        fetchFn,
      )
      if (refreshed.ok && refreshed.accessToken) {
        activeToken = refreshed.accessToken
        listRes = await withTimeout(
          fetchFn(listUrl.toString(), {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          8000,
          "Gmail threads.list retry",
        )
      }
    }

    if (!listRes.ok) {
      const errMsg = `Gmail thread sync failed (HTTP ${listRes.status})`
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "email",
        provider: creds.connection.provider,
        authType: "oauth2",
        status: "Error",
        lastError: errMsg,
      })
      return { ok: false, syncedThreads: [], error: errMsg }
    }

    const listData = (await listRes.json()) as {
      threads?: Array<{ id: string; snippet?: string }>
      nextPageToken?: string
    }

    const rawThreads = Array.isArray(listData.threads) ? listData.threads : []
    const syncedThreads: Array<{
      threadId: string
      matchedAccount: string
      subject: string
      sender: string
      timestamp: string
      snippet: string
      replyDetected: boolean
    }> = []

    for (const threadStub of rawThreads.slice(0, 10)) {
      const detailRes = await withTimeout(
        fetchFn(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadStub.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${activeToken}` } },
        ),
        6000,
        "Gmail threads.get",
      )
      if (!detailRes.ok) continue
      const detail = (await detailRes.json()) as {
        id: string
        snippet?: string
        messages?: Array<{
          internalDate?: string
          payload?: { headers?: Array<{ name: string; value: string }> }
        }>
      }
      const msgs = Array.isArray(detail.messages) ? detail.messages : []
      const lastMsg = msgs[msgs.length - 1]
      const headers = lastMsg?.payload?.headers || []
      const subject =
        headers.find((h) => h.name.toLowerCase() === "subject")?.value ||
        "(No subject)"
      const sender =
        headers.find((h) => h.name.toLowerCase() === "from")?.value ||
        "unknown@example.com"
      const dateStr =
        headers.find((h) => h.name.toLowerCase() === "date")?.value ||
        new Date().toISOString()

      const matched =
        backendStore.matchAccountByEmailOrDomain(
          `${sender} ${subject} ${detail.snippet || ""}`,
        ) ||
        (options?.accountName
          ? backendStore.assertAccountAccess(verified, options.accountName)
          : null)

      if (matched) {
        const sanitizedSnippet = sanitizeUntrustedExternalText(
          detail.snippet || threadStub.snippet || "",
          `Gmail Thread ${detail.id}`,
        )
        syncedThreads.push({
          threadId: detail.id,
          matchedAccount: matched.name,
          subject,
          sender,
          timestamp: dateStr,
          snippet: sanitizedSnippet,
          replyDetected: msgs.length > 1,
        })

        backendStore.addInteraction(verified, {
          account_name: matched.name,
          date_label: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          }),
          title: `Email thread: ${subject.slice(0, 60)}`,
          meta: "Gmail OAuth Sync",
          note: detail.snippet || "Synced thread activity",
          is_alert: false,
          sort_order: 1,
        })
      }
    }

    const nowIso = new Date().toISOString()
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "email",
      provider: creds.connection.provider,
      authType: "oauth2",
      status: "Connected",
      lastSyncedAt: nowIso,
      syncCursor: listData.nextPageToken,
      lastError: undefined,
      metadata: {
        ...creds.connection.metadata,
        lastSyncedCount: syncedThreads.length,
      },
    })

    return {
      ok: true,
      syncedThreads,
      nextPageToken: listData.nextPageToken,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, syncedThreads: [], error: msg }
  }
}

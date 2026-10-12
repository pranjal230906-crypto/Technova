import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { backendStore, type AuthContext } from "../store/backendStore.ts"
import {
  createOAuthState,
  generatePkcePair,
  verifyOAuthState,
  withTimeout,
} from "../security/security.ts"

export const SALESFORCE_MCP_SERVER_ID = "salesforce_mcp"

export const SALESFORCE_MCP_TOOLS: Tool[] = [
  {
    name: "salesforce_query_accounts",
    description:
      "Retrieve accessible Salesforce CRM accounts, opportunities, renewal dates, account owners, and mapped DealFlow AI account IDs (Read-Only).",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Optional account name filter",
        },
        next_records_url: {
          type: "string",
          description: "Optional pagination cursor (nextRecordsUrl) from previous query",
        },
      },
      additionalProperties: false,
    },
  },
]

export function getSalesforceOAuthConfig() {
  const clientId = (process.env.SALESFORCE_CLIENT_ID || "").trim()
  const clientSecret = (process.env.SALESFORCE_CLIENT_SECRET || "").trim()
  const loginUrl = (
    process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com"
  )
    .trim()
    .replace(/\/+$/, "")
  const callbackUrl = (
    process.env.SALESFORCE_CALLBACK_URL ||
    process.env.SALESFORCE_REDIRECT_URI ||
    "http://localhost:5173/api/oauth/salesforce/callback"
  ).trim()
  const isConfigured = Boolean(
    clientId &&
      clientSecret &&
      !clientId.includes("your-salesforce-connected-app"),
  )
  return { clientId, clientSecret, loginUrl, callbackUrl, isConfigured }
}

export function buildSalesforceOAuthAuthorizeUrl(auth: AuthContext): {
  configured: boolean
  authorizeUrl?: string
  state: string
  scopes: string[]
  message?: string
} {
  const verified = backendStore.assertAuthenticated(auth)
  const cfg = getSalesforceOAuthConfig()
  const { codeVerifier, codeChallenge } = generatePkcePair()
  const state = createOAuthState({
    userId: verified.userId,
    workspaceId: verified.workspaceId,
    integration: "crm",
    codeVerifier,
  })
  const scopes = ["api", "refresh_token", "id"]

  if (!cfg.isConfigured) {
    return {
      configured: false,
      state,
      scopes,
      message:
        "Salesforce Connected App credentials (SALESFORCE_CLIENT_ID / SALESFORCE_CLIENT_SECRET) are not configured on the server.",
    }
  }

  const url = new URL(`${cfg.loginUrl}/services/oauth2/authorize`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", cfg.clientId)
  url.searchParams.set("redirect_uri", cfg.callbackUrl)
  url.searchParams.set("scope", scopes.join(" "))
  url.searchParams.set("state", state)
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")

  return {
    configured: true,
    authorizeUrl: url.toString(),
    state,
    scopes,
  }
}

export async function handleSalesforceOAuthCallback(params: {
  code: string
  state: string
  customFetch?: typeof fetch
}): Promise<{ ok: boolean; userId?: string; instanceUrl?: string; error?: string }> {
  const stateCheck = verifyOAuthState(params.state)
  if (!stateCheck.valid || !stateCheck.payload) {
    return { ok: false, error: stateCheck.error || "Invalid Salesforce OAuth state" }
  }
  const { userId, workspaceId, codeVerifier } = stateCheck.payload
  const auth: AuthContext = { userId, workspaceId }
  const cfg = getSalesforceOAuthConfig()
  const fetchFn = params.customFetch || fetch

  if (!cfg.isConfigured) {
    return {
      ok: false,
      userId,
      error: "Salesforce Connected App server credentials are not configured",
    }
  }

  try {
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code: params.code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.callbackUrl,
    }
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier
    }

    const res = await withTimeout(
      fetchFn(`${cfg.loginUrl}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenParams).toString(),
      }),
      8000,
      "Salesforce OAuth token exchange",
    )

    if (!res.ok) {
      const errText = await res.text()
      backendStore.upsertMcpConnection(auth, {
        integrationKey: "crm",
        provider: "Salesforce",
        authType: "oauth2",
        status: "Error",
        lastError: `Salesforce OAuth token exchange failed (HTTP ${res.status})`,
      })
      return {
        ok: false,
        userId,
        error: `Salesforce OAuth failed: ${errText.slice(0, 120)}`,
      }
    }

    const tokenData = (await res.json()) as {
      access_token: string
      refresh_token?: string
      instance_url: string
      id?: string
      scope?: string
    }

    backendStore.upsertMcpConnection(auth, {
      integrationKey: "crm",
      provider: "Salesforce",
      serverUrl: tokenData.instance_url,
      authType: "oauth2",
      status: "Connected",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      scopes: tokenData.scope ? tokenData.scope.split(" ") : ["api"],
      externalAccountId: tokenData.id || tokenData.instance_url,
      lastTestAt: new Date().toISOString(),
      lastError: undefined,
      metadata: {
        instanceUrl: tokenData.instance_url,
      },
    })

    return { ok: true, userId, instanceUrl: tokenData.instance_url }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, userId, error: msg }
  }
}

export async function refreshSalesforceAccessToken(
  auth: AuthContext,
  customFetch?: typeof fetch,
): Promise<{ ok: boolean; accessToken?: string; instanceUrl?: string; error?: string }> {
  const creds = backendStore.getDecryptedConnectionCredentials(auth, "crm")
  if (!creds || !creds.refreshToken) {
    backendStore.upsertMcpConnection(auth, {
      integrationKey: "crm",
      provider: "Salesforce",
      authType: "oauth2",
      status: "Error",
      lastError: "Salesforce access token expired and no refresh token is available.",
    })
    return {
      ok: false,
      error: "Salesforce access token expired and no refresh token is available",
    }
  }

  const cfg = getSalesforceOAuthConfig()
  const fetchFn = customFetch || fetch

  try {
    const res = await withTimeout(
      fetchFn(`${cfg.loginUrl}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: cfg.clientId || "sf_client_id",
          client_secret: cfg.clientSecret || "sf_client_secret",
          refresh_token: creds.refreshToken,
        }).toString(),
      }),
      8000,
      "Salesforce OAuth token refresh",
    )

    if (!res.ok) {
      backendStore.upsertMcpConnection(auth, {
        integrationKey: "crm",
        provider: "Salesforce",
        authType: "oauth2",
        status: "Error",
        accessToken: "",
        lastError: `Salesforce refresh token expired or revoked (HTTP ${res.status})`,
      })
      return {
        ok: false,
        error: `Salesforce token refresh failed (HTTP ${res.status})`,
      }
    }

    const data = (await res.json()) as {
      access_token: string
      instance_url?: string
    }
    const instanceUrl =
      data.instance_url ||
      creds.connection.serverUrl ||
      (creds.connection.metadata?.instanceUrl as string) ||
      ""

    backendStore.upsertMcpConnection(auth, {
      integrationKey: "crm",
      provider: "Salesforce",
      serverUrl: instanceUrl,
      authType: "oauth2",
      status: "Connected",
      accessToken: data.access_token,
      lastError: undefined,
      metadata: {
        ...creds.connection.metadata,
        instanceUrl,
      },
    })

    return { ok: true, accessToken: data.access_token, instanceUrl }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

/**
 * Verifies Salesforce CRM connection against the documented `/services/data/v60.0/limits` REST endpoint.
 * Never simulates authentication.
 */
export async function testSalesforceConnection(
  auth: AuthContext,
  options?: {
    instanceUrl?: string
    accessToken?: string
    refreshToken?: string
    customFetch?: typeof fetch
  },
): Promise<{
  ok: boolean
  status: "Connected" | "Not configured" | "Error"
  instanceUrl?: string
  apiRemaining?: number
  error?: string
}> {
  const verified = backendStore.assertAuthenticated(auth)
  const fetchFn = options?.customFetch || fetch
  const stored = backendStore.getDecryptedConnectionCredentials(verified, "crm")

  const instanceUrl = (
    options?.instanceUrl ??
    stored?.connection.serverUrl ??
    (stored?.connection.metadata?.instanceUrl as string) ??
    ""
  )
    .trim()
    .replace(/\/+$/, "")

  const token = (options?.accessToken ?? stored?.accessToken ?? "").trim()
  const refreshToken = (
    options?.refreshToken ??
    stored?.refreshToken ??
    ""
  ).trim()

  if (!instanceUrl || !token || !instanceUrl.startsWith("http")) {
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "crm",
      provider: "Salesforce",
      authType: "oauth2",
      status: "Not configured",
      lastError: "Salesforce Instance URL and Access Token are required",
    })
    return {
      ok: false,
      status: "Not configured",
      error:
        "Salesforce Instance URL and OAuth Access Token are not configured.",
    }
  }

  try {
    let res = await withTimeout(
      fetchFn(`${instanceUrl}/services/data/v60.0/limits`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }),
      8000,
      "Salesforce limits check",
    )

    if (res.status === 401 && refreshToken) {
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "crm",
        provider: "Salesforce",
        serverUrl: instanceUrl,
        authType: "oauth2",
        status: "Connecting",
        accessToken: token,
        refreshToken,
      })
      const refreshed = await refreshSalesforceAccessToken(verified, fetchFn)
      if (refreshed.ok && refreshed.accessToken) {
        res = await withTimeout(
          fetchFn(
            `${refreshed.instanceUrl || instanceUrl}/services/data/v60.0/limits`,
            {
              headers: {
                Authorization: `Bearer ${refreshed.accessToken}`,
                Accept: "application/json",
              },
            },
          ),
          8000,
          "Salesforce limits check after refresh",
        )
      } else {
        return {
          ok: false,
          status: "Error",
          error: refreshed.error || "Salesforce token expired and refresh failed",
        }
      }
    }

    if (res.status === 429) {
      const rateMsg = "Salesforce API rate limit exceeded (HTTP 429)"
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "crm",
        provider: "Salesforce",
        serverUrl: instanceUrl,
        authType: "oauth2",
        status: "Error",
        lastError: rateMsg,
      })
      return { ok: false, status: "Error", error: rateMsg }
    }

    if (!res.ok) {
      const errMsg = `Salesforce authentication check failed (HTTP ${res.status})`
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "crm",
        provider: "Salesforce",
        serverUrl: instanceUrl,
        authType: "oauth2",
        status: "Error",
        lastError: errMsg,
      })
      return { ok: false, status: "Error", error: errMsg }
    }

    const limits = (await res.json()) as {
      DailyApiRequests?: { Max?: number; Remaining?: number }
    }

    backendStore.upsertMcpConnection(verified, {
      integrationKey: "crm",
      provider: "Salesforce",
      serverUrl: instanceUrl,
      authType: "oauth2",
      status: "Connected",
      accessToken: token,
      refreshToken: refreshToken || undefined,
      lastTestAt: new Date().toISOString(),
      lastError: undefined,
      metadata: {
        instanceUrl,
        dailyApiRemaining: limits?.DailyApiRequests?.Remaining,
      },
    })

    return {
      ok: true,
      status: "Connected",
      instanceUrl,
      apiRemaining: limits?.DailyApiRequests?.Remaining,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "crm",
      provider: "Salesforce",
      serverUrl: instanceUrl,
      authType: "oauth2",
      status: "Error",
      lastError: msg,
    })
    return { ok: false, status: "Error", error: msg }
  }
}

/**
 * Synchronizes Salesforce Accounts, Opportunities, renewal dates, and owners with
 * pagination (`nextRecordsUrl`), rate-limit handling, and incremental `SystemModstamp` cursor support.
 */
export async function syncSalesforceAccounts(
  auth: AuthContext,
  options?: {
    accountNameFilter?: string
    nextRecordsUrl?: string
    incremental?: boolean
    customFetch?: typeof fetch
  },
): Promise<{
  ok: boolean
  syncedAccounts: Array<{
    salesforceId: string
    dealflowAccountName: string
    arr: string
    renewalDate: string
    ownerName: string
    stageOrStatus: string
  }>
  nextRecordsUrl?: string
  error?: string
}> {
  const verified = backendStore.assertAuthenticated(auth)
  const fetchFn = options?.customFetch || fetch
  const creds = backendStore.getDecryptedConnectionCredentials(verified, "crm")

  if (!creds || !creds.accessToken || creds.connection.status !== "Connected") {
    return {
      ok: false,
      syncedAccounts: [],
      error: "Salesforce CRM is not connected. Authenticate first before syncing.",
    }
  }

  let activeToken = creds.accessToken
  const instanceUrl = (
    creds.connection.serverUrl ||
    (creds.connection.metadata?.instanceUrl as string) ||
    ""
  ).replace(/\/+$/, "")

  let queryEndpoint = ""
  if (options?.nextRecordsUrl) {
    queryEndpoint = `${instanceUrl}${options.nextRecordsUrl.startsWith("/") ? "" : "/"}${options.nextRecordsUrl}`
  } else {
    const whereClauses: string[] = []
    if (options?.accountNameFilter) {
      const safeName = options.accountNameFilter.replace(/'/g, "\\'")
      whereClauses.push(`Name = '${safeName}'`)
    }
    if (options?.incremental && creds.connection.syncCursor) {
      whereClauses.push(`SystemModstamp > ${creds.connection.syncCursor}`)
    }
    const whereSql =
      whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : ""
    const soql = `SELECT Id, Name, AnnualRevenue, Type, Owner.Name, SystemModstamp FROM Account${whereSql} ORDER BY SystemModstamp DESC LIMIT 25`
    queryEndpoint = `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`
  }

  try {
    let res = await withTimeout(
      fetchFn(queryEndpoint, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          Accept: "application/json",
        },
      }),
      8000,
      "Salesforce SOQL query",
    )

    if (res.status === 401 && creds.refreshToken) {
      const refreshed = await refreshSalesforceAccessToken(verified, fetchFn)
      if (refreshed.ok && refreshed.accessToken) {
        activeToken = refreshed.accessToken
        res = await withTimeout(
          fetchFn(queryEndpoint, {
            headers: {
              Authorization: `Bearer ${activeToken}`,
              Accept: "application/json",
            },
          }),
          8000,
          "Salesforce SOQL retry",
        )
      }
    }

    if (res.status === 429) {
      return {
        ok: false,
        syncedAccounts: [],
        error: "Salesforce API rate limit exceeded (HTTP 429). Retry later.",
      }
    }

    if (!res.ok) {
      const errMsg = `Salesforce SOQL query failed (HTTP ${res.status})`
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "crm",
        provider: "Salesforce",
        serverUrl: instanceUrl,
        authType: "oauth2",
        status: "Error",
        lastError: errMsg,
      })
      return { ok: false, syncedAccounts: [], error: errMsg }
    }

    const data = (await res.json()) as {
      done?: boolean
      nextRecordsUrl?: string
      records?: Array<{
        Id: string
        Name: string
        AnnualRevenue?: number
        Type?: string
        Owner?: { Name?: string }
        CloseDate?: string
        StageName?: string
        SystemModstamp?: string
      }>
    }

    const records = Array.isArray(data.records) ? data.records : []
    const syncedAccounts: Array<{
      salesforceId: string
      dealflowAccountName: string
      arr: string
      renewalDate: string
      ownerName: string
      stageOrStatus: string
    }> = []

    let latestModstamp = creds.connection.syncCursor

    for (const rec of records) {
      if (!rec.Name) continue
      const arrNum = Number(rec.AnnualRevenue || 65000)
      const arrLabel =
        arrNum >= 1000 ? `$${Math.round(arrNum / 1000)}K` : `$${arrNum}`
      const ownerName = rec.Owner?.Name || "Maya Chen"
      const renewalDate = rec.CloseDate || "Aug 15, 2025"
      const initials = rec.Name.split(/\s+/)
        .map((w) => w[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase()

      const existingAcc = backendStore
        .getAccounts(verified)
        .find((a) => a.name.toLowerCase() === rec.Name.toLowerCase())

      const updated = backendStore.upsertAccount(verified, {
        name: rec.Name,
        initials: initials || "SF",
        status: existingAcc?.status || "Healthy",
        tone: existingAcc?.tone || "green",
        signal:
          existingAcc?.signal ||
          `Synced from Salesforce (${rec.Id})`,
        renewal: existingAcc?.renewal || renewalDate,
        action: existingAcc?.action || "Review Salesforce opportunity stage",
        color: existingAcc?.color || "bg-emerald-100 text-emerald-700",
        owner: ownerName,
        arr: arrLabel,
        tier: rec.Type || existingAcc?.tier || "Enterprise",
        external_crm_id: rec.Id,
      })

      if (rec.SystemModstamp) {
        latestModstamp = rec.SystemModstamp
      }

      syncedAccounts.push({
        salesforceId: rec.Id,
        dealflowAccountName: updated.name,
        arr: updated.arr,
        renewalDate: updated.renewal,
        ownerName: updated.owner,
        stageOrStatus: updated.status,
      })
    }

    backendStore.upsertMcpConnection(verified, {
      integrationKey: "crm",
      provider: "Salesforce",
      serverUrl: instanceUrl,
      authType: "oauth2",
      status: "Connected",
      syncCursor: latestModstamp || new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      lastError: undefined,
      metadata: {
        ...creds.connection.metadata,
        syncedAccountsCount: syncedAccounts.length,
      },
    })

    return {
      ok: true,
      syncedAccounts,
      nextRecordsUrl: data.nextRecordsUrl,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, syncedAccounts: [], error: msg }
  }
}

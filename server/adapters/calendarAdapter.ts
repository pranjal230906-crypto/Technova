import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { backendStore, type AuthContext } from "../store/backendStore.ts"
import { refreshGoogleAccessToken } from "./gmailAdapter.ts"
import { withTimeout } from "../security/security.ts"

export const CALENDAR_MCP_SERVER_ID = "calendar_mcp"

export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly"

export const CALENDAR_MCP_TOOLS: Tool[] = [
  {
    name: "calendar_list_customer_events",
    description:
      "Retrieve customer meetings, QBR dates, attendees, and upcoming follow-up events associated with a DealFlow AI account (Read-Only).",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Customer account name to filter associated calendar events",
        },
        max_results: {
          type: "number",
          description: "Maximum events to return (1-25)",
        },
        page_token: {
          type: "string",
          description: "Optional pagination token",
        },
      },
      required: ["account_name"],
      additionalProperties: false,
    },
  },
]

/**
 * Verifies Google Calendar connection with a live request to Google Calendar API v3.
 * Never marks Connected unless authentication and the test request succeed.
 */
export async function testGoogleCalendarConnection(
  auth: AuthContext,
  options?: {
    accessToken?: string
    refreshToken?: string
    calendarId?: string
    customFetch?: typeof fetch
  },
): Promise<{
  ok: boolean
  status: "Connected" | "Not configured" | "Error"
  calendarSummary?: string
  timeZone?: string
  error?: string
}> {
  const verified = backendStore.assertAuthenticated(auth)
  const fetchFn = options?.customFetch || fetch
  const stored = backendStore.getDecryptedConnectionCredentials(
    verified,
    "calendar",
  )

  const token = (options?.accessToken ?? stored?.accessToken ?? "").trim()
  const refreshToken = (
    options?.refreshToken ??
    stored?.refreshToken ??
    ""
  ).trim()
  const calendarId = (
    options?.calendarId ||
    (stored?.connection.metadata?.calendarId as string) ||
    "primary"
  ).trim()

  if (!token) {
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "calendar",
      provider: "Google Calendar",
      authType: "oauth2",
      status: "Not configured",
      lastError: "No Google Calendar OAuth access token configured",
    })
    return {
      ok: false,
      status: "Not configured",
      error: "Google Calendar OAuth token is not configured.",
    }
  }

  try {
    let res = await withTimeout(
      fetchFn(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      8000,
      "Google Calendar metadata verification",
    )

    if (res.status === 401 && refreshToken) {
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "calendar",
        provider: "Google Calendar",
        authType: "oauth2",
        status: "Connecting",
        accessToken: token,
        refreshToken,
      })
      const refreshed = await refreshGoogleAccessToken(
        verified,
        "calendar",
        fetchFn,
      )
      if (refreshed.ok && refreshed.accessToken) {
        res = await withTimeout(
          fetchFn(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
            {
              headers: { Authorization: `Bearer ${refreshed.accessToken}` },
            },
          ),
          8000,
          "Google Calendar retry after token refresh",
        )
      } else {
        return {
          ok: false,
          status: "Error",
          error: refreshed.error || "Calendar OAuth token expired and refresh failed",
        }
      }
    }

    if (!res.ok) {
      const errMsg = `Google Calendar API authentication check failed (HTTP ${res.status})`
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "calendar",
        provider: "Google Calendar",
        authType: "oauth2",
        status: "Error",
        lastError: errMsg,
      })
      return { ok: false, status: "Error", error: errMsg }
    }

    const calMeta = (await res.json()) as {
      id?: string
      summary?: string
      timeZone?: string
    }

    backendStore.upsertMcpConnection(verified, {
      integrationKey: "calendar",
      provider: "Google Calendar",
      authType: "oauth2",
      status: "Connected",
      accessToken: token,
      refreshToken: refreshToken || undefined,
      externalAccountId: calMeta.id || calendarId,
      scopes: [CALENDAR_READONLY_SCOPE],
      lastTestAt: new Date().toISOString(),
      lastError: undefined,
      metadata: {
        calendarId,
        calendarSummary: calMeta.summary || "Primary Calendar",
        timeZone: calMeta.timeZone || "UTC",
      },
    })

    return {
      ok: true,
      status: "Connected",
      calendarSummary: calMeta.summary || calendarId,
      timeZone: calMeta.timeZone,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    backendStore.upsertMcpConnection(verified, {
      integrationKey: "calendar",
      provider: "Google Calendar",
      authType: "oauth2",
      status: "Error",
      lastError: msg,
    })
    return { ok: false, status: "Error", error: msg }
  }
}

/**
 * Incrementally synchronizes Google Calendar events with pagination, syncToken support,
 * and deterministic association to DealFlow AI customer accounts.
 */
export async function syncCalendarEventsIncremental(
  auth: AuthContext,
  options?: {
    accountName?: string
    maxResults?: number
    pageToken?: string
    useIncrementalSyncToken?: boolean
    customFetch?: typeof fetch
  },
): Promise<{
  ok: boolean
  events: Array<{
    eventId: string
    matchedAccount: string
    summary: string
    startTime: string
    attendees: string[]
    isUpcoming: boolean
  }>
  nextPageToken?: string
  nextSyncToken?: string
  error?: string
}> {
  const verified = backendStore.assertAuthenticated(auth)
  const fetchFn = options?.customFetch || fetch
  const creds = backendStore.getDecryptedConnectionCredentials(
    verified,
    "calendar",
  )

  if (!creds || !creds.accessToken || creds.connection.status !== "Connected") {
    return {
      ok: false,
      events: [],
      error: "Google Calendar integration is not connected.",
    }
  }

  let activeToken = creds.accessToken
  const calendarId =
    (creds.connection.metadata?.calendarId as string) || "primary"

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  )
  url.searchParams.set(
    "maxResults",
    String(Math.min(Math.max(1, options?.maxResults || 15), 25)),
  )

  if (options?.pageToken) {
    url.searchParams.set("pageToken", options.pageToken)
  } else if (
    options?.useIncrementalSyncToken &&
    creds.connection.syncCursor
  ) {
    url.searchParams.set("syncToken", creds.connection.syncCursor)
  } else {
    url.searchParams.set("singleEvents", "true")
    url.searchParams.set("orderBy", "startTime")
    url.searchParams.set(
      "timeMin",
      new Date(Date.now() - 30 * 86400000).toISOString(),
    )
  }

  try {
    let res = await withTimeout(
      fetchFn(url.toString(), {
        headers: { Authorization: `Bearer ${activeToken}` },
      }),
      8000,
      "Google Calendar events.list",
    )

    // Handle 410 Gone (expired incremental syncToken -> full sync fallback)
    if (res.status === 410) {
      url.searchParams.delete("syncToken")
      url.searchParams.set("singleEvents", "true")
      res = await withTimeout(
        fetchFn(url.toString(), {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
        8000,
        "Google Calendar full resync",
      )
    }

    if (res.status === 401 && creds.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(
        verified,
        "calendar",
        fetchFn,
      )
      if (refreshed.ok && refreshed.accessToken) {
        activeToken = refreshed.accessToken
        res = await withTimeout(
          fetchFn(url.toString(), {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          8000,
          "Google Calendar events.list retry",
        )
      }
    }

    if (!res.ok) {
      const errMsg = `Calendar sync failed (HTTP ${res.status})`
      backendStore.upsertMcpConnection(verified, {
        integrationKey: "calendar",
        provider: "Google Calendar",
        authType: "oauth2",
        status: "Error",
        lastError: errMsg,
      })
      return { ok: false, events: [], error: errMsg }
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string
        summary?: string
        description?: string
        start?: { dateTime?: string; date?: string }
        attendees?: Array<{ email?: string; displayName?: string }>
      }>
      nextPageToken?: string
      nextSyncToken?: string
    }

    const rawItems = Array.isArray(data.items) ? data.items : []
    const matchedEvents: Array<{
      eventId: string
      matchedAccount: string
      summary: string
      startTime: string
      attendees: string[]
      isUpcoming: boolean
    }> = []

    for (const item of rawItems) {
      const summary = item.summary || "Customer Meeting"
      const attendeeEmails = (item.attendees || [])
        .map((a) => a.email || "")
        .filter(Boolean)
      const searchBlob = `${summary} ${item.description || ""} ${attendeeEmails.join(" ")}`

      const matched =
        backendStore.matchAccountByEmailOrDomain(searchBlob) ||
        (options?.accountName
          ? backendStore.assertAccountAccess(verified, options.accountName)
          : null)

      if (!matched) continue
      if (
        options?.accountName &&
        matched.name.toLowerCase() !== options.accountName.toLowerCase()
      ) {
        continue
      }

      const startIso =
        item.start?.dateTime || item.start?.date || new Date().toISOString()
      const isUpcoming = new Date(startIso).getTime() >= Date.now()

      matchedEvents.push({
        eventId: item.id,
        matchedAccount: matched.name,
        summary,
        startTime: startIso,
        attendees: attendeeEmails,
        isUpcoming,
      })

      backendStore.addInteraction(verified, {
        account_name: matched.name,
        date_label: new Date(startIso).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
        title: summary,
        meta: `Google Calendar (${attendeeEmails.length} attendees)`,
        note: isUpcoming
          ? "Upcoming scheduled follow-up"
          : "Completed meeting synced",
        is_alert: false,
        sort_order: 2,
      })
    }

    backendStore.upsertMcpConnection(verified, {
      integrationKey: "calendar",
      provider: "Google Calendar",
      authType: "oauth2",
      status: "Connected",
      syncCursor: data.nextSyncToken || creds.connection.syncCursor,
      lastSyncedAt: new Date().toISOString(),
      lastError: undefined,
      metadata: {
        ...creds.connection.metadata,
        syncedEventsCount: matchedEvents.length,
      },
    })

    return {
      ok: true,
      events: matchedEvents,
      nextPageToken: data.nextPageToken,
      nextSyncToken: data.nextSyncToken,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, events: [], error: msg }
  }
}

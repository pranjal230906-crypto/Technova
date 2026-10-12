import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import {
  createConnectedDealFlowMcpPair,
  DEALFLOW_MCP_SERVER_ID,
} from "./dealflowMcpServer.ts"
import {
  GMAIL_MCP_SERVER_ID,
  GMAIL_MCP_TOOLS,
  syncGmailThreads,
} from "../adapters/gmailAdapter.ts"
import {
  CALENDAR_MCP_SERVER_ID,
  CALENDAR_MCP_TOOLS,
  syncCalendarEventsIncremental,
} from "../adapters/calendarAdapter.ts"
import {
  SALESFORCE_MCP_SERVER_ID,
  SALESFORCE_MCP_TOOLS,
  syncSalesforceAccounts,
} from "../adapters/salesforceAdapter.ts"
import { backendStore, type AuthContext } from "../store/backendStore.ts"
import {
  redactForLogs,
  withSafeRetry,
  withTimeout,
} from "../security/security.ts"

export interface RegisteredMcpServerDescriptor {
  serverId: string
  displayName: string
  transportType: "in-memory-sdk" | "remote-http-mcp" | "verified-api-adapter"
  endpointUrl?: string
  available: boolean
  tools: Tool[]
  customHandler?: (
    toolName: string,
    args: Record<string, unknown>,
    auth: AuthContext,
  ) => Promise<Record<string, unknown>>
}

export interface McpToolExecutionResult {
  ok: boolean
  requestId: string
  serverId: string
  toolName: string
  durationMs: number
  data?: Record<string, unknown>
  error?: string
}

/**
 * Strict allowlist of permitted MCP tools that the AI Agent and Gateway may invoke.
 * Any tool not in this allowlist (or dynamically added via registerMcpServer) is denied.
 */
const DEFAULT_ALLOWED_TOOLS = new Set<string>([
  // DealFlow AI Custom MCP Server tools (Requirement 2)
  "get_account_summary",
  "get_customer_signals",
  "search_customer_evidence",
  "get_product_usage",
  "propose_followup_task",
  "get_pending_actions",
  // Read-only External Adapter tools (Requirements 3, 4, 5)
  "gmail_list_customer_threads",
  "calendar_list_customer_events",
  "salesforce_query_accounts",
])

/**
 * Validates tool arguments against the MCP tool's JSON Schema before execution.
 */
export function validateToolArguments(
  tool: Tool,
  args: Record<string, unknown>,
): { valid: boolean; error?: string } {
  const schema = tool.inputSchema as {
    type?: string
    properties?: Record<
      string,
      { type?: string; enum?: string[]; description?: string }
    >
    required?: string[]
    additionalProperties?: boolean
  }

  if (!schema || schema.type !== "object") {
    return { valid: true }
  }

  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return { valid: false, error: "Arguments must be a JSON object" }
  }

  const requiredFields = Array.isArray(schema.required) ? schema.required : []
  for (const reqField of requiredFields) {
    const val = args[reqField]
    if (
      val === undefined ||
      val === null ||
      (typeof val === "string" && !val.trim())
    ) {
      return {
        valid: false,
        error: `Validation Error: Missing or empty required argument "${reqField}" for tool "${tool.name}"`,
      }
    }
  }

  const properties = schema.properties || {}
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (key === "__auth") continue
      if (!(key in properties)) {
        return {
          valid: false,
          error: `Validation Error: Unexpected argument "${key}" for tool "${tool.name}"`,
        }
      }
    }
  }

  for (const [key, propSpec] of Object.entries(properties)) {
    const val = args[key]
    if (val === undefined || val === null) continue
    if (propSpec.type === "string" && typeof val !== "string") {
      return {
        valid: false,
        error: `Validation Error: Argument "${key}" must be of type string`,
      }
    }
    if (
      propSpec.type === "number" &&
      (typeof val !== "number" || Number.isNaN(val))
    ) {
      return {
        valid: false,
        error: `Validation Error: Argument "${key}" must be of type number`,
      }
    }
    if (
      Array.isArray(propSpec.enum) &&
      typeof val === "string" &&
      !propSpec.enum.includes(val)
    ) {
      return {
        valid: false,
        error: `Validation Error: Argument "${key}" must be one of [${propSpec.enum.join(", ")}]`,
      }
    }
  }

  return { valid: true }
}

export class CentralMcpGateway {
  private sdkClientPromise: Promise<{ client: Client }> | null = null
  private allowedTools = new Set<string>(DEFAULT_ALLOWED_TOOLS)
  private servers = new Map<string, RegisteredMcpServerDescriptor>()
  private defaultTimeoutMs = 8000

  constructor() {
    this.registerBuiltInServers()
  }

  private registerBuiltInServers() {
    this.servers.set(DEALFLOW_MCP_SERVER_ID, {
      serverId: DEALFLOW_MCP_SERVER_ID,
      displayName: "DealFlow AI Custom MCP Server",
      transportType: "in-memory-sdk",
      endpointUrl:
        process.env.DEALFLOW_MCP_SERVER_URL || "in-memory://dealflow-mcp-server",
      available: true,
      tools: [], // Discovered dynamically via official MCP SDK Client.listTools()
    })

    this.servers.set(GMAIL_MCP_SERVER_ID, {
      serverId: GMAIL_MCP_SERVER_ID,
      displayName: "Google Workspace Gmail MCP / API Adapter",
      transportType: process.env.GMAIL_MCP_SERVER_URL
        ? "remote-http-mcp"
        : "verified-api-adapter",
      endpointUrl:
        process.env.GMAIL_MCP_SERVER_URL ||
        "https://gmail.googleapis.com/gmail/v1",
      available: true,
      tools: GMAIL_MCP_TOOLS,
      customHandler: async (toolName, args, auth) => {
        if (toolName === "gmail_list_customer_threads") {
          const res = await syncGmailThreads(auth, {
            accountName: String(args.account_name || ""),
            maxResults:
              typeof args.max_results === "number" ? args.max_results : 10,
            pageToken: args.page_token ? String(args.page_token) : undefined,
          })
          if (!res.ok) {
            throw new Error(res.error || "Gmail thread retrieval failed")
          }
          return {
            account_name: args.account_name,
            threads: res.syncedThreads,
            next_page_token: res.nextPageToken,
          }
        }
        throw new Error(`Unsupported Gmail tool: ${toolName}`)
      },
    })

    this.servers.set(CALENDAR_MCP_SERVER_ID, {
      serverId: CALENDAR_MCP_SERVER_ID,
      displayName: "Google Calendar MCP / API Adapter",
      transportType: process.env.CALENDAR_MCP_SERVER_URL
        ? "remote-http-mcp"
        : "verified-api-adapter",
      endpointUrl:
        process.env.CALENDAR_MCP_SERVER_URL ||
        "https://www.googleapis.com/calendar/v3",
      available: true,
      tools: CALENDAR_MCP_TOOLS,
      customHandler: async (toolName, args, auth) => {
        if (toolName === "calendar_list_customer_events") {
          const res = await syncCalendarEventsIncremental(auth, {
            accountName: String(args.account_name || ""),
            maxResults:
              typeof args.max_results === "number" ? args.max_results : 15,
            pageToken: args.page_token ? String(args.page_token) : undefined,
          })
          if (!res.ok) {
            throw new Error(res.error || "Calendar event retrieval failed")
          }
          return {
            account_name: args.account_name,
            events: res.events,
            next_page_token: res.nextPageToken,
            next_sync_token: res.nextSyncToken,
          }
        }
        throw new Error(`Unsupported Calendar tool: ${toolName}`)
      },
    })

    this.servers.set(SALESFORCE_MCP_SERVER_ID, {
      serverId: SALESFORCE_MCP_SERVER_ID,
      displayName: "Salesforce CRM MCP / REST Adapter",
      transportType: process.env.SALESFORCE_MCP_SERVER_URL
        ? "remote-http-mcp"
        : "verified-api-adapter",
      endpointUrl:
        process.env.SALESFORCE_MCP_SERVER_URL || "https://login.salesforce.com",
      available: true,
      tools: SALESFORCE_MCP_TOOLS,
      customHandler: async (toolName, args, auth) => {
        if (toolName === "salesforce_query_accounts") {
          const res = await syncSalesforceAccounts(auth, {
            accountNameFilter: args.account_name
              ? String(args.account_name)
              : undefined,
            nextRecordsUrl: args.next_records_url
              ? String(args.next_records_url)
              : undefined,
          })
          if (!res.ok) {
            throw new Error(res.error || "Salesforce account query failed")
          }
          return {
            accounts: res.syncedAccounts,
            next_records_url: res.nextRecordsUrl,
          }
        }
        throw new Error(`Unsupported Salesforce tool: ${toolName}`)
      },
    })
  }

  private async getDealFlowSdkClient(): Promise<Client> {
    if (!this.sdkClientPromise) {
      this.sdkClientPromise = createConnectedDealFlowMcpPair()
    }
    const { client } = await this.sdkClientPromise
    return client
  }

  /**
   * Dynamically registers a new MCP server and its permitted tools without redesigning the application.
   */
  public registerMcpServer(
    descriptor: RegisteredMcpServerDescriptor,
    allowAllServerTools = true,
  ) {
    this.servers.set(descriptor.serverId, descriptor)
    if (allowAllServerTools) {
      for (const t of descriptor.tools) {
        this.allowedTools.add(t.name)
      }
    }
  }

  public setServerAvailability(serverId: string, available: boolean) {
    const srv = this.servers.get(serverId)
    if (srv) {
      srv.available = available
    }
  }

  /**
   * Discovers all tools and their JSON input schemas across all registered MCP servers.
   */
  public async discoverTools(auth?: Partial<AuthContext>): Promise<{
    servers: Array<{
      serverId: string
      displayName: string
      transportType: string
      available: boolean
      connectionStatus: string
      toolCount: number
    }>
    tools: Array<Tool & { serverId: string }>
  }> {
    const verified = auth ? backendStore.assertAuthenticated(auth) : null
    const connections = verified
      ? backendStore.getMcpConnections(verified)
      : []

    // Discover tools from the official MCP TypeScript SDK DealFlow Server
    const sdkClient = await this.getDealFlowSdkClient()
    const sdkToolsList = await sdkClient.listTools()
    const dealflowDesc = this.servers.get(DEALFLOW_MCP_SERVER_ID)
    if (dealflowDesc) {
      dealflowDesc.tools = sdkToolsList.tools
    }

    const allTools: Array<Tool & { serverId: string }> = []
    const serverSummaries: Array<{
      serverId: string
      displayName: string
      transportType: string
      available: boolean
      connectionStatus: string
      toolCount: number
    }> = []

    for (const srv of this.servers.values()) {
      const integrationMap: Record<string, string> = {
        [DEALFLOW_MCP_SERVER_ID]: "dealflow_mcp",
        [GMAIL_MCP_SERVER_ID]: "email",
        [CALENDAR_MCP_SERVER_ID]: "calendar",
        [SALESFORCE_MCP_SERVER_ID]: "crm",
      }
      const intKey = integrationMap[srv.serverId]
      const conn = connections.find((c) => c.integrationKey === intKey)
      const connectionStatus =
        srv.serverId === DEALFLOW_MCP_SERVER_ID
          ? "Connected"
          : conn?.status || "Not configured"

      serverSummaries.push({
        serverId: srv.serverId,
        displayName: srv.displayName,
        transportType: srv.transportType,
        available: srv.available,
        connectionStatus,
        toolCount: srv.tools.length,
      })

      for (const tool of srv.tools) {
        if (this.allowedTools.has(tool.name)) {
          allTools.push({
            ...tool,
            serverId: srv.serverId,
          })
        }
      }
    }

    return { servers: serverSummaries, tools: allTools }
  }

  /**
   * Routes a tool call through allowlist verification, JSON schema validation,
   * workspace/account authentication, timeout, retry, and invocation logging.
   */
  public async callTool(params: {
    auth: Partial<AuthContext>
    toolName: string
    args: Record<string, unknown>
    timeoutMs?: number
  }): Promise<McpToolExecutionResult> {
    const startMs = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const toolName = (params.toolName || "").trim()

    let verifiedAuth: AuthContext
    try {
      verifiedAuth = backendStore.assertAuthenticated(params.auth)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      backendStore.recordMcpToolInvocation({
        request_id: requestId,
        workspace_id: params.auth?.workspaceId || "ws_unknown",
        user_id: params.auth?.userId || "unauthenticated",
        server_id: "gateway",
        tool_name: toolName,
        redacted_arguments: redactForLogs(params.args),
        status: "denied",
        duration_ms: Date.now() - startMs,
        error_message: msg,
      })
      return {
        ok: false,
        requestId,
        serverId: "gateway",
        toolName,
        durationMs: Date.now() - startMs,
        error: msg,
      }
    }

    // 1. Enforce strict tool allowlist
    if (!this.allowedTools.has(toolName)) {
      const denyMsg = `Security Error (403): Tool "${toolName}" is not in the Central MCP Gateway allowlist`
      backendStore.recordMcpToolInvocation({
        request_id: requestId,
        workspace_id: verifiedAuth.workspaceId,
        user_id: verifiedAuth.userId,
        server_id: "gateway",
        tool_name: toolName,
        redacted_arguments: redactForLogs(params.args),
        status: "denied",
        duration_ms: Date.now() - startMs,
        error_message: denyMsg,
      })
      return {
        ok: false,
        requestId,
        serverId: "gateway",
        toolName,
        durationMs: Date.now() - startMs,
        error: denyMsg,
      }
    }

    // 2. Discover & locate target server and tool schema
    await this.discoverTools(verifiedAuth)
    let targetServer: RegisteredMcpServerDescriptor | undefined
    let targetTool: Tool | undefined

    for (const srv of this.servers.values()) {
      const found = srv.tools.find((t) => t.name === toolName)
      if (found) {
        targetServer = srv
        targetTool = found
        break
      }
    }

    if (!targetServer || !targetTool) {
      const notFoundMsg = `Tool "${toolName}" not found on any registered MCP server`
      return {
        ok: false,
        requestId,
        serverId: "unknown",
        toolName,
        durationMs: Date.now() - startMs,
        error: notFoundMsg,
      }
    }

    if (!targetServer.available) {
      const unavailMsg = `MCP Server "${targetServer.displayName}" (${targetServer.serverId}) is currently unavailable`
      backendStore.recordMcpToolInvocation({
        request_id: requestId,
        workspace_id: verifiedAuth.workspaceId,
        user_id: verifiedAuth.userId,
        server_id: targetServer.serverId,
        tool_name: toolName,
        redacted_arguments: redactForLogs(params.args),
        status: "error",
        duration_ms: Date.now() - startMs,
        error_message: unavailMsg,
      })
      return {
        ok: false,
        requestId,
        serverId: targetServer.serverId,
        toolName,
        durationMs: Date.now() - startMs,
        error: unavailMsg,
      }
    }

    // 3. Validate tool arguments against schema
    const validation = validateToolArguments(targetTool, params.args || {})
    if (!validation.valid) {
      backendStore.recordMcpToolInvocation({
        request_id: requestId,
        workspace_id: verifiedAuth.workspaceId,
        user_id: verifiedAuth.userId,
        server_id: targetServer.serverId,
        tool_name: toolName,
        redacted_arguments: redactForLogs(params.args),
        status: "error",
        duration_ms: Date.now() - startMs,
        error_message: validation.error,
      })
      return {
        ok: false,
        requestId,
        serverId: targetServer.serverId,
        toolName,
        durationMs: Date.now() - startMs,
        error: validation.error,
      }
    }

    // 4. Execute tool with timeout & safe retry
    const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs
    try {
      const data = await withSafeRetry(
        async () => {
          return await withTimeout(
            (async () => {
              if (targetServer!.serverId === DEALFLOW_MCP_SERVER_ID) {
                const sdkClient = await this.getDealFlowSdkClient()
                const response = await sdkClient.callTool({
                  name: toolName,
                  arguments: {
                    ...params.args,
                    __auth: verifiedAuth,
                  },
                })
                const contentArr = Array.isArray(response.content)
                  ? response.content
                  : []
                const firstText =
                  contentArr.find((c) => c.type === "text")?.text || "{}"
                const parsed = JSON.parse(firstText) as Record<string, unknown>
                if (response.isError || parsed.error) {
                  throw new Error(String(parsed.error || "MCP tool error"))
                }
                return parsed
              }

              if (targetServer!.customHandler) {
                return await targetServer!.customHandler(
                  toolName,
                  params.args,
                  verifiedAuth,
                )
              }

              throw new Error(
                `No execution handler configured for server "${targetServer!.serverId}"`,
              )
            })(),
            timeoutMs,
            `MCP tool ${toolName}`,
          )
        },
        { retries: 1, baseDelayMs: 100 },
      )

      const durationMs = Date.now() - startMs
      const isDenied = false
      backendStore.recordMcpToolInvocation({
        request_id: requestId,
        workspace_id: verifiedAuth.workspaceId,
        user_id: verifiedAuth.userId,
        server_id: targetServer.serverId,
        tool_name: toolName,
        redacted_arguments: redactForLogs(params.args),
        status: isDenied ? "denied" : "success",
        duration_ms: durationMs,
        result_summary: `Returned ${Object.keys(data).length} top-level fields`,
      })

      return {
        ok: true,
        requestId,
        serverId: targetServer.serverId,
        toolName,
        durationMs,
        data,
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startMs
      const msg = err instanceof Error ? err.message : String(err)
      const isTimeout = /timed out/i.test(msg)
      const isDenied = /access denied|unauthorized|403|401/i.test(msg)

      backendStore.recordMcpToolInvocation({
        request_id: requestId,
        workspace_id: verifiedAuth.workspaceId,
        user_id: verifiedAuth.userId,
        server_id: targetServer.serverId,
        tool_name: toolName,
        redacted_arguments: redactForLogs(params.args),
        status: isTimeout ? "timeout" : isDenied ? "denied" : "error",
        duration_ms: durationMs,
        error_message: msg,
      })

      return {
        ok: false,
        requestId,
        serverId: targetServer.serverId,
        toolName,
        durationMs,
        error: msg,
      }
    }
  }
}

export const centralMcpGateway = new CentralMcpGateway()

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js"
import {
  buildRagCorpus,
  getCustomRagDocuments,
  retrieveRelevantChunks,
} from "../../src/lib/rag.ts"
import { backendStore, type AuthContext } from "../store/backendStore.ts"
import { sanitizeUntrustedExternalText } from "../security/security.ts"

export const DEALFLOW_MCP_SERVER_ID = "dealflow_mcp"

export const DEALFLOW_MCP_TOOLS: Tool[] = [
  {
    name: "get_account_summary",
    description:
      "Retrieve customer account summary including ARR, renewal date, health status, champion contact, and follow-up state from Supabase.",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Exact or case-insensitive customer account name (e.g. Acme Corporation)",
        },
      },
      required: ["account_name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_customer_signals",
    description:
      "Retrieve verified churn risk signals, expansion indicators, and recent interaction alerts for a customer account.",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Target customer account name",
        },
      },
      required: ["account_name"],
      additionalProperties: false,
    },
  },
  {
    name: "search_customer_evidence",
    description:
      "Search verified customer evidence, QBR transcripts, CRM notes, and RevOps playbooks using the existing DealFlow RAG pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Customer account name to scope evidence retrieval",
        },
        query: {
          type: "string",
          description: "Natural-language search query for evidence retrieval",
        },
        top_k: {
          type: "number",
          description: "Maximum number of ranked evidence chunks to return (1-10)",
        },
      },
      required: ["account_name", "query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_product_usage",
    description:
      "Retrieve product usage telemetry events (user_login, session_started, feature_used, subscription_activity) and seat utilization for a customer.",
    inputSchema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Customer account name",
        },
        limit: {
          type: "number",
          description: "Max events to return (default 20)",
        },
      },
      required: ["account_name"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_followup_task",
    description:
      "Create a PENDING follow-up proposal in the Approval Center with required evidence citations. Does NOT send emails or execute external CRM writes.",
    inputSchema: {
      type: "object",
      properties: {
        customer: {
          type: "string",
          description: "Target customer account name",
        },
        action: {
          type: "string",
          description: "Short title of the proposed action",
        },
        owner: {
          type: "string",
          description: "Assigned account owner",
        },
        refs: {
          type: "string",
          description: "Comma-separated verified evidence citation codes (e.g. 'E1, E2, KB-1')",
        },
        proposed_change: {
          type: "string",
          description: "Concrete proposed change or due date",
        },
        description: {
          type: "string",
          description: "Evidence-backed rationale for the human reviewer",
        },
        intended_operation: {
          type: "string",
          enum: [
            "create_followup_task",
            "send_customer_email",
            "create_calendar_meeting",
            "update_crm_field",
          ],
          description: "Type of consequential operation requiring human approval",
        },
        recipient_email: {
          type: "string",
          description: "Optional recipient email if proposing an email draft",
        },
        email_subject: {
          type: "string",
          description: "Optional email subject if proposing an email draft",
        },
        email_body: {
          type: "string",
          description: "Optional email body if proposing an email draft",
        },
        idempotency_key: {
          type: "string",
          description: "Optional idempotency key to prevent duplicate proposals",
        },
      },
      required: ["customer", "action", "refs", "proposed_change", "description"],
      additionalProperties: false,
    },
  },
  {
    name: "get_pending_actions",
    description:
      "Retrieve pending actions awaiting human approval in the Approval Center, optionally filtered by customer account.",
    inputSchema: {
      type: "object",
      properties: {
        customer: {
          type: "string",
          description: "Optional customer account name filter",
        },
      },
      additionalProperties: false,
    },
  },
]

function extractAuthFromArgs(rawArgs: Record<string, unknown>): {
  auth: AuthContext
  cleanArgs: Record<string, unknown>
} {
  const { __auth, ...cleanArgs } = rawArgs
  const authObj = (__auth || {}) as Partial<AuthContext>
  const verified = backendStore.assertAuthenticated(authObj)
  return { auth: verified, cleanArgs }
}

/**
 * Executes a DealFlow AI MCP tool directly with full input validation and workspace/account access checks.
 */
export async function executeDealFlowMcpTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { auth, cleanArgs } = extractAuthFromArgs(rawArgs)

  switch (toolName) {
    case "get_account_summary": {
      const accountName = String(cleanArgs.account_name || "").trim()
      if (!accountName) {
        throw new Error("Validation Error: account_name must be a non-empty string")
      }
      const account = backendStore.assertAccountAccess(auth, accountName)
      return {
        account_name: account.name,
        external_crm_id: account.external_crm_id,
        status: account.status,
        arr: account.arr,
        tier: account.tier || "Enterprise",
        owner: account.owner,
        renewal_date: account.renewal,
        renewal_days: account.renewal_days || "43 days",
        primary_signal: account.signal,
        product_usage: account.product_usage,
        product_usage_note: account.product_usage_note,
        champion_status: account.champion_status,
        champion_note: account.champion_note,
        champion_email: account.champion_email,
        followup_status: account.followup_status,
        followup_note: account.followup_note,
        recommended_action: account.action,
      }
    }

    case "get_customer_signals": {
      const accountName = String(cleanArgs.account_name || "").trim()
      if (!accountName) {
        throw new Error("Validation Error: account_name must be a non-empty string")
      }
      const account = backendStore.assertAccountAccess(auth, accountName)
      const evidence = backendStore.getEvidenceForAccount(auth, account.name)
      const interactions = backendStore.getInteractionsForAccount(
        auth,
        account.name,
      )
      const risksOpps = backendStore
        .getRisksOpportunities(auth)
        .filter((r) => r.customer.toLowerCase() === account.name.toLowerCase())

      return {
        account_name: account.name,
        health_status: account.status,
        primary_signal: account.signal,
        verified_evidence_count: evidence.length,
        verified_evidence: evidence.map((e) => ({
          code: e.code,
          title: e.title,
          source: e.source,
          verified_date: e.verified_date,
        })),
        recent_interactions: interactions.map((i) => ({
          date: i.date_label,
          title: i.title,
          meta: i.meta,
          note: sanitizeUntrustedExternalText(i.note, i.meta),
          is_alert: i.is_alert,
        })),
        portfolio_flags: risksOpps,
      }
    }

    case "search_customer_evidence": {
      const accountName = String(cleanArgs.account_name || "").trim()
      const query = String(cleanArgs.query || "").trim()
      const topK =
        typeof cleanArgs.top_k === "number"
          ? Math.min(Math.max(1, cleanArgs.top_k), 10)
          : 5

      if (!accountName) {
        throw new Error("Validation Error: account_name is required")
      }
      if (!query) {
        throw new Error("Validation Error: query must be a non-empty string")
      }

      const account = backendStore.assertAccountAccess(auth, accountName)
      const evidence = backendStore.getEvidenceForAccount(auth, account.name)
      const interactions = backendStore.getInteractionsForAccount(
        auth,
        account.name,
      )
      const risksOpportunities = backendStore.getRisksOpportunities(auth)
      const approvals = backendStore.getPendingActions(auth, account.name)

      // Reuse the existing RAG pipeline (no duplicate vector DB)
      const corpus = buildRagCorpus({
        accounts: [account],
        evidence,
        interactions,
        risksOpportunities,
        approvals,
        customDocs: getCustomRagDocuments(),
      })

      const retrieved = retrieveRelevantChunks(query, corpus, {
        topK,
        activeCustomer: account.name,
      })

      return {
        account_name: account.name,
        query,
        total_indexed_chunks: corpus.length,
        matched_chunks: retrieved.map((c) => ({
          id: c.id,
          citation_code: c.citationCode,
          title: c.title,
          source: c.source,
          category: c.category,
          score: Number(c.score.toFixed(3)),
          content: sanitizeUntrustedExternalText(c.content, c.source),
        })),
      }
    }

    case "get_product_usage": {
      const accountName = String(cleanArgs.account_name || "").trim()
      const limit =
        typeof cleanArgs.limit === "number" ? cleanArgs.limit : 20
      if (!accountName) {
        throw new Error("Validation Error: account_name is required")
      }
      return backendStore.getProductUsageForAccount(auth, accountName, limit)
    }

    case "propose_followup_task": {
      const customer = String(cleanArgs.customer || "").trim()
      const action = String(cleanArgs.action || "").trim()
      const refs = String(cleanArgs.refs || "").trim()
      const proposedChange = String(cleanArgs.proposed_change || "").trim()
      const description = String(cleanArgs.description || "").trim()

      if (!customer || !action || !refs || !proposedChange || !description) {
        throw new Error(
          "Validation Error: customer, action, refs, proposed_change, and description are all required",
        )
      }

      const res = backendStore.proposeFollowupTask(auth, {
        customer,
        action,
        owner: cleanArgs.owner ? String(cleanArgs.owner) : undefined,
        refs,
        proposed_change: proposedChange,
        description,
        intended_operation: cleanArgs.intended_operation as
          | "create_followup_task"
          | "send_customer_email"
          | "create_calendar_meeting"
          | "update_crm_field"
          | undefined,
        recipient_email: cleanArgs.recipient_email
          ? String(cleanArgs.recipient_email)
          : undefined,
        email_subject: cleanArgs.email_subject
          ? String(cleanArgs.email_subject)
          : undefined,
        email_body: cleanArgs.email_body
          ? String(cleanArgs.email_body)
          : undefined,
        idempotency_key: cleanArgs.idempotency_key
          ? String(cleanArgs.idempotency_key)
          : undefined,
      })

      return {
        created: res.created,
        duplicate: res.duplicate,
        status: "pending",
        executed_externally: false,
        governance_notice:
          "Proposal queued in Approval Center with status='pending'. Human approval is strictly required before external execution.",
        proposal: {
          id: res.proposal.id,
          customer: res.proposal.customer,
          action: res.proposal.action,
          owner: res.proposal.owner,
          refs: res.proposal.refs,
          proposed_change: res.proposal.proposed_change,
          intended_operation: res.proposal.intended_operation,
          payload_hash: res.proposal.payload_hash,
          status: res.proposal.status,
        },
      }
    }

    case "get_pending_actions": {
      const customer = cleanArgs.customer
        ? String(cleanArgs.customer).trim()
        : undefined
      const pending = backendStore.getPendingActions(auth, customer)
      return {
        count: pending.length,
        pending_actions: pending.map((p) => ({
          id: p.id,
          customer: p.customer,
          action: p.action,
          owner: p.owner,
          refs: p.refs,
          proposed_change: p.proposed_change,
          intended_operation: p.intended_operation,
          payload_hash: p.payload_hash,
          status: p.status,
          submitted_label: p.submitted_label,
        })),
      }
    }

    default:
      throw new Error(`Unknown DealFlow MCP tool: "${toolName}"`)
  }
}

/**
 * Creates an official @modelcontextprotocol/sdk Server instance exposing the 6 DealFlow AI tools.
 */
export function createDealFlowMcpServer(): Server {
  const server = new Server(
    {
      name: "dealflow-ai-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: DEALFLOW_MCP_TOOLS,
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name
    const rawArgs = (request.params.arguments || {}) as Record<string, unknown>
    try {
      const result = await executeDealFlowMcpTool(toolName, rawArgs)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: false,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: msg }),
          },
        ],
        isError: true,
      }
    }
  })

  return server
}

/**
 * Connects an official @modelcontextprotocol/sdk Client to the DealFlow MCP Server over InMemoryTransport.
 */
export async function createConnectedDealFlowMcpPair(): Promise<{
  server: Server
  client: Client
}> {
  const server = createDealFlowMcpServer()
  const client = new Client(
    {
      name: "dealflow-central-mcp-gateway-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  )
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])
  return { server, client }
}

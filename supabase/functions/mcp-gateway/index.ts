// ============================================================================
// DealFlow AI — Supabase Edge Function: Central MCP Gateway & Approval Guard
// Deploy with: npx supabase functions deploy mcp-gateway
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dealflow-user-id, x-dealflow-workspace-id, x-ingestion-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

const ALLOWED_MCP_TOOLS = new Set([
  "get_account_summary",
  "get_customer_signals",
  "search_customer_evidence",
  "get_product_usage",
  "propose_followup_task",
  "get_pending_actions",
  "gmail_list_customer_threads",
  "calendar_list_customer_events",
  "salesforce_query_accounts",
])

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const authHeader = req.headers.get("Authorization") ?? ""

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    })

    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "discover"

    if (req.method === "GET" && action === "discover") {
      return new Response(
        JSON.stringify({
          ok: true,
          gateway: "dealflow-supabase-edge-mcp-gateway",
          allowedTools: Array.from(ALLOWED_MCP_TOOLS),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const userId =
      req.headers.get("x-dealflow-user-id") || body.userId || ""
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: userId required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (body.toolName) {
      if (!ALLOWED_MCP_TOOLS.has(body.toolName)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Tool "${body.toolName}" is not permitted by MCP Gateway allowlist`,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }

      if (body.toolName === "get_account_summary") {
        const { data, error } = await supabase
          .from("accounts")
          .select("*")
          .ilike("name", String(body.args?.account_name || ""))
          .maybeSingle()

        if (error || !data) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: error?.message || "Account not found or access denied",
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          )
        }
        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    return new Response(
      JSON.stringify({ ok: true, received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

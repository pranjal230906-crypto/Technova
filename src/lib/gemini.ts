import type {
  AccountRecord,
  ApprovalRecord,
  EvidenceRecord,
  InteractionRecord,
  RiskOpportunityRecord,
} from "./supabase"
import {
  buildRagCorpus,
  formatRetrievedContextForPrompt,
  getCustomRagDocuments,
  retrieveRelevantChunks,
  type CustomRagDocument,
  type RetrievedChunk,
} from "./rag"

export interface GeminiConfig {
  apiKey: string
  model: string
  endpoint: string
  isConfigured: boolean
}

export interface AccountAIInsight {
  riskLevel: string
  summary: string
  whyItMatters: string
  suggestedNextStep: string
  recommendedActions: {
    title: string
    reason: string
    refs: string
    status: string
  }[]
  retrievedChunks?: RetrievedChunk[]
}

export interface RagCopilotResponse {
  answer: string
  thinking: string
  thinkingSteps: string[]
  thinkingDurationSec: number
  retrievedChunks: RetrievedChunk[]
  totalIndexedChunks: number
}

const STORAGE_GEMINI_KEY = "technova_gemini_api_key"
const STORAGE_GEMINI_MODEL = "technova_gemini_model"
const LEGACY_GROQ_KEY = "technova_groq_api_key"
const LEGACY_GROK_KEY = "technova_grok_api_key"

export const GEMINI_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models"
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"

export const GEMINI_MODELS: { id: string; label: string }[] = [
  {
    id: "gemini-3.8-flash",
    label: "DF-Core 3.8 Flash (Recommended · Fast Reasoning)",
  },
  {
    id: "gemini-2.5-flash",
    label: "DF-Core 2.5 Flash (Balanced)",
  },
  {
    id: "gemini-2.5-pro",
    label: "DF-Core 2.5 Pro (Deep Analysis)",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "DF-Core 2.5 Lite (Low Latency)",
  },
]

const RETIRED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
])

function normalizeGeminiModel(model?: string | null): string {
  const trimmed = (model || "").trim().replace(/^models\//i, "")
  if (
    !trimmed ||
    !trimmed.toLowerCase().startsWith("gemini-") ||
    RETIRED_MODELS.has(trimmed.toLowerCase())
  ) {
    return DEFAULT_GEMINI_MODEL
  }
  return trimmed
}

export function getGeminiConfig(): GeminiConfig {
  const envKey = (
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || ""
  ).trim()
  const envModel = (
    (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || ""
  ).trim()

  const storedKey =
    typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_GEMINI_KEY)?.trim() || ""
      : ""
  const storedModel =
    typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_GEMINI_MODEL)?.trim() || ""
      : ""

  const isPlaceholderEnv =
    !envKey ||
    envKey.includes("your_gemini_api_key") ||
    envKey.includes("your-gemini-api-key") ||
    envKey.startsWith("gsk_")

  // Prioritize key saved in the UI modal (storedKey), then valid .env key
  const apiKey = storedKey || (!isPlaceholderEnv ? envKey : "")
  const model = normalizeGeminiModel(
    storedModel || envModel || DEFAULT_GEMINI_MODEL,
  )

  return {
    apiKey,
    model,
    endpoint: `${GEMINI_ENDPOINT_BASE}/${model}:generateContent`,
    isConfigured: Boolean(apiKey && apiKey.length > 10),
  }
}

export function saveGeminiConfig(apiKey: string, model?: string) {
  if (typeof window === "undefined") return
  const resolvedModel = normalizeGeminiModel(model)

  window.localStorage.setItem(STORAGE_GEMINI_KEY, apiKey.trim())
  window.localStorage.setItem(STORAGE_GEMINI_MODEL, resolvedModel)
  window.localStorage.removeItem(LEGACY_GROQ_KEY)
  window.localStorage.removeItem(LEGACY_GROK_KEY)
}

export function clearGeminiConfig() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_GEMINI_KEY)
  window.localStorage.removeItem(STORAGE_GEMINI_MODEL)
  window.localStorage.removeItem(LEGACY_GROQ_KEY)
  window.localStorage.removeItem(LEGACY_GROK_KEY)
}

export async function fetchAvailableGeminiModels(
  apiKey: string,
): Promise<{ id: string; label: string }[]> {
  try {
    const res = await fetch(
      `${GEMINI_ENDPOINT_BASE}?key=${encodeURIComponent(apiKey.trim())}`,
    )
    if (!res.ok) return GEMINI_MODELS
    const data = await res.json()
    const rawModels: Array<{
      name?: string
      displayName?: string
      supportedGenerationMethods?: string[]
    }> = Array.isArray(data?.models) ? data.models : []

    const usable = rawModels
      .filter((m) => {
        const id = (m.name || "").replace(/^models\//i, "")
        const supportsGenerate =
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent")
        const isTextGemini =
          id.startsWith("gemini-") &&
          !id.includes("embedding") &&
          !id.includes("imagen") &&
          !id.includes("veo") &&
          !id.includes("tts") &&
          !id.includes("audio") &&
          !RETIRED_MODELS.has(id.toLowerCase())
        return supportsGenerate && isTextGemini
      })
      .map((m) => {
        const id = (m.name || "").replace(/^models\//i, "")
        return {
          id,
          label: m.displayName || id,
        }
      })

    return usable.length > 0 ? usable : GEMINI_MODELS
  } catch {
    return GEMINI_MODELS
  }
}

async function requestGeminiModel(
  model: string,
  apiKey: string,
  systemText: string,
  contents: { role: "user" | "model"; parts: { text: string }[] }[],
  temperature: number,
): Promise<Response> {
  const cleanModel = model.replace(/^models\//i, "")
  const url = `${GEMINI_ENDPOINT_BASE}/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const payload: Record<string, unknown> = {
    contents:
      contents.length > 0
        ? contents
        : [{ role: "user", parts: [{ text: "Hello" }] }],
    generationConfig: {
      temperature,
    },
  }

  if (systemText) {
    payload.systemInstruction = {
      parts: [{ text: systemText }],
    }
  }

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const errJson = await response.json()
    return (
      errJson?.error?.message ||
      errJson?.message ||
      JSON.stringify(errJson)
    )
  } catch {
    return (await response.text()) || `HTTP ${response.status}`
  }
}

export async function callGeminiChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: {
    temperature?: number
    customApiKey?: string
    customModel?: string
  },
): Promise<string> {
  const cfg = getGeminiConfig()
  const apiKey = (options?.customApiKey || cfg.apiKey || "").trim()
  if (!apiKey) {
    throw new Error(
      "AI Engine API key is not configured. Open 'Ask AI Copilot' -> 'Engine Settings' to save your key.",
    )
  }

  const primaryModel = normalizeGeminiModel(options?.customModel || cfg.model)
  const temperature = options?.temperature ?? 0.3

  const systemMessages = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    }))

  let response = await requestGeminiModel(
    primaryModel,
    apiKey,
    systemMessages,
    contents,
    temperature,
  )

  if (!response.ok) {
    const firstErr = await parseErrorMessage(response)
    const isModelUnavailable =
      response.status === 404 ||
      /no longer available|not found|not supported|deprecated|update your code to use/i.test(
        firstErr,
      )

    if (isModelUnavailable) {
      const suggestedMatch = firstErr.match(/models\/(gemini-[a-zA-Z0-9.-]+)/i)
      const candidates: string[] = []
      if (suggestedMatch?.[1]) {
        candidates.push(suggestedMatch[1])
      }
      for (const fallback of [
        "gemini-3.8-flash",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
      ]) {
        if (fallback !== primaryModel && !candidates.includes(fallback)) {
          candidates.push(fallback)
        }
      }
      const liveModels = await fetchAvailableGeminiModels(apiKey)
      for (const m of liveModels) {
        if (m.id !== primaryModel && !candidates.includes(m.id)) {
          candidates.push(m.id)
        }
      }

      for (const candidateModel of candidates.slice(0, 5)) {
        const retryRes = await requestGeminiModel(
          candidateModel,
          apiKey,
          systemMessages,
          contents,
          temperature,
        )
        if (retryRes.ok) {
          response = retryRes
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_GEMINI_MODEL, candidateModel)
          }
          break
        }
      }

      if (!response.ok) {
        throw new Error(`AI Engine Error: ${firstErr}`)
      }
    } else {
      throw new Error(`AI Engine Error: ${firstErr}`)
    }
  }

  const data = await response.json()
  const rawParts: Array<{ text?: string; thought?: boolean }> =
    Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts
      : []

  const nonThoughtParts = rawParts.filter((p) => !p.thought && p.text)
  const partsToUse = nonThoughtParts.length > 0 ? nonThoughtParts : rawParts
  const content = partsToUse.map((p) => p.text || "").join("")

  if (!content.trim()) {
    throw new Error("Empty response from DealFlow AI Engine.")
  }
  return content.trim()
}

export async function verifyGeminiConnection(
  apiKey: string,
  model?: string,
): Promise<{ ok: boolean; message: string; activeModel?: string }> {
  try {
    const resolvedModel = normalizeGeminiModel(model)
    const reply = await callGeminiChat(
      [
        {
          role: "system",
          content: "Reply with a short confirmation message under 12 words.",
        },
        {
          role: "user",
          content: "Confirm DealFlow AI Engine connection is active.",
        },
      ],
      {
        temperature: 0.1,
        customApiKey: apiKey,
        customModel: resolvedModel,
      },
    )
    const finalModel =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_GEMINI_MODEL)
        : null) || resolvedModel
    saveGeminiConfig(apiKey, finalModel)
    return {
      ok: true,
      activeModel: finalModel,
      message: `DealFlow AI Engine connected! Status: "${reply}"`,
    }
  } catch (err: unknown) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Failed to connect to DealFlow AI Engine.",
    }
  }
}

export async function generateAccountRiskInsight(
  account: AccountRecord,
  evidence: EvidenceRecord[],
  interactions: InteractionRecord[],
  customDocs?: CustomRagDocument[],
): Promise<AccountAIInsight> {
  const corpus = buildRagCorpus({
    accounts: [account],
    evidence,
    interactions,
    risksOpportunities: [],
    approvals: [],
    customDocs: customDocs ?? getCustomRagDocuments(),
  })

  const retrievedChunks = retrieveRelevantChunks(
    `${account.name} ${account.status} ${account.signal} renewal risk usage champion action`,
    corpus,
    { topK: 6, activeCustomer: account.name },
  )

  const ragContextText = formatRetrievedContextForPrompt(retrievedChunks)

  const systemPrompt = `You are DealFlow AI, an autonomous RevOps intelligence engine with strict human-in-the-loop governance.
Analyze the customer account using ONLY the verified context sources below. Do not mention any third-party AI model or backend architecture names. Ground every claim in the source citation codes (e.g., [E1], [E2], [KB-1], [PB-1]).
Return ONLY valid JSON (no markdown code fences) matching this exact schema:
{
  "riskLevel": "High risk" | "Medium risk" | "Expansion ready" | "Healthy",
  "summary": "2-3 sentences explaining account health/risk and citing source codes like [E1], [KB-1]",
  "whyItMatters": "2 sentences explaining the commercial impact before renewal",
  "suggestedNextStep": "1 concrete, trackable action for the account owner with a timeframe",
  "recommendedActions": [
    {
      "title": "Short action title",
      "reason": "Brief rationale",
      "refs": "E1, KB-1",
      "status": "Ready for review"
    }
  ]
}`

  const userPrompt = `Target Customer Account: ${account.name} (${account.arr} ARR, Owner: ${account.owner}, Renewal: ${account.renewal})

Verified Context Sources:
${ragContextText}`

  const raw = await callGeminiChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2 },
  )

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const cleaned = (jsonMatch ? jsonMatch[0] : raw)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()

  const parsed = JSON.parse(cleaned) as AccountAIInsight
  return {
    riskLevel: parsed.riskLevel || account.status,
    summary:
      parsed.summary ||
      `${account.name} shows ${account.signal}. Review evidence E1-E4.`,
    whyItMatters:
      parsed.whyItMatters ||
      "Timely intervention before renewal protects ARR and clarifies customer priorities.",
    suggestedNextStep:
      parsed.suggestedNextStep ||
      `${account.action} for ${account.owner}, due tomorrow.`,
    recommendedActions:
      Array.isArray(parsed.recommendedActions) &&
      parsed.recommendedActions.length > 0
        ? parsed.recommendedActions.slice(0, 4)
        : [
            {
              title: account.action,
              reason: "Restore momentum before renewal",
              refs: "E1, E3, E4",
              status: "Ready for review",
            },
          ],
    retrievedChunks,
  }
}

export async function generateFollowUpEmail(
  account: AccountRecord,
  evidence: EvidenceRecord[],
  tone: "executive" | "value" | "urgent" = "executive",
  customDocs?: CustomRagDocument[],
): Promise<{ subject: string; body: string }> {
  const corpus = buildRagCorpus({
    accounts: [account],
    evidence,
    interactions: [],
    risksOpportunities: [],
    approvals: [],
    customDocs: customDocs ?? getCustomRagDocuments(),
  })

  const retrievedChunks = retrieveRelevantChunks(
    `${account.name} ${account.signal} follow-up email renewal QBR champion`,
    corpus,
    { topK: 5, activeCustomer: account.name },
  )

  const ragContextText = formatRetrievedContextForPrompt(retrievedChunks)

  const toneInstructions = {
    executive:
      "Warm, consultative executive check-in focused on strategic alignment ahead of renewal.",
    value:
      "Value-driven and helpful, offering an adoption workshop or enablement session to address usage trends.",
    urgent:
      "Direct, concise, and time-sensitive check-in to establish a clear next step before the upcoming renewal date.",
  }[tone]

  const systemPrompt = `You are DealFlow AI drafting a customer follow-up email for a RevOps account owner.
Use only the verified context sources below. Do not fabricate metrics or mention internal AI model names.
Return ONLY valid JSON (no markdown code fences) with this exact structure:
{
  "subject": "Email subject line",
  "body": "Full email body with greeting and sign-off from the account owner"
}`

  const userPrompt = `Account: ${account.name}
Account Owner: ${account.owner}
Champion Email: ${account.champion_email || "alex.morgan@acme.example"}
Renewal Date: ${account.renewal} (${account.renewal_days || "43 days"})
Desired Tone: ${toneInstructions}

Verified Context Sources:
${ragContextText}`

  const raw = await callGeminiChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.4 },
  )

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const cleaned = (jsonMatch ? jsonMatch[0] : raw)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()

  const parsed = JSON.parse(cleaned) as { subject: string; body: string }
  return {
    subject:
      parsed.subject || `Checking in on ${account.name}'s goals before renewal`,
    body: parsed.body || "",
  }
}

export async function askGeminiCopilotWithRAG(
  question: string,
  context: {
    accounts: AccountRecord[]
    evidence?: EvidenceRecord[]
    interactions?: InteractionRecord[]
    approvals: ApprovalRecord[]
    risksOpportunities: RiskOpportunityRecord[]
    customDocs?: CustomRagDocument[]
    activeCustomer?: string
  },
  options?: {
    customApiKey?: string
    customModel?: string
    topK?: number
  },
): Promise<RagCopilotResponse> {
  const startMs = Date.now()
  const corpus = buildRagCorpus({
    accounts: context.accounts,
    evidence: context.evidence ?? [],
    interactions: context.interactions ?? [],
    risksOpportunities: context.risksOpportunities,
    approvals: context.approvals,
    customDocs: context.customDocs ?? getCustomRagDocuments(),
  })

  const retrievedChunks = retrieveRelevantChunks(question, corpus, {
    topK: options?.topK ?? 6,
    activeCustomer: context.activeCustomer,
  })

  const ragContextBlock = formatRetrievedContextForPrompt(retrievedChunks)

  const systemPrompt = `You are the DealFlow AI Copilot.
You must answer the operator's question strictly using the Verified Knowledge Sources provided below.
Rules:
1. Never mention internal model providers or backend implementation names. Present yourself strictly as DealFlow AI.
2. Start your output with a <thinking>...</thinking> block containing 4 concise bullet points ("- ...") showing your internal step-by-step reasoning:
   - Step 1: Deconstructing the operator's prompt and identifying target account(s) & ARR/renewal context.
   - Step 2: Evaluating the highest-scoring evidence chunks (${retrievedChunks.map((c) => `[${c.citationCode}]`).join(", ") || "[E1]"}).
   - Step 3: Weighing churn risk vs. expansion signals and commercial urgency.
   - Step 4: Formulating actionable RevOps next steps and verifying human-in-the-loop governance [PB-3].
3. Immediately after </thinking>, write your final answer for the operator.
4. Cite the bracketed source codes inline (e.g., [E1], [ACC-1], [KB-1], [PB-1], [RO-1]) for every claim you make.
5. Keep the final answer concise, structured, and actionable for RevOps operators.

Verified Knowledge Sources (${retrievedChunks.length} matched):
${ragContextBlock}`

  const rawOutput = await callGeminiChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    {
      temperature: 0.25,
      customApiKey: options?.customApiKey,
      customModel: options?.customModel,
    },
  )

  // Ensure a smooth minimum thinking duration so live progressive thinking steps are visible
  const elapsedMs = Date.now() - startMs
  if (elapsedMs < 2200) {
    await new Promise((r) => setTimeout(r, 2200 - elapsedMs))
  }
  const thinkingDurationSec = Math.max(
    1.8,
    Math.round(((Date.now() - startMs) / 1000) * 10) / 10,
  )

  const thinkMatch = rawOutput.match(/<thinking>([\s\S]*?)<\/thinking>/i)
  const rawThinking = thinkMatch?.[1]?.trim() || ""
  const cleanAnswer =
    rawOutput.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim() ||
    rawOutput.trim()

  const activeCustomerLabel = context.activeCustomer || "active portfolio"
  const topCitations = retrievedChunks
    .slice(0, 4)
    .map((c) => `[${c.citationCode}] ${c.title}`)
    .join(", ")

  const defaultSteps = [
    `Parsed operator intent for "${question.slice(0, 70)}${question.length > 70 ? "..." : ""}" scoped to ${activeCustomerLabel}.`,
    `Retrieved ${retrievedChunks.length} relevant sources out of ${corpus.length} indexed records (${topCitations || "verified CRM & telemetry records"}).`,
    `Cross-referenced product usage telemetry, QBR sentiment, and renewal timeline to isolate root-cause commercial signals.`,
    `Validated recommended play against human-in-the-loop Approval Center policy [PB-3] before presenting final answer.`,
  ]

  const parsedSteps = rawThinking
    ? rawThinking
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter((line) => line.length > 8)
    : []

  const thinkingSteps = parsedSteps.length >= 2 ? parsedSteps : defaultSteps
  const thinking =
    rawThinking || thinkingSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")

  return {
    answer: cleanAnswer,
    thinking,
    thinkingSteps,
    thinkingDurationSec,
    retrievedChunks,
    totalIndexedChunks: corpus.length,
  }
}

export async function askGeminiCopilot(
  question: string,
  context: {
    accounts: AccountRecord[]
    approvals: ApprovalRecord[]
    risksOpportunities: RiskOpportunityRecord[]
  },
  options?: {
    customApiKey?: string
    customModel?: string
  },
): Promise<string> {
  const res = await askGeminiCopilotWithRAG(question, context, options)
  return res.answer
}

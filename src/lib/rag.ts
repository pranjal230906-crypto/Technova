import type {
  AccountRecord,
  ApprovalRecord,
  AuditLogRecord,
  EvidenceRecord,
  InteractionRecord,
  RiskOpportunityRecord,
} from "./supabase.ts"

export type RagCategory =
  | "evidence"
  | "account"
  | "interaction"
  | "risk_opportunity"
  | "playbook"
  | "custom_doc"
  | "governance"

export interface RagChunk {
  id: string
  citationCode: string
  title: string
  content: string
  source: string
  category: RagCategory
  customer?: string
  createdAt?: string
  embedding?: number[]
}

export interface RetrievedChunk extends RagChunk {
  score: number
  semanticScore: number
  lexicalScore: number
  matchedTerms: string[]
}

export interface CustomRagDocument {
  id: string
  citationCode: string
  title: string
  customer: string
  source: string
  content: string
  created_at: string
}

const STORAGE_CUSTOM_RAG_DOCS = "technova_rag_custom_docs_v1"
const EMBEDDING_CACHE = new Map<string, number[]>()

export const DEFAULT_PLAYBOOK_CHUNKS: RagChunk[] = [
  {
    id: "playbook-renewal-rescue",
    citationCode: "PB-1",
    title: "RevOps Playbook: High-Risk Renewal Rescue (< 60 Days)",
    source: "DealFlow RevOps Playbook",
    category: "playbook",
    content:
      "When an Enterprise account is within 60 days of renewal and shows declining product usage (>20% drop) or champion silence (>14 days without reply): (1) Create a high-priority follow-up task for the Account Owner due within 24 hours, (2) Draft an executive alignment email referencing verified usage telemetry, (3) Offer a targeted adoption & enablement workshop, and (4) Require human approval in the Approval Center before executing CRM or email changes.",
  },
  {
    id: "playbook-expansion",
    citationCode: "PB-2",
    title: "RevOps Playbook: Seat & Tier Expansion Triggers",
    source: "DealFlow RevOps Playbook",
    category: "playbook",
    content:
      "When an account exceeds 85% license seat utilization or increases weekly active usage by >15% QoQ (e.g. Northwind Health, Globex): (1) Flag as Expansion Opportunity, (2) Prepare an ROI & capacity review deck citing usage telemetry, and (3) Propose a multi-year or tier upgrade package for Account Owner review.",
  },
  {
    id: "playbook-governance",
    citationCode: "PB-3",
    title: "Human-in-the-Loop Governance & Evidence Grounding Policy",
    source: "DealFlow Safety Policy",
    category: "governance",
    content:
      "Every AI insight, risk score, and recommended CRM/email action must cite verifiable evidence IDs (E1-E6, ACC-*, INT-*, KB-*, PB-*). Consequential actions (sending external customer emails, modifying CRM renewal stages, reassigning tasks) cannot execute autonomously; they must be queued in the Approval Center and logged in the governance audit trail upon human approval or rejection.",
  },
]

export const DEFAULT_CUSTOM_RAG_DOCS: CustomRagDocument[] = [
  {
    id: "kb-acme-qbr-notes",
    citationCode: "KB-1",
    title: "Acme Corp Q1 Executive QBR Transcript Summary",
    customer: "Acme Corporation",
    source: "Uploaded QBR Notes",
    content:
      "During the March 25 QBR with Acme Corporation ($84K ARR, owner Maya Chen), VP of Ops Alex Morgan mentioned their analytics team is restructuring and two power users moved to a new department. They requested a guided workflow template for their new onboarding cohort before deciding on the May 28 renewal.",
    created_at: "2025-03-26",
  },
  {
    id: "kb-northwind-expansion-notes",
    citationCode: "KB-2",
    title: "Northwind Health Clinical Department Expansion Request",
    customer: "Northwind Health",
    source: "Customer Success Call Note",
    content:
      "Northwind Health ($126K ARR, owner Liam Patel) is onboarding 25 additional clinical coordinators next month. Current license capacity is at 94% utilization. Customer champion requested pricing for an Enterprise Plus seat bundle ahead of their Jun 14, 2025 renewal.",
    created_at: "2025-04-04",
  },
]

export function getCustomRagDocuments(): CustomRagDocument[] {
  if (typeof window === "undefined") return DEFAULT_CUSTOM_RAG_DOCS
  try {
    const raw = window.localStorage.getItem(STORAGE_CUSTOM_RAG_DOCS)
    if (!raw) {
      window.localStorage.setItem(
        STORAGE_CUSTOM_RAG_DOCS,
        JSON.stringify(DEFAULT_CUSTOM_RAG_DOCS),
      )
      return DEFAULT_CUSTOM_RAG_DOCS
    }
    const parsed = JSON.parse(raw) as CustomRagDocument[]
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_CUSTOM_RAG_DOCS
  } catch {
    return DEFAULT_CUSTOM_RAG_DOCS
  }
}

export function saveCustomRagDocuments(docs: CustomRagDocument[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_CUSTOM_RAG_DOCS, JSON.stringify(docs))
}

export function addCustomRagDocument(input: {
  title: string
  customer: string
  source: string
  content: string
}): CustomRagDocument[] {
  const existing = getCustomRagDocuments()
  const nextNum = existing.length + 1
  const newDoc: CustomRagDocument = {
    id: `kb-custom-${Date.now()}`,
    citationCode: `KB-${nextNum}`,
    title: input.title.trim(),
    customer: input.customer.trim() || "All Accounts",
    source: input.source.trim() || "Custom Knowledge Base",
    content: input.content.trim(),
    created_at: new Date().toISOString().slice(0, 10),
  }
  const updated = [newDoc, ...existing]
  saveCustomRagDocuments(updated)
  return updated
}

export function deleteCustomRagDocument(id: string): CustomRagDocument[] {
  const existing = getCustomRagDocuments()
  const updated = existing.filter((d) => d.id !== id)
  saveCustomRagDocuments(updated)
  return updated
}

/**
 * Splits longer custom documents into overlapping semantic chunks so RAG retrieval stays precise.
 */
export function chunkDocumentText(
  text: string,
  maxChars = 550,
  overlapChars = 90,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (normalized.length <= maxChars) return [normalized]

  const paragraphs = normalized.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).trim().length <= maxChars) {
      current = current ? `${current}\n\n${para}` : para
    } else {
      if (current) chunks.push(current.trim())
      if (para.length <= maxChars) {
        current = para
      } else {
        // Slice long paragraph with overlap
        let start = 0
        while (start < para.length) {
          const slice = para.slice(start, start + maxChars)
          chunks.push(slice.trim())
          start += maxChars - overlapChars
        }
        current = ""
      }
    }
  }
  if (current.trim()) {
    chunks.push(current.trim())
  }
  return chunks
}

/**
 * Builds the complete unified RAG knowledge corpus from live Supabase/app state + playbooks + custom uploaded docs.
 */
export function buildRagCorpus(params: {
  accounts: AccountRecord[]
  evidence: EvidenceRecord[]
  interactions: InteractionRecord[]
  risksOpportunities: RiskOpportunityRecord[]
  approvals: ApprovalRecord[]
  auditLogs?: AuditLogRecord[]
  customDocs?: CustomRagDocument[]
}): RagChunk[] {
  const chunks: RagChunk[] = []

  // 1. Verified Evidence chunks (E1, E2, ...)
  params.evidence.forEach((ev) => {
    chunks.push({
      id: `evidence-${ev.code}`,
      citationCode: ev.code,
      title: `Verified Evidence ${ev.code}: ${ev.title}`,
      content: `Evidence [${ev.code}] for ${ev.account_name || "Acme Corporation"}: ${ev.title}. Source: ${ev.source}. Verification timestamp: ${ev.verified_date}.`,
      source: ev.source,
      category: "evidence",
      customer: ev.account_name || "Acme Corporation",
      createdAt: ev.verified_date,
    })
  })

  // 2. Customer Account profile chunks (ACC-1, ACC-2, ...)
  params.accounts.forEach((acc, idx) => {
    chunks.push({
      id: `account-${acc.name}`,
      citationCode: `ACC-${idx + 1}`,
      title: `Account Profile: ${acc.name} (${acc.status})`,
      content: `Customer Account: ${acc.name} (${acc.tier || "Enterprise"}). Health Status: ${acc.status}. ARR: ${acc.arr}. Account Owner: ${acc.owner}. Renewal Date: ${acc.renewal} (${acc.renewal_days || "upcoming"}). Primary Signal: ${acc.signal}. Product Usage: ${acc.product_usage || "Monitored"} (${acc.product_usage_note || acc.signal}). Champion Status: ${acc.champion_status || "Active"} (${acc.champion_note || ""}). Champion Email: ${acc.champion_email || "N/A"}. Follow-up Status: ${acc.followup_status || "Pending"} (${acc.followup_note || acc.action}). Recommended Next Action: ${acc.action}.`,
      source: "CRM & Account Telemetry",
      category: "account",
      customer: acc.name,
    })
  })

  // 3. Customer Interaction timeline chunks (INT-1, INT-2, ...)
  params.interactions.forEach((inter, idx) => {
    chunks.push({
      id: `interaction-${idx + 1}`,
      citationCode: `INT-${idx + 1}`,
      title: `Interaction (${inter.date_label}): ${inter.title}`,
      content: `Customer Interaction for ${inter.account_name || "Acme Corporation"} on ${inter.date_label}: ${inter.title} (${inter.meta}). Details: ${inter.note}. Alert status: ${inter.is_alert ? "Critical Risk Alert" : "Normal interaction"}.`,
      source: inter.meta,
      category: "interaction",
      customer: inter.account_name || "Acme Corporation",
      createdAt: inter.date_label,
    })
  })

  // 4. Portfolio Risks & Growth Opportunities chunks (RO-1, RO-2, ...)
  params.risksOpportunities.forEach((ro, idx) => {
    chunks.push({
      id: `risk-opp-${idx + 1}`,
      citationCode: `RO-${idx + 1}`,
      title: `${ro.category === "risk" ? "Churn Risk" : "Expansion Opportunity"}: ${ro.customer}`,
      content: `${ro.category === "risk" ? "Churn Risk" : "Expansion Opportunity"} for ${ro.customer} (${ro.value_label}): ${ro.signal}. Priority/Impact: ${ro.badge_label}. Supporting verified evidence IDs: ${ro.refs}.`,
      source: "Portfolio Risk & Opportunity Scanner",
      category: "risk_opportunity",
      customer: ro.customer,
    })
  })

  // 5. Pending & Historical Approvals chunks (APR-1, APR-2, ...)
  params.approvals.forEach((app, idx) => {
    chunks.push({
      id: `approval-${idx + 1}`,
      citationCode: `APR-${idx + 1}`,
      title: `Approval Queue (${app.status}): ${app.action} for ${app.customer}`,
      content: `Governance Approval Item for ${app.customer}: Action "${app.action}" assigned to ${app.owner}. Status: ${app.status}. Supporting Evidence: ${app.refs}. Why recommended: ${app.description}. Proposed CRM/Email change: ${app.proposed_change}.`,
      source: "Approval Center",
      category: "governance",
      customer: app.customer,
    })
  })

  // 6. Custom Knowledge Base documents (chunked if long)
  const customDocs = params.customDocs ?? getCustomRagDocuments()
  customDocs.forEach((doc) => {
    const subChunks = chunkDocumentText(doc.content)
    subChunks.forEach((textPiece, partIdx) => {
      const code =
        subChunks.length > 1
          ? `${doc.citationCode}.${partIdx + 1}`
          : doc.citationCode
      chunks.push({
        id: `${doc.id}-part-${partIdx + 1}`,
        citationCode: code,
        title:
          subChunks.length > 1
            ? `${doc.title} (Part ${partIdx + 1})`
            : doc.title,
        content: `[${code}] (${doc.customer}) ${doc.title}: ${textPiece}`,
        source: doc.source,
        category: "custom_doc",
        customer: doc.customer === "All Accounts" ? undefined : doc.customer,
        createdAt: doc.created_at,
      })
    })
  })

  // 7. Standard RevOps Playbooks & Governance SOPs
  chunks.push(...DEFAULT_PLAYBOOK_CHUNKS)

  return chunks
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "what",
  "why",
  "how",
  "who",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "but",
  "can",
  "will",
  "should",
  "would",
  "could",
  "our",
  "their",
  "about",
  "into",
  "more",
  "some",
  "such",
  "than",
  "then",
  "them",
  "these",
  "they",
  "which",
  "when",
  "where",
  "show",
  "tell",
  "give",
  "please",
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}

/**
 * Generates a 128-dimensional semantic feature vector using character trigrams + domain concept projections.
 * Used for instant zero-latency vector similarity and combined with Gemini embeddings when available.
 */
function computeLocalSemanticVector(text: string, dims = 128): number[] {
  const vec = new Array<number>(dims).fill(0)
  const clean = text.toLowerCase()
  const tokens = tokenize(clean)

  // Concept cluster boosting for RevOps semantic synonyms
  const semanticClusters: Array<[RegExp, number]> = [
    [/churn|risk|declin|drop|at-risk|cancel|leave|danger|red/g, 0],
    [/renew|contract|expir|upcoming|days|may|jun|jul|aug/g, 1],
    [/usage|active|telemetry|adoption|login|seat|utilization|engagement/g, 2],
    [/champion|reply|silent|email|contact|morgan|meeting|qbr|call/g, 3],
    [/expand|expansion|upsell|growth|opportunity|upgrade|capacity/g, 4],
    [/approv|governance|audit|human|review|reject|execute|policy/g, 5],
    [/arr|revenue|\$|budget|commercial|pricing|tier|enterprise/g, 6],
    [/action|recommend|next|step|task|follow-up|owner|maya|liam|sara/g, 7],
  ]

  for (const [regex, clusterIdx] of semanticClusters) {
    const matches = clean.match(regex)
    if (matches && matches.length > 0) {
      vec[clusterIdx] += matches.length * 2.5
    }
  }

  for (const tok of tokens) {
    let hash = 2166136261
    for (let i = 0; i < tok.length; i++) {
      hash ^= tok.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const idx = 8 + (Math.abs(hash) % (dims - 8))
    vec[idx] += 1.0

    // Character 3-grams for fuzzy/morphological matching
    for (let i = 0; i <= tok.length - 3; i++) {
      const tri = tok.slice(i, i + 3)
      let thash = 5381
      for (let j = 0; j < tri.length; j++) {
        thash = (thash * 33) ^ tri.charCodeAt(j)
      }
      const tidx = 8 + (Math.abs(thash) % (dims - 8))
      vec[tidx] += 0.35
    }
  }

  // L2 normalize
  let norm = 0
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < dims; i++) vec[i] /= norm
  return vec
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom > 0 ? dot / denom : 0
}

/**
 * Optional Google Gemini Embedding API call (`text-embedding-004`) with caching.
 * Gracefully falls back to null if unavailable so hybrid retrieval never blocks or errors.
 */
export async function fetchGeminiEmbedding(
  text: string,
  apiKey?: string,
): Promise<number[] | null> {
  if (!apiKey || apiKey.length < 10) return null
  const cacheKey = `${text.slice(0, 200)}_${text.length}`
  const cached = EMBEDDING_CACHE.get(cacheKey)
  if (cached) return cached

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(apiKey.trim())}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text.slice(0, 2000) }] },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const values = data?.embedding?.values
    if (Array.isArray(values) && values.length > 0) {
      EMBEDDING_CACHE.set(cacheKey, values)
      return values
    }
    return null
  } catch {
    return null
  }
}

/**
 * Hybrid RAG Retriever: Combines BM25 Lexical Scoring + Semantic Vector Cosine Similarity + Entity/Customer Boosting.
 */
export function retrieveRelevantChunks(
  query: string,
  corpus: RagChunk[],
  options?: {
    topK?: number
    activeCustomer?: string
  },
): RetrievedChunk[] {
  const topK = options?.topK ?? 6
  const queryTokens = tokenize(query)
  const queryVec = computeLocalSemanticVector(query)
  const queryLower = query.toLowerCase()

  // Calculate document frequencies for BM25
  const docFreq = new Map<string, number>()
  const docTokenLists = corpus.map((chunk) => {
    const toks = tokenize(`${chunk.citationCode} ${chunk.title} ${chunk.content}`)
    const unique = new Set(toks)
    unique.forEach((t) => docFreq.set(t, (docFreq.get(t) || 0) + 1))
    return toks
  })

  const avgDocLen =
    docTokenLists.reduce((sum, list) => sum + list.length, 0) /
    Math.max(corpus.length, 1)

  const k1 = 1.5
  const b = 0.75

  const scored: RetrievedChunk[] = corpus.map((chunk, idx) => {
    const docTokens = docTokenLists[idx]
    const docVec = computeLocalSemanticVector(
      `${chunk.title} ${chunk.content} ${chunk.customer || ""}`,
    )
    const semanticScore = Math.max(0, cosineSimilarity(queryVec, docVec))

    // BM25 lexical score
    let bm25 = 0
    const matchedTerms: string[] = []
    const freqMap = new Map<string, number>()
    for (const t of docTokens) {
      freqMap.set(t, (freqMap.get(t) || 0) + 1)
    }

    for (const qTok of queryTokens) {
      const tf = freqMap.get(qTok) || 0
      if (tf > 0) {
        if (!matchedTerms.includes(qTok)) matchedTerms.push(qTok)
        const df = docFreq.get(qTok) || 1
        const idf = Math.log(1 + (corpus.length - df + 0.5) / (df + 0.5))
        const num = tf * (k1 + 1)
        const denom = tf + k1 * (1 - b + b * (docTokens.length / avgDocLen))
        bm25 += idf * (num / denom)
      } else {
        // Prefix match bonus
        const partial = docTokens.find(
          (dt) => dt.startsWith(qTok) || qTok.startsWith(dt),
        )
        if (partial && qTok.length >= 4) {
          if (!matchedTerms.includes(qTok)) matchedTerms.push(qTok)
          bm25 += 0.45
        }
      }
    }

    const normalizedLexical = Math.min(1, bm25 / 6.5)

    // Entity & Customer context boost
    let contextBoost = 0
    if (
      chunk.customer &&
      queryLower.includes(chunk.customer.toLowerCase().split(" ")[0])
    ) {
      contextBoost += 0.28
      const firstWord = chunk.customer.toLowerCase().split(" ")[0]
      if (!matchedTerms.includes(firstWord)) matchedTerms.push(firstWord)
    } else if (
      options?.activeCustomer &&
      chunk.customer &&
      chunk.customer.toLowerCase() === options.activeCustomer.toLowerCase()
    ) {
      contextBoost += 0.14
    }

    // Citation code exact match boost (e.g. "E1", "KB-1", "PB-1")
    if (queryLower.includes(chunk.citationCode.toLowerCase())) {
      contextBoost += 0.35
    }

    // Combine hybrid score (normalized to [0.15, 0.99])
    const rawHybrid =
      semanticScore * 0.48 + normalizedLexical * 0.42 + contextBoost
    const finalScore = Math.min(0.99, Math.max(0.12, rawHybrid))

    return {
      ...chunk,
      score: Number(finalScore.toFixed(2)),
      semanticScore: Number(semanticScore.toFixed(2)),
      lexicalScore: Number(normalizedLexical.toFixed(2)),
      matchedTerms,
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

/**
 * Formats retrieved RAG chunks into a structured context block for the LLM prompt.
 */
export function formatRetrievedContextForPrompt(
  chunks: RetrievedChunk[],
): string {
  return chunks
    .map(
      (c, i) =>
        `Chunk #${i + 1} [${c.citationCode}] (Relevance: ${Math.round(c.score * 100)}% | Category: ${c.category} | Source: ${c.source}${c.customer ? ` | Account: ${c.customer}` : ""}):\n${c.content}`,
    )
    .join("\n\n")
}

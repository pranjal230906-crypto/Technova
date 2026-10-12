import crypto from "node:crypto"

const DEFAULT_DEV_KEY_MATERIAL =
  process.env.MCP_TOKEN_ENCRYPTION_KEY ||
  "dealflow-default-dev-key-must-override-in-prod-32b"

const OAUTH_STATE_SECRET =
  process.env.OAUTH_STATE_SIGNING_SECRET ||
  "dealflow-oauth-csrf-state-secret-key-2025"

function deriveAesKey(secretMaterial = DEFAULT_DEV_KEY_MATERIAL): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secretMaterial.trim())) {
    return Buffer.from(secretMaterial.trim(), "hex")
  }
  return crypto.createHash("sha256").update(secretMaterial).digest()
}

/**
 * Encrypts sensitive tokens (refresh tokens, access tokens, API secrets) at rest
 * using AES-256-GCM with a random 12-byte IV and 16-byte authentication tag.
 */
export function encryptSecret(plaintext: string, customKey?: string): string {
  if (!plaintext) return ""
  const key = deriveAesKey(customKey)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

/**
 * Decrypts AES-256-GCM encrypted token ciphertext.
 */
export function decryptSecret(ciphertext: string, customKey?: string): string {
  if (!ciphertext) return ""
  const parts = ciphertext.split(":")
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted token format")
  }
  const key = deriveAesKey(customKey)
  const iv = Buffer.from(parts[1], "base64")
  const authTag = Buffer.from(parts[2], "base64")
  const encrypted = Buffer.from(parts[3], "base64")
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

/**
 * Computes a deterministic SHA-256 hash of an approval action payload so
 * approvals are cryptographically bound to the exact intended operation and content.
 */
export function computeApprovalPayloadHash(payload: {
  customer: string
  action: string
  intendedOperation: string
  proposedChange: string
  recipientEmail?: string
  emailSubject?: string
  emailBody?: string
}): string {
  const canonical = JSON.stringify({
    customer: (payload.customer || "").trim(),
    action: (payload.action || "").trim(),
    intendedOperation: (payload.intendedOperation || "create_followup_task").trim(),
    proposedChange: (payload.proposedChange || "").trim(),
    recipientEmail: (payload.recipientEmail || "").trim().toLowerCase(),
    emailSubject: (payload.emailSubject || "").trim(),
    emailBody: (payload.emailBody || "").trim(),
  })
  return crypto.createHash("sha256").update(canonical).digest("hex")
}

// One-time CSRF OAuth state store with TTL
const consumedNonces = new Set<string>()

export interface OAuthStatePayload {
  userId: string
  workspaceId: string
  integration: "email" | "calendar" | "crm"
  nonce: string
  codeVerifier?: string
  issuedAt: number
  expiresAt: number
}

export function generatePkcePair(): {
  codeVerifier: string
  codeChallenge: string
} {
  const codeVerifier = crypto.randomBytes(32).toString("base64url")
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
  return { codeVerifier, codeChallenge }
}

export function createOAuthState(params: {
  userId: string
  workspaceId: string
  integration: "email" | "calendar" | "crm"
  codeVerifier?: string
  ttlMs?: number
}): string {
  const issuedAt = Date.now()
  const payload: OAuthStatePayload = {
    userId: params.userId,
    workspaceId: params.workspaceId,
    integration: params.integration,
    nonce: crypto.randomBytes(16).toString("hex"),
    codeVerifier: params.codeVerifier,
    issuedAt,
    expiresAt: issuedAt + (params.ttlMs ?? 10 * 60 * 1000),
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )
  const signature = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyOAuthState(stateToken: string): {
  valid: boolean
  payload?: OAuthStatePayload
  error?: string
} {
  if (!stateToken || !stateToken.includes(".")) {
    return { valid: false, error: "Malformed OAuth state parameter" }
  }
  const [encoded, signature] = stateToken.split(".")
  const expectedSig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url")

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSig)
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return { valid: false, error: "Invalid OAuth state signature (CSRF check failed)" }
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as OAuthStatePayload

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: "OAuth state token has expired" }
    }
    if (consumedNonces.has(payload.nonce)) {
      return { valid: false, error: "OAuth state token has already been used" }
    }
    consumedNonces.add(payload.nonce)
    return { valid: true, payload }
  } catch {
    return { valid: false, error: "Failed to decode OAuth state payload" }
  }
}

const SENSITIVE_KEY_PATTERN =
  /token|secret|password|authorization|api_?key|client_secret|email_body|body|raw_thread|refresh_token|access_token/i

const EMAIL_REGEX = /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

/**
 * Redacts tokens, secrets, email bodies, and full email addresses before logging.
 */
export function redactForLogs(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "string") {
    if (value.startsWith("Bearer ") || value.startsWith("ya29.") || value.startsWith("00D")) {
      return "[REDACTED_TOKEN]"
    }
    return value.replace(EMAIL_REGEX, "$1***@$2")
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForLogs(item))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]"
      } else {
        out[k] = redactForLogs(v)
      }
    }
    return out
  }
  return value
}

/**
 * Wraps untrusted external email threads or retrieved documents and strips
 * prompt-injection patterns so the LLM treats them strictly as data, never instructions.
 */
export function sanitizeUntrustedExternalText(
  rawText: string,
  sourceLabel = "external",
): string {
  const cleaned = (rawText || "")
    .replace(/ignore\s+(all\s+)?(previous|prior|system)\s+instructions/gi, "[filtered-directive]")
    .replace(/<\/?(system|instruction|prompt|tool_call)>/gi, "[filtered-tag]")
    .slice(0, 2000)
  return `<untrusted_external_data source="${(sourceLabel || "external").replace(/"/g, "")}">\n${cleaned}\n</untrusted_external_data>`
}

// Simple sliding-window rate limiter per actor/endpoint
const rateBuckets = new Map<string, number[]>()

export function checkRateLimit(
  bucketKey: string,
  maxRequests = 60,
  windowMs = 60_000,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const timestamps = (rateBuckets.get(bucketKey) || []).filter(
    (t) => now - t < windowMs,
  )
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] || now
    return { allowed: false, retryAfterMs: Math.max(100, windowMs - (now - oldest)) }
  }
  timestamps.push(now)
  rateBuckets.set(bucketKey, timestamps)
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Executes a promise with a strict timeout in milliseconds.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "MCP operation",
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Retries transient errors with exponential backoff while immediately failing on auth/validation errors.
 */
export async function withSafeRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = options?.retries ?? 2
  const baseDelayMs = options?.baseDelayMs ?? 150
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      // Do not retry authentication, authorization, or schema validation errors
      if (/unauthorized|forbidden|access denied|invalid argument|validation|not configured|401|403/i.test(msg)) {
        throw err
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}

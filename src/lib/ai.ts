/**
 * Unified AI Router — fast, reliable, multi-provider
 *
 * Primary:    Groq (llama-3.1-8b-instant / llama-3.3-70b-versatile)
 * Failover 1: z-ai-web-dev-sdk (auto-configured in this env)
 * Failover 2: Google Gemini (if NEXT_PUBLIC_GEMINI_API_KEY set)
 *
 * All functions return typed, parsed results with sensible timeouts.
 */

import 'server-only'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// ─── Model selection ─────────────────────────────────────────────────────
export const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',         // ~150ms first token, cheap
  smart: 'llama-3.3-70b-versatile',     // better reasoning
} as const

function getGroqKey(): string | null {
  const k = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY
  if (!k || k === 'placeholder_groq_key' || k.length < 20) return null
  return k
}

function getGeminiKey(): string | null {
  const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!k || k.length < 20) return null
  return k
}

// ─── Tiny fetch-with-timeout helper ──────────────────────────────────────
async function fetchWithTimeout(url: string, init: RequestInit, ms = 20000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// ─── Public types ────────────────────────────────────────────────────────
export interface ChatMessageIn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamChunk {
  value: string
  done: boolean
}

// ─── Core: Groq chat (non-stream) ────────────────────────────────────────
export async function groqChat(
  messages: ChatMessageIn[],
  opts: { model?: keyof typeof GROQ_MODELS; temperature?: number; maxTokens?: number; json?: boolean } = {}
): Promise<string> {
  const key = getGroqKey()
  if (!key) throw new Error('Groq not configured')

  const res = await fetchWithTimeout(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODELS[opts.model || 'fast'],
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 800,
      response_format: opts.json ? { type: 'json_object' } : undefined,
    }),
  }, 15000)

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Core: Groq streaming chat (yields text deltas) ──────────────────────
export async function* groqChatStream(
  messages: ChatMessageIn[],
  opts: { model?: keyof typeof GROQ_MODELS; temperature?: number; maxTokens?: number } = {}
): AsyncGenerator<string, void, unknown> {
  const key = getGroqKey()
  if (!key) throw new Error('Groq not configured')

  const res = await fetchWithTimeout(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODELS[opts.model || 'fast'],
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
    }),
  }, 60000)

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const lines = buf.split('\n')
    buf = lines.pop() || ''  // keep partial line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const payload = trimmed.slice(6)
      if (payload === '[DONE]') return
      try {
        const obj = JSON.parse(payload)
        const delta = obj.choices?.[0]?.delta?.content
        if (delta) yield delta as string
      } catch {
        // skip malformed lines
      }
    }
  }
}

// ─── Failover: z-ai-web-dev-sdk ──────────────────────────────────────────
async function zaiChat(messages: ChatMessageIn[], maxTokens = 800): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
    max_tokens: maxTokens,
  } as Record<string, unknown>)
  return completion.choices?.[0]?.message?.content || ''
}

// ─── Failover: Gemini ────────────────────────────────────────────────────
async function geminiChat(messages: ChatMessageIn[], maxTokens = 800, temperature = 0.6): Promise<string> {
  const key = getGeminiKey()
  if (!key) throw new Error('Gemini not configured')
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // translate messages
  const system = messages.find(m => m.role === 'system')?.content
  const convo = messages.filter(m => m.role !== 'system')
  const contents = convo.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const result = await model.generateContent({
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  })
  return result.response.text() || ''
}

// ─── Unified: chat with auto-failover (non-stream) ───────────────────────
export async function chat(
  messages: ChatMessageIn[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 800
  const temperature = opts.temperature ?? 0.6

  // 1) Groq
  if (getGroqKey()) {
    try {
      const out = await groqChat(messages, { maxTokens, temperature, json: opts.json })
      if (out.trim()) return out
    } catch (e) {
      console.warn('[ai] Groq failed:', e instanceof Error ? e.message : 'unknown')
    }
  }

  // 2) z-ai SDK
  try {
    const out = await zaiChat(messages, maxTokens)
    if (out.trim()) return out
  } catch (e) {
    console.warn('[ai] z-ai failed:', e instanceof Error ? e.message : 'unknown')
  }

  // 3) Gemini
  if (getGeminiKey()) {
    try {
      const out = await geminiChat(messages, maxTokens, temperature)
      if (out.trim()) return out
    } catch (e) {
      console.warn('[ai] Gemini failed:', e instanceof Error ? e.message : 'unknown')
    }
  }

  return ''
}

// ─── Unified: stream chat with auto-failover ─────────────────────────────
export async function* chatStream(
  messages: ChatMessageIn[],
  opts: { maxTokens?: number; temperature?: number } = {}
): AsyncGenerator<string, void, unknown> {
  const maxTokens = opts.maxTokens ?? 1024
  const temperature = opts.temperature ?? 0.6

  // 1) Groq streaming
  if (getGroqKey()) {
    try {
      let produced = false
      for await (const chunk of groqChatStream(messages, { maxTokens, temperature })) {
        produced = true
        yield chunk
      }
      if (produced) return
    } catch (e) {
      console.warn('[ai] Groq stream failed:', e instanceof Error ? e.message : 'unknown')
    }
  }

  // 2) z-ai SDK — simulate stream
  try {
    const full = await zaiChat(messages, maxTokens)
    if (full.trim()) {
      const tokens = full.match(/\S+\s*/g) || [full]
      for (const t of tokens) {
        yield t
        await new Promise(r => setTimeout(r, 8))
      }
      return
    }
  } catch (e) {
    console.warn('[ai] z-ai stream-fallback failed:', e instanceof Error ? e.message : 'unknown')
  }

  // 3) Gemini — simulate stream
  if (getGeminiKey()) {
    try {
      const full = await geminiChat(messages, maxTokens, temperature)
      if (full.trim()) {
        const tokens = full.match(/\S+\s*/g) || [full]
        for (const t of tokens) {
          yield t
          await new Promise(r => setTimeout(r, 8))
        }
        return
      }
    } catch (e) {
      console.warn('[ai] Gemini stream-fallback failed:', e instanceof Error ? e.message : 'unknown')
    }
  }
  // yield nothing — caller handles empty
}

// ─── JSON helpers ────────────────────────────────────────────────────────
export function safeJsonParse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  let cleaned = raw.trim()
  // strip ```json fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (m) {
      try {
        return JSON.parse(m[0]) as T
      } catch {
        /* ignore */
      }
    }
    return fallback
  }
}

// ─── High-level: tags ────────────────────────────────────────────────────
export async function generateTags(content: string): Promise<string[]> {
  const truncated = content.slice(0, 1500)
  const out = await chat(
    [
      {
        role: 'system',
        content:
          'You are a tagging engine. Read the user thought and return 3-5 short, lowercase tags. ' +
          'Return JSON: {"tags":["tag1","tag2",...]}. Tags must be single words, lowercase, no # symbol.',
      },
      { role: 'user', content: truncated },
    ],
    { maxTokens: 100, temperature: 0.2, json: true }
  )
  const parsed = safeJsonParse<{ tags?: unknown[] }>(out, { tags: [] })
  if (!Array.isArray(parsed.tags)) return []
  return parsed.tags
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.toLowerCase().trim().replace(/^#/, '').replace(/\s+/g, '-'))
    .filter(Boolean)
    .slice(0, 5)
}

// ─── High-level: summary ─────────────────────────────────────────────────
export async function generateSummary(content: string): Promise<string> {
  const truncated = content.slice(0, 2000)
  const out = await chat(
    [
      {
        role: 'system',
        content:
          'Summarize the user content in 1-2 concise, friendly sentences. ' +
          'Capture the key idea. Plain text only, no markdown headers.',
      },
      { role: 'user', content: truncated },
    ],
    { maxTokens: 150, temperature: 0.3 }
  )
  return out.trim()
}

// ─── High-level: title from URL ──────────────────────────────────────────
export async function generateTitleFromUrl(url: string, html: string): Promise<string> {
  // try simple <title> first
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (m && m[1].trim().length > 2) {
    return m[1].trim().slice(0, 200)
  }
  // og:title
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og && og[1].trim().length > 2) {
    return og[1].trim().slice(0, 200)
  }
  // fallback to URL hostname
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 100)
  }
}

// ─── High-level: extract readable text from HTML ─────────────────────────
export function extractTextFromHtml(html: string): string {
  // strip script/style/nav/footer first
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  // strip remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')
  // decode common entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/g, ' ')
  // collapse whitespace
  return cleaned.replace(/\s+/g, ' ').trim()
}

// ─── High-level: read URL content ────────────────────────────────────────
export async function readUrlContent(url: string): Promise<{ title: string; text: string; raw: string }> {
  // 1) Try z-ai web reader first (handles JS-rendered pages)
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    // The SDK exposes webReader.read() — try multiple shapes for safety
    const reader = (zai as unknown as { webReader?: { read: (u: string) => Promise<{ title?: string; content?: string; html?: string; text?: string }> } }).webReader
    if (reader && typeof reader.read === 'function') {
      const result = await reader.read(url)
      if (result && (result.content || result.html || result.text)) {
        const text = result.content || result.text || extractTextFromHtml(result.html || '')
        const title = result.title || ''
        if (text.length > 100) return { title, text: text.slice(0, 8000), raw: result.html || '' }
      }
    }
  } catch (e) {
    console.warn('[ai] z-ai reader failed:', e instanceof Error ? e.message : 'unknown')
  }

  // 2) Raw fetch fallback
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AetherBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  }, 15000)

  if (!res.ok) throw new Error(`Fetch ${res.status}`)
  const html = await res.text()
  const title = await generateTitleFromUrl(url, html)
  const text = extractTextFromHtml(html).slice(0, 8000)
  return { title, text, raw: html }
}

// ─── High-level: detect URLs in text ─────────────────────────────────────
export function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi
  return (text.match(re) || []).map(u => u.replace(/[.,;:!?)]+$/, ''))
}

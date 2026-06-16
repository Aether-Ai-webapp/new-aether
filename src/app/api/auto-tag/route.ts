import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Shared prompt (used by BOTH AIs) ────────────────────────────────
const TAGGING_PROMPT = `Analyze this user's thought. Return a JSON object with ONE field: 'tags'. 'tags' must be an array of 3-5 relevant, lowercase tags (e.g., ['work', 'idea', 'personal', 'study', 'link', 'project', 'learning']). Return ONLY the raw JSON, no markdown formatting, no extra text.`

// ─── Clean JSON helper ───────────────────────────────────────────────
// LLMs sometimes wrap responses in ```json ... ``` blocks
const cleanJsonString = (str: string): string => {
  return str
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()
}

// ─── Parse tags from LLM response ────────────────────────────────────
function parseTagsFromResponse(rawText: string): string[] {
  const cleaned = cleanJsonString(rawText)

  let parsed: { tags: string[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract JSON object from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        return []
      }
    } else {
      return []
    }
  }

  if (!Array.isArray(parsed.tags)) return []

  return parsed.tags
    .filter((t: unknown) => typeof t === 'string')
    .map((t: string) => t.toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 5)
}

// ─── Attempt 1: Groq (fast & cheap) via REST API ─────────────────────
async function tryGroq(content: string): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey || groqKey === 'placeholder_groq_key') return null

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'user',
          content: `${TAGGING_PROMPT}\n\nUser's thought:\n${content.slice(0, 1000)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 100,
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  return text || null
}

// ─── Attempt 2: Gemini (failover) ────────────────────────────────────
async function tryGemini(content: string): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return null

  const genAI = new GoogleGenerativeAI(geminiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${TAGGING_PROMPT}\n\nUser's thought:\n${content.slice(0, 1000)}` }],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 100 },
  })

  return result.response.text() || null
}

// ─── POST /api/auto-tag ──────────────────────────────────────────────
// Dual-AI auto-tagging: Groq primary → Gemini failover
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()

    if (!content?.trim()) {
      return NextResponse.json({ tags: [] }, { status: 400 })
    }

    // Race the entire dual-AI flow with a 15s timeout
    const tags = await Promise.race([
      getTagsWithFailover(content),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 15000)),
    ])

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Auto-tag error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ tags: [] })
  }
}

// ─── Failover logic: Groq → Gemini ───────────────────────────────────
async function getTagsWithFailover(content: string): Promise<string[]> {
  // Attempt 1: Groq (fast & cheap)
  try {
    const groqResponse = await tryGroq(content)
    if (groqResponse) {
      const tags = parseTagsFromResponse(groqResponse)
      if (tags.length > 0) return tags
    }
  } catch (error) {
    console.error('Groq failed, falling back to Gemini', error instanceof Error ? error.message : 'Unknown error')
  }

  // Attempt 2: Gemini (failover)
  try {
    const geminiResponse = await tryGemini(content)
    if (geminiResponse) {
      const tags = parseTagsFromResponse(geminiResponse)
      if (tags.length > 0) return tags
    }
  } catch (error) {
    console.error('Gemini failed too', error instanceof Error ? error.message : 'Unknown error')
  }

  // Both AIs failed — return empty (keyword tags from the store still apply)
  return []
}

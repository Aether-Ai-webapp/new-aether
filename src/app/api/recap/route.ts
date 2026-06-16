import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiCache, CACHE_KEYS, CACHE_TTL, getGeminiFlashModel, isProviderCoolingDown, markProviderFailed } from '@/lib/ai-cache'

// ═══════════════════════════════════════════════════════════════════════
// ─── AI DAILY RECAP GENERATOR — ULTRA-FAST ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════
//
// GET /api/recap?hours=24
//
// Architecture:
// 1. Cache check (instant on hit)
// 2. Fetch memories from DB
// 3. Generate instant stats-based recap (always available)
// 4. Race Gemini + Groq with 3s timeout for AI recap
// 5. Use AI recap if available, otherwise stats recap
// ═══════════════════════════════════════════════════════════════════════

/** Interface for the cached recap response */
interface RecapResponse {
  recap: string
  count: number
  topTags: string[]
  memories: Array<{
    id: string
    type: string
    title: string
    summary: string | null
    tags: string[]
    createdAt: string
  }>
  period: number
}

export async function GET(req: NextRequest) {
  try {
    const hoursParam = req.nextUrl.searchParams.get('hours')
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24

    // ── CACHE CHECK: instant return on hit ─────────────────────────────
    const userId = 'local' // Simplified — skip Supabase auth for speed
    const cacheKey = CACHE_KEYS.RECAP(userId, hours)
    const cached = aiCache.get<RecapResponse>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    // ── Fetch memories from Prisma (skip Supabase for speed) ──────────
    let memories: Array<{
      id: string
      type: string
      title: string
      content: string
      summary: string | null
      tags: string[]
      createdAt: string
    }> = []

    try {
      const prismaMemories = await db.memory.findMany({
        where: {
          createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      memories = prismaMemories.map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        content: m.content.slice(0, 300),
        summary: m.summary,
        tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
        createdAt: m.createdAt.toISOString(),
      }))
    } catch (prismaErr) {
      console.error('Prisma recap fetch failed:', prismaErr instanceof Error ? prismaErr.message : 'Unknown')
      return NextResponse.json(
        { error: 'Database not configured.' },
        { status: 503 }
      )
    }

    if (memories.length === 0) {
      const emptyResponse: RecapResponse = {
        recap: 'A quiet period — no memories captured yet. Start saving thoughts, links, and ideas to see your AI-generated executive recap here.',
        count: 0,
        topTags: [],
        memories: [],
        period: hours,
      }
      aiCache.set(cacheKey, emptyResponse, CACHE_TTL.RECAP)
      return NextResponse.json(emptyResponse)
    }

    // ── Count tags (instant, no AI needed) ─────────────────────────────
    const tagCounts: Record<string, number> = {}
    memories.forEach(m => {
      m.tags.forEach(t => {
        tagCounts[t.trim()] = (tagCounts[t.trim()] || 0) + 1
      })
    })

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag)

    // ── Generate instant stats-based recap (always available) ──────────
    const typeBreakdown = memories.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const typeSummary = Object.entries(typeBreakdown)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ')

    // Build a richer stats recap with top titles
    const topTitles = memories.slice(0, 5).map(m => `"${m.title || 'Untitled'}"`).join(', ')

    const statsRecap = `You captured ${memories.length} memories in the last ${hours} hours (${typeSummary}). ${topTags.length > 0 ? `Your primary focus areas: ${topTags.join(', ')}.` : ''} Notable captures include: ${topTitles}.`

    // ── Try AI enhancement with 3s timeout ────────────────────────────
    let aiRecap = ''

    const aiPromises: Promise<string>[] = []

    // PROVIDER 1: Gemini Flash (shared singleton client) — skip if cooling down
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey && !isProviderCoolingDown('gemini')) {
      const memorySummaries = memories.map(m => {
        const parts = [`[${m.type}] "${m.title || 'Untitled'}"`]
        if (m.summary) parts.push(`Summary: ${m.summary}`)
        if (m.content) parts.push(`Content: ${m.content}`)
        if (m.tags.length > 0) parts.push(`Tags: ${m.tags.join(', ')}`)
        return parts.join(' | ')
      })
      const contextText = memorySummaries.join('\n\n')
      const systemPrompt = 'You are an executive chief of staff. Synthesize the following daily captures into a 3-sentence retrospective emphasizing themes, achievements, and focus areas. Use second person ("you").'
      const userPrompt = `Memories from the last ${hours} hours:\n\n${contextText}`

      aiPromises.push(
        (async (): Promise<string> => {
          const model = getGeminiFlashModel()
          const result = await model.generateContent({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'Understood. I will generate a concise 3-sentence executive recap.' }] },
              { role: 'user', parts: [{ text: userPrompt }] },
            ],
            generationConfig: { temperature: 0.5, maxOutputTokens: 200 },
          })
          const text = result.response.text().trim()
          if (!text) throw new Error('Gemini returned empty response')
          return text
        })()
      )
    }

    // PROVIDER 2: Groq Llama 3.1 8B Instant — skip if cooling down
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey && groqKey !== 'placeholder_groq_key' && !isProviderCoolingDown('groq')) {
      const memorySummaries = memories.map(m => {
        const parts = [`[${m.type}] "${m.title || 'Untitled'}"`]
        if (m.summary) parts.push(`Summary: ${m.summary}`)
        if (m.content) parts.push(`Content: ${m.content}`)
        if (m.tags.length > 0) parts.push(`Tags: ${m.tags.join(', ')}`)
        return parts.join(' | ')
      })
      const contextText = memorySummaries.join('\n\n')

      aiPromises.push(
        (async (): Promise<string> => {
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
                  role: 'system',
                  content: 'You are an executive chief of staff. Synthesize the following raw stream of daily thoughts into a concise 3-sentence daily retrospective emphasizing primary themes and focus areas. Write in second person ("you"). Be specific.',
                },
                {
                  role: 'user',
                  content: `Memories from the last ${hours} hours:\n\n${contextText}`,
                },
              ],
              temperature: 0.5,
              max_tokens: 200,
            }),
          })

          if (!response.ok) {
            if (response.status === 403 || response.status === 429) {
              markProviderFailed('groq', response.status === 429 ? 30 : 60)
            }
            throw new Error(`Groq API returned ${response.status}`)
          }

          const data = await response.json()
          const text = data.choices?.[0]?.message?.content?.trim()
          if (!text) throw new Error('Groq returned empty response')
          return text
        })()
      )
    }

    // Race all providers with 3s timeout — first to succeed wins
    if (aiPromises.length > 0) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout')), 3000)
        )
        aiRecap = await Promise.race([
          Promise.any(aiPromises),
          timeoutPromise,
        ])
      } catch {
        // All AI providers failed or timed out — stats recap is great
        console.warn('All AI providers failed for recap, using stats fallback')
      }
    }

    // Use AI recap if available, otherwise stats recap
    const finalRecap = aiRecap || statsRecap

    // ── Format memories for response ───────────────────────────────────
    const formattedMemories = memories.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      summary: m.summary,
      tags: m.tags,
      createdAt: m.createdAt,
    }))

    const response: RecapResponse = {
      recap: finalRecap,
      count: memories.length,
      topTags,
      memories: formattedMemories,
      period: hours,
    }

    // ── Store in cache ─────────────────────────────────────────────────
    aiCache.set(cacheKey, response, CACHE_TTL.RECAP)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Recap generation failed:', error)
    return NextResponse.json({ error: 'Failed to generate recap' }, { status: 500 })
  }
}

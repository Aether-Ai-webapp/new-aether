import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════════════
// ─── AI DAILY RECAP GENERATOR ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
//
// GET /api/recap?hours=24
//
// Fetches all memories from the last N hours, synthesizes them into
// an executive daily recap using AI, and returns:
// - AI-generated recap text
// - Top tags / themes
// - Memory count + formatted list
// - Period info

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key && url !== 'your_supabase_url_here' && key !== 'your_supabase_anon_key_here')
}

async function getSupabaseRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const cookieStore = await cookies()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Component context — ignore
        }
      },
    },
  })

  return supabase
}

export async function GET(req: NextRequest) {
  try {
    const hoursParam = req.nextUrl.searchParams.get('hours')
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    // ── Try Supabase first ────────────────────────────────────────────
    let memories: Array<{
      id: string
      type: string
      title: string
      content: string
      summary: string | null
      tags: string[]
      createdAt: string
    }> = []

    if (isSupabaseConfigured()) {
      try {
        const supabase = await getSupabaseRouteClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (!authError && user) {
          const { data, error } = await supabase
            .from('memories')
            .select('id, type, title, content, summary, tags, created_at')
            .eq('user_id', user.id)
            .gte('created_at', cutoff.toISOString())
            .order('created_at', { ascending: false })
            .limit(50)

          if (!error && data) {
            memories = (data as Array<Record<string, unknown>>).map(row => ({
              id: row.id as string,
              type: (row.type as string) || 'text',
              title: (row.title as string) || '',
              content: ((row.content as string) || '').slice(0, 300),
              summary: (row.summary as string) || null,
              tags: row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
              createdAt: (row.created_at as string) || new Date().toISOString(),
            }))
          }
        }
      } catch (err) {
        console.warn('Supabase recap fetch failed, falling back to Prisma:', err instanceof Error ? err.message : 'Unknown')
      }
    }

    // ── Prisma fallback ────────────────────────────────────────────────
    if (memories.length === 0) {
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
    }

    if (memories.length === 0) {
      return NextResponse.json({
        recap: 'A quiet period — no memories captured yet. Start saving thoughts, links, and ideas to see your AI-generated executive recap here.',
        count: 0,
        topTags: [],
        memories: [],
        period: hours,
      })
    }

    // ── Build context for AI ───────────────────────────────────────────
    const memorySummaries = memories.map(m => {
      const parts = [`[${m.type}] "${m.title || 'Untitled'}"`]
      if (m.summary) parts.push(`Summary: ${m.summary}`)
      if (m.content) parts.push(`Content: ${m.content}`)
      if (m.tags.length > 0) parts.push(`Tags: ${m.tags.join(', ')}`)
      return parts.join(' | ')
    })

    const contextText = memorySummaries.join('\n\n')

    // ── Count tags ─────────────────────────────────────────────────────
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

    // ── Generate AI recap ──────────────────────────────────────────────
    let aiRecap = ''

    // PRIMARY: Gemini Flash
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: 'You are an executive chief of staff. Synthesize the following daily captures into a 3-sentence retrospective emphasizing themes, achievements, and focus areas. Use second person ("you").' }] },
            { role: 'model', parts: [{ text: 'Understood. I will generate a concise 3-sentence executive recap.' }] },
            { role: 'user', parts: [{ text: `Memories from the last ${hours} hours:\n\n${contextText}` }] },
          ],
          generationConfig: { temperature: 0.5, maxOutputTokens: 300 },
        })

        aiRecap = result.response.text().trim()
      } catch (geminiErr) {
        console.warn('Gemini recap generation failed:', geminiErr instanceof Error ? geminiErr.message : 'Unknown')
      }
    }

    // FALLBACK: Groq
    if (!aiRecap) {
      const groqKey = process.env.GROQ_API_KEY
      if (groqKey && groqKey !== 'placeholder_groq_key') {
        try {
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
                  content: 'You are an executive chief of staff. Synthesize the following raw stream of daily thoughts, bookmarks, and captures into a highly coherent, actionable 3-sentence daily retrospective analysis emphasizing primary themes, achievements, and structural focuses. Write in a warm, reflective, and slightly poetic tone. Use second person ("you"). Be specific about what was captured, not generic.',
                },
                {
                  role: 'user',
                  content: `Here are my captured memories from the last ${hours} hours. Generate an executive recap summarizing what I focused on, key themes, and any insights or recommendations.\n\n${contextText}`,
                },
              ],
              temperature: 0.5,
              max_tokens: 300,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            aiRecap = data.choices?.[0]?.message?.content?.trim() || ''
          }
        } catch (groqErr) {
          console.warn('Groq recap generation failed:', groqErr instanceof Error ? groqErr.message : 'Unknown')
        }
      }
    }

    // ULTIMATE FALLBACK: Simple stats-based recap
    if (!aiRecap) {
      const typeBreakdown = memories.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const typeSummary = Object.entries(typeBreakdown)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ')

      aiRecap = `You captured ${memories.length} memories in the last ${hours} hours (${typeSummary}). ${topTags.length > 0 ? `Your primary focus areas included: ${topTags.join(', ')}.` : ''} Keep capturing to unlock deeper AI-powered insights and thematic connections.`
    }

    // ── Format memories for response ───────────────────────────────────
    const formattedMemories = memories.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      summary: m.summary,
      tags: m.tags,
      createdAt: m.createdAt,
    }))

    return NextResponse.json({
      recap: aiRecap,
      count: memories.length,
      topTags,
      memories: formattedMemories,
      period: hours,
    })
  } catch (error) {
    console.error('Recap generation failed:', error)
    return NextResponse.json({ error: 'Failed to generate recap' }, { status: 500 })
  }
}

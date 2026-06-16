import { NextRequest, NextResponse } from 'next/server'
import { chat, type ChatMessageIn } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/ai/recap - Generate a recap of the user's recent memories
// Body: { timeframe?: 'today' | 'week' | 'all' }
// Returns: { recap: string }
export async function POST(req: NextRequest) {
  try {
    const { timeframe = 'week' } = await req.json()

    // Load memories from Prisma (works for both local and authed users as a fallback)
    let memories: { type: string; title: string; content: string; tags: string; summary: string | null; createdAt: Date }[] = []

    try {
      const { db } = await import('@/lib/db')
      const since = timeframe === 'today'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : timeframe === 'week'
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : new Date(0)
      memories = await db.memory.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    } catch {
      // ignore
    }

    if (memories.length === 0) {
      return NextResponse.json({
        recap: "You don't have any memories from this period yet. Start capturing thoughts, links, and ideas — I'll recap them for you next time! ✨",
      })
    }

    const memoryContext = memories.map(m => {
      const tags = m.tags ? m.tags.split(',').filter(Boolean).join(', ') : ''
      return `- [${m.type}] **${m.title || 'Untitled'}**${tags ? ` _#${tags.split(', ').join(' #')}_` : ''}: ${m.content.slice(0, 200)}${m.summary ? ` (summary: ${m.summary})` : ''}`
    }).join('\n')

    const messages: ChatMessageIn[] = [
      {
        role: 'system',
        content: `You are Aether, a warm and friendly AI memory assistant. Create a CONCISE recap of the user's memories from ${timeframe === 'today' ? 'today' : timeframe === 'week' ? 'this week' : 'all time'}.

The user has ${memories.length} memories:

${memoryContext}

Format your recap as:
1. **Quick Summary** — 1-2 sentence overview
2. **Highlights** — bullet list of the 3-5 most important memories grouped by theme
3. **Patterns & Connections** — highlight any themes, recurring topics, or connections you noticed
4. **Follow-ups** — 1-2 actionable suggestions or follow-up questions

Keep it warm, personal, and enthusiastic. Use markdown. Be concise.`,
      },
      { role: 'user', content: `Give me a recap of my ${timeframe === 'today' ? 'day' : timeframe === 'week' ? 'week' : 'memories'}.` },
    ]

    const recap = await chat(messages, { maxTokens: 1200, temperature: 0.5 })
    return NextResponse.json({ recap, count: memories.length })
  } catch (error) {
    console.error('Recap error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json({ recap: 'Sorry, I could not generate a recap right now.' })
  }
}

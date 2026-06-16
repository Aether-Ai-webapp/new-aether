import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════
// POST /api/collection-recap
//
// Generates a beautiful, unified 2-sentence macro-synthesis
// detailing what themes exist across an entire collection.
//
// Pipeline:
//   1. Fetch all memories in the collection (Supabase or Prisma)
//   2. Feed them into Gemini 1.5 Flash
//   3. Return a 2-sentence synthesis
// ═══════════════════════════════════════════════════════════════════════

const RECAP_SYSTEM_PROMPT = `You are a brilliant synthesis engine. You are given a collection of memories, notes, and ideas from a user's second brain app. Your task is to produce exactly 2 sentences that capture the core themes, patterns, and narrative arc of this entire collection. Be specific, insightful, and direct. Never use filler phrases like "The collection contains" or "These memories show". Speak with the authority of someone who deeply understands the user's thinking.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { collectionId } = body

    if (!collectionId) {
      return NextResponse.json({ error: 'collectionId is required' }, { status: 400 })
    }

    // ── 1. Fetch memories from the collection ──────────────────────────
    let memoriesText = ''
    let memoryCount = 0

    // Try Supabase first
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Get memory IDs from junction table
        const { data: junctionData } = await supabase
          .from('memory_collections')
          .select('memory_id')
          .eq('collection_id', collectionId)

        if (junctionData && junctionData.length > 0) {
          const memoryIds = junctionData.map((j: { memory_id: string }) => j.memory_id)

          const { data: memories } = await supabase
            .from('memories')
            .select('title, content, tags, recap, created_at')
            .in('id', memoryIds)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (memories && memories.length > 0) {
            memoryCount = memories.length
            memoriesText = (memories as Record<string, unknown>[])
              .map((m) => {
                const title = m.title ? `"${m.title}"` : 'Untitled'
                const content = (m.content as string || '').slice(0, 300)
                const recap = m.recap ? ` | Recap: ${(m.recap as string).slice(0, 150)}` : ''
                const date = m.created_at
                  ? ` [${new Date(m.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}]`
                  : ''
                return `${date} ${title}: ${content}${recap}`
              })
              .join('\n\n')
          }
        }
      }
    } catch (supabaseErr) {
      console.warn('[collection-recap] Supabase failed:', supabaseErr instanceof Error ? supabaseErr.message : 'Unknown')
    }

    // Fallback: Prisma
    if (!memoriesText) {
      try {
        const { db } = await import('@/lib/db')
        const junctions = await db.memoryCollection.findMany({
          where: { collectionId },
          select: { memoryId: true },
        })

        if (junctions.length > 0) {
          const memoryIds = junctions.map((j) => j.memoryId)
          const memories = await db.memory.findMany({
            where: { id: { in: memoryIds } },
            select: { title: true, content: true, tags: true, recap: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })

          if (memories.length > 0) {
            memoryCount = memories.length
            memoriesText = memories
              .map((m) => {
                const title = m.title ? `"${m.title}"` : 'Untitled'
                const content = (m.content || '').slice(0, 300)
                const recap = m.recap ? ` | Recap: ${m.recap.slice(0, 150)}` : ''
                const date = ` [${m.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}]`
                return `${date} ${title}: ${content}${recap}`
              })
              .join('\n\n')
          }
        }
      } catch (prismaErr) {
        console.warn('[collection-recap] Prisma failed:', prismaErr instanceof Error ? prismaErr.message : 'Unknown')
      }
    }

    if (!memoriesText || memoryCount === 0) {
      return NextResponse.json({ recap: 'No memories in this collection yet.' })
    }

    // ── 2. Generate recap with AI ──────────────────────────────────────

    // Try Gemini first
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: RECAP_SYSTEM_PROMPT }] },
            { role: 'model', parts: [{ text: 'I will produce exactly 2 insightful sentences synthesizing the themes across the provided memories.' }] },
            { role: 'user', parts: [{ text: `Here are ${memoryCount} memories from a collection:\n\n${memoriesText}` }] },
          ],
          generationConfig: { temperature: 0.6, maxOutputTokens: 200 },
        })

        const recapText = result.response.text()?.trim()
        if (recapText) {
          return NextResponse.json({ recap: recapText, memoryCount })
        }
      } catch (geminiErr) {
        console.warn('[collection-recap] Gemini failed:', geminiErr instanceof Error ? geminiErr.message : 'Unknown')
      }
    }

    // Try Groq
    const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY
    if (groqKey && groqKey !== 'placeholder_groq_key') {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: RECAP_SYSTEM_PROMPT },
              { role: 'user', content: `Here are ${memoryCount} memories from a collection:\n\n${memoriesText}` },
            ],
            temperature: 0.6,
            max_tokens: 200,
          }),
        })

        if (groqRes.ok) {
          const data = await groqRes.json()
          const recapText = data.choices?.[0]?.message?.content?.trim()
          if (recapText) {
            return NextResponse.json({ recap: recapText, memoryCount })
          }
        }
      } catch (groqErr) {
        console.warn('[collection-recap] Groq failed:', groqErr instanceof Error ? groqErr.message : 'Unknown')
      }
    }

    // Try z-ai
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: RECAP_SYSTEM_PROMPT },
          { role: 'user', content: `Here are ${memoryCount} memories from a collection:\n\n${memoriesText}` },
        ],
        thinking: { type: 'disabled' },
      })

      const recapText = completion.choices?.[0]?.message?.content?.trim()
      if (recapText) {
        return NextResponse.json({ recap: recapText, memoryCount })
      }
    } catch (zaiErr) {
      console.warn('[collection-recap] z-ai failed:', zaiErr instanceof Error ? zaiErr.message : 'Unknown')
    }

    // Fallback
    return NextResponse.json({
      recap: `A collection of ${memoryCount} memories spanning multiple topics and ideas.`,
      memoryCount,
    })
  } catch (error) {
    console.error('[collection-recap] Outer error:', error)
    return NextResponse.json({ error: 'Failed to generate recap' }, { status: 500 })
  }
}

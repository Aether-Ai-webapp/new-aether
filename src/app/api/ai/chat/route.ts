import { NextRequest } from 'next/server'
import { chatStream, type ChatMessageIn } from '@/lib/ai'
import { extractUrls, readUrlContent } from '@/lib/ai'

// POST /api/ai/chat - Chat with AI about memories (RAG-powered, streaming, fast Groq)
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message } = body

    if (!message?.trim()) {
      return new Response('Message is required', { status: 400 })
    }

    const lower = message.toLowerCase().trim()
    const isRecap = /^(recap|summary|summarize|what.?s new|catch me up|brief me)/i.test(lower)

    // ── Build memory context (parallel: try Supabase + Prisma race) ────
    const { memoryContext, memoryCount, typeSummary, searchMethod } = await buildMemoryContext(message, isRecap)

    // ── Extract any URL pasted in the question and read it ────────────
    let urlContext = ''
    const urls = extractUrls(message)
    if (urls.length > 0) {
      try {
        const { title, text } = await readUrlContent(urls[0])
        if (text) {
          urlContext = `\n\nThe user also pasted this URL: ${urls[0]}\nTitle: ${title}\nContent excerpt: ${text.slice(0, 1500)}`
        }
      } catch {
        // ignore — non-blocking
      }
    }

    // ── Build system prompt ─────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      memoryContext,
      memoryCount,
      typeSummary,
      searchMethod,
      isRecap,
      urlContext,
    })

    const messages: ChatMessageIn[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]

    // ── Stream response (Groq primary, failover to z-ai/Gemini) ────────
    const encoder = new TextEncoder()
    let produced = false

    const stream = new ReadableStream({
      async pull(controller) {
        if (produced) {
          controller.close()
          return
        }
        produced = true
        try {
          for await (const chunk of chatStream(messages, {
            maxTokens: isRecap ? 1500 : 1024,
            temperature: 0.55,
          })) {
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : 'unknown'
          controller.enqueue(encoder.encode(`\n\n_(Sorry, my AI connection hiccupped: ${err}). Please try again._`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      "I couldn't search your memories right now. Please try again.",
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
  }
}

// ─── Build memory context (race Supabase + Prisma) ───────────────────────
async function buildMemoryContext(query: string, isRecap: boolean) {
  // Try Supabase semantic search → Supabase recent → Prisma recent — in parallel where possible
  const supaPromise = loadFromSupabase(query, isRecap)
  const prismaPromise = loadFromPrisma(isRecap)

  const [supa, prisma] = await Promise.allSettled([supaPromise, prismaPromise])

  const supaResult = supa.status === 'fulfilled' ? supa.value : null
  if (supaResult && supaResult.memoryContext) {
    return supaResult
  }
  const prismaResult = prisma.status === 'fulfilled' ? prisma.value : null
  if (prismaResult && prismaResult.memoryContext) {
    return prismaResult
  }
  return { memoryContext: '', memoryCount: 0, typeSummary: '', searchMethod: 'none' as const }
}

async function loadFromSupabase(query: string, isRecap: boolean) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return emptyCtx()

    // Semantic search if embedding available
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (geminiKey && !isRecap) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(geminiKey)
        const emb = genAI.getGenerativeModel('text-embedding-004')
        const embResult = await emb.embedContent(query)
        const embedding = embResult.embedding.values
        const { data: matched, error } = await supabase.rpc('match_memories', {
          query_embedding: embedding,
          match_user_id: user.id,
          match_count: 12,
        })
        if (!error && matched && matched.length > 0) {
          return formatRows(matched as Record<string, unknown>[], 'semantic')
        }
      } catch {
        // fall through
      }
    }

    // Recent memories
    const { data, error } = await supabase
      .from('memories')
      .select('type, title, content, tags, summary')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(isRecap ? 50 : 20)

    if (!error && data && data.length > 0) {
      return formatRows(data as Record<string, unknown>[], isRecap ? 'recent-recap' : 'recent')
    }
  } catch {
    // fall through
  }
  return emptyCtx()
}

async function loadFromPrisma(isRecap: boolean) {
  try {
    const { db } = await import('@/lib/db')
    const memories = await db.memory.findMany({
      orderBy: { createdAt: 'desc' },
      take: isRecap ? 50 : 20,
      include: { collections: { include: { collection: { select: { name: true } } } } },
    })
    if (memories.length === 0) return emptyCtx()
    const rows = memories.map(m => ({
      type: m.type,
      title: m.title,
      content: m.content,
      tags: m.tags,
      summary: m.summary,
    })) as unknown as Record<string, unknown>[]
    return formatRows(rows, isRecap ? 'recent-prisma-recap' : 'recent-prisma')
  } catch {
    return emptyCtx()
  }
}

function emptyCtx() {
  return { memoryContext: '', memoryCount: 0, typeSummary: '', searchMethod: 'none' as const }
}

function formatRows(rows: Record<string, unknown>[], method: string) {
  const memoryCount = rows.length
  const types = rows.reduce((acc, m) => {
    const t = (m.type as string) || 'text'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const typeSummary = Object.entries(types).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`).join(', ')

  const memoryContext = rows
    .map((m) => {
      const tags = m.tags ? String(m.tags).split(',').filter(Boolean).join(', ') : ''
      const summary = m.summary ? ` | Summary: ${m.summary}` : ''
      const sim = m.similarity ? ` (relevance: ${Number(m.similarity).toFixed(2)})` : ''
      const content = String(m.content || '').slice(0, method.includes('recap') ? 400 : 250)
      return `[${m.type}] "${m.title || 'Untitled'}": ${content}${tags ? ` | Tags: ${tags}` : ''}${summary}${sim}`
    })
    .join('\n')

  return { memoryContext, memoryCount, typeSummary, searchMethod: method }
}

// ─── System prompt builder ───────────────────────────────────────────────
function buildSystemPrompt(opts: {
  memoryContext: string
  memoryCount: number
  typeSummary: string
  searchMethod: string
  isRecap: boolean
  urlContext: string
}): string {
  const { memoryContext, memoryCount, typeSummary, searchMethod, isRecap, urlContext } = opts

  const recapGuidance = isRecap
    ? `\n\nThe user asked for a recap. Provide a CONCISE overview of their recent memories grouped by theme or time. Use bullet points and bold headers. Highlight any patterns, todos, or things that need follow-up. End with 1-2 thoughtful follow-up questions.`
    : ''

  return `You are Aether, a warm and friendly personal AI memory assistant — like a smart friend who remembers everything for them. You speak naturally, casually, and with genuine enthusiasm.

${searchMethod === 'semantic'
      ? `I found the most semantically relevant memories for your question (AI-powered search):`
      : searchMethod.includes('recap')
        ? `Here are your ${memoryCount} most recent memories (${typeSummary}):`
        : searchMethod !== 'none'
          ? `Here are the user's recent memories (${typeSummary}):`
          : ''}

${memoryContext || 'No memories saved yet.'}
${urlContext}
${recapGuidance}

Personality & Style:
- Be warm, friendly, and conversational — like chatting with a thoughtful friend
- Use natural language: "Hey!", "Oh nice!", "I found something cool for you"
- Show genuine excitement when finding connections between memories
- Use "you" and "your" — make it personal
- Keep responses concise but warm — no corporate/robotic tone
- Use markdown formatting for readability (bold, lists, headings)

Memory Handling:
- Reference specific memories by quoting their title or content
- When you find connections between memories, highlight them excitedly
- If memories don't answer the question, be honest but helpful — suggest what they could save
- For URL questions, summarize the URL content and connect it to existing memories if relevant
- Always end with an encouraging note or follow-up suggestion`
}

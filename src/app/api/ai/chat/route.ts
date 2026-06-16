import { NextRequest } from 'next/server'

// POST /api/ai/chat - Chat with AI about memories (RAG-powered, streaming)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message } = body

    if (!message?.trim()) {
      return new Response('Message is required', { status: 400 })
    }

    // Build memory context — try Semantic Search (RAG) first, then fall back to recent memories
    let memoryContext = ''
    let memoryCount = 0
    let typeSummary = ''
    let searchMethod = 'none'

    // ── ATTEMPT 1: Semantic Search with pgvector (RAG) ──────────────────
    try {
      const geminiKey = process.env.GEMINI_API_KEY
      if (geminiKey) {
        // Step A: Convert the user's question into an embedding
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(geminiKey)
        const embeddingModel = genAI.getGenerativeModel('text-embedding-004')
        const embedResult = await embeddingModel.embedContent(message)
        const queryEmbedding = embedResult.embedding.values

        // Step B: Query Supabase for the most similar memories using pgvector
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Try the match_memories RPC function (pgvector similarity search)
          const { data: matchedMemories, error: rpcError } = await supabase.rpc(
            'match_memories',
            {
              query_embedding: queryEmbedding,
              match_user_id: user.id,
              match_count: 10,
            }
          )

          if (!rpcError && matchedMemories && matchedMemories.length > 0) {
            memoryCount = matchedMemories.length
            const memoryTypes = (matchedMemories as Record<string, unknown>[]).reduce((acc, m) => {
              const t = (m.type as string) || 'text'
              acc[t] = (acc[t] || 0) + 1
              return acc
            }, {} as Record<string, number>)
            typeSummary = Object.entries(memoryTypes).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`).join(', ')

            memoryContext = (matchedMemories as Record<string, unknown>[])
              .map((m) => {
                const tags = m.tags ? (m.tags as string).split(',').filter(Boolean).join(', ') : ''
                const similarity = m.similarity ? ` (relevance: ${(m.similarity as number).toFixed(2)})` : ''
                return `[${m.type}] "${m.title || 'Untitled'}": ${(m.content as string || '').slice(0, 300)}${tags ? ` | Tags: ${tags}` : ''}${similarity}`
              })
              .join('\n')

            searchMethod = 'semantic'
          } else if (rpcError) {
            // RPC function doesn't exist yet (pgvector not set up) — fall through
            console.warn('match_memories RPC not available:', rpcError.message)
          }
        }
      }
    } catch (semanticError) {
      console.warn('Semantic search failed, falling back to recent memories:', semanticError instanceof Error ? semanticError.message : 'Unknown')
      // Fall through to recent memories approach
    }

    // ── ATTEMPT 2: Recent memories fallback (last 20) via Supabase ──────
    if (!memoryContext) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data, error } = await supabase
            .from('memories')
            .select('type, title, content, tags')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)

          if (!error && data && data.length > 0) {
            memoryCount = data.length
            const memoryTypes = (data as Record<string, unknown>[]).reduce((acc, m) => {
              const t = (m.type as string) || 'text'
              acc[t] = (acc[t] || 0) + 1
              return acc
            }, {} as Record<string, number>)
            typeSummary = Object.entries(memoryTypes).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`).join(', ')

            memoryContext = (data as Record<string, unknown>[])
              .map((m) => {
                const tags = m.tags ? (m.tags as string).split(',').filter(Boolean).join(', ') : ''
                return `[${m.type}] "${m.title || 'Untitled'}": ${(m.content as string || '').slice(0, 200)}${tags ? ` | Tags: ${tags}` : ''}`
              })
              .join('\n')

            searchMethod = 'recent'
          }
        }
      } catch {
        // Fall through to Prisma
      }
    }

    // ── ATTEMPT 3: Prisma fallback (last 20) ───────────────────────────
    if (!memoryContext) {
      try {
        const { db } = await import('@/lib/db')
        const memories = await db.memory.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            collections: {
              include: {
                collection: { select: { name: true } },
              },
            },
          },
        })

        memoryCount = memories.length
        const memoryTypes = memories.reduce((acc, m) => {
          acc[m.type] = (acc[m.type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        typeSummary = Object.entries(memoryTypes).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`).join(', ')

        memoryContext = memories
          .map((m) => {
            const collections = m.collections.map((mc) => mc.collection.name).join(', ')
            const tags = m.tags ? m.tags.split(',').filter(Boolean).join(', ') : ''
            return `[${m.type}] "${m.title || 'Untitled'}": ${m.content.slice(0, 200)}${tags ? ` | Tags: ${tags}` : ''}${collections ? ` | Collections: ${collections}` : ''}`
          })
          .join('\n')

        searchMethod = 'recent-prisma'
      } catch {
        // Prisma also failed, continue with empty context
      }
    }

    const systemPrompt = `You are Aether, a warm and friendly personal AI memory assistant — like a smart friend who remembers everything for them. You speak naturally, casually, and with genuine enthusiasm about helping.

${searchMethod === 'semantic'
      ? `I found the most semantically relevant memories for your question (using AI-powered search):`
      : searchMethod !== 'none'
        ? `Here are the user's recent memories:`
        : ''}

${memoryContext || 'No memories saved yet.'}

Personality & Style:
- Be warm, friendly, and conversational — like chatting with a thoughtful friend
- Use natural language: "Hey!", "Oh nice!", "I found something cool for you"
- Show genuine excitement when finding connections between memories
- Use "you" and "your" — make it personal
- Keep responses concise but warm — no corporate/robotic tone

Memory Handling:
- Reference specific memories by quoting their title or content
- When you find connections between memories, highlight them excitedly
- Use markdown formatting for readability (bold, lists, etc.)
- If memories don't answer the question, be honest but helpful — suggest what they could save
- Always end with an encouraging note or follow-up suggestion`

    // ── STREAMING RESPONSE ────────────────────────────────────────────────
    const encoder = new TextEncoder()

    // Helper: create a ReadableStream from an async generator
    function createStreamFromGenerator(generator: AsyncGenerator<string, void, unknown>) {
      return new ReadableStream({
        async pull(controller) {
          try {
            const { value, done } = await generator.next()
            if (done) {
              controller.close()
            } else {
              controller.enqueue(encoder.encode(value))
            }
          } catch (err) {
            controller.error(err)
          }
        },
      })
    }

    // ── Try Gemini with streaming (PRIMARY) ────────────────────────────────
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        async function* geminiStreamGenerator() {
          const result = await model.generateContentStream({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'I am Aether, your memory assistant.' }] },
              { role: 'user', parts: [{ text: message }] },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          })

          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) yield text
          }
        }

        const stream = createStreamFromGenerator(geminiStreamGenerator())
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
          },
        })
      } catch (geminiError) {
        console.error('Gemini failed:', geminiError instanceof Error ? geminiError.message : 'Unknown')
      }
    }

    // ── Try Groq with streaming ──────────────────────────────────────────
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey && groqKey !== 'placeholder_groq_key') {
      try {
        async function* groqStreamGenerator() {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
              ],
              temperature: 0.7,
              max_tokens: 1024,
              stream: true,
            }),
          })

          if (!groqResponse.ok) throw new Error(`Groq error: ${groqResponse.status}`)
          if (!groqResponse.body) throw new Error('No body')

          const reader = groqResponse.body.getReader()
          const decoder = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') return
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) yield content
                } catch {
                  // Skip non-JSON lines
                }
              }
            }
          }
        }

        const stream = createStreamFromGenerator(groqStreamGenerator())
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
          },
        })
      } catch (groqError) {
        console.error('Groq failed:', groqError instanceof Error ? groqError.message : 'Unknown')
      }
    }

    // ── Built-in fallback: simulate streaming for consistency ────────────
    const fallbackResponse = `I'm Aether, your memory assistant. Here's what I found in your memories:\n\n` +
      `You have **${memoryCount} memories** saved (${typeSummary || 'none yet'}).${searchMethod === 'semantic' ? ' (AI-powered semantic search)' : ''}\n\n` +
      (memoryCount > 0
        ? `I'd love to help you explore your memories more deeply! My AI connection is currently experiencing issues, but I can still help you browse and organize your saved content. Try the **Memories** tab to search and filter your notes.`
        : `You haven't saved any memories yet. Try clicking the **+** button to add your first note, link, image, or voice memo!`)

    async function* fallbackStreamGenerator() {
      const words = fallbackResponse.split(/(\s+)/)
      for (const word of words) {
        yield word
        await new Promise((r) => setTimeout(r, 10))
      }
    }

    const stream = createStreamFromGenerator(fallbackStreamGenerator())
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      "I couldn't search your memories right now. Please try again.",
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    )
  }
}

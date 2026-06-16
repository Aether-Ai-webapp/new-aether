import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════════════
// ─── SEMANTIC VECTOR SEARCH API ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
//
// GET /api/search?q=<query>&limit=<n>
//
// Flow:
// 1. Convert query to embedding vector via Gemini text-embedding-004
// 2. If Supabase + pgvector: use match_memories RPC for cosine similarity
// 3. If not: fall back to Prisma keyword search (TF-IDF lite)
//
// Returns conceptually relevant memories even if exact keywords don't match.

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key && url !== 'your_supabase_url_here' && key !== 'your_supabase_anon_key_here')
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  // Try Gemini text-embedding-004
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return null

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(geminiKey)
    const embeddingModel = genAI.getGenerativeModel('text-embedding-004')

    const result = await embeddingModel.embedContent(text.slice(0, 2000))
    const values = result.embedding.values

    if (!values || values.length === 0) {
      throw new Error('Empty embedding returned')
    }

    return values
  } catch (err) {
    console.warn('Embedding generation failed:', err instanceof Error ? err.message : 'Unknown')
    return null
  }
}

// ── Keyword-based fallback search (Prisma, always works) ────────────
async function keywordSearch(query: string, limit: number) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)

  if (words.length === 0) return []

  // Get all memories and score them locally
  const allMemories = await db.memory.findMany({
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      summary: true,
      deepInsight: true,
      tags: true,
      sourceUrl: true,
      imageUrl: true,
      imagePreview: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
      collections: {
        include: {
          collection: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      },
    },
    take: 200,
    orderBy: { createdAt: 'desc' },
  })

  // Score each memory based on keyword matches
  const scored = allMemories.map(memory => {
    const searchable = `${memory.title} ${memory.content} ${memory.summary || ''} ${memory.tags}`.toLowerCase()
    let score = 0

    for (const word of words) {
      // Exact match scoring
      const titleMatches = (memory.title.toLowerCase().match(new RegExp(word, 'g')) || []).length
      const contentMatches = (searchable.match(new RegExp(word, 'g')) || []).length
      const tagMatches = (memory.tags.toLowerCase().match(new RegExp(word, 'g')) || []).length

      score += titleMatches * 3 + contentMatches * 1 + tagMatches * 5
    }

    return { memory, score }
  })

  // Return top scored memories
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      id: s.memory.id,
      type: s.memory.type,
      title: s.memory.title,
      content: s.memory.content,
      summary: s.memory.summary,
      deepInsight: s.memory.deepInsight,
      tags: s.memory.tags ? s.memory.tags.split(',').filter(Boolean) : [],
      sourceUrl: s.memory.sourceUrl,
      imageUrl: s.memory.imageUrl,
      imagePreview: s.memory.imagePreview,
      isFavorite: s.memory.isFavorite,
      createdAt: s.memory.createdAt.toISOString(),
      updatedAt: s.memory.updatedAt.toISOString(),
      collections: s.memory.collections.map(mc => ({
        id: mc.collection.id,
        name: mc.collection.name,
        color: mc.collection.color,
        icon: mc.collection.icon,
      })),
      similarity: s.score / (words.length * 10), // Normalized score (0-1ish)
      searchMethod: 'keyword',
    }))
}

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q')?.trim()
    const limitParam = req.nextUrl.searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
    }

    // ── PATH A: Semantic Vector Search (Supabase + pgvector) ────────
    if (isSupabaseConfigured()) {
      try {
        const embedding = await generateEmbedding(query)

        if (embedding && embedding.length > 0) {
          // Use admin client to call match_memories RPC
          try {
            const { createAdminClient } = await import('@/lib/supabase/admin')
            const supabase = createAdminClient()

            // Get user ID from query param or try cookie-based auth
            let userId: string | null = req.nextUrl.searchParams.get('userId')

            if (!userId) {
              try {
                const { createServerClient } = await import('@supabase/ssr')
                const { cookies: nextCookies } = await import('next/headers')
                const cookieStore = await nextCookies()
                const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
                const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

                const supabaseRoute = createServerClient(url, key, {
                  cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll() {},
                  },
                })

                const { data: { user } } = await supabaseRoute.auth.getUser()
                if (user) userId = user.id
              } catch {
                // No authenticated user — search all memories (admin mode)
              }
            }

            // Call the match_memories RPC function
            const rpcParams: Record<string, unknown> = {
              query_embedding: embedding,
              match_count: limit,
            }

            if (userId) {
              rpcParams.match_user_id = userId
            }

            const { data: matches, error: matchError } = await supabase
              .rpc('match_memories', rpcParams)

            if (!matchError && matches && matches.length > 0) {
              // Enrich results with full memory data
              const memoryIds = matches.map((m: { id: string }) => m.id)

              const { data: fullMemories, error: fetchError } = await supabase
                .from('memories')
                .select('*, memory_collections(collection_id, collections(id, name, color, icon))')
                .in('id', memoryIds)

              if (!fetchError && fullMemories) {
                // Re-order by similarity
                const similarityMap = new Map(
                  matches.map((m: { id: string; similarity: number }) => [m.id, m.similarity])
                )

                const results = fullMemories.map((row: Record<string, unknown>) => ({
                  id: row.id as string,
                  type: (row.type as string) || 'text',
                  title: (row.title as string) || '',
                  content: (row.content as string) || '',
                  summary: (row.summary as string) || null,
                  deepInsight: (row.deep_insight as string) || null,
                  tags: row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
                  sourceUrl: (row.source_url as string) || null,
                  imageUrl: (row.image_url as string) || null,
                  imagePreview: (row.image_preview as string) || null,
                  isFavorite: (row.is_favorite as boolean) || false,
                  createdAt: (row.created_at as string) || new Date().toISOString(),
                  updatedAt: (row.updated_at as string) || new Date().toISOString(),
                  collections: ((row.memory_collections as Array<{ collections: { id: string; name: string; color: string; icon: string } }>) || []).map(mc => ({
                    id: mc.collections.id,
                    name: mc.collections.name,
                    color: mc.collections.color,
                    icon: mc.collections.icon,
                  })),
                  similarity: similarityMap.get(row.id as string) || 0,
                  searchMethod: 'semantic',
                }))

                // Sort by similarity descending
                results.sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)

                return NextResponse.json({
                  results,
                  query,
                  method: 'semantic',
                  count: results.length,
                })
              }
            }
          } catch (err) {
            console.warn('Supabase vector search failed, falling back to keyword:', err instanceof Error ? err.message : 'Unknown')
          }
        }
      } catch (err) {
        console.warn('Semantic search unavailable, falling back to keyword:', err instanceof Error ? err.message : 'Unknown')
      }
    }

    // ── PATH B: Keyword Search Fallback (Prisma, always works) ──────
    const results = await keywordSearch(query, limit)

    return NextResponse.json({
      results,
      query,
      method: 'keyword',
      count: results.length,
    })
  } catch (error) {
    console.error('Search API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

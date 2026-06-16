import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 1. Get the target memory first
    // Try Supabase, fall back to Prisma
    let targetMemory: { id: string; content: string; tags: string; type: string; user_id?: string } | null = null
    
    // Try Supabase
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data, error } = await supabase
          .from('memories')
          .select('id, content, tags, type, user_id')
          .eq('id', id)
          .single()
        
        if (!error && data) {
          targetMemory = data as typeof targetMemory
        }
      }
    } catch { /* fall through */ }
    
    // Fallback: Prisma
    if (!targetMemory) {
      try {
        const { db } = await import('@/lib/db')
        const memory = await db.memory.findUnique({
          where: { id },
          select: { id: true, content: true, tags: true, type: true },
        })
        if (memory) {
          targetMemory = memory
        }
      } catch { /* fall through */ }
    }
    
    if (!targetMemory) {
      return NextResponse.json({ related: [] }, { status: 404 })
    }
    
    // 2. Try semantic search with pgvector
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (geminiKey && targetMemory.user_id) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(geminiKey)
        const embeddingModel = genAI.getGenerativeModel('text-embedding-004')
        const embedResult = await embeddingModel.embedContent(targetMemory.content.slice(0, 2000))
        const queryEmbedding = embedResult.embedding.values
        
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        
        const { data: matched, error: rpcError } = await supabase.rpc(
          'match_memories',
          {
            query_embedding: queryEmbedding,
            match_user_id: targetMemory.user_id,
            match_count: 6, // get 6, filter out the target itself
          }
        )
        
        if (!rpcError && matched && matched.length > 0) {
          const related = (matched as Record<string, unknown>[])
            .filter((m) => m.id !== id) // exclude the target memory itself
            .slice(0, 5)
            .map((m) => ({
              id: m.id as string,
              title: (m.title as string) || 'Untitled',
              content: ((m.content as string) || '').slice(0, 100),
              tags: m.tags ? (m.tags as string).split(',').filter(Boolean) : [],
              type: (m.type as string) || 'text',
              createdAt: m.created_at as string,
              similarity: m.similarity ? Number((m.similarity as number).toFixed(3)) : null,
            }))
          
          return NextResponse.json({ related })
        }
      } catch (e) {
        console.warn('Semantic related search failed:', e instanceof Error ? e.message : 'Unknown')
      }
    }
    
    // 3. Fallback: keyword matching on shared tags
    const targetTags = targetMemory.tags ? targetMemory.tags.split(',').filter(Boolean) : []
    if (targetTags.length > 0) {
      try {
        const { db } = await import('@/lib/db')
        const allMemories = await db.memory.findMany({
          where: { id: { not: id } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, title: true, content: true, tags: true, type: true, createdAt: true },
        })
        
        // Score by shared tag count
        const scored = allMemories.map((m) => {
          const mTags = m.tags ? m.tags.split(',').filter(Boolean) : []
          const sharedTags = mTags.filter((t) => targetTags.includes(t))
          return { ...m, score: sharedTags.length }
        }).filter((m) => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
        
        return NextResponse.json({
          related: scored.map((m) => ({
            id: m.id,
            title: m.title || 'Untitled',
            content: m.content.slice(0, 100),
            tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
            type: m.type,
            createdAt: m.createdAt.toISOString(),
            similarity: null,
          })),
        })
      } catch { /* fall through */ }
    }
    
    // 4. No related memories found
    return NextResponse.json({ related: [] })
  } catch (error) {
    console.error('Related memories error:', error)
    return NextResponse.json({ related: [] })
  }
}

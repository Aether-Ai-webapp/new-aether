import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════════════
// ─── AI BRAIN: FIND CONNECTIONS BETWEEN MEMORIES ──────────────────────
// ═══════════════════════════════════════════════════════════════════════

interface MemoryNode {
  id: string
  title: string
  type: string
  tags: string[]
  content: string
}

interface Connection {
  sourceId: string
  targetId: string
  reason: string
  strength: number // 1-5
}

interface BrainCluster {
  name: string
  memoryIds: string[]
  theme: string
}

// ── Tag-based + Content-based Connection Engine ──────────────────────

function computeConnections(memories: MemoryNode[]): Connection[] {
  const connections: Connection[] = []

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i]
      const b = memories[j]
      let strength = 0
      const reasons: string[] = []

      // Tag overlap
      const aTags = new Set(a.tags.map(t => t.toLowerCase()))
      const bTags = new Set(b.tags.map(t => t.toLowerCase()))
      const tagOverlap = [...aTags].filter(t => bTags.has(t))
      if (tagOverlap.length > 0) {
        strength += tagOverlap.length * 2
        reasons.push(`Shared tags: ${tagOverlap.join(', ')}`)
      }

      // Content word overlap (meaningful words only, >4 chars)
      const stopWords = new Set(['about', 'which', 'their', 'there', 'would', 'could', 'should', 'these', 'those', 'being', 'having', 'where', 'after', 'before', 'between', 'through', 'during', 'without'])
      const aWords = new Set(
        a.content.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w))
      )
      const bWords = new Set(
        b.content.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w))
      )
      const wordOverlap = [...aWords].filter(w => bWords.has(w))
      if (wordOverlap.length >= 2) {
        strength += Math.min(wordOverlap.length, 5)
        reasons.push(`Related concepts`)
      }

      // Same type bonus
      if (a.type === b.type && strength > 0) {
        strength += 1
      }

      if (strength >= 2) {
        connections.push({
          sourceId: a.id,
          targetId: b.id,
          reason: reasons.join('; '),
          strength: Math.min(strength, 5),
        })
      }
    }
  }

  return connections.sort((a, b) => b.strength - a.strength).slice(0, 30)
}

// ── Cluster Detection ─────────────────────────────────────────────────

function detectClusters(memories: MemoryNode[]): BrainCluster[] {
  const tagGroups: Record<string, string[]> = {}

  for (const mem of memories) {
    for (const tag of mem.tags) {
      const t = tag.toLowerCase()
      if (!tagGroups[t]) tagGroups[t] = []
      tagGroups[t].push(mem.id)
    }
  }

  const clusters: BrainCluster[] = []
  for (const [tag, ids] of Object.entries(tagGroups)) {
    if (ids.length >= 2) {
      clusters.push({
        name: tag.charAt(0).toUpperCase() + tag.slice(1),
        memoryIds: ids,
        theme: tag,
      })
    }
  }

  return clusters.sort((a, b) => b.memoryIds.length - a.memoryIds.length).slice(0, 10)
}

// ── LLM-powered Deep Connection Analysis (Gemini Flash) ─────────────

async function deepAnalysisWithLLM(memories: MemoryNode[]): Promise<BrainCluster[] | null> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return null

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Build a condensed memory summary for the LLM
    const memorySummaries = memories.slice(0, 20).map(m =>
      `[${m.id.slice(0, 8)}] "${m.title}" (tags: ${m.tags.join(', ')}) — ${m.content.slice(0, 100)}`
    ).join('\n')

    const prompt = `Analyze these memories from a user's second brain. Find thematic clusters and deep non-obvious connections between ideas. Return a JSON array of clusters:

[
  {
    "name": "Short cluster name",
    "theme": "One sentence describing the connecting theme",
    "memory_ids": ["id1", "id2", "id3"]
  }
]

Only include clusters where memories genuinely relate. Use the short IDs (first 8 chars). Find 2-5 clusters maximum.

Memories:
${memorySummaries}`

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: 'You are an AI brain that finds deep, non-obvious thematic connections between ideas. Return only valid JSON arrays.' }] },
        { role: 'model', parts: [{ text: 'Understood. I will analyze the memories and return a JSON array of thematic clusters.' }] },
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: { temperature: 0.5, maxOutputTokens: 800 },
    })

    const responseText = result.response.text()
    if (!responseText) return null

    let jsonStr = responseText.trim()
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (jsonMatch) jsonStr = jsonMatch[0]

    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) {
      // Map short IDs back to full IDs
      const shortToFullId = new Map<string, string>()
      for (const m of memories) {
        shortToFullId.set(m.id.slice(0, 8), m.id)
      }

      return parsed.filter((c: { name?: string; theme?: string; memory_ids?: string[] }) =>
        c.name && c.theme && Array.isArray(c.memory_ids) && c.memory_ids.length >= 2
      ).map((c: { name: string; theme: string; memory_ids: string[] }) => ({
        name: c.name,
        theme: c.theme,
        memoryIds: c.memory_ids
          .map((shortId: string) => shortToFullId.get(shortId) || shortId)
          .filter((id: string) => memories.some(m => m.id === id)),
      })).filter((c: { memoryIds: string[] }) => c.memoryIds.length >= 2)
    }

    return null
  } catch (err) {
    console.warn('Gemini deep cluster analysis failed:', err instanceof Error ? err.message : 'Unknown')
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN GET HANDLER ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const memoryId = searchParams.get('memoryId') // Get connections for a specific memory

    // Fetch all memories from Prisma
    let allMemories
    try {
      allMemories = await db.memory.findMany({
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    } catch (prismaErr) {
      console.error('Prisma fallback failed:', prismaErr instanceof Error ? prismaErr.message : 'Unknown')
      return NextResponse.json(
        { error: 'Database not configured. Please set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your Vercel environment variables.' },
        { status: 503 }
      )
    }

    if (allMemories.length === 0) {
      return NextResponse.json({ connections: [], clusters: [], relatedMemories: [] })
    }

    // Build memory nodes
    const memoryNodes: MemoryNode[] = allMemories.map(m => ({
      id: m.id,
      title: m.title || 'Untitled',
      type: m.type,
      tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
      content: m.content || '',
    }))

    // Compute connections
    const connections = computeConnections(memoryNodes)

    // Detect clusters (tag-based first, always fast)
    let clusters = detectClusters(memoryNodes)

    // Try LLM deep analysis for richer clusters
    const llmClusters = await deepAnalysisWithLLM(memoryNodes)
    if (llmClusters && llmClusters.length > 0) {
      // Merge LLM clusters with tag clusters (LLM clusters take priority)
      const llmNames = new Set(llmClusters.map(c => c.name.toLowerCase()))
      const tagClustersFiltered = clusters.filter(c => !llmNames.has(c.name.toLowerCase()))
      clusters = [...llmClusters, ...tagClustersFiltered].slice(0, 10)
    }

    // If a specific memory was requested, find its connections
    let relatedMemories: { id: string; title: string; type: string; reason: string; strength: number }[] = []
    if (memoryId) {
      relatedMemories = connections
        .filter(c => c.sourceId === memoryId || c.targetId === memoryId)
        .map(c => {
          const otherId = c.sourceId === memoryId ? c.targetId : c.sourceId
          const otherMem = memoryNodes.find(m => m.id === otherId)
          return {
            id: otherId,
            title: otherMem?.title || 'Untitled',
            type: otherMem?.type || 'text',
            reason: c.reason,
            strength: c.strength,
          }
        })
    }

    return NextResponse.json({
      connections,
      clusters,
      relatedMemories,
    })
  } catch (error) {
    console.error('Brain route error:', error)
    return NextResponse.json(
      { error: 'Brain analysis failed' },
      { status: 500 }
    )
  }
}

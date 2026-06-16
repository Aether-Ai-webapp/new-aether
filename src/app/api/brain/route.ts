import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiCache, CACHE_KEYS, CACHE_TTL, getGeminiFlashModel, isProviderCoolingDown, markProviderFailed } from '@/lib/ai-cache'

// ═══════════════════════════════════════════════════════════════════════
// ─── AI BRAIN: FIND CONNECTIONS BETWEEN MEMORIES (ULTRA-FAST) ────────
// ═══════════════════════════════════════════════════════════════════════
//
// Optimizations:
// 1. Instant local computation (tag + content connections, clustering)
// 2. LLM deep analysis runs with 3s timeout — if slow, skip it
// 3. Skip LLM entirely for <5 memories (not enough signal)
// 4. Return local results immediately, LLM clusters are bonus only
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

// ── LLM-powered Deep Connection Analysis (with timeout) ──────────

async function deepAnalysisWithLLM(memories: MemoryNode[]): Promise<BrainCluster[] | null> {
  try {
    // Don't even try LLM if fewer than 5 memories — not enough signal
    if (memories.length < 5) return null

    const model = getGeminiFlashModel()

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

    // 3-second timeout for LLM — if it's slow, local clusters are sufficient
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('LLM timeout')), 3000)
    )

    const result = await Promise.race([
      model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: 'You are an AI brain that finds deep, non-obvious thematic connections between ideas. Return only valid JSON arrays.' }] },
          { role: 'model', parts: [{ text: 'Understood. I will analyze the memories and return a JSON array of thematic clusters.' }] },
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
      }),
      timeoutPromise,
    ])

    if (!result) return null

    const responseText = (result as Awaited<ReturnType<typeof model.generateContent>>).response.text()
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
    // Timeout or API error — local clusters are fine
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      markProviderFailed('gemini', 30)
    }
    console.warn('Gemini deep cluster analysis skipped:', err instanceof Error ? err.message : 'Unknown')
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN GET HANDLER ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const memoryId = searchParams.get('memoryId')

    // ── Check in-memory cache ──────────────────────────────────────────
    const userId = 'local' // Simplified — skip Supabase auth for speed
    const cacheKey = memoryId
      ? CACHE_KEYS.BRAIN_MEMORY(memoryId)
      : CACHE_KEYS.BRAIN(userId)

    const cached = aiCache.get<{ connections: Connection[]; clusters: BrainCluster[]; relatedMemories: { id: string; title: string; type: string; reason: string; strength: number }[] }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // ── Fetch all memories from Prisma ─────────────────────────────────
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
        take: 60,
      })
    } catch (prismaErr) {
      console.error('Prisma query failed:', prismaErr instanceof Error ? prismaErr.message : 'Unknown')
      return NextResponse.json(
        { error: 'Database not configured.' },
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

    // ── Run local computation first (instant) ────────────────────────
    const connections = computeConnections(memoryNodes)
    let clusters = detectClusters(memoryNodes)

    // ── Try LLM deep analysis as enhancement (with timeout) ─────────
    // Only if we have enough memories AND a Gemini API key AND not in cooldown
    if (memoryNodes.length >= 5 && process.env.GEMINI_API_KEY && !isProviderCoolingDown('gemini')) {
      const llmClusters = await deepAnalysisWithLLM(memoryNodes)
      if (llmClusters && llmClusters.length > 0) {
        const llmNames = new Set(llmClusters.map(c => c.name.toLowerCase()))
        const tagClustersFiltered = clusters.filter(c => !llmNames.has(c.name.toLowerCase()))
        clusters = [...llmClusters, ...tagClustersFiltered].slice(0, 10)
      }
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

    const responseBody = {
      connections,
      clusters,
      relatedMemories,
    }

    // ── Store in cache ─────────────────────────────────────────────────
    const ttl = memoryId ? CACHE_TTL.BRAIN_MEMORY : CACHE_TTL.BRAIN
    aiCache.set(cacheKey, responseBody, ttl)

    return NextResponse.json(responseBody)
  } catch (error) {
    console.error('Brain route error:', error)
    return NextResponse.json(
      { error: 'Brain analysis failed' },
      { status: 500 }
    )
  }
}

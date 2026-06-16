import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getGeminiFlashModel, getGeminiEmbeddingModel, aiCache, isProviderCoolingDown, markProviderFailed } from '@/lib/ai-cache'

// ═══════════════════════════════════════════════════════════════════════
// ─── ULTRA-FAST CAPTURE ROUTE ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
//
// Architecture: Immediate Ingestion + Asynchronous Enrichment
//
// 1. Parse FormData → validate → save raw row to DB → return instantly
// 2. After response: fire background AI (LLM, VLM, ASR) with timeouts
// 3. All AI calls have 5s timeout max — never block forever
// ═══════════════════════════════════════════════════════════════════════

// ─── TIMEOUT HELPER ──────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[Timeout] ${label} exceeded ${ms}ms`)
        resolve(null)
      }, ms)
    ),
  ])
}

// ─── KEYWORD-BASED AUTO-TAGGING (free, instant, always runs) ─────────
function autoGenerateTags(content: string, title: string): string[] {
  const text = `${title} ${content}`.toLowerCase()
  const tagMap: Record<string, string[]> = {
    work: ['meeting', 'project', 'deadline', 'client', 'office', 'team', 'q1', 'q2', 'q3', 'q4', 'quarterly', 'strategy', 'standup', 'sprint', 'agile'],
    personal: ['routine', 'morning', 'exercise', 'meditation', 'journal', 'habit', 'family', 'gratitude', 'wellness'],
    travel: ['trip', 'itinerary', 'flight', 'hotel', 'visit', 'tokyo', 'paris', 'destination', 'vacation', 'passport'],
    learning: ['learn', 'study', 'course', 'tutorial', 'book', 'read', 'article', 'university', 'lecture', 'research'],
    code: ['code', 'programming', 'react', 'javascript', 'typescript', 'api', 'bug', 'feature', 'css', 'html', 'framework', 'debug', 'deploy', 'git', 'docker', 'kubernetes'],
    design: ['design', 'ui', 'ux', 'layout', 'color', 'font', 'figma', 'wireframe', 'gradient', 'typography', 'prototype'],
    ai: ['ai', 'machine learning', 'neural', 'model', 'gpt', 'gemini', 'llm', 'chatbot', 'prompt', 'embedding', 'transformer'],
    recipe: ['recipe', 'cook', 'bake', 'ingredient', 'food', 'meal', 'breakfast', 'dinner', 'lunch'],
    finance: ['budget', 'invest', 'stock', 'savings', 'expense', 'income', 'tax', 'mortgage', 'crypto'],
    health: ['doctor', 'symptom', 'medication', 'workout', 'diet', 'sleep', 'mental health', 'therapy'],
    idea: ['idea', 'concept', 'brainstorm', 'innovative', 'startup', 'prototype', 'vision'],
    task: ['todo', 'remind', 'need to', 'must', 'buy', 'deadline', 'urgent'],
  }

  const tags: string[] = []
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.push(tag)
    }
  }
  return tags.slice(0, 5)
}

// ─── AI COGNITIVE SYNTHESIS ──────────────────────────────────────────

interface AISynthesis {
  suggested_title: string
  summary: string
  deep_insight: string
  tags: string[]
  connected_themes: string[]
}

const SYNTHESIS_SYSTEM_PROMPT = `You are the sovereign intelligence core of Aether — a personal second-brain system. Analyze this memory capture. Generate:
1. A clean, concise suggested title (max 60 chars)
2. A natural 2-sentence summary
3. A deep professional insight connecting this to broader patterns
4. 3-5 specific, lowercase tags that capture the essence
5. 2-3 connected themes — topics that this memory relates to that could link it to other memories

Return STRICTLY a valid JSON object. No markdown, no extra text:
{
  "suggested_title": "string",
  "summary": "string",
  "deep_insight": "string",
  "tags": ["tag1", "tag2", "tag3"],
  "connected_themes": ["theme1", "theme2"]
}`

function parseSynthesisResponse(responseText: string): AISynthesis {
  let jsonStr = responseText.trim()
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) jsonStr = jsonMatch[0]

  const parsed = JSON.parse(jsonStr)

  if (
    typeof parsed.suggested_title !== 'string' ||
    typeof parsed.summary !== 'string' ||
    typeof parsed.deep_insight !== 'string' ||
    !Array.isArray(parsed.tags)
  ) {
    throw new Error('Invalid synthesis JSON structure')
  }

  return {
    suggested_title: parsed.suggested_title,
    summary: parsed.summary,
    deep_insight: parsed.deep_insight,
    tags: parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 5),
    connected_themes: Array.isArray(parsed.connected_themes)
      ? parsed.connected_themes.filter((t: unknown) => typeof t === 'string').slice(0, 3)
      : [],
  }
}

async function synthesizeWithGemini(rawContent: string): Promise<AISynthesis> {
  const model = getGeminiFlashModel()

  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: SYNTHESIS_SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Understood. I will return strictly a JSON object with suggested_title, summary, deep_insight, tags, and connected_themes fields.' }] },
      { role: 'user', parts: [{ text: rawContent.slice(0, 4000) }] },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  })

  const responseText = result.response.text()
  return parseSynthesisResponse(responseText)
}

async function synthesizeWithGroq(rawContent: string): Promise<AISynthesis> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey || groqKey === 'placeholder_groq_key') {
    throw new Error('Groq API key not configured')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: rawContent.slice(0, 4000) },
      ],
      temperature: 0.4,
      max_tokens: 600,
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API returned ${response.status}`)
  }

  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content
  if (!responseText) {
    throw new Error('Empty Groq response')
  }

  return parseSynthesisResponse(responseText)
}

async function synthesizeWithLLM(rawContent: string): Promise<AISynthesis | null> {
  const promises: Promise<AISynthesis>[] = []

  if (process.env.GEMINI_API_KEY && !isProviderCoolingDown('gemini')) {
    promises.push(
      synthesizeWithGemini(rawContent).catch(err => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
          markProviderFailed('gemini', 30)
        }
        throw err
      })
    )
  }

  const groqKey = process.env.GROQ_API_KEY
  if (groqKey && groqKey !== 'placeholder_groq_key' && !isProviderCoolingDown('groq')) {
    promises.push(
      synthesizeWithGroq(rawContent).catch(err => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('403') || msg.includes('429')) {
          markProviderFailed('groq', msg.includes('429') ? 30 : 60)
        }
        throw err
      })
    )
  }

  if (promises.length === 0) return null

  try {
    // Race with 5s timeout — never block enrichment forever
    return await withTimeout(Promise.any(promises), 5000, 'LLM synthesis')
  } catch {
    return null
  }
}

// ─── IMAGE VISION ANALYSIS ───────────────────────────────────────────

interface ImageAnalysis {
  description: string
  extracted_text: string
  objects: string[]
  tags: string[]
}

async function analyzeImageWithVLM(imageFile: File): Promise<ImageAnalysis | null> {
  if (!process.env.GEMINI_API_KEY || isProviderCoolingDown('gemini')) return null

  try {
    const model = getGeminiFlashModel()

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = imageFile.type || 'image/png'

    const prompt = `Analyze this image in detail. Return a JSON object with:
- "description": A detailed 2-3 sentence description of what's in the image
- "extracted_text": Any text visible in the image (OCR). Empty string if none.
- "objects": Array of main objects/subjects detected (max 5)
- "tags": Array of 3-5 relevant lowercase tags describing the content

Return STRICTLY valid JSON only, no markdown or extra text.`

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      { text: prompt },
    ])

    const responseText = result.response.text()
    if (!responseText) return null

    let jsonStr = responseText.trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) jsonStr = jsonMatch[0]

    const parsed = JSON.parse(jsonStr)

    if (typeof parsed.description === 'string') {
      return {
        description: parsed.description || '',
        extracted_text: parsed.extracted_text || '',
        objects: Array.isArray(parsed.objects) ? parsed.objects.slice(0, 5) : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 5) : [],
      }
    }

    return null
  } catch (err) {
    console.warn('Gemini Vision image analysis failed:', err instanceof Error ? err.message : 'Unknown')
    return null
  }
}

// ─── AUDIO TRANSCRIPTION ─────────────────────────────────────────────

async function transcribeAudio(audioFile: File): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey && groqKey !== 'placeholder_groq_key' && !isProviderCoolingDown('groq')) {
    try {
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('model', 'whisper-large-v3-turbo')
      formData.append('response_format', 'json')

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.text?.trim()) return data.text
      }
    } catch (err) {
      console.warn('Groq Whisper failed:', err instanceof Error ? err.message : 'Unknown')
    }
  }

  return ''
}

// ─── SAVE TO PRISMA ──────────────────────────────────────────────────

async function saveToPrisma(data: {
  type: string
  title: string
  content: string
  summary: string | null
  deepInsight: string | null
  tags: string[]
  sourceUrl: string | null
  imageUrl: string | null
  imagePreview: string | null
  recap: string | null
}) {
  const memory = await db.memory.create({
    data: {
      type: data.type || 'text',
      title: data.title || '',
      content: data.content || '',
      summary: data.summary,
      deepInsight: data.deepInsight,
      tags: data.tags.join(','),
      sourceUrl: data.sourceUrl,
      imageUrl: data.imageUrl,
      imagePreview: data.imagePreview,
      recap: data.recap,
    },
    include: {
      collections: {
        include: {
          collection: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      },
    },
  })

  return {
    id: memory.id,
    type: memory.type,
    title: memory.title,
    content: memory.content,
    summary: memory.summary,
    deepInsight: memory.deepInsight || null,
    tags: memory.tags ? memory.tags.split(',').filter(Boolean) : [],
    sourceUrl: memory.sourceUrl,
    fileUrl: memory.fileUrl || null,
    imagePreview: memory.imagePreview || null,
    imageUrl: memory.imageUrl || null,
    recap: memory.recap || null,
    isFavorite: memory.isFavorite,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    collections: memory.collections.map(mc => ({
      id: mc.collection.id,
      name: mc.collection.name,
      color: mc.collection.color,
      icon: mc.collection.icon,
    })),
  }
}

// ─── FIND CONNECTED MEMORIES ────────────────────────────────────────

async function findConnectedMemories(
  newMemoryTags: string[],
  newMemoryContent: string,
  newMemoryId: string
): Promise<{ id: string; title: string; reason: string }[]> {
  try {
    const allMemories = await db.memory.findMany({
      where: {
        id: { not: newMemoryId },
      },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        type: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    if (allMemories.length === 0) return []

    const connected: { id: string; title: string; reason: string; score: number }[] = []

    for (const mem of allMemories) {
      const memTags = mem.tags ? mem.tags.split(',').filter(Boolean) : []
      const overlapTags = memTags.filter(t => newMemoryTags.includes(t.toLowerCase()))

      if (overlapTags.length > 0) {
        connected.push({
          id: mem.id,
          title: mem.title || 'Untitled',
          reason: `Shares tags: ${overlapTags.join(', ')}`,
          score: overlapTags.length * 2,
        })
      }

      const contentWords = mem.content.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const newWords = newMemoryContent.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const overlapWords = contentWords.filter(w => newWords.includes(w))
      if (overlapWords.length >= 2) {
        const existing = connected.find(c => c.id === mem.id)
        if (existing) {
          existing.score += overlapWords.length
        } else {
          connected.push({
            id: mem.id,
            title: mem.title || 'Untitled',
            reason: `Similar content themes`,
            score: overlapWords.length,
          })
        }
      }
    }

    return connected
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ id, title, reason }) => ({ id, title, reason }))
  } catch (err) {
    console.warn('Find connected memories failed:', err instanceof Error ? err.message : 'Unknown')
    return []
  }
}

// ─── INLINE EMBEDDING GENERATION ─────────────────────────────────────

async function generateInlineEmbedding(
  memoryId: string,
  aiTitle: string | null,
  aiSummary: string | null,
  enrichedContent: string
): Promise<void> {
  try {
    const embeddingModel = getGeminiEmbeddingModel()
    if (embeddingModel) {
      const embeddingContent = [aiTitle, aiSummary, enrichedContent].filter(Boolean).join(' ').slice(0, 2000)
      const embedResult = await embeddingModel.embedContent(embeddingContent)
      const embeddingVector = embedResult.embedding.values
      if (embeddingVector && embeddingVector.length > 0) {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const adminClient = createAdminClient()
        await adminClient.from('memories').update({ embedding: embeddingVector }).eq('id', memoryId)
      }
    }
  } catch (embedErr) {
    console.warn('Inline embedding generation failed:', embedErr instanceof Error ? embedErr.message : 'Unknown')
  }
}

// ─── BACKGROUND ENRICHMENT WORKER ────────────────────────────────────
//
// OPTIMIZED: All AI calls have timeouts. Never block forever.
// Phase 1: transcribe + VLM + synthesis + upload (parallel, with timeouts)
// Phase 2: Merge → update DB
// Phase 3: Embedding (parallel with Phase 2)

async function backgroundEnrichMemory(
  memoryId: string,
  rawContent: string,
  memoryType: string,
  imageFile: File | null,
  audioFile: File | null,
  _hasUrl: boolean,
  _url: string,
  _supabaseUserId: string | null
): Promise<void> {
  try {
    const startTime = Date.now()

    // ── SHORT CONTENT FAST PATH: Skip AI synthesis for trivial content ──
    const skipSynthesis = rawContent.trim().length < 50

    // ══════════════════════════════════════════════════════════════════
    // ── PHASE 1: PARALLEL — All independent operations with timeouts ──
    // ══════════════════════════════════════════════════════════════════
    const phase1Start = Date.now()

    const [audioResult, imageResult, synthesisResult] = await Promise.allSettled([
      // Audio transcription (if voice capture) — 5s timeout
      audioFile && audioFile.size > 0
        ? withTimeout(transcribeAudio(audioFile), 5000, 'Audio transcription')
        : Promise.resolve(''),

      // Image VLM analysis (if image capture) — 5s timeout
      imageFile && imageFile.size > 0
        ? withTimeout(analyzeImageWithVLM(imageFile), 5000, 'Image VLM analysis')
        : Promise.resolve<ImageAnalysis | null>(null),

      // AI Cognitive Synthesis — 5s timeout, skip for short content
      !skipSynthesis
        ? withTimeout(synthesizeWithLLM(rawContent), 5000, 'LLM synthesis')
        : Promise.resolve<AISynthesis | null>(null),
    ])

    console.log(`[Background Enrichment] Phase 1 (parallel) completed in ${Date.now() - phase1Start}ms`)

    const audioTranscript = audioResult.status === 'fulfilled' ? audioResult.value : ''
    const imageAnalysis = imageResult.status === 'fulfilled' ? imageResult.value : null
    const synthesis = synthesisResult.status === 'fulfilled' ? synthesisResult.value : null

    // ══════════════════════════════════════════════════════════════════
    // ── PHASE 2: Merge results → build enriched content → update DB ────
    // ══════════════════════════════════════════════════════════════════

    let enrichedContent = rawContent
    if (audioTranscript) {
      enrichedContent += (enrichedContent ? '\n\n' : '') + `Voice Transcript:\n${audioTranscript}`
    }
    if (imageAnalysis) {
      const imageContentParts: string[] = []
      if (imageAnalysis.description) imageContentParts.push(imageAnalysis.description)
      if (imageAnalysis.extracted_text) imageContentParts.push(`Text in image: ${imageAnalysis.extracted_text}`)
      if (imageAnalysis.objects.length > 0) imageContentParts.push(`Objects: ${imageAnalysis.objects.join(', ')}`)
      if (imageContentParts.length > 0) {
        enrichedContent += (enrichedContent ? '\n\n' : '') + imageContentParts.join('\n\n')
      }
    }

    let aiTitle: string | null = null
    let aiSummary: string | null = null
    let aiDeepInsight: string | null = null
    let aiTags = autoGenerateTags(enrichedContent, rawContent.slice(0, 80))
    let connectedThemes: string[] = []

    if (synthesis) {
      aiTitle = synthesis.suggested_title
      aiSummary = synthesis.summary
      aiDeepInsight = synthesis.deep_insight
      if (synthesis.tags.length > 0) {
        const allTags = [...new Set([...synthesis.tags, ...aiTags])]
        aiTags = allTags.slice(0, 6)
      }
      if (synthesis.connected_themes.length > 0) {
        connectedThemes = synthesis.connected_themes
      }
    }

    // Merge VLM tags
    if (imageAnalysis && imageAnalysis.tags.length > 0) {
      const allTags = [...new Set([...aiTags, ...imageAnalysis.tags.map(t => t.toLowerCase())])]
      aiTags = allTags.slice(0, 6)
    }

    // Build DB update payload
    const prismaUpdateData: Record<string, unknown> = {
      content: enrichedContent,
      tags: aiTags.join(','),
    }
    if (aiTitle) prismaUpdateData.title = aiTitle
    if (aiSummary) prismaUpdateData.summary = aiSummary
    if (aiDeepInsight) prismaUpdateData.deepInsight = aiDeepInsight

    // ── Phase 2+3: DB update + embedding in parallel ──────────────────
    const updatePromises: Promise<unknown>[] = []

    // DB Update
    updatePromises.push(
      (async () => {
        try {
          await db.memory.update({
            where: { id: memoryId },
            data: prismaUpdateData,
          })
          console.log(`[Background Enrichment] Memory ${memoryId} enriched successfully (Prisma) in ${Date.now() - startTime}ms`)
        } catch (err) {
          console.warn('Prisma enrichment update failed:', err instanceof Error ? err.message : 'Unknown')
        }
      })()
    )

    // Inline embedding (parallel with DB update)
    if (process.env.GEMINI_API_KEY) {
      updatePromises.push(
        withTimeout(
          generateInlineEmbedding(memoryId, aiTitle, aiSummary, enrichedContent),
          5000,
          'Embedding generation'
        )
      )
    }

    await Promise.allSettled(updatePromises)

    console.log(`[Background Enrichment] Total enrichment time for ${memoryId}: ${Date.now() - startTime}ms`)
  } catch (err) {
    console.error('[Background Enrichment] Fatal error:', err instanceof Error ? err.message : 'Unknown')
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN POST HANDLER ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    // ── STEP 1: Parse FormData ──────────────────────────────────────
    const formData = await req.formData()
    const text = (formData.get('text') as string) || ''
    const url = (formData.get('url') as string) || ''
    const imageFile = formData.get('image') as File | null
    const audioFile = formData.get('audio') as File | null

    const hasText = text.trim().length > 0
    const hasUrl = url.trim().length > 0
    const hasImage = imageFile && imageFile.size > 0
    const hasAudio = audioFile && audioFile.size > 0

    if (!hasText && !hasUrl && !hasImage && !hasAudio) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    // ── STEP 2: Determine type & build raw content ─────────────────
    let memoryType: string = 'text'
    if (hasAudio) memoryType = 'voice'
    if (hasImage) memoryType = 'image'
    if (hasUrl) memoryType = 'link'
    if (hasAudio && hasImage) memoryType = 'voice'
    if (!hasAudio && !hasImage && !hasUrl) memoryType = 'text'

    let rawContent = ''
    if (hasText) rawContent += text.trim()
    if (hasUrl) rawContent += (rawContent ? '\n\n' : '') + `URL: ${url.trim()}`
    if (hasImage && !rawContent) rawContent = 'Image capture'
    if (hasAudio && !rawContent) rawContent = 'Voice note'
    if (!rawContent) rawContent = 'Captured content'

    // ── STEP 3: Instant keyword-based tags (no AI, zero latency) ───
    const instantTags = autoGenerateTags(rawContent, text.slice(0, 80))

    // ── STEP 4: Immediate DB save ──────────────────────────────────
    try {
      const memory = await saveToPrisma({
        type: memoryType,
        title: hasText ? text.slice(0, 80) : hasUrl ? 'Saved Link' : hasAudio ? 'Voice Note' : 'Image Capture',
        content: rawContent,
        summary: null,
        deepInsight: null,
        tags: instantTags,
        sourceUrl: hasUrl ? url.trim() : null,
        imageUrl: null,
        imagePreview: null,
        recap: null,
      })

      const savedMemory = {
        ...memory,
        enriching: true,
      }

      // ── INSTANT RETURN — user sees memory immediately ────────────
      const response = NextResponse.json({ success: true, memory: savedMemory })

      // ── Invalidate caches (new memory changes everything) ────────
      aiCache.invalidate('brain:')
      aiCache.invalidate('reap:')

      // ── BACKGROUND ENRICHMENT (fire and forget) ──────────────────
      backgroundEnrichMemory(
        memory.id,
        rawContent,
        memoryType,
        hasImage ? imageFile : null,
        hasAudio ? audioFile : null,
        hasUrl,
        url,
        null // No Supabase user in local mode
      ).catch(err => {
        console.error('[Background Enrichment] Unhandled error:', err instanceof Error ? err.message : 'Unknown')
      })

      return response
    } catch (prismaErr) {
      console.error('Prisma save failed:', prismaErr instanceof Error ? prismaErr.message : 'Unknown')
      return NextResponse.json(
        { error: 'Database save failed.' },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('Capture route error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

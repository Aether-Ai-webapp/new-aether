import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════════════
// ─── SUPABASE AVAILABILITY CHECK ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key && url !== 'your_supabase_url_here' && key !== 'your_supabase_anon_key_here')
}

// ═══════════════════════════════════════════════════════════════════════
// ─── SUPABASE SERVER CLIENT (cookie-aware for Route Handlers) ────────
// ═══════════════════════════════════════════════════════════════════════

async function getSupabaseRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieStore = await cookies()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  })

  return supabase
}

// ═══════════════════════════════════════════════════════════════════════
// ─── KEYWORD-BASED AUTO-TAGGING (free, instant, always runs) ─────────
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// ─── AI COGNITIVE SYNTHESIS (Gemini Flash — production-ready) ──────────
// ═══════════════════════════════════════════════════════════════════════

interface AISynthesis {
  suggested_title: string
  summary: string
  deep_insight: string
  tags: string[]
  connected_themes: string[]
}

async function synthesizeWithLLM(rawContent: string): Promise<AISynthesis | null> {
  const systemPrompt = `You are the sovereign intelligence core of Aether — a personal second-brain system. Analyze this memory capture. Generate:
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

  // ── PRIMARY: Gemini Flash ────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I will return strictly a JSON object with suggested_title, summary, deep_insight, tags, and connected_themes fields.' }] },
          { role: 'user', parts: [{ text: rawContent.slice(0, 4000) }] },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
      })

      const responseText = result.response.text()
      let jsonStr = responseText.trim()
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) jsonStr = jsonMatch[0]

      const parsed = JSON.parse(jsonStr)

      if (
        typeof parsed.suggested_title === 'string' &&
        typeof parsed.summary === 'string' &&
        typeof parsed.deep_insight === 'string' &&
        Array.isArray(parsed.tags)
      ) {
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

      return null
    } catch (err) {
      console.warn('Gemini synthesis failed:', err instanceof Error ? err.message : 'Unknown')
    }
  }

  // ── FALLBACK: Groq (fast & cheap) ──────────────────────────────
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawContent.slice(0, 4000) },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const responseText = data.choices?.[0]?.message?.content
        if (responseText) {
          let jsonStr = responseText.trim()
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
          if (jsonMatch) jsonStr = jsonMatch[0]

          const parsed = JSON.parse(jsonStr)

          if (
            typeof parsed.suggested_title === 'string' &&
            typeof parsed.summary === 'string' &&
            typeof parsed.deep_insight === 'string' &&
            Array.isArray(parsed.tags)
          ) {
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
        }
      }
    } catch (err) {
      console.warn('Groq synthesis failed:', err instanceof Error ? err.message : 'Unknown')
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════
// ─── IMAGE VISION ANALYSIS (Gemini Vision — production-ready) ──────────
// ═══════════════════════════════════════════════════════════════════════

interface ImageAnalysis {
  description: string
  extracted_text: string
  objects: string[]
  tags: string[]
}

async function analyzeImageWithVLM(imageFile: File): Promise<ImageAnalysis | null> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    console.warn('No GEMINI_API_KEY set — image analysis unavailable')
    return null
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Convert image to base64
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

// ═══════════════════════════════════════════════════════════════════════
// ─── AUDIO TRANSCRIPTION (Groq Whisper — production-ready) ────────────
// ═══════════════════════════════════════════════════════════════════════

async function transcribeAudio(audioFile: File): Promise<string> {
  // Try Groq Whisper (fast & accurate)
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey && groqKey !== 'placeholder_groq_key') {
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

// ═══════════════════════════════════════════════════════════════════════
// ─── IMAGE UPLOAD TO SUPABASE STORAGE (when configured) ──────────────
// ═══════════════════════════════════════════════════════════════════════

async function uploadImageToStorage(
  imageFile: File,
  userId: string,
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>
): Promise<string | null> {
  try {
    const ext = imageFile.name.split('.').pop() || 'png'
    const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('memories')
      .upload(filename, buffer, {
        contentType: imageFile.type || 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.warn('Supabase Storage upload failed:', uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('memories')
      .getPublicUrl(filename)

    return urlData?.publicUrl || null
  } catch (err) {
    console.warn('Image upload error:', err instanceof Error ? err.message : 'Unknown')
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── COLLECTION TAG MATCHING (Supabase only) ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════

async function matchOrCreateCollections(
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>,
  userId: string,
  memoryId: string,
  tags: string[]
): Promise<void> {
  if (tags.length === 0) return

  try {
    const { data: existingCollections } = await supabase
      .from('collections')
      .select('id, name')
      .eq('user_id', userId)

    if (existingCollections && existingCollections.length > 0) {
      for (const tag of tags) {
        const tagLower = tag.toLowerCase()
        const matched = existingCollections.find((c: { id: string; name: string }) =>
          c.name.toLowerCase().includes(tagLower) || tagLower.includes(c.name.toLowerCase())
        )

        if (matched) {
          await supabase
            .from('memory_collections')
            .insert({
              memory_id: memoryId,
              collection_id: matched.id,
            })
          break
        }
      }
    }
  } catch (err) {
    console.warn('Collection matching failed:', err instanceof Error ? err.message : 'Unknown')
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── SAVE TO PRISMA (Local Fallback — always works) ─────────────────
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// ─── FIND CONNECTED MEMORIES (for AI Brain) ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════

async function findConnectedMemories(
  newMemoryTags: string[],
  newMemoryContent: string,
  newMemoryId: string
): Promise<{ id: string; title: string; reason: string }[]> {
  try {
    // Get all existing memories from Prisma
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

    // ── Quick tag-based matching (instant, no LLM needed) ─────────
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

      // Content similarity — check for common meaningful words
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

    // Sort by score and return top 5
    return connected
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ id, title, reason }) => ({ id, title, reason }))
  } catch (err) {
    console.warn('Find connected memories failed:', err instanceof Error ? err.message : 'Unknown')
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── BACKGROUND ENRICHMENT WORKER ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
// This function runs AFTER the response is sent. It performs all the
// expensive AI operations (LLM synthesis, VLM analysis, transcription)
// and then updates the database row with the enriched data.

async function backgroundEnrichMemory(
  memoryId: string,
  rawContent: string,
  memoryType: string,
  imageFile: File | null,
  audioFile: File | null,
  hasUrl: boolean,
  url: string,
  supabaseUserId: string | null
): Promise<void> {
  try {
    // ── 1. Audio transcription (if voice capture) ──────────────────
    let audioTranscript = ''
    if (audioFile && audioFile.size > 0) {
      audioTranscript = await transcribeAudio(audioFile)
    }

    // ── 2. Image analysis (if image capture) ───────────────────────
    let imageAnalysis: ImageAnalysis | null = null
    if (imageFile && imageFile.size > 0) {
      imageAnalysis = await analyzeImageWithVLM(imageFile)
    }

    // ── 3. Build enriched content ──────────────────────────────────
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

    // ── 4. AI Cognitive Synthesis ──────────────────────────────────
    const synthesis = await synthesizeWithLLM(enrichedContent)

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

    // ── 5. Upload image to Supabase Storage (if applicable) ────────
    let uploadedImageUrl: string | null = null
    if (imageFile && imageFile.size > 0 && supabaseUserId && isSupabaseConfigured()) {
      try {
        const supabase = await getSupabaseRouteClient()
        uploadedImageUrl = await uploadImageToStorage(imageFile, supabaseUserId, supabase)
      } catch (err) {
        console.warn('Background image upload failed:', err instanceof Error ? err.message : 'Unknown')
      }
    }

    // ── 6. Update database with enriched data ─────────────────────
    const updateData: Record<string, unknown> = {
      content: enrichedContent,
      tags: aiTags.join(','),
    }
    if (aiTitle) updateData.title = aiTitle
    if (aiSummary) updateData.summary = aiSummary
    if (aiDeepInsight) updateData.deep_insight = aiDeepInsight
    if (uploadedImageUrl) updateData.image_url = uploadedImageUrl

    // Try Supabase update first
    if (supabaseUserId && isSupabaseConfigured()) {
      try {
        const supabase = await getSupabaseRouteClient()
        const { error } = await supabase
          .from('memories')
          .update(updateData)
          .eq('id', memoryId)

        if (!error) {
          // Collection tag matching
          await matchOrCreateCollections(supabase, supabaseUserId, memoryId, aiTags)

          // Trigger embedding generation in background
          try {
            const embeddingContent = [aiTitle, aiSummary, enrichedContent].filter(Boolean).join(' ').slice(0, 2000)
            await fetch('/api/generate-embedding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ memoryId, content: embeddingContent }),
            })
          } catch {
            // Non-blocking — embedding is nice-to-have
          }

          console.log(`[Background Enrichment] Memory ${memoryId} enriched successfully (Supabase)`)
          return
        }
        console.warn('Supabase enrichment update failed:', error.message)
      } catch (err) {
        console.warn('Supabase enrichment failed, falling back to Prisma:', err instanceof Error ? err.message : 'Unknown')
      }
    }

    // Prisma fallback for enrichment update
    try {
      const prismaUpdateData: Record<string, unknown> = {
        content: enrichedContent,
        tags: aiTags.join(','),
      }
      if (aiTitle) prismaUpdateData.title = aiTitle
      if (aiSummary) prismaUpdateData.summary = aiSummary
      if (aiDeepInsight) prismaUpdateData.deepInsight = aiDeepInsight
      if (uploadedImageUrl) prismaUpdateData.imageUrl = uploadedImageUrl

      await db.memory.update({
        where: { id: memoryId },
        data: prismaUpdateData,
      })

      console.log(`[Background Enrichment] Memory ${memoryId} enriched successfully (Prisma)`)
    } catch (err) {
      console.warn('Prisma enrichment update failed:', err instanceof Error ? err.message : 'Unknown')
    }
  } catch (err) {
    console.error('[Background Enrichment] Fatal error:', err instanceof Error ? err.message : 'Unknown')
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN POST HANDLER ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
//
// ARCHITECTURE: Immediate Ingestion + Asynchronous Enrichment
//
// 1. Parse FormData → validate → save raw row to DB → return instantly (~200ms)
// 2. After response: fire background AI (LLM, VLM, ASR) → update row with enriched data
//
// The frontend uses Optimistic UI to show a placeholder immediately,
// then replaces it with the real memory when the API responds, and
// later updates it again when AI enrichment completes via polling or refetch.

export async function POST(req: NextRequest) {
  try {
    // ── STEP 1: Parse FormData ──────────────────────────────────────
    const formData = await req.formData()
    const text = (formData.get('text') as string) || ''
    const url = (formData.get('url') as string) || ''
    const imageFile = formData.get('image') as File | null
    const audioFile = formData.get('audio') as File | null

    // Validate: at least one content source
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

    // Build raw content from what we have immediately
    let rawContent = ''
    if (hasText) rawContent += text.trim()
    if (hasUrl) rawContent += (rawContent ? '\n\n' : '') + `URL: ${url.trim()}`
    if (hasImage && !rawContent) rawContent = 'Image capture'
    if (hasAudio && !rawContent) rawContent = 'Voice note'
    if (!rawContent) rawContent = 'Captured content'

    // ── STEP 3: Instant keyword-based tags (no AI, zero latency) ───
    const instantTags = autoGenerateTags(rawContent, text.slice(0, 80))

    // ── STEP 4: Immediate DB save (raw, no AI enrichment yet) ──────
    let savedMemoryId: string
    let supabaseUserId: string | null = null
    let savedMemory: Record<string, unknown>

    // Try Supabase first
    if (isSupabaseConfigured()) {
      try {
        const supabase = await getSupabaseRouteClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (!authError && user) {
          supabaseUserId = user.id

          // Upload image immediately (storage is fast, doesn't need AI)
          let imageUrl: string | null = null
          if (hasImage) {
            imageUrl = await uploadImageToStorage(imageFile, user.id, supabase)
          }

          const { data: memoryRow, error: insertError } = await supabase
            .from('memories')
            .insert({
              user_id: user.id,
              type: memoryType,
              title: hasText ? text.slice(0, 80) : hasUrl ? 'Saved Link' : hasAudio ? 'Voice Note' : 'Image Capture',
              content: rawContent,
              summary: null, // Will be filled by background enrichment
              deep_insight: null,
              tags: instantTags.join(','),
              source_url: hasUrl ? url.trim() : null,
              image_url: imageUrl,
              image_preview: null,
              file_url: null,
              recap: null,
              is_favorite: false,
            })
            .select('*, memory_collections(collection_id, collections(id, name, color, icon))')
            .single()

          if (!insertError && memoryRow) {
            const row = memoryRow as Record<string, unknown>
            savedMemoryId = row.id as string
            const memoryCollections = (row.memory_collections as Array<{ collection_id: string; collections: { id: string; name: string; color: string; icon: string } }>) || []

            savedMemory = {
              id: row.id,
              type: (row.type as string) || 'text',
              title: (row.title as string) || '',
              content: (row.content as string) || '',
              summary: (row.summary as string) || null,
              deepInsight: (row.deep_insight as string) || null,
              tags: row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
              sourceUrl: (row.source_url as string) || null,
              fileUrl: (row.file_url as string) || null,
              imagePreview: (row.image_preview as string) || null,
              imageUrl: (row.image_url as string) || null,
              recap: (row.recap as string) || null,
              isFavorite: (row.is_favorite as boolean) || false,
              createdAt: (row.created_at as string) || new Date().toISOString(),
              updatedAt: (row.updated_at as string) || new Date().toISOString(),
              collections: memoryCollections.map(mc => ({
                id: mc.collections.id,
                name: mc.collections.name,
                color: mc.collections.color,
                icon: mc.collections.icon,
              })),
              enriching: true, // Signal to frontend that AI enrichment is pending
            }

            // ── INSTANT RETURN — user sees memory immediately ────────
            const response = NextResponse.json({ success: true, memory: savedMemory })

            // ── BACKGROUND ENRICHMENT (fire and forget) ──────────────
            // This runs AFTER the response is sent to the client
            backgroundEnrichMemory(
              savedMemoryId,
              rawContent,
              memoryType,
              hasImage ? imageFile : null,
              hasAudio ? audioFile : null,
              hasUrl,
              url,
              supabaseUserId
            ).catch(err => {
              console.error('[Background Enrichment] Unhandled error:', err instanceof Error ? err.message : 'Unknown')
            })

            return response
          }

          console.warn('Supabase insert failed, falling back to Prisma:', insertError?.message)
        }
      } catch (err) {
        console.warn('Supabase capture failed, falling back to Prisma:', err instanceof Error ? err.message : 'Unknown')
      }
    }

    // ── PRISMA FALLBACK (always works) ─────────────────────────────
    const memory = await saveToPrisma({
      type: memoryType,
      title: hasText ? text.slice(0, 80) : hasUrl ? 'Saved Link' : hasAudio ? 'Voice Note' : 'Image Capture',
      content: rawContent,
      summary: null, // Will be filled by background enrichment
      deepInsight: null,
      tags: instantTags,
      sourceUrl: hasUrl ? url.trim() : null,
      imageUrl: null,
      imagePreview: null,
      recap: null,
    })

    savedMemoryId = memory.id
    savedMemory = {
      ...memory,
      enriching: true, // Signal to frontend that AI enrichment is pending
    }

    // ── INSTANT RETURN — user sees memory immediately ────────────────
    const response = NextResponse.json({ success: true, memory: savedMemory })

    // ── BACKGROUND ENRICHMENT (fire and forget) ──────────────────────
    backgroundEnrichMemory(
      savedMemoryId,
      rawContent,
      memoryType,
      hasImage ? imageFile : null,
      hasAudio ? audioFile : null,
      hasUrl,
      url,
      supabaseUserId
    ).catch(err => {
      console.error('[Background Enrichment] Unhandled error:', err instanceof Error ? err.message : 'Unknown')
    })

    return response
  } catch (error) {
    console.error('Capture route error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple auto-tagging based on content keywords (no external API needed)
function autoGenerateTags(content: string, title: string): string[] {
  const text = `${title} ${content}`.toLowerCase()
  const tagMap: Record<string, string[]> = {
    'work': ['meeting', 'project', 'deadline', 'client', 'office', 'team', 'q1', 'q2', 'q3', 'q4', 'quarterly', 'strategy'],
    'personal': ['routine', 'morning', 'exercise', 'meditation', 'journal', 'habit'],
    'travel': ['trip', 'itinerary', 'flight', 'hotel', 'visit', 'tokyo', 'paris', 'destination'],
    'learning': ['learn', 'study', 'course', 'tutorial', 'book', 'read', 'article'],
    'code': ['code', 'programming', 'react', 'javascript', 'typescript', 'api', 'bug', 'feature', 'css', 'html', 'framework'],
    'design': ['design', 'ui', 'ux', 'layout', 'color', 'font', 'figma', 'wireframe'],
    'ai': ['ai', 'machine learning', 'neural', 'model', 'gpt', 'gemini', 'llm', 'chatbot'],
    'recipe': ['recipe', 'cook', 'bake', 'ingredient', 'food', 'meal', 'breakfast', 'dinner'],
    'idea': ['idea', 'concept', 'brainstorm', 'innovative', 'startup', 'prototype'],
    'finance': ['budget', 'expense', 'invest', 'savings', 'money', 'cost'],
  }

  const tags: string[] = []
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.push(tag)
    }
  }

  return tags.slice(0, 5)
}

// GET /api/memories - List all memories
// When authenticated, try Supabase first; fall back to Prisma
export async function GET() {
  try {
    // Try Supabase first if user is authenticated
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (!authError && user) {
        const { data, error } = await supabase
          .from('memories')
          .select('*, memory_collections(collection_id, collections(id, name, color, icon))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const result = data.map((m: Record<string, unknown>) => ({
            id: m.id,
            type: m.type,
            title: m.title,
            content: m.content,
            summary: m.summary,
            tags: m.tags ? (m.tags as string).split(',').filter(Boolean) : [],
            sourceUrl: m.source_url,
            fileUrl: m.file_url,
            imagePreview: m.image_preview,
            isFavorite: m.is_favorite,
            createdAt: m.created_at,
            updatedAt: m.updated_at,
            collections: (m.memory_collections as Record<string, Record<string, unknown>>[])?.map((mc: Record<string, unknown>) => ({
              id: (mc.collections as Record<string, unknown>)?.id,
              name: (mc.collections as Record<string, unknown>)?.name,
              color: (mc.collections as Record<string, unknown>)?.color,
              icon: (mc.collections as Record<string, unknown>)?.icon,
            })) || [],
          }))
          return NextResponse.json(result)
        }
        // If Supabase query fails (tables don't exist), fall through to Prisma
      }
    } catch (supabaseErr) {
      console.error('Supabase GET memories failed:', supabaseErr instanceof Error ? supabaseErr.message : 'Unknown error')
      // Fall through to Prisma
    }

    // Fallback: Prisma
    const memories = await db.memory.findMany({
      orderBy: { createdAt: 'desc' },
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

    const result = memories.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      content: m.content,
      summary: m.summary,
      tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
      sourceUrl: m.sourceUrl,
      fileUrl: m.fileUrl,
      imagePreview: m.imagePreview,
      isFavorite: m.isFavorite,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      collections: m.collections.map((mc) => ({
        id: mc.collection.id,
        name: mc.collection.name,
        color: mc.collection.color,
        icon: mc.collection.icon,
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch memories:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

// POST /api/memories - Create a new memory with auto-tagging
// When authenticated, try Supabase first; fall back to Prisma
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, title, content, sourceUrl, tags, collectionIds, imagePreview, fileUrl } = body

    if (!content?.trim() && !sourceUrl?.trim() && !imagePreview?.trim()) {
      return NextResponse.json({ error: 'Content, URL, or image is required' }, { status: 400 })
    }

    // Auto-generate tags if not provided
    let finalTags = tags
    if ((!tags || tags.length === 0) && content?.trim()) {
      const autoTags = autoGenerateTags(content, title || '')
      if (autoTags.length > 0) {
        finalTags = autoTags
      }
    }

    // Try Supabase first if user is authenticated
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: memoryRow, error } = await supabase
          .from('memories')
          .insert({
            user_id: user.id,
            type: type || 'text',
            title: title || '',
            content: content || '',
            source_url: sourceUrl || null,
            file_url: fileUrl || null,
            image_preview: imagePreview || null,
            tags: finalTags ? (Array.isArray(finalTags) ? finalTags.join(',') : finalTags) : '',
          })
          .select('*, memory_collections(collection_id, collections(id, name, color, icon))')
          .single()

        if (!error && memoryRow) {
          const m = memoryRow as Record<string, unknown>

          // If collectionIds provided, create junction rows
          if (collectionIds?.length) {
            await supabase.from('memory_collections').insert(
              collectionIds.map((cid: string) => ({
                memory_id: m.id,
                collection_id: cid,
              }))
            )
          }

          return NextResponse.json(
            {
              id: m.id,
              type: m.type,
              title: m.title,
              content: m.content,
              summary: m.summary,
              tags: m.tags ? (m.tags as string).split(',').filter(Boolean) : [],
              sourceUrl: m.source_url,
              fileUrl: m.file_url,
              imagePreview: m.image_preview,
              isFavorite: m.is_favorite,
              createdAt: m.created_at,
              updatedAt: m.updated_at,
              collections: [],
            },
            { status: 201 }
          )
        }
        // If Supabase insert fails (tables don't exist), fall through to Prisma
      }
    } catch {
      // Fall through to Prisma
    }

    // Fallback: Prisma
    const memory = await db.memory.create({
      data: {
        type: type || 'text',
        title: title || '',
        content: content || '',
        summary: null,
        sourceUrl: sourceUrl || null,
        fileUrl: fileUrl || null,
        imagePreview: imagePreview || null,
        tags: finalTags ? (Array.isArray(finalTags) ? finalTags.join(',') : finalTags) : '',
        collections: collectionIds?.length
          ? {
              create: collectionIds.map((cid: string) => ({
                collectionId: cid,
              })),
            }
          : undefined,
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

    return NextResponse.json(
      {
        id: memory.id,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        summary: memory.summary,
        tags: memory.tags ? memory.tags.split(',').filter(Boolean) : [],
        sourceUrl: memory.sourceUrl,
        fileUrl: memory.fileUrl,
        imagePreview: memory.imagePreview,
        isFavorite: memory.isFavorite,
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
        collections: memory.collections.map((mc) => ({
          id: mc.collection.id,
          name: mc.collection.name,
          color: mc.collection.color,
          icon: mc.collection.icon,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create memory:', error)
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 })
  }
}

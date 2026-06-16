import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/collections - List all collections
export async function GET() {
  try {
    // Try Supabase first if user is authenticated
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from('collections')
          .select('*, memory_collections(id)')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (!error && data) {
          const result = data.map((c: Record<string, unknown>) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || '📁',
            color: c.color || '#6D597A',
            createdAt: c.created_at,
            memoryCount: (c.memory_collections as unknown[])?.length || 0,
          }))
          return NextResponse.json(result)
        }
      }
    } catch {
      // Fall through to Prisma
    }

    // Fallback: Prisma
    const collections = await db.collection.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { memories: true } },
      },
    })

    const result = collections.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      createdAt: c.createdAt.toISOString(),
      memoryCount: c._count.memories,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch collections:', error)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

// POST /api/collections - Create a new collection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, color, icon } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Try Supabase first if user is authenticated
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: collectionRow, error } = await supabase
          .from('collections')
          .insert({
            user_id: user.id,
            name: name.trim(),
            color: color || '#6D597A',
            icon: icon || '📁',
          })
          .select()
          .single()

        if (!error && collectionRow) {
          return NextResponse.json({
            id: (collectionRow as Record<string, unknown>).id,
            name: (collectionRow as Record<string, unknown>).name,
            icon: (collectionRow as Record<string, unknown>).icon,
            color: (collectionRow as Record<string, unknown>).color,
            createdAt: (collectionRow as Record<string, unknown>).created_at,
            memoryCount: 0,
          }, { status: 201 })
        }
      }
    } catch {
      // Fall through to Prisma
    }

    // Fallback: Prisma
    const collection = await db.collection.create({
      data: {
        name: name.trim(),
        color: color || '#6D597A',
        icon: icon || '📁',
      },
    })

    return NextResponse.json({
      id: collection.id,
      name: collection.name,
      icon: collection.icon,
      color: collection.color,
      createdAt: collection.createdAt.toISOString(),
      memoryCount: 0,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create collection:', error)
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }
}

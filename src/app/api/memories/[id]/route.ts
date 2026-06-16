import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/memories/:id - Update a memory
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, content, tags, sourceUrl, isFavorite, type, summary, collectionIds } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.join(',') : tags
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite
    if (type !== undefined) updateData.type = type
    if (summary !== undefined) updateData.summary = summary

    // Handle collection membership updates
    if (collectionIds !== undefined) {
      // Delete existing and recreate
      await db.memoryCollection.deleteMany({ where: { memoryId: id } })
      if (Array.isArray(collectionIds) && collectionIds.length > 0) {
        updateData.collections = {
          create: collectionIds.map((cid: string) => ({ collectionId: cid })),
        }
      }
    }

    const memory = await db.memory.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Failed to update memory:', error)
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 })
  }
}

// DELETE /api/memories/:id - Delete a memory
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.memory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete memory:', error)
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateTags } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/ai/tags - Auto-generate tags for content (alias of /api/auto-tag)
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()
    if (!content?.trim()) {
      return NextResponse.json({ tags: [] }, { status: 400 })
    }
    const tags = await generateTags(content)
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Tags error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json({ tags: [] })
  }
}

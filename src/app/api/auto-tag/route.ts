import { NextRequest, NextResponse } from 'next/server'
import { generateTags } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/auto-tag - Fast AI tagging (Groq primary, failover chain)
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()
    if (!content?.trim()) {
      return NextResponse.json({ tags: [] }, { status: 400 })
    }

    // Race with a 12s timeout to guarantee snappy UX
    const tags = await Promise.race([
      generateTags(content),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 12000)),
    ])

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Auto-tag error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json({ tags: [] })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateSummary } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/ai/summary - Auto-generate summary for content
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()
    if (!content?.trim()) {
      return NextResponse.json({ summary: '' }, { status: 400 })
    }

    const summary = await Promise.race([
      generateSummary(content),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 15000)),
    ])
    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summary error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json({ summary: '' })
  }
}

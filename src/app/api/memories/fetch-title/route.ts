import { NextRequest, NextResponse } from 'next/server'
import { readUrlContent } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 15

// POST /api/memories/fetch-title - Fast URL title fetcher
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    try {
      const { title } = await readUrlContent(url.trim())
      return NextResponse.json({ title: title || null })
    } catch {
      return NextResponse.json({ title: null })
    }
  } catch {
    return NextResponse.json({ title: null })
  }
}

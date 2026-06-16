import { NextRequest, NextResponse } from 'next/server'
import { readUrlContent } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/ai/read-link - Read and extract content from a URL (fast, reliable)
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const { title, text } = await readUrlContent(url.trim())

    if (!title && !text) {
      try {
        const u = new URL(url)
        return NextResponse.json({
          title: u.hostname,
          content: url,
          description: 'Could not read content from this URL.',
        })
      } catch {
        return NextResponse.json({ title: '', content: '', description: '' })
      }
    }

    return NextResponse.json({
      title,
      content: text,
      description: text.slice(0, 300),
    })
  } catch (error) {
    console.error('Read link error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json({ error: 'Failed to read link' }, { status: 500 })
  }
}

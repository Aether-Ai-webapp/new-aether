import { NextRequest, NextResponse } from 'next/server'

// POST /api/ai/read-link - Read and extract content from a URL
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let title = ''
    let content = ''
    let description = ''

    // Fetch the URL and extract content
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AetherBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        const html = await response.text()

        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        title = titleMatch ? titleMatch[1].trim() : ''

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)
        description = descMatch ? descMatch[1].trim() : ''

        // Also try og:description
        if (!description) {
          const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i)
          description = ogDescMatch ? ogDescMatch[1].trim() : ''
        }

        // Try og:title if no title
        if (!title) {
          const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i)
          title = ogTitleMatch ? ogTitleMatch[1].trim() : ''
        }

        // Strip HTML tags for content
        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000)
      }
    } catch (fetchError) {
      console.warn('URL fetch failed:', fetchError instanceof Error ? fetchError.message : 'Unknown')
    }

    // If we still got nothing, return the URL itself as a fallback
    if (!title && !content) {
      return NextResponse.json({
        title: new URL(url).hostname,
        content: url,
        description: 'Could not read content from this URL.',
      })
    }

    return NextResponse.json({ title, content, description })
  } catch (error) {
    console.error('Read link error:', error)
    return NextResponse.json({ error: 'Failed to read link' }, { status: 500 })
  }
}

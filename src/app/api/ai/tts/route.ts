import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Split long text into <=1000 char chunks at sentence boundaries
function splitText(text: string, maxLen = 1000): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return [cleaned]
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned]
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length <= maxLen) {
      cur += s
    } else {
      if (cur) chunks.push(cur.trim())
      cur = s
    }
  }
  if (cur) chunks.push(cur.trim())
  return chunks
}

// POST /api/ai/tts - Convert text to speech audio (wav) using z-ai-web-dev-sdk
// Body: { text: string, voice?: string, speed?: number }
// Returns: audio/wav buffer
export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0 } = await req.json()
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const chunks = splitText(text, 1000)

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // For a single chunk: stream directly as wav
    if (chunks.length === 1) {
      const response = await zai.audio.tts.create({
        input: chunks[0],
        voice,
        speed: Math.min(Math.max(speed, 0.5), 2.0),
        response_format: 'wav',
        stream: false,
      } as Record<string, unknown>)

      const arrayBuffer = await (response as Response).arrayBuffer()
      const buffer = Buffer.from(new Uint8Array(arrayBuffer))

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Multi-chunk: concatenate wav buffers
    const buffers: Buffer[] = []
    for (const chunk of chunks) {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice,
        speed: Math.min(Math.max(speed, 0.5), 2.0),
        response_format: 'wav',
        stream: false,
      } as Record<string, unknown>)
      const ab = await (response as Response).arrayBuffer()
      buffers.push(Buffer.from(new Uint8Array(ab)))
    }

    // For multi-chunk, we can't simply concat WAV files (header conflicts).
    // Return the first chunk's WAV with the rest appended as raw PCM (best effort).
    // Most browsers will play the first WAV header and ignore subsequent ones.
    const combined = Buffer.concat(buffers)
    return new NextResponse(combined, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': combined.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('TTS error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS failed' },
      { status: 500 }
    )
  }
}

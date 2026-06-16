import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/ai/asr - Transcribe audio (base64) using z-ai-web-dev-sdk
// Body: { audio: string (base64) }
// Returns: { text: string }
export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json()
    if (!audio?.trim()) {
      return NextResponse.json({ error: 'Audio (base64) is required' }, { status: 400 })
    }

    // Strip data URL prefix if present (e.g., data:audio/webm;base64,XXXX)
    const base64 = audio.replace(/^data:audio\/[a-z0-9.]+;base64,/i, '')

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const response = await zai.audio.asr.create({
      file_base64: base64,
    } as Record<string, unknown>)

    const text = (response as { text?: string }).text || ''
    return NextResponse.json({ text })
  } catch (error) {
    console.error('ASR error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Use the AI SDK to transcribe audio
    try {
      const { createTranscription } = await import('@/lib/aether-asr')
      const text = await createTranscription(audioFile)
      if (text?.trim()) {
        return NextResponse.json({ text: text.trim() })
      }
    } catch {
      // Fall through to simple response
    }

    // Fallback: return empty transcription (no external API available)
    return NextResponse.json({ text: '' })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/ai/image - Generate an image from text prompt using z-ai-web-dev-sdk
// Body: { prompt: string, size?: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440' }
// Returns: { base64: string, url: 'data:image/png;base64,...' }
export async function POST(req: NextRequest) {
  try {
    const { prompt, size = '1024x1024' } = await req.json()
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const SUPPORTED_SIZES = ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864', '1440x720', '720x1440']
    const finalSize = SUPPORTED_SIZES.includes(size) ? size : '1024x1024'

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const response = await zai.images.generations.create({
      prompt: prompt.trim(),
      size: finalSize,
    } as Record<string, unknown>)

    const imageBase64 = response.data?.[0]?.base64
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image returned' }, { status: 500 })
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`

    return NextResponse.json({
      base64: imageBase64,
      url: dataUrl,
      size: finalSize,
    })
  } catch (error) {
    console.error('Image gen error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    )
  }
}

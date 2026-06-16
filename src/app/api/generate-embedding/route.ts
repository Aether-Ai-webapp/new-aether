import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/generate-embedding
 *
 * Generates a vector embedding for a memory's content using Gemini
 * text-embedding-004, then updates the memory row in Supabase.
 *
 * Body: { memoryId: string, content: string }
 *
 * This is called in the background after a memory is saved —
 * it must never block or break the save flow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { memoryId, content } = body

    if (!memoryId || !content?.trim()) {
      return NextResponse.json(
        { error: 'memoryId and content are required' },
        { status: 400 }
      )
    }

    // ── 1. Generate embedding with Gemini text-embedding-004 ──────────
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    let embeddingVector: number[]

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(geminiKey)
      const embeddingModel = genAI.getGenerativeModel('text-embedding-004')

      const result = await embeddingModel.embedContent(content.slice(0, 2000))
      embeddingVector = result.embedding.values

      if (!embeddingVector || embeddingVector.length === 0) {
        throw new Error('Empty embedding returned')
      }
    } catch (embedError) {
      console.error(
        'Embedding generation failed:',
        embedError instanceof Error ? embedError.message : 'Unknown'
      )
      return NextResponse.json(
        { error: 'Failed to generate embedding' },
        { status: 500 }
      )
    }

    // ── 2. Update the memory row in Supabase (service role bypasses RLS) ──
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const supabase = createAdminClient()

      const { error: updateError } = await supabase
        .from('memories')
        .update({ embedding: embeddingVector })
        .eq('id', memoryId)

      if (updateError) {
        console.error('Failed to update embedding in Supabase:', updateError.message)
        return NextResponse.json(
          { error: 'Failed to store embedding' },
          { status: 500 }
        )
      }
    } catch (adminError) {
      console.error(
        'Admin client error:',
        adminError instanceof Error ? adminError.message : 'Unknown'
      )
      return NextResponse.json(
        { error: 'Database update failed — check SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      memoryId,
      dimensions: embeddingVector.length,
    })
  } catch (error) {
    console.error(
      'generate-embedding error:',
      error instanceof Error ? error.message : 'Unknown'
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

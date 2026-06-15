import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const hoursParam = req.nextUrl.searchParams.get('hours')
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24

    // Fetch recent memories from the last N hours
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    const memories = await db.memory.findMany({
      where: {
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    if (memories.length === 0) {
      return NextResponse.json({
        recap: 'No memories captured in this period. Start capturing thoughts, links, and ideas to see your AI-generated executive recap here.',
        count: 0,
        topTags: [],
        memories: [],
      })
    }

    // Build context for the AI
    const memorySummaries = memories.map(m => {
      const parts = [`[${m.type}] "${m.title || 'Untitled'}"`]
      if (m.summary) parts.push(`Summary: ${m.summary}`)
      if (m.content) parts.push(`Content: ${m.content.slice(0, 300)}`)
      if (m.tags) parts.push(`Tags: ${m.tags}`)
      return parts.join(' | ')
    })

    const contextText = memorySummaries.join('\n\n')

    // Count tags
    const tagCounts: Record<string, number> = {}
    memories.forEach(m => {
      if (m.tags) {
        m.tags.split(',').filter(Boolean).forEach(t => {
          tagCounts[t.trim()] = (tagCounts[t.trim()] || 0) + 1
        })
      }
    })

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag)

    // Generate AI recap using z-ai-web-dev-sdk
    let aiRecap = ''

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are Aether, an intelligent personal knowledge assistant. You generate concise, insightful executive recaps of a person's captured thoughts and ideas. Write in a warm, reflective, and slightly poetic tone. Focus on themes, patterns, and actionable insights. Keep the recap to 3-5 sentences. Use second person ("you").`,
          },
          {
            role: 'user',
            content: `Here are my captured memories from the last ${hours} hours. Generate an executive recap summarizing what I focused on, key themes, and any insights or recommendations.\n\n${contextText}`,
          },
        ],
        thinking: { type: 'disabled' },
      })

      aiRecap = completion.choices[0]?.message?.content || ''
    } catch (aiErr) {
      console.error('AI recap generation failed:', aiErr)
      // Fallback: simple recap
      const typeBreakdown = memories.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const typeSummary = Object.entries(typeBreakdown)
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ')

      aiRecap = `You captured ${memories.length} memories in the last ${hours} hours (${typeSummary}). ${topTags.length > 0 ? `Your primary focus areas included: ${topTags.join(', ')}.` : ''} Keep capturing to unlock deeper AI-powered insights and thematic connections.`
    }

    // Format memories for response
    const formattedMemories = memories.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      summary: m.summary,
      tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
      createdAt: m.createdAt,
    }))

    return NextResponse.json({
      recap: aiRecap,
      count: memories.length,
      topTags,
      memories: formattedMemories,
      period: hours,
    })
  } catch (error) {
    console.error('Recap generation failed:', error)
    return NextResponse.json({ error: 'Failed to generate recap' }, { status: 500 })
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI | null {
  if (!API_KEY) return null
  if (!genAI) {
    try {
      genAI = new GoogleGenerativeAI(API_KEY)
    } catch {
      return null
    }
  }
  return genAI
}

export async function chatWithGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const ai = getGenAI()
  if (!ai) throw new Error('Gemini API key not configured')

  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'I understand. I am Aether, your personal AI memory assistant.' }] },
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 1024 },
  })

  return result.response.text() || 'I couldn\'t generate a response.'
}

export async function generateTags(content: string): Promise<string[]> {
  const ai = getGenAI()
  if (!ai) return []

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Generate 3-5 relevant tags for the following content. Return ONLY comma-separated tags, nothing else:\n\n' + content.slice(0, 500) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 100 },
    })
    const text = result.response.text()
    return text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
  } catch {
    return []
  }
}

export async function generateSummary(content: string): Promise<string> {
  const ai = getGenAI()
  if (!ai) return ''

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Summarize the following in 1-2 concise sentences:\n\n' + content.slice(0, 500) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 150 },
    })
    return result.response.text().trim()
  } catch {
    return ''
  }
}

/**
 * ASR (Automatic Speech Recognition) helper using Groq Whisper API
 * This module is server-only.
 */

export async function createTranscription(audioFile: File): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey || groqKey === 'placeholder_groq_key') {
    console.warn('No GROQ_API_KEY set — voice transcription unavailable')
    return ''
  }

  try {
    const formData = new FormData()
    formData.append('file', audioFile)
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
      },
      body: formData,
    })

    if (response.ok) {
      const data = await response.json()
      if (data.text?.trim()) return data.text.trim()
    }

    return ''
  } catch (error) {
    console.error('ASR error:', error)
    return ''
  }
}

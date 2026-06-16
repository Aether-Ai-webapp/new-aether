'use client'

import { useState, useRef, useCallback } from 'react'
import { useAetherStore, type Memory, type MemoryType } from '@/lib/aether-store'

// ═══════════════════════════════════════════════════════════════════════
// ─── TYPES ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export interface CaptureResult {
  success: boolean
  memory?: Memory
  error?: string
  optimisticId?: string // The temp ID used for optimistic UI
}

export interface UseCaptureReturn {
  // Text capture
  captureText: (title: string, content: string) => Promise<CaptureResult>

  // Link capture
  captureLink: (url: string, title?: string, notes?: string) => Promise<CaptureResult>

  // Image capture
  captureImage: (file: File, title?: string) => Promise<CaptureResult>

  // Voice capture
  captureVoice: (audioBlob: Blob, title?: string) => Promise<CaptureResult>

  // Voice recording state
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  recordingDuration: number

  // Common state
  isCapturing: boolean
  captureError: string | null
}

// ═══════════════════════════════════════════════════════════════════════
// ─── OPTIMISTIC UI HELPER ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createOptimisticMemory(
  type: MemoryType,
  title: string,
  content: string,
  imageUrl?: string | null,
  sourceUrl?: string | null,
): { id: string; memory: Memory } {
  const tempId = generateTempId()
  const memory: Memory = {
    id: tempId,
    type,
    title: title || (type === 'image' ? 'Image capture' : type === 'voice' ? 'Voice Note' : type === 'link' ? 'Saved Link' : 'New Thought'),
    content: content || title,
    summary: 'AI analyzing...',
    deepInsight: null,
    tags: [],
    sourceUrl: sourceUrl || null,
    fileUrl: null,
    imagePreview: imageUrl || null,
    imageUrl: imageUrl || null,
    recap: null,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    collections: [],
  }
  return { id: tempId, memory }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── HOOK ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export function useCapture(): UseCaptureReturn {
  const addMemory = useAetherStore((s) => s.addMemory)
  const deleteMemory = useAetherStore((s) => s.deleteMemory)

  // Common state
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolvedAudioRef = useRef<((blob: Blob | null) => void) | null>(null)

  // ── Helper: post FormData to /api/capture with Optimistic UI ──────
  const postCapture = useCallback(async (
    formData: FormData,
    optimisticType: MemoryType,
    optimisticTitle: string,
    optimisticContent: string,
    optimisticImageUrl?: string | null,
    optimisticSourceUrl?: string | null,
  ): Promise<CaptureResult> => {
    // ── OPTIMISTIC: Create temp memory and add to store instantly ────
    const { id: tempId, memory: optimisticMemory } = createOptimisticMemory(
      optimisticType,
      optimisticTitle,
      optimisticContent,
      optimisticImageUrl,
      optimisticSourceUrl,
    )
    addMemory(optimisticMemory)

    try {
      setCaptureError(null)

      const response = await fetch('/api/capture', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: string }).error || `Server error: ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (data.success && data.memory) {
        const realMemory = data.memory as Memory
        // Replace optimistic mock with real server-persisted memory
        deleteMemory(tempId)
        addMemory(realMemory)
        return { success: true, memory: realMemory, optimisticId: tempId }
      }

      // No memory returned — remove optimistic mock
      deleteMemory(tempId)
      return { success: false, error: 'No memory returned from server', optimisticId: tempId }
    } catch (err) {
      // On failure: remove the optimistic mock from the store
      deleteMemory(tempId)
      const message = err instanceof Error ? err.message : 'Capture failed'
      setCaptureError(message)
      return { success: false, error: message, optimisticId: tempId }
    }
  }, [addMemory, deleteMemory])

  // ── Text Capture ───────────────────────────────────────────────────
  const captureText = useCallback(async (title: string, content: string): Promise<CaptureResult> => {
    if (!content.trim()) return { success: false, error: 'Content is required' }

    setIsCapturing(true)
    try {
      const formData = new FormData()
      formData.append('type', 'text')
      formData.append('text', content.trim())
      return await postCapture(formData, 'text', title || content.slice(0, 60), content)
    } finally {
      setIsCapturing(false)
    }
  }, [postCapture])

  // ── Link Capture ───────────────────────────────────────────────────
  const captureLink = useCallback(async (url: string, title?: string, notes?: string): Promise<CaptureResult> => {
    if (!url.trim()) return { success: false, error: 'URL is required' }

    setIsCapturing(true)
    try {
      const formData = new FormData()
      formData.append('type', 'link')
      formData.append('url', url.trim())
      if (notes?.trim()) formData.append('text', notes.trim())
      return await postCapture(
        formData,
        'link',
        title || url.slice(0, 60),
        notes || url,
        null,
        url,
      )
    } finally {
      setIsCapturing(false)
    }
  }, [postCapture])

  // ── Image Capture ──────────────────────────────────────────────────
  const captureImage = useCallback(async (file: File, title?: string): Promise<CaptureResult> => {
    if (!file || file.size === 0) return { success: false, error: 'Image file is required' }

    setIsCapturing(true)
    try {
      // Create a local preview URL for optimistic display
      const previewUrl = URL.createObjectURL(file)
      const formData = new FormData()
      formData.append('type', 'image')
      formData.append('image', file)
      return await postCapture(
        formData,
        'image',
        title || 'Image capture',
        title || 'Image capture',
        previewUrl,
      )
    } finally {
      setIsCapturing(false)
    }
  }, [postCapture])

  // ── Voice Capture ──────────────────────────────────────────────────
  const captureVoice = useCallback(async (audioBlob: Blob, title?: string): Promise<CaptureResult> => {
    if (!audioBlob || audioBlob.size === 0) return { success: false, error: 'Audio recording is required' }

    setIsCapturing(true)
    try {
      const formData = new FormData()
      formData.append('type', 'voice')
      const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' })
      formData.append('audio', audioFile)
      if (title?.trim()) formData.append('text', title.trim())
      return await postCapture(
        formData,
        'voice',
        title || 'Voice Note',
        title || 'Voice recording...',
      )
    } finally {
      setIsCapturing(false)
    }
  }, [postCapture])

  // ── Voice Recording Controls ───────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Resolve the promise for stopRecording()
        if (resolvedAudioRef.current) {
          resolvedAudioRef.current(audioBlob)
          resolvedAudioRef.current = null
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } catch {
      setCaptureError('Microphone access denied')
      throw new Error('Microphone access denied')
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return null
    }

    // Stop timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setIsRecording(false)

    // Create a promise that resolves when the onstop handler fires
    return new Promise<Blob | null>((resolve) => {
      resolvedAudioRef.current = resolve
      mediaRecorderRef.current!.stop()
    })
  }, [])

  return {
    captureText,
    captureLink,
    captureImage,
    captureVoice,
    isRecording,
    startRecording,
    stopRecording,
    recordingDuration,
    isCapturing,
    captureError,
  }
}

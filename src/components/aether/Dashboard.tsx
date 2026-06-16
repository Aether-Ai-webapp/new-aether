'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAetherStore, type Memory, type MemoryType } from '@/lib/aether-store'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Send,
  X,
  Trash2,
  Link2,
  FileText,
  CheckCircle2,
  Brain,
  Clock,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  Sparkles,
  Download,
  Eye,
  Volume2,
  AlertTriangle,
  Lock,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════════════
// ─── HELPERS ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function detectContentType(text: string): 'link' | 'task' | 'note' {
  const lower = text.toLowerCase()
  if (/https?:\/\//.test(lower) || /\bwww\./.test(lower)) return 'link'
  if (/\b(todo|remind|need to|buy|must)\b/.test(lower)) return 'task'
  return 'note'
}

function mapToMemoryType(detected: 'link' | 'task' | 'note'): MemoryType {
  if (detected === 'link') return 'link'
  return 'text'
}

const typeIconMap: Record<string, React.ElementType> = {
  link: Link2,
  task: CheckCircle2,
  note: FileText,
  voice: Volume2,
  image: ImageIcon,
}

function downloadMemoryAsMarkdown(memory: Memory) {
  const lines: string[] = []
  lines.push(`# ${memory.title || 'Untitled Memory'}`)
  lines.push('')
  lines.push(`**Type:** ${memory.type}`)
  lines.push(`**Created:** ${new Date(memory.createdAt).toLocaleString()}`)
  if (memory.tags.length > 0) {
    lines.push(`**Tags:** ${memory.tags.join(', ')}`)
  }
  if (memory.sourceUrl) {
    lines.push(`**Source:** ${memory.sourceUrl}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  if (memory.summary) {
    lines.push('## AI Summary')
    lines.push('')
    lines.push(memory.summary)
    lines.push('')
  }

  if (memory.deepInsight || memory.recap) {
    lines.push('## Cognitive Insight')
    lines.push('')
    lines.push(memory.deepInsight || memory.recap || '')
    lines.push('')
  }

  lines.push('## Original Content')
  lines.push('')
  lines.push(memory.content)
  lines.push('')

  const markdown = lines.join('\n')
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(memory.title || 'memory').slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════════════════════
// ─── DASHBOARD COMPONENT ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export function Dashboard() {
  const {
    memories,
    addMemory,
    deleteMemory,
    deleteMemoryFromDB,
    isLoading,
    isAuthenticated,
    fetchMemories,
    requireAuth,
    setShowAuthModal,
  } = useAetherStore()

  // ── Local State ──────────────────────────────────────────────────
  const [captureText, setCaptureText] = useState('')
  const [showCaptureAnimation, setShowCaptureAnimation] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Image upload state
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Memory drawer state
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Purge confirmation state
  const [confirmPurge, setConfirmPurge] = useState(false)

  // Input ref
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Fetch memories on mount ──────────────────────────────────────
  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  // ── Sorted memories ──────────────────────────────────────────────
  const sortedMemories = useMemo(() => {
    if (!Array.isArray(memories)) return []
    return [...memories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [memories])

  // ═════════════════════════════════════════════════════════════════
  // ─── AUTH GATE FOR CAPTURE ────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════
  const gateCapture = useCallback((): boolean => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      toast.error('Sign in to capture memories')
      return false
    }
    return true
  }, [isAuthenticated, setShowAuthModal])

  // ═════════════════════════════════════════════════════════════════
  // ─── THE UNIVERSAL CAPTURE SUBMIT (Optimistic UI) ────────────────
  // ═════════════════════════════════════════════════════════════════
  const handleCaptureSubmit = useCallback(async () => {
    if (!gateCapture()) return

    const text = captureText.trim()
    const image = imagePreview

    if (!text && !image) return

    // ── OPTIMISTIC UI: Create temporary mock memory instantly ────────
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const detected = image?.file ? 'image' : detectContentType(text || 'note')
    const memoryType = image?.file ? 'image' : mapToMemoryType(detected)

    const optimisticMemory: Memory = {
      id: tempId,
      type: memoryType as MemoryType,
      title: text.slice(0, 80) || 'Image capture',
      content: text || 'Image capture',
      summary: 'Extracting insights...',
      deepInsight: null,
      tags: [],
      sourceUrl: detected === 'link' ? text : null,
      fileUrl: null,
      imagePreview: image?.url || null,
      imageUrl: image?.url || null,
      recap: null,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      collections: [],
      _optimistic: true as unknown as undefined, // type-safe marker
    }

    // Prepend to store IMMEDIATELY — user sees it within milliseconds
    addMemory(optimisticMemory)
    setShowCaptureAnimation(true)

    // Clear input instantly
    setCaptureText('')
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => inputRef.current?.focus(), 50)

    try {
      const formData = new FormData()

      if (text.trim()) {
        formData.append('text', text.trim())
      }

      if (image?.file) {
        formData.append('image', image.file)
        formData.append('type', 'image')
      } else {
        formData.append('type', memoryType)

        if (detected === 'link') {
          formData.append('url', text.trim())
        }
      }

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
        // Replace the optimistic mock with the real server-persisted memory
        // The real memory will have `enriching: true` if AI is still running
        deleteMemory(tempId)
        addMemory(realMemory)
      }

      toast.success('Memory captured')
    } catch (error) {
      // On failure: remove the optimistic mock from the store
      deleteMemory(tempId)
      console.error('[Dashboard] Capture failed:', error)
      const message = error instanceof Error ? error.message : 'Failed to save — please try again'
      toast.error(message)
    } finally {
      setTimeout(() => setShowCaptureAnimation(false), 300)
    }
  }, [captureText, imagePreview, addMemory, deleteMemory, gateCapture])

  // ═════════════════════════════════════════════════════════════════
  // ─── VOICE RECORDING ─────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  const handleMicClick = useCallback(() => {
    if (!gateCapture()) return
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, gateCapture])

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

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)

        // ── OPTIMISTIC: Show voice note instantly ────────────────────
        const tempId = `temp_voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const optimisticVoice: Memory = {
          id: tempId,
          type: 'voice',
          title: 'Voice Note',
          content: captureText.trim() || 'Voice recording...',
          summary: 'Transcribing audio...',
          deepInsight: null,
          tags: [],
          sourceUrl: null,
          fileUrl: null,
          imagePreview: null,
          imageUrl: null,
          recap: null,
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          collections: [],
        }
        addMemory(optimisticVoice)
        setCaptureText('')
        setImagePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''

        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')
          formData.append('type', 'voice')

          const currentText = captureText.trim()
          if (currentText) {
            formData.append('text', currentText)
          }

          const response = await fetch('/api/capture', {
            method: 'POST',
            body: formData,
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.memory) {
              // Replace optimistic with real memory
              deleteMemory(tempId)
              addMemory(data.memory as Memory)
            }
            toast.success('Voice memory captured')
          } else {
            deleteMemory(tempId)
            toast.error('Voice capture failed')
          }
        } catch {
          deleteMemory(tempId)
          toast.error('Voice capture failed')
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [captureText, addMemory, deleteMemory])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  // ═════════════════════════════════════════════════════════════════
  // ─── IMAGE UPLOAD ────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!gateCapture()) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Under 10MB')
      return
    }
    const url = URL.createObjectURL(file)
    setImagePreview({ file, url, name: file.name })
  }, [gateCapture])

  const removeImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [imagePreview])

  // ═════════════════════════════════════════════════════════════════
  // ─── INSPECTION DRAWER ──────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  const openDrawer = useCallback((memory: Memory) => {
    setSelectedMemory(memory)
    setDrawerOpen(true)
    setConfirmPurge(false)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setConfirmPurge(false)
    setTimeout(() => setSelectedMemory(null), 300)
  }, [])

  // ── PURGE MEMORY ──────────────────────────────────────────────
  const handlePurge = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/capture?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        await deleteMemoryFromDB(id)
      }

      deleteMemory(id)
      closeDrawer()
      toast.success('Memory purged')
    } catch {
      try {
        await deleteMemoryFromDB(id)
        deleteMemory(id)
        closeDrawer()
        toast.success('Memory purged')
      } catch {
        toast.error('Failed to purge memory')
      }
    }
  }, [deleteMemory, deleteMemoryFromDB, closeDrawer])

  // ── DOWNLOAD MEMORY AS MARKDOWN ──────────────────────────────────
  const handleDownload = useCallback((memory: Memory) => {
    downloadMemoryAsMarkdown(memory)
    toast.success('Downloaded as markdown')
  }, [])

  // ── Keyboard handler ─────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCaptureSubmit()
    }
  }, [handleCaptureSubmit])

  // ═════════════════════════════════════════════════════════════════
  // ─── RENDER ──────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full relative">
      {/* ── CAPTURE BAR AT TOP CENTER ───────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-2 md:px-0 relative z-10">
        {/* Soft breathing purple background glow aura */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-64 h-32 rounded-full bg-purple-200/30 blur-3xl"
          />
        </div>

        <div className="max-w-2xl mx-auto relative">
          {/* Image preview pill */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="mb-2 inline-flex items-center gap-2 bg-white/90 border border-black/[0.06] rounded-xl pl-1.5 pr-2.5 py-1.5 shadow-sm"
              >
                <img src={imagePreview.url} alt={imagePreview.name} className="size-8 rounded-lg object-cover" />
                <span className="text-xs text-gray-500 max-w-[120px] truncate">{imagePreview.name}</span>
                <button onClick={removeImage} className="size-4 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                  <X className="size-3 text-gray-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Glass capsule input */}
          <div
            className={cn(
              'bg-white/80 border border-black/[0.04] shadow-sm backdrop-blur-xl rounded-2xl p-2',
              'focus-within:border-purple-300/60 focus-within:shadow-[0_0_40px_rgba(168,85,247,0.04)]',
              'transition-all duration-200',
              !isAuthenticated && 'opacity-80',
              showCaptureAnimation && 'border-purple-300/80 shadow-[0_0_60px_rgba(168,85,247,0.08)]'
            )}
          >
            <div className="flex items-center gap-1.5">
              {/* Mic button */}
              <button
                onClick={handleMicClick}
                disabled={isTranscribing}
                className={cn(
                  'size-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                  isRecording
                    ? 'bg-red-50 text-red-500 hover:bg-red-100'
                    : isTranscribing
                      ? 'bg-gray-50 text-gray-400'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                )}
              >
                {isTranscribing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </button>

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isAuthenticated ? 'Capture a thought...' : 'Sign in to capture memories...'}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none min-w-0 py-1.5 px-1"
              />

              {/* Image upload button */}
              <button
                onClick={() => {
                  if (!gateCapture()) return
                  fileInputRef.current?.click()
                }}
                className="size-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all shrink-0"
              >
                <ImageIcon className="size-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* Send button */}
              <button
                onClick={handleCaptureSubmit}
                disabled={!captureText.trim() && !imagePreview}
                className={cn(
                  'size-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                  captureText.trim() || imagePreview
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>

          {/* Auth prompt for unauthenticated users */}
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-2 mt-3"
            >
              <Lock className="size-3 text-gray-300" />
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs text-purple-500 hover:text-purple-700 font-medium transition-colors"
              >
                Sign in to start capturing
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── MEMORY FEED TIMELINE ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0">
        <div className="max-w-2xl mx-auto">
          {isLoading && (!memories || memories.length === 0) ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-6 animate-spin text-gray-300" />
            </div>
          ) : !sortedMemories || sortedMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Brain className="size-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400 text-center">Your memories will appear here</p>
              <p className="text-xs text-gray-300 mt-1">
                {isAuthenticated
                  ? 'Use the capture bar above to save your first thought'
                  : 'Sign in to start capturing your thoughts'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.03]">
              <AnimatePresence mode="popLayout">
                {sortedMemories.map((memory, index) => {
                  const detected = detectContentType(memory.content || memory.title)
                  const IconComponent = typeIconMap[memory.type] || typeIconMap[detected] || FileText
                  const staggerDelay = Math.min(index * 0.03, 0.15)
                  const isEnriching = (memory as Memory & { enriching?: boolean }).enriching || memory.id.startsWith('temp_')

                  return (
                    <motion.button
                      key={memory.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, delay: staggerDelay, ease: 'easeOut' }}
                      onClick={() => openDrawer(memory)}
                      className={cn(
                        "w-full flex items-center gap-3 py-3.5 px-1 text-left group hover:bg-black/[0.015] rounded-lg transition-colors",
                        isEnriching && "bg-purple-50/30"
                      )}
                    >
                      <div className="shrink-0 size-8 flex items-center justify-center">
                        {isEnriching ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          >
                            <Sparkles className="size-4 text-purple-400" />
                          </motion.div>
                        ) : (
                          <IconComponent className="size-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 line-clamp-2 leading-snug">
                          {memory.title || memory.content}
                        </p>
                        {isEnriching ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <motion.div
                              className="h-2 w-20 rounded-full bg-purple-100"
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <span className="text-[10px] text-purple-400 font-medium">AI enriching...</span>
                          </div>
                        ) : memory.summary ? (
                          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                            {memory.summary}
                          </p>
                        ) : null}
                        {memory.tags && memory.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {memory.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-gray-300 tabular-nums">
                        {formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })}
                      </span>
                      <ChevronRight className="size-4 text-gray-200 group-hover:text-gray-300 shrink-0 transition-colors" />
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── FULL INSPECTION DRAWER (slide-out from right) ──────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-40"
              onClick={closeDrawer}
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white/95 backdrop-blur-2xl border-l border-black/[0.04] z-50 flex flex-col overflow-hidden"
            >
              {selectedMemory && (
                <>
                  {/* ── Drawer Header ────────────────────────────────── */}
                  <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-black/[0.04]">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="size-3.5" />
                      {formatDistanceToNow(new Date(selectedMemory.createdAt), { addSuffix: true })}
                    </div>
                    <button
                      onClick={closeDrawer}
                      className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* ── Drawer Content (scrollable) ──────────────────── */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Title */}
                    <h2 className="text-lg font-semibold text-gray-900 leading-snug">
                      {selectedMemory.title || selectedMemory.content}
                    </h2>

                    {/* ── 1. AI-GENERATED SUMMARY ────────── */}
                    {selectedMemory.summary && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-purple-500 font-medium">
                          <Sparkles className="size-3" />
                          AI Summary
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {selectedMemory.summary}
                        </p>
                      </div>
                    )}

                    {/* ── 2. RAW CONTENT / IMAGE / URL ──────────────── */}
                    {selectedMemory.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-black/[0.04]">
                        <img
                          src={selectedMemory.imageUrl}
                          alt={selectedMemory.title || 'Memory image'}
                          className="w-full object-cover max-h-64"
                        />
                      </div>
                    )}

                    {(selectedMemory.imagePreview || selectedMemory.fileUrl) && !selectedMemory.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-black/[0.04]">
                        <img
                          src={selectedMemory.imagePreview || selectedMemory.fileUrl || ''}
                          alt={selectedMemory.title || 'Memory image'}
                          className="w-full object-cover max-h-64"
                        />
                      </div>
                    )}

                    {/* Raw original content */}
                    {selectedMemory.content && selectedMemory.content !== selectedMemory.title && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                          <FileText className="size-3" />
                          Original Content
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3 max-h-60 overflow-y-auto">
                          {selectedMemory.content}
                        </div>
                      </div>
                    )}

                    {/* Source URL */}
                    {selectedMemory.sourceUrl && (
                      <a
                        href={selectedMemory.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-700 transition-colors break-all"
                      >
                        <Link2 className="size-3 shrink-0" />
                        {selectedMemory.sourceUrl}
                      </a>
                    )}

                    {/* ── 3. DEEP COGNITIVE INSIGHT ────────────────── */}
                    {(selectedMemory.deepInsight || selectedMemory.recap) && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <Eye className="size-3" />
                          Cognitive Insight
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed bg-amber-50/50 border border-amber-100/50 rounded-xl p-3">
                          {selectedMemory.deepInsight || selectedMemory.recap}
                        </div>
                      </div>
                    )}

                    {/* ── Tags ─────────────────────────────────────── */}
                    {selectedMemory.tags && selectedMemory.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMemory.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ── Collections ──────────────────────────────── */}
                    {selectedMemory.collections && selectedMemory.collections.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMemory.collections.map((col) => (
                          <span
                            key={col.id}
                            className="text-[11px] px-2 py-0.5 rounded-full border border-black/[0.06] text-gray-500 font-medium flex items-center gap-1"
                          >
                            {col.icon && <span>{col.icon}</span>}
                            {col.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Timestamp detail */}
                    <div className="text-[11px] text-gray-300">
                      {new Date(selectedMemory.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* ── Drawer Actions (sticky bottom) ────────────────── */}
                  <div className="shrink-0 px-6 py-4 border-t border-black/[0.04] flex items-center gap-3">
                    {/* Download Markdown button */}
                    <button
                      onClick={() => handleDownload(selectedMemory)}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Download className="size-3.5" />
                      Export .md
                    </button>

                    <div className="flex-1" />

                    {/* Purge Memory button */}
                    {!confirmPurge ? (
                      <button
                        onClick={() => setConfirmPurge(true)}
                        className="flex items-center gap-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                        Purge Memory
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-red-500" />
                        <span className="text-xs text-red-500 font-medium">Sure?</span>
                        <button
                          onClick={() => handlePurge(selectedMemory.id)}
                          className="flex items-center gap-1.5 text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmPurge(false)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { FileText, Link2, ImageIcon, Mic, Loader2, Crown, Sparkles, Square, Play, StopCircle } from 'lucide-react'
import { useAetherStore, type MemoryType } from '@/lib/aether-store'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface AddMemorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMemorySheet({ open, onOpenChange }: AddMemorySheetProps) {
  const isMobile = useIsMobile()
  const saveMemory = useAetherStore((s) => s.saveMemory)
  const requireAuth = useAetherStore((s) => s.requireAuth)
  const isAuthenticated = useAetherStore((s) => s.isAuthenticated)
  const memories = useAetherStore((s) => s.memories)

  // ── Free plan limit ──────────────────────────────────────────────────
  const FREE_MEMORY_LIMIT = 50

  // Text tab state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // Link tab state
  const [url, setUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [isFetchingTitle, setIsFetchingTitle] = useState(false)

  // Image tab state
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')        // user-pasted URL
  const [generatedImage, setGeneratedImage] = useState<string | null>(null) // data URL from AI
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  // Voice tab state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')

  // Common state
  const [activeTab, setActiveTab] = useState('text')
  const [isSaving, setIsSaving] = useState(false)

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordedChunksRef = useRef<Float32Array[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Encode Float32 PCM samples into a WAV Blob ──────────────────────
  const encodeWav = useCallback((samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    // RIFF header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)           // subchunk size
    view.setUint16(20, 1, true)            // audio format = PCM
    view.setUint16(22, 1, true)            // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true)            // block align
    view.setUint16(34, 16, true)           // bits per sample
    writeString(36, 'data')
    view.setUint32(40, samples.length * 2, true)

    // PCM samples (float32 → int16)
    let offset = 44
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }

    return new Blob([view], { type: 'audio/wav' })
  }, [])

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const resetForm = useCallback(() => {
    setTitle('')
    setContent('')
    setUrl('')
    setLinkTitle('')
    setImagePrompt('')
    setImageUrl('')
    setGeneratedImage(null)
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setTranscript('')
    setRecordingTime(0)
    setActiveTab('text')
    setIsSaving(false)
    setIsFetchingTitle(false)
    setIsGeneratingImage(false)
    setIsTranscribing(false)
    setIsRecording(false)
  }, [audioUrl])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setTimeout(resetForm, 300)
  }, [onOpenChange, resetForm])

  // ── Fetch link title ─────────────────────────────────────────────────
  const fetchLinkTitle = useCallback(async () => {
    if (!url.trim()) return
    setIsFetchingTitle(true)
    try {
      const res = await fetch('/api/memories/fetch-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.title) setLinkTitle(data.title)
      }
    } catch {
      // silent
    } finally {
      setIsFetchingTitle(false)
    }
  }, [url])

  // ── Generate image via AI ────────────────────────────────────────────
  const generateImage = useCallback(async () => {
    if (!imagePrompt.trim()) return
    setIsGeneratingImage(true)
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt.trim(), size: '1024x1024' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed (${res.status})`)
      }
      const data = await res.json()
      if (data.url) {
        setGeneratedImage(data.url)
        toast.success('Image generated!')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image generation failed')
    } finally {
      setIsGeneratingImage(false)
    }
  }, [imagePrompt])

  // ── Voice recording (WAV via Web Audio API) ─────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      recordedChunksRef.current = []

      // Use AudioContext to capture raw PCM samples for WAV encoding
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioCtx()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      // 4096 sample buffer, 1 in/out channel
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0)
        // Clone the data (it gets reused)
        recordedChunksRef.current.push(new Float32Array(input))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch (e) {
      toast.error('Microphone access denied or unavailable')
    }
  }, [])

  const stopRecording = useCallback(() => {
    // Capture sample rate BEFORE closing the context
    const sampleRate = audioContextRef.current?.sampleRate || 48000

    // Stop the processor and disconnect
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }

    // Combine all recorded chunks into one Float32Array
    const chunks = recordedChunksRef.current
    if (chunks.length > 0) {
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
      const combined = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      // Encode as WAV using the AudioContext's actual sample rate (typically 48000)
      // The ASR API accepts any sample rate >= 16kHz
      const wavBlob = encodeWav(combined, sampleRate)
      setAudioBlob(wavBlob)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(URL.createObjectURL(wavBlob))
    }

    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [audioUrl, encodeWav])

  // ── Transcribe audio via ASR ─────────────────────────────────────────
  const transcribeAudio = useCallback(async () => {
    if (!audioBlob) return
    setIsTranscribing(true)
    try {
      // Convert blob to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        try {
          const res = await fetch('/api/ai/asr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64 }),
          })
          if (!res.ok) throw new Error(`Failed (${res.status})`)
          const data = await res.json()
          if (data.text) {
            setTranscript(data.text)
            toast.success('Transcribed!')
          } else {
            toast.error('No speech detected')
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Transcription failed')
        } finally {
          setIsTranscribing(false)
        }
      }
      reader.readAsDataURL(audioBlob)
    } catch (e) {
      toast.error('Failed to read audio')
      setIsTranscribing(false)
    }
  }, [audioBlob])

  // ── Save handler ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (memories.length >= FREE_MEMORY_LIMIT) {
      toast.error('Free limit reached — upgrade to Pro for unlimited memories', {
        icon: <Crown className="size-4" />,
      })
      return
    }

    const type = activeTab as MemoryType
    let memoryTitle = ''
    let memoryContent = ''
    let sourceUrl: string | null = null
    let imagePreview: string | null = null
    let fileUrl: string | null = null

    if (type === 'text') {
      memoryTitle = title.trim() || 'Untitled Note'
      memoryContent = content.trim()
      if (!memoryContent) return
    } else if (type === 'link') {
      memoryTitle = linkTitle.trim() || url.trim() || 'Untitled Link'
      memoryContent = content.trim() || url.trim()
      sourceUrl = url.trim()
      if (!sourceUrl) return
    } else if (type === 'image') {
      // Prefer generated image, fall back to URL
      const finalImage = generatedImage || (imageUrl.trim() ? imageUrl.trim() : null)
      if (!finalImage) {
        toast.error('Generate an image or paste an image URL first')
        return
      }
      memoryTitle = title.trim() || imagePrompt.trim().slice(0, 60) || 'Untitled Image'
      memoryContent = content.trim() || imagePrompt.trim()
      imagePreview = finalImage
      fileUrl = finalImage.startsWith('data:') ? null : finalImage
    } else if (type === 'voice') {
      memoryTitle = title.trim() || 'Voice Note'
      memoryContent = transcript.trim() || content.trim()
      if (!memoryContent) {
        toast.error('Record and transcribe audio, or type notes')
        return
      }
      if (audioUrl) fileUrl = audioUrl
    }

    // Gate: if not authenticated, show auth modal and queue this save
    if (!isAuthenticated) {
      const savedType = type
      const savedTitle = memoryTitle
      const savedContent = memoryContent
      const savedSourceUrl = sourceUrl
      const savedImagePreview = imagePreview
      const savedFileUrl = fileUrl

      requireAuth(async () => {
        const result = await saveMemory({
          type: savedType,
          title: savedTitle,
          content: savedContent,
          sourceUrl: savedSourceUrl,
          imagePreview: savedImagePreview,
          fileUrl: savedFileUrl,
        })
        if (result) toast.success('Memory saved!')
      })
      handleClose()
      return
    }

    // Authenticated: save directly
    setIsSaving(true)
    try {
      const result = await saveMemory({
        type,
        title: memoryTitle,
        content: memoryContent,
        sourceUrl,
        imagePreview,
        fileUrl,
      })
      if (result) {
        handleClose()
        toast.success('Memory saved!')
      } else {
        toast.error('Failed to save memory')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }, [activeTab, title, content, linkTitle, url, imageUrl, generatedImage, imagePrompt, transcript, audioUrl, isAuthenticated, requireAuth, saveMemory, handleClose, memories.length, FREE_MEMORY_LIMIT])

  const isSaveDisabled = () => {
    if (isSaving) return true
    if (activeTab === 'text') return !content.trim()
    if (activeTab === 'link') return !url.trim()
    if (activeTab === 'image') return !generatedImage && !imageUrl.trim()
    if (activeTab === 'voice') return !transcript.trim() && !content.trim()
    return false
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const sheetContent = (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="text" className="gap-1.5">
            <FileText className="size-4" />
            <span className="hidden sm:inline">Text</span>
          </TabsTrigger>
          <TabsTrigger value="link" className="gap-1.5">
            <Link2 className="size-4" />
            <span className="hidden sm:inline">Link</span>
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-1.5">
            <ImageIcon className="size-4" />
            <span className="hidden sm:inline">Image</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1.5">
            <Mic className="size-4" />
            <span className="hidden sm:inline">Voice</span>
          </TabsTrigger>
        </TabsList>

        {/* Text Tab */}
        <TabsContent value="text" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="memory-title">Title</Label>
            <Input
              id="memory-title"
              placeholder="Give your memory a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memory-content">Content</Label>
            <Textarea
              id="memory-content"
              placeholder="Write your thoughts, notes, ideas..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[160px] resize-y"
            />
          </div>
        </TabsContent>

        {/* Link Tab */}
        <TabsContent value="link" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="link-url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => fetchLinkTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchLinkTitle()
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={fetchLinkTitle}
                disabled={isFetchingTitle || !url.trim()}
              >
                {isFetchingTitle ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We&apos;ll auto-read the page content and tag it for you after saving.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-title">Title</Label>
            <Input
              id="link-title"
              placeholder="Link title (auto-fetched or type manually)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-notes">Notes</Label>
            <Textarea
              id="link-notes"
              placeholder="Add notes about this link..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] resize-y"
            />
          </div>
        </TabsContent>

        {/* Image Tab — AI generation + URL paste */}
        <TabsContent value="image" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="image-title">Title</Label>
            <Input
              id="image-title"
              placeholder="Image title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-prompt">
              <Sparkles className="size-3 inline mr-1" />
              Generate image with AI
            </Label>
            <div className="flex gap-2">
              <Input
                id="image-prompt"
                placeholder="A serene mountain landscape at sunset..."
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGeneratingImage) generateImage()
                }}
              />
              <Button
                variant="outline"
                onClick={generateImage}
                disabled={isGeneratingImage || !imagePrompt.trim()}
              >
                {isGeneratingImage ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                <span className="ml-1 hidden sm:inline">Generate</span>
              </Button>
            </div>
          </div>

          {/* Image preview */}
          {generatedImage && (
            <div className="relative rounded-lg overflow-hidden border">
              <img src={generatedImage} alt="Generated" className="w-full h-auto" />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 size-7"
                onClick={() => setGeneratedImage(null)}
              >
                ×
              </Button>
            </div>
          )}

          {/* OR divider */}
          <div className="flex items-center gap-2 py-1">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">OR paste image URL</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="space-y-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            {imageUrl.trim() && !generatedImage && (
              <div className="relative rounded-lg overflow-hidden border">
                <img src={imageUrl.trim()} alt="Preview" className="w-full h-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-notes">Notes</Label>
            <Textarea
              id="image-notes"
              placeholder="Add notes about this image..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-y"
            />
          </div>
        </TabsContent>

        {/* Voice Tab — Recording + ASR */}
        <TabsContent value="voice" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="voice-title">Title</Label>
            <Input
              id="voice-title"
              placeholder="Voice note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Recording controls */}
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center gap-3">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90"
                size="lg"
              >
                <Mic className="size-5" />
                Start Recording
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-rose-500">
                  <span className="size-3 rounded-full bg-rose-500 animate-pulse" />
                  Recording... {formatTime(recordingTime)}
                </div>
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                >
                  <Square className="size-5" />
                  Stop
                </Button>
              </div>
            )}
          </div>

          {/* Audio playback + transcribe */}
          {audioUrl && !isRecording && (
            <div className="space-y-3">
              <audio src={audioUrl} controls className="w-full" />
              <div className="flex gap-2">
                <Button
                  onClick={transcribeAudio}
                  disabled={isTranscribing}
                  variant="outline"
                  className="gap-2 flex-1"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Transcribe with AI
                    </>
                  )}
                </Button>
                <Button
                  onClick={startRecording}
                  variant="ghost"
                  className="gap-2"
                >
                  <Mic className="size-4" />
                  Re-record
                </Button>
              </div>
            </div>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="space-y-2">
              <Label htmlFor="voice-transcript">Transcript (editable)</Label>
              <Textarea
                id="voice-transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[100px] resize-y"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="voice-notes">Additional notes (optional)</Label>
            <Textarea
              id="voice-notes"
              placeholder="Add any extra notes..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-y"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="pt-4 pb-2">
        <Button
          onClick={handleSave}
          disabled={isSaveDisabled()}
          className="w-full bg-gradient-to-r from-primary to-[#8B6F9A] text-primary-foreground hover:opacity-90"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Memory'
          )}
        </Button>
      </div>
    </>
  )

  // On mobile: use Drawer (slides up from bottom)
  // On desktop: use Sheet (slides from right)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New Memory</DrawerTitle>
            <DrawerDescription>
              Capture a thought, link, image, or voice note.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 max-h-[80vh] overflow-y-auto">
            {sheetContent}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Memory</SheetTitle>
          <SheetDescription>
            Capture a thought, link, image, or voice note.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          {sheetContent}
        </div>
      </SheetContent>
    </Sheet>
  )
}

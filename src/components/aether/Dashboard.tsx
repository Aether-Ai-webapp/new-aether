'use client'

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Mic,
  Send,
  Sparkles,
  X,
  Trash2,
  Crown,
  Link2,
  FileText,
  CheckCircle2,
  Download,
} from 'lucide-react'
import { useAetherStore, type Memory, type MemoryType } from '@/lib/aether-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PaywallModal } from '@/components/aether/PaywallModal'

// ─── Helpers ────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

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

// ─── Category Config ─────────────────────────────────────────────────
const categoryConfig = {
  link: { label: 'Links', icon: Link2, color: 'text-emerald-400' },
  task: { label: 'Tasks', icon: CheckCircle2, color: 'text-amber-400' },
  note: { label: 'Notes', icon: FileText, color: 'text-purple-400' },
}

// ─── Particle Burst Engine ───────────────────────────────────────────
interface Particle {
  id: number
  x: number
  y: number
  scale: number
  rotate: number
  duration: number
  color: string
  size: number
}

function generateParticles(count: number = 12): Particle[] {
  const colors = [
    'rgba(168, 85, 247, 0.8)',    // purple-500
    'rgba(192, 132, 252, 0.7)',   // purple-400
    'rgba(139, 92, 246, 0.6)',    // violet-500
    'rgba(124, 58, 237, 0.6)',    // violet-600
    'rgba(109, 40, 217, 0.5)',    // purple-700
  ]
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 120,
    y: -(60 + Math.random() * 100),
    scale: 0.4 + Math.random() * 0.8,
    rotate: (Math.random() - 0.5) * 360,
    duration: 0.5 + Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 4 + Math.random() * 6,
  }))
}

function ParticleBurst({ particles, isDark }: { particles: Particle[]; isDark: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [1, 1, 0],
            x: p.x,
            y: p.y,
            scale: [0, p.scale, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: isDark
              ? `0 0 ${p.size * 2}px ${p.color}`
              : `0 0 ${p.size}px ${p.color}`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Capture Feedback Card ──────────────────────────────────────────
interface CaptureFeedback {
  category: 'link' | 'task' | 'note'
}

function CaptureFeedbackCard({ feedback, isDark }: { feedback: CaptureFeedback; isDark: boolean }) {
  const config = categoryConfig[feedback.category]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, scale: 0.98, filter: 'blur(2px)', transition: { duration: 0.3, ease: 'easeInOut' } }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.15 }}
      className={cn(
        'mt-4 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl',
        isDark
          ? 'bg-white/[0.03] border border-white/[0.04] shadow-[0_0_16px_-5px_rgba(168,85,247,0.15)]'
          : 'bg-white border border-purple-100 shadow-lg shadow-purple-500/10'
      )}
    >
      <div className={cn(
        'size-6 rounded-md flex items-center justify-center',
        isDark ? 'bg-purple-500/10' : 'bg-purple-50'
      )}>
        <Icon className={cn('size-3.5', config.color)} />
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <span className={cn(isDark ? 'text-white/30' : 'text-gray-400')}>Captured. Cleaned up. Sent to</span>
        <span className={cn('font-semibold', isDark ? 'text-purple-400/80' : 'text-purple-600')}>
          {config.label}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Shimmer Border for New Cards ───────────────────────────────────
function ShimmerBorder({ isDark }: { isDark: boolean }) {
  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: '200%' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-xl"
    >
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.12) 40%, rgba(192,132,252,0.2) 50%, rgba(168,85,247,0.12) 60%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.1) 40%, rgba(192,132,252,0.18) 50%, rgba(168,85,247,0.1) 60%, transparent 100%)',
        }}
      />
    </motion.div>
  )
}

// ─── Main Dashboard Component ────────────────────────────────────────
export function Dashboard() {
  const {
    memories,
    saveMemory,
    fetchMemories,
    deleteMemoryFromDB,
    darkMode,
    isLoading,
  } = useAetherStore()

  const [captureText, setCaptureText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isJustSaved, setIsJustSaved] = useState(false)

  // ── Dopamine Engine state
  const [particles, setParticles] = useState<Particle[]>([])
  const [captureFeedback, setCaptureFeedback] = useState<CaptureFeedback | null>(null)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)

  const justSavedTimer = useRef<ReturnType<typeof setTimeout>>()
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>()

  // Hydration guard
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Skeleton loading
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    if (memories.length > 0 && !hasFetched) setHasFetched(true)
  }, [memories.length, hasFetched])

  useEffect(() => {
    if (!isLoading && !hasFetched) {
      const timer = setTimeout(() => setHasFetched(true), 600)
      return () => clearTimeout(timer)
    }
  }, [isLoading, hasFetched])

  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)

  const FREE_MEMORY_LIMIT = 50

  // ── Capture handler (Dopamine Engine wired in)
  const handleCapture = useCallback(async () => {
    const text = captureText.trim()
    if (!text || isSaving) return

    const detectedType = detectContentType(text)
    const memoryType = mapToMemoryType(detectedType)

    setCaptureText('')
    setParticles(generateParticles(14))
    setTimeout(() => setParticles([]), 1200)

    setCaptureFeedback({ category: detectedType })
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setCaptureFeedback(null), 2500)

    setIsJustSaved(true)
    if (justSavedTimer.current) clearTimeout(justSavedTimer.current)
    justSavedTimer.current = setTimeout(() => setIsJustSaved(false), 600)

    if (memories.length >= FREE_MEMORY_LIMIT) {
      setTimeout(() => setShowPaywall(true), 800)
      return
    }

    setIsSaving(true)
    try {
      const savedMemory = await saveMemory({
        type: memoryType,
        title: text.split('\n')[0].slice(0, 80) || 'Quick Note',
        content: text,
        sourceUrl: detectedType === 'link' ? text.trim() : null,
      })
      await fetchMemories()

      if (savedMemory) {
        setLastSavedId(savedMemory.id)
        setTimeout(() => setLastSavedId(null), 1500)
      }

      if (savedMemory) {
        fetch('/api/generate-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memoryId: savedMemory.id, content: savedMemory.content }),
        }).catch(() => {})
      }
    } catch {
      // silent
    } finally {
      setIsSaving(false)
    }
  }, [captureText, isSaving, saveMemory, fetchMemories, memories.length, FREE_MEMORY_LIMIT])

  const handleCaptureKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCapture()
    }
  }, [handleCapture])

  const handleMicClick = useCallback(() => {
    toast.info('Voice recording coming soon!', { icon: <Mic className="size-4" /> })
  }, [])

  const handleDeleteMemory = useCallback(async () => {
    if (!selectedMemory || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteMemoryFromDB(selectedMemory.id)
      setSelectedMemory(null)
    } catch {
      // keep modal open
    } finally {
      setIsDeleting(false)
    }
  }, [selectedMemory, isDeleting, deleteMemoryFromDB])

  const displayMemories = useMemo(() => {
    return [...memories]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [memories])

  const isDark = darkMode

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'min-h-screen relative overflow-hidden flex flex-col items-center pt-12 pb-10 px-4',
        isDark ? 'bg-transparent text-white' : 'bg-gradient-to-b from-slate-50 to-white text-gray-900'
      )}
    >
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-2xl">
        <h1 className={cn(
          'text-3xl font-bold tracking-tight mb-8',
          isDark
            ? 'bg-gradient-to-r from-white via-purple-100 to-violet-200 bg-clip-text text-transparent'
            : 'text-gray-900'
        )}>
          {mounted ? getGreeting() : ''}
        </h1>
      </section>

      {/* ── Gravity Capture Bar ───────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-2xl mx-auto mb-10">
        <div className={cn(
          'relative rounded-2xl p-1.5 transition-all duration-500',
          isDark
            ? isJustSaved
              ? 'bg-white/[0.03] border border-purple-400/30 shadow-[0_0_0_1px_rgba(168,85,247,0.4),0_0_60px_-10px_rgba(168,85,247,0.4)]'
              : 'bg-white/[0.02] border border-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_30px_-10px_rgba(168,85,247,0.08)] focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_0_60px_-15px_rgba(168,85,247,0.3)] focus-within:border-purple-500/20'
            : isJustSaved
              ? 'bg-white border border-purple-300/50 shadow-[0_0_0_1px_rgba(168,85,247,0.3),0_0_40px_-10px_rgba(168,85,247,0.2)]'
              : 'bg-white border border-gray-200 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_0_30px_-10px_rgba(168,85,247,0.06)] focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_0_40px_-10px_rgba(168,85,247,0.1)] focus-within:border-purple-300/30'
        )}>
          <div className="flex items-center gap-2">
            <input
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={handleCaptureKeyDown}
              placeholder="Dump a thought, URL, or task... press Enter"
              disabled={isSaving}
              className={cn(
                'w-full bg-transparent text-base focus:outline-none px-4 py-3',
                isDark
                  ? 'text-white placeholder:text-white/20'
                  : 'text-gray-900 placeholder:text-gray-400'
              )}
            />

            {/* Mic button */}
            <button
              onClick={handleMicClick}
              className={cn(
                'flex items-center justify-center size-9 rounded-lg transition-colors duration-150 shrink-0',
                isDark
                  ? 'text-white/15 hover:text-white/40 hover:bg-white/[0.03]'
                  : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
              )}
              aria-label="Voice recording"
            >
              <Mic className="size-4" />
            </button>

            {/* Save/Send button */}
            <motion.button
              onClick={handleCapture}
              disabled={!captureText.trim() || isSaving}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className={cn(
                'flex items-center justify-center text-sm font-medium px-4 py-1.5 rounded-lg transition-all duration-200 shrink-0',
                captureText.trim() && !isSaving
                  ? isDark
                    ? 'bg-gradient-to-r from-purple-400 to-violet-500 hover:from-purple-300 hover:to-violet-400 text-white shadow-[0_0_16px_-4px_rgba(168,85,247,0.5)] hover:shadow-[0_0_24px_-4px_rgba(168,85,247,0.6)]'
                    : 'bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400 text-white shadow-[0_0_16px_-4px_rgba(168,85,247,0.3)] hover:shadow-[0_0_24px_-4px_rgba(168,85,247,0.5)]'
                  : isDark
                    ? 'bg-white/[0.04] text-white/20'
                    : 'bg-gray-100 text-gray-400'
              )}
            >
              <Send className="size-4" />
            </motion.button>
          </div>

          {/* 🫧 Particle Burst Layer */}
          <AnimatePresence>
            {particles.length > 0 && (
              <ParticleBurst particles={particles} isDark={isDark} />
            )}
          </AnimatePresence>
        </div>

        {/* 🎯 Capture Feedback Card */}
        <div className="flex justify-center">
          <AnimatePresence>
            {captureFeedback && (
              <CaptureFeedbackCard feedback={captureFeedback} isDark={isDark} />
            )}
          </AnimatePresence>
        </div>

        {/* Free Plan Limit */}
        {memories.length > 0 && (
          <div className={cn(
            'flex items-center justify-center gap-1.5 mt-3',
            isDark ? 'text-white/15' : 'text-gray-400'
          )}>
            {memories.length >= FREE_MEMORY_LIMIT ? (
              <>
                <Crown className="size-3 text-purple-500/60" />
                <span className={cn('text-[11px] font-medium', isDark ? 'text-purple-400/60' : 'text-purple-600')}>
                  Free limit reached — upgrade for unlimited
                </span>
              </>
            ) : memories.length >= FREE_MEMORY_LIMIT - 3 ? (
              <>
                <Crown className="size-3" />
                <span className="text-[11px]">
                  {FREE_MEMORY_LIMIT - memories.length} memories remaining on Free plan
                </span>
              </>
            ) : (
              <span className="text-[11px]">
                {memories.length} / {FREE_MEMORY_LIMIT} free memories
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── Memories Feed ──────────────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-2xl mx-auto space-y-3">
        {!hasFetched ? (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl p-5 animate-pulse',
                  isDark
                    ? 'bg-white/[0.015] border border-white/[0.03]'
                    : 'bg-gray-50 border border-gray-100'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'size-9 rounded-lg shrink-0',
                    isDark ? 'bg-white/[0.03]' : 'bg-gray-100'
                  )} />
                  <div className="flex-1 space-y-3">
                    <div className={cn('h-4 rounded w-3/4', isDark ? 'bg-white/[0.03]' : 'bg-gray-100')} />
                    <div className={cn('h-3 rounded w-1/2', isDark ? 'bg-white/[0.03]' : 'bg-gray-100')} />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : displayMemories.length === 0 ? (
          <p className={cn('text-sm mt-20 text-center', isDark ? 'text-white/10' : 'text-gray-300')}>
            Your mind is clear. Dump a thought above.
          </p>
        ) : (
          <>
            {displayMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                isDark={isDark}
                isNew={memory.id === lastSavedId}
                onClick={() => setSelectedMemory(memory)}
              />
            ))}
          </>
        )}
      </section>

      {/* ── Memory Detail Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMemory && (
          <MemoryDetailModal
            memory={selectedMemory}
            isDark={isDark}
            onClose={() => setSelectedMemory(null)}
            onDelete={handleDeleteMemory}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>

      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        isDark={isDark}
      />
    </motion.div>
  )
}

// ─── Memory Card ──────────────────────────────────────────────────────
function MemoryCard({ memory, isDark, isNew, onClick }: { memory: Memory; isDark: boolean; isNew: boolean; onClick: () => void }) {
  const displayTitle =
    memory.title || memory.content.split('\n')[0].slice(0, 80) || 'Untitled'
  const relativeTime = formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })

  return (
    <motion.div
      initial={isNew
        ? { opacity: 0, y: 20, scale: 0.95 }
        : { opacity: 0, y: -20, scale: 0.95 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        isNew
          ? { type: 'spring', stiffness: 200, damping: 18, delay: 0.3 }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        onClick={onClick}
        className={cn(
          'relative overflow-hidden rounded-xl p-5 transition-all duration-300 cursor-pointer group',
          isNew
            ? isDark
              ? 'bg-white/[0.025] border border-purple-500/15 shadow-[0_0_24px_-5px_rgba(168,85,247,0.2)]'
              : 'bg-white border border-purple-200/60 shadow-lg shadow-purple-500/10'
            : isDark
              ? 'bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.025] hover:border-white/[0.06]'
              : 'bg-white border border-gray-100 hover:bg-gray-50/80 hover:border-purple-200/60 hover:shadow-lg hover:shadow-purple-500/5'
        )}
      >
        {isNew && <ShimmerBorder isDark={isDark} />}

        <p className={cn(
          'text-sm leading-relaxed relative z-0',
          isDark ? 'text-white/70' : 'text-gray-700'
        )}>
          {displayTitle}
        </p>
        {memory.tags.length > 0 && (
          <div className="mt-2 relative z-0">
            {memory.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={cn(
                  'inline-block text-[10px] font-medium px-2 py-0.5 rounded-md mr-1.5 mt-1 uppercase tracking-wider',
                  isDark
                    ? 'bg-purple-500/8 text-purple-400/80'
                    : 'bg-purple-50 text-purple-600'
                )}
              >
                {tag}
              </span>
            ))}
            {memory.tags.length > 3 && (
              <span className={cn(
                'inline-block text-[10px] font-medium px-2 py-0.5 rounded-md mr-1.5 mt-1 uppercase tracking-wider',
                isDark ? 'bg-white/[0.03] text-white/15' : 'bg-gray-100 text-gray-400'
              )}>
                +{memory.tags.length - 3}
              </span>
            )}
          </div>
        )}
        <span className={cn(
          'text-[11px] mt-2 block relative z-0',
          isDark ? 'text-white/15' : 'text-gray-400'
        )}>
          {relativeTime}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Memory Detail Modal ────────────────────────────────────────────
function MemoryDetailModal({
  memory,
  isDark,
  onClose,
  onDelete,
  isDeleting,
}: {
  memory: Memory
  isDark: boolean
  onClose: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const [relatedMemories, setRelatedMemories] = useState<Array<{
    id: string
    title: string
    content: string
    tags: string[]
    type: string
    createdAt: string
    similarity: number | null
  }>>([])
  const [loadingRelated, setLoadingRelated] = useState(true)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // Fetch related memories
  useEffect(() => {
    setLoadingRelated(true)
    fetch(`/api/memories/related/${memory.id}`)
      .then((res) => res.ok ? res.json() : { related: [] })
      .then((data) => setRelatedMemories(data.related || []))
      .catch(() => setRelatedMemories([]))
      .finally(() => setLoadingRelated(false))
  }, [memory.id])

  // Generate summary on demand if missing
  const handleGenerateSummary = useCallback(async () => {
    setGeneratingSummary(true)
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memory.content.slice(0, 1000) }),
      })
      if (res.ok) {
        const { summary } = await res.json()
        if (summary?.trim()) {
          // Update the memory in the store
          useAetherStore.getState().updateMemory(memory.id, { summary })
          // Also persist to backend
          fetch(`/api/memories/${memory.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary }),
          }).catch(() => {})
        }
      }
    } catch {
      // silent
    } finally {
      setGeneratingSummary(false)
    }
  }, [memory.id, memory.content])

  // Download PDF
  const handleDownloadPDF = useCallback(() => {
    const doc = document.createElement('div')
    doc.innerHTML = `
      <div style="font-family: system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px; color: #1a1a2e;">
        <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #1a1a2e;">${memory.title || 'Untitled Memory'}</h1>
          <p style="font-size: 12px; color: #6b7280; margin: 0;">${new Date(memory.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          ${memory.tags.length > 0 ? `<div style="margin-top: 8px;">${memory.tags.map(t => `<span style="display: inline-block; background: #f3e8ff; color: #7c3aed; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-right: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${t}</span>`).join('')}</div>` : ''}
        </div>
        ${memory.summary ? `
        <div style="background: #faf5ff; border-left: 3px solid #7c3aed; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
          <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #7c3aed; margin: 0 0 8px 0;">AI Summary</p>
          <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0;">${memory.summary}</p>
        </div>
        ` : ''}
        <div style="margin-bottom: 32px;">
          <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 12px 0;">Original</p>
          <p style="font-size: 14px; line-height: 1.7; color: #374151; white-space: pre-wrap; margin: 0;">${memory.content}</p>
        </div>
        ${memory.sourceUrl ? `
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
          <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin: 0 0 8px 0;">Source</p>
          <p style="font-size: 13px; color: #7c3aed; margin: 0; word-break: break-all;">${memory.sourceUrl}</p>
        </div>
        ` : ''}
        <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 11px; color: #d1d5db; margin: 0;">Exported from Aether — Your Second Brain</p>
        </div>
      </div>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${memory.title || 'Memory'} — Aether</title>
            <style>
              @media print { @page { margin: 20mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>${doc.innerHTML}</body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 300)
    }
  }, [memory])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto',
          isDark
            ? 'bg-[#060812]/95 backdrop-blur-xl border border-white/[0.06] shadow-purple-500/10'
            : 'bg-white border border-gray-200 shadow-purple-500/5'
        )}
      >
        {/* Close button */}
        <div className="flex justify-between items-start mb-4">
          <h2 className={cn(
            'text-lg font-bold pr-8',
            isDark ? 'text-white' : 'text-gray-900'
          )}>
            {memory.title || 'Untitled Memory'}
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'size-8 rounded-lg flex items-center justify-center transition-colors shrink-0',
              isDark
                ? 'text-white/30 hover:text-white/60 hover:bg-white/[0.05]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* AI Summary Section */}
        <div className={cn(
          'rounded-xl p-4 mb-4',
          isDark
            ? 'bg-purple-500/[0.06] border border-purple-500/10'
            : 'bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100/60'
        )}>
          <p className={cn(
            'text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2',
            isDark ? 'text-purple-400/80' : 'text-purple-600'
          )}>
            <Sparkles className="w-3.5 h-3.5" />
            AI Summary
          </p>
          {memory.summary ? (
            <p className={cn(
              'text-sm leading-relaxed',
              isDark ? 'text-white/70' : 'text-gray-700'
            )}>
              {memory.summary}
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <p className={cn('text-sm', isDark ? 'text-white/25' : 'text-gray-400')}>
                No AI summary yet
              </p>
              <motion.button
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'text-xs font-medium px-3 py-1 rounded-lg transition-colors',
                  isDark
                    ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50'
                )}
              >
                {generatingSummary ? 'Generating...' : 'Generate'}
              </motion.button>
            </div>
          )}
        </div>

        {/* Tags Section */}
        {memory.tags.length > 0 && (
          <div className="mb-4">
            <p className={cn(
              'text-xs font-semibold uppercase tracking-widest mb-2',
              isDark ? 'text-white/25' : 'text-gray-400'
            )}>
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    'text-xs px-2.5 py-0.5 rounded-md font-medium',
                    isDark ? 'bg-purple-500/8 text-purple-400/80' : 'bg-purple-100 text-purple-700'
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Memories Section */}
        <div className="mb-4">
          <p className={cn(
            'text-xs font-semibold uppercase tracking-widest mb-2',
            isDark ? 'text-white/25' : 'text-gray-400'
          )}>
            Related Memories
          </p>
          {loadingRelated ? (
            <div className={cn(
              'rounded-lg p-3 animate-pulse',
              isDark ? 'bg-white/[0.02]' : 'bg-gray-50'
            )}>
              <div className={cn('h-3 rounded w-2/3 mb-2', isDark ? 'bg-white/[0.03]' : 'bg-gray-200')} />
              <div className={cn('h-3 rounded w-1/2', isDark ? 'bg-white/[0.03]' : 'bg-gray-200')} />
            </div>
          ) : relatedMemories.length > 0 ? (
            <div className="space-y-2">
              {relatedMemories.slice(0, 3).map((rm) => (
                <div
                  key={rm.id}
                  className={cn(
                    'rounded-lg p-3 text-sm transition-colors',
                    isDark
                      ? 'bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.04]'
                      : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                  )}
                >
                  <p className={cn('font-medium text-xs mb-1', isDark ? 'text-white/60' : 'text-gray-700')}>
                    {rm.title}
                  </p>
                  <p className={cn('text-xs leading-relaxed', isDark ? 'text-white/30' : 'text-gray-500')}>
                    {rm.content.slice(0, 80)}{rm.content.length > 80 ? '...' : ''}
                  </p>
                  {rm.similarity !== null && (
                    <p className={cn('text-[10px] mt-1', isDark ? 'text-purple-400/40' : 'text-purple-500/60')}>
                      {Math.round(rm.similarity * 100)}% match
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={cn('text-xs', isDark ? 'text-white/15' : 'text-gray-400')}>
              No related memories found yet. Save more memories to discover connections!
            </p>
          )}
        </div>

        {/* Original Content */}
        <div className="mb-6">
          <p className={cn(
            'text-xs font-semibold uppercase tracking-widest mb-2',
            isDark ? 'text-white/25' : 'text-gray-400'
          )}>
            Original
          </p>
          <p className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap',
            isDark ? 'text-white/60' : 'text-gray-800'
          )}>
            {memory.content}
          </p>
        </div>

        {/* Source URL */}
        {memory.sourceUrl && (
          <div className="mb-6">
            <p className={cn(
              'text-xs font-semibold uppercase tracking-widest mb-2',
              isDark ? 'text-white/25' : 'text-gray-400'
            )}>
              Source
            </p>
            <a
              href={memory.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'text-sm underline break-all',
                isDark ? 'text-purple-400/70 hover:text-purple-400' : 'text-purple-600 hover:text-purple-800'
              )}
            >
              {memory.sourceUrl}
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <motion.button
            onClick={handleDownloadPDF}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors',
              isDark
                ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            )}
          >
            <Download className="size-4" />
            PDF
          </motion.button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={cn(
              'text-sm font-medium px-4 py-2 rounded-lg transition-colors',
              isDark
                ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/10'
                : 'text-red-500 hover:text-red-600 hover:bg-red-50',
              isDeleting && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <Trash2 className="size-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

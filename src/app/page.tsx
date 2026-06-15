'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAetherStore, type Memory, type MemoryType } from '@/lib/aether-store'
import { useCapture } from '@/hooks/useCapture'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Sparkles,
  Brain,
  Mic,
  MicOff,
  Send,
  X,
  ArrowRight,
  Check,
  Zap,
  Loader2,
  Link2,
  FileText,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Download,
  Trash2,
  Eye,
  LogOut,
  LogIn,
  Search,
  MessageCircle,
  Volume2,
  Tag,
  ExternalLink,
  Hash,
  Command as CommandIcon,
  Plus,
  Globe,
  Type,
  Camera,
  Settings,
  LayoutGrid,
  BarChart3,
  BookOpen,
  Palette,
  Shield,
  Activity,
  ChevronRight,
  Star,
  FolderOpen,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ═══════════════════════════════════════════════════════════════════════
// ─── MOBILE DETECTION HOOK ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// ═══════════════════════════════════════════════════════════════════════
// ─── LIVING DEMO COMPONENT (Framer Motion Typing) ───────────────────
// ═══════════════════════════════════════════════════════════════════════

function LivingDemo() {
  const [displayedText, setDisplayedText] = useState('')
  const [phase, setPhase] = useState<'typing' | 'processing' | 'done'>('typing')
  const demoText = "I need to build a PC for video editing — what GPU should I get under $500?"

  useEffect(() => {
    let i = 0
    setDisplayedText('')
    setPhase('typing')
    const interval = setInterval(() => {
      if (i < demoText.length) {
        setDisplayedText(demoText.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => setPhase('processing'), 400)
        setTimeout(() => setPhase('done'), 1800)
      }
    }, 45)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (phase === 'done') {
      const timer = setTimeout(() => {
        setDisplayedText('')
        setPhase('typing')
      }, 4500)
      return () => clearTimeout(timer)
    }
  }, [phase])

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.04] shadow-[0_20px_50px_rgba(109,89,122,0.05)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.04]">
          <div className="w-3 h-3 rounded-full bg-red-300/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-300/70" />
          <div className="w-3 h-3 rounded-full bg-green-300/70" />
          <span className="ml-3 text-xs text-zinc-400 font-medium tracking-wide">Aether Capture</span>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-4 py-3 mb-4">
            <Zap className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-sm text-zinc-700 min-h-[20px] leading-relaxed">
              {displayedText}
              {phase === 'typing' && <span className="animate-pulse text-purple-500">|</span>}
            </span>
          </div>
          <AnimatePresence mode="wait">
            {phase === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-zinc-400"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Synthesizing insight...</span>
              </motion.div>
            )}
            {phase === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-xl p-4 shadow-[0_8px_30px_rgba(109,89,122,0.04)]"
              >
                <p className="font-semibold text-sm text-zinc-800 mb-1 tracking-tight">PC Build GPU Research</p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Considering video editing needs under $500, the RTX 4060 Ti offers excellent value with NVENC encoding support and 16GB VRAM options.
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="text-[10px] px-2 py-0.5 bg-purple-50/80 text-purple-600 border border-purple-100/50 rounded-full font-medium">hardware</span>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-50/80 text-purple-600 border border-purple-100/50 rounded-full font-medium">video-editing</span>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-50/80 text-purple-600 border border-purple-100/50 rounded-full font-medium">budget</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ─── MEMORY TYPE HELPERS ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function MemoryTypeIcon({ type, className }: { type: MemoryType; className?: string }) {
  switch (type) {
    case 'voice':
      return <Volume2 className={className} />
    case 'link':
      return <Link2 className={className} />
    case 'image':
      return <ImageIcon className={className} />
    default:
      return <FileText className={className} />
  }
}

function MemoryTypeBgClass(type: MemoryType): string {
  switch (type) {
    case 'voice': return 'bg-rose-50 text-rose-500'
    case 'link': return 'bg-emerald-50 text-emerald-500'
    case 'image': return 'bg-amber-50 text-amber-500'
    default: return 'bg-purple-50 text-purple-500'
  }
}

function MemoryTypeBadgeClass(type: MemoryType): string {
  switch (type) {
    case 'voice': return 'bg-rose-50/80 text-rose-600 border-rose-100/50'
    case 'link': return 'bg-emerald-50/80 text-emerald-600 border-emerald-100/50'
    case 'image': return 'bg-amber-50/80 text-amber-600 border-amber-100/50'
    default: return 'bg-purple-50/80 text-purple-600 border-purple-100/50'
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── WEEKLY RECAP HELPER ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function getWeeklyRecap(memories: Memory[]): { count: number; topTags: string[]; summary: string } | null {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekMemories = memories.filter(m => new Date(m.createdAt).getTime() > sevenDaysAgo)
  if (weekMemories.length === 0) return null

  const tagCounts: Record<string, number> = {}
  weekMemories.forEach(m => {
    m.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag)

  const latestRecap = weekMemories[0]?.recap
  if (latestRecap) {
    return { count: weekMemories.length, topTags, summary: latestRecap.slice(0, 200) }
  }

  const summaries = weekMemories
    .map(m => m.summary || m.content || m.title)
    .filter(Boolean)
    .slice(0, 5)
  const combinedText = summaries.join('. ')
  const summaryText = combinedText.length > 150
    ? combinedText.slice(0, 147) + '...'
    : combinedText || `You captured ${weekMemories.length} thought${weekMemories.length > 1 ? 's' : ''} this week.`

  return { count: weekMemories.length, topTags, summary: summaryText }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN APPLICATION COMPONENT ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export default function AetherApp() {
  const store = useAetherStore()
  const isMobile = useIsMobile()
  const capture = useCapture()

  // ── Capture State ────────────────────────────────────────────────
  const [captureInput, setCaptureInput] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [justCapturedId, setJustCapturedId] = useState<string | null>(null)

  // ── Auth State ───────────────────────────────────────────────────
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [freeEmail, setFreeEmail] = useState('')
  const [freePassword, setFreePassword] = useState('')
  const [premiumEmail, setPremiumEmail] = useState('')
  const [premiumPassword, setPremiumPassword] = useState('')

  // ── Ask AI State ─────────────────────────────────────────────────
  const [askAIQuery, setAskAIQuery] = useState('')
  const [askAIResponse, setAskAIResponse] = useState('')
  const [askAILoading, setAskAILoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Recap State ──────────────────────────────────────────────────
  const [recapData, setRecapData] = useState<{ recap: string; count: number; topTags: string[]; period: number } | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)

  // ── Drawer State ─────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMemory, setDrawerMemory] = useState<Memory | null>(null)
  const [drawerConnections, setDrawerConnections] = useState<{ id: string; title: string; type: string; reason: string; strength: number }[]>([])
  const [drawerConnectionsLoading, setDrawerConnectionsLoading] = useState(false)

  // ── AI Brain State ───────────────────────────────────────────────
  const [brainOpen, setBrainOpen] = useState(false)
  const [brainClusters, setBrainClusters] = useState<{ name: string; theme: string; memoryIds: string[] }[]>([])
  const [brainLoading, setBrainLoading] = useState(false)

  // ── Command Palette State ────────────────────────────────────────
  const [commandOpen, setCommandOpen] = useState(false)

  // ── Collections State ────────────────────────────────────────────
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionColor, setNewCollectionColor] = useState('#6D597A')
  const [newCollectionIcon, setNewCollectionIcon] = useState('📁')

  // ═════════════════════════════════════════════════════════════════
  // ─── EFFECTS ─────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  useEffect(() => {
    store.checkSession()
  }, [])

  useEffect(() => {
    if (store.isAuthenticated) {
      store.fetchMemories()
      store.fetchCollections()
    }
  }, [store.isAuthenticated])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [askAIResponse])

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Clear just-captured animation after a few seconds
  useEffect(() => {
    if (justCapturedId) {
      const timer = setTimeout(() => setJustCapturedId(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [justCapturedId])

  // ═════════════════════════════════════════════════════════════════
  // ─── HANDLERS ────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  const handleCaptureSubmit = useCallback(async () => {
    const text = captureInput.trim()
    if (!text && !selectedImage && !capture.isRecording) return

    try {
      // Image capture
      if (selectedImage) {
        const result = await capture.captureImage(selectedImage, text || undefined)
        if (result.success && result.memory) {
          setJustCapturedId(result.memory.id)
          toast.success('Image captured & AI analyzed!', { icon: '✨' })
        } else if (result.error) {
          toast.error(result.error)
        }
        setCaptureInput('')
        setSelectedImage(null)
        setImagePreviewUrl(null)
        return
      }

      // Voice capture
      if (capture.isRecording) {
        const blob = await capture.stopRecording()
        if (blob) {
          const result = await capture.captureVoice(blob, text || undefined)
          if (result.success && result.memory) {
            setJustCapturedId(result.memory.id)
            toast.success('Voice note captured & transcribed!', { icon: '✨' })
          } else if (result.error) {
            toast.error(result.error)
          }
        }
        setCaptureInput('')
        return
      }

      // Text or Link capture
      const isUrl = /^https?:\/\//i.test(text)
      let result
      if (isUrl) {
        result = await capture.captureLink(text, undefined, undefined)
      } else {
        result = await capture.captureText(text, text)
      }

      if (result.success && result.memory) {
        setJustCapturedId(result.memory.id)
        toast.success(
          result.memory.summary || (result.memory.tags && result.memory.tags.length > 0)
            ? 'Captured with AI synthesis!'
            : 'Memory captured!',
          { icon: '✨' }
        )
      } else if (result.error) {
        toast.error(result.error)
      }

      setCaptureInput('')
    } catch (err) {
      console.error('Capture error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to capture. Please try again.')
    }
  }, [captureInput, selectedImage, capture])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    const url = URL.createObjectURL(file)
    setImagePreviewUrl(url)
  }, [])

  const handleStartRecording = useCallback(async () => {
    try {
      await capture.startRecording()
    } catch {
      toast.error('Microphone access denied')
    }
  }, [capture])

  const handleStopRecording = useCallback(async () => {
    const blob = await capture.stopRecording()
    if (blob) {
      const text = captureInput.trim()
      const result = await capture.captureVoice(blob, text || undefined)
      if (result.success && result.memory) {
        setJustCapturedId(result.memory.id)
        toast.success('Voice note captured & transcribed!', { icon: '✨' })
      } else if (result.error) {
        toast.error(result.error)
      }
      setCaptureInput('')
    }
  }, [capture, captureInput])

  const handleAuth = useCallback(async (mode: 'login' | 'signup', email: string, password: string, name?: string) => {
    setAuthLoading(true)
    try {
      let success = false
      if (mode === 'login') {
        success = await store.login(email, password)
      } else {
        success = await store.signup(email, password, name || '')
      }
      if (success) {
        setAuthModalOpen(false)
        store.setShowAuthModal(false)
        setAuthEmail('')
        setAuthPassword('')
        setAuthName('')
        toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
      } else {
        toast.error(mode === 'login' ? 'Invalid credentials' : 'Signup failed. Try again.')
      }
    } catch {
      toast.error('Authentication error')
    } finally {
      setAuthLoading(false)
    }
  }, [store])

  const handleDeleteMemory = useCallback(async (id: string) => {
    try {
      await store.deleteMemoryFromDB(id)
      setDrawerOpen(false)
      setDrawerMemory(null)
      toast.success('Memory purged')
    } catch {
      toast.error('Failed to delete memory')
    }
  }, [store])

  const handleDownloadMarkdown = useCallback((memory: Memory) => {
    const md = `# ${memory.title || 'Untitled'}\n\n`
      + `**Type:** ${memory.type}\n`
      + `**Date:** ${new Date(memory.createdAt).toLocaleDateString()}\n\n`
      + `## Summary\n${memory.summary || 'No summary available.'}\n\n`
      + `## Raw Content\n${memory.content}\n\n`
      + `## Deep Insight\n${memory.deepInsight || 'No deep insight available.'}\n\n`
      + `## Tags\n${memory.tags.join(', ') || 'None'}\n`

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${memory.title?.slice(0, 40) || 'memory'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleAskAI = useCallback(async () => {
    const q = askAIQuery.trim()
    if (!q) return

    setAskAILoading(true)
    setAskAIResponse('')

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
        credentials: 'include',
      })

      if (!res.ok || !res.body) throw new Error('Chat failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setAskAIResponse(fullText)
      }
    } catch {
      setAskAIResponse('I couldn\'t search your memories right now. Please try again.')
    } finally {
      setAskAILoading(false)
    }
  }, [askAIQuery])

  const handleLoadRecap = useCallback(async (hours = 24) => {
    setRecapLoading(true)
    try {
      const res = await fetch(`/api/recap?hours=${hours}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRecapData(data)
      }
    } catch {
      toast.error('Failed to generate recap')
    } finally {
      setRecapLoading(false)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    await store.logout()
    toast.success('Signed out')
  }, [store])

  const openDrawer = useCallback(async (memory: Memory) => {
    setDrawerMemory(memory)
    setDrawerOpen(true)
    setDrawerConnections([])
    setDrawerConnectionsLoading(true)

    try {
      const res = await fetch(`/api/brain?memoryId=${memory.id}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDrawerConnections(data.relatedMemories || [])
      }
    } catch {
      // Non-critical
    } finally {
      setDrawerConnectionsLoading(false)
    }
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setDrawerMemory(null)
    setDrawerConnections([])
  }, [])

  const handleLoadBrain = useCallback(async () => {
    setBrainLoading(true)
    try {
      const res = await fetch('/api/brain', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setBrainClusters(data.clusters || [])
        setBrainOpen(true)
      }
    } catch {
      toast.error('Failed to load AI Brain')
    } finally {
      setBrainLoading(false)
    }
  }, [])

  const handleCreateCollection = useCallback(async () => {
    const name = newCollectionName.trim()
    if (!name) return
    try {
      const collection = await store.saveCollection({ name, color: newCollectionColor, icon: newCollectionIcon })
      if (collection) {
        toast.success('Collection created!')
        setNewCollectionName('')
      } else {
        toast.error('Failed to create collection')
      }
    } catch {
      toast.error('Failed to create collection')
    }
  }, [newCollectionName, newCollectionColor, newCollectionIcon, store])

  // ═════════════════════════════════════════════════════════════════
  // ─── COMPUTED VALUES ─────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  const showLanding = !isMobile && !store.isAuthenticated

  const filteredMemories = useMemo(() => {
    return store.memories.filter(m => {
      if (store.filterType !== 'all' && m.type !== store.filterType) return false
      if (store.searchQuery) {
        const q = store.searchQuery.toLowerCase()
        return (
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.tags.some(t => t.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [store.memories, store.filterType, store.searchQuery])

  const weeklyRecap = useMemo(() => getWeeklyRecap(store.memories), [store.memories])

  // ═════════════════════════════════════════════════════════════════
  // ─── RENDER: STATE A — LANDING PAGE ──────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  if (showLanding) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-black/[0.04]">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_4px_12px_rgba(139,92,246,0.2)]">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-zinc-900 tracking-tight">Aether</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCommandOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 bg-white/60 border border-black/[0.04] rounded-lg hover:bg-white/80 transition-all"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-400 font-mono">⌘K</kbd>
              </button>
              <button
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true) }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-white/60 border border-black/[0.04] rounded-lg hover:bg-white/80 transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 leading-[1.1]">
              A sanctuary for thoughts
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                that move too fast.
              </span>
            </h1>
            <p className="mt-6 text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed">
              Built for builders, creators, and divergent minds who need zero-friction mental clarity.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Sub-second voice capture</span>
              <span className="text-zinc-200">&middot;</span>
              <span className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> AI-powered synthesis</span>
              <span className="text-zinc-200">&middot;</span>
              <span className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Semantic search</span>
            </div>
          </motion.div>
        </section>

        {/* Interactive Living Demo */}
        <section className="px-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          >
            <LivingDemo />
          </motion.div>
        </section>

        {/* Pricing Cards */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* Free Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
              className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-8 flex flex-col transition-all duration-500 ease-out hover:shadow-[0_8px_30px_rgba(109,89,122,0.08)] hover:-translate-y-0.5"
            >
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">Ambient</p>
                <p className="text-4xl font-bold text-zinc-900 tracking-tight">$0.00 <span className="text-base font-normal text-zinc-400">/ Free</span></p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  15 Cognitive Captures per month
                </li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  Standard text and local timeline indexing
                </li>
                <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  AI-powered summaries
                </li>
              </ul>
              <div className="space-y-3 border-t border-black/[0.04] pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Create Free Account</p>
                <input
                  type="email"
                  placeholder="Email"
                  value={freeEmail}
                  onChange={e => setFreeEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={freePassword}
                  onChange={e => setFreePassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
                <button
                  onClick={async () => {
                    if (!freeEmail || !freePassword) { toast.error('Please fill in all fields'); return }
                    setAuthLoading(true)
                    const ok = await store.signup(freeEmail, freePassword, '')
                    setAuthLoading(false)
                    if (ok) { setFreeEmail(''); setFreePassword(''); toast.success('Welcome to Aether!') }
                    else toast.error('Signup failed. Try again.')
                  }}
                  disabled={authLoading}
                  className="w-full py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all duration-500 ease-out disabled:opacity-50"
                >
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Get Started Free'}
                </button>
              </div>
            </motion.div>

            {/* Premium Tier Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
              className="relative rounded-2xl p-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 shadow-[0_20px_50px_rgba(109,89,122,0.1)]"
            >
              <div className="bg-white rounded-2xl p-8 flex flex-col h-full transition-all duration-500 ease-out hover:shadow-[0_8px_30px_rgba(109,89,122,0.08)] hover:-translate-y-0.5">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Ascent</p>
                    <span className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-600 rounded-full font-medium border border-purple-100/50">Premium</span>
                  </div>
                  <p className="text-4xl font-bold text-zinc-900 tracking-tight">$5.99 <span className="text-base font-normal text-zinc-400">/ month</span></p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    Infinite Cognitive Scale
                  </li>
                  <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    Sub-second Groq voice processing
                  </li>
                  <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    Deep AI insights &amp; synthesis
                  </li>
                  <li className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    Autonomous collection auto-clustering
                  </li>
                </ul>
                <div className="space-y-3 border-t border-black/[0.04] pt-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Unlock Premium Sanctuary</p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={premiumEmail}
                    onChange={e => setPremiumEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={premiumPassword}
                    onChange={e => setPremiumPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                  />
                  <button
                    onClick={async () => {
                      if (!premiumEmail || !premiumPassword) { toast.error('Please fill in all fields'); return }
                      setAuthLoading(true)
                      const ok = await store.signup(premiumEmail, premiumPassword, '')
                      setAuthLoading(false)
                      if (ok) { setPremiumEmail(''); setPremiumPassword(''); toast.success('Welcome to Aether Premium!') }
                      else toast.error('Signup failed. Try again.')
                    }}
                    disabled={authLoading}
                    className="w-full py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg transition-all duration-500 ease-out disabled:opacity-50"
                  >
                    {authLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Unlock Premium'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-black/[0.04] py-8 px-6 mt-auto">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-zinc-400">
            <span>&copy; {new Date().getFullYear()} Aether</span>
            <span>Your second brain, always listening.</span>
          </div>
        </footer>

        {/* Sign In Modal */}
        <AnimatePresence>
          {authModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm"
              onClick={() => setAuthModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 border border-black/[0.04]"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Sign In</h2>
                  <button onClick={() => setAuthModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                  />
                  <button
                    onClick={() => handleAuth('login', authEmail, authPassword)}
                    disabled={authLoading}
                    className="w-full py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all disabled:opacity-50"
                  >
                    {authLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In'}
                  </button>
                  <p className="text-center text-xs text-zinc-400">
                    Don&apos;t have an account?{' '}
                    <button
                      onClick={() => setAuthModalOpen(false)}
                      className="text-purple-600 hover:underline"
                    >
                      Sign up below
                    </button>
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Command Palette (Landing) */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Aether Command Palette" description="Search or type a command...">
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => { setCommandOpen(false); setAuthMode('signup'); setAuthModalOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Free Account
              </CommandItem>
              <CommandItem onSelect={() => { setCommandOpen(false); setAuthMode('login'); setAuthModalOpen(true) }}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════════════
  // ─── RENDER: STATE B — MAIN DASHBOARD ────────────────────────────
  // ═════════════════════════════════════════════════════════════════

  const navItems = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
    { key: 'ask' as const, label: 'Ask AI', icon: MessageCircle },
    { key: 'collections' as const, label: 'Collections', icon: FolderOpen },
    { key: 'settings' as const, label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-40 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-[0_4px_12px_rgba(139,92,246,0.15)] cursor-pointer"
              onClick={() => store.setCurrentView('dashboard')}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-zinc-900 tracking-tight cursor-pointer" onClick={() => store.setCurrentView('dashboard')}>Aether</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = store.currentView === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    store.setCurrentView(item.key)
                    if (item.key === 'ask' && !recapData) handleLoadRecap()
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 ease-out",
                    isActive
                      ? "bg-purple-50/80 text-purple-700 border border-purple-200/50"
                      : "text-zinc-500 hover:text-zinc-700 hover:bg-white/60 border border-transparent"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            {/* Search / Command Palette button */}
            <button
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 bg-white/60 border border-black/[0.04] rounded-lg hover:bg-white/80 transition-all"
              title="Search (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-[9px] px-1 py-0.5 bg-zinc-100 rounded text-zinc-400 font-mono ml-1">&#8984;K</kbd>
            </button>
            {/* AI Brain button */}
            <button
              onClick={handleLoadBrain}
              disabled={brainLoading}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-500 ease-out",
                brainOpen
                  ? "bg-amber-50/80 text-amber-700 border border-amber-200/50"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-white/60 border border-transparent"
              )}
            >
              {brainLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Brain</span>
            </button>
            {/* Auth / Sign out */}
            {store.user && store.user.id !== 'local' ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-8 pt-6 pb-24 md:pb-20">

        {/* ═════════════════════════════════════════════════════════════
            VIEW: SETTINGS
            ═════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {store.currentView === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Aether Sanctuary Preferences</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Configure your personal Second Brain AI models, view tokens, and managed database connections.</p>
                  </div>
                </div>

                <div className="border-t border-black/[0.04] pt-6 space-y-4">
                  {/* AI Engine Status */}
                  <div className="flex justify-between items-center bg-gradient-to-r from-purple-50/50 to-indigo-50/50 p-4 rounded-xl border border-purple-100/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">Intelligence Engine Status</p>
                        <p className="text-xs text-zinc-400">z-ai-web-dev-sdk LLM Core (Online)</p>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>

                  {/* Voice Pipeline */}
                  <div className="flex justify-between items-center bg-gradient-to-r from-rose-50/50 to-pink-50/50 p-4 rounded-xl border border-rose-100/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                        <Volume2 className="w-4 h-4 text-rose-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">Dynamic Voice Pipeline</p>
                        <p className="text-xs text-zinc-400">z-ai-web-dev-sdk ASR Dictation Engine</p>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      CONNECTED
                    </span>
                  </div>

                  {/* Vision Engine */}
                  <div className="flex justify-between items-center bg-gradient-to-r from-amber-50/50 to-yellow-50/50 p-4 rounded-xl border border-amber-100/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">Vision Understanding Engine</p>
                        <p className="text-xs text-zinc-400">z-ai-web-dev-sdk VLM Image Analysis</p>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>

                  {/* Database Status */}
                  <div className="flex justify-between items-center bg-gradient-to-r from-emerald-50/50 to-teal-50/50 p-4 rounded-xl border border-emerald-100/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">Local Database Engine</p>
                        <p className="text-xs text-zinc-400">Prisma + SQLite (Persistent)</p>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      HEALTHY
                    </span>
                  </div>

                  {/* Account Profile */}
                  <div className="pt-4 border-t border-black/[0.04]">
                    <label className="text-xs font-bold text-zinc-500 block mb-2 uppercase tracking-wider">Account Profile Email</label>
                    <input
                      type="text"
                      disabled
                      value={store.user?.email || 'local-developer@aether.ai'}
                      className="w-full text-xs p-3 bg-zinc-100 text-zinc-500 rounded-xl border border-zinc-200 cursor-not-allowed"
                    />
                  </div>

                  {/* Stats */}
                  <div className="pt-4 border-t border-black/[0.04]">
                    <label className="text-xs font-bold text-zinc-500 block mb-3 uppercase tracking-wider">Sanctuary Statistics</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#FAFAFA] p-3 rounded-xl border border-black/[0.04] text-center">
                        <p className="text-2xl font-bold text-zinc-900">{store.memories.length}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">Memories</p>
                      </div>
                      <div className="bg-[#FAFAFA] p-3 rounded-xl border border-black/[0.04] text-center">
                        <p className="text-2xl font-bold text-zinc-900">{store.collections.length}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">Collections</p>
                      </div>
                      <div className="bg-[#FAFAFA] p-3 rounded-xl border border-black/[0.04] text-center">
                        <p className="text-2xl font-bold text-zinc-900">{store.memories.filter(m => m.type === 'voice').length}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">Voice Notes</p>
                      </div>
                      <div className="bg-[#FAFAFA] p-3 rounded-xl border border-black/[0.04] text-center">
                        <p className="text-2xl font-bold text-zinc-900">{store.memories.filter(m => m.isFavorite).length}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">Favorites</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => store.setCurrentView('dashboard')}
                    className="text-xs font-bold bg-zinc-900 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-800 transition-all duration-300 flex items-center gap-2"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Return to Workspace
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              VIEW: ASK AI / DAILY RECAP
              ═════════════════════════════════════════════════════════════ */}
          {store.currentView === 'ask' && (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* 24-Hour Executive Recap Card */}
              <div className="bg-gradient-to-br from-purple-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-purple-300" />
                    <h2 className="text-lg font-bold">Automated 24-Hour Executive Recap</h2>
                  </div>
                  <p className="text-xs text-purple-200/80 mt-1">
                    A consolidated high-level thematic analysis synthesized across all cognitive memory cells captured throughout the last day.
                  </p>

                  {recapLoading ? (
                    <div className="mt-6 p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-purple-300 animate-spin" />
                      <span className="text-sm text-purple-200">Synthesizing your cognitive patterns...</span>
                    </div>
                  ) : recapData ? (
                    <div className="mt-6 p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 text-xs leading-relaxed text-zinc-100">
                      <p className="whitespace-pre-wrap">&ldquo;{recapData.recap}&rdquo;</p>
                      {recapData.topTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/10">
                          {recapData.topTags.map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-400/20 rounded-full font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-purple-300/60 mt-2">{recapData.count} memories analyzed in the last {recapData.period}h</p>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <button
                        onClick={() => handleLoadRecap(24)}
                        className="text-xs font-medium bg-white/10 hover:bg-white/20 backdrop-blur-md text-purple-100 px-4 py-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Generate 24h Recap
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Period Selector */}
              <div className="flex items-center gap-2">
                {[
                  { label: '24h', hours: 24 },
                  { label: '7 days', hours: 168 },
                  { label: '30 days', hours: 720 },
                ].map(({ label, hours }) => (
                  <button
                    key={hours}
                    onClick={() => handleLoadRecap(hours)}
                    disabled={recapLoading}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-300",
                      recapData?.period === hours
                        ? "bg-purple-600 text-white"
                        : "bg-white/60 text-zinc-500 hover:bg-white border border-black/[0.04]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* AI Chat Interface */}
              <div className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <h3 className="text-sm font-bold text-zinc-800 tracking-tight">Ask Your Mind</h3>
                  </div>
                </div>
                {askAIResponse && (
                  <div className="mb-4 p-4 bg-purple-50/30 rounded-xl border border-purple-100/30 text-sm text-zinc-700 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {askAIResponse}
                    <div ref={chatEndRef} />
                  </div>
                )}
                {askAILoading && !askAIResponse && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching your memories...
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={askAIQuery}
                    onChange={e => setAskAIQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAskAI() }}
                    placeholder="What was that thing I mentioned about..."
                    className="flex-1 px-3 py-2 text-sm bg-[#FAFAFA] border border-black/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 placeholder:text-zinc-300 transition-all"
                  />
                  <button
                    onClick={handleAskAI}
                    disabled={askAILoading || !askAIQuery.trim()}
                    className="shrink-0 p-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(139,92,246,0.2)]"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => store.setCurrentView('dashboard')}
                className="text-xs font-bold bg-white text-zinc-800 border border-zinc-200 shadow-sm px-4 py-2.5 rounded-xl hover:bg-zinc-50 transition-all flex items-center gap-2"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Dismiss Report View
              </button>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              VIEW: COLLECTIONS
              ═════════════════════════════════════════════════════════════ */}
          {store.currentView === 'collections' && (
            <motion.div
              key="collections"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Collections</h2>
                    <p className="text-xs text-zinc-400">Organize memories into themed groups</p>
                  </div>
                </div>
              </div>

              {/* Create New Collection */}
              <div className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-5">
                <h3 className="text-sm font-bold text-zinc-800 tracking-tight mb-3">New Collection</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {['📁', '💻', '🎨', '📚', '🧠', '🚀', '💡', '🏠'].map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewCollectionIcon(icon)}
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all",
                          newCollectionIcon === icon ? "bg-purple-100 border border-purple-200/50 scale-110" : "bg-[#FAFAFA] border border-black/[0.04] hover:bg-white"
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {['#6D597A', '#E07A5F', '#3D8B7A', '#5B8C5A', '#D4A373', '#6C757D'].map(color => (
                      <button
                        key={color}
                        onClick={() => setNewCollectionColor(color)}
                        className={cn(
                          "w-5 h-5 rounded-full transition-all",
                          newCollectionColor === color ? "ring-2 ring-offset-2 ring-purple-400 scale-110" : ""
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={e => setNewCollectionName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection() }}
                    placeholder="Collection name..."
                    className="flex-1 px-3 py-2 text-sm bg-[#FAFAFA] border border-black/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 placeholder:text-zinc-300 transition-all"
                  />
                  <button
                    onClick={handleCreateCollection}
                    disabled={!newCollectionName.trim()}
                    className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collection Grid */}
              {store.collections.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center border border-emerald-100/30">
                    <FolderOpen className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight mb-2">No collections yet</h3>
                  <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    Create your first collection to organize memories into themed groups.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {store.collections.map(col => (
                    <motion.div
                      key={col.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-4 transition-all duration-500 ease-out hover:shadow-[0_8px_30px_rgba(109,89,122,0.08)] hover:-translate-y-0.5 cursor-pointer"
                      style={{ borderLeftWidth: '3px', borderLeftColor: col.color }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{col.icon}</span>
                        <h4 className="text-sm font-semibold text-zinc-800 truncate">{col.name}</h4>
                      </div>
                      <p className="text-xs text-zinc-400">{col.memoryCount} memories</p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <button
                          onClick={async () => {
                            await store.deleteCollection(col.id)
                            toast.success('Collection deleted')
                          }}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <button
                onClick={() => store.setCurrentView('dashboard')}
                className="text-xs font-bold bg-white text-zinc-800 border border-zinc-200 shadow-sm px-4 py-2.5 rounded-xl hover:bg-zinc-50 transition-all flex items-center gap-2"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Back to Dashboard
              </button>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              VIEW: DEFAULT DASHBOARD
              ═════════════════════════════════════════════════════════════ */}
          {store.currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* ═══ CAPTURE CAPSULE BAR ═══ */}
              <div className="relative">
                {/* Aether Glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/15 to-indigo-500/15 blur-2xl rounded-3xl pointer-events-none" />
                <div className="relative bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-3">
                  {/* Image preview strip */}
                  {imagePreviewUrl && (
                    <div className="mb-3 flex items-center gap-2">
                      <img src={imagePreviewUrl} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-black/[0.04]" />
                      <button
                        onClick={() => { setSelectedImage(null); setImagePreviewUrl(null) }}
                        className="text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {/* Capture input row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-purple-600 hover:bg-purple-50/50 transition-all"
                      title="Attach image"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={capture.isRecording ? handleStopRecording : handleStartRecording}
                      className={cn(
                        "shrink-0 p-2 rounded-lg transition-all duration-500 ease-out",
                        capture.isRecording
                          ? "text-rose-500 bg-rose-50/50 animate-pulse"
                          : "text-zinc-400 hover:text-purple-600 hover:bg-purple-50/50"
                      )}
                      title={capture.isRecording ? "Stop recording" : "Record voice"}
                    >
                      {capture.isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      value={captureInput}
                      onChange={e => setCaptureInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCaptureSubmit() } }}
                      placeholder={capture.isRecording ? `Recording ${capture.recordingDuration}s...` : "Capture a thought, paste a link, or type a note..."}
                      className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none placeholder:text-zinc-300 text-zinc-800"
                      disabled={capture.isCapturing}
                    />
                    <button
                      onClick={handleCaptureSubmit}
                      disabled={capture.isCapturing || (!captureInput.trim() && !selectedImage && !capture.isRecording)}
                      className={cn(
                        "shrink-0 p-2 rounded-lg transition-all duration-500 ease-out",
                        capture.isCapturing
                          ? "bg-purple-100 text-purple-400"
                          : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(139,92,246,0.2)]"
                      )}
                    >
                      {capture.isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Recording indicator */}
                  {capture.isRecording && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-rose-500">
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      Recording {capture.recordingDuration}s — tap mic to stop
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ WEEKLY RECAP CARD ═══ */}
              <AnimatePresence>
                {weeklyRecap && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    <div className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">&#10024;</span>
                        <h3 className="text-sm font-bold text-zinc-900 tracking-tight">This Week&apos;s Recap</h3>
                      </div>
                      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                        {weeklyRecap.count} memories captured{weeklyRecap.topTags.length > 0 && (
                          <> &middot; top tags: {weeklyRecap.topTags.join(', ')}</>
                        )}
                      </p>
                      <p className="text-sm text-zinc-600 leading-relaxed bg-purple-50/30 rounded-xl p-3 border border-purple-100/30 mb-3">
                        &ldquo;{weeklyRecap.summary}&rdquo;
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { store.setFilterType('all'); store.setSearchQuery('') }}
                          className="text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50/50 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          View All
                        </button>
                        <button
                          onClick={() => { store.setCurrentView('ask'); handleLoadRecap() }}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 bg-white/60 hover:bg-white px-3 py-1.5 rounded-lg border border-black/[0.04] transition-all"
                        >
                          Ask About This Week
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ═══ AI BRAIN PANEL ═══ */}
              <AnimatePresence>
                {brainOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-2xl shadow-[0_20px_50px_rgba(109,89,122,0.05)] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-amber-500" />
                          <h3 className="text-sm font-bold text-zinc-800 tracking-tight">AI Brain &mdash; Memory Connections</h3>
                        </div>
                        <button onClick={() => setBrainOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {brainClusters.length === 0 ? (
                        <p className="text-xs text-zinc-400">No clusters detected yet. Capture more memories to reveal connections.</p>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {brainClusters.filter(cluster => {
                            const clusterMemories = store.memories.filter(m => cluster.memoryIds.includes(m.id))
                            return clusterMemories.length > 0
                          }).length === 0 ? (
                            <p className="text-xs text-zinc-400">Analyzing connections... Capture more memories to reveal deeper patterns.</p>
                          ) : (
                            brainClusters.filter(cluster => {
                              const clusterMemories = store.memories.filter(m => cluster.memoryIds.includes(m.id))
                              return clusterMemories.length > 0
                            }).map((cluster, i) => {
                              const clusterMemories = store.memories.filter(m => cluster.memoryIds.includes(m.id))
                              return (
                                <div key={i} className="bg-[#FAFAFA] rounded-xl border border-black/[0.04] p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-amber-100/80 flex items-center justify-center">
                                      <Zap className="w-3 h-3 text-amber-600" />
                                    </div>
                                    <h4 className="text-sm font-semibold text-zinc-800 tracking-tight">{cluster.name}</h4>
                                    <span className="text-[10px] text-zinc-400 font-medium">{clusterMemories.length} memories</span>
                                  </div>
                                  <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{cluster.theme}</p>
                                  <div className="space-y-1.5">
                                    {clusterMemories.slice(0, 5).map(m => (
                                      <button
                                        key={m.id}
                                        onClick={() => { setBrainOpen(false); openDrawer(m) }}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-white/80 rounded-lg border border-black/[0.04] hover:border-purple-200/50 hover:bg-purple-50/30 transition-all duration-500 ease-out text-left"
                                      >
                                        <div className={cn("shrink-0 w-5 h-5 rounded flex items-center justify-center", MemoryTypeBgClass(m.type))}>
                                          <MemoryTypeIcon type={m.type} className="w-2.5 h-2.5" />
                                        </div>
                                        <span className="text-xs font-medium text-zinc-700 truncate">{m.title || 'Untitled'}</span>
                                        {m.tags.length > 0 && (
                                          <span className="text-[10px] text-purple-500 ml-auto shrink-0">{m.tags[0]}</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ═══ FILTER BAR ═══ */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(['all', 'text', 'voice', 'link', 'image'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => store.setFilterType(type)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-500 ease-out shrink-0",
                      store.filterType === type
                        ? "bg-zinc-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                        : "bg-white/60 text-zinc-500 hover:bg-white border border-black/[0.04] hover:border-black/[0.08]"
                    )}
                  >
                    {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                  <input
                    type="text"
                    value={store.searchQuery}
                    onChange={e => store.setSearchQuery(e.target.value)}
                    placeholder="Filter..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white/60 border border-black/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 placeholder:text-zinc-300 w-32 sm:w-40 transition-all"
                  />
                </div>
              </div>

              {/* ═══ MEMORY GRID ═══ */}
              {store.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                </div>
              ) : filteredMemories.length === 0 ? (
                /* ═══ EMPTY STATE ═══ */
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center border border-purple-100/30 shadow-[0_0_40px_rgba(139,92,246,0.08)]">
                    <Sparkles className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight mb-2">Your mind is a blank canvas</h3>
                  <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed mb-6">
                    Capture your first thought, link, or voice note and watch Aether bring it to life.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Try: I need to research GPU benchmarks', 'Try: https://example.com/article', 'Try: Record a quick thought'].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (suggestion.startsWith('Try: Record')) {
                            handleStartRecording()
                          } else if (suggestion.startsWith('Try: https://')) {
                            setCaptureInput(suggestion.replace('Try: ', ''))
                          } else {
                            setCaptureInput(suggestion.replace('Try: ', ''))
                          }
                        }}
                        className="text-xs px-3 py-1.5 bg-white/60 border border-black/[0.04] rounded-full text-zinc-500 hover:text-purple-600 hover:bg-purple-50/50 hover:border-purple-100/50 transition-all duration-500 ease-out"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                /* Masonry Grid */
                <div className="columns-1 md:columns-2 lg:columns-3 gap-3 [column-fill:_balance]">
                  {filteredMemories.map(memory => {
                    const isJustCaptured = justCapturedId === memory.id
                    return (
                      <motion.div
                        key={memory.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="break-inside-avoid mb-3"
                      >
                        <div
                          onClick={() => openDrawer(memory)}
                          className={cn(
                            "group cursor-pointer rounded-xl bg-white/80 backdrop-blur-xl border border-black/[0.04] shadow-[0_20px_50px_rgba(109,89,122,0.05)] overflow-hidden transition-all duration-500 ease-out hover:shadow-[0_8px_30px_rgba(109,89,122,0.08)] hover:-translate-y-0.5",
                            isJustCaptured && "ring-2 ring-emerald-400/40 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                          )}
                        >
                          {/* Image at top */}
                          {memory.imageUrl && (
                            <div className="relative">
                              <img
                                src={memory.imageUrl}
                                alt={memory.title || 'Captured image'}
                                className="w-full h-40 object-cover"
                              />
                              <div className="absolute top-2 right-2">
                                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", MemoryTypeBgClass(memory.type))}>
                                  <MemoryTypeIcon type={memory.type} className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="p-4">
                            {/* Title row */}
                            <div className="flex items-start gap-2.5 mb-2">
                              {!memory.imageUrl && (
                                <div className={cn("shrink-0 w-7 h-7 rounded-lg flex items-center justify-center", MemoryTypeBgClass(memory.type))}>
                                  <MemoryTypeIcon type={memory.type} className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-zinc-800 truncate tracking-tight">
                                  {memory.title || 'Untitled'}
                                </h3>
                              </div>
                              {isJustCaptured && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="shrink-0"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </motion.div>
                              )}
                            </div>
                            {/* Content preview */}
                            {(memory.summary || memory.content) && (
                              <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3 mb-3">
                                {memory.summary || memory.content}
                              </p>
                            )}
                            {/* Tags and time */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {memory.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 bg-purple-50/80 text-purple-600 border border-purple-100/50 rounded-full font-medium hover:bg-purple-100/80 transition-colors cursor-default"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {memory.tags.length > 3 && (
                                <span className="text-[10px] text-zinc-300 font-medium">+{memory.tags.length - 3}</span>
                              )}
                              <span className="text-[10px] text-zinc-300 ml-auto flex items-center gap-1 shrink-0">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAFAFA]/90 backdrop-blur-xl border-t border-black/[0.04] px-2 py-1.5 flex items-center justify-around safe-area-bottom">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = store.currentView === item.key
            return (
              <button
                key={item.key}
                onClick={() => {
                  store.setCurrentView(item.key)
                  if (item.key === 'ask' && !recapData) handleLoadRecap()
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-300",
                  isActive ? "text-purple-600" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-black/[0.04] py-4 px-6 mt-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[10px] text-zinc-400 font-medium">
          <span>&copy; {new Date().getFullYear()} Aether</span>
          <span>{store.memories.length} memories</span>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════
          ─── MEMORY DRAWER (Right-side sliding panel) ──────────────────
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && drawerMemory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black"
              onClick={closeDrawer}
            />
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#FAFAFA] shadow-2xl overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="sticky top-0 bg-[#FAFAFA]/80 backdrop-blur-xl z-10 flex items-center justify-between px-5 py-4 border-b border-black/[0.04]">
                <h2 className="text-sm font-bold text-zinc-900 tracking-tight">Memory Detail</h2>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-white/60 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Title & Type Badge */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border", MemoryTypeBadgeClass(drawerMemory.type))}>
                      {drawerMemory.type}
                    </span>
                    <span className="text-[10px] text-zinc-300 font-medium">
                      {formatDistanceToNow(new Date(drawerMemory.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight">
                    {drawerMemory.title || 'Untitled'}
                  </h3>
                </div>

                {/* AI Summary Card */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">AI Summary</span>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed bg-purple-50/30 rounded-xl p-4 border border-purple-100/30">
                    {drawerMemory.summary || 'Summary not yet generated...'}
                  </p>
                </div>

                {/* Content Section */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Content</span>
                  </div>
                  {drawerMemory.imageUrl ? (
                    <div className="space-y-3">
                      <img
                        src={drawerMemory.imageUrl}
                        alt="Captured image"
                        className="w-full rounded-xl border border-black/[0.04]"
                      />
                      {drawerMemory.content && drawerMemory.content !== 'Image capture' && (
                        <div className="text-sm text-zinc-600 bg-white/80 rounded-xl p-4 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-black/[0.04]">
                          {drawerMemory.content}
                        </div>
                      )}
                    </div>
                  ) : drawerMemory.sourceUrl ? (
                    <div className="space-y-2">
                      <a
                        href={drawerMemory.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors break-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        {drawerMemory.sourceUrl}
                      </a>
                      {drawerMemory.content && (
                        <div className="text-sm text-zinc-600 bg-white/80 rounded-xl p-4 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-black/[0.04]">
                          {drawerMemory.content}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-600 bg-white/80 rounded-xl p-4 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-black/[0.04]">
                      {drawerMemory.content || 'No content'}
                    </div>
                  )}
                </div>

                {/* ═══ AI GLOW CARD — Deep Insight ═══ */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Deep Insight</span>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50/80 via-indigo-50/60 to-blue-50/80 border border-purple-200/30 shadow-[0_0_40px_rgba(139,92,246,0.08)] rounded-xl p-4">
                    <p className="text-sm text-zinc-700 leading-relaxed">
                      {drawerMemory.deepInsight || 'Deep insight not yet generated...'}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {drawerMemory.tags.length > 0 ? drawerMemory.tags.map(tag => (
                      <span key={tag} className="text-xs px-2.5 py-1 bg-purple-50/80 text-purple-600 border border-purple-100/50 rounded-full flex items-center gap-0.5 hover:bg-purple-100/80 transition-colors cursor-default">
                        <Hash className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    )) : (
                      <span className="text-xs text-zinc-300">No tags</span>
                    )}
                  </div>
                </div>

                {/* Collections */}
                {drawerMemory.collections.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2 block">Collections</span>
                    <div className="flex flex-wrap gap-1.5">
                      {drawerMemory.collections.map(col => (
                        <span
                          key={col.id}
                          className="text-xs px-2.5 py-1 rounded-full border border-black/[0.04]"
                          style={{ backgroundColor: `${col.color}15`, color: col.color, borderColor: `${col.color}30` }}
                        >
                          {col.icon} {col.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ═══ AI Brain: Connected Memories ═══ */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Connected Memories</span>
                  </div>
                  {drawerConnectionsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Finding connections...
                    </div>
                  ) : drawerConnections.length > 0 ? (
                    <div className="space-y-1.5">
                      {drawerConnections.map(conn => {
                        const connMem = store.memories.find(m => m.id === conn.id)
                        return (
                          <button
                            key={conn.id}
                            onClick={() => { if (connMem) openDrawer(connMem) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-amber-50/30 rounded-xl border border-amber-100/30 hover:border-amber-200/50 hover:bg-amber-50/50 transition-all duration-500 ease-out text-left group"
                          >
                            <div className={cn("shrink-0 w-6 h-6 rounded-lg flex items-center justify-center", MemoryTypeBgClass(conn.type as MemoryType))}>
                              <MemoryTypeIcon type={conn.type as MemoryType} className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-zinc-700 truncate group-hover:text-amber-700 transition-colors">
                                {conn.title}
                              </p>
                              <p className="text-[10px] text-zinc-400 truncate">{conn.reason}</p>
                            </div>
                            <ArrowRight className="w-3 h-3 text-zinc-200 group-hover:text-amber-400 transition-colors shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-300 py-1">No connected memories found</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-black/[0.04]">
                  <button
                    onClick={() => handleDownloadMarkdown(drawerMemory)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-purple-600 bg-purple-50/50 hover:bg-purple-50 rounded-lg border border-purple-100/50 transition-all duration-500 ease-out"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .md
                  </button>
                  <button
                    onClick={() => handleDeleteMemory(drawerMemory!.id)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-all duration-500 ease-out"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          ─── AUTH MODAL (Dashboard) ────────────────────────────────────
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {(authModalOpen || store.showAuthModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm"
            onClick={() => { setAuthModalOpen(false); store.setShowAuthModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-black/[0.04]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuthMode('login')}
                    className={cn(
                      "text-sm font-semibold pb-1 transition-colors tracking-tight",
                      authMode === 'login' ? "text-zinc-900 border-b-2 border-purple-500" : "text-zinc-400"
                    )}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setAuthMode('signup')}
                    className={cn(
                      "text-sm font-semibold pb-1 transition-colors tracking-tight",
                      authMode === 'signup' ? "text-zinc-900 border-b-2 border-purple-500" : "text-zinc-400"
                    )}
                  >
                    Sign Up
                  </button>
                </div>
                <button
                  onClick={() => { setAuthModalOpen(false); store.setShowAuthModal(false) }}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {authMode === 'signup' && (
                  <input
                    type="text"
                    placeholder="Name"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                  />
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleAuth(authMode, authEmail, authPassword, authName)
                    }
                  }}
                  className="w-full px-3 py-2.5 text-sm border border-black/[0.06] rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
                <button
                  onClick={() => handleAuth(authMode, authEmail, authPassword, authName)}
                  disabled={authLoading}
                  className="w-full py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg transition-all duration-500 ease-out disabled:opacity-50"
                >
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          ─── COMMAND PALETTE (CMDK) ────────────────────────────────────
          ═══════════════════════════════════════════════════════════════ */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Aether Command Palette" description="Search memories or type a command...">
        <CommandInput placeholder="Type a command or search memories..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {/* Navigation */}
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => { setCommandOpen(false); store.setCurrentView('dashboard') }}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Go to Dashboard
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); store.setCurrentView('ask'); handleLoadRecap() }}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Ask AI / Daily Recap
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); store.setCurrentView('collections') }}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Collections
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); store.setCurrentView('settings') }}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </CommandItem>
          </CommandGroup>
          {/* Actions */}
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setCommandOpen(false); setCaptureInput(''); document.querySelector<HTMLInputElement>('[placeholder*="Capture"]')?.focus() }}>
              <Type className="mr-2 h-4 w-4" />
              Capture new text
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); setCaptureInput('https://') }}>
              <Globe className="mr-2 h-4 w-4" />
              Capture new link
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); fileInputRef.current?.click() }}>
              <Camera className="mr-2 h-4 w-4" />
              Capture new image
            </CommandItem>
            <CommandItem onSelect={() => { setCommandOpen(false); handleLoadBrain() }}>
              <Brain className="mr-2 h-4 w-4" />
              Open AI Brain
            </CommandItem>
          </CommandGroup>
          {/* Memories by type */}
          {filteredMemories.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Memories">
                {filteredMemories.slice(0, 10).map(memory => (
                  <CommandItem
                    key={memory.id}
                    value={`${memory.title} ${memory.content} ${memory.tags.join(' ')}`}
                    onSelect={() => { setCommandOpen(false); openDrawer(memory) }}
                  >
                    <div className={cn("mr-2 w-4 h-4 rounded flex items-center justify-center", MemoryTypeBgClass(memory.type))}>
                      <MemoryTypeIcon type={memory.type} className="w-2.5 h-2.5" />
                    </div>
                    <span className="truncate">{memory.title || 'Untitled'}</span>
                    {memory.tags.length > 0 && (
                      <CommandShortcut>#{memory.tags[0]}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  )
}

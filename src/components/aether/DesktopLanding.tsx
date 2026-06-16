'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Brain,
  Mic,
  Send,
  Image as ImageIcon,
  Loader2,
  X,
  ArrowRight,
  Check,
  Zap,
  Volume2,
  Layers,
} from 'lucide-react'
import { useAetherStore } from '@/lib/aether-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════════════
// ─── ANIMATION VARIANTS ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
}

const staggerChild = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// ═══════════════════════════════════════════════════════════════════════
// ─── TYPING ANIMATION DATA ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

const DEMO_THOUGHTS = [
  'The best products are the ones that disappear into your workflow...',
  'What if memory was as fluid as thought itself?',
  'Every great idea starts as a fragment before it becomes a system...',
]

const DEMO_SUMMARIES = [
  'Products that seamlessly integrate into existing habits become invisible infrastructure. The highest compliment for a tool is when users forget it is there.',
  'Memory systems should mirror the associative, non-linear nature of human cognition rather than forcing rigid hierarchies. Fluidity enables recall.',
  'Innovation follows a consistent arc: scattered observations crystallize into coherent frameworks. The fragment is the seed of every breakthrough.',
]

// ═══════════════════════════════════════════════════════════════════════
// ─── INTERACTIVE DEMO COMPONENT ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function InteractiveDemo() {
  const [phase, setPhase] = useState<'typing' | 'morphing' | 'result'>('typing')
  const [displayText, setDisplayText] = useState('')
  const [currentThoughtIdx, setCurrentThoughtIdx] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentThought = DEMO_THOUGHTS[currentThoughtIdx]
  const currentSummary = DEMO_SUMMARIES[currentThoughtIdx]

  const runCycle = useCallback(() => {
    setPhase('typing')
    setDisplayText('')
    setShowSummary(false)

    let charIndex = 0
    const typeInterval = setInterval(() => {
      if (charIndex < currentThought.length) {
        setDisplayText(currentThought.slice(0, charIndex + 1))
        charIndex++
      } else {
        clearInterval(typeInterval)
        timerRef.current = setTimeout(() => {
          setPhase('morphing')
          timerRef.current = setTimeout(() => {
            setPhase('result')
            setShowSummary(true)
            timerRef.current = setTimeout(() => {
              setCurrentThoughtIdx((prev) => (prev + 1) % DEMO_THOUGHTS.length)
            }, 4000)
          }, 800)
        }, 1200)
      }
    }, 45)

    return () => {
      clearInterval(typeInterval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentThought])

  useEffect(() => {
    const cleanup = runCycle()
    return cleanup
  }, [currentThoughtIdx])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.div
        variants={scaleIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        className="relative bg-white rounded-2xl border border-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.04]">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400/70" />
            <div className="size-2.5 rounded-full bg-yellow-400/70" />
            <div className="size-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[11px] text-gray-300 font-medium tracking-wide">AETHER</span>
          </div>
          <div className="w-[54px]" />
        </div>

        {/* Content area */}
        <div className="p-5 min-h-[220px] flex flex-col">
          {/* The typing input bar */}
          <div className="bg-white/80 border border-black/[0.04] shadow-sm backdrop-blur-xl rounded-2xl p-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl flex items-center justify-center text-gray-300">
                <Mic className="size-4" />
              </div>
              <div className="flex-1 text-sm text-gray-800 min-h-[28px] flex items-center">
                {displayText}
                {phase === 'typing' && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="inline-block w-[2px] h-4 bg-purple-500 ml-0.5"
                  />
                )}
              </div>
              <div className={cn(
                'size-8 rounded-xl flex items-center justify-center transition-all',
                displayText ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
              )}>
                <Send className="size-3.5" />
              </div>
            </div>
          </div>

          {/* Morphing into a card */}
          <AnimatePresence mode="wait">
            {phase === 'result' && showSummary && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="bg-gray-50/80 border border-black/[0.03] rounded-xl p-4"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="size-3 text-purple-500" />
                  <span className="text-[11px] font-medium text-purple-500 tracking-wide">AI SUMMARY</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {currentSummary}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {phase !== 'result' && (
            <div className="flex-1" />
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ─── PRICING CARD AUTH FORM ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function CardAuthForm({ mode, onSuccess }: { mode: 'signup' | 'premium'; onSuccess: () => void }) {
  const { login, signup } = useAetherStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in email and password')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      const success = await signup(email.trim(), password, email.trim().split('@')[0])
      if (success) {
        toast.success('Welcome to Aether!')
        onSuccess()
      } else {
        toast.error('Signup failed. Email may already be in use.')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4">
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        className="w-full border border-black/[0.06] focus:border-purple-400 bg-white rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors disabled:opacity-50"
      />
      <input
        type="password"
        placeholder="Password (6+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
        className="w-full border border-black/[0.06] focus:border-purple-400 bg-white rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-lg h-10 font-medium text-sm transition-all',
          mode === 'premium'
            ? 'bg-gradient-to-r from-purple-600 to-rose-500 hover:from-purple-700 hover:to-rose-600 text-white'
            : 'bg-gray-900 hover:bg-gray-800 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === 'premium' ? (
          <>
            Unlock Premium Sanctuary
            <ArrowRight className="size-3.5" />
          </>
        ) : (
          'Create Free Account'
        )}
      </button>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ─── SIGN IN DIALOG ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAetherStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in email and password')
      return
    }

    setIsLoading(true)
    try {
      const success = await login(email.trim(), password)
      if (success) {
        toast.success('Welcome back!')
        onClose()
      } else {
        toast.error('Invalid email or password')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-20 right-8 z-50 w-80 bg-white border border-black/[0.04] shadow-[0_16px_48px_rgba(0,0,0,0.08)] rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-gray-900">Sign In</h3>
              <button
                onClick={onClose}
                className="size-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
                className="w-full border border-black/[0.06] focus:border-purple-400 bg-white rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors disabled:opacity-50"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full border border-black/[0.06] focus:border-purple-400 bg-white rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg h-10 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Sign In'}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ─── DESKTOP LANDING PAGE ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

export function DesktopLanding() {
  const [showSignIn, setShowSignIn] = useState(false)

  const handleAuthSuccess = useCallback(() => {
    // Auth success handled by store; page.tsx will switch to Dashboard
  }, [])

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col relative overflow-hidden">
      {/* ── Background ambient blobs ────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-purple-100/40 blur-3xl animate-ambient-drift" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-rose-100/30 blur-3xl animate-ambient-drift-alt" />
        <div className="absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-amber-100/20 blur-3xl animate-ambient-drift" />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── FLOATING HEADER ────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-zinc-900 flex items-center justify-center shadow-sm">
              <Brain className="size-5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900 tracking-tight">Aether</span>
          </div>

          <button
            onClick={() => setShowSignIn(true)}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-white/60 border border-transparent hover:border-black/[0.06] transition-all"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 1: THE PURPOSE HERO ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="flex-1 flex items-center justify-center pt-24 pb-16 px-6 relative">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-2xl mx-auto text-center"
        >
          <motion.div variants={staggerChild} className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100/60">
              <Sparkles className="size-3 text-purple-500" />
              <span className="text-[11px] font-medium text-purple-600 tracking-wide">COGNITIVE SANCTUARY</span>
            </div>
          </motion.div>

          <motion.h1
            variants={staggerChild}
            className="text-4xl sm:text-5xl md:text-[56px] font-semibold text-gray-900 tracking-tight leading-[1.1] mb-6"
          >
            A sanctuary for thoughts{' '}
            <span className="bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent">
              that move too fast.
            </span>
          </motion.h1>

          <motion.p
            variants={staggerChild}
            className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-xl mx-auto"
          >
            Built for builders, creators, and divergent minds who need an absolute zero-friction mental escape pod.
          </motion.p>

          <motion.div variants={staggerChild} className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                const el = document.getElementById('pricing')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-6 h-11 font-medium text-sm transition-colors"
            >
              Get Started
              <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => setShowSignIn(true)}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 rounded-xl px-6 h-11 font-medium text-sm hover:bg-white/60 border border-black/[0.06] transition-all"
            >
              Sign In
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 2: THE INTERACTIVE LIVING DEMO ─────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          className="max-w-6xl mx-auto"
        >
          <motion.div variants={staggerChild} className="text-center mb-10">
            <span className="text-[11px] font-medium text-gray-400 tracking-widest uppercase">See it in action</span>
          </motion.div>

          <InteractiveDemo />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 3: ASYMMETRIC PRICING & AUTH MATRIX ────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 px-6 pb-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto"
        >
          <motion.div variants={staggerChild} className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight mb-3">
              Begin your cognitive journey
            </h2>
            <p className="text-sm text-gray-400">No credit card required. Start thinking freely.</p>
          </motion.div>

          <motion.div variants={staggerChild} className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* ── LEFT CARD: Ambient Free Tier ──────────────────────── */}
            <div className="bg-white border border-black/[0.06] rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="mb-6">
                <span className="text-[11px] font-medium text-gray-400 tracking-widest uppercase">Ambient</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-semibold text-gray-900">$0.00</span>
                <span className="text-sm text-gray-400">/ Free</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                15 Cognitive Captures per month, standard text and local timeline indexing.
              </p>

              <ul className="space-y-2.5 mb-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="size-3.5 text-green-500 shrink-0" />
                  15 captures / month
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="size-3.5 text-green-500 shrink-0" />
                  Text & link capture
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="size-3.5 text-green-500 shrink-0" />
                  AI summaries
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="size-3.5 text-green-500 shrink-0" />
                  Local timeline indexing
                </li>
              </ul>

              <div className="mt-6 pt-5 border-t border-black/[0.04]">
                <label className="text-[11px] font-medium text-gray-400 tracking-widest uppercase block mb-3">
                  Create Free Account
                </label>
                <CardAuthForm mode="signup" onSuccess={handleAuthSuccess} />
              </div>
            </div>

            {/* ── RIGHT CARD: Ascent Premium Tier ───────────────────── */}
            <div className="relative bg-white rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
              {/* Animated gradient border - using purple/rose instead of indigo/blue */}
              <div className="absolute inset-0 rounded-2xl p-[2px] animate-gradient-border bg-[length:200%_200%] bg-gradient-to-r from-purple-500 via-rose-400 to-purple-600">
                <div className="w-full h-full bg-white rounded-[14px]" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[11px] font-medium text-purple-500 tracking-widest uppercase">Ascent</span>
                  <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100/60">
                    PREMIUM
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-semibold text-gray-900">$5.99</span>
                  <span className="text-sm text-gray-400">/ month</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  Infinite Cognitive Scale, sub-second Groq voice processing, deep insights, and autonomous 10-memory vector collection auto-clustering.
                </p>

                <ul className="space-y-2.5 mb-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <Zap className="size-3.5 text-purple-500 shrink-0" />
                    Unlimited captures
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <Volume2 className="size-3.5 text-purple-500 shrink-0" />
                    Sub-second Groq voice processing
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <Brain className="size-3.5 text-purple-500 shrink-0" />
                    Deep cognitive insights
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <Layers className="size-3.5 text-purple-500 shrink-0" />
                    Auto-clustering collections
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <Sparkles className="size-3.5 text-purple-500 shrink-0" />
                    Priority AI synthesis
                  </li>
                </ul>

                <div className="mt-6 pt-5 border-t border-black/[0.04]">
                  <label className="text-[11px] font-medium text-gray-400 tracking-widest uppercase block mb-3">
                    Unlock Premium Sanctuary
                  </label>
                  <CardAuthForm mode="premium" onSuccess={handleAuthSuccess} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="py-6 text-center border-t border-black/[0.03]">
        <p className="text-xs text-gray-400">Aether &mdash; Your cognitive sanctuary</p>
      </footer>

      {/* ── Sign In Dialog ────────────────────────────────────────── */}
      <SignInDialog open={showSignIn} onClose={() => setShowSignIn(false)} />
    </div>
  )
}

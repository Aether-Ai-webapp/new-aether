'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Star } from 'lucide-react'
import { useAetherStore } from '@/lib/aether-store'

interface LandingPageProps {
  onEnterApp: () => void
}

const features = [
  'Unlimited Cognitive Storage',
  'Zero-Friction Voice Ingestion',
  'Continuous Multi-Note AI Synchronization',
]

const testimonials = [
  { name: 'Sarah K.', role: 'Researcher', text: 'Aether completely transformed how I capture and connect my ideas.' },
  { name: 'James L.', role: 'Writer', text: 'The AI recall is unreal — it surfaces thoughts I forgot I even had.' },
  { name: 'Priya M.', role: 'Founder', text: 'I use this for every meeting, idea, and insight. It never lets me down.' },
  { name: 'David R.', role: 'Designer', text: 'Elegant, fast, and actually useful. This is what note-taking should be.' },
  { name: 'Elena T.', role: 'Professor', text: 'My students and I rely on Aether for literature synthesis. Game changer.' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.2, ease: 'easeInOut' },
  }),
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const { setShowAuthModal } = useAetherStore()

  const handleGetStarted = () => {
    onEnterApp()
    setShowAuthModal(true)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F9FAFB] flex flex-col items-center justify-center">
      {/* Ambient gradient blobs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-30 animate-ambient-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0) 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-25 animate-ambient-drift-alt"
        style={{
          background:
            'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0) 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-20 animate-ambient-drift"
        style={{
          background:
            'radial-gradient(ellipse, rgba(192,132,252,0.10) 0%, rgba(192,132,252,0) 70%)',
          animationDelay: '3s',
        }}
      />

      {/* Title */}
      <motion.h1
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-900 text-center max-w-3xl px-6"
      >
        Your mind, entirely unified.
      </motion.h1>

      {/* Pricing Card */}
      <motion.div
        custom={1}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mt-14 w-full max-w-md mx-6 rounded-3xl bg-white/90 border border-black/[0.04] shadow-2xl backdrop-blur-md p-10"
      >
        <p className="uppercase text-sm font-semibold tracking-wider text-purple-600 text-center">
          INFINITE COGNITIVE SCALE
        </p>

        <div className="mt-5 flex items-baseline justify-center gap-1.5">
          <span className="text-5xl font-bold text-zinc-900">$5.99</span>
          <span className="text-base font-medium text-zinc-400">/ month</span>
        </div>

        <div className="border-t border-black/[0.04] my-6" />

        <ul className="space-y-4">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <Sparkles className="size-4 text-purple-500 shrink-0" />
              <span className="text-sm text-zinc-600">{feature}</span>
            </li>
          ))}
        </ul>

        <motion.button
          onClick={handleGetStarted}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="mt-8 w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-3.5 font-medium transition-colors duration-200"
        >
          Get Started
        </motion.button>
      </motion.div>

      {/* Testimonial Ticker */}
      <motion.div
        custom={2}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mt-16 w-full overflow-hidden"
      >
        <div className="animate-ticker flex gap-8 w-max">
          {[...testimonials, ...testimonials].map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              className="w-72 shrink-0 rounded-2xl bg-white/70 border border-black/[0.04] backdrop-blur-sm p-5"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    className="size-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="size-7 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-white text-xs font-semibold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-800">{t.name}</p>
                  <p className="text-[11px] text-zinc-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

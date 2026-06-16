'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Send, Sparkles, MessageCircle, Volume2, Square, RefreshCw } from 'lucide-react'
import { useAetherStore, type ChatMessage } from '@/lib/aether-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

// ─── Suggestion chips ────────────────────────────────────────────────
const suggestions = [
  'Recap my week',
  'What did I save this week?',
  'Summarize my recent notes',
  'Find links about design',
]

// ─── Animation variants ──────────────────────────────────────────────
const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}

const dotBounce = {
  animate: {
    y: [0, -6, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// ─── Helper: strip markdown for TTS ──────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' (code block) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[_~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── TTS Player Hook ─────────────────────────────────────────────────
function useTTS() {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingId(null)
  }, [])

  const play = useCallback(async (id: string, text: string) => {
    // If already playing this, stop
    if (playingId === id) {
      stop()
      return
    }
    // Stop any current playback
    stop()
    setIsLoading(id)
    try {
      const cleanText = stripMarkdown(text).slice(0, 4000)
      if (!cleanText) return
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'tongtong', speed: 1.0 }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setPlayingId(null)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setPlayingId(null)
        URL.revokeObjectURL(url)
      }
      await audio.play()
      setPlayingId(id)
    } catch (e) {
      toast.error('Could not play audio')
    } finally {
      setIsLoading(null)
    }
  }, [playingId, stop])

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  return { play, stop, playingId, isLoading }
}

// ─── Typing indicator ────────────────────────────────────────────────
function TypingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="flex items-end gap-2"
    >
      <div className="size-7 rounded-full bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-purple-500/15">
        <Brain className="size-3.5 text-white" />
      </div>

      <div className={cn(
        'rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm',
        isDark
          ? 'bg-white/[0.025] border border-white/[0.04] text-white/90'
          : 'bg-white border border-gray-100 text-gray-900 shadow-md'
      )}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={cn(
                'size-2 rounded-full',
                isDark ? 'bg-purple-400/20' : 'bg-purple-400/40'
              )}
              {...dotBounce}
              transition={{
                ...dotBounce.animate.transition,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Single message bubble ───────────────────────────────────────────
function ChatBubble({
  message,
  isDark,
  onPlay,
  playingId,
  ttsLoading,
}: {
  message: ChatMessage
  isDark: boolean
  onPlay: (id: string, text: string) => void
  playingId: string | null
  ttsLoading: string | null
}) {
  const isUser = message.role === 'user'
  const isPlaying = playingId === message.id
  const isLoadingThis = ttsLoading === message.id

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* Aether avatar for assistant */}
      {!isUser && (
        <div className="size-7 rounded-full bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-purple-500/15">
          <Brain className="size-3.5 text-white" />
        </div>
      )}

      <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 text-white rounded-br-sm shadow-md shadow-purple-500/15'
              : isDark
                ? 'bg-white/[0.025] border border-white/[0.04] text-white/90 rounded-bl-sm'
                : 'bg-white border border-gray-100 text-gray-900 rounded-bl-sm shadow-md'
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <div className={cn(
              'prose prose-sm max-w-none',
              isDark ? 'dark:prose-invert' : '',
              'prose-p:leading-relaxed prose-p:my-1',
              'prose-headings:my-2',
              isDark ? 'prose-headings:text-white' : 'prose-headings:text-gray-900',
              'prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
              isDark
                ? 'prose-code:text-purple-400 prose-code:before:content-[\'\'] prose-code:after:content-[\'\']'
                : 'prose-code:text-purple-600 prose-code:before:content-[\'\'] prose-code:after:content-[\'\']',
              isDark
                ? 'prose-pre:bg-white/[0.025] prose-pre:border prose-pre:border-white/[0.04]'
                : 'prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-100',
              isDark ? 'prose-strong:text-white' : 'prose-strong:text-gray-900',
              isDark ? 'prose-a:text-purple-400' : 'prose-a:text-purple-600',
              'prose-a:underline'
            )}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* TTS button for assistant messages */}
        {!isUser && message.content && (
          <button
            onClick={() => onPlay(message.id, message.content)}
            disabled={isLoadingThis}
            className={cn(
              'mt-1 ml-1 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all',
              'hover:bg-purple-500/10',
              isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-400 hover:text-purple-600',
              isPlaying && 'text-purple-500'
            )}
          >
            {isLoadingThis ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : isPlaying ? (
              <Square className="size-3" />
            ) : (
              <Volume2 className="size-3" />
            )}
            {isLoadingThis ? 'Loading...' : isPlaying ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="size-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/15">
          <MessageCircle className="size-3.5 text-white" />
        </div>
      )}
    </motion.div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────
function EmptyState({ onSuggestionClick, isDark }: { onSuggestionClick: (text: string) => void; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center h-full px-4 py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className={cn(
          'size-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg',
          isDark
            ? 'bg-gradient-to-br from-purple-500/8 to-indigo-500/8 border border-purple-500/12 shadow-purple-500/8'
            : 'bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 shadow-purple-500/5'
        )}
      >
        <Brain className={cn('size-10', isDark ? 'text-purple-400/70' : 'text-purple-600')} />
      </motion.div>

      <h3 className={cn(
        'text-xl font-semibold mb-2',
        isDark
          ? 'bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent'
          : 'text-gray-900'
      )}>
        Ask me anything about your memories
      </h3>

      <p className={cn(
        'text-sm max-w-[280px] mb-8',
        isDark ? 'text-white/30' : 'text-gray-500'
      )}>
        I can search, summarize, recap, and find patterns across everything you&apos;ve saved.
      </p>

      <div className="flex flex-wrap justify-center gap-2 max-w-[360px]">
        {suggestions.map((suggestion, i) => (
          <motion.button
            key={suggestion}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
            onClick={() => onSuggestionClick(suggestion)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm transition-all duration-200',
              'hover:shadow-md active:scale-[0.97]',
              isDark
                ? 'border-white/[0.04] bg-white/[0.02] text-white/50 hover:bg-white/[0.04] hover:border-purple-500/20 hover:text-white/80 hover:shadow-purple-500/8'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 hover:shadow-purple-500/10'
            )}
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main AskAether component ────────────────────────────────────────
export function AskAether() {
  const { chatMessages, addChatMessage, clearChat, darkMode } = useAetherStore()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDark = darkMode
  const tts = useTTS()

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      )
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages, isLoading, scrollToBottom])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }
      addChatMessage(userMessage)
      setInput('')
      setIsLoading(true)
      // Stop any TTS playback when new message starts
      tts.stop()

      // Detect recap command — use dedicated recap endpoint for richer output
      const isRecap = /^(recap|summary|summarize|what.?s new|catch me up|brief me)/i.test(trimmed)

      try {
        // For recap, use the dedicated recap endpoint
        if (isRecap) {
          const timeframeMatch = /today|day\b/i.test(trimmed) ? 'today'
            : /week/i.test(trimmed) ? 'week'
            : /all|everything|month/i.test(trimmed) ? 'all'
            : 'week'

          const res = await fetch('/api/ai/recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeframe: timeframeMatch }),
          })

          if (!res.ok) throw new Error(`Error: ${res.status}`)

          const data = await res.json()
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.recap || 'Sorry, I could not generate a recap.',
            timestamp: new Date(),
          }
          addChatMessage(assistantMessage)
          return
        }

        // Normal chat — streaming
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        })

        if (!res.ok) throw new Error(`Error: ${res.status}`)

        const assistantId = `assistant-${Date.now()}`

        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }
        addChatMessage(assistantMessage)

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            accumulated += chunk

            useAetherStore.setState((state) => ({
              chatMessages: state.chatMessages.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: accumulated }
                  : msg
              ),
            }))
          }
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'I\'m sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        }
        addChatMessage(errorMessage)
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
    },
    [isLoading, addChatMessage, tts]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestionClick = (text: string) => {
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] md:h-[calc(100dvh-4rem)] max-w-3xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/15">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <h1 className={cn(
                'text-xl font-bold tracking-tight',
                isDark
                  ? 'bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent'
                  : 'text-gray-900'
              )}>
                Ask Aether
              </h1>
              <p className={cn(
                'text-xs',
                isDark ? 'text-white/25' : 'text-gray-500'
              )}>
                Search, recap, and connect your memories with AI
              </p>
            </div>
          </div>

          {chatMessages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearChat(); tts.stop() }}
              className={cn(
                isDark ? 'text-white/25 hover:text-white/60' : 'text-gray-400 hover:text-gray-700'
              )}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Chat Area ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollRef} className="h-full">
          <div className="pr-2">
            <AnimatePresence mode="popLayout">
              {chatMessages.length === 0 && !isLoading ? (
                <EmptyState onSuggestionClick={handleSuggestionClick} isDark={isDark} />
              ) : (
                <div className="flex flex-col gap-4 py-2 pb-4">
                  {chatMessages.map((msg) => (
                    msg.content ? (
                      <ChatBubble
                        key={msg.id}
                        message={msg}
                        isDark={isDark}
                        onPlay={tts.play}
                        playingId={tts.playingId}
                        ttsLoading={tts.isLoading}
                      />
                    ) : (
                      msg.role === 'assistant' && isLoading ? (
                        <TypingIndicator key={msg.id} isDark={isDark} />
                      ) : null
                    )
                  ))}
                  {isLoading &&
                    (chatMessages.length === 0 || chatMessages[chatMessages.length - 1]?.role !== 'assistant') && (
                      <TypingIndicator isDark={isDark} />
                    )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>

      {/* ── Input Area ─────────────────────────────────────────────── */}
      <div className="shrink-0 pt-3 pb-2">
        <form
          onSubmit={handleSubmit}
          className={cn(
            'flex items-center gap-2 p-1.5 rounded-2xl transition-all duration-500',
            isDark
              ? 'bg-white/[0.02] border border-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_30px_-10px_rgba(168,85,247,0.08)] focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_0_60px_-15px_rgba(168,85,247,0.3)] focus-within:border-purple-500/20'
              : 'bg-white border border-gray-200 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_0_30px_-10px_rgba(168,85,247,0.06)] focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_0_40px_-10px_rgba(168,85,247,0.1)] focus-within:border-purple-300/30'
          )}
        >
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your memories, or type 'recap my week'..."
              disabled={isLoading}
              className={cn(
                'rounded-xl h-11 pl-4 pr-4 text-sm border-0 shadow-none bg-transparent',
                isDark
                  ? 'text-white placeholder:text-white/20 focus-visible:ring-0'
                  : 'text-gray-900 placeholder:text-gray-400 focus-visible:ring-purple-400/30'
              )}
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
            className={cn(
              'size-10 rounded-xl transition-all active:scale-95',
              'bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600',
              'hover:shadow-lg hover:shadow-purple-500/20',
              'disabled:opacity-50 disabled:shadow-none'
            )}
          >
            <Send className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
        <p className={cn(
          'text-[10px] text-center mt-2',
          isDark ? 'text-white/10' : 'text-gray-400'
        )}>
          Aether AI may make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}

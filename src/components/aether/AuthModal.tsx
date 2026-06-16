'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, ArrowRight, Loader2, Brain } from 'lucide-react'
import { useAetherStore } from '@/lib/aether-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, signup, darkMode } = useAetherStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [isLoading, setIsLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const isDark = darkMode

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setName('')
    setIsLoading(false)
  }

  const handleClose = () => {
    setShowAuthModal(false)
    setTimeout(resetForm, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in email and password')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      const success = mode === 'login'
        ? await login(email.trim(), password)
        : await signup(email.trim(), password, name.trim())

      if (success) {
        toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
        handleClose()
      } else {
        toast.error(mode === 'login' ? 'Invalid email or password' : 'Signup failed. Email may already be in use.')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {showAuthModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                'relative w-full max-w-md rounded-2xl p-8 shadow-2xl',
                isDark
                  ? 'bg-[#060812]/95 backdrop-blur-xl border border-white/[0.06] shadow-purple-500/10'
                  : 'bg-white/95 backdrop-blur-xl border border-gray-200 shadow-purple-500/5'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                className={cn(
                  'absolute top-4 right-4 size-8 rounded-full flex items-center justify-center transition-colors',
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.08] text-white/40'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                )}
              >
                <X className="size-4" />
              </button>

              {/* Header */}
              <div className="flex flex-col items-center mb-8">
                <motion.div
                  initial={{ scale: 0.8, rotate: -5 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="size-14 rounded-2xl bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 mb-4"
                >
                  <Brain className="size-7 text-white" />
                </motion.div>
                <h2 className={cn(
                  'text-2xl font-bold',
                  isDark
                    ? 'bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent'
                    : 'text-gray-900'
                )}>
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className={cn(
                  'text-sm mt-1',
                  isDark ? 'text-white/30' : 'text-gray-500'
                )}>
                  {mode === 'login'
                    ? 'Sign in to sync your memories across devices'
                    : 'Start saving memories to the cloud'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label className={cn(
                      'text-xs font-medium',
                      isDark ? 'text-white/50' : 'text-gray-600'
                    )}>Name</Label>
                    <div className="relative">
                      <User className={cn(
                        'absolute left-3 top-1/2 -translate-y-1/2 size-4',
                        isDark ? 'text-white/20' : 'text-gray-400'
                      )} />
                      <Input
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={cn(
                          'pl-9 h-11',
                          isDark
                            ? 'bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-purple-500/30 focus-visible:ring-purple-500/15'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus-visible:ring-purple-400/20'
                        )}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className={cn(
                    'text-xs font-medium',
                    isDark ? 'text-white/50' : 'text-gray-600'
                  )}>Email</Label>
                  <div className="relative">
                    <Mail className={cn(
                      'absolute left-3 top-1/2 -translate-y-1/2 size-4',
                      isDark ? 'text-white/20' : 'text-gray-400'
                    )} />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(
                        'pl-9 h-11',
                        isDark
                          ? 'bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-purple-500/30 focus-visible:ring-purple-500/15'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus-visible:ring-purple-400/20'
                      )}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={cn(
                    'text-xs font-medium',
                    isDark ? 'text-white/50' : 'text-gray-600'
                  )}>Password</Label>
                  <div className="relative">
                    <Lock className={cn(
                      'absolute left-3 top-1/2 -translate-y-1/2 size-4',
                      isDark ? 'text-white/20' : 'text-gray-400'
                    )} />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        'pl-9 h-11',
                        isDark
                          ? 'bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-purple-500/30 focus-visible:ring-purple-500/15'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus-visible:ring-purple-400/20'
                      )}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-white transition-all duration-200',
                    'bg-gradient-to-r from-purple-400 via-violet-500 to-indigo-500',
                    'hover:from-purple-300 hover:via-violet-400 hover:to-indigo-400',
                    'shadow-[0_0_24px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_32px_-5px_rgba(168,85,247,0.6)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    <>
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Switch mode */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className={cn(
                    'text-xs transition-colors',
                    isDark
                      ? 'text-white/25 hover:text-white/50'
                      : 'text-gray-400 hover:text-gray-700'
                  )}
                  disabled={isLoading}
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

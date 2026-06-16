'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Search,
  Layers,
  Settings,
  Brain,
  LogIn,
  LogOut,
  Plus,
} from 'lucide-react'
import { useAetherStore, type AppView } from '@/lib/aether-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AuthModal } from '@/components/aether/AuthModal'
import { AddMemorySheet } from '@/components/aether/AddMemorySheet'
import { AuroraBackground } from '@/components/aether/AuroraBackground'
import { StarField } from '@/components/aether/StarField'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NavItem {
  view: AppView
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: Home },
  { view: 'ask', label: 'Ask Aether', icon: Search },
  { view: 'collections', label: 'Collections', icon: Layers },
  { view: 'settings', label: 'Settings', icon: Settings },
]

const mobileNavItems: { view: AppView; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard', label: 'Home', icon: Home },
  { view: 'ask', label: 'Ask', icon: Search },
  { view: 'collections', label: 'Collections', icon: Layers },
  { view: 'settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentView, setCurrentView, darkMode, isAuthenticated, user, setShowAuthModal, logout } = useAetherStore()
  const isMobile = useIsMobile()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [showAddMemory, setShowAddMemory] = useState(false)

  const isDark = darkMode

  const handleSignOut = async () => {
    await logout()
    toast.success('Signed out')
  }

  return (
    <div className={cn(
      'min-h-screen flex flex-col transition-theme relative overflow-hidden',
      isDark ? 'bg-[#020408] text-white' : 'bg-[#f8f9fc] text-gray-900'
    )}>
      {/* ── Star Field ─────────────────────────────────────────────── */}
      <StarField isDark={isDark} />

      {/* ── Nebula Mesh Gradient Background ────────────────────────── */}
      <AuroraBackground isDark={isDark} />

      <div className="relative z-10 flex flex-1 min-h-0">
        {/* ── Glassmorphic Sidebar (Desktop) ──────────────────────── */}
        {!isMobile && (
          <aside
            className={cn(
              'h-screen fixed left-0 top-0 z-40 flex flex-col transition-all duration-300',
              sidebarExpanded ? 'w-64' : 'w-20',
              isDark
                ? 'bg-[#020408]/60 backdrop-blur-2xl border-r border-white/[0.03]'
                : 'bg-white/70 backdrop-blur-2xl border-r border-gray-200/50'
            )}
            onMouseEnter={() => setSidebarExpanded(true)}
            onMouseLeave={() => setSidebarExpanded(false)}
          >
            {/* Logo + Auth Header */}
            <div className={cn(
              'flex items-center justify-between gap-2 h-16 shrink-0',
              sidebarExpanded ? 'px-4' : 'px-0 justify-center',
              isDark ? 'border-b border-white/[0.03]' : 'border-b border-gray-200/50'
            )}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn(
                  'size-9 rounded-xl flex items-center justify-center shrink-0',
                  'bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 shadow-lg shadow-purple-500/20'
                )}>
                  <Brain className="size-5 text-white" />
                </div>
                <AnimatePresence>
                  {sidebarExpanded && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'text-xl font-bold whitespace-nowrap overflow-hidden bg-clip-text text-transparent',
                        isDark
                          ? 'bg-gradient-to-r from-purple-300 via-violet-300 to-indigo-300'
                          : 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600'
                      )}
                    >
                      AETHER
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Auth button in sidebar header */}
              <AnimatePresence>
                {sidebarExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="shrink-0"
                  >
                    {isAuthenticated ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1 px-2',
                          isDark ? 'text-white/25 hover:text-white/60 hover:bg-white/[0.03]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/60'
                        )}
                        onClick={handleSignOut}
                      >
                        <LogOut className="size-3" />
                        Log Out
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1 px-2',
                          isDark ? 'text-white/25 hover:text-white/60 hover:bg-white/[0.03]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/60'
                        )}
                        onClick={() => setShowAuthModal(true)}
                      >
                        <LogIn className="size-3" />
                        Sign In
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto items-center">
              <TooltipProvider delayDuration={0}>
                {navItems.map((item) => {
                  const isActive = currentView === item.view
                  const Icon = item.icon
                  return (
                    <Tooltip key={item.view}>
                      <TooltipTrigger asChild>
                        <motion.button
                          onClick={() => setCurrentView(item.view)}
                          whileHover={{ x: 4 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className={cn(
                            'flex items-center gap-3 rounded-xl p-3 text-sm font-medium transition-all duration-200 w-full',
                            isActive
                              ? isDark
                                ? 'text-white/90 bg-gradient-to-r from-purple-500/10 via-violet-500/8 to-transparent shadow-[0_0_20px_-5px_rgba(168,85,247,0.2)] border-r-2 border-purple-400/60'
                                : 'text-purple-700 bg-gradient-to-r from-purple-50 via-violet-50 to-transparent shadow-[0_0_20px_-5px_rgba(168,85,247,0.15)] border-r-2 border-purple-500'
                              : isDark
                                ? 'text-white/25 hover:text-white/60 hover:bg-white/[0.03]'
                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/60'
                          )}
                        >
                          <Icon className={cn(
                            'w-5 h-5 shrink-0',
                            isActive
                              ? isDark ? 'text-purple-400' : 'text-purple-600'
                              : ''
                          )} />
                          <AnimatePresence>
                            {sidebarExpanded && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="whitespace-nowrap overflow-hidden"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </TooltipTrigger>
                      {!sidebarExpanded && (
                        <TooltipContent side="right" className="font-medium">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </TooltipProvider>

              {/* New Memory button — prominent CTA in sidebar */}
              <div className="px-2 mt-2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        onClick={() => setShowAddMemory(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'flex items-center gap-3 rounded-xl p-3 text-sm font-semibold transition-all duration-200 w-full',
                          'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-600 text-white',
                          'shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40',
                          !sidebarExpanded && 'justify-center'
                        )}
                      >
                        <Plus className="size-5 shrink-0" />
                        <AnimatePresence>
                          {sidebarExpanded && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="whitespace-nowrap overflow-hidden"
                            >
                              New Memory
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </TooltipTrigger>
                    {!sidebarExpanded && (
                      <TooltipContent side="right" className="font-medium">
                        New Memory
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </nav>

            {/* Bottom: auth status */}
            <div className={cn(
              'p-3 shrink-0',
              isDark ? 'border-t border-white/[0.03]' : 'border-t border-gray-200/50'
            )}>
              {isAuthenticated && user && sidebarExpanded && (
                <div className={cn(
                  'text-[11px] px-2 truncate',
                  isDark ? 'text-white/15' : 'text-gray-400'
                )}>
                  {user.email}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── Main Content Area ────────────────────────────────────── */}
        <main
          className={cn(
            'flex-1 flex flex-col min-h-0 transition-all duration-300',
            !isMobile && (sidebarExpanded ? 'ml-64' : 'ml-20')
          )}
        >
          {/* Top auth bar on mobile */}
          {isMobile && (
            <div className={cn(
              'flex items-center justify-between px-4 h-12 shrink-0',
              isDark
                ? 'bg-[#020408]/70 backdrop-blur-xl border-b border-white/[0.03]'
                : 'bg-white/70 backdrop-blur-xl border-b border-gray-200/50'
            )}>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/15">
                  <Brain className="size-4 text-white" />
                </div>
                <span className={cn(
                  'font-bold text-sm bg-clip-text text-transparent',
                  isDark
                    ? 'bg-gradient-to-r from-purple-300 via-violet-300 to-indigo-300'
                    : 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600'
                )}>
                  AETHER
                </span>
              </div>
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 text-xs gap-1 px-2',
                    isDark ? 'text-white/25 hover:text-white/60' : 'text-gray-400 hover:text-gray-700'
                  )}
                  onClick={handleSignOut}
                >
                  <LogOut className="size-3" />
                  Log Out
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 text-xs gap-1 px-2',
                    isDark ? 'text-white/25 hover:text-white/60' : 'text-gray-400 hover:text-gray-700'
                  )}
                  onClick={() => setShowAuthModal(true)}
                >
                  <LogIn className="size-3" />
                  Sign In
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="p-4 md:p-6 lg:p-8"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ──────────────────────────────────── */}
      {isMobile && (
        <nav className={cn(
          'fixed bottom-0 left-0 right-0 z-40 safe-area-bottom transition-theme',
          isDark
            ? 'bg-[#020408]/80 backdrop-blur-2xl border-t border-white/[0.03]'
            : 'bg-white/80 backdrop-blur-2xl border-t border-gray-200/50'
        )}>
          <div className="flex items-center justify-around h-16 px-2 relative">
            {mobileNavItems.map((item) => {
              const isActive = currentView === item.view
              const Icon = item.icon
              return (
                <button
                  key={item.view}
                  onClick={() => setCurrentView(item.view)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-lg transition-all min-w-[48px] min-h-[44px]',
                    isActive
                      ? isDark
                        ? 'text-purple-400'
                        : 'text-purple-600'
                      : isDark
                        ? 'text-white/25'
                        : 'text-gray-400'
                  )}
                >
                  <Icon className="size-5" />
                  <span className={cn(
                    'text-[10px] font-medium',
                    isActive && 'font-semibold'
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="mobileNavIndicator"
                      className={cn(
                        'absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full',
                        isDark ? 'bg-purple-400/60' : 'bg-purple-600'
                      )}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      )}

      {/* ── Mobile Floating Action Button ──────────────────────────────── */}
      {isMobile && (
        <motion.button
          onClick={() => setShowAddMemory(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'fixed bottom-20 right-4 z-50 size-14 rounded-full',
            'bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-600',
            'shadow-xl shadow-purple-500/30 flex items-center justify-center',
            'safe-area-bottom'
          )}
          aria-label="New Memory"
        >
          <Plus className="size-6 text-white" />
        </motion.button>
      )}

      {/* ── Add Memory Sheet (global) ──────────────────────────────────── */}
      <AddMemorySheet open={showAddMemory} onOpenChange={setShowAddMemory} />

      {/* Auth Modal — global */}
      <AuthModal />
    </div>
  )
}

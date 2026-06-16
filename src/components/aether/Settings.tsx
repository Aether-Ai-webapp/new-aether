'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Moon,
  Sun,
  Crown,
  Download,
  Trash2,
  HardDrive,
  Info,
  Pencil,
  Check,
  X,
  Sparkles,
  Brain,
  LogOut,
  LogIn,
  Cloud,
  CloudOff,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { useAetherStore } from '@/lib/aether-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Animation variants ────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

// ─── Profile defaults ───────────────────────────────────────────────
const defaultProfile = {
  name: 'Aether User',
  email: 'hello@aether.app',
}

// ─── Feature list for plan comparison ───────────────────────────────
const planFeatures = [
  { label: 'Memories', free: 'Up to 15', pro: 'Unlimited' },
  { label: 'AI Chat', free: '3 / day', pro: 'Unlimited' },
  { label: 'Auto-tagging', free: 'Basic', pro: 'Advanced' },
  { label: 'Priority support', free: false, pro: true },
]

// ─── Component ──────────────────────────────────────────────────────
export function Settings() {
  const { darkMode, toggleDarkMode, memories, collections, user, logout, isAuthenticated, setShowAuthModal, supabaseReady } = useAetherStore()
  const [profile, setProfile] = useState({ name: user?.name || 'Aether User', email: user?.email || 'hello@aether.app' })
  const [editName, setEditName] = useState(profile.name)
  const [editEmail, setEditEmail] = useState(profile.email)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // ── Supabase setup state ────────────────────────────────────────
  const [checkingSetup, setCheckingSetup] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)

  // Derive setup status from store state
  const effectiveSetupStatus = useMemo(() => {
    if (!isAuthenticated) return 'idle' as const
    if (supabaseReady) return 'ready' as const
    if (checkingSetup) return 'checking' as const
    return 'not-setup' as const
  }, [isAuthenticated, supabaseReady, checkingSetup])

  const checkSetup = async () => {
    setCheckingSetup(true)
    try {
      const res = await fetch('/api/setup/supabase')
      const data = await res.json()
      if (data.tablesExist) {
        // Update store - the store already tracks supabaseReady
        useAetherStore.setState({ supabaseReady: true })
      }
    } catch {
      // Error case - already reflected in effectiveSetupStatus
    }
    setCheckingSetup(false)
  }

  const copySqlToClipboard = async () => {
    try {
      const res = await fetch('/api/setup/sql')
      if (res.ok) {
        const { sql } = await res.json()
        await navigator.clipboard.writeText(sql)
        setSqlCopied(true)
        toast.success('SQL copied to clipboard!')
        setTimeout(() => setSqlCopied(false), 2000)
      }
    } catch {
      toast.error('Failed to copy SQL')
    }
  }

  // Sync dark mode class on <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Storage usage (simulated: ~2 KB per memory + ~0.5 KB per collection)
  const usedKB = memories.length * 2 + collections.length * 0.5
  const maxKB = 500 // Free plan: 500 KB
  const usagePercent = Math.min((usedKB / maxKB) * 100, 100)

  const handleEditProfile = () => {
    setEditName(profile.name)
    setEditEmail(profile.email)
    setEditDialogOpen(true)
  }

  const handleSaveProfile = async () => {
    const newName = editName.trim() || defaultProfile.name
    const newEmail = editEmail.trim() || defaultProfile.email

    // Update local state immediately
    setProfile({ name: newName, email: newEmail })
    setEditDialogOpen(false)

    // Update Supabase auth if authenticated
    if (isAuthenticated) {
      try {
        const { createClient } = await import('@/lib/supabase/browser')
        const supabase = createClient()

        // Update name in user metadata
        const { error: nameError } = await supabase.auth.updateUser({
          data: { full_name: newName }
        })
        if (nameError) throw nameError

        // Update email if it changed
        if (newEmail !== profile.email) {
          const { error: emailError } = await supabase.auth.updateUser({
            email: newEmail
          })
          if (emailError) throw emailError
        }

        // Update the store user
        useAetherStore.setState((state) => ({
          user: state.user ? { ...state.user, name: newName, email: newEmail } : null
        }))

        toast.success('Profile updated!')
      } catch {
        toast.error('Failed to update profile. Please try again.')
      }
    } else {
      toast.success('Profile updated!')
    }
  }

  const handleDarkModeToggle = () => {
    toggleDarkMode()
    toast.success(darkMode ? 'Light mode enabled' : 'Dark mode enabled')
  }

  const handleExportPDF = () => {
    const memoriesHTML = memories.map((m) => {
      const date = new Date(m.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const tags = m.tags.length > 0
        ? `<div style="margin-top: 6px;">${m.tags.map(t => `<span style="display: inline-block; background: #f3e8ff; color: #7c3aed; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px; margin-right: 3px; text-transform: uppercase; letter-spacing: 0.5px;">${t}</span>`).join('')}</div>`
        : ''
      const summary = m.summary
        ? `<div style="background: #faf5ff; border-left: 3px solid #7c3aed; padding: 10px 14px; margin-top: 8px; border-radius: 0 6px 6px 0;"><p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #7c3aed; margin: 0 0 4px 0;">AI Summary</p><p style="font-size: 12px; line-height: 1.5; color: #374151; margin: 0;">${m.summary}</p></div>`
        : ''
      const typeLabel = m.type !== 'text' ? `<span style="display: inline-block; background: #ede9fe; color: #6d28d9; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px; margin-left: 6px; text-transform: uppercase;">${m.type}</span>` : ''

      return `
        <div style="margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6;">
          <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0; color: #1a1a2e;">${m.title || 'Untitled Memory'}${typeLabel}</h3>
          <p style="font-size: 11px; color: #9ca3af; margin: 0;">${date}</p>
          ${tags}
          ${summary}
          <p style="font-size: 13px; line-height: 1.6; color: #4b5563; margin-top: 8px; white-space: pre-wrap;">${m.content}</p>
          ${m.sourceUrl ? `<p style="font-size: 11px; color: #7c3aed; margin-top: 6px; word-break: break-all;">🔗 ${m.sourceUrl}</p>` : ''}
        </div>
      `
    }).join('')

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Aether — Memory Export</title>
            <style>
              @media print {
                @page { margin: 15mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
              body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; max-width: 750px; margin: 0 auto; padding: 40px 30px; }
            </style>
          </head>
          <body>
            <div style="border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: 800; margin: 0; color: #1a1a2e;">✨ Aether</h1>
              <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">Your Second Brain — Memory Export</p>
              <p style="font-size: 11px; color: #9ca3af; margin: 4px 0 0 0;">Exported on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${memories.length} memories</p>
            </div>
            ${memoriesHTML}
            <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="font-size: 10px; color: #d1d5db; margin: 0;">Exported from Aether — Your Second Brain</p>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 400)
    }
  }

  const handleClearAllData = () => {
    toast('All data cleared', { description: 'This is a demo — no data was actually deleted.' })
  }

  const handleUpgrade = () => {
    toast('Coming soon', { description: 'Pro plan will be available soon!' })
  }

  const userInitial = profile.name.charAt(0).toUpperCase()

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8"
    >
      {/* ── Page Title ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="size-7 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, appearance, and data.
        </p>
      </motion.div>

      {/* ── 1. Profile Section ─────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <User className="size-4 text-[#6D597A]" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex items-center justify-center size-14 rounded-full bg-gradient-to-br from-primary to-[#8B6F9A] text-primary-foreground font-bold text-xl shrink-0 shadow-md">
                {userInitial}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">
                  {profile.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {profile.email}
                </p>
              </div>

              {/* Edit Button */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={handleEditProfile}
                  >
                    <Pencil className="size-3.5" />
                    <span className="hidden sm:inline">Edit Profile</span>
                    <span className="sm:hidden">Edit</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <label htmlFor="edit-name" className="text-sm font-medium text-foreground">
                        Name
                      </label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="edit-email" className="text-sm font-medium text-foreground">
                        Email
                      </label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSaveProfile} className="gap-1.5">
                      <Check className="size-3.5" />
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Auth Button */}
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { logout(); toast.success('Signed out'); }}
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => setShowAuthModal(true)}
                >
                  <LogIn className="size-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 2. Cloud Sync (Supabase) Section ────────────────────────── */}
      {isAuthenticated && (
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                {effectiveSetupStatus === 'ready' ? (
                  <Cloud className="size-4 text-[#81B29A]" />
                ) : (
                  <CloudOff className="size-4 text-[#E07A5F]" />
                )}
                Cloud Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {effectiveSetupStatus === 'ready' ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#81B29A]/10">
                  <CheckCircle2 className="size-5 text-[#81B29A] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Connected to Supabase</p>
                    <p className="text-xs text-muted-foreground">Your memories sync across devices.</p>
                  </div>
                </div>
              ) : effectiveSetupStatus === 'not-setup' || effectiveSetupStatus === 'error' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#E07A5F]/10">
                    <AlertCircle className="size-5 text-[#E07A5F] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Database tables not found</p>
                      <p className="text-xs text-muted-foreground">Run the setup SQL in your Supabase dashboard to enable cloud sync.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={copySqlToClipboard}
                    >
                      {sqlCopied ? (
                        <CheckCircle2 className="size-3.5 text-[#81B29A]" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {sqlCopied ? 'Copied!' : 'Copy Setup SQL'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open('https://supabase.com/dashboard/project/kzjntvjzjhbodehuqxbf/sql', '_blank')}
                    >
                      <ExternalLink className="size-3.5" />
                      Open SQL Editor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={checkSetup}
                    >
                      <Check className="size-3.5" />
                      Re-check
                    </Button>
                  </div>
                </div>
              ) : effectiveSetupStatus === 'checking' ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
                  <Cloud className="size-5 text-muted-foreground shrink-0 animate-pulse" />
                  <p className="text-sm text-muted-foreground">Checking database connection...</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── 3. Appearance Section ──────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              {darkMode ? (
                <Moon className="size-4 text-[#B8A9C9]" />
              ) : (
                <Sun className="size-4 text-[#F2CC8F]" />
              )}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex items-center justify-center size-9 rounded-lg shrink-0',
                  darkMode ? 'bg-[#2d2d4a]' : 'bg-[#F2CC8F]/30'
                )}>
                  {darkMode ? (
                    <Moon className="size-4 text-[#B8A9C9]" />
                  ) : (
                    <Sun className="size-4 text-[#F2CC8F]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {darkMode ? 'On — easy on the eyes' : 'Off — bright and warm'}
                  </p>
                </div>
              </div>
              <Switch
                checked={darkMode}
                onCheckedChange={handleDarkModeToggle}
                aria-label="Toggle dark mode"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 4. Plan Section ────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Crown className="size-4 text-[#F2CC8F]" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Current Plan Card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F5EDE6] dark:bg-[#252540] transition-colors">
              <div className="flex items-center justify-center size-10 rounded-full bg-[#F2CC8F]/30 dark:bg-[#F2CC8F]/20 shrink-0">
                <Crown className="size-5 text-[#F2CC8F]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Free Plan</p>
                  <Badge className="bg-[#6D597A]/10 text-[#6D597A] dark:bg-[#B8A9C9]/20 dark:text-[#B8A9C9] border-0 text-[10px] px-1.5 py-0 h-5">
                    Current
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Up to 50 memories · unlimited AI chats
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-[#6D597A] to-[#8B6F9A] text-white hover:opacity-90 shadow-sm shrink-0"
                onClick={handleUpgrade}
              >
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">Upgrade to Pro</span>
                <span className="sm:hidden">Pro</span>
              </Button>
            </div>

            {/* Feature Comparison */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Feature Comparison
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Feature</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Free</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-[#6D597A] dark:text-[#B8A9C9]">Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planFeatures.map((feature, i) => (
                      <tr key={feature.label} className={cn(i < planFeatures.length - 1 && 'border-b border-border')}>
                        <td className="py-2 px-3 text-xs text-foreground">{feature.label}</td>
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                          {typeof feature.free === 'boolean' ? (
                            feature.free ? (
                              <Check className="size-3.5 mx-auto text-[#81B29A]" />
                            ) : (
                              <X className="size-3.5 mx-auto text-muted-foreground/40" />
                            )
                          ) : (
                            feature.free
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-foreground">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="size-3.5 mx-auto text-[#81B29A]" />
                            ) : (
                              <X className="size-3.5 mx-auto text-muted-foreground/40" />
                            )
                          ) : (
                            feature.pro
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 5. Data Section ────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <HardDrive className="size-4 text-[#81B29A]" />
              Data
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-5">
            {/* Storage Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Storage Usage</p>
                <p className="text-xs text-muted-foreground">
                  {usedKB.toFixed(1)} KB / {maxKB} KB
                </p>
              </div>
              <Progress value={usagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {memories.length} memories · {collections.length} collections
              </p>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={handleExportPDF}
              >
                <Download className="size-4" />
                Export PDF
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="gap-2 flex-1"
                  >
                    <Trash2 className="size-4" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <Trash2 className="size-5 text-destructive" />
                      Clear All Data
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your memories, collections, and chat
                      history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, clear everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 6. About Section ───────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Info className="size-4 text-[#6D597A] dark:text-[#B8A9C9]" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-primary to-[#8B6F9A] text-primary-foreground shadow-md shrink-0">
                <Brain className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Aether v0.3.0</p>
                <p className="text-xs text-muted-foreground">Your personal memory companion</p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Version</span>
                <span className="text-xs font-medium text-foreground">0.3.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Build</span>
                <span className="text-xs font-medium text-foreground">2025.03</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cloud Sync</span>
                <span className="text-xs font-medium text-foreground">
                  {supabaseReady ? 'Connected' : isAuthenticated ? 'Setup Required' : 'Not Available'}
                </span>
              </div>
            </div>

            <Separator />

            <p className="text-xs text-center text-muted-foreground py-1">
              Made with ❤️ by the Aether team
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

// ─── Small Settings icon (lucide-style inline) ──────────────────────
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

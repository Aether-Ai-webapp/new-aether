'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  BookOpen,
  Search,
  FileText,
  LinkIcon,
  ImageIcon,
  Mic,
  Heart,
  ArrowLeft,
  Pencil,
  Trash2,
  ExternalLink,
  Plus,
  Tag,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react'
import { useAetherStore, type Memory, type MemoryType } from '@/lib/aether-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

// ─── Type config ────────────────────────────────────────────────────
const typeConfig: Record<
  MemoryType,
  { label: string; icon: React.ElementType; color: string; bg: string; badgeBg: string }
> = {
  text: {
    label: 'Note',
    icon: FileText,
    color: '#8B5CF6',
    bg: 'bg-[#8B5CF6]/10',
    badgeBg: 'bg-[#8B5CF6]/15 text-[#7C3AED]',
  },
  link: {
    label: 'Link',
    icon: LinkIcon,
    color: '#22C55E',
    bg: 'bg-[#22C55E]/10',
    badgeBg: 'bg-[#22C55E]/15 text-[#16A34A]',
  },
  image: {
    label: 'Image',
    icon: ImageIcon,
    color: '#3B82F6',
    bg: 'bg-[#3B82F6]/10',
    badgeBg: 'bg-[#3B82F6]/15 text-[#2563EB]',
  },
  voice: {
    label: 'Voice',
    icon: Mic,
    color: '#EC4899',
    bg: 'bg-[#EC4899]/10',
    badgeBg: 'bg-[#EC4899]/15 text-[#DB2777]',
  },
}

// ─── Filter pills config ────────────────────────────────────────────
const filterOptions: {
  type: MemoryType | 'all'
  label: string
  icon: React.ElementType
}[] = [
  { type: 'all', label: 'All', icon: BookOpen },
  { type: 'text', label: 'Notes', icon: FileText },
  { type: 'link', label: 'Links', icon: LinkIcon },
  { type: 'image', label: 'Images', icon: ImageIcon },
  { type: 'voice', label: 'Voice', icon: Mic },
]

// ─── Animation variants ─────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

const detailVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } },
}

// ─── Memory Card ────────────────────────────────────────────────────
function MemoryCard({
  memory,
  onClick,
  onToggleFavorite,
}: {
  memory: Memory
  onClick: () => void
  onToggleFavorite: () => void
}) {
  const config = typeConfig[memory.type]
  const TypeIcon = config.icon
  const darkMode = useAetherStore((s) => s.darkMode)
  const isDark = darkMode
  const displayTitle =
    memory.title || memory.content.split('\n')[0].slice(0, 80) || 'Untitled'
  const contentPreview = memory.content.slice(0, 120).replace(/\n/g, ' ')
  const relativeTime = formatDistanceToNow(new Date(memory.createdAt), {
    addSuffix: true,
  })

  return (
    <motion.div variants={itemVariants}>
      <Card className={cn(
        'shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group',
        isDark
          ? 'bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08]'
          : 'bg-white/80 border border-gray-100 hover:bg-white hover:border-gray-200'
      )}>
        <CardContent className="p-3 md:p-4 space-y-2.5">
          {/* Top row: type badge + favorite + time */}
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              className={cn('gap-1 px-2 py-0.5 h-6 text-[11px] font-medium border-0', config.badgeBg)}
            >
              <TypeIcon className="size-3" />
              {config.label}
            </Badge>

            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite()
                }}
                className={cn(
                  'size-7 rounded-full flex items-center justify-center transition-all duration-150',
                  'hover:bg-accent active:scale-90',
                  memory.isFavorite
                    ? 'text-[#E07A5F]'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                )}
                aria-label={memory.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className="size-4"
                  fill={memory.isFavorite ? 'currentColor' : 'none'}
                />
              </button>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {relativeTime}
              </span>
            </div>
          </div>

          {/* Title */}
          <p
            className="text-sm font-semibold text-foreground leading-snug line-clamp-1"
            onClick={onClick}
          >
            {displayTitle}
          </p>

          {/* Image preview (for image-type memories) */}
          {memory.imagePreview && (
            <div className="rounded-md overflow-hidden border border-border/50 max-h-32" onClick={onClick}>
              <img
                src={memory.imagePreview}
                alt={displayTitle}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Content preview */}
          {memory.content && memory.title && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {contentPreview}
            </p>
          )}

          {/* Tags + Collections */}
          <div className="flex flex-wrap items-center gap-1.5">
            {memory.tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-normal bg-[#6D597A]/10 text-[#6D597A] border-0"
              >
                {tag}
              </Badge>
            ))}
            {memory.tags.length > 4 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-normal bg-muted text-muted-foreground border-0"
              >
                +{memory.tags.length - 4}
              </Badge>
            )}
            {memory.collections.slice(0, 2).map((col) => (
              <Badge
                key={col.id}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-normal border-0 gap-1"
                style={{
                  backgroundColor: `${col.color}15`,
                  color: col.color,
                }}
              >
                <span className="text-[9px]">{col.icon || '📁'}</span>
                {col.name}
              </Badge>
            ))}
            {memory.collections.length > 2 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-normal bg-muted text-muted-foreground border-0"
              >
                +{memory.collections.length - 2}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Memory Detail View ─────────────────────────────────────────────
function MemoryDetail({
  memory,
  onBack,
  onToggleFavorite,
  onDelete,
}: {
  memory: Memory
  onBack: () => void
  onToggleFavorite: () => void
  onDelete: () => void
}) {
  const config = typeConfig[memory.type]
  const TypeIcon = config.icon
  const darkMode = useAetherStore((s) => s.darkMode)
  const isDark = darkMode
  const relativeTime = formatDistanceToNow(new Date(memory.createdAt), {
    addSuffix: true,
  })

  return (
    <motion.div
      variants={detailVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-5"
    >
      {/* Back button + actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            className={cn(
              'size-9',
              memory.isFavorite ? 'text-[#E07A5F]' : 'text-muted-foreground'
            )}
          >
            <Heart
              className="size-4"
              fill={memory.isFavorite ? 'currentColor' : 'none'}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="size-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Title + type badge */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'size-9 rounded-lg flex items-center justify-center shrink-0',
              config.bg
            )}
          >
            <TypeIcon className="size-4" style={{ color: config.color }} />
          </div>
          <Badge
            variant="secondary"
            className={cn('gap-1 px-2 py-0.5 h-6 text-[11px] font-medium border-0', config.badgeBg)}
          >
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
        </div>

        <h2 className="text-xl font-bold text-foreground leading-tight">
          {memory.title || 'Untitled'}
        </h2>
      </div>

      {/* Image (for image-type memories) */}
      {memory.imagePreview && (
        <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm">
          <img
            src={memory.imagePreview}
            alt={memory.title || 'Image'}
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Audio playback (for voice-type memories) */}
      {memory.fileUrl && memory.type === 'voice' && (
        <audio src={memory.fileUrl} controls className="w-full" />
      )}

      {/* Content */}
      <Card className={cn(
        'shadow-sm',
        isDark
          ? 'bg-white/[0.015] border border-white/[0.04]'
          : 'bg-white/80 border border-gray-100'
      )}>
        <CardContent className="p-4 md:p-5">
          <p className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words', isDark ? 'text-white/70' : 'text-foreground')}>
            {memory.content}
          </p>
        </CardContent>
      </Card>

      {/* Source URL */}
      {memory.sourceUrl && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Source
          </p>
          <a
            href={memory.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            {memory.sourceUrl}
          </a>
        </div>
      )}

      {/* Tags */}
      {memory.tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="size-3" />
            Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {memory.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2.5 py-1 h-7 font-normal bg-[#6D597A]/10 text-[#6D597A] border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Collections */}
      {memory.collections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="size-3" />
            Collections
          </p>
          <div className="flex flex-wrap gap-2">
            {memory.collections.map((col) => (
              <Badge
                key={col.id}
                variant="secondary"
                className="text-xs px-2.5 py-1 h-7 font-normal border-0 gap-1.5"
                style={{
                  backgroundColor: `${col.color}15`,
                  color: col.color,
                }}
              >
                <span className="text-[10px]">{col.icon || '📁'}</span>
                {col.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {memory.summary && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            AI Summary
          </p>
          <Card className={cn(
            isDark
              ? 'bg-purple-500/5 border border-purple-500/10'
              : 'bg-[#6D597A]/5 border-0'
          )}>
            <CardContent className="p-4">
              <p className={cn('text-sm leading-relaxed italic', isDark ? 'text-white/50' : 'text-foreground/80')}>
                {memory.summary}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { setCurrentView, setSearchQuery, setFilterType } = useAetherStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="size-20 rounded-2xl bg-[#6D597A]/10 flex items-center justify-center mb-6">
        <BookOpen className="size-10 text-[#6D597A]/40" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        {hasFilters ? 'No memories found' : 'No memories yet'}
      </h3>

      <p className="text-sm text-muted-foreground max-w-[260px] mb-6">
        {hasFilters
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'Start capturing your thoughts, links, and ideas.'}
      </p>

      {hasFilters ? (
        <Button
          variant="outline"
          onClick={() => {
            setSearchQuery('')
            setFilterType('all')
          }}
          className="gap-2"
        >
          <X className="size-4" />
          Clear Filters
        </Button>
      ) : (
        <Button
          onClick={() => setCurrentView('dashboard')}
          className="gap-2 bg-gradient-to-r from-primary to-[#8B6F9A] text-primary-foreground hover:opacity-90 shadow-md"
        >
          <Plus className="size-4" />
          Add Your First Memory
        </Button>
      )}
    </motion.div>
  )
}

// ─── Main Memories Component ────────────────────────────────────────
export function Memories() {
  const {
    memories,
    collections,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    selectedMemoryId,
    setSelectedMemoryId,
    selectedCollectionId,
    setSelectedCollectionId,
    deleteMemory,
    updateMemory,
    setCurrentView,
  } = useAetherStore()

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Filtered memories ────────────────────────────────────────────
  const filteredMemories = useMemo(() => {
    let result = [...memories]

    // Filter by selected collection
    if (selectedCollectionId) {
      result = result.filter((m) =>
        m.collections.some((c) => c.id === selectedCollectionId)
      )
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((m) => m.type === filterType)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    // Sort by date (newest first)
    result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return result
  }, [memories, searchQuery, filterType, selectedCollectionId])

  // ── Selected memory ──────────────────────────────────────────────
  const selectedMemory = useMemo(
    () => memories.find((m) => m.id === selectedMemoryId) || null,
    [memories, selectedMemoryId]
  )

  // ── Selected collection name ─────────────────────────────────────
  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId) || null,
    [collections, selectedCollectionId]
  )

  // ── Handlers ─────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback(
    async (memory: Memory) => {
      const newFavorite = !memory.isFavorite
      // Optimistic update
      updateMemory(memory.id, { isFavorite: newFavorite })
      try {
        await fetch(`/api/memories/${memory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: newFavorite }),
        })
      } catch {
        // Revert on error
        updateMemory(memory.id, { isFavorite: !newFavorite })
      }
    },
    [updateMemory]
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/memories/${deleteTarget}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        deleteMemory(deleteTarget)
        if (selectedMemoryId === deleteTarget) {
          setSelectedMemoryId(null)
        }
      }
    } catch {
      // Handle error silently
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteMemory, selectedMemoryId, setSelectedMemoryId])

  const handleBack = useCallback(() => {
    setSelectedMemoryId(null)
  }, [setSelectedMemoryId])

  const hasFilters = searchQuery.trim() !== '' || filterType !== 'all' || !!selectedCollectionId

  return (
    <div className="max-w-3xl mx-auto pb-24 md:pb-8">
      <AnimatePresence mode="wait">
        {selectedMemory ? (
          /* ── Detail View ──────────────────────────────────────────── */
          <MemoryDetail
            key="detail"
            memory={selectedMemory}
            onBack={handleBack}
            onToggleFavorite={() => handleToggleFavorite(selectedMemory)}
            onDelete={() => setDeleteTarget(selectedMemory.id)}
          />
        ) : (
          /* ── List View ────────────────────────────────────────────── */
          <motion.div
            key="list"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* ── Header ────────────────────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <BookOpen className="size-7 text-[#6D597A]" />
                    Memories
                    {selectedCollection && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-2.5 py-1 h-7 font-medium border-0 gap-1.5 ml-1"
                        style={{
                          backgroundColor: `${selectedCollection.color}15`,
                          color: selectedCollection.color,
                        }}
                      >
                        <span className="text-[10px]">{selectedCollection.icon}</span>
                        {selectedCollection.name}
                        <button
                          onClick={() => setSelectedCollectionId(null)}
                          className="ml-0.5 size-4 rounded-full hover:bg-black/10 flex items-center justify-center"
                          aria-label="Clear collection filter"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredMemories.length}{' '}
                    {filteredMemories.length === 1 ? 'memory' : 'memories'}
                  </p>
                </div>

                <Button
                  onClick={() => setCurrentView('dashboard')}
                  className="gap-2 bg-gradient-to-r from-primary to-[#8B6F9A] text-primary-foreground hover:opacity-90 shadow-md"
                  size="sm"
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </div>
            </motion.div>

            {/* ── Search Bar ────────────────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search memories by title, content, or tags..."
                  className="h-10 pl-9 pr-9 text-sm bg-card border-0 shadow-sm
                    focus-visible:ring-primary/30 focus-visible:border-primary/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </motion.div>

            {/* ── Filter Pills ─────────────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {filterOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = filterType === option.type
                  return (
                    <button
                      key={option.type}
                      onClick={() => setFilterType(option.type)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap',
                        'transition-all duration-150 hover:shadow-sm active:scale-[0.97]',
                        'border',
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      <Icon className="size-3.5" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </motion.div>

            {/* ── Memory List ───────────────────────────────────────── */}
            {filteredMemories.length === 0 ? (
              <EmptyState hasFilters={hasFilters} />
            ) : (
              <div className="max-h-[calc(100dvh-18rem)] md:max-h-[calc(100dvh-14rem)] overflow-y-auto pr-1 space-y-2.5">
                {filteredMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => setSelectedMemoryId(memory.id)}
                    onToggleFavorite={() => handleToggleFavorite(memory)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this memory? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

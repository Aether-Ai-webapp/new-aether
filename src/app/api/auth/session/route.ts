import { NextResponse } from 'next/server'

// GET /api/auth/session - Get current auth session
export async function GET() {
  // If Supabase isn't configured, return unauthenticated immediately (silent)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ user: null, authenticated: false })
  }
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ user: null, authenticated: false })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        avatarUrl: user.user_metadata?.avatar_url || null,
      },
      authenticated: true,
    })
  } catch {
    return NextResponse.json({ user: null, authenticated: false })
  }
}

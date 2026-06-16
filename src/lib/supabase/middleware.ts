import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase session refresh middleware.
 *
 * Gracefully no-ops when Supabase is not configured (Prisma-only mode),
 * so the app still works end-to-end without Supabase env vars.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // No Supabase config → run in Prisma-only mode, just pass the request through.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  try {
    // Refresh the session
    const { data: { user } } = await supabase.auth.getUser()

    // Protect API routes - allow through for now, auth is optional
    // If user is not signed in and the route starts with /api/protected,
    // redirect to login
    if (!user && request.nextUrl.pathname.startsWith('/api/protected')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } catch {
    // Supabase call failed (network/config issue) — don't break the request.
    // App falls back to Prisma-only auth.
  }

  return supabaseResponse
}

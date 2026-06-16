import { NextResponse } from 'next/server'

// GET /api/setup/supabase - Check if Supabase tables exist
export async function GET() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        connected: false,
        authenticated: false,
        tablesExist: false,
        error: 'Not authenticated',
      })
    }

    // Try to query the memories table to see if it exists
    const { error: memoriesError } = await supabase
      .from('memories')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    const { error: collectionsError } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    const tablesExist = !memoriesError && !collectionsError

    return NextResponse.json({
      connected: true,
      authenticated: true,
      tablesExist,
      userId: user.id,
      errors: {
        memories: memoriesError?.message || null,
        collections: collectionsError?.message || null,
      },
    })
  } catch (error) {
    console.error('Supabase setup check failed:', error)
    return NextResponse.json({
      connected: false,
      authenticated: false,
      tablesExist: false,
      error: 'Failed to check Supabase setup',
    })
  }
}

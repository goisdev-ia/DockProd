import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Confirma signup via token_hash (template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/login'

  if (token_hash && type) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      const url = request.nextUrl.clone()
      url.pathname = next.startsWith('/') ? next : `/${next}`
      url.searchParams.delete('token_hash')
      url.searchParams.delete('type')
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
    console.error('auth/confirm verifyOtp:', error)
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('erro', 'Link de confirmação inválido ou expirado. Tente fazer login com sua senha.')
  return NextResponse.redirect(url)
}

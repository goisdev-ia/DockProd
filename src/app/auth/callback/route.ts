import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Troca o código de confirmação (PKCE) por sessão e redireciona.
 * Configure no Supabase Auth: Redirect URLs = http://localhost:3000/auth/callback
 * E no template de email: {{ .SiteURL }}/auth/callback?code={{ .Code }}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/login'

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const url = request.nextUrl.clone()
      url.pathname = next.startsWith('/') ? next : `/${next}`
      url.searchParams.delete('code')
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
    console.error('auth/callback exchangeCodeForSession:', error)
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('erro', 'Falha ao confirmar email. Tente fazer login com sua senha.')
  return NextResponse.redirect(url)
}
